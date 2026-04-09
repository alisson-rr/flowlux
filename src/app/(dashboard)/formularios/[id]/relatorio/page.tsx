"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Eye,
  Loader2,
  MousePointerClick,
  TrendingUp,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatDateTime, formatPhone } from "@/lib/utils";
import type { PreCheckoutEvent, PreCheckoutForm, PreCheckoutSession } from "@/types";

type SessionWithMeta = PreCheckoutSession & {
  metadata?: Record<string, unknown> | null;
};

function getStatusLabel(status: PreCheckoutForm["status"]) {
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

function formatPercent(value: number) {
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function buildDailySeries(sessions: SessionWithMeta[], days = 14) {
  const counts = new Map<string, number>();

  sessions.forEach((session) => {
    const dateKey = new Date(session.started_at).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
    counts.set(dateKey, (counts.get(dateKey) || 0) + 1);
  });

  return Array.from({ length: days }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - index - 1));
    const key = date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });

    return {
      date: key,
      count: counts.get(key) || 0,
    };
  });
}

function buildTopList(values: Array<string | null | undefined>, limit = 5) {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    const normalized = (value || "").trim() || "Sem identificacao";
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function getSourceLabel(value?: string | null) {
  if (!value) return "Sem origem identificada";

  try {
    const parsed = new URL(value);
    return `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return value;
  }
}

function getCampaignLabel(session: SessionWithMeta) {
  const source = String(session.metadata?.utm_source || "").trim();
  const medium = String(session.metadata?.utm_medium || "").trim();
  const campaign = String(session.metadata?.utm_campaign || "").trim();

  if (!source && !medium && !campaign) {
    return "Sem UTM";
  }

  return [source, medium, campaign].filter(Boolean).join(" / ");
}

export default function FormularioRelatorioPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const formId = typeof params?.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<PreCheckoutForm | null>(null);
  const [sessions, setSessions] = useState<SessionWithMeta[]>([]);
  const [events, setEvents] = useState<PreCheckoutEvent[]>([]);

  const loadReport = useCallback(async () => {
    if (!user || !formId) return;

    setLoading(true);

    const [formResult, sessionResult, eventResult] = await Promise.all([
      supabase.from("pre_checkout_forms").select("*").eq("id", formId).eq("user_id", user.id).single(),
      supabase
        .from("pre_checkout_sessions")
        .select("id,form_id,user_id,session_token,resume_token,status,lead_id,current_step_position,answers_count,visitor_phone_raw,visitor_phone_e164,visitor_phone_search_keys,visitor_email,metadata,started_at,last_interaction_at,completed_at,abandoned_at,expires_at,created_at,updated_at")
        .eq("form_id", formId)
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(2000),
      supabase
        .from("pre_checkout_events")
        .select("id,form_id,user_id,session_id,lead_id,event_type,status,metadata,occurred_at,created_at")
        .eq("form_id", formId)
        .eq("user_id", user.id)
        .order("occurred_at", { ascending: false })
        .limit(3000),
    ]);

    if (formResult.error || !formResult.data) {
      toast("Nao foi possivel carregar o relatorio deste formulario.", "error");
      setLoading(false);
      return;
    }

    setForm(formResult.data as PreCheckoutForm);
    setSessions((sessionResult.data || []) as SessionWithMeta[]);
    setEvents((eventResult.data || []) as PreCheckoutEvent[]);
    setLoading(false);
  }, [formId, toast, user]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const metrics = useMemo(() => {
    const countEvents = (type: PreCheckoutEvent["event_type"]) => events.filter((event) => event.event_type === type).length;

    const views = countEvents("view");
    const starts = countEvents("start");
    const answers = countEvents("step_answered");
    const leads = countEvents("lead_captured");
    const completed = countEvents("completed");
    const abandoned = countEvents("abandoned");
    const redirects = countEvents("redirect_checkout") + countEvents("redirect_whatsapp");
    const errors = events.filter((event) => event.status === "error").length;

    const startRate = views > 0 ? (starts / views) * 100 : 0;
    const completionRate = starts > 0 ? (completed / starts) * 100 : 0;
    const abandonmentRate = starts > 0 ? (abandoned / starts) * 100 : 0;
    const redirectRate = completed > 0 ? (redirects / completed) * 100 : 0;

    return {
      views,
      starts,
      answers,
      leads,
      completed,
      abandoned,
      redirects,
      errors,
      startRate,
      completionRate,
      abandonmentRate,
      redirectRate,
    };
  }, [events]);

  const dailySeries = useMemo(() => buildDailySeries(sessions, 14), [sessions]);
  const maxDailyCount = Math.max(...dailySeries.map((item) => item.count), 1);

  const topSources = useMemo(
    () => buildTopList(sessions.map((session) => getSourceLabel(String(session.metadata?.referrer || ""))), 5),
    [sessions]
  );

  const topCampaigns = useMemo(
    () => buildTopList(sessions.map((session) => getCampaignLabel(session)), 5),
    [sessions]
  );

  const latestSessions = useMemo(() => sessions.slice(0, 8), [sessions]);
  const latestAlerts = useMemo(
    () => events.filter((event) => event.status === "error" || event.status === "warning").slice(0, 6),
    [events]
  );

  const metricCards = [
    { title: "Visualizacoes", value: metrics.views, icon: Eye, color: "text-blue-300" },
    { title: "Inicios", value: metrics.starts, icon: MousePointerClick, color: "text-violet-300" },
    { title: "Respostas confirmadas", value: metrics.answers, icon: BarChart3, color: "text-cyan-300" },
    { title: "Leads capturados", value: metrics.leads, icon: UserRoundCheck, color: "text-green-300" },
    { title: "Taxa de inicio", value: formatPercent(metrics.startRate), icon: TrendingUp, color: "text-sky-300" },
    { title: "Taxa de conclusao", value: formatPercent(metrics.completionRate), icon: CheckCircle2, color: "text-emerald-300" },
    { title: "Taxa de abandono", value: formatPercent(metrics.abandonmentRate), icon: XCircle, color: "text-orange-300" },
    { title: "Redirecionamentos", value: metrics.redirects, icon: ExternalLink, color: "text-amber-300" },
  ];

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => router.push("/formularios")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Card className="p-8 text-center">
          <p className="font-medium">Nao encontramos este formulario.</p>
          <p className="mt-2 text-sm text-muted-foreground">Tente voltar para a lista e abrir novamente.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/formularios")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para formularios
          </Button>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{form.name}</h1>
              <Badge variant={getStatusVariant(form.status)}>{getStatusLabel(form.status)}</Badge>
            </div>
            <p className="text-muted-foreground">
              Veja o desempenho do form, as principais origens e as ultimas sessoes registradas.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push(`/formularios/${form.id}`)}>
            Editar formulario
          </Button>
          {form.status === "published" ? (
            <Button variant="outline" onClick={() => window.open(`/f/${form.slug}`, "_blank")}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir pagina
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <Card key={card.title} className="border-border/60">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className="mt-1 text-2xl font-bold">{card.value}</p>
                </div>
                <div className={`rounded-xl bg-muted p-3 ${card.color}`}>
                  <card.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Sessoes por dia</CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Ainda nao houve sessoes neste formulario.</p>
            ) : (
              <>
                <div className="flex h-48 items-end gap-2">
                  {dailySeries.map((item) => (
                    <div key={item.date} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex h-40 w-full items-end">
                        <div
                          className="w-full rounded-t-md bg-primary/80 transition-all duration-500"
                          style={{ height: `${Math.max((item.count / maxDailyCount) * 100, 4)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{item.date}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Taxa de redirecionamento apos conclusao: {formatPercent(metrics.redirectRate)}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Origens principais</CardTitle>
          </CardHeader>
          <CardContent>
            {topSources.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma origem registrada ainda.</p>
            ) : (
              <div className="space-y-3">
                {topSources.map((item) => {
                  const maxCount = Math.max(...topSources.map((entry) => entry.count), 1);
                  const width = (item.count / maxCount) * 100;

                  return (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="line-clamp-1 text-sm text-muted-foreground">{item.label}</span>
                        <span className="text-xs font-medium">{item.count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-secondary/80" style={{ width: `${Math.max(width, 8)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Campanhas e UTMs</CardTitle>
          </CardHeader>
          <CardContent>
            {topCampaigns.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma campanha identificada ainda.</p>
            ) : (
              <div className="space-y-3">
                {topCampaigns.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                    <span className="line-clamp-2 text-sm text-muted-foreground">{item.label}</span>
                    <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Alertas recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {latestAlerts.length === 0 ? (
              <div className="space-y-2 py-8 text-center">
                <AlertTriangle className="mx-auto h-6 w-6 text-green-400" />
                <p className="text-sm text-muted-foreground">Nenhum alerta recente neste formulario.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {latestAlerts.map((event) => (
                  <div key={event.id} className="rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{event.event_type}</p>
                      <span className="text-xs text-muted-foreground">{formatDateTime(event.occurred_at)}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {event.status === "error" ? "Evento registrado com erro para revisao." : "Evento registrado para acompanhamento."}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Eventos com erro</span>
                <span className="font-semibold">{metrics.errors}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Ultimas sessoes</CardTitle>
        </CardHeader>
        <CardContent>
          {latestSessions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma sessao registrada ate agora.</p>
          ) : (
            <div className="space-y-3">
              {latestSessions.map((session) => (
                <div key={session.id} className="grid gap-3 rounded-xl border border-border/60 p-4 md:grid-cols-[1fr_1fr_0.9fr_0.8fr]">
                  <div className="min-w-0">
                    <p className="font-medium">{session.visitor_email || "Sessao sem e-mail"}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {session.visitor_phone_e164 ? formatPhone(session.visitor_phone_e164) : "Sem telefone informado"}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{getSourceLabel(String(session.metadata?.referrer || ""))}</p>
                    <p className="truncate text-sm text-muted-foreground">{getCampaignLabel(session)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm">{session.status}</p>
                    <p className="text-sm text-muted-foreground">{session.answers_count} respostas</p>
                  </div>
                  <div className="text-sm text-muted-foreground">{formatDateTime(session.started_at)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
