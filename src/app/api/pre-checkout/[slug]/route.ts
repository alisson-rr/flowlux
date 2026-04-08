import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildPreCheckoutSessionExpiry, decidePreCheckoutSessionResume } from "@/lib/pre-checkout/forms";
import { buildLeadPhoneFields, getPhoneIdentity } from "@/lib/phone";
import { phoneToJid } from "@/lib/utils";
import { enqueueFlowExecution, kickFlowExecution } from "@/lib/flow-executions";
import { isPreCheckoutLabEnabledForHost } from "@/lib/feature-access";
import type { PreCheckoutSessionStatus } from "@/types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PublicFormRow = {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  theme: Record<string, any>;
  final_config: Record<string, any>;
  integrations: Record<string, any>;
  session_settings: { resume_window_minutes?: number; abandonment_window_minutes?: number } | null;
};

type StepRow = {
  id: string;
  step_key: string;
  position: number;
  type: string;
  title: string;
  description: string | null;
  placeholder: string | null;
  is_required: boolean;
  options: any[];
};

type SessionRow = {
  id: string;
  user_id: string;
  form_id: string;
  session_token: string;
  resume_token: string;
  status: PreCheckoutSessionStatus;
  lead_id: string | null;
  current_step_position: number;
  answers_count: number;
  expires_at: string | null;
};

async function parseBody(req: NextRequest) {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function getPublishedForm(slug: string) {
  const supabase = getSupabaseAdmin();
  const { data: form } = await supabase
    .from("pre_checkout_forms")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!form) return null;

  const { data: steps } = await supabase
    .from("pre_checkout_form_steps")
    .select("*")
    .eq("form_id", form.id)
    .order("position");

  return {
    form: form as PublicFormRow,
    steps: (steps || []) as StepRow[],
  };
}

async function insertEvent(input: {
  formId: string;
  userId: string;
  sessionId?: string | null;
  leadId?: string | null;
  eventType: string;
  status?: "success" | "warning" | "error";
  metadata?: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdmin();
  await supabase.from("pre_checkout_events").insert({
    form_id: input.formId,
    user_id: input.userId,
    session_id: input.sessionId || null,
    lead_id: input.leadId || null,
    event_type: input.eventType,
    status: input.status || "success",
    metadata: input.metadata || {},
  });
}

function getAnswerValue(answer: { answer_text?: string | null; answer_json?: Record<string, any> | null }) {
  if (typeof answer.answer_json?.value === "string") return answer.answer_json.value;
  if (Array.isArray(answer.answer_json?.values)) return answer.answer_json.values;
  return answer.answer_text || "";
}

function isBlankAnswer(value: unknown) {
  if (Array.isArray(value)) return value.length === 0;
  return !String(value || "").trim();
}

async function findOrCreateLead(input: {
  form: PublicFormRow;
  steps: StepRow[];
  session: SessionRow;
}) {
  const supabase = getSupabaseAdmin();
  const { data: answers } = await supabase
    .from("pre_checkout_answers")
    .select("step_id, answer_text, answer_json")
    .eq("session_id", input.session.id);

  const answerMap = new Map((answers || []).map((answer) => [answer.step_id, getAnswerValue(answer)]));
  const nameStep = input.steps.find((step) => step.step_key === "nome" || step.step_key === "name" || step.type === "short_text");
  const emailStep = input.steps.find((step) => step.type === "email");
  const phoneStep = input.steps.find((step) => step.type === "phone");

  const name = String(nameStep ? answerMap.get(nameStep.id) || "" : "").trim();
  const email = String(emailStep ? answerMap.get(emailStep.id) || "" : "").trim();
  const phoneRaw = String(phoneStep ? answerMap.get(phoneStep.id) || "" : "").trim();
  const phoneFields = phoneRaw ? buildLeadPhoneFields(phoneRaw) : null;

  let existingLead: { id: string; name: string | null; email: string | null } | null = null;
  if (phoneFields?.phone_search_keys?.length) {
    const { data } = await supabase
      .from("leads")
      .select("id, name, email")
      .eq("user_id", input.form.user_id)
      .overlaps("phone_search_keys", phoneFields.phone_search_keys)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    existingLead = data || null;
  } else if (email) {
    const { data } = await supabase
      .from("leads")
      .select("id, name, email")
      .eq("user_id", input.form.user_id)
      .eq("email", email)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    existingLead = data || null;
  }

  const basePayload = {
    name: name || existingLead?.name || "Lead do formulário",
    email: email || existingLead?.email || null,
    source: `Pre-checkout - ${input.form.name}`,
    funnel_id: input.form.integrations?.funnel_id || null,
    stage_id: input.form.integrations?.stage_id || null,
  };

  let leadId: string | null = existingLead?.id || null;
  if (existingLead?.id) {
    await supabase.from("leads").update({
      ...basePayload,
      ...(phoneFields || {}),
    }).eq("id", existingLead.id);
  } else if (phoneFields) {
    const { data: createdLead } = await supabase.from("leads").insert({
      user_id: input.form.user_id,
      ...basePayload,
      ...phoneFields,
    }).select("id").single();
    leadId = createdLead?.id || null;
  }

  if (leadId && Array.isArray(input.form.integrations?.tag_ids) && input.form.integrations.tag_ids.length > 0) {
    const tagPayload = input.form.integrations.tag_ids.map((tagId: string) => ({ lead_id: leadId, tag_id: tagId }));
    await supabase.from("lead_tags").upsert(tagPayload, { onConflict: "lead_id,tag_id" });
  }

  return {
    leadId,
    leadName: basePayload.name,
    leadPhone: phoneFields?.phone || phoneRaw || "",
  };
}

async function maybeEnqueueFlow(input: {
  flowId?: string | null;
  userId: string;
  phone?: string | null;
  leadId?: string | null;
  sessionId: string;
  source: "complete" | "abandon";
}) {
  if (!input.flowId || !input.phone) return;

  const supabase = getSupabaseAdmin();
  const { data: instances } = await supabase
    .from("whatsapp_instances")
    .select("id, instance_name, status")
    .eq("user_id", input.userId)
    .order("created_at");

  const instance = (instances || []).find((item) => item.status === "connected") || (instances || [])[0];
  if (!instance?.instance_name) return;

  const remoteJid = phoneToJid(input.phone);
  const { executionId } = await enqueueFlowExecution({
    flowId: input.flowId,
    userId: input.userId,
    instanceId: instance.id || null,
    instanceName: instance.instance_name,
    remoteJid,
    metadata: {
      enqueue_source: `pre_checkout_${input.source}`,
      pre_checkout_session_id: input.sessionId,
      lead_id: input.leadId || null,
    },
  });

  kickFlowExecution(executionId);
}

export async function GET(_: NextRequest, context: { params: Promise<{ slug: string }> }) {
  if (!isPreCheckoutLabEnabledForHost(_.headers.get("host"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { slug } = await context.params;
  const bundle = await getPublishedForm(slug);
  if (!bundle) {
    return NextResponse.json({ error: "Formulário não encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    form: bundle.form,
    steps: bundle.steps,
  });
}

export async function POST(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  if (!isPreCheckoutLabEnabledForHost(req.headers.get("host"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { slug } = await context.params;
  const body = await parseBody(req);
  const action = body?.action;
  const bundle = await getPublishedForm(slug);

  if (!bundle) {
    return NextResponse.json({ error: "Formulário não encontrado" }, { status: 404 });
  }

  const supabase = getSupabaseAdmin();
  const sessionToken = body?.session_token;

  if (action === "bootstrap") {
    const resumeToken = body?.resume_token;
    let session: SessionRow | null = null;

    if (resumeToken) {
      const { data } = await supabase
        .from("pre_checkout_sessions")
        .select("*")
        .eq("form_id", bundle.form.id)
        .eq("resume_token", resumeToken)
        .maybeSingle();
      session = (data as SessionRow | null) || null;
    }

    const decision = decidePreCheckoutSessionResume(session, new Date());
    if (decision.action === "create_new") {
      const now = new Date().toISOString();
      const expiresAt = buildPreCheckoutSessionExpiry(now, bundle.form.session_settings?.resume_window_minutes || 1440);
      const { data: created } = await supabase
        .from("pre_checkout_sessions")
        .insert({
          form_id: bundle.form.id,
          user_id: bundle.form.user_id,
          status: "started",
          current_step_position: 0,
          answers_count: 0,
          metadata: {
            utm_source: body?.utm_source || null,
            utm_medium: body?.utm_medium || null,
            utm_campaign: body?.utm_campaign || null,
            fbclid: body?.fbclid || null,
            gclid: body?.gclid || null,
            referrer: body?.referrer || null,
          },
          started_at: now,
          last_interaction_at: now,
          expires_at: expiresAt,
        })
        .select("*")
        .single();
      session = created as SessionRow;
      await insertEvent({ formId: bundle.form.id, userId: bundle.form.user_id, sessionId: session.id, eventType: "start" });
    }

    await insertEvent({ formId: bundle.form.id, userId: bundle.form.user_id, sessionId: session?.id, eventType: "view" });

    const { data: answers } = await supabase
      .from("pre_checkout_answers")
      .select("step_id, answer_text, answer_json")
      .eq("session_id", session?.id || "");

    return NextResponse.json({
      form: bundle.form,
      steps: bundle.steps,
      session,
      answers: answers || [],
    });
  }

  if (!sessionToken) {
    return NextResponse.json({ error: "Sessão inválida" }, { status: 400 });
  }

  const { data: sessionData } = await supabase
    .from("pre_checkout_sessions")
    .select("*")
    .eq("form_id", bundle.form.id)
    .eq("session_token", sessionToken)
    .maybeSingle();

  const session = sessionData as SessionRow | null;
  if (!session) {
    return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
  }

  if (action === "answer") {
    const step = bundle.steps.find((item) => item.id === body?.step_id);
    const value = body?.value;

    if (!step) {
      return NextResponse.json({ error: "Pergunta não encontrada" }, { status: 404 });
    }

    if (step.is_required && isBlankAnswer(value)) {
      return NextResponse.json({ error: "Resposta obrigatória" }, { status: 400 });
    }

    if (step.type === "email" && value && !EMAIL_REGEX.test(String(value).trim())) {
      return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
    }

    if (step.type === "phone" && value && !getPhoneIdentity(String(value))) {
      return NextResponse.json({ error: "Telefone inválido" }, { status: 400 });
    }

    const answerText = Array.isArray(value) ? value.join(", ") : String(value || "").trim();
    const answerJson = Array.isArray(value) ? { values: value } : { value: answerText };
    await supabase.from("pre_checkout_answers").upsert({
      form_id: bundle.form.id,
      session_id: session.id,
      step_id: step.id,
      user_id: bundle.form.user_id,
      answer_text: answerText || null,
      answer_json: answerJson,
      confirmed_at: new Date().toISOString(),
    }, { onConflict: "session_id,step_id" });

    const updates: Record<string, unknown> = {
      status: "in_progress",
      current_step_position: Number(body?.next_position || session.current_step_position),
      last_interaction_at: new Date().toISOString(),
      expires_at: buildPreCheckoutSessionExpiry(new Date(), bundle.form.session_settings?.resume_window_minutes || 1440),
    };

    if (step.type === "phone") {
      const phoneIdentity = getPhoneIdentity(answerText);
      if (phoneIdentity) {
        updates.visitor_phone_raw = answerText;
        updates.visitor_phone_e164 = phoneIdentity.e164;
        updates.visitor_phone_search_keys = phoneIdentity.searchKeys;
      }
    }

    if (step.type === "email") {
      updates.visitor_email = answerText;
    }

    const { count } = await supabase
      .from("pre_checkout_answers")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id);

    updates.answers_count = count || session.answers_count || 0;
    const { data: updatedSession } = await supabase
      .from("pre_checkout_sessions")
      .update(updates)
      .eq("id", session.id)
      .select("*")
      .single();

    await insertEvent({
      formId: bundle.form.id,
      userId: bundle.form.user_id,
      sessionId: session.id,
      eventType: "step_answered",
      metadata: { step_id: step.id, step_key: step.step_key, step_type: step.type },
    });

    return NextResponse.json({ session: updatedSession });
  }

  if (action === "complete") {
    const lead = await findOrCreateLead({ form: bundle.form, steps: bundle.steps, session });

    const { data: updatedSession } = await supabase
      .from("pre_checkout_sessions")
      .update({
        status: "completed",
        lead_id: lead.leadId,
        completed_at: new Date().toISOString(),
        last_interaction_at: new Date().toISOString(),
      })
      .eq("id", session.id)
      .select("*")
      .single();

    if (lead.leadId) {
      await insertEvent({ formId: bundle.form.id, userId: bundle.form.user_id, sessionId: session.id, leadId: lead.leadId, eventType: "lead_captured" });
    }

    await insertEvent({ formId: bundle.form.id, userId: bundle.form.user_id, sessionId: session.id, leadId: lead.leadId, eventType: "completed" });

    if (bundle.form.final_config?.action === "checkout_redirect") {
      await insertEvent({ formId: bundle.form.id, userId: bundle.form.user_id, sessionId: session.id, leadId: lead.leadId, eventType: "redirect_checkout" });
    }

    if (bundle.form.final_config?.action === "whatsapp_redirect") {
      await insertEvent({ formId: bundle.form.id, userId: bundle.form.user_id, sessionId: session.id, leadId: lead.leadId, eventType: "redirect_whatsapp" });
    }

    await maybeEnqueueFlow({
      flowId: bundle.form.integrations?.flow_on_complete_id || null,
      userId: bundle.form.user_id,
      phone: lead.leadPhone,
      leadId: lead.leadId,
      sessionId: session.id,
      source: "complete",
    });

    return NextResponse.json({
      session: updatedSession,
      lead,
      final_config: bundle.form.final_config,
    });
  }

  if (action === "abandon") {
    if (session.status === "completed" || (session.answers_count || 0) === 0) {
      return NextResponse.json({ success: true });
    }

    await supabase
      .from("pre_checkout_sessions")
      .update({
        status: "abandoned",
        abandoned_at: new Date().toISOString(),
        last_interaction_at: new Date().toISOString(),
      })
      .eq("id", session.id)
      .neq("status", "completed");

    await insertEvent({ formId: bundle.form.id, userId: bundle.form.user_id, sessionId: session.id, leadId: session.lead_id, eventType: "abandoned", status: "warning" });
    await maybeEnqueueFlow({
      flowId: bundle.form.integrations?.flow_on_abandon_id || null,
      userId: bundle.form.user_id,
      phone: body?.phone || null,
      leadId: session.lead_id,
      sessionId: session.id,
      source: "abandon",
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
