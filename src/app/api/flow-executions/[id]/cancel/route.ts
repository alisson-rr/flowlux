import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { cancelFlowExecution } from "@/lib/flow-executions";

const FLOW_WORKER_SECRET = process.env.FLOW_WORKER_SECRET || "";

function isInternalWorkerRequest(req: NextRequest) {
  if (!FLOW_WORKER_SECRET) return false;
  return req.headers.get("x-flow-worker-secret") === FLOW_WORKER_SECRET;
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Execution id is required" }, { status: 400 });
    }

    const internalRequest = isInternalWorkerRequest(req);
    const userId = internalRequest ? null : await getAuthenticatedUserId(req);

    if (!internalRequest && !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    if (!internalRequest && userId) {
      const { data: execution } = await supabase
        .from("flow_executions")
        .select("id")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();

      if (!execution?.id) {
        return NextResponse.json({ error: "Execution not found" }, { status: 404 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason : null;

    await cancelFlowExecution(id, reason);

    return NextResponse.json({ success: true, execution_id: id, status: "cancelled" });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || error || "Unknown cancel error") }, { status: 500 });
  }
}
