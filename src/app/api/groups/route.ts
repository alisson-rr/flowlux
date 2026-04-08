import { NextRequest, NextResponse } from "next/server";
import { authorizeUserRequest } from "@/lib/api-user-auth";
import { createWhatsAppGroup } from "@/lib/whatsapp-groups";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      user_id,
      instance_id,
      subject,
      description,
      participant_lead_ids,
      manual_participants,
    } = body || {};

    if (!user_id || !instance_id || !subject) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const authorized = await authorizeUserRequest(req, user_id);
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const group = await createWhatsAppGroup({
      userId: user_id,
      instanceId: instance_id,
      subject,
      description,
      participantLeadIds: Array.isArray(participant_lead_ids) ? participant_lead_ids : [],
      manualParticipants: manual_participants || "",
    });

    return NextResponse.json({ success: true, group });
  } catch (error: any) {
    console.error("[api/groups] create failed", error);
    return NextResponse.json({ error: String(error?.message || error || "Unable to create group") }, { status: 500 });
  }
}
