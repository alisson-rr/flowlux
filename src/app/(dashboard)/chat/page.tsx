"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { evolutionApi } from "@/lib/evolution-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Send, Paperclip, Loader2, MessageSquare, Plus, Image, Video, FileUp, FileText, X, Phone, Mail, Globe, Tag, StickyNote, ChevronRight, Music, Filter, Download, Zap, Timer, Play,
} from "lucide-react";
import { cn, formatPhone, getInitials } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

interface Conversation { id: string; instance_id: string; remote_jid: string; contact_name: string; contact_phone: string; last_message: string; last_message_at: string; unread_count: number; }
interface ChatMessage { id: string; from_me: boolean; content: string; message_type: string; media_url?: string; status: string; created_at: string; }
interface LeadOption { id: string; name: string; phone: string; }
interface MediaItem { id: string; file_name: string; file_type: string; file_url: string; file_size: number; }
interface FlowOption { id: string; name: string; description: string; trigger_type: string; is_active: boolean; steps: FlowStepOption[]; }
interface FlowStepOption { id: string; step_order: number; step_type: string; content: string; media_url: string; file_name: string; delay_seconds: number; }

const TAG_COLORS = ["#8B5CF6", "#F97316", "#3B82F6", "#10B981", "#EF4444", "#EC4899", "#06B6D4", "#EAB308"];

interface InstanceOption { id: string; instance_name: string; }

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showNewConv, setShowNewConv] = useState(false);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [leadSearch, setLeadSearch] = useState("");

  // Instance selector
  const [instances, setInstances] = useState<InstanceOption[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");

  // Right panel state: "lead" | "media" | null
  const [rightPanel, setRightPanel] = useState<"lead" | "media" | null>(null);
  const [leadInfo, setLeadInfo] = useState<any>(null);
  const [newNote, setNewNote] = useState("");
  const [newTag, setNewTag] = useState("");
  const [templates, setTemplates] = useState<{ id: string; name: string; content: string }[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaTab, setMediaTab] = useState("templates");
  const [filterTag, setFilterTag] = useState("");
  const [allTags, setAllTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [convLeadTags, setConvLeadTags] = useState<Record<string, string[]>>({});

  // Media attachment to send with message
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  // Flows / Triggers
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [showFlowPicker, setShowFlowPicker] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<FlowOption | null>(null);
  const [showFlowPreview, setShowFlowPreview] = useState(false);
  const [executingFlow, setExecutingFlow] = useState(false);

  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };

  // === DATA LOADING (all parallel) ===
  const loadInitialData = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) { setLoading(false); return; }

      const [convsRes, leadsRes, templatesRes, mediaRes, tagsRes, leadTagsRes, instRes, flowsRes] = await Promise.all([
        supabase.from("conversations").select("*").eq("user_id", userId).order("last_message_at", { ascending: false }),
        supabase.from("leads").select("id, name, phone").eq("user_id", userId),
        supabase.from("message_templates").select("id, name, content").eq("user_id", userId),
        supabase.from("media").select("id, file_name, file_type, file_url, file_size").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("tags").select("id, name, color").eq("user_id", userId),
        supabase.from("leads").select("phone, lead_tags(tag_id)").eq("user_id", userId),
        supabase.from("whatsapp_instances").select("id, instance_name").eq("user_id", userId).is("deleted_at", null),
        supabase.from("flows").select("*, flow_steps(*)").eq("user_id", userId).eq("is_active", true).order("name"),
      ]);
      if (convsRes.data) setConversations(convsRes.data);
      if (leadsRes.data) setLeads(leadsRes.data);
      if (templatesRes.data) setTemplates(templatesRes.data);
      if (mediaRes.data) setMediaItems(mediaRes.data);
      if (tagsRes.data) setAllTags(tagsRes.data);
      if (instRes.data) {
        setInstances(instRes.data);
        if (instRes.data.length > 0 && !selectedInstanceId) {
          setSelectedInstanceId(instRes.data[0].id);
        }
      }
      if (flowsRes.data) {
        setFlows(flowsRes.data.map((f: any) => ({
          ...f,
          steps: (f.flow_steps || []).sort((a: any, b: any) => a.step_order - b.step_order),
        })));
      }
      if (leadTagsRes.data) {
        const map: Record<string, string[]> = {};
        leadTagsRes.data.forEach((l: any) => {
          const phone = l.phone.replace(/\D/g, "");
          map[phone] = l.lead_tags?.map((lt: any) => lt.tag_id) || [];
        });
        setConvLeadTags(map);
      }
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
    if (data) { setMessages(data); setTimeout(scrollToBottom, 100); }
  }, []);

  const loadLeadInfo = async (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const { data } = await supabase
      .from("leads")
      .select("*, lead_tags(tags(*)), notes(*)")
      .or(`phone.ilike.%${cleanPhone}%,phone.ilike.%${phone}%`)
      .limit(1)
      .single();

    if (data) {
      setLeadInfo({
        ...data,
        tags: data.lead_tags?.map((lt: any) => lt.tags).filter(Boolean) || [],
        notes: data.notes || [],
      });
    } else {
      setLeadInfo(null);
    }
    setRightPanel("lead");
  };

  const refreshTags = async () => {
    const [tagsRes, leadTagsRes] = await Promise.all([
      supabase.from("tags").select("id, name, color"),
      supabase.from("leads").select("phone, lead_tags(tag_id)"),
    ]);
    if (tagsRes.data) setAllTags(tagsRes.data);
    if (leadTagsRes.data) {
      const map: Record<string, string[]> = {};
      leadTagsRes.data.forEach((l: any) => { map[l.phone.replace(/\D/g, "")] = l.lead_tags?.map((lt: any) => lt.tag_id) || []; });
      setConvLeadTags(map);
    }
  };

  useEffect(() => {
    loadInitialData();

    const channel = supabase
      .channel("flowlux-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as ChatMessage;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(scrollToBottom, 100);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const conv = payload.new as Conversation;
          setConversations((prev) => {
            if (prev.some((c) => c.id === conv.id)) return prev;
            return [conv, ...prev];
          });
        } else if (payload.eventType === "UPDATE") {
          const conv = payload.new as Conversation;
          setConversations((prev) => prev.map((c) => c.id === conv.id ? { ...c, ...conv } : c));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadInitialData]);

  // === ACTIONS ===
  const handleStartConversation = async (lead: LeadOption) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const phone = lead.phone.replace(/\D/g, "");
    const remoteJid = phone.startsWith("55") ? `${phone}@s.whatsapp.net` : `55${phone}@s.whatsapp.net`;

    if (!selectedInstanceId) { toast("Selecione um WhatsApp primeiro.", "warning"); return; }

    const existing = conversations.find((c) => c.remote_jid === remoteJid && c.instance_id === selectedInstanceId);
    if (existing) { handleSelectConversation(existing); setShowNewConv(false); setLeadSearch(""); return; }

    const { data: conv } = await supabase.from("conversations").insert({
      user_id: userData.user.id, instance_id: selectedInstanceId, remote_jid: remoteJid,
      contact_name: lead.name, contact_phone: phone, unread_count: 0,
    }).select().single();

    if (conv) { setConversations((prev) => [conv, ...prev]); setSelectedConv(conv); setMessages([]); }
    setShowNewConv(false);
    setLeadSearch("");
  };

  const handleSelectConversation = async (conv: Conversation) => {
    setSelectedConv(conv);
    await loadMessages(conv.id);
    if (conv.unread_count > 0) {
      await supabase.from("conversations").update({ unread_count: 0 }).eq("id", conv.id);
      setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c)));
    }
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !selectedMedia) || !selectedConv || !selectedInstanceId) return;
    setSendingMessage(true);
    try {
      const inst = instances.find((i) => i.id === selectedInstanceId);
      if (!inst) { toast("Selecione um WhatsApp primeiro.", "warning"); setSendingMessage(false); return; }

      // Send media if selected
      if (selectedMedia) {
        const isAudio = selectedMedia.file_type === "audio";
        if (isAudio) {
          await evolutionApi.sendAudio(inst.instance_name, selectedConv.remote_jid, selectedMedia.file_url);
        } else {
          await evolutionApi.sendMedia(inst.instance_name, selectedConv.remote_jid, selectedMedia.file_url, selectedMedia.file_type, newMessage || "", selectedMedia.file_name);
        }
        await supabase.from("messages").insert({
          conversation_id: selectedConv.id, remote_jid: selectedConv.remote_jid, from_me: true,
          message_type: selectedMedia.file_type, content: isAudio ? "" : (newMessage || selectedMedia.file_name), media_url: selectedMedia.file_url, status: "sent",
        });
        setSelectedMedia(null);
      } else {
        // Text only
        await evolutionApi.sendText(inst.instance_name, selectedConv.remote_jid, newMessage);
        await supabase.from("messages").insert({
          conversation_id: selectedConv.id, remote_jid: selectedConv.remote_jid, from_me: true,
          message_type: "text", content: newMessage, status: "sent",
        });
      }

      await supabase.from("conversations").update({ last_message: newMessage || "[Mídia]", last_message_at: new Date().toISOString() }).eq("id", selectedConv.id);
      setNewMessage("");
    } catch (err: any) { console.error("Error sending message:", err); toast("Erro ao enviar mensagem: " + (err?.message || ""), "error"); } finally { setSendingMessage(false); }
  };

  const handleAddNote = async () => {
    if (!leadInfo || !newNote.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data, error } = await supabase.from("notes").insert({ lead_id: leadInfo.id, user_id: userData.user.id, content: newNote }).select().single();
    if (!error && data) {
      setLeadInfo((prev: any) => prev ? { ...prev, notes: [...prev.notes, data] } : prev);
      setNewNote("");
    }
  };

  const handleAddTag = async () => {
    if (!leadInfo || !newTag.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
    let { data: existingTag } = await supabase.from("tags").select().eq("name", newTag).eq("user_id", userData.user.id).single();
    if (!existingTag) {
      const { data: created } = await supabase.from("tags").insert({ name: newTag, color, user_id: userData.user.id }).select().single();
      existingTag = created;
    }
    if (existingTag) {
      await supabase.from("lead_tags").insert({ lead_id: leadInfo.id, tag_id: existingTag.id });
      setLeadInfo((prev: any) => prev ? { ...prev, tags: [...prev.tags, { id: existingTag!.id, name: existingTag!.name, color: existingTag!.color }] } : prev);
      setNewTag("");
      refreshTags();
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!leadInfo) return;
    await supabase.from("lead_tags").delete().eq("lead_id", leadInfo.id).eq("tag_id", tagId);
    setLeadInfo((prev: any) => prev ? { ...prev, tags: prev.tags.filter((t: any) => t.id !== tagId) } : prev);
    refreshTags();
  };

  // === EXECUTE FLOW ===
  const handleExecuteFlow = async () => {
    if (!selectedFlow || !selectedConv || !selectedInstanceId) return;
    setExecutingFlow(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const inst = instances.find((i) => i.id === selectedInstanceId);
      if (!inst) { toast("Selecione um WhatsApp.", "warning"); return; }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || "";

      const res = await fetch("/api/execute-flow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          flow_id: selectedFlow.id,
          user_id: userData.user.id,
          instance_id: selectedInstanceId,
          instance_name: inst.instance_name,
          remote_jid: selectedConv.remote_jid,
          conversation_id: selectedConv.id,
        }),
      });
      const result = await res.json();

      if (!res.ok) {
        console.error("Flow execution error:", result);
        toast("Erro ao executar fluxo: " + (result.error || "erro desconhecido"), "error");
      } else {
        setShowFlowPreview(false);
        setSelectedFlow(null);
      }
    } catch (err) {
      console.error("Flow execution error:", err);
      toast("Erro ao executar fluxo.", "error");
    } finally {
      setExecutingFlow(false);
    }
  };

  const getFlowStepIcon = (type: string) => {
    if (type === "text") return <MessageSquare className="h-4 w-4 text-blue-400" />;
    if (type === "image") return <Image className="h-4 w-4 text-green-400" />;
    if (type === "video") return <Video className="h-4 w-4 text-purple-400" />;
    if (type === "audio") return <Music className="h-4 w-4 text-pink-400" />;
    if (type === "document") return <FileUp className="h-4 w-4 text-orange-400" />;
    if (type === "delay") return <Timer className="h-4 w-4 text-yellow-400" />;
    return <MessageSquare className="h-4 w-4" />;
  };

  const getFlowStepLabel = (type: string) => {
    const labels: Record<string, string> = { text: "Texto", image: "Imagem", video: "Vídeo", audio: "Áudio", document: "Documento", delay: "Esperar" };
    return labels[type] || type;
  };

  // === FILTERS ===
  const filteredLeads = leads.filter((l) => l.name.toLowerCase().includes(leadSearch.toLowerCase()) || l.phone.includes(leadSearch));

  const filteredConversations = conversations.filter((c) => {
    const matchesSearch = c.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.contact_phone?.includes(searchTerm);
    if (!matchesSearch) return false;
    if (selectedInstanceId && c.instance_id !== selectedInstanceId) return false;
    if (!filterTag) return true;
    const phone = c.contact_phone?.replace(/\D/g, "") || "";
    return convLeadTags[phone]?.includes(filterTag);
  });

  const formatTime = (date: string) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Ontem";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  const getMediaByType = (type: string) => mediaItems.filter((m) => m.file_type === type);
  const getTypeIcon = (type: string) => {
    if (type === "image") return <Image className="h-4 w-4 text-green-400" />;
    if (type === "video") return <Video className="h-4 w-4 text-blue-400" />;
    if (type === "audio") return <Music className="h-4 w-4 text-purple-400" />;
    return <FileUp className="h-4 w-4 text-orange-400" />;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="animate-fade-in -m-6">
      <div className="flex h-[calc(100vh-0px)]">
        {/* Sidebar - Conversations */}
        <div className="w-[340px] border-r border-border flex flex-col bg-sidebar">
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Chat</h2>
              <Button size="sm" onClick={() => setShowNewConv(true)}>
                <Plus className="h-4 w-4 mr-1" /> Nova
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar conversas..." className="pl-10 bg-muted/50" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            {/* WhatsApp Instance - REQUIRED */}
            <div className={cn("rounded-lg border-2 p-2", selectedInstanceId ? "border-primary/50 bg-primary/5" : "border-destructive/50 bg-destructive/5")}>
              <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">WhatsApp ativo *</p>
              {instances.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum WhatsApp configurado</p>
              ) : (
                <Select value={selectedInstanceId || "none"} onValueChange={(v) => { setSelectedInstanceId(v === "none" ? "" : v); setSelectedConv(null); setMessages([]); }}>
                  <SelectTrigger className="h-8 text-xs"><MessageSquare className="h-3 w-3 mr-1.5" /><SelectValue placeholder="Selecione um WhatsApp" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione...</SelectItem>
                    {instances.map((inst) => <SelectItem key={inst.id} value={inst.id}>{inst.instance_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            {allTags.length > 0 && (
              <Select value={filterTag || "all"} onValueChange={(v) => setFilterTag(v === "all" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs"><Filter className="h-3 w-3 mr-1" /><SelectValue placeholder="Filtrar por tag" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as tags</SelectItem>
                  {allTags.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-4">
                <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm text-center">Nenhuma conversa encontrada</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <button key={conv.id} onClick={() => handleSelectConversation(conv)}
                  className={cn("w-full flex items-center gap-3 p-3 hover:bg-sidebar-hover transition-colors text-left border-b border-border/50", selectedConv?.id === conv.id && "bg-sidebar-hover")}>
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{getInitials(conv.contact_name || conv.contact_phone)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm truncate">{conv.contact_name || formatPhone(conv.contact_phone)}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(conv.last_message_at)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-muted-foreground truncate">{conv.last_message || "Sem mensagens"}</p>
                      {conv.unread_count > 0 && (
                        <span className="ml-2 w-5 h-5 rounded-full bg-primary text-[10px] font-bold text-white flex items-center justify-center shrink-0">{conv.unread_count}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedConv ? (
            <>
              {/* Chat Header */}
              <div className="h-16 border-b border-border flex items-center justify-between px-4 bg-card">
                <button className="flex items-center gap-3 hover:opacity-80 transition-opacity" onClick={() => loadLeadInfo(selectedConv.contact_phone)}>
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">{getInitials(selectedConv.contact_name || selectedConv.contact_phone)}</span>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm">{selectedConv.contact_name || formatPhone(selectedConv.contact_phone)}</p>
                    <p className="text-xs text-muted-foreground">{formatPhone(selectedConv.contact_phone)}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {/* Messages Column */}
                <div className="flex-1 flex flex-col">
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background/50">
                    {messages.map((msg) => (
                      <div key={msg.id} className={cn("flex", msg.from_me ? "justify-end" : "justify-start")}>
                        <div className={cn("max-w-[70%] rounded-2xl px-4 py-2.5 text-sm", msg.from_me ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card border border-border rounded-bl-md")}>
                          {msg.media_url && msg.message_type === "image" && (
                            <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="block mb-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={msg.media_url} alt="" className="rounded-lg max-h-48 w-auto object-cover" loading="lazy" />
                            </a>
                          )}
                          {msg.media_url && msg.message_type === "video" && (
                            <video src={msg.media_url} controls className="rounded-lg max-h-48 w-full mb-2" preload="metadata" />
                          )}
                          {msg.media_url && msg.message_type === "audio" && (
                            <div className="mb-2 min-w-[240px]">
                              <audio src={msg.media_url} controls className="w-full h-10" preload="metadata" />
                            </div>
                          )}
                          {msg.media_url && msg.message_type === "document" && (
                            <a href={msg.media_url} target="_blank" rel="noopener noreferrer"
                              className={cn("flex items-center gap-2 p-2 rounded-lg mb-2", msg.from_me ? "bg-primary-foreground/10" : "bg-muted")}>
                              <FileText className="h-5 w-5 shrink-0" />
                              <span className="text-xs truncate">{msg.content || "Documento"}</span>
                              <Download className="h-4 w-4 shrink-0 ml-auto" />
                            </a>
                          )}
                          {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                          <p className={cn("text-[10px] mt-1", msg.from_me ? "text-primary-foreground/60" : "text-muted-foreground")}>
                            {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="border-t border-border bg-card">
                    {/* Selected media thumbnail */}
                    {selectedMedia && (
                      <div className="px-3 pt-2 flex items-center gap-2">
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted text-xs">
                          {selectedMedia.file_type === "image" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={selectedMedia.file_url} alt="" className="h-10 w-10 rounded object-cover" />
                          ) : (
                            <div className="h-10 w-10 rounded bg-muted-foreground/10 flex items-center justify-center">
                              {selectedMedia.file_type === "video" ? <Video className="h-4 w-4 text-blue-400" /> : selectedMedia.file_type === "audio" ? <Music className="h-4 w-4 text-purple-400" /> : <FileUp className="h-4 w-4 text-orange-400" />}
                            </div>
                          )}
                          <span className="truncate max-w-[150px]">{selectedMedia.file_name}</span>
                          <button onClick={() => setSelectedMedia(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    )}
                    <div className="p-3 flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => { setRightPanel(rightPanel === "media" ? null : "media"); setMediaTab("templates"); }}>
                        <Paperclip className="h-5 w-5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setShowFlowPicker(true)} title="Gatilhos / Fluxos" disabled={flows.length === 0}>
                        <Zap className={cn("h-5 w-5", flows.length > 0 ? "text-yellow-500" : "text-muted-foreground")} />
                      </Button>
                      <Input
                        placeholder={selectedMedia?.file_type === "audio" ? "Áudio não suporta texto" : "Digite uma mensagem..."}
                        value={selectedMedia?.file_type === "audio" ? "" : newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                        className="flex-1 h-10"
                        disabled={selectedMedia?.file_type === "audio"}
                      />
                      <Button className="h-10 w-10" size="icon" onClick={handleSendMessage} disabled={sendingMessage || (!newMessage.trim() && !selectedMedia)}>
                        {sendingMessage ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* RIGHT PANEL: Lead Info */}
                {rightPanel === "lead" && (
                  <div className="w-[340px] border-l border-border bg-card overflow-y-auto shrink-0">
                    <div className="p-4 border-b border-border flex items-center justify-between">
                      <h3 className="font-semibold text-sm">Informações do Lead</h3>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRightPanel(null)}><X className="h-4 w-4" /></Button>
                    </div>
                    {leadInfo ? (
                      <div className="p-4 space-y-4">
                        <div className="text-center">
                          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                            <span className="text-lg font-bold text-primary">{getInitials(leadInfo.name)}</span>
                          </div>
                          <p className="font-medium">{leadInfo.name}</p>
                        </div>
                        {/* All contact info */}
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground p-2 rounded-md bg-muted/50">
                            <Phone className="h-4 w-4 shrink-0" /> {formatPhone(leadInfo.phone)}
                          </div>
                          {leadInfo.email && (
                            <div className="flex items-center gap-2 text-muted-foreground p-2 rounded-md bg-muted/50">
                              <Mail className="h-4 w-4 shrink-0" /> {leadInfo.email}
                            </div>
                          )}
                          {leadInfo.source && (
                            <div className="flex items-center gap-2 text-muted-foreground p-2 rounded-md bg-muted/50">
                              <Globe className="h-4 w-4 shrink-0" /> {leadInfo.source}
                            </div>
                          )}
                          {leadInfo.stage_id && (
                            <div className="flex items-center gap-2 text-muted-foreground p-2 rounded-md bg-muted/50">
                              <ChevronRight className="h-4 w-4 shrink-0" /> Etapa: {leadInfo.stage_id}
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-muted-foreground p-2 rounded-md bg-muted/50">
                            <StickyNote className="h-4 w-4 shrink-0" /> Criado: {new Date(leadInfo.created_at).toLocaleDateString("pt-BR")}
                          </div>
                        </div>

                        {/* Tags with add/remove */}
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground flex items-center gap-1"><Tag className="h-3 w-3" /> Tags</p>
                          <div className="flex flex-wrap gap-1">
                            {leadInfo.tags?.map((t: any) => (
                              <span key={t.id} className="text-[10px] px-2 py-0.5 rounded-full text-white flex items-center gap-1" style={{ backgroundColor: t.color }}>
                                {t.name}
                                <button onClick={() => handleRemoveTag(t.id)}><X className="h-2.5 w-2.5" /></button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-1.5">
                            <Input placeholder="Nova tag..." value={newTag} onChange={(e) => setNewTag(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleAddTag()} className="h-8 text-xs" />
                            <Button size="sm" variant="outline" className="h-8 px-2" onClick={handleAddTag}><Plus className="h-3 w-3" /></Button>
                          </div>
                        </div>

                        {/* Notes with add */}
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground flex items-center gap-1"><StickyNote className="h-3 w-3" /> Observações</p>
                          <div className="space-y-1.5 max-h-32 overflow-y-auto">
                            {leadInfo.notes?.map((n: any) => (
                              <div key={n.id} className="p-2 rounded-md bg-muted text-xs">
                                <p>{n.content}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleDateString("pt-BR")}</p>
                              </div>
                            ))}
                          </div>
                          <Textarea placeholder="Adicionar observação..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="min-h-[50px] text-xs" />
                          <Button size="sm" onClick={handleAddNote} className="w-full h-8 text-xs">Adicionar Nota</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 text-center text-muted-foreground space-y-3">
                        <p className="text-sm">Nenhum lead encontrado para este número</p>
                        <Button size="sm" className="w-full" onClick={async () => {
                          if (!selectedConv) return;
                          const { data: userData } = await supabase.auth.getUser();
                          if (!userData.user) return;
                          const phone = selectedConv.contact_phone;
                          const name = selectedConv.contact_name || phone;
                          const { data, error } = await supabase.from("leads").insert({
                            user_id: userData.user.id, name, phone, source: "WhatsApp",
                          }).select().single();
                          if (!error && data) {
                            toast("Lead criado com sucesso!", "success");
                            loadLeadInfo(phone);
                          } else {
                            toast("Erro ao criar lead.", "error");
                          }
                        }}>
                          <Plus className="h-4 w-4 mr-1.5" /> Criar Lead
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* RIGHT PANEL: Media & Templates */}
                {rightPanel === "media" && (
                  <div className="w-[340px] border-l border-border bg-card overflow-y-auto shrink-0">
                    <div className="p-4 border-b border-border flex items-center justify-between">
                      <h3 className="font-semibold text-sm">Mídia & Mensagens</h3>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRightPanel(null)}><X className="h-4 w-4" /></Button>
                    </div>
                    {/* Tabs */}
                    <div className="flex border-b border-border">
                      {[
                        { key: "templates", label: "Prontas", icon: FileText },
                        { key: "image", label: "Imagens", icon: Image },
                        { key: "video", label: "Vídeos", icon: Video },
                        { key: "audio", label: "Áudios", icon: Music },
                        { key: "document", label: "Arquivos", icon: FileUp },
                      ].map((tab) => (
                        <button key={tab.key} onClick={() => setMediaTab(tab.key)}
                          className={cn("flex-1 py-3 text-xs flex flex-col items-center gap-1 transition-colors",
                            mediaTab === tab.key ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                          )}>
                          <tab.icon className="h-5 w-5" />
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="p-3">
                      {mediaTab === "templates" ? (
                        <div className="space-y-2">
                          {templates.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma mensagem pronta. Crie em Mídia.</p>
                          ) : (
                            templates.map((tpl) => (
                              <button key={tpl.id} onClick={() => { setNewMessage(tpl.content); setRightPanel(null); }}
                                className="w-full p-2.5 rounded-lg border border-border hover:border-primary/40 transition-colors text-left">
                                <p className="font-medium text-xs">{tpl.name}</p>
                                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{tpl.content}</p>
                              </button>
                            ))
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {getMediaByType(mediaTab).length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">Nenhum arquivo. Faça upload em Mídia.</p>
                          ) : (
                            getMediaByType(mediaTab).map((item) => (
                              <button key={item.id} onClick={() => { setSelectedMedia(item); setRightPanel(null); }}
                                className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border border-border hover:border-primary/40 transition-colors text-left">
                                {item.file_type === "image" ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={item.file_url} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                                ) : (
                                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">{getTypeIcon(item.file_type)}</div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate">{item.file_name}</p>
                                  <p className="text-[10px] text-muted-foreground">{item.file_type}</p>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <MessageSquare className="h-10 w-10 opacity-30" />
              </div>
              <p className="text-lg font-medium">Selecione uma conversa</p>
              <p className="text-sm mt-1">Escolha uma conversa ao lado para começar</p>
            </div>
          )}
        </div>
      </div>

      {/* New Conversation Dialog */}
      <Dialog open={showNewConv} onOpenChange={setShowNewConv}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Conversa</DialogTitle>
            <DialogDescription>Selecione um lead para iniciar uma conversa</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar lead..." className="pl-10" value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} />
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {filteredLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum lead encontrado</p>
              ) : (
                filteredLeads.map((lead) => (
                  <button key={lead.id} onClick={() => handleStartConversation(lead)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left">
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{getInitials(lead.name)}</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{lead.name}</p>
                      <p className="text-xs text-muted-foreground">{formatPhone(lead.phone)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Flow Picker Dialog */}
      <Dialog open={showFlowPicker} onOpenChange={setShowFlowPicker}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-yellow-500" /> Gatilhos / Fluxos</DialogTitle>
            <DialogDescription>Selecione um fluxo para enviar ao contato</DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {flows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum fluxo ativo. Crie em Automação.</p>
            ) : (
              flows.map((flow) => (
                <button key={flow.id} onClick={() => { setSelectedFlow(flow); setShowFlowPicker(false); setShowFlowPreview(true); }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/40 transition-colors text-left">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{flow.name}</p>
                    {flow.description && <p className="text-xs text-muted-foreground truncate">{flow.description}</p>}
                    <div className="flex items-center gap-1.5 mt-1 overflow-x-auto">
                      {flow.steps.map((s, si) => (
                        <React.Fragment key={s.id}>
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
                            {getFlowStepIcon(s.step_type)}
                          </span>
                          {si < flow.steps.length - 1 && <span className="text-muted-foreground text-[8px]">→</span>}
                        </React.Fragment>
                      ))}
                      <span className="text-[10px] text-muted-foreground ml-1">{flow.steps.length} passo{flow.steps.length !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Flow Preview & Execute Dialog */}
      <Dialog open={showFlowPreview} onOpenChange={(open) => { setShowFlowPreview(open); if (!open) setSelectedFlow(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-yellow-500" /> {selectedFlow?.name}</DialogTitle>
            <DialogDescription>Revise a sequência de mensagens antes de enviar</DialogDescription>
          </DialogHeader>
          {selectedFlow && (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {selectedFlow.steps.map((step, i) => (
                <div key={step.id} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{i + 1}</div>
                    {i < selectedFlow.steps.length - 1 && <div className="w-0.5 h-4 bg-border mt-1" />}
                  </div>
                  <div className="flex-1 p-3 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center gap-2 mb-1">
                      {getFlowStepIcon(step.step_type)}
                      <span className="font-medium text-xs">{getFlowStepLabel(step.step_type)}</span>
                      {step.step_type === "delay" && (
                        <span className="text-[10px] text-muted-foreground">({step.delay_seconds}s)</span>
                      )}
                    </div>
                    {step.content && <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{step.content}</p>}
                    {step.media_url && step.step_type === "image" && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={step.media_url} alt="" className="h-16 w-auto rounded mt-1 object-cover" />
                    )}
                    {step.media_url && step.step_type !== "image" && step.file_name && (
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                        <FileUp className="h-3 w-3" /> {step.file_name}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Enviar para: <strong>{selectedConv?.contact_name || formatPhone(selectedConv?.contact_phone || "")}</strong>
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowFlowPreview(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleExecuteFlow} disabled={executingFlow}>
                {executingFlow ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Play className="h-4 w-4 mr-1.5" />}
                Executar Fluxo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
