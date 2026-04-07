"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import type { PlanId } from "@/lib/plan-limits";

interface DashboardProfile {
  name: string;
  avatar_url: string;
  email: string;
}

interface DashboardSubscription {
  plan_id: PlanId;
  status: string;
  trial_end: string | null;
  current_period_end: string | null;
}

interface DashboardDataContextType {
  loading: boolean;
  profile: DashboardProfile | null;
  failedCount: number;
  disconnectedInstances: string[];
  subscription: DashboardSubscription | null;
  hasActivePlan: boolean;
  trialDaysLeft: number | null;
  refresh: () => Promise<void>;
}

const ACTIVE_STATUSES = ["active", "authorized", "trial"];

const DashboardDataContext = createContext<DashboardDataContextType | null>(null);

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [failedCount, setFailedCount] = useState(0);
  const [disconnectedInstances, setDisconnectedInstances] = useState<string[]>([]);
  const [subscription, setSubscription] = useState<DashboardSubscription | null>(null);
  const [hasActivePlan, setHasActivePlan] = useState(true);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (authLoading) return;

    if (!user) {
      setProfile(null);
      setFailedCount(0);
      setDisconnectedInstances([]);
      setSubscription(null);
      setHasActivePlan(true);
      setTrialDaysLeft(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const [profileRes, instRes, failedRes, subRes] = await Promise.all([
      supabase.from("profiles").select("name, avatar_url, email").eq("id", user.id).single(),
      supabase
        .from("whatsapp_instances")
        .select("instance_name")
        .eq("user_id", user.id)
        .eq("status", "disconnected")
        .is("deleted_at", null),
      supabase
        .from("mass_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "failed"),
      supabase
        .from("subscriptions")
        .select("plan_id, status, trial_end, current_period_end")
        .eq("user_id", user.id)
        .in("status", ACTIVE_STATUSES)
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),
    ]);

    setProfile(profileRes.data ? {
      name: profileRes.data.name || "",
      avatar_url: profileRes.data.avatar_url || "",
      email: profileRes.data.email || user.email || "",
    } : {
      name: "",
      avatar_url: "",
      email: user.email || "",
    });
    setDisconnectedInstances((instRes.data || []).map((instance) => instance.instance_name));
    setFailedCount(failedRes.count || 0);

    const nextSubscription = (subRes.data || null) as DashboardSubscription | null;
    setSubscription(nextSubscription);

    let nextHasActivePlan = !!nextSubscription;
    let nextTrialDaysLeft: number | null = null;

    if (nextSubscription?.status === "trial" && nextSubscription.trial_end) {
      const trialEnd = new Date(nextSubscription.trial_end);
      if (trialEnd < new Date()) {
        nextHasActivePlan = !!(
          nextSubscription.current_period_end &&
          new Date(nextSubscription.current_period_end) > new Date()
        );
      } else {
        const diff = trialEnd.getTime() - Date.now();
        nextTrialDaysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
      }
    }

    setHasActivePlan(nextHasActivePlan);
    setTrialDaysLeft(nextTrialDaysLeft);
    setLoading(false);
  }, [authLoading, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <DashboardDataContext.Provider
      value={{
        loading,
        profile,
        failedCount,
        disconnectedInstances,
        subscription,
        hasActivePlan,
        trialDaysLeft,
        refresh,
      }}
    >
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData() {
  return useContext(DashboardDataContext);
}
