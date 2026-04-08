import { NextRequest, NextResponse } from "next/server";
import { authorizeUserRequest } from "@/lib/api-user-auth";
import { sendGroupMessage } from "@/lib/whatsapp-groups";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { user_id, message, media_url, media_type, file_name } = body || {};

    if (!id || !user_id || (!message && !media_url)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const authorized = await authorizeUserRequest(req, user_id);
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await sendGroupMessage({
      userId: user_id,
      groupId: id,
      message: message || "",
      mediaUrl: media_url || null,
      mediaType: media_type || null,
      fileName: file_name || null,
      sendMode: "manual",
    });

    return NextResponse.json({
      success: true,
      provider_response: result.providerResponse,
    });
  } catch (error: any) {
    console.error("[api/groups/send] send failed", error);
    return NextResponse.json({ error: String(error?.message || error || "Unable to send group message") }, { status: 500 });
  }
}
