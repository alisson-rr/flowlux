"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, TrendingUp, UserPlus, Inbox, BarChart3, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface StageData { stage: string; count: number; color: string; }
interface WeekData { date: string; sent: number; received: number; }

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalLeads: 0,
    newLeadsWeek: 0,
    totalConversations: 0,
    messagesReceived: 0,
    conversionRate: 0,
    stageCount: 0,
  });
  const [stagesData, setStagesData] = useState<StageData[]>([]);
  const [weekData, setWeekData] = useState<WeekData[]>([]);

  const loadAll = useCallback(async () => {
    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // ALL queries in parallel - single round trip
      const [leadsRes, newLeadsRes, convsRes, msgsReceivedRes, stagesRes, allLeadsRes, weekMsgsRes] = await Promise.all([
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("archived", false),
        supabase.from("leads").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
        supabase.from("conversations").select("*", { count: "exact", head: true }),
        supabase.from("messages").select("*", { count: "exact", head: true }).eq("from_me", false),
        supabase.from("funnel_stages").select("id, name, color").order("order"),
        supabase.from("leads").select("stage_id").eq("archived", false),
        supabase.from("messages").select("from_me, created_at").gte("created_at", weekAgo),
      ]);

      const totalLeads = leadsRes.count || 0;
      const stages = stagesRes.data || [];
      const allLeads = allLeadsRes.data || [];

      const stageCounts: StageData[] = stages.map((s: any) => ({
        stage: s.name,
        count: allLeads.filter((l: any) => l.stage_id === s.id).length,
        color: s.color,
      }));

      const lastStageCount = stageCounts.length > 0 ? stageCounts[stageCounts.length - 1].count : 0;

      setMetrics({
        totalLeads,
        newLeadsWeek: newLeadsRes.count || 0,
        totalConversations: convsRes.count || 0,
        messagesReceived: msgsReceivedRes.count || 0,
        conversionRate: totalLeads > 0 ? Math.round((lastStageCount / totalLeads) * 100) : 0,
        stageCount: stages.length,
      });
      setStagesData(stageCounts);

      // Build week chart from single query result (no loop)
      const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const weekMsgs = weekMsgsRes.data || [];
      const weekMap: Record<string, { sent: number; received: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        weekMap[d.toISOString().split("T")[0]] = { sent: 0, received: 0 };
      }
      weekMsgs.forEach((m: any) => {
        const day = new Date(m.created_at).toISOString().split("T")[0];
        if (weekMap[day]) {
          if (m.from_me) weekMap[day].sent++;
          else weekMap[day].received++;
        }
      });
      const weekMessages: WeekData[] = Object.entries(weekMap).map(([dateStr, counts]) => ({
        date: dayNames[new Date(dateStr).getDay()],
        ...counts,
      }));
      setWeekData(weekMessages);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const metricCards = [
    { title: "Total de Leads", value: metrics.totalLeads, icon: Users, color: "text-primary" },
    { title: "Novos na Semana", value: metrics.newLeadsWeek, icon: UserPlus, color: "text-secondary" },
    { title: "Conversas Ativas", value: metrics.totalConversations, icon: MessageSquare, color: "text-blue-400" },
    { title: "Mensagens Recebidas", value: metrics.messagesReceived, icon: Inbox, color: "text-green-400" },
    { title: "Taxa de Conversão", value: `${metrics.conversionRate}%`, icon: TrendingUp, color: "text-yellow-400" },
    { title: "Etapas do Funil", value: metrics.stageCount, icon: BarChart3, color: "text-purple-400" },
  ];

  const maxBarValue = Math.max(...weekData.map((d) => Math.max(d.sent, d.received)), 1);

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do seu negócio</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metricCards.map((card) => (
          <Card key={card.title} className="hover:border-primary/30 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-bold mt-1">{card.value}</p>
                </div>
                <div className={`p-3 rounded-lg bg-muted ${card.color}`}>
                  <card.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads por Etapa</CardTitle>
          </CardHeader>
          <CardContent>
            {stagesData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Configure as etapas do funil em Leads</p>
            ) : (
              <div className="space-y-3">
                {stagesData.map((stage) => {
                  const maxCount = Math.max(...stagesData.map((s) => s.count), 1);
                  const width = (stage.count / maxCount) * 100;
                  return (
                    <div key={stage.stage} className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-24 shrink-0">{stage.stage}</span>
                      <div className="flex-1 h-8 bg-muted rounded-md overflow-hidden">
                        <div
                          className="h-full rounded-md flex items-center px-2 transition-all duration-500"
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

        {/* Messages Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mensagens da Semana</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-48">
              {weekData.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex gap-0.5 items-end" style={{ height: "160px" }}>
                    <div
                      className="flex-1 bg-primary/80 rounded-t-sm transition-all duration-500"
                      style={{ height: `${Math.max((day.sent / maxBarValue) * 100, 2)}%` }}
                    />
                    <div
                      className="flex-1 bg-secondary/80 rounded-t-sm transition-all duration-500"
                      style={{ height: `${Math.max((day.received / maxBarValue) * 100, 2)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{day.date}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-primary/80" />
                <span className="text-xs text-muted-foreground">Enviadas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-secondary/80" />
                <span className="text-xs text-muted-foreground">Recebidas</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
