import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Lock, Unlock, Plus, AlertCircle } from "lucide-react";

export default function FinanceAccountingPeriods() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [reopenDialog, setReopenDialog] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState("");

  const { data: periods = [], isLoading } = useQuery({
    queryKey: ["accounting_periods"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounting_periods" as any).select("*").order("period_start", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const generatePeriods = useMutation({
    mutationFn: async () => {
      const tenantId = await getAuthTenantId();
      const now = new Date();
      const year = now.getFullYear();
      const existingMonths = new Set(periods.map((p: any) => p.period_start));
      const toInsert: any[] = [];
      for (let m = 0; m < 12; m++) {
        const start = `${year}-${String(m + 1).padStart(2, "0")}-01`;
        if (existingMonths.has(start)) continue;
        const lastDay = new Date(year, m + 1, 0).getDate();
        const end = `${year}-${String(m + 1).padStart(2, "0")}-${lastDay}`;
        toInsert.push({ tenant_id: tenantId, period_start: start, period_end: end, status: "aberto" });
      }
      if (toInsert.length > 0) {
        const { error } = await supabase.from("accounting_periods" as any).insert(toInsert as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounting_periods"] });
      toast({ title: "Períodos gerados" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const closePeriod = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("accounting_periods" as any)
        .update({ status: "fechado", closed_by: user!.id, closed_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounting_periods"] });
      toast({ title: "Período fechado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const reopenPeriod = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("accounting_periods" as any)
        .update({ status: "aberto", reopened_by: user!.id, reopened_at: new Date().toISOString(), reopen_reason: reason } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounting_periods"] });
      toast({ title: "Período reaberto" });
      setReopenDialog(null);
      setReopenReason("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const statusColors: Record<string, string> = {
    aberto: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    em_fechamento: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    fechado: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fechamento de Período</h1>
          <p className="text-muted-foreground text-sm">Controle de travamento mensal/anual de lançamentos</p>
        </div>
        <Button onClick={() => generatePeriods.mutate()} disabled={generatePeriods.isPending}>
          <Plus className="h-4 w-4 mr-2" /> Gerar Períodos do Ano
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Períodos Contábeis</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-sm text-muted-foreground">Carregando...</p>
          ) : periods.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Lock className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhum período cadastrado</p>
              <p className="text-xs mt-1">Clique em "Gerar Períodos do Ano" para criar os 12 meses</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fechado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono">{p.period_start.slice(0, 7)}</TableCell>
                    <TableCell className="text-sm">{p.period_start}</TableCell>
                    <TableCell className="text-sm">{p.period_end}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${statusColors[p.status] || ""}`}>
                        {p.status === "aberto" ? "Aberto" : p.status === "em_fechamento" ? "Em Fechamento" : "Fechado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.closed_at ? new Date(p.closed_at).toLocaleDateString("pt-BR") : "-"}</TableCell>
                    <TableCell className="text-right">
                      {p.status === "aberto" && (
                        <Button variant="outline" size="sm" onClick={() => closePeriod.mutate(p.id)}>
                          <Lock className="h-3.5 w-3.5 mr-1" /> Fechar
                        </Button>
                      )}
                      {p.status === "fechado" && (
                        <Button variant="ghost" size="sm" onClick={() => setReopenDialog(p.id)}>
                          <Unlock className="h-3.5 w-3.5 mr-1" /> Reabrir
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!reopenDialog} onOpenChange={() => setReopenDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reabrir Período</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950 dark:border-amber-800">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-300">Reabrir um período permite editar lançamentos anteriormente travados. Informe a justificativa.</p>
            </div>
            <div className="space-y-2">
              <Label>Justificativa *</Label>
              <Textarea value={reopenReason} onChange={e => setReopenReason(e.target.value)} rows={3} placeholder="Motivo da reabertura..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenDialog(null)}>Cancelar</Button>
            <Button onClick={() => reopenPeriod.mutate({ id: reopenDialog!, reason: reopenReason })} disabled={!reopenReason || reopenPeriod.isPending}>Confirmar Reabertura</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
