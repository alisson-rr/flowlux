"use client";

import React from "react";
import {
  Users,
  MessageSquare,
  TrendingUp,
  UserPlus,
  Inbox,
  BarChart3,
  AlertTriangle,
  CalendarClock,
  Clock3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { useDashboardMetrics } from "@/lib/use-dashboard-metrics";

export default function DashboardPage() {
  const {
    loading,
    metrics,
    stagesData,
    weekData,
    failedFlowSteps,
    recentOperationalAlerts,
  } = useDashboardMetrics();

  function formatDuration(durationMs: number) {
    if (!durationMs) return "-";

    const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
    if (totalSeconds < 60) return `${totalSeconds}s`;

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  function formatAlertDate(dateLike: string) {
    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const metricCards = [
    { title: "Total de Leads", value: metrics.totalLeads, icon: Users, color: "text-primary" },
    { title: "Novos na Semana", value: metrics.newLeadsWeek, icon: UserPlus, color: "text-secondary" },
    { title: "Conversas Ativas", value: metrics.totalConversations, icon: MessageSquare, color: "text-blue-400" },
    { title: "Mensagens Recebidas", value: metrics.messagesReceived, icon: Inbox, color: "text-green-400" },
    { title: "Taxa de Conversao", value: `${metrics.conversionRate}%`, icon: TrendingUp, color: "text-yellow-400" },
    { title: "Etapas do Funil", value: metrics.stageCount, icon: BarChart3, color: "text-purple-400" },
    { title: "Erros Operacionais", value: metrics.messageErrorsWeek, icon: AlertTriangle, color: "text-destructive" },
    { title: "Agendamentos Processados", value: metrics.scheduledProcessedWeek, icon: CalendarClock, color: "text-amber-300" },
    { title: "Tempo Medio do Fluxo", value: formatDuration(metrics.averageFlowExecutionMs), icon: Clock3, color: "text-cyan-300" },
  ];

  const maxBarValue = Math.max(...weekData.map((day) => Math.max(day.sent, day.received)), 1);
  const maxFailedStepValue = Math.max(...failedFlowSteps.map((item) => item.count), 1);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visao geral do seu negocio</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {metricCards.map((card) => (
          <Card key={card.title} className="transition-colors hover:border-primary/30">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className="mt-1 text-2xl font-bold">{card.value}</p>
                </div>
                <div className={`rounded-lg bg-muted p-3 ${card.color}`}>
                  <card.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads por Etapa</CardTitle>
          </CardHeader>
          <CardContent>
            {stagesData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Configure as etapas do funil em Leads</p>
            ) : (
              <div className="space-y-3">
                {stagesData.map((stage) => {
                  const maxCount = Math.max(...stagesData.map((item) => item.count), 1);
                  const width = (stage.count / maxCount) * 100;

                  return (
                    <div key={stage.stage} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-sm text-muted-foreground">{stage.stage}</span>
                      <div className="h-8 flex-1 overflow-hidden rounded-md bg-muted">
                        <div
                          className="flex h-full items-center rounded-md px-2 transition-all duration-500"
                          style={{ width: `${Math.max(width, 5)}%`, backgroundColor: stage.color }}
                        >
                          <span className="text-xs font-medium text-white">{stage.count}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mensagens da Semana</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-end gap-2">
              {weekData.map((day, index) => (
                <div key={index} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full items-end gap-0.5" style={{ height: "160px" }}>
                    <div
                      className="flex-1 rounded-t-sm bg-primary/80 transition-all duration-500"
                      style={{ height: `${Math.max((day.sent / maxBarValue) * 100, 2)}%` }}
                    />
                    <div
                      className="flex-1 rounded-t-sm bg-secondary/80 transition-all duration-500"
                      style={{ height: `${Math.max((day.received / maxBarValue) * 100, 2)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{day.date}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-sm bg-primary/80" />
                <span className="text-xs text-muted-foreground">Enviadas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-sm bg-secondary/80" />
                <span className="text-xs text-muted-foreground">Recebidas</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Falhas por Etapa do Fluxo</CardTitle>
          </CardHeader>
          <CardContent>
            {failedFlowSteps.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma falha de fluxo registrada nos ultimos 7 dias</p>
            ) : (
              <div className="space-y-3">
                {failedFlowSteps.map((item) => {
                  const width = (item.count / maxFailedStepValue) * 100;

                  return (
                    <div key={item.key} className="space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="line-clamp-1 text-sm text-muted-foreground">{item.label}</span>
                        <span className="text-xs font-medium text-foreground">{item.count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-destructive/80 transition-all duration-500"
                          style={{ width: `${Math.max(width, 8)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alertas Operacionais Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentOperationalAlerts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum alerta operacional recente</p>
            ) : (
              <div className="space-y-3">
                {recentOperationalAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-lg border p-3 ${
                      alert.severity === "error"
                        ? "border-destructive/30 bg-destructive/5"
                        : "border-amber-500/30 bg-amber-500/5"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{alert.message}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {alert.source} - {alert.eventType}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                          alert.severity === "error"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-amber-500/10 text-amber-300"
                        }`}
                      >
                        {alert.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{formatAlertDate(alert.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
