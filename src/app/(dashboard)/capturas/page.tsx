"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Copy,
  ExternalLink,
  Loader2,
  PanelsTopLeft,
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
import { CAPTURE_POPUP_TEMPLATE_LIST, buildPopupFromTemplate } from "@/lib/capture-popups/templates";
import { slugifyCapturePopupName } from "@/lib/capture-popups/popups";
import { formatDateTime } from "@/lib/utils";
import type { CapturePopup } from "@/types";

function buildUniqueSlug(name: string) {
  const base = slugifyCapturePopupName(name) || "popup";
  return `${base}-${Date.now().toString(36)}`;
}

function getStatusVariant(status: CapturePopup["status"]) {
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

function getStatusLabel(status: CapturePopup["status"] | "all") {
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

type PopupPreviewModel = {
  templateKey: string;
  title: string;
  description?: string | null;
  buttonText: string;
  theme?: CapturePopup["theme"];
  compact?: boolean;
};

function renderTemplateMock({
  templateKey,
  title,
  description,
  buttonText,
  theme,
  compact = false,
}: PopupPreviewModel) {
  const isDark = templateKey === "offer-inline-dark";
  const isWhatsapp = templateKey === "whatsapp-fast-pass";
  const panelBackground = theme?.panel_background || (isDark ? "#140f1c" : "#ffffff");
  const panelTextColor = theme?.panel_text_color || (isDark ? "#ffffff" : "#202229");
  const buttonColor = theme?.button_color || (isDark ? "#ff0f8a" : isWhatsapp ? "#16a34a" : "#22c55e");
  const buttonTextColor = theme?.button_text_color || "#ffffff";
  const fieldBackground = theme?.field_background || "#ffffff";
  const fieldBorderColor = theme?.field_border_color || "rgba(15,23,42,0.12)";
  const frameHeight = compact ? "h-36" : "h-52";
  const dialogWidth = compact ? (isDark ? "max-w-[240px]" : "max-w-[220px]") : (isDark ? "max-w-[320px]" : "max-w-[286px]");
  const fieldHeight = compact ? "h-7" : "h-9";

  return (
    <div
      className={`relative ${frameHeight} overflow-hidden rounded-[26px] border border-border/60 p-4`}
      style={{
        background: isDark
          ? "linear-gradient(135deg, #180016 0%, #ff0f8a 55%, #231828 100%)"
          : isWhatsapp
            ? "linear-gradient(135deg, #ffffff 0%, #dfffea 100%)"
          : "linear-gradient(135deg, #ffffff 0%, #eef3f7 100%)",
      }}
    >
      <div
        className={`mx-auto flex h-full w-full ${dialogWidth} overflow-hidden rounded-[24px] border shadow-[0_18px_48px_rgba(0,0,0,0.24)]`}
        style={{
          background: panelBackground,
          borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.08)",
        }}
      >
        {isDark ? (
          <>
            <div className="flex min-w-0 flex-[1.08] flex-col justify-center p-4">
              <div className="space-y-1">
                <div
                  className={`line-clamp-2 font-bold ${compact ? "text-sm" : "text-base"}`}
                  style={{ color: panelTextColor }}
                >
                  {title}
                </div>
                <div className="line-clamp-2 text-[11px]" style={{ color: "rgba(255,255,255,0.72)" }}>
                  {description || "Preencha abaixo para continuar"}
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <div className={`${fieldHeight} rounded-full border`} style={{ background: fieldBackground, borderColor: fieldBorderColor }} />
                <div className={`${fieldHeight} rounded-full border`} style={{ background: fieldBackground, borderColor: fieldBorderColor }} />
              </div>

              <div
                className={`mt-3 rounded-full ${compact ? "h-8" : "h-9"}`}
                style={{ background: buttonColor, color: buttonTextColor }}
              />
            </div>

            <div className="relative flex min-w-[38%] flex-1 items-end justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#7c3aed_0%,#ec4899_42%,#1f1630_100%)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.38),transparent_38%)]" />
              <div className="absolute left-3 top-3 rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[10px] font-medium text-white">
                Oferta
              </div>
              <div className="relative mb-0 h-[78%] w-[82%] rounded-t-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.26),rgba(255,255,255,0.08))]" />
            </div>
          </>
        ) : (
          <div className={`flex w-full flex-col justify-center ${compact ? "p-4" : "p-5"}`}>
            <div className="space-y-1 text-center">
              <div
                className={`line-clamp-2 font-bold ${compact ? "text-sm" : "text-[1.02rem]"}`}
                style={{ color: panelTextColor }}
              >
                {title}
              </div>
              <div className="line-clamp-2 text-[11px]" style={{ color: isWhatsapp ? "#5f6b74" : "#6b7280" }}>
                {description || (isWhatsapp ? "Continue em poucos segundos" : "Preencha abaixo para continuar")}
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div className={`${fieldHeight} rounded-full border`} style={{ background: fieldBackground, borderColor: fieldBorderColor }} />
              <div className={`${fieldHeight} rounded-full border`} style={{ background: fieldBackground, borderColor: fieldBorderColor }} />
              {!isWhatsapp ? (
                <div className={`${fieldHeight} rounded-full border`} style={{ background: fieldBackground, borderColor: fieldBorderColor }} />
              ) : null}
            </div>

            <div
              className={`mt-3 flex items-center justify-center rounded-full font-semibold ${compact ? "h-8 text-[11px]" : "h-10 text-xs"}`}
              style={{ background: buttonColor, color: buttonTextColor }}
            >
              {buttonText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getTemplateDetails(templateKey: string) {
  switch (templateKey) {
    case "lead-capture-minimal":
      return {
        tag: "Mais simples e direto",
        bullets: ["Visual claro", "Cadastro rapido", "Ideal para checkout"],
      };
    case "offer-inline-dark":
      return {
        tag: "Mais agressivo para oferta",
        bullets: ["Visual de impacto", "CTA forte", "Ideal para vendas"],
      };
    case "whatsapp-fast-pass":
      return {
        tag: "Mais rapido para WhatsApp",
        bullets: ["Poucos campos", "Leva para conversa", "Ideal para suporte"],
      };
    default:
      return {
        tag: "Modelo de captura",
        bullets: ["Captura dados antes da proxima etapa."],
      };
  }
}

export default function CapturasPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<CapturePopup["status"] | "all">("all");
  const [popups, setPopups] = useState<CapturePopup[]>([]);

  const loadPopups = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("capture_popups")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      toast("Nao foi possivel carregar os pop-ups.", "error");
    } else {
      setPopups((data || []) as CapturePopup[]);
    }

    setLoading(false);
  }, [toast, user]);

  useEffect(() => {
    loadPopups();
  }, [loadPopups]);

  const filteredPopups = useMemo(() => (
    popups.filter((popup) => {
      if (popup.status === "archived") return false;
      const matchesStatus = statusFilter === "all" || popup.status === statusFilter;
      const searchable = `${popup.name} ${popup.slug} ${popup.template_key}`.toLowerCase();
      const matchesSearch = searchable.includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    })
  ), [popups, searchTerm, statusFilter]);

  const handleCreateFromTemplate = async (templateKey: string) => {
    if (!user) return;
    const templateData = buildPopupFromTemplate(templateKey);
    if (!templateData) {
      toast("Template invalido.", "error");
      return;
    }

    setSaving("creating");
    const slug = buildUniqueSlug(templateData.popup.name);
    const { data: popup, error: popupError } = await supabase
      .from("capture_popups")
      .insert({
        user_id: user.id,
        name: templateData.popup.name,
        slug,
        description: templateData.popup.description || "",
        template_key: templateData.popup.template_key,
        template_version: templateData.popup.template_version,
        content: templateData.popup.content,
        theme: templateData.popup.theme,
        trigger: templateData.popup.trigger,
        integrations: templateData.popup.integrations,
      })
      .select("*")
      .single();

    if (popupError || !popup) {
      toast("Nao foi possivel criar o pop-up.", "error");
      setSaving(null);
      return;
    }

    const fieldsPayload = templateData.fields.map((field) => ({
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

    const { error: fieldsError } = await supabase.from("capture_popup_fields").insert(fieldsPayload);
    if (fieldsError) {
      await supabase.from("capture_popups").delete().eq("id", popup.id);
      toast("O pop-up foi criado, mas os campos falharam. Tente novamente.", "error");
      setSaving(null);
      return;
    }

    toast("Pop-up criado com sucesso!", "success");
    setShowCreateDialog(false);
    setSaving(null);
    router.push(`/capturas/${popup.id}`);
  };

  const handleDuplicate = async (popupId: string) => {
    if (!user) return;
    setSaving(popupId);

    const [{ data: sourcePopup }, { data: sourceFields }] = await Promise.all([
      supabase.from("capture_popups").select("*").eq("id", popupId).single(),
      supabase.from("capture_popup_fields").select("*").eq("popup_id", popupId).order("position"),
    ]);

    if (!sourcePopup) {
      toast("Nao foi possivel duplicar o pop-up.", "error");
      setSaving(null);
      return;
    }

    const duplicateName = `${sourcePopup.name} (copia)`;
    const { data: duplicatedPopup, error: duplicatedPopupError } = await supabase
      .from("capture_popups")
      .insert({
        user_id: user.id,
        name: duplicateName,
        slug: buildUniqueSlug(duplicateName),
        description: sourcePopup.description,
        template_key: sourcePopup.template_key,
        template_version: sourcePopup.template_version,
        status: "draft",
        content: sourcePopup.content,
        theme: sourcePopup.theme,
        trigger: sourcePopup.trigger,
        integrations: sourcePopup.integrations,
      })
      .select("*")
      .single();

    if (duplicatedPopupError || !duplicatedPopup) {
      toast("Nao foi possivel duplicar o pop-up.", "error");
      setSaving(null);
      return;
    }

    const duplicatedFields = (sourceFields || []).map((field: any) => ({
      popup_id: duplicatedPopup.id,
      user_id: user.id,
      field_key: `${field.field_key}_${Date.now().toString(36)}`,
      position: field.position,
      type: field.type,
      label: field.label,
      placeholder: field.placeholder || "",
      is_required: field.is_required,
      width: field.width,
      settings: field.settings || {},
    }));

    const { error: duplicatedFieldsError } = await supabase.from("capture_popup_fields").insert(duplicatedFields);
    if (duplicatedFieldsError) {
      await supabase.from("capture_popups").delete().eq("id", duplicatedPopup.id);
      toast("A copia falhou ao replicar os campos.", "error");
      setSaving(null);
      return;
    }

    await loadPopups();
    toast("Pop-up duplicado com sucesso!", "success");
    setSaving(null);
  };

  const handleStatusChange = async (popup: CapturePopup, status: CapturePopup["status"]) => {
    setSaving(popup.id);
    const updates: Record<string, unknown> = {
      status,
      published_at: status === "published" ? (popup.published_at || new Date().toISOString()) : popup.published_at,
      archived_at: status === "archived" ? new Date().toISOString() : null,
    };

    const { error } = await supabase.from("capture_popups").update(updates).eq("id", popup.id);
    if (error) {
      toast("Nao foi possivel atualizar o status.", "error");
    } else {
      await loadPopups();
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
          <h1 className="text-2xl font-bold">Pop-ups de captura</h1>
          <p className="text-muted-foreground">
            Crie um pop-up, personalize o visual e cole um codigo no site para capturar leads.
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo pop-up
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

        {filteredPopups.length === 0 ? (
          <div className="space-y-3 rounded-xl border border-dashed border-border p-10 text-center">
            <PanelsTopLeft className="mx-auto h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Nenhum pop-up encontrado</p>
              <p className="text-sm text-muted-foreground">
                Crie seu primeiro modal de captura e instale com um snippet na landing page.
              </p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Criar agora
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredPopups.map((popup) => (
              <Card key={popup.id} className="border-border/60 bg-card/80">
                <div className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-semibold">{popup.name}</h2>
                        <Badge variant={getStatusVariant(popup.status)}>{getStatusLabel(popup.status)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Atualizado {formatDateTime(popup.updated_at)}</p>
                    </div>
                    {saving === popup.id && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <Button size="sm" onClick={() => router.push(`/capturas/${popup.id}`)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => router.push(`/capturas/${popup.id}/relatorio`)}>
                      <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                      Relatorio
                    </Button>
                    {popup.status === "published" ? (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(popup, "paused")}>
                        <PauseCircle className="mr-1.5 h-3.5 w-3.5" />
                        Pausar
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(popup, "published")}>
                        <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                        Publicar
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-3 text-xs"
                      onClick={() => handleDuplicate(popup.id)}
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Duplicar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-3 text-xs"
                      onClick={() => handleStatusChange(popup, "archived")}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Excluir
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar pop-up a partir de um modelo</DialogTitle>
            <DialogDescription>
              Escolha o estilo inicial mais proximo da sua oferta. Depois voce pode trocar textos, cores, imagem e destino final.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-3">
            {CAPTURE_POPUP_TEMPLATE_LIST.map((template) => (
              <Card key={template.key} className="space-y-4 overflow-hidden border-border/60 p-4">
                {renderTemplateMock({
                  templateKey: template.key,
                  title: template.popup.content.title,
                  description: template.popup.content.description,
                  buttonText: template.popup.content.button_text,
                  theme: template.popup.theme,
                })}

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
