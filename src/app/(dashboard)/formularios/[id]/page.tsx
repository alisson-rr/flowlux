"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowDown, ArrowUp, ExternalLink, Loader2,
  MonitorSmartphone, PauseCircle, Palette, Plus, Rocket, Save, Settings2, Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRE_CHECKOUT_TEMPLATE_LIST } from "@/lib/pre-checkout/templates";
import { slugifyPreCheckoutFormName, validatePreCheckoutPublish } from "@/lib/pre-checkout/forms";
import type { PreCheckoutForm, PreCheckoutFormStep, PreCheckoutFormStepType, PreCheckoutStepOption } from "@/types";

type FunnelOption = { id: string; name: string };
type StageOption = { id: string; name: string; funnel_id: string };
type TagOption = { id: string; name: string; color: string };
type FlowOption = { id: string; name: string; is_active: boolean };

const STEP_TYPES: Array<{ value: PreCheckoutFormStepType; label: string }> = [
  { value: "short_text", label: "Texto curto" },
  { value: "long_text", label: "Texto longo" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "single_choice", label: "Escolha única" },
  { value: "multiple_choice", label: "Múltipla escolha" },
];

function createStep(type: PreCheckoutFormStepType, position: number): PreCheckoutFormStep {
  const baseKey = `campo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
  const choiceOptions: PreCheckoutStepOption[] = [
    { id: `${baseKey}_1`, label: "Opção 1", value: "opcao_1" },
    { id: `${baseKey}_2`, label: "Opção 2", value: "opcao_2" },
  ];

  return {
    id: `temp-${baseKey}`,
    form_id: "",
    step_key: baseKey,
    position,
    type,
    title: "Nova pergunta",
    description: "",
    placeholder: "",
    is_required: true,
    options: type === "single_choice" || type === "multiple_choice" ? choiceOptions : [],
    settings: { auto_focus: position === 0, max_length: type === "long_text" ? 500 : 160 },
  };
}

function normalizeSteps(steps: PreCheckoutFormStep[]) {
  return [...steps]
    .sort((a, b) => a.position - b.position)
    .map((step, index) => ({ ...step, position: index }));
}

export default function FormularioEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const formId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PreCheckoutForm | null>(null);
  const [steps, setSteps] = useState<PreCheckoutFormStep[]>([]);
  const [deletedStepIds, setDeletedStepIds] = useState<string[]>([]);
  const [funnels, setFunnels] = useState<FunnelOption[]>([]);
  const [stages, setStages] = useState<StageOption[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [flows, setFlows] = useState<FlowOption[]>([]);

  const orderedSteps = useMemo(() => normalizeSteps(steps), [steps]);
  const availableStages = useMemo(
    () => stages.filter((stage) => stage.funnel_id === form?.integrations.funnel_id),
    [form?.integrations.funnel_id, stages],
  );
  const validation = useMemo(() => (
    form
      ? validatePreCheckoutPublish(form, orderedSteps)
      : { isValid: false, errors: [] }
  ), [form, orderedSteps]);

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
      toast("Não foi possível carregar este formulário.", "error");
      router.push("/formularios");
      return;
    }

    setForm(formResponse.data as PreCheckoutForm);
    setSteps((stepsResponse.data || []) as PreCheckoutFormStep[]);
    setFunnels((funnelsResponse.data || []) as FunnelOption[]);
    setStages((stagesResponse.data || []) as StageOption[]);
    setTags((tagsResponse.data || []) as TagOption[]);
    setFlows(((flowsResponse.data || []) as FlowOption[]).filter((flow) => flow.is_active));
    setDeletedStepIds([]);
    setLoading(false);
  }, [formId, router, toast, user]);

  useEffect(() => { loadData(); }, [loadData]);

  const updateForm = useCallback((updater: (current: PreCheckoutForm) => PreCheckoutForm) => {
    setForm((current) => (current ? updater(current) : current));
  }, []);

  const updateStep = useCallback((stepId: string, updater: (current: PreCheckoutFormStep) => PreCheckoutFormStep) => {
    setSteps((current) => current.map((step) => (step.id === stepId ? updater(step) : step)));
  }, []);

  const addStep = (type: PreCheckoutFormStepType) => setSteps((current) => [...normalizeSteps(current), createStep(type, current.length)]);
  const moveStep = (index: number, direction: -1 | 1) => {
    const next = [...orderedSteps];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSteps(normalizeSteps(next));
  };

  const removeStep = (stepId: string) => {
    if (!stepId.startsWith("temp-")) setDeletedStepIds((current) => Array.from(new Set([...current, stepId])));
    setSteps((current) => normalizeSteps(current.filter((step) => step.id !== stepId)));
  };

  const handleSave = async (nextStatus?: PreCheckoutForm["status"]) => {
    if (!user || !form) return;

    const normalizedSlug = slugifyPreCheckoutFormName(form.slug || form.name);
    if (!normalizedSlug) {
      toast("Defina um slug válido para o formulário.", "warning");
      return;
    }

    if (nextStatus === "published" && !validation.isValid) {
      toast(validation.errors[0] || "O formulário ainda não pode ser publicado.", "warning");
      return;
    }

    setSaving(true);
    const { data: slugConflict } = await supabase
      .from("pre_checkout_forms")
      .select("id")
      .eq("slug", normalizedSlug)
      .neq("id", form.id)
      .limit(1);

    if (slugConflict && slugConflict.length > 0) {
      toast("Esse slug já está em uso. Ajuste antes de salvar.", "warning");
      setSaving(false);
      return;
    }

    const normalizedSteps = normalizeSteps(steps);
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

    const { error: formError } = await supabase.from("pre_checkout_forms").update(formPayload).eq("id", form.id);
    if (formError) {
      toast("Não foi possível salvar o formulário.", "error");
      setSaving(false);
      return;
    }

    if (deletedStepIds.length) {
      await supabase.from("pre_checkout_form_steps").delete().in("id", deletedStepIds);
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
        options: step.options,
        settings: step.settings,
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
        options: step.options,
        settings: step.settings,
      }));

    if (persistedSteps.length) await supabase.from("pre_checkout_form_steps").upsert(persistedSteps);
    if (newSteps.length) await supabase.from("pre_checkout_form_steps").insert(newSteps);

    toast(nextStatus === "published" ? "Formulário publicado!" : "Formulário salvo com sucesso!", "success");
    await loadData();
    setSaving(false);
  };

  if (loading || !form) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const previewStyle: React.CSSProperties = form.theme.background.mode === "image" && form.theme.background.image_url
    ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,${form.theme.background.image_overlay / 100}), rgba(0,0,0,${form.theme.background.image_overlay / 100})), url(${form.theme.background.image_url})`,
        backgroundSize: "cover",
        backgroundPosition: `${form.theme.background.image_focus_x}% ${form.theme.background.image_focus_y}%`,
      }
    : { background: form.theme.background.color };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-2">
          <Link href="/formularios" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{form.name}</h1>
            <Badge variant={form.status === "published" ? "default" : "outline"}>{form.status}</Badge>
            <Badge variant="outline">{PRE_CHECKOUT_TEMPLATE_LIST.find((item) => item.key === form.template_key)?.name || form.template_key}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Configure estrutura, visual, tracking e destino comercial do seu pre-checkout.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.open(`/f/${form.slug}`, "_blank")}
            disabled={form.status !== "published"}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir público
          </Button>
          <Button variant="outline" onClick={() => handleSave(form.status === "published" ? "paused" : "published")} disabled={saving}>
            {form.status === "published" ? <PauseCircle className="h-4 w-4 mr-2" /> : <Rocket className="h-4 w-4 mr-2" />}
            {form.status === "published" ? "Pausar" : "Publicar"}
          </Button>
          <Button onClick={() => handleSave()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      {!validation.isValid && (
        <Card className="border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-300">Pendências para publicar</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-100/90">
            {validation.errors.slice(0, 5).map((error) => <li key={error}>• {error}</li>)}
          </ul>
        </Card>
      )}

      <Tabs defaultValue="conteudo" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
          <TabsTrigger value="perguntas">Perguntas</TabsTrigger>
          <TabsTrigger value="estilo">Estilo</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          <TabsTrigger value="finalizacao">Finalização</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="conteudo">
          <Card className="grid gap-4 p-5 lg:grid-cols-2">
            <div className="space-y-2"><Label>Nome</Label><Input value={form.name} onChange={(e) => updateForm((current) => ({ ...current, name: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Slug</Label><Input value={form.slug} onChange={(e) => updateForm((current) => ({ ...current, slug: slugifyPreCheckoutFormName(e.target.value) }))} /></div>
            <div className="space-y-2 lg:col-span-2"><Label>Descrição</Label><Textarea value={form.description || ""} onChange={(e) => updateForm((current) => ({ ...current, description: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Janela para retomar (min)</Label><Input type="number" value={form.session_settings.resume_window_minutes} onChange={(e) => updateForm((current) => ({ ...current, session_settings: { ...current.session_settings, resume_window_minutes: Number(e.target.value || 0) } }))} /></div>
            <div className="space-y-2"><Label>Janela de abandono (min)</Label><Input type="number" value={form.session_settings.abandonment_window_minutes} onChange={(e) => updateForm((current) => ({ ...current, session_settings: { ...current.session_settings, abandonment_window_minutes: Number(e.target.value || 0) } }))} /></div>
          </Card>
        </TabsContent>

        <TabsContent value="perguntas">
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">{STEP_TYPES.map((type) => <Button key={type.value} variant="outline" size="sm" onClick={() => addStep(type.value)}><Plus className="h-3.5 w-3.5 mr-1.5" />{type.label}</Button>)}</div>
            {orderedSteps.map((step, index) => (
              <Card key={step.id} className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1"><p className="text-sm font-medium">Pergunta {index + 1}</p><p className="text-xs text-muted-foreground">{step.step_key}</p></div>
                  <div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => moveStep(index, -1)} disabled={index === 0}><ArrowUp className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => moveStep(index, 1)} disabled={index === orderedSteps.length - 1}><ArrowDown className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => removeStep(step.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2"><Label>Título</Label><Input value={step.title} onChange={(e) => updateStep(step.id, (current) => ({ ...current, title: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Tipo</Label><Select value={step.type} onValueChange={(value: PreCheckoutFormStepType) => updateStep(step.id, (current) => ({ ...current, type: value, options: value === "single_choice" || value === "multiple_choice" ? (current.options.length ? current.options : createStep(value, index).options) : [] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STEP_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2 lg:col-span-2"><Label>Descrição</Label><Textarea value={step.description || ""} onChange={(e) => updateStep(step.id, (current) => ({ ...current, description: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Placeholder</Label><Input value={step.placeholder || ""} onChange={(e) => updateStep(step.id, (current) => ({ ...current, placeholder: e.target.value }))} /></div>
                  <div className="flex items-center justify-between rounded-xl border p-3"><div><p className="text-sm font-medium">Obrigatória</p><p className="text-xs text-muted-foreground">Bloqueia avanço sem resposta</p></div><Switch checked={step.is_required} onCheckedChange={(checked) => updateStep(step.id, (current) => ({ ...current, is_required: checked }))} /></div>
                </div>
                {(step.type === "single_choice" || step.type === "multiple_choice") && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between"><Label>Opções</Label><Button variant="outline" size="sm" onClick={() => updateStep(step.id, (current) => ({ ...current, options: [...current.options, { id: `${current.step_key}_${Date.now()}`, label: `Opção ${current.options.length + 1}`, value: `opcao_${current.options.length + 1}` }] }))}>Adicionar opção</Button></div>
                    {step.options.map((option) => (
                      <div key={option.id} className="grid gap-2 lg:grid-cols-[1fr_1fr_auto]">
                        <Input value={option.label} onChange={(e) => updateStep(step.id, (current) => ({ ...current, options: current.options.map((item) => item.id === option.id ? { ...item, label: e.target.value } : item) }))} />
                        <Input value={option.value} onChange={(e) => updateStep(step.id, (current) => ({ ...current, options: current.options.map((item) => item.id === option.id ? { ...item, value: e.target.value } : item) }))} />
                        <Button variant="ghost" size="icon" onClick={() => updateStep(step.id, (current) => ({ ...current, options: current.options.filter((item) => item.id !== option.id) }))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="estilo">
          <Card className="grid gap-4 p-5 lg:grid-cols-2">
            <div className="space-y-2"><Label>Imagem do topo</Label><Input value={form.theme.top_image_url || ""} onChange={(e) => updateForm((current) => ({ ...current, theme: { ...current.theme, top_image_url: e.target.value } }))} /></div>
            <div className="space-y-2"><Label>Modo do fundo</Label><Select value={form.theme.background.mode} onValueChange={(value: "solid" | "image") => updateForm((current) => ({ ...current, theme: { ...current.theme, background: { ...current.theme.background, mode: value } } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="solid">Cor sólida</SelectItem><SelectItem value="image">Imagem</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Cor principal</Label><Input type="color" value={form.theme.primary_color} onChange={(e) => updateForm((current) => ({ ...current, theme: { ...current.theme, primary_color: e.target.value } }))} /></div>
            <div className="space-y-2"><Label>Cor do painel</Label><Input type="color" value={form.theme.panel_color} onChange={(e) => updateForm((current) => ({ ...current, theme: { ...current.theme, panel_color: e.target.value } }))} /></div>
            <div className="space-y-2"><Label>URL da imagem de fundo</Label><Input value={form.theme.background.image_url || ""} onChange={(e) => updateForm((current) => ({ ...current, theme: { ...current.theme, background: { ...current.theme.background, image_url: e.target.value } } }))} /></div>
            <div className="flex items-center justify-between rounded-xl border p-3"><div><p className="text-sm font-medium">Imagem em tela cheia</p><p className="text-xs text-muted-foreground">Ocupa todo o fundo do formulário</p></div><Switch checked={form.theme.background.full_bleed} onCheckedChange={(checked) => updateForm((current) => ({ ...current, theme: { ...current.theme, background: { ...current.theme.background, full_bleed: checked } } }))} /></div>
            <div className="space-y-2"><Label>Fonte do título</Label><Input value={form.theme.typography.heading_font} onChange={(e) => updateForm((current) => ({ ...current, theme: { ...current.theme, typography: { ...current.theme.typography, heading_font: e.target.value } } }))} /></div>
            <div className="space-y-2"><Label>Fonte do corpo</Label><Input value={form.theme.typography.body_font} onChange={(e) => updateForm((current) => ({ ...current, theme: { ...current.theme, typography: { ...current.theme.typography, body_font: e.target.value } } }))} /></div>
          </Card>
        </TabsContent>

        <TabsContent value="integracoes">
          <Card className="grid gap-4 p-5 lg:grid-cols-2">
            <div className="space-y-2"><Label>Funil</Label><Select value={form.integrations.funnel_id || "none"} onValueChange={(value) => updateForm((current) => ({ ...current, integrations: { ...current.integrations, funnel_id: value === "none" ? null : value, stage_id: null } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum</SelectItem>{funnels.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Etapa</Label><Select value={form.integrations.stage_id || "none"} onValueChange={(value) => updateForm((current) => ({ ...current, integrations: { ...current.integrations, stage_id: value === "none" ? null : value } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nenhuma</SelectItem>{availableStages.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Flow ao concluir</Label><Select value={form.integrations.flow_on_complete_id || "none"} onValueChange={(value) => updateForm((current) => ({ ...current, integrations: { ...current.integrations, flow_on_complete_id: value === "none" ? null : value } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum</SelectItem>{flows.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Flow no abandono</Label><Select value={form.integrations.flow_on_abandon_id || "none"} onValueChange={(value) => updateForm((current) => ({ ...current, integrations: { ...current.integrations, flow_on_abandon_id: value === "none" ? null : value } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum</SelectItem>{flows.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 lg:col-span-2"><Label>Tags para aplicar</Label><div className="flex flex-wrap gap-2">{tags.map((tag) => { const active = form.integrations.tag_ids?.includes(tag.id); return <button key={tag.id} type="button" onClick={() => updateForm((current) => ({ ...current, integrations: { ...current.integrations, tag_ids: active ? (current.integrations.tag_ids || []).filter((id) => id !== tag.id) : [...(current.integrations.tag_ids || []), tag.id] } }))} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${active ? "border-transparent text-white" : "border-border text-muted-foreground"}`} style={{ backgroundColor: active ? tag.color : "transparent" }}>{tag.name}</button>; })}</div></div>
            <div className="flex items-center justify-between rounded-xl border p-3"><div><p className="text-sm font-medium">Pixel habilitado</p><p className="text-xs text-muted-foreground">Rastreia visualização, início e conclusão</p></div><Switch checked={Boolean(form.integrations.pixel_enabled)} onCheckedChange={(checked) => updateForm((current) => ({ ...current, integrations: { ...current.integrations, pixel_enabled: checked } }))} /></div>
            <div className="space-y-2"><Label>ID do pixel</Label><Input value={form.integrations.pixel_id || ""} onChange={(e) => updateForm((current) => ({ ...current, integrations: { ...current.integrations, pixel_id: e.target.value } }))} /></div>
          </Card>
        </TabsContent>

        <TabsContent value="finalizacao">
          <Card className="grid gap-4 p-5 lg:grid-cols-2">
            <div className="space-y-2 lg:col-span-2"><Label>Ação final</Label><Select value={form.final_config.action} onValueChange={(value: PreCheckoutForm["final_config"]["action"]) => updateForm((current) => ({ ...current, final_config: { ...current.final_config, action: value } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="checkout_redirect">Ir para checkout</SelectItem><SelectItem value="whatsapp_redirect">Redirecionar para WhatsApp</SelectItem><SelectItem value="thank_you">Tela de obrigado</SelectItem><SelectItem value="flow_only">Somente flow</SelectItem></SelectContent></Select></div>
            <div className="space-y-2 lg:col-span-2"><Label>URL de redirecionamento</Label><Input value={form.final_config.redirect_url || ""} onChange={(e) => updateForm((current) => ({ ...current, final_config: { ...current.final_config, redirect_url: e.target.value } }))} /></div>
            <div className="space-y-2"><Label>WhatsApp destino</Label><Input value={form.final_config.whatsapp_phone || ""} onChange={(e) => updateForm((current) => ({ ...current, final_config: { ...current.final_config, whatsapp_phone: e.target.value } }))} /></div>
            <div className="space-y-2"><Label>Mensagem de WhatsApp</Label><Input value={form.final_config.whatsapp_message || ""} onChange={(e) => updateForm((current) => ({ ...current, final_config: { ...current.final_config, whatsapp_message: e.target.value } }))} /></div>
            <div className="space-y-2"><Label>Título do obrigado</Label><Input value={form.final_config.thank_you_title || ""} onChange={(e) => updateForm((current) => ({ ...current, final_config: { ...current.final_config, thank_you_title: e.target.value } }))} /></div>
            <div className="space-y-2"><Label>Descrição do obrigado</Label><Textarea value={form.final_config.thank_you_description || ""} onChange={(e) => updateForm((current) => ({ ...current, final_config: { ...current.final_config, thank_you_description: e.target.value } }))} /></div>
          </Card>
        </TabsContent>

        <TabsContent value="preview">
          <div className="grid gap-4 xl:grid-cols-[1.1fr_340px]">
            <Card className="overflow-hidden" style={previewStyle}>
              <div className="p-4 sm:p-8">
                <div className="mx-auto w-full max-w-2xl rounded-[28px] border border-white/10 p-6 shadow-2xl" style={{ backgroundColor: form.theme.panel_color, color: form.theme.text_color }}>
                  <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground"><Palette className="h-3.5 w-3.5" /> Preview público</div>
                  {form.theme.top_image_url && <img src={form.theme.top_image_url} alt="" className="mb-5 h-40 w-full rounded-2xl object-cover" />}
                  <h2 className="text-2xl font-semibold">{form.name}</h2>
                  <p className="mt-2 text-sm opacity-80">{form.description || "Use este espaço para contextualizar o lead antes do checkout."}</p>
                  <div className="mt-6 space-y-3">{orderedSteps.map((step, index) => <div key={step.id} className="rounded-2xl border border-white/10 bg-black/10 p-4"><p className="text-xs uppercase tracking-wide opacity-60">Pergunta {index + 1}</p><p className="mt-1 font-medium">{step.title}</p><p className="mt-2 text-sm opacity-70">{step.description || step.placeholder || "Campo configurado para coletar esta resposta."}</p></div>)}</div>
                  <Button className="mt-6" style={{ backgroundColor: form.theme.primary_color }}><Rocket className="h-4 w-4 mr-2" />Continuar</Button>
                </div>
              </div>
            </Card>
            <Card className="space-y-4 p-5">
              <div className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /><p className="font-medium">Resumo rápido</p></div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><strong className="text-foreground">URL:</strong> /f/{form.slug}</p>
                <p><strong className="text-foreground">Perguntas:</strong> {orderedSteps.length}</p>
                <p><strong className="text-foreground">Ação final:</strong> {form.final_config.action}</p>
                <p><strong className="text-foreground">Pixel:</strong> {form.integrations.pixel_enabled ? "Ativo" : "Desligado"}</p>
              </div>
              <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                O render público entra no próximo bloco do módulo. Este preview já te ajuda a configurar tema, copy e estrutura antes da publicação.
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => window.open(`/f/${form.slug}`, "_blank")} disabled={form.status !== "published"}>
                  <ExternalLink className="h-4 w-4 mr-2" />Abrir página
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => window.open(`/f/${form.slug}`, "_blank")} disabled={form.status !== "published"}>
                  <MonitorSmartphone className="h-4 w-4 mr-2" />Mobile
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
