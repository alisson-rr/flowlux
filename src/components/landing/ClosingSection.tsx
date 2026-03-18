"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const ClosingSection = () => {
  return (
    <section className="py-24 px-4">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6" style={{ textWrap: "balance" } as React.CSSProperties}>
          Seu WhatsApp pode continuar no improviso ou começar a trabalhar de forma{" "}
          <span className="text-gradient-primary">mais inteligente</span>
        </h2>
        <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
          Com mais controle, mais velocidade e mais automação, você ganha estrutura para vender melhor sem precisar aumentar o caos da operação.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/login">
            <Button variant="hero" size="xl">
              Começar agora <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
          <a href="#planos">
            <Button variant="heroOutline" size="xl">
              Escolher meu plano
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
};

export default ClosingSection;
