"use client";

import { Zap, FolderKanban, Bot, TrendingUp, LayoutDashboard, Shield } from "lucide-react";

const benefits = [
  {
    icon: Zap,
    title: "Você responde mais rápido",
    text: "Tenha mensagens prontas, fluxos automáticos e tudo acessível na mesma tela do chat.",
  },
  {
    icon: FolderKanban,
    title: "Você se organiza de verdade",
    text: "Use CRM com funis, tags, notas e etapas personalizadas para não perder o controle dos leads.",
  },
  {
    icon: Bot,
    title: "Você automatiza partes do processo",
    text: "Crie gatilhos por palavras, sequências de mensagens e ações automáticas para reduzir trabalho manual.",
  },
  {
    icon: TrendingUp,
    title: "Você vende com mais consistência",
    text: "Acompanhe cada lead com mais clareza e mantenha o processo comercial rodando com menos falhas.",
  },
  {
    icon: LayoutDashboard,
    title: "Você centraliza a operação",
    text: "Chat, disparos, mídias, funis, automações e integração com Hotmart no mesmo sistema.",
  },
  {
    icon: Shield,
    title: "Você escala com mais segurança",
    text: "Use múltiplos números, segmente envios e mantenha sua operação mais organizada conforme cresce.",
  },
];

const BenefitsSection = () => {
  return (
    <section className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="tag-mono mb-4 inline-block">Benefícios</div>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-12" style={{ textWrap: "balance" } as React.CSSProperties}>
          O que muda na prática quando você usa o FlowLux
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {benefits.map((b) => (
            <div key={b.title} className="card-lux-hover p-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <b.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{b.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{b.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
