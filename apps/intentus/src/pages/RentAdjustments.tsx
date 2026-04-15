import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Check, Calculator, Eye, Scale, AlertTriangle } from "lucide-react";
import {
  useRentAdjustments,
  useCreateRentAdjustment,
  useApplyRentAdjustment,
  useUpdateRentAdjustment,
  indexTypeLabels,
  adjustmentStatusLabels,
} from "@/hooks/useRentAdjustments";
import { useContracts } from "@/hooks/useContracts";
import { useProfiles } from "@/hooks/useDealCardFeatures";
import { format } from "date-fns";

export default function RentAdjustments() {
  const { data: adjustments = [], isLoading: adjLoading } = useRentAdjustments();
  const { data: contracts = [], isLoading: ctLoading } = useContracts({ status: "ativo", contract_type: "locacao" });
  const createAdj = useCreateRentAdjustment();
  const applyAdj = useApplyRentAdjustment();
  const updateAdj = useUpdateRentAdjustment();
  const { data: profiles = [] } = useProfiles();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewAdj, setViewAdj] = useState<any>(null);
  const [form, setForm] = useState({
    contract_id: "",
    adjustment_date: "",
    index_type: "igpm" as string,
    index_percentage: 0,
    notes: "",
    requires_addendum: false,
  });

  const selectedContract = contracts.find((c: any) => c.id === form.contract_id);
  const previousValue = (selectedContract as any)?.monthly_value || 0;
  const newValue = Math.round(previousValue * (1 + form.index_percentage / 100) * 100) / 100;
  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const pendingContracts = (() => {
    if (ctLoading || adjLoading) return [];
    const now = new Date();
    const result: any[] = [];
    for (const c of contracts as any[]) {
      if (!c.start_date || !c.adjustment_index) continue;
      const start = new Date(c.start_date + "T00:00:00");
      const yearsSince = now.getFullYear() - start.getFullYear();
      const nextAnniversary = new Date(start);
      nextAnniversary.setFullYear(start.getFullYear() + yearsSince);
      if (nextAnniversary < now) nextAnniversary.setFullYear(nextAnniversary.getFullYear() + 1);
      const prevAnniversary = new Date(nextAnniversary);
      prevAnniversary.setFullYear(prevAnniversary.getFullYear() - 1);
      const cycleYear = prevAnniversary > start ? prevAnniversary.getFullYear() : nextAnniversary.getFullYear();
      const hasAdj = adjustments.some((a: any) => {
        if (a.contract_id !== c.id) return false;
        const adjDate = new Date(a.adjustment_date + "T00:00:00");
        return adjDate.getFullYear() === cycleYear;
      });
      if (!hasAdj) {
        const daysUntil = Math.ceil((nextAnniversary.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const dataBase = prevAnniversary >= start ? prevAnniversary : nextAnniversary;
        result.push({ ...c, data_base: dataBase.toISOString().split("T")[0], next_anniversary: nextAnniversary.toISOString().split("T")[0], days_until: daysUntil });
      }
    }
    return result.sort((a, b) => a.days_until - b.days_until);
  })();

  const pendingAdjustments = adjustments.filter((a: any) => a.status === "pendente");
  const doneAdjustments = adjustments.filter((a: any) => a.status !== "pendente");

  function openNew(contractId?: string) {
    const defaultDate = contractId ? pendingContracts.find((c: any) => c.id === contractId)?.next_anniversary || "" : "";
    const contract = contractId ? contracts.find((c: any) => c.id === contractId) : undefined;
    setForm({
      contract_id: contractId || "",
      adjustment_date: defaultDate,
      index_type: (contract as any)?.adjustment_index || "igpm",
      index_percentage: 0,
      notes: "",
      requires_addendum: false,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    createAdj.mutate({
      contract_id: form.contract_id,
      adjustment_date: form.adjustment_date,
      index_type: form.index_type as any,
      index_percentage: form.index_percentage,
      previous_value: previousValue,
      new_value: newValue,
      status: "pendente",
      notes: form.notes || null,
      requires_addendum: form.requires_addendum,
      deal_request_id: null,
      property_id: (selectedContract as any)?.property_id || (selectedContract as any)?.properties?.id,
    } as any, { onSuccess: () => setDialogOpen(false) });
  }

  const isLoading = adjLoading || ctLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Reajustes</h1>
          <p className="text-muted-foreground text-sm">Gerencie os reajustes anuais de aluguel por índice econômico (IGP-M, IPCA, INPC ou manual).</p>
        </div>
        <Button onClick={() => openNew()} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Reajuste</Button>
      </div>

      {/* Pendentes */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" /> Pendentes
          {(pendingContracts.length + pendingAdjustments.length) > 0 && <Badge variant="secondary" className="ml-1">{pendingContracts.length + pendingAdjustments.length}</Badge>}
        </h3>
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                   <TableHead>Imóvel</TableHead>
                  <TableHead>Índice</TableHead>
                  <TableHead>Valor Atual</TableHead>
                  <TableHead>Data-Base</TableHead>
                  <TableHead>Próximo Aniversário</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : (pendingContracts.length === 0 && pendingAdjustments.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <Check className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      Todos os contratos estão com reajustes em dia.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {pendingAdjustments.map((a: any) => (
                      <TableRow key={a.id} className="bg-amber-50/50 dark:bg-amber-950/10">
                        <TableCell className="font-medium">{a.contracts?.properties?.title || "—"}</TableCell>
                        <TableCell><Badge variant="outline">{indexTypeLabels[a.index_type] || a.index_type}</Badge></TableCell>
                        <TableCell>{fmt(Number(a.previous_value))} → <span className="font-bold">{fmt(Number(a.new_value))}</span></TableCell>
                        <TableCell>{format(new Date(a.adjustment_date), "dd/MM/yyyy")}</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell><Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Reajuste Pendente</Badge></TableCell>
                        <TableCell>
                          <Select
                            value={a.assigned_to || ""}
                            onValueChange={(v) => {
                              updateAdj.mutate({ id: a.id, assigned_to: v === "__none__" ? null : v } as any);
                            }}
                          >
                            <SelectTrigger className="w-[140px] h-8 text-xs">
                              <SelectValue placeholder="Atribuir..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Nenhum</SelectItem>
                              {profiles.map((p) => (
                                <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => setViewAdj(a)}><Eye className="h-3 w-3" /></Button>
                            <Button size="sm" variant="outline" onClick={() => applyAdj.mutate({ id: a.id, contractId: a.contract_id, newValue: Number(a.new_value) })} disabled={applyAdj.isPending}>
                              <Check className="h-3 w-3 mr-1" /> Aplicar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {pendingContracts.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.properties?.title || "—"}</TableCell>
                        <TableCell><Badge variant="outline">{indexTypeLabels[c.adjustment_index] || c.adjustment_index}</Badge></TableCell>
                        <TableCell>{fmt(Number(c.monthly_value || 0))}</TableCell>
                        <TableCell>{c.data_base ? format(new Date(c.data_base + "T00:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
                        <TableCell>
                          {c.next_anniversary ? format(new Date(c.next_anniversary + "T00:00:00"), "dd/MM/yyyy") : "—"}
                          {c.days_until <= 0 && <Badge variant="destructive" className="ml-2 text-xs">Vencido</Badge>}
                          {c.days_until > 0 && c.days_until <= 30 && <Badge variant="secondary" className="ml-2 text-xs">{c.days_until}d</Badge>}
                        </TableCell>
                        <TableCell>—</TableCell>
                        <TableCell><Badge variant="outline" className="text-orange-600 border-orange-300">Não Reajustado</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="default" onClick={() => openNew(c.id)}><Calculator className="h-3 w-3 mr-1" /> Criar Reajuste</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Realizados */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Check className="h-5 w-5 text-emerald-500" /> Realizados
          {doneAdjustments.length > 0 && <Badge variant="secondary" className="ml-1">{doneAdjustments.length}</Badge>}
        </h3>
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Índice</TableHead>
                  <TableHead>Percentual</TableHead>
                  <TableHead>Valor Anterior</TableHead>
                  <TableHead>Novo Valor</TableHead>
                  <TableHead>Data Reajuste</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aditivo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : doneAdjustments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      <Calculator className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      Nenhum reajuste realizado ainda.
                    </TableCell>
                  </TableRow>
                ) : (
                  doneAdjustments.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.contracts?.properties?.title || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{indexTypeLabels[a.index_type] || a.index_type}</Badge></TableCell>
                      <TableCell className="font-mono">{a.index_percentage}%</TableCell>
                      <TableCell>{fmt(Number(a.previous_value))}</TableCell>
                      <TableCell className="font-bold">{fmt(Number(a.new_value))}</TableCell>
                      <TableCell>{format(new Date(a.adjustment_date), "dd/MM/yyyy")}</TableCell>
                      <TableCell><Badge variant={a.status === "aplicado" ? "default" : "outline"}>{adjustmentStatusLabels[a.status] || a.status}</Badge></TableCell>
                      <TableCell>
                        {a.requires_addendum ? (
                          <Badge variant="outline" className="text-xs gap-1"><Scale className="h-3 w-3" />{a.deal_request_id ? "Enviado" : "Pendente"}</Badge>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => setViewAdj(a)}><Eye className="h-3 w-3" /></Button></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* View Dialog */}
      <Dialog open={!!viewAdj} onOpenChange={(open) => !open && setViewAdj(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Detalhes do Reajuste</DialogTitle></DialogHeader>
          {viewAdj && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Imóvel:</span><p className="font-medium">{viewAdj.contracts?.properties?.title || "—"}</p></div>
                <div><span className="text-muted-foreground">Índice:</span><p className="font-medium">{indexTypeLabels[viewAdj.index_type] || viewAdj.index_type}</p></div>
                <div><span className="text-muted-foreground">Percentual:</span><p className="font-medium">{viewAdj.index_percentage}%</p></div>
                <div><span className="text-muted-foreground">Data:</span><p className="font-medium">{format(new Date(viewAdj.adjustment_date), "dd/MM/yyyy")}</p></div>
                <div><span className="text-muted-foreground">Valor Anterior:</span><p className="font-medium">{fmt(Number(viewAdj.previous_value))}</p></div>
                <div><span className="text-muted-foreground">Novo Valor:</span><p className="font-medium">{fmt(Number(viewAdj.new_value))}</p></div>
                <div><span className="text-muted-foreground">Status:</span><p><Badge variant={viewAdj.status === "aplicado" ? "default" : "secondary"}>{adjustmentStatusLabels[viewAdj.status]}</Badge></p></div>
                <div><span className="text-muted-foreground">Aditivo:</span><p className="font-medium">{viewAdj.requires_addendum ? (viewAdj.deal_request_id ? "Enviado ao jurídico" : "Pendente") : "Não solicitado"}</p></div>
              </div>
              {viewAdj.notes && <div className="text-sm"><span className="text-muted-foreground">Observações:</span><p className="mt-1 whitespace-pre-wrap">{viewAdj.notes}</p></div>}
              {viewAdj.applied_at && <div className="text-sm"><span className="text-muted-foreground">Aplicado em:</span><p>{format(new Date(viewAdj.applied_at), "dd/MM/yyyy HH:mm")}</p></div>}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setViewAdj(null)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Novo Reajuste de Aluguel</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Contrato de Locação *</Label>
              <Select value={form.contract_id} onValueChange={(v) => setForm({ ...form, contract_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
                <SelectContent>
                  {contracts.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{(c as any).properties?.title || "Sem imóvel"} — {fmt(Number((c as any).monthly_value || 0))}/mês</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Índice *</Label>
                <Select value={form.index_type} onValueChange={(v) => setForm({ ...form, index_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(indexTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Percentual (%) *</Label>
                <Input type="number" step="0.01" value={form.index_percentage} onChange={(e) => setForm({ ...form, index_percentage: Number(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Data do Reajuste *</Label>
              <Input type="date" value={form.adjustment_date} onChange={(e) => setForm({ ...form, adjustment_date: e.target.value })} />
            </div>
            {form.contract_id && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4 pb-4 space-y-1">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Valor atual:</span><span>{fmt(previousValue)}</span></div>
                  <div className="flex justify-between text-sm font-bold"><span className="text-muted-foreground">Novo valor:</span><span className="text-primary">{fmt(newValue)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Diferença:</span><span className="text-green-600">+{fmt(newValue - previousValue)}</span></div>
                </CardContent>
              </Card>
            )}
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-1.5"><Scale className="h-4 w-4" /> Enviar aditivo ao jurídico?</Label>
                <p className="text-xs text-muted-foreground">Cria automaticamente um pedido de aditivo de reajuste/prorrogação para o departamento jurídico.</p>
              </div>
              <Switch checked={form.requires_addendum} onCheckedChange={(v) => setForm({ ...form, requires_addendum: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.contract_id || !form.adjustment_date || createAdj.isPending}>Criar Reajuste</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
