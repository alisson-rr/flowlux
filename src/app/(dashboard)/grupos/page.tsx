"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Link2,
  Loader2,
  MessagesSquare,
  MessageSquare,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Shield,
  Trash2,
  UserMinus,
  UserPlus,
  WandSparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatDateTime } from "@/lib/utils";
import type {
  GroupScheduledMessage,
  Lead,
  MessageTemplate,
  WhatsappInstance,
  WhatsAppGroup,
  WhatsAppGroupParticipant,
} from "@/types";

type FlowOption = {
  id: string;
  name: string;
  is_active: boolean;
};

type MediaItem = {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
};

type GroupPageScheduled = GroupScheduledMessage & {
  group?: Pick<WhatsAppGroup, "id" | "subject" | "status"> | null;
};

type GroupDialogMode = "create" | "edit";

const SUPPORTED_MEDIA_TYPES = new Set(["image", "video", "audio", "document"]);

function isImageMediaType(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "image" || normalized.startsWith("image/");
}

function isAudioMediaType(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "audio" || normalized.startsWith("audio/");
}

function getParticipantDisplayValue(participant: WhatsAppGroupParticipant) {
  const source = String(participant.action_target || participant.id || "").trim();
  return source.replace(/@.+$/, "");
}

function getStatusLabel(status?: string | null) {
  switch (status) {
    case "published":
    case "active":
      return "Ativo";
    case "paused":
      return "Pausado";
    case "sent":
      return "Enviado";
    case "processing":
      return "Processando";
    case "retry_waiting":
      return "Tentando novamente";
    case "failed":
      return "Falhou";
    case "cancelled":
      return "Cancelado";
    default:
      return "Rascunho";
  }
}

function getStatusVariant(status?: string | null) {
  switch (status) {
    case "published":
    case "active":
    case "sent":
      return "default";
    case "paused":
    case "retry_waiting":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

function toDateTimeLocalValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildDefaultGroupForm(instances: WhatsappInstance[]) {
  return {
    id: null as string | null,
    subject: "",
    description: "",
    instance_id: instances[0]?.id || "",
    manual_participants: "",
    selected_lead_ids: [] as string[],
  };
}

function buildDefaultSendForm() {
  return {
    group_id: "",
    message: "",
    media_url: "",
    media_type: "",
    file_name: "",
  };
}

function buildDefaultFlowForm() {
  return {
    group_id: "",
    flow_id: "",
  };
}

function buildDefaultScheduleForm(instances: WhatsappInstance[]) {
  return {
    id: null as string | null,
    group_id: "",
    scheduled_at: "",
    message: "",
    media_url: "",
    media_type: "",
    file_name: "",
    instance_id: instances[0]?.id || "",
  };
}

function splitParticipantEntries(value: string) {
  return String(value || "")
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function GruposPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [tab, setTab] = useState("grupos");

  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [scheduledMessages, setScheduledMessages] = useState<GroupPageScheduled[]>([]);
  const [instances, setInstances] = useState<WhatsappInstance[]>([]);
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);

  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupDialogMode, setGroupDialogMode] = useState<GroupDialogMode>("create");
  const [groupForm, setGroupForm] = useState(buildDefaultGroupForm([]));

  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendForm, setSendForm] = useState(buildDefaultSendForm());

  const [flowDialogOpen, setFlowDialogOpen] = useState(false);
  const [flowForm, setFlowForm] = useState(buildDefaultFlowForm());

  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState(buildDefaultScheduleForm([]));
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [adminGroup, setAdminGroup] = useState<WhatsAppGroup | null>(null);
  const [groupParticipants, setGroupParticipants] = useState<WhatsAppGroupParticipant[]>([]);
  const [sentLast7DaysCount, setSentLast7DaysCount] = useState(0);
  const [announcementMode, setAnnouncementMode] = useState<"all_members" | "admins_only">("all_members");
  const [editSettingsMode, setEditSettingsMode] = useState<"all_members" | "admins_only">("all_members");
  const [participantInput, setParticipantInput] = useState("");

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    const [
      groupsRes,
      scheduledRes,
      instancesRes,
      flowsRes,
      leadsRes,
      mediaRes,
      templatesRes,
      sentLogsRes,
    ] = await Promise.all([
      supabase
        .from("whatsapp_groups")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "archived")
        .order("updated_at", { ascending: false }),
      supabase
        .from("group_scheduled_messages")
        .select("*, group:whatsapp_groups(id, subject, status)")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .neq("status", "cancelled")
        .order("scheduled_at", { ascending: true }),
      supabase
        .from("whatsapp_instances")
        .select("id, user_id, instance_name, status, created_at")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at"),
      supabase
        .from("flows")
        .select("id, name, is_active")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("leads")
        .select("id, user_id, name, phone, email, stage_id, created_at, updated_at")
        .eq("user_id", user.id)
        .eq("archived", false)
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("media")
        .select("id, file_name, file_type, file_url")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("message_templates")
        .select("id, user_id, name, content, created_at")
        .eq("user_id", user.id)
        .order("name"),
      supabase
        .from("group_message_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "sent")
        .gte("sent_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    if (groupsRes.error || scheduledRes.error || instancesRes.error || flowsRes.error || leadsRes.error || mediaRes.error || templatesRes.error || sentLogsRes.error) {
      toast("Nao foi possivel carregar o modulo de grupos.", "error");
      setLoading(false);
      return;
    }

    const nextInstances = (instancesRes.data || []) as WhatsappInstance[];
    setGroups((groupsRes.data || []) as WhatsAppGroup[]);
    setScheduledMessages((scheduledRes.data || []) as GroupPageScheduled[]);
    setInstances(nextInstances);
    setFlows((flowsRes.data || []) as FlowOption[]);
    setLeads((leadsRes.data || []) as Lead[]);
    setMediaItems(((mediaRes.data || []) as MediaItem[]).filter((item) => SUPPORTED_MEDIA_TYPES.has(item.file_type)));
    setTemplates((templatesRes.data || []) as MessageTemplate[]);
    setSentLast7DaysCount(sentLogsRes.count || 0);
    setLoading(false);

    setGroupForm((current) => current.instance_id ? current : buildDefaultGroupForm(nextInstances));
    setScheduleForm((current) => current.instance_id ? current : buildDefaultScheduleForm(nextInstances));
  }, [toast, user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const withAuthHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  const filteredGroups = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return groups;
    return groups.filter((group) => {
      const instanceName = instances.find((instance) => instance.id === group.instance_id)?.instance_name || "";
      return `${group.subject} ${group.description || ""} ${group.remote_jid} ${instanceName}`.toLowerCase().includes(term);
    });
  }, [groups, instances, searchTerm]);

  const filteredLeads = useMemo(() => {
    const term = leadSearch.trim().toLowerCase();
    const base = term
      ? leads.filter((lead) => `${lead.name} ${lead.phone} ${lead.email || ""}`.toLowerCase().includes(term))
      : leads;

    return base.slice(0, 12);
  }, [leadSearch, leads]);

  const pendingSchedules = useMemo(
    () => scheduledMessages.filter((item) => ["pending", "processing", "retry_waiting"].includes(item.status)),
    [scheduledMessages],
  );

  const handleSyncGroups = async () => {
    if (!user?.id) return;
    setBusyKey("sync");
    try {
      const res = await fetch("/api/groups/sync", {
        method: "POST",
        headers: await withAuthHeaders(),
        body: JSON.stringify({ user_id: user.id }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Falha ao sincronizar grupos");
      await loadData();
      toast(`${payload.synced_groups || 0} grupos sincronizados.`, "success");
    } catch (error: any) {
      toast(String(error?.message || error || "Falha ao sincronizar grupos"), "error");
    } finally {
      setBusyKey(null);
    }
  };

  const openCreateGroup = () => {
    setGroupDialogMode("create");
    setGroupForm(buildDefaultGroupForm(instances));
    setLeadSearch("");
    setGroupDialogOpen(true);
  };

  const openEditGroup = (group: WhatsAppGroup) => {
    setGroupDialogMode("edit");
    setGroupForm({
      id: group.id,
      subject: group.subject,
      description: group.description || "",
      instance_id: group.instance_id,
      manual_participants: "",
      selected_lead_ids: [],
    });
    setLeadSearch("");
    setGroupDialogOpen(true);
  };

  const saveGroup = async () => {
    if (!user?.id) return;
    if (!groupForm.subject.trim() || !groupForm.instance_id) {
      toast("Preencha o nome do grupo e a instancia.", "warning");
      return;
    }

    if (groupDialogMode === "create" && !groupForm.manual_participants.trim() && groupForm.selected_lead_ids.length === 0) {
      toast("Adicione pelo menos um participante para criar o grupo.", "warning");
      return;
    }

    setBusyKey(groupDialogMode === "create" ? "create-group" : `group-${groupForm.id}`);

    try {
      const url = groupDialogMode === "create" ? "/api/groups" : `/api/groups/${groupForm.id}`;
      const method = groupDialogMode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: await withAuthHeaders(),
        body: JSON.stringify({
          user_id: user.id,
          instance_id: groupForm.instance_id,
          subject: groupForm.subject,
          description: groupForm.description,
          participant_lead_ids: groupForm.selected_lead_ids,
          manual_participants: groupForm.manual_participants,
          status: "active",
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Falha ao salvar grupo");

      await loadData();
      setGroupDialogOpen(false);
      toast(groupDialogMode === "create" ? "Grupo criado com sucesso." : "Grupo atualizado com sucesso.", "success");
    } catch (error: any) {
      toast(String(error?.message || error || "Falha ao salvar grupo"), "error");
    } finally {
      setBusyKey(null);
    }
  };

  const archiveGroup = async (groupId: string) => {
    if (!user?.id) return;
    setBusyKey(`archive-${groupId}`);
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "DELETE",
        headers: await withAuthHeaders(),
        body: JSON.stringify({ user_id: user.id }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Falha ao excluir grupo");
      await loadData();
      toast("Grupo removido da lista.", "success");
    } catch (error: any) {
      toast(String(error?.message || error || "Falha ao excluir grupo"), "error");
    } finally {
      setBusyKey(null);
    }
  };

  const openSendDialog = (group: WhatsAppGroup) => {
    setSendForm({
      group_id: group.id,
      message: "",
      media_url: "",
      media_type: "",
      file_name: "",
    });
    setSendDialogOpen(true);
  };

  const handleSendMessage = async () => {
    if (!user?.id || !sendForm.group_id || (!sendForm.message.trim() && !sendForm.media_url)) {
      toast("Escreva a mensagem ou selecione uma midia.", "warning");
      return;
    }

    setBusyKey(`send-${sendForm.group_id}`);
    try {
      const res = await fetch(`/api/groups/${sendForm.group_id}/send`, {
        method: "POST",
        headers: await withAuthHeaders(),
        body: JSON.stringify({
          user_id: user.id,
          message: isAudioMediaType(sendForm.media_type) ? "" : sendForm.message,
          media_url: sendForm.media_url || null,
          media_type: sendForm.media_type || null,
          file_name: sendForm.file_name || null,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Falha ao enviar mensagem");

      setSendDialogOpen(false);
      setSendForm(buildDefaultSendForm());
      toast("Mensagem enviada para o grupo.", "success");
    } catch (error: any) {
      toast(String(error?.message || error || "Falha ao enviar mensagem"), "error");
    } finally {
      setBusyKey(null);
    }
  };

  const openFlowDialog = (group: WhatsAppGroup) => {
    setFlowForm({ group_id: group.id, flow_id: "" });
    setFlowDialogOpen(true);
  };

  const handleSendFlow = async () => {
    if (!user?.id || !flowForm.group_id || !flowForm.flow_id) {
      toast("Escolha um fluxo para enviar.", "warning");
      return;
    }

    setBusyKey(`flow-${flowForm.group_id}`);
    try {
      const res = await fetch(`/api/groups/${flowForm.group_id}/flow`, {
        method: "POST",
        headers: await withAuthHeaders(),
        body: JSON.stringify({
          user_id: user.id,
          flow_id: flowForm.flow_id,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Falha ao iniciar fluxo");

      setFlowDialogOpen(false);
      setFlowForm(buildDefaultFlowForm());
      toast("Fluxo colocado na fila do grupo.", "success");
    } catch (error: any) {
      toast(String(error?.message || error || "Falha ao iniciar fluxo"), "error");
    } finally {
      setBusyKey(null);
    }
  };

  const openScheduleDialog = (group?: WhatsAppGroup, scheduled?: GroupPageScheduled) => {
    setScheduleForm({
      id: scheduled?.id || null,
      group_id: scheduled?.group_id || group?.id || "",
      scheduled_at: toDateTimeLocalValue(scheduled?.scheduled_at),
      message: scheduled?.message || "",
      media_url: scheduled?.media_url || "",
      media_type: scheduled?.media_type || "",
      file_name: scheduled?.file_name || "",
      instance_id: scheduled?.instance_id || group?.instance_id || instances[0]?.id || "",
    });
    setScheduleDialogOpen(true);
  };

  const handleSaveSchedule = async () => {
    if (!user?.id || !scheduleForm.group_id || !scheduleForm.scheduled_at || (!scheduleForm.message.trim() && !scheduleForm.media_url)) {
      toast("Preencha grupo, horario e conteudo.", "warning");
      return;
    }

    setBusyKey(scheduleForm.id ? `schedule-${scheduleForm.id}` : `schedule-${scheduleForm.group_id}`);
    try {
      const res = await fetch(`/api/groups/${scheduleForm.group_id}/schedule`, {
        method: "POST",
        headers: await withAuthHeaders(),
        body: JSON.stringify({
          user_id: user.id,
          scheduled_message_id: scheduleForm.id,
          scheduled_at: scheduleForm.scheduled_at,
          message: isAudioMediaType(scheduleForm.media_type) ? "" : scheduleForm.message,
          media_url: scheduleForm.media_url || null,
          media_type: scheduleForm.media_type || null,
          file_name: scheduleForm.file_name || null,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Falha ao salvar agendamento");

      setScheduleDialogOpen(false);
      setScheduleForm(buildDefaultScheduleForm(instances));
      await loadData();
      toast(scheduleForm.id ? "Agendamento atualizado." : "Mensagem agendada com sucesso.", "success");
    } catch (error: any) {
      toast(String(error?.message || error || "Falha ao salvar agendamento"), "error");
    } finally {
      setBusyKey(null);
    }
  };

  const deleteScheduled = async (scheduledId: string) => {
    if (!user?.id) return;
    setBusyKey(`delete-scheduled-${scheduledId}`);
    try {
      const res = await fetch(`/api/group-scheduled/${scheduledId}`, {
        method: "DELETE",
        headers: await withAuthHeaders(),
        body: JSON.stringify({ user_id: user.id }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Falha ao excluir agendamento");
      await loadData();
      toast("Agendamento removido.", "success");
    } catch (error: any) {
      toast(String(error?.message || error || "Falha ao excluir agendamento"), "error");
    } finally {
      setBusyKey(null);
    }
  };

  const handleShareGroupLink = async (groupId: string) => {
    if (!user?.id) return;
    setBusyKey(`invite-${groupId}`);
    try {
      const res = await fetch(`/api/groups/${groupId}/invite-link`, {
        method: "POST",
        headers: await withAuthHeaders(),
        body: JSON.stringify({ user_id: user.id }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Falha ao gerar o link do grupo");

      const inviteUrl = String(payload.invite_url || "");
      if (!inviteUrl) {
        throw new Error("O grupo nao retornou um link valido");
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
      }

      toast("Link do grupo copiado.", "success");
    } catch (error: any) {
      toast(String(error?.message || error || "Falha ao gerar o link do grupo"), "error");
    } finally {
      setBusyKey(null);
    }
  };

  const openAdminDialog = async (group: WhatsAppGroup) => {
    setAdminGroup(group);
    setParticipantInput("");
    setAnnouncementMode((group.metadata as Record<string, unknown> | undefined)?.announce ? "admins_only" : "all_members");
    setEditSettingsMode((group.metadata as Record<string, unknown> | undefined)?.restrict ? "admins_only" : "all_members");
    setGroupParticipants([]);
    setAdminDialogOpen(true);
    setBusyKey(`participants-${group.id}`);

    try {
      const params = new URLSearchParams({ user_id: user?.id || "" });
      const res = await fetch(`/api/groups/${group.id}/participants?${params.toString()}`, {
        method: "GET",
        headers: await withAuthHeaders(),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Falha ao carregar participantes");
      setGroupParticipants(Array.isArray(payload.participants) ? payload.participants : []);
    } catch (error: any) {
      toast(String(error?.message || error || "Falha ao carregar participantes"), "error");
    } finally {
      setBusyKey(null);
    }
  };

  const handleSaveAdminSettings = async () => {
    if (!user?.id || !adminGroup?.id) return;
    setBusyKey(`settings-${adminGroup.id}`);
    try {
      const res = await fetch(`/api/groups/${adminGroup.id}/settings`, {
        method: "PATCH",
        headers: await withAuthHeaders(),
        body: JSON.stringify({
          user_id: user.id,
          announcement_mode: announcementMode,
          edit_settings_mode: editSettingsMode,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Falha ao salvar configuracoes do grupo");

      await loadData();
      toast("Configuracoes do grupo atualizadas.", "success");
    } catch (error: any) {
      toast(String(error?.message || error || "Falha ao salvar configuracoes do grupo"), "error");
    } finally {
      setBusyKey(null);
    }
  };

  const handleParticipantAction = async (action: "add" | "remove" | "promote" | "demote", participants: string[]) => {
    if (!user?.id || !adminGroup?.id) return;
    setBusyKey(`${action}-${adminGroup.id}`);
    try {
      const res = await fetch(`/api/groups/${adminGroup.id}/participants`, {
        method: "PATCH",
        headers: await withAuthHeaders(),
        body: JSON.stringify({
          user_id: user.id,
          action,
          participants,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Falha ao atualizar participantes");

      setGroupParticipants(Array.isArray(payload.participants) ? payload.participants : []);
      setParticipantInput("");
      await loadData();
      toast("Participantes atualizados.", "success");
    } catch (error: any) {
      toast(String(error?.message || error || "Falha ao atualizar participantes"), "error");
    } finally {
      setBusyKey(null);
    }
  };

  const handleAddParticipants = async () => {
    const entries = splitParticipantEntries(participantInput);
    if (entries.length === 0) {
      toast("Informe pelo menos um telefone para adicionar.", "warning");
      return;
    }
    await handleParticipantAction("add", entries);
  };

  const summaryCards = [
    {
      label: "Grupos ativos",
      value: groups.filter((group) => group.status === "active").length,
      helper: "Base pronta para disparo",
      icon: MessagesSquare,
    },
    {
      label: "Agendamentos pendentes",
      value: pendingSchedules.length,
      helper: "Mensagens futuras e reenvios",
      icon: CalendarClock,
    },
    {
      label: "Envios nos ultimos 7 dias",
      value: sentLast7DaysCount,
      helper: "Acompanha tracao recente",
      icon: Send,
    },
  ];

  const selectedSendGroup = groups.find((group) => group.id === sendForm.group_id) || null;
  const selectedFlowGroup = groups.find((group) => group.id === flowForm.group_id) || null;
  const selectedScheduleGroup = groups.find((group) => group.id === scheduleForm.group_id) || null;

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Grupos</h1>
          <p className="text-muted-foreground">
            Organize seus grupos de WhatsApp e use o FlowLux para criar, disparar, automatizar e agendar sem depender do chat.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleSyncGroups} disabled={busyKey === "sync"}>
            {busyKey === "sync" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Sincronizar grupos
          </Button>
          <Button onClick={openCreateGroup}>
            <Plus className="mr-2 h-4 w-4" />
            Novo grupo
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((card) => (
          <Card key={card.label} className="border-border/60 bg-card/80">
            <CardContent className="flex items-start justify-between p-5">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="text-3xl font-semibold">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.helper}</p>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3">
                <card.icon className="h-5 w-5 text-primary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="space-y-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar grupo pelo nome, instancia ou identificador"
              className="pl-9"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Funcionalidade focada em envio. O FlowLux nao usa este modulo como canal de atendimento.
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="grupos">Grupos</TabsTrigger>
            <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
          </TabsList>

          <TabsContent value="grupos" className="space-y-3">
            {filteredGroups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                <MessagesSquare className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 font-medium">Nenhum grupo encontrado</p>
                <p className="text-sm text-muted-foreground">
                  Crie um novo grupo ou sincronize os grupos ja existentes da sua instancia.
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredGroups.map((group) => {
                  const instanceName = instances.find((instance) => instance.id === group.instance_id)?.instance_name || "Instancia";

                  return (
                    <Card key={group.id} className="border-border/60 bg-card/80">
                      <CardContent className="space-y-4 p-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-lg font-semibold">{group.subject}</h2>
                              <Badge variant={getStatusVariant(group.status) as any}>{getStatusLabel(group.status)}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {group.description || "Grupo pronto para comunicacoes de oferta, aquecimento ou suporte."}
                            </p>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>{instanceName}</span>
                              <span>{group.participants_count || 0} participantes</span>
                              <span>Atualizado {formatDateTime(group.updated_at)}</span>
                            </div>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            <Button size="sm" onClick={() => openSendDialog(group)}>
                              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                              Enviar mensagem
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openFlowDialog(group)}>
                              <WandSparkles className="mr-1.5 h-3.5 w-3.5" />
                              Enviar fluxo
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openScheduleDialog(group)}>
                              <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                              Agendar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleShareGroupLink(group.id)}>
                              <Link2 className="mr-1.5 h-3.5 w-3.5" />
                              Compartilhar link
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openAdminDialog(group)}>
                              <Shield className="mr-1.5 h-3.5 w-3.5" />
                              Administrar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => openEditGroup(group)}>
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => archiveGroup(group.id)}
                            >
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                              Excluir
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="agendamentos" className="space-y-3">
            <div className="grid gap-3">
              {scheduledMessages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                  <CalendarClock className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 font-medium">Nenhum agendamento ainda</p>
                  <p className="text-sm text-muted-foreground">
                    Use os grupos para programar avisos, aquecimentos ou sequencias antes de uma oferta.
                  </p>
                </div>
              ) : (
                scheduledMessages.map((item) => (
                  <Card key={item.id} className="border-border/60 bg-card/80">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-semibold">{item.group?.subject || item.group_subject}</h2>
                            <Badge variant={getStatusVariant(item.status) as any}>{getStatusLabel(item.status)}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {item.message || (item.media_url ? "Midia sem legenda" : "Sem conteudo")}
                          </p>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>Agendado para {formatDateTime(item.scheduled_at)}</span>
                            <span>Tentativas {item.attempt_count}</span>
                            {item.failure_reason ? <span className="text-destructive">{item.failure_reason}</span> : null}
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Button size="sm" variant="outline" onClick={() => openScheduleDialog(undefined, item)}>
                            Editar
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteScheduled(item.id)}>
                            Excluir
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{groupDialogMode === "create" ? "Novo grupo" : "Editar grupo"}</DialogTitle>
            <DialogDescription>
              {groupDialogMode === "create"
                ? "Monte o grupo uma vez e depois use o FlowLux para mandar campanhas, aquecimentos e lembretes."
                : "Ajuste o nome do grupo, a descricao e a instancia vinculada."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome do grupo *</Label>
                  <Input
                    value={groupForm.subject}
                    onChange={(event) => setGroupForm((current) => ({ ...current, subject: event.target.value }))}
                    placeholder="Ex.: Lote VIP da oferta"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Instancia *</Label>
                  <Select value={groupForm.instance_id} onValueChange={(value) => setGroupForm((current) => ({ ...current, instance_id: value }))}>
                    <SelectTrigger><SelectValue placeholder="Escolha a instancia" /></SelectTrigger>
                    <SelectContent>
                      {instances.map((instance) => (
                        <SelectItem key={instance.id} value={instance.id}>{instance.instance_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descricao</Label>
                <Textarea
                  value={groupForm.description}
                  onChange={(event) => setGroupForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Diga qual e o objetivo do grupo para ficar facil de organizar."
                />
              </div>

              {groupDialogMode === "create" ? (
                <>
                  <div className="space-y-2">
                    <Label>Participantes vindos dos leads</Label>
                    <Input
                      value={leadSearch}
                      onChange={(event) => setLeadSearch(event.target.value)}
                      placeholder="Busque por nome, telefone ou email"
                    />
                    <div className="max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-border/70 p-3">
                      {filteredLeads.map((lead) => {
                        const isSelected = groupForm.selected_lead_ids.includes(lead.id);
                        return (
                          <button
                            key={lead.id}
                            type="button"
                            onClick={() => setGroupForm((current) => ({
                              ...current,
                              selected_lead_ids: isSelected
                                ? current.selected_lead_ids.filter((value) => value !== lead.id)
                                : [...current.selected_lead_ids, lead.id],
                            }))}
                            className={cn(
                              "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                              isSelected ? "border-primary bg-primary/10" : "border-border/70 hover:bg-muted/40",
                            )}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{lead.name}</p>
                              <p className="truncate text-xs text-muted-foreground">{lead.phone}</p>
                            </div>
                            {isSelected ? <Badge>Selecionado</Badge> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Participantes manuais</Label>
                    <Textarea
                      value={groupForm.manual_participants}
                      onChange={(event) => setGroupForm((current) => ({ ...current, manual_participants: event.target.value }))}
                      placeholder={"+55 11 99999-1111\n+1 305 555 1222\n11988887777"}
                      className="min-h-[120px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Um telefone por linha. Pode usar numero nacional com ou sem o 9 e tambem internacionais com +.
                    </p>
                  </div>
                </>
              ) : null}
            </div>

            <Card className="border-dashed">
              <CardContent className="space-y-3 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resumo rapido</p>
                <div className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Nome:</span> {groupForm.subject || "A definir"}</p>
                  <p><span className="text-muted-foreground">Instancia:</span> {instances.find((instance) => instance.id === groupForm.instance_id)?.instance_name || "Nao escolhida"}</p>
                  {groupDialogMode === "create" ? (
                    <p><span className="text-muted-foreground">Leads selecionados:</span> {groupForm.selected_lead_ids.length}</p>
                  ) : (
                    <p><span className="text-muted-foreground">Modo:</span> Edicao do grupo</p>
                  )}
                </div>
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                  O foco deste modulo e ajudar o infoprodutor a centralizar grupos de oferta, aquecimento ou suporte sem depender de atendimento em tempo real.
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveGroup} disabled={busyKey === "create-group" || busyKey === `group-${groupForm.id}`}>
              {(busyKey === "create-group" || busyKey === `group-${groupForm.id}`) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {groupDialogMode === "create" ? "Criar grupo" : "Salvar alteracoes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar mensagem para grupo</DialogTitle>
            <DialogDescription>
              Dispare uma comunicacao imediata, com texto ou midia, para o grupo selecionado.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Grupo</Label>
                <Select value={sendForm.group_id} onValueChange={(value) => setSendForm((current) => ({ ...current, group_id: value }))}>
                  <SelectTrigger><SelectValue placeholder="Escolha o grupo" /></SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>{group.subject}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea
                  value={sendForm.message}
                  onChange={(event) => setSendForm((current) => ({ ...current, message: event.target.value }))}
                  placeholder={isAudioMediaType(sendForm.media_type) ? "Audio nao aceita legenda. Envie apenas o arquivo." : "Escreva a mensagem principal do grupo."}
                  className="min-h-[140px]"
                  disabled={isAudioMediaType(sendForm.media_type)}
                />
                {isAudioMediaType(sendForm.media_type) ? (
                  <p className="text-xs text-muted-foreground">Quando a midia for audio, o WhatsApp envia somente o audio, sem texto junto.</p>
                ) : null}
              </div>

              {templates.length > 0 ? (
                <div className="space-y-2">
                  <Label>Mensagem pronta</Label>
                  <Select
                    value="none"
                    onValueChange={(value) => {
                      if (value === "none") return;
                      const template = templates.find((item) => item.id === value);
                      if (!template) return;
                      setSendForm((current) => ({ ...current, message: template.content }));
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Usar uma mensagem pronta" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecione...</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {mediaItems.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Midia opcional</Label>
                    {sendForm.media_url ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSendForm((current) => ({ ...current, media_url: "", media_type: "", file_name: "" }))}
                      >
                        Remover
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {mediaItems.slice(0, 9).map((item) => {
                      const isSelected = item.file_url === sendForm.media_url;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSendForm((current) => ({
                            ...current,
                            message: isAudioMediaType(item.file_type) ? "" : current.message,
                            media_url: item.file_url,
                            media_type: item.file_type,
                            file_name: item.file_name,
                          }))}
                          className={cn(
                            "rounded-2xl border p-3 text-left transition-all",
                            isSelected ? "border-primary bg-primary/10" : "border-border/70 hover:bg-muted/40",
                          )}
                        >
                          <p className="line-clamp-1 text-sm font-medium">{item.file_name}</p>
                          <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{item.file_type}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <Card className="border-dashed">
              <CardContent className="space-y-3 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resumo</p>
                <div className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Grupo:</span> {selectedSendGroup?.subject || "Nao selecionado"}</p>
                  <p><span className="text-muted-foreground">Tipo:</span> {sendForm.media_url ? (isAudioMediaType(sendForm.media_type) ? `${sendForm.media_type} sem texto` : `${sendForm.media_type} com legenda`) : "Somente texto"}</p>
                </div>
                {sendForm.media_url ? (
                  isImageMediaType(sendForm.media_type) ? (
                    <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/20">
                      <img src={sendForm.media_url} alt={sendForm.file_name || "Imagem selecionada"} className="h-48 w-full object-cover" />
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                      Midia selecionada: {sendForm.file_name || sendForm.media_type}
                    </div>
                  )
                ) : null}
                <div className="rounded-2xl border bg-muted/20 p-3 text-sm whitespace-pre-wrap">
                  {sendForm.message || "Escreva a mensagem para visualizar aqui."}
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSendMessage} disabled={busyKey === `send-${sendForm.group_id}`}>
              {busyKey === `send-${sendForm.group_id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Enviar agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={flowDialogOpen} onOpenChange={setFlowDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar fluxo</DialogTitle>
            <DialogDescription>
              Use um fluxo ja pronto para disparar uma sequencia de mensagens no grupo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Grupo</Label>
              <Select value={flowForm.group_id} onValueChange={(value) => setFlowForm((current) => ({ ...current, group_id: value }))}>
                <SelectTrigger><SelectValue placeholder="Escolha o grupo" /></SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>{group.subject}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fluxo</Label>
              <Select value={flowForm.flow_id} onValueChange={(value) => setFlowForm((current) => ({ ...current, flow_id: value }))}>
                <SelectTrigger><SelectValue placeholder="Escolha o fluxo" /></SelectTrigger>
                <SelectContent>
                  {flows.map((flow) => (
                    <SelectItem key={flow.id} value={flow.id}>{flow.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
              O grupo recebe apenas o disparo. O historico do envio fica neste modulo, sem virar conversa no chat do atendimento.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlowDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSendFlow} disabled={busyKey === `flow-${flowForm.group_id}`}>
              {busyKey === `flow-${flowForm.group_id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
              Iniciar fluxo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{scheduleForm.id ? "Editar agendamento" : "Agendar mensagem"}</DialogTitle>
            <DialogDescription>
              Planeje avisos para o grupo e deixe o FlowLux reenfileirar sozinho se houver falha temporaria.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Grupo</Label>
                  <Select value={scheduleForm.group_id} onValueChange={(value) => setScheduleForm((current) => ({ ...current, group_id: value }))}>
                    <SelectTrigger><SelectValue placeholder="Escolha o grupo" /></SelectTrigger>
                    <SelectContent>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>{group.subject}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data e hora</Label>
                  <Input
                    type="datetime-local"
                    value={scheduleForm.scheduled_at}
                    onChange={(event) => setScheduleForm((current) => ({ ...current, scheduled_at: event.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea
                  value={scheduleForm.message}
                  onChange={(event) => setScheduleForm((current) => ({ ...current, message: event.target.value }))}
                  placeholder={isAudioMediaType(scheduleForm.media_type) ? "Audio nao aceita legenda. O agendamento vai enviar apenas o arquivo." : "Escreva a mensagem do agendamento."}
                  className="min-h-[140px]"
                  disabled={isAudioMediaType(scheduleForm.media_type)}
                />
                {isAudioMediaType(scheduleForm.media_type) ? (
                  <p className="text-xs text-muted-foreground">Para audio, o agendamento envia somente o arquivo, sem texto junto.</p>
                ) : null}
              </div>

              {mediaItems.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Midia opcional</Label>
                    {scheduleForm.media_url ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setScheduleForm((current) => ({ ...current, media_url: "", media_type: "", file_name: "" }))}
                      >
                        Remover
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {mediaItems.slice(0, 9).map((item) => {
                      const isSelected = item.file_url === scheduleForm.media_url;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setScheduleForm((current) => ({
                            ...current,
                            message: isAudioMediaType(item.file_type) ? "" : current.message,
                            media_url: item.file_url,
                            media_type: item.file_type,
                            file_name: item.file_name,
                          }))}
                          className={cn(
                            "rounded-2xl border p-3 text-left transition-all",
                            isSelected ? "border-primary bg-primary/10" : "border-border/70 hover:bg-muted/40",
                          )}
                        >
                          <p className="line-clamp-1 text-sm font-medium">{item.file_name}</p>
                          <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{item.file_type}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <Card className="border-dashed">
              <CardContent className="space-y-3 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resumo</p>
                <div className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Grupo:</span> {selectedScheduleGroup?.subject || "Nao selecionado"}</p>
                  <p><span className="text-muted-foreground">Horario:</span> {scheduleForm.scheduled_at || "Nao definido"}</p>
                  <p><span className="text-muted-foreground">Midia:</span> {scheduleForm.file_name || "Sem midia"}</p>
                </div>
                {scheduleForm.media_url ? (
                  isImageMediaType(scheduleForm.media_type) ? (
                    <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/20">
                      <img src={scheduleForm.media_url} alt={scheduleForm.file_name || "Imagem agendada"} className="h-48 w-full object-cover" />
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                      Midia selecionada: {scheduleForm.file_name || scheduleForm.media_type}
                    </div>
                  )
                ) : null}
                <div className="rounded-2xl border bg-muted/20 p-3 text-sm whitespace-pre-wrap">
                  {scheduleForm.message || "Escreva a mensagem para visualizar aqui."}
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveSchedule} disabled={busyKey === `schedule-${scheduleForm.id}` || busyKey === `schedule-${scheduleForm.group_id}`}>
              {(busyKey === `schedule-${scheduleForm.id}` || busyKey === `schedule-${scheduleForm.group_id}`) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
              {scheduleForm.id ? "Salvar alteracoes" : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Administrar grupo</DialogTitle>
            <DialogDescription>
              Controle quem pode enviar mensagens, quem pode editar o grupo e gerencie administradores sem sair do FlowLux.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Quem pode enviar mensagens</Label>
                  <Select value={announcementMode} onValueChange={(value: "all_members" | "admins_only") => setAnnouncementMode(value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_members">Todos do grupo</SelectItem>
                      <SelectItem value="admins_only">Somente administradores</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Quem pode editar configuracoes</Label>
                  <Select value={editSettingsMode} onValueChange={(value: "all_members" | "admins_only") => setEditSettingsMode(value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_members">Todos do grupo</SelectItem>
                      <SelectItem value="admins_only">Somente administradores</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-2">
                    <Label>Adicionar participante</Label>
                    <Textarea
                      value={participantInput}
                      onChange={(event) => setParticipantInput(event.target.value)}
                      placeholder={"+55 11 99999-1111\n5511988887777\n+1 305 555 1222"}
                      className="min-h-[96px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Pode usar nacional com ou sem o 9 e tambem internacionais com +.
                    </p>
                  </div>
                  <Button onClick={handleAddParticipants} disabled={busyKey === `add-${adminGroup?.id}`}>
                    {busyKey === `add-${adminGroup?.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                    Adicionar
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Participantes</p>
                    <p className="text-sm text-muted-foreground">Promova, remova ou tire permissao de administrador.</p>
                  </div>
                  {busyKey === `participants-${adminGroup?.id}` ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                </div>

                <div className="max-h-[360px] space-y-2 overflow-y-auto rounded-2xl border border-border/70 p-3">
                  {groupParticipants.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                      Nenhum participante carregado ainda.
                    </div>
                  ) : (
                    groupParticipants.map((participant) => {
                      const isAdmin = participant.admin === "admin" || participant.admin === "superadmin";
                      const isOwner = participant.admin === "superadmin";
                      return (
                        <div key={participant.id} className="flex flex-col gap-3 rounded-2xl border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{getParticipantDisplayValue(participant)}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant={isAdmin ? "default" : "secondary"}>
                                {isOwner ? "Dono do grupo" : isAdmin ? "Administrador" : "Participante"}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {isOwner ? null : isAdmin ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleParticipantAction("demote", [participant.action_target || participant.id])}
                                disabled={busyKey === `demote-${adminGroup?.id}`}
                              >
                                Remover admin
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleParticipantAction("promote", [participant.action_target || participant.id])}
                                disabled={busyKey === `promote-${adminGroup?.id}`}
                              >
                                Tornar admin
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleParticipantAction("remove", [participant.action_target || participant.id])}
                              disabled={isOwner || busyKey === `remove-${adminGroup?.id}`}
                            >
                              <UserMinus className="mr-1.5 h-3.5 w-3.5" />
                              Remover
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <Card className="border-dashed">
              <CardContent className="space-y-4 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resumo do grupo</p>
                <div className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Grupo:</span> {adminGroup?.subject || "Nao selecionado"}</p>
                  <p><span className="text-muted-foreground">Participantes:</span> {groupParticipants.length}</p>
                  <p><span className="text-muted-foreground">Mensagens:</span> {announcementMode === "admins_only" ? "Somente administradores" : "Todos"}</p>
                  <p><span className="text-muted-foreground">Configuracoes:</span> {editSettingsMode === "admins_only" ? "Somente administradores" : "Todos"}</p>
                </div>
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                  Ideal para lancamentos, suporte VIP e grupos temporarios onde o produtor precisa travar falas e controlar quem administra.
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdminDialogOpen(false)}>Fechar</Button>
            <Button onClick={handleSaveAdminSettings} disabled={busyKey === `settings-${adminGroup?.id}`}>
              {busyKey === `settings-${adminGroup?.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
              Salvar configuracoes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
