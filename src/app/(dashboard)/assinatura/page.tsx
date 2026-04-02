"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Crown,
  Check,
  Zap,
  MessageSquare,
  Users,
  BarChart3,
  Kanban,
  Bot,
  Send,
  Loader2,
  Star,
  Sparkles,
  Clock,
  CreditCard,
  ArrowRight,
  ShieldCheck,
  Flame,
  HardDrive,
  Tag,
  StickyNote,
  FileText,
  Workflow,
  Megaphone,
  UsersRound,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";

interface Subscription {
  id: string;
  plan_id: string;
  status: string;
  trial_start: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  created_at: string;
}

const PLAN_NAMES: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  black: "FlowLux Black",
};

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "49",
    oldPrice: "89",
    priceNum: 49,
    period: "/mês",
    description: "Comece a organizar seus leads e responder mais rápido",
    icon: Zap,
    color: "from-green-500 to-emerald-500",
    borderColor: "border-green-500/30",
    bgColor: "bg-green-500/10",
    popular: false,
    recommended: false,
    link: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=2a69ac12835b4077bbf7279faa7d61c6",
    features: [
      { text: "1 número WhatsApp", icon: MessageSquare },
      { text: "Até 500 leads", icon: Users },
      { text: "Chat em tempo real + CRM", icon: Kanban },
      { text: "Tags + Notas", icon: Tag },
      { text: "Gatilhos de mensagens", icon: Zap },
      { text: "5 GB de mídias", icon: HardDrive },
      { text: "Mensagens prontas", icon: FileText },
      { text: "Fluxos de mensagens", icon: Workflow },
      { text: "Disparo em massa (500/mês)", icon: Send },
      { text: "Integração Hotmart", icon: ShieldCheck },
      { text: "Comunidade exclusiva", icon: UsersRound },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "69",
    oldPrice: "129",
    priceNum: 69,
    period: "/mês",
    description: "Automatize seu atendimento e aumente suas vendas no WhatsApp",
    icon: Star,
    color: "from-purple-500 to-violet-500",
    borderColor: "border-purple-500/30",
    bgColor: "bg-purple-500/10",
    popular: false,
    recommended: false,
    link: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=d9bbcdeb8cdd488994afa7c88d94f75e",
    features: [
      { text: "Até 3 números WhatsApp", icon: MessageSquare },
      { text: "Leads ilimitados", icon: Users },
      { text: "Chat em tempo real + CRM", icon: Kanban },
      { text: "Tags + Notas", icon: Tag },
      { text: "Gatilhos por palavra-chave", icon: Zap },
      { text: "15 GB de mídias", icon: HardDrive },
      { text: "Mensagens prontas", icon: FileText },
      { text: "Fluxos ilimitados", icon: Workflow },
      { text: "Disparo em massa (5.000/mês)", icon: Send },
      { text: "Integração Hotmart", icon: ShieldCheck },
      { text: "Comunidade exclusiva", icon: UsersRound },
    ],
  },
  {
    id: "black",
    name: "FlowLux Black",
    price: "59",
    oldPrice: "99",
    priceNum: 59,
    period: "12x",
    description: "O plano definitivo para escalar seu negócio no WhatsApp",
    icon: Flame,
    color: "from-orange-500 to-red-500",
    borderColor: "border-orange-500/30",
    bgColor: "bg-orange-500/10",
    popular: false,
    recommended: true,
    link: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=e54d3d648c9045d3ac50101e493e8e84",
    features: [
      { text: "Até 5 números WhatsApp", icon: MessageSquare },
      { text: "Leads ilimitados", icon: Users },
      { text: "Chat em tempo real + CRM", icon: Kanban },
      { text: "Tags + Notas", icon: Tag },
      { text: "Gatilhos por palavra-chave", icon: Zap },
      { text: "30 GB de mídias", icon: HardDrive },
      { text: "Mensagens prontas", icon: FileText },
      { text: "Fluxos ilimitados", icon: Workflow },
      { text: "Disparo em massa (10.000/mês)", icon: Megaphone },
      { text: "Integração Hotmart", icon: ShieldCheck },
      { text: "Suporte prioritário", icon: Rocket },
      { text: "Comunidade exclusiva", icon: UsersRound },
      { text: "Acesso antecipado a IA personalizada", icon: Bot },
    ],
  },
];

export default function AssinaturaPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [hadTrial, setHadTrial] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAlterarMode = searchParams.get("alterar") === "true";

  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        // Check if user ever had a trial
        const { data: trialHistory } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", userData.user.id)
          .not("trial_start", "is", null)
          .limit(1);

        if (trialHistory && trialHistory.length > 0) {
          setHadTrial(true);
        }

        // Check for active subscription
        const { data } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", userData.user.id)
          .in("status", ["active", "authorized", "trial", "pending_payment", "pending"])
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (data) {
          setSubscription(data);
          // If user has active subscription and not in alterar mode, redirect to history
          if (!isAlterarMode) {
            router.replace("/assinatura/historico");
            return;
          }
        } else {
          // Check for cancelled subscription with access still valid
          const { data: cancelledSub } = await supabase
            .from("subscriptions")
            .select("*")
            .eq("user_id", userData.user.id)
            .eq("status", "cancelled")
            .gt("current_period_end", new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (cancelledSub) {
            setSubscription(cancelledSub);
            // Cancelled but still has access → redirect to history
            if (!isAlterarMode) {
              router.replace("/assinatura/historico");
              return;
            }
          }
        }
      } catch {
        // No subscription found
      } finally {
        setLoading(false);
      }
    };
    loadSubscription();
  }, [isAlterarMode, router]);

  const [selectingPlan, setSelectingPlan] = useState<string | null>(null);

  const handleSelectPlan = async (plan: typeof PLANS[0]) => {
    try {
      setSelectingPlan(plan.id);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast("Faça login para assinar.", "error");
        setSelectingPlan(null);
        return;
      }

      // Clean up old broken pending subscriptions for this user (no MP data)
      await supabase
        .from("subscriptions")
        .delete()
        .eq("user_id", userData.user.id)
        .in("status", ["pending", "pending_payment"])
        .is("mp_preapproval_id", null);

      const backUrl = `${window.location.origin}/assinatura/sucesso`;
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const res = await fetch("/api/create-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          plan_id: plan.id,
          user_id: userData.user.id,
          user_email: userData.user.email,
          back_url: backUrl,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        toast("Você já possui uma assinatura ativa.", "error");
        setSelectingPlan(null);
        // Reload to show current subscription
        window.location.reload();
        return;
      }

      if (!res.ok || !data.init_point) {
        console.error("Error creating subscription:", data);
        toast(data.error || "Erro ao criar assinatura. Tente novamente.", "error");
        setSelectingPlan(null);
        return;
      }

      if (data.fallback) {
        console.warn("Using fallback generic MP link (API not configured or failed)");
      }

      // Redirect to Mercado Pago checkout
      window.location.href = data.init_point;
    } catch (err) {
      console.error("Error selecting plan:", err);
      toast("Erro ao selecionar plano.", "error");
      setSelectingPlan(null);
    }
  };

  const handleChangePlan = async (plan: typeof PLANS[0]) => {
    try {
      setSelectingPlan(plan.id);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast("Faça login para alterar o plano.", "error");
        setSelectingPlan(null);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const res = await fetch("/api/update-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          user_id: userData.user.id,
          new_plan_id: plan.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.requires_new_checkout) {
          toast("Para mudar de/para o plano Black, cancele a assinatura atual e assine o novo plano.", "warning");
        } else {
          toast(data.error || "Erro ao alterar plano.", "error");
        }
        setSelectingPlan(null);
        return;
      }

      toast(data.message || "Plano alterado com sucesso!", "success");
      // Redirect to history page after successful change
      router.push("/assinatura/historico");
    } catch (err) {
      console.error("Error changing plan:", err);
      toast("Erro ao alterar plano.", "error");
      setSelectingPlan(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "success" | "outline" | "destructive" }> = {
      active: { label: "Ativo", variant: "success" },
      authorized: { label: "Autorizado", variant: "success" },
      trial: { label: "Período de Teste", variant: "outline" },
      pending_payment: { label: "Aguardando Pagamento", variant: "outline" },
      pending: { label: "Aguardando Pagamento", variant: "outline" },
      paused: { label: "Pausado", variant: "outline" },
      cancelled: { label: "Cancelado", variant: "destructive" },
    };
    const info = map[status] || { label: status, variant: "outline" as const };
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  const getTrialDaysLeft = () => {
    if (!subscription?.trial_end) return 0;
    const diff = new Date(subscription.trial_end).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">
          {isAlterarMode ? "Alterar Plano" : "Escolha seu Plano"}
        </h1>
        <p className="text-muted-foreground text-lg">
          {hadTrial ? (
            "Escolha o plano ideal para o seu negócio"
          ) : (
            <>Comece com <span className="text-primary font-semibold">7 dias grátis</span> e escale seu negócio</>
          )}
        </p>
      </div>

      {/* Current Subscription Banner */}
      {subscription && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/20">
                  <Crown className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-lg">
                      Plano {PLAN_NAMES[subscription.plan_id] || subscription.plan_id}
                    </p>
                    {getStatusBadge(subscription.status)}
                  </div>
                  {subscription.trial_end && getTrialDaysLeft() > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      <Clock className="h-3.5 w-3.5 inline mr-1" />
                      {getTrialDaysLeft()} dias restantes no período de teste
                    </p>
                  )}
                </div>
              </div>
              <Link href="/assinatura/historico">
                <Button variant="outline" size="sm">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Histórico
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trial Banner - only show if user never had a trial */}
      {!hadTrial && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 p-6 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-primary/20 rounded-full px-4 py-1.5 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Oferta Especial</span>
            </div>
            <h2 className="text-2xl font-bold mb-1">7 Dias Grátis para Testar</h2>
            <p className="text-muted-foreground">
              Teste todas as funcionalidades sem compromisso. Cancele quando quiser.
            </p>
          </div>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isCurrentPlan = subscription?.plan_id === plan.id && 
            ["active", "authorized", "trial"].includes(subscription?.status || "");
          
          return (
            <Card
              key={plan.id}
              className={cn(
                "relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/5",
                plan.recommended ? "border-orange-500/50 shadow-lg shadow-orange-500/10 scale-[1.02]" : "border-border",
                isCurrentPlan && "ring-2 ring-primary"
              )}
            >
              {/* Recommended Badge */}
              {plan.recommended && (
                <div className="absolute top-0 right-0">
                  <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl">
                    RECOMENDADO
                  </div>
                </div>
              )}

              <CardHeader className="pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn("p-2.5 rounded-xl bg-gradient-to-br", plan.color)}>
                    <plan.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                  </div>
                </div>
                <CardDescription className="text-sm">{plan.description}</CardDescription>

                {/* Price */}
                <div className="pt-4">
                  <div className="flex items-baseline gap-1">
                    {plan.period === "12x" ? (
                      <>
                        <span className="text-sm text-muted-foreground">12x</span>
                        <span className="text-sm text-muted-foreground">R$</span>
                        <span className="text-4xl font-bold">{plan.price}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm text-muted-foreground">R$</span>
                        <span className="text-4xl font-bold">{plan.price}</span>
                        <span className="text-muted-foreground">{plan.period}</span>
                      </>
                    )}
                    {plan.oldPrice && (
                      <span className="text-lg text-muted-foreground line-through ml-2">
                        R${plan.oldPrice}
                      </span>
                    )}
                  </div>
                  {!hadTrial && plan.id !== "black" && (
                    <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      7 dias grátis inclusos
                    </p>
                  )}
                  {plan.id === "black" && (
                    <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Parcele em até 12x no cartão
                    </p>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Features */}
                <div className="space-y-2.5">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className={cn("p-1 rounded-md shrink-0", plan.bgColor)}>
                        <feature.icon className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm">{feature.text}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <div className="pt-4">
                  {isCurrentPlan ? (
                    <Button className="w-full" disabled>
                      <Check className="h-4 w-4 mr-2" />
                      Plano Atual
                    </Button>
                  ) : (
                    <Button
                      className={cn(
                        "w-full group",
                        plan.recommended
                          ? "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                          : ""
                      )}
                      onClick={() => (isAlterarMode && subscription && subscription.status !== "cancelled") ? handleChangePlan(plan) : handleSelectPlan(plan)}
                      disabled={!!selectingPlan}
                    >
                      {selectingPlan === plan.id ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando...</>
                      ) : (
                        <>{(hadTrial || plan.id === "black") ? "Assinar Agora" : "Começar Teste Grátis"}<ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" /></>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* FAQ / Info */}
      <div className="grid md:grid-cols-3 gap-4 pt-4">
        <Card className="bg-muted/30 border-border/50">
          <CardContent className="p-4 text-center">
            <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-green-400" />
            <p className="font-medium text-sm">Pagamento Seguro</p>
            <p className="text-xs text-muted-foreground mt-1">Processado pelo Mercado Pago</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30 border-border/50">
          <CardContent className="p-4 text-center">
            <Clock className="h-8 w-8 mx-auto mb-2 text-blue-400" />
            <p className="font-medium text-sm">{hadTrial ? "Ativação Imediata" : "7 Dias Grátis"}</p>
            <p className="text-xs text-muted-foreground mt-1">{hadTrial ? "Acesso imediato ao assinar" : "Cancele a qualquer momento"}</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30 border-border/50">
          <CardContent className="p-4 text-center">
            <CreditCard className="h-8 w-8 mx-auto mb-2 text-purple-400" />
            <p className="font-medium text-sm">Sem Fidelidade</p>
            <p className="text-xs text-muted-foreground mt-1">Cancele quando quiser sem multa</p>
          </CardContent>
        </Card>
      </div>

      {/* Link to payment history */}
      {subscription && (
        <div className="text-center pb-4">
          <Link href="/assinatura/historico" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Ver histórico completo de pagamentos →
          </Link>
        </div>
      )}
    </div>
  );
}
