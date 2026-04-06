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
  MessageSquare, Image, Video, Music, FileUp, Timer, GripVertical, ArrowLeft, Eye,
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
  total_count: number;
  created_at: string;
  instance_id?: string;
  target_tags?: string[];
  target_stages?: string[];
}

interface ScheduledMsg {
  id: string;
  lead_name?: string;
  message: string;
  scheduled_at: string;
  status: string;
}

interface Instance { id: string; instance_name: string; }
interface MediaItem { id: string; file_name: string; file_type: string; file_url: string; }
interface TagOption { id: string; name: string; color: string; }
interface StageOption { id: string; name: string; color: string; }

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

  // Scheduled
  const [showAddScheduled, setShowAddScheduled] = useState(false);
  const [editingScheduledId, setEditingScheduledId] = useState<string | null>(null);
  const [newScheduled, setNewScheduled] = useState({ lead_id: "", message: "", scheduled_at: "", instance_id: "" });

  // Step media picker
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaPickerStepIndex, setMediaPickerStepIndex] = useState(-1);

  const loadData = useCallback(async () => {
    try {
      const userId = user?.id;
      if (!userId) { setLoading(false); return; }

      const [flowsRes, massRes, schedRes, instRes, leadsRes, mediaRes, tagsRes, stagesRes] = await Promise.all([
        supabase.from("flows").select("*, flow_steps(*)").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("mass_messages").select("*").eq("user_id", userId).is("deleted_at", null).neq("status", "cancelled").order("created_at", { ascending: false }),
        supabase.from("scheduled_messages").select("*, leads(name)").eq("user_id", userId).is("deleted_at", null).neq("status", "cancelled").order("created_at", { ascending: false }),
        supabase.from("whatsapp_instances").select("id, instance_name").eq("user_id", userId).is("deleted_at", null),
        supabase.from("leads").select("id, name, phone, stage_id, lead_tags(tag_id)").eq("user_id", userId).eq("archived", false).is("deleted_at", null),
        supabase.from("media").select("id, file_name, file_type, file_url").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("tags").select("id, name, color").eq("user_id", userId),
        supabase.from("funnel_stages").select("id, name, color").eq("user_id", userId),
      ]);
      if (flowsRes.data) {
        setFlows(flowsRes.data.map((f: any) => ({
          ...f,
          steps: (f.flow_steps || []).sort((a: FlowStep, b: FlowStep) => a.step_order - b.step_order),
        })));
      }
      if (massRes.data) {
        setMassMessages(massRes.data);
        // Calculate monthly disparos (sent_count from completed/sending this month)
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const monthlyTotal = massRes.data
          .filter((m: any) => ["completed", "sending", "sent"].includes(m.status) && m.created_at >= monthStart)
          .reduce((acc: number, m: any) => acc + (m.sent_count || 0), 0);
        setMonthlyDisparos(monthlyTotal);
      }
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
      if (tagsRes.data) setAllTags(tagsRes.data);
      if (stagesRes.data) setAllStages(stagesRes.data);
    } catch { /* */ } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

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
    const schedAt = m.scheduled_at ? new Date(m.scheduled_at).toISOString().slice(0, 16) : "";
    setNewMass({ name: m.name, message: m.message, scheduled_at: schedAt, instance_id: m.instance_id || instances[0]?.id || "", target_tags: m.target_tags || [], target_stages: m.target_stages || [] });
    setShowAddMass(true);
  };

  const deleteMassMessage = async (id: string) => {
    await supabase.from("mass_messages").update({ status: "cancelled", deleted_at: new Date().toISOString() }).eq("id", id);
    setMassMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const handleAddMassMessage = async () => {
    if (!newMass.name || !newMass.message || !newMass.instance_id) {
      if (!newMass.name) toast("Nome da campanha é obrigatório.", "warning");
      else if (!newMass.message) toast("Mensagem é obrigatória.", "warning");
      else if (!newMass.instance_id) toast("Selecione um WhatsApp para o disparo.", "warning");
      return;
    }
    const newStatus = newMass.scheduled_at ? "scheduled" : "draft";
    const payload = { name: newMass.name, message: newMass.message, scheduled_at: newMass.scheduled_at || null, instance_id: newMass.instance_id, target_tags: newMass.target_tags, target_stages: newMass.target_stages };
    if (editingMassId) {
      const { error } = await supabase.from("mass_messages").update({ ...payload, status: newStatus }).eq("id", editingMassId);
      if (!error) { setMassMessages((prev) => prev.map((m) => m.id === editingMassId ? { ...m, ...payload, status: newStatus } : m)); toast("Disparo atualizado!", "success"); }
      setEditingMassId(null);
    } else {
      if (!user) return;
      const { data, error } = await supabase.from("mass_messages").insert({
        user_id: user.id, ...payload,
        status: newMass.scheduled_at ? "scheduled" : "draft", sent_count: 0, total_count: 0,
      }).select().single();
      if (!error && data) setMassMessages((prev) => [data, ...prev]);
    }
    setNewMass({ name: "", message: "", scheduled_at: "", instance_id: "", target_tags: [], target_stages: [] });
    setShowAddMass(false);
  };

  // ===== SCHEDULED =====
  const openEditScheduled = (sm: ScheduledMsg) => {
    setEditingScheduledId(sm.id);
    const schedAt = sm.scheduled_at ? new Date(sm.scheduled_at).toISOString().slice(0, 16) : "";
    setNewScheduled({ lead_id: "", message: sm.message, scheduled_at: schedAt, instance_id: instances[0]?.id || "" });
    setShowAddScheduled(true);
  };

  const deleteScheduledMessage = async (id: string) => {
    await supabase.from("scheduled_messages").update({ status: "cancelled", deleted_at: new Date().toISOString() }).eq("id", id);
    setScheduledMessages((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAddScheduled = async () => {
    if (!newScheduled.message || !newScheduled.scheduled_at || (!newScheduled.lead_id && !editingScheduledId)) return;
    if (!newScheduled.instance_id) { toast("Selecione um WhatsApp.", "warning"); return; }
    const payload = { message: newScheduled.message, scheduled_at: newScheduled.scheduled_at, instance_id: newScheduled.instance_id };
    if (editingScheduledId) {
      const { error } = await supabase.from("scheduled_messages").update({ ...payload, status: "pending" }).eq("id", editingScheduledId);
      if (!error) { setScheduledMessages((prev) => prev.map((s) => s.id === editingScheduledId ? { ...s, ...payload, status: "pending" } : s)); toast("Agendamento atualizado!", "success"); }
      setEditingScheduledId(null);
    } else {
      if (!newScheduled.lead_id) return;
      if (!user) return;
      const { data, error } = await supabase.from("scheduled_messages").insert({
        user_id: user.id, lead_id: newScheduled.lead_id, instance_id: newScheduled.instance_id,
        message: newScheduled.message, scheduled_at: newScheduled.scheduled_at, status: "pending",
      }).select("*, leads(name)").single();
      if (!error && data) setScheduledMessages((prev) => [{ ...data, lead_name: (data as any).leads?.name }, ...prev]);
    }
    setNewScheduled({ lead_id: "", message: "", scheduled_at: "", instance_id: instances[0]?.id || "" });
    setShowAddScheduled(false);
  };

  // ===== HELPERS =====
  const statusColors: Record<string, string> = { draft: "outline", scheduled: "warning", sending: "default", completed: "success", failed: "destructive", pending: "warning", sent: "success", cancelled: "outline" };
  const statusLabels: Record<string, string> = { draft: "Rascunho", scheduled: "Agendado", sending: "Enviando", completed: "Concluído", failed: "Falhou", pending: "Pendente", sent: "Enviado", cancelled: "Cancelado" };

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
                <span className={cn("font-mono font-semibold", monthlyDisparos >= limits.max_mass_messages_per_month ? "text-destructive" : "text-foreground")}>
                  {monthlyDisparos.toLocaleString("pt-BR")} / {limits.max_mass_messages_per_month === Infinity ? "Ilimitado" : limits.max_mass_messages_per_month.toLocaleString("pt-BR")}
                </span>
              </div>
              {limits.max_mass_messages_per_month !== Infinity && (
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", monthlyDisparos >= limits.max_mass_messages_per_month ? "bg-destructive" : "bg-primary")}
                    style={{ width: `${Math.min(100, (monthlyDisparos / limits.max_mass_messages_per_month) * 100)}%` }}
                  />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {monthlyDisparos >= limits.max_mass_messages_per_month && limits.max_mass_messages_per_month !== Infinity && (
                <Link href="/assinatura">
                  <Button variant="outline" size="sm" className="text-xs">Fazer upgrade</Button>
                </Link>
              )}
              <Button
                onClick={() => {
                  if (monthlyDisparos >= limits.max_mass_messages_per_month && limits.max_mass_messages_per_month !== Infinity) {
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
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{mm.name}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{mm.message}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusColors[mm.status] as any}>{statusLabels[mm.status] || mm.status}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(mm.created_at).toLocaleDateString("pt-BR")}</span>
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
          <div className="flex justify-end">
            <Button onClick={() => setShowAddScheduled(true)}><Plus className="h-4 w-4 mr-2" /> Agendar Mensagem</Button>
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
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{sm.lead_name || "Lead"}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{sm.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(sm.scheduled_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusColors[sm.status] as any}>{statusLabels[sm.status] || sm.status}</Badge>
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
      <Dialog open={showAddMass} onOpenChange={(open) => { setShowAddMass(open); if (!open) { setEditingMassId(null); setNewMass({ name: "", message: "", scheduled_at: "", instance_id: "", target_tags: [], target_stages: [] }); } }}>
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
                <Select value={newMass.instance_id || instances[0]?.id || ""} onValueChange={(v) => setNewMass({ ...newMass, instance_id: v })}>
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
            <Button variant="outline" onClick={() => setShowAddMass(false)}>Cancelar</Button>
            <Button onClick={handleAddMassMessage}>{editingMassId ? "Salvar" : "Criar Disparo"}  </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scheduled Message Dialog */}
      <Dialog open={showAddScheduled} onOpenChange={(open) => { setShowAddScheduled(open); if (!open) { setEditingScheduledId(null); setNewScheduled({ lead_id: "", message: "", scheduled_at: "", instance_id: instances[0]?.id || "" }); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingScheduledId ? "Editar Agendamento" : "Agendar Mensagem"}</DialogTitle>
            <DialogDescription>{editingScheduledId ? "Altere os dados do agendamento" : "Agende uma mensagem para ser enviada a um lead"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!editingScheduledId && (
              <div className="space-y-2">
                <Label>Lead *</Label>
                <Select value={newScheduled.lead_id || "none"} onValueChange={(v) => setNewScheduled({ ...newScheduled, lead_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar lead" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione...</SelectItem>
                    {leads.map((l) => <SelectItem key={l.id} value={l.id}>{l.name} - {l.phone}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Mensagem *</Label>
              <Textarea placeholder="Conteúdo da mensagem..." value={newScheduled.message} onChange={(e) => setNewScheduled({ ...newScheduled, message: e.target.value })} />
            </div>
            {instances.length > 0 && (
              <div className="space-y-2">
                <Label>WhatsApp (instância) *</Label>
                <Select value={newScheduled.instance_id || instances[0]?.id || ""} onValueChange={(v) => setNewScheduled({ ...newScheduled, instance_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar instância" /></SelectTrigger>
                  <SelectContent>
                    {instances.map((inst) => <SelectItem key={inst.id} value={inst.id}>{inst.instance_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Data e hora *</Label>
              <Input type="datetime-local" value={newScheduled.scheduled_at} onChange={(e) => setNewScheduled({ ...newScheduled, scheduled_at: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddScheduled(false)}>Cancelar</Button>
            <Button onClick={handleAddScheduled}>{editingScheduledId ? "Salvar" : "Agendar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
