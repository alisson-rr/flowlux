import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || "";
const mpWebhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET || "";

// Helper to fetch data from Mercado Pago API
async function mpFetch(endpoint: string) {
  const res = await fetch(`https://api.mercadopago.com${endpoint}`, {
    headers: { Authorization: `Bearer ${mpAccessToken}` },
  });
  if (!res.ok) {
    console.error(`MP API error: ${res.status} ${res.statusText}`);
    return null;
  }
  return res.json();
}

// Validate Mercado Pago webhook signature
function validateSignature(req: NextRequest, rawBody: string): boolean {
  if (!mpWebhookSecret) return true; // Skip if no secret configured

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  if (!xSignature || !xRequestId) return false;

  // Parse x-signature header: "ts=...,v1=..."
  const parts: Record<string, string> = {};
  xSignature.split(",").forEach((part) => {
    const [key, value] = part.split("=");
    if (key && value) parts[key.trim()] = value.trim();
  });

  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  // Get data_id from body
  const dataId = JSON.parse(rawBody)?.data?.id || "";

  // Build the manifest string
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const hmac = crypto.createHmac("sha256", mpWebhookSecret).update(manifest).digest("hex");

  return hmac === v1;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Validate webhook signature
    if (mpWebhookSecret && !validateSignature(req, rawBody)) {
      console.error("Invalid Mercado Pago webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const eventType = body.type || "";
    const eventAction = body.action || "";
    const dataId = body.data?.id || "";

    // Log the webhook
    await supabase.from("mp_webhooks").insert({
      event_type: eventType,
      event_action: eventAction,
      mp_id: String(dataId),
      payload: body,
      processed: false,
    });

    // Handle subscription (preapproval) events
    if (eventType === "subscription_preapproval" && dataId) {
      const preapproval = await mpFetch(`/preapproval/${dataId}`);

      if (preapproval) {
        const payerEmail = preapproval.payer_email || "";
        const payerId = preapproval.payer_id ? String(preapproval.payer_id) : "";
        const mpStatus = preapproval.status || ""; // authorized, paused, cancelled, pending
        const startDate = preapproval.date_created || null;
        const nextPaymentDate = preapproval.next_payment_date || null;

        // Map MP status to our status
        let appStatus = "pending";
        if (mpStatus === "authorized") appStatus = "active";
        else if (mpStatus === "paused") appStatus = "paused";
        else if (mpStatus === "cancelled") appStatus = "cancelled";
        else if (mpStatus === "pending") appStatus = "pending";

        // Find user by email in profiles or auth
        let userId: string | null = null;

        if (payerEmail) {
          // Try to find user by email in auth.users via admin
          const { data: users } = await supabase.auth.admin.listUsers();
          const matchedUser = users?.users?.find(
            (u) => u.email?.toLowerCase() === payerEmail.toLowerCase()
          );
          if (matchedUser) userId = matchedUser.id;
        }

        if (userId) {
          // Check if subscription already exists with this mp_preapproval_id
          const { data: existing } = await supabase
            .from("subscriptions")
            .select("id, status")
            .eq("mp_preapproval_id", String(dataId))
            .single();

          if (existing) {
            // Update existing subscription
            const updates: Record<string, any> = {
              status: appStatus,
              mp_payer_email: payerEmail,
              mp_payer_id: payerId,
            };
            if (nextPaymentDate) updates.current_period_end = nextPaymentDate;
            if (mpStatus === "cancelled") updates.cancelled_at = new Date().toISOString();

            await supabase
              .from("subscriptions")
              .update(updates)
              .eq("id", existing.id);
          } else {
            // Try to match with a pending subscription for this user
            const { data: pendingSub } = await supabase
              .from("subscriptions")
              .select("id")
              .eq("user_id", userId)
              .eq("status", "pending")
              .order("created_at", { ascending: false })
              .limit(1)
              .single();

            if (pendingSub) {
              await supabase
                .from("subscriptions")
                .update({
                  mp_preapproval_id: String(dataId),
                  mp_payer_id: payerId,
                  mp_payer_email: payerEmail,
                  status: appStatus,
                  current_period_start: startDate,
                  current_period_end: nextPaymentDate,
                })
                .eq("id", pendingSub.id);
            } else {
              // Determine plan from preapproval amount
              const amount = preapproval.auto_recurring?.transaction_amount || 0;
              const planId = amount > 150 ? "professional" : "starter";

              // Create new subscription
              await supabase.from("subscriptions").insert({
                user_id: userId,
                plan_id: planId,
                status: appStatus,
                mp_preapproval_id: String(dataId),
                mp_payer_id: payerId,
                mp_payer_email: payerEmail,
                trial_start: new Date().toISOString().split("T")[0],
                trial_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                current_period_start: startDate,
                current_period_end: nextPaymentDate,
              });
            }
          }
        }

        // Mark webhook as processed
        await supabase
          .from("mp_webhooks")
          .update({ processed: true })
          .eq("mp_id", String(dataId))
          .eq("event_type", eventType)
          .is("processed", false);
      }
    }

    // Handle payment events
    if (eventType === "payment" && dataId) {
      const payment = await mpFetch(`/v1/payments/${dataId}`);

      if (payment) {
        const payerEmail = payment.payer?.email || "";
        const mpPaymentStatus = payment.status || ""; // approved, pending, in_process, rejected, refunded, cancelled
        const amount = payment.transaction_amount || 0;
        const currency = payment.currency_id || "BRL";
        const paymentMethod = payment.payment_type_id || "";
        const description = payment.description || "Pagamento FlowLux";
        const paidAt = payment.date_approved || payment.date_created || null;

        // Find user
        let userId: string | null = null;
        if (payerEmail) {
          const { data: users } = await supabase.auth.admin.listUsers();
          const matchedUser = users?.users?.find(
            (u) => u.email?.toLowerCase() === payerEmail.toLowerCase()
          );
          if (matchedUser) userId = matchedUser.id;
        }

        if (userId) {
          // Find subscription for this user
          const { data: sub } = await supabase
            .from("subscriptions")
            .select("id")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          // Insert payment record
          await supabase.from("subscription_payments").insert({
            user_id: userId,
            subscription_id: sub?.id || null,
            mp_payment_id: String(dataId),
            status: mpPaymentStatus,
            amount,
            currency,
            payment_method: paymentMethod,
            description,
            paid_at: paidAt,
          });

          // If payment approved, ensure subscription is active
          if (mpPaymentStatus === "approved" && sub) {
            await supabase
              .from("subscriptions")
              .update({ status: "active" })
              .eq("id", sub.id);
          }
        }

        // Mark webhook as processed
        await supabase
          .from("mp_webhooks")
          .update({ processed: true })
          .eq("mp_id", String(dataId))
          .eq("event_type", eventType)
          .is("processed", false);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Mercado Pago webhook error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", service: "mercadopago-webhook" });
}
