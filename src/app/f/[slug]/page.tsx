"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatPhoneInputValue } from "@/lib/phone";
import { PRE_CHECKOUT_DEFAULT_THEME, PRE_CHECKOUT_SYSTEM_MESSAGE_DEFAULTS } from "@/lib/pre-checkout/templates";
import type { PreCheckoutConnectConfig, PreCheckoutFinalAction, PreCheckoutForm, PreCheckoutFormStep, PreCheckoutSystemMessages } from "@/types";

type SessionPayload = {
  id: string;
  session_token: string;
  resume_token: string;
  current_step_position: number;
  status: string;
  answers_count: number;
};

type PublicAnswerValue = string | string[] | number | boolean;

const TEXT_INPUT_TYPES = new Set(["short_text", "email", "phone", "number", "date"]);
const DISPLAY_ONLY_STEP_TYPES = new Set(["welcome_screen", "statement", "end_screen"]);

function storageKey(slug: string) {
  return `flowlux-form:${slug}:resume-token`;
}

function getConnectConfigFromForm(form: PreCheckoutForm | null): PreCheckoutConnectConfig {
  const connect = form?.integrations?.connect || {};
  return {
    meta_pixel_enabled: Boolean(connect.meta_pixel_enabled ?? form?.integrations?.pixel_enabled),
    meta_pixel_id: connect.meta_pixel_id ?? form?.integrations?.pixel_id ?? "",
    ga4_enabled: Boolean(connect.ga4_enabled),
    ga4_measurement_id: connect.ga4_measurement_id || "",
    gtm_enabled: Boolean(connect.gtm_enabled),
    gtm_container_id: connect.gtm_container_id || "",
  };
}

function getSystemMessages(form: PreCheckoutForm | null): PreCheckoutSystemMessages {
  return {
    ...PRE_CHECKOUT_SYSTEM_MESSAGE_DEFAULTS,
    ...(form?.session_settings?.system_messages || {}),
    buttons: { ...PRE_CHECKOUT_SYSTEM_MESSAGE_DEFAULTS.buttons, ...(form?.session_settings?.system_messages?.buttons || {}) },
    errors: { ...PRE_CHECKOUT_SYSTEM_MESSAGE_DEFAULTS.errors, ...(form?.session_settings?.system_messages?.errors || {}) },
    completion: { ...PRE_CHECKOUT_SYSTEM_MESSAGE_DEFAULTS.completion, ...(form?.session_settings?.system_messages?.completion || {}) },
    other: { ...PRE_CHECKOUT_SYSTEM_MESSAGE_DEFAULTS.other, ...(form?.session_settings?.system_messages?.other || {}) },
  };
}

function getTheme(form: PreCheckoutForm | null) {
  if (!form) return PRE_CHECKOUT_DEFAULT_THEME;
  const theme = form.theme || PRE_CHECKOUT_DEFAULT_THEME;
  const background = (theme.background || PRE_CHECKOUT_DEFAULT_THEME.background) as Partial<PreCheckoutForm["theme"]["background"]>;
  const typography = (theme.typography || PRE_CHECKOUT_DEFAULT_THEME.typography) as Partial<PreCheckoutForm["theme"]["typography"]>;
  const layout = (theme.layout || PRE_CHECKOUT_DEFAULT_THEME.layout) as Partial<PreCheckoutForm["theme"]["layout"]>;
  const branding = (theme.branding || PRE_CHECKOUT_DEFAULT_THEME.branding || {}) as Partial<NonNullable<PreCheckoutForm["theme"]["branding"]>>;

  return {
    style_key: theme.style_key || PRE_CHECKOUT_DEFAULT_THEME.style_key,
    primary_color: theme.primary_color || PRE_CHECKOUT_DEFAULT_THEME.primary_color,
    button_text_color: theme.button_text_color || PRE_CHECKOUT_DEFAULT_THEME.button_text_color,
    text_color: theme.text_color || PRE_CHECKOUT_DEFAULT_THEME.text_color,
    panel_color: theme.panel_color || PRE_CHECKOUT_DEFAULT_THEME.panel_color,
    input_background_color: theme.input_background_color || PRE_CHECKOUT_DEFAULT_THEME.input_background_color,
    input_text_color: theme.input_text_color || PRE_CHECKOUT_DEFAULT_THEME.input_text_color,
    input_border_color: theme.input_border_color || PRE_CHECKOUT_DEFAULT_THEME.input_border_color,
    background: {
      mode: background.mode || PRE_CHECKOUT_DEFAULT_THEME.background.mode,
      color: background.color || PRE_CHECKOUT_DEFAULT_THEME.background.color,
      image_url: background.image_url ?? PRE_CHECKOUT_DEFAULT_THEME.background.image_url,
      image_focus_x: background.image_focus_x ?? PRE_CHECKOUT_DEFAULT_THEME.background.image_focus_x,
      image_focus_y: background.image_focus_y ?? PRE_CHECKOUT_DEFAULT_THEME.background.image_focus_y,
    },
    typography: {
      heading_font: typography.heading_font || PRE_CHECKOUT_DEFAULT_THEME.typography.heading_font,
      body_font: typography.body_font || PRE_CHECKOUT_DEFAULT_THEME.typography.body_font,
      form_font: typography.form_font || PRE_CHECKOUT_DEFAULT_THEME.typography.form_font,
      button_radius: typography.button_radius || PRE_CHECKOUT_DEFAULT_THEME.typography.button_radius,
      input_radius: typography.input_radius || PRE_CHECKOUT_DEFAULT_THEME.typography.input_radius,
    },
    layout: {
      align: layout.align || PRE_CHECKOUT_DEFAULT_THEME.layout.align,
      spacing: layout.spacing || PRE_CHECKOUT_DEFAULT_THEME.layout.spacing,
    },
    branding: {
      ...(PRE_CHECKOUT_DEFAULT_THEME.branding || {}),
      logo_url: branding.logo_url ?? PRE_CHECKOUT_DEFAULT_THEME.branding?.logo_url ?? null,
      logo_position: branding.logo_position || PRE_CHECKOUT_DEFAULT_THEME.branding?.logo_position || "center",
      logo_size: branding.logo_size || PRE_CHECKOUT_DEFAULT_THEME.branding?.logo_size || "md",
      background_image_url: branding.background_image_url ?? PRE_CHECKOUT_DEFAULT_THEME.branding?.background_image_url ?? null,
      background_image_focus_x: branding.background_image_focus_x ?? PRE_CHECKOUT_DEFAULT_THEME.branding?.background_image_focus_x ?? 50,
      background_image_focus_y: branding.background_image_focus_y ?? PRE_CHECKOUT_DEFAULT_THEME.branding?.background_image_focus_y ?? 50,
      background_brightness: branding.background_brightness ?? PRE_CHECKOUT_DEFAULT_THEME.branding?.background_brightness,
    },
  };
}

function parseAnswer(answer: { step_id: string; answer_text?: string | null; answer_json?: Record<string, any> | null }) {
  if (typeof answer.answer_json?.accepted === "boolean") return [answer.step_id, answer.answer_json.accepted] as const;
  if (typeof answer.answer_json?.value === "number") return [answer.step_id, answer.answer_json.value] as const;
  if (typeof answer.answer_json?.value === "string") return [answer.step_id, answer.answer_json.value] as const;
  if (Array.isArray(answer.answer_json?.values)) return [answer.step_id, answer.answer_json.values] as const;
  return [answer.step_id, answer.answer_text || ""] as const;
}

function isEmptyValue(value: PublicAnswerValue) {
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "boolean") return !value;
  return !String(value ?? "").trim();
}

function toWhatsappUrl(phone?: string | null, message?: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message || "")}` : null;
}

function radiusClass(radius: "sm" | "md" | "lg" | "full") {
  if (radius === "sm") return "rounded-xl";
  if (radius === "lg") return "rounded-3xl";
  if (radius === "full") return "rounded-full";
  return "rounded-2xl";
}

function getLogoSizeClass(size?: NonNullable<PreCheckoutForm["theme"]["branding"]>["logo_size"]) {
  if (size === "sm") return "max-h-10 max-w-[140px]";
  if (size === "lg") return "max-h-20 max-w-[260px]";
  if (size === "xl") return "max-h-28 max-w-[320px]";
  return "max-h-14 max-w-[180px]";
}

function getStepMediaLayout(settings: PreCheckoutFormStep["settings"] | undefined, device: "desktop" | "mobile") {
  if (device === "mobile") return settings?.media_layout_mobile || "background";
  return settings?.media_layout_desktop || "background";
}

function getStepLabel(step: PreCheckoutFormStep, isLast: boolean, finalConfig: PreCheckoutForm["final_config"], messages: PreCheckoutSystemMessages) {
  if (step.settings?.button_label?.trim()) return step.settings.button_label;
  if (step.type === "legal") return messages.buttons.legal_accept_label;
  return isLast ? finalConfig?.button_label || messages.buttons.submit_label : messages.buttons.confirm_answer;
}

function getStepOptions(step: PreCheckoutFormStep, messages: PreCheckoutSystemMessages) {
  if (step.type === "yes_no" && (!step.options || step.options.length === 0)) {
    return [
      { id: `${step.id}-yes`, label: messages.buttons.yes_label, value: "sim" },
      { id: `${step.id}-no`, label: messages.buttons.no_label, value: "nao" },
    ];
  }
  return step.options || [];
}

export default function PublicFormPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = params?.slug;
  const previewMode = searchParams?.get("preview") === "1";
  const editorPreviewKey = searchParams?.get("editorPreviewKey") || "";
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<PreCheckoutForm | null>(null);
  const [steps, setSteps] = useState<PreCheckoutFormStep[]>([]);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, PublicAnswerValue>>({});
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [viewportMode, setViewportMode] = useState<"desktop" | "mobile">("desktop");
  const [screenError, setScreenError] = useState("");
  const [completedMessage, setCompletedMessage] = useState<{ title: string; description: string } | null>(null);
  const startedTrackedRef = useRef(false);

  const currentStep = steps[currentStepIndex] || null;
  const currentValue = currentStep ? answers[currentStep.id] ?? (currentStep.type === "multiple_choice" ? [] : currentStep.type === "legal" ? false : "") : "";
  const isLastStep = currentStepIndex >= steps.length - 1;
  const theme = useMemo(() => getTheme(form), [form]);
  const messages = useMemo(() => getSystemMessages(form), [form]);
  const connectConfig = useMemo(() => getConnectConfigFromForm(form), [form]);

  const pageStyle = useMemo<React.CSSProperties>(
    () => ({ fontFamily: theme.typography.body_font }),
    [theme]
  );

  const fireTrackingEvent = (name: string, payload: Record<string, unknown> = {}) => {
    if (previewMode || typeof window === "undefined") return;
    const fbq = (window as any).fbq;
    if (typeof fbq === "function") fbq("trackCustom", name, payload);
    const gtag = (window as any).gtag;
    if (typeof gtag === "function") gtag("event", name, payload);
    const dataLayer = (window as any).dataLayer;
    if (Array.isArray(dataLayer)) dataLayer.push({ event: name, ...payload });
  };

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (previewMode && editorPreviewKey && typeof window !== "undefined") {
        try {
          const previewPayload = window.localStorage.getItem(editorPreviewKey);
          if (previewPayload) {
            const parsed = JSON.parse(previewPayload);
            const previewForm = parsed?.form as PreCheckoutForm | null;
            const previewSteps = Array.isArray(parsed?.steps) ? (parsed.steps as PreCheckoutFormStep[]) : [];
            if (!cancelled && previewForm && previewSteps.length) {
              setForm(previewForm);
              setSteps(previewSteps);
              setSession(null);
              setAnswers({});
              setCurrentStepIndex(0);
              setLoading(false);
              return;
            }
          }
        } catch {
          // ignore and fall through
        }
      }
      const resumeToken = window.localStorage.getItem(storageKey(slug));
      const query = new URLSearchParams(window.location.search);
      const getResponse = await fetch(`/api/pre-checkout/${slug}`);
      if (!getResponse.ok) {
        if (!cancelled) setScreenError(messages.completion.unavailable);
        setLoading(false);
        return;
      }
      const initialData = await getResponse.json();
      const bootstrapResponse = await fetch(`/api/pre-checkout/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bootstrap",
          resume_token: resumeToken,
          utm_source: query.get("utm_source"),
          utm_medium: query.get("utm_medium"),
          utm_campaign: query.get("utm_campaign"),
          fbclid: query.get("fbclid"),
          gclid: query.get("gclid"),
          referrer: document.referrer || null,
        }),
      });
      if (!bootstrapResponse.ok) {
        if (!cancelled) setScreenError(messages.completion.no_connection);
        setLoading(false);
        return;
      }
      const sessionData = await bootstrapResponse.json();
      if (cancelled) return;
      setForm(initialData.form);
      setSteps(initialData.steps || []);
      setSession(sessionData.session);
      setAnswers(Object.fromEntries((sessionData.answers || []).map(parseAnswer)));
      setCurrentStepIndex(Math.min(sessionData.session?.current_step_position || 0, Math.max((initialData.steps || []).length - 1, 0)));
      window.localStorage.setItem(storageKey(slug), sessionData.session.resume_token);
      fireTrackingEvent("FlowLuxFormView", { slug });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [editorPreviewKey, messages.completion.no_connection, messages.completion.unavailable, previewMode, slug]);

  useEffect(() => {
    if (previewMode || !slug || !session || completedMessage) return;
    const handleAbandon = () => {
      if ((session.answers_count || 0) === 0) return;
      navigator.sendBeacon(`/api/pre-checkout/${slug}`, new Blob([JSON.stringify({ action: "abandon", session_token: session.session_token })], { type: "application/json" }));
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") handleAbandon();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [completedMessage, previewMode, session, slug]);

  useEffect(() => {
    const syncViewport = () => setViewportMode(window.innerWidth < 768 ? "mobile" : "desktop");
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  const setAnswer = (value: PublicAnswerValue) => currentStep && setAnswers((current) => ({ ...current, [currentStep.id]: value }));

  const handleFieldInputChange = (value: string) => {
    if (currentStep?.type === "phone") return setAnswer(formatPhoneInputValue(value));
    setAnswer(value);
  };

  const handleContinue = async () => {
    if (!currentStep || !form) return;
    if (currentStep.is_required && !DISPLAY_ONLY_STEP_TYPES.has(currentStep.type) && isEmptyValue(currentValue)) {
      setScreenError(["single_choice", "picture_choice", "dropdown", "yes_no", "multiple_choice"].includes(currentStep.type) ? messages.errors.selection_required : currentStep.type === "legal" ? messages.errors.legal_rejected : messages.errors.required);
      return;
    }

    if (previewMode) {
      setScreenError("");
      if (!isLastStep) {
        setCurrentStepIndex((current) => Math.min(current + 1, steps.length - 1));
        return;
      }
      setCompletedMessage({
        title: form.final_config?.thank_you_title || messages.completion.success,
        description: form.final_config?.thank_you_description || "Assim que publicar, essa sera a experiencia final do form.",
      });
      return;
    }

    if (!session) return;
    setSubmitting(true);
    setScreenError("");
    if (!startedTrackedRef.current) {
      fireTrackingEvent("FlowLuxFormStart", { slug });
      startedTrackedRef.current = true;
    }
    const answerValue: PublicAnswerValue = currentStep.type === "legal" ? Boolean(currentValue) : ["number", "rating", "opinion_scale", "nps"].includes(currentStep.type) && currentValue !== "" ? Number(currentValue) : currentValue;
    const answerResponse = await fetch(`/api/pre-checkout/${slug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "answer", session_token: session.session_token, step_id: currentStep.id, value: answerValue, next_position: Math.min(currentStepIndex + 1, steps.length - 1) }),
    });
    if (!answerResponse.ok) {
      const errorData = await answerResponse.json().catch(() => ({}));
      setScreenError(errorData.error || messages.completion.server_error);
      setSubmitting(false);
      return;
    }
    const answerPayload = await answerResponse.json();
    setSession(answerPayload.session);
    fireTrackingEvent("FlowLuxFormStepAnswered", { slug, step_key: currentStep.step_key, step_type: currentStep.type });
    if (!isLastStep) {
      setCurrentStepIndex((current) => Math.min(current + 1, steps.length - 1));
      setSubmitting(false);
      return;
    }
    const completeResponse = await fetch(`/api/pre-checkout/${slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete", session_token: session.session_token }) });
    const completePayload = await completeResponse.json().catch(() => ({}));
    setSubmitting(false);
    if (!completeResponse.ok) {
      setScreenError(completePayload.error || messages.completion.server_error);
      return;
    }
    fireTrackingEvent("Lead", { slug });
    fireTrackingEvent("FlowLuxFormComplete", { slug });
    window.localStorage.removeItem(storageKey(slug));
    if (completePayload.redirect_url_override) return void (window.location.href = completePayload.redirect_url_override);
    const action = completePayload.final_config?.action as PreCheckoutFinalAction | undefined;
    if (action === "checkout_redirect" && completePayload.final_config?.redirect_url) return void (window.location.href = completePayload.final_config.redirect_url);
    if (action === "whatsapp_redirect") {
      const url = toWhatsappUrl(completePayload.final_config?.whatsapp_phone, completePayload.final_config?.whatsapp_message);
      if (url) return void (window.location.href = url);
    }
    setCompletedMessage({
      title: completePayload.final_config?.thank_you_title || messages.completion.success,
      description: completePayload.final_config?.thank_you_description || "Recebemos suas respostas e vamos seguir daqui.",
    });
  };

  const inputStyle: React.CSSProperties = { backgroundColor: theme.input_background_color || "#FFFFFF", color: theme.input_text_color || "#111827", borderColor: theme.input_border_color || "#D8DDE7" };
  const buttonStyle: React.CSSProperties = { backgroundColor: theme.primary_color, color: theme.button_text_color || "#FFFFFF" };
  const previewSpacingClass =
    theme.layout.spacing === "compact"
      ? "space-y-5 p-6"
      : theme.layout.spacing === "relaxed"
        ? "space-y-9 p-10"
        : "space-y-7 p-8";
  const mediaBrightness = currentStep?.settings?.media_brightness ?? 100;
  const currentMediaLayout = getStepMediaLayout(currentStep?.settings, viewportMode);
  const globalBackgroundImageUrl =
    theme.branding?.background_image_url ||
    (theme.background.mode === "image" ? theme.background.image_url : null) ||
    null;
  const globalBackgroundPosition = `${theme.branding?.background_image_focus_x || theme.background.image_focus_x}% ${theme.branding?.background_image_focus_y || theme.background.image_focus_y}%`;
  const globalBackgroundBrightness = theme.branding?.background_brightness || 100;
  const stepVideoUrl = currentStep?.settings?.video_url || null;
  const stepImageUrl = !stepVideoUrl ? currentStep?.settings?.image_url || null : null;
  const stepHasVisual = Boolean(stepVideoUrl || stepImageUrl);
  const surfaceHasBackground = Boolean(globalBackgroundImageUrl);
  const usesBackgroundMedia = stepHasVisual && currentMediaLayout === "background";
  const usesTopMedia = stepHasVisual && !usesBackgroundMedia && (currentMediaLayout === "top" || currentMediaLayout === "top-wide");
  const usesSplitMedia =
    stepHasVisual &&
    !usesBackgroundMedia &&
    ["left", "left-wide", "right", "right-wide"].includes(currentMediaLayout);
  const contentUsesOverlay = surfaceHasBackground || usesBackgroundMedia;
  const surfaceTextColor = contentUsesOverlay ? "#FFFFFF" : theme.text_color;
  const surfaceMetaColor = contentUsesOverlay ? "rgba(255,255,255,0.72)" : "#8C92A4";
  const surfaceInputStyle: React.CSSProperties = contentUsesOverlay
    ? {
        backgroundColor: "rgba(15, 23, 42, 0.55)",
        borderColor: "rgba(255,255,255,0.16)",
        color: "#FFFFFF",
      }
    : inputStyle;
  const columnAlignmentClass = "items-center text-center";
  const mediaNode = stepHasVisual ? (
    <div className="relative h-full w-full overflow-hidden bg-[#0B0B12]">
      {stepVideoUrl ? (
        <video
          src={stepVideoUrl}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: `brightness(${mediaBrightness}%)` }}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : stepImageUrl ? (
        <img
          src={stepImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: `brightness(${mediaBrightness}%)`, objectPosition: "50% 50%" }}
        />
      ) : null}
    </div>
  ) : null;
  const backgroundMediaNode = surfaceHasBackground ? (
    <div className="absolute inset-0 overflow-hidden bg-[#0B0B12]">
      {globalBackgroundImageUrl ? (
        <img
          src={globalBackgroundImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: `brightness(${globalBackgroundBrightness}%)`, objectPosition: globalBackgroundPosition }}
        />
      ) : null}
    </div>
  ) : null;
  const stepBackgroundNode = usesBackgroundMedia ? (
    <div className="absolute inset-0 overflow-hidden bg-[#0B0B12]">
      {stepVideoUrl ? (
        <video
          src={stepVideoUrl}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: `brightness(${mediaBrightness}%)` }}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : stepImageUrl ? (
        <img
          src={stepImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: `brightness(${mediaBrightness}%)`, objectPosition: "50% 50%" }}
        />
      ) : null}
    </div>
  ) : null;

  const formBody = (
    <form className={`mx-auto w-full max-w-[720px] space-y-6 ${theme.layout.align === "left" ? "text-left" : "text-center"}`} onSubmit={(event) => { event.preventDefault(); void handleContinue(); }}>
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em]" style={{ color: surfaceMetaColor }}><span>{form?.name}</span><span>{currentStepIndex + 1}/{steps.length}</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full transition-all" style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%`, backgroundColor: theme.primary_color }} /></div>
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold sm:text-4xl" style={{ fontFamily: theme.typography.heading_font }}>{currentStep?.title}</h1>
          {(currentStep?.description || form?.description) ? <p className="max-w-2xl text-base opacity-80">{currentStep?.description || form?.description}</p> : null}
        </div>
      </div>

      <div className="space-y-4">
        {currentStep && TEXT_INPUT_TYPES.has(currentStep.type) ? <Input type={currentStep.type === "email" ? "email" : currentStep.type === "date" ? "date" : currentStep.type === "number" ? "number" : "text"} inputMode={currentStep.type === "phone" ? "tel" : currentStep.type === "number" ? "numeric" : undefined} value={typeof currentValue === "string" || typeof currentValue === "number" ? String(currentValue) : ""} onChange={(event) => handleFieldInputChange(event.target.value)} placeholder={currentStep.placeholder || messages.buttons.text_hint} className={`h-14 border ${radiusClass(theme.typography.input_radius)}`} style={surfaceInputStyle} /> : null}
        {currentStep?.type === "long_text" ? <Textarea value={typeof currentValue === "string" ? currentValue : ""} onChange={(event) => setAnswer(event.target.value)} placeholder={currentStep.placeholder || messages.buttons.text_hint} className={`min-h-[180px] border ${radiusClass(theme.typography.input_radius)}`} style={surfaceInputStyle} /> : null}
        {currentStep?.type === "dropdown" ? <div className="space-y-2"><select value={typeof currentValue === "string" ? currentValue : ""} onChange={(event) => setAnswer(event.target.value)} className={`h-14 w-full border px-4 ${radiusClass(theme.typography.input_radius)}`} style={surfaceInputStyle}><option value="">{messages.buttons.dropdown_touch_hint}</option>{getStepOptions(currentStep, messages).map((option) => <option key={option.id} value={option.value}>{option.label}</option>)}</select><p className="text-sm opacity-65">{messages.buttons.dropdown_hint}</p></div> : null}
        {currentStep && (currentStep.type === "single_choice" || currentStep.type === "yes_no") ? <div className="grid gap-3">{getStepOptions(currentStep, messages).map((option) => { const active = currentValue === option.value; return <button key={option.id} type="button" onClick={() => setAnswer(option.value)} className={`border px-5 py-4 text-left text-base transition-colors ${radiusClass(theme.typography.input_radius)} ${active ? "border-transparent" : "border-black/10 bg-black/5 hover:bg-black/10"}`} style={{ backgroundColor: active ? theme.primary_color : contentUsesOverlay ? "rgba(15, 23, 42, 0.55)" : undefined, color: active ? theme.button_text_color || "#FFFFFF" : surfaceTextColor }}>{option.label}</button>; })}</div> : null}
        {currentStep?.type === "picture_choice" ? <div className="grid gap-4 sm:grid-cols-2">{getStepOptions(currentStep, messages).map((option) => { const active = currentValue === option.value; return <button key={option.id} type="button" onClick={() => setAnswer(option.value)} className={`overflow-hidden border text-left transition-colors ${radiusClass(theme.typography.input_radius)} ${active ? "border-transparent" : "border-black/10 bg-black/5 hover:bg-black/10"}`} style={{ backgroundColor: active ? theme.primary_color : contentUsesOverlay ? "rgba(15, 23, 42, 0.55)" : undefined, color: active ? theme.button_text_color || "#FFFFFF" : surfaceTextColor }}><div className="aspect-[4/3] w-full overflow-hidden border-b border-white/10 bg-black/10">{option.image_url ? <img src={option.image_url} alt={option.label} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm opacity-60">Imagem da opção</div>}</div><div className="px-4 py-3 text-base font-medium">{option.label}</div></button>; })}</div> : null}
        {currentStep?.type === "multiple_choice" ? <div className="space-y-3"><p className="text-sm opacity-65">{messages.buttons.multiple_choice_hint}</p><div className="grid gap-3">{getStepOptions(currentStep, messages).map((option) => { const selected = Array.isArray(currentValue) ? currentValue.map(String).includes(option.value) : false; return <button key={option.id} type="button" onClick={() => { const list = Array.isArray(currentValue) ? currentValue.map(String) : []; setAnswer(list.includes(option.value) ? list.filter((item) => item !== option.value) : [...list, option.value]); }} className={`flex items-center gap-3 border px-5 py-4 text-left text-base transition-colors ${radiusClass(theme.typography.input_radius)} ${selected ? "border-transparent" : "border-black/10 bg-black/5 hover:bg-black/10"}`} style={{ backgroundColor: selected ? theme.primary_color : contentUsesOverlay ? "rgba(15, 23, 42, 0.55)" : undefined, color: selected ? theme.button_text_color || "#FFFFFF" : surfaceTextColor }}><span className={`h-5 w-5 rounded-md border ${selected ? "border-white bg-white/20" : "border-black/30"}`} /><span>{option.label}</span></button>; })}</div></div> : null}
        {currentStep && ["rating", "opinion_scale", "nps"].includes(currentStep.type) ? <div className="space-y-4"><div className="flex flex-wrap gap-3">{Array.from({ length: ((currentStep.settings?.max_value || (currentStep.type === "rating" ? 5 : 10)) - (typeof currentStep.settings?.min_value === "number" ? currentStep.settings.min_value : currentStep.type === "nps" ? 0 : 1)) + 1 }).map((_, index) => { const min = typeof currentStep.settings?.min_value === "number" ? currentStep.settings.min_value : currentStep.type === "nps" ? 0 : 1; const value = min + index; const active = Number(currentValue) === value; return <button key={value} type="button" onClick={() => setAnswer(value)} className={`flex h-14 w-14 items-center justify-center border text-base font-semibold transition-colors ${radiusClass(theme.typography.button_radius)} ${active ? "border-transparent" : "border-black/10 bg-black/5 hover:bg-black/10"}`} style={{ backgroundColor: active ? theme.primary_color : contentUsesOverlay ? "rgba(15, 23, 42, 0.55)" : undefined, color: active ? theme.button_text_color || "#FFFFFF" : surfaceTextColor }}>{value}</button>; })}</div><div className="flex justify-between text-sm opacity-70"><span>{currentStep.settings?.min_label || ""}</span><span>{currentStep.settings?.max_label || ""}</span></div></div> : null}
        {currentStep?.type === "legal" ? <label className={`flex items-start gap-3 border border-black/10 bg-black/5 px-5 py-5 text-left text-base ${radiusClass(theme.typography.input_radius)}`} style={contentUsesOverlay ? { backgroundColor: "rgba(15, 23, 42, 0.55)", borderColor: "rgba(255,255,255,0.16)" } : undefined}><input type="checkbox" checked={Boolean(currentValue)} onChange={(event) => setAnswer(event.target.checked)} className="mt-1 h-5 w-5 rounded border-black/30" /><div className="space-y-1"><div>{currentStep.settings?.legal_consent_text || currentStep.description || messages.buttons.legal_accept_label}</div><div className="text-sm opacity-70">{currentStep.settings?.legal_required_label || messages.errors.legal_rejected}</div></div></label> : null}
      </div>

      {screenError ? <p className="text-sm text-rose-500">{screenError}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="ghost" disabled={currentStepIndex === 0 || submitting} onClick={() => setCurrentStepIndex((current) => Math.max(0, current - 1))}>Voltar</Button>
        <div className="flex items-center gap-3">
          {!DISPLAY_ONLY_STEP_TYPES.has(currentStep?.type || "") && currentStep?.type !== "multiple_choice" && currentStep?.type !== "legal" && currentStep?.type !== "long_text" ? <span className="hidden text-sm opacity-60 sm:inline">{messages.buttons.next_hint}</span> : null}
          <Button type="submit" disabled={submitting} className={radiusClass(theme.typography.button_radius)} style={buttonStyle}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>{currentStep ? getStepLabel(currentStep, isLastStep, form!.final_config, messages) : messages.buttons.confirm_answer}</span><ChevronRight className="ml-2 h-4 w-4" /></>}</Button>
        </div>
      </div>
    </form>
  );

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#0D0E14]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!form || !steps.length) return <div className="flex min-h-screen items-center justify-center bg-[#0D0E14] p-6 text-center text-white">{screenError || messages.completion.unavailable}</div>;

  return (
    <div className="min-h-screen" style={pageStyle}>
      {!previewMode && connectConfig.meta_pixel_enabled && connectConfig.meta_pixel_id && <Script id={`pixel-${form.id}`} strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '${connectConfig.meta_pixel_id}');fbq('track', 'PageView');`}</Script>}
      {!previewMode && connectConfig.ga4_enabled && connectConfig.ga4_measurement_id && <><Script src={`https://www.googletagmanager.com/gtag/js?id=${connectConfig.ga4_measurement_id}`} strategy="afterInteractive" /><Script id={`ga4-${form.id}`} strategy="afterInteractive">{`window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}window.gtag = gtag;gtag('js', new Date());gtag('config', '${connectConfig.ga4_measurement_id}');`}</Script></>}
      {!previewMode && connectConfig.gtm_enabled && connectConfig.gtm_container_id && <><Script id={`gtm-${form.id}`} strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${connectConfig.gtm_container_id}');`}</Script><noscript><iframe src={`https://www.googletagmanager.com/ns.html?id=${connectConfig.gtm_container_id}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} /></noscript></>}

      <div
        className="relative min-h-screen w-full overflow-hidden"
        style={{
          backgroundColor: theme.panel_color,
          color: surfaceTextColor,
          minHeight: viewportMode === "mobile" ? 680 : 560,
        }}
      >
        {surfaceHasBackground ? backgroundMediaNode : null}
        {usesBackgroundMedia ? stepBackgroundNode : null}
        {contentUsesOverlay ? <div className="absolute inset-0 bg-black/35" /> : null}

        <div className={`relative z-10 flex min-h-screen w-full flex-col ${previewSpacingClass}`}>
              {theme.branding?.logo_url ? (
                <div className={`flex ${theme.branding.logo_position === "left" ? "justify-start" : "justify-center"}`}>
                  <img src={theme.branding.logo_url} alt="" className={`${getLogoSizeClass(theme.branding.logo_size)} w-auto object-contain`} />
                </div>
              ) : null}

              {completedMessage ? (
                <div className={`mx-auto flex w-full max-w-[900px] flex-1 flex-col gap-4 py-10 ${columnAlignmentClass}`}>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10"><CheckCircle2 className="h-8 w-8 text-emerald-500" /></div>
                  <div className="space-y-2"><h1 className="text-3xl font-semibold" style={{ fontFamily: theme.typography.heading_font }}>{completedMessage.title}</h1><p className="max-w-xl text-sm opacity-80">{completedMessage.description}</p></div>
                </div>
              ) : (
                <div className="mx-auto flex w-full max-w-[900px] flex-1 flex-col items-center justify-center text-center">
                  {usesTopMedia ? (
                    <div className={`mb-6 w-full ${currentMediaLayout === "top-wide" ? "h-64" : "h-44"}`}>
                      {mediaNode}
                    </div>
                  ) : null}

                  {usesSplitMedia ? (
                    <div className={`grid w-full flex-1 items-stretch gap-6 ${currentMediaLayout === "left-wide" || currentMediaLayout === "right-wide" ? "md:grid-cols-[1.2fr_0.8fr]" : "md:grid-cols-[1fr_1fr]"}`}>
                      {currentMediaLayout.startsWith("left") ? (
                        <>
                          <div className="h-full min-h-[420px]">{mediaNode}</div>
                          <div className="flex flex-col justify-center">{formBody}</div>
                        </>
                      ) : (
                        <>
                          <div className="flex flex-col justify-center">{formBody}</div>
                          <div className="h-full min-h-[420px]">{mediaNode}</div>
                        </>
                      )}
                    </div>
                  ) : (
                    formBody
                  )}
                </div>
              )}
        </div>
      </div>
    </div>
  );
}
