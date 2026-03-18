"use client";

import { AlertTriangle, Clock, MessageSquareOff, ShieldX } from "lucide-react";

const painItems = [
  { icon: MessageSquareOff, text: "Leads sem resposta" },
  { icon: Clock, text: "Mensagens repetidas o dia inteiro" },
  { icon: ShieldX, text: "Conversas perdidas" },
  { icon: AlertTriangle, text: "Falta de organização" },
  { icon: Clock, text: "Demora no retorno" },
  { icon: ShieldX, text: "Pouca automação" },
];

const PainSection = () => {
  return (
    <section className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-center" style={{ textWrap: "balance" } as React.CSSProperties}>
          Seu WhatsApp virou ferramenta de vendas ou virou <span className="text-destructive">bagunça</span>?
        </h2>
        <p className="text-muted-foreground text-center text-lg mb-12 max-w-2xl mx-auto">
          Quando o atendimento cresce, começam os problemas.
        </p>

        <div className="grid md:grid-cols-3 gap-4 mb-12">
          {painItems.map((item) => (
            <div
              key={item.text}
              className="card-lux p-5 opacity-60 grayscale hover:opacity-80 hover:grayscale-0 transition-all duration-200"
            >
              <item.icon className="w-5 h-5 text-destructive mb-3" />
              <p className="font-mono text-sm text-destructive/80">{item.text}</p>
            </div>
          ))}
        </div>

        <div className="text-center space-y-2 max-w-xl mx-auto">
          <p className="text-muted-foreground">
            O problema não é falta de lead.
          </p>
          <p className="text-muted-foreground">
            É falta de <span className="text-foreground font-semibold">estrutura para atender, nutrir e converter melhor.</span>
          </p>
          <p className="text-primary font-bold text-xl mt-6">
            É aí que entra o FlowLux.
          </p>
        </div>
      </div>
    </section>
  );
};

export default PainSection;
