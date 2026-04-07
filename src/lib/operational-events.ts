import { getSupabaseAdmin } from "@/lib/supabase-admin";

type OperationalSeverity = "info" | "warning" | "error";
type OperationalStatus = "success" | "warning" | "error";

export interface OperationalEventInput {
  userId?: string | null;
  source: string;
  eventType: string;
  severity?: OperationalSeverity;
  status?: OperationalStatus;
  entityType?: string | null;
  entityId?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function recordOperationalEvent(input: OperationalEventInput) {
  try {
    const supabase = getSupabaseAdmin();

    await supabase.from("operational_events").insert({
      user_id: input.userId || null,
      source: input.source,
      event_type: input.eventType,
      severity: input.severity || "info",
      status: input.status || "success",
      entity_type: input.entityType || null,
      entity_id: input.entityId || null,
      message: input.message || null,
      metadata: input.metadata || {},
    });
  } catch (error) {
    console.warn("Failed to persist operational event:", error);
  }
}
