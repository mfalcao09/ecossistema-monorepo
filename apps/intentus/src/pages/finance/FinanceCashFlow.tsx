import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, Building, Repeat } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function useMonthRange(offset: number) {
  const target = offset === 0 ? new Date() : (offset > 0 ? addMonths(new Date(), offset) : subMonths(new Date(), Math.abs(offset)));
  return {
    start: format(startOfMonth(target), "yyyy-MM-dd"),
    end: format(endOfMonth(target), "yyyy-MM-dd"),
    label: format(target, "MMMM yyyy", { locale: ptBR }),
    refMonth: format(target, "yyyy-MM"),
  };
}

function useCashFlowData(monthOffset: number) {
  const { start, end, refMonth } = useMonthRange(monthOffset);

  return useQuery({
    queryKey: ["cashflow", start, end],
    queryFn: async () => {
      const { data: installments } = await supabase
        .from("contract_installments")
        .select("id, amount, paid_amount, payment_date, status, revenue_type, due_date, contract_id")
        .gte("due_date", start)
        .lte("due_date", end)
        .order("due_date");

      const { data: transfers } = await supabase
        .from("owner_transfers")
        .select("id, net_amount, admin_fee_value, status, payment_date, reference_month, owner_person_id")
        .eq("reference_month", refMonth);

      const { data: commissions } = await supabase
        .from("commission_splits")
        .select("id, calculated_value, net_value, status, payment_date, role")
        .eq("status", "pago");

      const allInstallments = installments || [];
      const allTransfers = (transfers || []) as any[];
      const allCommissions = (commissions || []).filter((c: any) => {
        if (!c.payment_date) return false;
        return c.payment_date >= start && c.payment_date <= end;
      }) as any[];

      // Item 11: Separate own revenue from transit money
      const paidInstallments = allInstallments.filter(i => i.status === "pago");
      const ownRevenue = paidInstallments
        .filter(i => i.revenue_type === "propria")
        .reduce((s, i) => s + Number(i.paid_amount || i.amount), 0);
      const transitRevenue = paidInstallments
        .filter(i => i.revenue_type !== "propria")
        .reduce((s, i) => s + Number(i.paid_amount || i.amount), 0);
      const totalEntries = ownRevenue + transitRevenue;

      const totalPending = allInstallments.filter(i => i.status === "pendente").reduce((s, i) => s + Number(i.amount), 0);
      const totalTransfersPaid = allTransfers.filter((t: any) => t.status === "pago").reduce((s: number, t: any) => s + Number(t.net_amount), 0);
      const totalTransfersPending = allTransfers.filter((t: any) => t.status === "pendente").reduce((s: number, t: any) => s + Number(t.net_amount), 0);
      const totalCommissionsPaid = allCommissions.reduce((s: number, c: any) => s + Number(c.net_value || c.calculated_value), 0);
      const adminFees = allTransfers.reduce((s: number, t: any) => s + Number(t.admin_fee_value), 0);

      const totalExits = totalTransfersPaid + totalCommissionsPaid;
      const balance = totalEntries - totalExits;

      // Build movement rows with category distinction
      const movements: { date: string; description: string; category: string; entrada: number; saida: number }[] = [];

      paidInstallments.forEach(i => {
        movements.push({
          date: i.payment_date || i.due_date,
          description: i.revenue_type === "propria"
            ? `Taxa de intermediação / Receita própria`
            : `Recebimento de aluguel (trânsito)`,
          category: i.revenue_type === "propria" ? "Receita Própria" : "Trânsito",
          entrada: Number(i.paid_amount || i.amount),
          saida: 0,
        });
      });

      allTransfers.filter((t: any) => t.status === "pago").forEach((t: any) => {
        movements.push({
          date: t.payment_date || start,
          description: `Repasse ao proprietário`,
          category: "Repasse",
          entrada: 0,
          saida: Number(t.net_amount),
        });
      });

      // Admin fees retained = own revenue from leases
      if (adminFees > 0) {
        movements.push({
          date: end,
          description: `Taxas de administração retidas (receita própria)`,
          category: "Receita Própria",
          entrada: adminFees,
          saida: 0,
        });
      }

      allCommissions.forEach((c: any) => {
        movements.push({
          date: c.payment_date,
          description: `Comissão ${c.role}`,
          category: c.role === "house" ? "Receita Própria" : "Comissão Corretor",
          entrada: 0,
          saida: Number(c.net_value || c.calculated_value),
        });
      });

      movements.sort((a, b) => a.date.localeCompare(b.date));

      return {
        totalEntries,
        totalExits,
        totalPending,
        totalTransfersPending,
        balance,
        adminFees,
        ownRevenue: ownRevenue + adminFees,
        transitRevenue,
        movements,
      };
    },
  });
}

const categoryColors: Record<string, string> = {
  "Receita Própria": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  "Trânsito": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  "Repasse": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  "Comissão Corretor": "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
};

export default function FinanceCashFlow() {
  const [monthOffset, setMonthOffset] = useState(0);
  const { label } = useMonthRange(monthOffset);
  const { data, isLoading } = useCashFlowData(monthOffset);
  const { data: forecast } = useCashFlowData(1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Fluxo de Caixa</h1>
          <p className="text-muted-foreground text-sm">Receita própria vs. dinheiro em trânsito (terceiros)</p>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="outline" size="sm" onClick={() => setMonthOffset(o => o - 1)}>← Anterior</Button>
          <span className="text-sm font-medium capitalize min-w-[140px] text-center">{label}</span>
          <Button variant="outline" size="sm" onClick={() => setMonthOffset(o => o + 1)}>Próximo →</Button>
        </div>
      </div>

      {/* Item 11: Split cards - Own Revenue vs Transit */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building className="h-4 w-4" /> Faturamento Próprio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{fmt(data?.ownRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Comissões de venda + Taxas de intermediação + Taxas de administração
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Repeat className="h-4 w-4" /> Dinheiro em Trânsito (Terceiros)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{fmt(data?.transitRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Aluguéis recebidos (passivo) → pendente de repasse ao proprietário
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Entradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 flex items-center gap-1">
              <ArrowUpRight className="h-5 w-5" /> {fmt(data?.totalEntries || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">A receber: {fmt(data?.totalPending || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Saídas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive flex items-center gap-1">
              <ArrowDownRight className="h-5 w-5" /> {fmt(data?.totalExits || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Repasses pendentes: {fmt(data?.totalTransfersPending || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold flex items-center gap-1 ${(data?.balance || 0) >= 0 ? "text-green-600" : "text-destructive"}`}>
              <Wallet className="h-5 w-5" /> {fmt(data?.balance || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Taxa de adm. retida: {fmt(data?.adminFees || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Previsão Próx. Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              <TrendingUp className="h-5 w-5" /> {fmt(forecast?.totalPending || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Baseado em parcelas a vencer</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimentações</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Entrada</TableHead>
                <TableHead className="text-right">Saída</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : !data?.movements.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    Nenhuma movimentação neste período.
                  </TableCell>
                </TableRow>
              ) : (
                data.movements.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell>{format(new Date(m.date), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{m.description}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={categoryColors[m.category] || ""}>
                        {m.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-green-600">{m.entrada > 0 ? fmt(m.entrada) : ""}</TableCell>
                    <TableCell className="text-right text-destructive">{m.saida > 0 ? fmt(m.saida) : ""}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
