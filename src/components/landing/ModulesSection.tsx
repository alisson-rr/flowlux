import { BarChart3, Bot, MessageSquareText, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import VideoMockup from "@/components/landing/VideoMockup";

const modules = [
  {
    icon: Sparkles,
    title: "Capte com mais contexto desde a entrada.",
    text: "Traga novos leads para dentro da operacao com formularios, popup e entradas organizadas para o time agir mais rapido.",
    resources: ["Formularios estilo Typeform", "Popup de captura para LP", "Entrada centralizada de leads"],
    video: [
      "mostrar o formulario ou popup em acao",
      "mostrar o lead entrando na operacao",
      "mostrar o ponto de transicao para o CRM",
    ],
  },
  {
    icon: MessageSquareText,
    title: "Organize atendimento e vendas em um so fluxo.",
    text: "Visualize contatos, etapas e oportunidades em uma operacao comercial que nao depende de memoria, planilha ou improviso.",
    resources: ["CRM integrado", "Kanban de leads", "Atendimento por WhatsApp", "Organizacao por etapas e contexto"],
    video: [
      "mostrar CRM ou kanban com leads reais",
      "mostrar tags, notas ou etapa comercial",
      "mostrar uma conversa conectada ao lead",
    ],
  },
  {
    icon: Bot,
    title: "Automatize sem perder controle da jornada.",
    text: "Acione processos, gatilhos e disparos com mais consistencia para ganhar velocidade sem quebrar a experiencia do lead.",
    resources: ["Automacoes de mensagens", "Gatilhos no WhatsApp", "Disparos segmentados em massa", "Fluxos automatizados"],
    video: [
      "mostrar o fluxo sendo configurado",
      "mostrar um gatilho ou disparo sendo acionado",
      "mostrar que existe controle do processo",
    ],
  },
  {
    icon: BarChart3,
    title: "Mantenha o relacionamento ativo antes e depois da venda.",
    text: "Continue a jornada do lead e do cliente com grupos, acompanhamento, midias e integracoes que deixam a operacao viva.",
    resources: ["Gestao de grupos no WhatsApp", "Upload de midias", "Integracao com Hotmart", "Continuidade de relacionamento"],
    video: [
      "mostrar grupo, midia ou integracao em uso",
      "mostrar acompanhamento pos-venda ou reengajamento",
      "mostrar que o lead continua dentro da operacao",
    ],
  },
];

export default function ModulesSection() {
  return (
    <section id="modulos" className="px-4 py-24 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <div className="tag-mono mb-4 inline-block">O que existe dentro</div>
          <h2 className="text-3xl font-bold text-foreground md:text-5xl">
            Tudo o que sua operacao precisa para captar, vender e se relacionar melhor.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
            Do primeiro lead ao acompanhamento continuo, o Flow Up conecta os modulos que sustentam
            marketing, vendas e relacionamento em uma operacao mais organizada.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {modules.map((module) => (
            <article key={module.title} className="card-lux card-lux-hover p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
                  <module.icon className="h-5 w-5 text-cyan-300" />
                </div>
                <h3 className="text-xl font-semibold text-white">{module.title}</h3>
              </div>

              <p className="mb-5 text-sm leading-relaxed text-muted-foreground">{module.text}</p>

              {/* TODO: Gravar um video curto deste modulo seguindo o checklist abaixo e trocar este placeholder depois. */}
              <VideoMockup
                compact
                label="Mockup de video"
                title="O que o video precisa mostrar"
                description="Use esta area como placeholder ate a gravacao final do modulo."
                checklist={module.video}
                className="mb-5"
              />

              <ul className="space-y-2">
                {module.resources.map((resource) => (
                  <li key={resource} className="flex items-start gap-2 text-sm text-slate-200">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-300" />
                    <span>{resource}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-muted-foreground">
            Nao e sobre juntar recursos soltos. E sobre ter uma operacao que conecta captacao, vendas,
            automacao e relacionamento em um unico sistema.
          </p>
          <Link href="/login" className="mt-5 inline-flex">
            <Button variant="hero" size="lg" className="landing-button-primary text-white">
              Testar gratis por 7 dias
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
