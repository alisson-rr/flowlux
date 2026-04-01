"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PLAN_LIMITS, type PlanId } from "@/lib/plan-limits";
import { useAuth } from "@/contexts/auth-context";

interface SubscriptionData {
  plan_id: PlanId;
  status: string;
  trial_end: string | null;
  current_period_end: string | null;
}

interface UseSubscriptionReturn {
  plan: PlanId;
  limits: typeof PLAN_LIMITS[PlanId];
  status: string;
  loading: boolean;
  isActive: boolean;
}

const ACTIVE_STATUSES = ["active", "authorized", "trial"];

export function useSubscription(): UseSubscriptionReturn {
  const { userId, loading: authLoading } = useAuth();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) { setLoading(false); return; }

    const load = async () => {
      try {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("plan_id, status, trial_end, current_period_end")
          .eq("user_id", userId)
          .in("status", ACTIVE_STATUSES)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (sub) {
          if (sub.status === "trial" && sub.trial_end) {
            const trialEnd = new Date(sub.trial_end);
            if (trialEnd < new Date()) {
              const hasPeriodAccess = sub.current_period_end && new Date(sub.current_period_end) > new Date();
              if (!hasPeriodAccess) {
                setData(null);
                return;
              }
            }
          }
          setData(sub as SubscriptionData);
        }
      } catch { /* no subscription */ }
      finally { setLoading(false); }
    };
    load();
  }, [userId, authLoading]);

  const plan: PlanId = data?.plan_id || "starter";
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
  const isActive = !!data && ACTIVE_STATUSES.includes(data.status);

  return { plan, limits, status: data?.status || "", loading, isActive };
}
