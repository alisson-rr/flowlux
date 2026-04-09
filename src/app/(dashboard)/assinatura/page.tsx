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
  FolderOpen,
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
import { useAuth } from "@/contexts/auth-context";
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
  black: "Black",
};

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    badge: "Para organizar sua base",
    price: "59",
    oldPrice: "",
    priceNum: 59,
    period: "/mês",
    description: "Comece a organizar seus leads e responder mais rápido",
    icon: Zap,
    color: "from-[#2563EB] to-[#7C3AED]",
    borderColor: "border-blue-500/25",
    bgColor: "bg-blue-500/10",
    displayDescription: "Para o infoprodutor que quer sair da gambiarra e centralizar captacao, atendimento e follow-up.",
    displayFeatures: [
      { text: "500 leads", icon: Users },
      { text: "1 numero de WhatsApp", icon: MessageSquare },
      { text: "500 disparos por mes", icon: Send },
      { text: "5 GB de armazenamento", icon: HardDrive },
      { text: "Chat + CRM + funil", icon: Kanban },
      { text: "Formularios e popup de captura", icon: FileText },
      { text: "Tags, notas e templates", icon: Tag },
      { text: "Biblioteca de midias", icon: FolderOpen },
      { text: "Integracao Hotmart", icon: ShieldCheck },
    ],
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
    price: "99",
    oldPrice: "",
    priceNum: 99,
    period: "/mês",
    description: "Automatize seu atendimento e aumente suas vendas no WhatsApp",
    icon: Sparkles,
    color: "from-[#22D3EE] to-[#2DD4BF]",
    borderColor: "border-cyan-400/35",
    bgColor: "bg-cyan-400/10",
    badge: "Mais escolhido",
    displayDescription: "Para quem ja validou a operacao e quer automatizar etapas, ganhar escala e operar com mais controle.",
    displayFeatures: [
      { text: "5.000 leads", icon: Users },
      { text: "3 numeros de WhatsApp", icon: MessageSquare },
      { text: "5.000 disparos por mes", icon: Send },
      { text: "10 GB de armazenamento", icon: HardDrive },
      { text: "Tudo do Starter", icon: Check },
      { text: "Automacoes e disparos em escala", icon: Workflow },
      { text: "Gestao de grupos e continuidade", icon: UsersRound },
      { text: "Mais volume para crescer com previsibilidade", icon: BarChart3 },
    ],
    popular: true,
    recommended: true,
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
    name: "Black",
    price: "149",
    oldPrice: "",
    priceNum: 149,
    period: "/mes",
    description: "O plano definitivo para escalar seu negócio no WhatsApp",
    icon: Crown,
    color: "from-[#7C3AED] to-[#A855F7]",
    borderColor: "border-purple-400/30",
    bgColor: "bg-purple-400/10",
    badge: "Operacao avancada",
    displayDescription: "Para operacoes maduras que precisam de mais volume, prioridade e acesso a camadas premium.",
    displayFeatures: [
      { text: "Leads ilimitados", icon: Users },
      { text: "5 numeros de WhatsApp", icon: MessageSquare },
      { text: "15.000 disparos por mes", icon: Megaphone },
      { text: "20 GB de armazenamento", icon: HardDrive },
      { text: "Tudo do Pro", icon: Check },
      { text: "Suporte prioritario", icon: Rocket },
      { text: "Mais estrutura para time e operacao", icon: Crown },
      { text: "Acesso antecipado a IA e expansoes", icon: Bot },
    ],
    popular: false,
    recommended: false,
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
  const { user } = useAuth();

  useEffect(() => {
    const loadSubscription = async () => {
      try {
        if (!user) return;

        // Check if user ever had a trial
        const { data: trialHistory } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", user.id)
          .not("trial_start", "is", null)
          .limit(1);

        if (trialHistory && trialHistory.length > 0) {
          setHadTrial(true);
        }

        // Check for active subscription
        const { data } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
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
            .eq("user_id", user.id)
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
  }, [isAlterarMode, router, user]);

  const [selectingPlan, setSelectingPlan] = useState<string | null>(null);

  const handleSelectPlan = async (plan: typeof PLANS[0]) => {
    try {
      setSelectingPlan(plan.id);
      const userData = { user };
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
      const userData = { user };
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
          {isAlterarMode ? "Alterar plano" : "Escolha seu plano"}
        </h1>
        <p className="text-muted-foreground text-lg">
          {hadTrial ? (
            "Escolha o plano ideal para o momento da sua operacao"
          ) : (
            <>Comece com <span className="text-primary font-semibold">7 dias gratis</span> e veja como o Flow Up encaixa na sua rotina</>
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
            <h2 className="text-2xl font-bold mb-1">7 dias gratis para testar</h2>
            <p className="text-muted-foreground">
              Teste a operacao completa antes de decidir o melhor plano para continuar.
            </p>
          </div>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isCurrentPlan = subscription?.plan_id === plan.id && 
            ["active", "authorized", "trial"].includes(subscription?.status || "");
          const planFeatures = plan.displayFeatures || plan.features;
          const planDescription = plan.displayDescription || plan.description;
          
          return (
            <Card
              key={plan.id}
              className={cn(
                "relative overflow-hidden border-border/70 bg-card/70 transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-xl hover:shadow-primary/5",
                plan.recommended && "border-cyan-400/45 shadow-lg shadow-cyan-400/10 md:scale-[1.02]",
                isCurrentPlan && "ring-2 ring-primary"
              )}
            >
              {/* Recommended Badge */}
              {plan.recommended && (
                <div className="absolute top-0 right-0">
                  <div className="rounded-bl-xl bg-gradient-to-r from-[#22D3EE] to-[#2DD4BF] px-4 py-1.5 text-xs font-bold text-[#05070D]">
                    MAIS ESCOLHIDO
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
                    {!plan.recommended && plan.badge && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{plan.badge}</p>
                    )}
                  </div>
                </div>
                <CardDescription className="text-sm leading-relaxed">{planDescription}</CardDescription>

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
                        <span className="text-muted-foreground">/mes</span>
                      </>
                    )}
                    {plan.oldPrice && (
                      <span className="text-lg text-muted-foreground line-through ml-2">
                        R${plan.oldPrice}
                      </span>
                    )}
                  </div>
                  {!hadTrial && (
                    <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      7 dias gratis para testar
                    </p>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Features */}
                <div className="space-y-2.5">
                  {planFeatures.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className={cn("p-1 rounded-md shrink-0", plan.bgColor)}>
                        <feature.icon className="h-3.5 w-3.5 text-cyan-300" />
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
                          ? "bg-gradient-to-r from-[#22D3EE] to-[#2DD4BF] text-[#05070D] hover:brightness-105"
                          : ""
                      )}
                      onClick={() => (isAlterarMode && subscription && subscription.status !== "cancelled") ? handleChangePlan(plan) : handleSelectPlan(plan)}
                      disabled={!!selectingPlan}
                    >
                      {selectingPlan === plan.id ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando...</>
                      ) : (
                        <>{hadTrial ? "Assinar agora" : "Comecar teste gratis"}<ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" /></>
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
