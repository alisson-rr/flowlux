"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  CirclePlus,
  Eye,
  GripVertical,
  ImagePlus,
  Loader2,
  Monitor,
  Palette,
  Plus,
  Rocket,
  Save,
  Settings2,
  Smartphone,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PRE_CHECKOUT_DEFAULT_SESSION_SETTINGS,
  PRE_CHECKOUT_DEFAULT_THEME,
  PRE_CHECKOUT_SYSTEM_MESSAGE_DEFAULTS,
} from "@/lib/pre-checkout/templates";
import { slugifyPreCheckoutFormName, validatePreCheckoutPublish } from "@/lib/pre-checkout/forms";
import {
  PRE_CHECKOUT_STEP_PALETTE,
  createBuilderStep,
  createDefaultConnectConfig,
  createDefaultWorkflowAction,
  createDefaultWorkflowTrigger,
  normalizeBuilderSteps,
} from "@/lib/pre-checkout/builder";
import type {
  PreCheckoutForm,
  PreCheckoutFormStep,
  PreCheckoutFormStepType,
  PreCheckoutStepOption,
  PreCheckoutSystemMessages,
  PreCheckoutWorkflowAction,
  PreCheckoutWorkflowCondition,
  PreCheckoutWorkflowTrigger,
} from "@/types";

type FunnelOption = { id: string; name: string };
type StageOption = { id: string; name: string; funnel_id: string };
type TagOption = { id: string; name: string; color: string };
type FlowOption = { id: string; name: string; is_active: boolean };

const TAB_CONTENT = "conteudo";
const TAB_WORKFLOW = "workflow";
const TAB_CONNECT = "conexoes";
const TAB_SETTINGS = "configuracoes";

const PANEL_PADDING: Record<PreCheckoutForm["theme"]["layout"]["spacing"], string> = {
  compact: "p-6",
  comfortable: "p-8",
  relaxed: "p-10",
};

const INPUT_RADIUS: Record<PreCheckoutForm["theme"]["typography"]["input_radius"], string> = {
  sm: "rounded-xl",
  md: "rounded-2xl",
  lg: "rounded-[20px]",
  full: "rounded-full",
};

const BUTTON_RADIUS: Record<PreCheckoutForm["theme"]["typography"]["button_radius"], string> = {
  sm: "rounded-xl",
  md: "rounded-2xl",
  lg: "rounded-[20px]",
  full: "rounded-full",
};

const LAYOUT_SPACING_OPTIONS: Array<{ value: PreCheckoutForm["theme"]["layout"]["spacing"]; label: string }> = [
  { value: "compact", label: "Mais enxuto" },
  { value: "comfortable", label: "Confortavel" },
  { value: "relaxed", label: "Respirado" },
];

const RADIUS_OPTIONS: Array<{ value: PreCheckoutForm["theme"]["typography"]["input_radius"]; label: string }> = [
  { value: "sm", label: "Suave" },
  { value: "md", label: "Medio" },
  { value: "lg", label: "Arredondado" },
  { value: "full", label: "Capsula" },
];

const FONT_OPTIONS = [
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "DM Sans", value: "'DM Sans', sans-serif" },
  { label: "Manrope", value: "Manrope, sans-serif" },
  { label: "Poppins", value: "Poppins, sans-serif" },
  { label: "Montserrat", value: "Montserrat, sans-serif" },
  { label: "Lora", value: "Lora, serif" },
  { label: "Merriweather", value: "Merriweather, serif" },
  { label: "Playfair Display", value: "'Playfair Display', serif" },
  { label: "Nunito", value: "Nunito, sans-serif" },
  { label: "Open Sans", value: "'Open Sans', sans-serif" },
];

const LOGO_SIZE_OPTIONS: Array<{ value: "sm" | "md" | "lg" | "xl"; label: string }> = [
  { value: "sm", label: "Pequeno" },
  { value: "md", label: "Medio" },
  { value: "lg", label: "Grande" },
  { value: "xl", label: "Gigante" },
];

const STEP_MEDIA_LAYOUT_DESKTOP_OPTIONS: Array<{ value: "top" | "right" | "right-wide" | "left" | "left-wide" | "background"; label: string }> = [
  { value: "top", label: "Topo" },
  { value: "right", label: "Direita" },
  { value: "right-wide", label: "Direita ampla" },
  { value: "left", label: "Esquerda" },
  { value: "left-wide", label: "Esquerda ampla" },
  { value: "background", label: "Fundo" },
];

const STEP_MEDIA_LAYOUT_MOBILE_OPTIONS: Array<{ value: "top" | "top-wide" | "background" | "hidden"; label: string }> = [
  { value: "top", label: "Topo" },
  { value: "top-wide", label: "Topo amplo" },
  { value: "background", label: "Fundo" },
  { value: "hidden", label: "Sem imagem" },
];

const WORKFLOW_TRIGGER_OPTIONS: Array<{ value: PreCheckoutWorkflowTrigger["type"]; label: string; description: string }> = [
  { value: "any_full_response", label: "Qualquer resposta completa", description: "Dispara sempre que alguém conclui o form." },
  { value: "full_response_with_conditions", label: "Resposta completa com condições", description: "Dispara só quando as respostas atendem às condições." },
  { value: "ending_reached", label: "Final específico atingido", description: "Dispara quando o lead cai em um final específico." },
  { value: "abandoned", label: "Abandono", description: "Dispara quando o lead sai sem concluir." },
];

const WORKFLOW_ACTION_OPTIONS: Array<{ value: PreCheckoutWorkflowAction["type"]; label: string; description: string }> = [
  { value: "send_whatsapp_respondent", label: "Enviar WhatsApp para o lead", description: "Entrega a mensagem no numero respondido no form." },
  { value: "send_whatsapp_internal", label: "Enviar WhatsApp interno", description: "Notifica equipe ou parceiro em um numero especifico." },
  { value: "apply_tags", label: "Aplicar tags", description: "Marca o lead no CRM para segmentacao." },
  { value: "move_stage", label: "Mover etapa do funil", description: "Leva o lead para outra etapa automaticamente." },
  { value: "start_flow", label: "Iniciar fluxo", description: "Aciona um fluxo ja existente no FlowUp." },
  { value: "redirect_url", label: "Redirecionar URL", description: "Sobrescreve o destino final para um link especifico." },
  { value: "webhook", label: "Enviar webhook", description: "Entrega os dados para outra ferramenta." },
];

function sanitizeTheme(theme?: Partial<PreCheckoutForm["theme"]>): PreCheckoutForm["theme"] {
  const defaultTheme = PRE_CHECKOUT_DEFAULT_THEME;
  const branding = (theme?.branding || {}) as Partial<NonNullable<PreCheckoutForm["theme"]["branding"]>>;
  const background = (theme?.background || {}) as Partial<PreCheckoutForm["theme"]["background"]>;
  const typography = (theme?.typography || {}) as Partial<PreCheckoutForm["theme"]["typography"]>;
  const layout = (theme?.layout || {}) as Partial<PreCheckoutForm["theme"]["layout"]>;

  return {
    style_key: theme?.style_key || defaultTheme.style_key,
    primary_color: theme?.primary_color || defaultTheme.primary_color,
    button_text_color: theme?.button_text_color || defaultTheme.button_text_color,
    text_color: theme?.text_color || defaultTheme.text_color,
    panel_color: theme?.panel_color || defaultTheme.panel_color,
    input_background_color: theme?.input_background_color || defaultTheme.input_background_color,
    input_text_color: theme?.input_text_color || defaultTheme.input_text_color,
    input_border_color: theme?.input_border_color || defaultTheme.input_border_color,
    background: {
      mode: background.mode || defaultTheme.background.mode,
      color: background.color || defaultTheme.background.color,
      image_url: background.image_url ?? defaultTheme.background.image_url,
      image_focus_x: background.image_focus_x ?? defaultTheme.background.image_focus_x,
      image_focus_y: background.image_focus_y ?? defaultTheme.background.image_focus_y,
    },
    typography: {
      heading_font: typography.heading_font || defaultTheme.typography.heading_font,
      body_font: typography.body_font || defaultTheme.typography.body_font,
      form_font: typography.form_font || defaultTheme.typography.form_font,
      button_radius: typography.button_radius || defaultTheme.typography.button_radius,
      input_radius: typography.input_radius || defaultTheme.typography.input_radius,
    },
    layout: {
      align: layout.align || defaultTheme.layout.align,
      spacing: layout.spacing || defaultTheme.layout.spacing,
    },
    branding: {
      ...(defaultTheme.branding || {}),
      logo_url: branding.logo_url ?? defaultTheme.branding?.logo_url ?? null,
      logo_position: branding.logo_position || defaultTheme.branding?.logo_position || "center",
      logo_size: branding.logo_size || defaultTheme.branding?.logo_size || "md",
      background_image_url: branding.background_image_url ?? defaultTheme.branding?.background_image_url ?? null,
      background_image_focus_x: branding.background_image_focus_x ?? defaultTheme.branding?.background_image_focus_x ?? 50,
      background_image_focus_y: branding.background_image_focus_y ?? defaultTheme.branding?.background_image_focus_y ?? 50,
      background_brightness: branding.background_brightness ?? defaultTheme.branding?.background_brightness,
    },
  };
}

function sanitizeStepSettings(settings?: PreCheckoutFormStep["settings"]): PreCheckoutFormStep["settings"] {
  const current = settings || {};
  return {
    auto_focus: current.auto_focus,
    max_length: current.max_length ?? null,
    min_value: current.min_value ?? null,
    max_value: current.max_value ?? null,
    min_label: current.min_label ?? null,
    max_label: current.max_label ?? null,
    button_label: current.button_label ?? null,
    image_url: current.image_url ?? null,
    video_url: current.video_url ?? null,
    media_kind: current.media_kind ?? null,
    media_brightness: current.media_brightness ?? null,
    media_layout_desktop: current.media_layout_desktop ?? null,
    media_layout_mobile: current.media_layout_mobile ?? null,
    legal_consent_text: current.legal_consent_text ?? null,
    legal_required_label: current.legal_required_label ?? null,
    map_to_contact_field: current.map_to_contact_field ?? null,
  };
}

function sanitizeStep(step: PreCheckoutFormStep): PreCheckoutFormStep {
  return {
    ...step,
    settings: sanitizeStepSettings(step.settings),
  };
}

const SYSTEM_MESSAGE_SECTIONS = {
  buttons: {
    title: "Botões, dicas e atalhos",
    fields: [
      { key: "confirm_answer", label: "Botão para confirmar resposta" },
      { key: "next_hint", label: "Instrução para ir para a próxima pergunta" },
      { key: "multiple_choice_hint", label: "Dica para seleção múltipla" },
      { key: "dropdown_hint", label: "Instrução do dropdown" },
      { key: "dropdown_touch_hint", label: "Instrução do dropdown em telas touch" },
      { key: "other_label", label: "Rótulo da opção Outro" },
      { key: "other_placeholder", label: "Hint do campo Outro" },
      { key: "exact_selection_step_1", label: "Escolha exata - passo 1" },
      { key: "exact_selection_step_2", label: "Escolha exata - passo 2" },
      { key: "range_max_step_1", label: "Faixa com máximo - passo 1" },
      { key: "range_max_step_2", label: "Faixa com máximo - passo 2" },
      { key: "range_between", label: "Faixa com mínimo e máximo" },
      { key: "range_min_step_1", label: "Faixa com mínimo - passo 1" },
      { key: "range_min_step_2", label: "Faixa com mínimo - passo 2" },
      { key: "text_hint", label: "Hint para campo de texto" },
      { key: "option_key_hint", label: "Hint de tecla ao passar o mouse nas opções" },
      { key: "yes_label", label: "Botão Sim" },
      { key: "no_label", label: "Botão Não" },
      { key: "yes_shortcut", label: "Atalho de teclado do Sim", maxLength: 1 },
      { key: "no_shortcut", label: "Atalho de teclado do Não", maxLength: 1 },
      { key: "legal_accept_label", label: "Botão para aceitar termo legal" },
      { key: "legal_reject_label", label: "Botão para rejeitar termo legal" },
      { key: "review_label", label: "Botão para revisar erros" },
      { key: "submit_label", label: "Botão de envio do form" },
      { key: "continue_label", label: "Botão para continuar" },
    ],
  },
  errors: {
    title: "Mensagens de erro",
    fields: [
      { key: "required", label: "Quando a resposta for obrigatória" },
      { key: "selection_required", label: "Quando precisar selecionar uma opção" },
      { key: "value_required", label: "Quando precisar digitar um valor" },
      { key: "legal_rejected", label: "Quando o termo legal for rejeitado" },
      { key: "invalid_email", label: "Quando o e-mail for inválido" },
      { key: "invalid_url", label: "Quando a URL for inválida" },
      { key: "invalid_number_range", label: "Quando o número sair da faixa permitida" },
      { key: "invalid_number_low", label: "Quando o número for menor que o mínimo" },
      { key: "invalid_number_high", label: "Quando o número for maior que o máximo" },
      { key: "dropdown_not_found", label: "Quando não houver sugestão no dropdown" },
      { key: "invalid_phone", label: "Quando o telefone for inválido" },
    ],
  },
  completion: {
    title: "Envio e conclusão",
    fields: [
      { key: "success", label: "Confirmação de envio concluído" },
      { key: "no_connection", label: "Erro sem conexão com o servidor" },
      { key: "server_error", label: "Erro interno no servidor" },
      { key: "unavailable", label: "Erro quando o form estiver indisponível" },
    ],
  },
  other: {
    title: "Outras mensagens",
    fields: [
      { key: "unsupported_device", label: "Alerta de dispositivo não suportado" },
      { key: "line_break_hint", label: "Dica para quebra de linha em texto longo" },
      { key: "file_required", label: "Mensagem quando um arquivo for obrigatório" },
      { key: "file_button", label: "Botão de upload" },
      { key: "file_drop_hint", label: "Dica da área de drop" },
      { key: "file_too_big", label: "Erro quando o arquivo for grande demais" },
      { key: "file_uploading", label: "Mensagem durante upload do arquivo" },
    ],
  },
} as const;

function ensureFormDefaults(form: PreCheckoutForm): PreCheckoutForm {
  const defaultMessages = PRE_CHECKOUT_SYSTEM_MESSAGE_DEFAULTS;
  return {
    ...form,
    theme: sanitizeTheme(form.theme),
    integrations: {
      ...form.integrations,
      workflows: form.integrations?.workflows || [],
      connect: {
        ...createDefaultConnectConfig(),
        ...(form.integrations?.connect || {}),
      },
    },
    session_settings: {
      ...PRE_CHECKOUT_DEFAULT_SESSION_SETTINGS,
      ...(form.session_settings || {}),
      system_messages: {
        ...defaultMessages,
        ...(form.session_settings?.system_messages || {}),
        buttons: {
          ...defaultMessages.buttons,
          ...(form.session_settings?.system_messages?.buttons || {}),
        },
        errors: {
          ...defaultMessages.errors,
          ...(form.session_settings?.system_messages?.errors || {}),
        },
        completion: {
          ...defaultMessages.completion,
          ...(form.session_settings?.system_messages?.completion || {}),
        },
        other: {
          ...defaultMessages.other,
          ...(form.session_settings?.system_messages?.other || {}),
        },
      },
    },
  };
}

function getStatusLabel(status: PreCheckoutForm["status"]) {
  if (status === "published") return "Publicado";
  if (status === "paused") return "Pausado";
  if (status === "archived") return "Arquivado";
  return "Rascunho";
}

function getStepIconLabel(type: PreCheckoutFormStepType) {
  const item = PRE_CHECKOUT_STEP_PALETTE.find((entry) => entry.type === type);
  return item?.label || type;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeOptionValue(value: string, index: number) {
  return slugifyPreCheckoutFormName(value) || `opcao_${index + 1}`;
}

function radiusClass(radius: "sm" | "md" | "lg" | "full") {
  if (radius === "sm") return "rounded-xl";
  if (radius === "lg") return "rounded-3xl";
  if (radius === "full") return "rounded-full";
  return "rounded-2xl";
}

function getLogoSizeClass(size?: NonNullable<PreCheckoutForm["theme"]["branding"]>["logo_size"]) {
  if (size === "sm") return "max-h-10 max-w-[140px]";
  if (size === "lg") return "max-h-20 max-w-[260px]";
  if (size === "xl") return "max-h-28 max-w-[320px]";
  return "max-h-14 max-w-[180px]";
}

function getStepMediaLayout(
  settings: PreCheckoutFormStep["settings"] | undefined,
  device: "desktop" | "mobile"
) {
  if (device === "mobile") return settings?.media_layout_mobile || "background";
  return settings?.media_layout_desktop || "background";
}

function MediaLayoutButton({
  active,
  label,
  type,
  onClick,
}: {
  active: boolean;
  label: string;
  type: string;
  onClick: () => void;
}) {
  const frameClass = active ? "border-primary bg-primary/10" : "border-white/10 bg-[#171821] hover:border-primary/30";
  const bar = "rounded-sm bg-zinc-300/90";
  const darkBar = "rounded-sm bg-zinc-100/95";

  const preview = (() => {
    if (type === "background") return <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#8B5CF6]"><div className={`h-4 w-5 ${darkBar}`} /></div>;
    if (type === "top" || type === "top-wide") return <div className="flex h-10 w-10 flex-col gap-1 rounded-lg bg-[#232536] p-1.5"><div className={`w-full ${bar} ${type === "top-wide" ? "h-4" : "h-3"}`} /><div className={`h-2 w-4/5 ${darkBar}`} /><div className={`h-2 w-3/5 ${darkBar}`} /></div>;
    if (type === "right" || type === "right-wide") return <div className="flex h-10 w-10 gap-1 rounded-lg bg-[#232536] p-1.5"><div className="flex flex-1 flex-col justify-center gap-1"><div className={`h-2 w-full ${darkBar}`} /><div className={`h-2 w-3/4 ${darkBar}`} /></div><div className={`${bar} rounded-md ${type === "right-wide" ? "w-5" : "w-4"} h-full`} /></div>;
    if (type === "left" || type === "left-wide") return <div className="flex h-10 w-10 gap-1 rounded-lg bg-[#232536] p-1.5"><div className={`${bar} rounded-md ${type === "left-wide" ? "w-5" : "w-4"} h-full`} /><div className="flex flex-1 flex-col justify-center gap-1"><div className={`h-2 w-full ${darkBar}`} /><div className={`h-2 w-3/4 ${darkBar}`} /></div></div>;
    return <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#232536]"><div className={`h-2 w-5 ${darkBar}`} /></div>;
  })();

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-14 w-14 items-center justify-center rounded-2xl border transition ${frameClass}`}
      title={label}
      aria-label={label}
    >
      {preview}
    </button>
  );
}

function FontSearchField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione uma fonte" />
        </SelectTrigger>
        <SelectContent>
          {FONT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AutosizeTextField({
  value,
  onChange,
  placeholder,
  maxLength,
  className,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const resize = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${element.scrollHeight}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [resize, value]);

  return (
    <Textarea
      ref={ref}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      rows={1}
      style={style}
      onChange={(event) => {
        onChange(event.target.value);
        resize();
      }}
      className={`min-h-[44px] resize-none overflow-hidden ${className || ""}`}
    />
  );
}

function SortableStepCard({
  step,
  index,
  selected,
  onClick,
}: {
  step: PreCheckoutFormStep;
  index: number;
  selected: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: step.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-3 transition-all ${
        selected
          ? "border-primary/30 bg-primary/12"
          : "border-white/8 bg-[#171821] hover:border-primary/20 hover:bg-[#1B1D27]"
      } ${isDragging ? "z-20 scale-[0.98] opacity-80 shadow-2xl shadow-black/40" : ""} ${isOver ? "ring-2 ring-primary/20" : ""}`}
    >
      <button
        type="button"
        aria-label="Arrastar etapa"
        {...attributes}
        {...listeners}
        className="flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-xl bg-[#232536] text-primary transition-colors active:cursor-grabbing group-hover:bg-[#2A2D42]"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
        <div className="truncate text-sm font-medium text-white">{step.title || `Etapa ${index + 1}`}</div>
        <div className="truncate text-xs text-zinc-400">{getStepIconLabel(step.type)}</div>
      </button>
    </div>
  );
}

function StepCanvasPreview({
  form,
  step,
  stepIndex,
  totalSteps,
  onUpdate,
  previewDevice,
}: {
  form: PreCheckoutForm;
  step: PreCheckoutFormStep;
  stepIndex: number;
  totalSteps: number;
  onUpdate: (updater: (step: PreCheckoutFormStep) => PreCheckoutFormStep) => void;
  previewDevice: "desktop" | "mobile";
}) {
  const inputRadius = INPUT_RADIUS[form.theme.typography.input_radius];
  const buttonRadius = BUTTON_RADIUS[form.theme.typography.button_radius];
  const options = step.options || [];
  const isChoice = ["single_choice", "picture_choice", "multiple_choice", "dropdown", "yes_no"].includes(step.type);
  const mediaBrightness = step.settings?.media_brightness ?? 100;
  const previewWidthClass = previewDevice === "mobile" ? "max-w-[390px]" : "max-w-[900px]";
  const previewSpacingClass =
    form.theme.layout.spacing === "compact" ? "space-y-5 p-6" : form.theme.layout.spacing === "relaxed" ? "space-y-9 p-10" : "space-y-7 p-8";
  const stepMediaLayout = getStepMediaLayout(step.settings, previewDevice);
  const globalBackgroundImageUrl =
    form.theme.branding?.background_image_url ||
    (form.theme.background.mode === "image" ? form.theme.background.image_url : null) ||
    null;
  const globalBackgroundPosition = `${form.theme.branding?.background_image_focus_x || form.theme.background.image_focus_x}% ${form.theme.branding?.background_image_focus_y || form.theme.background.image_focus_y}%`;
  const globalBackgroundBrightness = form.theme.branding?.background_brightness || 100;
  const stepVideoUrl = step.settings?.video_url || null;
  const stepImageUrl = !stepVideoUrl ? step.settings?.image_url || null : null;
  const stepHasVisual = Boolean(stepVideoUrl || stepImageUrl);
  const surfaceHasBackground = Boolean(globalBackgroundImageUrl);
  const contentUsesOverlay = surfaceHasBackground || (stepHasVisual && stepMediaLayout === "background");
  const usesBackgroundMedia = stepHasVisual && stepMediaLayout === "background";
  const surfaceTextColor = contentUsesOverlay ? "#FFFFFF" : form.theme.text_color;
  const surfaceMetaColor = contentUsesOverlay ? "rgba(255,255,255,0.72)" : "#8C92A4";
  const contentTextColor = surfaceTextColor;
  const contentMetaColor = surfaceMetaColor;
  const surfaceInputStyle: React.CSSProperties = contentUsesOverlay
    ? {
        backgroundColor: "rgba(15, 23, 42, 0.55)",
        borderColor: "rgba(255,255,255,0.16)",
        color: "#FFFFFF",
      }
    : {
        backgroundColor: form.theme.input_background_color || "#FFFFFF",
        borderColor: form.theme.input_border_color || "#D8DDE7",
        color: form.theme.input_text_color || "#111827",
      };

  const mediaNode = stepHasVisual ? (
    <div className="relative h-full w-full overflow-hidden rounded-[28px] border border-white/10 bg-[#0B0B12]">
      {stepVideoUrl ? (
        <video
          src={stepVideoUrl}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: `brightness(${mediaBrightness}%)` }}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : stepImageUrl ? (
        <img
          src={stepImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: `brightness(${mediaBrightness}%)`, objectPosition: "50% 50%" }}
        />
      ) : null}
    </div>
  ) : null;
  const backgroundMediaNode = surfaceHasBackground ? (
    <div className="absolute inset-0 overflow-hidden bg-[#0B0B12]">
      {globalBackgroundImageUrl ? (
        <img
          src={globalBackgroundImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: `brightness(${globalBackgroundBrightness}%)`, objectPosition: globalBackgroundPosition }}
        />
      ) : null}
    </div>
  ) : null;
  const stepBackgroundNode = usesBackgroundMedia ? (
    <div className="absolute inset-0 overflow-hidden bg-[#0B0B12]">
      {stepVideoUrl ? (
        <video
          src={stepVideoUrl}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: `brightness(${mediaBrightness}%)` }}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : stepImageUrl ? (
        <img
          src={stepImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: `brightness(${mediaBrightness}%)`, objectPosition: "50% 50%" }}
        />
      ) : null}
    </div>
  ) : null;

  const contentNode = (
    <div className="mx-auto w-full max-w-[720px] space-y-5">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em]" style={{ color: contentMetaColor }}>
        <span>Etapa {stepIndex + 1}</span>
        <span>{stepIndex + 1}/{totalSteps}</span>
      </div>

      <AutosizeTextField
        value={step.title}
        onChange={(value) => onUpdate((current) => ({ ...current, title: value }))}
        className="border-0 px-0 text-center text-3xl font-semibold shadow-none focus-visible:ring-0"
        style={{ fontFamily: form.theme.typography.heading_font, backgroundColor: "transparent", color: contentTextColor }}
        placeholder="Digite o titulo da etapa"
      />

      <AutosizeTextField
        value={textValue(step.description)}
        onChange={(value) => onUpdate((current) => ({ ...current, description: value }))}
        className="min-h-[72px] border-0 px-0 text-center text-base shadow-none focus-visible:ring-0"
        style={{ backgroundColor: "transparent", color: contentTextColor }}
        placeholder="Adicione um apoio opcional para esta etapa"
      />

      {step.type === "welcome_screen" || step.type === "statement" || step.type === "end_screen" ? (
        <Button
          type="button"
          className={`h-12 px-8 ${buttonRadius}`}
          style={{ backgroundColor: form.theme.primary_color, color: form.theme.button_text_color || "#FFFFFF" }}
        >
          {step.type === "welcome_screen"
            ? PRE_CHECKOUT_SYSTEM_MESSAGE_DEFAULTS.buttons.continue_label
            : step.type === "end_screen"
              ? PRE_CHECKOUT_SYSTEM_MESSAGE_DEFAULTS.buttons.submit_label
              : PRE_CHECKOUT_SYSTEM_MESSAGE_DEFAULTS.buttons.confirm_answer}
        </Button>
      ) : step.type === "long_text" ? (
        <Textarea
          value={textValue(step.placeholder)}
          onChange={(event) => onUpdate((current) => ({ ...current, placeholder: event.target.value }))}
          className={`min-h-[160px] border px-5 py-4 text-base shadow-none ${inputRadius}`}
          style={surfaceInputStyle}
          placeholder="Texto de ajuda dentro do campo"
        />
      ) : step.type === "dropdown" ? (
        <div className={`border px-5 py-4 text-base ${inputRadius}`} style={surfaceInputStyle}>
          {step.placeholder || form.session_settings.system_messages?.buttons.dropdown_hint || "Digite ou selecione uma opcao"}
        </div>
      ) : step.type === "picture_choice" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {options.map((option) => (
            <div key={option.id} className={`overflow-hidden border ${inputRadius}`} style={surfaceInputStyle}>
              <div className="aspect-[4/3] w-full overflow-hidden border-b border-white/10 bg-black/10">
                {option.image_url ? (
                  <img src={option.image_url} alt={option.label} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm opacity-60">Imagem da opção</div>
                )}
              </div>
              <div className="px-4 py-3 text-base">{option.label}</div>
            </div>
          ))}
        </div>
      ) : isChoice ? (
        <div className="grid gap-3">
          {options.map((option) => (
            <div key={option.id} className={`border px-5 py-4 text-base ${inputRadius}`} style={surfaceInputStyle}>
              {option.label}
            </div>
          ))}
        </div>
      ) : step.type === "rating" || step.type === "opinion_scale" || step.type === "nps" ? (
        <div className="flex flex-wrap justify-center gap-3">
          {Array.from({ length: ((step.settings?.max_value || (step.type === "rating" ? 5 : 10)) - (typeof step.settings?.min_value === "number" ? step.settings.min_value : step.type === "nps" ? 0 : 1)) + 1 }, (_, index) => (
            <div key={index} className={`flex h-12 w-12 items-center justify-center border text-sm font-semibold ${inputRadius}`} style={surfaceInputStyle}>
              {(typeof step.settings?.min_value === "number" ? step.settings.min_value : step.type === "nps" ? 0 : 1) + index}
            </div>
          ))}
        </div>
      ) : step.type === "legal" ? (
        <div className={`border px-5 py-4 text-base ${inputRadius}`} style={surfaceInputStyle}>
          {step.settings?.legal_consent_text || "Eu aceito continuar"}
        </div>
      ) : (
        <Input
          value={textValue(step.placeholder)}
          onChange={(event) => onUpdate((current) => ({ ...current, placeholder: event.target.value }))}
          className={`h-14 border px-5 text-base shadow-none ${inputRadius}`}
          style={surfaceInputStyle}
          placeholder="Texto de ajuda dentro do campo"
        />
      )}
    </div>
  );

  return (
    <div className={`mx-auto w-full ${previewWidthClass}`}>
      <div
        className="relative overflow-hidden rounded-[32px] border border-white/10"
        style={{
          backgroundColor: form.theme.panel_color,
          color: contentTextColor,
          fontFamily: form.theme.typography.form_font,
          minHeight: previewDevice === "mobile" ? 680 : 560,
        }}
      >
        {surfaceHasBackground ? backgroundMediaNode : null}
        {usesBackgroundMedia ? stepBackgroundNode : null}
        {contentUsesOverlay ? <div className="absolute inset-0 bg-black/35" /> : null}

        <div className={`relative z-10 flex min-h-[inherit] flex-col ${previewSpacingClass}`}>
          {form.theme.branding?.logo_url ? (
            <div className={`flex ${form.theme.branding.logo_position === "left" ? "justify-start" : "justify-center"}`}>
              <img src={form.theme.branding.logo_url} alt="Logo do form" className={`${getLogoSizeClass(form.theme.branding.logo_size)} w-auto object-contain`} />
            </div>
          ) : null}

          <div className="mx-auto flex w-full max-w-[900px] flex-1 flex-col items-center justify-center text-center">
            {stepHasVisual && !usesBackgroundMedia && (stepMediaLayout === "top" || stepMediaLayout === "top-wide") ? (
              <div className={`mb-6 w-full ${stepMediaLayout === "top-wide" ? "h-64" : "h-44"}`}>
                {mediaNode}
              </div>
            ) : null}

            {stepHasVisual && !usesBackgroundMedia && ["left", "left-wide", "right", "right-wide"].includes(stepMediaLayout) ? (
              <div className={`grid w-full flex-1 items-stretch gap-6 ${stepMediaLayout === "left-wide" || stepMediaLayout === "right-wide" ? "md:grid-cols-[1.2fr_0.8fr]" : "md:grid-cols-[1fr_1fr]"}`}>
                {stepMediaLayout.startsWith("left") ? (
                  <>
                    <div className="h-full min-h-[420px]">{mediaNode}</div>
                    <div className="flex flex-col justify-center">{contentNode}</div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col justify-center">{contentNode}</div>
                    <div className="h-full min-h-[420px]">{mediaNode}</div>
                  </>
                )}
              </div>
            ) : (
              contentNode
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FormularioEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const formId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [currentTab, setCurrentTab] = useState(TAB_CONTENT);
  const [showVisualPanel, setShowVisualPanel] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [form, setForm] = useState<PreCheckoutForm | null>(null);
  const [steps, setSteps] = useState<PreCheckoutFormStep[]>([]);
  const [deletedStepIds, setDeletedStepIds] = useState<string[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [funnels, setFunnels] = useState<FunnelOption[]>([]);
  const [stages, setStages] = useState<StageOption[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved">("idle");
  const [uploadingAssetKey, setUploadingAssetKey] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastPersistedSnapshotRef = useRef("");
  const skipAutosaveRef = useRef(true);
  const isPersistingRef = useRef(false);

  const orderedSteps = useMemo(() => normalizeBuilderSteps(steps), [steps]);
  const selectedStep = useMemo(
    () => orderedSteps.find((step) => step.id === selectedStepId) || orderedSteps[0] || null,
    [orderedSteps, selectedStepId],
  );
  const availableStages = useMemo(
    () => stages.filter((stage) => stage.funnel_id === form?.integrations.funnel_id),
    [form?.integrations.funnel_id, stages],
  );
  const workflows = form?.integrations?.workflows || [];
  const selectedTrigger = workflows.find((trigger) => trigger.id === selectedTriggerId) || workflows[0] || null;
  const selectedAction = selectedTrigger?.actions.find((action) => action.id === selectedActionId) || selectedTrigger?.actions[0] || null;
  const validation = useMemo(
    () => (form ? validatePreCheckoutPublish(form, orderedSteps) : { isValid: false, errors: [] }),
    [form, orderedSteps],
  );
  const previewStorageKey = useMemo(() => (form ? `flowlux-form-preview:${form.id}` : ""), [form]);
  const previewHref = useMemo(() => (form ? `/f/${form.slug || `preview-${form.id}`}?preview=1&formId=${form.id}&editorPreviewKey=${encodeURIComponent(previewStorageKey)}` : "#"), [form, previewStorageKey]);

  const buildSnapshot = useCallback(
    (targetForm: PreCheckoutForm, targetSteps: PreCheckoutFormStep[], targetDeletedIds: string[] = []) =>
      JSON.stringify({
        form: targetForm,
        steps: normalizeBuilderSteps(targetSteps).map((step) => ({
          ...step,
          options: step.options || [],
          settings: step.settings || {},
        })),
        deletedStepIds: [...targetDeletedIds].sort(),
      }),
    [],
  );

  const updateForm = useCallback((updater: (current: PreCheckoutForm) => PreCheckoutForm) => {
    setForm((current) => (current ? updater(current) : current));
  }, []);

  const updateStep = useCallback((stepId: string, updater: (current: PreCheckoutFormStep) => PreCheckoutFormStep) => {
    setSteps((current) => current.map((step) => (step.id === stepId ? updater(step) : step)));
  }, []);

  const updateTrigger = useCallback((triggerId: string, updater: (current: PreCheckoutWorkflowTrigger) => PreCheckoutWorkflowTrigger) => {
    updateForm((current) => ({
      ...current,
      integrations: {
        ...current.integrations,
        workflows: (current.integrations.workflows || []).map((trigger) => (trigger.id === triggerId ? updater(trigger) : trigger)),
      },
    }));
  }, [updateForm]);

  const updateAction = useCallback((triggerId: string, actionId: string, updater: (current: PreCheckoutWorkflowAction) => PreCheckoutWorkflowAction) => {
    updateTrigger(triggerId, (trigger) => ({
      ...trigger,
      actions: trigger.actions.map((action) => (action.id === actionId ? updater(action) : action)),
    }));
  }, [updateTrigger]);

  const handleStepDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedSteps.findIndex((step) => step.id === active.id);
    const newIndex = orderedSteps.findIndex((step) => step.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reorderedSteps = arrayMove(orderedSteps, oldIndex, newIndex).map((step, index) => ({
      ...step,
      position: index,
    }));
    setSteps(reorderedSteps);
  }, [orderedSteps]);

  const updateSystemMessage = useCallback(
    <TGroup extends keyof PreCheckoutSystemMessages, TKey extends keyof PreCheckoutSystemMessages[TGroup]>(
      group: TGroup,
      key: TKey,
      value: PreCheckoutSystemMessages[TGroup][TKey],
    ) => {
      const defaults = PRE_CHECKOUT_DEFAULT_SESSION_SETTINGS.system_messages!;
      updateForm((current) => ({
        ...current,
        session_settings: {
          ...current.session_settings,
          system_messages: {
            ...(current.session_settings.system_messages || defaults),
            buttons: {
              ...(current.session_settings.system_messages?.buttons || defaults.buttons),
            },
            errors: {
              ...(current.session_settings.system_messages?.errors || defaults.errors),
            },
            completion: {
              ...(current.session_settings.system_messages?.completion || defaults.completion),
            },
            other: {
              ...(current.session_settings.system_messages?.other || defaults.other),
            },
            [group]: {
              ...((current.session_settings.system_messages?.[group] as unknown as Record<string, unknown>) || (defaults[group] as unknown as Record<string, unknown>)),
              [key]: value as unknown,
            },
          },
        },
      }));
    },
    [updateForm],
  );

  const resetSystemMessages = useCallback((group?: keyof PreCheckoutSystemMessages) => {
    const defaults = PRE_CHECKOUT_DEFAULT_SESSION_SETTINGS.system_messages!;
    updateForm((current) => ({
      ...current,
      session_settings: {
        ...current.session_settings,
        system_messages: group
          ? {
              ...(current.session_settings.system_messages || defaults),
              [group]: defaults[group],
            }
          : defaults,
      },
    }));
  }, [updateForm]);

  const loadData = useCallback(async () => {
    if (!user || !formId) return;
    setLoading(true);

    const [
      formResponse,
      stepsResponse,
      funnelsResponse,
      stagesResponse,
      tagsResponse,
      flowsResponse,
    ] = await Promise.all([
      supabase.from("pre_checkout_forms").select("*").eq("id", formId).eq("user_id", user.id).single(),
      supabase.from("pre_checkout_form_steps").select("*").eq("form_id", formId).order("position"),
      supabase.from("funnels").select("id, name").eq("user_id", user.id).order("created_at"),
      supabase.from("funnel_stages").select("id, name, funnel_id").eq("user_id", user.id).order("order"),
      supabase.from("tags").select("id, name, color").eq("user_id", user.id).order("name"),
      supabase.from("flows").select("id, name, is_active").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

    if (formResponse.error || !formResponse.data) {
      toast("Não foi possível carregar este form.", "error");
      router.push("/formularios");
      return;
    }

    const nextForm = ensureFormDefaults(formResponse.data as PreCheckoutForm);
    const nextSteps = normalizeBuilderSteps(((stepsResponse.data || []) as PreCheckoutFormStep[]).map(sanitizeStep));
    lastPersistedSnapshotRef.current = buildSnapshot(nextForm, nextSteps, []);
    skipAutosaveRef.current = true;
    setForm(nextForm);
    setSteps(nextSteps);
    setDeletedStepIds([]);
    setSelectedStepId(nextSteps[0]?.id || null);
    setSelectedTriggerId(nextForm.integrations?.workflows?.[0]?.id || null);
    setSelectedActionId(nextForm.integrations?.workflows?.[0]?.actions?.[0]?.id || null);
    setFunnels((funnelsResponse.data || []) as FunnelOption[]);
    setStages((stagesResponse.data || []) as StageOption[]);
    setTags((tagsResponse.data || []) as TagOption[]);
    setFlows(((flowsResponse.data || []) as FlowOption[]).filter((flow) => flow.is_active));
    setSaveState("idle");
    setLoading(false);
  }, [buildSnapshot, formId, router, toast, user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (searchParams.get("source") === "ai") {
      setCurrentTab(TAB_CONTENT);
    }
  }, [searchParams]);

  useEffect(() => {
    if (saveState !== "saved") return;
    const timer = setTimeout(() => setSaveState("idle"), 1800);
    return () => clearTimeout(timer);
  }, [saveState]);

  useEffect(() => {
    if (!form || !previewStorageKey || typeof window === "undefined") return;
    window.localStorage.setItem(
      previewStorageKey,
      JSON.stringify({
        form,
        steps: orderedSteps,
      }),
    );
  }, [form, orderedSteps, previewStorageKey]);

  const handleThemeAssetUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    field: "logo_url" | "background_image_url",
  ) => {
    if (!user || !form) return;
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingAssetKey(field);
    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    const filePath = `forms/${user.id}/${form.id}/${field}-${Date.now().toString(36)}.${extension}`;

    const { error: uploadError } = await supabase.storage.from("public_bucket").upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || undefined,
    });

    if (uploadError) {
      toast("Não foi possível enviar esse arquivo.", "error");
      setUploadingAssetKey(null);
      return;
    }

    const { data: urlData } = supabase.storage.from("public_bucket").getPublicUrl(filePath);
    updateForm((current) => ({
      ...current,
      theme: {
        ...current.theme,
        branding: {
          ...(current.theme.branding || PRE_CHECKOUT_DEFAULT_THEME.branding!),
          [field]: urlData.publicUrl,
        },
      },
    }));
    setUploadingAssetKey(null);
  };

  const handleStepMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>, stepId: string) => {
    if (!user || !form) return;
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingAssetKey(`step:${stepId}`);
    const extension = file.name.split(".").pop()?.toLowerCase() || (file.type.startsWith("video/") ? "mp4" : "png");
    const filePath = `forms/${user.id}/${form.id}/steps/${stepId}-${Date.now().toString(36)}.${extension}`;

    const { error: uploadError } = await supabase.storage.from("public_bucket").upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || undefined,
    });

    if (uploadError) {
      toast("Não foi possível enviar a mídia da etapa.", "error");
      setUploadingAssetKey(null);
      return;
    }

    const { data: urlData } = supabase.storage.from("public_bucket").getPublicUrl(filePath);
    updateStep(stepId, (current) => ({
      ...current,
      settings: {
        ...current.settings,
        media_kind: file.type.startsWith("video/") ? "video" : "image",
        image_url: file.type.startsWith("image/") ? urlData.publicUrl : null,
        video_url: file.type.startsWith("video/") ? urlData.publicUrl : null,
        media_brightness: current.settings?.media_brightness ?? 100,
      },
    }));
    setUploadingAssetKey(null);
  };

  const handleOptionImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    stepId: string,
    optionId: string
  ) => {
    if (!user || !form) return;
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingAssetKey(`option:${stepId}:${optionId}`);
    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    const filePath = `forms/${user.id}/${form.id}/options/${stepId}-${optionId}-${Date.now().toString(36)}.${extension}`;

    const { error: uploadError } = await supabase.storage.from("public_bucket").upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || undefined,
    });

    if (uploadError) {
      toast("Não foi possível enviar a imagem da opção.", "error");
      setUploadingAssetKey(null);
      return;
    }

    const { data: urlData } = supabase.storage.from("public_bucket").getPublicUrl(filePath);
    updateStep(stepId, (current) => ({
      ...current,
      options: current.options.map((option) =>
        option.id === optionId
          ? { ...option, image_url: urlData.publicUrl }
          : option
      ),
    }));
    setUploadingAssetKey(null);
  };

  const handleSave = async (nextStatus?: PreCheckoutForm["status"]) => {
    await persistFormState({ nextStatus, silent: false });
  };

  const handleAddStep = (type: PreCheckoutFormStepType) => {
    const next = createBuilderStep(type, orderedSteps.length);
    setSteps((current) => [...normalizeBuilderSteps(current), next]);
    setSelectedStepId(next.id);
    setShowAddDialog(false);
  };

  const handleRemoveStep = (stepId: string) => {
    if (!stepId.startsWith("temp-")) {
      setDeletedStepIds((current) => Array.from(new Set([...current, stepId])));
    }
    const nextSteps = normalizeBuilderSteps(orderedSteps.filter((step) => step.id !== stepId));
    setSteps(nextSteps);
    setSelectedStepId(nextSteps[0]?.id || null);
  };

  const persistFormState = useCallback(async ({ nextStatus, silent = false }: { nextStatus?: PreCheckoutForm["status"]; silent?: boolean } = {}) => {
    if (!user || !form || isPersistingRef.current) return false;

    const normalizedSlug = slugifyPreCheckoutFormName(form.slug || form.name);
    if (!normalizedSlug) {
      if (!silent) toast("Defina um identificador valido para o form.", "warning");
      return false;
    }

    if (nextStatus === "published" && !validation.isValid) {
      if (!silent) toast(validation.errors[0] || "Revise as configuracoes obrigatorias antes de publicar.", "warning");
      return false;
    }

    isPersistingRef.current = true;
    setSaveState("saving");
    if (!silent) setSaving(true);
    if (nextStatus === "published") setPublishing(true);

    try {
      const normalizedSteps = normalizeBuilderSteps(steps);
      const formPayload = {
        name: form.name.trim(),
        slug: normalizedSlug,
        description: form.description || "",
        status: nextStatus || form.status,
        theme: form.theme,
        final_config: form.final_config,
        integrations: form.integrations,
        session_settings: form.session_settings,
        published_at: nextStatus === "published" ? (form.published_at || new Date().toISOString()) : form.published_at,
      };

      const { data: slugConflict } = await supabase
        .from("pre_checkout_forms")
        .select("id")
        .eq("slug", normalizedSlug)
        .neq("id", form.id)
        .limit(1);

      if (slugConflict && slugConflict.length > 0) {
        if (!silent) toast("Esse identificador ja esta em uso.", "warning");
        return false;
      }

      const { error: formError } = await supabase.from("pre_checkout_forms").update(formPayload).eq("id", form.id);
      if (formError) {
        if (!silent) toast("Não foi possível salvar o form.", "error");
        return false;
      }

      if (deletedStepIds.length) {
        const { error: deleteError } = await supabase.from("pre_checkout_form_steps").delete().in("id", deletedStepIds);
        if (deleteError && !silent) {
          toast("Não foi possível remover etapas antigas.", "error");
          return false;
        }
      }

      const persistedSteps = normalizedSteps
        .filter((step) => !step.id.startsWith("temp-"))
        .map((step) => ({
          id: step.id,
          form_id: form.id,
          user_id: user.id,
          step_key: step.step_key,
          position: step.position,
          type: step.type,
          title: step.title,
          description: step.description || "",
          placeholder: step.placeholder || "",
          is_required: step.is_required,
          options: step.options.map((option, optionIndex) => ({
            ...option,
            value: normalizeOptionValue(option.label || option.value, optionIndex),
          })),
          settings: sanitizeStepSettings(step.settings),
        }));

      const newSteps = normalizedSteps
        .filter((step) => step.id.startsWith("temp-"))
        .map((step) => ({
          form_id: form.id,
          user_id: user.id,
          step_key: step.step_key,
          position: step.position,
          type: step.type,
          title: step.title,
          description: step.description || "",
          placeholder: step.placeholder || "",
          is_required: step.is_required,
          options: step.options.map((option, optionIndex) => ({
            ...option,
            value: normalizeOptionValue(option.label || option.value, optionIndex),
          })),
          settings: sanitizeStepSettings(step.settings),
        }));

      if (persistedSteps.length) {
        const { error: persistedError } = await supabase.from("pre_checkout_form_steps").upsert(persistedSteps);
        if (persistedError) {
          if (!silent) toast("Não foi possível atualizar as etapas.", "error");
          return false;
        }
      }

      let nextSteps = normalizedSteps;
      if (newSteps.length) {
        const { data: insertedSteps, error: newStepsError } = await supabase
          .from("pre_checkout_form_steps")
          .insert(newSteps)
          .select("*");

        if (newStepsError) {
          if (!silent) toast("Não foi possível salvar novas etapas.", "error");
          return false;
        }

        if (insertedSteps?.length) {
          const insertedMap = new Map(insertedSteps.map((step) => [step.step_key, step as PreCheckoutFormStep]));
          nextSteps = normalizedSteps.map((step) => insertedMap.get(step.step_key) || step);
          if (selectedStepId?.startsWith("temp-")) {
            const replacement = nextSteps.find((step) => step.step_key === normalizedSteps.find((item) => item.id === selectedStepId)?.step_key);
            if (replacement) setSelectedStepId(replacement.id);
          }
        }
      }

      const nextFormState = ensureFormDefaults({
        ...form,
        ...formPayload,
      } as PreCheckoutForm);

      setForm(nextFormState);
      setSteps(normalizeBuilderSteps(nextSteps));
      setDeletedStepIds([]);

      const nextSnapshot = buildSnapshot(nextFormState, nextSteps, []);
      lastPersistedSnapshotRef.current = nextSnapshot;
      if (previewStorageKey && typeof window !== "undefined") {
        window.localStorage.setItem(
          previewStorageKey,
          JSON.stringify({
            form: nextFormState,
            steps: normalizeBuilderSteps(nextSteps),
          }),
        );
      }

      setSaveState("saved");
      if (!silent) {
        toast(nextStatus === "published" ? "Form publicado com sucesso!" : "Form salvo com sucesso!", "success");
      }
      return true;
    } finally {
      isPersistingRef.current = false;
      setSaving(false);
      setPublishing(false);
    }
  }, [buildSnapshot, deletedStepIds, form, previewStorageKey, steps, toast, user, validation]);

  useEffect(() => {
    if (!form) return;
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false;
      return;
    }
    const currentSnapshot = buildSnapshot(form, steps, deletedStepIds);
    if (currentSnapshot === lastPersistedSnapshotRef.current) {
      return;
    }
    setSaveState("dirty");
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      void persistFormState({ silent: true });
    }, 1400);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [buildSnapshot, deletedStepIds, form, persistFormState, steps]);

  const handleGenerateWithAi = async () => {
    if (!form || !aiPrompt.trim()) {
      toast("Descreva o objetivo do form para a IA.", "warning");
      return;
    }
    const aiModel = "gpt-4.1-mini";

    setAiLoading(true);
    const response = await fetch("/api/pre-checkout/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: aiModel,
        businessContext: form.name,
        goal: aiPrompt,
        audience: form.description,
        destination: form.final_config.action,
        preferredStyle: form.theme.style_key,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    setAiLoading(false);
    if (!response.ok || !payload?.result) {
      toast(payload?.error || "A IA não conseguiu montar o form.", "error");
      return;
    }

    const result = payload.result;
    updateForm((current) => ensureFormDefaults({
      ...current,
      name: result.name || current.name,
      description: result.description || current.description,
      theme: {
        ...current.theme,
        primary_color: result.theme?.primary_color || current.theme.primary_color,
        panel_color: result.theme?.panel_color || current.theme.panel_color,
        text_color: result.theme?.text_color || current.theme.text_color,
        background: {
          ...current.theme.background,
          color: result.theme?.background_color || current.theme.background.color,
        },
      },
      final_config: {
        ...current.final_config,
        ...(result.final_config || {}),
      },
      integrations: {
        ...current.integrations,
        workflows: (result.workflow_suggestions || []).map((trigger: any) => ({
          id: `trigger_${crypto.randomUUID()}`,
          name: trigger.name || "Novo gatilho",
          type: trigger.type || "any_full_response",
          enabled: true,
          ending_step_key: trigger.ending_step_key || null,
          conditions: (trigger.conditions || []).map((condition: any) => ({
            id: `condition_${crypto.randomUUID()}`,
            step_key: condition.step_key || null,
            operator: condition.operator || "equals",
            value: condition.value ?? "",
          })),
          actions: (trigger.actions || []).map((action: any) => ({
            id: `action_${crypto.randomUUID()}`,
            type: action.type,
            enabled: true,
            label: action.label || "",
            config: {
              ...createDefaultWorkflowAction(action.type).config,
              ...(action.config || {}),
            },
          })),
        })),
        connect: {
          ...current.integrations.connect,
          ...(result.connect_suggestions || {}),
        },
      },
    }));

    const aiSteps = Array.isArray(result.steps)
      ? result.steps.map((step: any, index: number) => ({
          ...createBuilderStep(step.type || "short_text", index),
          id: `temp-ai-${crypto.randomUUID()}`,
          step_key: step.step_key || `etapa_${index + 1}`,
          position: index,
          type: step.type || "short_text",
          title: step.title || "Nova etapa",
          description: step.description || "",
          placeholder: step.placeholder || "",
          is_required: step.is_required ?? true,
          options: Array.isArray(step.options)
            ? step.options.map((option: any, optionIndex: number) => ({
                id: option.id || `option_${index}_${optionIndex}`,
                label: option.label || `Opção ${optionIndex + 1}`,
                value: option.value || `opcao_${optionIndex + 1}`,
              }))
            : [],
          settings: {
            ...createBuilderStep(step.type || "short_text", index).settings,
            ...(step.settings || {}),
          },
        }))
      : [];

    if (aiSteps.length) {
      setSteps(normalizeBuilderSteps(aiSteps));
      setSelectedStepId(aiSteps[0]?.id || null);
    }
    setAiPrompt("");
    toast("Estrutura gerada com IA e aplicada ao form.", "success");
  };

  const handleAddTrigger = (type: PreCheckoutWorkflowTrigger["type"]) => {
    const nextTrigger = createDefaultWorkflowTrigger(type);
    updateForm((current) => ({
      ...current,
      integrations: {
        ...current.integrations,
        workflows: [...(current.integrations.workflows || []), nextTrigger],
      },
    }));
    setSelectedTriggerId(nextTrigger.id);
    setSelectedActionId(nextTrigger.actions[0]?.id || null);
    setCurrentTab(TAB_WORKFLOW);
  };

  const handleRemoveTrigger = (triggerId: string) => {
    const nextTriggers = workflows.filter((trigger) => trigger.id !== triggerId);
    updateForm((current) => ({
      ...current,
      integrations: {
        ...current.integrations,
        workflows: nextTriggers,
      },
    }));
    setSelectedTriggerId(nextTriggers[0]?.id || null);
    setSelectedActionId(nextTriggers[0]?.actions?.[0]?.id || null);
  };

  const handleAddWorkflowAction = (type: PreCheckoutWorkflowAction["type"]) => {
    if (!selectedTrigger) return;
    const nextAction = createDefaultWorkflowAction(type);
    updateTrigger(selectedTrigger.id, (trigger) => ({
      ...trigger,
      actions: [...trigger.actions, nextAction],
    }));
    setSelectedActionId(nextAction.id);
  };

  const handleRemoveWorkflowAction = (actionId: string) => {
    if (!selectedTrigger) return;
    updateTrigger(selectedTrigger.id, (trigger) => ({
      ...trigger,
      actions: trigger.actions.filter((action) => action.id !== actionId),
    }));
    const nextAction = selectedTrigger.actions.find((action) => action.id !== actionId);
    setSelectedActionId(nextAction?.id || null);
  };

  const handleAddCondition = () => {
    if (!selectedTrigger) return;
    updateTrigger(selectedTrigger.id, (trigger) => ({
      ...trigger,
      conditions: [
        ...trigger.conditions,
        {
          id: `condition_${crypto.randomUUID()}`,
          step_key: orderedSteps[0]?.step_key || null,
          operator: "equals",
          value: "",
        },
      ],
    }));
  };

  const handleRemoveCondition = (conditionId: string) => {
    if (!selectedTrigger) return;
    updateTrigger(selectedTrigger.id, (trigger) => ({
      ...trigger,
      conditions: trigger.conditions.filter((condition) => condition.id !== conditionId),
    }));
  };

  const openPreview = () => {
    if (!form || !previewStorageKey) return;
    window.localStorage.setItem(
      previewStorageKey,
      JSON.stringify({
        form,
        steps: orderedSteps,
      }),
    );
    window.open(previewHref, "_blank", "noopener,noreferrer");
  };

  if (loading || !form) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const systemMessages = {
    ...PRE_CHECKOUT_SYSTEM_MESSAGE_DEFAULTS,
    ...(form.session_settings.system_messages || {}),
    buttons: {
      ...PRE_CHECKOUT_SYSTEM_MESSAGE_DEFAULTS.buttons,
      ...(form.session_settings.system_messages?.buttons || {}),
    },
    errors: {
      ...PRE_CHECKOUT_SYSTEM_MESSAGE_DEFAULTS.errors,
      ...(form.session_settings.system_messages?.errors || {}),
    },
    completion: {
      ...PRE_CHECKOUT_SYSTEM_MESSAGE_DEFAULTS.completion,
      ...(form.session_settings.system_messages?.completion || {}),
    },
    other: {
      ...PRE_CHECKOUT_SYSTEM_MESSAGE_DEFAULTS.other,
      ...(form.session_settings.system_messages?.other || {}),
    },
  };

  const renderWorkflowActionEditor = (action: PreCheckoutWorkflowAction) => {
    if (!selectedTrigger) return null;

    return (
      <div className="space-y-5 border-t border-white/10 px-5 py-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nome da acao</Label>
            <Input
              value={action.label || ""}
              onChange={(event) => updateAction(selectedTrigger.id, action.id, (current) => ({ ...current, label: event.target.value }))}
              placeholder="Ex.: Avisar equipe comercial"
            />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#171821] p-4">
            <div>
              <p className="text-sm font-medium text-white">Acao ativa</p>
              <p className="text-xs text-zinc-400">Se desligar, ela não será executada.</p>
            </div>
            <Switch checked={action.enabled} onCheckedChange={(checked) => updateAction(selectedTrigger.id, action.id, (current) => ({ ...current, enabled: checked }))} />
          </div>
        </div>

        {["send_whatsapp_respondent", "send_whatsapp_internal"].includes(action.type) ? (
          <div className="space-y-4">
            {action.type === "send_whatsapp_internal" ? (
              <div className="space-y-2">
                <Label>Numero que vai receber</Label>
                <Input
                  value={action.config.phone || ""}
                  onChange={(event) => updateAction(selectedTrigger.id, action.id, (current) => ({ ...current, config: { ...current.config, phone: event.target.value } }))}
                  placeholder="5511999999999"
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                value={action.config.message || ""}
                onChange={(event) => updateAction(selectedTrigger.id, action.id, (current) => ({ ...current, config: { ...current.config, message: event.target.value } }))}
                placeholder="Use variaveis como {nome}, {email}, {telefone} ou {{step_key}}"
              />
            </div>
          </div>
        ) : null}

        {action.type === "apply_tags" ? (
          <div className="space-y-2">
            <Label>Tags aplicadas</Label>
            <div className="grid gap-2 md:grid-cols-2">
              {tags.map((tag) => {
                const active = action.config.tag_ids?.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() =>
                      updateAction(selectedTrigger.id, action.id, (current) => ({
                        ...current,
                        config: {
                          ...current.config,
                          tag_ids: active
                            ? (current.config.tag_ids || []).filter((tagId) => tagId !== tag.id)
                            : [...(current.config.tag_ids || []), tag.id],
                        },
                      }))
                    }
                    className={`rounded-2xl border px-4 py-3 text-left ${active ? "border-primary/30 bg-primary/10" : "border-white/10 bg-[#171821] hover:bg-[#1D1F2A]"}`}
                  >
                    <span className="text-sm font-medium text-white">{tag.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {action.type === "move_stage" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Funil</Label>
              <Select
                value={action.config.funnel_id || "__none"}
                onValueChange={(value) =>
                  updateAction(selectedTrigger.id, action.id, (current) => ({
                    ...current,
                    config: { ...current.config, funnel_id: value === "__none" ? null : value, stage_id: null },
                  }))
                }
              >
                <SelectTrigger><SelectValue placeholder="Selecione um funil" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sem funil</SelectItem>
                  {funnels.map((funnel) => (
                    <SelectItem key={funnel.id} value={funnel.id}>{funnel.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Etapa</Label>
              <Select
                value={action.config.stage_id || "__none"}
                onValueChange={(value) => updateAction(selectedTrigger.id, action.id, (current) => ({ ...current, config: { ...current.config, stage_id: value === "__none" ? null : value } }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione uma etapa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sem etapa</SelectItem>
                  {stages.filter((stage) => !action.config.funnel_id || stage.funnel_id === action.config.funnel_id).map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}

        {action.type === "start_flow" ? (
          <div className="space-y-2">
            <Label>Fluxo</Label>
            <Select
              value={action.config.flow_id || "__none"}
              onValueChange={(value) => updateAction(selectedTrigger.id, action.id, (current) => ({ ...current, config: { ...current.config, flow_id: value === "__none" ? null : value } }))}
            >
              <SelectTrigger><SelectValue placeholder="Selecione um fluxo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Sem fluxo</SelectItem>
                {flows.map((flow) => (
                  <SelectItem key={flow.id} value={flow.id}>{flow.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {action.type === "redirect_url" ? (
          <div className="space-y-2">
            <Label>URL de destino</Label>
            <Input
              value={action.config.url || ""}
              onChange={(event) => updateAction(selectedTrigger.id, action.id, (current) => ({ ...current, config: { ...current.config, url: event.target.value } }))}
              placeholder="https://..."
            />
          </div>
        ) : null}

        {action.type === "webhook" ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[1fr_160px]">
              <div className="space-y-2">
                <Label>URL do webhook</Label>
                <Input
                  value={action.config.webhook_url || ""}
                  onChange={(event) => updateAction(selectedTrigger.id, action.id, (current) => ({ ...current, config: { ...current.config, webhook_url: event.target.value } }))}
                  placeholder="https://api.seudominio.com/hook"
                />
              </div>
              <div className="space-y-2">
                <Label>Metodo</Label>
                <Select
                  value={action.config.webhook_method || "POST"}
                  onValueChange={(value: "POST" | "PUT") => updateAction(selectedTrigger.id, action.id, (current) => ({ ...current, config: { ...current.config, webhook_method: value } }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  };
  return (
    <>
      <div className="flex min-h-screen flex-col bg-[#09090D] text-zinc-100">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#111114]/95 backdrop-blur">
          <div className="mx-auto flex min-h-[72px] max-w-[1700px] items-center justify-between gap-4 px-6">
            <div className="flex items-center gap-3">
              <Link href="/formularios" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Link>
            </div>

            <div className="flex flex-1 items-center justify-center gap-3">
              <Tabs value={currentTab} onValueChange={setCurrentTab} className="flex-1 max-w-2xl">
                <TabsList className="grid w-full grid-cols-4 rounded-2xl border border-white/10 bg-[#13141B] p-1">
                  <TabsTrigger className="rounded-xl text-zinc-400 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-none" value={TAB_CONTENT}>Conteudo</TabsTrigger>
                  <TabsTrigger className="rounded-xl text-zinc-400 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-none" value={TAB_WORKFLOW}>Workflow</TabsTrigger>
                  <TabsTrigger className="rounded-xl text-zinc-400 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-none" value={TAB_CONNECT}>Conexoes</TabsTrigger>
                  <TabsTrigger className="rounded-xl text-zinc-400 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-none" value={TAB_SETTINGS}>Configuracoes</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#171821] p-1">
                <Button
                  variant={previewDevice === "desktop" ? "default" : "ghost"}
                  size="icon"
                  className="rounded-xl"
                  onClick={() => setPreviewDevice("desktop")}
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  variant={previewDevice === "mobile" ? "default" : "ghost"}
                  size="icon"
                  className="rounded-xl"
                  onClick={() => setPreviewDevice("mobile")}
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="icon" className="rounded-2xl border-white/10 bg-[#171821] text-zinc-100 hover:bg-[#1D1F2A]" onClick={() => setShowVisualPanel((current) => !current)}>
                <Palette className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden w-[160px] shrink-0 justify-end text-right text-xs text-zinc-400 md:flex">
                <span className={saveState === "idle" ? "opacity-0" : "opacity-100"}>
                  {saveState === "saving" ? "Salvando..." : saveState === "saved" ? "Salvo" : saveState === "dirty" ? "Alteracoes pendentes" : "."}
                </span>
              </span>
              <Button variant="outline" onClick={openPreview}>
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
              <Button variant="outline" onClick={() => handleSave(form.status === "published" ? "paused" : "published")} disabled={publishing}>
                <Rocket className="mr-2 h-4 w-4" />
                {form.status === "published" ? "Pausar" : "Publicar"}
              </Button>
              <Button onClick={() => handleSave()} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar
              </Button>
            </div>
          </div>
        </header>


        <main className="flex-1">
          <Tabs value={currentTab} onValueChange={setCurrentTab} className="h-full">
            <TabsContent value={TAB_CONTENT} className="m-0 h-full">
              <div className="grid min-h-[calc(100vh-72px)] grid-cols-[280px_minmax(0,1fr)_340px] gap-0">
                <aside className="border-r border-white/10 bg-[#111114]">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                    <div>
                      <p className="text-sm font-semibold text-white">Etapas</p>
                      <p className="text-xs text-zinc-400">Arraste para reorganizar</p>
                    </div>
                    <Button size="icon" variant="outline" onClick={() => setShowAddDialog(true)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleStepDragEnd}>
                    <SortableContext items={orderedSteps.map((step) => step.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2 px-3 py-4">
                        {orderedSteps.map((step, index) => (
                          <SortableStepCard
                            key={step.id}
                            step={step}
                            index={index}
                            selected={selectedStep?.id === step.id}
                            onClick={() => setSelectedStepId(step.id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </aside>

                <section className="min-w-0 border-r border-white/10 bg-[#0D0E14]">
                  <div className="border-b border-white/10 bg-[#13141B] px-8 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">Editor visual</p>
                        <p className="text-xs text-zinc-400">
                          {previewDevice === "mobile" ? "Visualizando em mobile" : "Visualizando em desktop"}
                        </p>
                      </div>
                      <Badge variant="outline">{orderedSteps.length} etapas</Badge>
                    </div>
                  </div>

                  <div className="min-h-[calc(100vh-220px)] bg-[#0D0E14] px-8 py-8">
                    {selectedStep ? (
                      <StepCanvasPreview
                        form={form}
                        step={selectedStep}
                        stepIndex={orderedSteps.findIndex((step) => step.id === selectedStep.id)}
                        totalSteps={orderedSteps.length || 1}
                        previewDevice={previewDevice}
                        onUpdate={(updater) => updateStep(selectedStep.id, updater)}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Button onClick={() => setShowAddDialog(true)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Adicionar primeira etapa
                        </Button>
                      </div>
                    )}
                  </div>
                </section>

                <aside className="bg-[#111114] px-5 py-6">
                  {selectedStep ? (
                    <div className="space-y-6">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-white">Configuracoes da etapa</p>
                        <p className="text-xs text-zinc-400">Mantenha so o necessario e ajuste o resto no canvas.</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Tipo de resposta</Label>
                        <Select
                          value={selectedStep.type}
                          onValueChange={(value: PreCheckoutFormStepType) =>
                            updateStep(selectedStep.id, (current) => ({
                              ...createBuilderStep(value, current.position),
                              ...current,
                              type: value,
                              options: ["single_choice", "picture_choice", "multiple_choice", "dropdown", "yes_no"].includes(value)
                                ? current.options.length ? current.options : createBuilderStep(value, current.position).options
                                : [],
                            }))
                          }
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PRE_CHECKOUT_STEP_PALETTE.map((item) => (
                              <SelectItem key={item.type} value={item.type}>{item.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#171821] p-3">
                        <div>
                          <p className="text-sm font-medium text-white">Obrigatoria</p>
                          <p className="text-xs text-zinc-400">So avanca com resposta valida.</p>
                        </div>
                        <Switch checked={selectedStep.is_required} onCheckedChange={(checked) => updateStep(selectedStep.id, (current) => ({ ...current, is_required: checked }))} />
                      </div>

                      <div className="space-y-3 rounded-3xl border border-white/10 bg-[#171821] p-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-white">Midia da etapa</p>
                          <p className="text-xs text-zinc-400">Envie imagem ou video para complementar essa etapa.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Label htmlFor={`step-media-${selectedStep.id}`} className="cursor-pointer">
                            <div className="inline-flex h-10 items-center justify-center rounded-xl border border-input px-3 text-sm">
                              {uploadingAssetKey === `step:${selectedStep.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                              Enviar midia
                            </div>
                          </Label>
                          <input id={`step-media-${selectedStep.id}`} type="file" accept="image/*,video/*" className="hidden" onChange={(event) => void handleStepMediaUpload(event, selectedStep.id)} />
                          {(selectedStep.settings?.image_url || selectedStep.settings?.video_url) ? (
                            <Button
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => updateStep(selectedStep.id, (current) => ({ ...current, settings: { ...current.settings, image_url: null, video_url: null, media_kind: null } }))}
                            >
                              Remover midia
                            </Button>
                          ) : null}
                        </div>
                        <div className="space-y-2">
                          <Label>Brightness da midia</Label>
                          <Input
                            type="range"
                            min={40}
                            max={140}
                            step={5}
                            value={String(selectedStep.settings?.media_brightness ?? 100)}
                            onChange={(event) => updateStep(selectedStep.id, (current) => ({ ...current, settings: { ...current.settings, media_brightness: Number(event.target.value) } }))}
                          />
                        </div>
                        {(selectedStep.settings?.image_url || selectedStep.settings?.video_url) ? (
                          <div className="space-y-4">
                            <Label>Layout</Label>

                            <div className="rounded-2xl border border-white/10 bg-[#111114] p-3">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <span className="text-sm font-medium text-zinc-200">Mobile</span>
                                <span className="text-xs text-zinc-500">Como aparece no celular</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {STEP_MEDIA_LAYOUT_MOBILE_OPTIONS.map((option) => (
                                  <MediaLayoutButton
                                    key={option.value}
                                    type={option.value}
                                    label={option.label}
                                    active={getStepMediaLayout(selectedStep.settings, "mobile") === option.value}
                                    onClick={() =>
                                      updateStep(selectedStep.id, (current) => ({
                                        ...current,
                                        settings: { ...current.settings, media_layout_mobile: option.value },
                                      }))
                                    }
                                  />
                                ))}
                              </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-[#111114] p-3">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <span className="text-sm font-medium text-zinc-200">Desktop</span>
                                <span className="text-xs text-zinc-500">Como aparece no computador</span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 max-w-[220px]">
                                {STEP_MEDIA_LAYOUT_DESKTOP_OPTIONS.map((option) => (
                                  <MediaLayoutButton
                                    key={option.value}
                                    type={option.value}
                                    label={option.label}
                                    active={getStepMediaLayout(selectedStep.settings, "desktop") === option.value}
                                    onClick={() =>
                                      updateStep(selectedStep.id, (current) => ({
                                        ...current,
                                        settings: { ...current.settings, media_layout_desktop: option.value },
                                      }))
                                    }
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {["single_choice", "picture_choice", "multiple_choice", "dropdown", "yes_no"].includes(selectedStep.type) ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label>Opcoes</Label>
                            <Button
                              size="sm"
                              variant="outline"
                          onClick={() => updateStep(selectedStep.id, (current) => ({
                                ...current,
                                options: [...current.options, { id: crypto.randomUUID(), label: `Opcao ${current.options.length + 1}`, value: `opcao_${current.options.length + 1}` }],
                              }))}
                            >
                              <Plus className="mr-2 h-3.5 w-3.5" />
                              Opcao
                            </Button>
                          </div>
                          {selectedStep.options.map((option) => (
                            <div key={option.id} className="space-y-3 rounded-2xl border border-white/10 bg-[#171821] p-3">
                              {selectedStep.type === "picture_choice" ? (
                                <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111114]">
                                  {option.image_url ? (
                                    <img src={option.image_url} alt={option.label} className="aspect-[4/3] w-full object-cover" />
                                  ) : (
                                    <div className="flex aspect-[4/3] items-center justify-center text-sm text-zinc-400">Nenhuma imagem enviada</div>
                                  )}
                                </div>
                              ) : null}
                              <AutosizeTextField
                                value={option.label}
                                onChange={(value) =>
                                  updateStep(selectedStep.id, (current) => ({
                                    ...current,
                                    options: current.options.map((item, optionIndex) =>
                                      item.id === option.id
                                        ? {
                                            ...item,
                                            label: value,
                                            value: normalizeOptionValue(value, optionIndex),
                                          }
                                        : item
                                    ),
                                  }))
                                }
                              />
                              <div className="flex flex-wrap gap-2">
                                {selectedStep.type === "picture_choice" ? (
                                  <>
                                    <Label htmlFor={`option-image-${selectedStep.id}-${option.id}`} className="cursor-pointer">
                                      <div className="inline-flex h-10 items-center justify-center rounded-xl border border-input px-3 text-sm">
                                        {uploadingAssetKey === `option:${selectedStep.id}:${option.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                                        Enviar imagem
                                      </div>
                                    </Label>
                                    <input
                                      id={`option-image-${selectedStep.id}-${option.id}`}
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(event) => void handleOptionImageUpload(event, selectedStep.id, option.id)}
                                    />
                                    {option.image_url ? (
                                      <Button
                                        variant="ghost"
                                        className="text-destructive"
                                        onClick={() =>
                                          updateStep(selectedStep.id, (current) => ({
                                            ...current,
                                            options: current.options.map((item) =>
                                              item.id === option.id ? { ...item, image_url: null } : item
                                            ),
                                          }))
                                        }
                                      >
                                        Remover imagem
                                      </Button>
                                    ) : null}
                                  </>
                                ) : null}
                                <Button variant="ghost" size="icon" onClick={() => updateStep(selectedStep.id, (current) => ({ ...current, options: current.options.filter((item) => item.id !== option.id) }))}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <Button variant="outline" className="w-full text-destructive" onClick={() => handleRemoveStep(selectedStep.id)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir etapa
                      </Button>
                    </div>
                  ) : null}
                </aside>
              </div>

              <div className="sticky bottom-0 border-t border-white/10 bg-[#111114]/95 p-4 backdrop-blur">
                <div className="mx-auto flex max-w-[960px] items-end gap-3 rounded-[24px] border border-white/10 bg-[#171821] px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <Textarea
                      value={aiPrompt}
                      onChange={(event) => setAiPrompt(event.target.value)}
                      placeholder="Descreva o form que a IA deve criar: objetivo, oferta, publico e destino final."
                      className="min-h-[64px] resize-none border-0 p-0 shadow-none focus-visible:ring-0"
                    />
                    <p className="text-xs text-zinc-400">A IA e interna do app e monta a estrutura para voce.</p>
                  </div>
                  <Button onClick={handleGenerateWithAi} disabled={aiLoading}>
                    {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Criar com IA
                  </Button>
                </div>
              </div>
            </TabsContent>
            <TabsContent value={TAB_WORKFLOW} className="m-0">
              <div className="grid min-h-[calc(100vh-64px)] grid-cols-[280px_minmax(0,1fr)_340px] gap-0">
                <aside className="border-r border-white/10 bg-[#111114]">
                  <div className="flex items-center justify-between px-4 py-4">
                    <div>
                      <p className="text-sm font-semibold">Triggers</p>
                      <p className="text-xs text-zinc-400">Dispare acoes com base nas respostas do form.</p>
                    </div>
                    <Select onValueChange={(value: PreCheckoutWorkflowTrigger["type"]) => handleAddTrigger(value)}>
                      <SelectTrigger className="w-[56px] px-3">
                        <Plus className="h-4 w-4" />
                      </SelectTrigger>
                      <SelectContent>
                        {WORKFLOW_TRIGGER_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 px-3 pb-4">
                    {workflows.length === 0 ? (
                      <Card className="border-dashed border-white/10 bg-[#171821] p-4 text-sm text-zinc-400">
                        Comece criando um trigger para definir quando o FlowUp deve agir.
                      </Card>
                    ) : (
                      workflows.map((trigger) => {
                        const triggerMeta = WORKFLOW_TRIGGER_OPTIONS.find((option) => option.value === trigger.type);
                        const selected = trigger.id === selectedTrigger?.id;
                        return (
                          <button
                            key={trigger.id}
                            type="button"
                            onClick={() => {
                              setSelectedTriggerId(trigger.id);
                              setSelectedActionId(trigger.actions[0]?.id || null);
                            }}
                            className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${selected ? "border-primary/30 bg-primary/12" : "border-white/10 bg-[#171821] hover:bg-[#1D1F2A]"}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-white">{trigger.name}</p>
                                <p className="text-xs text-zinc-400">{triggerMeta?.label || trigger.type}</p>
                              </div>
                              <Badge variant={trigger.enabled ? "default" : "outline"}>
                                {trigger.enabled ? "Ativo" : "Pausado"}
                              </Badge>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </aside>

                <section className="min-w-0 border-r border-white/10 bg-[#0D0E14] px-8 py-8">
                  {!selectedTrigger ? (
                    <div className="flex h-full items-center justify-center">
                      <Card className="max-w-xl border-white/10 bg-[#111114] p-8 text-center shadow-sm shadow-black/20">
                        <h3 className="text-xl font-semibold text-white">Escolha como este form vai reagir</h3>
                        <p className="mt-2 text-sm text-zinc-400">
                          Crie triggers para enviar WhatsApp, marcar tags, mover etapa do funil ou iniciar fluxos assim que alguem responder.
                        </p>
                      </Card>
                    </div>
                  ) : (
                    <div className="mx-auto flex max-w-4xl flex-col items-center gap-6">
                      <Card className="w-full max-w-3xl space-y-5 rounded-[28px] border-white/10 bg-[#111114] p-6 shadow-sm shadow-black/20">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Trigger</p>
                            <h3 className="mt-2 text-lg font-semibold text-white">O que vai acionar esta automacao?</h3>
                          </div>
                          <Button variant="ghost" className="text-destructive" onClick={() => handleRemoveTrigger(selectedTrigger.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir trigger
                          </Button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Nome do trigger</Label>
                            <Input value={selectedTrigger.name} onChange={(event) => updateTrigger(selectedTrigger.id, (current) => ({ ...current, name: event.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label>Quando isso acontece</Label>
                            <Select value={selectedTrigger.type} onValueChange={(value: PreCheckoutWorkflowTrigger["type"]) => updateTrigger(selectedTrigger.id, (current) => ({ ...current, type: value }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {WORKFLOW_TRIGGER_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#171821] p-4">
                          <div>
                            <p className="text-sm font-medium text-white">Trigger ativo</p>
                            <p className="text-xs text-zinc-400">Se desativar, nenhuma acao deste bloco sera executada.</p>
                          </div>
                          <Switch checked={selectedTrigger.enabled} onCheckedChange={(checked) => updateTrigger(selectedTrigger.id, (current) => ({ ...current, enabled: checked }))} />
                        </div>

                        {selectedTrigger.type === "ending_reached" ? (
                          <div className="space-y-2">
                            <Label>Final que dispara a acao</Label>
                            <Select value={selectedTrigger.ending_step_key || "__none"} onValueChange={(value) => updateTrigger(selectedTrigger.id, (current) => ({ ...current, ending_step_key: value === "__none" ? null : value }))}>
                              <SelectTrigger><SelectValue placeholder="Selecione um final" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none">Escolha uma etapa final</SelectItem>
                                {orderedSteps.filter((step) => step.type === "end_screen").map((step) => (
                                  <SelectItem key={step.id} value={step.step_key}>{step.title}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : null}

                        {selectedTrigger.type === "full_response_with_conditions" ? (
                          <div className="space-y-4 rounded-2xl border border-white/10 bg-[#171821] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-white">Condicoes</p>
                                <p className="text-xs text-zinc-400">Use respostas do form para restringir o disparo.</p>
                              </div>
                              <Button variant="outline" size="sm" onClick={handleAddCondition}>
                                <Plus className="mr-2 h-4 w-4" />
                                Condicao
                              </Button>
                            </div>

                            {selectedTrigger.conditions.length === 0 ? (
                              <p className="text-sm text-zinc-400">Nenhuma condicao adicionada ainda.</p>
                            ) : (
                              <div className="space-y-3">
                                {selectedTrigger.conditions.map((condition) => (
                                  <div key={condition.id} className="grid gap-3 rounded-2xl border border-white/10 bg-[#111114] p-3 md:grid-cols-[1.1fr_1fr_1fr_auto]">
                                    <Select value={condition.step_key || "__none"} onValueChange={(value) => updateTrigger(selectedTrigger.id, (current) => ({ ...current, conditions: current.conditions.map((item) => item.id === condition.id ? { ...item, step_key: value === "__none" ? null : value } : item) }))}>
                                      <SelectTrigger><SelectValue placeholder="Pergunta" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none">Selecione uma etapa</SelectItem>
                                        {orderedSteps.filter((step) => !["welcome_screen", "statement", "end_screen"].includes(step.type)).map((step) => (
                                          <SelectItem key={step.id} value={step.step_key}>{step.title}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Select value={condition.operator} onValueChange={(value: PreCheckoutWorkflowCondition["operator"]) => updateTrigger(selectedTrigger.id, (current) => ({ ...current, conditions: current.conditions.map((item) => item.id === condition.id ? { ...item, operator: value } : item) }))}>
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="equals">igual a</SelectItem>
                                        <SelectItem value="not_equals">diferente de</SelectItem>
                                        <SelectItem value="contains">contem</SelectItem>
                                        <SelectItem value="not_contains">não contém</SelectItem>
                                        <SelectItem value="is_answered">foi respondida</SelectItem>
                                        <SelectItem value="is_not_answered">não foi respondida</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      value={typeof condition.value === "string" ? condition.value : Array.isArray(condition.value) ? condition.value.join(", ") : ""}
                                      onChange={(event) => updateTrigger(selectedTrigger.id, (current) => ({ ...current, conditions: current.conditions.map((item) => item.id === condition.id ? { ...item, value: event.target.value } : item) }))}
                                      placeholder="Valor esperado"
                                      disabled={["is_answered", "is_not_answered"].includes(condition.operator)}
                                    />
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveCondition(condition.id)}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </Card>

                      <div className="w-full max-w-4xl pb-28">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Acoes</p>
                            <h3 className="mt-1 text-lg font-semibold text-white">O que o FlowUp faz quando esse trigger acontecer?</h3>
                          </div>
                        </div>

                        {selectedTrigger.actions.length === 0 ? (
                          <Card className="rounded-[28px] border-dashed border-white/10 bg-[#111114] p-8 text-center text-sm text-zinc-400">
                            Escolha uma acao na lateral direita para continuar.
                          </Card>
                        ) : (
                          <div className="relative space-y-4 pl-10 before:absolute before:left-[15px] before:top-4 before:bottom-4 before:w-px before:bg-white/10">
                            {selectedTrigger.actions.map((action) => {
                              const actionMeta = WORKFLOW_ACTION_OPTIONS.find((option) => option.value === action.type);
                              const selected = action.id === selectedAction?.id;
                              const actionIndex = selectedTrigger.actions.findIndex((item) => item.id === action.id) + 1;
                              return (
                                <div key={action.id} className="relative">
                                  <span className="absolute -left-10 top-6 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#171821] text-xs font-semibold text-primary shadow-sm shadow-black/20">
                                    {actionIndex}
                                  </span>
                                  <div className={`overflow-hidden rounded-3xl border transition-colors ${selected ? "border-primary/30 bg-primary/10" : "border-white/10 bg-[#171821]"}`}>
                                    <div className="flex items-start justify-between gap-4 px-5 py-4">
                                      <button
                                        type="button"
                                        onClick={() => setSelectedActionId(selected ? null : action.id)}
                                        className="min-w-0 flex-1 text-left transition-colors hover:text-white"
                                      >
                                        <div>
                                          <p className="text-sm font-medium text-white">{action.label || actionMeta?.label || action.type}</p>
                                          <p className="mt-1 text-xs text-zinc-400">{actionMeta?.description}</p>
                                        </div>
                                      </button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="shrink-0 text-zinc-400 hover:text-destructive"
                                        onClick={() => handleRemoveWorkflowAction(action.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                    {selected ? renderWorkflowActionEditor(action) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </section>

                <aside className="bg-[#111114] px-5 py-6">
                  {selectedTrigger ? (
                    <div className="space-y-6">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-white">Acoes do workflow</p>
                        <p className="text-xs text-zinc-400">Adicione novas acoes e edite a acao selecionada.</p>
                      </div>

                      <div className="grid gap-3">
                        {WORKFLOW_ACTION_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            disabled={!selectedTrigger}
                            onClick={() => handleAddWorkflowAction(option.value)}
                            className="rounded-3xl border border-white/10 bg-[#171821] px-4 py-4 text-left transition hover:border-primary/30 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#232536] text-primary">
                                <CirclePlus className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-white">{option.label}</p>
                                <p className="mt-1 text-xs text-zinc-400">{option.description}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </aside>

              </div>
            </TabsContent>
            <TabsContent value={TAB_CONNECT} className="m-0">
              <div className="mx-auto max-w-5xl space-y-6 px-8 py-8">
                <div>
                  <h2 className="text-xl font-semibold text-white">Conexões e tracking</h2>
                  <p className="text-sm text-zinc-400">Ative Meta Pixel, Google Analytics 4 e Google Tag Manager.</p>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                  <Card className="space-y-4 border-white/10 bg-[#111114] p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Meta Pixel</p>
                        <p className="text-sm text-zinc-400">View, start e conclusão.</p>
                      </div>
                      <Switch checked={Boolean(form.integrations.connect?.meta_pixel_enabled)} onCheckedChange={(checked) => updateForm((current) => ({ ...current, integrations: { ...current.integrations, connect: { ...current.integrations.connect, meta_pixel_enabled: checked } } }))} />
                    </div>
                    <Input value={form.integrations.connect?.meta_pixel_id || ""} onChange={(event) => updateForm((current) => ({ ...current, integrations: { ...current.integrations, connect: { ...current.integrations.connect, meta_pixel_id: event.target.value } } }))} placeholder="ID do pixel" />
                  </Card>

                  <Card className="space-y-4 border-white/10 bg-[#111114] p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Google Analytics 4</p>
                        <p className="text-sm text-zinc-400">Measurement ID do GA4.</p>
                      </div>
                      <Switch checked={Boolean(form.integrations.connect?.ga4_enabled)} onCheckedChange={(checked) => updateForm((current) => ({ ...current, integrations: { ...current.integrations, connect: { ...current.integrations.connect, ga4_enabled: checked } } }))} />
                    </div>
                    <Input value={form.integrations.connect?.ga4_measurement_id || ""} onChange={(event) => updateForm((current) => ({ ...current, integrations: { ...current.integrations, connect: { ...current.integrations.connect, ga4_measurement_id: event.target.value } } }))} placeholder="G-XXXXXXXXXX" />
                  </Card>

                  <Card className="space-y-4 border-white/10 bg-[#111114] p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Google Tag Manager</p>
                        <p className="text-sm text-zinc-400">Container do GTM.</p>
                      </div>
                      <Switch checked={Boolean(form.integrations.connect?.gtm_enabled)} onCheckedChange={(checked) => updateForm((current) => ({ ...current, integrations: { ...current.integrations, connect: { ...current.integrations.connect, gtm_enabled: checked } } }))} />
                    </div>
                    <Input value={form.integrations.connect?.gtm_container_id || ""} onChange={(event) => updateForm((current) => ({ ...current, integrations: { ...current.integrations, connect: { ...current.integrations.connect, gtm_container_id: event.target.value } } }))} placeholder="GTM-XXXXXXX" />
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value={TAB_SETTINGS} className="m-0">
              <div className="mx-auto max-w-6xl space-y-8 px-8 py-8">
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="space-y-4 border-white/10 bg-[#111114] p-5">
                    <div className="flex items-center gap-2">
                      <Settings2 className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">Dados do form</h3>
                    </div>
                    <div className="space-y-2">
                      <Label>Nome</Label>
                      <AutosizeTextField value={form.name} onChange={(value) => updateForm((current) => ({ ...current, name: value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>URL</Label>
                      <Input value={form.slug} onChange={(event) => updateForm((current) => ({ ...current, slug: slugifyPreCheckoutFormName(event.target.value) }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição geral</Label>
                      <AutosizeTextField value={form.description || ""} onChange={(value) => updateForm((current) => ({ ...current, description: value }))} />
                    </div>
                  </Card>
                  <Card className="space-y-4 border-white/10 bg-[#111114] p-5">
                    <div className="flex items-center justify-between"><h3 className="font-semibold">Mensagens do sistema</h3>
                      <Button variant="outline" size="sm" onClick={() => resetSystemMessages()}>Resetar tudo</Button>
                    </div>
                    <div className="space-y-5">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">Botões, dicas e atalhos</p>
                          <Button variant="ghost" size="sm" onClick={() => resetSystemMessages("buttons")}>Padrão</Button>
                        </div>
                        <AutosizeTextField value={systemMessages.buttons.confirm_answer} onChange={(value) => updateSystemMessage("buttons", "confirm_answer", value)} placeholder="Botão para confirmar resposta" />
                        <AutosizeTextField value={systemMessages.buttons.next_hint} onChange={(value) => updateSystemMessage("buttons", "next_hint", value)} placeholder="Hint da próxima pergunta" />
                        <AutosizeTextField value={systemMessages.buttons.dropdown_hint} onChange={(value) => updateSystemMessage("buttons", "dropdown_hint", value)} placeholder="Texto do dropdown" />
                        <AutosizeTextField value={systemMessages.buttons.submit_label} onChange={(value) => updateSystemMessage("buttons", "submit_label", value)} placeholder="Texto do botão final" />
                        {SYSTEM_MESSAGE_SECTIONS.buttons.fields
                          .filter((field) => !["confirm_answer", "next_hint", "dropdown_hint", "submit_label"].includes(String(field.key)))
                          .map((field) => (
                            <div key={String(field.key)} className="space-y-2">
                              <Label>{field.label}</Label>
                              <AutosizeTextField
                                value={String((systemMessages.buttons as Record<string, string>)[String(field.key)] || "")}
                                maxLength={"maxLength" in field ? Number(field.maxLength) : undefined}
                                onChange={(value) => updateSystemMessage("buttons", field.key as never, value as never)}
                              />
                            </div>
                          ))}
                      </div>
                      {(["errors", "completion", "other"] as const).map((groupKey) => (
                        <div key={groupKey} className="space-y-3 rounded-2xl border border-white/10 bg-[#171821] p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{SYSTEM_MESSAGE_SECTIONS[groupKey].title}</p>
                            <Button variant="ghost" size="sm" onClick={() => resetSystemMessages(groupKey)}>Padrão</Button>
                          </div>
                          {SYSTEM_MESSAGE_SECTIONS[groupKey].fields.map((field) => (
                            <div key={String(field.key)} className="space-y-2">
                              <Label>{field.label}</Label>
                              <AutosizeTextField
                                value={String((systemMessages[groupKey] as Record<string, string>)[String(field.key)] || "")}
                                maxLength={"maxLength" in field ? Number(field.maxLength) : undefined}
                                onChange={(value) => updateSystemMessage(groupKey, field.key as never, value as never)}
                              />
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {showVisualPanel ? (
        <div className="fixed inset-y-20 right-4 z-50 w-[400px] overflow-y-auto rounded-[28px] border border-white/10 bg-[#111114] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Visual do form</p>
              <p className="text-xs text-zinc-400">Altere o visual enquanto acompanha o editor.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowVisualPanel(false)}>
              Fechar
            </Button>
          </div>
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Cor principal</Label><Input type="color" value={form.theme.primary_color} onChange={(event) => updateForm((current) => ({ ...current, theme: { ...current.theme, primary_color: event.target.value } }))} /></div>
              <div className="space-y-2"><Label>Cor do fundo</Label><Input type="color" value={form.theme.background.color} onChange={(event) => updateForm((current) => ({ ...current, theme: { ...current.theme, background: { ...current.theme.background, color: event.target.value } } }))} /></div>
              <div className="space-y-2"><Label>Cor do painel</Label><Input type="color" value={form.theme.panel_color} onChange={(event) => updateForm((current) => ({ ...current, theme: { ...current.theme, panel_color: event.target.value } }))} /></div>
              <div className="space-y-2"><Label>Cor do texto</Label><Input type="color" value={form.theme.text_color} onChange={(event) => updateForm((current) => ({ ...current, theme: { ...current.theme, text_color: event.target.value } }))} /></div>
              <div className="space-y-2"><Label>Botao</Label><Input type="color" value={form.theme.button_text_color || "#FFFFFF"} onChange={(event) => updateForm((current) => ({ ...current, theme: { ...current.theme, button_text_color: event.target.value } }))} /></div>
              <div className="space-y-2"><Label>Texto do input</Label><Input type="color" value={form.theme.input_text_color || "#111827"} onChange={(event) => updateForm((current) => ({ ...current, theme: { ...current.theme, input_text_color: event.target.value } }))} /></div>
            </div>

            <FontSearchField label="Fonte do titulo" value={form.theme.typography.heading_font} onChange={(value) => updateForm((current) => ({ ...current, theme: { ...current.theme, typography: { ...current.theme.typography, heading_font: value } } }))} />
            <FontSearchField label="Fonte do form" value={form.theme.typography.form_font} onChange={(value) => updateForm((current) => ({ ...current, theme: { ...current.theme, typography: { ...current.theme.typography, form_font: value } } }))} />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Espacamento</Label>
                <Select value={form.theme.layout.spacing} onValueChange={(value: PreCheckoutForm["theme"]["layout"]["spacing"]) => updateForm((current) => ({ ...current, theme: { ...current.theme, layout: { ...current.theme.layout, spacing: value } } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LAYOUT_SPACING_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Arredondamento dos inputs</Label>
                <Select value={form.theme.typography.input_radius} onValueChange={(value: PreCheckoutForm["theme"]["typography"]["input_radius"]) => updateForm((current) => ({ ...current, theme: { ...current.theme, typography: { ...current.theme.typography, input_radius: value } } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RADIUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Arredondamento dos botoes</Label>
                <Select value={form.theme.typography.button_radius} onValueChange={(value: PreCheckoutForm["theme"]["typography"]["button_radius"]) => updateForm((current) => ({ ...current, theme: { ...current.theme, typography: { ...current.theme.typography, button_radius: value } } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RADIUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 rounded-3xl border border-white/10 bg-[#171821] p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Logo</p>
                <p className="text-xs text-zinc-400">Use a logo no topo do form e escolha o tamanho dela.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="form-logo-upload" className="cursor-pointer">
                  <div className="inline-flex h-10 items-center justify-center rounded-xl border border-input px-3 text-sm">
                    {uploadingAssetKey === "logo_url" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                    Enviar logo
                  </div>
                </Label>
                <input id="form-logo-upload" type="file" accept="image/*" className="hidden" onChange={(event) => void handleThemeAssetUpload(event, "logo_url")} />
                {form.theme.branding?.logo_url ? (
                  <Button variant="ghost" className="text-destructive" onClick={() => updateForm((current) => ({ ...current, theme: { ...current.theme, branding: { ...(current.theme.branding || PRE_CHECKOUT_DEFAULT_THEME.branding!), logo_url: null } } }))}>
                    Remover logo
                  </Button>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Tamanho da logo</Label>
                <Select
                  value={form.theme.branding?.logo_size || "md"}
                  onValueChange={(value) =>
                    updateForm((current) => ({
                      ...current,
                      theme: {
                        ...current.theme,
                        branding: {
                          ...(current.theme.branding || PRE_CHECKOUT_DEFAULT_THEME.branding!),
                          logo_size: value as "sm" | "md" | "lg" | "xl",
                        },
                      },
                    }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LOGO_SIZE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 rounded-3xl border border-white/10 bg-[#171821] p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Imagem de fundo</p>
                <p className="text-xs text-zinc-400">Use uma imagem para preencher o fundo completo da pagina.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="form-background-upload" className="cursor-pointer">
                  <div className="inline-flex h-10 items-center justify-center rounded-xl border border-input px-3 text-sm">
                    {uploadingAssetKey === "background_image_url" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                    Enviar fundo
                  </div>
                </Label>
                <input id="form-background-upload" type="file" accept="image/*" className="hidden" onChange={(event) => void handleThemeAssetUpload(event, "background_image_url")} />
                {form.theme.branding?.background_image_url ? (
                  <Button variant="ghost" className="text-destructive" onClick={() => updateForm((current) => ({ ...current, theme: { ...current.theme, branding: { ...(current.theme.branding || PRE_CHECKOUT_DEFAULT_THEME.branding!), background_image_url: null } } }))}>
                    Remover fundo
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Foco horizontal (%)</Label><Input type="number" min={0} max={100} value={String(form.theme.branding?.background_image_focus_x || 50)} onChange={(event) => updateForm((current) => ({ ...current, theme: { ...current.theme, branding: { ...(current.theme.branding || PRE_CHECKOUT_DEFAULT_THEME.branding!), background_image_focus_x: Number(event.target.value) || 50 } } }))} /></div>
                <div className="space-y-2"><Label>Foco vertical (%)</Label><Input type="number" min={0} max={100} value={String(form.theme.branding?.background_image_focus_y || 50)} onChange={(event) => updateForm((current) => ({ ...current, theme: { ...current.theme, branding: { ...(current.theme.branding || PRE_CHECKOUT_DEFAULT_THEME.branding!), background_image_focus_y: Number(event.target.value) || 50 } } }))} /></div>
              </div>
              <div className="space-y-2">
                <Label>Brightness do fundo</Label>
                <Input type="range" min={40} max={140} step={5} value={String(form.theme.branding?.background_brightness || 100)} onChange={(event) => updateForm((current) => ({ ...current, theme: { ...current.theme, branding: { ...(current.theme.branding || PRE_CHECKOUT_DEFAULT_THEME.branding!), background_brightness: Number(event.target.value) || 100 } } }))} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Adicionar etapa</DialogTitle>
            <DialogDescription>Escolha o elemento que melhor encaixa nesta parte do form.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-3">
            {["Contato", "Escolha", "Escala", "Conteudo", "Finalizacao"].map((category) => (
              <div key={category} className="space-y-3">
                <p className="text-sm font-semibold">{category}</p>
                <div className="space-y-2">
                  {PRE_CHECKOUT_STEP_PALETTE.filter((item) => item.category === category).map((item) => (
                    <button key={item.type} type="button" onClick={() => handleAddStep(item.type)} className="block w-full rounded-2xl border px-4 py-3 text-left hover:border-primary/30 hover:bg-primary/5">
                      <div className="font-medium">{item.label}</div>
                      <div className="text-sm text-muted-foreground">{item.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
