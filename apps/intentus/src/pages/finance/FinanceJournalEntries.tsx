import { useState, useMemo } from "react";
import { useJournalEntries, JournalEntryInput, JournalEntryLine } from "@/hooks/useJournalEntries";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, BookOpen, Trash2, Check, Download, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { exportToCSV } from "@/lib/csvExport";

interface LineForm {
  account_id: string;
  debit_amount: string;
  credit_amount: string;
  description: string;
}

const emptyLine: LineForm = { account_id: "", debit_amount: "", credit_amount: "", description: "" };

export default function FinanceJournalEntries() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { entries, isLoading, create, confirm, remove } = useJournalEntries({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    search: search || undefined,
    accountId: accountFilter || undefined,
  });
  const { accounts } = useChartOfAccounts();

  // Form state
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formDesc, setFormDesc] = useState("");
  const [formStatus, setFormStatus] = useState<"rascunho" | "confirmado">("rascunho");
  const [lines, setLines] = useState<LineForm[]>([{ ...emptyLine }, { ...emptyLine }]);

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit_amount) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit_amount) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
  const canSave = formDesc && lines.every(l => l.account_id && (parseFloat(l.debit_amount) > 0 || parseFloat(l.credit_amount) > 0)) && isBalanced && totalDebit > 0;

  const addLine = () => setLines([...lines, { ...emptyLine }]);
  const removeLine = (i: number) => { if (lines.length > 2) setLines(lines.filter((_, idx) => idx !== i)); };
  const updateLine = (i: number, field: keyof LineForm, value: string) => {
    const updated = [...lines];
    updated[i] = { ...updated[i], [field]: value };
    setLines(updated);
  };

  const resetForm = () => {
    setFormDate(format(new Date(), "yyyy-MM-dd"));
    setFormDesc("");
    setFormStatus("rascunho");
    setLines([{ ...emptyLine }, { ...emptyLine }]);
  };

  const handleSave = () => {
    const input: JournalEntryInput = {
      entry_date: formDate,
      description: formDesc,
      status: formStatus,
      lines: lines.map(l => ({
        account_id: l.account_id,
        debit_amount: parseFloat(l.debit_amount) || 0,
        credit_amount: parseFloat(l.credit_amount) || 0,
        description: l.description || undefined,
      })),
    };
    create.mutate(input, { onSuccess: () => { setDialogOpen(false); resetForm(); } });
  };

  const handleExport = () => {
    const rows = entries.flatMap(e =>
      (e.lines || []).map(l => ({
        data: e.entry_date,
        historico: e.description,
        status: e.status,
        conta_codigo: l.account_code,
        conta_nome: l.account_name,
        debito: l.debit_amount,
        credito: l.credit_amount,
        descricao_linha: l.description || "",
      }))
    );
    exportToCSV(rows, "livro_diario");
  };

  // Sort accounts for select
  const sortedAccounts = useMemo(() => [...accounts].filter(a => a.is_active).sort((a, b) => a.code.localeCompare(b.code)), [accounts]);

  // KPIs
  const totalEntries = entries.length;
  const drafts = entries.filter(e => e.status === "rascunho").length;
  const confirmed = entries.filter(e => e.status === "confirmado").length;
  const sumDebits = entries.reduce((s, e) => s + (e.total_debit || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Livro Diário</h1>
          <p className="text-muted-foreground text-sm">Lançamentos contábeis em partida dobrada</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={entries.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Novo Lançamento
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 pb-3 px-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{totalEntries}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4"><p className="text-xs text-muted-foreground">Rascunhos</p><p className="text-2xl font-bold text-amber-600">{drafts}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4"><p className="text-xs text-muted-foreground">Confirmados</p><p className="text-2xl font-bold text-green-600">{confirmed}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4"><p className="text-xs text-muted-foreground">Soma Débitos</p><p className="text-2xl font-bold">R$ {sumDebits.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent></Card>
      </div>

      {/* Filters */}
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
              <Label className="text-xs">Conta</Label>
              <Select value={accountFilter || "__all__"} onValueChange={v => setAccountFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-56 h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas as contas</SelectItem>
                  {sortedAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1 min-w-[200px]">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por histórico..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entries list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Lançamentos</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhum lançamento encontrado</p>
            </div>
          ) : (
            <div className="space-y-1">
              {entries.map(entry => {
                const isExpanded = expandedId === entry.id;
                return (
                  <div key={entry.id} className="border rounded-md">
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-sm font-mono text-muted-foreground w-24">{entry.entry_date}</span>
                      <span className="text-sm flex-1">{entry.description}</span>
                      <span className="text-sm font-mono w-28 text-right">R$ {(entry.total_debit || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      <Badge variant={entry.status === "confirmado" ? "default" : "outline"} className="text-xs">
                        {entry.status === "confirmado" ? "Confirmado" : "Rascunho"}
                      </Badge>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        {entry.status === "rascunho" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => confirm.mutate(entry.id)} title="Confirmar">
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                        )}
                        {entry.status === "rascunho" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(entry.id)} title="Excluir">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {isExpanded && entry.lines && (
                      <div className="border-t px-4 py-2 bg-muted/30">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Conta</TableHead>
                              <TableHead>Descrição</TableHead>
                              <TableHead className="text-right">Débito</TableHead>
                              <TableHead className="text-right">Crédito</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {entry.lines.map((l, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-mono text-sm">{l.account_code} - {l.account_name}</TableCell>
                                <TableCell className="text-sm">{l.description || "-"}</TableCell>
                                <TableCell className="text-right font-mono">{Number(l.debit_amount) > 0 ? Number(l.debit_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "-"}</TableCell>
                                <TableCell className="text-right font-mono">{Number(l.credit_amount) > 0 ? Number(l.credit_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Entry Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Lançamento Contábil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Histórico *</Label>
                <Input placeholder="Descrição do lançamento" value={formDesc} onChange={e => setFormDesc(e.target.value)} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Linhas de Lançamento</Label>
                <Button variant="outline" size="sm" onClick={addLine}><Plus className="h-3.5 w-3.5 mr-1" /> Linha</Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Conta</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-28">Débito</TableHead>
                    <TableHead className="w-28">Crédito</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Select value={line.account_id || "__none__"} onValueChange={v => updateLine(i, "account_id", v === "__none__" ? "" : v)}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__" disabled>Selecione uma conta</SelectItem>
                            {sortedAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input className="h-9" placeholder="Opcional" value={line.description} onChange={e => updateLine(i, "description", e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Input className="h-9 text-right font-mono" type="number" min="0" step="0.01" placeholder="0,00" value={line.debit_amount} onChange={e => updateLine(i, "debit_amount", e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Input className="h-9 text-right font-mono" type="number" min="0" step="0.01" placeholder="0,00" value={line.credit_amount} onChange={e => updateLine(i, "credit_amount", e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeLine(i)} disabled={lines.length <= 2}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell colSpan={2} className="text-right">Totais:</TableCell>
                    <TableCell className="text-right font-mono">R$ {totalDebit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-mono">R$ {totalCredit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>

              {!isBalanced && totalDebit > 0 && (
                <div className="flex items-center gap-2 text-destructive text-sm mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>Débitos e créditos não estão equilibrados (diferença: R$ {Math.abs(totalDebit - totalCredit).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})</span>
                </div>
              )}
              {isBalanced && totalDebit > 0 && (
                <div className="flex items-center gap-2 text-green-600 text-sm mt-2">
                  <Check className="h-4 w-4" />
                  <span>Lançamento equilibrado ✓</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={v => setFormStatus(v as any)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="confirmado">Confirmado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!canSave || create.isPending}>
              {create.isPending ? "Salvando..." : "Salvar Lançamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
