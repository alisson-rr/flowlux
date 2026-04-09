import { MessagesSquare, RouteOff, Rows3 } from "lucide-react";

const painItems = [
  {
    icon: RouteOff,
    title: "Captacao sem contexto",
    text: "Os leads entram, mas chegam sem historico, sem organizacao e sem uma proxima acao clara para o time.",
  },
  {
    icon: Rows3,
    title: "Vendas sem processo",
    text: "As conversas avancam no improviso, os follow-ups se perdem e a operacao depende mais de memoria do que de metodo.",
  },
  {
    icon: MessagesSquare,
    title: "Relacionamento sem continuidade",
    text: "Depois da venda, o contato esfria porque grupos, mensagens, historico e acompanhamento ficam espalhados.",
  },
];

export default function PainSection() {
  return (
    <section className="px-4 py-24 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <div className="tag-mono mb-4 inline-block">Onde a operacao quebra</div>
          <h2 className="text-3xl font-bold text-foreground md:text-5xl">
            A operacao do infoprodutor nao cabe em ferramentas soltas.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
            Quando cada etapa vive em um lugar diferente, o lead perde contexto, o time perde
            velocidade e a venda perde continuidade.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {painItems.map((item) => (
            <article key={item.title} className="card-lux p-6">
              <div className="mb-5 inline-flex rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <item.icon className="h-5 w-5 text-slate-100" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-white">{item.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{item.text}</p>
            </article>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-3xl text-center text-lg text-slate-200">
          Com o Flow Up, sua operacao fica conectada do primeiro lead ao relacionamento continuo.
        </p>
      </div>
    </section>
  );
}
