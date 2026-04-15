import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Plus, Building2, Pencil, Trash2, MapPin, ChevronDown, ChevronRight, Layers } from "lucide-react";
import {
  useDevelopments, useCreateDevelopment, useUpdateDevelopment, useDeleteDevelopment,
  useCreateDevelopmentUnit, useUpdateDevelopmentUnit, useDeleteDevelopmentUnit,
} from "@/hooks/useDevelopments";
import { useDevelopmentBlocks, useCreateBlock, useDeleteBlock } from "@/hooks/useDevelopmentBlocks";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const devStatusLabels: Record<string, string> = {
  breve_lancamento: "Breve Lançamento",
  lancamento: "Lançamento",
  obras: "Em Obras",
  entregue: "Entregue",
};
const devStatusColors: Record<string, string> = {
  breve_lancamento: "bg-blue-100 text-blue-800",
  lancamento: "bg-emerald-100 text-emerald-800",
  obras: "bg-amber-100 text-amber-800",
  entregue: "bg-gray-100 text-gray-800",
};
const devTypeLabels: Record<string, string> = { loteamento: "Loteamento", vertical: "Vertical" };
const unitStatusLabels: Record<string, string> = {
  disponivel: "Disponível", reservado: "Reservado", reservada: "Reservada",
  proposta_em_analise: "Proposta", vendido: "Vendido", bloqueada: "Bloqueada",
};
const unitStatusColors: Record<string, string> = {
  disponivel: "bg-emerald-500", reservado: "bg-yellow-500", reservada: "bg-yellow-500",
  proposta_em_analise: "bg-orange-500", vendido: "bg-red-500", bloqueada: "bg-gray-400",
};

function BlockManager({ developmentId }: { developmentId: string }) {
  const { data: blocks = [] } = useDevelopmentBlocks(developmentId);
  const createBlock = useCreateBlock();
  const deleteBlock = useDeleteBlock();
  const [name, setName] = useState("");

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input placeholder="Nome do bloco/quadra..." value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" />
        <Button size="sm" variant="outline" disabled={!name || createBlock.isPending} onClick={() => {
          createBlock.mutate({ development_id: developmentId, nome: name, sort_order: blocks.length }, { onSuccess: () => setName("") });
        }}><Plus className="h-3 w-3 mr-1" />Bloco</Button>
      </div>
      {blocks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {blocks.map(b => (
            <Badge key={b.id} variant="secondary" className="gap-1 text-xs">
              <Layers className="h-3 w-3" />{b.nome}
              <button className="ml-1 text-destructive hover:text-destructive/80" onClick={() => deleteBlock.mutate(b.id)}>×</button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Developments() {
  const { data: developments = [], isLoading } = useDevelopments();
  const create = useCreateDevelopment();
  const update = useUpdateDevelopment();
  const remove = useDeleteDevelopment();
  const createUnit = useCreateDevelopmentUnit();
  const updateUnit = useUpdateDevelopmentUnit();
  const deleteUnit = useDeleteDevelopmentUnit();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<{ name: string; description: string; city: string; neighborhood: string; state: string; total_units: number; tipo: "loteamento" | "vertical"; status_empreendimento: "breve_lancamento" | "lancamento" | "obras" | "entregue"; vgv_estimado: number; data_lancamento: string; address: string }>({ name: "", description: "", city: "", neighborhood: "", state: "", total_units: 0, tipo: "loteamento", status_empreendimento: "breve_lancamento", vgv_estimado: 0, data_lancamento: "", address: "" });

  const [unitDialog, setUnitDialog] = useState<string | null>(null);
  const [unitForm, setUnitForm] = useState({ unit_identifier: "", area: 0, price: 0, floor: "", typology: "", block_id: "" });

  const [expandedId, setExpandedId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", city: "", neighborhood: "", state: "", total_units: 0, tipo: "loteamento", status_empreendimento: "breve_lancamento", vgv_estimado: 0, data_lancamento: "", address: "" });
    setDialogOpen(true);
  }

  function openEdit(d: any) {
    setEditing(d);
    setForm({ name: d.name, description: d.description || "", city: d.city || "", neighborhood: d.neighborhood || "", state: d.state || "", total_units: d.total_units || 0, tipo: d.tipo || "loteamento", status_empreendimento: d.status_empreendimento || "breve_lancamento", vgv_estimado: d.vgv_estimado || 0, data_lancamento: d.data_lancamento || "", address: d.address || "" });
    setDialogOpen(true);
  }

  function handleSave() {
    if (editing) {
      update.mutate({ id: editing.id, ...form }, { onSuccess: () => setDialogOpen(false) });
    } else {
      create.mutate(form, { onSuccess: () => setDialogOpen(false) });
    }
  }

  function handleAddUnit() {
    if (!unitDialog || !unitForm.unit_identifier) return;
    const payload: any = { development_id: unitDialog, unit_identifier: unitForm.unit_identifier };
    if (unitForm.area) payload.area = unitForm.area;
    if (unitForm.price) payload.price = unitForm.price;
    if (unitForm.block_id) payload.block_id = unitForm.block_id;
    createUnit.mutate(payload, { onSuccess: () => { setUnitDialog(null); setUnitForm({ unit_identifier: "", area: 0, price: 0, floor: "", typology: "", block_id: "" }); } });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Empreendimentos</h1>
          <p className="text-muted-foreground text-sm">Gestão de lançamentos, blocos e unidades</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Novo Empreendimento</Button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Carregando...</div>
      ) : developments.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum empreendimento cadastrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {developments.map((d: any) => {
            const units = d.development_units || [];
            const sold = units.filter((u: any) => u.status === "vendido").length;
            const available = units.filter((u: any) => u.status === "disponivel").length;
            const pct = units.length > 0 ? Math.round((sold / units.length) * 100) : 0;
            const isExpanded = expandedId === d.id;

            return (
              <Card key={d.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base leading-tight">{d.name}</CardTitle>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {[d.neighborhood, d.city, d.state].filter(Boolean).join(", ") || "—"}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {d.tipo && <Badge variant="outline" className="text-[10px]">{devTypeLabels[d.tipo] || d.tipo}</Badge>}
                    {d.status_empreendimento && <Badge className={`text-[10px] ${devStatusColors[d.status_empreendimento] || ""}`}>{devStatusLabels[d.status_empreendimento] || d.status_empreendimento}</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold">{units.length}</p>
                      <p className="text-[10px] text-muted-foreground">Unidades</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-emerald-600">{available}</p>
                      <p className="text-[10px] text-muted-foreground">Disponíveis</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-red-600">{sold}</p>
                      <p className="text-[10px] text-muted-foreground">Vendidas</p>
                    </div>
                  </div>
                  {d.vgv_estimado > 0 && (
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">VGV</span>
                        <span className="font-medium">{fmt(d.vgv_estimado)}</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                      <p className="text-[10px] text-right text-muted-foreground mt-0.5">{pct}% vendido</p>
                    </div>
                  )}

                  <Button variant="ghost" size="sm" className="w-full justify-between text-xs" onClick={() => setExpandedId(isExpanded ? null : d.id)}>
                    <span>Gerenciar Blocos & Unidades</span>
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </Button>

                  {isExpanded && (
                    <div className="space-y-3 pt-2 border-t">
                      <BlockManager developmentId={d.id} />
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Unidades ({units.length})</span>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setUnitDialog(d.id)}>
                          <Plus className="h-3 w-3 mr-1" />Unidade
                        </Button>
                      </div>
                      {units.length > 0 && (
                        <div className="max-h-48 overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">ID</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                                <TableHead className="text-xs text-right">Preço</TableHead>
                                <TableHead className="w-8"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {units.map((u: any) => (
                                <TableRow key={u.id}>
                                  <TableCell className="text-xs font-medium py-1">{u.unit_identifier}</TableCell>
                                  <TableCell className="py-1">
                                    <div className="flex items-center gap-1.5">
                                      <div className={`h-2 w-2 rounded-full ${unitStatusColors[u.status] || "bg-gray-300"}`} />
                                      <span className="text-xs">{unitStatusLabels[u.status] || u.status}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs text-right py-1">{u.price ? fmt(Number(u.price)) : "—"}</TableCell>
                                  <TableCell className="py-1">
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteUnit.mutate(u.id)}><Trash2 className="h-3 w-3" /></Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Development Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Empreendimento" : "Novo Empreendimento"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nome *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v as "loteamento" | "vertical" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loteamento">Loteamento</SelectItem>
                    <SelectItem value="vertical">Vertical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status_empreendimento} onValueChange={v => setForm({ ...form, status_empreendimento: v as "breve_lancamento" | "lancamento" | "obras" | "entregue" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(devStatusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Cidade</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Bairro</Label><Input value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>UF</Label><Input value={form.state} maxLength={2} onChange={e => setForm({ ...form, state: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>VGV Estimado (R$)</Label><Input type="number" value={form.vgv_estimado} onChange={e => setForm({ ...form, vgv_estimado: Number(e.target.value) })} /></div>
              <div className="space-y-1.5"><Label>Data Lançamento</Label><Input type="date" value={form.data_lancamento} onChange={e => setForm({ ...form, data_lancamento: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Total de Unidades</Label><Input type="number" value={form.total_units} onChange={e => setForm({ ...form, total_units: Number(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label>Endereço</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={create.isPending || update.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unit Dialog */}
      <Dialog open={!!unitDialog} onOpenChange={v => !v && setUnitDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Adicionar Unidade</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Identificação *</Label><Input value={unitForm.unit_identifier} onChange={e => setUnitForm({ ...unitForm, unit_identifier: e.target.value })} placeholder="Ex: Lote 15, Apto 102" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Área (m²)</Label><Input type="number" value={unitForm.area || ""} onChange={e => setUnitForm({ ...unitForm, area: Number(e.target.value) })} /></div>
              <div className="space-y-1.5"><Label>Preço (R$)</Label><Input type="number" value={unitForm.price || ""} onChange={e => setUnitForm({ ...unitForm, price: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Andar</Label><Input value={unitForm.floor} onChange={e => setUnitForm({ ...unitForm, floor: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Tipologia</Label><Input value={unitForm.typology} onChange={e => setUnitForm({ ...unitForm, typology: e.target.value })} placeholder="Ex: 2 quartos" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnitDialog(null)}>Cancelar</Button>
            <Button onClick={handleAddUnit} disabled={createUnit.isPending}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
