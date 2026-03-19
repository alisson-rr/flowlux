import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || "";

// Plan configurations
// Starter & Pro: monthly subscriptions via Preapproval API
// Black: one-time annual payment (12x R$59 = R$708) via Checkout Pro (Preferences API)
const PLAN_CONFIG: Record<string, {
  name: string;
  amount: number;
  type: "subscription" | "checkout";
  frequency?: number;
  frequency_type?: string;
  installments?: number;
  total_amount?: number;
}> = {
  starter: {
    name: "FlowLux Starter",
    amount: 49,
    type: "subscription",
    frequency: 1,
    frequency_type: "months",
  },
  pro: {
    name: "FlowLux Pro",
    amount: 69,
    type: "subscription",
    frequency: 1,
    frequency_type: "months",
  },
  black: {
    name: "FlowLux Black",
    amount: 59,
    type: "checkout",
    installments: 12,
    total_amount: 708, // 12 x R$59
  },
};

// Fallback: generic MP checkout links (preapproval_plan_id based)
const MP_GENERIC_LINKS: Record<string, string> = {
  starter: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=2a69ac12835b4077bbf7279faa7d61c6",
  pro: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=d9bbcdeb8cdd488994afa7c88d94f75e",
  black: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=e54d3d648c9045d3ac50101e493e8e84",
};

// ========================================
// Create a monthly subscription via Preapproval API (Starter / Pro)
// ========================================
async function createSubscriptionFlow(
  planConfig: typeof PLAN_CONFIG[string],
  userId: string,
  userEmail: string,
  backUrl: string,
  hadTrial: boolean,
  supabase: any,
  planId: string,
) {
  const mpPayload = {
    reason: planConfig.name,
    external_reference: userId,
    payer_email: userEmail,
    auto_recurring: {
      frequency: planConfig.frequency,
      frequency_type: planConfig.frequency_type,
      transaction_amount: planConfig.amount,
      currency_id: "BRL",
      ...(hadTrial ? {} : {
        free_trial: {
          frequency: 7,
          frequency_type: "days",
        },
      }),
    },
    payment_methods_allowed: {
      payment_types: [
        { id: "credit_card" },
        { id: "debit_card" },
        { id: "pix" },
      ],
      payment_methods: [
        { id: "pix" },
      ],
    },
    back_url: backUrl,
    status: "pending",
  };

  console.log("[create-subscription] Calling MP Preapproval API:", {
    reason: mpPayload.reason,
    amount: mpPayload.auto_recurring.transaction_amount,
    hadTrial,
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
  console.log("[create-subscription] MP Preapproval response:", {
    status: mpResponse.status,
    id: mpData.id,
    init_point: mpData.init_point ? "present" : "MISSING",
  });

  if (!mpResponse.ok || !mpData.init_point) {
    console.error("[create-subscription] MP Preapproval error:", JSON.stringify(mpData));

    const { error: dbError } = await supabase.from("subscriptions").insert({
      user_id: userId,
      plan_id: planId,
      status: "pending_payment",
      mp_payer_email: userEmail,
    });
    if (dbError) console.error("[create-subscription] DB insert error (fallback):", dbError);

    return NextResponse.json({
      init_point: MP_GENERIC_LINKS[planId],
      fallback: true,
      mp_error: mpData.message || mpData.error || "MP API error",
    });
  }

  const { error: dbError } = await supabase.from("subscriptions").insert({
    user_id: userId,
    plan_id: planId,
    status: "pending_payment",
    mp_preapproval_id: mpData.id,
    mp_payer_email: userEmail,
  });
  if (dbError) console.error("[create-subscription] DB insert error:", dbError);

  console.log("[create-subscription] Subscription created! MP ID:", mpData.id);

  return NextResponse.json({
    init_point: mpData.init_point,
    mp_id: mpData.id,
  });
}

// ========================================
// Create a one-time payment via Checkout Pro / Preferences API (Black)
// Allows 12x installments on credit card
// ========================================
async function createCheckoutFlow(
  planConfig: typeof PLAN_CONFIG[string],
  userId: string,
  userEmail: string,
  backUrl: string,
  supabase: any,
  planId: string,
) {
  const webhookUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`
    : "https://flowlux.vercel.app/api/webhooks/mercadopago";

  const preferencePayload = {
    items: [
      {
        id: `plan-${planId}`,
        title: `${planConfig.name} - Plano Anual`,
        description: `Assinatura anual ${planConfig.name} (12 meses)`,
        quantity: 1,
        unit_price: planConfig.total_amount || (planConfig.amount * (planConfig.installments || 12)),
        currency_id: "BRL",
      },
    ],
    payer: {
      email: userEmail,
    },
    payment_methods: {
      installments: planConfig.installments || 12,
      default_installments: planConfig.installments || 12,
    },
    back_urls: {
      success: backUrl,
      failure: backUrl.replace("/sucesso", ""),
      pending: backUrl,
    },
    auto_return: "approved",
    external_reference: userId,
    notification_url: webhookUrl,
    statement_descriptor: planConfig.name,
  };

  console.log("[create-subscription] Calling MP Checkout Pro (Preferences) API:", {
    title: preferencePayload.items[0].title,
    total: preferencePayload.items[0].unit_price,
    installments: preferencePayload.payment_methods.installments,
  });

  const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${mpAccessToken}`,
    },
    body: JSON.stringify(preferencePayload),
  });

  const mpData = await mpResponse.json();
  console.log("[create-subscription] MP Checkout Pro response:", {
    status: mpResponse.status,
    id: mpData.id,
    init_point: mpData.init_point ? "present" : "MISSING",
  });

  if (!mpResponse.ok || !mpData.init_point) {
    console.error("[create-subscription] MP Checkout Pro error:", JSON.stringify(mpData));

    const { error: dbError } = await supabase.from("subscriptions").insert({
      user_id: userId,
      plan_id: planId,
      status: "pending_payment",
      mp_payer_email: userEmail,
    });
    if (dbError) console.error("[create-subscription] DB insert error (fallback):", dbError);

    return NextResponse.json({
      init_point: MP_GENERIC_LINKS[planId],
      fallback: true,
      mp_error: mpData.message || mpData.error || "MP Checkout Pro error",
    });
  }

  // Insert pending subscription — mp_preference_id stored in mp_preapproval_id field for reuse
  const { error: dbError } = await supabase.from("subscriptions").insert({
    user_id: userId,
    plan_id: planId,
    status: "pending_payment",
    mp_preapproval_id: `pref_${mpData.id}`,
    mp_payer_email: userEmail,
  });
  if (dbError) console.error("[create-subscription] DB insert error:", dbError);

  console.log("[create-subscription] Checkout Pro created! Preference ID:", mpData.id);

  return NextResponse.json({
    init_point: mpData.init_point,
    mp_id: mpData.id,
    type: "checkout",
  });
}

// ========================================
// Main handler
// ========================================
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
      .select("id, plan_id, status, mp_preapproval_id")
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

    // Check if user has ever had a trial (any subscription with trial_start set)
    const { data: trialHistory } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", user_id)
      .not("trial_start", "is", null)
      .limit(1);

    const hadTrial = !!(trialHistory && trialHistory.length > 0);
    console.log("[create-subscription] User trial history:", { hadTrial });

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

    const resolvedBackUrl = back_url || "https://flowlux.vercel.app/assinatura/sucesso";

    // Route to the correct flow based on plan type
    if (planConfig.type === "checkout") {
      // Black plan: one-time payment with installments via Checkout Pro
      return createCheckoutFlow(planConfig, user_id, user_email, resolvedBackUrl, supabase, plan_id);
    } else {
      // Starter/Pro: monthly subscription via Preapproval API
      return createSubscriptionFlow(planConfig, user_id, user_email, resolvedBackUrl, hadTrial, supabase, plan_id);
    }
  } catch (err: any) {
    console.error("[create-subscription] Unexpected error:", err);
    return NextResponse.json({ error: "Erro interno: " + String(err.message || err) }, { status: 500 });
  }
}
