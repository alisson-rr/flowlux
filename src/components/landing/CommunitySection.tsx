"use client";

import { MessageCircle, Lightbulb, Star, Users, MessagesSquare } from "lucide-react";

const bullets = [
  { icon: MessagesSquare, text: "Troca de estratégias" },
  { icon: Lightbulb, text: "Novidades em primeira mão" },
  { icon: Star, text: "Espaço para feedback" },
  { icon: Users, text: "Apoio entre usuários" },
  { icon: MessageCircle, text: "Discussões práticas sobre uso real" },
];

const CommunitySection = () => {
  return (
    <section className="py-24 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <div className="tag-mono mb-4 inline-block">Exclusivo Black</div>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Mais do que acesso à ferramenta
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-12 leading-relaxed">
          No plano Black, você também entra em uma comunidade para trocar experiências, acompanhar novidades, opinar em melhorias e se apoiar com outros usuários que também usam o WhatsApp como canal de vendas.
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          {bullets.map((b) => (
            <div key={b.text} className="card-lux px-5 py-3 flex items-center gap-2">
              <b.icon className="w-4 h-4 text-primary" />
              <span className="text-sm text-foreground">{b.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CommunitySection;
