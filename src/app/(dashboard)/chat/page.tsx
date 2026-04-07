"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { evolutionApi } from "@/lib/evolution-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Send, Paperclip, Loader2, MessageSquare, Plus, Image, Video, FileUp, FileText, X, Phone, Mail, Globe, Tag, StickyNote, ChevronRight, Music, Filter, Download, Zap, Timer, Play, Mic, Square, Trash2, CalendarClock, Clock, Pencil,
} from "lucide-react";
import { cn, formatPhone, getInitials, normalizePhone, phoneToJid, phoneVariants } from "@/lib/utils";
import { TAG_COLORS } from "@/lib/constants";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/auth-context";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useIncrementalDisplay } from "@/lib/use-incremental-display";
import { usePersistedState } from "@/lib/use-persisted-state";

interface Conversation { id: string; user_id?: string; instance_id: string; remote_jid: string; contact_name: string; contact_phone: string; last_message: string; last_message_at: string; unread_count: number; }
interface ChatMessage { id: string; conversation_id: string; from_me: boolean; content: string; message_type: string; media_url?: string; status: string; created_at: string; isOptimistic?: boolean; }
interface LeadOption { id: string; name: string; phone: string; }
interface MediaItem { id: string; file_name: string; file_type: string; file_url: string; file_size: number; }
interface FlowOption { id: string; name: string; description: string; trigger_type: string; is_active: boolean; steps: FlowStepOption[]; }
interface FlowStepOption { id: string; step_order: number; step_type: string; content: string; media_url: string; file_name: string; delay_seconds: number; }
interface ChatScheduledMessage {
  id: string;
  lead_id?: string | null;
  instance_id?: string | null;
  message: string;
  scheduled_at: string;
  status: string;
  media_url?: string | null;
  media_type?: string | null;
  file_name?: string | null;
  last_attempt_at?: string | null;
  sent_at?: string | null;
  failure_reason?: string | null;
  deleted_at?: string | null;
  leads?: { name?: string | null } | null;
}

const MESSAGES_PAGE_SIZE = 40;
const CONVERSATIONS_PAGE_SIZE = 50;

interface InstanceOption { id: string; instance_name: string; }

function getConversationRecencyValue(conversation: Pick<Conversation, "last_message_at">) {
  const timestamp = new Date(conversation.last_message_at || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortConversationsByRecent(conversations: Conversation[]) {
  return [...conversations].sort((a, b) => getConversationRecencyValue(b) - getConversationRecencyValue(a));
}

function buildLeadTagMap(rows: Array<{ phone?: string | null; lead_tags?: Array<{ tag_id?: string | null }> }> = []) {
  const map: Record<string, string[]> = {};

  rows.forEach((lead) => {
    const tagIds = (lead.lead_tags || [])
      .map((item) => item.tag_id)
      .filter((tagId): tagId is string => Boolean(tagId));

    if (tagIds.length === 0) return;

    phoneVariants(lead.phone || "").forEach((variant) => {
      if (!variant) return;
      map[variant] = Array.from(new Set([...(map[variant] || []), ...tagIds]));
    });
  });

  return map;
}

function getScheduledPreviewText(item: Pick<ChatScheduledMessage, "message" | "media_type" | "file_name">) {
  const message = item.message?.trim();
  if (message) return message;
  if (item.media_type === "image") return "[Imagem]";
  if (item.media_type === "video") return "[Video]";
  if (item.media_type === "audio") return "[Audio]";
  if (item.media_type === "document") return item.file_name || "[Documento]";
  return "[Mensagem agendada]";
}

function getScheduledStatusMeta(status: string) {
  if (status === "sent") {
    return { label: "Enviado", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" };
  }
  if (status === "failed") {
    return { label: "Falhou", className: "border-destructive/40 bg-destructive/10 text-destructive" };
  }
  if (status === "processing") {
    return { label: "Processando", className: "border-amber-500/30 bg-amber-500/10 text-amber-300" };
  }
  return { label: "Agendado", className: "border-primary/30 bg-primary/10 text-primary" };
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = usePersistedState("chat-search-term", "");
  const [loading, setLoading] = useState(true);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
  const [hasMoreConversationPages, setHasMoreConversationPages] = useState(false);
  const [conversationTotalCount, setConversationTotalCount] = useState(0);
  const [baseDataReady, setBaseDataReady] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showNewConv, setShowNewConv] = useState(false);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [loadingLeadOptions, setLoadingLeadOptions] = useState(false);
  const [hasLoadedLeadOptions, setHasLoadedLeadOptions] = useState(false);

  // Instance selector
  const [instances, setInstances] = useState<InstanceOption[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = usePersistedState<string>("chat-selected-instance-id", "");

  // Right panel state: "lead" | "media" | null
  const [rightPanel, setRightPanel] = useState<"lead" | "media" | null>(null);
  const [leadInfo, setLeadInfo] = useState<any>(null);
  const [loadingLeadInfo, setLoadingLeadInfo] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [newTag, setNewTag] = useState("");
  const [templates, setTemplates] = useState<{ id: string; name: string; content: string }[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaTab, setMediaTab] = useState("templates");
  const [filterTag, setFilterTag] = usePersistedState("chat-filter-tag", "");
  const [allTags, setAllTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [convLeadTags, setConvLeadTags] = useState<Record<string, string[]>>({});
  const [chatFunnels, setChatFunnels] = useState<{ id: string; name: string }[]>([]);
  const [chatStages, setChatStages] = useState<{ id: string; name: string; color: string; order: number; funnel_id: string }[]>([]);
  const [loadingMediaLibrary, setLoadingMediaLibrary] = useState(false);
  const [hasLoadedMediaLibrary, setHasLoadedMediaLibrary] = useState(false);
  const [loadingFlows, setLoadingFlows] = useState(false);
  const [hasLoadedFlows, setHasLoadedFlows] = useState(false);
  const [loadingLeadPanelMeta, setLoadingLeadPanelMeta] = useState(false);
  const [hasLoadedLeadPanelMeta, setHasLoadedLeadPanelMeta] = useState(false);

  // Media attachment to send with message
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  // Flows / Triggers
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [showFlowPicker, setShowFlowPicker] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<FlowOption | null>(null);
  const [showFlowPreview, setShowFlowPreview] = useState(false);
  const [executingFlow, setExecutingFlow] = useState(false);

  // Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null);

  // Schedule message from chat
  const getDefaultScheduledFormState = useCallback(() => ({
    lead_id: "",
    message: "",
    scheduled_at: "",
    instance_id: selectedInstanceId || instances[0]?.id || "",
    media_url: "",
    media_type: "",
    file_name: "",
  }), [instances, selectedInstanceId]);
  const [showScheduleMsg, setShowScheduleMsg] = useState(false);
  const [newScheduled, setNewScheduled] = useState(() => getDefaultScheduledFormState());
  const [chatScheduledMessages, setChatScheduledMessages] = useState<ChatScheduledMessage[]>([]);
  const [loadingScheduledMessages, setLoadingScheduledMessages] = useState(false);
  const [savingScheduledMessage, setSavingScheduledMessage] = useState(false);
  const [editingScheduledId, setEditingScheduledId] = useState<string | null>(null);

  // Avisos de campos faltantes
  const [missingFields, setMissingFields] = useState<string[]>([]);

  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedConversationRef = useRef<string | null>(null);
  const conversationOffsetRef = useRef(0);
  const initialConversationQueryDoneRef = useRef(false);
  const shouldStickToBottomRef = useRef(false);
  const preserveScrollHeightRef = useRef<number | null>(null);
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 220);
  const debouncedLeadSearch = useDebouncedValue(leadSearch, 220);
  const normalizedConversationSearch = debouncedSearchTerm.trim().toLowerCase();

  const normalizeConversationSearchInput = useCallback((value: string) => (
    value
      .trim()
      .replace(/[%_(),]/g, " ")
      .replace(/\s+/g, " ")
  ), []);

  const matchesConversationBaseFilters = useCallback((conversation: Conversation) => {
    if (selectedInstanceId && conversation.instance_id !== selectedInstanceId) return false;
    if (!normalizedConversationSearch) return true;

    return [
      conversation.contact_name || "",
      conversation.contact_phone || "",
      conversation.last_message || "",
    ].some((value) => value.toLowerCase().includes(normalizedConversationSearch));
  }, [normalizedConversationSearch, selectedInstanceId]);

  const matchesConversationTagFilter = useCallback((conversation: Conversation) => {
    if (!filterTag) return true;
    return phoneVariants(conversation.contact_phone || "").some((variant) => convLeadTags[variant]?.includes(filterTag));
  }, [convLeadTags, filterTag]);

  const updateConversationPreview = useCallback((conversationId: string, lastMessage: string, lastMessageAt: string) => {
    setConversations((prev) => {
      const index = prev.findIndex((conversation) => conversation.id === conversationId);
      if (index === -1) return prev;

      const updatedConversation = {
        ...prev[index],
        last_message: lastMessage,
        last_message_at: lastMessageAt,
      };

      return sortConversationsByRecent([
        updatedConversation,
        ...prev.slice(0, index),
        ...prev.slice(index + 1),
      ]);
    });

    setSelectedConv((prev) => (
      prev?.id === conversationId
        ? { ...prev, last_message: lastMessage, last_message_at: lastMessageAt }
        : prev
    ));
  }, []);

  const createOptimisticMessage = useCallback((payload: {
    conversationId: string;
    content: string;
    messageType: string;
    mediaUrl?: string;
    createdAt: string;
  }): ChatMessage => ({
    id: `optimistic-${payload.conversationId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    conversation_id: payload.conversationId,
    from_me: true,
    content: payload.content,
    message_type: payload.messageType,
    media_url: payload.mediaUrl,
    status: "sending",
    created_at: payload.createdAt,
    isOptimistic: true,
  }), []);

  const matchesOptimisticMessage = useCallback((optimisticMessage: ChatMessage, incomingMessage: ChatMessage) => {
    if (!optimisticMessage.isOptimistic || !optimisticMessage.from_me || !incomingMessage.from_me) return false;
    if (optimisticMessage.conversation_id !== incomingMessage.conversation_id) return false;
    if (optimisticMessage.message_type !== incomingMessage.message_type) return false;
    if ((optimisticMessage.media_url || "") !== (incomingMessage.media_url || "")) return false;
    if (optimisticMessage.content !== incomingMessage.content) return false;

    const optimisticTimestamp = new Date(optimisticMessage.created_at).getTime();
    const incomingTimestamp = new Date(incomingMessage.created_at).getTime();

    return Number.isFinite(optimisticTimestamp)
      && Number.isFinite(incomingTimestamp)
      && Math.abs(optimisticTimestamp - incomingTimestamp) < 60000;
  }, []);

  const reconcileLocalMessage = useCallback((conversationId: string, temporaryId: string, persistedMessage?: ChatMessage) => {
    if (selectedConversationRef.current !== conversationId) return;

    setMessages((prev) => {
      const temporaryIndex = prev.findIndex((message) => message.id === temporaryId);

      if (persistedMessage && prev.some((message) => message.id === persistedMessage.id)) {
        return temporaryIndex === -1
          ? prev
          : prev.filter((message) => message.id !== temporaryId);
      }

      if (temporaryIndex === -1) {
        return persistedMessage ? [...prev, persistedMessage] : prev;
      }

      if (!persistedMessage) {
        return prev.filter((message) => message.id !== temporaryId);
      }

      const next = [...prev];
      next[temporaryIndex] = persistedMessage;
      return next;
    });
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior });
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const isNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;

    return container.scrollHeight - container.scrollTop - container.clientHeight < 120;
  }, []);

  const appendLocalMessage = useCallback((message: ChatMessage) => {
    if (selectedConversationRef.current !== message.conversation_id) return;

    const shouldAutoScroll = isNearBottom();
    setMessages((prev) => [...prev, message]);
    if (shouldAutoScroll) {
      shouldStickToBottomRef.current = true;
    }
  }, [isNearBottom]);

  useEffect(() => {
    selectedConversationRef.current = selectedConv?.id || null;
  }, [selectedConv]);

  useEffect(() => {
    if (preserveScrollHeightRef.current !== null) {
      const container = messagesContainerRef.current;
      if (container) {
        const previousHeight = preserveScrollHeightRef.current;
        container.scrollTop = container.scrollHeight - previousHeight;
      }
      preserveScrollHeightRef.current = null;
      return;
    }

    if (shouldStickToBottomRef.current) {
      requestAnimationFrame(() => scrollToBottom());
      shouldStickToBottomRef.current = false;
    }
  }, [messages, scrollToBottom]);

  // Ajustar altura do textarea quando a mensagem mudar
  useEffect(() => {
    const textarea = document.querySelector('textarea[style*="height"]') as HTMLTextAreaElement;
    if (textarea && newMessage) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 220) + 'px';
    }
  }, [newMessage]);

  // Atualizar campos faltantes quando a mensagem mudar
  useEffect(() => {
    const currentMissingFields = checkMissingFields(newMessage);
    setMissingFields(currentMissingFields);
  }, [newMessage]);

  // Função para verificar parâmetros ainda presentes na mensagem
  const checkMissingFields = (message: string): string[] => {
    const missingFields: string[] = [];
    
    // Verificar se ainda há parâmetros na mensagem atual
    if (message.includes('{nome}')) missingFields.push('nome');
    if (message.includes('{email}')) missingFields.push('email');
    if (message.includes('{telefone}')) missingFields.push('telefone');
    
    return missingFields;
  };

  // Função para substituir parâmetros nos templates
  const replaceTemplateParameters = (template: string): { content: string; missingFields: string[] } => {
    if (!template) return { content: template, missingFields: [] };
    
    const missingFields: string[] = [];
    let processedContent = template;
    
    // Extrair primeiro nome
    const getFirstName = (fullName: string) => {
      if (!fullName) return '';
      const names = fullName.trim().split(' ');
      return names[0];
    };
    
    // Dados do contato/lead para substituição
    const contactName = getFirstName(selectedConv?.contact_name || leadInfo?.name || '');
    const contactEmail = leadInfo?.email || '';
    const contactPhone = selectedConv?.contact_phone || leadInfo?.phone || '';
    
    // Verificar campos faltantes apenas se o parâmetro ainda existe no texto
    if (template.includes('{nome}') && !contactName) missingFields.push('nome');
    if (template.includes('{email}') && !contactEmail) missingFields.push('email');
    if (template.includes('{telefone}') && !contactPhone) missingFields.push('telefone');
    
    // Substituir apenas se tiver informação
    if (contactName) processedContent = processedContent.replace(/{nome}/g, contactName);
    if (contactEmail) processedContent = processedContent.replace(/{email}/g, contactEmail);
    if (contactPhone) processedContent = processedContent.replace(/{telefone}/g, formatPhone(contactPhone));
    
    // Verificar quais parâmetros ainda permanecem sem substituição
    const remainingMissingFields = checkMissingFields(processedContent);
    
    return { content: processedContent, missingFields: remainingMissingFields };
  };

  // === DATA LOADING ===
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

  const formatDateTime = useCallback((value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "-", []);

  const loadConversationPage = useCallback(async ({
    reset = false,
    forceOffset,
    instanceIdOverride,
  }: {
    reset?: boolean;
    forceOffset?: number;
    instanceIdOverride?: string;
  } = {}) => {
    const userId = authUser?.id;

    if (!userId) {
      conversationOffsetRef.current = 0;
      setConversations([]);
      setConversationTotalCount(0);
      setHasMoreConversationPages(false);
      return;
    }

    const nextOffset = typeof forceOffset === "number"
      ? forceOffset
      : reset
        ? 0
        : conversationOffsetRef.current;
    const isPaginating = !reset && nextOffset > 0;

    if (isPaginating) {
      setLoadingMoreConversations(true);
    } else {
      setLoadingConversations(true);
    }

    try {
      const activeInstanceId = typeof instanceIdOverride === "string" ? instanceIdOverride : selectedInstanceId;
      const safeSearchTerm = normalizeConversationSearchInput(debouncedSearchTerm);

      let query = supabase
        .from("conversations")
        .select("*", { count: "exact" })
        .eq("user_id", userId)
        .order("last_message_at", { ascending: false })
        .range(nextOffset, nextOffset + CONVERSATIONS_PAGE_SIZE - 1);

      if (activeInstanceId) {
        query = query.eq("instance_id", activeInstanceId);
      }

      if (safeSearchTerm) {
        query = query.or(`contact_name.ilike.%${safeSearchTerm}%,contact_phone.ilike.%${safeSearchTerm}%,last_message.ilike.%${safeSearchTerm}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const nextPage = sortConversationsByRecent((data || []) as Conversation[]);
      const nextCount = count ?? nextOffset + nextPage.length;
      const updatedOffset = nextOffset + nextPage.length;

      conversationOffsetRef.current = updatedOffset;
      setConversationTotalCount(nextCount);
      setHasMoreConversationPages(updatedOffset < nextCount);
      setConversations((prev) => (
        reset
          ? nextPage
          : sortConversationsByRecent([
            ...prev.filter((existing) => !nextPage.some((incoming) => incoming.id === existing.id)),
            ...nextPage,
          ])
      ));
    } catch (error) {
      console.error("Error loading conversations:", error);
      if (reset) {
        conversationOffsetRef.current = 0;
        setConversations([]);
        setConversationTotalCount(0);
        setHasMoreConversationPages(false);
      }
    } finally {
      if (isPaginating) {
        setLoadingMoreConversations(false);
      } else {
        setLoadingConversations(false);
      }
    }
  }, [authUser, debouncedSearchTerm, normalizeConversationSearchInput, selectedInstanceId]);

  const loadInitialData = useCallback(async () => {
    try {
      const userId = authUser?.id;
      setBaseDataReady(false);

      if (!userId) {
        conversationOffsetRef.current = 0;
        setConversations([]);
        setAllTags([]);
        setConvLeadTags({});
        setInstances([]);
        setConversationTotalCount(0);
        setHasMoreConversationPages(false);
        setBaseDataReady(false);
        setLoading(false);
        return;
      }

      const [tagsRes, leadTagsRes, instRes] = await Promise.all([
        supabase.from("tags").select("id, name, color").eq("user_id", userId),
        supabase.from("leads").select("phone, lead_tags(tag_id)").eq("user_id", userId).is("deleted_at", null),
        supabase.from("whatsapp_instances").select("id, instance_name").eq("user_id", userId).is("deleted_at", null),
      ]);

      if (tagsRes.data) setAllTags(tagsRes.data);
      if (instRes.data) {
        setInstances(instRes.data);
        if (instRes.data.length > 0) {
          setSelectedInstanceId((current) => instRes.data.some((instance) => instance.id === current) ? current : instRes.data[0].id);
        } else {
          setSelectedInstanceId("");
        }
      } else {
        setInstances([]);
        setSelectedInstanceId("");
      }

      if (leadTagsRes.data) {
        setConvLeadTags(buildLeadTagMap(leadTagsRes.data));
      }
    } catch {
      // ignore
    } finally {
      setBaseDataReady(true);
    }
  }, [authUser, setSelectedInstanceId]);

  const ensureLeadOptionsLoaded = useCallback(async () => {
    if (!authUser) return leads;
    if (hasLoadedLeadOptions) return leads;
    if (loadingLeadOptions) return leads;

    setLoadingLeadOptions(true);
    try {
      const { data } = await supabase
        .from("leads")
        .select("id, name, phone")
        .eq("user_id", authUser.id)
        .is("deleted_at", null)
        .order("name");

      if (data) {
        setLeads(data);
        setHasLoadedLeadOptions(true);
        return data;
      }
    } finally {
      setLoadingLeadOptions(false);
    }

    return leads;
  }, [authUser, hasLoadedLeadOptions, leads, loadingLeadOptions]);

  const ensureMediaLibraryLoaded = useCallback(async () => {
    if (!authUser || hasLoadedMediaLibrary || loadingMediaLibrary) return;

    setLoadingMediaLibrary(true);
    try {
      const [templatesRes, mediaRes] = await Promise.all([
        supabase.from("message_templates").select("id, name, content").eq("user_id", authUser.id).order("name"),
        supabase.from("media").select("id, file_name, file_type, file_url, file_size").eq("user_id", authUser.id).order("created_at", { ascending: false }),
      ]);

      if (templatesRes.data) setTemplates(templatesRes.data);
      if (mediaRes.data) setMediaItems(mediaRes.data);
      setHasLoadedMediaLibrary(true);
    } finally {
      setLoadingMediaLibrary(false);
    }
  }, [authUser, hasLoadedMediaLibrary, loadingMediaLibrary]);

  const ensureFlowsLoaded = useCallback(async () => {
    if (!authUser || hasLoadedFlows || loadingFlows) return;

    setLoadingFlows(true);
    try {
      const { data } = await supabase
        .from("flows")
        .select("*, flow_steps(*)")
        .eq("user_id", authUser.id)
        .eq("is_active", true)
        .order("name");

      if (data) {
        setFlows(data.map((flow: any) => ({
          ...flow,
          steps: (flow.flow_steps || []).sort((a: any, b: any) => a.step_order - b.step_order),
        })));
        setHasLoadedFlows(true);
      }
    } finally {
      setLoadingFlows(false);
    }
  }, [authUser, hasLoadedFlows, loadingFlows]);

  const ensureLeadPanelMetaLoaded = useCallback(async () => {
    if (!authUser || hasLoadedLeadPanelMeta || loadingLeadPanelMeta) return;

    setLoadingLeadPanelMeta(true);
    try {
      const [funnelsRes, stagesRes] = await Promise.all([
        supabase.from("funnels").select("id, name").eq("user_id", authUser.id).order("created_at"),
        supabase.from("funnel_stages").select("id, name, color, order, funnel_id").eq("user_id", authUser.id).order("order"),
      ]);

      if (funnelsRes.data) setChatFunnels(funnelsRes.data);
      if (stagesRes.data) setChatStages(stagesRes.data);
      setHasLoadedLeadPanelMeta(true);
    } finally {
      setLoadingLeadPanelMeta(false);
    }
  }, [authUser, hasLoadedLeadPanelMeta, loadingLeadPanelMeta]);

  const fetchMessagesPage = useCallback(async (conversationId: string, beforeCreatedAt?: string) => {
    let query = supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(MESSAGES_PAGE_SIZE);

    if (beforeCreatedAt) {
      query = query.lt("created_at", beforeCreatedAt);
    }

    const { data } = await query;
    const nextMessages = (data || []).slice().reverse();

    return {
      messages: nextMessages,
      hasMore: (data || []).length === MESSAGES_PAGE_SIZE,
    };
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    setHasOlderMessages(false);
    try {
      const result = await fetchMessagesPage(conversationId);
      shouldStickToBottomRef.current = true;
      setMessages(result.messages);
      setHasOlderMessages(result.hasMore);
    } finally {
      setLoadingMessages(false);
    }
  }, [fetchMessagesPage]);

  const loadOlderMessages = useCallback(async () => {
    if (loadingMessages || loadingOlderMessages || !hasOlderMessages) return;

    const conversationId = selectedConversationRef.current;
    const oldestMessage = messages[0];

    if (!conversationId || !oldestMessage) return;

    const container = messagesContainerRef.current;
    preserveScrollHeightRef.current = container?.scrollHeight ?? null;
    setLoadingOlderMessages(true);

    try {
      const result = await fetchMessagesPage(conversationId, oldestMessage.created_at);
      setMessages((current) => {
        const nextIds = new Set(current.map((message) => message.id));
        const olderMessages = result.messages.filter((message) => !nextIds.has(message.id));
        return olderMessages.length > 0 ? [...olderMessages, ...current] : current;
      });
      setHasOlderMessages(result.hasMore);
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [fetchMessagesPage, hasOlderMessages, loadingMessages, loadingOlderMessages, messages]);

  const loadScheduledMessagesForLead = useCallback(async (leadId: string) => {
    if (!authUser) {
      setChatScheduledMessages([]);
      return [];
    }

    setLoadingScheduledMessages(true);
    try {
      const { data, error } = await supabase
        .from("scheduled_messages")
        .select("id, lead_id, instance_id, message, scheduled_at, status, media_url, media_type, file_name, last_attempt_at, sent_at, failure_reason, deleted_at, leads(name)")
        .eq("user_id", authUser.id)
        .eq("lead_id", leadId)
        .is("deleted_at", null)
        .neq("status", "cancelled")
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true });

      if (error) throw error;

      const items = (data || []) as ChatScheduledMessage[];
      setChatScheduledMessages(items);
      return items;
    } catch (error) {
      console.error("Error loading scheduled messages for lead:", error);
      setChatScheduledMessages([]);
      return [];
    } finally {
      setLoadingScheduledMessages(false);
    }
  }, [authUser]);

  const loadLeadInfo = useCallback(async (phone: string) => {
    setRightPanel("lead");
    setLoadingLeadInfo(true);

    try {
      if (!authUser) {
        setLeadInfo(null);
        setChatScheduledMessages([]);
        return null;
      }

      await ensureLeadPanelMetaLoaded();

      const leadOptions = await ensureLeadOptionsLoaded();
      const convVariants = phoneVariants(phone);
      const matchedLead = leadOptions.find((lead) => {
        const leadVariants = phoneVariants(lead.phone || "");
        return convVariants.some((variant) => leadVariants.includes(variant));
      });

      if (!matchedLead) {
        setLeadInfo(null);
        setChatScheduledMessages([]);
        return null;
      }

      const { data } = await supabase
        .from("leads")
        .select("*, lead_tags(tags(*)), notes(*)")
        .eq("id", matchedLead.id)
        .single();

      if (data) {
        const nextLead = {
          ...data,
          tags: data.lead_tags?.map((item: any) => item.tags).filter(Boolean) || [],
          notes: data.notes || [],
        };
        setLeadInfo(nextLead);
        await loadScheduledMessagesForLead(nextLead.id);
        return nextLead;
      } else {
        setLeadInfo(null);
        setChatScheduledMessages([]);
        return null;
      }
    } finally {
      setLoadingLeadInfo(false);
    }
  }, [authUser, ensureLeadOptionsLoaded, ensureLeadPanelMetaLoaded, loadScheduledMessagesForLead]);

  const refreshTags = async () => {
    if (!authUser) return;

    const [tagsRes, leadTagsRes] = await Promise.all([
      supabase.from("tags").select("id, name, color").eq("user_id", authUser.id),
      supabase.from("leads").select("phone, lead_tags(tag_id)").eq("user_id", authUser.id).is("deleted_at", null),
    ]);
    if (tagsRes.data) setAllTags(tagsRes.data);
    if (leadTagsRes.data) {
      setConvLeadTags(buildLeadTagMap(leadTagsRes.data));
    }
  };

  useEffect(() => {
    initialConversationQueryDoneRef.current = false;

    if (!authUser?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    loadInitialData();
  }, [authUser?.id, loadInitialData]);

  useEffect(() => {
    if (!authUser?.id || !baseDataReady) return;

    let cancelled = false;

    loadConversationPage({ reset: true, forceOffset: 0 }).finally(() => {
      if (cancelled) return;
      if (!initialConversationQueryDoneRef.current) {
        initialConversationQueryDoneRef.current = true;
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [authUser?.id, baseDataReady, debouncedSearchTerm, loadConversationPage, selectedInstanceId]);

  useEffect(() => {
    const conversationId = selectedConv?.id;
    if (!conversationId) return;

    const channel = supabase
      .channel(`flowlux-chat-messages-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const msg = payload.new as ChatMessage;
        const shouldAutoScroll = isNearBottom();
        setMessages((prev) => {
          if (prev.some((message) => message.id === msg.id)) return prev;
          const optimisticIndex = prev.findIndex((message) => matchesOptimisticMessage(message, msg));
          if (optimisticIndex !== -1) {
            const next = [...prev];
            next[optimisticIndex] = msg;
            return next;
          }
          return [...prev, msg];
        });
        if (shouldAutoScroll) {
          shouldStickToBottomRef.current = true;
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isNearBottom, matchesOptimisticMessage, selectedConv?.id]);

  useEffect(() => {
    const userId = authUser?.id;
    if (!userId) return;

    const channel = supabase
      .channel(`flowlux-chat-conversations-${userId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "conversations",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (payload.eventType === "INSERT") {
          const newConversation = payload.new as Conversation;
          if (!matchesConversationBaseFilters(newConversation)) return;

          setConversationTotalCount((prev) => prev + 1);
          setConversations((prev) => (
            prev.some((conversation) => conversation.id === newConversation.id)
              ? prev
              : sortConversationsByRecent([newConversation, ...prev])
          ));
          return;
        }

        if (payload.eventType === "UPDATE") {
          const previousConversation = payload.old as Conversation;
          const nextConversation = payload.new as Conversation;
          const didMatchBefore = matchesConversationBaseFilters(previousConversation);
          const matchesNow = matchesConversationBaseFilters(nextConversation);

          if (!didMatchBefore && matchesNow) {
            setConversationTotalCount((prev) => prev + 1);
          } else if (didMatchBefore && !matchesNow) {
            setConversationTotalCount((prev) => Math.max(prev - 1, 0));
          }

          setConversations((prev) => {
            const exists = prev.some((conversation) => conversation.id === nextConversation.id);
            if (!matchesNow) {
              return exists
                ? prev.filter((conversation) => conversation.id !== nextConversation.id)
                : prev;
            }

            if (!exists) {
              return sortConversationsByRecent([nextConversation, ...prev]);
            }

            const updated = prev.map((conversation) => (
              conversation.id === nextConversation.id
                ? { ...conversation, ...nextConversation }
                : conversation
            ));
            return sortConversationsByRecent(updated);
          });

          setSelectedConv((prev) => (prev?.id === nextConversation.id ? { ...prev, ...nextConversation } : prev));
          return;
        }

        if (payload.eventType === "DELETE") {
          const removedConversation = payload.old as Conversation;
          if (matchesConversationBaseFilters(removedConversation)) {
            setConversationTotalCount((prev) => Math.max(prev - 1, 0));
          }

          setConversations((prev) => prev.filter((conversation) => conversation.id !== removedConversation.id));

          if (selectedConversationRef.current === removedConversation.id) {
            selectedConversationRef.current = null;
            setSelectedConv(null);
            setMessages([]);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser?.id, matchesConversationBaseFilters]);

  useEffect(() => {
    if (showNewConv) {
      ensureLeadOptionsLoaded();
    }
  }, [ensureLeadOptionsLoaded, showNewConv]);

  useEffect(() => {
    if (showFlowPicker) {
      ensureFlowsLoaded();
    }
  }, [ensureFlowsLoaded, showFlowPicker]);

  useEffect(() => {
    if (rightPanel === "media") {
      ensureMediaLibraryLoaded();
    }
  }, [ensureMediaLibraryLoaded, rightPanel]);

  // === ACTIONS ===
  const handleStartConversation = async (lead: LeadOption) => {
    if (!authUser) return;

    const normalized = normalizePhone(lead.phone);
    if (!normalized) { toast("Telefone inválido.", "warning"); return; }

    const remoteJid = phoneToJid(normalized);
    const jidPhone = remoteJid.replace("@s.whatsapp.net", "");

    if (!selectedInstanceId) { toast("Selecione um WhatsApp primeiro.", "warning"); return; }

    // Check existing conversation considering all phone variants (with/without 9th digit, country code)
    const variants = phoneVariants(normalized);
    const jidVariants = variants.filter((v: string) => v.startsWith("55")).map((v: string) => `${v}@s.whatsapp.net`);
    jidVariants.push(remoteJid);
    const existing = conversations.find((c) => jidVariants.includes(c.remote_jid) && c.instance_id === selectedInstanceId);
    if (existing) { handleSelectConversation(existing); setShowNewConv(false); setLeadSearch(""); return; }

    const { data: conv } = await supabase.from("conversations").insert({
      user_id: authUser.id, instance_id: selectedInstanceId, remote_jid: remoteJid,
      contact_name: lead.name, contact_phone: jidPhone, unread_count: 0,
    }).select().single();

    if (conv) {
      selectedConversationRef.current = conv.id;
      setConversations((prev) => sortConversationsByRecent([conv, ...prev]));
      setSelectedConv(conv);
      setMessages([]);
    }
    setShowNewConv(false);
    setLeadSearch("");
  };

  const handleSelectConversation = async (conv: Conversation) => {
    selectedConversationRef.current = conv.id;
    setSelectedConv(conv);
    setRightPanel(null);
    setLeadInfo(null);
    preserveScrollHeightRef.current = null;
    shouldStickToBottomRef.current = false;
    setMessages([]);
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
        const proxyRes = await fetch("/api/send-media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: isAudio ? "audio" : "media",
            instance_name: inst.instance_name,
            number: selectedConv.remote_jid,
            media_url: selectedMedia.file_url,
            media_type: selectedMedia.file_type,
            caption: isAudio ? "" : (newMessage || ""),
            file_name: selectedMedia.file_name,
            user_id: authUser?.id || null,
            conversation_id: selectedConv.id,
          }),
        });
        if (!proxyRes.ok) {
          const err = await proxyRes.json().catch(() => ({}));
          throw new Error(err.error || "Erro ao enviar mídia");
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
    if (!leadInfo || !newNote.trim() || !authUser) return;
    const { data, error } = await supabase.from("notes").insert({ lead_id: leadInfo.id, user_id: authUser.id, content: newNote }).select().single();
    if (!error && data) {
      setLeadInfo((prev: any) => prev ? { ...prev, notes: [...prev.notes, data] } : prev);
      setNewNote("");
    }
  };

  const handleAddTag = async () => {
    if (!leadInfo || !newTag.trim() || !authUser) return;
    const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
    let { data: existingTag } = await supabase.from("tags").select().eq("name", newTag).eq("user_id", authUser.id).single();
    if (!existingTag) {
      const { data: created } = await supabase.from("tags").insert({ name: newTag, color, user_id: authUser.id }).select().single();
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
      if (!authUser) return;
      const inst = instances.find((i) => i.id === selectedInstanceId);
      if (!inst) { toast("Selecione um WhatsApp.", "warning"); return; }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || "";

      // Fire-and-forget: don't block UI waiting for all steps to complete
      setShowFlowPreview(false);
      setSelectedFlow(null);
      setExecutingFlow(false);
      toast("Fluxo enfileirado! O worker vai processar as etapas em segundo plano.", "success");

      fetch("/api/execute-flow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          flow_id: selectedFlow.id,
          user_id: authUser.id,
          instance_id: selectedInstanceId,
          instance_name: inst.instance_name,
          remote_jid: selectedConv.remote_jid,
          conversation_id: selectedConv.id,
        }),
      }).then(async (res) => {
        if (!res.ok) {
          const result = await res.json().catch(() => ({}));
          console.error("Flow execution error:", result);
          toast("Erro no fluxo: " + (result.error || "erro desconhecido"), "error");
        }
      }).catch((err) => {
        console.error("Flow execution error:", err);
        toast("Erro ao executar fluxo.", "error");
      });
      return;
    } catch (err) {
      console.error("Flow execution error:", err);
      toast("Erro ao executar fluxo.", "error");
    } finally {
      setExecutingFlow(false);
    }
  };

  // === AUDIO RECORDING ===
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setRecordingTime(0);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm;codecs=opus" });
        setRecordedAudioBlob(blob);
        setRecordedAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      toast("Não foi possível acessar o microfone.", "error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  };

  const discardRecording = () => {
    if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
    setRecordedAudioBlob(null);
    setRecordedAudioUrl(null);
    setRecordingTime(0);
    setIsPlayingRecording(false);
    if (recordedAudioRef.current) { recordedAudioRef.current.pause(); recordedAudioRef.current = null; }
  };

  const togglePlayRecording = () => {
    if (!recordedAudioUrl) return;
    if (isPlayingRecording && recordedAudioRef.current) {
      recordedAudioRef.current.pause();
      setIsPlayingRecording(false);
    } else {
      const audio = new Audio(recordedAudioUrl);
      recordedAudioRef.current = audio;
      audio.onended = () => setIsPlayingRecording(false);
      audio.play();
      setIsPlayingRecording(true);
    }
  };

  const sendRecordedAudio = async () => {
    if (!recordedAudioBlob || !selectedConv || !selectedInstanceId) return;
    setSendingMessage(true);
    try {
      const inst = instances.find((i) => i.id === selectedInstanceId);
      if (!inst) { toast("Selecione um WhatsApp.", "warning"); setSendingMessage(false); return; }

      if (!authUser) { setSendingMessage(false); return; }

      const fileName = `audio_${Date.now()}.webm`;
      const filePath = `media/${authUser.id}/${fileName}`;
      const { error: upErr } = await supabase.storage.from("public_bucket").upload(filePath, recordedAudioBlob, { cacheControl: "3600", contentType: "audio/webm", upsert: true });
      if (upErr) { toast("Erro ao fazer upload do áudio.", "error"); setSendingMessage(false); return; }

      const { data: urlData } = supabase.storage.from("public_bucket").getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) { toast("Erro ao obter URL do áudio.", "error"); setSendingMessage(false); return; }

      const proxyRes = await fetch("/api/send-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "audio",
          instance_name: inst.instance_name,
          number: selectedConv.remote_jid,
          media_url: publicUrl,
          user_id: authUser.id,
          conversation_id: selectedConv.id,
        }),
      });
      if (!proxyRes.ok) {
        const err = await proxyRes.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao enviar áudio");
      }
      await Promise.all([
        supabase.from("messages").insert({
          conversation_id: selectedConv.id, remote_jid: selectedConv.remote_jid, from_me: true,
          message_type: "audio", content: "", media_url: publicUrl, status: "sent",
        }),
        supabase.from("conversations").update({ last_message: "[Áudio]", last_message_at: new Date().toISOString() }).eq("id", selectedConv.id),
      ]);
      discardRecording();
    } catch (err: any) {
      console.error("Error sending recorded audio:", err);
      toast("Erro ao enviar áudio: " + (err?.message || ""), "error");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSendMessageOptimized = async () => {
    if (sendingMessage || (!newMessage.trim() && !selectedMedia) || !selectedConv || !selectedInstanceId) return;

    const conversation = selectedConv;
    const draftMessage = newMessage;
    const draftMedia = selectedMedia;
    const sentAt = new Date().toISOString();
    const isAudioMedia = draftMedia?.file_type === "audio";
    const messageType = draftMedia ? draftMedia.file_type : "text";
    const messageContent = draftMedia
      ? (isAudioMedia ? "" : (draftMessage || draftMedia.file_name))
      : draftMessage;
    const conversationPreview = draftMedia
      ? (isAudioMedia ? "[Áudio]" : (draftMessage || draftMedia.file_name || "[Mídia]"))
      : draftMessage;
    const optimisticMessage = createOptimisticMessage({
      conversationId: conversation.id,
      content: messageContent,
      messageType,
      mediaUrl: draftMedia?.file_url,
      createdAt: sentAt,
    });

    setSendingMessage(true);
    const inst = instances.find((i) => i.id === selectedInstanceId);
    if (!inst) {
      toast("Selecione um WhatsApp primeiro.", "warning");
      setSendingMessage(false);
      return;
    }

    setNewMessage("");
    setSelectedMedia(null);
    appendLocalMessage(optimisticMessage);
    updateConversationPreview(conversation.id, conversationPreview, sentAt);

    try {
      if (draftMedia) {
        const proxyRes = await fetch("/api/send-media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: isAudioMedia ? "audio" : "media",
            instance_name: inst.instance_name,
            number: conversation.remote_jid,
            media_url: draftMedia.file_url,
            media_type: draftMedia.file_type,
            caption: isAudioMedia ? "" : (draftMessage || ""),
            file_name: draftMedia.file_name,
            user_id: authUser?.id || null,
            conversation_id: conversation.id,
          }),
        });
        if (!proxyRes.ok) {
          const err = await proxyRes.json().catch(() => ({}));
          throw new Error(err.error || "Erro ao enviar mídia");
        }
      } else {
        await evolutionApi.sendText(inst.instance_name, conversation.remote_jid, draftMessage);
      }

      const [messageInsert, conversationUpdate] = await Promise.all([
        supabase.from("messages").insert({
          conversation_id: conversation.id,
          remote_jid: conversation.remote_jid,
          from_me: true,
          message_type: messageType,
          content: messageContent,
          media_url: draftMedia?.file_url,
          status: "sent",
        }).select().single(),
        supabase.from("conversations")
          .update({ last_message: conversationPreview, last_message_at: sentAt })
          .eq("id", conversation.id),
      ]);

      if (messageInsert.data) {
        reconcileLocalMessage(conversation.id, optimisticMessage.id, messageInsert.data as ChatMessage);
      }

      if (messageInsert.error || conversationUpdate.error) {
        console.error("Chat sync error after send:", {
          messageError: messageInsert.error,
          conversationError: conversationUpdate.error,
        });
        toast("Mensagem enviada, mas houve falha ao sincronizar o histórico.", "warning");
      }
    } catch (err: any) {
      console.error("Error sending message:", err);
      reconcileLocalMessage(conversation.id, optimisticMessage.id);
      updateConversationPreview(conversation.id, conversation.last_message, conversation.last_message_at);

      if (selectedConversationRef.current === conversation.id) {
        setNewMessage(draftMessage);
        setSelectedMedia(draftMedia);
      }

      toast("Erro ao enviar mensagem: " + (err?.message || ""), "error");
    } finally {
      setSendingMessage(false);
    }
  };

  const sendRecordedAudioOptimized = async () => {
    if (sendingMessage || !recordedAudioBlob || !selectedConv || !selectedInstanceId) return;

    const conversation = selectedConv;
    const audioBlob = recordedAudioBlob;
    let optimisticMessage: ChatMessage | null = null;
    setSendingMessage(true);

    try {
      const inst = instances.find((i) => i.id === selectedInstanceId);
      if (!inst) { toast("Selecione um WhatsApp.", "warning"); setSendingMessage(false); return; }
      if (!authUser) { setSendingMessage(false); return; }

      const fileName = `audio_${Date.now()}.webm`;
      const filePath = `media/${authUser.id}/${fileName}`;
      const { error: upErr } = await supabase.storage.from("public_bucket").upload(filePath, audioBlob, { cacheControl: "3600", contentType: "audio/webm", upsert: true });
      if (upErr) { toast("Erro ao fazer upload do áudio.", "error"); setSendingMessage(false); return; }

      const { data: urlData } = supabase.storage.from("public_bucket").getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) { toast("Erro ao obter URL do áudio.", "error"); setSendingMessage(false); return; }

      const sentAt = new Date().toISOString();
      optimisticMessage = createOptimisticMessage({
        conversationId: conversation.id,
        content: "",
        messageType: "audio",
        mediaUrl: publicUrl,
        createdAt: sentAt,
      });

      appendLocalMessage(optimisticMessage);
      updateConversationPreview(conversation.id, "[Áudio]", sentAt);

      const proxyRes = await fetch("/api/send-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "audio",
          instance_name: inst.instance_name,
          number: conversation.remote_jid,
          media_url: publicUrl,
          user_id: authUser.id,
          conversation_id: conversation.id,
        }),
      });
      if (!proxyRes.ok) {
        const err = await proxyRes.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao enviar áudio");
      }

      const [messageInsert, conversationUpdate] = await Promise.all([
        supabase.from("messages").insert({
          conversation_id: conversation.id,
          remote_jid: conversation.remote_jid,
          from_me: true,
          message_type: "audio",
          content: "",
          media_url: publicUrl,
          status: "sent",
        }).select().single(),
        supabase.from("conversations")
          .update({ last_message: "[Áudio]", last_message_at: sentAt })
          .eq("id", conversation.id),
      ]);

      if (messageInsert.data) {
        reconcileLocalMessage(conversation.id, optimisticMessage.id, messageInsert.data as ChatMessage);
      }

      if (messageInsert.error || conversationUpdate.error) {
        console.error("Audio sync error after send:", {
          messageError: messageInsert.error,
          conversationError: conversationUpdate.error,
        });
        toast("Áudio enviado, mas houve falha ao sincronizar o histórico.", "warning");
      }

      discardRecording();
    } catch (err: any) {
      console.error("Error sending recorded audio:", err);
      if (optimisticMessage) {
        reconcileLocalMessage(conversation.id, optimisticMessage.id);
        updateConversationPreview(conversation.id, conversation.last_message, conversation.last_message_at);
      }
      toast("Erro ao enviar áudio: " + (err?.message || ""), "error");
    } finally {
      setSendingMessage(false);
    }
  };

  const formatRecordingTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // === SCHEDULE MESSAGE FROM CHAT ===
  const openScheduleDialogForConversation = useCallback(async (scheduledMessage?: ChatScheduledMessage) => {
    if (!selectedConv) return;

    const activeLead = leadInfo || await loadLeadInfo(selectedConv.contact_phone);
    if (!activeLead) {
      toast("Crie ou vincule um lead a este contato antes de agendar mensagens.", "warning");
      return;
    }

    await ensureMediaLibraryLoaded();

    if (scheduledMessage) {
      setEditingScheduledId(scheduledMessage.id);
      setNewScheduled({
        lead_id: activeLead.id,
        message: scheduledMessage.message || "",
        scheduled_at: toDateTimeLocalValue(scheduledMessage.scheduled_at),
        instance_id: scheduledMessage.instance_id || selectedInstanceId || instances[0]?.id || "",
        media_url: scheduledMessage.media_url || "",
        media_type: scheduledMessage.media_type || "",
        file_name: scheduledMessage.file_name || "",
      });
    } else {
      setEditingScheduledId(null);
      setNewScheduled({
        ...getDefaultScheduledFormState(),
        lead_id: activeLead.id,
        instance_id: selectedInstanceId || instances[0]?.id || "",
      });
    }

    setShowScheduleMsg(true);
  }, [
    ensureMediaLibraryLoaded,
    getDefaultScheduledFormState,
    instances,
    leadInfo,
    loadLeadInfo,
    selectedConv,
    selectedInstanceId,
    toDateTimeLocalValue,
    toast,
  ]);

  const deleteScheduledMessageFromChat = useCallback(async (scheduledMessageId: string) => {
    if (!leadInfo) return;
    if (!window.confirm("Excluir este agendamento?")) return;

    const { error } = await supabase
      .from("scheduled_messages")
      .update({ status: "cancelled", deleted_at: new Date().toISOString() })
      .eq("id", scheduledMessageId);

    if (error) {
      console.error("Error deleting scheduled message:", error);
      toast("Nao foi possivel excluir o agendamento.", "error");
      return;
    }

    if (editingScheduledId === scheduledMessageId) {
      setEditingScheduledId(null);
      setShowScheduleMsg(false);
      setNewScheduled(getDefaultScheduledFormState());
    }

    await loadScheduledMessagesForLead(leadInfo.id);
    toast("Agendamento excluido.", "success");
  }, [editingScheduledId, getDefaultScheduledFormState, leadInfo, loadScheduledMessagesForLead, toast]);

  const handleScheduleFromChat = async () => {
    if (savingScheduledMessage || !selectedConv || !authUser) return;

    const activeLead = leadInfo || await loadLeadInfo(selectedConv.contact_phone);
    if (!activeLead) {
      toast("Crie ou vincule um lead a este contato antes de agendar mensagens.", "warning");
      return;
    }

    const trimmedMessage = newScheduled.message.trim();
    const resolvedInstanceId = newScheduled.instance_id || selectedInstanceId || instances[0]?.id || "";
    const parsedScheduledAt = toIsoDateTime(newScheduled.scheduled_at);
    const hasMediaAttachment = Boolean(newScheduled.media_url && newScheduled.media_type);

    if ((!trimmedMessage && !hasMediaAttachment) || !parsedScheduledAt) {
      if (!trimmedMessage && !hasMediaAttachment) toast("Preencha a mensagem ou escolha uma midia.", "warning");
      else toast("Selecione uma data e hora validas.", "warning");
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

        if (error) throw error;
        toast("Agendamento atualizado!", "success");
      } else {
        const { error } = await supabase
          .from("scheduled_messages")
          .insert({
            user_id: authUser.id,
            lead_id: activeLead.id,
            ...payload,
          });

        if (error) throw error;
        toast("Mensagem agendada!", "success");
      }

      await loadScheduledMessagesForLead(activeLead.id);
      setShowScheduleMsg(false);
      setEditingScheduledId(null);
      setNewScheduled(getDefaultScheduledFormState());
    } catch (error) {
      console.error("Error saving scheduled message from chat:", error);
      toast(editingScheduledId ? "Erro ao atualizar agendamento." : "Erro ao agendar mensagem.", "error");
    } finally {
      setSavingScheduledMessage(false);
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
  const filteredLeads = useMemo(() => (
    leads.filter((lead) =>
      lead.name.toLowerCase().includes(debouncedLeadSearch.toLowerCase()) ||
      lead.phone.includes(debouncedLeadSearch)
    )
  ), [debouncedLeadSearch, leads]);

  const filteredConversations = useMemo(() => (
    conversations.filter(matchesConversationTagFilter)
  ), [conversations, matchesConversationTagFilter]);

  const leadFilterKey = `${debouncedLeadSearch}|${showNewConv}`;
  const {
    visibleItems: visibleLeadOptions,
    totalCount: filteredLeadCount,
    hasMore: hasMoreLeadOptions,
    loadMore: loadMoreLeadOptions,
  } = useIncrementalDisplay(filteredLeads, {
    initialCount: 25,
    step: 25,
    resetKey: leadFilterKey,
  });
  const visibleConversations = filteredConversations;
  const filteredConversationCount = filteredConversations.length;
  const handleLoadMoreConversations = useCallback(() => {
    if (!hasMoreConversationPages || loadingMoreConversations) return;
    loadConversationPage({ reset: false });
  }, [hasMoreConversationPages, loadConversationPage, loadingMoreConversations]);

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
  const scheduledSupportedMedia = mediaItems.filter((item) => ["image", "video", "document"].includes(item.file_type));
  const selectedScheduledMediaId = scheduledSupportedMedia.find((item) => item.file_url === newScheduled.media_url)?.id || "none";
  const selectedScheduledLead = (leadInfo && newScheduled.lead_id === leadInfo.id)
    ? { id: leadInfo.id, name: leadInfo.name, phone: leadInfo.phone }
    : newScheduled.lead_id
      ? leads.find((lead) => lead.id === newScheduled.lead_id) || (selectedConv ? {
        id: newScheduled.lead_id,
        name: selectedConv.contact_name || "Contato atual",
        phone: selectedConv.contact_phone,
      } : null)
      : null;
  const selectedScheduledMedia = newScheduled.media_url
    ? scheduledSupportedMedia.find((item) => item.file_url === newScheduled.media_url)
      || {
        id: "selected",
        file_name: newScheduled.file_name || "arquivo",
        file_type: newScheduled.media_type || "document",
        file_url: newScheduled.media_url,
        file_size: 0,
      }
    : null;
  const scheduledDateParts = newScheduled.scheduled_at
    ? (() => {
      const [datePart, timePart = ""] = newScheduled.scheduled_at.split("T");
      const date = new Date(newScheduled.scheduled_at);
      if (Number.isNaN(date.getTime())) {
        return {
          dateLabel: datePart || "Data invalida",
          timeLabel: timePart || "--:--",
        };
      }
      return {
        dateLabel: date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "long" }),
        timeLabel: timePart || date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      };
    })()
    : null;
  const canSaveScheduledFromChat = Boolean(newScheduled.scheduled_at && (newScheduled.message.trim() || selectedScheduledMedia));

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
        <div className="space-y-2 px-3 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-background/80">
            <Icon className={cn(
              "h-5 w-5",
              media.file_type === "video" ? "text-blue-400" : media.file_type === "image" ? "text-green-400" : "text-orange-400",
            )} />
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">{media.file_name || "Arquivo"}</p>
        </div>
      </div>
    );
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
            {loadingConversations && filteredConversationCount === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-4">
                <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary/70" />
                <p className="text-sm text-center">Carregando conversas...</p>
              </div>
            ) : filteredConversationCount === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-4">
                <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm text-center">Nenhuma conversa encontrada</p>
              </div>
            ) : (
              <>
                {visibleConversations.map((conv) => (
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
                ))}
                <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      {filterTag
                        ? `Mostrando ${visibleConversations.length} conversa${visibleConversations.length !== 1 ? "s" : ""} com a tag selecionada`
                        : `Mostrando ${visibleConversations.length} de ${conversationTotalCount} conversa${conversationTotalCount !== 1 ? "s" : ""}`}
                    </span>
                    {hasMoreConversationPages && (
                      <Button variant="outline" size="sm" onClick={handleLoadMoreConversations} disabled={loadingMoreConversations}>
                        {loadingMoreConversations ? (
                          <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            Carregando...
                          </>
                        ) : (
                          "Carregar mais"
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </>
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
                  <div
                    ref={messagesContainerRef}
                    className="flex-1 overflow-y-auto p-4 space-y-3 bg-background/50"
                    onScroll={(event) => {
                      const target = event.currentTarget;
                      if (target.scrollTop < 120 && hasOlderMessages && !loadingOlderMessages) {
                        loadOlderMessages();
                      }
                    }}
                  >
                    {loadingMessages ? (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando mensagens...
                      </div>
                    ) : (
                      <>
                        {loadingOlderMessages && (
                          <div className="flex items-center justify-center py-2 text-xs text-muted-foreground">
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Carregando mensagens antigas...
                          </div>
                        )}
                        {messages.length === 0 ? (
                          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            Nenhuma mensagem nesta conversa ainda.
                          </div>
                        ) : messages.map((msg) => (
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
                      </>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="border-t border-border bg-card">
                    {/* Selected media thumbnail */}
                    {selectedMedia && !isRecording && !recordedAudioBlob && (
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

                    {/* Recording in progress */}
                    {isRecording && (
                      <div className="p-3 flex items-center gap-3">
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive" onClick={() => { stopRecording(); discardRecording(); }} title="Descartar">
                          <Trash2 className="h-5 w-5" />
                        </Button>
                        <div className="flex-1 flex items-center gap-3 px-3 py-2 rounded-full bg-muted">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                          <div className="flex-1 h-1 rounded-full bg-primary/30 overflow-hidden">
                            <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: `${Math.min(100, (recordingTime / 120) * 100)}%` }} />
                          </div>
                          <span className="text-sm font-mono text-muted-foreground min-w-[40px]">{formatRecordingTime(recordingTime)}</span>
                        </div>
                        <Button className="h-10 w-10 rounded-full bg-primary" size="icon" onClick={stopRecording} title="Parar gravação">
                          <Square className="h-4 w-4 fill-current" />
                        </Button>
                      </div>
                    )}

                    {/* Recorded audio ready to send */}
                    {!isRecording && recordedAudioBlob && (
                      <div className="p-3 flex items-center gap-3">
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive" onClick={discardRecording} title="Descartar">
                          <Trash2 className="h-5 w-5" />
                        </Button>
                        <div className="flex-1 flex items-center gap-3 px-3 py-2 rounded-full bg-muted">
                          <button onClick={togglePlayRecording} className="text-primary hover:text-primary/80 transition-colors">
                            {isPlayingRecording ? <Square className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                          </button>
                          <div className="flex-1 h-1 rounded-full bg-primary/30" />
                          <span className="text-sm font-mono text-muted-foreground min-w-[40px]">{formatRecordingTime(recordingTime)}</span>
                          <Mic className="h-4 w-4 text-pink-500" />
                        </div>
                        <Button className="h-10 w-10 rounded-full bg-primary" size="icon" onClick={sendRecordedAudioOptimized} disabled={sendingMessage} title="Enviar áudio">
                          {sendingMessage ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                        </Button>
                      </div>
                    )}

                    {/* Normal input */}
                    {!isRecording && !recordedAudioBlob && (
                      <div className="p-3 flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => { setRightPanel(rightPanel === "media" ? null : "media"); setMediaTab("templates"); }}>
                          <Paperclip className="h-5 w-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10"
                          onClick={async () => {
                            await ensureFlowsLoaded();
                            setShowFlowPicker(true);
                          }}
                          title="Gatilhos / Fluxos"
                          disabled={loadingFlows}
                        >
                          {loadingFlows ? (
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          ) : (
                            <Zap className={cn("h-5 w-5", hasLoadedFlows && flows.length > 0 ? "text-yellow-500" : "text-muted-foreground")} />
                          )}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => {
                          openScheduleDialogForConversation();
                        }} title="Agendar mensagem">
                          <CalendarClock className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                        </Button>
                        <div className="flex-1">
                          {/* Aviso de campos faltantes */}
                          {missingFields.length > 0 && (
                            <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-md">
                              <p className="text-xs text-red-600">
                                ⚠️ Informações ausentes: {missingFields.map(field => {
                                  const fieldNames: Record<string, string> = {
                                    nome: 'nome',
                                    email: 'email', 
                                    telefone: 'telefone'
                                  };
                                  return fieldNames[field] || field;
                                }).join(', ')}
                              </p>
                            </div>
                          )}
                          <Textarea
                          placeholder={selectedMedia?.file_type === "audio" ? "Áudio não suporta texto" : "Digite uma mensagem..."}
                          value={selectedMedia?.file_type === "audio" ? "" : newMessage}
                          onChange={(e) => {
                            setNewMessage(e.target.value);
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = Math.min(target.scrollHeight, 220) + 'px';
                          }}
                          onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = Math.min(target.scrollHeight, 220) + 'px';
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                              e.preventDefault();
                              handleSendMessageOptimized();
                            }
                          }}
                          className="flex-1 min-h-[44px] resize-none overflow-hidden"
                          disabled={selectedMedia?.file_type === "audio"}
                          rows={1}
                          style={{
                            height: 'auto',
                            minHeight: '44px',
                            maxHeight: 220
                          }}
                        />
                        </div>
                        {newMessage.trim() || selectedMedia ? (
                          <Button className="h-10 w-10" size="icon" onClick={handleSendMessageOptimized} disabled={sendingMessage || (!newMessage.trim() && !selectedMedia)}>
                            {sendingMessage ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={startRecording} title="Gravar áudio">
                            <Mic className="h-5 w-5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT PANEL: Lead Info */}
                {rightPanel === "lead" && (
                  <div className="w-[340px] border-l border-border bg-card overflow-y-auto shrink-0">
                    <div className="p-4 border-b border-border flex items-center justify-between">
                      <h3 className="font-semibold text-sm">Informações do Lead</h3>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRightPanel(null)}><X className="h-4 w-4" /></Button>
                    </div>
                    {loadingLeadInfo ? (
                      <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando lead...
                      </div>
                    ) : leadInfo ? (
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
                            <div className="flex items-center gap-2 text-muted-foreground p-2 rounded-md bg-muted/50">
                            <StickyNote className="h-4 w-4 shrink-0" /> Criado: {new Date(leadInfo.created_at).toLocaleDateString("pt-BR")}
                          </div>
                        </div>

                        {/* Funnel & Stage */}
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground">Funil</p>
                            <Select value={leadInfo.funnel_id || "none"} onValueChange={async (val) => {
                              const fid = val === "none" ? null : val;
                              await supabase.from("leads").update({ funnel_id: fid, stage_id: null }).eq("id", leadInfo.id);
                              setLeadInfo((prev: any) => prev ? { ...prev, funnel_id: fid, stage_id: null } : prev);
                            }}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione um funil" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Nenhum</SelectItem>
                                {chatFunnels.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          {leadInfo.funnel_id && (() => {
                            const fStages = chatStages.filter((s) => s.funnel_id === leadInfo.funnel_id);
                            return fStages.length > 0 ? (
                              <div className="space-y-1.5">
                                <p className="text-xs text-muted-foreground">Etapa</p>
                                <Select value={leadInfo.stage_id || fStages[0]?.id} onValueChange={async (val) => {
                                  await supabase.from("leads").update({ stage_id: val }).eq("id", leadInfo.id);
                                  setLeadInfo((prev: any) => prev ? { ...prev, stage_id: val } : prev);
                                }}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>{fStages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                            ) : null;
                          })()}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <CalendarClock className="h-3 w-3" /> Próximos agendamentos
                            </p>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => openScheduleDialogForConversation()}>
                              <Plus className="mr-1 h-3 w-3" /> Novo
                            </Button>
                          </div>

                          {loadingScheduledMessages ? (
                            <div className="flex items-center justify-center rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Carregando agendamentos...
                            </div>
                          ) : chatScheduledMessages.length === 0 ? (
                            <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
                              Nenhum agendamento futuro para este lead.
                            </div>
                          ) : (
                            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                              {chatScheduledMessages.map((item) => {
                                const statusMeta = getScheduledStatusMeta(item.status);
                                return (
                                  <div key={item.id} className="rounded-lg border bg-muted/30 p-3 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Badge variant="outline" className={statusMeta.className}>
                                            {statusMeta.label}
                                          </Badge>
                                          <span className="text-[10px] text-muted-foreground">{formatDateTime(item.scheduled_at)}</span>
                                        </div>
                                        <p className="whitespace-pre-wrap break-words text-xs">{getScheduledPreviewText(item)}</p>
                                        {item.failure_reason && (
                                          <p className="text-[10px] text-destructive">Falha: {item.failure_reason}</p>
                                        )}
                                      </div>
                                      <div className="flex shrink-0 items-center gap-1">
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7"
                                          onClick={() => openScheduleDialogForConversation(item)}
                                          title="Editar agendamento"
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7 text-destructive hover:text-destructive"
                                          onClick={() => deleteScheduledMessageFromChat(item.id)}
                                          title="Excluir agendamento"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Tags with add/remove */}
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground flex items-center gap-1"><Tag className="h-3 w-3" /> Tags</p>
                          <div className="flex flex-wrap gap-1.5">
                            {leadInfo.tags?.map((t: any) => (
                              <span key={t.id} className="text-[10px] px-2 py-0.5 rounded-full text-white flex items-center gap-1" style={{ backgroundColor: t.color }}>
                                {t.name}
                                <button onClick={() => handleRemoveTag(t.id)}><X className="h-2.5 w-2.5" /></button>
                              </span>
                            ))}
                          </div>
                          {allTags.filter((t) => !leadInfo.tags?.some((lt: any) => lt.id === t.id)).length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[10px] text-muted-foreground">Clique para adicionar:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {allTags.filter((t) => !leadInfo.tags?.some((lt: any) => lt.id === t.id)).map((tag) => (
                                  <button
                                    key={tag.id}
                                    onClick={async () => {
                                      if (!leadInfo) return;
                                      await supabase.from("lead_tags").insert({ lead_id: leadInfo.id, tag_id: tag.id });
                                      setLeadInfo((prev: any) => prev ? { ...prev, tags: [...prev.tags, { id: tag.id, name: tag.name, color: tag.color }] } : prev);
                                      refreshTags();
                                    }}
                                    className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-border text-muted-foreground hover:text-white hover:border-transparent transition-colors"
                                    onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = tag.color; }}
                                    onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = "transparent"; }}
                                  >
                                    + {tag.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="flex gap-1.5">
                            <Input placeholder="Criar nova tag..." value={newTag} onChange={(e) => setNewTag(e.target.value)}
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
                          if (!selectedConv || !authUser) return;
                          const phone = selectedConv.contact_phone;
                          const name = selectedConv.contact_name || phone;
                          // Get default funnel and stage
                          const { data: defaultFunnel } = await supabase.from("funnels").select("id").eq("user_id", authUser.id).order("created_at").limit(1).single();
                          let defaultStageId = null;
                          if (defaultFunnel) {
                            const { data: defaultStage } = await supabase.from("funnel_stages").select("id").eq("funnel_id", defaultFunnel.id).order("order").limit(1).single();
                            defaultStageId = defaultStage?.id || null;
                          }
                          const { data, error } = await supabase.from("leads").insert({
                            user_id: authUser.id, name, phone, source: "WhatsApp",
                            funnel_id: defaultFunnel?.id || null,
                            stage_id: defaultStageId,
                          }).select().single();
                          if (!error && data) {
                            setLeads((prev) => prev.some((lead) => lead.id === data.id) ? prev : [...prev, { id: data.id, name: data.name, phone: data.phone }]);
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
                      {loadingMediaLibrary ? (
                        <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando biblioteca...
                        </div>
                      ) : mediaTab === "templates" ? (
                        <div className="space-y-2">
                          {templates.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma mensagem pronta. Crie em Mídia.</p>
                          ) : (
                            templates.map((tpl) => (
                              <button key={tpl.id} onClick={() => { 
                                const result = replaceTemplateParameters(tpl.content); 
                                setNewMessage(result.content); 
                                setMissingFields(result.missingFields);
                                setRightPanel(null); 
                              }}
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
              {loadingLeadOptions ? (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando leads...
                </div>
              ) : filteredLeadCount === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum lead encontrado</p>
              ) : (
                <>
                  {visibleLeadOptions.map((lead) => (
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
                  ))}
                  <div className="flex items-center justify-between gap-2 px-1 pt-2 text-xs text-muted-foreground">
                    <span>Mostrando {visibleLeadOptions.length} de {filteredLeadCount} lead{filteredLeadCount !== 1 ? "s" : ""}</span>
                    {hasMoreLeadOptions && (
                      <Button variant="outline" size="sm" onClick={loadMoreLeadOptions}>
                        Carregar mais
                      </Button>
                    )}
                  </div>
                </>
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
            {loadingFlows ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando fluxos...
              </div>
            ) : flows.length === 0 ? (
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

      {/* Schedule Message from Chat Dialog */}
      <Dialog open={showScheduleMsg} onOpenChange={(open) => {
        setShowScheduleMsg(open);
        if (!open) {
          setEditingScheduledId(null);
          setNewScheduled(getDefaultScheduledFormState());
          setSavingScheduledMessage(false);
        }
      }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              {editingScheduledId ? "Editar Agendamento" : "Agendar Mensagem"}
            </DialogTitle>
            <DialogDescription>
              {editingScheduledId
                ? "Altere os dados do agendamento desta conversa."
                : "Agende uma mensagem para a conversa atual sem precisar escolher o lead novamente."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Conversa atual</Label>
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3">
                  <p className="text-sm font-medium">{selectedScheduledLead?.name || selectedConv?.contact_name || "Contato atual"}</p>
                  <p className="text-xs text-muted-foreground">{formatPhone(selectedScheduledLead?.phone || selectedConv?.contact_phone || "")}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea
                  placeholder={"Conteudo da mensagem...\n\nAs quebras de linha serao preservadas no envio."}
                  value={newScheduled.message}
                  onChange={(e) => setNewScheduled((prev) => ({ ...prev, message: e.target.value }))}
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
                        <div className="space-y-2 text-center">
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
                    <Select
                      value={newScheduled.instance_id || selectedInstanceId || instances[0]?.id || ""}
                      onValueChange={(v) => setNewScheduled((prev) => ({ ...prev, instance_id: v }))}
                    >
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
                      onChange={(e) => setNewScheduled((prev) => ({ ...prev, scheduled_at: e.target.value }))}
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
                    <span className="truncate">{selectedScheduledLead?.name || "Preview da mensagem"}</span>
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
                        <span className="truncate">{selectedScheduledLead?.phone || selectedConv?.contact_phone || "Telefone do lead"}</span>
                        <span>{newScheduled.scheduled_at ? newScheduled.scheduled_at.slice(11, 16) : "--:--"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-dashed p-4">
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
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleMsg(false)} disabled={savingScheduledMessage}>Cancelar</Button>
            <Button onClick={handleScheduleFromChat} disabled={savingScheduledMessage || !canSaveScheduledFromChat}>
              {savingScheduledMessage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4 mr-1.5" />}
              {editingScheduledId ? "Salvar" : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
