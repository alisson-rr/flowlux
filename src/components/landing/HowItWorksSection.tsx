import { ArrowRight, Bot, Kanban, MessageSquareText, Orbit } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const steps = [
  {
    number: "01",
    title: "Capture leads sem perder contexto desde a entrada.",
    description:
      "Use formularios, popup e entradas integradas para trazer novos leads para dentro da operacao ja com mais visibilidade para agir rapido.",
    icon: Orbit,
    recordingNotes: [
      "mostrar o formulario ou popup recebendo um novo lead",
      "mostrar os dados essenciais chegando organizados",
      "mostrar a passagem imediata desse lead para a operacao",
    ],
  },
  {
    number: "02",
    title: "Organize contatos, etapas e conversas em um so lugar.",
    description:
      "Visualize sua operacao em CRM e kanban, acompanhe cada lead por etapa e pare de depender de planilha, memoria ou conversa solta.",
    icon: Kanban,
    recordingNotes: [
      "mostrar o lead dentro do CRM ou kanban",
      "mostrar etapa, tags ou notas do lead",
      "mostrar a conversa ligada ao contexto comercial",
    ],
  },
  {
    number: "03",
    title: "Automatize processos sem quebrar a experiencia do lead.",
    description:
      "Acione mensagens, gatilhos e fluxos com mais consistencia, sem transformar seu atendimento em algo frio ou desconectado da venda.",
    icon: Bot,
    recordingNotes: [
      "mostrar um fluxo ou automacao sendo configurado",
      "mostrar a automacao disparando em um contexto real",
      "mostrar que existe controle e leitura do processo",
    ],
  },
  {
    number: "04",
    title: "Continue o relacionamento antes, durante e depois da venda.",
    description:
      "Use WhatsApp, grupos, follow-up e integracoes para manter o lead e o cliente conectados ao longo da jornada.",
    icon: MessageSquareText,
    recordingNotes: [
      "mostrar grupo, follow-up ou reengajamento em andamento",
      "mostrar conteudo ou midia sendo usado no relacionamento",
      "mostrar que a jornada continua depois da venda",
    ],
  },
];

export default function HowItWorksSection() {
  return (
    <section id="como-funciona" className="px-4 py-24 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <div className="tag-mono mb-4 inline-block">Como funciona</div>
          <h2 className="text-3xl font-bold text-foreground md:text-5xl">
            Do primeiro lead ao relacionamento continuo, o Flow Up organiza a operacao inteira.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
            Em vez de remendar ferramentas e processos, voce conecta captacao, atendimento, vendas e
            relacionamento em um fluxo unico.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step) => (
            <article key={step.number} className="card-lux card-lux-hover flex h-full flex-col p-6">
              <div className="mb-6 flex items-center justify-between">
                <span className="text-sm font-semibold text-cyan-300">{step.number}</span>
                <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
                  <step.icon className="h-5 w-5 text-white" />
                </div>
              </div>

              <h3 className="mb-4 text-lg font-semibold text-white">{step.title}</h3>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">{step.description}</p>

              <div className="mt-auto rounded-2xl border border-white/10 bg-[#08111F]/80 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  O que gravar neste ponto
                </p>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  {step.recordingNotes.map((note) => (
                    <li key={note} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 text-center">
          <p className="max-w-3xl text-base text-muted-foreground">
            Tudo isso em uma operacao pensada para infoprodutores que precisam captar, vender e se
            relacionar com mais controle.
          </p>
          <Link href="/login">
            <Button variant="hero" size="lg" className="landing-button-primary text-white">
              Testar gratis por 7 dias <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
