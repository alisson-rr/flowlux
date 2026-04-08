import { NextRequest, NextResponse } from "next/server";
import { authorizeUserRequest } from "@/lib/api-user-auth";
import { fetchWhatsAppGroupInviteLink } from "@/lib/whatsapp-groups";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { user_id } = body || {};

    if (!id || !user_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const authorized = await authorizeUserRequest(req, user_id);
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await fetchWhatsAppGroupInviteLink({
      userId: user_id,
      groupId: id,
    });

    return NextResponse.json({
      success: true,
      invite_code: result.inviteCode,
      invite_url: result.inviteUrl,
    });
  } catch (error: any) {
    console.error("[api/groups/invite-link] fetch failed", error);
    return NextResponse.json({ error: String(error?.message || error || "Unable to fetch invite link") }, { status: 500 });
  }
}
