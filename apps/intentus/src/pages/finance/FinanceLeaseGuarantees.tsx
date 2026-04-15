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
import { Plus, Pencil, Shield, AlertTriangle } from "lucide-react";
import {
  useLeaseGuarantees, useCreateLeaseGuarantee, useUpdateLeaseGuarantee,
  useLeaseGuaranteeMovements, useCreateGuaranteeMovement,
  guaranteeKindLabels, guaranteeStatusLabels, movementTypeLabels,
} from "@/hooks/useLeaseGuarantees";
import { useContracts } from "@/hooks/useContracts";
import { format, differenceInDays } from "date-fns";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function FinanceLeaseGuarantees() {
  const { data: guarantees = [], isLoading } = useLeaseGuarantees();
  const { data: contracts = [] } = useContracts();
  const create = useCreateLeaseGuarantee();
  const update = useUpdateLeaseGuarantee();
  const createMovement = useCreateGuaranteeMovement();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [movOpen, setMovOpen] = useState(false);
  const [selectedGuarantee, setSelectedGuarantee] = useState<any>(null);
  const { data: movements = [] } = useLeaseGuaranteeMovements(selectedGuarantee?.id || null);

  const [form, setForm] = useState({ contract_id: "", guarantee_kind: "caucao_dinheiro", deposit_value: 0, current_value: 0, correction_index: "nenhum", deposit_date: "", expiry_date: "", insurer_name: "", policy_number: "", status: "ativa", notes: "" });
  const [movForm, setMovForm] = useState({ movement_type: "deposito", amount: 0, reference_date: "", description: "" });

  const ativas = guarantees.filter((g: any) => g.status === "ativa");
  const vencendo30d = ativas.filter((g: any) => g.expiry_date && differenceInDays(new Date(g.expiry_date), new Date()) <= 30 && differenceInDays(new Date(g.expiry_date), new Date()) >= 0);
  const totalCustodia = ativas.reduce((s: number, g: any) => s + Number(g.current_value || g.deposit_value || 0), 0);

  function openNew() {
    setEditing(null);
    setForm({ contract_id: "", guarantee_kind: "caucao_dinheiro", deposit_value: 0, current_value: 0, correction_index: "nenhum", deposit_date: "", expiry_date: "", insurer_name: "", policy_number: "", status: "ativa", notes: "" });
    setDialogOpen(true);
  }

  function openEdit(g: any) {
    setEditing(g);
    setForm({ contract_id: g.contract_id, guarantee_kind: g.guarantee_kind, deposit_value: Number(g.deposit_value || 0), current_value: Number(g.current_value || 0), correction_index: g.correction_index, deposit_date: g.deposit_date || "", expiry_date: g.expiry_date || "", insurer_name: g.insurer_name || "", policy_number: g.policy_number || "", status: g.status, notes: g.notes || "" });
    setDialogOpen(true);
  }

  function handleSave() {
    const payload = { ...form, deposit_value: form.deposit_value || null, current_value: form.current_value || null, deposit_date: form.deposit_date || null, expiry_date: form.expiry_date || null, insurer_name: form.insurer_name || null, policy_number: form.policy_number || null, notes: form.notes || null };
    if (editing) { update.mutate({ id: editing.id, ...payload }, { onSuccess: () => setDialogOpen(false) }); }
    else { create.mutate(payload, { onSuccess: () => setDialogOpen(false) }); }
  }

  function openMovements(g: any) { setSelectedGuarantee(g); setMovOpen(true); setMovForm({ movement_type: "deposito", amount: 0, reference_date: format(new Date(), "yyyy-MM-dd"), description: "" }); }

  function handleAddMovement() {
    createMovement.mutate({ guarantee_id: selectedGuarantee.id, ...movForm, description: movForm.description || null }, { onSuccess: () => setMovForm({ movement_type: "deposito", amount: 0, reference_date: format(new Date(), "yyyy-MM-dd"), description: "" }) });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Garantias Contratuais</h1>
          <p className="text-muted-foreground text-sm">Gestão de cauções e contas escrow vinculadas a contratos</p>
        </div>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Garantia</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total em Custódia</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmt(totalCustodia)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Garantias Ativas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{ativas.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Vencendo em 30d</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">{vencendo30d.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Devolvidas no Mês</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{guarantees.filter((g: any) => g.status === "devolvida").length}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Imóvel</TableHead><TableHead>Tipo</TableHead><TableHead>Valor Depositado</TableHead><TableHead>Valor Atual</TableHead><TableHead>Vencimento</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
              : guarantees.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground"><Shield className="h-10 w-10 mx-auto mb-2 opacity-30" />Nenhuma garantia cadastrada.</TableCell></TableRow>
              : guarantees.map((g: any) => {
                const expiring = g.expiry_date && differenceInDays(new Date(g.expiry_date), new Date()) <= 30 && differenceInDays(new Date(g.expiry_date), new Date()) >= 0;
                return (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.contracts?.properties?.title || "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{guaranteeKindLabels[g.guarantee_kind] || g.guarantee_kind}</Badge></TableCell>
                    <TableCell>{fmt(Number(g.deposit_value || 0))}</TableCell>
                    <TableCell className="font-bold">{fmt(Number(g.current_value || g.deposit_value || 0))}</TableCell>
                    <TableCell>{g.expiry_date ? <span className={expiring ? "text-amber-600 font-medium" : ""}>{g.expiry_date}{expiring && <AlertTriangle className="inline h-3 w-3 ml-1" />}</span> : "—"}</TableCell>
                    <TableCell><Badge variant="outline">{guaranteeStatusLabels[g.status] || g.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openMovements(g)}>Movim.</Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(g)}><Pencil className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Garantia" : "Nova Garantia Contratual"}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-1.5"><Label>Contrato *</Label>
              <Select value={form.contract_id} onValueChange={(v) => setForm({ ...form, contract_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{contracts.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.properties?.title || "Contrato"}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Tipo *</Label>
              <Select value={form.guarantee_kind} onValueChange={(v) => setForm({ ...form, guarantee_kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(guaranteeKindLabels).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Valor Depositado</Label><Input type="number" value={form.deposit_value} onChange={(e) => setForm({ ...form, deposit_value: Number(e.target.value) })} /></div>
              <div className="space-y-1.5"><Label>Valor Atual</Label><Input type="number" value={form.current_value} onChange={(e) => setForm({ ...form, current_value: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Data Depósito</Label><Input type="date" value={form.deposit_date} onChange={(e) => setForm({ ...form, deposit_date: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Vencimento</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
            </div>
            {(form.guarantee_kind === "seguro_fianca" || form.guarantee_kind === "titulo_capitalizacao") && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Seguradora</Label><Input value={form.insurer_name} onChange={(e) => setForm({ ...form, insurer_name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Nº Apólice</Label><Input value={form.policy_number} onChange={(e) => setForm({ ...form, policy_number: e.target.value })} /></div>
              </div>
            )}
            <div className="space-y-1.5"><Label>Índice de Correção</Label>
              <Select value={form.correction_index} onValueChange={(v) => setForm({ ...form, correction_index: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="nenhum">Nenhum</SelectItem><SelectItem value="igpm">IGPM</SelectItem><SelectItem value="ipca">IPCA</SelectItem><SelectItem value="poupanca">Índice Poupança</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(guaranteeStatusLabels).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.contract_id || create.isPending || update.isPending}>{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Movements dialog */}
      <Dialog open={movOpen} onOpenChange={setMovOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Movimentações - {selectedGuarantee?.contracts?.properties?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Tipo</Label>
                <Select value={movForm.movement_type} onValueChange={(v) => setMovForm({ ...movForm, movement_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(movementTypeLabels).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Valor</Label><Input type="number" value={movForm.amount} onChange={(e) => setMovForm({ ...movForm, amount: Number(e.target.value) })} /></div>
              <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={movForm.reference_date} onChange={(e) => setMovForm({ ...movForm, reference_date: e.target.value })} /></div>
            </div>
            <div className="flex gap-2">
              <Input placeholder="Descrição..." value={movForm.description} onChange={(e) => setMovForm({ ...movForm, description: e.target.value })} className="flex-1" />
              <Button onClick={handleAddMovement} disabled={!movForm.amount || createMovement.isPending} size="sm">Adicionar</Button>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Valor</TableHead><TableHead>Descrição</TableHead></TableRow></TableHeader>
              <TableBody>
                {movements.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Nenhuma movimentação.</TableCell></TableRow>
                : movements.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.reference_date}</TableCell>
                    <TableCell><Badge variant="outline">{movementTypeLabels[m.movement_type] || m.movement_type}</Badge></TableCell>
                    <TableCell className="font-mono">{fmt(Number(m.amount))}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.description || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
