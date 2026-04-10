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

export interface DashboardMetricsData {
  totalLeads: number;
  newLeadsWeek: number;
  totalConversations: number;
  messagesReceived: number;
  conversionRate: number;
  stageCount: number;
  messageErrorsWeek: number;
  scheduledProcessedWeek: number;
  averageFlowExecutionMs: number;
}

export interface DashboardActivationSignals {
  whatsappInstances: number;
  connectedWhatsappInstances: number;
  activeFlows: number;
  totalFlows: number;
  massMessages: number;
  scheduledMessages: number;
  messageTemplates: number;
  mediaFiles: number;
  capturePopups: number;
  publishedCapturePopups: number;
  forms: number;
  publishedForms: number;
  groups: number;
}

interface FailedFlowStepData {
  key: string;
  label: string;
  count: number;
}

interface OperationalAlert {
  id: string;
  source: string;
  eventType: string;
  severity: "warning" | "error";
  message: string;
  createdAt: string;
}

const DEFAULT_METRICS: DashboardMetricsData = {
  totalLeads: 0,
  newLeadsWeek: 0,
  totalConversations: 0,
  messagesReceived: 0,
  conversionRate: 0,
  stageCount: 0,
  messageErrorsWeek: 0,
  scheduledProcessedWeek: 0,
  averageFlowExecutionMs: 0,
};

const DEFAULT_ACTIVATION_SIGNALS: DashboardActivationSignals = {
  whatsappInstances: 0,
  connectedWhatsappInstances: 0,
  activeFlows: 0,
  totalFlows: 0,
  massMessages: 0,
  scheduledMessages: 0,
  messageTemplates: 0,
  mediaFiles: 0,
  capturePopups: 0,
  publishedCapturePopups: 0,
  forms: 0,
  publishedForms: 0,
  groups: 0,
};

export function useDashboardMetrics() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetricsData>(DEFAULT_METRICS);
  const [stagesData, setStagesData] = useState<StageData[]>([]);
  const [weekData, setWeekData] = useState<WeekData[]>([]);
  const [failedFlowSteps, setFailedFlowSteps] = useState<FailedFlowStepData[]>([]);
  const [recentOperationalAlerts, setRecentOperationalAlerts] = useState<OperationalAlert[]>([]);
  const [activationSignals, setActivationSignals] = useState<DashboardActivationSignals>(DEFAULT_ACTIVATION_SIGNALS);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [
        leadsRes,
        newLeadsRes,
        convsRes,
        msgsReceivedRes,
        stagesRes,
        allLeadsRes,
        weekMsgsRes,
        operationalErrorsRes,
        scheduledAttemptsRes,
        groupScheduledAttemptsRes,
        flowExecutionsRes,
        failedFlowStepsRes,
        recentAlertsRes,
        instancesRes,
        flowsRes,
        massMessagesRes,
        scheduledMessagesRes,
        templatesRes,
        mediaRes,
        capturePopupsRes,
        formsRes,
        groupsRes,
      ] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("archived", false),
        supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
        supabase.from("conversations").select("id", { count: "exact", head: true }),
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("from_me", false),
        supabase.from("funnel_stages").select("id, name, color").order("order"),
        supabase.from("leads").select("stage_id").eq("archived", false),
        supabase.from("messages").select("from_me, created_at").gte("created_at", weekAgo),
        supabase.from("operational_events").select("id", { count: "exact", head: true }).eq("severity", "error").gte("created_at", weekAgo),
        supabase.from("scheduled_message_attempts").select("id", { count: "exact", head: true }).in("status", ["sent", "failed", "skipped"]).gte("attempted_at", weekAgo),
        supabase.from("group_scheduled_message_attempts").select("id", { count: "exact", head: true }).in("status", ["sent", "failed", "skipped"]).gte("attempted_at", weekAgo),
        supabase.from("flow_executions").select("flow_id, started_at, completed_at").gte("started_at", weekAgo).not("completed_at", "is", null),
        supabase.from("flow_execution_steps").select("flow_id, step_order, step_type, updated_at").eq("status", "failed").gte("updated_at", weekAgo),
        supabase.from("operational_events").select("id, severity, source, event_type, message, created_at").in("severity", ["warning", "error"]).gte("created_at", weekAgo).order("created_at", { ascending: false }).limit(8),
        supabase.from("whatsapp_instances").select("id, status").is("deleted_at", null),
        supabase.from("flows").select("id, is_active"),
        supabase.from("mass_messages").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("scheduled_messages").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("message_templates").select("id", { count: "exact", head: true }),
        supabase.from("media").select("id", { count: "exact", head: true }),
        supabase.from("capture_popups").select("id, status").neq("status", "archived"),
        supabase.from("pre_checkout_forms").select("id, status").neq("status", "archived"),
        supabase.from("whatsapp_groups").select("id", { count: "exact", head: true }).eq("status", "active"),
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

      const completedFlowDurations = (flowExecutionsRes.data || [])
        .map((execution: any) => {
          const startedAt = new Date(execution.started_at || "").getTime();
          const completedAt = new Date(execution.completed_at || "").getTime();

          if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt) || completedAt < startedAt) {
            return null;
          }

          return completedAt - startedAt;
        })
        .filter((duration: number | null): duration is number => duration !== null);

      const averageFlowExecutionMs = completedFlowDurations.length > 0
        ? Math.round(completedFlowDurations.reduce((total, duration) => total + duration, 0) / completedFlowDurations.length)
        : 0;

      const failedFlowStepRows = failedFlowStepsRes.data || [];
      const flowIds = Array.from(
        new Set(
          failedFlowStepRows
            .map((step: any) => step.flow_id)
            .filter((flowId: string | null | undefined): flowId is string => Boolean(flowId))
        )
      );

      let flowNameMap: Record<string, string> = {};
      if (flowIds.length > 0) {
        const { data: flowsData } = await supabase
          .from("flows")
          .select("id, name")
          .in("id", flowIds);

        flowNameMap = Object.fromEntries((flowsData || []).map((flow: any) => [flow.id, flow.name]));
      }

      const failedFlowBuckets = new Map<string, FailedFlowStepData>();

      failedFlowStepRows.forEach((step: any) => {
        const bucketKey = `${step.flow_id}:${step.step_order}:${step.step_type}`;
        const flowName = flowNameMap[step.flow_id] || "Fluxo";
        const currentBucket = failedFlowBuckets.get(bucketKey);

        if (currentBucket) {
          currentBucket.count += 1;
          return;
        }

        failedFlowBuckets.set(bucketKey, {
          key: bucketKey,
          label: `${flowName} - etapa ${step.step_order} (${step.step_type})`,
          count: 1,
        });
      });

      const nextFailedFlowSteps = Array.from(failedFlowBuckets.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      const nextRecentOperationalAlerts: OperationalAlert[] = (recentAlertsRes.data || []).map((alert: any) => ({
        id: alert.id,
        source: alert.source,
        eventType: alert.event_type,
        severity: alert.severity,
        message: alert.message || "Sem descricao",
        createdAt: alert.created_at,
      }));

      const instances = instancesRes.data || [];
      const flows = flowsRes.data || [];
      const capturePopups = capturePopupsRes.data || [];
      const forms = formsRes.data || [];

      setMetrics({
        totalLeads,
        newLeadsWeek: newLeadsRes.count || 0,
        totalConversations: convsRes.count || 0,
        messagesReceived: msgsReceivedRes.count || 0,
        conversionRate: totalLeads > 0 ? Math.round((lastStageCount / totalLeads) * 100) : 0,
        stageCount: stages.length,
        messageErrorsWeek: operationalErrorsRes.count || 0,
        scheduledProcessedWeek: (scheduledAttemptsRes.count || 0) + (groupScheduledAttemptsRes.count || 0),
        averageFlowExecutionMs,
      });
      setStagesData(nextStagesData);
      setWeekData(nextWeekData);
      setFailedFlowSteps(nextFailedFlowSteps);
      setRecentOperationalAlerts(nextRecentOperationalAlerts);
      setActivationSignals({
        whatsappInstances: instances.length,
        connectedWhatsappInstances: instances.filter((instance: any) => instance.status === "connected").length,
        activeFlows: flows.filter((flow: any) => flow.is_active).length,
        totalFlows: flows.length,
        massMessages: massMessagesRes.count || 0,
        scheduledMessages: scheduledMessagesRes.count || 0,
        messageTemplates: templatesRes.count || 0,
        mediaFiles: mediaRes.count || 0,
        capturePopups: capturePopups.length,
        publishedCapturePopups: capturePopups.filter((popup: any) => popup.status === "published").length,
        forms: forms.length,
        publishedForms: forms.filter((form: any) => form.status === "published").length,
        groups: groupsRes.count || 0,
      });
    } catch (error) {
      console.error("Dashboard load error:", error);
      setActivationSignals(DEFAULT_ACTIVATION_SIGNALS);
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
    failedFlowSteps,
    recentOperationalAlerts,
    activationSignals,
    reload,
  };
}
