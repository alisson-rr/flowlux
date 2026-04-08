import { NextRequest, NextResponse } from "next/server";
import { authorizeUserRequest } from "@/lib/api-user-auth";
import { updateWhatsAppGroupSettings } from "@/lib/whatsapp-groups";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { user_id, announcement_mode, edit_settings_mode } = body || {};

    if (!id || !user_id || !announcement_mode || !edit_settings_mode) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const authorized = await authorizeUserRequest(req, user_id);
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await updateWhatsAppGroupSettings({
      userId: user_id,
      groupId: id,
      announcementMode: announcement_mode,
      editSettingsMode: edit_settings_mode,
    });

    return NextResponse.json({
      success: true,
      settings: result.settings,
    });
  } catch (error: any) {
    console.error("[api/groups/settings] update failed", error);
    return NextResponse.json({ error: String(error?.message || error || "Unable to update group settings") }, { status: 500 });
  }
}
