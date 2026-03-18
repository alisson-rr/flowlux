"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  CreditCard,
  Loader2,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Receipt,
  Crown,
  Calendar,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Payment {
  id: string;
  mp_payment_id: string | null;
  status: string;
  amount: number | null;
  currency: string;
  payment_method: string | null;
  description: string | null;
  paid_at: string | null;
  created_at: string;
}

interface Subscription {
  id: string;
  plan_id: string;
  status: string;
  trial_start: string | null;
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export default function HistoricoPagamentosPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        const [subRes, payRes] = await Promise.all([
          supabase
            .from("subscriptions")
            .select("*")
            .eq("user_id", userData.user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single(),
          supabase
            .from("subscription_payments")
            .select("*")
            .eq("user_id", userData.user.id)
            .order("created_at", { ascending: false }),
        ]);

        if (subRes.data) setSubscription(subRes.data);
        if (payRes.data) setPayments(payRes.data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "—";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
  };

  const getStatusInfo = (status: string) => {
    const map: Record<string, { label: string; variant: "success" | "outline" | "destructive"; icon: typeof CheckCircle }> = {
      approved: { label: "Aprovado", variant: "success", icon: CheckCircle },
      pending: { label: "Pendente", variant: "outline", icon: Clock },
      in_process: { label: "Processando", variant: "outline", icon: RefreshCw },
      rejected: { label: "Rejeitado", variant: "destructive", icon: XCircle },
      refunded: { label: "Reembolsado", variant: "outline", icon: RefreshCw },
      cancelled: { label: "Cancelado", variant: "destructive", icon: XCircle },
    };
    return map[status] || { label: status, variant: "outline" as const, icon: AlertCircle };
  };

  const getSubscriptionStatusInfo = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      active: { label: "Ativa", color: "text-green-400" },
      authorized: { label: "Autorizada", color: "text-green-400" },
      trial: { label: "Período de Teste", color: "text-blue-400" },
      pending: { label: "Pendente", color: "text-yellow-400" },
      paused: { label: "Pausada", color: "text-yellow-400" },
      cancelled: { label: "Cancelada", color: "text-red-400" },
    };
    return map[status] || { label: status, color: "text-muted-foreground" };
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
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/assinatura">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Histórico de Pagamentos</h1>
            <p className="text-muted-foreground">Acompanhe seus pagamentos e assinatura</p>
          </div>
        </div>
      </div>

      {/* Subscription Summary */}
      {subscription && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Crown className="h-5 w-5 text-primary" />
              Assinatura Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Plano</p>
                <p className="font-semibold">
                  {subscription.plan_id === "professional" ? "Professional" : "Starter"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                <p className={cn("font-semibold", getSubscriptionStatusInfo(subscription.status).color)}>
                  {getSubscriptionStatusInfo(subscription.status).label}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Desde</p>
                <p className="font-semibold">{formatDate(subscription.created_at)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  {subscription.status === "trial" ? "Teste até" : "Próxima cobrança"}
                </p>
                <p className="font-semibold">
                  {subscription.trial_end && getTrialDaysLeft() > 0
                    ? `${formatDate(subscription.trial_end)} (${getTrialDaysLeft()} dias)`
                    : subscription.current_period_end
                    ? formatDate(subscription.current_period_end)
                    : "—"}
                </p>
              </div>
            </div>

            {subscription.cancelled_at && (
              <div className="mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Assinatura cancelada em {formatDate(subscription.cancelled_at)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payments List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5" />
            Pagamentos
          </CardTitle>
          <CardDescription>
            {payments.length > 0
              ? `${payments.length} pagamento${payments.length > 1 ? "s" : ""} encontrado${payments.length > 1 ? "s" : ""}`
              : "Nenhum pagamento registrado ainda"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum pagamento encontrado</p>
              <p className="text-sm mt-1">
                Os pagamentos aparecerão aqui após o período de teste
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => {
                const statusInfo = getStatusInfo(payment.status);
                const StatusIcon = statusInfo.icon;
                return (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/20 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "p-2.5 rounded-lg",
                          payment.status === "approved"
                            ? "bg-green-500/20 text-green-400"
                            : payment.status === "rejected" || payment.status === "cancelled"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <StatusIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {payment.description || "Pagamento de assinatura"}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDateTime(payment.paid_at || payment.created_at)}
                          </span>
                          {payment.payment_method && (
                            <span className="text-xs text-muted-foreground">
                              {payment.payment_method}
                            </span>
                          )}
                          {payment.mp_payment_id && (
                            <span className="text-xs text-muted-foreground">
                              ID: {payment.mp_payment_id}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={statusInfo.variant} className="text-[10px]">
                        {statusInfo.label}
                      </Badge>
                      <span
                        className={cn(
                          "font-semibold text-sm",
                          payment.status === "approved"
                            ? "text-green-400"
                            : "text-muted-foreground"
                        )}
                      >
                        {formatCurrency(payment.amount)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Back link */}
      <div className="text-center pb-4">
        <Link href="/assinatura" className="text-sm text-muted-foreground hover:text-primary transition-colors">
          ← Voltar para planos
        </Link>
      </div>
    </div>
  );
}
