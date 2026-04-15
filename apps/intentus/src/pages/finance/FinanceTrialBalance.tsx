import { useState, useMemo } from "react";
import { useJournalEntries } from "@/hooks/useJournalEntries";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileCheck, Download, CheckCircle, XCircle } from "lucide-react";
import { exportToCSV } from "@/lib/csvExport";

const ACCOUNT_TYPES = [
  { value: "all", label: "Todos os tipos" },
  { value: "ativo", label: "Ativo" },
  { value: "passivo", label: "Passivo" },
  { value: "receita", label: "Receita" },
  { value: "despesa", label: "Despesa" },
  { value: "patrimonio_liquido", label: "Patrimônio Líquido" },
];

export default function FinanceTrialBalance() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const { accounts } = useChartOfAccounts();
  const { entries } = useJournalEntries({ startDate: startDate || undefined, endDate: endDate || undefined });

  const balanceRows = useMemo(() => {
    // Aggregate debits and credits per account
    const map = new Map<string, { debit: number; credit: number }>();
    for (const entry of entries) {
      if (entry.status !== "confirmado") continue;
      for (const line of (entry.lines || [])) {
        const existing = map.get(line.account_id) || { debit: 0, credit: 0 };
        existing.debit += Number(line.debit_amount);
        existing.credit += Number(line.credit_amount);
        map.set(line.account_id, existing);
      }
    }

    return accounts
      .filter(a => {
        if (!map.has(a.id)) return false;
        if (typeFilter !== "all" && a.account_type !== typeFilter) return false;
        return true;
      })
      .sort((a, b) => a.code.localeCompare(b.code))
      .map(a => {
        const { debit, credit } = map.get(a.id)!;
        const isDevedora = a.nature === "devedora";
        const saldoDevedor = isDevedora ? Math.max(0, debit - credit) : 0;
        const saldoCredor = !isDevedora ? Math.max(0, credit - debit) : 0;
        // Handle cases where balance goes opposite
        const adjustedDevedor = isDevedora ? (debit >= credit ? debit - credit : 0) : (debit > credit ? debit - credit : 0);
        const adjustedCredor = !isDevedora ? (credit >= debit ? credit - debit : 0) : (credit > debit ? credit - debit : 0);
        return {
          code: a.code,
          name: a.name,
          type: a.account_type,
          nature: a.nature,
          totalDebit: debit,
          totalCredit: credit,
          saldoDevedor: adjustedDevedor,
          saldoCredor: adjustedCredor,
        };
      });
  }, [accounts, entries, typeFilter]);

  const totalDevedor = balanceRows.reduce((s, r) => s + r.saldoDevedor, 0);
  const totalCredor = balanceRows.reduce((s, r) => s + r.saldoCredor, 0);
  const isBalanced = Math.abs(totalDevedor - totalCredor) < 0.01;

  const handleExport = () => {
    exportToCSV(balanceRows.map(r => ({
      codigo: r.code,
      nome: r.name,
      tipo: r.type,
      debitos: r.totalDebit,
      creditos: r.totalCredit,
      saldo_devedor: r.saldoDevedor,
      saldo_credor: r.saldoCredor,
    })), "balancete_verificacao");
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Balancete de Verificação</h1>
          <p className="text-muted-foreground text-sm">Saldos de todas as contas com validação de equilíbrio</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={balanceRows.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">De</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Até</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation badge */}
      {balanceRows.length > 0 && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border ${isBalanced ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"}`}>
          {isBalanced ? <CheckCircle className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
          <span className={`text-sm font-medium ${isBalanced ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
            {isBalanced ? "Balancete equilibrado — Débitos = Créditos" : `Balancete desequilibrado — Diferença: R$ ${fmt(Math.abs(totalDevedor - totalCredor))}`}
          </span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Balancete</CardTitle>
            <span className="text-sm text-muted-foreground">({balanceRows.length} contas)</span>
          </div>
        </CardHeader>
        <CardContent>
          {balanceRows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma movimentação confirmada no período</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-28">Tipo</TableHead>
                  <TableHead className="text-right w-32">Total Débito</TableHead>
                  <TableHead className="text-right w-32">Total Crédito</TableHead>
                  <TableHead className="text-right w-32">Saldo Devedor</TableHead>
                  <TableHead className="text-right w-32">Saldo Credor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balanceRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">{r.code}</TableCell>
                    <TableCell className="text-sm">{r.name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{r.type}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{fmt(r.totalDebit)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(r.totalCredit)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{r.saldoDevedor > 0 ? fmt(r.saldoDevedor) : "-"}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{r.saldoCredor > 0 ? fmt(r.saldoCredor) : "-"}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2">
                  <TableCell colSpan={5} className="text-right">Totais:</TableCell>
                  <TableCell className="text-right font-mono">{fmt(totalDevedor)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(totalCredor)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
