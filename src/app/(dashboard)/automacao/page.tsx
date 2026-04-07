"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Zap, Plus, Clock, Trash2, Loader2, CalendarClock, Megaphone, Pencil, ArrowUp, ArrowDown,
  MessageSquare, Image, Video, Music, FileUp, Timer, GripVertical, ArrowLeft, Eye, RefreshCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { useSubscription } from "@/lib/use-subscription";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";

interface Flow {
  id: string;
  name: string;
  description: string;
  trigger_type: "manual" | "keyword" | "schedule";
  keywords: string[];
  schedule_cron?: string;
  is_active: boolean;
  created_at: string;
  steps?: FlowStep[];
}

interface FlowStep {
  id: string;
  flow_id: string;
  step_order: number;
  step_type: "text" | "image" | "video" | "audio" | "document" | "delay";
  content: string;
  media_url: string;
  file_name: string;
  delay_seconds: number;
}

interface MassMessage {
  id: string;
  name: string;
  message: string;
  status: string;
  scheduled_at: string | null;
  sent_count: number;
  failed_count: number;
  total_count: number;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  last_error?: string | null;
  instance_id?: string;
  target_tags?: string[];
  target_stages?: string[];
}

interface MassMessageDelivery {
  id: string;
  mass_message_id: string;
  lead_id?: string | null;
  lead_name: string;
  lead_phone: string;
  normalized_phone: string;
  status: string;
  attempt_count: number;
  last_attempt_at?: string | null;
  sent_at?: string | null;
  failure_reason?: string | null;
  created_at: string;
}

interface ScheduledMsg {
  id: string;
  lead_id?: string | null;
  lead_name?: string;
  instance_id?: string | null;
  message: string;
  scheduled_at: string;
  status: string;
  attempt_count?: number;
  claimed_at?: string | null;
  last_attempt_at?: string | null;
  sent_at?: string | null;
  failure_reason?: string | null;
  provider_response?: Record<string, unknown> | null;
  media_url?: string | null;
  media_type?: string | null;
  file_name?: string | null;
  created_at?: string;
}

interface ScheduledMessageAttempt {
  id: string;
  scheduled_message_id: string;
  attempt_number: number;
  target_phone: string;
  normalized_phone?: string | null;
  lead_name: string;
  instance_name?: string | null;
  status: string;
  attempted_at: string;
  completed_at?: string | null;
  failure_reason?: string | null;
  created_at: string;
}

interface Instance { id: string; instance_name: string; }
interface MediaItem { id: string; file_name: string; file_type: string; file_url: string; }
interface TagOption { id: string; name: string; color: string; }
interface StageOption { id: string; name: string; color: string; }
interface TemplateOption { id: string; name: string; content: string; }

const STEP_TYPES = [
  { value: "text", label: "Texto", icon: MessageSquare, color: "text-blue-400" },
  { value: "image", label: "Imagem", icon: Image, color: "text-green-400" },
  { value: "video", label: "Vídeo", icon: Video, color: "text-purple-400" },
  { value: "audio", label: "Áudio", icon: Music, color: "text-pink-400" },
  { value: "document", label: "Documento", icon: FileUp, color: "text-orange-400" },
  { value: "delay", label: "Esperar", icon: Timer, color: "text-yellow-400" },
];

export default function AutomacaoPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [massMessages, setMassMessages] = useState<MassMessage[]>([]);
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMsg[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [leads, setLeads] = useState<{ id: string; name: string; phone: string; stage_id?: string; tag_ids?: string[] }[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [allTags, setAllTags] = useState<TagOption[]>([]);
  const [allStages, setAllStages] = useState<StageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { plan, limits } = useSubscription();
  const { user } = useAuth();
  const [monthlyDisparos, setMonthlyDisparos] = useState(0);

  // Flow editor
  const [showFlowEditor, setShowFlowEditor] = useState(false);
  const [editingFlow, setEditingFlow] = useState<Flow | null>(null);
  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([]);
  const [flowName, setFlowName] = useState("");
  const [flowDescription, setFlowDescription] = useState("");
  const [flowTriggerType, setFlowTriggerType] = useState<"manual" | "keyword" | "schedule">("manual");
  const [flowKeywords, setFlowKeywords] = useState("");
  const [savingFlow, setSavingFlow] = useState(false);

  // Mass message
  const [showAddMass, setShowAddMass] = useState(false);
  const [editingMassId, setEditingMassId] = useState<string | null>(null);
  const [newMass, setNewMass] = useState({ name: "", message: "", scheduled_at: "", instance_id: "", target_tags: [] as string[], target_stages: [] as string[] });
  const [savingMassMessage, setSavingMassMessage] = useState(false);
  const [showMassDetails, setShowMassDetails] = useState(false);
  const [selectedMassMessage, setSelectedMassMessage] = useState<MassMessage | null>(null);
  const [massMessageDeliveries, setMassMessageDeliveries] = useState<MassMessageDelivery[]>([]);
  const [loadingMassDetails, setLoadingMassDetails] = useState(false);
  const [reprocessingAllMass, setReprocessingAllMass] = useState(false);
  const [reprocessingDeliveryIds, setReprocessingDeliveryIds] = useState<string[]>([]);

  // Scheduled
  const [showAddScheduled, setShowAddScheduled] = useState(false);
  const [editingScheduledId, setEditingScheduledId] = useState<string | null>(null);
  const [scheduledLeadSearch, setScheduledLeadSearch] = useState("");
  const [newScheduled, setNewScheduled] = useState({
    lead_id: "",
    message: "",
    scheduled_at: "",
    instance_id: "",
    media_url: "",
    media_type: "",
    file_name: "",
  });
  const [savingScheduledMessage, setSavingScheduledMessage] = useState(false);
  const [showScheduledDetails, setShowScheduledDetails] = useState(false);
  const [selectedScheduledMessage, setSelectedScheduledMessage] = useState<ScheduledMsg | null>(null);
  const [scheduledMessageAttempts, setScheduledMessageAttempts] = useState<ScheduledMessageAttempt[]>([]);
  const [loadingScheduledDetails, setLoadingScheduledDetails] = useState(false);
  const [reprocessingScheduledIds, setReprocessingScheduledIds] = useState<string[]>([]);

  // Step media picker
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaPickerStepIndex, setMediaPickerStepIndex] = useState(-1);

  const getDefaultMassFormState = useCallback(() => ({
    name: "",
    message: "",
    scheduled_at: "",
    instance_id: instances[0]?.id || "",
    target_tags: [] as string[],
    target_stages: [] as string[],
  }), [instances]);

  const getDefaultScheduledFormState = useCallback(() => ({
    lead_id: "",
    message: "",
    scheduled_at: "",
    instance_id: instances[0]?.id || "",
    media_url: "",
    media_type: "",
    file_name: "",
  }), [instances]);

  const toDateTimeLocalValue = useCallback((value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const pad = (input: number) => String(input).padStart(2, "0");

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }, []);

  const toIsoDateTime = useCallback((value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const userId = user?.id;
      if (!userId) { setLoading(false); return; }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

      const [flowsRes, massRes, schedRes, instRes, leadsRes, mediaRes, templatesRes, tagsRes, stagesRes, massUsageRes, scheduledUsageRes] = await Promise.all([
        supabase.from("flows").select("*, flow_steps(*)").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("mass_messages").select("*").eq("user_id", userId).is("deleted_at", null).neq("status", "cancelled").order("created_at", { ascending: false }),
        supabase.from("scheduled_messages").select("*, leads(name)").eq("user_id", userId).is("deleted_at", null).neq("status", "cancelled").order("created_at", { ascending: false }),
        supabase.from("whatsapp_instances").select("id, instance_name").eq("user_id", userId).is("deleted_at", null),
        supabase.from("leads").select("id, name, phone, stage_id, lead_tags(tag_id)").eq("user_id", userId).eq("archived", false).is("deleted_at", null),
        supabase.from("media").select("id, file_name, file_type, file_url").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("message_templates").select("id, name, content").eq("user_id", userId).order("name"),
        supabase.from("tags").select("id, name, color").eq("user_id", userId),
        supabase.from("funnel_stages").select("id, name, color").eq("user_id", userId),
        supabase
          .from("mass_message_deliveries")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "sent")
          .gte("sent_at", monthStart)
          .lt("sent_at", nextMonthStart),
        supabase
          .from("scheduled_messages")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "sent")
          .is("deleted_at", null)
          .gte("sent_at", monthStart)
          .lt("sent_at", nextMonthStart),
      ]);
      if (flowsRes.data) {
        setFlows(flowsRes.data.map((f: any) => ({
          ...f,
          steps: (f.flow_steps || []).sort((a: FlowStep, b: FlowStep) => a.step_order - b.step_order),
        })));
      }
      if (massRes.data) {
        setMassMessages(massRes.data);
      }
      setMonthlyDisparos((massUsageRes.count || 0) + (scheduledUsageRes.count || 0));
      if (schedRes.data) setScheduledMessages(schedRes.data.map((s: any) => ({ ...s, lead_name: s.leads?.name })));
      if (instRes.data) {
        setInstances(instRes.data);
        if (instRes.data.length > 0) {
          if (!newMass.instance_id) setNewMass((prev) => ({ ...prev, instance_id: instRes.data[0].id }));
          if (!newScheduled.instance_id) setNewScheduled((prev) => ({ ...prev, instance_id: instRes.data[0].id }));
        }
      }
      if (leadsRes.data) setLeads(leadsRes.data.map((l: any) => ({ ...l, tag_ids: l.lead_tags?.map((lt: any) => lt.tag_id) || [] })));
      if (mediaRes.data) setMediaItems(mediaRes.data);
      if (templatesRes.data) setTemplates(templatesRes.data);
      if (tagsRes.data) setAllTags(tagsRes.data);
      if (stagesRes.data) setAllStages(stagesRes.data);
    } catch { /* */ } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!showAddMass || editingMassId || newMass.instance_id || !instances[0]?.id) return;
    setNewMass((prev) => ({ ...prev, instance_id: instances[0].id }));
  }, [showAddMass, editingMassId, newMass.instance_id, instances]);

  useEffect(() => {
    if (!selectedMassMessage) return;
    const updatedMassMessage = massMessages.find((massMessage) => massMessage.id === selectedMassMessage.id);
    if (!updatedMassMessage) {
      setSelectedMassMessage(null);
      setMassMessageDeliveries([]);
      setShowMassDetails(false);
      return;
    }
    setSelectedMassMessage(updatedMassMessage);
  }, [massMessages, selectedMassMessage]);

  useEffect(() => {
    if (!showAddScheduled || editingScheduledId || newScheduled.instance_id || !instances[0]?.id) return;
    setNewScheduled((prev) => ({ ...prev, instance_id: instances[0].id }));
  }, [showAddScheduled, editingScheduledId, newScheduled.instance_id, instances]);

  useEffect(() => {
    if (!selectedScheduledMessage) return;
    const updatedScheduledMessage = scheduledMessages.find((scheduledMessage) => scheduledMessage.id === selectedScheduledMessage.id);
    if (!updatedScheduledMessage) {
      setSelectedScheduledMessage(null);
      setScheduledMessageAttempts([]);
      setShowScheduledDetails(false);
      return;
    }
    setSelectedScheduledMessage(updatedScheduledMessage);
  }, [scheduledMessages, selectedScheduledMessage]);

  // ===== FLOW EDITOR =====
  const openFlowEditor = (flow?: Flow) => {
    if (flow) {
      setEditingFlow(flow);
      setFlowName(flow.name);
      setFlowDescription(flow.description || "");
      setFlowTriggerType(flow.trigger_type);
      setFlowKeywords(flow.keywords?.join(", ") || "");
      setFlowSteps(flow.steps || []);
    } else {
      setEditingFlow(null);
      setFlowName("");
      setFlowDescription("");
      setFlowTriggerType("manual");
      setFlowKeywords("");
      setFlowSteps([]);
    }
    setShowFlowEditor(true);
  };

  const closeFlowEditor = () => { setShowFlowEditor(false); setEditingFlow(null); setFlowName(""); setFlowSteps([]); };

  const addStep = (type: string) => {
    const newStep: FlowStep = {
      id: `temp-${Date.now()}-${Math.random()}`,
      flow_id: editingFlow?.id || "",
      step_order: flowSteps.length,
      step_type: type as FlowStep["step_type"],
      content: "",
      media_url: "",
      file_name: "",
      delay_seconds: type === "delay" ? 5 : 0,
    };
    setFlowSteps([...flowSteps, newStep]);
  };

  const updateStep = (index: number, updates: Partial<FlowStep>) => {
    setFlowSteps(flowSteps.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const removeStep = (index: number) => {
    setFlowSteps(flowSteps.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= flowSteps.length) return;
    const arr = [...flowSteps];
    [arr[index], arr[target]] = [arr[target], arr[index]];
    setFlowSteps(arr);
  };

  const saveFlow = async () => {
    if (!flowName.trim() || flowSteps.length === 0) {
      toast("Preencha o nome do fluxo e adicione pelo menos um passo.", "warning");
      return;
    }
    setSavingFlow(true);
    try {
      if (!user) return;

      const flowPayload = {
        name: flowName,
        description: flowDescription,
        trigger_type: flowTriggerType,
        keywords: flowKeywords.split(",").map((k) => k.trim()).filter(Boolean),
        is_active: true,
      };

      let flowId = editingFlow?.id;

      if (flowId) {
        await supabase.from("flows").update(flowPayload).eq("id", flowId);
        await supabase.from("flow_steps").delete().eq("flow_id", flowId);
      } else {
        const { data, error } = await supabase.from("flows").insert({
          user_id: user.id, ...flowPayload,
        }).select().single();
        if (error || !data) { toast("Erro ao criar fluxo.", "error"); return; }
        flowId = data.id;
      }

      const stepsPayload = flowSteps.map((s, i) => ({
        flow_id: flowId,
        step_order: i,
        step_type: s.step_type,
        content: s.content || "",
        media_url: s.media_url || "",
        file_name: s.file_name || "",
        delay_seconds: s.delay_seconds || 0,
      }));

      const { data: stepsData } = await supabase.from("flow_steps").insert(stepsPayload).select();

      const updatedFlow: Flow = {
        ...(editingFlow || { id: flowId!, created_at: new Date().toISOString() }),
        ...flowPayload,
        steps: stepsData || [],
      };

      setFlows((prev) => {
        const exists = prev.find((f) => f.id === flowId);
        if (exists) return prev.map((f) => f.id === flowId ? updatedFlow : f);
        return [updatedFlow, ...prev];
      });

      closeFlowEditor();
    } catch (err) {
      console.error("Error saving flow:", err);
    } finally {
      setSavingFlow(false);
    }
  };

  const deleteFlow = async (id: string) => {
    await supabase.from("flow_steps").delete().eq("flow_id", id);
    await supabase.from("flows").delete().eq("id", id);
    setFlows((prev) => prev.filter((f) => f.id !== id));
  };

  const toggleFlow = async (id: string, isActive: boolean) => {
    await supabase.from("flows").update({ is_active: !isActive }).eq("id", id);
    setFlows((prev) => prev.map((f) => f.id === id ? { ...f, is_active: !isActive } : f));
  };

  // ===== MASS MESSAGES =====
  const openEditMass = (m: MassMessage) => {
    setEditingMassId(m.id);
    const schedAt = toDateTimeLocalValue(m.scheduled_at);
    setNewMass({ name: m.name, message: m.message, scheduled_at: schedAt, instance_id: m.instance_id || instances[0]?.id || "", target_tags: m.target_tags || [], target_stages: m.target_stages || [] });
    setShowAddMass(true);
  };

  const closeMassDetails = () => {
    setShowMassDetails(false);
    setSelectedMassMessage(null);
    setMassMessageDeliveries([]);
  };

  const loadMassMessageDeliveries = async (massMessageId: string) => {
    setLoadingMassDetails(true);
    try {
      const { data, error } = await supabase
        .from("mass_message_deliveries")
        .select("id, mass_message_id, lead_id, lead_name, lead_phone, normalized_phone, status, attempt_count, last_attempt_at, sent_at, failure_reason, created_at")
        .eq("mass_message_id", massMessageId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setMassMessageDeliveries(data || []);
    } catch (error) {
      console.error("Error loading mass message deliveries:", error);
      toast("Nao foi possivel carregar os logs deste disparo.", "error");
    } finally {
      setLoadingMassDetails(false);
    }
  };

  const openMassDetails = async (massMessage: MassMessage) => {
    setSelectedMassMessage(massMessage);
    setShowMassDetails(true);
    await loadMassMessageDeliveries(massMessage.id);
  };

  const getMassMessageCounters = (deliveries: MassMessageDelivery[]) => ({
    sentCount: deliveries.filter((delivery) => delivery.status === "sent").length,
    failedCount: deliveries.filter((delivery) => delivery.status === "failed").length,
    totalCount: deliveries.length,
  });

  const syncMassMessageAfterReprocess = async (massMessage: MassMessage, nextDeliveries: MassMessageDelivery[]) => {
    const counters = getMassMessageCounters(nextDeliveries);
    const updatePayload = {
      status: "scheduled",
      sent_count: counters.sentCount,
      failed_count: counters.failedCount,
      total_count: counters.totalCount,
      last_error: null,
      started_at: null,
      completed_at: null,
      scheduled_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("mass_messages")
      .update(updatePayload)
      .eq("id", massMessage.id);

    if (error) throw error;

    setMassMessages((prev) => prev.map((item) => item.id === massMessage.id ? { ...item, ...updatePayload } : item));
    setSelectedMassMessage((prev) => prev && prev.id === massMessage.id ? { ...prev, ...updatePayload } : prev);
  };

  const reprocessMassDeliveries = async (deliveryIds?: string[]) => {
    if (!selectedMassMessage) return;

    const idsToReprocess = deliveryIds || massMessageDeliveries
      .filter((delivery) => delivery.status === "failed")
      .map((delivery) => delivery.id);

    if (idsToReprocess.length === 0) {
      toast("Nao ha falhas pendentes de reprocessamento.", "warning");
      return;
    }

    if (deliveryIds) setReprocessingDeliveryIds((prev) => [...prev, ...idsToReprocess]);
    else setReprocessingAllMass(true);

    try {
      const { error: deliveriesError } = await supabase
        .from("mass_message_deliveries")
        .update({
          status: "pending",
          failure_reason: null,
          last_attempt_at: null,
          sent_at: null,
          provider_response: {},
        })
        .in("id", idsToReprocess);

      if (deliveriesError) throw deliveriesError;

      const nextDeliveries = massMessageDeliveries.map((delivery) => (
        idsToReprocess.includes(delivery.id)
          ? { ...delivery, status: "pending", failure_reason: null, last_attempt_at: null, sent_at: null }
          : delivery
      ));

      setMassMessageDeliveries(nextDeliveries);
      await syncMassMessageAfterReprocess(selectedMassMessage, nextDeliveries);

      toast(
        idsToReprocess.length === 1
          ? "Contato reenfileirado para novo disparo."
          : `${idsToReprocess.length} contatos reenfileirados para novo disparo.`,
        "success",
      );
    } catch (error) {
      console.error("Error reprocessing mass deliveries:", error);
      toast("Nao foi possivel reenfileirar as falhas deste disparo.", "error");
    } finally {
      if (deliveryIds) setReprocessingDeliveryIds((prev) => prev.filter((id) => !idsToReprocess.includes(id)));
      else setReprocessingAllMass(false);
    }
  };

  const deleteMassMessage = async (id: string) => {
    await supabase.from("mass_messages").update({ status: "cancelled", deleted_at: new Date().toISOString() }).eq("id", id);
    setMassMessages((prev) => prev.filter((m) => m.id !== id));
    if (selectedMassMessage?.id === id) closeMassDetails();
  };

  const handleAddMassMessage = async () => {
    if (savingMassMessage) return;

    const resolvedInstanceId = newMass.instance_id || instances[0]?.id || "";
    const trimmedName = newMass.name.trim();
    const trimmedMessage = newMass.message.trim();

    if (!trimmedName || !trimmedMessage || !resolvedInstanceId) {
      if (!trimmedName) { toast("Nome da campanha é obrigatório.", "warning"); return; }
      if (!trimmedMessage) { toast("Mensagem é obrigatória.", "warning"); return; }
      if (!resolvedInstanceId) { toast("Selecione um WhatsApp para o disparo.", "warning"); return; }
      if (!newMass.name) toast("Nome da campanha é obrigatório.", "warning");
      else if (!newMass.message) toast("Mensagem é obrigatória.", "warning");
      else if (!newMass.instance_id) toast("Selecione um WhatsApp para o disparo.", "warning");
      return;
    }
    const parsedScheduledAt = toIsoDateTime(newMass.scheduled_at);
    if (newMass.scheduled_at && !parsedScheduledAt) {
      toast("Selecione uma data e hora válidas para o disparo.", "warning");
      return;
    }
    const newStatus = parsedScheduledAt ? "scheduled" : "draft";
    const payload = { name: trimmedName, message: trimmedMessage, scheduled_at: parsedScheduledAt, instance_id: resolvedInstanceId, target_tags: newMass.target_tags, target_stages: newMass.target_stages };
    setSavingMassMessage(true);
    try {
    if (editingMassId) {
      const { error } = await supabase.from("mass_messages").update({ ...payload, status: newStatus }).eq("id", editingMassId);
      if (!error) { setMassMessages((prev) => prev.map((m) => m.id === editingMassId ? { ...m, ...payload, status: newStatus } : m)); toast("Disparo atualizado!", "success"); }
      setEditingMassId(null);
    } else {
      if (!user) return;
      const { data, error } = await supabase.from("mass_messages").insert({
        user_id: user.id, ...payload,
        status: parsedScheduledAt ? "scheduled" : "draft", sent_count: 0, failed_count: 0, total_count: 0,
      }).select().single();
      if (!error && data) { setMassMessages((prev) => [data, ...prev]); toast("Disparo criado!", "success"); }
    }
    setNewMass(getDefaultMassFormState());
    setShowAddMass(false);
    } finally {
      setSavingMassMessage(false);
    }
  };

  const closeScheduledDetails = () => {
    setShowScheduledDetails(false);
    setSelectedScheduledMessage(null);
    setScheduledMessageAttempts([]);
  };

  const loadScheduledMessageAttempts = async (scheduledMessageId: string) => {
    setLoadingScheduledDetails(true);
    try {
      const { data, error } = await supabase
        .from("scheduled_message_attempts")
        .select("id, scheduled_message_id, attempt_number, target_phone, normalized_phone, lead_name, instance_name, status, attempted_at, completed_at, failure_reason, created_at")
        .eq("scheduled_message_id", scheduledMessageId)
        .order("attempt_number", { ascending: false });

      if (error) throw error;

      setScheduledMessageAttempts(data || []);
    } catch (error) {
      console.error("Error loading scheduled message attempts:", error);
      toast("Nao foi possivel carregar o historico deste agendamento.", "error");
    } finally {
      setLoadingScheduledDetails(false);
    }
  };

  const openScheduledDetails = async (scheduledMessage: ScheduledMsg) => {
    setSelectedScheduledMessage(scheduledMessage);
    setShowScheduledDetails(true);
    await loadScheduledMessageAttempts(scheduledMessage.id);
  };

  const reprocessScheduledMessages = async (scheduledMessageIds?: string[]) => {
    const idsToReprocess = scheduledMessageIds || (selectedScheduledMessage?.status === "failed" ? [selectedScheduledMessage.id] : []);

    if (idsToReprocess.length === 0) {
      toast("Nao ha agendamentos falhos para reenfileirar.", "warning");
      return;
    }

    setReprocessingScheduledIds((prev) => Array.from(new Set([...prev, ...idsToReprocess])));

    const reprocessAt = new Date().toISOString();

    try {
      const { error } = await supabase
        .from("scheduled_messages")
        .update({
          status: "pending",
          scheduled_at: reprocessAt,
          claimed_at: null,
          failure_reason: null,
          provider_response: {},
          sent_at: null,
        })
        .in("id", idsToReprocess);

      if (error) throw error;

      setScheduledMessages((prev) => prev.map((item) => (
        idsToReprocess.includes(item.id)
          ? {
            ...item,
            status: "pending",
            scheduled_at: reprocessAt,
            claimed_at: null,
            failure_reason: null,
            provider_response: {},
            sent_at: null,
          }
          : item
      )));

      toast(
        idsToReprocess.length === 1
          ? "Agendamento reenfileirado para novo envio."
          : `${idsToReprocess.length} agendamentos reenfileirados para novo envio.`,
        "success",
      );

      if (selectedScheduledMessage && idsToReprocess.includes(selectedScheduledMessage.id)) {
        await loadScheduledMessageAttempts(selectedScheduledMessage.id);
      }
    } catch (error) {
      console.error("Error reprocessing scheduled messages:", error);
      toast("Nao foi possivel reenfileirar este agendamento.", "error");
    } finally {
      setReprocessingScheduledIds((prev) => prev.filter((id) => !idsToReprocess.includes(id)));
    }
  };

  // ===== SCHEDULED =====
  const openEditScheduled = (sm: ScheduledMsg) => {
    setEditingScheduledId(sm.id);
    const schedAt = toDateTimeLocalValue(sm.scheduled_at);
    setNewScheduled({
      lead_id: sm.lead_id || "",
      message: sm.message,
      scheduled_at: schedAt,
      instance_id: sm.instance_id || instances[0]?.id || "",
      media_url: sm.media_url || "",
      media_type: sm.media_type || "",
      file_name: sm.file_name || "",
    });
    setShowAddScheduled(true);
  };

  const deleteScheduledMessage = async (id: string) => {
    await supabase.from("scheduled_messages").update({ status: "cancelled", deleted_at: new Date().toISOString() }).eq("id", id);
    setScheduledMessages((prev) => prev.filter((s) => s.id !== id));
    if (selectedScheduledMessage?.id === id) closeScheduledDetails();
  };

  const handleAddScheduled = async () => {
    if (savingScheduledMessage) return;
    if (!editingScheduledId && usageLimitReached) {
      toast(`Limite de ${limits.max_mass_messages_per_month.toLocaleString("pt-BR")} disparos/mês atingido. Faça upgrade do plano.`, "warning");
      return;
    }

    const trimmedMessage = newScheduled.message.trim();
    const resolvedInstanceId = newScheduled.instance_id || instances[0]?.id || "";
    const parsedScheduledAt = toIsoDateTime(newScheduled.scheduled_at);
    const hasMediaAttachment = Boolean(newScheduled.media_url && newScheduled.media_type);

    if ((!trimmedMessage && !hasMediaAttachment) || !parsedScheduledAt || (!newScheduled.lead_id && !editingScheduledId)) {
      if (!trimmedMessage && !hasMediaAttachment) toast("Preencha a mensagem ou anexe uma mídia.", "warning");
      else if (!parsedScheduledAt) toast("Selecione uma data e hora válidas para o agendamento.", "warning");
      else toast("Selecione um lead para o agendamento.", "warning");
      return;
    }

    if (!resolvedInstanceId) {
      toast("Selecione um WhatsApp.", "warning");
      return;
    }

    const payload = {
      message: trimmedMessage,
      scheduled_at: parsedScheduledAt,
      instance_id: resolvedInstanceId,
      media_url: newScheduled.media_url || null,
      media_type: newScheduled.media_type || null,
      file_name: newScheduled.file_name || null,
      status: "pending",
      claimed_at: null,
      sent_at: null,
      failure_reason: null,
      provider_response: {},
    };

    setSavingScheduledMessage(true);
    try {
      if (editingScheduledId) {
        const { error } = await supabase
          .from("scheduled_messages")
          .update(payload)
          .eq("id", editingScheduledId);

        if (!error) {
          setScheduledMessages((prev) => prev.map((s) => s.id === editingScheduledId ? { ...s, ...payload } : s));
          toast("Agendamento atualizado!", "success");
        }
        setEditingScheduledId(null);
      } else {
        if (!newScheduled.lead_id || !user) return;
        const { data, error } = await supabase
          .from("scheduled_messages")
          .insert({
            user_id: user.id,
            lead_id: newScheduled.lead_id,
            instance_id: resolvedInstanceId,
            message: trimmedMessage,
            scheduled_at: parsedScheduledAt,
            media_url: newScheduled.media_url || null,
            media_type: newScheduled.media_type || null,
            file_name: newScheduled.file_name || null,
            status: "pending",
          })
          .select("*, leads(name)")
          .single();

        if (!error && data) {
          setScheduledMessages((prev) => [{ ...data, lead_name: (data as any).leads?.name }, ...prev]);
          toast("Mensagem agendada!", "success");
        }
      }

      setNewScheduled(getDefaultScheduledFormState());
      setShowAddScheduled(false);
    } finally {
      setSavingScheduledMessage(false);
    }
  };

  // ===== HELPERS =====
  const statusColors: Record<string, string> = { draft: "outline", scheduled: "warning", sending: "default", completed: "success", failed: "destructive", pending: "warning", processing: "default", sent: "success", cancelled: "outline" };
  const statusLabels: Record<string, string> = { draft: "Rascunho", scheduled: "Agendado", sending: "Enviando", completed: "Concluído", failed: "Falhou", pending: "Pendente", sent: "Enviado", cancelled: "Cancelado" };

  const extendedStatusColors: Record<string, string> = { completed_with_errors: "warning", skipped: "outline" };
  const extendedStatusLabels: Record<string, string> = { completed_with_errors: "Concluido com falhas", skipped: "Ignorado" };
  statusLabels.processing = "Processando";
  const getStatusColor = (status: string) => extendedStatusColors[status] || statusColors[status] || "outline";
  const getStatusLabel = (status: string) => extendedStatusLabels[status] || statusLabels[status] || status;
  const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "-";
  const usageLimitReached = monthlyDisparos >= limits.max_mass_messages_per_month && limits.max_mass_messages_per_month !== Infinity;
  const usageProgress = limits.max_mass_messages_per_month === Infinity
    ? 0
    : Math.min(100, (monthlyDisparos / limits.max_mass_messages_per_month) * 100);
  const scheduledSupportedMedia = mediaItems.filter((item) => ["image", "video", "document"].includes(item.file_type));
  const selectedScheduledMediaId = scheduledSupportedMedia.find((item) => item.file_url === newScheduled.media_url)?.id || "none";
  const selectedScheduledLead = newScheduled.lead_id ? leads.find((lead) => lead.id === newScheduled.lead_id) : null;
  const normalizedScheduledLeadSearch = scheduledLeadSearch.trim().toLowerCase();
  const filteredScheduledLeads = leads.filter((lead) => {
    if (!normalizedScheduledLeadSearch) return true;
    const leadLabel = `${lead.name} - ${lead.phone}`.toLowerCase();
    return lead.name.toLowerCase().includes(normalizedScheduledLeadSearch)
      || lead.phone.toLowerCase().includes(normalizedScheduledLeadSearch)
      || leadLabel.includes(normalizedScheduledLeadSearch);
  }).slice(0, 30);
  const selectedScheduledMedia = newScheduled.media_url
    ? scheduledSupportedMedia.find((item) => item.file_url === newScheduled.media_url)
      || {
        id: "selected",
        file_name: newScheduled.file_name || "arquivo",
        file_type: newScheduled.media_type || "document",
        file_url: newScheduled.media_url,
      }
    : null;
  const scheduledDateParts = newScheduled.scheduled_at
    ? (() => {
      const [datePart, timePart = ""] = newScheduled.scheduled_at.split("T");
      const date = new Date(newScheduled.scheduled_at);
      if (Number.isNaN(date.getTime())) {
        return {
          dateLabel: datePart || "Data inválida",
          timeLabel: timePart || "--:--",
        };
      }
      return {
        dateLabel: date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "long" }),
        timeLabel: timePart || date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      };
    })()
    : null;

  const renderScheduledMediaThumb = (
    media: { file_type?: string | null; file_url?: string | null; file_name?: string | null },
    mode: "picker" | "preview" = "picker",
  ) => {
    const frameClass = mode === "preview"
      ? "overflow-hidden rounded-2xl bg-black/10"
      : "overflow-hidden rounded-xl bg-muted";

    if (media.file_type === "image" && media.file_url) {
      return (
        <div className={frameClass}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media.file_url}
            alt={media.file_name || "Imagem"}
            className={cn("w-full object-cover", mode === "preview" ? "max-h-64" : "aspect-square")}
            loading="lazy"
          />
        </div>
      );
    }

    if (media.file_type === "video" && media.file_url) {
      return (
        <div className={frameClass}>
          <video
            src={media.file_url}
            className={cn("w-full object-cover", mode === "preview" ? "max-h-64" : "aspect-square")}
            preload="metadata"
            muted
          />
        </div>
      );
    }

    const Icon = media.file_type === "video" ? Video : media.file_type === "image" ? Image : FileUp;

    return (
      <div className={cn(
        "flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/60",
        mode === "preview" ? "h-32" : "aspect-square",
      )}>
        <div className="text-center space-y-2 px-3">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-background/80">
            <Icon className={cn(
              "h-5 w-5",
              media.file_type === "video" ? "text-blue-400" : media.file_type === "image" ? "text-green-400" : "text-orange-400",
            )} />
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{media.file_name || "Arquivo"}</p>
        </div>
      </div>
    );
  };

  const getStepIcon = (type: string) => {
    const found = STEP_TYPES.find((t) => t.value === type);
    if (!found) return <MessageSquare className="h-4 w-4" />;
    const Icon = found.icon;
    return <Icon className={cn("h-4 w-4", found.color)} />;
  };

  const getStepLabel = (type: string) => STEP_TYPES.find((t) => t.value === type)?.label || type;

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  // ===== FLOW EDITOR VIEW =====
  if (showFlowEditor) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={closeFlowEditor}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-2xl font-bold">{editingFlow ? "Editar Fluxo" : "Novo Fluxo"}</h1>
            <p className="text-muted-foreground">Monte a sequência de mensagens do seu fluxo</p>
          </div>
        </div>

        {/* Flow Settings */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do fluxo *</Label>
                <Input placeholder="Ex: Boas-vindas" value={flowName} onChange={(e) => setFlowName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tipo de gatilho</Label>
                <Select value={flowTriggerType} onValueChange={(v: any) => setFlowTriggerType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual (via chat)</SelectItem>
                    <SelectItem value="keyword">Palavra-chave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input placeholder="Descrição do fluxo (opcional)" value={flowDescription} onChange={(e) => setFlowDescription(e.target.value)} />
            </div>
            {flowTriggerType === "keyword" && (
              <div className="space-y-2">
                <Label>Palavras-chave (separadas por vírgula)</Label>
                <Input placeholder="oi, olá, bom dia" value={flowKeywords} onChange={(e) => setFlowKeywords(e.target.value)} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Steps - Visual Builder */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Passos do Fluxo</h2>
            <span className="text-sm text-muted-foreground">{flowSteps.length} passo{flowSteps.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Add Step Buttons */}
          <div className="flex flex-wrap gap-2">
            {STEP_TYPES.map((st) => {
              const Icon = st.icon;
              return (
                <Button key={st.value} variant="outline" size="sm" onClick={() => addStep(st.value)}>
                  <Icon className={cn("h-4 w-4 mr-1.5", st.color)} /> {st.label}
                </Button>
              );
            })}
          </div>

          {/* Steps List */}
          <div className="space-y-3">
            {flowSteps.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground border-dashed">
                <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum passo adicionado</p>
                <p className="text-sm mt-1">Clique nos botões acima para montar o fluxo</p>
              </Card>
            ) : (
              flowSteps.map((step, i) => (
                <Card key={step.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Step number & icon */}
                      <div className="flex flex-col items-center gap-1 pt-1">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {i + 1}
                        </div>
                        {i < flowSteps.length - 1 && <div className="w-0.5 h-6 bg-border" />}
                      </div>

                      {/* Step content */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          {getStepIcon(step.step_type)}
                          <span className="font-medium text-sm">{getStepLabel(step.step_type)}</span>
                        </div>

                        {step.step_type === "text" && (
                          <Textarea placeholder="Digite o texto da mensagem..." value={step.content}
                            onChange={(e) => updateStep(i, { content: e.target.value })}
                            className="min-h-[80px] text-sm" />
                        )}

                        {["image", "video", "audio", "document"].includes(step.step_type) && (
                          <div className="space-y-2">
                            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => { setMediaPickerStepIndex(i); setShowMediaPicker(true); }}>
                              {step.media_url ? (
                                <span className="flex items-center gap-2 truncate">
                                  {step.step_type === "image" && step.media_url ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={step.media_url} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
                                  ) : (
                                    <FileUp className="h-4 w-4 shrink-0" />
                                  )}
                                  <span className="truncate text-xs">{step.file_name || "Arquivo selecionado"}</span>
                                </span>
                              ) : (
                                <span className="flex items-center gap-2 text-muted-foreground">
                                  <FileUp className="h-4 w-4" /> Selecionar da biblioteca
                                </span>
                              )}
                            </Button>
                            {step.step_type === "image" && step.media_url && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={step.media_url} alt="" className="h-24 w-auto rounded-md object-cover" />
                            )}
                            {step.step_type !== "audio" && (
                              <Input placeholder="Legenda (opcional)" value={step.content}
                                onChange={(e) => updateStep(i, { content: e.target.value })} />
                            )}
                          </div>
                        )}

                        {step.step_type === "delay" && (
                          <div className="flex items-center gap-2">
                            <Label className="text-xs shrink-0">Esperar</Label>
                            <Input type="number" min={1} className="w-24" value={step.delay_seconds}
                              onChange={(e) => updateStep(i, { delay_seconds: parseInt(e.target.value) || 0 })} />
                            <span className="text-xs text-muted-foreground">segundos</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStep(i, -1)} disabled={i === 0}>
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStep(i, 1)} disabled={i === flowSteps.length - 1}>
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeStep(i)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Save Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={closeFlowEditor}>Cancelar</Button>
          <Button onClick={saveFlow} disabled={savingFlow}>
            {savingFlow && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editingFlow ? "Salvar Fluxo" : "Criar Fluxo"}
          </Button>
        </div>

        {/* Media Picker Dialog */}
        <Dialog open={showMediaPicker} onOpenChange={setShowMediaPicker}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Selecionar Mídia</DialogTitle>
              <DialogDescription>Escolha um arquivo da sua biblioteca</DialogDescription>
            </DialogHeader>
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {mediaItems.filter((m) => {
                const stepType = flowSteps[mediaPickerStepIndex]?.step_type;
                if (stepType === "image") return m.file_type === "image";
                if (stepType === "video") return m.file_type === "video";
                if (stepType === "audio") return m.file_type === "audio";
                if (stepType === "document") return m.file_type === "document";
                return true;
              }).map((item) => (
                <button key={item.id} onClick={() => {
                  updateStep(mediaPickerStepIndex, { media_url: item.file_url, file_name: item.file_name });
                  setShowMediaPicker(false);
                }} className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/40 transition-colors text-left">
                  {item.file_type === "image" && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.file_url} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.file_name}</p>
                    <p className="text-xs text-muted-foreground">{item.file_type}</p>
                  </div>
                </button>
              ))}
              {mediaItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma mídia. Faça upload em Mídia.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ===== MAIN VIEW =====
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Automação</h1>
        <p className="text-muted-foreground">Gerencie fluxos, disparos e mensagens agendadas</p>
      </div>

      <Tabs defaultValue="flows" className="space-y-4">
        <TabsList>
          <TabsTrigger value="flows" className="gap-2"><Zap className="h-4 w-4" /> Fluxos</TabsTrigger>
          <TabsTrigger value="mass" className="gap-2">
            <Megaphone className="h-4 w-4" /> Disparos em Massa
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="gap-2"><CalendarClock className="h-4 w-4" /> Agendamentos</TabsTrigger>
        </TabsList>

        {/* Flows Tab */}
        <TabsContent value="flows" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openFlowEditor()}><Plus className="h-4 w-4 mr-2" /> Novo Fluxo</Button>
          </div>
          <div className="grid gap-3">
            {flows.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum fluxo configurado</p>
                <p className="text-sm mt-1">Crie um fluxo com sequência de mensagens</p>
              </Card>
            ) : (
              flows.map((flow) => (
                <Card key={flow.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={cn("p-2 rounded-lg", flow.is_active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
                          <Zap className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{flow.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px]">
                              {flow.trigger_type === "manual" ? "Manual" : flow.trigger_type === "keyword" ? "Palavra-chave" : "Agendado"}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {flow.steps?.length || 0} passo{(flow.steps?.length || 0) !== 1 ? "s" : ""}
                            </span>
                            {flow.keywords?.length > 0 && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                                {flow.keywords.join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch checked={flow.is_active} onCheckedChange={() => toggleFlow(flow.id, flow.is_active)} />
                        <Button variant="ghost" size="icon" onClick={() => openFlowEditor(flow)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteFlow(flow.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {/* Steps preview */}
                    {flow.steps && flow.steps.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-3 pl-11 overflow-x-auto">
                        {flow.steps.map((s, si) => (
                          <React.Fragment key={s.id}>
                            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-[10px] shrink-0">
                              {getStepIcon(s.step_type)}
                              <span>{getStepLabel(s.step_type)}</span>
                            </div>
                            {si < flow.steps!.length - 1 && <span className="text-muted-foreground text-[10px]">→</span>}
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Mass Messages Tab */}
        <TabsContent value="mass" className="space-y-4">
          {/* Disparo Usage Bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Disparos este mês</span>
                <span className={cn("font-mono font-semibold", usageLimitReached ? "text-destructive" : "text-foreground")}>
                  {monthlyDisparos.toLocaleString("pt-BR")} / {limits.max_mass_messages_per_month === Infinity ? "Ilimitado" : limits.max_mass_messages_per_month.toLocaleString("pt-BR")}
                </span>
              </div>
              {limits.max_mass_messages_per_month !== Infinity && (
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", usageLimitReached ? "bg-destructive" : "bg-primary")}
                    style={{ width: `${usageProgress}%` }}
                  />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {usageLimitReached && (
                <Link href="/assinatura">
                  <Button variant="outline" size="sm" className="text-xs">Fazer upgrade</Button>
                </Link>
              )}
              <Button
                onClick={() => {
                  if (usageLimitReached) {
                    toast(`Limite de ${limits.max_mass_messages_per_month.toLocaleString("pt-BR")} disparos/mês atingido. Faça upgrade do plano.`, "warning");
                    return;
                  }
                  setShowAddMass(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" /> Novo Disparo
              </Button>
            </div>
          </div>
          <div className="grid gap-3">
            {massMessages.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum disparo em massa configurado</p>
              </Card>
            ) : (
              massMessages.map((mm) => (
                <Card key={mm.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <p className="font-medium text-sm">{mm.name}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{mm.message}</p>
                        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                          <span>{mm.sent_count || 0} enviados</span>
                          <span>{mm.failed_count || 0} falhas</span>
                          <span>{mm.total_count || 0} contatos</span>
                          {mm.scheduled_at && <span>Agendado: {formatDateTime(mm.scheduled_at)}</span>}
                          {mm.completed_at && <span>Ultima execucao: {formatDateTime(mm.completed_at)}</span>}
                        </div>
                        {mm.last_error && (
                          <p className="text-xs text-destructive">
                            Ultimo erro: {mm.last_error}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 self-end md:self-start">
                        <Badge variant={getStatusColor(mm.status) as any}>{getStatusLabel(mm.status)}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(mm.created_at).toLocaleDateString("pt-BR")}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openMassDetails(mm)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditMass(mm)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMassMessage(mm.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Scheduled Messages Tab */}
        <TabsContent value="scheduled" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Disparos este mês</span>
                <span className={cn("font-mono font-semibold", usageLimitReached ? "text-destructive" : "text-foreground")}>
                  {monthlyDisparos.toLocaleString("pt-BR")} / {limits.max_mass_messages_per_month === Infinity ? "Ilimitado" : limits.max_mass_messages_per_month.toLocaleString("pt-BR")}
                </span>
              </div>
              {limits.max_mass_messages_per_month !== Infinity && (
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", usageLimitReached ? "bg-destructive" : "bg-primary")}
                    style={{ width: `${usageProgress}%` }}
                  />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {usageLimitReached && (
                <Link href="/assinatura">
                  <Button variant="outline" size="sm" className="text-xs">Fazer upgrade</Button>
                </Link>
              )}
              <Button
                onClick={() => {
                  if (usageLimitReached) {
                    toast(`Limite de ${limits.max_mass_messages_per_month.toLocaleString("pt-BR")} disparos/mês atingido. Faça upgrade do plano.`, "warning");
                    return;
                  }
                  setShowAddScheduled(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" /> Agendar Mensagem
              </Button>
            </div>
          </div>
          <div className="grid gap-3">
            {scheduledMessages.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <CalendarClock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma mensagem agendada</p>
              </Card>
            ) : (
              scheduledMessages.map((sm) => (
                <Card key={sm.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <p className="font-medium text-sm">{sm.lead_name || "Lead"}</p>
                        {sm.message && (
                          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line line-clamp-3">{sm.message}</p>
                        )}
                        {sm.media_url && (
                          <p className="text-[11px] text-muted-foreground">
                            Mídia anexada: {sm.file_name || sm.media_type || "arquivo"}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(sm.scheduled_at)}
                          </span>
                          <span>Tentativas: {sm.attempt_count || 0}</span>
                          <span>Ultima tentativa: {formatDateTime(sm.last_attempt_at)}</span>
                          <span>Enviado em: {formatDateTime(sm.sent_at)}</span>
                        </div>
                        {sm.failure_reason && (
                          <p className="text-xs text-destructive">Falha: {sm.failure_reason}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 self-end md:self-start">
                        <Badge variant={getStatusColor(sm.status) as any}>{getStatusLabel(sm.status)}</Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openScheduledDetails(sm)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {sm.status === "failed" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => reprocessScheduledMessages([sm.id])}
                            disabled={reprocessingScheduledIds.includes(sm.id)}
                          >
                            {reprocessingScheduledIds.includes(sm.id)
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <RefreshCcw className="h-3.5 w-3.5" />}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditScheduled(sm)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteScheduledMessage(sm.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
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

      {/* Mass Message Dialog */}
      <Dialog open={showAddMass} onOpenChange={(open) => { setShowAddMass(open); if (!open) { setEditingMassId(null); setNewMass(getDefaultMassFormState()); setSavingMassMessage(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMassId ? "Editar Disparo" : "Novo Disparo em Massa"}</DialogTitle>
            <DialogDescription>Configure um disparo para múltiplos contatos</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da campanha</Label>
              <Input placeholder="Ex: Promoção Janeiro" value={newMass.name} onChange={(e) => setNewMass({ ...newMass, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea placeholder="Conteúdo da mensagem..." value={newMass.message} onChange={(e) => setNewMass({ ...newMass, message: e.target.value })} />
            </div>
            {instances.length > 0 && (
              <div className="space-y-2">
                <Label>WhatsApp (instância)</Label>
                <Select value={newMass.instance_id || instances[0]?.id || ""} onValueChange={(v) => setNewMass((prev) => ({ ...prev, instance_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar instância" /></SelectTrigger>
                  <SelectContent>
                    {instances.map((inst) => <SelectItem key={inst.id} value={inst.id}>{inst.instance_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Filtrar por Tags</Label>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => (
                  <button key={tag.id} onClick={() => {
                    const has = newMass.target_tags.includes(tag.id);
                    setNewMass({ ...newMass, target_tags: has ? newMass.target_tags.filter((t) => t !== tag.id) : [...newMass.target_tags, tag.id] });
                  }} className={cn("text-xs px-2 py-1 rounded-full border transition-colors", newMass.target_tags.includes(tag.id) ? "text-white border-transparent" : "text-muted-foreground border-border")}
                    style={newMass.target_tags.includes(tag.id) ? { backgroundColor: tag.color } : {}}>
                    {tag.name}
                  </button>
                ))}
                {allTags.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma tag cadastrada</span>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Filtrar por Etapa do Funil</Label>
              <div className="flex flex-wrap gap-1.5">
                {allStages.map((stage) => (
                  <button key={stage.id} onClick={() => {
                    const has = newMass.target_stages.includes(stage.id);
                    setNewMass({ ...newMass, target_stages: has ? newMass.target_stages.filter((s) => s !== stage.id) : [...newMass.target_stages, stage.id] });
                  }} className={cn("text-xs px-2 py-1 rounded-full border transition-colors", newMass.target_stages.includes(stage.id) ? "text-white border-transparent" : "text-muted-foreground border-border")}
                    style={newMass.target_stages.includes(stage.id) ? { backgroundColor: stage.color } : {}}>
                    {stage.name}
                  </button>
                ))}
                {allStages.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma etapa cadastrada</span>}
              </div>
            </div>
            {(() => {
              const filtered = leads.filter((l) => {
                const tagMatch = newMass.target_tags.length === 0 || newMass.target_tags.some((t) => l.tag_ids?.includes(t));
                const stageMatch = newMass.target_stages.length === 0 || newMass.target_stages.includes(l.stage_id || "");
                return tagMatch && stageMatch;
              });
              const count = newMass.target_tags.length > 0 || newMass.target_stages.length > 0 ? filtered.length : leads.length;
              return (
                <div className="p-2 rounded-md bg-muted text-xs text-muted-foreground">
                  <strong>{count}</strong> lead{count !== 1 ? "s" : ""} ser{count !== 1 ? "ão" : "á"} impactado{count !== 1 ? "s" : ""}
                  {" "} &middot; Tempo estimado: ~{Math.max(1, Math.ceil(count * 0.08))} min (~5s por mensagem)
                </div>
              );
            })()}
            <div className="space-y-2">
              <Label>Agendar para (opcional)</Label>
              <Input type="datetime-local" value={newMass.scheduled_at || ""} onChange={(e) => setNewMass({ ...newMass, scheduled_at: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMass(false)} disabled={savingMassMessage}>Cancelar</Button>
            <Button onClick={handleAddMassMessage} disabled={savingMassMessage}>
              {savingMassMessage && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingMassId ? "Salvar" : "Criar Disparo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMassDetails} onOpenChange={(open) => { if (!open) closeMassDetails(); else setShowMassDetails(true); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedMassMessage?.name || "Logs do disparo"}</DialogTitle>
            <DialogDescription>
              Acompanhe status por contato, motivo das falhas e reenfileire apenas o que precisar.
            </DialogDescription>
          </DialogHeader>

          {selectedMassMessage && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{selectedMassMessage.message}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{selectedMassMessage.sent_count || 0} enviados</span>
                      <span>{selectedMassMessage.failed_count || 0} falhas</span>
                      <span>{selectedMassMessage.total_count || 0} contatos</span>
                      <span>Status atual: {getStatusLabel(selectedMassMessage.status)}</span>
                    </div>
                    {selectedMassMessage.last_error && (
                      <p className="text-xs text-destructive">Ultimo erro geral: {selectedMassMessage.last_error}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadMassMessageDeliveries(selectedMassMessage.id)}
                      disabled={loadingMassDetails}
                    >
                      {loadingMassDetails ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                      <span className="ml-2">Atualizar</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => reprocessMassDeliveries()}
                      disabled={reprocessingAllMass || !massMessageDeliveries.some((delivery) => delivery.status === "failed")}
                    >
                      {reprocessingAllMass ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                      <span className="ml-2">Reprocessar falhas</span>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                {loadingMassDetails ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Carregando logs do disparo...
                  </div>
                ) : massMessageDeliveries.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Nenhum log por contato foi encontrado ainda para este disparo.
                  </div>
                ) : (
                  massMessageDeliveries.map((delivery) => {
                    const isReprocessing = reprocessingDeliveryIds.includes(delivery.id);
                    return (
                      <div key={delivery.id} className="rounded-lg border p-4 space-y-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-sm">{delivery.lead_name || "Lead sem nome"}</p>
                              <Badge variant={getStatusColor(delivery.status) as any}>{getStatusLabel(delivery.status)}</Badge>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>Telefone: {delivery.lead_phone || delivery.normalized_phone || "-"}</span>
                              <span>Tentativas: {delivery.attempt_count || 0}</span>
                              <span>Ultima tentativa: {formatDateTime(delivery.last_attempt_at)}</span>
                              <span>Enviado em: {formatDateTime(delivery.sent_at)}</span>
                            </div>
                            {delivery.failure_reason && (
                              <p className="text-xs text-destructive">Falha: {delivery.failure_reason}</p>
                            )}
                          </div>
                          {delivery.status === "failed" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => reprocessMassDeliveries([delivery.id])}
                              disabled={isReprocessing}
                            >
                              {isReprocessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                              <span className="ml-2">Reprocessar</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showScheduledDetails} onOpenChange={(open) => { if (!open) closeScheduledDetails(); else setShowScheduledDetails(true); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedScheduledMessage?.lead_name || "Historico do agendamento"}</DialogTitle>
            <DialogDescription>
              Veja as tentativas, o motivo da falha e reenfileire o agendamento quando precisar.
            </DialogDescription>
          </DialogHeader>

          {selectedScheduledMessage && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    {selectedScheduledMessage.message && (
                      <p className="text-sm text-muted-foreground whitespace-pre-line">{selectedScheduledMessage.message}</p>
                    )}
                    {selectedScheduledMessage.media_url && (
                      <p className="text-xs text-muted-foreground">
                        Mídia anexada: {selectedScheduledMessage.file_name || selectedScheduledMessage.media_type || "arquivo"}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>Status atual: {getStatusLabel(selectedScheduledMessage.status)}</span>
                      <span>Tentativas: {selectedScheduledMessage.attempt_count || 0}</span>
                      <span>Agendado para: {formatDateTime(selectedScheduledMessage.scheduled_at)}</span>
                      <span>Ultima tentativa: {formatDateTime(selectedScheduledMessage.last_attempt_at)}</span>
                      <span>Enviado em: {formatDateTime(selectedScheduledMessage.sent_at)}</span>
                    </div>
                    {selectedScheduledMessage.failure_reason && (
                      <p className="text-xs text-destructive">Ultima falha: {selectedScheduledMessage.failure_reason}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadScheduledMessageAttempts(selectedScheduledMessage.id)}
                      disabled={loadingScheduledDetails}
                    >
                      {loadingScheduledDetails ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                      <span className="ml-2">Atualizar</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => reprocessScheduledMessages([selectedScheduledMessage.id])}
                      disabled={selectedScheduledMessage.status !== "failed" || reprocessingScheduledIds.includes(selectedScheduledMessage.id)}
                    >
                      {reprocessingScheduledIds.includes(selectedScheduledMessage.id)
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <RefreshCcw className="h-4 w-4" />}
                      <span className="ml-2">Reprocessar</span>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                {loadingScheduledDetails ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Carregando historico do agendamento...
                  </div>
                ) : scheduledMessageAttempts.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Nenhuma tentativa foi registrada ainda para este agendamento.
                  </div>
                ) : (
                  scheduledMessageAttempts.map((attempt) => (
                    <div key={attempt.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-sm">Tentativa #{attempt.attempt_number}</p>
                            <Badge variant={getStatusColor(attempt.status) as any}>{getStatusLabel(attempt.status)}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>Lead: {attempt.lead_name || selectedScheduledMessage.lead_name || "Lead"}</span>
                            <span>Telefone: {attempt.target_phone || attempt.normalized_phone || "-"}</span>
                            <span>Instancia: {attempt.instance_name || "-"}</span>
                            <span>Iniciada em: {formatDateTime(attempt.attempted_at)}</span>
                            <span>Finalizada em: {formatDateTime(attempt.completed_at)}</span>
                          </div>
                          {attempt.failure_reason && (
                            <p className="text-xs text-destructive">Falha: {attempt.failure_reason}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Scheduled Message Dialog */}
      <Dialog open={showAddScheduled} onOpenChange={(open) => { setShowAddScheduled(open); if (!open) { setEditingScheduledId(null); setScheduledLeadSearch(""); setNewScheduled(getDefaultScheduledFormState()); setSavingScheduledMessage(false); } }}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editingScheduledId ? "Editar Agendamento" : "Agendar Mensagem"}</DialogTitle>
            <DialogDescription>{editingScheduledId ? "Altere os dados do agendamento" : "Agende uma mensagem para ser enviada a um lead"}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              {!editingScheduledId && (
                <div className="space-y-2">
                  <Label>Lead *</Label>
                  <div className="rounded-2xl border border-border/80 bg-muted/20 p-3 space-y-3">
                    <Input
                      placeholder="Buscar por nome ou telefone"
                      value={scheduledLeadSearch}
                      onChange={(e) => setScheduledLeadSearch(e.target.value)}
                      className="h-11 bg-background"
                    />
                    <div className="max-h-56 overflow-y-auto rounded-xl border bg-background">
                      {filteredScheduledLeads.length === 0 && !selectedScheduledLead ? (
                        <div className="p-4 text-sm text-muted-foreground">
                          Nenhum lead encontrado com esse termo.
                        </div>
                      ) : (
                        filteredScheduledLeads.map((lead) => {
                          const isSelected = newScheduled.lead_id === lead.id;
                          return (
                            <button
                              key={lead.id}
                              type="button"
                              onClick={() => {
                                setNewScheduled((prev) => ({ ...prev, lead_id: lead.id }));
                                setScheduledLeadSearch(`${lead.name} - ${lead.phone}`);
                              }}
                              className={cn(
                                "flex w-full items-center justify-between gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0",
                                isSelected ? "bg-primary/10" : "hover:bg-muted/60",
                              )}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{lead.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{lead.phone}</p>
                              </div>
                              {isSelected && <Badge variant="outline">Selecionado</Badge>}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea
                  placeholder={"Conteudo da mensagem...\n\nAs quebras de linha serao preservadas no envio."}
                  value={newScheduled.message}
                  onChange={(e) => setNewScheduled({ ...newScheduled, message: e.target.value })}
                  className="min-h-28 whitespace-pre-wrap"
                />
                <p className="text-[11px] text-muted-foreground">
                  Voce pode enviar so texto, so midia ou midia com legenda.
                </p>
              </div>

              {templates.length > 0 && (
                <div className="space-y-2">
                  <Label>Mensagem pronta</Label>
                  <Select
                    value="none"
                    onValueChange={(v) => {
                      if (v === "none") return;
                      const template = templates.find((item) => item.id === v);
                      if (!template) return;
                      setNewScheduled((prev) => ({ ...prev, message: template.content }));
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Usar mensagem pronta" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecione...</SelectItem>
                      {templates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {scheduledSupportedMedia.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Midia opcional</Label>
                    {selectedScheduledMedia && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setNewScheduled((prev) => ({ ...prev, media_url: "", media_type: "", file_name: "" }))}
                      >
                        Remover midia
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => setNewScheduled((prev) => ({ ...prev, media_url: "", media_type: "", file_name: "" }))}
                      className={cn(
                        "rounded-2xl border p-3 text-left transition-all",
                        !selectedScheduledMedia ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40 hover:bg-muted/40",
                      )}
                    >
                      <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-border bg-muted/60">
                        <div className="text-center space-y-2">
                          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-background/80">
                            <MessageSquare className="h-5 w-5 text-primary" />
                          </div>
                          <p className="text-xs text-muted-foreground">Somente texto</p>
                        </div>
                      </div>
                    </button>
                    {scheduledSupportedMedia.map((item) => {
                      const isSelected = selectedScheduledMediaId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setNewScheduled((prev) => ({
                            ...prev,
                            media_url: item.file_url,
                            media_type: item.file_type,
                            file_name: item.file_name,
                          }))}
                          className={cn(
                            "rounded-2xl border p-2 text-left transition-all",
                            isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40 hover:bg-muted/40",
                          )}
                        >
                          {renderScheduledMediaThumb(item)}
                          <div className="mt-2 space-y-1">
                            <p className="line-clamp-1 text-xs font-medium">{item.file_name}</p>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.file_type}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {instances.length > 0 && (
                  <div className="space-y-2">
                    <Label>WhatsApp (instancia) *</Label>
                    <Select value={newScheduled.instance_id || instances[0]?.id || ""} onValueChange={(v) => setNewScheduled({ ...newScheduled, instance_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecionar instancia" /></SelectTrigger>
                      <SelectContent>
                        {instances.map((inst) => <SelectItem key={inst.id} value={inst.id}>{inst.instance_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Data e hora *</Label>
                  <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-3 shadow-sm">
                    <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <CalendarClock className="h-4 w-4 text-primary" />
                      Escolha quando a mensagem deve sair
                    </div>
                    <Input
                      type="datetime-local"
                      value={newScheduled.scheduled_at}
                      onChange={(e) => setNewScheduled({ ...newScheduled, scheduled_at: e.target.value })}
                      className="h-12 border-primary/30 bg-background text-sm font-medium shadow-sm"
                      style={{ colorScheme: "dark" }}
                    />
                    {scheduledDateParts && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] capitalize">
                          {scheduledDateParts.dateLabel}
                        </Badge>
                        <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px]">
                          {scheduledDateParts.timeLabel}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-3xl border bg-gradient-to-b from-muted/70 to-background p-3">
                <div className="rounded-[28px] border bg-background p-3 shadow-sm">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="truncate">
                      {selectedScheduledLead?.name || "Preview da mensagem"}
                    </span>
                    <Badge variant="outline">Preview</Badge>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <div className="max-w-[88%] rounded-2xl rounded-br-md bg-primary px-3 py-3 text-primary-foreground shadow-sm">
                      {selectedScheduledMedia && (
                        <div className="mb-2">
                          {renderScheduledMediaThumb(selectedScheduledMedia, "preview")}
                        </div>
                      )}
                      {newScheduled.message ? (
                        <p className="whitespace-pre-wrap break-words text-sm">{newScheduled.message}</p>
                      ) : (
                        <p className="text-sm text-primary-foreground/70">
                          {selectedScheduledMedia ? "Legenda opcional" : "Escreva a mensagem para visualizar aqui"}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-primary-foreground/70">
                        <span className="truncate">
                          {selectedScheduledLead?.phone || "Telefone do lead"}
                        </span>
                        <span>{newScheduled.scheduled_at ? newScheduled.scheduled_at.slice(11, 16) : "--:--"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Card className="border-dashed">
                <CardContent className="p-4 space-y-3">
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resumo</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{selectedScheduledMedia ? "Midia + legenda" : "Texto"}</Badge>
                      {newScheduled.instance_id && (
                        <Badge variant="outline">
                          {instances.find((inst) => inst.id === newScheduled.instance_id)?.instance_name || "Instancia"}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p>Lead: <span className="text-foreground">{selectedScheduledLead?.name || "Nao selecionado"}</span></p>
                    <p>Agendamento: <span className="text-foreground">{newScheduled.scheduled_at || "Nao definido"}</span></p>
                    <p>Midia: <span className="text-foreground">{selectedScheduledMedia?.file_name || "Sem midia"}</span></p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddScheduled(false)} disabled={savingScheduledMessage}>Cancelar</Button>
            <Button onClick={handleAddScheduled} disabled={savingScheduledMessage}>
              {savingScheduledMessage && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingScheduledId ? "Salvar" : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
