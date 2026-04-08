"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Copy, PauseCircle, PlayCircle, Archive, Plus, Search, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { PRE_CHECKOUT_TEMPLATE_LIST, buildFormFromTemplate } from "@/lib/pre-checkout/templates";
import { slugifyPreCheckoutFormName } from "@/lib/pre-checkout/forms";
import { formatDateTime } from "@/lib/utils";
import type { PreCheckoutForm } from "@/types";

function buildUniqueSlug(name: string) {
  const base = slugifyPreCheckoutFormName(name) || "pre-checkout";
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
      toast("Não foi possível carregar os formulários.", "error");
    } else {
      setForms((data || []) as PreCheckoutForm[]);
    }

    setLoading(false);
  }, [toast, user]);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  const filteredForms = useMemo(() => {
    return forms.filter((form) => {
      const matchesStatus = statusFilter === "all" || form.status === statusFilter;
      const searchable = `${form.name} ${form.slug} ${form.template_key}`.toLowerCase();
      const matchesSearch = searchable.includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [forms, searchTerm, statusFilter]);

  const handleCreateFromTemplate = async (templateKey: string) => {
    if (!user) return;

    const templateData = buildFormFromTemplate(templateKey);
    if (!templateData) {
      toast("Template inválido.", "error");
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
      toast("Não foi possível criar o formulário.", "error");
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
      toast("O formulário foi criado, mas as perguntas falharam. Tente novamente.", "error");
      setSaving(null);
      return;
    }

    toast("Formulário criado com sucesso!", "success");
    setShowCreateDialog(false);
    setSaving(null);
    router.push(`/formularios/${form.id}`);
  };

  const handleDuplicate = async (formId: string) => {
    if (!user) return;
    setSaving(formId);

    const [{ data: sourceForm, error: sourceFormError }, { data: sourceSteps, error: sourceStepsError }] = await Promise.all([
      supabase.from("pre_checkout_forms").select("*").eq("id", formId).single(),
      supabase.from("pre_checkout_form_steps").select("*").eq("form_id", formId).order("position"),
    ]);

    if (sourceFormError || sourceStepsError || !sourceForm) {
      toast("Não foi possível duplicar o formulário.", "error");
      setSaving(null);
      return;
    }

    const duplicateName = `${sourceForm.name} (cópia)`;
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
      toast("Não foi possível duplicar o formulário.", "error");
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
      toast("A cópia falhou ao replicar as perguntas.", "error");
      setSaving(null);
      return;
    }

    await loadForms();
    toast("Formulário duplicado com sucesso!", "success");
    setSaving(null);
  };

  const handleStatusChange = async (form: PreCheckoutForm, status: PreCheckoutForm["status"]) => {
    setSaving(form.id);

    const updates: Partial<PreCheckoutForm> & Record<string, unknown> = {
      status,
      published_at: status === "published" ? new Date().toISOString() : form.published_at,
      archived_at: status === "archived" ? new Date().toISOString() : null,
    };

    const { error } = await supabase
      .from("pre_checkout_forms")
      .update(updates)
      .eq("id", form.id);

    if (error) {
      toast("Não foi possível atualizar o status.", "error");
    } else {
      await loadForms();
      toast("Status atualizado com sucesso!", "success");
    }

    setSaving(null);
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Formulários</h1>
          <p className="text-muted-foreground">
            Crie pre-checkouts, qualifique leads e leve o tráfego para a próxima etapa com contexto.
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo formulário
        </Button>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nome, slug ou template"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(["all", "draft", "published", "paused", "archived"] as const).map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(status)}
              >
                {status === "all" ? "Todos" : status}
              </Button>
            ))}
          </div>
        </div>

        {filteredForms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center space-y-3">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium">Nenhum formulário encontrado</p>
              <p className="text-sm text-muted-foreground">
                Crie o primeiro pre-checkout a partir de um template e comece a capturar contexto antes do checkout.
              </p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar agora
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredForms.map((form) => (
              <Card key={form.id} className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold truncate">{form.name}</h2>
                      <Badge variant={getStatusVariant(form.status)}>{form.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">/{form.slug}</p>
                  </div>
                  {saving === form.id && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
                </div>

                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground line-clamp-2">
                    {form.description || "Sem descrição ainda."}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Template: {form.template_key}</span>
                    <span>Atualizado em {formatDateTime(form.updated_at)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => router.push(`/formularios/${form.id}`)}>
                    Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDuplicate(form.id)}>
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Duplicar
                  </Button>
                  {form.status === "published" ? (
                    <Button size="sm" variant="outline" onClick={() => handleStatusChange(form, "paused")}>
                      <PauseCircle className="h-3.5 w-3.5 mr-1.5" />
                      Pausar
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleStatusChange(form, "published")}>
                      <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
                      Publicar
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handleStatusChange(form, "archived")}>
                    <Archive className="h-3.5 w-3.5 mr-1.5" />
                    Arquivar
                  </Button>
                  {form.status === "published" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(`/f/${form.slug}`, "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                      Abrir
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Criar formulário a partir de template</DialogTitle>
            <DialogDescription>
              Escolha um ponto de partida para montar seu pre-checkout sem começar do zero.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-3">
            {PRE_CHECKOUT_TEMPLATE_LIST.map((template) => (
              <Card key={template.key} className="p-4 space-y-4">
                <div
                  className="h-28 rounded-xl border border-border"
                  style={{
                    background:
                      template.key === "lead-capture-classic"
                        ? "linear-gradient(135deg, #8B5CF6 0%, #17171C 100%)"
                        : template.key === "application-focus"
                          ? "linear-gradient(135deg, #FFFFFF 0%, #DCE4FF 100%)"
                          : "linear-gradient(135deg, #22C55E 0%, #0B0B10 100%)",
                  }}
                />

                <div className="space-y-2">
                  <div>
                    <p className="font-semibold">{template.name}</p>
                    <p className="text-xs text-muted-foreground">{template.category}</p>
                  </div>
                  <p className="text-sm text-muted-foreground min-h-[60px]">{template.description}</p>
                </div>

                <Button
                  className="w-full"
                  disabled={saving === "creating"}
                  onClick={() => handleCreateFromTemplate(template.key)}
                >
                  {saving === "creating" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Usar template"}
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
