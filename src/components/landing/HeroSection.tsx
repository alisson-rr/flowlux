"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, MessageSquare, Users, GitBranch, Zap } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-24 pb-16 overflow-hidden">
      {/* Subtle glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
        className="relative z-10 max-w-4xl mx-auto text-center"
      >
        <span className="tag-mono mb-6 inline-block">Plataforma de vendas no WhatsApp</span>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.1] mb-6 text-foreground" style={{ textWrap: "balance" } as React.CSSProperties}>
          Organize, responda e venda pelo WhatsApp{" "}
          <span className="text-gradient-primary">sem virar escravo do atendimento</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          O FlowLux reúne chat, CRM, automações, funis, disparos e integração com Hotmart em um só lugar, para transformar conversas em vendas com mais velocidade, organização e escala.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
          <Link href="/login">
            <Button variant="hero" size="xl">
              Começar agora <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
          <a href="#planos">
            <Button variant="heroOutline" size="xl">
              Ver planos
            </Button>
          </a>
        </div>

        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          Ideal para infoprodutores que querem responder mais rápido, organizar seus leads e automatizar o processo comercial no WhatsApp.
        </p>
      </motion.div>

      {/* Dashboard Preview Mockup */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3, ease: [0.2, 0, 0, 1] }}
        className="relative z-10 mt-16 w-full max-w-5xl mx-auto"
      >
        <div className="card-lux p-1 md:p-2">
          <div className="bg-surface-elevated rounded-[20px] p-4 md:p-6">
            {/* Mock Dashboard */}
            <div className="flex items-center gap-3 mb-4 border-b border-foreground/5 pb-4">
              <div className="w-3 h-3 rounded-full bg-destructive/60" />
              <div className="w-3 h-3 rounded-full bg-secondary/60" />
              <div className="w-3 h-3 rounded-full bg-primary/60" />
              <span className="ml-4 text-xs text-muted-foreground font-mono">flowlux.app/dashboard</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { icon: MessageSquare, label: "Conversas", value: "247" },
                { icon: Users, label: "Leads", value: "1.832" },
                { icon: GitBranch, label: "No funil", value: "89" },
                { icon: Zap, label: "Automações", value: "12" },
              ].map((item) => (
                <div key={item.label} className="bg-background/50 rounded-xl p-3 border border-foreground/5">
                  <item.icon className="w-4 h-4 text-primary mb-2" />
                  <p className="text-2xl font-bold text-foreground font-mono tabular-nums">{item.value}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
            {/* Funnel stages */}
            <div className="flex gap-2 overflow-hidden">
              {["Novo", "Qualificado", "Proposta", "Negociação", "Pago"].map((stage, i) => (
                <div key={stage} className="flex-1 min-w-0">
                  <div className={`h-1.5 rounded-full mb-2 ${i < 3 ? "bg-primary/60" : i === 3 ? "bg-secondary/60" : "bg-primary"}`} />
                  <p className="text-[11px] font-mono text-muted-foreground truncate">{stage}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </motion.div>
    </section>
  );
};

export default HeroSection;
