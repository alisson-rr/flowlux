"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    q: "O Flow Up e so para vender no WhatsApp?",
    a: "Nao. O WhatsApp e uma parte importante da operacao, mas o Flow Up foi pensado para ajudar o infoprodutor a captar, organizar, automatizar e se relacionar com seus leads em um so lugar.",
  },
  {
    q: "Consigo usar mesmo com uma operacao pequena?",
    a: "Sim. O Starter foi pensado para quem quer sair da gambiarra e organizar a base sem precisar de uma equipe grande para comecar.",
  },
  {
    q: "Preciso trocar tudo o que eu uso hoje para comecar?",
    a: "Nao. A ideia e centralizar primeiro o que mais trava sua operacao e reduzir a dependencia de ferramentas soltas conforme ela evolui.",
  },
  {
    q: "O que muda de um plano para outro?",
    a: "O core do produto continua o mesmo. O que muda e a capacidade da operacao: mais leads, mais numeros, mais disparos, mais armazenamento e camadas premium para quem precisa escalar com mais estrutura.",
  },
  {
    q: "Posso comecar em um plano menor e subir depois?",
    a: "Sim. A ideia da escada de planos e permitir que voce entre no momento certo da sua operacao e evolua sem precisar trocar de sistema depois.",
  },
];

export default function FAQSection() {
  return (
    <section id="faq" className="px-4 py-24 md:py-28">
      <div className="mx-auto max-w-4xl">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <div className="tag-mono mb-4 inline-block">FAQ</div>
          <h2 className="text-3xl font-bold text-foreground md:text-5xl">Perguntas frequentes</h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
            As respostas que ajudam a reduzir a ansiedade final antes do teste gratis.
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((faq, index) => (
            <AccordionItem key={faq.q} value={`item-${index}`} className="card-lux border-none px-6">
              <AccordionTrigger className="text-left text-base font-semibold text-white hover:no-underline md:text-lg">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="pb-2 text-sm leading-relaxed text-muted-foreground md:text-base">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
