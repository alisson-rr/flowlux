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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Smartphone, Plus, QrCode, RefreshCw, Power, PowerOff, Trash2, Loader2, CheckCircle, XCircle, Wifi, WifiOff, ShoppingCart, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { useSubscription } from "@/lib/use-subscription";
import Link from "next/link";

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
  const [hotmartEvents, setHotmartEvents] = useState<Record<string, { funnel_id: string; stage_id: string; tag_id: string }>>({});
  const [funnels, setFunnels] = useState<{ id: string; name: string }[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string; funnel_id: string }[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const { toast } = useToast();
  const { limits } = useSubscription();

  const HOTMART_EVENTS = [
    { key: "PURCHASE_APPROVED", label: "Compra Aprovada" },
    { key: "PURCHASE_COMPLETE", label: "Compra Completa" },
    { key: "PURCHASE_CANCELED", label: "Compra Cancelada" },
    { key: "PURCHASE_REFUNDED", label: "Compra Reembolsada" },
    { key: "PURCHASE_EXPIRED", label: "Compra Expirada" },
    { key: "PURCHASE_DELAYED", label: "Compra Atrasada" },
    { key: "PURCHASE_PROTEST", label: "Pedido de Reembolso" },
    { key: "PURCHASE_CHARGEBACK", label: "Chargeback" },
    { key: "PURCHASE_WAITING_PAYMENT", label: "Aguardando Pagamento" },
    { key: "SUBSCRIPTION_CANCELLATION", label: "Cancelamento de Assinatura" },
    { key: "SWITCH_PLAN", label: "Troca de Plano" },
    { key: "PURCHASE_FIRST_ACCESS", label: "Primeiro Acesso" },
    { key: "MODULE_COMPLETE", label: "Módulo Completo" },
    { key: "CART_ABANDONMENT", label: "Abandono de Carrinho" },
    { key: "SUBSCRIPTION_CHARGE_DATE_UPDATED", label: "Atualização Data Cobrança" },
  ];

  const loadData = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();

      const [instancesRes, hotmartRes, funnelsRes, stagesRes, tagsRes] = await Promise.all([
        userData.user
          ? supabase.from("whatsapp_instances").select("*").eq("user_id", userData.user.id).is("deleted_at", null).order("created_at")
          : Promise.resolve({ data: [] }),
        userData.user
          ? supabase.from("integrations").select("api_key, config").eq("user_id", userData.user.id).eq("type", "hotmart").single()
          : Promise.resolve({ data: null }),
        userData.user ? supabase.from("funnels").select("id, name").eq("user_id", userData.user.id) : Promise.resolve({ data: [] }),
        userData.user ? supabase.from("funnel_stages").select("id, name, funnel_id").eq("user_id", userData.user.id).order("order") : Promise.resolve({ data: [] }),
        userData.user ? supabase.from("tags").select("id, name").eq("user_id", userData.user.id) : Promise.resolve({ data: [] }),
      ]);

      if (instancesRes.data) setInstances(instancesRes.data);
      if (hotmartRes.data) {
        setHotmartToken((hotmartRes.data as any)?.api_key || "");
        if ((hotmartRes.data as any)?.config?.events) setHotmartEvents((hotmartRes.data as any).config.events);
      }
      const loadedFunnels = (funnelsRes.data || []) as any[];
      const loadedStages = (stagesRes.data || []) as any[];
      setFunnels(loadedFunnels);
      setStages(loadedStages);
      if (tagsRes.data) setTags(tagsRes.data as any);

      // Pre-set defaults for hotmart events if not yet configured
      if (loadedFunnels.length > 0 && !(hotmartRes.data as any)?.config?.events) {
        const defaultFunnel = loadedFunnels[0].id;
        const defaultStage = loadedStages.find((s: any) => s.funnel_id === defaultFunnel)?.id || "";
        const defaults: Record<string, { funnel_id: string; stage_id: string; tag_id: string }> = {};
        ["PURCHASE_APPROVED","PURCHASE_COMPLETE","PURCHASE_CANCELED","PURCHASE_REFUNDED","PURCHASE_EXPIRED","PURCHASE_DELAYED","PURCHASE_PROTEST","PURCHASE_CHARGEBACK","PURCHASE_WAITING_PAYMENT","SUBSCRIPTION_CANCELLATION","SWITCH_PLAN","PURCHASE_FIRST_ACCESS","MODULE_COMPLETE","CART_ABANDONMENT","SUBSCRIPTION_CHARGE_DATE_UPDATED"].forEach((k) => {
          defaults[k] = { funnel_id: defaultFunnel, stage_id: defaultStage, tag_id: "" };
        });
        setHotmartEvents(defaults);
      }

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
      const result = await evolutionApi.createInstance(newInstanceName, "https://webhook.devnoflow.com.br/webhook/flowlux-webhook");

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

      toast("Instância criada com webhook configurado!", "success");

      // Show QR code if available and start polling for connection
      if (result?.qrcode?.base64) {
        setQrCode({ instanceName: newInstanceName, base64: result.qrcode.base64 });
        setShowQrDialog(true);

        // Poll for connection status every 5s while QR dialog is open
        const instName = newInstanceName;
        const pollInterval = setInterval(async () => {
          try {
            const status = await evolutionApi.getInstanceStatus(instName);
            if (status?.instance?.state === "open") {
              clearInterval(pollInterval);
              const createdInst = instances.find((i) => i.instance_name === instName) || inst;
              if (createdInst) {
                await supabase.from("whatsapp_instances").update({ status: "connected" }).eq("id", createdInst.id);
                setInstances((prev) => prev.map((i) => i.instance_name === instName ? { ...i, status: "connected" } : i));
              }
              setShowQrDialog(false);
              toast("WhatsApp conectado com sucesso!", "success");
            }
          } catch { /* ignore */ }
        }, 5000);
        // Stop polling after 3 minutes
        setTimeout(() => clearInterval(pollInterval), 180000);
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
        // Poll for connection status every 5s while QR dialog is open
        const pollInterval = setInterval(async () => {
          try {
            const status = await evolutionApi.getInstanceStatus(instanceName);
            if (status?.instance?.state === "open") {
              clearInterval(pollInterval);
              const inst = instances.find((i) => i.instance_name === instanceName);
              if (inst) {
                await supabase.from("whatsapp_instances").update({ status: "connected" }).eq("id", inst.id);
                setInstances((prev) => prev.map((i) => i.instance_name === instanceName ? { ...i, status: "connected" } : i));
              }
              setShowQrDialog(false);
              toast("WhatsApp conectado com sucesso!", "success");
            }
          } catch { /* ignore */ }
        }, 5000);
        // Stop polling after 3 minutes
        setTimeout(() => clearInterval(pollInterval), 180000);
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
      await supabase.from("whatsapp_instances").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      setInstances((prev) => prev.filter((i) => i.id !== id));
      toast("Instância excluída.", "success");
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
      config: { events: hotmartEvents },
    }, { onConflict: "user_id,type" });

    setHotmartSaving(false);
    setHotmartSaved(true);
    toast("Configuração Hotmart salva!", "success");
    setTimeout(() => setHotmartSaved(false), 3000);
  };

  const updateHotmartEvent = (eventKey: string, field: string, value: string) => {
    setHotmartEvents((prev) => ({
      ...prev,
      [eventKey]: { ...prev[eventKey], [field]: value },
    }));
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
        <h1 className="text-2xl font-bold">Integrações</h1>
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
              <p className="text-sm text-muted-foreground">
                Gerencie suas conexões com o WhatsApp
                <span className={cn("ml-2 text-xs font-mono px-2 py-0.5 rounded-full", instances.length >= limits.max_whatsapp_instances ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground")}>
                  {instances.length}/{limits.max_whatsapp_instances} número{limits.max_whatsapp_instances !== 1 ? "s" : ""}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {instances.length >= limits.max_whatsapp_instances && (
                <Link href="/assinatura">
                  <Button variant="outline" size="sm" className="text-xs">Fazer upgrade</Button>
                </Link>
              )}
              <Button onClick={() => {
                if (instances.length >= limits.max_whatsapp_instances) {
                  toast(`Limite de ${limits.max_whatsapp_instances} número${limits.max_whatsapp_instances !== 1 ? "s" : ""} atingido. Faça upgrade do plano.`, "warning");
                  return;
                }
                setShowAddInstance(true);
              }}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar Número
              </Button>
            </div>
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
                    value={typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/hotmart${hotmartToken ? '?hottok=' + hotmartToken : ''}` : ""}
                    className="bg-muted"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const url = `${window.location.origin}/api/webhooks/hotmart${hotmartToken ? '?hottok=' + hotmartToken : ''}`;
                        await navigator.clipboard.writeText(url);
                        toast("URL copiada!", "success");
                      } catch {
                        const input = document.querySelector('input[readonly]') as HTMLInputElement;
                        if (input) { input.select(); document.execCommand("copy"); toast("URL copiada!", "success"); }
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

              {/* Event Mappings - Collapsible */}
              <details className="pt-4 border-t border-border">
                <summary className="cursor-pointer flex items-center gap-2 text-base font-semibold hover:text-primary transition-colors">
                  <ChevronDown className="h-4 w-4" /> Personalizar Eventos
                </summary>
                <p className="text-xs text-muted-foreground mt-2 mb-3">Para cada evento, defina o funil, etapa e tag que serão aplicados ao lead</p>
                <div className="space-y-3 mt-3">
                  {HOTMART_EVENTS.map((evt) => {
                    const cfg = hotmartEvents[evt.key] || { funnel_id: "", stage_id: "", tag_id: "" };
                    const stagesForFunnel = stages.filter((s) => s.funnel_id === cfg.funnel_id);
                    return (
                      <div key={evt.key} className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
                        <p className="text-sm font-medium">{evt.label} <span className="text-[10px] text-muted-foreground">({evt.key})</span></p>
                        <div className="grid grid-cols-3 gap-2">
                          <Select value={cfg.funnel_id || "none"} onValueChange={(v) => updateHotmartEvent(evt.key, "funnel_id", v === "none" ? "" : v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Funil" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sem funil</SelectItem>
                              {funnels.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Select value={cfg.stage_id || "none"} onValueChange={(v) => updateHotmartEvent(evt.key, "stage_id", v === "none" ? "" : v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Etapa" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sem etapa</SelectItem>
                              {(cfg.funnel_id ? stagesForFunnel : stages).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Select value={cfg.tag_id || "none"} onValueChange={(v) => updateHotmartEvent(evt.key, "tag_id", v === "none" ? "" : v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tag" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sem tag</SelectItem>
                              {tags.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>

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
            <DialogTitle>Adicionar Número WhatsApp</DialogTitle>
            <DialogDescription>Dê um nome para identificar este número</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome de identificação</Label>
              <Input
                placeholder="Ex: comercial, suporte, vendas"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value.replace(/\s/g, "-").toLowerCase())}
              />
              <p className="text-xs text-muted-foreground">Use um nome simples para identificar este WhatsApp (apenas letras, números e hifens)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddInstance(false)}>Cancelar</Button>
            <Button onClick={handleCreateInstance} disabled={creatingInstance}>
              {creatingInstance && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Adicionar
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
              Escaneie o QR Code com seu WhatsApp para conectar o número <strong>{qrCode?.instanceName}</strong>
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
