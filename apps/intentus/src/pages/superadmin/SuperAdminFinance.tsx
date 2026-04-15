import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DollarSign, Search, MoreHorizontal, Plus, Eye, Check, X, Printer,
  ArrowUpRight, ArrowDownRight, AlertTriangle, Wallet,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { format, startOfMonth, endOfMonth, addMonths, subDays, isAfter, isBefore, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  aberta: { label: "Aberta", variant: "secondary" },
  quitada: { label: "Quitada", variant: "default" },
  vencida: { label: "Vencida", variant: "destructive" },
  cancelada: { label: "Cancelada", variant: "outline" },
};

interface InvoiceItem {
  date?: string;
  description: string;
  quantity: number;
  requester?: string;
  amount: number;
}

export default function SuperAdminFinance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tenantFilter, setTenantFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [genForm, setGenForm] = useState({
    tenant_id: "",
    reference_month: format(new Date(), "yyyy-MM"),
    extra_items: [] as InvoiceItem[],
    notes: "",
    bulk: false,
  });

  // Fetch tenants
  const { data: tenants = [] } = useQuery({
    queryKey: ["sa-finance-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("id, name, cnpj, settings").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch subscriptions with plan info
  const { data: subscriptions = [] } = useQuery({
    queryKey: ["sa-finance-subs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_subscriptions")
        .select("*, plans(name, price_monthly)")
        .eq("status", "ativo");
      if (error) throw error;
      return data;
    },
  });

  // Fetch addon subscriptions for all tenants
  const { data: allAddonSubs = [] } = useQuery({
    queryKey: ["sa-finance-addon-subs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_addon_subscriptions")
        .select("*")
        .eq("status", "ativo");
      if (error) throw error;
      return data;
    },
  });

  // Fetch extra resources for all tenants
  const { data: allExtraResources = [] } = useQuery({
    queryKey: ["sa-finance-extra-resources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_extra_resources")
        .select("*")
        .eq("status", "ativo");
      if (error) throw error;
      return data;
    },
  });

  // Fetch invoices
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["sa-finance-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_invoices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const getTenantName = (tenantId: string) => tenants.find((t) => t.id === tenantId)?.name || "—";
  const getTenantSettings = (tenantId: string) => {
    const t = tenants.find((t) => t.id === tenantId);
    return typeof t?.settings === "object" ? (t.settings as any) : {};
  };

  // KPIs
  const totalFaturado = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalRecebido = invoices.filter((i) => i.status === "quitada").reduce((s, i) => s + Number(i.paid_amount || i.amount || 0), 0);
  const totalAberto = invoices.filter((i) => i.status === "aberta").reduce((s, i) => s + Number(i.amount || 0) - Number(i.discount || 0), 0);
  const totalVencido = invoices.filter((i) => i.status === "vencida").reduce((s, i) => s + Number(i.amount || 0) - Number(i.discount || 0), 0);

  // Period date range
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

  // Filters
  const filtered = invoices.filter((inv) => {
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (tenantFilter !== "all" && inv.tenant_id !== tenantFilter) return false;
    // Period filter on due_date
    const { from, to } = getPeriodRange();
    if (from && isBefore(parseISO(inv.due_date), from)) return false;
    if (to && isAfter(parseISO(inv.due_date), to)) return false;
    if (search) {
      const name = getTenantName(inv.tenant_id).toLowerCase();
      return name.includes(search.toLowerCase()) || String(inv.invoice_number).includes(search);
    }
    return true;
  });

  // Mutations
  const markPaid = useMutation({
    mutationFn: async (invoice: any) => {
      const { error } = await supabase.from("tenant_invoices").update({
        status: "quitada",
        paid_at: new Date().toISOString(),
        paid_amount: Number(invoice.amount) - Number(invoice.discount || 0),
        payment_method: "manual",
      } as any).eq("id", invoice.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sa-finance-invoices"] });
      toast.success("Fatura marcada como paga!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tenant_invoices").update({ status: "cancelada" } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sa-finance-invoices"] });
      toast.success("Fatura cancelada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateInvoice = useMutation({
    mutationFn: async () => {
      const targetTenants = genForm.bulk
        ? tenants.filter((t) => subscriptions.some((s: any) => s.tenant_id === t.id))
        : tenants.filter((t) => t.id === genForm.tenant_id);

      if (targetTenants.length === 0) throw new Error("Nenhuma empresa selecionada.");

      const refDate = genForm.reference_month + "-01";
      const dueDate = format(addMonths(new Date(refDate), 0), "yyyy-MM") + "-10";

      for (const tenant of targetTenants) {
        const sub = subscriptions.find((s: any) => s.tenant_id === tenant.id) as any;
        const planPrice = sub?.plans?.price_monthly || 0;
        const planName = sub?.plans?.name || "Plano";

        const items: InvoiceItem[] = [
          {
            date: refDate,
            description: `Assinatura ${planName} - ${format(new Date(refDate), "MMMM/yyyy", { locale: ptBR })}`,
            quantity: 1,
            amount: planPrice,
          },
        ];

        // Add addon subscriptions
        const tenantAddons = allAddonSubs.filter((a: any) => a.tenant_id === tenant.id);
        for (const addon of tenantAddons) {
          items.push({
            date: refDate,
            description: `Add-on: ${(addon as any).name}`,
            quantity: (addon as any).quantity || 1,
            amount: Number((addon as any).price_monthly) || 0,
          });
        }

        // Add extra resources
        const tenantExtras = allExtraResources.filter((r: any) => r.tenant_id === tenant.id && (r as any).quantity > 0);
        for (const extra of tenantExtras) {
          const label = (extra as any).resource_type === "users" ? "Usuários Extras" : "Imóveis Extras";
          items.push({
            date: refDate,
            description: label,
            quantity: (extra as any).quantity,
            amount: Number((extra as any).price_per_unit) || 0,
          });
        }

        // Add manual extra items
        items.push(...genForm.extra_items);

        const totalAmount = items.reduce((s, i) => s + i.amount * i.quantity, 0);

        const { error } = await supabase.from("tenant_invoices").insert({
          tenant_id: tenant.id,
          subscription_id: sub?.id || null,
          reference_date: refDate,
          due_date: dueDate,
          amount: totalAmount,
          discount: 0,
          status: "aberta",
          items: items as any,
          notes: genForm.notes || null,
          created_by: user?.id,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sa-finance-invoices"] });
      toast.success("Fatura(s) gerada(s) com sucesso!");
      setGenerateOpen(false);
      setGenForm({ tenant_id: "", reference_month: format(new Date(), "yyyy-MM"), extra_items: [], notes: "", bulk: false });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openDetail = (inv: any) => {
    setSelectedInvoice(inv);
    setDetailOpen(true);
  };

  const kpis = [
    { label: "Total Faturado", value: totalFaturado, icon: DollarSign, color: "text-primary" },
    { label: "Total Recebido", value: totalRecebido, icon: ArrowUpRight, color: "text-green-600" },
    { label: "Total em Aberto", value: totalAberto, icon: Wallet, color: "text-yellow-600" },
    { label: "Total Vencido", value: totalVencido, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground">Gestão de faturas e cobranças dos tenants.</p>
        </div>
        <Button onClick={() => setGenerateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />Gerar Fatura
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">{kpi.label}</span>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <div className="text-xl font-bold mt-1">{fmt(kpi.value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por empresa ou nº fatura..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={tenantFilter} onValueChange={setTenantFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
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
                <TableHead>Empresa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Quitação</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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
                        <TableCell className="font-medium">{getTenantName(inv.tenant_id)}</TableCell>
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDetail(inv)}>
                                <Eye className="h-4 w-4 mr-2" />Visualizar Fatura
                              </DropdownMenuItem>
                              {inv.status === "aberta" || inv.status === "vencida" ? (
                                <>
                                  <DropdownMenuItem onClick={() => markPaid.mutate(inv)}>
                                    <Check className="h-4 w-4 mr-2" />Marcar como Paga
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive" onClick={() => cancelInvoice.mutate(inv.id)}>
                                    <X className="h-4 w-4 mr-2" />Cancelar
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={3}>Total</TableCell>
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
          {selectedInvoice && <InvoiceDetail
            invoice={selectedInvoice}
            tenantName={getTenantName(selectedInvoice.tenant_id)}
            tenantSettings={getTenantSettings(selectedInvoice.tenant_id)}
            tenantCnpj={tenants.find((t) => t.id === selectedInvoice.tenant_id)?.cnpj}
          />}
        </DialogContent>
      </Dialog>

      {/* Generate Invoice Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerar Fatura</DialogTitle>
            <DialogDescription>Crie faturas para uma ou todas as empresas ativas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="bulk"
                checked={genForm.bulk}
                onChange={(e) => setGenForm({ ...genForm, bulk: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="bulk">Gerar em lote (todas as empresas ativas)</Label>
            </div>

            {!genForm.bulk && (
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Select value={genForm.tenant_id} onValueChange={(v) => setGenForm({ ...genForm, tenant_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Mês de Referência</Label>
              <Input
                type="month"
                value={genForm.reference_month}
                onChange={(e) => setGenForm({ ...genForm, reference_month: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={genForm.notes}
                onChange={(e) => setGenForm({ ...genForm, notes: e.target.value })}
                placeholder="Opcional..."
                rows={2}
              />
            </div>

            {genForm.tenant_id && !genForm.bulk && (() => {
              const sub = subscriptions.find((s: any) => s.tenant_id === genForm.tenant_id) as any;
              if (!sub) return <p className="text-sm text-muted-foreground">Empresa sem assinatura ativa.</p>;
              const tenantAddons = allAddonSubs.filter((a: any) => a.tenant_id === genForm.tenant_id);
              const tenantExtras = allExtraResources.filter((r: any) => r.tenant_id === genForm.tenant_id && (r as any).quantity > 0);
              const addonTotal = tenantAddons.reduce((s: number, a: any) => s + (Number(a.price_monthly) * (a.quantity || 1)), 0);
              const extrasTotal = tenantExtras.reduce((s: number, r: any) => s + (Number(r.price_per_unit) * r.quantity), 0);
              const total = (sub.plans?.price_monthly || 0) + addonTotal + extrasTotal;
              return (
                <div className="rounded-md border p-3 bg-muted/30 text-sm space-y-1">
                  <div><span className="font-medium">Plano:</span> {sub.plans?.name || "—"} — {fmt(sub.plans?.price_monthly || 0)}</div>
                  {tenantAddons.length > 0 && (
                    <div><span className="font-medium">Add-ons:</span> {tenantAddons.length} módulo(s) — {fmt(addonTotal)}</div>
                  )}
                  {tenantExtras.length > 0 && tenantExtras.map((r: any) => (
                    <div key={r.id}>
                      <span className="font-medium">{r.resource_type === "users" ? "Usuários Extras" : "Imóveis Extras"}:</span>{" "}
                      {r.quantity}x — {fmt(r.quantity * Number(r.price_per_unit))}
                    </div>
                  ))}
                  <Separator className="my-1" />
                  <div><span className="font-bold">Total estimado:</span> {fmt(total)}</div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancelar</Button>
            <Button
              disabled={generateInvoice.isPending || (!genForm.bulk && !genForm.tenant_id)}
              onClick={() => generateInvoice.mutate()}
            >
              {generateInvoice.isPending ? "Gerando..." : "Gerar Fatura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Invoice Detail Sub-component ── */
function InvoiceDetail({
  invoice,
  tenantName,
  tenantSettings,
  tenantCnpj,
}: {
  invoice: any;
  tenantName: string;
  tenantSettings: any;
  tenantCnpj?: string;
}) {
  const st = statusConfig[invoice.status] || statusConfig.aberta;
  const items: InvoiceItem[] = Array.isArray(invoice.items) ? invoice.items : [];
  const subtotal = items.reduce((s, i) => s + i.amount * (i.quantity || 1), 0);
  const discount = Number(invoice.discount || 0);
  const total = subtotal - discount;

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
        {/* Beneficiary */}
        <div className="space-y-1">
          <h4 className="font-semibold text-xs uppercase text-muted-foreground tracking-wider">Beneficiário</h4>
          <p className="font-medium">Casa Conexão Mágica</p>
          <p className="text-muted-foreground text-xs">Plataforma de Gestão Imobiliária</p>
        </div>

        {/* Client */}
        <div className="space-y-1">
          <h4 className="font-semibold text-xs uppercase text-muted-foreground tracking-wider">Cliente</h4>
          <p className="font-medium">{tenantName}</p>
          {tenantSettings?.razaoSocial && <p className="text-xs text-muted-foreground">{tenantSettings.razaoSocial}</p>}
          {tenantCnpj && <p className="text-xs text-muted-foreground">CNPJ: {tenantCnpj}</p>}
          {tenantSettings?.email && <p className="text-xs text-muted-foreground">{tenantSettings.email}</p>}
        </div>
      </div>

      <Separator />

      {/* Items */}
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

      {/* Totals */}
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

      <div className="flex justify-end print:hidden">
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />Imprimir Fatura
        </Button>
      </div>
    </div>
  );
}
