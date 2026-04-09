"use client";

const steps = [
  "O lead entra.",
  "É identificado.",
  "É organizado no funil.",
  "Recebe tag.",
  "Pode ativar fluxo.",
  "Pode entrar em campanha.",
];

const DifferentiatorSection = () => {
  return (
    <section className="py-24 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6" style={{ textWrap: "balance" } as React.CSSProperties}>
          Não é só um chat. Não é só um CRM.{" "}
          <span className="text-gradient-primary">Não é só automação.</span>
        </h2>
        <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
          O FlowUp une atendimento, organização e ação em um único sistema. Você não precisa de uma ferramenta para conversar, outra para organizar, outra para automatizar e outra para integrar sua venda.
        </p>

        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {steps.map((step, i) => (
            <div
              key={step}
              className="card-lux px-4 py-3 flex items-center gap-2"
            >
              <span className="font-mono text-xs text-primary">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-sm text-foreground">{step}</span>
            </div>
          ))}
        </div>

        <p className="text-muted-foreground">
          E tudo isso dentro de uma estrutura <span className="text-foreground font-semibold">mais simples de operar.</span>
        </p>
      </div>
    </section>
  );
};

export default DifferentiatorSection;
