import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || "";

export async function POST(req: NextRequest) {
  try {
    const authenticatedUserId = await getAuthenticatedUserId(req);
    if (!authenticatedUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { user_id } = body;

    console.log("[cancel-subscription] Request:", { user_id, auth_user_id: authenticatedUserId });

    if (user_id && user_id !== authenticatedUserId) {
      return NextResponse.json({ error: "User mismatch" }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    // Find the active subscription for this user
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", authenticatedUserId)
      .in("status", ["active", "authorized", "trial", "pending_payment"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!subscription) {
      return NextResponse.json({ error: "Nenhuma assinatura ativa encontrada." }, { status: 404 });
    }

    console.log("[cancel-subscription] Found subscription:", {
      id: subscription.id,
      plan_id: subscription.plan_id,
      status: subscription.status,
      mp_preapproval_id: subscription.mp_preapproval_id,
      current_period_end: subscription.current_period_end,
    });

    // Cancel on Mercado Pago if we have a preapproval ID
    // Black plan (Checkout Pro) uses pref_ prefix — it's a one-time payment, nothing to cancel on MP side
    const isCheckoutPlan = subscription.mp_preapproval_id?.startsWith("pref_") || subscription.plan_id === "black";

    if (subscription.mp_preapproval_id && mpAccessToken && !isCheckoutPlan) {
      const mpRes = await fetch(
        `https://api.mercadopago.com/preapproval/${subscription.mp_preapproval_id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mpAccessToken}`,
          },
          body: JSON.stringify({ status: "cancelled" }),
        }
      );

      const mpData = await mpRes.json();
      console.log("[cancel-subscription] MP response:", {
        status: mpRes.status,
        mpStatus: mpData.status,
      });

      if (!mpRes.ok) {
        console.error("[cancel-subscription] MP API error:", JSON.stringify(mpData));
        return NextResponse.json(
          { error: "Erro ao cancelar assinatura no Mercado Pago." },
          { status: 500 }
        );
      }
    } else if (isCheckoutPlan) {
      console.log("[cancel-subscription] Black plan (Checkout Pro) — skipping MP API call, only updating DB");
    }

    // Update subscription in database
    // Keep current_period_end so user retains access until that date
    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    if (updateError) {
      console.error("[cancel-subscription] DB update error:", updateError);
      return NextResponse.json({ error: "Erro ao atualizar assinatura." }, { status: 500 });
    }

    console.log("[cancel-subscription] Subscription cancelled successfully:", subscription.id);

    return NextResponse.json({
      success: true,
      current_period_end: subscription.current_period_end,
      message: subscription.current_period_end
        ? `Assinatura cancelada. Você ainda terá acesso até ${new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}.`
        : "Assinatura cancelada com sucesso.",
    });
  } catch (err: any) {
    console.error("[cancel-subscription] Unexpected error:", err);
    return NextResponse.json({ error: "Erro interno: " + String(err.message || err) }, { status: 500 });
  }
}
