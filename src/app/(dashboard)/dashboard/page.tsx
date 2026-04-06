"use client";

import React from "react";
import { Users, MessageSquare, TrendingUp, UserPlus, Inbox, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { useDashboardMetrics } from "@/lib/use-dashboard-metrics";

export default function DashboardPage() {
  const { loading, metrics, stagesData, weekData } = useDashboardMetrics();

  const metricCards = [
    { title: "Total de Leads", value: metrics.totalLeads, icon: Users, color: "text-primary" },
    { title: "Novos na Semana", value: metrics.newLeadsWeek, icon: UserPlus, color: "text-secondary" },
    { title: "Conversas Ativas", value: metrics.totalConversations, icon: MessageSquare, color: "text-blue-400" },
    { title: "Mensagens Recebidas", value: metrics.messagesReceived, icon: Inbox, color: "text-green-400" },
    { title: "Taxa de Conversao", value: `${metrics.conversionRate}%`, icon: TrendingUp, color: "text-yellow-400" },
    { title: "Etapas do Funil", value: metrics.stageCount, icon: BarChart3, color: "text-purple-400" },
  ];

  const maxBarValue = Math.max(...weekData.map((day) => Math.max(day.sent, day.received)), 1);

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
          <Card key={card.title} className="hover:border-primary/30 transition-colors">
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
    </div>
  );
}
