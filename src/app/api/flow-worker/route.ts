import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { processQueuedFlowExecutions } from "@/lib/flow-executions";

const FLOW_WORKER_SECRET = process.env.FLOW_WORKER_SECRET || "";

function isInternalWorkerRequest(req: NextRequest) {
  if (!FLOW_WORKER_SECRET) return false;
  return req.headers.get("x-flow-worker-secret") === FLOW_WORKER_SECRET;
}

export async function POST(req: NextRequest) {
  try {
    const internalRequest = isInternalWorkerRequest(req);
    const userId = internalRequest ? null : await getAuthenticatedUserId(req);

    if (!internalRequest && !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const executionId = typeof body.execution_id === "string" ? body.execution_id : undefined;
    const limit = typeof body.limit === "number" ? body.limit : undefined;

    if (!internalRequest && !executionId) {
      return NextResponse.json({ error: "execution_id is required for user-triggered worker runs" }, { status: 400 });
    }

    if (!internalRequest && executionId && userId) {
      const supabase = getSupabaseAdmin();
      const { data: execution } = await supabase
        .from("flow_executions")
        .select("id")
        .eq("id", executionId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!execution?.id) {
        return NextResponse.json({ error: "Execution not found" }, { status: 404 });
      }
    }

    const result = await processQueuedFlowExecutions({
      executionId,
      limit,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || error || "Unknown worker error") }, { status: 500 });
  }
}
