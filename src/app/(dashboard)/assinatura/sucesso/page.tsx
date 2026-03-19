"use client";

import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Crown, ArrowRight, Loader2, Sparkles, PartyPopper } from "lucide-react";
import Link from "next/link";

export default function AssinaturaSucessoPage() {
  const [loading, setLoading] = useState(true);
  const [planName, setPlanName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef(0);

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        const { data } = await supabase
          .from("subscriptions")
          .select("plan_id, status, mp_preapproval_id")
          .eq("user_id", userData.user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (data) {
          const names: Record<string, string> = { starter: "Starter", pro: "Pro", black: "FlowLux Black" };
          setPlanName(names[data.plan_id] || data.plan_id);

          // Only confirm if webhook already set status to trial/active/authorized
          if (["active", "authorized", "trial"].includes(data.status)) {
            setConfirmed(true);
            setLoading(false);
            return;
          }
          // pending_payment / pending = still waiting for MP webhook confirmation
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    checkSubscription();

    // Poll every 5s for up to 3 minutes to detect webhook confirmation
    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      if (pollCountRef.current > 36) {
        // Stop after ~3 minutes
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }

      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        const { data } = await supabase
          .from("subscriptions")
          .select("plan_id, status")
          .eq("user_id", userData.user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (data && ["active", "authorized", "trial"].includes(data.status)) {
          const names: Record<string, string> = { starter: "Starter", pro: "Pro", black: "FlowLux Black" };
          setPlanName(names[data.plan_id] || data.plan_id);
          setConfirmed(true);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // ignore
      }
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh] animate-fade-in">
      <Card className="max-w-lg w-full border-primary/30 shadow-xl shadow-primary/10 overflow-hidden">
        {/* Gradient Top Bar */}
        <div className="h-2 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500" />

        <CardContent className="p-8 text-center space-y-6">
          {/* Success Icon */}
          <div className="relative inline-flex">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <PartyPopper className="h-4 w-4 text-primary" />
            </div>
          </div>

          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold mb-2">Assinatura Confirmada!</h1>
            <p className="text-muted-foreground">
              Bem-vindo ao FlowLux <span className="font-semibold text-primary">{planName}</span>
            </p>
          </div>

          {/* Trial Info */}
          <div className="bg-primary/10 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              <span className="font-semibold">7 Dias de Teste Grátis</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Seu período de teste já começou! Aproveite todos os recursos do plano sem nenhum custo durante 7 dias.
            </p>
          </div>

          {/* What's Next */}
          <div className="text-left space-y-3 bg-muted/30 rounded-xl p-4">
            <p className="font-medium text-sm flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" />
              Próximos passos:
            </p>
            <div className="space-y-2">
              {[
                "Configure sua instância WhatsApp em Configurações",
                "Importe ou crie seus primeiros leads",
                "Monte seu funil de vendas",
                "Configure automações para escalar",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-2">
            <Link href="/dashboard">
              <Button className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90">
                Ir para o Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href="/configuracoes">
              <Button variant="outline" className="w-full">
                Configurar WhatsApp
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
