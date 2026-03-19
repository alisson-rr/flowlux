"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Search, GripVertical, Loader2, Trash2, Settings2, ArrowUp, ArrowDown, Globe, StickyNote, Mail, UserPlus, Tag, X, Phone, Pencil, Archive, ArchiveRestore,
} from "lucide-react";
import { cn, formatPhone, formatPhoneInput, getInitials } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

interface Lead { id: string; name: string; phone: string; email?: string; stage_id: string; source?: string; archived: boolean; created_at: string; tags: { id: string; name: string; color: string }[]; notes: { id: string; content: string; created_at: string }[]; }
interface Stage { id: string; name: string; color: string; order: number; }
interface Funnel { id: string; name: string; description: string; }

const STAGE_COLORS = ["#8B5CF6", "#F97316", "#3B82F6", "#10B981", "#EAB308", "#EF4444", "#EC4899", "#06B6D4", "#14B8A6", "#A855F7"];

export default function FunilPage() {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState("");
  const [stages, setStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [draggedLead, setDraggedLead] = useState<string | null>(null);

  // Funnel config
  const [showFunnelConfig, setShowFunnelConfig] = useState(false);
  const [showAddFunnel, setShowAddFunnel] = useState(false);
  const [showAddLead, setShowAddLead] = useState(false);
  const [editStages, setEditStages] = useState<Stage[]>([]);
  const [newStageName, setNewStageName] = useState("");
  const [newFunnelName, setNewFunnelName] = useState("");
  const [newLead, setNewLead] = useState({ name: "", phone: "", email: "", source: "" });
  const [newLeadStage, setNewLeadStage] = useState("");

  // Lead detail modal
  const [showLeadDetail, setShowLeadDetail] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [newNote, setNewNote] = useState("");
  const [newTag, setNewTag] = useState("");
  const [allTags, setAllTags] = useState<{ id: string; name: string; color: string }[]>([]);

  const TAG_COLORS = ["#8B5CF6", "#F97316", "#3B82F6", "#10B981", "#EF4444", "#EC4899", "#06B6D4", "#EAB308"];
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    try {
      const [funnelsRes, stagesRes, leadsRes, tagsRes] = await Promise.all([
        supabase.from("funnels").select("id, name, description").order("created_at"),
        supabase.from("funnel_stages").select("*").order("order"),
        supabase.from("leads").select("*, lead_tags(tags(*)), notes(*)").is("deleted_at", null).eq("archived", false),
        supabase.from("tags").select("id, name, color"),
      ]);
      if (tagsRes.data) setAllTags(tagsRes.data);

      if (funnelsRes.data) {
        setFunnels(funnelsRes.data);
        if (funnelsRes.data.length > 0 && !selectedFunnelId) {
          setSelectedFunnelId(funnelsRes.data[0].id);
        }
      }
      if (stagesRes.data) setStages(stagesRes.data);
      if (leadsRes.data) {
        setLeads(leadsRes.data.map((l: any) => ({
          ...l, archived: l.archived || false,
          tags: l.lead_tags?.map((lt: any) => lt.tags).filter(Boolean) || [],
          notes: l.notes || [],
        })));
      }
    } catch { /* */ } finally { setLoading(false); }
  }, [selectedFunnelId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter stages/leads by selected funnel
  const funnelStages = stages.filter((s) => (s as any).funnel_id === selectedFunnelId);
  const filteredLeads = leads
    .filter((l) => (l as any).funnel_id === selectedFunnelId)
    .filter((l) => l.name.toLowerCase().includes(searchTerm.toLowerCase()) || l.phone.includes(searchTerm));
  const getLeadsByStage = (stageId: string) => filteredLeads.filter((l) => l.stage_id === stageId);

  // Drag & Drop
  const handleDrop = async (stageId: string) => {
    if (!draggedLead) return;
    await supabase.from("leads").update({ stage_id: stageId }).eq("id", draggedLead);
    setLeads((prev) => prev.map((l) => l.id === draggedLead ? { ...l, stage_id: stageId } : l));
    setDraggedLead(null);
  };

  // Funnel CRUD
  const handleAddFunnel = async () => {
    if (!newFunnelName.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data, error } = await supabase.from("funnels").insert({ user_id: userData.user.id, name: newFunnelName }).select().single();
    if (!error && data) {
      setFunnels((prev) => [...prev, data]);
      setSelectedFunnelId(data.id);
      setNewFunnelName("");
      setShowAddFunnel(false);
    }
  };

  const handleAddLead = async () => {
    if (!newLead.name || !newLead.phone) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const stageId = newLeadStage || funnelStages[0]?.id;
    const { data, error } = await supabase.from("leads").insert({
      user_id: userData.user.id, name: newLead.name, phone: newLead.phone,
      email: newLead.email || null, stage_id: stageId, source: newLead.source || null,
      funnel_id: selectedFunnelId,
    }).select("*, lead_tags(tags(*)), notes(*)").single();
    if (!error && data) {
      setLeads((prev) => [...prev, { ...data, archived: false, tags: data.lead_tags?.map((lt: any) => lt.tags).filter(Boolean) || [], notes: data.notes || [] }]);
      setNewLead({ name: "", phone: "", email: "", source: "" });
      setNewLeadStage("");
      setShowAddLead(false);
    }
  };

  const handleDeleteFunnel = async () => {
    if (!selectedFunnelId || funnels.length <= 1) { toast("Deve haver pelo menos um funil.", "warning"); return; }
    await supabase.from("funnel_stages").delete().eq("funnel_id", selectedFunnelId);
    await supabase.from("funnels").delete().eq("id", selectedFunnelId);
    setFunnels((prev) => prev.filter((f) => f.id !== selectedFunnelId));
    setSelectedFunnelId(funnels[0]?.id || "");
  };

  // Stage CRUD
  const openFunnelConfig = () => { setEditStages([...funnelStages]); setShowFunnelConfig(true); };

  const handleSaveFunnel = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    for (let i = 0; i < editStages.length; i++) {
      const s = editStages[i];
      if (s.id.startsWith("temp-")) {
        const { data } = await supabase.from("funnel_stages").insert({
          user_id: userData.user.id, funnel_id: selectedFunnelId, name: s.name, color: s.color, order: i,
        }).select().single();
        if (data) editStages[i] = { ...data, order: i };
      } else {
        await supabase.from("funnel_stages").update({ name: s.name, color: s.color, order: i }).eq("id", s.id);
      }
    }
    const removedIds = funnelStages.filter((s) => !editStages.find((es) => es.id === s.id)).map((s) => s.id);
    for (const id of removedIds) await supabase.from("funnel_stages").delete().eq("id", id);
    setStages((prev) => [...prev.filter((s) => (s as any).funnel_id !== selectedFunnelId), ...editStages.map((s, i) => ({ ...s, order: i }))]);
    setShowFunnelConfig(false);
  };

  const moveStage = (i: number, dir: -1 | 1) => {
    const arr = [...editStages]; const t = i + dir;
    if (t < 0 || t >= arr.length) return;
    [arr[i], arr[t]] = [arr[t], arr[i]]; setEditStages(arr);
  };

  // === LEAD DETAIL: Tags & Notes ===
  const handleAddNote = async () => {
    if (!selectedLead || !newNote.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data, error } = await supabase.from("notes").insert({
      lead_id: selectedLead.id, user_id: userData.user.id, content: newNote,
    }).select().single();
    if (!error && data) {
      setLeads((prev) => prev.map((l) => l.id === selectedLead.id ? { ...l, notes: [...l.notes, data] } : l));
      setSelectedLead((prev) => prev ? { ...prev, notes: [...prev.notes, data] } : prev);
      setNewNote("");
    }
  };

  const handleAddTag = async () => {
    if (!selectedLead || !newTag.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
    let { data: existingTag } = await supabase.from("tags").select().eq("name", newTag).eq("user_id", userData.user.id).single();
    if (!existingTag) {
      const { data: created } = await supabase.from("tags").insert({ name: newTag, color, user_id: userData.user.id }).select().single();
      existingTag = created;
    }
    if (existingTag) {
      await supabase.from("lead_tags").insert({ lead_id: selectedLead.id, tag_id: existingTag.id });
      const tag = { id: existingTag.id, name: existingTag.name, color: existingTag.color };
      setLeads((prev) => prev.map((l) => l.id === selectedLead.id ? { ...l, tags: [...l.tags, tag] } : l));
      setSelectedLead((prev) => prev ? { ...prev, tags: [...prev.tags, tag] } : prev);
      if (!allTags.some((t) => t.id === existingTag!.id)) setAllTags((prev) => [...prev, tag]);
      setNewTag("");
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!selectedLead) return;
    await supabase.from("lead_tags").delete().eq("lead_id", selectedLead.id).eq("tag_id", tagId);
    setLeads((prev) => prev.map((l) => l.id === selectedLead.id ? { ...l, tags: l.tags.filter((t) => t.id !== tagId) } : l));
    setSelectedLead((prev) => prev ? { ...prev, tags: prev.tags.filter((t) => t.id !== tagId) } : prev);
  };

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Funil de Vendas</h1>
          <p className="text-muted-foreground">Visualize e gerencie seus leads no Kanban</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAddFunnel(true)}><Plus className="h-4 w-4 mr-1" /> Novo Funil</Button>
          <Button variant="outline" size="sm" onClick={openFunnelConfig}><Settings2 className="h-4 w-4 mr-1" /> Etapas</Button>
          <Button size="sm" onClick={() => setShowAddLead(true)}><UserPlus className="h-4 w-4 mr-1" /> Novo Lead</Button>
        </div>
      </div>

      {/* Funnel Selector + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedFunnelId} onValueChange={setSelectedFunnelId}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Selecionar funil" /></SelectTrigger>
          <SelectContent>
            {funnels.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar leads..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {/* Kanban Board */}
      {funnelStages.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <p>Nenhuma etapa configurada neste funil.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={openFunnelConfig}><Settings2 className="h-4 w-4 mr-1" /> Configurar Etapas</Button>
        </Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {funnelStages.map((stage) => (
            <div key={stage.id} className="flex-shrink-0 w-[300px]" onDragOver={(e) => e.preventDefault()} onDrop={() => handleDrop(stage.id)}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="font-medium text-sm">{stage.name}</span>
                <Badge variant="outline" className="ml-auto text-xs">{getLeadsByStage(stage.id).length}</Badge>
              </div>
              <div className="space-y-2 min-h-[200px] p-2 rounded-lg bg-muted/30 border border-dashed border-border">
                {getLeadsByStage(stage.id).map((lead) => (
                  <Card key={lead.id} draggable onDragStart={() => setDraggedLead(lead.id)}
                    onClick={() => { setSelectedLead(lead); setShowLeadDetail(true); }}
                    className={cn("p-3 cursor-pointer hover:border-primary/40 transition-all", draggedLead === lead.id && "opacity-50")}>
                    <div className="flex items-start gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0 cursor-grab" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: stage.color }}>
                            {getInitials(lead.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{lead.name}</p>
                            <p className="text-xs text-muted-foreground">{formatPhone(lead.phone)}</p>
                          </div>
                        </div>
                        {lead.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {lead.tags.slice(0, 3).map((tag) => (
                              <span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: tag.color }}>{tag.name}</span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-muted-foreground">
                          {lead.notes.length > 0 && <span className="flex items-center gap-0.5 text-[10px]"><StickyNote className="h-3 w-3" /> {lead.notes.length}</span>}
                          {lead.email && <Mail className="h-3 w-3" />}
                          {lead.source && <Globe className="h-3 w-3" />}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Funnel Dialog */}
      <Dialog open={showAddFunnel} onOpenChange={setShowAddFunnel}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo Funil</DialogTitle>
            <DialogDescription>Crie um novo funil de vendas</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do funil *</Label>
              <Input placeholder="Ex: Leads Compradores" value={newFunnelName} onChange={(e) => setNewFunnelName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddFunnel(false)}>Cancelar</Button>
            <Button onClick={handleAddFunnel}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Funnel Stages Config Dialog */}
      <Dialog open={showFunnelConfig} onOpenChange={setShowFunnelConfig}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Etapas</DialogTitle>
            <DialogDescription>Personalize as etapas do funil "{funnels.find((f) => f.id === selectedFunnelId)?.name}"</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[50vh] overflow-y-auto">
            {editStages.map((stage, i) => (
              <div key={stage.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/30">
                <input type="color" value={stage.color} onChange={(e) => { const a = [...editStages]; a[i] = { ...a[i], color: e.target.value }; setEditStages(a); }} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                <Input value={stage.name} onChange={(e) => { const a = [...editStages]; a[i] = { ...a[i], name: e.target.value }; setEditStages(a); }} className="flex-1 h-9" />
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStage(i, -1)} disabled={i === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStage(i, 1)} disabled={i === editStages.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditStages(editStages.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Input placeholder="Nova etapa..." value={newStageName} onChange={(e) => setNewStageName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newStageName.trim()) { setEditStages([...editStages, { id: `temp-${Date.now()}`, name: newStageName, color: STAGE_COLORS[editStages.length % STAGE_COLORS.length], order: editStages.length }]); setNewStageName(""); } }} className="h-9" />
              <Button size="sm" onClick={() => { if (newStageName.trim()) { setEditStages([...editStages, { id: `temp-${Date.now()}`, name: newStageName, color: STAGE_COLORS[editStages.length % STAGE_COLORS.length], order: editStages.length }]); setNewStageName(""); } }}><Plus className="h-4 w-4 mr-1" /> Add</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="destructive" size="sm" onClick={handleDeleteFunnel}>Excluir Funil</Button>
            <Button variant="outline" onClick={() => setShowFunnelConfig(false)}>Cancelar</Button>
            <Button onClick={handleSaveFunnel}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Add Lead Dialog */}
      <Dialog open={showAddLead} onOpenChange={setShowAddLead}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
            <DialogDescription>Adicione um lead diretamente ao funil</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input placeholder="Nome do lead" value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Telefone *</Label>
              <Input placeholder="(00) 00000-0000" value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: formatPhoneInput(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input placeholder="email@exemplo.com" value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} />
            </div>
            {funnelStages.length > 0 && (
              <div className="space-y-2">
                <Label>Etapa</Label>
                <Select value={newLeadStage || funnelStages[0]?.id} onValueChange={setNewLeadStage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {funnelStages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Origem</Label>
              <Input placeholder="Ex: WhatsApp, Hotmart" value={newLead.source} onChange={(e) => setNewLead({ ...newLead, source: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLead(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (!newLead.name.trim()) { toast("Nome é obrigatório.", "warning"); return; }
              if (!newLead.phone.trim()) { toast("Telefone é obrigatório.", "warning"); return; }
              handleAddLead();
            }}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Detail Dialog */}
      <Dialog open={showLeadDetail} onOpenChange={setShowLeadDetail}>
        <DialogContent className="max-w-lg overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedLead && (
                <>
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {getInitials(selectedLead.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate">{selectedLead.name}</p>
                    <p className="text-sm font-normal text-muted-foreground">{formatPhone(selectedLead.phone)}</p>
                  </div>
                </>
              )}
            </DialogTitle>
            <DialogDescription>Detalhes do lead</DialogDescription>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
              {/* Contact & Source Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground p-2 rounded-md bg-muted/50">
                  <Phone className="h-4 w-4 shrink-0" /> <span className="truncate">{formatPhone(selectedLead.phone)}</span>
                </div>
                {selectedLead.email && (
                  <div className="flex items-center gap-2 text-muted-foreground p-2 rounded-md bg-muted/50">
                    <Mail className="h-4 w-4 shrink-0" /> <span className="truncate">{selectedLead.email}</span>
                  </div>
                )}
                {selectedLead.source && (
                  <div className="flex items-center gap-2 text-muted-foreground p-2 rounded-md bg-muted/50">
                    <Globe className="h-4 w-4 shrink-0" /> <span className="truncate">{selectedLead.source}</span>
                  </div>
                )}
              </div>

              {/* Stage */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Etapa do Funil</Label>
                <Select value={selectedLead.stage_id} onValueChange={async (val) => {
                  await supabase.from("leads").update({ stage_id: val }).eq("id", selectedLead.id);
                  setLeads((prev) => prev.map((l) => l.id === selectedLead.id ? { ...l, stage_id: val } : l));
                  setSelectedLead({ ...selectedLead, stage_id: val });
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{funnelStages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Tag className="h-3 w-3" /> Tags</Label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedLead.tags.map((tag) => (
                    <span key={tag.id} className="text-xs px-2 py-1 rounded-full text-white flex items-center gap-1" style={{ backgroundColor: tag.color }}>
                      {tag.name}
                      <button onClick={() => handleRemoveTag(tag.id)}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
                {allTags.filter((t) => !selectedLead.tags.some((lt) => lt.id === t.id)).length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground">Clique para adicionar:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {allTags.filter((t) => !selectedLead.tags.some((lt) => lt.id === t.id)).map((tag) => (
                        <button
                          key={tag.id}
                          onClick={async () => {
                            if (!selectedLead) return;
                            await supabase.from("lead_tags").insert({ lead_id: selectedLead.id, tag_id: tag.id });
                            const t = { id: tag.id, name: tag.name, color: tag.color };
                            setLeads((prev) => prev.map((l) => l.id === selectedLead.id ? { ...l, tags: [...l.tags, t] } : l));
                            setSelectedLead((prev) => prev ? { ...prev, tags: [...prev.tags, t] } : prev);
                          }}
                          className="text-xs px-2 py-1 rounded-full border border-dashed border-border text-muted-foreground hover:text-white hover:border-transparent transition-colors"
                          onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = tag.color; }}
                          onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = "transparent"; }}
                        >
                          + {tag.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Input placeholder="Criar nova tag..." value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddTag()} className="h-8 text-xs" />
                  <Button size="sm" variant="outline" onClick={handleAddTag} className="shrink-0 h-8 text-xs">
                    <Plus className="h-3 w-3 mr-1" /> Criar
                  </Button>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><StickyNote className="h-3 w-3" /> Observações</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedLead.notes.map((note) => (
                    <div key={note.id} className="p-2.5 rounded-md bg-muted text-sm">
                      <p>{note.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{new Date(note.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                  ))}
                </div>
                <Textarea placeholder="Adicionar observação..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="min-h-[60px] text-sm" />
                <Button size="sm" onClick={handleAddNote} className="w-full">Adicionar Nota</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
