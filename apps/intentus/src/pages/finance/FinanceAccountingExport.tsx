import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { useToast } from "@/hooks/use-toast";
import { useJournalEntries } from "@/hooks/useJournalEntries";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileUp, Download, Eye } from "lucide-react";
import { exportToCSV } from "@/lib/csvExport";

const FORMATS = [
  { value: "csv_generico", label: "CSV Genérico" },
  { value: "dominio", label: "Layout Domínio" },
  { value: "fortes", label: "Layout Fortes" },
  { value: "prosoft", label: "Layout Prosoft" },
];

export default function FinanceAccountingExport() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [format, setFormat] = useState("csv_generico");

  const { entries } = useJournalEntries({ startDate: startDate || undefined, endDate: endDate || undefined });
  const { accounts } = useChartOfAccounts();
  
  const { data: exports = [], isLoading } = useQuery({
    queryKey: ["accounting_exports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounting_exports" as any).select("*").order("exported_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const confirmedEntries = entries.filter(e => e.status === "confirmado");

  const doExport = useMutation({
    mutationFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data: { user } } = await supabase.auth.getUser();

      // Generate CSV
      const rows = confirmedEntries.flatMap(e =>
        (e.lines || []).map(l => ({
          data: e.entry_date,
          conta_codigo: l.account_code,
          conta_nome: l.account_name,
          historico: l.description || e.description,
          debito: l.debit_amount,
          credito: l.credit_amount,
        }))
      );
      
      const fileName = `exportacao_${format}_${startDate}_${endDate}.csv`;
      exportToCSV(rows, fileName.replace(".csv", ""));

      // Save export record
      const { error } = await supabase.from("accounting_exports" as any).insert({
        tenant_id: tenantId, exported_by: user!.id,
        period_start: startDate, period_end: endDate,
        format, file_name: fileName, records_count: rows.length,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounting_exports"] });
      toast({ title: "Exportação realizada" });
      setDialogOpen(false);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Exportação Contábil</h1>
          <p className="text-muted-foreground text-sm">Geração de arquivos para o escritório de contabilidade</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Download className="h-4 w-4 mr-2" /> Nova Exportação
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Histórico de Exportações</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-sm text-muted-foreground">Carregando...</p>
          ) : exports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileUp className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma exportação realizada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Formato</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead className="text-right">Registros</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exports.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">{new Date(e.exported_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-mono text-sm">{e.period_start} a {e.period_end}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{FORMATS.find(f => f.value === e.format)?.label || e.format}</Badge></TableCell>
                    <TableCell className="text-sm">{e.file_name}</TableCell>
                    <TableCell className="text-right font-mono">{e.records_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Exportação Contábil</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Período Início *</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Período Fim *</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Formato</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMATS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {startDate && endDate && (
              <p className="text-sm text-muted-foreground">
                {confirmedEntries.length} lançamentos confirmados no período selecionado
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => doExport.mutate()} disabled={!startDate || !endDate || confirmedEntries.length === 0 || doExport.isPending}>Exportar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
