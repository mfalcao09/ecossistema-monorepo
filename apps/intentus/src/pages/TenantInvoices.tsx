import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import {
  Eye, Search, CreditCard, QrCode, Printer, DollarSign, Wallet, AlertTriangle,
  ArrowUpRight, FileText, Copy, Loader2, CheckCircle2, Clock, Crown, MessageCircle,
  Check, ExternalLink, CalendarClock, Receipt,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { format, startOfMonth, endOfMonth, addMonths, subDays, isAfter, isBefore, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useSearchParams, useNavigate } from "react-router-dom";
import { stripePromise } from "@/lib/stripe";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  aberta: { label: "Aberta", variant: "secondary" },
  quitada: { label: "Quitada", variant: "default" },
  vencida: { label: "Vencida", variant: "destructive" },
  cancelada: { label: "Cancelada", variant: "outline" },
};

const subStatusLabels: Record<string, { label: string; color: string }> = {
  ativo: { label: "Ativa", color: "bg-green-100 text-green-800" },
  ativa: { label: "Ativa", color: "bg-green-100 text-green-800" },
  trial: { label: "Trial", color: "bg-blue-100 text-blue-800" },
  expirado: { label: "Vencida", color: "bg-red-100 text-red-800" },
  cancelado: { label: "Cancelada", color: "bg-muted text-muted-foreground" },
};

interface InvoiceItem {
  date?: string;
  description: string;
  quantity: number;
  requester?: string;
  amount: number;
}

interface PixData {
  pix_charge_id: string | null;
  txid: string;
  qr_code: string;
  qr_code_base64: string;
  amount: number;
  expiration: number;
}

export default function TenantInvoices() {
  const { user, tenantName, tenantId } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [cardClientSecret, setCardClientSecret] = useState<string | null>(null);
  const [cardPaid, setCardPaid] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardInvoice, setCardInvoice] = useState<any>(null);
  const [pixDialogOpen, setPixDialogOpen] = useState(false);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [pixPaid, setPixPaid] = useState(false);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixCountdown, setPixCountdown] = useState(0);
  const pixPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pixStartTimeRef = useRef<number>(0);

  // ── Subscription queries ──
  const { data: subscription } = useQuery({
    queryKey: ["my-subscription", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("tenant_subscriptions")
        .select("*, plans:plan_id(*)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: chatSubscription } = useQuery({
    queryKey: ["my-chat-subscription", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_subscriptions")
        .select("*, chat_plans:chat_plan_id(*)")
        .eq("tenant_id", tenantId!)
        .eq("status", "ativo")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Cleanup polling on unmount or dialog close
  const stopPixPolling = useCallback(() => {
    if (pixPollingRef.current) {
      clearInterval(pixPollingRef.current);
      pixPollingRef.current = null;
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!pixDialogOpen || !pixData || pixPaid) return;
    pixStartTimeRef.current = Date.now();
    setPixCountdown(pixData.expiration);
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - pixStartTimeRef.current) / 1000);
      const remaining = Math.max(0, pixData.expiration - elapsed);
      setPixCountdown(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [pixDialogOpen, pixData, pixPaid]);

  // Realtime subscription for PIX payment confirmation
  useEffect(() => {
    if (!pixDialogOpen || !pixData?.pix_charge_id || pixPaid) return;
    const channel = supabase
      .channel(`pix-payment-${pixData.pix_charge_id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "platform_pix_charges",
          filter: `id=eq.${pixData.pix_charge_id}`,
        },
        (payload: any) => {
          if (payload.new?.status === "concluida") {
            setPixPaid(true);
            stopPixPolling();
            toast.success("Pagamento PIX confirmado! Assinatura reativada.");
            qc.invalidateQueries({ queryKey: ["tenant-invoices"] });
            qc.invalidateQueries({ queryKey: ["tenant-modules"] });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [pixDialogOpen, pixData?.pix_charge_id, pixPaid]);

  // Polling fallback every 10s
  useEffect(() => {
    if (!pixDialogOpen || !pixData?.pix_charge_id || pixPaid) return;
    pixPollingRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-pix-status", {
          body: { pix_charge_id: pixData.pix_charge_id },
        });
        if (!error && data?.paid) {
          setPixPaid(true);
          stopPixPolling();
          toast.success("Pagamento PIX confirmado! Assinatura reativada.");
          qc.invalidateQueries({ queryKey: ["tenant-invoices"] });
          qc.invalidateQueries({ queryKey: ["tenant-modules"] });
        }
      } catch { /* silent */ }
    }, 10_000);
    return () => stopPixPolling();
  }, [pixDialogOpen, pixData?.pix_charge_id, pixPaid]);

  // Reset pix state when dialog closes
  useEffect(() => {
    if (!pixDialogOpen) {
      setPixPaid(false);
      setPixData(null);
      stopPixPolling();
    }
  }, [pixDialogOpen]);

  // Check for paid param (Stripe redirect) and verify payment
  useEffect(() => {
    const paidId = searchParams.get("paid");
    if (paidId) {
      toast.info("Verificando pagamento...");
      supabase.functions.invoke("verify-invoice-payment", {
        body: { invoice_id: paidId },
      }).then(({ data, error }) => {
        if (error) {
          toast.error("Erro ao verificar pagamento");
        } else if (data?.status === "paid") {
          toast.success("Pagamento confirmado! Fatura quitada.");
          qc.invalidateQueries({ queryKey: ["tenant-invoices"] });
          qc.invalidateQueries({ queryKey: ["tenant-modules"] });
        } else if (data?.status === "already_paid") {
          toast.success("Fatura já está quitada.");
        } else {
          toast.info("Pagamento ainda em processamento. Atualize em alguns minutos.");
        }
      });
    }
  }, [searchParams]);

  // Fetch invoices for this tenant
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["tenant-invoices"],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
        .single();
      let query = supabase
        .from("tenant_invoices")
        .select("*")
        .order("created_at", { ascending: false });
      if (profile?.tenant_id) {
        query = query.eq("tenant_id", profile.tenant_id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // ── Payer KPIs ──
  const proximaFatura = invoices
    .filter(i => i.status === "aberta")
    .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))[0];

  const totalAberto = invoices
    .filter(i => ["aberta", "vencida"].includes(i.status))
    .reduce((s, i) => s + Number(i.amount || 0) - Number(i.discount || 0), 0);

  const totalPago = invoices
    .filter(i => i.status === "quitada")
    .reduce((s, i) => s + Number(i.paid_amount || i.amount || 0), 0);

  const faturasVencidas = invoices.filter(i => i.status === "vencida").length;

  // Subscription helpers
  const plan = subscription?.plans as any;
  const planModules: string[] = plan?.modules && Array.isArray(plan.modules) ? plan.modules : [];
  const subStatus = subscription?.status || "none";
  const subStatusInfo = subStatusLabels[subStatus] || { label: subStatus, color: "bg-muted text-muted-foreground" };
  const chatPlan = chatSubscription?.chat_plans as any;

  // Period
  const getPeriodRange = (): { from: Date | null; to: Date | null } => {
    const now = new Date();
    switch (periodFilter) {
      case "30d": return { from: subDays(now, 30), to: now };
      case "60d": return { from: subDays(now, 60), to: now };
      case "90d": return { from: subDays(now, 90), to: now };
      case "this_month": return { from: startOfMonth(now), to: endOfMonth(now) };
      case "last_month": {
        const lm = addMonths(now, -1);
        return { from: startOfMonth(lm), to: endOfMonth(lm) };
      }
      case "custom":
        return {
          from: customDateFrom ? parseISO(customDateFrom) : null,
          to: customDateTo ? parseISO(customDateTo) : null,
        };
      default: return { from: null, to: null };
    }
  };

  const filtered = invoices.filter((inv) => {
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    const { from, to } = getPeriodRange();
    if (from && isBefore(parseISO(inv.due_date), from)) return false;
    if (to && isAfter(parseISO(inv.due_date), to)) return false;
    if (search) return String(inv.invoice_number).includes(search);
    return true;
  });

  // Pay with Stripe Elements (card)
  const handlePayCard = async (invoice: any) => {
    setCardInvoice(invoice);
    setCardClientSecret(null);
    setCardPaid(false);
    setCardLoading(true);
    setCardDialogOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke("pay-invoice", {
        body: { invoice_id: invoice.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.clientSecret) throw new Error("clientSecret não retornado");
      setCardClientSecret(data.clientSecret);
    } catch (e: any) {
      toast.error(e.message || "Erro ao iniciar pagamento");
      setCardDialogOpen(false);
    } finally {
      setCardLoading(false);
    }
  };

  const handleCardPaymentSuccess = async () => {
    if (!cardInvoice) return;
    try {
      const { data, error } = await supabase.functions.invoke("verify-card-payment", {
        body: { invoice_id: cardInvoice.id },
      });
      if (!error && data?.status === "paid") {
        setCardPaid(true);
        toast.success("Pagamento confirmado! Fatura quitada.");
        qc.invalidateQueries({ queryKey: ["tenant-invoices"] });
        qc.invalidateQueries({ queryKey: ["tenant-modules"] });
      }
    } catch { /* silent */ }
  };

  // Pay with PIX - generate real QR code
  const handlePayPix = async (invoice: any) => {
    setPixLoading(true);
    setPixData(null);
    setPixDialogOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke("pay-invoice-pix", {
        body: { invoice_id: invoice.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPixData(data as PixData);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar PIX");
      setPixDialogOpen(false);
    } finally {
      setPixLoading(false);
    }
  };

  const canPay = (inv: any) => inv.status === "aberta" || inv.status === "vencida";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Faturas</h1>
        <p className="text-muted-foreground">Acompanhe suas assinaturas e pague as faturas da sua empresa.</p>
      </div>

      {/* ── Seção 1: Resumo das Assinaturas ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            Suas Assinaturas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 divide-y">
          {/* Plano Principal */}
          {plan ? (
            <div className="pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Crown className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{plan.name}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${subStatusInfo.color}`}>
                        {subStatusInfo.label}
                      </span>
                    </div>
                    {subscription?.expires_at && (
                      <p className="text-xs text-muted-foreground">
                        Vence em: {format(new Date(subscription.expires_at), "dd/MM/yyyy")}
                      </p>
                    )}
                    {planModules.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {planModules.slice(0, 6).map((mod: string) => (
                          <span key={mod} className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                            <Check className="h-3 w-3 text-green-600" />
                            {mod}
                          </span>
                        ))}
                        {planModules.length > 6 && (
                          <span className="text-xs text-muted-foreground">+{planModules.length - 6}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-lg">{fmt(plan.price_monthly || 0)}<span className="text-xs text-muted-foreground font-normal">/mês</span></p>
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => navigate("/meu-plano")}>
                    Gerenciar Plano <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="pb-4">
              <p className="text-sm text-muted-foreground">Nenhum plano ativo.</p>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs mt-1" onClick={() => navigate("/meu-plano")}>
                Ver planos disponíveis <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}

          {/* Módulos Extras */}
          {chatPlan ? (
            <div className="pt-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                    <MessageCircle className="h-4 w-4 text-green-700" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">WhatsApp — {chatPlan.name}</span>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800">
                        Ativo
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {chatPlan.max_users} usuários · {chatPlan.max_connections} conexões
                      {chatPlan.has_crm && " · CRM"}
                      {chatPlan.has_webhook && " · Webhooks"}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-lg">{fmt(chatPlan.price_monthly || 0)}<span className="text-xs text-muted-foreground font-normal">/mês</span></p>
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => navigate("/modulos-extras")}>
                    Gerenciar <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="pt-4">
              <p className="text-sm text-muted-foreground">Nenhum módulo extra contratado.</p>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs mt-1" onClick={() => navigate("/modulos-extras")}>
                Ver módulos disponíveis <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Seção 2: KPIs do Pagador ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Próxima Fatura</span>
              <CalendarClock className="h-4 w-4 text-primary" />
            </div>
            {proximaFatura ? (
              <>
                <div className="text-xl font-bold mt-1">{fmt(Number(proximaFatura.amount || 0) - Number(proximaFatura.discount || 0))}</div>
                <p className="text-xs text-muted-foreground">Vence {format(new Date(proximaFatura.due_date), "dd/MM/yyyy")}</p>
              </>
            ) : (
              <div className="text-xl font-bold mt-1 text-muted-foreground">—</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Total em Aberto</span>
              <Wallet className="h-4 w-4 text-yellow-600" />
            </div>
            <div className="text-xl font-bold mt-1">{fmt(totalAberto)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Total Pago</span>
              <ArrowUpRight className="h-4 w-4 text-green-600" />
            </div>
            <div className="text-xl font-bold mt-1">{fmt(totalPago)}</div>
            <p className="text-xs text-muted-foreground">Histórico</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Faturas Vencidas</span>
              <AlertTriangle className={`h-4 w-4 ${faturasVencidas > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            </div>
            <div className={`text-xl font-bold mt-1 ${faturasVencidas > 0 ? "text-destructive" : ""}`}>{faturasVencidas}</div>
            {faturasVencidas > 0 && <p className="text-xs text-destructive">Atenção!</p>}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nº da fatura..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="aberta">Aberta</SelectItem>
            <SelectItem value="quitada">Quitada</SelectItem>
            <SelectItem value="vencida">Vencida</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={periodFilter} onValueChange={(v) => { setPeriodFilter(v); if (v !== "custom") { setCustomDateFrom(""); setCustomDateTo(""); } }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo período</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="60d">Últimos 60 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
            <SelectItem value="this_month">Mês atual</SelectItem>
            <SelectItem value="last_month">Mês anterior</SelectItem>
            <SelectItem value="custom">Entre datas</SelectItem>
          </SelectContent>
        </Select>
        {periodFilter === "custom" && (
          <>
            <Input type="date" value={customDateFrom} onChange={(e) => setCustomDateFrom(e.target.value)} className="w-40" />
            <span className="text-muted-foreground text-sm">até</span>
            <Input type="date" value={customDateTo} onChange={(e) => setCustomDateTo(e.target.value)} className="w-40" />
          </>
        )}
        <Badge variant="secondary">{filtered.length} faturas</Badge>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-muted-foreground text-center py-12">Carregando...</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Quitação</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhuma fatura encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {filtered.map((inv) => {
                    const st = statusConfig[inv.status] || statusConfig.aberta;
                    const net = Number(inv.amount || 0) - Number(inv.discount || 0);
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs">#{inv.invoice_number}</TableCell>
                        <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                        <TableCell className="text-right font-medium">{fmt(net)}</TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(inv.reference_date), "MMM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-sm">{format(new Date(inv.due_date), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="text-sm">
                          {inv.paid_at ? format(new Date(inv.paid_at), "dd/MM/yyyy") : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedInvoice(inv); setDetailOpen(true); }} title="Ver detalhes">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canPay(inv) && (
                              <>
                                <Button
                                  variant="ghost" size="icon" className="h-8 w-8 text-primary"
                                  onClick={() => handlePayCard(inv)}
                                  disabled={payingId === inv.id}
                                  title="Pagar com Cartão"
                                >
                                  <CreditCard className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon" className="h-8 w-8 text-green-600"
                                  onClick={() => handlePayPix(inv)}
                                  title="Pagar com PIX"
                                >
                                  <QrCode className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right">
                      {fmt(filtered.reduce((s, i) => s + Number(i.amount || 0) - Number(i.discount || 0), 0))}
                    </TableCell>
                    <TableCell colSpan={4} />
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Invoice Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl print:max-w-full print:shadow-none print:border-none">
          {selectedInvoice && (
            <TenantInvoiceDetail
              invoice={selectedInvoice}
              tenantName={tenantName || "Minha Empresa"}
              onPayCard={() => handlePayCard(selectedInvoice)}
              onPayPix={() => { setDetailOpen(false); handlePayPix(selectedInvoice); }}
              paying={payingId === selectedInvoice?.id}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* PIX QR Code Dialog */}
      <Dialog open={pixDialogOpen} onOpenChange={(open) => { if (!open) { stopPixPolling(); } setPixDialogOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {pixPaid ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <QrCode className="h-5 w-5 text-green-600" />
              )}
              {pixPaid ? "Pagamento Confirmado!" : "Pagamento via PIX"}
            </DialogTitle>
            {!pixPaid && (
              <DialogDescription>
                Escaneie o QR Code ou copie o código PIX para pagar.
              </DialogDescription>
            )}
          </DialogHeader>

          {pixPaid ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-lg font-bold text-green-700">Pagamento recebido!</p>
                <p className="text-sm text-muted-foreground">Sua fatura foi quitada e a assinatura reativada.</p>
              </div>
              <Button onClick={() => setPixDialogOpen(false)} className="mt-2">Fechar</Button>
            </div>
          ) : pixLoading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-green-600" />
              <p className="text-sm text-muted-foreground">Gerando cobrança PIX...</p>
            </div>
          ) : pixData ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                {pixData.qr_code_base64 ? (
                  <img
                    src={pixData.qr_code_base64.startsWith("data:") ? pixData.qr_code_base64 : `data:image/png;base64,${pixData.qr_code_base64}`}
                    alt="QR Code PIX"
                    className="w-56 h-56 rounded-lg border"
                  />
                ) : (
                  <div className="w-56 h-56 rounded-lg border bg-muted flex items-center justify-center text-muted-foreground text-sm text-center p-4">
                    QR Code indisponível. Use o código copia-e-cola abaixo.
                  </div>
                )}
              </div>

              <div className="text-center">
                <p className="text-2xl font-bold text-green-700">{fmt(pixData.amount)}</p>
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className={`text-xs font-medium ${pixCountdown < 300 ? "text-destructive" : "text-muted-foreground"}`}>
                    {pixCountdown > 0
                      ? `Expira em ${Math.floor(pixCountdown / 60)}:${String(pixCountdown % 60).padStart(2, "0")}`
                      : "QR Code expirado"}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Aguardando confirmação do pagamento...</p>
              </div>

              {pixData.qr_code && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">PIX Copia e Cola</p>
                  <div className="relative">
                    <Input
                      readOnly
                      value={pixData.qr_code}
                      className="pr-10 text-xs font-mono"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full w-10"
                      onClick={() => {
                        navigator.clipboard.writeText(pixData.qr_code);
                        toast.success("Código PIX copiado!");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center">
                O pagamento será confirmado automaticamente em tempo real.
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Card Payment Dialog */}
      <Dialog open={cardDialogOpen} onOpenChange={(open) => {
        if (!open) { setCardClientSecret(null); setCardPaid(false); setCardInvoice(null); }
        setCardDialogOpen(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {cardPaid ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <CreditCard className="h-5 w-5 text-primary" />
              )}
              {cardPaid ? "Pagamento Confirmado!" : "Pagamento com Cartão"}
            </DialogTitle>
            {!cardPaid && (
              <DialogDescription>
                Insira os dados do cartão para pagar a fatura.
              </DialogDescription>
            )}
          </DialogHeader>

          {cardPaid ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-lg font-bold text-green-700">Pagamento recebido!</p>
                <p className="text-sm text-muted-foreground">Sua fatura foi quitada com sucesso.</p>
              </div>
              <Button onClick={() => setCardDialogOpen(false)} className="mt-2">Fechar</Button>
            </div>
          ) : cardLoading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Preparando pagamento...</p>
            </div>
          ) : cardClientSecret ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret: cardClientSecret,
                appearance: {
                  theme: "stripe",
                  variables: { borderRadius: "8px" },
                },
              }}
            >
              <InvoiceCardPaymentForm
                invoice={cardInvoice}
                onSuccess={handleCardPaymentSuccess}
                onBack={() => setCardDialogOpen(false)}
              />
            </Elements>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Invoice Detail Sub-component ── */
function TenantInvoiceDetail({
  invoice,
  tenantName,
  onPayCard,
  onPayPix,
  paying,
}: {
  invoice: any;
  tenantName: string;
  onPayCard: () => void;
  onPayPix: () => void;
  paying: boolean;
}) {
  const st = statusConfig[invoice.status] || statusConfig.aberta;
  const items: InvoiceItem[] = Array.isArray(invoice.items) ? invoice.items : [];
  const subtotal = items.reduce((s, i) => s + i.amount * (i.quantity || 1), 0);
  const discount = Number(invoice.discount || 0);
  const total = subtotal - discount;
  const canPay = invoice.status === "aberta" || invoice.status === "vencida";

  return (
    <div className="space-y-5">
      <DialogHeader>
        <DialogTitle className="flex items-center justify-between">
          <span>Fatura #{invoice.invoice_number}</span>
          <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
        </DialogTitle>
        <DialogDescription>
          Vencimento: {format(new Date(invoice.due_date), "dd/MM/yyyy")}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-6 text-sm">
        <div className="space-y-1">
          <h4 className="font-semibold text-xs uppercase text-muted-foreground tracking-wider">Beneficiário</h4>
          <p className="font-medium">Casa Conexão Mágica</p>
          <p className="text-muted-foreground text-xs">Plataforma de Gestão Imobiliária</p>
        </div>
        <div className="space-y-1">
          <h4 className="font-semibold text-xs uppercase text-muted-foreground tracking-wider">Cliente</h4>
          <p className="font-medium">{tenantName}</p>
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="font-semibold text-xs uppercase text-muted-foreground tracking-wider mb-2">Demonstrativo</h4>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-center w-20">Qtd</TableHead>
                <TableHead className="text-right w-32">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground text-sm">Sem itens.</TableCell>
                </TableRow>
              ) : (
                items.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-sm">{item.description}</TableCell>
                    <TableCell className="text-center text-sm">{item.quantity || 1}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(item.amount * (item.quantity || 1))}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 text-sm">
        <div className="flex gap-8">
          <span className="text-muted-foreground">Subtotal:</span>
          <span>{fmt(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex gap-8">
            <span className="text-muted-foreground">Desconto:</span>
            <span className="text-green-600">-{fmt(discount)}</span>
          </div>
        )}
        <Separator className="w-48 my-1" />
        <div className="flex gap-8 font-bold text-base">
          <span>Total:</span>
          <span>{fmt(total)}</span>
        </div>
      </div>

      {invoice.notes && (
        <>
          <Separator />
          <div className="text-sm">
            <span className="font-medium">Observações:</span>
            <p className="text-muted-foreground mt-1">{invoice.notes}</p>
          </div>
        </>
      )}

      <div className="flex items-center justify-between print:hidden">
        <div className="flex gap-2">
          {canPay && (
            <>
              <Button onClick={onPayCard} disabled={paying} className="gap-2">
                <CreditCard className="h-4 w-4" />
                {paying ? "Processando..." : "Pagar com Cartão"}
              </Button>
              <Button variant="outline" onClick={onPayPix} className="gap-2 text-green-700 border-green-300 hover:bg-green-50">
                <QrCode className="h-4 w-4" />
                Pagar com PIX
              </Button>
            </>
          )}
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />Imprimir
        </Button>
      </div>
    </div>
  );
}

/* ── Card Payment Form for Invoices (inside Elements provider) ── */
function InvoiceCardPaymentForm({
  invoice,
  onSuccess,
  onBack,
}: {
  invoice: any;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const net = Number(invoice?.amount || 0) - Number(invoice?.discount || 0);

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
          <p className="font-semibold">Fatura #{invoice?.invoice_number}</p>
          <p className="text-muted-foreground text-sm">Pagamento único</p>
        </div>
        <p className="text-xl font-bold">{fmt(net)}</p>
      </div>

      <PaymentElement options={{ layout: "tabs" }} />

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!stripe || loading} className="flex-1 gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {loading ? "Processando..." : "Confirmar pagamento"}
        </Button>
      </div>
    </form>
  );
}
