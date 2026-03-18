"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, MessageSquare, Tag, GitBranch, Zap, ImageIcon } from "lucide-react";

const ProductSection = () => {
  return (
    <section className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="tag-mono mb-4 inline-block">Produto</div>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4" style={{ textWrap: "balance" } as React.CSSProperties}>
          Um painel pensado para facilitar seu dia a dia no WhatsApp
        </h2>
        <p className="text-muted-foreground text-lg max-w-3xl mb-12 leading-relaxed">
          Nada de ferramenta confusa, travada ou cheia de coisa inútil. No FlowLux, você tem uma estrutura simples de usar, mas poderosa por trás.
        </p>

        {/* Bento Grid Mockup */}
        <div className="grid grid-cols-4 md:grid-cols-6 gap-3 mb-12">
          {/* Large cell - Chat */}
          <div className="col-span-4 md:col-span-3 row-span-2 card-lux-hover p-6">
            <MessageSquare className="w-5 h-5 text-primary mb-3" />
            <h3 className="font-bold text-foreground mb-1">Chat em tempo real</h3>
            <p className="text-sm text-muted-foreground mb-4">Converse e organize sem sair da tela.</p>
            <div className="space-y-2">
              {["João Silva — Interessado no curso", "Maria Souza — Boleto gerado", "Pedro Lima — Aguardando resposta"].map((msg) => (
                <div key={msg} className="bg-background/50 rounded-lg p-3 border border-foreground/5 text-xs text-muted-foreground">
                  {msg}
                </div>
              ))}
            </div>
          </div>

          {/* Medium cell - CRM */}
          <div className="col-span-4 md:col-span-3 card-lux-hover p-6">
            <GitBranch className="w-5 h-5 text-secondary mb-3" />
            <h3 className="font-bold text-foreground mb-1">Funis personalizados</h3>
            <div className="flex gap-1 mt-3">
              {["Novo", "Qualificado", "Proposta", "Pago"].map((s, i) => (
                <div key={s} className="flex-1 text-center">
                  <div className={`h-1 rounded-full mb-1 ${i === 3 ? "bg-primary" : "bg-muted-foreground/20"}`} />
                  <span className="text-[10px] font-mono text-muted-foreground">{s}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Small cells */}
          <div className="col-span-2 md:col-span-1 card-lux-hover p-4">
            <Tag className="w-4 h-4 text-primary mb-2" />
            <p className="text-xs font-semibold text-foreground">Tags</p>
          </div>
          <div className="col-span-2 md:col-span-1 card-lux-hover p-4">
            <Zap className="w-4 h-4 text-secondary mb-2" />
            <p className="text-xs font-semibold text-foreground">Gatilhos</p>
          </div>
          <div className="col-span-2 md:col-span-1 card-lux-hover p-4">
            <ImageIcon className="w-4 h-4 text-primary mb-2" />
            <p className="text-xs font-semibold text-foreground">Mídias</p>
          </div>
        </div>

        <div className="text-center">
          <Link href="/login">
            <Button variant="hero" size="lg">
              Quero conhecer o FlowLux <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default ProductSection;
