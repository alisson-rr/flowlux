import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getPhoneIdentity } from "@/lib/phone";
import {
  buildWhatsappRedirectUrl,
  findOrCreateLeadFromPopup,
  getPublishedCapturePopup,
  insertCapturePopupEvent,
  maybeEnqueuePopupFlow,
  withPublicCors,
} from "@/lib/capture-popups/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonWithCors(body: unknown, init?: ResponseInit) {
  return withPublicCors(NextResponse.json(body, init));
}

function normalizeAnswerValue(value: unknown) {
  return String(value || "").trim();
}

function sanitizePopupForPublic(popup: any, fields: any[]) {
  return {
    popup: {
      id: popup.id,
      name: popup.name,
      slug: popup.slug,
      description: popup.description,
      content: popup.content,
      theme: popup.theme,
      trigger: popup.trigger,
      integrations: {
        success_mode: popup.integrations?.success_mode,
        redirect_url: popup.integrations?.redirect_url,
        whatsapp_phone: popup.integrations?.whatsapp_phone,
        whatsapp_message: popup.integrations?.whatsapp_message,
        pixel_enabled: popup.integrations?.pixel_enabled,
        pixel_id: popup.integrations?.pixel_id,
      },
    },
    fields: fields.map((field) => ({
      id: field.id,
      field_key: field.field_key,
      position: field.position,
      type: field.type,
      label: field.label,
      placeholder: field.placeholder,
      is_required: field.is_required,
      width: field.width,
      settings: field.settings,
    })),
  };
}

async function parseBody(req: NextRequest) {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export async function OPTIONS() {
  return withPublicCors(new NextResponse(null, { status: 204 }));
}

export async function GET(_: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const bundle = await getPublishedCapturePopup(slug);

  if (!bundle) {
    return jsonWithCors({ error: "Popup nao encontrado" }, { status: 404 });
  }

  return jsonWithCors(sanitizePopupForPublic(bundle.popup, bundle.fields));
}

export async function POST(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const bundle = await getPublishedCapturePopup(slug);

  if (!bundle) {
    return jsonWithCors({ error: "Popup nao encontrado" }, { status: 404 });
  }

  const body = await parseBody(req);
  const rawAnswers = body?.answers && typeof body.answers === "object" ? body.answers : {};
  const fieldValues = Object.fromEntries(
    bundle.fields.map((field) => [field.field_key, normalizeAnswerValue(rawAnswers[field.field_key])]),
  ) as Record<string, string>;

  for (const field of bundle.fields) {
    const value = fieldValues[field.field_key];
    if (field.is_required && !value) {
      return jsonWithCors({ error: `Preencha o campo ${field.label}.` }, { status: 400 });
    }

    if (field.type === "email" && value && !EMAIL_REGEX.test(value)) {
      return jsonWithCors({ error: "Informe um email valido." }, { status: 400 });
    }

    if (field.type === "phone" && value && !getPhoneIdentity(value)) {
      return jsonWithCors({ error: "Informe um telefone valido." }, { status: 400 });
    }
  }

  const lead = await findOrCreateLeadFromPopup({
    popup: bundle.popup,
    fieldValues,
  });

  const supabase = getSupabaseAdmin();
  const { data: submission, error: submissionError } = await supabase
    .from("capture_popup_submissions")
    .insert({
      popup_id: bundle.popup.id,
      user_id: bundle.popup.user_id,
      lead_id: lead.leadId,
      visitor_name: fieldValues.name || null,
      visitor_email: fieldValues.email || null,
      visitor_phone_raw: fieldValues.phone || null,
      visitor_phone_e164: lead.phoneFields?.phone_e164 || null,
      visitor_phone_search_keys: lead.phoneFields?.phone_search_keys || [],
      answers: fieldValues,
      source_url: body?.source_url || null,
      referrer: body?.referrer || null,
      utm_source: body?.utm_source || null,
      utm_medium: body?.utm_medium || null,
      utm_campaign: body?.utm_campaign || null,
      fbclid: body?.fbclid || null,
      gclid: body?.gclid || null,
      submitted_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (submissionError || !submission) {
    await insertCapturePopupEvent({
      popupId: bundle.popup.id,
      userId: bundle.popup.user_id,
      eventType: "submit",
      status: "error",
      sessionToken: body?.session_token || null,
      metadata: { reason: submissionError?.message || "submission_failed" },
    });
    return jsonWithCors({ error: "Nao foi possivel registrar o lead." }, { status: 500 });
  }

  await insertCapturePopupEvent({
    popupId: bundle.popup.id,
    userId: bundle.popup.user_id,
    submissionId: submission.id,
    leadId: lead.leadId,
    sessionToken: body?.session_token || null,
    eventType: "submit",
    metadata: { source_url: body?.source_url || null },
  });

  await maybeEnqueuePopupFlow({
    popup: bundle.popup,
    flowId: bundle.popup.integrations?.flow_on_submit_id || null,
    phone: lead.leadPhone,
    leadId: lead.leadId,
    submissionId: submission.id,
  });

  const successMode = bundle.popup.integrations?.success_mode || "inline_message";
  const redirectUrl = successMode === "redirect"
    ? String(bundle.popup.integrations?.redirect_url || "")
    : successMode === "whatsapp"
      ? buildWhatsappRedirectUrl(
        bundle.popup.integrations?.whatsapp_phone,
        bundle.popup.integrations?.whatsapp_message,
      )
      : null;

  if (redirectUrl) {
    await insertCapturePopupEvent({
      popupId: bundle.popup.id,
      userId: bundle.popup.user_id,
      submissionId: submission.id,
      leadId: lead.leadId,
      sessionToken: body?.session_token || null,
      eventType: "redirect",
      metadata: { redirect_url: redirectUrl },
    });
  }

  return jsonWithCors({
    success: true,
    submission_id: submission.id,
    lead_id: lead.leadId,
    success_mode: successMode,
    redirect_url: redirectUrl,
    success_title: bundle.popup.content?.success_title || "Tudo certo",
    success_description:
      bundle.popup.content?.success_description || "Recebemos seus dados e vamos te redirecionar agora.",
  });
}
