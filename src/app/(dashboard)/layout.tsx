"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Crown, Loader2, X } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { DashboardDataProvider, useDashboardData } from "@/contexts/dashboard-context";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardDataProvider>
        <DashboardLayoutInner>{children}</DashboardLayoutInner>
      </DashboardDataProvider>
    </AuthProvider>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const dashboardData = useDashboardData();
  const trialDaysLeft = dashboardData?.trialDaysLeft;
  const [dismissBanner, setDismissBanner] = useState(false);
  const [dismissTrialBanner, setDismissTrialBanner] = useState(false);
  const isExclusiveEditor = /^\/formularios\/[^/]+$/.test(pathname || "");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user || !dashboardData || dashboardData.loading) return;
    const isAllowedPage = pathname === "/assinatura" || pathname?.startsWith("/assinatura/");
    if (!dashboardData.hasActivePlan && !isAllowedPage) {
      router.replace("/assinatura");
    }
  }, [dashboardData, pathname, router, user]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden">
        {!isExclusiveEditor ? <Sidebar failedCount={dashboardData?.failedCount || 0} /> : null}
        <main className="flex-1 overflow-y-auto">
          {!isExclusiveEditor && trialDaysLeft !== null && trialDaysLeft !== undefined && !dismissTrialBanner && (
            <div className="bg-primary/10 border-b border-primary/30 px-4 py-2 flex items-center justify-between text-sm text-primary">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 shrink-0" />
                <span>
                  <strong>PerÃ­odo de teste:</strong> {trialDaysLeft} dia{trialDaysLeft !== 1 ? "s" : ""} restante{trialDaysLeft !== 1 ? "s" : ""}.{" "}
                  <Link href="/assinatura" className="underline hover:text-primary/80">Ver planos</Link>
                </span>
              </div>
              <button onClick={() => setDismissTrialBanner(true)} className="shrink-0 opacity-60 hover:opacity-100"><X className="h-4 w-4" /></button>
            </div>
          )}

          {!isExclusiveEditor && dashboardData && dashboardData.disconnectedInstances.length > 0 && !dismissBanner && (
            <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2 flex items-center justify-between text-sm text-yellow-400">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  <strong>{dashboardData.disconnectedInstances.length}</strong> instÃ¢ncia{dashboardData.disconnectedInstances.length > 1 ? "s" : ""} desconectada{dashboardData.disconnectedInstances.length > 1 ? "s" : ""}:{" "}
                  {dashboardData.disconnectedInstances.join(", ")}
                </span>
              </div>
              <button onClick={() => setDismissBanner(true)} className="shrink-0 opacity-60 hover:opacity-100"><X className="h-4 w-4" /></button>
            </div>
          )}
          <div className={isExclusiveEditor ? "" : "p-6"}>{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
