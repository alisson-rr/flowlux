"use client";

import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle, UserCircle, Camera } from "lucide-react";
import { cn, getInitials, formatPhoneInput } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

export default function PerfilPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState({ name: "", email: "", phone: "", avatar_url: "" });
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data } = await supabase.from("profiles").select("*").eq("id", userData.user.id).single();
    if (data) {
      setProfile({
        name: data.name || "",
        email: data.email || userData.user.email || "",
        phone: data.phone || "",
        avatar_url: data.avatar_url || "",
      });
    } else {
      setProfile((prev) => ({ ...prev, email: userData.user!.email || "" }));
    }
    setLoading(false);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    await supabase.from("profiles").upsert({
      id: userData.user.id,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      avatar_url: profile.avatar_url,
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess(false);

    if (passwords.new !== passwords.confirm) {
      setPasswordError("As senhas não coincidem.");
      return;
    }

    if (passwords.new.length < 6) {
      setPasswordError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: passwords.new });

    if (error) {
      setPasswordError(error.message);
      return;
    }

    setPasswordSuccess(true);
    setPasswords({ current: "", new: "", confirm: "" });
    setTimeout(() => setPasswordSuccess(false), 3000);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { setUploading(false); return; }

      const ext = file.name.split(".").pop() || "png";
      const filePath = `avatars/${userData.user.id}-${Date.now()}.${ext}`;

      // Try to remove old file first (ignore errors)
      const oldPath = profile.avatar_url?.split("/public_bucket/")[1]?.split("?")[0];
      if (oldPath) {
        await supabase.storage.from("public_bucket").remove([oldPath]).catch(() => {});
      }

      const { error: uploadError } = await supabase.storage
        .from("public_bucket")
        .upload(filePath, file, { cacheControl: "3600", upsert: true });

      if (uploadError) {
        toast("Erro ao fazer upload. Verifique as políticas do bucket.", "error");
        console.error("Upload error:", uploadError);
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("public_bucket").getPublicUrl(filePath);
      const avatarUrl = urlData.publicUrl;

      await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", userData.user.id);
      setProfile((prev) => ({ ...prev, avatar_url: avatarUrl }));
    } catch (err) {
      console.error("Avatar upload error:", err);
      toast("Erro ao fazer upload da foto.", "error");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Perfil</h1>
        <p className="text-muted-foreground">Gerencie suas informações pessoais</p>
      </div>

      {/* Avatar & Name */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Pessoais</CardTitle>
          <CardDescription>Atualize seus dados de perfil</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="w-20 h-20 rounded-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }}
                />
              ) : null}
              <div className={cn("w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center", profile.avatar_url && "hidden")}>
                <span className="text-2xl font-bold text-primary">{getInitials(profile.name || "U")}</span>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div>
              <p className="font-medium">{profile.name || "Seu Nome"}</p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
          </div>

          {/* Form */}
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input id="name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={profile.email} disabled className="bg-muted cursor-not-allowed" />
              <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: formatPhoneInput(e.target.value) })} />
            </div>
          </div>

          <Button onClick={handleSaveProfile} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saved ? <><CheckCircle className="mr-2 h-4 w-4" /> Salvo!</> : "Salvar Alterações"}
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>Alterar Senha</CardTitle>
          <CardDescription>Atualize sua senha de acesso</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {passwordError && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{passwordError}</div>
          )}
          {passwordSuccess && (
            <div className="p-3 rounded-lg bg-green-500/10 text-green-400 text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> Senha alterada com sucesso!
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nova senha</Label>
            <Input id="newPassword" type="password" value={passwords.new} onChange={(e) => setPasswords({ ...passwords, new: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
            <Input id="confirmPassword" type="password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} />
          </div>
          <Button onClick={handleChangePassword} variant="outline">Alterar Senha</Button>
        </CardContent>
      </Card>
    </div>
  );
}
