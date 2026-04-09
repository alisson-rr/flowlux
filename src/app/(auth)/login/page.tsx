"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Email ou senha incorretos.");
      setLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("id, status, trial_end")
        .eq("user_id", userData.user.id)
        .in("status", ["active", "authorized", "trial"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!subscription) {
        router.push("/assinatura");
        return;
      }

      if (subscription.status === "trial" && subscription.trial_end) {
        const trialEnd = new Date(subscription.trial_end);
        if (trialEnd < new Date()) {
          router.push("/assinatura");
          return;
        }
      }
    }

    router.push("/dashboard");
  };

  return (
    <Card className="auth-card rounded-[28px] border-white/10 text-white shadow-none">
      <CardHeader className="space-y-3 text-center">
        <CardTitle className="text-3xl font-bold leading-tight text-white">Entrar</CardTitle>
        <CardDescription className="mx-auto max-w-md text-sm leading-relaxed text-slate-300">
          Acesse sua operacao no Flow Up.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleLogin}>
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

          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-200">
              Senha
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

          <div className="flex justify-end">
            <Link
              href="/esqueceu-senha"
              className="text-sm font-medium text-cyan-200 transition-colors hover:text-white"
            >
              Esqueceu a senha?
            </Link>
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
            Entrar
          </Button>

          <p className="text-center text-sm text-slate-400">
            Nao tem uma conta?{" "}
            <Link href="/cadastro" className="font-medium text-cyan-200 transition-colors hover:text-white">
              Cadastre-se
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
