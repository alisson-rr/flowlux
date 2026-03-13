"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, Bot, BookOpen, Sparkles, ArrowRight } from "lucide-react";

export default function MembrosPage() {
  const handleWhatsApp = () => {
    window.open("https://wa.me/5551994408307?text=Olá! Quero saber mais sobre a Área de Membros exclusiva.", "_blank");
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      {/* Hero */}
      <div className="text-center space-y-4 py-8">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
          <GraduationCap className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold">Área de Membros Exclusiva</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
          Crie sua própria área de membros personalizada com aulas, conteúdos exclusivos e agentes de IA sob medida para o seu negócio.
        </p>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-border/50 hover:border-primary/30 transition-colors">
          <CardContent className="p-6 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold">Aulas e Conteúdos</h3>
            <p className="text-sm text-muted-foreground">
              Monte sua grade de aulas com vídeos, materiais e trilhas de aprendizado personalizadas para seus alunos ou clientes.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 hover:border-primary/30 transition-colors">
          <CardContent className="p-6 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-xl bg-secondary/15 flex items-center justify-center">
              <Bot className="h-6 w-6 text-secondary" />
            </div>
            <h3 className="font-semibold">Agentes IA Personalizados</h3>
            <p className="text-sm text-muted-foreground">
              Crie agentes de inteligência artificial treinados com seu conteúdo para atender, ensinar e interagir com seus membros automaticamente.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 hover:border-primary/30 transition-colors">
          <CardContent className="p-6 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-xl bg-green-500/15 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-green-400" />
            </div>
            <h3 className="font-semibold">100% Personalizada</h3>
            <p className="text-sm text-muted-foreground">
              Sua área de membros com a sua marca, cores, domínio e identidade visual. Totalmente exclusiva para o seu negócio.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* CTA */}
      <div className="text-center py-8 space-y-4">
        <p className="text-muted-foreground">
          Transforme seu conhecimento em uma plataforma completa com inteligência artificial.
        </p>
        <Button size="lg" onClick={handleWhatsApp} className="text-base px-8 py-6 h-auto">
          Quero saber mais <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
        <p className="text-xs text-muted-foreground">
          Você será redirecionado para o WhatsApp para falar com nossa equipe.
        </p>
      </div>
    </div>
  );
}
