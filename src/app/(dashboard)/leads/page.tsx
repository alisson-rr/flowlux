"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Search, Phone, Mail, StickyNote, Tag, X, Loader2, Trash2, Settings2, ArrowUp, ArrowDown, Pencil, Globe, Archive, ArchiveRestore, Filter, SortAsc,
} from "lucide-react";
import { cn, formatPhone, formatPhoneInput, getInitials } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { useSubscription } from "@/lib/use-subscription";
import Link from "next/link";

interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  stage_id: string;
  source?: string;
  archived: boolean;
  created_at: string;
  tags: { id: string; name: string; color: string }[];
  notes: { id: string; content: string; created_at: string }[];
}

interface Stage {
  id: string;
  name: string;
  color: string;
  order: number;
}

const TAG_COLORS = ["#8B5CF6", "#F97316", "#3B82F6", "#10B981", "#EF4444", "#EC4899", "#06B6D4", "#EAB308"];
const STAGE_COLORS = ["#8B5CF6", "#F97316", "#3B82F6", "#10B981", "#EAB308", "#EF4444", "#EC4899", "#06B6D4", "#14B8A6", "#A855F7"];

export default function LeadsPage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddLead, setShowAddLead] = useState(false);
  const [showLeadDetail, setShowLeadDetail] = useState(false);
  const [showFunnelConfig, setShowFunnelConfig] = useState(false);
  const [showEditLead, setShowEditLead] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [newLeadStage, setNewLeadStage] = useState("");
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newLead, setNewLead] = useState({ name: "", phone: "", email: "", source: "" });
  const [editLead, setEditLead] = useState({ name: "", phone: "", email: "", source: "" });
  const [editStages, setEditStages] = useState<Stage[]>([]);
  const [newStageName, setNewStageName] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [filterTag, setFilterTag] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "phone">("recent");
  const [allTags, setAllTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [funnels, setFunnels] = useState<{ id: string; name: string }[]>([]);
  const [newLeadFunnel, setNewLeadFunnel] = useState("");
  const { toast } = useToast();
  const { limits } = useSubscription();

  const loadData = useCallback(async () => {
    try {
      const [stagesRes, leadsRes, tagsRes, funnelsRes] = await Promise.all([
        supabase.from("funnel_stages").select("*").order("order"),
        supabase.from("leads").select("*, lead_tags(tags(*)), notes(*)"),
        supabase.from("tags").select("id, name, color"),
        supabase.from("funnels").select("id, name").order("created_at"),
      ]);

      if (stagesRes.data && stagesRes.data.length > 0) setStages(stagesRes.data);
      if (funnelsRes.data) {
        setFunnels(funnelsRes.data);
        if (funnelsRes.data.length > 0 && !newLeadFunnel) setNewLeadFunnel(funnelsRes.data[0].id);
      }

      if (leadsRes.data) {
        setLeads(leadsRes.data.map((l: any) => ({
          ...l,
          archived: l.archived || false,
          tags: l.lead_tags?.map((lt: any) => lt.tags).filter(Boolean) || [],
          notes: l.notes || [],
        })));
      }

      if (tagsRes.data) setAllTags(tagsRes.data);
    } catch {
      // empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // === LEAD CRUD ===
  const handleAddLead = async () => {
    if (!newLead.name.trim()) { toast("Nome é obrigatório.", "warning"); return; }
    if (!newLead.phone.trim()) { toast("Telefone é obrigatório.", "warning"); return; }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const selectedFunnel = newLeadFunnel || funnels[0]?.id || null;
    const funnelStages = stages.filter((s: any) => !selectedFunnel || s.funnel_id === selectedFunnel);
    const selectedStage = newLeadStage && funnelStages.some((s) => s.id === newLeadStage) ? newLeadStage : funnelStages[0]?.id || null;

    if (!selectedFunnel || !selectedStage) {
      toast("É necessário ter um funil e etapa configurados para cadastrar um lead.", "warning");
      return;
    }

    const { data, error } = await supabase.from("leads").insert({
      user_id: userData.user.id,
      name: newLead.name,
      phone: newLead.phone,
      email: newLead.email || null,
      stage_id: selectedStage,
      funnel_id: selectedFunnel,
      source: newLead.source || null,
    }).select().single();

    if (!error && data) {
      setLeads((prev) => [...prev, { ...data, tags: [], notes: [] }]);
      setNewLead({ name: "", phone: "", email: "", source: "" });
      setNewLeadStage("");
      setShowAddLead(false);
    }
  };

  const handleUpdateLead = async () => {
    if (!selectedLead) return;
    if (!editLead.name.trim()) { toast("Nome é obrigatório.", "warning"); return; }
    if (!editLead.phone.trim()) { toast("Telefone é obrigatório.", "warning"); return; }

    const { error } = await supabase.from("leads").update({
      name: editLead.name,
      phone: editLead.phone,
      email: editLead.email || null,
      source: editLead.source || null,
    }).eq("id", selectedLead.id);

    if (!error) {
      const updated = { ...selectedLead, ...editLead };
      setLeads((prev) => prev.map((l) => l.id === selectedLead.id ? { ...l, ...editLead } : l));
      setSelectedLead(updated);
      setShowEditLead(false);
    }
  };

  const openEditLead = () => {
    if (!selectedLead) return;
    setEditLead({
      name: selectedLead.name,
      phone: selectedLead.phone,
      email: selectedLead.email || "",
      source: selectedLead.source || "",
    });
    setShowEditLead(true);
  };

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
      setNewTag("");
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!selectedLead) return;
    await supabase.from("lead_tags").delete().eq("lead_id", selectedLead.id).eq("tag_id", tagId);
    setLeads((prev) => prev.map((l) => l.id === selectedLead.id ? { ...l, tags: l.tags.filter((t) => t.id !== tagId) } : l));
    setSelectedLead((prev) => prev ? { ...prev, tags: prev.tags.filter((t) => t.id !== tagId) } : prev);
  };

  const handleArchiveLead = async (leadId: string, archive: boolean) => {
    await supabase.from("leads").update({ archived: archive }).eq("id", leadId);
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, archived: archive } : l));
    if (selectedLead?.id === leadId) setSelectedLead((prev) => prev ? { ...prev, archived: archive } : prev);
    setShowLeadDetail(false);
  };

  const handleDeleteLead = async (leadId: string) => {
    // Soft delete - set deleted_at instead of removing
    await supabase.from("leads").update({ deleted_at: new Date().toISOString() }).eq("id", leadId);
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    setShowLeadDetail(false);
    setSelectedLead(null);
  };

  // === FUNNEL CONFIG ===
  const openFunnelConfig = () => {
    setEditStages([...stages]);
    setShowFunnelConfig(true);
  };

  const handleSaveFunnel = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    for (let i = 0; i < editStages.length; i++) {
      const s = editStages[i];
      if (s.id.startsWith("temp-")) {
        const { data } = await supabase.from("funnel_stages").insert({
          user_id: userData.user.id, name: s.name, color: s.color, order: i,
        }).select().single();
        if (data) editStages[i] = { ...data, order: i };
      } else {
        await supabase.from("funnel_stages").update({ name: s.name, color: s.color, order: i }).eq("id", s.id);
      }
    }

    const removedIds = stages.filter((s) => !editStages.find((es) => es.id === s.id)).map((s) => s.id);
    for (const id of removedIds) {
      await supabase.from("funnel_stages").delete().eq("id", id);
    }

    setStages(editStages.map((s, i) => ({ ...s, order: i })));
    setShowFunnelConfig(false);
  };

  const moveStage = (index: number, direction: -1 | 1) => {
    const newArr = [...editStages];
    const target = index + direction;
    if (target < 0 || target >= newArr.length) return;
    [newArr[index], newArr[target]] = [newArr[target], newArr[index]];
    setEditStages(newArr);
  };

  const addNewStage = () => {
    if (!newStageName.trim()) return;
    const color = STAGE_COLORS[editStages.length % STAGE_COLORS.length];
    setEditStages([...editStages, { id: `temp-${Date.now()}`, name: newStageName, color, order: editStages.length }]);
    setNewStageName("");
  };

  const removeStage = (index: number) => {
    setEditStages(editStages.filter((_, i) => i !== index));
  };

  // === HELPERS ===
  const filteredLeads = leads
    .filter((l) => showArchived ? l.archived : !l.archived)
    .filter((l) =>
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.phone.includes(searchTerm) ||
      l.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter((l) => !filterTag || l.tags.some((t) => t.id === filterTag))
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "phone") return a.phone.localeCompare(b.phone);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-muted-foreground">
            Gerencie seus leads no funil de vendas
            <span className={cn("ml-2 text-xs font-mono px-2 py-0.5 rounded-full", leads.filter(l => !l.archived).length >= limits.max_leads && limits.max_leads !== Infinity ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground")}>
              {leads.filter(l => !l.archived).length.toLocaleString("pt-BR")}/{limits.max_leads === Infinity ? "∞" : limits.max_leads.toLocaleString("pt-BR")} leads
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openFunnelConfig}>
            <Settings2 className="h-4 w-4 mr-2" /> Configurar Funil
          </Button>
          {leads.filter(l => !l.archived).length >= limits.max_leads && limits.max_leads !== Infinity && (
            <Link href="/assinatura">
              <Button variant="outline" size="sm" className="text-xs">Fazer upgrade</Button>
            </Link>
          )}
          <Button onClick={() => {
            if (leads.filter(l => !l.archived).length >= limits.max_leads && limits.max_leads !== Infinity) {
              toast(`Limite de ${limits.max_leads.toLocaleString("pt-BR")} leads atingido. Fa\u00e7a upgrade do plano.`, "warning");
              return;
            }
            setShowAddLead(true);
          }}>
            <Plus className="h-4 w-4 mr-2" /> Novo Lead
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar leads..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        {allTags.length > 0 && (
          <Select value={filterTag} onValueChange={(v) => setFilterTag(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[160px] h-10"><Filter className="h-3.5 w-3.5 mr-1.5 shrink-0" /><SelectValue placeholder="Filtrar tag" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as tags</SelectItem>
              {allTags.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="w-[150px] h-10"><SortAsc className="h-3.5 w-3.5 mr-1.5 shrink-0" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Mais recentes</SelectItem>
            <SelectItem value="name">Nome A-Z</SelectItem>
            <SelectItem value="phone">Telefone</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={showArchived ? "secondary" : "outline"} size="sm" onClick={() => setShowArchived(!showArchived)}>
          <Archive className="h-4 w-4 mr-1.5" /> {showArchived ? "Arquivados" : "Ativos"}
        </Button>
      </div>

      {/* Leads List */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Lead</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Telefone</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Etapa</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Tags</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Origem</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Criado em</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    <Search className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>Nenhum lead encontrado</p>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const stage = stages.find((s) => s.id === lead.stage_id);
                  return (
                    <tr key={lead.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => { setSelectedLead(lead); setShowLeadDetail(true); }}>
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: stage?.color || "#8B5CF6" }}>
                            {getInitials(lead.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{lead.name}</p>
                            {lead.notes.length > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground"><StickyNote className="h-3 w-3" /> {lead.notes.length} nota{lead.notes.length > 1 ? "s" : ""}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">{formatPhone(lead.phone)}</td>
                      <td className="p-3 text-muted-foreground">{lead.email || "—"}</td>
                      <td className="p-3">
                        {stage && (
                          <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full" style={{ backgroundColor: stage.color + "20", color: stage.color }}>
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                            {stage.name}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {lead.tags.slice(0, 3).map((tag) => (
                            <span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: tag.color }}>{tag.name}</span>
                          ))}
                          {lead.tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{lead.tags.length - 3}</span>}
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">{lead.source || "—"}</td>
                      <td className="p-3 text-muted-foreground text-xs">{new Date(lead.created_at).toLocaleDateString("pt-BR")}</td>
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedLead(lead); openEditLead(); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleArchiveLead(lead.id, !lead.archived)}>
                            {lead.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteLead(lead.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredLeads.length > 0 && (
          <div className="p-3 border-t border-border text-xs text-muted-foreground">
            {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""} encontrado{filteredLeads.length !== 1 ? "s" : ""}
          </div>
        )}
      </Card>

      {/* Add Lead Dialog */}
      <Dialog open={showAddLead} onOpenChange={setShowAddLead}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
            <DialogDescription>Adicione um novo lead ao funil</DialogDescription>
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
            {funnels.length > 0 && (
              <div className="space-y-2">
                <Label>Funil</Label>
                <Select value={newLeadFunnel || funnels[0]?.id} onValueChange={(v) => { setNewLeadFunnel(v); setNewLeadStage(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {funnels.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Etapa</Label>
              <Select value={newLeadStage || stages.filter((s: any) => !newLeadFunnel || s.funnel_id === newLeadFunnel)[0]?.id} onValueChange={setNewLeadStage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stages.filter((s: any) => !newLeadFunnel || s.funnel_id === newLeadFunnel).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Origem</Label>
              <Input placeholder="Ex: WhatsApp, Hotmart, Site" value={newLead.source} onChange={(e) => setNewLead({ ...newLead, source: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLead(false)}>Cancelar</Button>
            <Button onClick={handleAddLead}>Adicionar</Button>
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
                  <Button variant="ghost" size="icon" className="ml-auto shrink-0" onClick={openEditLead}>
                    <Pencil className="h-4 w-4" />
                  </Button>
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
                  <SelectContent>{stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Tag className="h-3 w-3" /> Tags</Label>
                {/* Tags atuais do lead */}
                <div className="flex flex-wrap gap-1.5">
                  {selectedLead.tags.map((tag) => (
                    <span key={tag.id} className="text-xs px-2 py-1 rounded-full text-white flex items-center gap-1" style={{ backgroundColor: tag.color }}>
                      {tag.name}
                      <button onClick={() => handleRemoveTag(tag.id)}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
                {/* Tags disponíveis para adicionar (excluindo as já atribuídas) */}
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
                          style={{ ["--hover-bg" as any]: tag.color }}
                          onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = tag.color; }}
                          onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = "transparent"; }}
                        >
                          + {tag.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Criar nova tag */}
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

              {/* Archive & Delete */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleArchiveLead(selectedLead.id, !selectedLead.archived)}
                >
                  {selectedLead.archived ? <ArchiveRestore className="h-4 w-4 mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
                  {selectedLead.archived ? "Desarquivar" : "Arquivar"}
                </Button>
                <Button variant="destructive" size="sm" className="flex-1" onClick={() => handleDeleteLead(selectedLead.id)}>
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Lead Dialog */}
      <Dialog open={showEditLead} onOpenChange={setShowEditLead}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Lead</DialogTitle>
            <DialogDescription>Atualize as informações do lead</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={editLead.name} onChange={(e) => setEditLead({ ...editLead, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Telefone *</Label>
              <Input value={editLead.phone} onChange={(e) => setEditLead({ ...editLead, phone: formatPhoneInput(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={editLead.email} onChange={(e) => setEditLead({ ...editLead, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Origem</Label>
              <Input value={editLead.source} onChange={(e) => setEditLead({ ...editLead, source: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditLead(false)}>Cancelar</Button>
            <Button onClick={handleUpdateLead}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Funnel Config Dialog */}
      <Dialog open={showFunnelConfig} onOpenChange={setShowFunnelConfig}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Funil</DialogTitle>
            <DialogDescription>Personalize as etapas do seu funil de vendas</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[50vh] overflow-y-auto">
            {editStages.map((stage, i) => (
              <div key={stage.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/30">
                <input type="color" value={stage.color} onChange={(e) => {
                  const arr = [...editStages]; arr[i] = { ...arr[i], color: e.target.value }; setEditStages(arr);
                }} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                <Input value={stage.name} onChange={(e) => {
                  const arr = [...editStages]; arr[i] = { ...arr[i], name: e.target.value }; setEditStages(arr);
                }} className="flex-1 h-9" />
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStage(i, -1)} disabled={i === 0}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStage(i, 1)} disabled={i === editStages.length - 1}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeStage(i)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Input placeholder="Nova etapa..." value={newStageName} onChange={(e) => setNewStageName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNewStage()} className="h-9" />
              <Button size="sm" onClick={addNewStage}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFunnelConfig(false)}>Cancelar</Button>
            <Button onClick={handleSaveFunnel}>Salvar Funil</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
