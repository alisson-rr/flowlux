import { NextRequest, NextResponse } from "next/server";
import { authorizeUserRequest } from "@/lib/api-user-auth";
import { fetchWhatsAppGroupParticipants, updateWhatsAppGroupParticipants } from "@/lib/whatsapp-groups";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const userId = req.nextUrl.searchParams.get("user_id");

    if (!id || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const authorized = await authorizeUserRequest(req, userId);
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const participants = await fetchWhatsAppGroupParticipants({
      userId,
      groupId: id,
    });

    return NextResponse.json({
      success: true,
      participants,
    });
  } catch (error: any) {
    console.error("[api/groups/participants] fetch failed", error);
    return NextResponse.json({ error: String(error?.message || error || "Unable to fetch participants") }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { user_id, action, participants } = body || {};

    if (!id || !user_id || !action || !Array.isArray(participants)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const authorized = await authorizeUserRequest(req, user_id);
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await updateWhatsAppGroupParticipants({
      userId: user_id,
      groupId: id,
      action,
      participants,
    });

    return NextResponse.json({
      success: true,
      participants: result.participants,
    });
  } catch (error: any) {
    console.error("[api/groups/participants] update failed", error);
    return NextResponse.json({ error: String(error?.message || error || "Unable to update participants") }, { status: 500 });
  }
}
