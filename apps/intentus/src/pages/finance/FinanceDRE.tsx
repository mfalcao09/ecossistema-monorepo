import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, TrendingUp, TrendingDown } from "lucide-react";
import { useDRE, type DRELine } from "@/hooks/useDRE";
import { exportToCSV } from "@/lib/csvExport";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function FinanceDRE() {
  const today = new Date();
  const [periodStart, setPeriodStart] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [periodEnd, setPeriodEnd] = useState(format(endOfMonth(today), "yyyy-MM-dd"));

  const { data, isLoading } = useDRE(periodStart, periodEnd);
  const lines = data?.lines || [];

  function handleExport() {
    exportToCSV(
      lines.map((l) => ({ descricao: l.label, valor: l.value.toFixed(2) })),
      "dre-gerencial",
      { descricao: "Descrição", valor: "Valor (R$)" }
    );
  }

  const chartData = [
    { name: "Receita Bruta", valor: data?.grossRevenue || 0 },
    { name: "Receita Líquida", valor: data?.netRevenue || 0 },
    { name: "Resultado", valor: data?.operatingResult || 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">DRE Gerencial</h1>
          <p className="text-muted-foreground text-sm">Demonstrativo de Resultados do Exercício</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" /> Exportar CSV</Button>
      </div>

      <div className="flex gap-4 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Início</Label>
          <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="w-44" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Fim</Label>
          <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-44" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Receita Bruta</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmt(data?.grossRevenue || 0)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Receita Líquida</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmt(data?.netRevenue || 0)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Resultado Operacional</CardTitle></CardHeader><CardContent><div className={`text-2xl font-bold ${(data?.operatingResult || 0) >= 0 ? "text-green-600" : "text-destructive"}`}>{fmt(data?.operatingResult || 0)}</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Demonstrativo</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading ? <TableRow><TableCell colSpan={2} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
                : lines.length === 0 ? <TableRow><TableCell colSpan={2} className="text-center py-12 text-muted-foreground">Sem dados no período.</TableCell></TableRow>
                : lines.map((line, idx) => (
                  <TableRow key={idx} className={line.level === 2 ? "border-t-2 bg-muted/30" : ""}>
                    <TableCell className={`${line.bold ? "font-bold" : ""} ${line.level === 1 ? "pl-8 text-muted-foreground text-sm" : ""}`}>
                      {line.value >= 0 && line.level === 0 ? <TrendingUp className="inline h-3.5 w-3.5 mr-1 text-green-600" /> : line.value < 0 && line.level === 0 ? <TrendingDown className="inline h-3.5 w-3.5 mr-1 text-destructive" /> : null}
                      {line.label}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${line.bold ? "font-bold" : ""} ${line.value < 0 ? "text-destructive" : ""}`}>{fmt(Math.abs(line.value))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Visão Geral</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
