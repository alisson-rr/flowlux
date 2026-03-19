"use client";

import { MessageSquare, GitBranch, Send, Zap, Megaphone, ShoppingBag, FolderOpen, Smartphone } from "lucide-react";

const features = [
  {
    icon: MessageSquare,
    title: "Chat com CRM integrado",
    desc: "Converse com seus leads e organize tudo sem sair da tela. Cadastre leads, aplique tags, adicione notas e mantenha o histórico organizado.",
    video: "Veja como cadastrar, organizar e agir em cima de um lead em poucos cliques.",
  },
  {
    icon: GitBranch,
    title: "Funis personalizados",
    desc: "Crie múltiplos funis para diferentes objetivos e acompanhe cada lead da forma certa, com etapas e organização próprias.",
    video: "Veja como montar funis personalizados para diferentes estratégias de venda.",
  },
  {
    icon: Send,
    title: "Fluxos de mensagens",
    desc: "Envie sequências prontas com texto, imagem, áudio, vídeo e arquivo. Padronize a comunicação e agilize respostas.",
    video: "Veja como criar um fluxo de mensagens e usar no dia a dia do atendimento.",
  },
  {
    icon: Zap,
    title: "Gatilhos automáticos",
    desc: "Configure palavras-chave para ativar fluxos automaticamente. Reduza tarefas repetitivas de forma simples.",
    video: "Veja como transformar palavras do lead em automações práticas no WhatsApp.",
  },
  {
    icon: Megaphone,
    title: "Disparo em massa segmentado",
    desc: "Filtre envios por funil, etapa e tags para disparar campanhas de forma mais estratégica para as pessoas certas.",
    video: "Veja como segmentar e disparar campanhas para leads mais qualificados.",
  },
  {
    icon: ShoppingBag,
    title: "Integração com Hotmart",
    desc: "Configure eventos da Hotmart para organizar leads em funis e etapas específicas com tags automáticas.",
    video: "Veja como automatizar funil, etapa e tag com eventos da Hotmart.",
    highlight: true,
  },
  {
    icon: FolderOpen,
    title: "Biblioteca de mídias e mensagens",
    desc: "Salve mensagens, imagens, vídeos, áudios e arquivos para usar no atendimento sem perder tempo.",
    video: "Veja como deixar seu atendimento mais rápido com materiais prontos.",
  },
  {
    icon: Smartphone,
    title: "Múltiplos números de WhatsApp",
    desc: "Trabalhe com múltiplos números e distribua melhor sua estrutura de atendimento e vendas.",
    video: "Veja como funciona a operação com vários números no mesmo painel.",
  },
];

const FeaturesSection = () => {
  return (
    <section className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="tag-mono mb-4 inline-block">Como funciona na prática</div>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-16" style={{ textWrap: "balance" } as React.CSSProperties}>
          Recursos que fazem o FlowLux trabalhar por você
        </h2>

        <div className="space-y-16">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`flex flex-col md:flex-row gap-8 items-start ${i % 2 !== 0 ? "md:flex-row-reverse" : ""} ${f.highlight ? "gradient-hotmart rounded-3xl p-8 -mx-4 md:-mx-8" : ""}`}
            >
              {/* Text */}
              <div className="flex-1 md:sticky md:top-24">
                {f.highlight && (
                  <span className="tag-mono bg-primary/20 text-primary mb-4 inline-block">
                    Diferencial do FlowLux
                  </span>
                )}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <f.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{f.title}</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed mb-4">{f.desc}</p>
                <p className="text-sm text-muted-foreground/70 italic">{f.video}</p>
              </div>

              {/* Video placeholder */}
              <div className="flex-1 w-full">
                <div className="rounded-[24px] p-3 bg-card border border-foreground/5">
                  <div className="rounded-[12px] bg-surface-elevated aspect-video flex items-center justify-center overflow-hidden">
                    <img 
                      src={
                        f.title === "Chat com CRM integrado" ? "/assets/chat.png" :
                        f.title === "Funis personalizados" ? "/assets/funil.png" :
                        f.title === "Fluxos de mensagens" ? "/assets/fluxo.png" :
                        f.title === "Gatilhos automáticos" ? "/assets/disparo.png" :
                        f.title === "Disparo em massa segmentado" ? "/assets/disparo.png" :
                        f.title === "Integração com Hotmart" ? "/assets/hotmart.png" :
                        f.title === "Biblioteca de mídias e mensagens" ? "/assets/midias.png" :
                        f.title === "Múltiplos números de WhatsApp" ? "/assets/whats.png" :
                        "/assets/chat.png"
                      }
                      alt={f.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
