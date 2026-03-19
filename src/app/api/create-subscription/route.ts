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

    if (!plan_id || !user_id || !user_email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const mpPlanId = MP_PLAN_IDS[plan_id];
    if (!mpPlanId) {
      return NextResponse.json({ error: "Invalid plan_id" }, { status: 400 });
    }

    if (!mpAccessToken) {
      return NextResponse.json({ error: "Mercado Pago not configured" }, { status: 500 });
    }

    // Create subscription via Mercado Pago API with external_reference
    const mpResponse = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mpAccessToken}`,
      },
      body: JSON.stringify({
        preapproval_plan_id: mpPlanId,
        external_reference: user_id,
        payer_email: user_email,
        back_url: back_url || "https://flowlux.vercel.app/assinatura/sucesso",
      }),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Mercado Pago API error:", mpData);
      return NextResponse.json(
        { error: "Erro ao criar assinatura no Mercado Pago", details: mpData },
        { status: 500 }
      );
    }

    // mpData contains: id, init_point, status, external_reference, etc.
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create subscription record with pending_payment status (NO access, NO trial yet)
    await supabase.from("subscriptions").insert({
      user_id,
      plan_id,
      status: "pending_payment",
      mp_preapproval_id: mpData.id || null,
      mp_payer_email: user_email,
    });

    return NextResponse.json({
      init_point: mpData.init_point,
      mp_id: mpData.id,
    });
  } catch (err: any) {
    console.error("Create subscription error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
