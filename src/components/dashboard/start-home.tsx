"use client";

import React from "react";
import Link from "next/link";
import { ArrowUp, ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { DashboardActivationSignals, DashboardMetricsData } from "@/lib/use-dashboard-metrics";

type ChatRole = "assistant" | "user";

interface ChatMessage {
  role: ChatRole;
  content: string;
  created_at?: string;
}

interface Mission {
  id: string;
  title: string;
  href: string;
  complete: boolean;
}

interface StartHomeProps {
  loading: boolean;
  metrics: DashboardMetricsData;
  activationSignals: DashboardActivationSignals;
}

const NINA_SUGGESTIONS = [
  "Como começo minha operação?",
  "O que devo configurar primeiro?",
  "Como captar meus primeiros leads?",
];

function getLevel(progress: number) {
  if (progress >= 85) return "Nível 5: Operação Flow Up";
  if (progress >= 65) return "Nível 4: Automação ativa";
  if (progress >= 45) return "Nível 3: Funil rodando";
  if (progress >= 25) return "Nível 2: Captação pronta";
  return "Nível 1: Primeiros passos";
}

function getMissions(metrics: DashboardMetricsData, signals: DashboardActivationSignals): Mission[] {
  return [
    {
      id: "connect-whatsapp",
      title: "Conectar seu primeiro WhatsApp",
      href: "/configuracoes",
      complete: signals.connectedWhatsappInstances > 0,
    },
    {
      id: "capture-source",
      title: "Criar uma entrada de lead",
      href: signals.forms > signals.capturePopups ? "/formularios" : "/capturas",
      complete: signals.publishedCapturePopups > 0 || signals.publishedForms > 0,
    },
    {
      id: "first-leads",
      title: "Adicionar seus primeiros leads",
      href: "/leads",
      complete: metrics.totalLeads > 0,
    },
    {
      id: "first-funnel",
      title: "Montar um funil simples",
      href: "/funil",
      complete: metrics.stageCount >= 3,
    },
    {
      id: "message-assets",
      title: "Criar mensagens e mídias base",
      href: "/midia",
      complete: signals.messageTemplates > 0 || signals.mediaFiles > 0,
    },
    {
      id: "first-automation",
      title: "Ativar um follow-up simples",
      href: "/automacao",
      complete: signals.activeFlows > 0 || signals.massMessages > 0 || signals.scheduledMessages > 0,
    },
    {
      id: "groups",
      title: "Centralizar grupos importantes",
      href: "/grupos",
      complete: signals.groups > 0,
    },
  ];
}

export function StartHome({ loading, metrics, activationSignals }: StartHomeProps) {
  const { toast } = useToast();
  const [expanded, setExpanded] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const missions = React.useMemo(() => {
    return getMissions(metrics, activationSignals)
      .map((mission, index) => ({ ...mission, index }))
      .sort((a, b) => {
        if (a.complete !== b.complete) return a.complete ? 1 : -1;
        return a.index - b.index;
      });
  }, [activationSignals, metrics]);

  const completedCount = missions.filter((mission) => mission.complete).length;
  const progress = missions.length > 0 ? Math.round((completedCount / missions.length) * 100) : 0;
  const level = getLevel(progress);
  const nextMission = missions.find((mission) => !mission.complete) || missions[0];
  const visibleMissions = expanded ? missions : missions.slice(0, 3);

  React.useEffect(() => {
    let cancelled = false;

    async function loadNinaHistory() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const response = await fetch("/api/nina?limit=30", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!cancelled && response.ok && Array.isArray(payload.messages)) {
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        setMessages(
          payload.messages
            .map((message: ChatMessage) => ({
              role: message.role,
              content: message.content,
              created_at: message.created_at,
            }))
            .filter((message: ChatMessage) => {
              if (!message.created_at) return false;
              const createdAt = new Date(message.created_at).getTime();
              return Number.isFinite(createdAt) && createdAt >= startOfToday;
            }),
        );
      }
    }

    void loadNinaHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitMessage() {
    const content = draft.trim();
    if (!content || sending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setDraft("");
    setSending(true);

    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/nina", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
        },
        body: JSON.stringify({
          messages: nextMessages,
          context: {
            progress,
            nextMission: nextMission?.title || "",
            completedMissions: completedCount,
            totalMissions: missions.length,
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não consegui falar com a Nina agora.");

      setMessages((current) => [
        ...current,
        { role: "assistant", content: payload.message || "Me conta onde você travou que eu te ajudo." },
      ]);
    } catch (error: any) {
      toast(String(error?.message || error || "Não consegui falar com a Nina agora."), "error");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void submitMessage();
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-4xl flex-col animate-fade-in">
      <div className="rounded-2xl border border-border/70 bg-card/55 px-4 py-3">
        <div className="mb-3 flex items-center gap-3">
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">
            {level}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#2563EB] via-[#7C3AED] to-[#2DD4BF] transition-all duration-500"
              style={{ width: `${loading ? 0 : progress}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">
            {loading ? "--" : `${progress}%`}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-3">
            {visibleMissions.map((mission) => (
              <Link
                key={mission.id}
                href={mission.href}
                className={cn(
                  "flex min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                  mission.complete
                    ? "border-emerald-400/15 bg-emerald-400/5 text-muted-foreground line-through"
                    : "border-border/70 bg-background/35 text-foreground hover:border-cyan-300/30 hover:bg-background/55"
                )}
              >
                <span className="truncate">{mission.title}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
          {missions.length > 3 ? (
            <button
              type="button"
              aria-label={expanded ? "Mostrar menos missões" : "Mostrar todas as missões"}
              onClick={() => setExpanded((current) => !current)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          ) : null}
        </div>
      </div>

      <section className="flex flex-1 flex-col justify-center py-12 text-center">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Bom te ver por aqui, Alisson.
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
          Sou a Nina e estou aqui pra te ajudar um passo de cada vez.
          <br />
          Se tiver alguma dúvida é só me chamar aqui abaixo.
        </p>
      </section>

      {messages.length > 0 ? (
        <div className="mb-4 max-h-[360px] space-y-3 overflow-y-auto rounded-2xl border border-border/70 bg-card/35 p-4">
          {messages.slice(-12).map((message, index) => (
            <div key={`${message.role}-${index}`} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[82%] rounded-2xl px-4 py-3 text-left text-sm leading-relaxed",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background/70 text-foreground",
                )}
              >
                {message.content}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <form
        className="pb-6"
        onSubmit={(event) => {
          event.preventDefault();
          void submitMessage();
        }}
      >
        <div className="relative">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="O que posso fazer por você?"
            className="min-h-[112px] resize-none rounded-2xl bg-card/45 pr-14"
            disabled={loading}
          />
          <Button
            type="submit"
            size="icon"
            className="absolute bottom-3 right-3 h-9 w-9 rounded-full"
            disabled={sending || loading || !draft.trim()}
          >
            {sending ? "..." : <ArrowUp className="h-4 w-4" />}
          </Button>
        </div>

        <div className="mt-3 flex flex-col items-start gap-1.5">
          {NINA_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setDraft(suggestion)}
              className="text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
