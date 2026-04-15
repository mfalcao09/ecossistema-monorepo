import { useState, useMemo } from "react";
import { useJournalEntries } from "@/hooks/useJournalEntries";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scale, Download, CheckCircle, XCircle } from "lucide-react";
import { exportToCSV } from "@/lib/csvExport";

interface BalanceNode {
  code: string;
  name: string;
  balance: number;
  children: BalanceNode[];
  level: number;
}

export default function FinanceBalanceSheet() {
  const [baseDate, setBaseDate] = useState(new Date().toISOString().slice(0, 10));

  const { accounts } = useChartOfAccounts();
  const { entries } = useJournalEntries({ endDate: baseDate });

  // Compute balance per account from confirmed entries
  const accountBalances = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of entries) {
      if (entry.status !== "confirmado") continue;
      for (const line of (entry.lines || [])) {
        const account = accounts.find(a => a.id === line.account_id);
        if (!account) continue;
        const isDevedora = account.nature === "devedora";
        const delta = isDevedora ? (Number(line.debit_amount) - Number(line.credit_amount)) : (Number(line.credit_amount) - Number(line.debit_amount));
        map.set(line.account_id, (map.get(line.account_id) || 0) + delta);
      }
    }
    return map;
  }, [entries, accounts]);

  // Build grouped data
  const buildGroup = (type: string) => {
    return accounts
      .filter(a => a.account_type === type && accountBalances.has(a.id))
      .sort((a, b) => a.code.localeCompare(b.code))
      .map(a => ({ code: a.code, name: a.name, balance: accountBalances.get(a.id) || 0 }));
  };

  const ativos = buildGroup("ativo");
  const passivos = buildGroup("passivo");
  const plItems = buildGroup("patrimonio_liquido");

  const totalAtivo = ativos.reduce((s, a) => s + a.balance, 0);
  const totalPassivo = passivos.reduce((s, a) => s + a.balance, 0);
  const totalPL = plItems.reduce((s, a) => s + a.balance, 0);
  const totalPassivoPL = totalPassivo + totalPL;
  const isBalanced = Math.abs(totalAtivo - totalPassivoPL) < 0.01;

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  const handleExport = () => {
    const rows = [
      ...ativos.map(a => ({ lado: "Ativo", codigo: a.code, nome: a.name, saldo: a.balance })),
      { lado: "Ativo", codigo: "", nome: "TOTAL ATIVO", saldo: totalAtivo },
      ...passivos.map(a => ({ lado: "Passivo", codigo: a.code, nome: a.name, saldo: a.balance })),
      { lado: "Passivo", codigo: "", nome: "TOTAL PASSIVO", saldo: totalPassivo },
      ...plItems.map(a => ({ lado: "Patrimônio Líquido", codigo: a.code, nome: a.name, saldo: a.balance })),
      { lado: "Patrimônio Líquido", codigo: "", nome: "TOTAL PL", saldo: totalPL },
    ];
    exportToCSV(rows, `balanco_patrimonial_${baseDate}`);
  };

  const renderSide = (title: string, items: { code: string; name: string; balance: number }[], total: number) => (
    <div className="flex-1">
      <h3 className="font-semibold text-sm mb-3 pb-2 border-b">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Sem movimentação</p>
      ) : (
        <div className="space-y-1">
          {items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm py-1 px-2 hover:bg-muted/50 rounded">
              <span><span className="font-mono text-muted-foreground mr-2">{item.code}</span>{item.name}</span>
              <span className="font-mono">{fmt(item.balance)}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold text-sm py-2 px-2 border-t mt-2">
            <span>Total {title}</span>
            <span className="font-mono">{fmt(total)}</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Balanço Patrimonial</h1>
          <p className="text-muted-foreground text-sm">Demonstração da posição patrimonial (Ativo = Passivo + PL)</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={ativos.length === 0 && passivos.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Data-base</Label>
              <Input type="date" value={baseDate} onChange={e => setBaseDate(e.target.value)} className="h-9 w-44" />
            </div>
          </div>
        </CardContent>
      </Card>

      {(ativos.length > 0 || passivos.length > 0 || plItems.length > 0) && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border ${isBalanced ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"}`}>
          {isBalanced ? <CheckCircle className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
          <span className={`text-sm font-medium ${isBalanced ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
            {isBalanced ? "Equação fundamental verificada — Ativo = Passivo + PL" : `Desequilíbrio: Ativo (${fmt(totalAtivo)}) ≠ Passivo+PL (${fmt(totalPassivoPL)})`}
          </span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Balanço em {baseDate}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {ativos.length === 0 && passivos.length === 0 && plItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Scale className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma movimentação confirmada até esta data</p>
            </div>
          ) : (
            <div className="flex gap-8">
              {renderSide("Ativo", ativos, totalAtivo)}
              <div className="w-px bg-border" />
              <div className="flex-1">
                {renderSide("Passivo", passivos, totalPassivo)}
                <div className="mt-6" />
                {renderSide("Patrimônio Líquido", plItems, totalPL)}
                <div className="flex justify-between font-bold text-sm py-2 px-2 border-t-2 mt-4">
                  <span>Total Passivo + PL</span>
                  <span className="font-mono">{fmt(totalPassivoPL)}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
