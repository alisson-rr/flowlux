"use client";

import React from "react";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { StartHome } from "@/components/dashboard/start-home";
import { useDashboardMetrics } from "@/lib/use-dashboard-metrics";

export default function InicioPage() {
  const {
    loading,
    metrics,
    activationSignals,
  } = useDashboardMetrics();

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <StartHome
      loading={loading}
      metrics={metrics}
      activationSignals={activationSignals}
    />
  );
}
