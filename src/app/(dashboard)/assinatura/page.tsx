"use client";

import React, { useEffect, useState } from "react";
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

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "97",
    priceNum: 97,
    period: "/mês",
    description: "Ideal para quem está começando a organizar seus leads e atendimento.",
    icon: Zap,
    color: "from-blue-500 to-cyan-500",
    borderColor: "border-blue-500/30",
    bgColor: "bg-blue-500/10",
    popular: false,
    link: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=2a69ac12835b4077bbf7279faa7d61c6",
    features: [
      { text: "CRM completo com funil Kanban", icon: Kanban },
      { text: "Até 500 leads", icon: Users },
      { text: "1 número WhatsApp", icon: MessageSquare },
      { text: "Chat em tempo real", icon: MessageSquare },
      { text: "Disparo em massa (até 500/mês)", icon: Send },
      { text: "Mensagens agendadas", icon: Clock },
      { text: "Dashboard com métricas", icon: BarChart3 },
      { text: "Integração Hotmart", icon: ShieldCheck },
    ],
  },
  {
    id: "professional",
    name: "Professional",
    price: "197",
    priceNum: 197,
    period: "/mês",
    description: "Para profissionais que precisam de automação avançada e escala.",
    icon: Crown,
    color: "from-purple-500 to-pink-500",
    borderColor: "border-primary/30",
    bgColor: "bg-primary/10",
    popular: true,
    link: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=2a69ac12835b4077bbf7279faa7d61c61111111",
    features: [
      { text: "Tudo do plano Starter", icon: Check },
      { text: "Leads ilimitados", icon: Users },
      { text: "Até 3 números WhatsApp", icon: MessageSquare },
      { text: "Disparos ilimitados", icon: Send },
      { text: "Automações avançadas com IA", icon: Bot },
      { text: "Área de membros", icon: Star },
      { text: "Gestão de mídias", icon: Sparkles },
      { text: "Suporte prioritário", icon: ShieldCheck },
    ],
  },
];

export default function AssinaturaPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        const { data } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", userData.user.id)
          .in("status", ["active", "authorized", "trial", "pending"])
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (data) setSubscription(data);
      } catch {
        // No subscription found
      } finally {
        setLoading(false);
      }
    };
    loadSubscription();
  }, []);

  const handleSelectPlan = async (plan: typeof PLANS[0]) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast("Faça login para assinar.", "error");
        return;
      }

      // Create pending subscription
      await supabase.from("subscriptions").insert({
        user_id: userData.user.id,
        plan_id: plan.id,
        status: "pending",
        trial_start: new Date().toISOString().split("T")[0],
        trial_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      });

      // Redirect to Mercado Pago
      window.open(plan.link, "_blank");
    } catch (err) {
      console.error("Error selecting plan:", err);
      toast("Erro ao selecionar plano.", "error");
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "success" | "outline" | "destructive" }> = {
      active: { label: "Ativo", variant: "success" },
      authorized: { label: "Autorizado", variant: "success" },
      trial: { label: "Período de Teste", variant: "outline" },
      pending: { label: "Pendente", variant: "outline" },
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
        <h1 className="text-3xl font-bold">Escolha seu Plano</h1>
        <p className="text-muted-foreground text-lg">
          Comece com <span className="text-primary font-semibold">7 dias grátis</span> e escale seu negócio
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
                      Plano {subscription.plan_id === "professional" ? "Professional" : "Starter"}
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

      {/* Trial Banner */}
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

      {/* Plans Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {PLANS.map((plan) => {
          const isCurrentPlan = subscription?.plan_id === plan.id && 
            ["active", "authorized", "trial"].includes(subscription?.status || "");
          
          return (
            <Card
              key={plan.id}
              className={cn(
                "relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/5",
                plan.popular ? "border-primary/50 shadow-lg shadow-primary/10" : "border-border",
                isCurrentPlan && "ring-2 ring-primary"
              )}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute top-0 right-0">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl">
                    MAIS POPULAR
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
                    <span className="text-sm text-muted-foreground">R$</span>
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    7 dias grátis inclusos
                  </p>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Features */}
                <div className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className={cn("p-1 rounded-md", plan.bgColor)}>
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
                        plan.popular
                          ? "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                          : ""
                      )}
                      onClick={() => handleSelectPlan(plan)}
                    >
                      Começar Teste Grátis
                      <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
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
            <p className="font-medium text-sm">7 Dias Grátis</p>
            <p className="text-xs text-muted-foreground mt-1">Cancele a qualquer momento</p>
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
