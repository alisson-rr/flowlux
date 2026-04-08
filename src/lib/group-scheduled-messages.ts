import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { recordOperationalEvent } from "@/lib/operational-events";
import { sendGroupMessage } from "@/lib/whatsapp-groups";

declare global {
  // eslint-disable-next-line no-var
  var __groupScheduledResumeTimers: Map<string, NodeJS.Timeout> | undefined;
}

type GroupScheduledStatus = "pending" | "processing" | "retry_waiting" | "sent" | "failed" | "cancelled";

interface GroupScheduledMessageRecord {
  id: string;
  user_id: string;
  group_id: string;
  instance_id: string;
  remote_jid: string;
  group_subject: string;
  message: string | null;
  scheduled_at: string;
  next_run_at: string | null;
  status: GroupScheduledStatus;
  attempt_count: number;
  max_attempts: number;
  claimed_at: string | null;
  last_attempt_at: string | null;
  sent_at: string | null;
  failure_reason: string | null;
  provider_response: Record<string, unknown> | null;
  media_url: string | null;
  media_type: "image" | "video" | "audio" | "document" | null;
  file_name: string | null;
  deleted_at: string | null;
}

export interface GroupScheduledProcessResult {
  scheduledMessageId: string;
  status: GroupScheduledStatus | "not_found" | "already_processing";
  nextRunAt?: string | null;
  error?: string | null;
}

export async function upsertGroupScheduledMessage(input: {
  userId: string;
  scheduledMessageId?: string | null;
  groupId: string;
  instanceId: string;
  remoteJid: string;
  groupSubject: string;
  message?: string | null;
  scheduledAt: string;
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | "audio" | "document" | null;
  fileName?: string | null;
}) {
  const supabase = getSupabaseAdmin();
  const payload = {
    user_id: input.userId,
    group_id: input.groupId,
    instance_id: input.instanceId,
    remote_jid: input.remoteJid,
    group_subject: input.groupSubject,
    message: input.message || "",
    scheduled_at: input.scheduledAt,
    next_run_at: input.scheduledAt,
    media_url: input.mediaUrl || null,
    media_type: input.mediaType || null,
    file_name: input.fileName || null,
    status: "pending",
    failure_reason: null,
    provider_response: {},
    deleted_at: null,
  };

  const query = input.scheduledMessageId
    ? supabase
        .from("group_scheduled_messages")
        .update({
          ...payload,
          attempt_count: 0,
          claimed_at: null,
          last_attempt_at: null,
          sent_at: null,
          updated_at: nowIso(),
        })
        .eq("id", input.scheduledMessageId)
        .eq("user_id", input.userId)
    : supabase.from("group_scheduled_messages").insert(payload);

  const { data, error } = await query.select("*").single();

  if (error || !data?.id) {
    throw new Error(error?.message || "Nao foi possivel salvar o agendamento do grupo");
  }

  return data as GroupScheduledMessageRecord;
}

export async function cancelGroupScheduledMessage(userId: string, scheduledMessageId: string) {
  const supabase = getSupabaseAdmin();
  clearResume(scheduledMessageId);

  const { error } = await supabase
    .from("group_scheduled_messages")
    .update({
      status: "cancelled",
      deleted_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq("id", scheduledMessageId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message || "Nao foi possivel cancelar o agendamento do grupo");
  }

  return { success: true };
}

function nowIso() {
  return new Date().toISOString();
}

function getRetryDelayMs(attemptCount: number) {
  if (attemptCount <= 1) return 30_000;
  if (attemptCount === 2) return 60_000;
  return 120_000;
}

function isDue(dateLike?: string | null) {
  if (!dateLike) return true;
  const timestamp = new Date(dateLike).getTime();
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function getResumeTimers() {
  if (!globalThis.__groupScheduledResumeTimers) {
    globalThis.__groupScheduledResumeTimers = new Map<string, NodeJS.Timeout>();
  }

  return globalThis.__groupScheduledResumeTimers;
}

function clearResume(scheduledMessageId: string) {
  const timers = getResumeTimers();
  const existing = timers.get(scheduledMessageId);
  if (existing) {
    clearTimeout(existing);
    timers.delete(scheduledMessageId);
  }
}

function scheduleResume(scheduledMessageId: string, dateLike?: string | null) {
  clearResume(scheduledMessageId);

  const targetTime = dateLike ? new Date(dateLike).getTime() : Date.now();
  const delayMs = Math.max(0, (Number.isFinite(targetTime) ? targetTime : Date.now()) - Date.now());
  const timers = getResumeTimers();

  const timeout = setTimeout(() => {
    timers.delete(scheduledMessageId);
    void processQueuedGroupScheduledMessages({ scheduledMessageId, limit: 1 }).catch((error) => {
      console.error("Group scheduled message resume failed:", error);
    });
  }, delayMs);

  timers.set(scheduledMessageId, timeout);
}

export function kickGroupScheduledMessage(scheduledMessageId: string, dateLike?: string | null) {
  scheduleResume(scheduledMessageId, dateLike);
}

async function markCancelled(scheduledMessage: GroupScheduledMessageRecord) {
  const supabase = getSupabaseAdmin();
  clearResume(scheduledMessage.id);

  await supabase
    .from("group_scheduled_messages")
    .update({
      status: "cancelled",
      updated_at: nowIso(),
    })
    .eq("id", scheduledMessage.id);
}

export async function processGroupScheduledMessage(scheduledMessageId: string): Promise<GroupScheduledProcessResult> {
  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase
    .from("group_scheduled_messages")
    .select("*")
    .eq("id", scheduledMessageId)
    .maybeSingle();

  if (error || !row) {
    return {
      scheduledMessageId,
      status: "not_found",
      error: error?.message || "Agendamento nao encontrado",
    };
  }

  const scheduledMessage = row as GroupScheduledMessageRecord;

  if (scheduledMessage.deleted_at || scheduledMessage.status === "cancelled") {
    await markCancelled(scheduledMessage);
    return {
      scheduledMessageId,
      status: "cancelled",
    };
  }

  const dueAt = scheduledMessage.next_run_at || scheduledMessage.scheduled_at;

  if (!isDue(dueAt) && scheduledMessage.status === "pending") {
    scheduleResume(scheduledMessage.id, dueAt);
    return {
      scheduledMessageId,
      status: "pending",
      nextRunAt: dueAt,
    };
  }

  const attemptNumber = (scheduledMessage.attempt_count || 0) + 1;
  const attemptTime = nowIso();

  const { data: claimed } = await supabase
    .from("group_scheduled_messages")
    .update({
      status: "processing",
      attempt_count: attemptNumber,
      claimed_at: attemptTime,
      last_attempt_at: attemptTime,
      failure_reason: null,
      provider_response: {},
    })
    .eq("id", scheduledMessage.id)
    .in("status", ["pending", "retry_waiting"])
    .select("*")
    .maybeSingle();

  if (!claimed) {
    return {
      scheduledMessageId,
      status: "already_processing",
    };
  }

  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("instance_name")
    .eq("id", scheduledMessage.instance_id)
    .maybeSingle();

  const { data: group } = await supabase
    .from("whatsapp_groups")
    .select("subject")
    .eq("id", scheduledMessage.group_id)
    .maybeSingle();

  const attemptInsert = await supabase
    .from("group_scheduled_message_attempts")
    .insert({
      scheduled_message_id: scheduledMessage.id,
      user_id: scheduledMessage.user_id,
      group_id: scheduledMessage.group_id,
      instance_id: scheduledMessage.instance_id,
      attempt_number: attemptNumber,
      target_group_jid: scheduledMessage.remote_jid,
      group_subject: group?.subject || scheduledMessage.group_subject,
      instance_name: instance?.instance_name || null,
      status: "processing",
      attempted_at: attemptTime,
    })
    .select("*")
    .single();

  const attemptId = attemptInsert.data?.id as string | undefined;

  try {
    const result = await sendGroupMessage({
      userId: scheduledMessage.user_id,
      groupId: scheduledMessage.group_id,
      message: scheduledMessage.message || "",
      mediaUrl: scheduledMessage.media_url,
      mediaType: scheduledMessage.media_type,
      fileName: scheduledMessage.file_name,
      sendMode: "scheduled",
      scheduledMessageId: scheduledMessage.id,
    });

    const sentAt = nowIso();

    await Promise.all([
      supabase
        .from("group_scheduled_messages")
        .update({
          status: "sent",
          sent_at: sentAt,
          next_run_at: null,
          provider_response: result.providerResponse || {},
          failure_reason: null,
          updated_at: sentAt,
        })
        .eq("id", scheduledMessage.id),
      attemptId
        ? supabase
            .from("group_scheduled_message_attempts")
            .update({
              status: "sent",
              completed_at: sentAt,
              provider_response: result.providerResponse || {},
              failure_reason: null,
            })
            .eq("id", attemptId)
        : Promise.resolve({}),
    ]);

    clearResume(scheduledMessage.id);

    return {
      scheduledMessageId,
      status: "sent",
    };
  } catch (error: any) {
    const message = String(error?.message || error || "Falha ao enviar agendamento do grupo");

    if (attemptNumber < (scheduledMessage.max_attempts || 3)) {
      const retryAt = new Date(Date.now() + getRetryDelayMs(attemptNumber)).toISOString();

      await Promise.all([
        supabase
          .from("group_scheduled_messages")
          .update({
            status: "retry_waiting",
            next_run_at: retryAt,
            failure_reason: message,
            updated_at: nowIso(),
          })
          .eq("id", scheduledMessage.id),
        attemptId
          ? supabase
              .from("group_scheduled_message_attempts")
              .update({
                status: "failed",
                completed_at: nowIso(),
                failure_reason: message,
              })
              .eq("id", attemptId)
          : Promise.resolve({}),
      ]);

      scheduleResume(scheduledMessage.id, retryAt);

      return {
        scheduledMessageId,
        status: "retry_waiting",
        nextRunAt: retryAt,
        error: message,
      };
    }

      await Promise.all([
        supabase
          .from("group_scheduled_messages")
          .update({
            status: "failed",
            next_run_at: null,
            failure_reason: message,
            updated_at: nowIso(),
          })
        .eq("id", scheduledMessage.id),
      attemptId
        ? supabase
            .from("group_scheduled_message_attempts")
            .update({
              status: "failed",
              completed_at: nowIso(),
              failure_reason: message,
            })
            .eq("id", attemptId)
        : Promise.resolve({}),
    ]);

    clearResume(scheduledMessage.id);

    await recordOperationalEvent({
      userId: scheduledMessage.user_id,
      source: "group_scheduled_messages",
      eventType: "send_failed",
      severity: "error",
      status: "error",
      entityType: "whatsapp_group",
      entityId: scheduledMessage.group_id,
      message,
      metadata: {
        scheduled_message_id: scheduledMessage.id,
        remote_jid: scheduledMessage.remote_jid,
      },
    });

    return {
      scheduledMessageId,
      status: "failed",
      error: message,
    };
  }
}

export async function processQueuedGroupScheduledMessages(options: {
  scheduledMessageId?: string;
  limit?: number;
} = {}) {
  const supabase = getSupabaseAdmin();
  const limit = Math.max(1, Math.min(options.limit || 10, 25));

  let scheduledMessageIds: string[] = [];

  if (options.scheduledMessageId) {
    scheduledMessageIds = [options.scheduledMessageId];
  } else {
    const { data: rows, error } = await supabase
      .from("group_scheduled_messages")
      .select("id, scheduled_at, next_run_at")
      .is("deleted_at", null)
      .in("status", ["pending", "retry_waiting"])
      .limit(limit * 3);

    if (error) {
      throw new Error(error.message || "Nao foi possivel carregar os agendamentos dos grupos");
    }

    scheduledMessageIds = (rows || [])
      .sort((a: any, b: any) => {
        const left = new Date(a.next_run_at || a.scheduled_at).getTime();
        const right = new Date(b.next_run_at || b.scheduled_at).getTime();
        return left - right;
      })
      .filter((row: any) => isDue(row.next_run_at || row.scheduled_at))
      .slice(0, limit)
      .map((row: any) => row.id);
  }

  const results: GroupScheduledProcessResult[] = [];

  for (const scheduledMessageId of scheduledMessageIds) {
    results.push(await processGroupScheduledMessage(scheduledMessageId));
  }

  return {
    processedCount: results.length,
    results,
  };
}
