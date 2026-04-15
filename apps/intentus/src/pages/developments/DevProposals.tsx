import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileText, Eye } from "lucide-react";
import { useDevelopments } from "@/hooks/useDevelopments";
import { useDevelopmentProposals, useCreateProposal, useUpdateProposalStatus } from "@/hooks/useDevelopmentProposals";
import { usePeople } from "@/hooks/usePeople";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const statusLabels: Record<string, string> = {
  rascunho: "Rascunho", analise_comercial: "Análise Comercial", aprovada: "Aprovada", reprovada: "Reprovada", cancelada: "Cancelada",
};
const statusColors: Record<string, string> = {
  rascunho: "bg-gray-100 text-gray-800", analise_comercial: "bg-blue-100 text-blue-800", aprovada: "bg-emerald-100 text-emerald-800", reprovada: "bg-red-100 text-red-800", cancelada: "bg-gray-100 text-gray-500",
};

export default function DevProposals() {
  const { data: developments = [] } = useDevelopments();
  const [filterDev, setFilterDev] = useState<string>("all");
  const { data: proposals = [], isLoading } = useDevelopmentProposals(filterDev !== "all" ? filterDev : undefined);
  const updateStatus = useUpdateProposalStatus();
  const createProposal = useCreateProposal();
  const { data: people = [] } = usePeople();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailProp, setDetailProp] = useState<any>(null);
  const [form, setForm] = useState({
    development_id: "", unit_id: "", client_person_id: "", broker_person_id: "",
    valor_total_proposto: 0, valor_entrada: 0, qtd_parcelas_mensais: 12, valor_parcela_mensal: 0,
    qtd_parcelas_intermediarias: 0, valor_parcela_intermediaria: 0, valor_financiamento: 0,
    desconto_percentual: 0, observacoes: "",
  });

  // Available units for the selected development
  const selectedDev = developments.find((d: any) => d.id === form.development_id);
  const availableUnits = (selectedDev?.development_units || []).filter((u: any) => u.status === "disponivel");

  function openCreate() {
    setForm({ development_id: developments[0]?.id || "", unit_id: "", client_person_id: "", broker_person_id: "", valor_total_proposto: 0, valor_entrada: 0, qtd_parcelas_mensais: 12, valor_parcela_mensal: 0, qtd_parcelas_intermediarias: 0, valor_parcela_intermediaria: 0, valor_financiamento: 0, desconto_percentual: 0, observacoes: "" });
    setDialogOpen(true);
  }

  function handleCreate() {
    if (!form.unit_id || !form.client_person_id || !form.development_id) return;
    createProposal.mutate({
      ...form,
      valor_total_proposto: form.valor_total_proposto || form.valor_entrada + (form.qtd_parcelas_mensais * form.valor_parcela_mensal) + (form.qtd_parcelas_intermediarias * form.valor_parcela_intermediaria) + form.valor_financiamento,
    }, { onSuccess: () => setDialogOpen(false) });
  }

  // Auto-calculate total
  const autoTotal = form.valor_entrada + (form.qtd_parcelas_mensais * form.valor_parcela_mensal) + (form.qtd_parcelas_intermediarias * form.valor_parcela_intermediaria) + form.valor_financiamento;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display">Propostas</h1>
          <p className="text-muted-foreground text-sm">Motor de propostas e negociação de unidades</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterDev} onValueChange={setFilterDev}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar empreendimento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {developments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Nova Proposta</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Carregando...</div>
      ) : proposals.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma proposta encontrada.</p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.development_units?.unit_identifier || "—"}</TableCell>
                    <TableCell>{p.client?.full_name || "—"}</TableCell>
                    <TableCell>{fmt(Number(p.valor_total_proposto))}</TableCell>
                    <TableCell>{fmt(Number(p.valor_entrada))}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[p.status] || ""}>{statusLabels[p.status] || p.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailProp(p)}><Eye className="h-3.5 w-3.5" /></Button>
                      {p.status === "rascunho" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus.mutate({ id: p.id, status: "analise_comercial" })}>Enviar</Button>
                      )}
                      {p.status === "analise_comercial" && (
                        <>
                          <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => updateStatus.mutate({ id: p.id, status: "aprovada" })}>Aprovar</Button>
                          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => updateStatus.mutate({ id: p.id, status: "reprovada" })}>Reprovar</Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailProp} onOpenChange={v => !v && setDetailProp(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Detalhes da Proposta</DialogTitle></DialogHeader>
          {detailProp && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground text-xs">Unidade</p><p className="font-medium">{detailProp.development_units?.unit_identifier}</p></div>
                <div><p className="text-muted-foreground text-xs">Cliente</p><p className="font-medium">{detailProp.client?.full_name}</p></div>
                <div><p className="text-muted-foreground text-xs">Corretor</p><p className="font-medium">{detailProp.broker?.full_name || "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Status</p><Badge className={statusColors[detailProp.status]}>{statusLabels[detailProp.status]}</Badge></div>
              </div>
              <div className="border-t pt-3 grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground text-xs">Valor Total</p><p className="font-bold">{fmt(Number(detailProp.valor_total_proposto))}</p></div>
                <div><p className="text-muted-foreground text-xs">Entrada</p><p className="font-medium">{fmt(Number(detailProp.valor_entrada))}</p></div>
                <div><p className="text-muted-foreground text-xs">Parcelas Mensais</p><p className="font-medium">{detailProp.qtd_parcelas_mensais}x de {fmt(Number(detailProp.valor_parcela_mensal))}</p></div>
                {detailProp.valor_financiamento > 0 && <div><p className="text-muted-foreground text-xs">Financiamento</p><p className="font-medium">{fmt(Number(detailProp.valor_financiamento))}</p></div>}
                {detailProp.desconto_percentual > 0 && <div><p className="text-muted-foreground text-xs">Desconto</p><p className="font-medium">{detailProp.desconto_percentual}%</p></div>}
              </div>
              {detailProp.observacoes && <div className="border-t pt-3"><p className="text-muted-foreground text-xs">Observações</p><p>{detailProp.observacoes}</p></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Proposal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Proposta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Empreendimento *</Label>
              <Select value={form.development_id} onValueChange={v => setForm({ ...form, development_id: v, unit_id: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{developments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Unidade * (somente disponíveis)</Label>
              <Select value={form.unit_id} onValueChange={v => setForm({ ...form, unit_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar unidade" /></SelectTrigger>
                <SelectContent>
                  {availableUnits.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.unit_identifier} {u.price ? `- ${fmt(Number(u.price))}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cliente *</Label>
              <Select value={form.client_person_id} onValueChange={v => setForm({ ...form, client_person_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                <SelectContent>{people.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name} {p.cpf_cnpj ? `(${p.cpf_cnpj})` : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2">Plano Financeiro</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Entrada (R$)</Label><Input type="number" value={form.valor_entrada || ""} onChange={e => setForm({ ...form, valor_entrada: Number(e.target.value) })} /></div>
                <div className="space-y-1.5"><Label>Parcelas Mensais</Label><Input type="number" value={form.qtd_parcelas_mensais} onChange={e => setForm({ ...form, qtd_parcelas_mensais: Number(e.target.value) })} /></div>
                <div className="space-y-1.5"><Label>Valor Parcela Mensal</Label><Input type="number" value={form.valor_parcela_mensal || ""} onChange={e => setForm({ ...form, valor_parcela_mensal: Number(e.target.value) })} /></div>
                <div className="space-y-1.5"><Label>Financiamento (R$)</Label><Input type="number" value={form.valor_financiamento || ""} onChange={e => setForm({ ...form, valor_financiamento: Number(e.target.value) })} /></div>
                <div className="space-y-1.5"><Label>Parcelas Intermediárias</Label><Input type="number" value={form.qtd_parcelas_intermediarias || ""} onChange={e => setForm({ ...form, qtd_parcelas_intermediarias: Number(e.target.value) })} /></div>
                <div className="space-y-1.5"><Label>Valor Intermediária</Label><Input type="number" value={form.valor_parcela_intermediaria || ""} onChange={e => setForm({ ...form, valor_parcela_intermediaria: Number(e.target.value) })} /></div>
              </div>
              <div className="mt-3 p-3 bg-muted rounded-md">
                <p className="text-sm"><span className="text-muted-foreground">Total Calculado: </span><span className="font-bold">{fmt(autoTotal)}</span></p>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Desconto (%)</Label><Input type="number" value={form.desconto_percentual || ""} onChange={e => setForm({ ...form, desconto_percentual: Number(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createProposal.isPending}>Criar Proposta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
