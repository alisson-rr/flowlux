"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function EsqueceuSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <Card className="auth-card rounded-[28px] border-white/10 text-white shadow-none">
        <CardHeader className="space-y-3 text-center">
          <CardTitle className="text-3xl font-bold text-white">Email enviado</CardTitle>
          <CardDescription className="mx-auto max-w-md text-sm leading-relaxed text-slate-300">
            Enviamos um link de recuperacao para <strong className="text-white">{email}</strong>.
            Verifique sua caixa de entrada.
          </CardDescription>
        </CardHeader>

        <CardFooter>
          <Link href="/login" className="w-full">
            <Button variant="heroOutline" className="landing-button-secondary w-full text-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao login
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="auth-card rounded-[28px] border-white/10 text-white shadow-none">
      <CardHeader className="space-y-3 text-center">
        <CardTitle className="text-3xl font-bold text-white">Recuperar senha</CardTitle>
        <CardDescription className="mx-auto max-w-md text-sm leading-relaxed text-slate-300">
          Informe seu email para receber o link de recuperacao.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleReset}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-200">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input h-12 rounded-xl"
              required
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button
            type="submit"
            variant="hero"
            className="landing-button-primary h-12 w-full rounded-xl text-white"
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar link
          </Button>
          <Link
            href="/login"
            className="flex items-center justify-center gap-1 text-sm font-medium text-cyan-200 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3 w-3" /> Voltar ao login
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
