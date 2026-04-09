"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, FileText, Loader2, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TERMOS_DE_USO, POLITICA_DE_PRIVACIDADE } from "@/lib/legal-texts";
import { formatPhoneInput, normalizePhone } from "@/lib/utils";

export default function CadastroPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const handleChange = (field: string, value: string) => {
    if (field === "phone") {
      setForm((prev) => ({ ...prev, phone: formatPhoneInput(value) }));
      return;
    }

    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("As senhas nao coincidem.");
      return;
    }

    if (form.password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (!acceptedTerms) {
      setError("Voce precisa aceitar os Termos de Uso e a Politica de Privacidade.");
      return;
    }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { name: form.name, phone: normalizePhone(form.phone) },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        name: form.name,
        email: form.email,
        phone: normalizePhone(form.phone),
      });

      const { data: funnel } = await supabase
        .from("funnels")
        .insert({
          user_id: data.user.id,
          name: "Funil Principal",
          description: "Funil padrao criado automaticamente",
        })
        .select()
        .single();

      if (funnel) {
        const defaultStages = [
          { name: "Novo Lead", color: "#8B5CF6", order: 0 },
          { name: "Contato Feito", color: "#3B82F6", order: 1 },
          { name: "Proposta Enviada", color: "#F97316", order: 2 },
          { name: "Negociacao", color: "#EAB308", order: 3 },
          { name: "Fechado", color: "#10B981", order: 4 },
        ];

        await supabase.from("funnel_stages").insert(
          defaultStages.map((stage) => ({
            user_id: data.user!.id,
            funnel_id: funnel.id,
            name: stage.name,
            color: stage.color,
            order: stage.order,
          })),
        );
      }
    }

    router.push("/assinatura");
  };

  return (
    <>
      <Card className="auth-card rounded-[28px] border-white/10 text-white shadow-none">
        <CardHeader className="space-y-3 text-center">
          <CardTitle className="text-3xl font-bold text-white">Criar conta</CardTitle>
          <CardDescription className="mx-auto max-w-md text-sm leading-relaxed text-slate-300">
            Preencha os dados para comecar sua operacao no Flow Up.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleRegister}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-200">
                Nome completo
              </Label>
              <Input
                id="name"
                placeholder="Seu nome"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="auth-input h-12 rounded-xl"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="auth-input h-12 rounded-xl"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-slate-200">
                Telefone
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(00) 00000-0000"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                className="auth-input h-12 rounded-xl"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua senha"
                  value={form.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  className="auth-input h-12 rounded-xl pr-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-200">
                Confirmar senha
              </Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Confirme sua senha"
                value={form.confirmPassword}
                onChange={(e) => handleChange("confirmPassword", e.target.value)}
                className="auth-input h-12 rounded-xl"
                required
              />
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <Checkbox
                checked={acceptedTerms}
                onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                className="mt-0.5"
              />
              <span className="text-sm leading-tight text-slate-300">
                Li e aceito os{" "}
                <button
                  type="button"
                  onClick={() => setShowTerms(true)}
                  className="font-medium text-cyan-200 transition-colors hover:text-white"
                >
                  Termos de Uso
                </button>{" "}
                e a{" "}
                <button
                  type="button"
                  onClick={() => setShowPrivacy(true)}
                  className="font-medium text-cyan-200 transition-colors hover:text-white"
                >
                  Politica de Privacidade
                </button>
              </span>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              variant="hero"
              className="landing-button-primary h-12 w-full rounded-xl text-white"
              disabled={loading || !acceptedTerms}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar conta
            </Button>

            <p className="text-center text-sm text-slate-400">
              Ja tem uma conta?{" "}
              <Link href="/login" className="font-medium text-cyan-200 transition-colors hover:text-white">
                Entrar
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>

      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="auth-card h-[min(88vh,760px)] w-[calc(100%-1rem)] max-w-3xl overflow-hidden border-white/10 p-0 text-white sm:w-full">
          <div className="bg-[linear-gradient(90deg,rgba(37,99,235,0.16),rgba(124,58,237,0.12),rgba(34,211,238,0.12))] px-5 py-4 md:px-7">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="flex items-center gap-2 text-xl text-white">
                <FileText className="h-5 w-5 text-cyan-300" /> Termos de Uso
              </DialogTitle>
              <DialogDescription className="text-slate-300">
                Ultima atualizacao: 24/03/2026
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="overflow-y-auto px-5 py-5 md:px-7">
            <div className="rounded-[20px] border border-cyan-400/12 bg-[#08111F]/88 p-4 text-sm leading-7 text-slate-200 whitespace-pre-wrap md:p-6">
              {TERMOS_DE_USO}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPrivacy} onOpenChange={setShowPrivacy}>
        <DialogContent className="auth-card h-[min(88vh,760px)] w-[calc(100%-1rem)] max-w-3xl overflow-hidden border-white/10 p-0 text-white sm:w-full">
          <div className="bg-[linear-gradient(90deg,rgba(37,99,235,0.16),rgba(124,58,237,0.12),rgba(34,211,238,0.12))] px-5 py-4 md:px-7">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="flex items-center gap-2 text-xl text-white">
                <Shield className="h-5 w-5 text-cyan-300" /> Politica de Privacidade
              </DialogTitle>
              <DialogDescription className="text-slate-300">
                Ultima atualizacao: 24/03/2026
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="overflow-y-auto px-5 py-5 md:px-7">
            <div className="rounded-[20px] border border-cyan-400/12 bg-[#08111F]/88 p-4 text-sm leading-7 text-slate-200 whitespace-pre-wrap md:p-6">
              {POLITICA_DE_PRIVACIDADE}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
