import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileSearch, Upload, CheckCircle, AlertCircle, HelpCircle, FileText } from "lucide-react";
import { useBankReconciliations, useBankReconciliationEntries, useCreateBankReconciliation, useCreateBankReconciliationEntries, useUpdateReconciliationEntry } from "@/hooks/useBankReconciliation";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { parseOFX, parseCSV, csvToTransactions, type OFXTransaction } from "@/lib/ofxParser";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { format } from "date-fns";

const matchStatusLabels: Record<string, string> = {
  pendente: "Pendente",
  conciliado: "Conciliado",
  divergente: "Divergente",
  sem_correspondencia: "Sem Correspondência",
};

const matchStatusColors: Record<string, string> = {
  pendente: "bg-blue-100 text-blue-800",
  conciliado: "bg-green-100 text-green-800",
  divergente: "bg-amber-100 text-amber-800",
  sem_correspondencia: "bg-red-100 text-red-800",
};

const MatchIcon = ({ status }: { status: string }) => {
  if (status === "conciliado") return <CheckCircle className="h-4 w-4 text-green-600" />;
  if (status === "divergente") return <AlertCircle className="h-4 w-4 text-amber-600" />;
  if (status === "sem_correspondencia") return <HelpCircle className="h-4 w-4 text-red-500" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
};

export default function FinanceBankReconciliation() {
  const { data: reconciliations = [], isLoading } = useBankReconciliations();
  const { data: bankAccounts = [] } = useBankAccounts();
  const createRecon = useCreateBankReconciliation();
  const createEntries = useCreateBankReconciliationEntries();
  const updateEntry = useUpdateReconciliationEntry();

  const [selectedRecon, setSelectedRecon] = useState<string | null>(null);
  const { data: entries = [] } = useBankReconciliationEntries(selectedRecon);

  const [importOpen, setImportOpen] = useState(false);
  const [bankAccountId, setBankAccountId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const totalEntries = entries.length;
  const conciliadas = entries.filter((e: any) => e.match_status === "conciliado").length;
  const divergentes = entries.filter((e: any) => e.match_status === "divergente").length;
  const semCorr = entries.filter((e: any) => e.match_status === "sem_correspondencia").length;

  async function handleFileUpload() {
    const file = selectedFile || fileRef.current?.files?.[0];
    if (!file || !bankAccountId) return;

    const content = await file.text();
    const isOFX = file.name.toLowerCase().endsWith(".ofx");
    let transactions: OFXTransaction[];

    if (isOFX) {
      transactions = parseOFX(content);
    } else {
      const rows = parseCSV(content);
      const keys = Object.keys(rows[0] || {});
      transactions = csvToTransactions(rows, keys[0], keys[1], keys[2]);
    }

    if (!transactions.length) return;

    const dates = transactions.map((t) => t.date).sort();
    const recon = await createRecon.mutateAsync({
      bank_account_id: bankAccountId,
      file_name: file.name,
      file_type: isOFX ? "ofx" : "csv",
      period_start: dates[0],
      period_end: dates[dates.length - 1],
      total_entries: transactions.length,
    });

    const tenant_id = await getAuthTenantId();
    const entryRows = transactions.map((t) => ({
      tenant_id,
      reconciliation_id: (recon as any).id,
      transaction_date: t.date,
      description: t.description,
      amount: t.amount,
      direction: t.direction,
      reference_code: t.referenceCode || null,
      match_status: "pendente",
    }));

    await createEntries.mutateAsync(entryRows);
    setSelectedRecon((recon as any).id);
    setImportOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Conciliação Bancária</h1>
          <p className="text-muted-foreground text-sm">Importe extratos OFX/CSV e concilie com lançamentos do sistema</p>
        </div>
        <Button onClick={() => setImportOpen(true)} size="sm"><Upload className="h-4 w-4 mr-1" /> Importar Extrato</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Entradas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{totalEntries}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Conciliadas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{conciliadas}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Divergentes</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">{divergentes}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Sem Correspondência</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{semCorr}</div></CardContent></Card>
      </div>

      <div className="flex gap-4">
        <div className="w-64">
          <Label className="text-xs text-muted-foreground mb-1 block">Sessão de Conciliação</Label>
          <Select value={selectedRecon || ""} onValueChange={setSelectedRecon}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {reconciliations.map((r: any) => (
                <SelectItem key={r.id} value={r.id}>{r.file_name} ({r.bank_accounts?.name})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground"><FileSearch className="h-10 w-10 mx-auto mb-2 opacity-30" />Selecione ou importe uma conciliação.</TableCell></TableRow>
              ) : entries.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell>{e.transaction_date}</TableCell>
                  <TableCell className="max-w-xs truncate">{e.description}</TableCell>
                  <TableCell className={e.direction === "credito" ? "text-green-700 font-mono" : "text-destructive font-mono"}>{e.direction === "debito" ? "-" : ""}{fmt(Number(e.amount))}</TableCell>
                  <TableCell><Badge variant="outline">{e.direction === "credito" ? "Crédito" : "Débito"}</Badge></TableCell>
                  <TableCell><div className="flex items-center gap-1.5"><MatchIcon status={e.match_status} /><Badge className={matchStatusColors[e.match_status]}>{matchStatusLabels[e.match_status]}</Badge></div></TableCell>
                  <TableCell className="text-right">
                    {e.match_status === "pendente" && (
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => updateEntry.mutate({ id: e.id, match_status: "conciliado" })}>Conciliar</Button>
                        <Button variant="ghost" size="sm" onClick={() => updateEntry.mutate({ id: e.id, match_status: "sem_correspondencia" })}>Sem Match</Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Importar Extrato Bancário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Conta Bancária *</Label>
              <Select value={bankAccountId} onValueChange={setBankAccountId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Arquivo (OFX ou CSV) *</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) setSelectedFile(file);
                }}
              >
                <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-1" />
                <p className="text-sm text-muted-foreground">
                  {selectedFile ? selectedFile.name : "Arraste o arquivo aqui ou clique para selecionar"}
                </p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">Formatos: OFX, CSV</p>
                <input ref={fileRef} type="file" accept=".ofx,.csv" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
            <Button onClick={handleFileUpload} disabled={!bankAccountId || !selectedFile || createRecon.isPending}>Importar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
