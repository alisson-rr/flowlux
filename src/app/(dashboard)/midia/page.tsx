"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FileText, Image, Video, Music, FileUp, Plus, Trash2, Loader2, Pencil, Download, Search, FolderOpen, Check, Mic, Square, Upload,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface Template { id: string; name: string; content: string; category: string; }
interface MediaItem { id: string; file_name: string; file_type: string; file_url: string; file_size: number; created_at: string; }

const ALLOWED_EXTENSIONS = [
  "jpg", "jpeg", "png", "gif", "webp", "bmp",
  "mp4", "mov", "avi", "mkv", "3gp",
  "mp3", "ogg", "wav", "aac", "m4a", "opus", "webm",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "zip", "rar",
];

const BLOCKED_EXTENSIONS = ["svg", "eps", "ai", "cdr", "tiff", "tif", "psd", "raw", "heic"];

const ALLOWED_MIME_ACCEPT = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp",
  "video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska", "video/3gpp",
  "audio/mpeg", "audio/ogg", "audio/wav", "audio/aac", "audio/mp4", "audio/opus", "audio/webm",
  "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv", "application/zip", "application/x-rar-compressed",
].join(",");

function isFileAllowed(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (BLOCKED_EXTENSIONS.includes(ext)) return false;
  return ALLOWED_EXTENSIONS.includes(ext);
}

// Sanitize filename: remove accents, special chars, spaces -> hyphens
function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-zA-Z0-9._-]/g, "-") // replace special chars with hyphen
    .replace(/-+/g, "-") // collapse multiple hyphens
    .replace(/^-|-$/g, ""); // trim hyphens
}

export default function MidiaPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: "", content: "", category: "geral" });
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateCategory, setTemplateCategory] = useState("all");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const getSupportedMimeType = () => {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/mp4",
      "",
    ];
    for (const type of types) {
      if (!type || (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type))) return type;
    }
    return "";
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast("Gravação de áudio requer HTTPS ou localhost.", "warning");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blobType = mediaRecorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: blobType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
    } catch (err) {
      toast("Não foi possível acessar o microfone. Verifique as permissões.", "error");
      console.error(err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const cancelRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
  };

  const uploadRecording = async () => {
    if (!audioBlob) return;
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const fileName = `gravacao-${Date.now()}.webm`;
      const filePath = `media/${userData.user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("public_bucket").upload(filePath, audioBlob, { cacheControl: "3600", contentType: "audio/webm" });
      if (uploadError) { toast("Erro ao enviar áudio: " + uploadError.message, "error"); return; }

      const { data: urlData } = supabase.storage.from("public_bucket").getPublicUrl(filePath);
      const { data, error } = await supabase.from("media").insert({
        user_id: userData.user.id, file_name: fileName, file_type: "audio",
        file_url: urlData.publicUrl, file_size: audioBlob.size,
      }).select("id, file_name, file_type, file_url, file_size, created_at").single();

      if (!error && data) setMediaItems((prev) => [data, ...prev]);
      cancelRecording();
    } catch (err) {
      console.error("Upload recording error:", err);
    } finally {
      setUploading(false);
    }
  };

  const formatRecTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const loadData = useCallback(async () => {
    try {
      const [tempRes, mediaRes] = await Promise.all([
        supabase.from("message_templates").select("id, name, content, category").order("name"),
        supabase.from("media").select("id, file_name, file_type, file_url, file_size, created_at").order("created_at", { ascending: false }),
      ]);
      if (tempRes.data) setTemplates(tempRes.data);
      if (mediaRes.data) setMediaItems(mediaRes.data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // === TEMPLATES ===
  const handleSaveTemplate = async () => {
    if (!newTemplate.name || !newTemplate.content) return;
    if (editingTemplateId) {
      const { error } = await supabase.from("message_templates").update(newTemplate).eq("id", editingTemplateId);
      if (!error) setTemplates((prev) => prev.map((t) => t.id === editingTemplateId ? { ...t, ...newTemplate } : t));
      setEditingTemplateId(null);
    } else {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data, error } = await supabase.from("message_templates").insert({ user_id: userData.user.id, ...newTemplate }).select().single();
      if (!error && data) setTemplates((prev) => [...prev, data]);
    }
    setNewTemplate({ name: "", content: "", category: "geral" });
    setShowAddTemplate(false);
  };

  const openEditTemplate = (t: Template) => {
    setEditingTemplateId(t.id);
    setNewTemplate({ name: t.name, content: t.content, category: t.category || "geral" });
    setShowAddTemplate(true);
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from("message_templates").delete().eq("id", id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  // === MEDIA ===
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const rejectedFiles: string[] = [];
      for (const file of Array.from(files)) {
        if (!isFileAllowed(file.name)) {
          rejectedFiles.push(file.name);
          continue;
        }
        const ext = file.name.split(".").pop() || "";
        const baseName = file.name.substring(0, file.name.lastIndexOf(".") || file.name.length);
        const safeName = sanitizeFileName(baseName);
        const safeFullName = safeName ? `${safeName}.${ext}` : `${Date.now()}.${ext}`;
        const filePath = `media/${userData.user.id}/${Date.now()}-${safeFullName}`;

        let fileType = "document";
        if (file.type.startsWith("image/")) fileType = "image";
        else if (file.type.startsWith("video/")) fileType = "video";
        else if (file.type.startsWith("audio/")) fileType = "audio";

        const { error: uploadError } = await supabase.storage
          .from("public_bucket")
          .upload(filePath, file, { cacheControl: "3600" });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast(`Erro ao enviar "${file.name}": ${uploadError.message}`, "error");
          continue;
        }

        const { data: urlData } = supabase.storage.from("public_bucket").getPublicUrl(filePath);
        const { data, error } = await supabase.from("media").insert({
          user_id: userData.user.id,
          file_name: file.name, // keep original name for display
          file_type: fileType,
          file_url: urlData.publicUrl,
          file_size: file.size,
        }).select("id, file_name, file_type, file_url, file_size, created_at").single();

        if (!error && data) setMediaItems((prev) => [data, ...prev]);
      }
      if (rejectedFiles.length > 0) {
        toast(`${rejectedFiles.length} arquivo(s) bloqueado(s) - formato não suportado`, "warning");
      }
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRename = async (item: MediaItem) => {
    const clean = renameValue.replace(/[^a-zA-Z0-9À-ÿ\s._-]/g, "").trim();
    if (!clean) return;
    const { error } = await supabase.from("media").update({ file_name: clean }).eq("id", item.id);
    if (!error) {
      setMediaItems((prev) => prev.map((m) => m.id === item.id ? { ...m, file_name: clean } : m));
    }
    setRenamingId(null);
    setRenameValue("");
  };

  const deleteMedia = async (item: MediaItem) => {
    const path = item.file_url.split("/public_bucket/")[1];
    if (path) await supabase.storage.from("public_bucket").remove([path]).catch(() => {});
    await supabase.from("media").delete().eq("id", item.id);
    setMediaItems((prev) => prev.filter((m) => m.id !== item.id));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "image": return <Image className="h-5 w-5 text-green-400" />;
      case "video": return <Video className="h-5 w-5 text-blue-400" />;
      case "audio": return <Music className="h-5 w-5 text-purple-400" />;
      default: return <FileUp className="h-5 w-5 text-orange-400" />;
    }
  };

  const filteredMedia = mediaItems
    .filter((m) => filterType === "all" || m.file_type === filterType)
    .filter((m) => m.file_name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Mídia & Mensagens</h1>
        <p className="text-muted-foreground">Gerencie seus arquivos, mídias e mensagens prontas</p>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates" className="gap-2"><FileText className="h-4 w-4" /> Mensagens Prontas</TabsTrigger>
          <TabsTrigger value="media" className="gap-2"><FolderOpen className="h-4 w-4" /> Arquivos & Mídia</TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar mensagem..." className="pl-10" value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} />
              </div>
              <Select value={templateCategory} onValueChange={setTemplateCategory}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="geral">Geral</SelectItem>
                  <SelectItem value="vendas">Vendas</SelectItem>
                  <SelectItem value="suporte">Suporte</SelectItem>
                  <SelectItem value="boas-vindas">Boas-vindas</SelectItem>
                  <SelectItem value="follow-up">Follow-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => { setEditingTemplateId(null); setNewTemplate({ name: "", content: "", category: "geral" }); setShowAddTemplate(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Nova Mensagem
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates
              .filter((t) => templateCategory === "all" || t.category === templateCategory)
              .filter((t) => t.name.toLowerCase().includes(templateSearch.toLowerCase()) || t.content.toLowerCase().includes(templateSearch.toLowerCase()))
              .length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground col-span-2">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma mensagem pronta cadastrada</p>
              </Card>
            ) : (
              templates
                .filter((t) => templateCategory === "all" || t.category === templateCategory)
                .filter((t) => t.name.toLowerCase().includes(templateSearch.toLowerCase()) || t.content.toLowerCase().includes(templateSearch.toLowerCase()))
                .map((tpl) => (
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

        {/* Media Tab */}
        <TabsContent value="media" className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar arquivo..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="image">Imagens</SelectItem>
                  <SelectItem value="video">Vídeos</SelectItem>
                  <SelectItem value="audio">Áudios</SelectItem>
                  <SelectItem value="document">Documentos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <input ref={fileInputRef} type="file" className="hidden" multiple accept={ALLOWED_MIME_ACCEPT} onChange={handleFileUpload} />
              <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Upload
              </Button>
            </div>
          </div>

          {/* Audio Recorder */}
          {(filterType === "all" || filterType === "audio") && (
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Mic className="h-5 w-5 text-purple-400 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Gravar Áudio</p>
                  <p className="text-xs text-muted-foreground">Grave um áudio diretamente pelo microfone</p>
                </div>
                {!isRecording && !audioBlob && (
                  <Button size="sm" variant="outline" onClick={startRecording}>
                    <Mic className="h-4 w-4 mr-1.5 text-red-500" /> Gravar
                  </Button>
                )}
                {isRecording && (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-mono text-red-500">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      {formatRecTime(recordingTime)}
                    </span>
                    <Button size="sm" variant="destructive" onClick={stopRecording}>
                      <Square className="h-3.5 w-3.5 mr-1" /> Parar
                    </Button>
                  </div>
                )}
                {audioBlob && !isRecording && (
                  <div className="flex items-center gap-2">
                    <audio src={audioUrl || undefined} controls className="h-8" />
                    <Button size="sm" onClick={uploadRecording} disabled={uploading}>
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                      Salvar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelRecording}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {filteredMedia.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum arquivo encontrado</p>
              <p className="text-sm mt-1">Faça upload de imagens, vídeos, áudios ou documentos</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredMedia.map((item) => (
                <Card key={item.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-muted shrink-0">
                        {getTypeIcon(item.file_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        {renamingId === item.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value.replace(/[<>:"/\\|?*]/g, ""))}
                              onKeyDown={(e) => { if (e.key === "Enter") handleRename(item); if (e.key === "Escape") setRenamingId(null); }}
                              className="h-7 text-xs"
                              autoFocus
                            />
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleRename(item)}>
                              <Check className="h-3.5 w-3.5 text-green-400" />
                            </Button>
                          </div>
                        ) : (
                          <p className="font-medium text-sm truncate cursor-pointer hover:text-primary"
                            onClick={() => { setRenamingId(item.id); setRenameValue(item.file_name); }}
                            title="Clique para renomear"
                          >{item.file_name}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px]">{item.file_type}</Badge>
                          <span className="text-[10px] text-muted-foreground">{formatSize(item.file_size)}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(item.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setRenamingId(item.id); setRenameValue(item.file_name); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(item.file_url, "_blank")}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMedia(item)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {item.file_type === "image" && (
                      <div className="mt-3 rounded-md overflow-hidden bg-muted h-32">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.file_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Template Dialog */}
      <Dialog open={showAddTemplate} onOpenChange={(open) => { setShowAddTemplate(open); if (!open) { setEditingTemplateId(null); setNewTemplate({ name: "", content: "", category: "geral" }); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTemplateId ? "Editar Mensagem Pronta" : "Nova Mensagem Pronta"}</DialogTitle>
            <DialogDescription>Crie um modelo de mensagem reutilizável</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
            <Button onClick={handleSaveTemplate}>{editingTemplateId ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
