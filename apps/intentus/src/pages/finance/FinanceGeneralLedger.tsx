import { useState, useMemo } from "react";
import { useJournalEntries } from "@/hooks/useJournalEntries";
import { useChartOfAccounts, ChartAccount } from "@/hooks/useChartOfAccounts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookText, Download } from "lucide-react";
import { exportToCSV } from "@/lib/csvExport";

export default function FinanceGeneralLedger() {
  const [accountId, setAccountId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { accounts } = useChartOfAccounts();
  const { entries } = useJournalEntries({ accountId: accountId || undefined, startDate: startDate || undefined, endDate: endDate || undefined });

  const sortedAccounts = useMemo(() => [...accounts].filter(a => a.is_active).sort((a, b) => a.code.localeCompare(b.code)), [accounts]);
  const selectedAccount = accounts.find(a => a.id === accountId);

  // Build ledger rows with running balance
  const ledgerRows = useMemo(() => {
    if (!accountId) return [];
    const rows: { date: string; description: string; debit: number; credit: number; balance: number }[] = [];
    
    // Collect all lines for this account, sorted by date
    const allLines: { date: string; description: string; debit: number; credit: number }[] = [];
    const sortedEntries = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at));
    
    for (const entry of sortedEntries) {
      for (const line of (entry.lines || [])) {
        if (line.account_id === accountId) {
          allLines.push({
            date: entry.entry_date,
            description: line.description || entry.description,
            debit: Number(line.debit_amount),
            credit: Number(line.credit_amount),
          });
        }
      }
    }

    let balance = 0;
    for (const line of allLines) {
      // For devedora accounts: debit increases, credit decreases
      // For credora accounts: credit increases, debit decreases
      const isDevedora = selectedAccount?.nature === "devedora";
      balance += isDevedora ? (line.debit - line.credit) : (line.credit - line.debit);
      rows.push({ ...line, balance });
    }
    return rows;
  }, [accountId, entries, selectedAccount]);

  const handleExport = () => {
    exportToCSV(ledgerRows.map(r => ({
      data: r.date,
      historico: r.description,
      debito: r.debit,
      credito: r.credit,
      saldo: r.balance,
    })), `livro_razao_${selectedAccount?.code || ""}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Livro Razão</h1>
          <p className="text-muted-foreground text-sm">Extrato detalhado por conta contábil com saldo progressivo</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={ledgerRows.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1 min-w-[280px]">
              <Label className="text-xs">Conta *</Label>
              <Select value={accountId || "__none__"} onValueChange={v => setAccountId(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione uma conta" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" disabled>Selecione uma conta</SelectItem>
                  {sortedAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">De</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Até</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 w-40" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BookText className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">
              {selectedAccount ? `${selectedAccount.code} - ${selectedAccount.name}` : "Selecione uma conta"}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {!accountId ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Selecione uma conta para ver o extrato</p>
            </div>
          ) : ledgerRows.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">Nenhuma movimentação no período</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Data</TableHead>
                  <TableHead>Histórico</TableHead>
                  <TableHead className="text-right w-32">Débito</TableHead>
                  <TableHead className="text-right w-32">Crédito</TableHead>
                  <TableHead className="text-right w-36">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">{r.date}</TableCell>
                    <TableCell className="text-sm">{r.description}</TableCell>
                    <TableCell className="text-right font-mono">{r.debit > 0 ? r.debit.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "-"}</TableCell>
                    <TableCell className="text-right font-mono">{r.credit > 0 ? r.credit.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "-"}</TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${r.balance < 0 ? "text-destructive" : ""}`}>
                      {r.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
