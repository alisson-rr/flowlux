import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { processQueuedGroupScheduledMessages } from "@/lib/group-scheduled-messages";

const GROUP_WORKER_SECRET = process.env.GROUP_WORKER_SECRET || "";

function isInternalWorkerRequest(req: NextRequest) {
  if (!GROUP_WORKER_SECRET) return false;
  return req.headers.get("x-group-worker-secret") === GROUP_WORKER_SECRET;
}

export async function POST(req: NextRequest) {
  try {
    const internalRequest = isInternalWorkerRequest(req);
    const userId = internalRequest ? null : await getAuthenticatedUserId(req);

    if (!internalRequest && !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const scheduledMessageId = typeof body.scheduled_message_id === "string" ? body.scheduled_message_id : undefined;
    const limit = typeof body.limit === "number" ? body.limit : undefined;

    if (!internalRequest && !scheduledMessageId) {
      return NextResponse.json({ error: "scheduled_message_id is required for user-triggered worker runs" }, { status: 400 });
    }

    if (!internalRequest && scheduledMessageId && userId) {
      const supabase = getSupabaseAdmin();
      const { data: scheduled } = await supabase
        .from("group_scheduled_messages")
        .select("id")
        .eq("id", scheduledMessageId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!scheduled?.id) {
        return NextResponse.json({ error: "Scheduled message not found" }, { status: 404 });
      }
    }

    const result = await processQueuedGroupScheduledMessages({
      scheduledMessageId,
      limit,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || error || "Unknown group worker error") }, { status: 500 });
  }
}
