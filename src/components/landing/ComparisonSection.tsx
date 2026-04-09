import { CheckCircle2, XCircle } from "lucide-react";

const comparisons = [
  {
    title: "O lead entra, mas o contexto nao acompanha.",
    broken: "Formulario em um lugar. Atendimento em outro. Quem pega o lead precisa descobrir tudo do zero.",
    connected:
      "O lead entra dentro do fluxo da operacao, com mais contexto para o time agir rapido e melhor.",
  },
  {
    title: "O comercial trabalha, mas o processo nao sustenta.",
    broken:
      "Conversas travam, follow-ups se perdem e o time precisa improvisar toda vez que o volume aumenta.",
    connected:
      "Etapas, contatos, mensagens e acompanhamento ficam organizados em um so lugar para vender com mais previsibilidade.",
  },
  {
    title: "Depois da venda, o relacionamento se quebra.",
    broken:
      "Grupos, mensagens, historico e continuidade ficam espalhados, e o cliente sai do radar da operacao.",
    connected:
      "O relacionamento continua conectado para sustentar acompanhamento, engajamento e novas oportunidades.",
  },
];

export default function ComparisonSection() {
  return (
    <section className="px-4 py-24 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <div className="tag-mono mb-4 inline-block">Por que trava</div>
          <h2 className="text-3xl font-bold text-foreground md:text-5xl">
            Por que ferramentas soltas quebram sua operacao.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
            O problema nao e ter varias ferramentas. E depender delas sem continuidade entre uma etapa e outra.
          </p>
        </div>

        <div className="space-y-5">
          {comparisons.map((item) => (
            <div key={item.title} className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
              <div className="card-lux p-6">
                <p className="mb-4 text-lg font-semibold text-white">{item.title}</p>
                <div className="rounded-[22px] border border-white/[0.08] bg-black/[0.15] p-5">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs font-medium text-red-200">
                    <XCircle className="h-3.5 w-3.5" />
                    Ferramentas soltas
                  </div>
                  <p className="text-sm leading-relaxed text-slate-300">{item.broken}</p>
                </div>
              </div>

              <div className="card-lux gradient-hotmart p-6">
                <div className="rounded-[22px] border border-cyan-400/20 bg-[#07101D]/80 p-5">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Com Flow Up
                  </div>
                  <p className="text-sm leading-relaxed text-slate-200">{item.connected}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-3xl text-center">
          <p className="text-lg font-medium text-slate-100">
            Menos remendo entre ferramentas. Mais controle sobre uma operacao que precisa funcionar do
            primeiro lead ao pos-venda.
          </p>
        </div>
      </div>
    </section>
  );
}
