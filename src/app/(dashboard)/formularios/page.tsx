"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Copy,
  FileText,
  ExternalLink,
  Sparkles,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { PRE_CHECKOUT_DEFAULT_SESSION_SETTINGS, PRE_CHECKOUT_DEFAULT_THEME, PRE_CHECKOUT_TEMPLATE_LIST, buildFormFromTemplate } from "@/lib/pre-checkout/templates";
import { slugifyPreCheckoutFormName } from "@/lib/pre-checkout/forms";
import { formatDateTime } from "@/lib/utils";
import type { PreCheckoutForm } from "@/types";

function buildUniqueSlug(name: string) {
  const base = slugifyPreCheckoutFormName(name) || "form";
  return `${base}-${Date.now().toString(36)}`;
}

function getStatusVariant(status: PreCheckoutForm["status"]) {
  switch (status) {
    case "published":
      return "default";
    case "paused":
      return "secondary";
    case "archived":
      return "outline";
    default:
      return "outline";
  }
}

function getStatusLabel(status: PreCheckoutForm["status"] | "all") {
  switch (status) {
    case "draft":
      return "Rascunho";
    case "published":
      return "Publicado";
    case "paused":
      return "Pausado";
    case "archived":
      return "Arquivado";
    default:
      return "Todos";
  }
}

function getTemplateDetails(templateKey: string) {
  switch (templateKey) {
    case "application-focus":
      return {
        tag: "Mais consultivo",
        bullets: ["Filtra melhor o lead", "Ideal para aplicacao", "Bom para vendas de ticket maior"],
      };
    case "warmup-whatsapp":
      return {
        tag: "Mais rapido para WhatsApp",
        bullets: ["Poucos passos", "Leva para conversa", "Otimo para suporte ou fechamento"],
      };
    default:
      return {
        tag: "Mais simples e direto",
        bullets: ["Cadastro rapido", "Bom para checkout", "Ideal para captar antes da compra"],
      };
  }
}

function buildBlankForm() {
  return {
    form: {
      name: "Novo form",
      description: "",
      template_key: "lead-capture-classic",
      template_version: 1,
      theme: PRE_CHECKOUT_DEFAULT_THEME,
      final_config: {
        action: "thank_you" as const,
        thank_you_title: "Tudo certo",
        thank_you_description: "Recebemos sua resposta.",
        button_label: "Enviar",
      },
      integrations: {
        tag_ids: [],
        workflows: [],
        connect: {
          meta_pixel_enabled: false,
          meta_pixel_id: "",
          ga4_enabled: false,
          ga4_measurement_id: "",
          gtm_enabled: false,
          gtm_container_id: "",
        },
      },
      session_settings: PRE_CHECKOUT_DEFAULT_SESSION_SETTINGS,
    },
    steps: [
      {
        step_key: "boas_vindas",
        position: 0,
        type: "welcome_screen" as const,
        title: "Vamos começar",
        description: "Apresente o contexto antes da primeira pergunta.",
        placeholder: "",
        is_required: false,
        options: [],
        settings: { button_label: "Começar" },
      },
      {
        step_key: "pergunta_1",
        position: 1,
        type: "short_text" as const,
        title: "Digite sua resposta",
        description: "",
        placeholder: "Sua resposta",
        is_required: true,
        options: [],
        settings: { auto_focus: true, max_length: 160, map_to_contact_field: null },
      },
      {
        step_key: "final",
        position: 2,
        type: "end_screen" as const,
        title: "Tudo certo",
        description: "Agora siga para a próxima ação.",
        placeholder: "",
        is_required: false,
        options: [],
        settings: { button_label: "Finalizar" },
      },
    ],
  };
}

export default function FormulariosPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<PreCheckoutForm["status"] | "all">("all");
  const [forms, setForms] = useState<PreCheckoutForm[]>([]);

  const loadForms = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("pre_checkout_forms")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      toast("Nao foi possivel carregar os formularios.", "error");
    } else {
      setForms((data || []) as PreCheckoutForm[]);
    }

    setLoading(false);
  }, [toast, user]);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  const filteredForms = useMemo(
    () =>
      forms.filter((form) => {
        if (form.status === "archived") return false;
        const matchesStatus = statusFilter === "all" || form.status === statusFilter;
        const searchable = `${form.name} ${form.slug} ${form.template_key}`.toLowerCase();
        const matchesSearch = searchable.includes(searchTerm.toLowerCase());
        return matchesStatus && matchesSearch;
      }),
    [forms, searchTerm, statusFilter]
  );

  const handleCreateFromTemplate = async (templateKey: string) => {
    if (!user) return;

    const templateData = templateKey === "blank" ? buildBlankForm() : buildFormFromTemplate(templateKey);
    if (!templateData) {
      toast("Modelo invalido.", "error");
      return;
    }

    setSaving("creating");

    const slug = buildUniqueSlug(templateData.form.name);
    const { data: form, error: formError } = await supabase
      .from("pre_checkout_forms")
      .insert({
        user_id: user.id,
        name: templateData.form.name,
        slug,
        description: templateData.form.description || "",
        template_key: templateData.form.template_key,
        template_version: templateData.form.template_version,
        theme: templateData.form.theme,
        final_config: templateData.form.final_config,
        integrations: templateData.form.integrations,
        session_settings: templateData.form.session_settings,
      })
      .select("*")
      .single();

    if (formError || !form) {
      toast("Nao foi possivel criar o formulario.", "error");
      setSaving(null);
      return;
    }

    const stepsPayload = templateData.steps.map((step) => ({
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

    const { error: stepsError } = await supabase.from("pre_checkout_form_steps").insert(stepsPayload);
    if (stepsError) {
      await supabase.from("pre_checkout_forms").delete().eq("id", form.id);
      toast("O formulario foi criado, mas os passos falharam. Tente novamente.", "error");
      setSaving(null);
      return;
    }

    toast("Form criado com sucesso!", "success");
    setShowCreateDialog(false);
    setSaving(null);
    router.push(`/formularios/${form.id}${templateKey === "ai" ? "?source=ai" : ""}`);
  };

  const handleCreateBlank = async () => {
    await handleCreateFromTemplate("blank");
  };

  const handleCreateWithAi = async () => {
    if (!user) return;
    const blank = buildBlankForm();
    setSaving("creating");

    const slug = buildUniqueSlug(blank.form.name);
    const { data: form, error: formError } = await supabase
      .from("pre_checkout_forms")
      .insert({
        user_id: user.id,
        name: "Novo form com IA",
        slug,
        description: "",
        template_key: blank.form.template_key,
        template_version: blank.form.template_version,
        theme: blank.form.theme,
        final_config: blank.form.final_config,
        integrations: blank.form.integrations,
        session_settings: blank.form.session_settings,
      })
      .select("*")
      .single();

    if (formError || !form) {
      toast("Nao foi possivel criar o form com IA.", "error");
      setSaving(null);
      return;
    }

    const stepsPayload = blank.steps.map((step) => ({
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

    const { error: stepsError } = await supabase.from("pre_checkout_form_steps").insert(stepsPayload);
    if (stepsError) {
      await supabase.from("pre_checkout_forms").delete().eq("id", form.id);
      toast("Nao foi possivel preparar o form com IA.", "error");
      setSaving(null);
      return;
    }

    setShowCreateDialog(false);
    setSaving(null);
    router.push(`/formularios/${form.id}?source=ai`);
  };

  const handleDuplicate = async (formId: string) => {
    if (!user) return;
    setSaving(formId);

    const [{ data: sourceForm, error: sourceFormError }, { data: sourceSteps, error: sourceStepsError }] = await Promise.all([
      supabase.from("pre_checkout_forms").select("*").eq("id", formId).single(),
      supabase.from("pre_checkout_form_steps").select("*").eq("form_id", formId).order("position"),
    ]);

    if (sourceFormError || sourceStepsError || !sourceForm) {
      toast("Nao foi possivel duplicar o formulario.", "error");
      setSaving(null);
      return;
    }

    const duplicateName = `${sourceForm.name} (copia)`;
    const { data: duplicatedForm, error: duplicatedFormError } = await supabase
      .from("pre_checkout_forms")
      .insert({
        user_id: user.id,
        name: duplicateName,
        slug: buildUniqueSlug(duplicateName),
        description: sourceForm.description,
        template_key: sourceForm.template_key,
        template_version: sourceForm.template_version,
        status: "draft",
        theme: sourceForm.theme,
        final_config: sourceForm.final_config,
        integrations: sourceForm.integrations,
        session_settings: sourceForm.session_settings,
      })
      .select("*")
      .single();

    if (duplicatedFormError || !duplicatedForm) {
      toast("Nao foi possivel duplicar o formulario.", "error");
      setSaving(null);
      return;
    }

    const duplicatedSteps = (sourceSteps || []).map((step: any) => ({
      form_id: duplicatedForm.id,
      user_id: user.id,
      step_key: step.step_key,
      position: step.position,
      type: step.type,
      title: step.title,
      description: step.description || "",
      placeholder: step.placeholder || "",
      is_required: step.is_required,
      options: step.options || [],
      settings: step.settings || {},
    }));

    const { error: duplicatedStepsError } = await supabase.from("pre_checkout_form_steps").insert(duplicatedSteps);
    if (duplicatedStepsError) {
      await supabase.from("pre_checkout_forms").delete().eq("id", duplicatedForm.id);
      toast("A copia falhou ao replicar os passos.", "error");
      setSaving(null);
      return;
    }

    await loadForms();
    toast("Formulario duplicado com sucesso!", "success");
    setSaving(null);
  };

  const handleStatusChange = async (form: PreCheckoutForm, status: PreCheckoutForm["status"]) => {
    setSaving(form.id);

    const updates: Partial<PreCheckoutForm> & Record<string, unknown> = {
      status,
      published_at: status === "published" ? new Date().toISOString() : form.published_at,
      archived_at: status === "archived" ? new Date().toISOString() : null,
    };

    const { error } = await supabase.from("pre_checkout_forms").update(updates).eq("id", form.id);

    if (error) {
      toast("Nao foi possivel atualizar o status.", "error");
    } else {
      await loadForms();
      toast("Status atualizado com sucesso!", "success");
    }

    setSaving(null);
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Forms</h1>
          <p className="text-muted-foreground">Crie forms conversacionais, acompanhe respostas e automatize o próximo passo.</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo form
        </Button>
      </div>

      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nome, identificador ou modelo"
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(["all", "draft", "published", "paused"] as const).map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(status)}
              >
                {getStatusLabel(status)}
              </Button>
            ))}
          </div>
        </div>

        {filteredForms.length === 0 ? (
          <div className="space-y-3 rounded-xl border border-dashed border-border p-10 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Nenhum form encontrado</p>
              <p className="text-sm text-muted-foreground">
                Crie seu primeiro form do zero, com IA ou a partir de um modelo.
              </p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Criar agora
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredForms.map((form) => (
              <Card key={form.id} className="border-border/60 bg-card/80">
                <div className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-semibold">{form.name}</h2>
                        <Badge variant={getStatusVariant(form.status)}>{getStatusLabel(form.status)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Atualizado {formatDateTime(form.updated_at)}</p>
                    </div>
                    {saving === form.id ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <Button size="sm" onClick={() => router.push(`/formularios/${form.id}`)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => router.push(`/formularios/${form.id}/relatorio`)}>
                      <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                      Relatorio
                    </Button>
                    {form.status === "published" ? (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(form, "paused")}>
                        <PauseCircle className="mr-1.5 h-3.5 w-3.5" />
                        Pausar
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(form, "published")}>
                        <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                        Publicar
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" className="h-8 px-3 text-xs" onClick={() => handleDuplicate(form.id)}>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Duplicar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-3 text-xs"
                      onClick={() => handleStatusChange(form, "archived")}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Excluir
                    </Button>
                    {form.status === "published" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-3 text-xs"
                        onClick={() => window.open(`/f/${form.slug}`, "_blank")}
                      >
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Abrir
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
          <DialogTitle>Como você quer começar?</DialogTitle>
          <DialogDescription>
              Escolha entre começar em branco, montar com IA ou usar um modelo base para acelerar.
          </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="space-y-4 border-border/60 p-4">
              <div className="space-y-2">
                <Badge variant="outline">Em branco</Badge>
                <div className="text-lg font-semibold">Começar do zero</div>
                <p className="text-sm text-muted-foreground">Cria um form limpo para você montar a estrutura do seu jeito.</p>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>• Estrutura mínima pronta</div>
                <div>• Ideal para criação manual</div>
                <div>• Mais controle desde o início</div>
              </div>
              <Button className="w-full" disabled={saving === "creating"} onClick={handleCreateBlank}>
                {saving === "creating" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar em branco"}
              </Button>
            </Card>

            <Card className="space-y-4 border-border/60 p-4">
              <div className="space-y-2">
                <Badge variant="outline">Com IA</Badge>
                <div className="text-lg font-semibold">Criar com IA</div>
                <p className="text-sm text-muted-foreground">Abre o editor com o assistente pronto para gerar a estrutura do form com OpenAI.</p>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>• Você usa o seu token</div>
                <div>• Geração guiada no editor</div>
                <div>• Ideal para montar rápido</div>
              </div>
              <Button className="w-full" disabled={saving === "creating"} onClick={handleCreateWithAi}>
                {saving === "creating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="mr-2 h-4 w-4" />Criar com IA</>}
              </Button>
            </Card>

            {PRE_CHECKOUT_TEMPLATE_LIST.map((template) => (
              <Card key={template.key} className="space-y-4 overflow-hidden border-border/60 p-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{template.name}</p>
                      <p className="text-xs text-muted-foreground">{template.category}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {getTemplateDetails(template.key).tag}
                    </Badge>
                  </div>

                  <p className="min-h-[44px] text-sm leading-relaxed text-muted-foreground">{template.description}</p>

                  <div className="flex flex-wrap gap-2">
                    {getTemplateDetails(template.key).bullets.map((bullet) => (
                      <span
                        key={bullet}
                        className="rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-[11px] text-muted-foreground"
                      >
                        {bullet}
                      </span>
                    ))}
                  </div>
                </div>

                  <Button
                  className="w-full"
                  disabled={saving === "creating"}
                  onClick={() => handleCreateFromTemplate(template.key)}
                >
                  {saving === "creating" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Usar modelo"}
                </Button>
              </Card>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
