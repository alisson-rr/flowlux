import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Hotmart sends event type in different fields depending on webhook version
    const event = body.event || body.data?.purchase?.status || "unknown";
    const buyerEmail = body.data?.buyer?.email || body.buyer?.email || "";
    const buyerName = body.data?.buyer?.name || body.buyer?.name || "";
    const buyerPhone = body.data?.buyer?.checkout_phone || body.buyer?.checkout_phone || "";
    const productName = body.data?.product?.name || body.product?.name || "";
    const transactionId = body.data?.purchase?.transaction || body.purchase?.transaction || "";

    // Find user by hotmart integration token match
    // Hotmart sends hottok as query param or in headers
    const hottok = req.nextUrl.searchParams.get("hottok") || "";

    let userId: string | null = null;

    if (hottok) {
      const { data: integration } = await supabase
        .from("integrations")
        .select("user_id")
        .eq("type", "hotmart")
        .eq("api_key", hottok)
        .eq("is_active", true)
        .single();
      userId = integration?.user_id || null;
    }

    // Log the webhook event
    await supabase.from("hotmart_webhooks").insert({
      user_id: userId,
      event,
      payload: body,
      processed: false,
    });

    // Process based on event type
    if (userId && buyerPhone && (event === "PURCHASE_COMPLETE" || event === "PURCHASE_APPROVED" || event === "approved")) {
      // Auto-create lead from purchase
      const cleanPhone = buyerPhone.replace(/\D/g, "");

      // Check if lead already exists
      const { data: existingLead } = await supabase
        .from("leads")
        .select("id")
        .eq("user_id", userId)
        .eq("phone", cleanPhone)
        .is("deleted_at", null)
        .single();

      if (!existingLead) {
        await supabase.from("leads").insert({
          user_id: userId,
          name: buyerName || "Lead Hotmart",
          phone: cleanPhone,
          email: buyerEmail || null,
          source: `Hotmart - ${productName}`,
        });
      }

      // Mark webhook as processed
      // (we just inserted it above, so update the latest one)
      await supabase
        .from("hotmart_webhooks")
        .update({ processed: true })
        .eq("user_id", userId)
        .eq("event", event)
        .order("created_at", { ascending: false })
        .limit(1);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Hotmart webhook error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Hotmart may also send GET for verification
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
