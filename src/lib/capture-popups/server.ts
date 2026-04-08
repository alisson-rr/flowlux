import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildLeadPhoneFields } from "@/lib/phone";
import { phoneToJid } from "@/lib/utils";
import { enqueueFlowExecution, kickFlowExecution } from "@/lib/flow-executions";
import type { CapturePopup, CapturePopupField } from "@/types";

export type PublicCapturePopupRow = CapturePopup;
export type PublicCapturePopupFieldRow = CapturePopupField;

export const PUBLIC_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function withPublicCors(response: Response) {
  Object.entries(PUBLIC_CORS_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export async function getPublishedCapturePopup(slug: string) {
  const supabase = getSupabaseAdmin();
  const { data: popup } = await supabase
    .from("capture_popups")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!popup) return null;

  const { data: fields } = await supabase
    .from("capture_popup_fields")
    .select("*")
    .eq("popup_id", popup.id)
    .order("position");

  return {
    popup: popup as PublicCapturePopupRow,
    fields: (fields || []) as PublicCapturePopupFieldRow[],
  };
}

export async function insertCapturePopupEvent(input: {
  popupId: string;
  userId: string;
  eventType: string;
  status?: "success" | "warning" | "error";
  submissionId?: string | null;
  leadId?: string | null;
  sessionToken?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdmin();
  await supabase.from("capture_popup_events").insert({
    popup_id: input.popupId,
    user_id: input.userId,
    submission_id: input.submissionId || null,
    lead_id: input.leadId || null,
    session_token: input.sessionToken || null,
    event_type: input.eventType,
    status: input.status || "success",
    metadata: input.metadata || {},
  });
}

export async function findOrCreateLeadFromPopup(input: {
  popup: PublicCapturePopupRow;
  fieldValues: Record<string, string>;
}) {
  const supabase = getSupabaseAdmin();
  const name = String(input.fieldValues.name || input.fieldValues.full_name || "").trim();
  const email = String(input.fieldValues.email || "").trim();
  const phoneRaw = String(input.fieldValues.phone || input.fieldValues.whatsapp || "").trim();
  const phoneFields = phoneRaw ? buildLeadPhoneFields(phoneRaw) : null;

  let existingLead: { id: string; name: string | null; email: string | null } | null = null;
  if (phoneFields?.phone_search_keys?.length) {
    const { data } = await supabase
      .from("leads")
      .select("id, name, email")
      .eq("user_id", input.popup.user_id)
      .overlaps("phone_search_keys", phoneFields.phone_search_keys)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    existingLead = data || null;
  } else if (email) {
    const { data } = await supabase
      .from("leads")
      .select("id, name, email")
      .eq("user_id", input.popup.user_id)
      .eq("email", email)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    existingLead = data || null;
  }

  const basePayload = {
    name: name || existingLead?.name || "Lead do popup",
    email: email || existingLead?.email || null,
    source: `Popup - ${input.popup.name}`,
    funnel_id: input.popup.integrations?.funnel_id || null,
    stage_id: input.popup.integrations?.stage_id || null,
  };

  let leadId: string | null = existingLead?.id || null;
  if (existingLead?.id) {
    await supabase.from("leads").update({
      ...basePayload,
      ...(phoneFields || {}),
    }).eq("id", existingLead.id);
  } else if (phoneFields || email) {
    const { data: createdLead } = await supabase.from("leads").insert({
      user_id: input.popup.user_id,
      ...basePayload,
      ...(phoneFields || {}),
    }).select("id").single();
    leadId = createdLead?.id || null;
  }

  if (leadId && Array.isArray(input.popup.integrations?.tag_ids) && input.popup.integrations.tag_ids.length > 0) {
    const tagPayload = input.popup.integrations.tag_ids.map((tagId) => ({ lead_id: leadId, tag_id: tagId }));
    await supabase.from("lead_tags").upsert(tagPayload, { onConflict: "lead_id,tag_id" });
  }

  return {
    leadId,
    leadName: basePayload.name,
    leadEmail: basePayload.email,
    leadPhone: phoneFields?.phone || phoneRaw || "",
    phoneFields,
  };
}

export async function maybeEnqueuePopupFlow(input: {
  popup: PublicCapturePopupRow;
  flowId?: string | null;
  phone?: string | null;
  leadId?: string | null;
  submissionId: string;
}) {
  if (!input.flowId || !input.phone) return;

  const supabase = getSupabaseAdmin();
  const { data: instances } = await supabase
    .from("whatsapp_instances")
    .select("id, instance_name, status")
    .eq("user_id", input.popup.user_id)
    .order("created_at");

  const instance = (instances || []).find((item) => item.status === "connected") || (instances || [])[0];
  if (!instance?.instance_name) return;

  const remoteJid = phoneToJid(input.phone);
  const { executionId } = await enqueueFlowExecution({
    flowId: input.flowId,
    userId: input.popup.user_id,
    instanceId: instance.id || null,
    instanceName: instance.instance_name,
    remoteJid,
    metadata: {
      enqueue_source: "capture_popup_submit",
      capture_popup_id: input.popup.id,
      capture_popup_submission_id: input.submissionId,
      lead_id: input.leadId || null,
    },
  });

  kickFlowExecution(executionId);
}

export function buildWhatsappRedirectUrl(phone?: string | null, message?: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message || "")}`;
}
