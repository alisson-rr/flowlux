import { NextRequest, NextResponse } from "next/server";
import { authorizeUserRequest } from "@/lib/api-user-auth";
import { cancelGroupScheduledMessage } from "@/lib/group-scheduled-messages";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { user_id } = body || {};

    if (!id || !user_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const authorized = await authorizeUserRequest(req, user_id);
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await cancelGroupScheduledMessage(user_id, id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || error || "Unable to cancel scheduled group message") }, { status: 500 });
  }
}
