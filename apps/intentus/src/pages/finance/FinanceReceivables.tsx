import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, ArrowUpRight, Clock, AlertTriangle, Building, ArrowRightLeft, CheckCircle2, Receipt, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { calculateServiceTaxes } from "@/lib/terminationCalc";
import { exportToCSV } from "@/lib/csvExport";
import { useBoletos } from "@/hooks/useBankIntegration";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

function useAllInstallmentsWithContracts() {
  return useQuery({
    queryKey: ["all-installments-with-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_installments")
        .select(`
          *,
          contracts:contract_id (
            id, contract_type, monthly_value, commission_percentage,
            properties:property_id ( id, title ),
            contract_parties ( person_id, role, people:person_id ( id, name ) )
          )
        `)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });
}

export default function FinanceReceivables() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const { data: installments = [], isLoading } = useAllInstallmentsWithContracts();
  const { data: boletos = [] } = useBoletos();

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const formatDate = (d: string | null) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const thisMonthItems = installments.filter((i: any) => i.due_date?.startsWith(currentMonth));
  const pending = thisMonthItems.filter((i: any) => i.status === "pendente" || i.status === "atrasado");
  const paid = thisMonthItems.filter((i: any) => i.status === "pago");
  const overdue = installments.filter((i: any) => i.status === "pendente" && i.due_date < now.toISOString().split("T")[0]);

  // Include boletos pagos in the received total
  const boletosPaidThisMonth = boletos.filter((b: any) => b.status === "pago" && b.paid_at?.startsWith(currentMonth));
  const boletoPaidTotal = boletosPaidThisMonth.reduce((s: number, b: any) => s + Number(b.paid_amount || b.amount), 0);

  const pendingTotal = pending.reduce((s: number, i: any) => s + Number(i.amount), 0);
  const paidTotal = paid.reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount), 0);
  const combinedPaidTotal = Math.max(paidTotal, boletoPaidTotal); // avoid double-counting
  const overdueTotal = overdue.reduce((s: number, i: any) => s + Number(i.amount), 0);
  const adimplencia = thisMonthItems.length > 0 ? Math.round((paid.length / thisMonthItems.length) * 100) : 0;

  const ownRevenue = installments.filter((i: any) => (i as any).revenue_type === "propria");
  const transitRevenue = installments.filter((i: any) => (i as any).revenue_type !== "propria");

  // Monthly chart data (last 6 months)
  const chartData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const monthItems = installments.filter((inst: any) => inst.due_date?.startsWith(key));
      const monthBoletos = boletos.filter((b: any) => b.due_date?.startsWith(key));
      months.push({
        month: label,
        recebido: monthItems.filter((i: any) => i.status === "pago").reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount), 0),
        pendente: monthItems.filter((i: any) => i.status === "pendente" || i.status === "atrasado").reduce((s: number, i: any) => s + Number(i.amount), 0),
        boletos_pagos: monthBoletos.filter((b: any) => b.status === "pago").reduce((s: number, b: any) => s + Number(b.paid_amount || b.amount), 0),
      });
    }
    return months;
  }, [installments, boletos]);

  const filtered = useMemo(() => {
    let items = installments;
    if (statusFilter === "propria") items = ownRevenue;
    else if (statusFilter === "transito") items = transitRevenue;
    else if (statusFilter !== "todos") items = items.filter((i: any) => i.status === statusFilter);

    if (search) {
      const s = search.toLowerCase();
      items = items.filter((i: any) => {
        const prop = i.contracts?.properties?.title?.toLowerCase() || "";
        const payer = i.contracts?.contract_parties?.find((p: any) => p.role === "locatario")?.people?.name?.toLowerCase() || "";
        return prop.includes(s) || payer.includes(s);
      });
    }
    return items;
  }, [installments, statusFilter, search, ownRevenue, transitRevenue]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Receitas</h1>
          <p className="text-muted-foreground text-sm">Dashboard de controle de receitas — receita própria vs. dinheiro em trânsito</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            const rows = filtered.map((i: any) => ({
              vencimento: i.due_date,
              descricao: i.installment_number === 0 ? "Taxa de Intermediação" : `Parcela ${i.installment_number}`,
              imovel: i.contracts?.properties?.title || "",
              valor: Number(i.amount).toFixed(2),
              classificacao: (i as any).revenue_type === "propria" ? "Receita Própria" : "Trânsito",
              status: i.status,
            }));
            exportToCSV(rows, "receitas", { vencimento: "Vencimento", descricao: "Descrição", imovel: "Imóvel", valor: "Valor", classificacao: "Classificação", status: "Status" });
          }}><Download className="h-4 w-4 mr-1" />Exportar</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">A Receber (Mês)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(pendingTotal)}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><ArrowUpRight className="h-3 w-3 text-primary" /> {pending.length} títulos pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Recebido (Mês)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{fmt(combinedPaidTotal)}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><CheckCircle2 className="h-3 w-3 text-emerald-600" /> {paid.length} recebimentos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Inadimplência</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{fmt(overdueTotal)}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><AlertTriangle className="h-3 w-3 text-destructive" /> {overdue.length} títulos atrasados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Adimplência</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{adimplencia}%</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Clock className="h-3 w-3" /> Mês atual</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Evolução de Receitas (últimos 6 meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="recebido" name="Recebido" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pendente" name="Pendente" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.5} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Revenue classification */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-primary/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Building className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold">
                  {fmt(ownRevenue.filter((i: any) => i.status === "pago").reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount), 0))}
                </p>
                <p className="text-xs text-muted-foreground">Receita Própria (comissões, taxas de intermediação e administração)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-bold">
                  {fmt(transitRevenue.filter((i: any) => i.status === "pago").reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount), 0))}
                </p>
                <p className="text-xs text-muted-foreground">Dinheiro em Trânsito (aluguéis e encargos de terceiros — passivo)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tax summary */}
      {(() => {
        const ownPaidTotal = ownRevenue
          .filter((i: any) => i.status === "pago")
          .reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount), 0);
        if (ownPaidTotal <= 0) return null;
        const { taxes, totalTax, netRevenue } = calculateServiceTaxes(ownPaidTotal);
        return (
          <Card className="border-primary/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4" /> Estimativa Tributária sobre Receita Própria (Lucro Presumido)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                {taxes.map((t) => (
                  <div key={t.tax} className="text-center">
                    <p className="text-xs text-muted-foreground">{t.tax} ({t.rate}%)</p>
                    <p className="text-sm font-bold">{fmt(t.value)}</p>
                  </div>
                ))}
                <div className="text-center border-l pl-3">
                  <p className="text-xs text-muted-foreground">Total Impostos</p>
                  <p className="text-sm font-bold text-destructive">{fmt(totalTax)}</p>
                </div>
                <div className="text-center border-l pl-3">
                  <p className="text-xs text-muted-foreground">Receita Líquida</p>
                  <p className="text-sm font-bold text-emerald-600">{fmt(netRevenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por imóvel, inquilino..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="atrasado">Atrasado</SelectItem>
            <SelectItem value="propria">Receita Própria</SelectItem>
            <SelectItem value="transito">Dinheiro em Trânsito</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Imóvel</TableHead>
                <TableHead>Pagador</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Classificação</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    Nenhuma receita encontrada. As parcelas dos contratos aparecerão aqui.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((i: any) => {
                  const payer = i.contracts?.contract_parties?.find((p: any) => p.role === "locatario" || p.role === "comprador");
                  const isOwn = (i as any).revenue_type === "propria";
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-mono text-sm">{formatDate(i.due_date)}</TableCell>
                      <TableCell>{i.installment_number === 0 ? "Taxa de Intermediação" : `Parcela ${i.installment_number}`}</TableCell>
                      <TableCell className="font-medium">{i.contracts?.properties?.title || "—"}</TableCell>
                      <TableCell>{payer?.people?.name || "—"}</TableCell>
                      <TableCell className="font-bold">{fmt(Number(i.amount))}</TableCell>
                      <TableCell>
                        <Badge variant={isOwn ? "default" : "outline"}>{isOwn ? "Receita Própria" : "Trânsito"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={i.status === "pago" ? "default" : i.status === "atrasado" ? "destructive" : "secondary"}>
                          {i.status === "pago" ? "Pago" : i.status === "atrasado" ? "Atrasado" : i.status === "cancelado" ? "Cancelado" : "Pendente"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
