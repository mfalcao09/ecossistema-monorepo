import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { FileOutput, Plus, Download, Eye } from "lucide-react";

export default function FinanceOwnerStatements() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [filterMonth, setFilterMonth] = useState("");

  // Fetch statements
  const { data: statements = [], isLoading } = useQuery({
    queryKey: ["owner_statements", filterMonth],
    queryFn: async () => {
      let q = supabase.from("owner_statements" as any).select("*").order("generated_at", { ascending: false });
      if (filterMonth) q = q.eq("reference_month", filterMonth);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch people for select
  const { data: people = [] } = useQuery({
    queryKey: ["people_owners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("people").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Form state
  const [form, setForm] = useState({
    owner_id: "", property_id: "", reference_month: new Date().toISOString().slice(0, 7),
    gross_rent: "", admin_fee: "", ir_retained: "", net_amount: "",
    deductions_json: "[]",
  });

  const create = useMutation({
    mutationFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("owner_statements" as any).insert({
        tenant_id: tenantId, created_by: user!.id,
        owner_id: form.owner_id, property_id: form.property_id || null,
        reference_month: form.reference_month,
        gross_rent: parseFloat(form.gross_rent) || 0,
        admin_fee: parseFloat(form.admin_fee) || 0,
        ir_retained: parseFloat(form.ir_retained) || 0,
        net_amount: parseFloat(form.net_amount) || 0,
        deductions_json: JSON.parse(form.deductions_json || "[]"),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner_statements"] });
      toast({ title: "Prestação de contas gerada" });
      setDialogOpen(false);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const fmt = (v: number) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prestação de Contas</h1>
          <p className="text-muted-foreground text-sm">Extrato mensal detalhado por proprietário</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova Prestação
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Mês de Referência</Label>
              <Input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="h-9 w-48" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileOutput className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Prestações Geradas</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-sm text-muted-foreground">Carregando...</p>
          ) : statements.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileOutput className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma prestação de contas</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês Ref.</TableHead>
                  <TableHead>Proprietário</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Tx Admin</TableHead>
                  <TableHead className="text-right">IR</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statements.map((s: any) => {
                  const owner = people.find((p: any) => p.id === s.owner_id);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono">{s.reference_month}</TableCell>
                      <TableCell>{owner?.name || s.owner_id}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(s.gross_rent)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(s.admin_fee)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(s.ir_retained)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{fmt(s.net_amount)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{s.status}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Prestação de Contas</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Proprietário *</Label>
              <Select value={form.owner_id || "__none__"} onValueChange={v => setForm({ ...form, owner_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" disabled>Selecione</SelectItem>
                  {people.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mês de Referência *</Label>
              <Input type="month" value={form.reference_month} onChange={e => setForm({ ...form, reference_month: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Aluguel Bruto</Label>
                <Input type="number" step="0.01" value={form.gross_rent} onChange={e => setForm({ ...form, gross_rent: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Taxa de Administração</Label>
                <Input type="number" step="0.01" value={form.admin_fee} onChange={e => setForm({ ...form, admin_fee: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>IRRF Retido</Label>
                <Input type="number" step="0.01" value={form.ir_retained} onChange={e => setForm({ ...form, ir_retained: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Valor Líquido</Label>
                <Input type="number" step="0.01" value={form.net_amount} onChange={e => setForm({ ...form, net_amount: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Deduções (JSON)</Label>
              <Textarea value={form.deductions_json} onChange={e => setForm({ ...form, deductions_json: e.target.value })} rows={3} placeholder='[{"descricao":"IPTU","valor":150}]' />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => create.mutate()} disabled={!form.owner_id || create.isPending}>Gerar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
