import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatCpfCnpj, isValidCpfCnpj } from "@/lib/cpfCnpjValidation";
import {
  Plus, FileText, QrCode, Copy, Eye, AlertTriangle, Receipt,
  CreditCard, CheckCircle2, FileBarChart, HandCoins, ChevronLeft,
  ChevronRight, Calendar, TrendingUp, DollarSign, Clock, XCircle,
} from "lucide-react";
import {
  useBankCredentials, useBoletos, useCreateBoleto, usePixCharges,
  useCreatePixCharge, useCreateManualInvoice, useMarkInvoicePaid,
} from "@/hooks/useBankIntegration";
import { useTenantModules } from "@/hooks/useTenantModules";
import { useGenerateRecurringInstallments } from "@/hooks/useContracts";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isAfter, isBefore, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const boletoStatusLabels: Record<string, string> = {
  emitido: "Emitido", registrado: "Registrado", pago: "Pago", cancelado: "Cancelado", vencido: "Vencido",
};
const boletoStatusColors: Record<string, string> = {
  emitido: "bg-blue-100 text-blue-800", registrado: "bg-cyan-100 text-cyan-800",
  pago: "bg-green-100 text-green-800", cancelado: "bg-red-100 text-red-800", vencido: "bg-amber-100 text-amber-800",
};
const pixStatusLabels: Record<string, string> = {
  ativa: "Ativa", concluida: "Concluída", cancelada: "Cancelada", expirada: "Expirada",
};
const contractTypeLabels: Record<string, string> = { locacao: "Locação", venda: "Venda" };

export default function FinanceIssuedInvoices() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tab, setTab] = useState("faturas");
  const [boletoDialog, setBoletoDialog] = useState(false);
  const [pixDialog, setPixDialog] = useState(false);
  const [manualDialog, setManualDialog] = useState(false);
  const [baixaDialog, setBaixaDialog] = useState(false);
  const [genDialog, setGenDialog] = useState(false);
  const [boletoPreFill, setBoletoPreFill] = useState<any>(null);
  const [manualPreFill, setManualPreFill] = useState<any>(null);
  const [baixaInstallment, setBaixaInstallment] = useState<any>(null);

  const monthStart = startOfMonth(currentMonth).toISOString().slice(0, 10);
  const monthEnd = endOfMonth(currentMonth).toISOString().slice(0, 10);
  const monthLabel = format(currentMonth, "MMMM yyyy", { locale: ptBR });

  const openBoletoFromInstallment = (installment: any) => {
    const payer = installment.contracts?.contract_parties?.find(
      (p: any) => ["locatario", "inquilino", "comprador"].includes(p.role)
    );
    setBoletoPreFill({
      amount: String(installment.amount),
      due_date: installment.due_date,
      payer_name: payer?.people?.name || "",
      payer_document: payer?.people?.document || "",
      installment_id: installment.id,
    });
    setBoletoDialog(true);
  };

  const openManualFromInstallment = (installment: any) => {
    const payer = installment.contracts?.contract_parties?.find(
      (p: any) => ["locatario", "inquilino", "comprador"].includes(p.role)
    );
    setManualPreFill({
      amount: String(installment.amount),
      due_date: installment.due_date,
      payer_name: payer?.people?.name || "",
      payer_document: payer?.people?.document || "",
      installment_id: installment.id,
    });
    setManualDialog(true);
  };

  const openBaixa = (installment: any) => {
    setBaixaInstallment(installment);
    setBaixaDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Faturas</h1>
          <p className="text-sm text-muted-foreground">Controle de faturamento por competência mensal</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setGenDialog(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />Gerar Mensalidades
        </Button>
      </div>

      {/* Month navigator */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 min-w-[160px] justify-center">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold capitalize text-base">{monthLabel}</span>
        </div>
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setCurrentMonth(new Date())}>
          Mês atual
        </Button>
      </div>

      {/* KPIs */}
      <MonthKpiCards monthStart={monthStart} monthEnd={monthEnd} />

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="faturas"><Receipt className="h-3.5 w-3.5 mr-1" />Faturas do Mês</TabsTrigger>
          <TabsTrigger value="boletos"><FileText className="h-3.5 w-3.5 mr-1" />Boletos Emitidos</TabsTrigger>
          <TabsTrigger value="pix"><QrCode className="h-3.5 w-3.5 mr-1" />PIX</TabsTrigger>
        </TabsList>

        <TabsContent value="faturas">
          <InvoicesTab
            monthStart={monthStart}
            monthEnd={monthEnd}
            onEmitBoleto={openBoletoFromInstallment}
            onManualInvoice={openManualFromInstallment}
            onBaixa={openBaixa}
          />
        </TabsContent>
        <TabsContent value="boletos">
          <BoletosTab
            monthStart={monthStart}
            monthEnd={monthEnd}
            onEmitApi={() => { setBoletoPreFill(null); setBoletoDialog(true); }}
            onEmitManual={() => { setManualPreFill(null); setManualDialog(true); }}
          />
        </TabsContent>
        <TabsContent value="pix"><PixTab onEmit={() => setPixDialog(true)} /></TabsContent>
      </Tabs>

      <BoletoFormDialog open={boletoDialog} onOpenChange={setBoletoDialog} preFill={boletoPreFill} />
      <ManualInvoiceDialog open={manualDialog} onOpenChange={setManualDialog} preFill={manualPreFill} />
      <PixFormDialog open={pixDialog} onOpenChange={setPixDialog} />
      <BaixaDialog open={baixaDialog} onOpenChange={setBaixaDialog} installment={baixaInstallment} />
      <GenerateInstallmentsDialog open={genDialog} onOpenChange={setGenDialog} />
    </div>
  );
}

// ─── Month KPI Cards ───
function MonthKpiCards({ monthStart, monthEnd }: { monthStart: string; monthEnd: string }) {
  const { data: installments = [] } = useQuery({
    queryKey: ["month-installments-kpis", monthStart, monthEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from("contract_installments")
        .select("id, amount, status, due_date")
        .gte("due_date", monthStart)
        .lte("due_date", monthEnd);
      return data ?? [];
    },
  });

  const { data: boletos = [] } = useQuery({
    queryKey: ["month-boletos-count", monthStart, monthEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from("boletos")
        .select("installment_id, status")
        .gte("due_date", monthStart)
        .lte("due_date", monthEnd);
      return data ?? [];
    },
  });

  const total = installments.reduce((s: number, i: any) => s + Number(i.amount), 0);
  const recebido = installments.filter((i: any) => i.status === "pago").reduce((s: number, i: any) => s + Number(i.amount), 0);
  const now = new Date().toISOString().slice(0, 10);
  const atrasado = installments
    .filter((i: any) => i.status !== "pago" && i.status !== "cancelado" && i.due_date < now)
    .reduce((s: number, i: any) => s + Number(i.amount), 0);
  const pendente = installments
    .filter((i: any) => i.status === "pendente" && i.due_date >= now)
    .reduce((s: number, i: any) => s + Number(i.amount), 0);

  const withBoleto = new Set(boletos.filter((b: any) => b.installment_id).map((b: any) => b.installment_id)).size;
  const semCobranca = installments.filter((i: any) => i.status !== "pago").length - withBoleto;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Card>
        <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" />Total do Mês</CardTitle></CardHeader>
        <CardContent className="px-4 pb-4"><div className="text-xl font-bold">{fmt(total)}</div><p className="text-xs text-muted-foreground">{installments.length} faturas</p></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-600" />Recebido</CardTitle></CardHeader>
        <CardContent className="px-4 pb-4"><div className="text-xl font-bold text-green-600">{fmt(recebido)}</div></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3 text-amber-500" />Pendente</CardTitle></CardHeader>
        <CardContent className="px-4 pb-4"><div className="text-xl font-bold text-amber-600">{fmt(pendente)}</div></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-500" />Atrasado</CardTitle></CardHeader>
        <CardContent className="px-4 pb-4"><div className="text-xl font-bold text-red-600">{fmt(atrasado)}</div></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1"><XCircle className="h-3 w-3 text-muted-foreground" />Sem Cobrança</CardTitle></CardHeader>
        <CardContent className="px-4 pb-4"><div className="text-xl font-bold text-muted-foreground">{semCobranca > 0 ? semCobranca : 0}</div><p className="text-xs text-muted-foreground">sem boleto/manual</p></CardContent>
      </Card>
    </div>
  );
}

// ─── Invoices Tab (main) ───
function InvoicesTab({
  monthStart, monthEnd, onEmitBoleto, onManualInvoice, onBaixa
}: {
  monthStart: string; monthEnd: string;
  onEmitBoleto: (i: any) => void;
  onManualInvoice: (i: any) => void;
  onBaixa: (i: any) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { hasModule } = useTenantModules();
  const canUseAPI = hasModule("integracao_bancaria");

  const { data: installments = [], isLoading } = useQuery({
    queryKey: ["month-faturas", monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_installments")
        .select("*, contracts:contract_id(id, contract_type, properties:property_id(title), contract_parties(role, people:person_id(name, document)))")
        .gte("due_date", monthStart)
        .lte("due_date", monthEnd)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []).filter((i: any) => i.contracts && ["locacao", "venda"].includes(i.contracts.contract_type));
    },
  });

  const { data: boletosData = [] } = useQuery({
    queryKey: ["month-boletos-map", monthStart, monthEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from("boletos")
        .select("id, installment_id, status, payer_name")
        .gte("due_date", monthStart)
        .lte("due_date", monthEnd);
      return data ?? [];
    },
  });

  // Map installment_id → boleto
  const boletoMap = useMemo(() => {
    const map: Record<string, any> = {};
    boletosData.forEach((b: any) => { if (b.installment_id) map[b.installment_id] = b; });
    return map;
  }, [boletosData]);

  const now = new Date().toISOString().slice(0, 10);

  const getComputedStatus = (i: any) => {
    if (i.status === "pago") return "pago";
    if (i.due_date < now) return "atrasado";
    return "pendente";
  };

  const statusLabels: Record<string, string> = { pago: "Pago", pendente: "Pendente", atrasado: "Atrasado" };
  const statusColors: Record<string, string> = {
    pago: "bg-green-100 text-green-800",
    pendente: "bg-amber-100 text-amber-800",
    atrasado: "bg-red-100 text-red-800",
  };

  const filtered = useMemo(() => {
    return installments.filter((i: any) => {
      const cs = getComputedStatus(i);
      if (statusFilter !== "all" && cs !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const payer = i.contracts?.contract_parties?.find((p: any) => ["locatario", "inquilino", "comprador"].includes(p.role));
        const payerName = payer?.people?.name || "";
        const property = i.contracts?.properties?.title || "";
        if (!payerName.toLowerCase().includes(s) && !property.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [installments, statusFilter, search]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-base">Faturas do Mês</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <Input placeholder="Buscar pagador ou imóvel..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vencimento</TableHead>
              <TableHead>Imóvel</TableHead>
              <TableHead>Pagador</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Boleto</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>Nenhuma fatura neste mês</p>
                  <p className="text-xs mt-1">Use "Gerar Mensalidades" para criar faturas a partir dos contratos ativos</p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((i: any) => {
                const payer = i.contracts?.contract_parties?.find((p: any) => ["locatario", "inquilino", "comprador"].includes(p.role));
                const boleto = boletoMap[i.id];
                const cs = getComputedStatus(i);
                const isPago = i.status === "pago";

                return (
                  <TableRow key={i.id} className={isPago ? "opacity-70" : ""}>
                    <TableCell className="font-medium">{format(new Date(i.due_date + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{i.contracts?.properties?.title || "—"}</TableCell>
                    <TableCell>{payer?.people?.name || "—"}</TableCell>
                    <TableCell className="font-medium">{fmt(Number(i.amount))}</TableCell>
                    <TableCell>
                      {boleto ? (
                        <Badge className={`text-[10px] ${boletoStatusColors[boleto.status] || ""}`}>
                          {boletoStatusLabels[boleto.status] || boleto.status}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem boleto</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${statusColors[cs] || ""}`}>{statusLabels[cs] || cs}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {!isPago && !boleto && canUseAPI && (
                          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onEmitBoleto(i)}>
                            <FileText className="h-3 w-3 mr-1" />Emitir Boleto
                          </Button>
                        )}
                        {!isPago && !boleto && (
                          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => onManualInvoice(i)}>
                            <HandCoins className="h-3 w-3 mr-1" />Manual
                          </Button>
                        )}
                        {!isPago && (
                          <Button variant="ghost" size="sm" className="text-xs h-7 text-green-700 hover:text-green-800 hover:bg-green-50" onClick={() => onBaixa(i)}>
                            <CheckCircle2 className="h-3 w-3 mr-1" />Dar Baixa
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Boletos Tab ───
function BoletosTab({ monthStart, monthEnd, onEmitApi, onEmitManual }: {
  monthStart: string; monthEnd: string;
  onEmitApi: () => void; onEmitManual: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { hasModule } = useTenantModules();
  const canUseAPI = hasModule("integracao_bancaria");
  const { data: boletos = [], isLoading } = useQuery({
    queryKey: ["boletos-tab-month", monthStart, monthEnd, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("boletos")
        .select("*")
        .gte("due_date", monthStart)
        .lte("due_date", monthEnd)
        .order("created_at", { ascending: false });
      if (statusFilter && statusFilter !== "all") q = q.eq("status", statusFilter as any);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
  const markPaid = useMarkInvoicePaid();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-base">Boletos Emitidos</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(boletoStatusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          {canUseAPI && (
            <Button size="sm" onClick={onEmitApi}><Plus className="h-3.5 w-3.5 mr-1" />Emitir Boleto</Button>
          )}
          <Button size="sm" variant="outline" onClick={onEmitManual}><HandCoins className="h-3.5 w-3.5 mr-1" />Nova Fatura Manual</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pagador</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : boletos.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum boleto neste mês</TableCell></TableRow>
            ) : boletos.map((b: any) => (
              <TableRow key={b.id} className={b.status === "pago" ? "bg-green-50/50 dark:bg-green-950/10" : ""}>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{b.payer_name}</p>
                    <p className="text-xs text-muted-foreground">{b.payer_document}</p>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{fmt(Number(b.amount))}</TableCell>
                <TableCell>{format(new Date(b.due_date + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">{(b as any).manual ? "Manual" : "API"}</Badge>
                </TableCell>
                <TableCell><Badge className={boletoStatusColors[b.status] || ""}>{boletoStatusLabels[b.status] || b.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {b.status !== "pago" && (b as any).manual && (
                      <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => markPaid.mutate({ boletoId: b.id, installment_id: b.installment_id, paid_amount: Number(b.amount) })} disabled={markPaid.isPending}>
                        <CheckCircle2 className="h-3 w-3 mr-1" />Marcar Pago
                      </Button>
                    )}
                    {b.linha_digitavel && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(b.linha_digitavel); toast.success("Linha digitável copiada!"); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {b.pdf_url && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <a href={b.pdf_url} target="_blank" rel="noopener"><Eye className="h-3.5 w-3.5" /></a>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── PIX Tab ───
function PixTab({ onEmit }: { onEmit: () => void }) {
  const { data: charges = [], isLoading } = usePixCharges();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Cobranças PIX</CardTitle>
        <Button size="sm" onClick={onEmit}><Plus className="h-3.5 w-3.5 mr-1" />Criar Cobrança PIX</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>TXID</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Pagador</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>QR Code</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : charges.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma cobrança PIX</TableCell></TableRow>
            ) : charges.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.txid || "—"}</TableCell>
                <TableCell className="font-medium">{fmt(Number(c.amount))}</TableCell>
                <TableCell>{c.payer_name || "—"}</TableCell>
                <TableCell><Badge variant="outline">{pixStatusLabels[c.status] || c.status}</Badge></TableCell>
                <TableCell>
                  {c.qr_code && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(c.qr_code); toast.success("QR Code copiado!"); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Baixa Dialog ───
function BaixaDialog({ open, onOpenChange, installment }: { open: boolean; onOpenChange: (v: boolean) => void; installment: any }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ paid_amount: "", payment_date: new Date().toISOString().slice(0, 10), payment_method: "dinheiro" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!installment) return;
    if (!form.paid_amount || !form.payment_date) { toast.error("Preencha os campos obrigatórios"); return; }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("contract_installments")
        .update({
          status: "pago",
          paid_amount: Number(form.paid_amount),
          payment_date: form.payment_date,
        })
        .eq("id", installment.id);
      if (error) throw error;
      toast.success("Baixa registrada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["month-faturas"] });
      queryClient.invalidateQueries({ queryKey: ["month-installments-kpis"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar baixa");
    } finally {
      setLoading(false);
    }
  };

  if (!installment) return null;
  const payer = installment.contracts?.contract_parties?.find((p: any) => ["locatario", "inquilino", "comprador"].includes(p.role));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Dar Baixa na Fatura</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md bg-muted px-3 py-2 text-sm space-y-1">
            <p className="font-medium">{installment.contracts?.properties?.title || "Imóvel"}</p>
            <p className="text-muted-foreground">{payer?.people?.name || "Pagador"} · Venc. {format(new Date(installment.due_date + "T12:00:00"), "dd/MM/yyyy")}</p>
            <p className="font-semibold">{fmt(Number(installment.amount))}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Valor Pago *</Label>
            <Input type="number" step="0.01" value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: e.target.value })}
              placeholder={String(installment.amount)} />
          </div>
          <div className="space-y-1.5">
            <Label>Data do Pagamento *</Label>
            <Input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Forma de Pagamento</Label>
            <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="ted">TED/DOC</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? "Salvando..." : "Confirmar Baixa"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Generate Installments Dialog ───
function GenerateInstallmentsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [genForm, setGenForm] = useState({ months: "12", startDate: new Date().toISOString().slice(0, 10) });
  const generateInstallments = useGenerateRecurringInstallments();

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["active-contracts-for-gen"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contracts")
        .select("id, contract_type, monthly_value, payment_due_day, start_date, properties:property_id(title), contract_parties(role, people:person_id(name))")
        .in("contract_type", ["locacao", "venda"])
        .eq("status", "ativo")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: open,
  });

  const { data: installmentCounts = {} } = useQuery({
    queryKey: ["contract-installment-counts-gen"],
    queryFn: async () => {
      const { data } = await supabase.from("contract_installments").select("contract_id");
      const counts: Record<string, number> = {};
      data?.forEach((i: any) => { counts[i.contract_id] = (counts[i.contract_id] || 0) + 1; });
      return counts;
    },
    enabled: open,
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === contracts.length) setSelected(new Set());
    else setSelected(new Set(contracts.map((c: any) => c.id)));
  };

  const handleGenerate = async () => {
    const months = Number(genForm.months);
    if (!months || months < 1) { toast.error("Informe a quantidade de meses"); return; }
    const selectedContracts = contracts.filter((c: any) => selected.has(c.id));
    for (const c of selectedContracts) {
      // Use payment_due_day if available to adjust start date
      let startDate = genForm.startDate;
      if ((c as any).payment_due_day) {
        const d = new Date(startDate);
        const day = Math.min((c as any).payment_due_day, 28);
        d.setDate(day);
        startDate = d.toISOString().slice(0, 10);
      }
      try {
        await generateInstallments.mutateAsync({
          contractId: c.id,
          monthlyValue: Number((c as any).monthly_value) || 0,
          numberOfMonths: months,
          startDate,
        });
      } catch { /* handled by mutation */ }
    }
    onOpenChange(false);
    setSelected(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Gerar Mensalidades</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quantidade de Meses</Label>
              <Input type="number" min={1} value={genForm.months} onChange={(e) => setGenForm({ ...genForm, months: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Data de Início</Label>
              <Input type="date" value={genForm.startDate} onChange={(e) => setGenForm({ ...genForm, startDate: e.target.value })} />
              <p className="text-xs text-muted-foreground">O dia de vencimento de cada contrato substitui o dia desta data, quando configurado.</p>
            </div>
          </div>
          <div className="rounded-md border overflow-auto max-h-72">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={selected.size === contracts.length && contracts.length > 0} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor Mensal</TableHead>
                  <TableHead>Dia Venc.</TableHead>
                  <TableHead>Parcelas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : contracts.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum contrato ativo</TableCell></TableRow>
                ) : contracts.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell><Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} /></TableCell>
                    <TableCell>{c.properties?.title || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{contractTypeLabels[c.contract_type] || c.contract_type}</Badge></TableCell>
                    <TableCell>{fmt(Number(c.monthly_value || 0))}</TableCell>
                    <TableCell>
                      {c.payment_due_day ? (
                        <Badge variant="secondary">Dia {c.payment_due_day}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={installmentCounts[c.id] ? "default" : "destructive"}>{installmentCounts[c.id] || 0}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-sm text-muted-foreground">{selected.size} contrato{selected.size !== 1 ? "s" : ""} selecionado{selected.size !== 1 ? "s" : ""}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleGenerate} disabled={generateInstallments.isPending || selected.size === 0}>
            {generateInstallments.isPending ? "Gerando..." : `Gerar para ${selected.size} contrato${selected.size !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Manual Invoice Dialog ───
function ManualInvoiceDialog({ open, onOpenChange, preFill }: { open: boolean; onOpenChange: (v: boolean) => void; preFill: any }) {
  const createManual = useCreateManualInvoice();
  const [form, setForm] = useState({ amount: "", due_date: "", payer_name: "", payer_document: "", notes: "", payment_method: "" });
  const resetForm = () => setForm({ amount: "", due_date: "", payer_name: "", payer_document: "", notes: "", payment_method: "" });

  const effectiveForm = useMemo(() => {
    if (preFill && open) {
      return { ...form, amount: preFill.amount || form.amount, due_date: preFill.due_date || form.due_date, payer_name: preFill.payer_name || form.payer_name, payer_document: preFill.payer_document || form.payer_document };
    }
    return form;
  }, [preFill, open, form]);

  const handleSubmit = () => {
    const f = effectiveForm;
    if (!f.amount || !f.due_date || !f.payer_name || !f.payer_document) { toast.error("Preencha os campos obrigatórios"); return; }
    createManual.mutate({
      amount: Number(f.amount), due_date: f.due_date, payer_name: f.payer_name, payer_document: f.payer_document,
      notes: f.notes || undefined, payment_method: f.payment_method || undefined, installment_id: preFill?.installment_id,
    }, { onSuccess: () => { onOpenChange(false); resetForm(); } });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Registrar Fatura Manual</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Valor *</Label><Input type="number" step="0.01" value={preFill?.amount || form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Vencimento *</Label><Input type="date" value={preFill?.due_date || form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Nome do Pagador *</Label><Input value={preFill?.payer_name || form.payer_name} onChange={(e) => setForm({ ...form, payer_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>CPF/CNPJ *</Label><Input value={preFill?.payer_document || form.payer_document} onChange={(e) => setForm({ ...form, payer_document: formatCpfCnpj(e.target.value) })} maxLength={18} /></div>
          <div className="space-y-1.5">
            <Label>Método</Label>
            <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="boleto_externo">Boleto Externo</SelectItem>
                <SelectItem value="deposito">Depósito/TED</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createManual.isPending}>{createManual.isPending ? "Salvando..." : "Registrar Fatura"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Boleto Form Dialog ───
function BoletoFormDialog({ open, onOpenChange, preFill }: { open: boolean; onOpenChange: (v: boolean) => void; preFill: any }) {
  const { data: creds = [] } = useBankCredentials();
  const createBoleto = useCreateBoleto();
  const [form, setForm] = useState({ credential_id: "", amount: "", due_date: "", payer_name: "", payer_document: "", payer_address: "", payer_city: "", payer_state: "", payer_zip: "", nosso_numero: "" });
  const effectiveForm = useMemo(() => {
    if (preFill && open) return { ...form, amount: preFill.amount || form.amount, due_date: preFill.due_date || form.due_date, payer_name: preFill.payer_name || form.payer_name, payer_document: preFill.payer_document || form.payer_document };
    return form;
  }, [preFill, open, form]);
  const resetForm = () => setForm({ credential_id: "", amount: "", due_date: "", payer_name: "", payer_document: "", payer_address: "", payer_city: "", payer_state: "", payer_zip: "", nosso_numero: "" });

  const handleSubmit = () => {
    const f = effectiveForm;
    if (!f.credential_id || !f.amount || !f.due_date || !f.payer_name || !f.payer_document) { toast.error("Preencha os campos obrigatórios"); return; }
    if (!isValidCpfCnpj(f.payer_document)) { toast.error("CPF/CNPJ do pagador é inválido"); return; }
    createBoleto.mutate({
      credential_id: f.credential_id, amount: Number(f.amount), due_date: f.due_date,
      payer_name: f.payer_name, payer_document: f.payer_document,
      payer_address: f.payer_address || undefined, payer_city: f.payer_city || undefined,
      payer_state: f.payer_state || undefined, payer_zip: f.payer_zip || undefined,
      nosso_numero: f.nosso_numero || undefined, installment_id: preFill?.installment_id,
    }, { onSuccess: () => { onOpenChange(false); resetForm(); } });
  };

  const activeCreds = (creds as any[]).filter((c: any) => c.active);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Emitir Boleto</DialogTitle></DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-1.5">
            <Label>Credencial Bancária *</Label>
            <Select value={effectiveForm.credential_id} onValueChange={(v) => setForm({ ...form, credential_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {activeCreds.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.bank_accounts?.name || c.provider} — {c.provider}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Valor *</Label><Input type="number" step="0.01" value={effectiveForm.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Vencimento *</Label><Input type="date" value={effectiveForm.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Nome do Pagador *</Label><Input value={effectiveForm.payer_name} onChange={(e) => setForm({ ...form, payer_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>CPF/CNPJ *</Label><Input value={effectiveForm.payer_document} onChange={(e) => setForm({ ...form, payer_document: formatCpfCnpj(e.target.value) })} maxLength={18} /></div>
          <div className="space-y-1.5"><Label>Endereço</Label><Input value={effectiveForm.payer_address} onChange={(e) => setForm({ ...form, payer_address: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5 col-span-2"><Label>Cidade</Label><Input value={effectiveForm.payer_city} onChange={(e) => setForm({ ...form, payer_city: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>UF</Label><Input value={effectiveForm.payer_state} maxLength={2} onChange={(e) => setForm({ ...form, payer_state: e.target.value.toUpperCase() })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>CEP</Label><Input value={effectiveForm.payer_zip} onChange={(e) => setForm({ ...form, payer_zip: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Nosso Número</Label><Input value={effectiveForm.nosso_numero} onChange={(e) => setForm({ ...form, nosso_numero: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createBoleto.isPending}>{createBoleto.isPending ? "Emitindo..." : "Emitir Boleto"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── PIX Form Dialog ───
function PixFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: creds = [] } = useBankCredentials();
  const createPix = useCreatePixCharge();
  const [form, setForm] = useState({ credential_id: "", amount: "", payer_name: "", payer_document: "", expiration: "3600" });
  const resetForm = () => setForm({ credential_id: "", amount: "", payer_name: "", payer_document: "", expiration: "3600" });

  const handleSubmit = () => {
    if (!form.credential_id || !form.amount || !form.payer_name || !form.payer_document) { toast.error("Preencha os campos obrigatórios"); return; }
    if (!isValidCpfCnpj(form.payer_document)) { toast.error("CPF/CNPJ do pagador é inválido"); return; }
    createPix.mutate({
      credential_id: form.credential_id, amount: Number(form.amount),
      payer_name: form.payer_name, payer_document: form.payer_document,
      expiration_seconds: Number(form.expiration),
    }, { onSuccess: () => { onOpenChange(false); resetForm(); } });
  };

  const activeCreds = (creds as any[]).filter((c: any) => c.active);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Criar Cobrança PIX</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Credencial Bancária *</Label>
            <Select value={form.credential_id} onValueChange={(v) => setForm({ ...form, credential_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {activeCreds.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.bank_accounts?.name || c.provider} — {c.provider}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Valor *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Nome do Pagador *</Label><Input value={form.payer_name} onChange={(e) => setForm({ ...form, payer_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>CPF/CNPJ *</Label><Input value={form.payer_document} onChange={(e) => setForm({ ...form, payer_document: formatCpfCnpj(e.target.value) })} maxLength={18} /></div>
          <div className="space-y-1.5">
            <Label>Expiração</Label>
            <Select value={form.expiration} onValueChange={(v) => setForm({ ...form, expiration: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1800">30 minutos</SelectItem>
                <SelectItem value="3600">1 hora</SelectItem>
                <SelectItem value="86400">24 horas</SelectItem>
                <SelectItem value="604800">7 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createPix.isPending}>{createPix.isPending ? "Criando..." : "Criar Cobrança PIX"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
