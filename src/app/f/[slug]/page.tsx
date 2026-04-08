"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { useParams } from "next/navigation";
import { CheckCircle2, ChevronRight, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PreCheckoutForm, PreCheckoutFormStep } from "@/types";

type SessionPayload = {
  id: string;
  session_token: string;
  resume_token: string;
  current_step_position: number;
  status: string;
  answers_count: number;
};

function storageKey(slug: string) {
  return `flowlux-pre-checkout:${slug}:resume-token`;
}

function parsePublicAnswer(answer: { step_id: string; answer_text?: string | null; answer_json?: Record<string, any> | null }) {
  if (typeof answer.answer_json?.value === "string") return [answer.step_id, answer.answer_json.value] as const;
  if (Array.isArray(answer.answer_json?.values)) return [answer.step_id, answer.answer_json.values] as const;
  return [answer.step_id, answer.answer_text || ""] as const;
}

function toWhatsappUrl(phone?: string | null, message?: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  const text = encodeURIComponent(message || "");
  return digits ? `https://wa.me/${digits}?text=${text}` : null;
}

export default function PublicPreCheckoutPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<PreCheckoutForm | null>(null);
  const [steps, setSteps] = useState<PreCheckoutFormStep[]>([]);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [screenError, setScreenError] = useState("");
  const [completedMessage, setCompletedMessage] = useState<{ title: string; description: string } | null>(null);
  const startedTrackedRef = useRef(false);

  const currentStep = steps[currentStepIndex] || null;
  const currentValue = currentStep ? answers[currentStep.id] ?? (currentStep.type === "multiple_choice" ? [] : "") : "";
  const isLastStep = currentStepIndex >= steps.length - 1;

  const layoutClass = useMemo(() => {
    const width = form?.theme.layout.width || "md";
    if (width === "sm") return "max-w-md";
    if (width === "lg") return "max-w-4xl";
    return "max-w-2xl";
  }, [form?.theme.layout.width]);

  const backgroundStyle = useMemo<React.CSSProperties>(() => {
    if (!form) return {};
    const background = form.theme.background;
    if (background.mode === "image" && background.image_url) {
      return {
        backgroundImage: `linear-gradient(rgba(0,0,0,${background.image_overlay / 100}), rgba(0,0,0,${background.image_overlay / 100})), url(${background.image_url})`,
        backgroundSize: "cover",
        backgroundPosition: `${background.image_focus_x}% ${background.image_focus_y}%`,
      };
    }

    return { background: background.color };
  }, [form]);

  const firePixel = (name: string, payload: Record<string, unknown> = {}) => {
    const fbq = typeof window !== "undefined" ? (window as any).fbq : null;
    if (typeof fbq === "function") {
      fbq("trackCustom", name, payload);
    }
  };

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;
    const bootstrap = async () => {
      setLoading(true);
      setScreenError("");

      const resumeToken = window.localStorage.getItem(storageKey(slug));
      const query = new URLSearchParams(window.location.search);
      const getResponse = await fetch(`/api/pre-checkout/${slug}`);
      if (!getResponse.ok) {
        if (!cancelled) setScreenError("Este formulário não está disponível no momento.");
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
        if (!cancelled) setScreenError("Não foi possível iniciar este formulário.");
        setLoading(false);
        return;
      }

      const sessionData = await bootstrapResponse.json();
      if (cancelled) return;

      const nextAnswers = Object.fromEntries((sessionData.answers || []).map(parsePublicAnswer));
      setForm(initialData.form);
      setSteps(initialData.steps || []);
      setSession(sessionData.session);
      setAnswers(nextAnswers);
      setCurrentStepIndex(Math.min(sessionData.session?.current_step_position || 0, Math.max((initialData.steps || []).length - 1, 0)));
      window.localStorage.setItem(storageKey(slug), sessionData.session.resume_token);
      firePixel("FlowLuxPreCheckoutView", { slug });
      setLoading(false);
    };

    bootstrap();
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (!slug || !session || completedMessage) return;

    const handleAbandon = () => {
      if ((session.answers_count || 0) === 0) return;
      const phoneAnswer = Object.entries(answers).find(([stepId]) => steps.find((step) => step.id === stepId)?.type === "phone")?.[1];
      navigator.sendBeacon(
        `/api/pre-checkout/${slug}`,
        new Blob([JSON.stringify({
          action: "abandon",
          session_token: session.session_token,
          phone: typeof phoneAnswer === "string" ? phoneAnswer : "",
        })], { type: "application/json" }),
      );
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") handleAbandon();
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [answers, completedMessage, session, slug, steps]);

  const setAnswer = (value: string | string[]) => {
    if (!currentStep) return;
    setAnswers((current) => ({ ...current, [currentStep.id]: value }));
  };

  const toggleMultipleChoice = (value: string) => {
    const current = Array.isArray(currentValue) ? currentValue : [];
    setAnswer(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const handleContinue = async () => {
    if (!currentStep || !session) return;
    if (currentStep.is_required && ((Array.isArray(currentValue) && currentValue.length === 0) || (!Array.isArray(currentValue) && !String(currentValue || "").trim()))) {
      setScreenError("Preencha este campo para continuar.");
      return;
    }

    setSubmitting(true);
    setScreenError("");
    if (!startedTrackedRef.current) {
      firePixel("FlowLuxPreCheckoutStart", { slug });
      startedTrackedRef.current = true;
    }

    const answerResponse = await fetch(`/api/pre-checkout/${slug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "answer",
        session_token: session.session_token,
        step_id: currentStep.id,
        value: currentValue,
        next_position: Math.min(currentStepIndex + 1, steps.length - 1),
      }),
    });

    if (!answerResponse.ok) {
      const errorData = await answerResponse.json().catch(() => ({}));
      setScreenError(errorData.error || "Não foi possível salvar sua resposta.");
      setSubmitting(false);
      return;
    }

    const answerPayload = await answerResponse.json();
    setSession(answerPayload.session);

    if (!isLastStep) {
      setCurrentStepIndex((current) => Math.min(current + 1, steps.length - 1));
      setSubmitting(false);
      return;
    }

    const completeResponse = await fetch(`/api/pre-checkout/${slug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "complete",
        session_token: session.session_token,
      }),
    });

    const completePayload = await completeResponse.json();
    setSubmitting(false);

    if (!completeResponse.ok) {
      setScreenError(completePayload.error || "Não foi possível concluir o formulário.");
      return;
    }

    firePixel("Lead", { slug });
    firePixel("FlowLuxPreCheckoutComplete", { slug });
    window.localStorage.removeItem(storageKey(slug));

    const action = completePayload.final_config?.action;
    if (action === "checkout_redirect" && completePayload.final_config?.redirect_url) {
      window.location.href = completePayload.final_config.redirect_url;
      return;
    }

    if (action === "whatsapp_redirect") {
      const whatsappUrl = toWhatsappUrl(
        completePayload.final_config?.whatsapp_phone,
        completePayload.final_config?.whatsapp_message,
      );
      if (whatsappUrl) {
        window.location.href = whatsappUrl;
        return;
      }
    }

    setCompletedMessage({
      title: completePayload.final_config?.thank_you_title || "Tudo certo",
      description: completePayload.final_config?.thank_you_description || "Recebemos suas respostas e vamos seguir daqui.",
    });
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#0B0B10]"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>;
  }

  if (!form || !steps.length) {
    return <div className="flex min-h-screen items-center justify-center bg-[#0B0B10] p-6 text-center text-white">{screenError || "Formulário indisponível."}</div>;
  }

  return (
    <div className="min-h-screen px-4 py-8" style={backgroundStyle}>
      {form.integrations.pixel_enabled && form.integrations.pixel_id && (
        <Script id={`pixel-${form.id}`} strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
          (window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${form.integrations.pixel_id}');
          fbq('track', 'PageView');
        `}</Script>
      )}

      <div className={`mx-auto ${layoutClass}`}>
        <div className="overflow-hidden rounded-[32px] border border-white/10 shadow-2xl" style={{ backgroundColor: form.theme.panel_color, color: form.theme.text_color }}>
          {form.theme.top_image_url ? (
            <img src={form.theme.top_image_url} alt="" className="h-44 w-full object-cover" />
          ) : (
            <div className="flex h-24 items-center justify-center border-b border-white/10 bg-black/10">
              <ImageIcon className="h-6 w-6 opacity-60" />
            </div>
          )}

          <div className="space-y-6 p-6 sm:p-8">
            {completedMessage ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold">{completedMessage.title}</h1>
                  <p className="mx-auto max-w-xl text-sm opacity-80">{completedMessage.description}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] opacity-60">
                    <span>{form.name}</span>
                    <span>{currentStepIndex + 1}/{steps.length}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full transition-all" style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%`, backgroundColor: form.theme.primary_color }} />
                  </div>
                  <div>
                    <h1 className="text-3xl font-semibold">{currentStep.title}</h1>
                    {(currentStep.description || form.description) && <p className="mt-2 text-sm opacity-80">{currentStep.description || form.description}</p>}
                  </div>
                </div>

                <div className="space-y-3">
                  {["short_text", "email", "phone"].includes(currentStep.type) && (
                    <Input value={Array.isArray(currentValue) ? "" : currentValue} onChange={(e) => setAnswer(e.target.value)} placeholder={currentStep.placeholder || ""} className="h-12 text-base" />
                  )}
                  {currentStep.type === "long_text" && (
                    <Textarea value={Array.isArray(currentValue) ? "" : currentValue} onChange={(e) => setAnswer(e.target.value)} placeholder={currentStep.placeholder || ""} className="min-h-32 text-base" />
                  )}
                  {currentStep.type === "single_choice" && (
                    <div className="grid gap-3">{currentStep.options.map((option) => <button key={option.id} type="button" onClick={() => setAnswer(option.value)} className={`rounded-2xl border px-4 py-4 text-left transition-colors ${currentValue === option.value ? "border-transparent text-white" : "border-white/10 hover:border-white/30"}`} style={{ backgroundColor: currentValue === option.value ? form.theme.primary_color : "transparent" }}>{option.label}</button>)}</div>
                  )}
                  {currentStep.type === "multiple_choice" && (
                    <div className="grid gap-3">{currentStep.options.map((option) => { const active = Array.isArray(currentValue) && currentValue.includes(option.value); return <button key={option.id} type="button" onClick={() => toggleMultipleChoice(option.value)} className={`rounded-2xl border px-4 py-4 text-left transition-colors ${active ? "border-transparent text-white" : "border-white/10 hover:border-white/30"}`} style={{ backgroundColor: active ? form.theme.primary_color : "transparent" }}>{option.label}</button>; })}</div>
                  )}
                </div>

                {screenError && <p className="text-sm text-rose-300">{screenError}</p>}

                <div className="flex items-center justify-between gap-3">
                  <Button type="button" variant="ghost" disabled={currentStepIndex === 0 || submitting} onClick={() => setCurrentStepIndex((current) => Math.max(0, current - 1))}>Voltar</Button>
                  <Button type="button" onClick={handleContinue} disabled={submitting} style={{ backgroundColor: form.theme.primary_color }}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>{isLastStep ? "Concluir" : "Continuar"}</span><ChevronRight className="ml-2 h-4 w-4" /></>}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
