"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Zap, Plus, Clock, Send, MessageSquare, Trash2, Loader2, Target, CalendarClock, Megaphone, FileText, Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Trigger {
  id: string;
  name: string;
  type: "keyword" | "schedule" | "event";
  keywords: string[];
  schedule_cron: string;
  message_template: string;
  is_active: boolean;
  created_at: string;
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
}

interface ScheduledMsg {
  id: string;
  lead_name?: string;
  message: string;
  scheduled_at: string;
  status: string;
}

interface Template {
  id: string;
  name: string;
  content: string;
  category: string;
}

export default function AutomacaoPage() {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [massMessages, setMassMessages] = useState<MassMessage[]>([]);
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMsg[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTrigger, setShowAddTrigger] = useState(false);
  const [showAddMass, setShowAddMass] = useState(false);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [showAddScheduled, setShowAddScheduled] = useState(false);
  const [editingTriggerId, setEditingTriggerId] = useState<string | null>(null);
  const [editingMassId, setEditingMassId] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const [newTrigger, setNewTrigger] = useState({ name: "", type: "keyword" as const, keywords: "", message_template: "" });
  const [newMass, setNewMass] = useState({ name: "", message: "", scheduled_at: "" });
  const [newTemplate, setNewTemplate] = useState({ name: "", content: "", category: "geral" });
  const [newScheduled, setNewScheduled] = useState({ lead_id: "", message: "", scheduled_at: "" });

  const loadData = useCallback(async () => {
    try {
      const [trigRes, massRes, schedRes, tempRes] = await Promise.all([
        supabase.from("automation_triggers").select("*").order("created_at", { ascending: false }),
        supabase.from("mass_messages").select("*").order("created_at", { ascending: false }),
        supabase.from("scheduled_messages").select("*, leads(name)").order("scheduled_at", { ascending: true }),
        supabase.from("message_templates").select("*").order("name"),
      ]);
      if (trigRes.data) setTriggers(trigRes.data);
      if (massRes.data) setMassMessages(massRes.data);
      if (schedRes.data) setScheduledMessages(schedRes.data.map((s: any) => ({ ...s, lead_name: s.leads?.name })));
      if (tempRes.data) setTemplates(tempRes.data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openEditTrigger = (t: Trigger) => {
    setEditingTriggerId(t.id);
    setNewTrigger({ name: t.name, type: t.type as "keyword", keywords: t.keywords?.join(", ") || "", message_template: t.message_template });
    setShowAddTrigger(true);
  };

  const openEditMass = (m: MassMessage) => {
    setEditingMassId(m.id);
    setNewMass({ name: m.name, message: m.message, scheduled_at: m.scheduled_at || "" });
    setShowAddMass(true);
  };

  const openEditTemplate = (t: Template) => {
    setEditingTemplateId(t.id);
    setNewTemplate({ name: t.name, content: t.content, category: t.category || "geral" });
    setShowAddTemplate(true);
  };

  const handleAddTrigger = async () => {
    if (!newTrigger.name || !newTrigger.message_template) return;

    const payload = {
      name: newTrigger.name,
      type: newTrigger.type,
      keywords: newTrigger.keywords.split(",").map((k) => k.trim()).filter(Boolean),
      message_template: newTrigger.message_template,
    };

    if (editingTriggerId) {
      const { error } = await supabase.from("automation_triggers").update(payload).eq("id", editingTriggerId);
      if (!error) setTriggers((prev) => prev.map((t) => t.id === editingTriggerId ? { ...t, ...payload } : t));
      setEditingTriggerId(null);
    } else {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data, error } = await supabase.from("automation_triggers").insert({
        user_id: userData.user.id, ...payload, is_active: true,
      }).select().single();
      if (!error && data) setTriggers((prev) => [data, ...prev]);
    }

    setNewTrigger({ name: "", type: "keyword", keywords: "", message_template: "" });
    setShowAddTrigger(false);
  };

  const toggleTrigger = async (id: string, isActive: boolean) => {
    await supabase.from("automation_triggers").update({ is_active: !isActive }).eq("id", id);
    setTriggers((prev) => prev.map((t) => t.id === id ? { ...t, is_active: !isActive } : t));
  };

  const deleteTrigger = async (id: string) => {
    await supabase.from("automation_triggers").delete().eq("id", id);
    setTriggers((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAddMassMessage = async () => {
    if (!newMass.name || !newMass.message) return;

    const payload = {
      name: newMass.name,
      message: newMass.message,
      scheduled_at: newMass.scheduled_at || null,
    };

    if (editingMassId) {
      const { error } = await supabase.from("mass_messages").update(payload).eq("id", editingMassId);
      if (!error) setMassMessages((prev) => prev.map((m) => m.id === editingMassId ? { ...m, ...payload } : m));
      setEditingMassId(null);
    } else {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data, error } = await supabase.from("mass_messages").insert({
        user_id: userData.user.id, ...payload,
        status: newMass.scheduled_at ? "scheduled" : "draft",
        sent_count: 0, total_count: 0,
      }).select().single();
      if (!error && data) setMassMessages((prev) => [data, ...prev]);
    }

    setNewMass({ name: "", message: "", scheduled_at: "" });
    setShowAddMass(false);
  };

  const handleAddTemplate = async () => {
    if (!newTemplate.name || !newTemplate.content) return;

    if (editingTemplateId) {
      const { error } = await supabase.from("message_templates").update(newTemplate).eq("id", editingTemplateId);
      if (!error) setTemplates((prev) => prev.map((t) => t.id === editingTemplateId ? { ...t, ...newTemplate } : t));
      setEditingTemplateId(null);
    } else {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data, error } = await supabase.from("message_templates").insert({
        user_id: userData.user.id, ...newTemplate,
      }).select().single();
      if (!error && data) setTemplates((prev) => [...prev, data]);
    }

    setNewTemplate({ name: "", content: "", category: "geral" });
    setShowAddTemplate(false);
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from("message_templates").delete().eq("id", id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const statusColors: Record<string, string> = {
    draft: "outline",
    scheduled: "warning",
    sending: "default",
    completed: "success",
    failed: "destructive",
    pending: "warning",
    sent: "success",
  };

  const statusLabels: Record<string, string> = {
    draft: "Rascunho",
    scheduled: "Agendado",
    sending: "Enviando",
    completed: "Concluído",
    failed: "Falhou",
    pending: "Pendente",
    sent: "Enviado",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Automação</h1>
        <p className="text-muted-foreground">Gerencie gatilhos, disparos e mensagens agendadas</p>
      </div>

      <Tabs defaultValue="triggers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="triggers" className="gap-2"><Target className="h-4 w-4" /> Gatilhos</TabsTrigger>
          <TabsTrigger value="mass" className="gap-2"><Megaphone className="h-4 w-4" /> Disparos em Massa</TabsTrigger>
          <TabsTrigger value="scheduled" className="gap-2"><CalendarClock className="h-4 w-4" /> Agendamentos</TabsTrigger>
        </TabsList>

        {/* Triggers Tab */}
        <TabsContent value="triggers" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowAddTrigger(true)}><Plus className="h-4 w-4 mr-2" /> Novo Gatilho</Button>
          </div>
          <div className="grid gap-3">
            {triggers.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum gatilho configurado</p>
              </Card>
            ) : (
              triggers.map((trigger) => (
                <Card key={trigger.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg", trigger.is_active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
                          <Zap className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{trigger.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px]">{trigger.type === "keyword" ? "Palavra-chave" : trigger.type === "schedule" ? "Agendado" : "Evento"}</Badge>
                            {trigger.keywords?.length > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                {trigger.keywords.join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch checked={trigger.is_active} onCheckedChange={() => toggleTrigger(trigger.id, trigger.is_active)} />
                        <Button variant="ghost" size="icon" onClick={() => openEditTrigger(trigger)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteTrigger(trigger.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 pl-11 line-clamp-2">{trigger.message_template}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Mass Messages Tab */}
        <TabsContent value="mass" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowAddMass(true)}><Plus className="h-4 w-4 mr-2" /> Novo Disparo</Button>
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
                        <span className="text-xs text-muted-foreground">{mm.sent_count}/{mm.total_count}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditMass(mm)}>
                          <Pencil className="h-3.5 w-3.5" />
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
                      <Badge variant={statusColors[sm.status] as any}>{statusLabels[sm.status] || sm.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowAddTemplate(true)}><Plus className="h-4 w-4 mr-2" /> Nova Mensagem</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground col-span-2">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma mensagem pronta cadastrada</p>
              </Card>
            ) : (
              templates.map((tpl) => (
                <Card key={tpl.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-sm">{tpl.name}</p>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">{tpl.category}</Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditTemplate(tpl)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteTemplate(tpl.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{tpl.content}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Trigger Dialog */}
      <Dialog open={showAddTrigger} onOpenChange={(open) => { setShowAddTrigger(open); if (!open) { setEditingTriggerId(null); setNewTrigger({ name: "", type: "keyword", keywords: "", message_template: "" }); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTriggerId ? "Editar Gatilho" : "Novo Gatilho"}</DialogTitle>
            <DialogDescription>Configure um gatilho automático para mensagens</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input placeholder="Nome do gatilho" value={newTrigger.name} onChange={(e) => setNewTrigger({ ...newTrigger, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={newTrigger.type} onValueChange={(v: any) => setNewTrigger({ ...newTrigger, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="keyword">Palavra-chave</SelectItem>
                  <SelectItem value="schedule">Agendado</SelectItem>
                  <SelectItem value="event">Evento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newTrigger.type === "keyword" && (
              <div className="space-y-2">
                <Label>Palavras-chave (separadas por vírgula)</Label>
                <Input placeholder="oi, olá, bom dia" value={newTrigger.keywords} onChange={(e) => setNewTrigger({ ...newTrigger, keywords: e.target.value })} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Mensagem de resposta</Label>
              <Textarea placeholder="Mensagem automática..." value={newTrigger.message_template} onChange={(e) => setNewTrigger({ ...newTrigger, message_template: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTrigger(false)}>Cancelar</Button>
            <Button onClick={handleAddTrigger}>{editingTriggerId ? "Salvar" : "Criar Gatilho"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Mass Message Dialog */}
      <Dialog open={showAddMass} onOpenChange={(open) => { setShowAddMass(open); if (!open) { setEditingMassId(null); setNewMass({ name: "", message: "", scheduled_at: "" }); } }}>
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
            <div className="space-y-2">
              <Label>Agendar para (opcional)</Label>
              <Input type="datetime-local" value={newMass.scheduled_at} onChange={(e) => setNewMass({ ...newMass, scheduled_at: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMass(false)}>Cancelar</Button>
            <Button onClick={handleAddMassMessage}>{editingMassId ? "Salvar" : "Criar Disparo"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Template Dialog */}
      <Dialog open={showAddTemplate} onOpenChange={(open) => { setShowAddTemplate(open); if (!open) { setEditingTemplateId(null); setNewTemplate({ name: "", content: "", category: "geral" }); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTemplateId ? "Editar Mensagem Pronta" : "Nova Mensagem Pronta"}</DialogTitle>
            <DialogDescription>Crie um modelo de mensagem reutilizável</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input placeholder="Nome do template" value={newTemplate.name} onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={newTemplate.category} onValueChange={(v) => setNewTemplate({ ...newTemplate, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="geral">Geral</SelectItem>
                  <SelectItem value="vendas">Vendas</SelectItem>
                  <SelectItem value="suporte">Suporte</SelectItem>
                  <SelectItem value="boas-vindas">Boas-vindas</SelectItem>
                  <SelectItem value="follow-up">Follow-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Conteúdo</Label>
              <Textarea placeholder="Texto da mensagem..." className="min-h-[120px]" value={newTemplate.content} onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTemplate(false)}>Cancelar</Button>
            <Button onClick={handleAddTemplate}>{editingTemplateId ? "Salvar" : "Criar Template"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
