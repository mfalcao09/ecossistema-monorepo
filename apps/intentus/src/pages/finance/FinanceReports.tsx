import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, BarChart3, PieChart, TrendingUp, FileSpreadsheet, Building2, DollarSign, Receipt } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// Tax rates for Lucro Presumido (most common for real estate agencies)
const TAX_RATES = {
  iss: { rate: 0.05, label: "ISS (5%)" },
  pis: { rate: 0.0065, label: "PIS (0,65%)" },
  cofins: { rate: 0.03, label: "COFINS (3%)" },
  irpj: { rate: 0.048, label: "IRPJ (4,8%)" },
  csll: { rate: 0.0288, label: "CSLL (2,88%)" },
};

function useOwnRevenue(period: string) {
  return useQuery({
    queryKey: ["own-revenue-tax", period],
    queryFn: async () => {
      const [year, month] = period.split("-").map(Number);
      const start = format(new Date(year, month - 1, 1), "yyyy-MM-dd");
      const end = format(endOfMonth(new Date(year, month - 1, 1)), "yyyy-MM-dd");
      const refMonth = `${year}-${String(month).padStart(2, "0")}`;

      // 1. Intermediation fees (revenue_type = 'propria')
      const { data: ownInstallments } = await supabase
        .from("contract_installments")
        .select("amount, paid_amount, status")
        .eq("revenue_type", "propria")
        .eq("status", "pago" as any)
        .gte("due_date", start)
        .lte("due_date", end);

      const intermediationFees = (ownInstallments || []).reduce((s, i) => s + Number(i.paid_amount || i.amount), 0);

      // 2. Admin fees from transfers
      const { data: transfers } = await supabase
        .from("owner_transfers")
        .select("admin_fee_value")
        .eq("reference_month", refMonth);

      const adminFees = (transfers || []).reduce((s: number, t: any) => s + Number(t.admin_fee_value), 0);

      // 3. Sale commissions (house portion)
      const { data: commissions } = await supabase
        .from("commission_splits")
        .select("calculated_value, role, payment_date")
        .eq("role", "house")
        .eq("status", "pago" as any);

      const saleCommissions = (commissions || [])
        .filter((c: any) => c.payment_date && c.payment_date >= start && c.payment_date <= end)
        .reduce((s: number, c: any) => s + Number(c.calculated_value), 0);

      const totalOwnRevenue = intermediationFees + adminFees + saleCommissions;

      const taxes = Object.entries(TAX_RATES).map(([key, { rate, label }]) => ({
        key,
        label,
        rate,
        value: Math.round(totalOwnRevenue * rate * 100) / 100,
      }));

      const totalTax = taxes.reduce((s, t) => s + t.value, 0);

      return {
        intermediationFees,
        adminFees,
        saleCommissions,
        totalOwnRevenue,
        taxes,
        totalTax,
        netAfterTax: totalOwnRevenue - totalTax,
      };
    },
  });
}

const reports = [
  { title: "DRE - Demonstrativo de Resultados", description: "Receitas, despesas e resultado líquido por período", icon: BarChart3 },
  { title: "Relatório de Comissões", description: "Comissões por corretor, imóvel e período", icon: DollarSign },
  { title: "Balancete de Locação", description: "Receitas e despesas por contrato de locação", icon: FileSpreadsheet },
  { title: "Performance de Imóveis", description: "Rentabilidade, vacância e indicadores por imóvel", icon: Building2 },
  { title: "Análise de Inadimplência", description: "Evolução da inadimplência, aging e provisões", icon: TrendingUp },
  { title: "Fluxo de Caixa Projetado", description: "Projeção de entradas e saídas dos próximos meses", icon: PieChart },
];

function getCurrentMonth() {
  return format(new Date(), "yyyy-MM");
}

export default function FinanceReports() {
  const [period, setPeriod] = useState(getCurrentMonth());
  const { data, isLoading } = useOwnRevenue(period);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Relatórios Financeiros</h1>
          <p className="text-muted-foreground text-sm">Demonstrativos, projeções fiscais e análises de performance</p>
        </div>
        <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-44" />
      </div>

      {/* Tax Projection */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" /> Projeção Fiscal — Faturamento Próprio
          </CardTitle>
          <CardDescription>
            Impostos incidentes apenas sobre a receita de serviços (comissões + taxas de administração + intermediação). 
            Não incide sobre o volume de aluguéis em trânsito.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4">Calculando...</p>
          ) : data ? (
            <div className="space-y-4">
              {/* Revenue breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Taxas de Intermediação</p>
                  <p className="text-lg font-bold">{fmt(data.intermediationFees)}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Taxas de Administração</p>
                  <p className="text-lg font-bold">{fmt(data.adminFees)}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Comissões de Venda (House)</p>
                  <p className="text-lg font-bold">{fmt(data.saleCommissions)}</p>
                </div>
                <div className="rounded-lg border bg-primary/5 border-primary/20 p-3">
                  <p className="text-xs text-muted-foreground font-medium">Total Faturamento Próprio</p>
                  <p className="text-lg font-bold text-primary">{fmt(data.totalOwnRevenue)}</p>
                </div>
              </div>

              {/* Tax table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Imposto</TableHead>
                    <TableHead>Alíquota</TableHead>
                    <TableHead>Base de Cálculo</TableHead>
                    <TableHead className="text-right">Valor Estimado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.taxes.map((t) => (
                    <TableRow key={t.key}>
                      <TableCell className="font-medium">{t.label}</TableCell>
                      <TableCell className="font-mono">{(t.rate * 100).toFixed(2)}%</TableCell>
                      <TableCell>{fmt(data.totalOwnRevenue)}</TableCell>
                      <TableCell className="text-right font-medium text-destructive">{fmt(t.value)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                    <TableCell colSpan={3} className="font-bold">Total de Impostos</TableCell>
                    <TableCell className="text-right font-bold text-destructive">{fmt(data.totalTax)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={3} className="font-bold">Resultado Líquido (após impostos)</TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">{fmt(data.netAfterTax)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <p className="text-xs text-muted-foreground">
                * Projeção baseada no regime de Lucro Presumido. Valores estimativos — consulte seu contador para apuração definitiva.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Report cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report) => (
          <Card key={report.title} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <report.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{report.title}</CardTitle>
                  <CardDescription className="text-xs">{report.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="w-full">
                <Download className="h-4 w-4 mr-1" /> Gerar Relatório
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}