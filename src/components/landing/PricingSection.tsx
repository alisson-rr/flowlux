"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, Crown, Rocket, Sparkles, Zap } from "lucide-react";

const plans = [
  {
    name: "Starter",
    badge: "Para organizar sua base",
    price: "R$59",
    description:
      "Para o infoprodutor que quer sair da gambiarra e centralizar captacao, atendimento e follow-up em um so lugar.",
    limits: ["500 leads", "1 numero de WhatsApp", "500 disparos por mes", "5 GB de armazenamento"],
    bullets: ["Chat + CRM + funil", "Formularios e popup de captura", "Tags, notas e templates", "Biblioteca de midias", "Integracao Hotmart"],
    cta: "Testar gratis por 7 dias",
    icon: Zap,
    featured: false,
  },
  {
    name: "Pro",
    badge: "Mais escolhido",
    price: "R$99",
    description:
      "Para quem ja validou a operacao e quer automatizar etapas, ganhar escala e operar com mais controle.",
    limits: ["5.000 leads", "3 numeros de WhatsApp", "5.000 disparos por mes", "10 GB de armazenamento"],
    bullets: ["Tudo do Starter", "Mais volume para crescer com previsibilidade", "Operacao com mais de um numero", "Automacoes e disparos em escala", "Gestao de grupos e continuidade de relacionamento"],
    cta: "Testar gratis por 7 dias",
    icon: Sparkles,
    featured: true,
  },
  {
    name: "Black",
    badge: "Operacao avancada",
    price: "R$149",
    description:
      "Para operacoes mais maduras que precisam de mais volume, prioridade e acesso a camadas premium do produto.",
    limits: ["Leads ilimitados", "5 numeros de WhatsApp", "15.000 disparos por mes", "20 GB de armazenamento"],
    bullets: ["Tudo do Pro", "Suporte prioritario", "Mais estrutura para time e operacao", "Faixa premium de escala", "Acesso antecipado a IA e expansoes"],
    cta: "Comecar no Black",
    icon: Crown,
    featured: false,
  },
];

export default function PricingSection() {
  return (
    <section id="planos" className="px-4 py-24 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <div className="tag-mono mb-4 inline-block">Planos</div>
          <h2 className="mx-auto max-w-3xl text-3xl font-bold text-foreground md:text-5xl">
            Escolha o plano ideal para o momento da sua operacao.
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Comece com 7 dias gratis e evolua sua operacao de captacao, vendas e relacionamento sem
            trocar de ferramenta depois.
          </p>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`card-lux relative flex h-full flex-col p-6 ${plan.featured ? "ring-1 ring-cyan-400/35 shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_26px_90px_-36px_rgba(34,211,238,0.35)]" : ""}`}
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div
                    className={`mb-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      plan.featured
                        ? "border border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
                        : "border border-white/10 bg-white/[0.03] text-slate-200"
                    }`}
                  >
                    {plan.badge}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
                      <plan.icon className={`h-5 w-5 ${plan.featured ? "text-cyan-300" : "text-white"}`} />
                    </div>
                    <h3 className="text-2xl font-semibold text-white">{plan.name}</h3>
                  </div>
                </div>
                {plan.featured && (
                  <div className="rounded-full bg-gradient-to-r from-[#22D3EE] to-[#2DD4BF] px-3 py-1 text-xs font-bold text-[#05070D]">
                    Pro
                  </div>
                )}
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">{plan.description}</p>

              <div className="mt-6 border-y border-white/[0.08] py-6">
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold tracking-tight text-white">{plan.price}</span>
                  <span className="pb-1 text-sm text-slate-300">/mes</span>
                </div>
                <p className="mt-2 text-sm text-cyan-100/80">7 dias gratis para testar</p>
              </div>

              <div className="mt-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Limites deste plano
                </p>
                <ul className="space-y-2 text-sm text-slate-200">
                  {plan.limits.map((limit) => (
                    <li key={limit} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                      <span>{limit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  O que voce leva
                </p>
                <ul className="space-y-2 text-sm text-slate-200">
                  {plan.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8">
                <Link href="/login">
                  <Button
                    variant="hero"
                    size="lg"
                    className={`w-full text-white ${plan.featured ? "landing-button-primary" : "landing-button-secondary border border-white/10 bg-white/[0.03]"}`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">7 dias gratis para testar</span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">Sem fidelidade</span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">Evolua de plano conforme sua operacao cresce</span>
        </div>
      </div>
    </section>
  );
}
