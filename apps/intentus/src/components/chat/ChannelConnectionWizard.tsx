import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  CheckCircle2,
  QrCode,
  RefreshCw,
  Smartphone,
  MessageCircle,
} from "lucide-react";
import { Instagram } from "@/components/icons/BrandIcons";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { ChannelConnectionMode } from "./ChannelTypeChoiceDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ChannelConnectionMode;
}

export function ChannelConnectionWizard({ open, onOpenChange, mode }: Props) {
  if (mode === "qrcode") {
    return <QRCodeWizard open={open} onOpenChange={onOpenChange} />;
  }
  if (mode === "hunion_whatsapp" || mode === "hunion_instagram") {
    return <HunionWizard open={open} onOpenChange={onOpenChange} mode={mode} />;
  }
  if (mode === "telegram") {
    return (
      <ManualWizard
        open={open}
        onOpenChange={onOpenChange}
        channelType="telegram"
        label="Token do Bot"
        placeholder="123456:ABC-DEF1234..."
      />
    );
  }
  if (mode === "webchat") {
    return (
      <ManualWizard
        open={open}
        onOpenChange={onOpenChange}
        channelType="webchat"
        label="Nome do Canal"
        placeholder="Chat do Site"
      />
    );
  }
  return null;
}

// ==================== QR Code Wizard (Z-API transparent) ====================
function QRCodeWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [step, setStep] = useState<"name" | "qrcode" | "done">("name");
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState<string | null>(null);
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const qc = useQueryClient();

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep("name");
      setName("");
      setChannelId(null);
      setQrcode(null);
      setLoading(false);
      setPhoneNumber(null);
    }
  }, [open]);

  const callEdge = useCallback(
    async (action: string, payload: Record<string, unknown>) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/channel-connect`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action, ...payload }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || "Request failed");
      }
      return res.json();
    },
    [],
  );

  const handleCreateAndGetQR = async () => {
    if (!name.trim()) return toast.error("Informe o nome do canal");
    setLoading(true);
    try {
      const { channel_id } = await callEdge("zapi_create_instance", { name });
      setChannelId(channel_id);
      const { qrcode: qr } = await callEdge("zapi_get_qrcode", { channel_id });
      setQrcode(qr);
      setStep("qrcode");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar canal");
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshQR = async () => {
    if (!channelId) return;
    setLoading(true);
    try {
      const { qrcode: qr } = await callEdge("zapi_get_qrcode", {
        channel_id: channelId,
      });
      setQrcode(qr);
    } catch {
      toast.error("Erro ao gerar novo QR Code");
    } finally {
      setLoading(false);
    }
  };

  // Polling for connection status
  useEffect(() => {
    if (step !== "qrcode" || !channelId) return;
    const interval = setInterval(async () => {
      try {
        const data = await callEdge("zapi_check_status", {
          channel_id: channelId,
        });
        if (data.connected) {
          setPhoneNumber(data.phone_number);
          setStep("done");
          qc.invalidateQueries({ queryKey: ["chat_channels"] });
          clearInterval(interval);
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [step, channelId, callEdge, qc]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "name" && "WhatsApp (QR Code)"}
            {step === "qrcode" && "Escanear QR Code"}
            {step === "done" && "Conectado!"}
          </DialogTitle>
          <DialogDescription>
            {step === "name" &&
              "Dê um nome para o canal e escaneie o QR Code com seu celular"}
            {step === "qrcode" &&
              "Abra o WhatsApp no celular, vá em Aparelhos Conectados e escaneie o código"}
            {step === "done" && "Seu canal WhatsApp foi conectado com sucesso"}
          </DialogDescription>
        </DialogHeader>

        {step === "name" && (
          <div className="space-y-4">
            <div>
              <Label>Nome do Canal *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: WhatsApp Vendas"
                autoFocus
              />
            </div>
            <Button
              onClick={handleCreateAndGetQR}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <QrCode className="h-4 w-4 mr-2" />
              )}
              Gerar QR Code
            </Button>
          </div>
        )}

        {step === "qrcode" && (
          <div className="flex flex-col items-center gap-4">
            {qrcode ? (
              <div className="border rounded-lg p-4 bg-white">
                <img
                  src={
                    qrcode.startsWith("data:")
                      ? qrcode
                      : `data:image/png;base64,${qrcode}`
                  }
                  alt="QR Code WhatsApp"
                  className="w-64 h-64 object-contain"
                />
              </div>
            ) : (
              <div className="w-64 h-64 flex items-center justify-center border rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Smartphone className="h-4 w-4" />
              <span>Aguardando leitura do QR Code...</span>
              <Loader2 className="h-3 w-3 animate-spin" />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshQR}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}
              />
              Gerar novo QR Code
            </Button>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="rounded-full bg-emerald-100 p-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
            <p className="text-center font-medium">Canal "{name}" conectado!</p>
            {phoneNumber && (
              <p className="text-sm text-muted-foreground font-mono">
                {phoneNumber}
              </p>
            )}
            <Button onClick={() => onOpenChange(false)} className="w-full">
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ==================== Hunion Wizard (Official WhatsApp / Instagram) ====================
function HunionWizard({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: ChannelConnectionMode;
}) {
  const [step, setStep] = useState<"login" | "select" | "done">("login");
  const [channelId, setChannelId] = useState<string | null>(null);
  const [assets, setAssets] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) {
      setStep("login");
      setChannelId(null);
      setAssets(null);
      setLoading(false);
      setSelectedAsset(null);
    }
  }, [open]);

  const callEdge = useCallback(
    async (action: string, payload: Record<string, unknown>) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/channel-connect`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action, ...payload }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || "Request failed");
      }
      return res.json();
    },
    [],
  );

  const handleFacebookLogin = async () => {
    setLoading(true);
    try {
      // Get Meta App ID from backend
      const { app_id } = await callEdge("get_meta_app_id", {});
      if (!app_id) {
        toast.error(
          "Meta App ID não configurado. Configure o secret META_APP_ID.",
        );
        setLoading(false);
        return;
      }

      // Load Facebook SDK dynamically
      await loadFacebookSDK(app_id);

      // Launch Embedded Signup
      window.FB?.login(
        async (response: any) => {
          if (response.authResponse?.code) {
            try {
              const result = await callEdge("hunion_exchange_token", {
                code: response.authResponse.code,
              });
              setChannelId(result.channel_id);

              // List assets
              const assetsData = await callEdge("hunion_list_assets", {
                channel_id: result.channel_id,
              });
              setAssets(assetsData);
              setStep("select");
            } catch (err: any) {
              toast.error(err.message || "Erro ao trocar token");
            }
          } else {
            toast.error("Login cancelado ou falhou");
          }
          setLoading(false);
        },
        {
          config_id: app_id,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType:
              mode === "hunion_instagram"
                ? "page_messaging"
                : "whatsapp_embedded_signup",
            sessionInfoVersion: 2,
          },
        },
      );
    } catch (err: any) {
      toast.error(err.message || "Erro ao iniciar login");
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!channelId || !selectedAsset) return;
    setLoading(true);
    try {
      await callEdge("hunion_register_channel", {
        channel_id: channelId,
        name:
          selectedAsset.name || selectedAsset.verified_name || "Canal Oficial",
        waba_id: selectedAsset.waba_id,
        phone_number_id: selectedAsset.phone_number_id,
        phone_display: selectedAsset.display_phone_number,
        business_id: selectedAsset.business_id,
        page_id: selectedAsset.page_id,
        channel_type:
          mode === "hunion_instagram" ? "instagram" : "whatsapp_oficial",
      });
      setStep("done");
      qc.invalidateQueries({ queryKey: ["chat_channels"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar canal");
    } finally {
      setLoading(false);
    }
  };

  const isWhatsApp = mode === "hunion_whatsapp";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "login" &&
              (isWhatsApp
                ? "WhatsApp Business (Oficial)"
                : "Instagram / Messenger")}
            {step === "select" && "Selecionar Conta"}
            {step === "done" && "Conectado!"}
          </DialogTitle>
          <DialogDescription>
            {step === "login" &&
              "Faça login com o Facebook para conectar sua conta"}
            {step === "select" && "Selecione a conta que deseja conectar"}
            {step === "done" && "Canal conectado com sucesso"}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-2">
          {["login", "select", "done"].map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : ["login", "select", "done"].indexOf(step) > i
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {["login", "select", "done"].indexOf(step) > i ? "✓" : i + 1}
              </div>
              {i < 2 && <div className="w-8 h-px bg-border" />}
            </div>
          ))}
        </div>

        {step === "login" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-sm text-center text-muted-foreground max-w-sm">
              {isWhatsApp
                ? "Ao clicar no botão abaixo, você será redirecionado para o Facebook para autorizar a conexão com sua conta WhatsApp Business."
                : "Ao clicar no botão abaixo, você será redirecionado para o Facebook para autorizar a conexão com sua página do Instagram ou Messenger."}
            </p>
            <Button
              onClick={handleFacebookLogin}
              disabled={loading}
              className="bg-[#1877F2] hover:bg-[#166FE5] text-white"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Entrar com Facebook
            </Button>
          </div>
        )}

        {step === "select" && assets && (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {/* WhatsApp numbers */}
            {assets.businesses?.map((biz: any) =>
              biz.owned_whatsapp_business_accounts?.data?.map((waba: any) =>
                waba.phone_numbers?.data?.map((phone: any) => (
                  <Card
                    key={phone.id}
                    className={`cursor-pointer transition-all ${selectedAsset?.phone_number_id === phone.id ? "border-primary ring-1 ring-primary" : "hover:border-primary/50"}`}
                    onClick={() =>
                      setSelectedAsset({
                        name: phone.verified_name || waba.name,
                        waba_id: waba.id,
                        phone_number_id: phone.id,
                        display_phone_number: phone.display_phone_number,
                        business_id: biz.id,
                      })
                    }
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <MessageCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">
                          {phone.verified_name || waba.name}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {phone.display_phone_number}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )),
              ),
            )}

            {/* Pages */}
            {assets.pages?.map((page: any) => (
              <Card
                key={page.id}
                className={`cursor-pointer transition-all ${selectedAsset?.page_id === page.id ? "border-primary ring-1 ring-primary" : "hover:border-primary/50"}`}
                onClick={() =>
                  setSelectedAsset({
                    name: page.name,
                    page_id: page.id,
                    business_id: null,
                  })
                }
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <Instagram className="h-5 w-5 text-pink-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{page.name}</p>
                    {page.instagram_business_account?.data?.username && (
                      <p className="text-xs text-muted-foreground">
                        @{page.instagram_business_account.data.username}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {!assets.businesses?.length && !assets.pages?.length && (
              <p className="text-center text-muted-foreground text-sm py-4">
                Nenhuma conta encontrada. Verifique as permissões da sua conta
                Meta.
              </p>
            )}

            <Button
              onClick={handleRegister}
              disabled={!selectedAsset || loading}
              className="w-full"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Conectar Selecionado
            </Button>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="rounded-full bg-emerald-100 p-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
            <p className="text-center font-medium">
              Canal conectado com sucesso!
            </p>
            <Button onClick={() => onOpenChange(false)} className="w-full">
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ==================== Manual Wizard (Telegram/Webchat) ====================
function ManualWizard({
  open,
  onOpenChange,
  channelType,
  label,
  placeholder,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  channelType: string;
  label: string;
  placeholder: string;
}) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) {
      setName("");
      setValue("");
    }
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) return toast.error("Nome é obrigatório");
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const tenantId = user?.user_metadata?.tenant_id;
      const { error } = await supabase.from("chat_channels").insert({
        name,
        channel_type: channelType as any,
        connected_via: "manual",
        phone_number: channelType === "telegram" ? value : null,
        tenant_id: tenantId,
      });
      if (error) throw error;
      toast.success("Canal criado");
      qc.invalidateQueries({ queryKey: ["chat_channels"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar canal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {channelType === "telegram" ? "Telegram" : "Webchat"}
          </DialogTitle>
          <DialogDescription>Configure os dados do canal</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome do Canal *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Bot Vendas"
            />
          </div>
          <div>
            <Label>{label}</Label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
            />
          </div>
          <Button onClick={handleCreate} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Adicionar Canal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Facebook SDK Loader ====================
declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

function loadFacebookSDK(appId: string): Promise<void> {
  return new Promise((resolve) => {
    if (window.FB) {
      window.FB.init({ appId, cookie: true, xfbml: true, version: "v21.0" });
      resolve();
      return;
    }
    window.fbAsyncInit = () => {
      window.FB.init({ appId, cookie: true, xfbml: true, version: "v21.0" });
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/pt_BR/sdk.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  });
}
