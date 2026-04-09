import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ClosingSection() {
  return (
    <section className="px-4 pb-24 pt-10 md:pb-28">
      <div className="mx-auto max-w-4xl">
        <div className="card-lux gradient-hotmart overflow-hidden px-6 py-10 text-center md:px-10 md:py-14">
          <div className="tag-mono mb-4 inline-block">Fechamento</div>
          <h2 className="mx-auto max-w-3xl text-3xl font-bold leading-tight text-white md:text-5xl">
            Capture, venda e se relacione com seus leads em um so lugar.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Se a sua operacao cresceu mais do que o seu processo, o proximo passo e organizar os dois no
            mesmo lugar.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-slate-200/90">
            Pare de operar no improviso com ferramentas soltas e comece a centralizar captacao, vendas e
            relacionamento em um sistema pensado para infoprodutores.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/login">
              <Button variant="hero" size="xl" className="landing-button-primary w-full text-white sm:w-auto">
                Testar gratis por 7 dias <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <a href="#como-funciona">
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
            Comece no plano certo para o momento da sua operacao e evolua sem trocar de sistema depois.
          </p>
        </div>
      </div>
    </section>
  );
}
