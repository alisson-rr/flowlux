"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  ExternalLink,
  Eye,
  Loader2,
  MousePointerClick,
  Send,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatDateTime, formatPhone } from "@/lib/utils";
import type { CapturePopup, CapturePopupEvent, CapturePopupSubmission } from "@/types";

function getStatusLabel(status: CapturePopup["status"]) {
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

function formatPercent(value: number) {
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function getSourceLabel(urlLike?: string | null) {
  if (!urlLike) return "Sem origem identificada";

  try {
    const url = new URL(urlLike);
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return urlLike;
  }
}

function getCampaignLabel(submission: CapturePopupSubmission) {
  const source = submission.utm_source?.trim();
  const medium = submission.utm_medium?.trim();
  const campaign = submission.utm_campaign?.trim();

  if (!source && !medium && !campaign) {
    return "Sem UTM";
  }

  return [source, medium, campaign].filter(Boolean).join(" / ");
}

function buildDailySeries(submissions: CapturePopupSubmission[], days = 14) {
  const counts = new Map<string, number>();

  submissions.forEach((submission) => {
    const dateKey = new Date(submission.submitted_at).toLocaleDateString("pt-BR", {
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
  const map = new Map<string, number>();

  values.forEach((value) => {
    const normalized = value?.trim() || "Sem identificacao";
    map.set(normalized, (map.get(normalized) || 0) + 1);
  });

  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export default function CapturaRelatorioPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const popupId = typeof params?.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState<CapturePopup | null>(null);
  const [submissions, setSubmissions] = useState<CapturePopupSubmission[]>([]);
  const [events, setEvents] = useState<CapturePopupEvent[]>([]);

  const loadReport = useCallback(async () => {
    if (!user || !popupId) return;

    setLoading(true);

    const [popupResult, submissionsResult, eventsResult] = await Promise.all([
      supabase
        .from("capture_popups")
        .select("*")
        .eq("id", popupId)
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("capture_popup_submissions")
        .select("id,popup_id,user_id,lead_id,submission_token,visitor_name,visitor_email,visitor_phone_raw,visitor_phone_e164,visitor_phone_search_keys,answers,source_url,referrer,utm_source,utm_medium,utm_campaign,fbclid,gclid,submitted_at,created_at,updated_at")
        .eq("popup_id", popupId)
        .eq("user_id", user.id)
        .order("submitted_at", { ascending: false })
        .limit(2000),
      supabase
        .from("capture_popup_events")
        .select("id,popup_id,user_id,submission_id,lead_id,session_token,event_type,status,metadata,occurred_at,created_at")
        .eq("popup_id", popupId)
        .eq("user_id", user.id)
        .order("occurred_at", { ascending: false })
        .limit(2000),
    ]);

    if (popupResult.error || !popupResult.data) {
      toast("Nao foi possivel carregar o relatorio deste pop-up.", "error");
      setLoading(false);
      return;
    }

    setPopup(popupResult.data as CapturePopup);
    setSubmissions((submissionsResult.data || []) as CapturePopupSubmission[]);
    setEvents((eventsResult.data || []) as CapturePopupEvent[]);
    setLoading(false);
  }, [popupId, toast, user]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const metrics = useMemo(() => {
    const countEvents = (type: CapturePopupEvent["event_type"]) => events.filter((event) => event.event_type === type).length;

    const views = countEvents("view");
    const opens = countEvents("open");
    const closes = countEvents("close");
    const redirects = countEvents("redirect");
    const pixelErrors = countEvents("pixel_error");
    const totalSubmissions = submissions.length;

    const openRate = views > 0 ? (opens / views) * 100 : 0;
    const captureRate = opens > 0 ? (totalSubmissions / opens) * 100 : views > 0 ? (totalSubmissions / views) * 100 : 0;
    const redirectRate = totalSubmissions > 0 ? (redirects / totalSubmissions) * 100 : 0;
    const closeRate = opens > 0 ? (closes / opens) * 100 : 0;

    return {
      views,
      opens,
      closes,
      redirects,
      pixelErrors,
      totalSubmissions,
      openRate,
      captureRate,
      redirectRate,
      closeRate,
    };
  }, [events, submissions]);

  const dailySeries = useMemo(() => buildDailySeries(submissions, 14), [submissions]);
  const maxDailyCount = Math.max(...dailySeries.map((item) => item.count), 1);

  const topSources = useMemo(
    () => buildTopList(submissions.map((submission) => getSourceLabel(submission.source_url)), 5),
    [submissions]
  );

  const topCampaigns = useMemo(
    () => buildTopList(submissions.map((submission) => getCampaignLabel(submission)), 5),
    [submissions]
  );

  const latestSubmissions = useMemo(() => submissions.slice(0, 8), [submissions]);
  const latestAlerts = useMemo(
    () =>
      events
        .filter((event) => event.event_type === "pixel_error" || event.status === "error")
        .slice(0, 6),
    [events]
  );

  const metricCards = [
    { title: "Visualizacoes", value: metrics.views, icon: Eye, color: "text-blue-300" },
    { title: "Aberturas", value: metrics.opens, icon: MousePointerClick, color: "text-violet-300" },
    { title: "Leads capturados", value: metrics.totalSubmissions, icon: Users, color: "text-green-300" },
    { title: "Redirecionamentos", value: metrics.redirects, icon: ExternalLink, color: "text-amber-300" },
    { title: "Taxa de abertura", value: formatPercent(metrics.openRate), icon: TrendingUp, color: "text-cyan-300" },
    { title: "Taxa de captura", value: formatPercent(metrics.captureRate), icon: Send, color: "text-emerald-300" },
    { title: "Taxa de clique final", value: formatPercent(metrics.redirectRate), icon: BarChart3, color: "text-pink-300" },
    { title: "Fechamentos", value: metrics.closes, icon: XCircle, color: "text-orange-300" },
  ];

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!popup) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => router.push("/capturas")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Card className="p-8 text-center">
          <p className="font-medium">Nao encontramos este pop-up.</p>
          <p className="mt-2 text-sm text-muted-foreground">Tente voltar para a lista e abrir novamente.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/capturas")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para pop-ups
          </Button>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{popup.name}</h1>
              <Badge variant={getStatusVariant(popup.status)}>{getStatusLabel(popup.status)}</Badge>
            </div>
            <p className="text-muted-foreground">
              Veja o desempenho deste pop-up, as origens mais fortes e os ultimos leads capturados.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push(`/capturas/${popup.id}`)}>
            Editar pop-up
          </Button>
          {popup.status === "published" ? (
            <Button variant="outline" onClick={() => window.open(`/api/capturas/${popup.slug}/script`, "_blank")}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Ver codigo
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
            <CardTitle className="text-base">Leads capturados por dia</CardTitle>
          </CardHeader>
          <CardContent>
            {submissions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Ainda nao houve capturas neste pop-up.</p>
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
                  Taxa de fechamento apos abertura: {formatPercent(metrics.closeRate)}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Paginas de origem</CardTitle>
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
            <CardTitle className="text-base">Alertas e erros recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {latestAlerts.length === 0 ? (
              <div className="space-y-2 py-8 text-center">
                <AlertTriangle className="mx-auto h-6 w-6 text-green-400" />
                <p className="text-sm text-muted-foreground">Nenhum erro recente neste pop-up.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {latestAlerts.map((event) => (
                  <div key={event.id} className="rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">
                        {event.event_type === "pixel_error" ? "Falha no pixel" : "Erro operacional"}
                      </p>
                      <span className="text-xs text-muted-foreground">{formatDateTime(event.occurred_at)}</span>
                    </div>
                    {event.metadata?.message ? (
                      <p className="mt-2 text-xs text-muted-foreground">{String(event.metadata.message)}</p>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">O evento foi registrado com erro para revisao.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Erros de pixel</span>
                <span className="font-semibold">{metrics.pixelErrors}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Ultimos leads capturados</CardTitle>
        </CardHeader>
        <CardContent>
          {latestSubmissions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum lead capturado ate agora.</p>
          ) : (
            <div className="space-y-3">
              {latestSubmissions.map((submission) => (
                <div key={submission.id} className="grid gap-3 rounded-xl border border-border/60 p-4 md:grid-cols-[1.2fr_1.1fr_0.9fr_0.8fr]">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{submission.visitor_name || "Lead sem nome"}</p>
                    <p className="truncate text-sm text-muted-foreground">{submission.visitor_email || "Sem e-mail informado"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{submission.visitor_phone_e164 ? formatPhone(submission.visitor_phone_e164) : "Sem telefone"}</p>
                    <p className="truncate text-sm text-muted-foreground">{getSourceLabel(submission.source_url)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm">{getCampaignLabel(submission)}</p>
                    <p className="text-sm text-muted-foreground">Token {submission.submission_token.slice(0, 8)}</p>
                  </div>
                  <div className="text-sm text-muted-foreground">{formatDateTime(submission.submitted_at)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
