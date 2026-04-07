import { NextRequest, NextResponse } from "next/server";
import { enqueueFlowExecution, kickFlowExecution } from "@/lib/flow-executions";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { recordOperationalEvent } from "@/lib/operational-events";

export async function POST(req: NextRequest) {
  let parsedBody: any = null;

  try {
    parsedBody = await req.json();
    const body = parsedBody;
    const { flow_id, user_id, instance_id, instance_name, remote_jid, conversation_id } = body;

    if (!flow_id || !user_id || !instance_name || !remote_jid) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const supabase = getSupabaseAdmin();

    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user || user.id !== user_id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else {
      const { data: userCheck } = await supabase.auth.admin.getUserById(user_id);
      if (!userCheck?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const { executionId, totalSteps } = await enqueueFlowExecution({
      flowId: flow_id,
      userId: user_id,
      instanceId: instance_id || null,
      instanceName: instance_name,
      remoteJid: remote_jid,
      conversationId: conversation_id || null,
      metadata: {
        enqueue_source: "manual",
      },
    });

    // Best effort kickoff. The execution remains persisted in the queue and can
    // also be resumed by the worker route if this process restarts.
    kickFlowExecution(executionId);

    return NextResponse.json({
      success: true,
      execution_id: executionId,
      status: "queued",
      total_steps: totalSteps,
    });
  } catch (error: any) {
    await recordOperationalEvent({
      userId: parsedBody?.user_id || null,
      source: "flow_execution_async",
      eventType: "enqueue_failed",
      severity: "error",
      status: "error",
      entityType: "conversation",
      entityId: parsedBody?.conversation_id || null,
      message: String(error?.message || error || "Unknown flow enqueue error"),
      metadata: {
        flow_id: parsedBody?.flow_id || null,
        instance_id: parsedBody?.instance_id || null,
        instance_name: parsedBody?.instance_name || null,
        remote_jid: parsedBody?.remote_jid || null,
      },
    });
    return NextResponse.json({ error: String(error?.message || error || "Unknown flow enqueue error") }, { status: 500 });
  }
}
