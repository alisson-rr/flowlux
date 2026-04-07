import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { recordOperationalEvent } from "@/lib/operational-events";

const EVOLUTION_API_URL = process.env.NEXT_PUBLIC_EVOLUTION_API_URL || "";
const EVOLUTION_API_KEY = process.env.NEXT_PUBLIC_EVOLUTION_API_KEY || "";

declare global {
  // eslint-disable-next-line no-var
  var __flowExecutionResumeTimers: Map<string, NodeJS.Timeout> | undefined;
}

type FlowExecutionStatus = "pending" | "queued" | "running" | "processing" | "retry_waiting" | "completed" | "failed" | "cancelled";
type FlowExecutionStepStatus = "queued" | "waiting_delay" | "processing" | "retry_waiting" | "completed" | "failed" | "cancelled" | "skipped";

type FlowStepType = "text" | "image" | "video" | "audio" | "document" | "delay";

interface FlowStepRecord {
  id: string;
  flow_id: string;
  step_order: number;
  step_type: FlowStepType;
  content: string | null;
  media_url: string | null;
  file_name: string | null;
  delay_seconds: number | null;
}

interface FlowExecutionRecord {
  id: string;
  flow_id: string;
  user_id: string;
  instance_id: string | null;
  instance_name: string | null;
  remote_jid: string;
  conversation_id: string | null;
  status: FlowExecutionStatus;
  current_step: number | null;
  total_steps: number | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  next_run_at: string | null;
  claimed_at: string | null;
  heartbeat_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  attempt_count: number | null;
  max_attempts: number | null;
  metadata: Record<string, any> | null;
  provider_response: Record<string, any> | null;
}

interface FlowExecutionStepRecord {
  id: string;
  execution_id: string;
  flow_id: string;
  flow_step_id: string | null;
  step_order: number;
  step_type: FlowStepType;
  content: string | null;
  media_url: string | null;
  file_name: string | null;
  delay_seconds: number | null;
  status: FlowExecutionStepStatus;
  attempt_count: number | null;
  max_attempts: number | null;
  scheduled_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  provider_response: Record<string, any> | null;
}

export interface EnqueueFlowExecutionInput {
  flowId: string;
  userId: string;
  instanceId?: string | null;
  instanceName: string;
  remoteJid: string;
  conversationId?: string | null;
  metadata?: Record<string, any>;
}

export interface FlowExecutionProcessResult {
  executionId: string;
  status: FlowExecutionStatus | "waiting_delay" | "already_processing" | "not_found";
  processedSteps: number;
  nextRunAt?: string | null;
  error?: string | null;
}

function nowIso() {
  return new Date().toISOString();
}

function getResumeTimers() {
  if (!globalThis.__flowExecutionResumeTimers) {
    globalThis.__flowExecutionResumeTimers = new Map<string, NodeJS.Timeout>();
  }

  return globalThis.__flowExecutionResumeTimers;
}

function clearExecutionResume(executionId: string) {
  const timers = getResumeTimers();
  const existing = timers.get(executionId);
  if (existing) {
    clearTimeout(existing);
    timers.delete(executionId);
  }
}

function scheduleExecutionResume(executionId: string, dateLike?: string | null) {
  clearExecutionResume(executionId);

  const targetTime = dateLike ? new Date(dateLike).getTime() : Date.now();
  const delayMs = Math.max(0, (Number.isFinite(targetTime) ? targetTime : Date.now()) - Date.now());
  const timers = getResumeTimers();

  const timeout = setTimeout(() => {
    timers.delete(executionId);
    void processQueuedFlowExecutions({ executionId, limit: 1 }).catch((error) => {
      console.error("Flow execution resume failed:", error);
    });
  }, delayMs);

  timers.set(executionId, timeout);
}

export function kickFlowExecution(executionId: string, dateLike?: string | null) {
  scheduleExecutionResume(executionId, dateLike);
}

function getRemotePhone(remoteJid: string) {
  return remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
}

function getConversationPreviewForStep(step: Pick<FlowExecutionStepRecord, "step_type" | "content" | "file_name">) {
  if (step.step_type === "text") return step.content || "[Texto]";
  if (step.step_type === "audio") return "[Áudio]";
  if (step.step_type === "image") return "[Imagem]";
  if (step.step_type === "video") return "[Vídeo]";
  if (step.step_type === "document") return step.file_name || "[Documento]";
  return "[Fluxo]";
}

function getMessageContentForStep(step: Pick<FlowExecutionStepRecord, "step_type" | "content">) {
  return step.step_type === "text" ? (step.content || "") : (step.content || "");
}

function getMessageTypeForStep(stepType: FlowStepType): "text" | "image" | "video" | "audio" | "document" {
  if (stepType === "image" || stepType === "video" || stepType === "audio" || stepType === "document") return stepType;
  return "text";
}

function getRetryDelayMs(attemptCount: number) {
  if (attemptCount <= 1) return 30_000;
  if (attemptCount === 2) return 60_000;
  return 120_000;
}

async function recordFlowExecutionFailure(params: {
  execution: FlowExecutionRecord;
  eventType: string;
  message: string;
  step?: Partial<FlowExecutionStepRecord> | null;
  metadata?: Record<string, unknown>;
}) {
  const { execution, eventType, message, step, metadata } = params;

  await recordOperationalEvent({
    userId: execution.user_id,
    source: "flow_execution_async",
    eventType,
    severity: "error",
    status: "error",
    entityType: "flow_execution",
    entityId: execution.id,
    message,
    metadata: {
      flow_id: execution.flow_id,
      instance_id: execution.instance_id,
      remote_jid: execution.remote_jid,
      conversation_id: execution.conversation_id,
      current_step: execution.current_step,
      step_id: step?.id || null,
      step_order: step?.step_order ?? null,
      step_type: step?.step_type ?? null,
      attempt_count: step?.attempt_count ?? null,
      max_attempts: step?.max_attempts ?? null,
      ...(metadata || {}),
    },
  });
}

function isDue(dateLike?: string | null) {
  if (!dateLike) return true;
  const timestamp = new Date(dateLike).getTime();
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

async function evolutionFetch(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(`${EVOLUTION_API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: EVOLUTION_API_KEY,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Evolution API error: ${res.status} - ${error}`);
  }

  return res.json().catch(() => ({}));
}

async function sendText(instanceName: string, number: string, text: string) {
  return evolutionFetch(`/message/sendText/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({ number, text }),
  });
}

async function urlToBase64Server(url: string): Promise<{ base64: string; detectedMime: string }> {
  const res = await fetch(url);
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { base64: buffer.toString("base64"), detectedMime: contentType };
}

async function sendMedia(instanceName: string, number: string, mediaUrl: string, mediaType: FlowStepType, caption?: string, fileName?: string) {
  const mediaKind = mediaType === "image" ? "image" : mediaType === "video" ? "video" : "document";
  const ext = (mediaUrl.split("?")[0].split(".").pop() || "").toLowerCase();
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    mp4: "video/mp4",
    avi: "video/avi",
    mov: "video/quicktime",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  const fallbackMime = mediaKind === "image" ? "image/jpeg" : mediaKind === "video" ? "video/mp4" : "application/octet-stream";

  let mediaData = mediaUrl;
  let mimetype = mimeMap[ext] || fallbackMime;

  try {
    const { base64, detectedMime } = await urlToBase64Server(mediaUrl);
    mediaData = base64;
    if (detectedMime && detectedMime !== "application/octet-stream") mimetype = detectedMime;
  } catch (error) {
    console.warn("Failed to convert media to base64, sending URL instead", error);
  }

  return evolutionFetch(`/message/sendMedia/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({
      number,
      mediatype: mediaKind,
      mimetype,
      media: mediaData,
      caption: caption || "",
      fileName: fileName || (ext ? `file.${ext}` : ""),
    }),
  });
}

async function sendAudio(instanceName: string, number: string, audioUrl: string) {
  return evolutionFetch(`/message/sendWhatsAppAudio/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({ number, audio: audioUrl }),
  });
}

async function ensureConversationForExecution(execution: FlowExecutionRecord) {
  const supabase = getSupabaseAdmin();

  if (execution.conversation_id) {
    return execution.conversation_id;
  }

  const remotePhone = getRemotePhone(execution.remote_jid);

  const { data: existingConversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", execution.user_id)
    .eq("remote_jid", execution.remote_jid)
    .maybeSingle();

  if (existingConversation?.id) {
    await supabase
      .from("flow_executions")
      .update({ conversation_id: existingConversation.id })
      .eq("id", execution.id);

    return existingConversation.id;
  }

  const { data: createdConversation, error: conversationError } = await supabase
    .from("conversations")
    .insert({
      user_id: execution.user_id,
      instance_id: execution.instance_id,
      remote_jid: execution.remote_jid,
      contact_phone: remotePhone,
      unread_count: 0,
    })
    .select("id")
    .single();

  if (conversationError || !createdConversation?.id) {
    throw new Error(conversationError?.message || "Unable to create conversation for flow execution");
  }

  await supabase
    .from("flow_executions")
    .update({ conversation_id: createdConversation.id })
    .eq("id", execution.id);

  return createdConversation.id;
}

async function claimExecution(execution: FlowExecutionRecord) {
  const supabase = getSupabaseAdmin();
  const claimedAt = nowIso();

  if (execution.status === "processing") {
    return execution;
  }

  const { data: claimedExecution } = await supabase
    .from("flow_executions")
    .update({
      status: "processing",
      claimed_at: claimedAt,
      heartbeat_at: claimedAt,
      started_at: execution.started_at || claimedAt,
      error_message: null,
    })
    .eq("id", execution.id)
    .in("status", ["pending", "queued", "running", "retry_waiting"])
    .select("*")
    .maybeSingle();

  return (claimedExecution as FlowExecutionRecord | null) || null;
}

async function markExecutionCancelled(executionId: string, reason?: string | null) {
  const supabase = getSupabaseAdmin();
  const cancelledAt = nowIso();

  await supabase
    .from("flow_executions")
    .update({
      status: "cancelled",
      cancelled_at: cancelledAt,
      cancel_reason: reason || null,
      completed_at: cancelledAt,
      heartbeat_at: cancelledAt,
    })
    .eq("id", executionId);

  await supabase
    .from("flow_execution_steps")
    .update({
      status: "cancelled",
      completed_at: cancelledAt,
      error_message: reason || null,
    })
    .eq("execution_id", executionId)
    .in("status", ["queued", "waiting_delay", "processing", "retry_waiting"]);
}

async function sendStep(execution: FlowExecutionRecord, step: FlowExecutionStepRecord) {
  const instanceName = execution.instance_name || execution.metadata?.instance_name;
  if (!instanceName) {
    throw new Error("Flow execution is missing instance_name");
  }

  const number = getRemotePhone(execution.remote_jid);

  if (step.step_type === "text") {
    return sendText(instanceName, number, step.content || "");
  }

  if (step.step_type === "audio") {
    if (!step.media_url) throw new Error("Audio step is missing media_url");
    return sendAudio(instanceName, number, step.media_url);
  }

  if (step.step_type === "image" || step.step_type === "video" || step.step_type === "document") {
    if (!step.media_url) throw new Error(`${step.step_type} step is missing media_url`);
    return sendMedia(instanceName, number, step.media_url, step.step_type, step.content || "", step.file_name || "");
  }

  throw new Error(`Unsupported flow step type: ${step.step_type}`);
}

export async function enqueueFlowExecution(input: EnqueueFlowExecutionInput) {
  const supabase = getSupabaseAdmin();

  const { data: flow, error: flowError } = await supabase
    .from("flows")
    .select("id, user_id, is_active")
    .eq("id", input.flowId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (flowError || !flow?.id) {
    throw new Error(flowError?.message || "Flow not found");
  }

  if (!flow.is_active) {
    throw new Error("Flow is inactive");
  }

  const { data: steps, error: stepsError } = await supabase
    .from("flow_steps")
    .select("*")
    .eq("flow_id", input.flowId)
    .order("step_order", { ascending: true });

  if (stepsError || !steps?.length) {
    throw new Error(stepsError?.message || "Flow steps not found");
  }

  const queuedAt = nowIso();

  const { data: execution, error: executionError } = await supabase
    .from("flow_executions")
    .insert({
      flow_id: input.flowId,
      user_id: input.userId,
      instance_id: input.instanceId || null,
      instance_name: input.instanceName,
      remote_jid: input.remoteJid,
      conversation_id: input.conversationId || null,
      status: "queued",
      current_step: 0,
      total_steps: steps.length,
      started_at: null,
      next_run_at: queuedAt,
      metadata: {
        ...(input.metadata || {}),
        instance_name: input.instanceName,
        enqueue_source: input.metadata?.enqueue_source || "manual",
      },
    })
    .select("*")
    .single();

  if (executionError || !execution?.id) {
    throw new Error(executionError?.message || "Unable to create flow execution");
  }

  const executionSteps = (steps as FlowStepRecord[]).map((step) => ({
    execution_id: execution.id,
    flow_id: input.flowId,
    flow_step_id: step.id,
    step_order: step.step_order,
    step_type: step.step_type,
    content: step.content || "",
    media_url: step.media_url || null,
    file_name: step.file_name || null,
    delay_seconds: step.delay_seconds || 0,
    status: "queued",
    attempt_count: 0,
    max_attempts: 3,
  }));

  const { error: stepInsertError } = await supabase
    .from("flow_execution_steps")
    .insert(executionSteps);

  if (stepInsertError) {
    await supabase.from("flow_executions").delete().eq("id", execution.id);
    throw new Error(stepInsertError.message || "Unable to create flow execution steps");
  }

  return {
    executionId: execution.id,
    totalSteps: steps.length,
  };
}

export async function processFlowExecution(executionId: string): Promise<FlowExecutionProcessResult> {
  const supabase = getSupabaseAdmin();
  let processedSteps = 0;

  const { data: executionData, error: executionError } = await supabase
    .from("flow_executions")
    .select("*")
    .eq("id", executionId)
    .maybeSingle();

  if (executionError || !executionData) {
    return {
      executionId,
      status: "not_found",
      processedSteps,
      error: executionError?.message || "Execution not found",
    };
  }

  let execution = executionData as FlowExecutionRecord;

  if (execution.status === "cancelled") {
    clearExecutionResume(execution.id);
    await markExecutionCancelled(execution.id, execution.cancel_reason);
    return { executionId: execution.id, status: "cancelled", processedSteps };
  }

  if ((execution.status === "queued" || execution.status === "retry_waiting" || execution.status === "pending" || execution.status === "running") && !isDue(execution.next_run_at)) {
    scheduleExecutionResume(execution.id, execution.next_run_at);
    return {
      executionId: execution.id,
      status: execution.status,
      processedSteps,
      nextRunAt: execution.next_run_at,
    };
  }

  const claimedExecution = await claimExecution(execution);
  if (!claimedExecution) {
    return {
      executionId: execution.id,
      status: "already_processing",
      processedSteps,
    };
  }
  execution = claimedExecution;

  while (true) {
    const { data: stepsData, error: stepsError } = await supabase
      .from("flow_execution_steps")
      .select("*")
      .eq("execution_id", execution.id)
      .order("step_order", { ascending: true });

    if (stepsError || !stepsData) {
      const failureMessage = stepsError?.message || "Unable to load flow execution steps";

      await supabase
        .from("flow_executions")
        .update({
          status: "failed",
          completed_at: nowIso(),
          heartbeat_at: nowIso(),
          error_message: failureMessage,
        })
        .eq("id", execution.id);

      await recordFlowExecutionFailure({
        execution,
        eventType: "steps_load_failed",
        message: failureMessage,
      });

      return {
        executionId: execution.id,
        status: "failed",
        processedSteps,
        error: failureMessage,
      };
    }

    const steps = stepsData as FlowExecutionStepRecord[];
    const currentStep = steps.find((step) => !["completed", "cancelled", "skipped"].includes(step.status));

    if (!currentStep) {
      const completedAt = nowIso();
      clearExecutionResume(execution.id);
      await supabase
        .from("flow_executions")
        .update({
          status: "completed",
          completed_at: completedAt,
          heartbeat_at: completedAt,
          next_run_at: null,
          error_message: null,
        })
        .eq("id", execution.id);

      return {
        executionId: execution.id,
        status: "completed",
        processedSteps,
      };
    }

    const { data: freshExecution } = await supabase
      .from("flow_executions")
      .select("status, cancel_reason")
      .eq("id", execution.id)
      .maybeSingle();

    if (freshExecution?.status === "cancelled") {
      clearExecutionResume(execution.id);
      await markExecutionCancelled(execution.id, freshExecution.cancel_reason || execution.cancel_reason);
      return {
        executionId: execution.id,
        status: "cancelled",
        processedSteps,
      };
    }

    if ((currentStep.status === "waiting_delay" || currentStep.status === "retry_waiting") && !isDue(currentStep.scheduled_for)) {
      const nextStatus = currentStep.status === "retry_waiting" ? "retry_waiting" : "queued";
      scheduleExecutionResume(execution.id, currentStep.scheduled_for);
      await supabase
        .from("flow_executions")
        .update({
          status: nextStatus,
          next_run_at: currentStep.scheduled_for,
          heartbeat_at: nowIso(),
          current_step: currentStep.step_order,
        })
        .eq("id", execution.id);

      return {
        executionId: execution.id,
        status: nextStatus,
        processedSteps,
        nextRunAt: currentStep.scheduled_for,
      };
    }

    if (currentStep.step_type === "delay") {
      if (currentStep.status === "waiting_delay" || currentStep.status === "retry_waiting") {
        const completedAt = nowIso();
        await supabase
          .from("flow_execution_steps")
          .update({
            status: "completed",
            completed_at: completedAt,
            provider_response: {
              ...(currentStep.provider_response || {}),
              delay_seconds: currentStep.delay_seconds || 0,
              resumed_at: completedAt,
            },
            error_message: null,
          })
          .eq("id", currentStep.id);

        await supabase
          .from("flow_executions")
          .update({
            current_step: currentStep.step_order + 1,
            next_run_at: null,
            heartbeat_at: completedAt,
          })
          .eq("id", execution.id);

        processedSteps += 1;
        continue;
      }

      const dueAt = new Date(Date.now() + (currentStep.delay_seconds || 0) * 1000).toISOString();

      await supabase
        .from("flow_execution_steps")
        .update({
          status: "waiting_delay",
          scheduled_for: dueAt,
          started_at: currentStep.started_at || nowIso(),
          provider_response: {
            ...(currentStep.provider_response || {}),
            delay_seconds: currentStep.delay_seconds || 0,
          },
          error_message: null,
        })
        .eq("id", currentStep.id);

      await supabase
        .from("flow_executions")
        .update({
          status: "queued",
          next_run_at: dueAt,
          current_step: currentStep.step_order,
          heartbeat_at: nowIso(),
        })
        .eq("id", execution.id);

      scheduleExecutionResume(execution.id, dueAt);

      return {
        executionId: execution.id,
        status: "queued",
        processedSteps,
        nextRunAt: dueAt,
      };
    }

    const currentAttemptCount = (currentStep.attempt_count || 0) + 1;
    const stepMaxAttempts = currentStep.max_attempts || execution.max_attempts || 3;
    const startedAt = nowIso();

    await supabase
      .from("flow_execution_steps")
      .update({
        status: "processing",
        attempt_count: currentAttemptCount,
        started_at: currentStep.started_at || startedAt,
        error_message: null,
      })
      .eq("id", currentStep.id);

    try {
      const conversationId = await ensureConversationForExecution(execution);
      const providerResponse = await sendStep(execution, currentStep);
      const sentAt = nowIso();
      const preview = getConversationPreviewForStep(currentStep);
      const messageType = getMessageTypeForStep(currentStep.step_type);

      await Promise.all([
        supabase.from("messages").insert({
          conversation_id: conversationId,
          remote_jid: execution.remote_jid,
          from_me: true,
          message_type: messageType,
          content: getMessageContentForStep(currentStep),
          media_url: currentStep.media_url || null,
          status: "sent",
          provider_payload: providerResponse || {},
          provider_timestamp: sentAt,
          created_at: sentAt,
        }),
        supabase.from("conversations").update({
          last_message: preview,
          last_message_at: sentAt,
        }).eq("id", conversationId),
        supabase.from("flow_execution_steps").update({
          status: "completed",
          completed_at: sentAt,
          provider_response: providerResponse || {},
          error_message: null,
        }).eq("id", currentStep.id),
        supabase.from("flow_executions").update({
          conversation_id: conversationId,
          current_step: currentStep.step_order + 1,
          next_run_at: null,
          heartbeat_at: sentAt,
          provider_response: providerResponse || {},
          error_message: null,
        }).eq("id", execution.id),
      ]);

      processedSteps += 1;
    } catch (error: any) {
      const errorMessage = String(error?.message || error || "Unknown flow execution error");
      const failedAt = nowIso();

      if (currentAttemptCount < stepMaxAttempts) {
        const retryAt = new Date(Date.now() + getRetryDelayMs(currentAttemptCount)).toISOString();

        await Promise.all([
          supabase.from("flow_execution_steps").update({
            status: "retry_waiting",
            scheduled_for: retryAt,
            error_message: errorMessage,
            provider_response: { error: errorMessage },
            attempt_count: currentAttemptCount,
          }).eq("id", currentStep.id),
          supabase.from("flow_executions").update({
            status: "retry_waiting",
            next_run_at: retryAt,
            heartbeat_at: failedAt,
            error_message: errorMessage,
            attempt_count: (execution.attempt_count || 0) + 1,
          }).eq("id", execution.id),
        ]);

        scheduleExecutionResume(execution.id, retryAt);

        return {
          executionId: execution.id,
          status: "retry_waiting",
          processedSteps,
          nextRunAt: retryAt,
          error: errorMessage,
        };
      }

      clearExecutionResume(execution.id);
      await Promise.all([
        supabase.from("flow_execution_steps").update({
          status: "failed",
          completed_at: failedAt,
          error_message: errorMessage,
          provider_response: { error: errorMessage },
          attempt_count: currentAttemptCount,
        }).eq("id", currentStep.id),
        supabase.from("flow_executions").update({
          status: "failed",
          completed_at: failedAt,
          heartbeat_at: failedAt,
          error_message: errorMessage,
          attempt_count: (execution.attempt_count || 0) + 1,
        }).eq("id", execution.id),
      ]);

      await recordFlowExecutionFailure({
        execution,
        eventType: "execution_failed",
        message: errorMessage,
        step: {
          id: currentStep.id,
          step_order: currentStep.step_order,
          step_type: currentStep.step_type,
          attempt_count: currentAttemptCount,
          max_attempts: stepMaxAttempts,
        },
      });

      return {
        executionId: execution.id,
        status: "failed",
        processedSteps,
        error: errorMessage,
      };
    }
  }
}

export async function processQueuedFlowExecutions(options: { executionId?: string; limit?: number } = {}) {
  const supabase = getSupabaseAdmin();
  const limit = Math.max(1, Math.min(options.limit || 5, 20));

  let executionIds: string[] = [];

  if (options.executionId) {
    executionIds = [options.executionId];
  } else {
    const { data: executionRows, error } = await supabase
      .from("flow_executions")
      .select("id, next_run_at")
      .in("status", ["pending", "queued", "retry_waiting"])
      .order("next_run_at", { ascending: true, nullsFirst: true })
      .limit(limit * 3);

    if (error) {
      throw new Error(error.message || "Unable to load queued flow executions");
    }

    executionIds = (executionRows || [])
      .filter((row: any) => isDue(row.next_run_at))
      .slice(0, limit)
      .map((row: any) => row.id);
  }

  const results: FlowExecutionProcessResult[] = [];

  for (const executionId of executionIds) {
    results.push(await processFlowExecution(executionId));
  }

  return {
    processedCount: results.length,
    results,
  };
}

export async function cancelFlowExecution(executionId: string, reason?: string | null) {
  await markExecutionCancelled(executionId, reason);
}
