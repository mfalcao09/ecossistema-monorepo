import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import QRCode from "qrcode";
import {
  Crown, Check, ArrowRight, CreditCard, QrCode, Loader2, CheckCircle2,
  Clock, Copy, Sparkles, Users, Building2, Zap, AlertTriangle, MessageCircle,
  Plus, Minus, Home,
} from "lucide-react";
import { stripePromise } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useAddonProducts } from "@/hooks/useAddonProducts";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// Module labels for display
const ALL_MODULES: Record<string, string> = {
  dashboard: "Dashboard",
  imoveis: "Gestão de Imóveis",
  pessoas: "Cadastro de Pessoas",
  contratos: "Contratos",
  garantias: "Garantias Contratuais",
  comercial_basico: "Comercial Básico (Dashboard, Negócios, Pipeline)",
  comercial_intermediario: "Comercial Intermediário (+ Visitas, Disponibilidade, Avaliações)",
  comercial_completo: "Comercial Completo (+ Metas, Exclusividades, Automações, Relatórios)",
  financeiro_basico: "Financeiro Básico (Receitas, Despesas, Fluxo de Caixa)",
  financeiro_intermediario: "Financeiro Intermediário (+ Contas Bancárias, Centros de Custo)",
  financeiro_completo: "Financeiro Completo (+ Comissões, Repasses, DRE, IR, DIMOB)",
  relacionamento_basico: "Relacionamento Básico (Atendimento, Contratos, Rescisões)",
  relacionamento_intermediario: "Relacionamento Intermediário (+ Reajustes, Garantias, Seguros)",
  relacionamento_completo: "Relacionamento Completo (+ Satisfação, Comunicação, Automações)",
  juridico_intermediario: "Jurídico Intermediário (Análises, Due Diligence, Notificações)",
  juridico_completo: "Jurídico Completo (+ Modelos, Procurações, Processos, Compliance)",
  api: "API & Integrações",
  empreendimentos: "Lançamentos Imobiliários",
};

interface PixData {
  pix_charge_id: string | null;
  txid: string;
  qr_code: string;
  amount: number;
  expiration: number;
}

export default function MyPlan() {
  const { tenantId } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { hasProducts: hasAddonProducts } = useAddonProducts();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cartao" | "pix" | null>(null);
  const [processing, setProcessing] = useState(false);
  const [upgradeResult, setUpgradeResult] = useState<any>(null);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [pixPaid, setPixPaid] = useState(false);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixCountdown, setPixCountdown] = useState(0);
  const pixPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pixStartTimeRef = useRef<number>(0);
  const [existingInvoiceAlert, setExistingInvoiceAlert] = useState<any>(null);
  const [abandonAlert, setAbandonAlert] = useState(false);
  const [cancellingCharge, setCancellingCharge] = useState(false);

  // Extra resources state
  const [extraUsers, setExtraUsers] = useState(0);
  const [extraProperties, setExtraProperties] = useState(0);
  const [savingExtras, setSavingExtras] = useState<string | null>(null);

  // Current subscription
  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ["my-plan-subscription", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_subscriptions")
        .select("*, plans:plan_id(*)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // All active plans
  const { data: allPlans = [] } = useQuery({
    queryKey: ["all-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("active", true)
        .order("price_monthly", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Extra resources
  const { data: extraResources = [] } = useQuery({
    queryKey: ["my-extra-resources", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_extra_resources")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("status", "ativo");
      if (error) throw error;
      return data;
    },
  });

  const currentExtraUsers = extraResources.find((r: any) => r.resource_type === "users");
  const currentExtraProperties = extraResources.find((r: any) => r.resource_type === "properties");

  // Initialize extra resource counters from current data
  useEffect(() => {
    setExtraUsers((currentExtraUsers as any)?.quantity || 0);
  }, [currentExtraUsers]);
  useEffect(() => {
    setExtraProperties((currentExtraProperties as any)?.quantity || 0);
  }, [currentExtraProperties]);

  const currentPlan = subscription?.plans as any;
  const currentPlanPrice = Number(currentPlan?.price_monthly || 0);
  const isTrialPlan = currentPlan && Number(currentPlan.price_monthly) === 0;
  const isTrialExpired = isTrialPlan && subscription?.status !== "ativo";
  const paidPlans = allPlans.filter((p: any) => Number(p.price_monthly) > 0);
  const higherPlans = isTrialPlan
    ? paidPlans
    : allPlans.filter((p: any) => Number(p.price_monthly) > currentPlanPrice);
  const selectedPlan = allPlans.find((p: any) => p.id === selectedPlanId) as any;
  const isTopPlan = higherPlans.length === 0;

  // Days remaining
  const daysRemaining = subscription?.expires_at
    ? Math.max(0, Math.ceil((new Date(subscription.expires_at).getTime() - Date.now()) / 86400000))
    : 0;
  const freeUpgrade = daysRemaining <= 5;
  const upgradeValue = selectedPlan
    ? freeUpgrade ? 0 : Math.round((Number(selectedPlan.price_monthly) - currentPlanPrice) * 100) / 100
    : 0;

  // New modules the selected plan adds
  const getNewModules = () => {
    if (!currentPlan || !selectedPlan) return [];
    const current = (currentPlan.modules as string[]) || [];
    const target = (selectedPlan.modules as string[]) || [];
    return target.filter((m: string) => !current.includes(m));
  };

  // PIX polling & realtime
  const stopPixPolling = useCallback(() => {
    if (pixPollingRef.current) {
      clearInterval(pixPollingRef.current);
      pixPollingRef.current = null;
    }
  }, []);

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

  useEffect(() => {
    if (!pixData?.pix_charge_id || pixPaid) return;
    const channel = supabase
      .channel(`pix-upgrade-${pixData.pix_charge_id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "platform_pix_charges",
        filter: `id=eq.${pixData.pix_charge_id}`,
      }, (payload: any) => {
        if (payload.new?.status === "concluida") {
          setPixPaid(true);
          stopPixPolling();
          toast.success("Pagamento confirmado! Novo plano ativado.");
          qc.invalidateQueries({ queryKey: ["my-plan-subscription"] });
          qc.invalidateQueries({ queryKey: ["tenant-modules"] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [pixData?.pix_charge_id, pixPaid]);

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
          toast.success("Pagamento confirmado! Novo plano ativado.");
          qc.invalidateQueries({ queryKey: ["my-plan-subscription"] });
          qc.invalidateQueries({ queryKey: ["tenant-modules"] });
        }
      } catch { /* silent */ }
    }, 10_000);
    return () => stopPixPolling();
  }, [pixData?.pix_charge_id, pixPaid]);

  const resetDialog = () => {
    setStep(1);
    setSelectedPlanId(null);
    setPaymentMethod(null);
    setProcessing(false);
    setUpgradeResult(null);
    setPixData(null);
    setPixPaid(false);
    setPixLoading(false);
    setCardClientSecret(null);
    setCardPaid(false);
    setCardLoading(false);
    stopPixPolling();
  };

  const handleOpenUpgrade = () => {
    resetDialog();
    setUpgradeOpen(true);
  };

  const handleProcessUpgrade = async () => {
    if (!selectedPlanId) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-upgrade", {
        body: { target_plan_id: selectedPlanId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Check if backend returned existing invoice
      if (data?.existing_invoice) {
        setExistingInvoiceAlert(data);
        return;
      }

      setUpgradeResult(data);

      if (data.free_upgrade) {
        toast.success("Upgrade aplicado com sucesso! Próxima fatura com novo valor.");
        qc.invalidateQueries({ queryKey: ["my-plan-subscription"] });
        qc.invalidateQueries({ queryKey: ["tenant-modules"] });
        setUpgradeOpen(false);
        return;
      }
      setStep(3);
    } catch (e: any) {
      toast.error(e.message || "Erro ao processar upgrade");
    } finally {
      setProcessing(false);
    }
  };

  const [cardClientSecret, setCardClientSecret] = useState<string | null>(null);
  const [cardPaid, setCardPaid] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);

  const handleInitCardPayment = async () => {
    if (!upgradeResult?.invoice_id) return;
    setCardLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("pay-invoice", {
        body: { invoice_id: upgradeResult.invoice_id },
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
    if (!upgradeResult?.invoice_id) return;
    try {
      const { data, error } = await supabase.functions.invoke("verify-card-payment", {
        body: { invoice_id: upgradeResult.invoice_id },
      });
      if (!error && data?.status === "paid") {
        setCardPaid(true);
        toast.success("Pagamento confirmado! Novo plano ativado.");
        qc.invalidateQueries({ queryKey: ["my-plan-subscription"] });
        qc.invalidateQueries({ queryKey: ["tenant-modules"] });
      }
    } catch { /* silent */ }
  };

  const handlePayPix = async () => {
    if (!upgradeResult?.invoice_id) return;
    setPixLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("pay-invoice-pix", {
        body: { invoice_id: upgradeResult.invoice_id },
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

  const hasActiveCharge = !!(pixData && !pixPaid) || !!(cardClientSecret && !cardPaid);

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      if (hasActiveCharge && upgradeResult?.invoice_id) {
        setAbandonAlert(true);
        return;
      }
      resetDialog();
    }
    setUpgradeOpen(open);
  };

  const handleConfirmAbandon = async () => {
    if (!upgradeResult?.invoice_id) return;
    setCancellingCharge(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-upgrade-charge", {
        body: { invoice_id: upgradeResult.invoice_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Cobrança cancelada com sucesso.");
    } catch (e: any) {
      toast.error(e.message || "Erro ao cancelar cobrança");
    } finally {
      setCancellingCharge(false);
      setAbandonAlert(false);
      resetDialog();
      setUpgradeOpen(false);
    }
  };

  const handleSaveExtra = async (type: "users" | "properties") => {
    if (!tenantId) return;
    setSavingExtras(type);
    try {
      const quantity = type === "users" ? extraUsers : extraProperties;
      const pricePerUnit = type === "users" ? 99.90 : 19.90;
      const existing = type === "users" ? currentExtraUsers : currentExtraProperties;

      if (quantity <= 0 && existing) {
        // Cancel
        await supabase
          .from("tenant_extra_resources")
          .update({ quantity: 0, status: "cancelado" } as any)
          .eq("id", (existing as any).id);
      } else if (existing) {
        // Update
        await supabase
          .from("tenant_extra_resources")
          .update({ quantity, price_per_unit: pricePerUnit, status: "ativo" } as any)
          .eq("id", (existing as any).id);
      } else if (quantity > 0) {
        // Create
        await supabase
          .from("tenant_extra_resources")
          .insert({
            tenant_id: tenantId,
            resource_type: type,
            quantity,
            price_per_unit: pricePerUnit,
          } as any);
      }

      qc.invalidateQueries({ queryKey: ["my-extra-resources"] });
      qc.invalidateQueries({ queryKey: ["tenant-modules"] });
      toast.success("Recursos extras atualizados! Será refletido na próxima fatura.");
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar recursos extras.");
    } finally {
      setSavingExtras(null);
    }
  };

  if (subLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Crown className="h-6 w-6 text-amber-500" /> Meu Plano
        </h1>
        <p className="text-muted-foreground">Detalhes do seu plano atual e opções de upgrade.</p>
      </div>

      {/* Trial Expired Banner */}
      {isTrialExpired && (
        <div className="rounded-lg border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-5 flex items-start gap-4">
          <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-bold text-foreground">Seu período de teste expirou</h3>
            <p className="text-sm text-muted-foreground">
              Escolha um plano abaixo para continuar utilizando todas as funcionalidades da plataforma.
            </p>
          </div>
        </div>
      )}

      {/* Current Plan */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">{currentPlan?.name || "Sem plano"}</CardTitle>
              <CardDescription>Plano ativo da sua empresa</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary">{fmt(currentPlanPrice)}</div>
              <span className="text-sm text-muted-foreground">/mês</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Vencimento</div>
                <div className="font-medium text-sm">
                  {subscription?.expires_at
                    ? format(new Date(subscription.expires_at), "dd/MM/yyyy", { locale: ptBR })
                    : "—"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Máx. Usuários</div>
                <div className="font-medium text-sm">
                  {currentPlan?.max_users ?? "Ilimitado"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Máx. Imóveis</div>
                <div className="font-medium text-sm">
                  {currentPlan?.max_properties ?? "Ilimitado"}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-3 text-sm">Módulos inclusos no seu plano:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {((currentPlan?.modules as string[]) || []).map((mod: string) => (
                <div key={mod} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-600 shrink-0" />
                  <span>{ALL_MODULES[mod] || mod}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Extra Resources Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" /> Recursos Extras
          </CardTitle>
          <CardDescription>
            Adquira usuários e imóveis extras para seu sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Extra Users */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-sm">Usuários Extras</p>
                  <p className="text-xs text-muted-foreground">
                    Limite do plano: {currentPlan?.max_users ?? "∞"} 
                    {extraUsers > 0 && ` + ${extraUsers} extras = ${(currentPlan?.max_users || 0) + extraUsers}`}
                  </p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">R$ 99,90 / cada / mês</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setExtraUsers(Math.max(0, extraUsers - 1))}
                disabled={extraUsers <= 0}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="font-bold text-lg w-12 text-center">{extraUsers}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setExtraUsers(extraUsers + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground flex-1">
                {extraUsers > 0 ? fmt(extraUsers * 99.90) + "/mês" : "Nenhum extra"}
              </span>
              {extraUsers !== ((currentExtraUsers as any)?.quantity || 0) && (
                <Button
                  size="sm"
                  onClick={() => handleSaveExtra("users")}
                  disabled={savingExtras === "users"}
                >
                  {savingExtras === "users" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
                </Button>
              )}
            </div>
          </div>

          {/* Extra Properties */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Home className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-sm">Imóveis Extras</p>
                  <p className="text-xs text-muted-foreground">
                    Limite do plano: {currentPlan?.max_properties ?? "∞"}
                    {extraProperties > 0 && ` + ${extraProperties} extras = ${(currentPlan?.max_properties || 0) + extraProperties}`}
                  </p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">R$ 19,90 / cada / mês</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setExtraProperties(Math.max(0, extraProperties - 10))}
                disabled={extraProperties <= 0}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="font-bold text-lg w-12 text-center">{extraProperties}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setExtraProperties(extraProperties + 10)}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground flex-1">
                {extraProperties > 0 ? fmt(extraProperties * 19.90) + "/mês" : "Nenhum extra"}
              </span>
              {extraProperties !== ((currentExtraProperties as any)?.quantity || 0) && (
                <Button
                  size="sm"
                  onClick={() => handleSaveExtra("properties")}
                  disabled={savingExtras === "properties"}
                >
                  {savingExtras === "properties" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Banner */}
      {!isTopPlan && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-bold">Conheça os planos superiores</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {higherPlans.map((plan: any) => {
              const isTopTier = plan.id === allPlans[allPlans.length - 1]?.id;
              const newModules = ((plan.modules as string[]) || []).filter(
                (m: string) => !((currentPlan?.modules as string[]) || []).includes(m)
              );
              return (
                <Card
                  key={plan.id}
                  className={`relative overflow-hidden ${
                    isTopTier
                      ? "border-2 border-amber-400 shadow-lg shadow-amber-100"
                      : "border"
                  }`}
                >
                  {isTopTier && (
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-amber-500 text-white">
                        <Crown className="h-3 w-3 mr-1" /> Recomendado
                      </Badge>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    <div className="text-2xl font-bold text-primary">
                      {fmt(Number(plan.price_monthly))}
                      <span className="text-sm font-normal text-muted-foreground">/mês</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>
                        <Users className="h-4 w-4 inline mr-1" />
                        {plan.max_users ?? "Ilimitado"} usuários
                      </span>
                      <span>
                        <Building2 className="h-4 w-4 inline mr-1" />
                        {plan.max_properties ?? "Ilimitado"} imóveis
                      </span>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">
                        Vantagens adicionais ao seu plano:
                      </p>
                      {newModules.map((mod: string) => (
                        <div key={mod} className="flex items-center gap-2 text-sm mb-1">
                          <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span>{ALL_MODULES[mod] || mod}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex justify-center pt-2">
            <Button size="lg" onClick={handleOpenUpgrade} className="gap-2 text-base px-8">
              <Sparkles className="h-5 w-5" />
              Faça agora seu Upgrade!
            </Button>
          </div>
        </div>
      )}

      {isTopPlan && (
        <Card className="border-amber-400 border-2">
          <CardContent className="flex items-center gap-3 p-6">
            <Crown className="h-8 w-8 text-amber-500" />
            <div>
              <p className="font-bold">Você já está no plano mais completo!</p>
              <p className="text-sm text-muted-foreground">Aproveite todos os recursos disponíveis.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Módulos Extras Banner */}
      {hasAddonProducts && (
        <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-primary/10 p-3">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-lg">Adquira módulos extras</p>
              <p className="text-sm text-muted-foreground">
                Amplie as capacidades do seu sistema com módulos adicionais como Atendimento WhatsApp e muito mais.
              </p>
            </div>
            <Button className="gap-2" onClick={() => navigate("/modulos-extras")}>
              <ArrowRight className="h-4 w-4" /> Ver módulos disponíveis
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ===== Upgrade Dialog ===== */}
      <Dialog open={upgradeOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Step 1: Choose Plan */}
          {step === 1 && (
            <>
              <DialogHeader>
                <DialogTitle>Escolha seu novo plano</DialogTitle>
                <DialogDescription>Selecione o plano para o qual deseja migrar.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 mt-4">
                {higherPlans.map((plan: any) => {
                  const isTopTier = plan.id === allPlans[allPlans.length - 1]?.id;
                  return (
                    <Card
                      key={plan.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedPlanId === plan.id
                          ? "ring-2 ring-primary border-primary"
                          : isTopTier
                          ? "border-amber-400"
                          : ""
                      }`}
                      onClick={() => setSelectedPlanId(plan.id)}
                    >
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          {isTopTier && <Crown className="h-5 w-5 text-amber-500" />}
                          <div>
                            <p className="font-semibold">{plan.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {plan.max_users ?? "∞"} usuários · {plan.max_properties ?? "∞"} imóveis
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">{fmt(Number(plan.price_monthly))}</div>
                          <span className="text-xs text-muted-foreground">/mês</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <div className="flex justify-end mt-4">
                <Button disabled={!selectedPlanId} onClick={() => setStep(2)} className="gap-2">
                  Continuar <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {/* Step 2: Comparison */}
          {step === 2 && selectedPlan && (
            <>
              <DialogHeader>
                <DialogTitle>Evolução do Plano</DialogTitle>
                <DialogDescription>Veja o que muda com o upgrade.</DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-muted/50">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Plano Atual</p>
                      <p className="font-bold text-lg">{currentPlan?.name}</p>
                      <p className="text-xl font-bold text-muted-foreground">{fmt(currentPlanPrice)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-primary border-2">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-primary mb-1">Novo Plano</p>
                      <p className="font-bold text-lg">{selectedPlan.name}</p>
                      <p className="text-xl font-bold text-primary">{fmt(Number(selectedPlan.price_monthly))}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* New modules */}
                <div>
                  <h4 className="font-semibold text-sm mb-2">O que você ganha a mais:</h4>
                  <div className="space-y-1">
                    {getNewModules().map((mod) => (
                      <div key={mod} className="flex items-center gap-2 text-sm">
                        <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                        <span>{ALL_MODULES[mod] || mod}</span>
                      </div>
                    ))}
                    {selectedPlan.max_users !== currentPlan?.max_users && (
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-blue-500" />
                        <span>Até {selectedPlan.max_users ?? "Ilimitado"} usuários (era {currentPlan?.max_users ?? "∞"})</span>
                      </div>
                    )}
                    {selectedPlan.max_properties !== currentPlan?.max_properties && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-blue-500" />
                        <span>Até {selectedPlan.max_properties ?? "Ilimitado"} imóveis (era {currentPlan?.max_properties ?? "∞"})</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Pricing */}
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Pagamento hoje:</span>
                    <span className="font-bold text-lg">
                      {freeUpgrade ? "Grátis (próximo da renovação)" : fmt(upgradeValue)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Próxima fatura mensal:</span>
                    <span className="font-bold">{fmt(Number(selectedPlan.price_monthly))}/mês</span>
                  </div>
                  {freeUpgrade && (
                    <p className="text-xs text-green-600 mt-1">
                      Sua renovação está a {daysRemaining} dia(s). O upgrade será aplicado agora e a próxima fatura já virá com o novo valor.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-between mt-4">
                <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
                <Button onClick={handleProcessUpgrade} disabled={processing} className="gap-2">
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {freeUpgrade ? "Ativar Upgrade" : "Continuar para Pagamento"}
                </Button>
              </div>
            </>
          )}

          {/* Step 3: Payment Method */}
          {step === 3 && (
            <>
              <DialogHeader>
                <DialogTitle>Método de Pagamento</DialogTitle>
                <DialogDescription>
                  Valor do upgrade: <strong>{fmt(upgradeResult?.amount || upgradeValue)}</strong>
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

          {/* Step 4: Payment */}
          {step === 4 && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {paymentMethod === "cartao" ? "Pagamento com Cartão" : "Pagamento via PIX"}
                </DialogTitle>
                <DialogDescription>
                  Valor: <strong>{fmt(upgradeResult?.amount || upgradeValue)}</strong>
                </DialogDescription>
              </DialogHeader>

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
                      <p className="text-sm text-muted-foreground">
                        Clique para inserir os dados do cartão.
                      </p>
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
                      appearance: {
                        theme: "stripe",
                        variables: {
                          borderRadius: "8px",
                        },
                      },
                    }}
                  >
                    <CardPaymentForm
                      amount={upgradeResult?.amount || upgradeValue}
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
                  <p className="text-sm text-muted-foreground">
                    Seu novo plano já está ativo. Aproveite os novos recursos!
                  </p>
                  <Button onClick={() => setUpgradeOpen(false)}>Fechar</Button>
                </div>
              )}

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
                      <p className="text-sm text-muted-foreground">
                        Clique para gerar o QR Code PIX.
                      </p>
                      <Button onClick={handlePayPix} size="lg" className="gap-2 bg-green-600 hover:bg-green-700">
                        <QrCode className="h-4 w-4" /> Gerar QR Code PIX
                      </Button>
                    </>
                  )}
                </div>
              )}

              {paymentMethod === "pix" && pixData && !pixPaid && (
                <div className="mt-4 space-y-4 text-center">
                  <PixQrCodeImage pixCopiaECola={pixData.qr_code} />
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
                  <p className="text-sm text-muted-foreground">
                    Seu novo plano já está ativo. Aproveite os novos recursos!
                  </p>
                  <Button onClick={() => setUpgradeOpen(false)}>Fechar</Button>
                </div>
              )}

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

      {/* Existing Invoice AlertDialog */}
      <AlertDialog open={!!existingInvoiceAlert} onOpenChange={(open) => { if (!open) setExistingInvoiceAlert(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Fatura de upgrade já existente
            </AlertDialogTitle>
            <AlertDialogDescription>
              Já existe uma fatura de upgrade em aberto no valor de{" "}
              <strong>{fmt(existingInvoiceAlert?.amount || 0)}</strong>.
              Realize o pagamento da fatura existente para concluir o upgrade.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setExistingInvoiceAlert(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setExistingInvoiceAlert(null);
              setUpgradeOpen(false);
              resetDialog();
              navigate("/faturas");
            }}>
              Ir para Faturas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Abandon Checkout AlertDialog */}
      <AlertDialog open={abandonAlert} onOpenChange={setAbandonAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Abandonar pagamento?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você tem uma cobrança em andamento. Ao sair, a cobrança será cancelada
              e a fatura será baixada. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancellingCharge}>
              Voltar ao pagamento
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAbandon}
              disabled={cancellingCharge}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancellingCharge ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Cancelando...</>
              ) : (
                "Sim, cancelar cobrança"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
/* ── PIX QR Code Image (generated client-side from pixCopiaECola) ── */
function PixQrCodeImage({ pixCopiaECola }: { pixCopiaECola: string }) {
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

  return (
    <img
      src={dataUrl}
      alt="QR Code PIX"
      className="w-56 h-56 mx-auto rounded-lg border"
    />
  );
}

/* ── Card Payment Form (inside Elements provider) ── */
function CardPaymentForm({
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
        confirmParams: {
          return_url: window.location.href,
        },
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
          <p className="font-semibold">Upgrade de Plano</p>
          <p className="text-muted-foreground text-sm">Pagamento único</p>
        </div>
        <p className="text-xl font-bold">{fmt(amount)}</p>
      </div>

      <PaymentElement options={{ layout: "tabs" }} />

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button type="submit" disabled={!stripe || loading} className="flex-1 gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {loading ? "Processando..." : "Confirmar pagamento"}
        </Button>
      </div>
    </form>
  );
}
