"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { evolutionApi } from "@/lib/evolution-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Smartphone, Plus, QrCode, RefreshCw, Power, PowerOff, Trash2, Loader2, CheckCircle, XCircle, Wifi, WifiOff, ShoppingCart, Webhook,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  status: "connected" | "disconnected" | "connecting";
  phone_number?: string;
  created_at: string;
}

export default function ConfiguracoesPage() {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddInstance, setShowAddInstance] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState("");
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [qrCode, setQrCode] = useState<{ instanceName: string; base64: string } | null>(null);
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [hotmartToken, setHotmartToken] = useState("");
  const [hotmartSaving, setHotmartSaving] = useState(false);
  const [hotmartSaved, setHotmartSaved] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();

      const [instancesRes, hotmartRes] = await Promise.all([
        supabase.from("whatsapp_instances").select("*").order("created_at"),
        userData.user
          ? supabase.from("integrations").select("api_key").eq("user_id", userData.user.id).eq("type", "hotmart").single()
          : Promise.resolve({ data: null }),
      ]);

      if (instancesRes.data) setInstances(instancesRes.data);
      if (hotmartRes.data) setHotmartToken((hotmartRes.data as any)?.api_key || "");

      // Check Evolution status in PARALLEL (not sequential)
      if (instancesRes.data && instancesRes.data.length > 0) {
        const statusChecks = instancesRes.data.map(async (inst) => {
          try {
            const status = await evolutionApi.getInstanceStatus(inst.instance_name);
            const newStatus = status?.instance?.state === "open" ? "connected" : "disconnected";
            if (newStatus !== inst.status) {
              await supabase.from("whatsapp_instances").update({ status: newStatus }).eq("id", inst.id);
              return { id: inst.id, status: newStatus };
            }
          } catch { /* ignore */ }
          return null;
        });

        const results = await Promise.allSettled(statusChecks);
        results.forEach((r) => {
          if (r.status === "fulfilled" && r.value) {
            setInstances((prev) => prev.map((i) => i.id === r.value!.id ? { ...i, status: r.value!.status as any } : i));
          }
        });
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleCreateInstance = async () => {
    if (!newInstanceName.trim()) return;
    setCreatingInstance(true);

    try {
      const result = await evolutionApi.createInstance(newInstanceName);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: inst } = await supabase.from("whatsapp_instances").insert({
        user_id: userData.user.id,
        instance_name: newInstanceName,
        status: "disconnected",
      }).select().single();

      if (inst) {
        setInstances((prev) => [...prev, inst]);
      }

      // Show QR code if available
      if (result?.qrcode?.base64) {
        setQrCode({ instanceName: newInstanceName, base64: result.qrcode.base64 });
        setShowQrDialog(true);
      }

      setNewInstanceName("");
      setShowAddInstance(false);
    } catch (err) {
      console.error("Error creating instance:", err);
    } finally {
      setCreatingInstance(false);
    }
  };

  const handleGenerateQR = async (instanceName: string) => {
    setActionLoading(instanceName + "-qr");
    try {
      const result = await evolutionApi.getQrCode(instanceName);
      if (result?.base64) {
        setQrCode({ instanceName, base64: result.base64 });
        setShowQrDialog(true);
      }
    } catch (err) {
      console.error("Error generating QR:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async (instanceName: string, id: string) => {
    setActionLoading(id + "-restart");
    try {
      await evolutionApi.restartInstance(instanceName);
      setTimeout(() => loadData(), 3000);
    } catch (err) {
      console.error("Error restarting:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (instanceName: string, id: string) => {
    setActionLoading(id + "-disconnect");
    try {
      await evolutionApi.logoutInstance(instanceName);
      await supabase.from("whatsapp_instances").update({ status: "disconnected" }).eq("id", id);
      setInstances((prev) => prev.map((i) => i.id === id ? { ...i, status: "disconnected" } : i));
    } catch (err) {
      console.error("Error disconnecting:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteInstance = async (instanceName: string, id: string) => {
    setActionLoading(id + "-delete");
    try {
      await evolutionApi.deleteInstance(instanceName);
      await supabase.from("whatsapp_instances").delete().eq("id", id);
      setInstances((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error("Error deleting:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveHotmart = async () => {
    setHotmartSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    await supabase.from("integrations").upsert({
      user_id: userData.user.id,
      type: "hotmart",
      api_key: hotmartToken,
      is_active: !!hotmartToken,
    }, { onConflict: "user_id,type" });

    setHotmartSaving(false);
    setHotmartSaved(true);
    setTimeout(() => setHotmartSaved(false), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Configure integrações e conexões</p>
      </div>

      <Tabs defaultValue="whatsapp" className="space-y-4">
        <TabsList>
          <TabsTrigger value="whatsapp" className="gap-2"><Smartphone className="h-4 w-4" /> WhatsApp</TabsTrigger>
          <TabsTrigger value="hotmart" className="gap-2"><ShoppingCart className="h-4 w-4" /> Hotmart</TabsTrigger>
        </TabsList>

        {/* WhatsApp Tab */}
        <TabsContent value="whatsapp" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-medium">Instâncias WhatsApp</h3>
              <p className="text-sm text-muted-foreground">Gerencie suas conexões com o WhatsApp via Evolution API</p>
            </div>
            <Button onClick={() => setShowAddInstance(true)}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar Número
            </Button>
          </div>

          {instances.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <Smartphone className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma instância configurada</p>
              <p className="text-sm mt-1">Adicione um número para começar</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {instances.map((inst) => (
                <Card key={inst.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "p-3 rounded-lg",
                          inst.status === "connected" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"
                        )}>
                          {inst.status === "connected" ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="font-medium">{inst.instance_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={inst.status === "connected" ? "success" : "outline"} className="text-[10px]">
                              {inst.status === "connected" ? "Conectado" : "Desconectado"}
                            </Badge>
                            {inst.phone_number && (
                              <span className="text-xs text-muted-foreground">{inst.phone_number}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Generate QR Code */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateQR(inst.instance_name)}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === inst.instance_name + "-qr" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <QrCode className="h-4 w-4 mr-1" />
                          )}
                          QR Code
                        </Button>

                        {/* Restart */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestart(inst.instance_name, inst.id)}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === inst.id + "-restart" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-1" />
                          )}
                          Reiniciar
                        </Button>

                        {/* Disconnect - only when connected */}
                        {inst.status === "connected" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDisconnect(inst.instance_name, inst.id)}
                            disabled={!!actionLoading}
                          >
                            {actionLoading === inst.id + "-disconnect" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <PowerOff className="h-4 w-4 mr-1" />
                            )}
                            Desconectar
                          </Button>
                        )}

                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteInstance(inst.instance_name, inst.id)}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === inst.id + "-delete" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Hotmart Tab */}
        <TabsContent value="hotmart" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Integração Hotmart</CardTitle>
              <CardDescription>Configure a integração com a Hotmart para receber informações de vendas e assinantes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Token da API Hotmart</Label>
                <Input
                  type="password"
                  placeholder="Insira seu token da Hotmart"
                  value={hotmartToken}
                  onChange={(e) => setHotmartToken(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Encontre seu token em Hotmart → Ferramentas → API / Webhooks
                </p>
              </div>

              <div className="space-y-2">
                <Label>URL do Webhook</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/hotmart` : ""}
                    className="bg-muted"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const url = `${window.location.origin}/api/webhooks/hotmart`;
                        await navigator.clipboard.writeText(url);
                        alert("URL copiada!");
                      } catch {
                        const input = document.querySelector('input[readonly]') as HTMLInputElement;
                        if (input) { input.select(); document.execCommand("copy"); alert("URL copiada!"); }
                      }
                    }}
                  >
                    Copiar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure este URL como webhook na Hotmart para receber eventos de compra
                </p>
              </div>

              <Button onClick={handleSaveHotmart} disabled={hotmartSaving}>
                {hotmartSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {hotmartSaved ? (
                  <><CheckCircle className="mr-2 h-4 w-4" /> Salvo!</>
                ) : (
                  "Salvar Configuração"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Instance Dialog */}
      <Dialog open={showAddInstance} onOpenChange={setShowAddInstance}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Número</DialogTitle>
            <DialogDescription>Crie uma nova instância do WhatsApp</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da instância</Label>
              <Input
                placeholder="Ex: meu-whatsapp"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value.replace(/\s/g, "-").toLowerCase())}
              />
              <p className="text-xs text-muted-foreground">Apenas letras, números e hifens</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddInstance(false)}>Cancelar</Button>
            <Button onClick={handleCreateInstance} disabled={creatingInstance}>
              {creatingInstance && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Instância
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" /> QR Code</DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com seu WhatsApp para conectar a instância <strong>{qrCode?.instanceName}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center p-4">
            {qrCode?.base64 ? (
              <img src={qrCode.base64} alt="QR Code" width={256} height={256} className="rounded-lg" />
            ) : (
              <div className="w-64 h-64 bg-muted rounded-lg flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Abra o WhatsApp → Menu → Aparelhos conectados → Conectar aparelho
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
