"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  { q: "O FlowLux funciona com múltiplos números?", a: "Sim. Dependendo do plano, você pode usar mais de um número na sua operação." },
  { q: "Posso criar mais de um funil?", a: "Sim. Você pode criar múltiplos funis com etapas personalizadas para diferentes estratégias." },
  { q: "Dá para automatizar mensagens?", a: "Sim. Você pode criar fluxos de mensagens e também gatilhos por palavras-chave." },
  { q: "O sistema integra com Hotmart?", a: "Sim. E você pode configurar o evento para definir funil, etapa e tag automaticamente." },
  { q: "O disparo em massa é segmentado?", a: "Sim. Você pode filtrar os envios por funil, etapa e tag." },
  { q: "Preciso saber mexer com automação avançada?", a: "Não. A ideia do FlowLux é justamente facilitar a operação e deixar o processo mais simples." },
  { q: "A IA já está inclusa para todo mundo?", a: "Não. O acesso antecipado à IA personalizada faz parte do plano Black." },
];

const FAQSection = () => {
  return (
    <section className="py-24 px-4">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-12 text-center">
          Perguntas frequentes
        </h2>

        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="card-lux px-6 border-none">
              <AccordionTrigger className="text-foreground font-semibold text-left hover:no-underline">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FAQSection;
