"use client";

import React from "react";
import {
  Compass,
  Brain,
  Bot,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  Rocket,
} from "lucide-react";

const features = [
  {
    icon: Compass,
    title: "Experiência Interativa",
    description:
      "Transforme conteúdos estáticos em uma experiência que envolve, conduz e gera ação.",
    color: "primary",
    items: [
      "Trilhas com caminhos diferentes por perfil",
      "Gamificação, etapas e progresso visual",
      "Ferramentas práticas dentro da área de membros",
      "Planos de ação personalizados",
      "Jornadas que se adaptam ao momento do aluno",
    ],
  },
  {
    icon: Brain,
    title: "Inteligência de Comunidade",
    description:
      "Tenha uma visão mais clara do que acontece dentro da sua comunidade e transforme conversas soltas em decisões mais estratégicas.",
    color: "cyan",
    items: [
      "Resumos automáticos com IA",
      "Análise de sentimento das conversas",
      "Identificação dos temas que mais movimentam o grupo",
      "Visão do que gera mais interação, dúvida ou atrito",
      "Mais clareza para acompanhar a saúde da comunidade",
    ],
  },
  {
    icon: Bot,
    title: "Agentes de IA Personalizados",
    description:
      "Coloque agentes inteligentes trabalhando dentro do seu produto para orientar, responder, acompanhar e gerar uma experiência muito mais avançada.",
    color: "secondary",
    items: [
      "IA treinada no seu método e no seu conteúdo",
      "Respostas personalizadas para dúvidas do aluno",
      "Apoio na execução das tarefas e próximos passos",
      "Orientação com base no perfil ou momento da jornada",
      "Suporte automatizado com mais contexto",
    ],
  },
];

const colorMap: Record<string, { bg: string; text: string; dot: string; glow: string; border: string }> = {
  primary: {
    bg: "bg-primary/10",
    text: "text-primary",
    dot: "bg-primary",
    glow: "group-hover:shadow-[0_0_40px_-10px_hsl(265,84%,60%,0.4)]",
    border: "group-hover:border-primary/30",
  },
  cyan: {
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
    dot: "bg-cyan-400",
    glow: "group-hover:shadow-[0_0_40px_-10px_hsl(190,90%,50%,0.4)]",
    border: "group-hover:border-cyan-400/30",
  },
  secondary: {
    bg: "bg-secondary/10",
    text: "text-secondary",
    dot: "bg-secondary",
    glow: "group-hover:shadow-[0_0_40px_-10px_hsl(25,95%,53%,0.4)]",
    border: "group-hover:border-secondary/30",
  },
};

export default function EvoluaPage() {
  const whatsappUrl =
    "https://wa.me/5551994408307?text=Olá! Quero explorar os upgrades para meu produto.";

  return (
    <div className="relative min-h-[calc(100vh-3rem)] flex flex-col">
      {/* Background glow orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-primary/[0.04] blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] rounded-full bg-cyan-500/[0.03] blur-3xl" />
        <div className="absolute bottom-0 -left-40 w-[500px] h-[400px] rounded-full bg-secondary/[0.03] blur-3xl" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto w-full space-y-16 py-4">
        {/* ── Hero ── */}
        <header className="text-center space-y-6 pt-8 pb-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <Rocket className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold tracking-wide text-primary uppercase">
              Expansão de produto
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight">
            Seu produto pode entregar
            <br />
            <span className="text-gradient-primary">muito mais</span> do que conteúdo
          </h1>

          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Você ainda entrega suas aulas, módulos e conteúdo estáticos.
            Adicione recursos que tornam sua entrega mais interativa, inteligente
            e personalizada, aumentando engajamento, retenção e percepção de
            valor.
          </p>
        </header>

        {/* ── Feature Cards ── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {features.map((feat, i) => {
            const c = colorMap[feat.color];
            const Icon = feat.icon;

            return (
              <div
                key={feat.title}
                className={`group card-lux-hover flex flex-col transition-all duration-300 ${c.glow} ${c.border}`}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {/* Icon badge */}
                <div
                  className={`w-12 h-12 rounded-2xl ${c.bg} flex items-center justify-center mb-5`}
                >
                  <Icon className={`h-6 w-6 ${c.text}`} />
                </div>

                {/* Title */}
                <h2 className="text-xl font-bold mb-2">{feat.title}</h2>

                {/* Description */}
                <p className="text-muted-foreground text-sm leading-relaxed mb-5">
                  {feat.description}
                </p>

                {/* Bullet items */}
                <ul className="space-y-2.5 mt-auto">
                  {feat.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <CheckCircle2
                        className={`h-4 w-4 ${c.text} shrink-0 mt-0.5 opacity-70`}
                      />
                      <span className="text-sm text-foreground/80 leading-snug">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>

        {/* ── Bottom CTA ── */}
        <section className="text-center space-y-6 pb-12">
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Esses recursos podem ser ativados como expansão do seu produto, de
            acordo com a estratégia do seu negócio.
          </p>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl text-base font-semibold text-white bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-all duration-200 shadow-lg hover:shadow-primary/25 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Sparkles className="h-5 w-5" />
            Explorar upgrades
            <ArrowUpRight className="h-4 w-4 opacity-70" />
          </a>
        </section>
      </div>
    </div>
  );
}
