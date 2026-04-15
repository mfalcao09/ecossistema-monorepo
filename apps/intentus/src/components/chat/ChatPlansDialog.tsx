import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import QRCode from "qrcode";
import {
  Check, X, ArrowRight, CreditCard, QrCode, Loader2, CheckCircle2,
  Clock, Copy, Users, Zap, Crown, MessageCircle, Bot, Webhook, BarChart3,
  Plus, Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { stripePromise } from "@/lib/stripe";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface ChatPlansDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentChatPlanId?: string | null;
  isUpgrade?: boolean;
}

interface PixData {
  pix_charge_id: string | null;
  txid: string;
  qr_code: string;
  amount: number;
  expiration: number;
}

export function ChatPlansDialog({ open, onOpenChange, currentChatPlanId, isUpgrade = false }: ChatPlansDialogProps) {
  const { tenantId } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [extraConnections, setExtraConnections] = useState(0);
  const [extraUsers, setExtraUsers] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cartao" | "pix" | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [pixPaid, setPixPaid] = useState(false);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixCountdown, setPixCountdown] = useState(0);
  const pixPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pixStartTimeRef = useRef<number>(0);
  const [cardClientSecret, setCardClientSecret] = useState<string | null>(null);
  const [cardPaid, setCardPaid] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);

  const { data: plans = [] } = useQuery({
    queryKey: ["chat-plans-dialog"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_plans")
        .select("*")
        .eq("active", true)
        .order("sort_order")
        .order("price_monthly");
      if (error) throw error;
      return data;
    },
  });

  const availablePlans = isUpgrade && currentChatPlanId
    ? (() => {
        const currentPlan = plans.find((p) => p.id === currentChatPlanId);
        const currentPrice = Number(currentPlan?.price_monthly || 0);
        return plans.filter((p) => Number(p.price_monthly) > currentPrice);
      })()
    : plans;

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) as any;
  const currentPlan = currentChatPlanId ? plans.find((p) => p.id === currentChatPlanId) as any : null;

  const extraWppCost = Number(selectedPlan?.extra_whatsapp_cost || 0);
  const activationFeePerExtra = Number(selectedPlan?.activation_fee_wpp || 0);
  const extraConnectionsMonthlyCost = extraConnections * extraWppCost;
  const extraActivationTotal = extraConnections * activationFeePerExtra;
  const extraUserCost = Number(selectedPlan?.additional_user_cost || 0);
  const extraUsersMonthlyCost = extraUsers * extraUserCost;

  const stopPixPolling = useCallback(() => {
    if (pixPollingRef.current) {
      clearInterval(pixPollingRef.current);
      pixPollingRef.current = null;
    }
  }, []);

  const resetDialog = () => {
    setStep(1);
    setSelectedPlanId(null);
    setExtraConnections(0);
    setExtraUsers(0);
    setPaymentMethod(null);
    setProcessing(false);
    setResult(null);
    setPixData(null);
    setPixPaid(false);
    setPixLoading(false);
    setCardClientSecret(null);
    setCardPaid(false);
    setCardLoading(false);
    stopPixPolling();
  };

  useEffect(() => {
    if (!open) resetDialog();
  }, [open]);

  // PIX countdown
  useEffect(() => {
    if (!pixData || pixPaid) return;
    pixStartTimeRef.current = Date.now();
    setPixCountdown(pixData.expiration);
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - pixStartTimeRef.current) / 1000);
      const remaining = Math.max(0, pixData.expiration - elapsed);
      setPixCountdown(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [pixData, pixPaid]);

  // Realtime for PIX
  useEffect(() => {
    if (!pixData?.pix_charge_id || pixPaid) return;
    const channel = supabase
      .channel(`pix-chat-sub-${pixData.pix_charge_id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "platform_pix_charges",
        filter: `id=eq.${pixData.pix_charge_id}`,
      }, (payload: any) => {
        if (payload.new?.status === "concluida") {
          setPixPaid(true);
          stopPixPolling();
          toast.success("Pagamento confirmado! Assinatura ativada.");
          qc.invalidateQueries({ queryKey: ["my-chat-subscription"] });
          qc.invalidateQueries({ queryKey: ["chat-subscription"] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [pixData?.pix_charge_id, pixPaid]);

  // Polling for PIX
  useEffect(() => {
    if (!pixData?.pix_charge_id || pixPaid) return;
    pixPollingRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-pix-status", {
          body: { pix_charge_id: pixData.pix_charge_id },
        });
        if (!error && data?.paid) {
          setPixPaid(true);
          stopPixPolling();
          toast.success("Pagamento confirmado! Assinatura ativada.");
          qc.invalidateQueries({ queryKey: ["my-chat-subscription"] });
          qc.invalidateQueries({ queryKey: ["chat-subscription"] });
        }
      } catch { /* silent */ }
    }, 10_000);
    return () => stopPixPolling();
  }, [pixData?.pix_charge_id, pixPaid]);

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    setExtraConnections(0);
    setExtraUsers(0);
    setStep(2);
  };

  const handleConfirmAndPay = async () => {
    if (!selectedPlanId) return;
    setProcessing(true);
    try {
      const body = isUpgrade
        ? { target_chat_plan_id: selectedPlanId, extra_connections: extraConnections, extra_users: extraUsers }
        : { chat_plan_id: selectedPlanId, extra_connections: extraConnections, extra_users: extraUsers };

      const { data, error } = await supabase.functions.invoke("process-chat-subscription", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.existing_invoice) {
        toast.info("Já existe uma fatura em aberto para esta assinatura.");
        setResult(data);
        setStep(3);
        return;
      }

      setResult(data);
      setStep(3);
    } catch (e: any) {
      toast.error(e.message || "Erro ao processar assinatura");
    } finally {
      setProcessing(false);
    }
  };

  const handleInitCardPayment = async () => {
    if (!result?.invoice_id) return;
    setCardLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("pay-invoice", {
        body: { invoice_id: result.invoice_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.clientSecret) throw new Error("clientSecret não retornado");
      setCardClientSecret(data.clientSecret);
    } catch (e: any) {
      toast.error(e.message || "Erro ao iniciar pagamento");
    } finally {
      setCardLoading(false);
    }
  };

  const handleCardPaymentSuccess = async () => {
    if (!result?.invoice_id) return;
    try {
      const { data, error } = await supabase.functions.invoke("verify-card-payment", {
        body: { invoice_id: result.invoice_id },
      });
      if (!error && data?.status === "paid") {
        setCardPaid(true);
        toast.success("Pagamento confirmado! Assinatura ativada.");
        qc.invalidateQueries({ queryKey: ["my-chat-subscription"] });
        qc.invalidateQueries({ queryKey: ["chat-subscription"] });
      }
    } catch { /* silent */ }
  };

  const handlePayPix = async () => {
    if (!result?.invoice_id) return;
    setPixLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("pay-invoice-pix", {
        body: { invoice_id: result.invoice_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPixData(data as PixData);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar PIX");
    } finally {
      setPixLoading(false);
    }
  };

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const getFeatureRow = (plan: any, key: string, label: string) => {
    const featureMap: Record<string, (p: any) => boolean | number | string> = {
      users: (p) => `${p.included_users ?? p.max_users} usuários`,
      connections: (p) => `${p.max_connections} conexões`,
      channels: (p) => p.channels_description || "WhatsApp",
      chatbot_service: (p) => p.chatbot_service_limit ? `${p.chatbot_service_limit} chatbots atendimento` : false,
      chatbot_automation: (p) => p.chatbot_automation_limit ? `${p.chatbot_automation_limit} chatbots automação` : false,
      funnels: (p) => p.max_funnels ? `${p.max_funnels} funis` : false,
      crm: (p) => !!p.has_crm,
      webhook: (p) => !!p.has_webhook,
    };
    const fn = featureMap[key];
    if (!fn) return null;
    const val = fn(plan);
    if (val === false || val === 0) return <X className="h-4 w-4 text-muted-foreground" />;
    if (val === true) return <Check className="h-4 w-4 text-green-600" />;
    return <span className="text-xs font-medium">{val}</span>;
  };

  const featureKeys = [
    { key: "users", label: "Usuários inclusos", icon: Users },
    { key: "connections", label: "Conexões", icon: Zap },
    { key: "channels", label: "Canais", icon: MessageCircle },
    { key: "chatbot_service", label: "Chatbots Atendimento", icon: Bot },
    { key: "chatbot_automation", label: "Chatbots Automação", icon: Bot },
    { key: "funnels", label: "Funis", icon: BarChart3 },
    { key: "crm", label: "CRM Integrado", icon: Users },
    { key: "webhook", label: "Webhooks", icon: Webhook },
  ];

  // Calculate totals for summary
  const getInvoiceTotal = () => {
    if (!selectedPlan) return 0;
    if (isUpgrade && currentPlan) {
      return Number(selectedPlan.price_monthly) - Number(currentPlan.price_monthly) + extraConnectionsMonthlyCost + extraActivationTotal + extraUsersMonthlyCost;
    }
    return Number(selectedPlan.price_monthly) + Number(selectedPlan.implementation_fee || 0) + extraConnectionsMonthlyCost + extraActivationTotal + extraUsersMonthlyCost;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* STEP 1: Plan showcase */}
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-green-600" />
                {isUpgrade ? "Upgrade de Plano WhatsApp" : "Planos de Atendimento WhatsApp"}
              </DialogTitle>
              <DialogDescription>
                {isUpgrade
                  ? "Escolha o plano superior para fazer upgrade."
                  : "Escolha o plano ideal para centralizar seu atendimento."}
              </DialogDescription>
            </DialogHeader>

            <div className={`grid gap-4 mt-4 ${availablePlans.length === 3 ? "grid-cols-1 md:grid-cols-3" : availablePlans.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
              {availablePlans.map((plan: any, idx: number) => {
                const isPopular = idx === 1 && availablePlans.length === 3;
                return (
                  <Card
                    key={plan.id}
                    className={`relative flex flex-col ${
                      isPopular ? "border-2 border-primary shadow-lg" : "border"
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground">
                          <Crown className="h-3 w-3 mr-1" /> Mais popular
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="text-center pb-2">
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <div className="mt-2">
                        <span className="text-3xl font-bold text-primary">{fmt(Number(plan.price_monthly))}</span>
                        <span className="text-sm text-muted-foreground">/mês</span>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-3">
                      <Separator />
                      {/* Feature list */}
                      <div className="space-y-2">
                        {featureKeys.map(({ key, label, icon: Icon }) => (
                          <div key={key} className="flex items-center gap-2 text-sm">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="flex-1 text-muted-foreground">{label}</span>
                            {getFeatureRow(plan, key, label)}
                          </div>
                        ))}
                      </div>

                      <Separator />

                      {/* Additional costs */}
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {plan.additional_user_cost > 0 && (
                          <p>Usuário extra: {fmt(Number(plan.additional_user_cost))}/mês</p>
                        )}
                        {plan.extra_whatsapp_cost > 0 && (
                          <p>WhatsApp extra: {fmt(Number(plan.extra_whatsapp_cost))}/mês</p>
                        )}
                        {plan.extra_social_cost > 0 && (
                          <p>IG/FB extra: {fmt(Number(plan.extra_social_cost))}/mês</p>
                        )}
                      </div>

                      <Separator />

                      {/* Fees */}
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {Number(plan.implementation_fee || 0) > 0 && (
                          <p>Implantação: {fmt(Number(plan.implementation_fee))}</p>
                        )}
                        {Number(plan.activation_fee_wpp || 0) > 0 && (
                          <p>Ativação WhatsApp Extra: {fmt(Number(plan.activation_fee_wpp))}/conexão</p>
                        )}
                      </div>

                      <Button
                        className="w-full mt-2"
                        variant={isPopular ? "default" : "outline"}
                        onClick={() => handleSelectPlan(plan.id)}
                      >
                        {isUpgrade ? "Fazer upgrade" : "Assine agora"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {/* STEP 2: Summary with extra connections option */}
        {step === 2 && selectedPlan && (
          <>
            <DialogHeader>
              <DialogTitle>Resumo da Contratação</DialogTitle>
              <DialogDescription>Confira os detalhes e escolha conexões extras se desejar.</DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-lg">{selectedPlan.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedPlan.included_users ?? selectedPlan.max_users} usuários · {selectedPlan.max_connections} conexões incluídas
                      </p>
                    </div>
                    <Badge variant="outline" className="text-primary border-primary">
                      Selecionado
                    </Badge>
                  </div>

                  <Separator />

                  {/* Extra connections chooser */}
                  {extraWppCost > 0 && (
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">Conexões WhatsApp extras</p>
                          <p className="text-xs text-muted-foreground">
                            Além das {selectedPlan.max_connections} conexões inclusas no plano. Cada conexão extra: {fmt(extraWppCost)}/mês
                            {activationFeePerExtra > 0 && ` + ${fmt(activationFeePerExtra)} de ativação`}.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={extraConnections <= 0}
                            onClick={() => setExtraConnections((v) => Math.max(0, v - 1))}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="font-bold text-lg w-8 text-center">{extraConnections}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setExtraConnections((v) => v + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {extraConnections > 0 && (
                        <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 rounded p-2">
                          <div className="flex justify-between">
                            <span>{extraConnections}x WhatsApp extra ({fmt(extraWppCost)}/mês cada)</span>
                            <span>{fmt(extraConnectionsMonthlyCost)}/mês</span>
                          </div>
                          {activationFeePerExtra > 0 && (
                            <div className="flex justify-between">
                              <span>{extraConnections}x Ativação WhatsApp Extra ({fmt(activationFeePerExtra)} cada)</span>
                              <span>{fmt(extraActivationTotal)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Extra users chooser */}
                  {extraUserCost > 0 && (
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">Usuários extras</p>
                          <p className="text-xs text-muted-foreground">
                            Além dos {selectedPlan.included_users ?? selectedPlan.max_users} usuários inclusos no plano. Cada usuário extra: {fmt(extraUserCost)}/mês.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={extraUsers <= 0}
                            onClick={() => setExtraUsers((v) => Math.max(0, v - 1))}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="font-bold text-lg w-8 text-center">{extraUsers}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setExtraUsers((v) => v + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {extraUsers > 0 && (
                        <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 rounded p-2">
                          <div className="flex justify-between">
                            <span>{extraUsers}x Usuário extra ({fmt(extraUserCost)}/mês cada)</span>
                            <span>{fmt(extraUsersMonthlyCost)}/mês</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <Separator />

                  {/* Itemized breakdown */}
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Discriminativo da primeira fatura:</p>
                    <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                      {isUpgrade && currentPlan ? (
                        <>
                          <div className="flex justify-between text-sm">
                            <span>Upgrade: {currentPlan.name} → {selectedPlan.name} (diferença mensal)</span>
                            <span className="font-semibold">{fmt(Number(selectedPlan.price_monthly) - Number(currentPlan.price_monthly))}</span>
                          </div>
                          {extraConnections > 0 && (
                            <>
                              <div className="flex justify-between text-sm">
                                <span>{extraConnections}x WhatsApp extra (mensal)</span>
                                <span className="font-semibold">{fmt(extraConnectionsMonthlyCost)}</span>
                              </div>
                              {activationFeePerExtra > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span>{extraConnections}x Ativação WhatsApp Extra</span>
                                  <span className="font-semibold">{fmt(extraActivationTotal)}</span>
                                </div>
                              )}
                            </>
                          )}
                          {extraUsers > 0 && (
                            <div className="flex justify-between text-sm">
                              <span>{extraUsers}x Usuário extra (mensal)</span>
                              <span className="font-semibold">{fmt(extraUsersMonthlyCost)}</span>
                            </div>
                          )}
                          <Separator />
                          <div className="flex justify-between text-sm font-bold">
                            <span>Total</span>
                            <span className="text-primary">{fmt(getInvoiceTotal())}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between text-sm">
                            <span>Plano {selectedPlan.name} - Atendimento WhatsApp (mensal)</span>
                            <span className="font-semibold">{fmt(Number(selectedPlan.price_monthly))}</span>
                          </div>
                          {Number(selectedPlan.implementation_fee || 0) > 0 && (
                            <div className="flex justify-between text-sm">
                              <span>Taxa de implantação</span>
                              <span className="font-semibold">{fmt(Number(selectedPlan.implementation_fee))}</span>
                            </div>
                          )}
                          {extraConnections > 0 && (
                            <>
                              <div className="flex justify-between text-sm">
                                <span>{extraConnections}x WhatsApp extra (mensal)</span>
                                <span className="font-semibold">{fmt(extraConnectionsMonthlyCost)}</span>
                              </div>
                              {activationFeePerExtra > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span>{extraConnections}x Ativação WhatsApp Extra</span>
                                  <span className="font-semibold">{fmt(extraActivationTotal)}</span>
                                </div>
                              )}
                            </>
                          )}
                          {extraUsers > 0 && (
                            <div className="flex justify-between text-sm">
                              <span>{extraUsers}x Usuário extra (mensal)</span>
                              <span className="font-semibold">{fmt(extraUsersMonthlyCost)}</span>
                            </div>
                          )}
                          <Separator />
                          <div className="flex justify-between text-sm font-bold">
                            <span>Total da primeira fatura</span>
                            <span className="text-primary">{fmt(getInvoiceTotal())}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Próximas faturas: {fmt(Number(selectedPlan.price_monthly) + extraConnectionsMonthlyCost + extraUsersMonthlyCost)}/mês
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
                <Button onClick={handleConfirmAndPay} disabled={processing} className="gap-2">
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Confirmar e pagar
                </Button>
              </div>
            </div>
          </>
        )}

        {/* STEP 3: Payment Method */}
        {step === 3 && (
          <>
            <DialogHeader>
              <DialogTitle>Método de Pagamento</DialogTitle>
              <DialogDescription>
                Valor: <strong>{fmt(result?.amount || 0)}</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Card
                className={`cursor-pointer transition-all hover:shadow-md ${
                  paymentMethod === "cartao" ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setPaymentMethod("cartao")}
              >
                <CardContent className="flex flex-col items-center justify-center p-6 gap-2">
                  <CreditCard className="h-10 w-10 text-primary" />
                  <p className="font-semibold">Cartão de Crédito</p>
                  <p className="text-xs text-muted-foreground text-center">Checkout seguro via Stripe</p>
                </CardContent>
              </Card>
              <Card
                className={`cursor-pointer transition-all hover:shadow-md ${
                  paymentMethod === "pix" ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setPaymentMethod("pix")}
              >
                <CardContent className="flex flex-col items-center justify-center p-6 gap-2">
                  <QrCode className="h-10 w-10 text-green-600" />
                  <p className="font-semibold">PIX</p>
                  <p className="text-xs text-muted-foreground text-center">Pagamento instantâneo</p>
                </CardContent>
              </Card>
            </div>
            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
              <Button
                disabled={!paymentMethod}
                onClick={() => setStep(4)}
                className="gap-2"
              >
                Continuar <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {/* STEP 4: Payment */}
        {step === 4 && (
          <>
            <DialogHeader>
              <DialogTitle>
                {paymentMethod === "cartao" ? "Pagamento com Cartão" : "Pagamento via PIX"}
              </DialogTitle>
              <DialogDescription>
                Valor: <strong>{fmt(result?.amount || 0)}</strong>
              </DialogDescription>
            </DialogHeader>

            {/* CARD */}
            {paymentMethod === "cartao" && !cardClientSecret && !cardPaid && (
              <div className="mt-4 space-y-4 text-center">
                {cardLoading ? (
                  <>
                    <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Preparando pagamento...</p>
                  </>
                ) : (
                  <>
                    <CreditCard className="h-16 w-16 mx-auto text-primary" />
                    <p className="text-sm text-muted-foreground">Clique para inserir os dados do cartão.</p>
                    <Button onClick={handleInitCardPayment} size="lg" className="gap-2">
                      <CreditCard className="h-4 w-4" /> Inserir dados do cartão
                    </Button>
                  </>
                )}
              </div>
            )}

            {paymentMethod === "cartao" && cardClientSecret && !cardPaid && (
              <div className="mt-4">
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret: cardClientSecret,
                    appearance: { theme: "stripe", variables: { borderRadius: "8px" } },
                  }}
                >
                  <ChatCardPaymentForm
                    amount={result?.amount || 0}
                    onSuccess={handleCardPaymentSuccess}
                    onBack={() => { setCardClientSecret(null); setStep(3); }}
                  />
                </Elements>
              </div>
            )}

            {paymentMethod === "cartao" && cardPaid && (
              <div className="mt-4 space-y-4 text-center">
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-600" />
                <p className="text-lg font-bold text-green-700">Pagamento confirmado!</p>
                <p className="text-sm text-muted-foreground">Sua assinatura WhatsApp está ativa.</p>
                <Button onClick={() => onOpenChange(false)}>Fechar</Button>
              </div>
            )}

            {/* PIX */}
            {paymentMethod === "pix" && !pixData && (
              <div className="mt-4 space-y-4 text-center">
                {pixLoading ? (
                  <>
                    <Loader2 className="h-12 w-12 mx-auto animate-spin text-green-600" />
                    <p className="text-sm text-muted-foreground">Gerando QR Code PIX...</p>
                  </>
                ) : (
                  <>
                    <QrCode className="h-16 w-16 mx-auto text-green-600" />
                    <p className="text-sm text-muted-foreground">Clique para gerar o QR Code PIX.</p>
                    <Button onClick={handlePayPix} size="lg" className="gap-2 bg-green-600 hover:bg-green-700">
                      <QrCode className="h-4 w-4" /> Gerar QR Code PIX
                    </Button>
                  </>
                )}
              </div>
            )}

            {paymentMethod === "pix" && pixData && !pixPaid && (
              <div className="mt-4 space-y-4 text-center">
                <ChatPixQrCode pixCopiaECola={pixData.qr_code} />
                {pixData.qr_code && (
                  <div className="flex items-center gap-2 justify-center">
                    <code className="text-xs bg-muted px-2 py-1 rounded max-w-[300px] truncate block">
                      {pixData.qr_code}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        navigator.clipboard.writeText(pixData.qr_code);
                        toast.success("Código copiado!");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                  <Clock className="h-4 w-4" />
                  <span>Expira em {formatCountdown(pixCountdown)}</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Aguardando confirmação do pagamento...</span>
                </div>
              </div>
            )}

            {paymentMethod === "pix" && pixPaid && (
              <div className="mt-4 space-y-4 text-center">
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-600" />
                <p className="text-lg font-bold text-green-700">Pagamento confirmado!</p>
                <p className="text-sm text-muted-foreground">Sua assinatura WhatsApp está ativa.</p>
                <Button onClick={() => onOpenChange(false)}>Fechar</Button>
              </div>
            )}

            {/* Back buttons */}
            {paymentMethod === "cartao" && !cardClientSecret && !cardLoading && !cardPaid && (
              <div className="flex justify-start mt-4">
                <Button variant="outline" onClick={() => setStep(3)}>Voltar</Button>
              </div>
            )}
            {paymentMethod === "pix" && !pixData && !pixLoading && (
              <div className="flex justify-start mt-4">
                <Button variant="outline" onClick={() => setStep(3)}>Voltar</Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── PIX QR Code Image ── */
function ChatPixQrCode({ pixCopiaECola }: { pixCopiaECola: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pixCopiaECola) return;
    QRCode.toDataURL(pixCopiaECola, { width: 256, margin: 2 })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [pixCopiaECola]);

  if (!pixCopiaECola || !dataUrl) {
    return (
      <div className="w-56 h-56 mx-auto rounded-lg border flex items-center justify-center bg-muted">
        <QrCode className="h-20 w-20 text-muted-foreground" />
      </div>
    );
  }

  return <img src={dataUrl} alt="QR Code PIX" className="w-56 h-56 mx-auto rounded-lg border" />;
}

/* ── Card Payment Form ── */
function ChatCardPaymentForm({
  amount,
  onSuccess,
  onBack,
}: {
  amount: number;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: "if_required",
      });
      if (error) {
        toast.error(error.message || "Erro ao processar pagamento.");
      } else if (paymentIntent?.status === "succeeded") {
        onSuccess();
      }
    } catch {
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg border bg-muted/50 p-4 flex justify-between items-center">
        <div>
          <p className="font-semibold">Assinatura WhatsApp</p>
          <p className="text-muted-foreground text-sm">Pagamento único</p>
        </div>
        <p className="text-xl font-bold">{fmt(amount)}</p>
      </div>
      <PaymentElement options={{ layout: "tabs" }} />
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack}>Voltar</Button>
        <Button type="submit" disabled={!stripe || loading} className="flex-1 gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {loading ? "Processando..." : "Confirmar pagamento"}
        </Button>
      </div>
    </form>
  );
}
