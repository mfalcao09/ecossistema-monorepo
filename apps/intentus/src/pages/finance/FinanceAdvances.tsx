import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, FastForward, Calculator } from "lucide-react";
import {
  useReceivablesAdvances, useCreateReceivablesAdvance, useUpdateReceivablesAdvance,
  advanceStatusLabels, advanceStatusColors,
} from "@/hooks/useReceivablesAdvances";
import { useContracts } from "@/hooks/useContracts";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function FinanceAdvances() {
  const { data: advances = [], isLoading } = useReceivablesAdvances();
  const { data: contracts = [] } = useContracts();
  const create = useCreateReceivablesAdvance();
  const update = useUpdateReceivablesAdvance();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  // Simulator state
  const [simContractId, setSimContractId] = useState("");
  const [simMonths, setSimMonths] = useState(3);
  const [simRate, setSimRate] = useState(2);
  const [simResult, setSimResult] = useState<{ gross: number; discount: number; net: number } | null>(null);

  const [form, setForm] = useState({ contract_id: "", owner_person_id: "", months_advanced: 3, discount_rate: 2, gross_amount: 0, discount_amount: 0, net_amount: 0, advance_date: "", status: "simulacao", notes: "" });

  const ativas = advances.filter((a: any) => ["aprovada", "paga"].includes(a.status));
  const totalAntecipado = ativas.reduce((s: number, a: any) => s + Number(a.net_amount), 0);
  const totalDesagio = ativas.reduce((s: number, a: any) => s + Number(a.discount_amount), 0);

  function simulate() {
    const contract = contracts.find((c: any) => c.id === simContractId);
    if (!contract) return;
    const monthlyValue = Number(contract.monthly_value || 0);
    const gross = monthlyValue * simMonths;
    const discount = gross * simRate / 100;
    const net = gross - discount;
    setSimResult({ gross, discount, net });
  }

  function openNew() {
    setEditing(null);
    setForm({ contract_id: "", owner_person_id: "", months_advanced: 3, discount_rate: 2, gross_amount: 0, discount_amount: 0, net_amount: 0, advance_date: "", status: "simulacao", notes: "" });
    setDialogOpen(true);
  }

  function openEdit(a: any) {
    setEditing(a);
    setForm({ contract_id: a.contract_id, owner_person_id: a.owner_person_id, months_advanced: a.months_advanced, discount_rate: Number(a.discount_rate), gross_amount: Number(a.gross_amount), discount_amount: Number(a.discount_amount), net_amount: Number(a.net_amount), advance_date: a.advance_date, status: a.status, notes: a.notes || "" });
    setDialogOpen(true);
  }

  function handleSave() {
    const payload = { ...form, notes: form.notes || null };
    if (editing) { update.mutate({ id: editing.id, ...payload }, { onSuccess: () => setDialogOpen(false) }); }
    else { create.mutate(payload, { onSuccess: () => setDialogOpen(false) }); }
  }

  // Auto-calc when values change in form
  function updateFormCalc(field: string, value: number) {
    const updated = { ...form, [field]: value };
    if (field === "gross_amount" || field === "discount_rate") {
      updated.discount_amount = Math.round(updated.gross_amount * updated.discount_rate / 100 * 100) / 100;
      updated.net_amount = updated.gross_amount - updated.discount_amount;
    }
    setForm(updated);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Antecipação de Recebíveis</h1>
          <p className="text-muted-foreground text-sm">Simule e controle antecipações de aluguéis a proprietários</p>
        </div>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Antecipação</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Antecipações Ativas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{ativas.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Valor Antecipado</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmt(totalAntecipado)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Deságio Total</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">{fmt(totalDesagio)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{advances.filter((a: any) => a.status === "simulacao").length}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="simulador" className="space-y-4">
        <TabsList>
          <TabsTrigger value="simulador">Simulador</TabsTrigger>
          <TabsTrigger value="antecipacoes">Antecipações</TabsTrigger>
        </TabsList>

        <TabsContent value="simulador">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calculator className="h-5 w-5" /> Simulador de Antecipação</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Contrato</Label>
                  <Select value={simContractId} onValueChange={setSimContractId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
                    <SelectContent>{contracts.filter((c: any) => c.contract_type === "locacao").map((c: any) => <SelectItem key={c.id} value={c.id}>{c.properties?.title || "Contrato"} - {fmt(Number(c.monthly_value || 0))}/mês</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Meses a Antecipar</Label><Input type="number" min={1} max={12} value={simMonths} onChange={(e) => setSimMonths(Number(e.target.value))} /></div>
                <div className="space-y-1.5"><Label>Taxa de Deságio (%)</Label><Input type="number" step={0.5} value={simRate} onChange={(e) => setSimRate(Number(e.target.value))} /></div>
              </div>
              <Button onClick={simulate} disabled={!simContractId}><Calculator className="h-4 w-4 mr-1" /> Simular</Button>
              {simResult && (
                <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-muted/50 border">
                  <div><p className="text-xs text-muted-foreground">Valor Bruto</p><p className="text-lg font-bold">{fmt(simResult.gross)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Deságio</p><p className="text-lg font-bold text-amber-600">- {fmt(simResult.discount)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Valor Líquido ao Proprietário</p><p className="text-lg font-bold text-green-600">{fmt(simResult.net)}</p></div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="antecipacoes">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Imóvel</TableHead><TableHead>Proprietário</TableHead><TableHead>Meses</TableHead><TableHead>Valor Bruto</TableHead><TableHead>Deságio</TableHead><TableHead>Líquido</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {isLoading ? <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
                  : advances.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground"><FastForward className="h-10 w-10 mx-auto mb-2 opacity-30" />Nenhuma antecipação registrada.</TableCell></TableRow>
                  : advances.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.contracts?.properties?.title || "—"}</TableCell>
                      <TableCell>{a.people?.name || "—"}</TableCell>
                      <TableCell className="font-mono">{a.months_advanced}x</TableCell>
                      <TableCell>{fmt(Number(a.gross_amount))}</TableCell>
                      <TableCell className="text-amber-600">- {fmt(Number(a.discount_amount))}</TableCell>
                      <TableCell className="font-bold text-green-600">{fmt(Number(a.net_amount))}</TableCell>
                      <TableCell><Badge className={advanceStatusColors[a.status]}>{advanceStatusLabels[a.status] || a.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Antecipação" : "Nova Antecipação"}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-1.5"><Label>Contrato *</Label>
              <Select value={form.contract_id} onValueChange={(v) => setForm({ ...form, contract_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{contracts.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.properties?.title || "Contrato"}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Proprietário (person_id) *</Label><Input value={form.owner_person_id} onChange={(e) => setForm({ ...form, owner_person_id: e.target.value })} placeholder="ID do proprietário" /></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>Meses</Label><Input type="number" min={1} value={form.months_advanced} onChange={(e) => setForm({ ...form, months_advanced: Number(e.target.value) })} /></div>
              <div className="space-y-1.5"><Label>Taxa Deságio (%)</Label><Input type="number" step={0.5} value={form.discount_rate} onChange={(e) => updateFormCalc("discount_rate", Number(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>Data Antecipação *</Label><Input type="date" value={form.advance_date} onChange={(e) => setForm({ ...form, advance_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>Bruto (R$)</Label><Input type="number" value={form.gross_amount} onChange={(e) => updateFormCalc("gross_amount", Number(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>Deságio (R$)</Label><Input type="number" value={form.discount_amount} readOnly className="bg-muted" /></div>
              <div className="space-y-1.5"><Label>Líquido (R$)</Label><Input type="number" value={form.net_amount} readOnly className="bg-muted" /></div>
            </div>
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(advanceStatusLabels).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.contract_id || !form.owner_person_id || !form.advance_date || create.isPending || update.isPending}>{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
