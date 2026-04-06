"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface StageData {
  stage: string;
  count: number;
  color: string;
}

interface WeekData {
  date: string;
  sent: number;
  received: number;
}

interface DashboardMetricsData {
  totalLeads: number;
  newLeadsWeek: number;
  totalConversations: number;
  messagesReceived: number;
  conversionRate: number;
  stageCount: number;
}

const DEFAULT_METRICS: DashboardMetricsData = {
  totalLeads: 0,
  newLeadsWeek: 0,
  totalConversations: 0,
  messagesReceived: 0,
  conversionRate: 0,
  stageCount: 0,
};

export function useDashboardMetrics() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetricsData>(DEFAULT_METRICS);
  const [stagesData, setStagesData] = useState<StageData[]>([]);
  const [weekData, setWeekData] = useState<WeekData[]>([]);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [leadsRes, newLeadsRes, convsRes, msgsReceivedRes, stagesRes, allLeadsRes, weekMsgsRes] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("archived", false),
        supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
        supabase.from("conversations").select("id", { count: "exact", head: true }),
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("from_me", false),
        supabase.from("funnel_stages").select("id, name, color").order("order"),
        supabase.from("leads").select("stage_id").eq("archived", false),
        supabase.from("messages").select("from_me, created_at").gte("created_at", weekAgo),
      ]);

      const totalLeads = leadsRes.count || 0;
      const stages = stagesRes.data || [];
      const allLeads = allLeadsRes.data || [];

      const nextStagesData: StageData[] = stages.map((stage: any) => ({
        stage: stage.name,
        count: allLeads.filter((lead: any) => lead.stage_id === stage.id).length,
        color: stage.color,
      }));

      const lastStageCount = nextStagesData.length > 0
        ? nextStagesData[nextStagesData.length - 1].count
        : 0;

      const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
      const weekMsgs = weekMsgsRes.data || [];
      const weekMap: Record<string, { sent: number; received: number }> = {};

      for (let i = 6; i >= 0; i -= 1) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        weekMap[date.toISOString().split("T")[0]] = { sent: 0, received: 0 };
      }

      weekMsgs.forEach((message: any) => {
        const day = new Date(message.created_at).toISOString().split("T")[0];
        if (!weekMap[day]) return;
        if (message.from_me) weekMap[day].sent += 1;
        else weekMap[day].received += 1;
      });

      const nextWeekData: WeekData[] = Object.entries(weekMap).map(([dateStr, counts]) => ({
        date: dayNames[new Date(dateStr).getDay()],
        ...counts,
      }));

      setMetrics({
        totalLeads,
        newLeadsWeek: newLeadsRes.count || 0,
        totalConversations: convsRes.count || 0,
        messagesReceived: msgsReceivedRes.count || 0,
        conversionRate: totalLeads > 0 ? Math.round((lastStageCount / totalLeads) * 100) : 0,
        stageCount: stages.length,
      });
      setStagesData(nextStagesData);
      setWeekData(nextWeekData);
    } catch (error) {
      console.error("Dashboard load error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    loading,
    metrics,
    stagesData,
    weekData,
    reload,
  };
}
