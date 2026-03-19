import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || "";

// Map plan IDs to Mercado Pago preapproval_plan_id
const MP_PLAN_IDS: Record<string, string> = {
  starter: "2a69ac12835b4077bbf7279faa7d61c6",
  pro: "d9bbcdeb8cdd488994afa7c88d94f75e",
  black: "e54d3d648c9045d3ac50101e493e8e84",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { plan_id, user_id, user_email, back_url } = body;

    console.log("[create-subscription] Request:", { plan_id, user_id, user_email: user_email ? "***" : "MISSING", back_url });

    if (!plan_id || !user_id || !user_email) {
      console.error("[create-subscription] Missing required fields:", { plan_id: !!plan_id, user_id: !!user_id, user_email: !!user_email });
      return NextResponse.json({ error: "Missing required fields: plan_id, user_id, user_email" }, { status: 400 });
    }

    const mpPlanId = MP_PLAN_IDS[plan_id];
    if (!mpPlanId) {
      console.error("[create-subscription] Invalid plan_id:", plan_id);
      return NextResponse.json({ error: `Invalid plan_id: ${plan_id}` }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user already has an active subscription
    const { data: activeSub } = await supabase
      .from("subscriptions")
      .select("id, plan_id, status")
      .eq("user_id", user_id)
      .in("status", ["active", "authorized", "trial"])
      .limit(1)
      .single();

    if (activeSub) {
      console.warn("[create-subscription] User already has active subscription:", activeSub.id);
      return NextResponse.json({
        error: "Você já possui uma assinatura ativa.",
        existing_plan: activeSub.plan_id,
        existing_status: activeSub.status,
      }, { status: 409 });
    }

    // Clean up old broken pending subscriptions (no MP data)
    await supabase
      .from("subscriptions")
      .delete()
      .eq("user_id", user_id)
      .in("status", ["pending", "pending_payment"])
      .is("mp_preapproval_id", null);

    // Check if MP access token is configured
    if (!mpAccessToken) {
      console.error("[create-subscription] MERCADOPAGO_ACCESS_TOKEN not configured");

      // Create subscription record as pending_payment
      const { error: dbError } = await supabase.from("subscriptions").insert({
        user_id,
        plan_id,
        status: "pending_payment",
        mp_payer_email: user_email,
      });

      if (dbError) console.error("[create-subscription] DB insert error (fallback):", dbError);

      // Fallback: redirect to generic MP checkout
      const genericLink = `https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=${mpPlanId}`;

      return NextResponse.json({
        init_point: genericLink,
        fallback: true,
        warning: "MP API not configured. external_reference not set - webhook matching will use email only.",
      });
    }

    // Create subscription via Mercado Pago API with external_reference
    const mpPayload = {
      preapproval_plan_id: mpPlanId,
      external_reference: user_id,
      payer_email: user_email,
      back_url: back_url || "https://flowlux.vercel.app/assinatura/sucesso",
      status: "pending",
    };
    console.log("[create-subscription] Calling MP API:", { ...mpPayload, payer_email: "***" });

    const mpResponse = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mpAccessToken}`,
      },
      body: JSON.stringify(mpPayload),
    });

    const mpData = await mpResponse.json();
    console.log("[create-subscription] MP API response:", {
      status: mpResponse.status,
      id: mpData.id,
      init_point: mpData.init_point ? "present" : "MISSING",
      mpStatus: mpData.status,
    });

    if (!mpResponse.ok || !mpData.init_point) {
      console.error("[create-subscription] MP API error:", JSON.stringify(mpData));

      // Create subscription record and return generic link as fallback
      const { error: dbError } = await supabase.from("subscriptions").insert({
        user_id,
        plan_id,
        status: "pending_payment",
        mp_payer_email: user_email,
      });
      if (dbError) console.error("[create-subscription] DB insert error (MP fail fallback):", dbError);

      const genericLink = `https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=${mpPlanId}`;

      return NextResponse.json({
        init_point: genericLink,
        fallback: true,
        mp_error: mpData.message || mpData.error || "MP API error",
      });
    }

    // Success: create subscription record with MP preapproval ID
    const { error: dbError } = await supabase.from("subscriptions").insert({
      user_id,
      plan_id,
      status: "pending_payment",
      mp_preapproval_id: mpData.id || null,
      mp_payer_email: user_email,
    });

    if (dbError) {
      console.error("[create-subscription] DB insert error:", dbError);
      // Still return the init_point — the webhook will handle creating the subscription later
    }

    console.log("[create-subscription] Success! MP ID:", mpData.id);

    return NextResponse.json({
      init_point: mpData.init_point,
      mp_id: mpData.id,
    });
  } catch (err: any) {
    console.error("[create-subscription] Unexpected error:", err);
    return NextResponse.json({ error: "Erro interno: " + String(err.message || err) }, { status: 500 });
  }
}
