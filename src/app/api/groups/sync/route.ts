import { NextRequest, NextResponse } from "next/server";
import { authorizeUserRequest } from "@/lib/api-user-auth";
import { syncWhatsAppGroups } from "@/lib/whatsapp-groups";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, instance_id } = body || {};

    if (!user_id) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    const authorized = await authorizeUserRequest(req, user_id);
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await syncWhatsAppGroups({
      userId: user_id,
      instanceId: instance_id || null,
    });

    return NextResponse.json({
      success: true,
      synced_groups: result.syncedGroups,
      instances_count: result.instancesCount,
    });
  } catch (error: any) {
    console.error("[api/groups/sync] sync failed", error);
    return NextResponse.json({ error: String(error?.message || error || "Sync failed") }, { status: 500 });
  }
}
