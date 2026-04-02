import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || "";

// Plan configurations for monthly subscriptions (updatable via PUT on preapproval)
// Note: Black plan uses Checkout Pro (one-time payment) and cannot be updated this way
const PLAN_CONFIG: Record<string, { name: string; amount: number }> = {
  starter: {
    name: "FlowLux Starter",
    amount: 49,
  },
  pro: {
    name: "FlowLux Pro",
    amount: 69,
  },
};

// Plans that use Checkout Pro (not subscription) — cannot be updated via PUT
const CHECKOUT_PLANS = ["black"];

export async function POST(req: NextRequest) {
  try {
    const authenticatedUserId = await getAuthenticatedUserId(req);
    if (!authenticatedUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { user_id, new_plan_id } = body;

    console.log("[update-subscription] Request:", { user_id, auth_user_id: authenticatedUserId, new_plan_id });

    if (!new_plan_id) {
      return NextResponse.json({ error: "Missing new_plan_id" }, { status: 400 });
    }

    if (user_id && user_id !== authenticatedUserId) {
      return NextResponse.json({ error: "User mismatch" }, { status: 403 });
    }

    // Block changes TO Black plan (requires new checkout, not a subscription update)
    if (CHECKOUT_PLANS.includes(new_plan_id)) {
      return NextResponse.json({
        error: "Para mudar para o plano FlowLux Black, cancele sua assinatura atual e assine o novo plano.",
        requires_new_checkout: true,
      }, { status: 400 });
    }

    const newPlanConfig = PLAN_CONFIG[new_plan_id];
    if (!newPlanConfig) {
      return NextResponse.json({ error: `Invalid plan_id: ${new_plan_id}` }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the active subscription for this user
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", authenticatedUserId)
      .in("status", ["active", "authorized", "trial"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!subscription) {
      return NextResponse.json({ error: "Nenhuma assinatura ativa encontrada." }, { status: 404 });
    }

    if (subscription.plan_id === new_plan_id) {
      return NextResponse.json({ error: "Você já está neste plano." }, { status: 400 });
    }

    // Block changes FROM Black plan (it uses Checkout Pro, no preapproval to update)
    if (CHECKOUT_PLANS.includes(subscription.plan_id)) {
      return NextResponse.json({
        error: "Para mudar do plano FlowLux Black, cancele sua assinatura atual e assine o novo plano.",
        requires_new_checkout: true,
      }, { status: 400 });
    }

    console.log("[update-subscription] Changing plan:", {
      from: subscription.plan_id,
      to: new_plan_id,
      mp_preapproval_id: subscription.mp_preapproval_id,
    });

    // Update on Mercado Pago if we have a preapproval ID
    if (subscription.mp_preapproval_id && mpAccessToken) {
      const mpRes = await fetch(
        `https://api.mercadopago.com/preapproval/${subscription.mp_preapproval_id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mpAccessToken}`,
          },
          body: JSON.stringify({
            reason: newPlanConfig.name,
            auto_recurring: {
              transaction_amount: newPlanConfig.amount,
              currency_id: "BRL",
            },
          }),
        }
      );

      const mpData = await mpRes.json();
      console.log("[update-subscription] MP response:", {
        status: mpRes.status,
        mpStatus: mpData.status,
        newAmount: mpData.auto_recurring?.transaction_amount,
      });

      if (!mpRes.ok) {
        console.error("[update-subscription] MP API error:", JSON.stringify(mpData));
        return NextResponse.json(
          { error: "Erro ao atualizar assinatura no Mercado Pago." },
          { status: 500 }
        );
      }
    }

    // Update plan in database
    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({ plan_id: new_plan_id })
      .eq("id", subscription.id);

    if (updateError) {
      console.error("[update-subscription] DB update error:", updateError);
      return NextResponse.json({ error: "Erro ao atualizar plano." }, { status: 500 });
    }

    console.log("[update-subscription] Plan updated successfully:", {
      subscriptionId: subscription.id,
      oldPlan: subscription.plan_id,
      newPlan: new_plan_id,
    });

    return NextResponse.json({
      success: true,
      old_plan: subscription.plan_id,
      new_plan: new_plan_id,
      message: `Plano alterado para ${newPlanConfig.name} com sucesso!`,
    });
  } catch (err: any) {
    console.error("[update-subscription] Unexpected error:", err);
    return NextResponse.json({ error: "Erro interno: " + String(err.message || err) }, { status: 500 });
  }
}
