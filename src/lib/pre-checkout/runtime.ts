import { evolutionApi } from "@/lib/evolution-api";
import { enqueueFlowExecution, kickFlowExecution } from "@/lib/flow-executions";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { phoneToJid } from "@/lib/utils";
import type {
  PreCheckoutConnectConfig,
  PreCheckoutForm,
  PreCheckoutFormStep,
  PreCheckoutIntegrationsConfig,
  PreCheckoutWorkflowAction,
  PreCheckoutWorkflowCondition,
  PreCheckoutWorkflowTrigger,
} from "@/types";

export interface PreCheckoutWorkflowExecutionLog {
  triggerId: string;
  triggerName: string;
  actionId?: string;
  actionType?: string;
  success: boolean;
  error?: string | null;
}

export interface RunPreCheckoutWorkflowsInput {
  form: Pick<PreCheckoutForm, "id" | "user_id" | "integrations" | "final_config">;
  steps: Array<Pick<PreCheckoutFormStep, "id" | "step_key" | "type">>;
  answers: Array<{ step_id: string; answer_text?: string | null; answer_json?: Record<string, unknown> | null }>;
  sessionId: string;
  leadId?: string | null;
  leadName?: string | null;
  leadPhone?: string | null;
  leadEmail?: string | null;
  eventType: "any_full_response" | "abandoned" | "ending_reached";
  endingStepKey?: string | null;
}

function answerToValue(answer: { answer_text?: string | null; answer_json?: Record<string, unknown> | null }) {
  if (typeof answer.answer_json?.accepted === "boolean") return answer.answer_json.accepted ? "aceito" : "";
  if (typeof answer.answer_json?.value === "string") return answer.answer_json.value;
  if (typeof answer.answer_json?.value === "number") return String(answer.answer_json.value);
  if (Array.isArray(answer.answer_json?.values)) return answer.answer_json.values.map(String);
  return String(answer.answer_text || "");
}

function buildAnswerMaps(
  steps: Array<Pick<PreCheckoutFormStep, "id" | "step_key" | "type">>,
  answers: Array<{ step_id: string; answer_text?: string | null; answer_json?: Record<string, unknown> | null }>,
) {
  const byStepId = new Map(answers.map((answer) => [answer.step_id, answerToValue(answer)]));
  const byStepKey = new Map<string, string | string[]>();

  for (const step of steps) {
    if (!byStepId.has(step.id)) continue;
    byStepKey.set(step.step_key, byStepId.get(step.id)!);
  }

  return { byStepId, byStepKey };
}

function valueToComparable(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim().toLowerCase());
  return String(value || "").trim().toLowerCase();
}

function evaluateCondition(condition: PreCheckoutWorkflowCondition, answerMap: Map<string, string | string[]>) {
  const currentValue = valueToComparable(answerMap.get(condition.step_key || ""));
  const expectedValue = valueToComparable(condition.value as string | string[] | undefined);

  if (condition.operator === "is_answered") {
    return Array.isArray(currentValue) ? currentValue.length > 0 : currentValue.length > 0;
  }

  if (condition.operator === "is_not_answered") {
    return Array.isArray(currentValue) ? currentValue.length === 0 : currentValue.length === 0;
  }

  if (Array.isArray(currentValue)) {
    const expected = Array.isArray(expectedValue) ? expectedValue : [expectedValue];
    if (condition.operator === "equals") return expected.every((item) => currentValue.includes(item));
    if (condition.operator === "not_equals") return !expected.every((item) => currentValue.includes(item));
    if (condition.operator === "contains") return expected.some((item) => currentValue.includes(item));
    if (condition.operator === "not_contains") return !expected.some((item) => currentValue.includes(item));
    return false;
  }

  if (condition.operator === "equals") return currentValue === expectedValue;
  if (condition.operator === "not_equals") return currentValue !== expectedValue;
  const comparableExpected = Array.isArray(expectedValue) ? expectedValue.join(" ") : expectedValue;
  if (condition.operator === "contains") return currentValue.includes(comparableExpected);
  if (condition.operator === "not_contains") return !currentValue.includes(comparableExpected);
  return false;
}

function interpolateTemplate(
  template: string | null | undefined,
  input: {
    leadName?: string | null;
    leadPhone?: string | null;
    leadEmail?: string | null;
    answersByStepKey: Map<string, string | string[]>;
  },
) {
  const replacements: Record<string, string> = {
    nome: input.leadName || "",
    telefone: input.leadPhone || "",
    email: input.leadEmail || "",
  };

  let result = String(template || "");
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(`{${key}}`, value);
    result = result.replaceAll(`{{${key}}}`, value);
  }

  for (const [key, value] of Array.from(input.answersByStepKey.entries())) {
    const serialized = Array.isArray(value) ? value.join(", ") : value;
    result = result.replaceAll(`{{${key}}}`, serialized);
  }

  return result;
}

function getConnectConfig(integrations: PreCheckoutIntegrationsConfig | null | undefined): PreCheckoutConnectConfig {
  const connect = integrations?.connect || {};
  return {
    meta_pixel_enabled: Boolean(connect.meta_pixel_enabled ?? integrations?.pixel_enabled),
    meta_pixel_id: connect.meta_pixel_id ?? integrations?.pixel_id ?? "",
    ga4_enabled: Boolean(connect.ga4_enabled),
    ga4_measurement_id: connect.ga4_measurement_id || "",
    gtm_enabled: Boolean(connect.gtm_enabled),
    gtm_container_id: connect.gtm_container_id || "",
  };
}

async function getAvailableInstance(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("whatsapp_instances")
    .select("id, instance_name, status")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at");

  return (data || []).find((item) => item.status === "connected") || (data || [])[0] || null;
}

async function runWorkflowAction(
  action: PreCheckoutWorkflowAction,
  input: RunPreCheckoutWorkflowsInput,
  answerMap: Map<string, string | string[]>,
) {
  const supabase = getSupabaseAdmin();
  const parsedMessage = interpolateTemplate(action.config.message, {
    leadName: input.leadName,
    leadPhone: input.leadPhone,
    leadEmail: input.leadEmail,
    answersByStepKey: answerMap,
  });

  switch (action.type) {
    case "send_whatsapp_respondent": {
      if (!input.leadPhone) throw new Error("Lead sem telefone para envio no WhatsApp.");
      const instance = await getAvailableInstance(input.form.user_id);
      if (!instance?.instance_name) throw new Error("Nenhuma instância conectada disponível.");
      await evolutionApi.sendText(instance.instance_name, input.leadPhone, parsedMessage);
      return {};
    }
    case "send_whatsapp_internal": {
      if (!action.config.phone) throw new Error("Defina o número interno do WhatsApp.");
      const instance = await getAvailableInstance(input.form.user_id);
      if (!instance?.instance_name) throw new Error("Nenhuma instância conectada disponível.");
      await evolutionApi.sendText(instance.instance_name, action.config.phone, parsedMessage);
      return {};
    }
    case "apply_tags": {
      if (!input.leadId || !action.config.tag_ids?.length) return {};
      const rows = action.config.tag_ids.map((tagId) => ({ lead_id: input.leadId, tag_id: tagId }));
      await supabase.from("lead_tags").upsert(rows, { onConflict: "lead_id,tag_id" });
      return {};
    }
    case "move_stage": {
      if (!input.leadId || !action.config.stage_id) return {};
      await supabase.from("leads").update({
        stage_id: action.config.stage_id,
        funnel_id: action.config.funnel_id || null,
      }).eq("id", input.leadId);
      return {};
    }
    case "start_flow": {
      if (!action.config.flow_id || !input.leadPhone) return {};
      const instance = await getAvailableInstance(input.form.user_id);
      if (!instance?.instance_name) throw new Error("Nenhuma instância conectada disponível.");
      const { executionId } = await enqueueFlowExecution({
        flowId: action.config.flow_id,
        userId: input.form.user_id,
        instanceId: instance.id || null,
        instanceName: instance.instance_name,
        remoteJid: phoneToJid(input.leadPhone),
        metadata: {
          enqueue_source: "pre_checkout_workflow",
          pre_checkout_session_id: input.sessionId,
          lead_id: input.leadId || null,
        },
      });
      kickFlowExecution(executionId);
      return {};
    }
    case "redirect_url":
      return { redirectUrl: action.config.url || null };
    case "webhook": {
      if (!action.config.webhook_url) throw new Error("Defina a URL do webhook.");
      const headers = Object.fromEntries((action.config.webhook_headers || []).filter((item) => item.key).map((item) => [item.key, item.value]));
      await fetch(action.config.webhook_url, {
        method: action.config.webhook_method || "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          form_id: input.form.id,
          session_id: input.sessionId,
          lead_id: input.leadId || null,
          lead_name: input.leadName || null,
          lead_phone: input.leadPhone || null,
          lead_email: input.leadEmail || null,
          event_type: input.eventType,
          ending_step_key: input.endingStepKey || null,
          answers: Object.fromEntries(answerMap.entries()),
        }),
      });
      return {};
    }
    default:
      return {};
  }
}

export async function runPreCheckoutWorkflows(input: RunPreCheckoutWorkflowsInput) {
  const workflows = input.form.integrations?.workflows || [];
  const answerMaps = buildAnswerMaps(input.steps, input.answers);
  const logs: PreCheckoutWorkflowExecutionLog[] = [];
  let redirectUrl: string | null = null;

  for (const trigger of workflows) {
    if (!trigger.enabled) continue;
    if (
      (input.eventType === "any_full_response" && !["any_full_response", "full_response_with_conditions"].includes(trigger.type)) ||
      (input.eventType === "abandoned" && trigger.type !== "abandoned") ||
      (input.eventType === "ending_reached" && trigger.type !== "ending_reached")
    ) {
      continue;
    }

    if (trigger.type === "ending_reached" && trigger.ending_step_key && trigger.ending_step_key !== input.endingStepKey) {
      continue;
    }

    if (trigger.type === "full_response_with_conditions") {
      const matches = trigger.conditions.length > 0 && trigger.conditions.every((condition) => evaluateCondition(condition, answerMaps.byStepKey));
      if (!matches) continue;
    }

    logs.push({ triggerId: trigger.id, triggerName: trigger.name, success: true });

    for (const action of trigger.actions) {
      if (!action.enabled) continue;
      try {
        const result = await runWorkflowAction(action, input, answerMaps.byStepKey);
        if (!redirectUrl && result.redirectUrl) redirectUrl = result.redirectUrl;
        logs.push({
          triggerId: trigger.id,
          triggerName: trigger.name,
          actionId: action.id,
          actionType: action.type,
          success: true,
        });
      } catch (error: any) {
        logs.push({
          triggerId: trigger.id,
          triggerName: trigger.name,
          actionId: action.id,
          actionType: action.type,
          success: false,
          error: String(error?.message || error || "Falha desconhecida"),
        });
      }
    }
  }

  return { logs, redirectUrl };
}

export { getConnectConfig };
