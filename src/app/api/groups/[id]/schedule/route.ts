import { NextRequest, NextResponse } from "next/server";
import { authorizeUserRequest } from "@/lib/api-user-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { kickGroupScheduledMessage, upsertGroupScheduledMessage } from "@/lib/group-scheduled-messages";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const {
      user_id,
      scheduled_message_id,
      message,
      scheduled_at,
      media_url,
      media_type,
      file_name,
    } = body || {};

    if (!id || !user_id || !scheduled_at || (!message && !media_url)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const authorized = await authorizeUserRequest(req, user_id);
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: group } = await supabase
      .from("whatsapp_groups")
      .select("id, user_id, instance_id, remote_jid, subject, status")
      .eq("id", id)
      .eq("user_id", user_id)
      .maybeSingle();

    if (!group?.id) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const saved = await upsertGroupScheduledMessage({
      userId: user_id,
      scheduledMessageId: scheduled_message_id || null,
      groupId: group.id,
      instanceId: group.instance_id,
      remoteJid: group.remote_jid,
      groupSubject: group.subject,
      message: message || "",
      scheduledAt: new Date(scheduled_at).toISOString(),
      mediaUrl: media_url || null,
      mediaType: media_type || null,
      fileName: file_name || null,
    });

    kickGroupScheduledMessage(saved.id, saved.next_run_at || saved.scheduled_at);

    return NextResponse.json({
      success: true,
      scheduled_message: saved,
    });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || error || "Unable to schedule group message") }, { status: 500 });
  }
}
