import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import VideoMockup from "@/components/landing/VideoMockup";

const heroChecklist = [
  "mostrar a entrada do lead por formulario ou popup",
  "mostrar o lead caindo no CRM ou kanban",
  "mostrar uma conversa conectada ao contexto desse lead",
  "mostrar um fluxo ou automacao dando continuidade ao processo",
];

export default function HeroSection() {
  return (
    <section id="top" className="relative overflow-hidden px-4 pb-24 pt-28 md:pb-28 md:pt-36">
      <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.18),transparent_42%)]" />
      <div className="absolute right-0 top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.18),transparent_62%)] blur-3xl" />
      <div className="absolute left-0 top-40 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.12),transparent_65%)] blur-3xl" />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <div className="max-w-2xl">
          <div className="tag-mono mb-5 inline-block">Operacao conectada para infoprodutores</div>

          <h1 className="text-4xl font-bold leading-[1.04] text-foreground md:text-6xl">
            Capture, venda e se <span className="text-gradient-primary">relacione</span> com seus leads em um{" "}
            <span className="text-gradient-up">so lugar.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-xl">
            Centralize formularios, CRM, automacoes, WhatsApp, grupos e funis em uma operacao feita
            para infoprodutores que precisam captar melhor, vender com mais controle e manter o
            relacionamento vivo.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/login">
              <Button variant="hero" size="xl" className="landing-button-primary w-full text-white sm:w-auto">
                Testar gratis por 7 dias <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <a href="#como-funciona" className="sm:w-auto">
              <Button
                variant="heroOutline"
                size="xl"
                className="landing-button-secondary w-full text-white sm:w-auto"
              >
                Ver demonstracao <PlayCircle className="ml-2 h-5 w-5" />
              </Button>
            </a>
          </div>

          <p className="mt-4 text-sm text-slate-300/80">
            Comece seu teste gratis e veja sua operacao funcionando do primeiro contato ao pos-venda.
          </p>

          <ul className="mt-8 grid gap-3 text-sm text-slate-100/90 sm:grid-cols-3 sm:gap-4">
            <li className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
              Capture leads com formularios e popup integrados
            </li>
            <li className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
              Organize atendimento, vendas e follow-up em um so fluxo
            </li>
            <li className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
              Automatize etapas sem perder o contexto do lead
            </li>
          </ul>
        </div>

        <div className="relative">
          {/* TODO: Gravar um video principal mostrando captacao + CRM + atendimento + automacao no Flow Up. */}
          <VideoMockup
            label="Mockup principal"
            title="Video principal da hero"
            description="Aqui entra a gravacao principal da landing mostrando a operacao conectada do Flow Up."
            checklist={heroChecklist}
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {["Captacao centralizada", "Vendas organizadas", "Relacionamento continuo"].map((label) => (
              <div key={label} className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.06] px-4 py-3 text-sm font-medium text-cyan-100">
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
