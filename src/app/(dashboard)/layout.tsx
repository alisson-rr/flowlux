"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { ToastProvider } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase";
import { AlertTriangle, X, Crown, Clock } from "lucide-react";
import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [disconnectedInstances, setDisconnectedInstances] = useState<string[]>([]);
  const [failedCount, setFailedCount] = useState(0);
  const [dismissBanner, setDismissBanner] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [dismissTrialBanner, setDismissTrialBanner] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const [instRes, failedRes, subRes] = await Promise.all([
        supabase.from("whatsapp_instances").select("instance_name, status").eq("user_id", userData.user.id).eq("status", "disconnected").is("deleted_at", null),
        supabase.from("mass_messages").select("id", { count: "exact", head: true }).eq("user_id", userData.user.id).eq("status", "failed"),
        supabase.from("subscriptions").select("status, trial_end").eq("user_id", userData.user.id).in("status", ["active", "authorized", "trial", "pending"]).order("created_at", { ascending: false }).limit(1).single(),
      ]);
      if (instRes.data) setDisconnectedInstances(instRes.data.map((i: any) => i.instance_name));
      if (failedRes.count) setFailedCount(failedRes.count);
      if (subRes.data?.status === "trial" && subRes.data?.trial_end) {
        const diff = new Date(subRes.data.trial_end).getTime() - Date.now();
        const days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        setTrialDaysLeft(days);
      }
    };
    check();
  }, []);

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar failedCount={failedCount} />
        <main className="flex-1 overflow-y-auto">
          {/* Trial Banner */}
          {trialDaysLeft !== null && !dismissTrialBanner && (
            <div className="bg-primary/10 border-b border-primary/30 px-4 py-2 flex items-center justify-between text-sm text-primary">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 shrink-0" />
                <span>
                  <strong>Período de teste:</strong> {trialDaysLeft} dia{trialDaysLeft !== 1 ? "s" : ""} restante{trialDaysLeft !== 1 ? "s" : ""}.{" "}
                  <Link href="/assinatura" className="underline hover:text-primary/80">Ver planos</Link>
                </span>
              </div>
              <button onClick={() => setDismissTrialBanner(true)} className="shrink-0 opacity-60 hover:opacity-100"><X className="h-4 w-4" /></button>
            </div>
          )}
          {disconnectedInstances.length > 0 && !dismissBanner && (
            <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2 flex items-center justify-between text-sm text-yellow-400">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  <strong>{disconnectedInstances.length}</strong> instância{disconnectedInstances.length > 1 ? "s" : ""} desconectada{disconnectedInstances.length > 1 ? "s" : ""}:{" "}
                  {disconnectedInstances.join(", ")}
                </span>
              </div>
              <button onClick={() => setDismissBanner(true)} className="shrink-0 opacity-60 hover:opacity-100"><X className="h-4 w-4" /></button>
            </div>
          )}
          <div className="p-6">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
