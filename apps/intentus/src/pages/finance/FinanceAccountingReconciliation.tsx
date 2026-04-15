import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { useToast } from "@/hooks/use-toast";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { useJournalEntries } from "@/hooks/useJournalEntries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GitCompareArrows, Plus, Check } from "lucide-react";

export default function FinanceAccountingReconciliation() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { accounts } = useChartOfAccounts();
  const sortedAccounts = useMemo(() => [...accounts].filter(a => a.is_active).sort((a, b) => a.code.localeCompare(b.code)), [accounts]);

  const [formAccountId, setFormAccountId] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formExtBalance, setFormExtBalance] = useState("");

  const { entries } = useJournalEntries({ accountId: formAccountId || undefined, startDate: formStart || undefined, endDate: formEnd || undefined });

  const { data: reconciliations = [], isLoading } = useQuery({
    queryKey: ["accounting_reconciliations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounting_reconciliations" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Compute book balance for selected account/period
  const bookBalance = useMemo(() => {
    if (!formAccountId) return 0;
    const account = accounts.find(a => a.id === formAccountId);
    let balance = 0;
    for (const entry of entries) {
      if (entry.status !== "confirmado") continue;
      for (const line of (entry.lines || [])) {
        if (line.account_id === formAccountId) {
          const isDevedora = account?.nature === "devedora";
          balance += isDevedora ? (Number(line.debit_amount) - Number(line.credit_amount)) : (Number(line.credit_amount) - Number(line.debit_amount));
        }
      }
    }
    return balance;
  }, [formAccountId, entries, accounts]);

  const createReconciliation = useMutation({
    mutationFn: async () => {
      const tenantId = await getAuthTenantId();
      const { error } = await supabase.from("accounting_reconciliations" as any).insert({
        tenant_id: tenantId,
        account_id: formAccountId,
        period_start: formStart,
        period_end: formEnd,
        book_balance: bookBalance,
        external_balance: parseFloat(formExtBalance) || 0,
        status: Math.abs(bookBalance - (parseFloat(formExtBalance) || 0)) < 0.01 ? "conciliado" : "pendente",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounting_reconciliations"] });
      toast({ title: "Conciliação criada" });
      setDialogOpen(false);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const markConcluded = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("accounting_reconciliations" as any)
        .update({ status: "conciliado", reconciled_by: user!.id, reconciled_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounting_reconciliations"] });
      toast({ title: "Conciliação finalizada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const fmt = (v: number) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const extBalance = parseFloat(formExtBalance) || 0;
  const diff = bookBalance - extBalance;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conciliação Contábil</h1>
          <p className="text-muted-foreground text-sm">Confronto entre saldos contábeis e bancários/externos</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova Conciliação
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <GitCompareArrows className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Conciliações</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-sm text-muted-foreground">Carregando...</p>
          ) : reconciliations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <GitCompareArrows className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma conciliação registrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Saldo Contábil</TableHead>
                  <TableHead className="text-right">Saldo Externo</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconciliations.map((r: any) => {
                  const account = accounts.find(a => a.id === r.account_id);
                  const d = Number(r.book_balance) - Number(r.external_balance);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{account ? `${account.code} - ${account.name}` : r.account_id}</TableCell>
                      <TableCell className="font-mono text-sm">{r.period_start} a {r.period_end}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(r.book_balance)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(r.external_balance)}</TableCell>
                      <TableCell className={`text-right font-mono ${Math.abs(d) > 0.01 ? "text-destructive font-semibold" : ""}`}>{fmt(d)}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "conciliado" ? "default" : "outline"} className="text-xs">
                          {r.status === "conciliado" ? "Conciliado" : r.status === "em_andamento" ? "Em Andamento" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status !== "conciliado" && (
                          <Button variant="ghost" size="sm" onClick={() => markConcluded.mutate(r.id)}>
                            <Check className="h-3.5 w-3.5 mr-1" /> Conciliar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Conciliação Contábil</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Conta Contábil *</Label>
              <Select value={formAccountId || "__none__"} onValueChange={v => setFormAccountId(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" disabled>Selecione</SelectItem>
                  {sortedAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Início *</Label>
                <Input type="date" value={formStart} onChange={e => setFormStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fim *</Label>
                <Input type="date" value={formEnd} onChange={e => setFormEnd(e.target.value)} />
              </div>
            </div>
            {formAccountId && formStart && formEnd && (
              <div className="p-3 bg-muted rounded-lg space-y-1">
                <p className="text-sm"><strong>Saldo Contábil:</strong> R$ {fmt(bookBalance)}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Saldo Externo (bancário) *</Label>
              <Input type="number" step="0.01" value={formExtBalance} onChange={e => setFormExtBalance(e.target.value)} />
            </div>
            {formAccountId && formExtBalance && (
              <div className={`p-3 rounded-lg border ${Math.abs(diff) < 0.01 ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"}`}>
                <p className={`text-sm font-medium ${Math.abs(diff) < 0.01 ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
                  Diferença: R$ {fmt(diff)} {Math.abs(diff) < 0.01 ? "✓" : ""}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => createReconciliation.mutate()} disabled={!formAccountId || !formStart || !formEnd || !formExtBalance || createReconciliation.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
