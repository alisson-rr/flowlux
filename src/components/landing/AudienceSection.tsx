"use client";

import { Target, Users, Phone, Headphones, Package, ShoppingBag } from "lucide-react";

const audiences = [
  { icon: Target, label: "Infoprodutores" },
  { icon: Users, label: "Equipes comerciais" },
  { icon: Phone, label: "Closers" },
  { icon: Headphones, label: "Atendimento de suporte" },
  { icon: Package, label: "Operações com múltiplos produtos" },
  { icon: ShoppingBag, label: "Estratégias com Hotmart" },
];

const AudienceSection = () => {
  return (
    <section className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="tag-mono mb-4 inline-block">Para quem é</div>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4" style={{ textWrap: "balance" } as React.CSSProperties}>
          Feito para quem vende no digital e precisa de velocidade
        </h2>
        <p className="text-muted-foreground text-lg max-w-3xl mb-12 leading-relaxed">
          Se você trabalha com lançamentos, perpétuo, remarketing, recuperação, atendimento comercial ou suporte via WhatsApp, o FlowLux te ajuda a colocar ordem e automação nessa operação.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {audiences.map((a) => (
            <div key={a.label} className="card-lux-hover p-5 flex items-center gap-3">
              <a.icon className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="text-sm font-semibold text-foreground">{a.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AudienceSection;
