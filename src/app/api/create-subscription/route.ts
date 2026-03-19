import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || "";

// Plan configurations with pricing for Mercado Pago auto_recurring
const PLAN_CONFIG: Record<string, { name: string; amount: number; frequency: number; frequency_type: string }> = {
  starter: {
    name: "FlowLux Starter",
    amount: 49,
    frequency: 1,
    frequency_type: "months",
  },
  pro: {
    name: "FlowLux Pro",
    amount: 69,
    frequency: 1,
    frequency_type: "months",
  },
  black: {
    name: "FlowLux Black",
    amount: 59,
    frequency: 1,
    frequency_type: "months",
  },
};

// Fallback: generic MP checkout links (preapproval_plan_id based)
const MP_GENERIC_LINKS: Record<string, string> = {
  starter: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=2a69ac12835b4077bbf7279faa7d61c6",
  pro: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=d9bbcdeb8cdd488994afa7c88d94f75e",
  black: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=e54d3d648c9045d3ac50101e493e8e84",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { plan_id, user_id, user_email, back_url } = body;

    console.log("[create-subscription] Request:", { plan_id, user_id, user_email: user_email ? "***" : "MISSING", back_url });

    if (!plan_id || !user_id || !user_email) {
      return NextResponse.json({ error: "Missing required fields: plan_id, user_id, user_email" }, { status: 400 });
    }

    const planConfig = PLAN_CONFIG[plan_id];
    if (!planConfig) {
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

      const { error: dbError } = await supabase.from("subscriptions").insert({
        user_id,
        plan_id,
        status: "pending_payment",
        mp_payer_email: user_email,
      });
      if (dbError) console.error("[create-subscription] DB insert error (fallback):", dbError);

      return NextResponse.json({
        init_point: MP_GENERIC_LINKS[plan_id],
        fallback: true,
      });
    }

    // Create subscription via Mercado Pago API
    // Using subscription WITHOUT associated plan (no preapproval_plan_id)
    // This returns an init_point (checkout link) where the user enters card details
    // Reference: https://www.mercadopago.com.br/developers/en/docs/subscriptions/integration-configuration/subscription-no-associated-plan
    const mpPayload = {
      reason: planConfig.name,
      external_reference: user_id,
      payer_email: user_email,
      auto_recurring: {
        frequency: planConfig.frequency,
        frequency_type: planConfig.frequency_type,
        transaction_amount: planConfig.amount,
        currency_id: "BRL",
      },
      back_url: back_url || "https://flowlux.vercel.app/assinatura/sucesso",
      status: "pending",
    };

    console.log("[create-subscription] Calling MP API (no plan):", {
      reason: mpPayload.reason,
      amount: mpPayload.auto_recurring.transaction_amount,
      external_reference: user_id,
    });

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

      // Fallback to generic link
      const { error: dbError } = await supabase.from("subscriptions").insert({
        user_id,
        plan_id,
        status: "pending_payment",
        mp_payer_email: user_email,
      });
      if (dbError) console.error("[create-subscription] DB insert error (fallback):", dbError);

      return NextResponse.json({
        init_point: MP_GENERIC_LINKS[plan_id],
        fallback: true,
        mp_error: mpData.message || mpData.error || "MP API error",
      });
    }

    // Success: MP returned init_point (checkout link)
    const { error: dbError } = await supabase.from("subscriptions").insert({
      user_id,
      plan_id,
      status: "pending_payment",
      mp_preapproval_id: mpData.id,
      mp_payer_email: user_email,
    });

    if (dbError) {
      console.error("[create-subscription] DB insert error:", dbError);
    }

    console.log("[create-subscription] Success! MP ID:", mpData.id, "init_point generated");

    return NextResponse.json({
      init_point: mpData.init_point,
      mp_id: mpData.id,
    });
  } catch (err: any) {
    console.error("[create-subscription] Unexpected error:", err);
    return NextResponse.json({ error: "Erro interno: " + String(err.message || err) }, { status: 500 });
  }
}
