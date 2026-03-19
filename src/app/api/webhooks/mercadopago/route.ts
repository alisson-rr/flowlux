import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || "";
const mpWebhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET || "";

// Helper to fetch data from Mercado Pago API
async function mpFetch(endpoint: string) {
  try {
    const res = await fetch(`https://api.mercadopago.com${endpoint}`, {
      headers: { Authorization: `Bearer ${mpAccessToken}` },
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[mp-webhook] MP API error ${res.status}: ${errorText}`);
      return null;
    }
    return res.json();
  } catch (err) {
    console.error("[mp-webhook] MP API fetch error:", err);
    return null;
  }
}

// Validate Mercado Pago webhook signature
// Reference: https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks
function validateSignature(req: NextRequest, body: string): boolean {
  if (!mpWebhookSecret) {
    console.warn("[mp-webhook] No MERCADOPAGO_WEBHOOK_SECRET configured, skipping validation");
    return true;
  }

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  if (!xSignature || !xRequestId) {
    console.error("[mp-webhook] Missing x-signature or x-request-id headers");
    return false;
  }

  // Parse x-signature header: "ts=...,v1=..."
  const parts: Record<string, string> = {};
  xSignature.split(",").forEach((part) => {
    const [key, ...valueParts] = part.split("=");
    if (key && valueParts.length > 0) parts[key.trim()] = valueParts.join("=").trim();
  });

  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) {
    console.error("[mp-webhook] Missing ts or v1 in x-signature:", xSignature);
    return false;
  }

  // CRITICAL: data.id must come from the QUERY PARAMETER, not the body
  // Mercado Pago computes the signature using the query parameter value
  const dataId = req.nextUrl.searchParams.get("data.id") || req.nextUrl.searchParams.get("id") || "";

  // Build the manifest string according to MP docs
  // Only include id: part if dataId is present
  let manifest = "";
  if (dataId) manifest += `id:${dataId};`;
  manifest += `request-id:${xRequestId};`;
  if (ts) manifest += `ts:${ts};`;

  const hmac = crypto.createHmac("sha256", mpWebhookSecret).update(manifest).digest("hex");

  if (hmac !== v1) {
    console.error("[mp-webhook] Signature mismatch", {
      manifest,
      expected: v1,
      computed: hmac,
      dataId,
    });
    return false;
  }

  return true;
}

// Find user by ID or email efficiently
async function findUserId(
  supabase: any,
  externalReference: string,
  payerEmail: string
): Promise<string | null> {
  // 1. Try external_reference (this is the user_id we set when creating the subscription)
  if (externalReference) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", externalReference)
      .single();
    if (profile) {
      console.log("[mp-webhook] Found user by external_reference:", externalReference);
      return (profile as any).id;
    }
  }

  if (!payerEmail) return null;
  const emailLower = payerEmail.toLowerCase();

  // 2. Find user by email in profiles table
  const { data: profileByEmail } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", emailLower)
    .limit(1)
    .single();
  if (profileByEmail) {
    console.log("[mp-webhook] Found user by email in profiles");
    return (profileByEmail as any).id;
  }

  // 3. Find user by email in auth.users using admin API (efficient single-user lookup)
  try {
    const { data, error } = await supabase.rpc("get_user_id_by_email", { email_input: emailLower }) as any;
    if (!error && data) {
      console.log("[mp-webhook] Found user by email via RPC");
      return data;
    }
  } catch {
    // RPC might not exist, fallback below
  }

  // 4. Last resort: list users with filter (paginated, limited)
  try {
    const { data: userList } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 50,
    });
    const matchedUser = (userList as any)?.users?.find(
      (u: any) => u.email?.toLowerCase() === emailLower
    );
    if (matchedUser) {
      console.log("[mp-webhook] Found user by email in auth.users list");
      return matchedUser.id;
    }
  } catch (err) {
    console.error("[mp-webhook] Error listing users:", err);
  }

  return null;
}

// Map Mercado Pago preapproval_plan_id to our plan_id
const MP_PLAN_TO_PLAN: Record<string, string> = {
  "2a69ac12835b4077bbf7279faa7d61c6": "starter",
  "d9bbcdeb8cdd488994afa7c88d94f75e": "pro",
  "e54d3d648c9045d3ac50101e493e8e84": "black",
};

function detectPlanId(preapproval: any): string {
  // 1. Try to match by preapproval_plan_id
  if (preapproval.preapproval_plan_id) {
    const plan = MP_PLAN_TO_PLAN[preapproval.preapproval_plan_id];
    if (plan) return plan;
  }

  // 2. Fallback: detect by amount
  const amount = preapproval.auto_recurring?.transaction_amount || 0;
  if (amount >= 65) return "pro";
  if (amount >= 55) return "black";
  return "starter";
}

export async function POST(req: NextRequest) {
  try {
    // Verify service role key is configured
    if (!supabaseServiceKey) {
      console.error("[mp-webhook] SUPABASE_SERVICE_ROLE_KEY not configured!");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const rawBody = await req.text();

    // Validate webhook signature
    if (!validateSignature(req, rawBody)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.error("[mp-webhook] Invalid JSON body");
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Support both query params and body for event type/data
    const eventType = body.type || req.nextUrl.searchParams.get("type") || req.nextUrl.searchParams.get("topic") || "";
    const eventAction = body.action || "";
    const dataId = String(body.data?.id || req.nextUrl.searchParams.get("data.id") || req.nextUrl.searchParams.get("id") || "");

    console.log("[mp-webhook] Received:", { eventType, eventAction, dataId, bodyType: body.type });

    if (!dataId) {
      console.warn("[mp-webhook] No data.id found, acknowledging webhook");
      return NextResponse.json({ success: true, message: "No data.id" });
    }

    // Log the webhook
    await supabase.from("mp_webhooks").insert({
      event_type: eventType,
      event_action: eventAction,
      mp_id: dataId,
      payload: body,
      processed: false,
    });

    // ========================================
    // Handle subscription (preapproval) events
    // ========================================
    if (eventType === "subscription_preapproval" && dataId) {
      const preapproval = await mpFetch(`/preapproval/${dataId}`);

      if (!preapproval) {
        console.error("[mp-webhook] Could not fetch preapproval data for:", dataId);
        // Return 500 so MP retries
        return NextResponse.json({ error: "Failed to fetch preapproval" }, { status: 500 });
      }

      console.log("[mp-webhook] Preapproval data:", {
        status: preapproval.status,
        external_reference: preapproval.external_reference,
        payer_email: preapproval.payer_email,
        preapproval_plan_id: preapproval.preapproval_plan_id,
      });

      const payerEmail = preapproval.payer_email || "";
      const payerId = preapproval.payer_id ? String(preapproval.payer_id) : "";
      const mpStatus = preapproval.status || "";
      const startDate = preapproval.date_created || null;
      const nextPaymentDate = preapproval.next_payment_date || null;
      const externalReference = preapproval.external_reference || "";

      // Find the user
      const userId = await findUserId(supabase, externalReference, payerEmail);

      if (!userId) {
        console.error("[mp-webhook] Could not find user!", { externalReference, payerEmail });
        // Return 500 so MP retries (user might not be fully registered yet)
        return NextResponse.json({ error: "User not found" }, { status: 500 });
      }

      console.log("[mp-webhook] User resolved:", userId, "MP Status:", mpStatus);

      // Detect plan from preapproval data
      const detectedPlanId = detectPlanId(preapproval);

      // Check if subscription already exists with this mp_preapproval_id
      const { data: existing } = await supabase
        .from("subscriptions")
        .select("id, status, plan_id")
        .eq("mp_preapproval_id", dataId)
        .single();

      if (existing) {
        // --- Update existing subscription based on MP status ---
        const updates: Record<string, any> = {
          mp_payer_email: payerEmail,
          mp_payer_id: payerId,
        };
        if (nextPaymentDate) updates.current_period_end = nextPaymentDate;
        if (startDate && !existing.status.includes("active")) updates.current_period_start = startDate;

        if (mpStatus === "authorized") {
          if (existing.status === "pending_payment" || existing.status === "pending") {
            updates.status = "trial";
            updates.trial_start = new Date().toISOString().split("T")[0];
            updates.trial_end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
          } else if (existing.status === "trial" || existing.status === "active" || existing.status === "authorized") {
            // Already active/trial, keep current status
          } else {
            // Re-activated from paused/cancelled
            updates.status = "active";
          }
        } else if (mpStatus === "paused") {
          updates.status = "paused";
        } else if (mpStatus === "cancelled") {
          updates.status = "cancelled";
          updates.cancelled_at = new Date().toISOString();
        }
        // If mpStatus is "pending", keep current status

        const { error: updateError } = await supabase
          .from("subscriptions")
          .update(updates)
          .eq("id", existing.id);

        if (updateError) {
          console.error("[mp-webhook] Error updating subscription:", updateError);
        } else {
          console.log("[mp-webhook] Subscription updated:", existing.id, updates);
        }
      } else {
        // No subscription with this mp_preapproval_id yet
        // Try to match with a pending subscription for this user
        const { data: pendingSub } = await supabase
          .from("subscriptions")
          .select("id, status, plan_id")
          .eq("user_id", userId)
          .in("status", ["pending_payment", "pending"])
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (pendingSub) {
          const updates: Record<string, any> = {
            mp_preapproval_id: dataId,
            mp_payer_id: payerId,
            mp_payer_email: payerEmail,
            current_period_start: startDate,
            current_period_end: nextPaymentDate,
          };

          if (mpStatus === "authorized") {
            updates.status = "trial";
            updates.trial_start = new Date().toISOString().split("T")[0];
            updates.trial_end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
          } else if (mpStatus === "cancelled") {
            updates.status = "cancelled";
            updates.cancelled_at = new Date().toISOString();
          } else if (mpStatus === "paused") {
            updates.status = "paused";
          }

          const { error: updateError } = await supabase
            .from("subscriptions")
            .update(updates)
            .eq("id", pendingSub.id);

          if (updateError) {
            console.error("[mp-webhook] Error updating pending subscription:", updateError);
          } else {
            console.log("[mp-webhook] Pending subscription updated:", pendingSub.id, updates);
          }
        } else {
          // No pending subscription found — create new one
          const newSub: Record<string, any> = {
            user_id: userId,
            plan_id: detectedPlanId,
            mp_preapproval_id: dataId,
            mp_payer_id: payerId,
            mp_payer_email: payerEmail,
            current_period_start: startDate,
            current_period_end: nextPaymentDate,
            status: "pending_payment",
          };

          if (mpStatus === "authorized") {
            newSub.status = "trial";
            newSub.trial_start = new Date().toISOString().split("T")[0];
            newSub.trial_end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
          }

          const { error: insertError } = await supabase.from("subscriptions").insert(newSub);

          if (insertError) {
            console.error("[mp-webhook] Error creating subscription:", insertError);
          } else {
            console.log("[mp-webhook] New subscription created for user:", userId);
          }
        }
      }

      // Mark webhook as processed
      await supabase
        .from("mp_webhooks")
        .update({ processed: true })
        .eq("mp_id", dataId)
        .eq("event_type", eventType)
        .is("processed", false);
    }

    // ========================================
    // Handle payment events
    // ========================================
    if ((eventType === "payment" || eventType === "subscription_authorized_payment") && dataId) {
      const payment = await mpFetch(`/v1/payments/${dataId}`);

      if (!payment) {
        console.error("[mp-webhook] Could not fetch payment data for:", dataId);
        return NextResponse.json({ error: "Failed to fetch payment" }, { status: 500 });
      }

      const payerEmail = payment.payer?.email || "";
      const mpPaymentStatus = payment.status || "";
      const amount = payment.transaction_amount || 0;
      const currency = payment.currency_id || "BRL";
      const paymentMethod = payment.payment_type_id || "";
      const description = payment.description || "Pagamento FlowLux";
      const paidAt = payment.date_approved || payment.date_created || null;
      const externalReference = payment.external_reference || "";

      console.log("[mp-webhook] Payment data:", {
        status: mpPaymentStatus,
        amount,
        externalReference,
        payerEmail,
      });

      // Find user
      const userId = await findUserId(supabase, externalReference, payerEmail);

      if (!userId) {
        console.error("[mp-webhook] Could not find user for payment!", { externalReference, payerEmail });
        return NextResponse.json({ error: "User not found for payment" }, { status: 500 });
      }

      // Find subscription for this user (prefer by mp_preapproval related, fallback to latest)
      let subId: string | null = null;
      let subStatus: string | null = null;

      // Try to find subscription linked to this payment's metadata
      if (payment.metadata?.preapproval_id) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id, status")
          .eq("mp_preapproval_id", String(payment.metadata.preapproval_id))
          .single();
        if (sub) {
          subId = sub.id;
          subStatus = sub.status;
        }
      }

      // Fallback: find the most recent active/trial/pending subscription for this user
      if (!subId) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id, status")
          .eq("user_id", userId)
          .in("status", ["active", "authorized", "trial", "pending_payment", "pending"])
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (sub) {
          subId = sub.id;
          subStatus = sub.status;
        }
      }

      // Last fallback: any subscription for this user
      if (!subId) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id, status")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (sub) {
          subId = sub.id;
          subStatus = sub.status;
        }
      }

      // Insert payment record (with deduplication check)
      const { data: existingPayment } = await supabase
        .from("subscription_payments")
        .select("id")
        .eq("mp_payment_id", dataId)
        .single();

      if (!existingPayment) {
        const { error: payInsertError } = await supabase.from("subscription_payments").insert({
          user_id: userId,
          subscription_id: subId,
          mp_payment_id: dataId,
          status: mpPaymentStatus,
          amount,
          currency,
          payment_method: paymentMethod,
          description,
          paid_at: paidAt,
        });
        if (payInsertError) {
          console.error("[mp-webhook] Error inserting payment:", payInsertError);
        } else {
          console.log("[mp-webhook] Payment recorded:", dataId);
        }
      } else {
        // Update existing payment record
        await supabase
          .from("subscription_payments")
          .update({ status: mpPaymentStatus, paid_at: paidAt })
          .eq("mp_payment_id", dataId);
        console.log("[mp-webhook] Payment updated (dedup):", dataId);
      }

      // If payment approved, ensure subscription is active
      if (mpPaymentStatus === "approved" && subId) {
        const { error: subUpdateError } = await supabase
          .from("subscriptions")
          .update({ status: "active" })
          .eq("id", subId)
          .in("status", ["trial", "pending_payment", "pending", "authorized"]);
        if (!subUpdateError) {
          console.log("[mp-webhook] Subscription activated via payment:", subId);
        }
      }

      // Mark webhook as processed
      await supabase
        .from("mp_webhooks")
        .update({ processed: true })
        .eq("mp_id", dataId)
        .eq("event_type", eventType)
        .is("processed", false);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[mp-webhook] Unexpected error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// GET endpoint for webhook health check and verification
export async function GET() {
  return NextResponse.json({ status: "ok", service: "mercadopago-webhook" });
}
