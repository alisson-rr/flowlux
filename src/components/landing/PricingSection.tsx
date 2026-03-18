"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, Zap, Star, Crown } from "lucide-react";

const plans = [
  {
    name: "Starter",
    icon: Zap,
    price: "R$89",
    period: "/mês",
    desc: "Pra quem quer começar a organizar os leads e responder mais rápido.",
    features: [
      "1 número WhatsApp",
      "Até 500 leads",
      "Chat + CRM",
      "Tags + notas",
      "Gatilhos de mensagens",
      "5GB de mídias",
      "Mensagens prontas",
      "Fluxos de mensagens",
      "Disparo limitado de 500/mês",
      "Integração Hotmart",
    ],
    cta: "Quero começar",
    badge: null,
    featured: false,
    gradient: false,
  },
  {
    name: "Pro",
    icon: Star,
    price: "R$129",
    period: "/mês",
    desc: "Pra quem quer automatizar o atendimento e ganhar escala.",
    features: [
      "3 números de WhatsApp",
      "Leads ilimitados",
      "Chat + CRM",
      "Tags + notas",
      "Gatilhos de mensagens",
      "15GB de mídias",
      "Mensagens prontas",
      "Fluxos de mensagens ilimitados",
      "Disparo em massa até 5.000/mês",
      "Integração Hotmart",
    ],
    cta: "Quero o Pro",
    badge: "Mais escolhido",
    featured: true,
    gradient: false,
  },
  {
    name: "FlowLux Black",
    icon: Crown,
    price: "12x R$99",
    period: "",
    desc: "Pra quem quer crescer com mais estrutura, prioridade e vantagens exclusivas.",
    features: [
      "5 números de WhatsApp",
      "Leads ilimitados",
      "Chat + CRM",
      "Tags + notas",
      "Gatilhos de mensagens",
      "30GB de mídias",
      "Mensagens prontas",
      "Fluxos de mensagens ilimitados",
      "Disparo em massa até 10.000/mês",
      "Integração Hotmart",
      "Suporte prioritário",
      "Comunidade",
      "Acesso antecipado a IA personalizada",
    ],
    cta: "Quero o Black",
    badge: "Recomendado",
    featured: false,
    gradient: true,
  },
];

const PricingSection = () => {
  return (
    <section className="py-24 px-4" id="planos">
      <div className="max-w-6xl mx-auto">
        {/* Trial banner */}
        <div className="text-center mb-16">
          <div className="inline-block rounded-2xl px-8 py-6 mb-8" style={{ background: "linear-gradient(135deg, hsla(25, 95%, 53%, 0.15), hsla(265, 84%, 60%, 0.15))" }}>
            <span className="tag-mono bg-primary/20 text-primary mb-3 inline-block">Oferta Especial</span>
            <h3 className="text-2xl font-bold text-foreground mb-1">7 Dias Grátis para Testar</h3>
            <p className="text-sm text-muted-foreground">Teste todas as funcionalidades sem compromisso. Cancele quando quiser.</p>
          </div>
        </div>

        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-12 text-center" style={{ textWrap: "balance" } as React.CSSProperties}>
          Escolha o plano ideal para o momento da sua operação
        </h2>

        <div className="grid md:grid-cols-3 gap-4 items-start">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-[24px] p-[1px] ${plan.featured ? "scale-105 z-10" : ""} ${plan.gradient ? "gradient-mesh-black" : ""}`}
              style={plan.featured ? { background: "linear-gradient(135deg, hsl(265, 84%, 60%), hsl(25, 95%, 53%))" } : plan.gradient ? {} : undefined}
            >
              {plan.badge && (
                <div className={`absolute -top-3 right-4 px-3 py-1 rounded-full text-xs font-bold z-20 ${plan.featured ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                  {plan.badge}
                </div>
              )}
              <div className={`card-lux h-full flex flex-col ${plan.gradient ? "gradient-mesh-black" : ""}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${plan.featured ? "bg-primary/20" : plan.gradient ? "bg-secondary/20" : "bg-muted"}`}>
                    <plan.icon className={`w-5 h-5 ${plan.featured ? "text-primary" : plan.gradient ? "text-secondary" : "text-primary"}`} />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                </div>

                <p className="text-sm text-muted-foreground mb-4">{plan.desc}</p>

                <div className="mb-6">
                  <span className="text-3xl font-bold text-foreground font-mono tabular-nums">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>

                <ul className="space-y-2 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href="/login">
                  <Button variant={plan.featured ? "hero" : "heroOutline"} size="lg" className="w-full">
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Melhor custo-benefício para quem quer crescer sem trocar de ferramenta depois.
        </p>
      </div>
    </section>
  );
};

export default PricingSection;
