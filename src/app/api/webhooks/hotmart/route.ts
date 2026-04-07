import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizePhone, phoneVariants } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    const event = body.event || body.data?.purchase?.status || "unknown";
    const buyerEmail = body.data?.buyer?.email || body.buyer?.email || "";
    const buyerName = body.data?.buyer?.name || body.buyer?.name || "";
    const buyerPhone = body.data?.buyer?.checkout_phone || body.buyer?.checkout_phone || "";
    const productName = body.data?.product?.name || body.product?.name || "";

    const hottok = req.nextUrl.searchParams.get("hottok") || "";

    // Find integration + config by hottok
    let userId: string | null = null;
    let eventConfig: Record<string, { funnel_id?: string; stage_id?: string; tag_id?: string }> = {};

    if (hottok) {
      const { data: integration } = await supabase
        .from("integrations")
        .select("user_id, config")
        .eq("type", "hotmart")
        .eq("api_key", hottok)
        .eq("is_active", true)
        .single();
      userId = integration?.user_id || null;
      eventConfig = (integration?.config as any)?.events || {};
    }

    // Log webhook
    await supabase.from("hotmart_webhooks").insert({
      user_id: userId, event, payload: body, processed: false,
    });

    if (!userId || !buyerPhone) {
      return NextResponse.json({ success: true, processed: false, reason: !userId ? "no_user" : "no_phone" });
    }

    const cleanPhone = normalizePhone(buyerPhone);
    if (!cleanPhone) {
      return NextResponse.json({ success: true, processed: false, reason: "invalid_phone" });
    }
    const cfg = eventConfig[event] || {};

    // Check if lead exists using all phone variants for robust matching
    const variants = phoneVariants(cleanPhone);
    const orFilter = variants.map((v) => `phone.eq.${v}`).join(",");
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id")
      .eq("user_id", userId)
      .or(orFilter)
      .is("deleted_at", null)
      .limit(1)
      .single();

    if (existingLead) {
      // Update existing lead with new stage/funnel if configured
      const updates: Record<string, any> = {};
      if (cfg.stage_id) updates.stage_id = cfg.stage_id;
      if (cfg.funnel_id) updates.funnel_id = cfg.funnel_id;
      if (Object.keys(updates).length > 0) {
        await supabase.from("leads").update(updates).eq("id", existingLead.id);
      }
      // Add tag if configured
      if (cfg.tag_id) {
        await supabase.from("lead_tags").upsert(
          { lead_id: existingLead.id, tag_id: cfg.tag_id },
          { onConflict: "lead_id,tag_id" }
        );
      }
    } else {
      // Create new lead
      const { data: newLead } = await supabase.from("leads").insert({
        user_id: userId,
        name: buyerName || "Lead Hotmart",
        phone: cleanPhone,
        email: buyerEmail || null,
        source: `Hotmart - ${productName}`,
        stage_id: cfg.stage_id || null,
        funnel_id: cfg.funnel_id || null,
      }).select("id").single();

      // Add tag
      if (newLead && cfg.tag_id) {
        await supabase.from("lead_tags").insert({ lead_id: newLead.id, tag_id: cfg.tag_id });
      }
    }

    // Mark processed
    await supabase
      .from("hotmart_webhooks")
      .update({ processed: true })
      .eq("user_id", userId)
      .eq("event", event)
      .is("processed", false)
      .order("created_at", { ascending: false })
      .limit(1);

    return NextResponse.json({ success: true, processed: true, event });
  } catch (err: any) {
    console.error("Hotmart webhook error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
