import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { recordOperationalEvent } from "@/lib/operational-events";
import { phoneToWhatsappDigits } from "@/lib/phone";

const EVOLUTION_API_URL = process.env.NEXT_PUBLIC_EVOLUTION_API_URL || "";
const EVOLUTION_API_KEY = process.env.NEXT_PUBLIC_EVOLUTION_API_KEY || "";

type GroupMessageType = "text" | "image" | "video" | "audio" | "document";
type GroupParticipantAction = "add" | "remove" | "promote" | "demote";
type GroupSettingAction = "announcement" | "not_announcement" | "locked" | "unlocked";

export interface WhatsAppGroupParticipant {
  id: string;
  admin: "superadmin" | "admin" | null;
}

export interface SyncWhatsAppGroupsInput {
  userId: string;
  instanceId?: string | null;
}

function nowIso() {
  return new Date().toISOString();
}

function buildGroupEndpoint(path: string, query?: Record<string, string | null | undefined>) {
  const search = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  return `${path}${search.size ? `?${search.toString()}` : ""}`;
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

async function urlToBase64(url: string): Promise<{ base64: string; detectedMime: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch media: ${res.status}`);

  const detectedMime = res.headers.get("content-type") || "application/octet-stream";
  const buffer = Buffer.from(await res.arrayBuffer());

  return {
    base64: buffer.toString("base64"),
    detectedMime,
  };
}

export function isGroupJid(value?: string | null) {
  return typeof value === "string" && value.endsWith("@g.us");
}

export function resolveWhatsAppTarget(remoteJid: string) {
  return isGroupJid(remoteJid) ? remoteJid : phoneToWhatsappDigits(remoteJid.replace(/@.+$/, ""));
}

function normalizeGroupMediaType(value?: string | null): GroupMessageType {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "image" || normalized.startsWith("image/")) return "image";
  if (normalized === "video" || normalized.startsWith("video/")) return "video";
  if (normalized === "audio" || normalized.startsWith("audio/")) return "audio";
  if (normalized === "document") return "document";
  if (normalized.includes("pdf") || normalized.includes("doc") || normalized.includes("sheet") || normalized.includes("text/")) {
    return "document";
  }

  return "text";
}

function getGroupRemoteJid(group: any) {
  return String(group?.id || group?.jid || group?.groupJid || group?.remoteJid || "");
}

function getGroupSubject(group: any) {
  return String(group?.subject || group?.name || group?.groupName || "Grupo sem nome");
}

function getGroupDescription(group: any) {
  if (typeof group?.desc === "string") return group.desc;
  if (typeof group?.description === "string") return group.description;
  return null;
}

function getGroupParticipants(group: any) {
  if (Array.isArray(group?.participants)) return group.participants;
  if (Array.isArray(group?.participant)) return group.participant;
  return [];
}

function getGroupParticipantsCount(group: any) {
  const participants = getGroupParticipants(group);
  return Number(group?.size || group?.participantsCount || participants.length || 0);
}

function getGroupCreationTimestamp(group: any) {
  return Number(group?.creation || group?.createdAt || group?.creationTimestamp || 0);
}

function normalizeGroupRow(params: {
  userId: string;
  instanceId: string;
  group: any;
  source?: "sync" | "manual";
}) {
  const { userId, instanceId, group, source = "sync" } = params;
  const participants = getGroupParticipants(group);
  const creation = getGroupCreationTimestamp(group);

  return {
    user_id: userId,
    instance_id: instanceId,
    remote_jid: getGroupRemoteJid(group),
    subject: getGroupSubject(group),
    description: getGroupDescription(group),
    picture_url:
      typeof group?.pictureUrl === "string"
        ? group.pictureUrl
        : typeof group?.picture === "string"
          ? group.picture
          : null,
    owner_jid: typeof group?.owner === "string" ? group.owner : null,
    participants_count: getGroupParticipantsCount(group),
    source,
    metadata: {
      subjectOwner: group?.subjectOwner || null,
      subjectTime: group?.subjectTime || null,
      creation: creation || null,
      restrict: !!group?.restrict,
      announce: !!group?.announce,
      participants_preview: participants.slice(0, 20),
    },
    last_synced_at: nowIso(),
  };
}

async function fetchInstance(instanceId: string, userId: string) {
  const supabase = getSupabaseAdmin();
  const { data: instance, error } = await supabase
    .from("whatsapp_instances")
    .select("id, user_id, instance_name, status")
    .eq("id", instanceId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !instance?.id) {
    throw new Error(error?.message || "Instancia nao encontrada");
  }

  return instance;
}

async function fetchGroupRecord(groupId: string, userId: string) {
  const supabase = getSupabaseAdmin();
  const { data: group, error } = await supabase
    .from("whatsapp_groups")
    .select("id, user_id, instance_id, remote_jid, subject, description, picture_url, owner_jid, participants_count, metadata, status")
    .eq("id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !group?.id) {
    throw new Error(error?.message || "Grupo nao encontrado");
  }

  return group;
}

async function fetchUserInstances(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data: instances, error } = await supabase
    .from("whatsapp_instances")
    .select("id, user_id, instance_name, status")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at");

  if (error) {
    throw new Error(error.message || "Nao foi possivel carregar as instancias");
  }

  return instances || [];
}

function parseFetchAllGroupsResponse(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.groups)) return payload.groups;
  if (Array.isArray(payload?.response)) return payload.response;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.data?.groups)) return payload.data.groups;
  if (Array.isArray(payload?.response?.groups)) return payload.response.groups;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function fetchAllGroupsFromEvolution(instanceName: string) {
  const endpoints = [
    buildGroupEndpoint(`/group/fetchAllGroups/${instanceName}`, { getParticipants: "false" }),
    buildGroupEndpoint(`/group/fetchAllGroups/${instanceName}`),
  ];

  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    try {
      const payload = await evolutionFetch(endpoint);
      return parseFetchAllGroupsResponse(payload);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Nao foi possivel carregar os grupos na Evolution");
}

async function syncSingleGroupFromEvolution(input: {
  userId: string;
  instanceId: string;
  instanceName: string;
  remoteJid: string;
}) {
  const supabase = getSupabaseAdmin();
  const groups = await fetchAllGroupsFromEvolution(input.instanceName);
  const matched = groups.find((group: any) => getGroupRemoteJid(group) === input.remoteJid);

  if (!matched) return null;

  const payload = normalizeGroupRow({
    userId: input.userId,
    instanceId: input.instanceId,
    group: matched,
  });

  const { data, error } = await supabase
    .from("whatsapp_groups")
    .upsert(payload, { onConflict: "instance_id,remote_jid" })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message || "Falha ao atualizar dados do grupo");
  }

  return data;
}

function parseParticipantsResponse(payload: any): WhatsAppGroupParticipant[] {
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.participants)
      ? payload.participants
      : Array.isArray(payload?.response?.participants)
        ? payload.response.participants
        : Array.isArray(payload?.data?.participants)
          ? payload.data.participants
          : [];

  return source
    .map((participant: any) => {
      const rawId = String(participant?.id || participant?.jid || participant?.participant || "");
      const actionTargetCandidate =
        participant?.phoneNumber ||
        participant?.phone ||
        participant?.number ||
        participant?.pn ||
        participant?.participant ||
        participant?.jid ||
        participant?.id ||
        "";

      let actionTarget = String(actionTargetCandidate || "").trim();
      if (/@(lid|s\.whatsapp\.net|c\.us)$/i.test(actionTarget)) {
        // Keep the exact participant identifier returned by Evolution/WhatsApp.
      } else {
        actionTarget = phoneToWhatsappDigits(actionTarget);
      }

      return {
        id: rawId,
        admin:
          participant?.admin === "superadmin" || participant?.admin === "admin"
            ? participant.admin
            : null,
        action_target: actionTarget || rawId || null,
      };
    })
    .filter((participant: WhatsAppGroupParticipant) => participant.id);
}

function normalizeParticipantTargets(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .map((value) => {
          if (/@(lid|s\.whatsapp\.net|c\.us)$/i.test(value)) return value;
          return phoneToWhatsappDigits(value);
        })
        .filter((value) => /@(lid|s\.whatsapp\.net|c\.us)$/i.test(value) || value.length >= 10),
    ),
  );
}

export async function syncWhatsAppGroups(input: SyncWhatsAppGroupsInput) {
  const supabase = getSupabaseAdmin();
  const instances = input.instanceId
    ? [await fetchInstance(input.instanceId, input.userId)]
    : await fetchUserInstances(input.userId);

  let syncedGroups = 0;

  for (const instance of instances) {
    if (!instance?.instance_name) continue;

    const groups = await fetchAllGroupsFromEvolution(instance.instance_name);

    const rows = groups
      .map((group: any) => normalizeGroupRow({ userId: input.userId, instanceId: instance.id, group }))
      .filter((group: ReturnType<typeof normalizeGroupRow>) => group.remote_jid);

    if (rows.length > 0) {
      const { error } = await supabase
        .from("whatsapp_groups")
        .upsert(rows, { onConflict: "instance_id,remote_jid" });

      if (error) {
        throw new Error(error.message || `Falha ao sincronizar grupos da instancia ${instance.instance_name}`);
      }
    }

    syncedGroups += rows.length;

    await recordOperationalEvent({
      userId: input.userId,
      source: "whatsapp_groups",
      eventType: "sync_completed",
      severity: "info",
      status: "success",
      entityType: "whatsapp_instance",
      entityId: instance.id,
      message: `Grupos sincronizados da instancia ${instance.instance_name}`,
      metadata: {
        synced_groups: rows.length,
        instance_name: instance.instance_name,
      },
    });
  }

  return {
    syncedGroups,
    instancesCount: instances.length,
  };
}

function normalizeManualParticipants(value?: string | null) {
  return String(value || "")
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => phoneToWhatsappDigits(item))
    .filter((item) => item.length >= 10);
}

export async function createWhatsAppGroup(input: {
  userId: string;
  instanceId: string;
  subject: string;
  description?: string | null;
  participantLeadIds?: string[];
  manualParticipants?: string | null;
}) {
  const supabase = getSupabaseAdmin();
  const instance = await fetchInstance(input.instanceId, input.userId);

  const { data: leads } = (input.participantLeadIds?.length
    ? await supabase
        .from("leads")
        .select("id, phone")
        .eq("user_id", input.userId)
        .in("id", input.participantLeadIds)
        .is("deleted_at", null)
    : { data: [] as Array<{ id: string; phone: string }> })
    ;

  const leadParticipants = (leads || [])
    .map((lead) => phoneToWhatsappDigits(String(lead.phone || "")))
    .filter((value) => value.length >= 10);

  const manualParticipants = normalizeManualParticipants(input.manualParticipants);
  const participants = Array.from(new Set([...leadParticipants, ...manualParticipants]));

  if (!input.subject.trim()) {
    throw new Error("Informe o nome do grupo");
  }

  if (participants.length === 0) {
    throw new Error("Adicione pelo menos um participante para criar o grupo");
  }

  const created = await evolutionFetch(`/group/create/${instance.instance_name}`, {
    method: "POST",
    body: JSON.stringify({
      subject: input.subject.trim(),
      description: input.description?.trim() || "",
      participants,
    }),
  });

  const createdRemoteJid = getGroupRemoteJid(created);
  const groups = await fetchAllGroupsFromEvolution(instance.instance_name);
  const normalizedSubject = input.subject.trim().toLowerCase();
  const matchedGroup =
    groups.find((group: any) => getGroupRemoteJid(group) === createdRemoteJid) ||
    groups
      .filter((group: any) => getGroupSubject(group).trim().toLowerCase() === normalizedSubject)
      .sort((a: any, b: any) => getGroupCreationTimestamp(b) - getGroupCreationTimestamp(a))[0];

  const remoteJid = getGroupRemoteJid(matchedGroup || created);
  if (!remoteJid) {
    throw new Error("Grupo criado no WhatsApp, mas nao foi possivel localizar o identificador para salvar no FlowLux");
  }

  if (input.description?.trim()) {
    try {
      await evolutionFetch(buildGroupEndpoint(`/group/updateGroupDescription/${instance.instance_name}`, { groupJid: remoteJid }), {
        method: "POST",
        body: JSON.stringify({ description: input.description.trim() }),
      });
    } catch (error) {
      console.warn("Failed to update group description after create:", error);
    }
  }

  const persistedGroup =
    matchedGroup ||
    {
      ...created,
      id: remoteJid,
      subject: input.subject.trim(),
      desc: input.description?.trim() || null,
      size: participants.length + 1,
      participants: participants.map((value) => ({ id: `${value}@s.whatsapp.net` })),
    };

  const upsertPayload = normalizeGroupRow({
    userId: input.userId,
    instanceId: instance.id,
    group: persistedGroup,
  });

  const { data: savedGroup, error } = await supabase
    .from("whatsapp_groups")
    .upsert({ ...upsertPayload, source: "manual" }, { onConflict: "instance_id,remote_jid" })
    .select("*")
    .single();

  if (error || !savedGroup?.id) {
    throw new Error(error?.message || "Grupo criado no WhatsApp, mas falhou ao salvar no FlowLux");
  }

  return savedGroup;
}

export async function updateWhatsAppGroup(input: {
  userId: string;
  groupId: string;
  subject: string;
  description?: string | null;
  status?: "active" | "paused";
}) {
  const supabase = getSupabaseAdmin();
  const group = await fetchGroupRecord(input.groupId, input.userId);

  const instance = await fetchInstance(group.instance_id, input.userId);

  if (input.subject.trim() && input.subject.trim() !== group.subject) {
    await evolutionFetch(buildGroupEndpoint(`/group/updateGroupSubject/${instance.instance_name}`, { groupJid: group.remote_jid }), {
      method: "POST",
      body: JSON.stringify({ subject: input.subject.trim() }),
    });
  }

  if ((input.description || "") !== (group.description || "")) {
    await evolutionFetch(buildGroupEndpoint(`/group/updateGroupDescription/${instance.instance_name}`, { groupJid: group.remote_jid }), {
      method: "POST",
      body: JSON.stringify({ description: input.description?.trim() || "" }),
    });
  }

  const { data: savedGroup, error: updateError } = await supabase
    .from("whatsapp_groups")
    .update({
      subject: input.subject.trim(),
      description: input.description?.trim() || null,
      status: input.status || "active",
      last_synced_at: nowIso(),
    })
    .eq("id", group.id)
    .select("*")
    .single();

  if (updateError || !savedGroup?.id) {
    throw new Error(updateError?.message || "Falha ao atualizar o grupo");
  }

  return savedGroup;
}

export async function archiveWhatsAppGroup(input: {
  userId: string;
  groupId: string;
}) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("whatsapp_groups")
    .update({
      status: "archived",
    })
    .eq("id", input.groupId)
    .eq("user_id", input.userId);

  if (error) {
    throw new Error(error.message || "Nao foi possivel excluir o grupo da lista");
  }

  return { success: true };
}

export async function fetchWhatsAppGroupInviteLink(input: {
  userId: string;
  groupId: string;
}) {
  const group = await fetchGroupRecord(input.groupId, input.userId);
  const instance = await fetchInstance(group.instance_id, input.userId);

  const payload = await evolutionFetch(buildGroupEndpoint(`/group/inviteCode/${instance.instance_name}`, { groupJid: group.remote_jid }));
  const inviteCode = String(payload?.inviteCode || payload?.code || payload?.invite_code || payload?.response?.inviteCode || "").trim();

  if (!inviteCode) {
    throw new Error("Nao foi possivel gerar o link do grupo");
  }

  return {
    inviteCode,
    inviteUrl: `https://chat.whatsapp.com/${inviteCode}`,
  };
}

export async function fetchWhatsAppGroupParticipants(input: {
  userId: string;
  groupId: string;
}) {
  const supabase = getSupabaseAdmin();
  const group = await fetchGroupRecord(input.groupId, input.userId);
  const instance = await fetchInstance(group.instance_id, input.userId);

  const payload = await evolutionFetch(buildGroupEndpoint(`/group/participants/${instance.instance_name}`, { groupJid: group.remote_jid }));
  const participants = parseParticipantsResponse(payload);

  await supabase
    .from("whatsapp_groups")
    .update({
      participants_count: participants.length,
      metadata: {
        ...(group.metadata || {}),
        participants_preview: participants.slice(0, 20),
      },
      last_synced_at: nowIso(),
    })
    .eq("id", group.id);

  return participants;
}

export async function updateWhatsAppGroupParticipants(input: {
  userId: string;
  groupId: string;
  action: GroupParticipantAction;
  participants: string[];
}) {
  const normalizedParticipants = normalizeParticipantTargets(input.participants);
  if (normalizedParticipants.length === 0) {
    throw new Error("Informe pelo menos um participante valido");
  }

  const group = await fetchGroupRecord(input.groupId, input.userId);
  const instance = await fetchInstance(group.instance_id, input.userId);

  await evolutionFetch(buildGroupEndpoint(`/group/updateParticipant/${instance.instance_name}`, { groupJid: group.remote_jid }), {
    method: "POST",
    body: JSON.stringify({
      action: input.action,
      participants: normalizedParticipants,
    }),
  });

  const participants = await fetchWhatsAppGroupParticipants({
    userId: input.userId,
    groupId: input.groupId,
  });

  return {
    success: true,
    participants,
  };
}

export async function updateWhatsAppGroupSettings(input: {
  userId: string;
  groupId: string;
  announcementMode: "all_members" | "admins_only";
  editSettingsMode: "all_members" | "admins_only";
}) {
  const supabase = getSupabaseAdmin();
  const group = await fetchGroupRecord(input.groupId, input.userId);
  const instance = await fetchInstance(group.instance_id, input.userId);

  const actions: GroupSettingAction[] = [
    input.announcementMode === "admins_only" ? "announcement" : "not_announcement",
    input.editSettingsMode === "admins_only" ? "locked" : "unlocked",
  ];

  for (const action of actions) {
    await evolutionFetch(buildGroupEndpoint(`/group/updateSetting/${instance.instance_name}`, { groupJid: group.remote_jid }), {
      method: "POST",
      body: JSON.stringify({ action }),
    });
  }

  const refreshed = await syncSingleGroupFromEvolution({
    userId: input.userId,
    instanceId: group.instance_id,
    instanceName: instance.instance_name,
    remoteJid: group.remote_jid,
  });

  if (!refreshed) {
    await supabase
      .from("whatsapp_groups")
      .update({
        metadata: {
          ...(group.metadata || {}),
          announce: input.announcementMode === "admins_only",
          restrict: input.editSettingsMode === "admins_only",
        },
        last_synced_at: nowIso(),
      })
      .eq("id", group.id);
  }

  return {
    success: true,
    settings: {
      announcementMode: input.announcementMode,
      editSettingsMode: input.editSettingsMode,
    },
  };
}

export async function sendGroupMessage(input: {
  userId: string;
  groupId: string;
  message?: string | null;
  mediaUrl?: string | null;
  mediaType?: GroupMessageType | null;
  fileName?: string | null;
  sendMode?: "manual" | "flow" | "scheduled";
  flowExecutionId?: string | null;
  scheduledMessageId?: string | null;
}) {
  const supabase = getSupabaseAdmin();
  const group = await fetchGroupRecord(input.groupId, input.userId);

  const instance = await fetchInstance(group.instance_id, input.userId);
  const target = resolveWhatsAppTarget(group.remote_jid);
  const sendMode = input.sendMode || "manual";
  const messageType = normalizeGroupMediaType(input.mediaType);
  const content = messageType === "audio" ? "" : (input.message || "");

  let providerResponse: Record<string, unknown> = {};
  try {
    if (input.mediaUrl) {
      if (messageType === "audio") {
        providerResponse = await evolutionFetch(`/message/sendWhatsAppAudio/${instance.instance_name}`, {
          method: "POST",
          body: JSON.stringify({
            number: target,
            audio: input.mediaUrl,
          }),
        });
      } else {
        providerResponse = await evolutionFetch(`/message/sendMedia/${instance.instance_name}`, {
          method: "POST",
          body: JSON.stringify({
            number: target,
            mediatype: messageType === "image" ? "image" : messageType === "video" ? "video" : "document",
            media: input.mediaUrl,
            caption: content,
          }),
        });
      }
    } else {
      providerResponse = await evolutionFetch(`/message/sendText/${instance.instance_name}`, {
        method: "POST",
        body: JSON.stringify({
          number: target,
          text: content,
        }),
      });
    }

    await supabase.from("group_message_logs").insert({
      group_id: group.id,
      user_id: input.userId,
      instance_id: group.instance_id,
      flow_execution_id: input.flowExecutionId || null,
      scheduled_message_id: input.scheduledMessageId || null,
      send_mode: sendMode,
      message_type: messageType,
      content: content || null,
      media_url: input.mediaUrl || null,
      file_name: input.fileName || null,
      status: "sent",
      provider_response: providerResponse || {},
      sent_at: nowIso(),
    });

    return {
      group,
      providerResponse,
    };
  } catch (error: any) {
    const message = String(error?.message || error || "Falha ao enviar mensagem para o grupo");

    await supabase.from("group_message_logs").insert({
      group_id: group.id,
      user_id: input.userId,
      instance_id: group.instance_id,
      flow_execution_id: input.flowExecutionId || null,
      scheduled_message_id: input.scheduledMessageId || null,
      send_mode: sendMode,
      message_type: messageType,
      content: content || null,
      media_url: input.mediaUrl || null,
      file_name: input.fileName || null,
      status: "failed",
      error_message: message,
      provider_response: {},
      sent_at: nowIso(),
    });

    await recordOperationalEvent({
      userId: input.userId,
      source: "whatsapp_groups",
      eventType: "send_failed",
      severity: "error",
      status: "error",
      entityType: "whatsapp_group",
      entityId: group.id,
      message,
      metadata: {
        instance_id: group.instance_id,
        remote_jid: group.remote_jid,
        send_mode: sendMode,
        media_type: messageType,
      },
    });

    throw error;
  }
}
