import { NextRequest, NextResponse } from "next/server";
import { authorizeUserRequest } from "@/lib/api-user-auth";
import { enqueueFlowExecution, kickFlowExecution } from "@/lib/flow-executions";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { user_id, flow_id } = body || {};

    if (!id || !user_id || !flow_id) {
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

    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_name")
      .eq("id", group.instance_id)
      .eq("user_id", user_id)
      .maybeSingle();

    if (!instance?.instance_name) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    const { executionId, totalSteps } = await enqueueFlowExecution({
      flowId: flow_id,
      userId: user_id,
      instanceId: instance.id,
      instanceName: instance.instance_name,
      remoteJid: group.remote_jid,
      conversationId: null,
      metadata: {
        enqueue_source: "group_manual",
        channel: "group",
        group_id: group.id,
        group_subject: group.subject,
      },
    });

    kickFlowExecution(executionId);

    return NextResponse.json({
      success: true,
      execution_id: executionId,
      status: "queued",
      total_steps: totalSteps,
    });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || error || "Unable to start group flow") }, { status: 500 });
  }
}
