import type {
  PreCheckoutFinalAction,
  PreCheckoutForm,
  PreCheckoutFormStep,
  PreCheckoutSession,
} from "@/types";
import { getConnectConfig } from "@/lib/pre-checkout/runtime";

export interface PreCheckoutPublishValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface SessionResumeDecision {
  action: "resume" | "create_new";
  reason: "active_session" | "completed_session" | "expired_session" | "missing_session" | "status_not_resumable";
}

const PUBLISHABLE_STATUSES = new Set<PreCheckoutForm["status"]>(["draft", "paused", "published"]);
const RESUMABLE_SESSION_STATUSES = new Set<PreCheckoutSession["status"]>(["started", "in_progress"]);
const URL_PROTOCOLS = new Set(["http:", "https:", "whatsapp:"]);

export function slugifyPreCheckoutFormName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function isValidAbsoluteUrl(value?: string | null): boolean {
  if (!value) return false;

  try {
    const url = new URL(value);
    return URL_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

function validateFinalAction(finalAction: PreCheckoutFinalAction, form: PreCheckoutForm): string[] {
  const errors: string[] = [];

  if (finalAction === "checkout_redirect" && !isValidAbsoluteUrl(form.final_config.redirect_url)) {
    errors.push("Defina uma URL válida para o redirecionamento final.");
  }

  if (finalAction === "whatsapp_redirect") {
    if (!form.final_config.whatsapp_phone?.trim()) {
      errors.push("Defina o número de WhatsApp para o redirecionamento.");
    }

    if (!form.final_config.whatsapp_message?.trim()) {
      errors.push("Defina a mensagem inicial do redirecionamento para o WhatsApp.");
    }
  }

  if (finalAction === "thank_you") {
    if (!form.final_config.thank_you_title?.trim()) {
      errors.push("Defina o título da tela de conclusão.");
    }

    if (!form.final_config.thank_you_description?.trim()) {
      errors.push("Defina a descrição da tela de conclusão.");
    }
  }

  return errors;
}

function validateConnectConfig(form: PreCheckoutForm): string[] {
  const errors: string[] = [];
  const connect = getConnectConfig(form.integrations);

  if (connect.meta_pixel_enabled && !String(connect.meta_pixel_id || "").trim()) {
    errors.push("Defina o ID do Meta Pixel ou desative essa integração.");
  }

  if (connect.ga4_enabled && !String(connect.ga4_measurement_id || "").trim()) {
    errors.push("Defina o Measurement ID do Google Analytics 4.");
  }

  if (connect.gtm_enabled && !String(connect.gtm_container_id || "").trim()) {
    errors.push("Defina o Container ID do Google Tag Manager.");
  }

  return errors;
}

export function validatePreCheckoutPublish(
  form: Pick<PreCheckoutForm, "name" | "slug" | "status" | "final_config">,
  steps: Array<Pick<PreCheckoutFormStep, "step_key" | "position" | "type" | "title" | "is_required" | "options">>
): PreCheckoutPublishValidationResult {
  const errors: string[] = [];

  if (!form.name.trim()) {
    errors.push("O formulário precisa ter um nome.");
  }

  if (!form.slug.trim()) {
    errors.push("O formulário precisa ter um slug.");
  }

  if (!PUBLISHABLE_STATUSES.has(form.status)) {
    errors.push("O status atual não permite publicação.");
  }

  if (!steps.length) {
    errors.push("O formulário precisa ter pelo menos uma pergunta.");
  }

  const sortedPositions = [...steps].sort((a, b) => a.position - b.position);
  const positionsAreSequential = sortedPositions.every((step, index) => step.position === index);
  if (!positionsAreSequential) {
    errors.push("As perguntas precisam estar ordenadas sem lacunas.");
  }

  const duplicatedStepKey = steps.find((step, index) => steps.findIndex((item) => item.step_key === step.step_key) !== index);
  if (duplicatedStepKey) {
    errors.push(`A chave da pergunta "${duplicatedStepKey.step_key}" está duplicada.`);
  }

  steps.forEach((step) => {
    if (!step.title.trim()) {
      errors.push(`A pergunta ${step.position + 1} precisa ter um título.`);
    }

    if ((step.type === "single_choice" || step.type === "picture_choice" || step.type === "multiple_choice" || step.type === "dropdown" || step.type === "yes_no") && !step.options.length) {
      errors.push(`A pergunta "${step.title}" precisa ter opções configuradas.`);
    }

    if (step.type === "picture_choice" && step.options.some((option) => !String(option.image_url || "").trim())) {
      errors.push(`A pergunta "${step.title}" precisa ter imagem em todas as opções.`);
    }
  });

  errors.push(...validateFinalAction(form.final_config.action, form as PreCheckoutForm));
  errors.push(...validateConnectConfig(form as PreCheckoutForm));

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function decidePreCheckoutSessionResume(
  session: Pick<PreCheckoutSession, "status" | "expires_at"> | null,
  now = new Date()
): SessionResumeDecision {
  if (!session) {
    return { action: "create_new", reason: "missing_session" };
  }

  if (!RESUMABLE_SESSION_STATUSES.has(session.status)) {
    return {
      action: "create_new",
      reason: session.status === "completed" ? "completed_session" : "status_not_resumable",
    };
  }

  if (session.expires_at && new Date(session.expires_at).getTime() <= now.getTime()) {
    return { action: "create_new", reason: "expired_session" };
  }

  return { action: "resume", reason: "active_session" };
}

export function buildPreCheckoutSessionExpiry(
  startedAt: string | Date,
  resumeWindowMinutes: number
): string {
  const baseDate = new Date(startedAt);
  baseDate.setMinutes(baseDate.getMinutes() + resumeWindowMinutes);
  return baseDate.toISOString();
}
