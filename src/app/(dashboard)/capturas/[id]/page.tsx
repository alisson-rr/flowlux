"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  ImagePlus,
  Loader2,
  MonitorSmartphone,
  MousePointerClick,
  PauseCircle,
  Palette,
  Plus,
  Rocket,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createCaptureField, normalizeCaptureFields, slugifyCapturePopupName, validateCapturePopupForPublish } from "@/lib/capture-popups/popups";
import { CAPTURE_POPUP_TEMPLATE_LIST } from "@/lib/capture-popups/templates";
import { formatPhoneInputValue } from "@/lib/phone";
import type { CapturePopup, CapturePopupField, CapturePopupFieldType } from "@/types";

type FunnelOption = { id: string; name: string };
type StageOption = { id: string; name: string; funnel_id: string };
type TagOption = { id: string; name: string; color: string | null };
type FlowOption = { id: string; name: string; is_active: boolean };

const FIELD_TYPE_OPTIONS: Array<{ value: CapturePopupFieldType; label: string }> = [
  { value: "name", label: "Nome" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "WhatsApp" },
  { value: "text", label: "Texto curto" },
  { value: "textarea", label: "Texto longo" },
];

const PANEL_WIDTH_PREVIEW = { xs: 300, sm: 360, md: 420, lg: 520, xl: 680 } as const;
const PANEL_PADDING_PREVIEW = { xs: 16, sm: 20, md: 24, lg: 32, xl: 40 } as const;
const BORDER_RADIUS_PREVIEW = { md: 12, lg: 18, xl: 24 } as const;
const ROW_IMAGE_SIZE_PREVIEW = { sm: "32%", md: "40%", lg: "45%", half: "50%" } as const;
const COLUMN_IMAGE_SIZE_PREVIEW = { sm: 120, md: 180, lg: 240, half: 300 } as const;

function getFieldInputType(field: CapturePopupField) {
  if (field.type === "email") return "email";
  if (field.type === "phone") return "tel";
  return "text";
}

function buildInstallScript(origin: string, slug: string) {
  return `<script async src="${origin}/api/capturas/${slug}/script"></script>`;
}

function buildManualOpenSnippet(slug: string) {
  return `<button onclick="window.FlowLuxPopups?.['${slug}']?.open()">Abrir pop-up</button>`;
}

function getPopupStatusLabel(status: CapturePopup["status"]) {
  switch (status) {
    case "published":
      return "Publicado";
    case "paused":
      return "Pausado";
    case "archived":
      return "Arquivado";
    default:
      return "Rascunho";
  }
}

function getTriggerModeLabel(mode: CapturePopup["trigger"]["mode"]) {
  switch (mode) {
    case "on_load":
      return "Ao carregar a pagina";
    case "delay":
      return "Depois de alguns segundos";
    case "click":
      return "Ao clicar em um botao";
    default:
      return "Abertura manual";
  }
}

function getSuccessModeLabel(mode: CapturePopup["integrations"]["success_mode"]) {
  switch (mode) {
    case "redirect":
      return "Redirecionar";
    case "whatsapp":
      return "Abrir WhatsApp";
    default:
      return "Mensagem de sucesso";
  }
}

function renderPopupPreview(
  popup: CapturePopup,
  orderedFields: CapturePopupField[],
  previewBackground: React.CSSProperties,
  panelStyle: React.CSSProperties,
  previewValues: Record<string, string>,
  onPreviewValueChange: (field: CapturePopupField, value: string) => void,
) {
  const hasMainImage = Boolean(popup.theme.top_image_url);
  const layoutMode = popup.theme.layout_mode || "column";
  const imagePosition = popup.theme.image_position || "top";
  const imageSize = popup.theme.image_size || "md";
  const panelPadding = PANEL_PADDING_PREVIEW[popup.theme.panel_padding || "md"] || 24;
  const imageBlock =
    hasMainImage ? (
      <img
        src={popup.theme.top_image_url || ""}
        alt="Imagem principal do popup"
        className="h-full w-full object-cover"
      />
    ) : null;

  const formContent = (
    <div style={{ padding: `${panelPadding}px` }} className="flex-1">
      <div className="space-y-3 text-center">
        <h2 style={{ fontFamily: popup.theme.title_font_family }} className="text-2xl font-bold leading-tight">
          {popup.content.title}
        </h2>
        {popup.content.description ? <p className="text-sm opacity-85">{popup.content.description}</p> : null}
      </div>
      <div className="mt-5 grid gap-3">
        {orderedFields.map((field) =>
          field.type === "textarea" ? (
            <div key={field.id}>
              <label className="mb-1 block text-xs font-medium opacity-85">
                {field.label}
                {field.is_required ? " *" : ""}
              </label>
              <textarea
                rows={4}
                value={previewValues[field.id] ?? ""}
                onChange={(event) => onPreviewValueChange(field, event.target.value)}
                placeholder={field.placeholder || ""}
                style={{
                  background: popup.theme.field_background,
                  color: popup.theme.field_text_color,
                  borderColor: popup.theme.field_border_color,
                  borderRadius: `${Math.max(10, BORDER_RADIUS_PREVIEW[popup.theme.border_radius] - 8)}px`,
                }}
                className="min-h-[110px] w-full border px-4 py-3 text-sm outline-none"
              />
            </div>
          ) : (
            <div key={field.id}>
              <label className="mb-1 block text-xs font-medium opacity-85">
                {field.label}
                {field.is_required ? " *" : ""}
              </label>
              <input
                type={getFieldInputType(field)}
                value={previewValues[field.id] ?? ""}
                onChange={(event) => onPreviewValueChange(field, event.target.value)}
                placeholder={field.placeholder || ""}
                style={{
                  background: popup.theme.field_background,
                  color: popup.theme.field_text_color,
                  borderColor: popup.theme.field_border_color,
                  borderRadius: `${Math.max(10, BORDER_RADIUS_PREVIEW[popup.theme.border_radius] - 8)}px`,
                }}
                className="h-12 w-full border px-4 text-sm outline-none"
              />
            </div>
          ),
        )}
      </div>
      <button
        type="button"
        style={{
          background: popup.theme.button_color,
          color: popup.theme.button_text_color,
          borderRadius: `${Math.max(12, BORDER_RADIUS_PREVIEW[popup.theme.border_radius] - 6)}px`,
        }}
        className="mt-5 flex h-12 w-full items-center justify-center text-sm font-semibold"
      >
        {popup.content.button_text}
      </button>
      {popup.content.disclaimer ? <p className="mt-3 text-center text-xs opacity-70">{popup.content.disclaimer}</p> : null}
      {popup.content.footer_note ? <p className="mt-2 text-center text-xs opacity-60">{popup.content.footer_note}</p> : null}
    </div>
  );

  return (
    <Card className="overflow-hidden p-0">
      <div className="min-h-[680px] p-6" style={previewBackground}>
        <div className="flex min-h-[620px] items-center justify-center">
          <div style={panelStyle} className="overflow-hidden border border-white/10">
            {layoutMode === "row" && hasMainImage && (imagePosition === "left" || imagePosition === "right") ? (
              <div className={`flex min-h-[520px] ${imagePosition === "right" ? "flex-row-reverse" : ""}`}>
                <div style={{ flex: `0 0 ${ROW_IMAGE_SIZE_PREVIEW[imageSize] || "40%"}` }}>{imageBlock}</div>
                {formContent}
              </div>
            ) : hasMainImage && (imagePosition === "top" || imagePosition === "bottom") ? (
              <div className={`flex min-h-[520px] flex-col ${imagePosition === "bottom" ? "flex-col-reverse" : ""}`}>
                <div style={{ height: `${COLUMN_IMAGE_SIZE_PREVIEW[imageSize] || 180}px` }}>{imageBlock}</div>
                {formContent}
              </div>
            ) : (
              formContent
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function CapturaEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const popupId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [popup, setPopup] = useState<CapturePopup | null>(null);
  const [fields, setFields] = useState<CapturePopupField[]>([]);
  const [deletedFieldIds, setDeletedFieldIds] = useState<string[]>([]);
  const [funnels, setFunnels] = useState<FunnelOption[]>([]);
  const [stages, setStages] = useState<StageOption[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [origin, setOrigin] = useState("http://localhost:3000");
  const [advancedMode, setAdvancedMode] = useState(false);
  const [uploadingImageKey, setUploadingImageKey] = useState<"top_image_url" | "background_image_url" | null>(null);
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const orderedFields = useMemo(() => normalizeCaptureFields(fields), [fields]);
  const validation = useMemo(
    () => (popup ? validateCapturePopupForPublish(popup, orderedFields) : { isValid: false, errors: [] }),
    [orderedFields, popup],
  );
  const availableStages = useMemo(
    () => stages.filter((stage) => stage.funnel_id === popup?.integrations.funnel_id),
    [popup?.integrations.funnel_id, stages],
  );
  const selectedTemplate = useMemo(
    () => CAPTURE_POPUP_TEMPLATE_LIST.find((template) => template.key === popup?.template_key),
    [popup?.template_key],
  );
  const visibleFieldTypeOptions = useMemo(
    () => (advancedMode ? FIELD_TYPE_OPTIONS : FIELD_TYPE_OPTIONS.filter((option) => ["name", "email", "phone"].includes(option.value))),
    [advancedMode],
  );

  useEffect(() => {
    setPreviewValues((current) =>
      orderedFields.reduce<Record<string, string>>((acc, field) => {
        acc[field.id] = current[field.id] || "";
        return acc;
      }, {}),
    );
  }, [orderedFields]);

  const handlePreviewValueChange = useCallback((field: CapturePopupField, value: string) => {
    setPreviewValues((current) => ({
      ...current,
      [field.id]: field.type === "phone" ? formatPhoneInputValue(value) : value,
    }));
  }, []);

  const loadData = useCallback(async () => {
    if (!user || !popupId) return;

    setLoading(true);
    const [popupResponse, fieldResponse, funnelResponse, stageResponse, tagResponse, flowResponse] = await Promise.all([
      supabase.from("capture_popups").select("*").eq("id", popupId).eq("user_id", user.id).single(),
      supabase.from("capture_popup_fields").select("*").eq("popup_id", popupId).order("position"),
      supabase.from("funnels").select("id, name").eq("user_id", user.id).order("created_at"),
      supabase.from("funnel_stages").select("id, name, funnel_id").eq("user_id", user.id).order("order"),
      supabase.from("tags").select("id, name, color").eq("user_id", user.id).order("name"),
      supabase.from("flows").select("id, name, is_active").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

    if (popupResponse.error || !popupResponse.data) {
      toast("Nao foi possivel carregar este pop-up.", "error");
      router.push("/capturas");
      return;
    }

    setPopup(popupResponse.data as CapturePopup);
    setFields((fieldResponse.data || []) as CapturePopupField[]);
    setFunnels((funnelResponse.data || []) as FunnelOption[]);
    setStages((stageResponse.data || []) as StageOption[]);
    setTags((tagResponse.data || []) as TagOption[]);
    setFlows(((flowResponse.data || []) as FlowOption[]).filter((flow) => flow.is_active));
    setDeletedFieldIds([]);
    setLoading(false);
  }, [popupId, router, toast, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updatePopup = useCallback((updater: (current: CapturePopup) => CapturePopup) => {
    setPopup((current) => (current ? updater(current) : current));
  }, []);

  const updateField = useCallback((fieldId: string, updater: (current: CapturePopupField) => CapturePopupField) => {
    setFields((current) => current.map((field) => (field.id === fieldId ? updater(field) : field)));
  }, []);

  const addField = (type: CapturePopupFieldType) => {
    setFields((current) => [...normalizeCaptureFields(current), createCaptureField(type, current.length)]);
  };

  const moveField = (index: number, direction: -1 | 1) => {
    const nextFields = [...orderedFields];
    const target = index + direction;
    if (target < 0 || target >= nextFields.length) return;
    [nextFields[index], nextFields[target]] = [nextFields[target], nextFields[index]];
    setFields(normalizeCaptureFields(nextFields));
  };

  const removeField = (fieldId: string) => {
    if (!fieldId.startsWith("temp-")) {
      setDeletedFieldIds((current) => Array.from(new Set([...current, fieldId])));
    }
    setFields((current) => normalizeCaptureFields(current.filter((field) => field.id !== fieldId)));
  };

  const toggleTag = (tagId: string) => {
    updatePopup((current) => {
      const ids = current.integrations.tag_ids || [];
      const nextIds = ids.includes(tagId) ? ids.filter((id) => id !== tagId) : [...ids, tagId];
      return { ...current, integrations: { ...current.integrations, tag_ids: nextIds } };
    });
  };

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copiado.`, "success");
    } catch {
      toast(`Nao foi possivel copiar ${label.toLowerCase()}.`, "error");
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, field: "top_image_url" | "background_image_url") => {
    if (!user || !popup) return;
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingImageKey(field);
    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    const safeName = `${field}-${Date.now().toString(36)}.${extension}`;
    const filePath = `capture-popups/${user.id}/${popup.id}/${safeName}`;

    const { error: uploadError } = await supabase.storage.from("public_bucket").upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || undefined,
    });

    if (uploadError) {
      toast("Nao foi possivel enviar a imagem.", "error");
      setUploadingImageKey(null);
      return;
    }

    const { data: urlData } = supabase.storage.from("public_bucket").getPublicUrl(filePath);
    updatePopup((current) => ({
      ...current,
      theme: {
        ...current.theme,
        [field]: urlData.publicUrl,
      },
    }));
    toast("Imagem enviada com sucesso.", "success");
    setUploadingImageKey(null);
  };

  const handleSave = async (nextStatus?: CapturePopup["status"]) => {
    if (!user || !popup) return;

    const normalizedSlug = slugifyCapturePopupName(popup.slug || popup.name);
    if (!normalizedSlug) {
      toast("Defina um identificador de URL valido para o pop-up.", "warning");
      return;
    }

    if (nextStatus === "published" && !validation.isValid) {
      toast(validation.errors[0] || "Ainda faltam ajustes para publicar.", "warning");
      return;
    }

    setSaving(true);
    const { data: slugConflict } = await supabase.from("capture_popups").select("id").eq("slug", normalizedSlug).neq("id", popup.id).limit(1);

    if (slugConflict && slugConflict.length > 0) {
      toast("Esse identificador de URL ja esta em uso. Ajuste antes de salvar.", "warning");
      setSaving(false);
      return;
    }

    const normalizedFields = normalizeCaptureFields(fields);
    const popupPayload = {
      name: popup.name.trim(),
      slug: normalizedSlug,
      description: popup.description || "",
      status: nextStatus || popup.status,
      content: popup.content,
      theme: popup.theme,
      trigger: popup.trigger,
      integrations: popup.integrations,
      published_at: nextStatus === "published" ? popup.published_at || new Date().toISOString() : popup.published_at,
      archived_at: nextStatus === "archived" ? new Date().toISOString() : null,
    };

    const { error: popupError } = await supabase.from("capture_popups").update(popupPayload).eq("id", popup.id);
    if (popupError) {
      toast("Nao foi possivel salvar o pop-up.", "error");
      setSaving(false);
      return;
    }

    if (deletedFieldIds.length > 0) await supabase.from("capture_popup_fields").delete().in("id", deletedFieldIds);

    const persistedFields = normalizedFields.filter((field) => !field.id.startsWith("temp-")).map((field) => ({
      id: field.id,
      popup_id: popup.id,
      user_id: user.id,
      field_key: field.field_key,
      position: field.position,
      type: field.type,
      label: field.label,
      placeholder: field.placeholder || "",
      is_required: field.is_required,
      width: field.width,
      settings: field.settings,
    }));

    const newFields = normalizedFields.filter((field) => field.id.startsWith("temp-")).map((field) => ({
      popup_id: popup.id,
      user_id: user.id,
      field_key: field.field_key,
      position: field.position,
      type: field.type,
      label: field.label,
      placeholder: field.placeholder || "",
      is_required: field.is_required,
      width: field.width,
      settings: field.settings,
    }));

    if (persistedFields.length > 0) await supabase.from("capture_popup_fields").upsert(persistedFields);
    if (newFields.length > 0) await supabase.from("capture_popup_fields").insert(newFields);

    toast(nextStatus === "published" ? "Pop-up publicado com sucesso!" : "Pop-up salvo com sucesso!", "success");
    await loadData();
    setSaving(false);
  };

  if (loading || !popup) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const previewBackground: React.CSSProperties =
    popup.theme.background_mode === "image" && popup.theme.background_image_url
      ? {
          backgroundImage: `linear-gradient(rgba(0,0,0,${popup.theme.overlay_opacity / 100}), rgba(0,0,0,${popup.theme.overlay_opacity / 100})), url(${popup.theme.background_image_url})`,
          backgroundPosition: `${popup.theme.background_image_focus_x}% ${popup.theme.background_image_focus_y}%`,
          backgroundSize: "cover",
        }
      : { background: popup.theme.background_color };

  const panelStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: `${PANEL_WIDTH_PREVIEW[popup.theme.panel_width]}px`,
    borderRadius: `${BORDER_RADIUS_PREVIEW[popup.theme.border_radius]}px`,
    background: popup.theme.panel_background,
    color: popup.theme.panel_text_color,
    fontFamily: popup.theme.font_family,
    boxShadow: "0 24px 60px rgba(0, 0, 0, 0.35)",
  };
  const installSnippet = buildInstallScript(origin, popup.slug);
  const manualOpenSnippet = buildManualOpenSnippet(popup.slug);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Link href="/capturas" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{popup.name}</h1>
            <Badge variant={popup.status === "published" ? "default" : "outline"}>{getPopupStatusLabel(popup.status)}</Badge>
            <Badge variant="outline">{selectedTemplate?.name || popup.template_key}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Monte seu pop-up, acompanhe a previa ao lado e depois copie o codigo para instalar na sua landing page.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => copyText(installSnippet, "Codigo")}>
            <Copy className="mr-2 h-4 w-4" />
            Copiar codigo
          </Button>
          <Button variant="outline" onClick={() => handleSave(popup.status === "published" ? "paused" : "published")} disabled={saving}>
            {popup.status === "published" ? <PauseCircle className="mr-2 h-4 w-4" /> : <Rocket className="mr-2 h-4 w-4" />}
            {popup.status === "published" ? "Pausar" : "Publicar"}
          </Button>
          <Button onClick={() => handleSave()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="space-y-1">
          <p className="font-medium">Modo simples</p>
          <p className="text-sm text-muted-foreground">
            O basico fica visivel para quem e leigo. Se quiser mexer em detalhes tecnicos, basta mostrar as opcoes avancadas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Mostrar opcoes avancadas</span>
          <Switch checked={advancedMode} onCheckedChange={setAdvancedMode} />
        </div>
      </Card>

      {!validation.isValid && (
        <Card className="border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-300">Ajustes para publicar</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-100/90">
            {validation.errors.slice(0, 6).map((error) => <li key={error}>- {error}</li>)}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(520px,1fr)]">
      <Tabs defaultValue="basico" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="basico">Basico</TabsTrigger>
          <TabsTrigger value="campos">Campos</TabsTrigger>
          <TabsTrigger value="estilo">Visual</TabsTrigger>
          <TabsTrigger value="gatilho">Abertura</TabsTrigger>
          <TabsTrigger value="integracoes">Depois do envio</TabsTrigger>
          <TabsTrigger value="instalacao">Codigo</TabsTrigger>
        </TabsList>

        <TabsContent value="basico">
          <Card className="grid gap-4 p-5 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome do pop-up</Label>
              <Input value={popup.name} onChange={(e) => updatePopup((current) => ({ ...current, name: e.target.value }))} />
            </div>
            {advancedMode && (
              <div className="space-y-2">
                <Label>Identificador da URL (slug)</Label>
                <Input value={popup.slug} onChange={(e) => updatePopup((current) => ({ ...current, slug: e.target.value }))} />
              </div>
            )}
            {advancedMode && (
              <div className="space-y-2 lg:col-span-2">
                <Label>Descricao interna</Label>
                <Textarea rows={2} value={popup.description || ""} onChange={(e) => updatePopup((current) => ({ ...current, description: e.target.value }))} />
              </div>
            )}
            <div className="space-y-2 lg:col-span-2">
              <Label>Titulo principal</Label>
              <Input value={popup.content.title} onChange={(e) => updatePopup((current) => ({ ...current, content: { ...current.content, title: e.target.value } }))} />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label>Texto de apoio</Label>
              <Textarea rows={3} value={popup.content.description || ""} onChange={(e) => updatePopup((current) => ({ ...current, content: { ...current.content, description: e.target.value } }))} />
            </div>
            <div className="space-y-2">
              <Label>Texto do botao</Label>
              <Input value={popup.content.button_text} onChange={(e) => updatePopup((current) => ({ ...current, content: { ...current.content, button_text: e.target.value } }))} />
            </div>
            {advancedMode && (
              <div className="space-y-2">
                <Label>Texto pequeno abaixo do botao</Label>
                <Input value={popup.content.footer_note || ""} onChange={(e) => updatePopup((current) => ({ ...current, content: { ...current.content, footer_note: e.target.value } }))} />
              </div>
            )}
            {advancedMode && (
              <div className="space-y-2 lg:col-span-2">
                <Label>Disclaimer</Label>
                <Textarea rows={2} value={popup.content.disclaimer || ""} onChange={(e) => updatePopup((current) => ({ ...current, content: { ...current.content, disclaimer: e.target.value } }))} />
              </div>
            )}
            {advancedMode && (
              <div className="space-y-2">
                <Label>Titulo do sucesso</Label>
                <Input value={popup.content.success_title || ""} onChange={(e) => updatePopup((current) => ({ ...current, content: { ...current.content, success_title: e.target.value } }))} />
              </div>
            )}
            {advancedMode && (
              <div className="space-y-2">
                <Label>Descricao do sucesso</Label>
                <Input value={popup.content.success_description || ""} onChange={(e) => updatePopup((current) => ({ ...current, content: { ...current.content, success_description: e.target.value } }))} />
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="campos">
          <div className="space-y-4">
            <Card className="flex flex-wrap gap-2 p-4">
              {visibleFieldTypeOptions.map((option) => (
                <Button key={option.value} variant="outline" size="sm" onClick={() => addField(option.value)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {option.label}
                </Button>
              ))}
              {!advancedMode && (
                <p className="w-full text-xs text-muted-foreground">
                  Quer usar campos personalizados e mais controle de layout? Ative as opcoes avancadas.
                </p>
              )}
            </Card>

            <div className="space-y-3">
              {orderedFields.map((field, index) => (
                <Card key={field.id} className="space-y-4 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <Badge variant="secondary">{FIELD_TYPE_OPTIONS.find((option) => option.value === field.type)?.label || field.type}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" onClick={() => moveField(index, -1)} disabled={index === 0}><ArrowUp className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" onClick={() => moveField(index, 1)} disabled={index === orderedFields.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" onClick={() => removeField(field.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Label</Label>
                      <Input value={field.label} onChange={(e) => updateField(field.id, (current) => ({ ...current, label: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Placeholder</Label>
                      <Input value={field.placeholder || ""} onChange={(e) => updateField(field.id, (current) => ({ ...current, placeholder: e.target.value }))} />
                    </div>
                    {advancedMode && (
                      <div className="space-y-2">
                        <Label>Largura</Label>
                        <Select value={field.width} onValueChange={(value: "full" | "half") => updateField(field.id, (current) => ({ ...current, width: value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">Linha inteira</SelectItem>
                            <SelectItem value="half">Metade da linha</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {advancedMode && (
                      <div className="space-y-2">
                        <Label>Limite de caracteres</Label>
                        <Input type="number" value={String(field.settings.max_length || "")} onChange={(e) => updateField(field.id, (current) => ({ ...current, settings: { ...current.settings, max_length: Number(e.target.value) || null } }))} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                    <div>
                      <p className="text-sm font-medium">Campo obrigatorio</p>
                      <p className="text-xs text-muted-foreground">Define se o lead precisa preencher este campo.</p>
                    </div>
                    <Switch checked={field.is_required} onCheckedChange={(checked) => updateField(field.id, (current) => ({ ...current, is_required: checked }))} />
                  </div>
                </Card>
              ))}

              {!orderedFields.length && (
                <Card className="p-6 text-center text-sm text-muted-foreground">
                  Adicione os campos que serao exibidos no modal de captura.
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="estilo">
          <Card className="space-y-4 p-5">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
              Tudo o que voce alterar aqui aparece na previa ao lado em tempo real.
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Largura do painel</Label>
                <Select value={popup.theme.panel_width} onValueChange={(value: "xs" | "sm" | "md" | "lg" | "xl") => updatePopup((current) => ({ ...current, theme: { ...current.theme, panel_width: value } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xs">Extra pequena</SelectItem>
                    <SelectItem value="sm">Pequena</SelectItem>
                    <SelectItem value="md">Media</SelectItem>
                    <SelectItem value="lg">Larga</SelectItem>
                    <SelectItem value="xl">Extra larga</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Espacamento interno</Label>
                <Select value={popup.theme.panel_padding || "md"} onValueChange={(value: "xs" | "sm" | "md" | "lg" | "xl") => updatePopup((current) => ({ ...current, theme: { ...current.theme, panel_padding: value } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xs">Bem compacto</SelectItem>
                    <SelectItem value="sm">Compacto</SelectItem>
                    <SelectItem value="md">Medio</SelectItem>
                    <SelectItem value="lg">Grande</SelectItem>
                    <SelectItem value="xl">Extra grande</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Raio das bordas</Label>
                <Select value={popup.theme.border_radius} onValueChange={(value: "md" | "lg" | "xl") => updatePopup((current) => ({ ...current, theme: { ...current.theme, border_radius: value } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="md">Media</SelectItem>
                    <SelectItem value="lg">Grande</SelectItem>
                    <SelectItem value="xl">Extra grande</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Disposicao do conteudo</Label>
                <Select value={popup.theme.layout_mode || "column"} onValueChange={(value: "column" | "row") => updatePopup((current) => ({
                  ...current,
                  theme: {
                    ...current.theme,
                    layout_mode: value,
                    image_position: value === "row"
                      ? (current.theme.image_position === "bottom" ? "left" : current.theme.image_position === "top" ? "left" : current.theme.image_position)
                      : (current.theme.image_position === "left" ? "top" : current.theme.image_position === "right" ? "top" : current.theme.image_position),
                  },
                }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="column">Em coluna</SelectItem>
                    <SelectItem value="row">Lado a lado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Posicao da imagem</Label>
                <Select value={popup.theme.image_position || "top"} onValueChange={(value: "top" | "bottom" | "left" | "right") => updatePopup((current) => ({ ...current, theme: { ...current.theme, image_position: value } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(popup.theme.layout_mode || "column") === "row" ? (
                      <>
                        <SelectItem value="left">Ao lado esquerdo</SelectItem>
                        <SelectItem value="right">Ao lado direito</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="top">Em cima</SelectItem>
                        <SelectItem value="bottom">Em baixo</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tamanho da imagem</Label>
                <Select value={popup.theme.image_size || "md"} onValueChange={(value: "sm" | "md" | "lg" | "half") => updatePopup((current) => ({ ...current, theme: { ...current.theme, image_size: value } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sm">Pequena</SelectItem>
                    <SelectItem value="md">Media</SelectItem>
                    <SelectItem value="lg">Grande</SelectItem>
                    <SelectItem value="half">Metade do popup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2"><Label>Fonte do corpo</Label><Input value={popup.theme.font_family} onChange={(e) => updatePopup((current) => ({ ...current, theme: { ...current.theme, font_family: e.target.value } }))} /></div>
              <div className="space-y-2"><Label>Fonte do titulo</Label><Input value={popup.theme.title_font_family} onChange={(e) => updatePopup((current) => ({ ...current, theme: { ...current.theme, title_font_family: e.target.value } }))} /></div>
            </div>
            <div className="grid gap-4 lg:grid-cols-4">
              <div className="space-y-2"><Label>Fundo do painel</Label><Input type="color" value={popup.theme.panel_background} onChange={(e) => updatePopup((current) => ({ ...current, theme: { ...current.theme, panel_background: e.target.value } }))} /></div>
              <div className="space-y-2"><Label>Texto do painel</Label><Input type="color" value={popup.theme.panel_text_color} onChange={(e) => updatePopup((current) => ({ ...current, theme: { ...current.theme, panel_text_color: e.target.value } }))} /></div>
              <div className="space-y-2"><Label>Cor do botao</Label><Input type="color" value={popup.theme.button_color} onChange={(e) => updatePopup((current) => ({ ...current, theme: { ...current.theme, button_color: e.target.value } }))} /></div>
              <div className="space-y-2"><Label>Texto do botao</Label><Input type="color" value={popup.theme.button_text_color} onChange={(e) => updatePopup((current) => ({ ...current, theme: { ...current.theme, button_text_color: e.target.value } }))} /></div>
              {advancedMode && <div className="space-y-2"><Label>Fundo dos campos</Label><Input type="color" value={popup.theme.field_background} onChange={(e) => updatePopup((current) => ({ ...current, theme: { ...current.theme, field_background: e.target.value } }))} /></div>}
              {advancedMode && <div className="space-y-2"><Label>Texto dos campos</Label><Input type="color" value={popup.theme.field_text_color} onChange={(e) => updatePopup((current) => ({ ...current, theme: { ...current.theme, field_text_color: e.target.value } }))} /></div>}
              {advancedMode && <div className="space-y-2"><Label>Borda dos campos</Label><Input type="color" value={popup.theme.field_border_color} onChange={(e) => updatePopup((current) => ({ ...current, theme: { ...current.theme, field_border_color: e.target.value } }))} /></div>}
              {advancedMode && <div className="space-y-2"><Label>Overlay</Label><Input type="color" value={popup.theme.overlay_color} onChange={(e) => updatePopup((current) => ({ ...current, theme: { ...current.theme, overlay_color: e.target.value } }))} /></div>}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {advancedMode && <div className="space-y-2"><Label>Opacidade do overlay (%)</Label><Input type="number" min={0} max={100} value={String(popup.theme.overlay_opacity)} onChange={(e) => updatePopup((current) => ({ ...current, theme: { ...current.theme, overlay_opacity: Number(e.target.value) || 0 } }))} /></div>}
              <div className="space-y-2">
                <Label>Modo de fundo</Label>
                <Select value={popup.theme.background_mode} onValueChange={(value: "solid" | "image") => updatePopup((current) => ({ ...current, theme: { ...current.theme, background_mode: value } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">Cor solida</SelectItem>
                    <SelectItem value="image">Imagem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2"><Label>Cor do fundo</Label><Input type="color" value={popup.theme.background_color} onChange={(e) => updatePopup((current) => ({ ...current, theme: { ...current.theme, background_color: e.target.value } }))} /></div>
              <div className="space-y-2">
                <Label>Imagem principal</Label>
                <Input value={popup.theme.top_image_url || ""} onChange={(e) => updatePopup((current) => ({ ...current, theme: { ...current.theme, top_image_url: e.target.value } }))} placeholder="https://..." />
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor="main-popup-image-upload" className="cursor-pointer">
                    <div className="inline-flex h-9 items-center justify-center rounded-md border border-input px-3 text-sm">
                      {uploadingImageKey === "top_image_url" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                      Enviar imagem
                    </div>
                  </Label>
                  <input id="main-popup-image-upload" type="file" accept="image/*" className="hidden" onChange={(event) => handleImageUpload(event, "top_image_url")} />
                </div>
              </div>
            </div>

            {popup.theme.background_mode === "image" && (
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-2 lg:col-span-3">
                  <Label>Imagem de fundo</Label>
                  <Input value={popup.theme.background_image_url || ""} onChange={(e) => updatePopup((current) => ({ ...current, theme: { ...current.theme, background_image_url: e.target.value } }))} placeholder="https://..." />
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor="background-popup-image-upload" className="cursor-pointer">
                      <div className="inline-flex h-9 items-center justify-center rounded-md border border-input px-3 text-sm">
                        {uploadingImageKey === "background_image_url" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                        Enviar imagem de fundo
                      </div>
                    </Label>
                    <input id="background-popup-image-upload" type="file" accept="image/*" className="hidden" onChange={(event) => handleImageUpload(event, "background_image_url")} />
                  </div>
                </div>
                <div className="space-y-2"><Label>Foco horizontal (%)</Label><Input type="number" min={0} max={100} value={String(popup.theme.background_image_focus_x)} onChange={(e) => updatePopup((current) => ({ ...current, theme: { ...current.theme, background_image_focus_x: Number(e.target.value) || 50 } }))} /></div>
                <div className="space-y-2"><Label>Foco vertical (%)</Label><Input type="number" min={0} max={100} value={String(popup.theme.background_image_focus_y)} onChange={(e) => updatePopup((current) => ({ ...current, theme: { ...current.theme, background_image_focus_y: Number(e.target.value) || 50 } }))} /></div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="gatilho">
          <Card className="space-y-4 p-5">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
              Escolha quando o pop-up deve aparecer. Em caso de duvida, use atraso de alguns segundos.
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>Modo de disparo</Label>
                <Select value={popup.trigger.mode} onValueChange={(value: "on_load" | "delay" | "click" | "manual") => updatePopup((current) => ({ ...current, trigger: { ...current.trigger, mode: value } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on_load">Ao carregar</SelectItem>
                    <SelectItem value="delay">Depois de alguns segundos</SelectItem>
                    <SelectItem value="click">Ao clicar em um botao</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Frequencia</Label>
                <Select value={popup.trigger.frequency} onValueChange={(value: "always" | "once_per_session" | "once_per_day") => updatePopup((current) => ({ ...current, trigger: { ...current.trigger, frequency: value } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="always">Sempre mostrar</SelectItem>
                    <SelectItem value="once_per_session">Uma vez por sessao</SelectItem>
                    <SelectItem value="once_per_day">Uma vez por dia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {popup.trigger.mode === "delay" && <div className="space-y-2"><Label>Delay em segundos</Label><Input type="number" min={0} value={String(popup.trigger.delay_seconds)} onChange={(e) => updatePopup((current) => ({ ...current, trigger: { ...current.trigger, delay_seconds: Number(e.target.value) || 0 } }))} /></div>}
            {popup.trigger.mode === "click" && <div className="space-y-2"><Label>Seletor do botao</Label><Input value={popup.trigger.click_selector || ""} onChange={(e) => updatePopup((current) => ({ ...current, trigger: { ...current.trigger, click_selector: e.target.value } }))} placeholder=".botao-checkout ou #cta-principal" /></div>}
            <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium">Mostrar botao de fechar</p>
                <p className="text-xs text-muted-foreground">Permite que o visitante feche o modal manualmente.</p>
              </div>
              <Switch checked={popup.trigger.show_close_button} onCheckedChange={(checked) => updatePopup((current) => ({ ...current, trigger: { ...current.trigger, show_close_button: checked } }))} />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="integracoes">
          <Card className="space-y-5 p-5">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
              Defina o que acontece depois que a pessoa envia. O restante fica no modo avancado.
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>O que acontece depois do envio</Label>
                <Select value={popup.integrations.success_mode} onValueChange={(value: "inline_message" | "redirect" | "whatsapp") => updatePopup((current) => ({ ...current, integrations: { ...current.integrations, success_mode: value } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inline_message">Mostrar mensagem</SelectItem>
                    <SelectItem value="redirect">Redirecionar</SelectItem>
                    <SelectItem value="whatsapp">Abrir WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {popup.integrations.success_mode === "redirect" && <div className="space-y-2"><Label>URL de redirecionamento</Label><Input value={popup.integrations.redirect_url || ""} onChange={(e) => updatePopup((current) => ({ ...current, integrations: { ...current.integrations, redirect_url: e.target.value } }))} placeholder="https://checkout..." /></div>}
              {popup.integrations.success_mode === "whatsapp" && (
                <>
                  <div className="space-y-2"><Label>Numero de WhatsApp</Label><Input value={popup.integrations.whatsapp_phone || ""} onChange={(e) => updatePopup((current) => ({ ...current, integrations: { ...current.integrations, whatsapp_phone: e.target.value } }))} placeholder="+5511999999999" /></div>
                  <div className="space-y-2"><Label>Mensagem inicial</Label><Input value={popup.integrations.whatsapp_message || ""} onChange={(e) => updatePopup((current) => ({ ...current, integrations: { ...current.integrations, whatsapp_message: e.target.value } }))} /></div>
                </>
              )}
            </div>

            {!advancedMode && (
              <div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                Funil, tags e flow aparecem quando o modo avancado estiver ligado.
              </div>
            )}

            <div className="rounded-2xl border border-border/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Meta Pixel</p>
                  <p className="text-xs text-muted-foreground">Rastreia view, open, submit e redirect.</p>
                </div>
                <Switch checked={Boolean(popup.integrations.pixel_enabled)} onCheckedChange={(checked) => updatePopup((current) => ({ ...current, integrations: { ...current.integrations, pixel_enabled: checked } }))} />
              </div>
              {popup.integrations.pixel_enabled && <div className="mt-4 space-y-2"><Label>ID do Pixel</Label><Input value={popup.integrations.pixel_id || ""} onChange={(e) => updatePopup((current) => ({ ...current, integrations: { ...current.integrations, pixel_id: e.target.value } }))} placeholder="123456789012345" /></div>}
            </div>

            {advancedMode && (
              <>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Funil</Label>
                    <Select value={popup.integrations.funnel_id || "none"} onValueChange={(value) => updatePopup((current) => ({ ...current, integrations: { ...current.integrations, funnel_id: value === "none" ? null : value, stage_id: value === "none" ? null : current.integrations.stage_id } }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione um funil" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem funil</SelectItem>
                        {funnels.map((funnel) => <SelectItem key={funnel.id} value={funnel.id}>{funnel.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Etapa do funil</Label>
                    <Select value={popup.integrations.stage_id || "none"} onValueChange={(value) => updatePopup((current) => ({ ...current, integrations: { ...current.integrations, stage_id: value === "none" ? null : value } }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione uma etapa" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem etapa</SelectItem>
                        {availableStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Flow ao enviar</Label>
                    <Select value={popup.integrations.flow_on_submit_id || "none"} onValueChange={(value) => updatePopup((current) => ({ ...current, integrations: { ...current.integrations, flow_on_submit_id: value === "none" ? null : value } }))}>
                      <SelectTrigger><SelectValue placeholder="Nenhum flow" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum flow</SelectItem>
                        {flows.map((flow) => <SelectItem key={flow.id} value={flow.id}>{flow.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>Tags aplicadas</Label>
                    <p className="text-xs text-muted-foreground">As tags serao anexadas ao lead capturado.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => {
                      const selected = (popup.integrations.tag_ids || []).includes(tag.id);
                      return (
                        <Button key={tag.id} type="button" variant={selected ? "default" : "outline"} size="sm" onClick={() => toggleTag(tag.id)} className="gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color || "#8B5CF6" }} />
                          {tag.name}
                        </Button>
                      );
                    })}
                    {!tags.length && <p className="text-sm text-muted-foreground">Nenhuma tag cadastrada.</p>}
                  </div>
                </div>
              </>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="instalacao">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="space-y-4 p-5">
              <div className="flex items-center gap-2"><MonitorSmartphone className="h-4 w-4 text-primary" /><h2 className="font-semibold">Codigo para instalar</h2></div>
              <p className="text-sm text-muted-foreground">Cole este codigo no final da sua pagina. Depois disso, basta publicar para ele comecar a funcionar.</p>
              {popup.status !== "published" && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                  O codigo pode ser copiado agora, mas ele so vai funcionar depois de <strong>publicar</strong>.
                </div>
              )}
              <Textarea readOnly rows={4} value={installSnippet} className="font-mono text-xs" />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => copyText(installSnippet, "Codigo")}><Copy className="mr-2 h-4 w-4" />Copiar codigo</Button>
              </div>
            </Card>

            {advancedMode && (
              <>
                <Card className="space-y-4 p-5">
                  <div className="flex items-center gap-2"><MousePointerClick className="h-4 w-4 text-primary" /><h2 className="font-semibold">Abertura manual</h2></div>
                  <p className="text-sm text-muted-foreground">Se preferir abrir via botao personalizado da pagina, use este codigo adicional.</p>
                  <Textarea readOnly rows={4} value={manualOpenSnippet} className="font-mono text-xs" />
                  <Button variant="outline" onClick={() => copyText(manualOpenSnippet, "Codigo manual")}><Copy className="mr-2 h-4 w-4" />Copiar codigo manual</Button>
                </Card>

                <Card className="space-y-4 p-5 lg:col-span-2">
                  <div className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /><h2 className="font-semibold">Resumo tecnico</h2></div>
                  <div className="grid gap-3 text-sm lg:grid-cols-3">
                    <div className="rounded-xl border border-border/60 p-3"><p className="font-medium">Identificador publico</p><p className="mt-1 text-muted-foreground">{popup.slug}</p></div>
                    <div className="rounded-xl border border-border/60 p-3"><p className="font-medium">Exibicao</p><p className="mt-1 text-muted-foreground">{getTriggerModeLabel(popup.trigger.mode)}</p></div>
                    <div className="rounded-xl border border-border/60 p-3"><p className="font-medium">Depois do envio</p><p className="mt-1 text-muted-foreground">{getSuccessModeLabel(popup.integrations.success_mode)}</p></div>
                  </div>
                </Card>
              </>
            )}
          </div>
        </TabsContent>

      </Tabs>

      <div className="space-y-4 xl:sticky xl:top-24 self-start">
        {renderPopupPreview(popup, orderedFields, previewBackground, panelStyle, previewValues, handlePreviewValueChange)}
      </div>
    </div>
    </div>
  );
}
