import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, FolderTree } from "lucide-react";
import { useCostCenters, useCostCenterEntries, useCreateCostCenter, useUpdateCostCenter, useCreateCostCenterEntry, centerTypeLabels } from "@/hooks/useCostCenters";
import { format } from "date-fns";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function FinanceCostCenters() {
  const { data: centers = [], isLoading } = useCostCenters();
  const create = useCreateCostCenter();
  const update = useUpdateCostCenter();
  const createEntry = useCreateCostCenterEntry();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", code: "", center_type: "customizado", active: true, notes: "" });

  const [selectedCenter, setSelectedCenter] = useState<string | null>(null);
  const { data: entries = [] } = useCostCenterEntries(selectedCenter);

  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [entryForm, setEntryForm] = useState({ entry_type: "receita", amount: 0, description: "", reference_date: format(new Date(), "yyyy-MM-dd"), reference_type: "manual" });

  function openNew() { setEditing(null); setForm({ name: "", code: "", center_type: "customizado", active: true, notes: "" }); setDialogOpen(true); }
  function openEdit(c: any) { setEditing(c); setForm({ name: c.name, code: c.code || "", center_type: c.center_type, active: c.active, notes: c.notes || "" }); setDialogOpen(true); }

  function handleSave() {
    const payload = { ...form, code: form.code || null, notes: form.notes || null };
    if (editing) { update.mutate({ id: editing.id, ...payload }, { onSuccess: () => setDialogOpen(false) }); }
    else { create.mutate(payload, { onSuccess: () => setDialogOpen(false) }); }
  }

  function handleAddEntry() {
    if (!selectedCenter) return;
    createEntry.mutate({ cost_center_id: selectedCenter, ...entryForm, description: entryForm.description || "Lançamento manual" }, { onSuccess: () => { setEntryDialogOpen(false); setEntryForm({ entry_type: "receita", amount: 0, description: "", reference_date: format(new Date(), "yyyy-MM-dd"), reference_type: "manual" }); } });
  }

  const totalReceita = entries.filter((e: any) => e.entry_type === "receita").reduce((s: number, e: any) => s + Number(e.amount), 0);
  const totalDespesa = entries.filter((e: any) => e.entry_type === "despesa").reduce((s: number, e: any) => s + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Centros de Custo</h1>
          <p className="text-muted-foreground text-sm">Análise de rentabilidade por imóvel, proprietário ou departamento</p>
        </div>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Centro</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Centros</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{centers.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Receita (selecionado)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{fmt(totalReceita)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Despesa (selecionado)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{fmt(totalDespesa)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Resultado Líquido</CardTitle></CardHeader><CardContent><div className={`text-2xl font-bold ${totalReceita - totalDespesa >= 0 ? "text-green-600" : "text-destructive"}`}>{fmt(totalReceita - totalDespesa)}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="centros" className="space-y-4">
        <TabsList>
          <TabsTrigger value="centros">Centros de Custo</TabsTrigger>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="centros">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Nome</TableHead><TableHead>Código</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
                  : centers.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground"><FolderTree className="h-10 w-10 mx-auto mb-2 opacity-30" />Nenhum centro de custo.</TableCell></TableRow>
                  : centers.map((c: any) => (
                    <TableRow key={c.id} className={selectedCenter === c.id ? "bg-muted/50" : "cursor-pointer"} onClick={() => setSelectedCenter(c.id)}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="font-mono">{c.code || "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{centerTypeLabels[c.center_type] || c.center_type}</Badge></TableCell>
                      <TableCell><Badge variant={c.active ? "default" : "outline"}>{c.active ? "Ativo" : "Inativo"}</Badge></TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lancamentos">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{selectedCenter ? `Lançamentos do centro selecionado` : "Selecione um centro de custo na aba anterior"}</p>
            {selectedCenter && <Button onClick={() => setEntryDialogOpen(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Lançamento</Button>}
          </div>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead>Valor</TableHead><TableHead>Origem</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {entries.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Nenhum lançamento.</TableCell></TableRow>
                  : entries.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.reference_date}</TableCell>
                      <TableCell><Badge variant={e.entry_type === "receita" ? "default" : "destructive"}>{e.entry_type === "receita" ? "Receita" : "Despesa"}</Badge></TableCell>
                      <TableCell>{e.description}</TableCell>
                      <TableCell className={`font-mono font-bold ${e.entry_type === "receita" ? "text-green-600" : "text-destructive"}`}>{fmt(Number(e.amount))}</TableCell>
                      <TableCell><Badge variant="outline">{e.reference_type}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Center dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar Centro" : "Novo Centro de Custo"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Código</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Tipo</Label>
              <Select value={form.center_type} onValueChange={(v) => setForm({ ...form, center_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(centerTypeLabels).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between"><Label>Ativo</Label><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /></div>
            <div className="space-y-1.5"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || create.isPending || update.isPending}>{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entry dialog */}
      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Novo Lançamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Tipo *</Label>
                <Select value={entryForm.entry_type} onValueChange={(v) => setEntryForm({ ...entryForm, entry_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="receita">Receita</SelectItem><SelectItem value="despesa">Despesa</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Valor (R$) *</Label><Input type="number" value={entryForm.amount} onChange={(e) => setEntryForm({ ...entryForm, amount: Number(e.target.value) })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Descrição *</Label><Input value={entryForm.description} onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Data Referência</Label><Input type="date" value={entryForm.reference_date} onChange={(e) => setEntryForm({ ...entryForm, reference_date: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddEntry} disabled={!entryForm.amount || createEntry.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
