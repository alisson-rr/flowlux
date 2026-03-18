"use client";

import { CheckCircle2 } from "lucide-react";

const SolutionSection = () => {
  return (
    <section className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="tag-mono mb-4 inline-block">Solução</div>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6" style={{ textWrap: "balance" } as React.CSSProperties}>
          Tudo o que você precisa para vender no WhatsApp com mais controle e menos esforço
        </h2>
        <p className="text-muted-foreground text-lg max-w-3xl mb-8 leading-relaxed">
          O FlowLux foi criado para centralizar sua operação comercial em um lugar só. Você consegue conversar com leads, organizar contatos, automatizar mensagens, disparar campanhas, acompanhar etapas do funil e integrar eventos da Hotmart sem depender de gambiarra, planilha ou atendimento manual pra tudo.
        </p>
        <div className="flex items-center gap-3 card-lux p-4 w-fit">
          <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
          <p className="text-foreground font-semibold">
            Resultado: mais velocidade, mais organização e mais chance de venda.
          </p>
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;
