import { NextRequest, NextResponse } from "next/server";
import { authorizeUserRequest } from "@/lib/api-user-auth";
import { archiveWhatsAppGroup, updateWhatsAppGroup } from "@/lib/whatsapp-groups";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { user_id, subject, description, status } = body || {};

    if (!id || !user_id || !subject) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const authorized = await authorizeUserRequest(req, user_id);
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const group = await updateWhatsAppGroup({
      userId: user_id,
      groupId: id,
      subject,
      description,
      status,
    });

    return NextResponse.json({ success: true, group });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || error || "Unable to update group") }, { status: 500 });
  }
}

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

    await archiveWhatsAppGroup({
      userId: user_id,
      groupId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || error || "Unable to delete group") }, { status: 500 });
  }
}
