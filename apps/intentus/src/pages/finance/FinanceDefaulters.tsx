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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, AlertTriangle, Clock, Users, FileText, Plus, Pencil, Trash2, Zap, Bell, Handshake, Sparkles } from "lucide-react";
import { DefaultRiskDialog } from "@/components/finance/DefaultRiskDialog";
import { DefaultRiskPredictionWidget } from "@/components/contracts/command-center/DefaultRiskPredictionWidget";
import {
  useCollectionRules, useCreateCollectionRule, useUpdateCollectionRule, useDeleteCollectionRule,
  collectionActionLabels, type CollectionRule,
} from "@/hooks/useCollectionRules";
import {
  useDebtAgreements, useCreateDebtAgreement, useUpdateDebtAgreement, useDeleteDebtAgreement,
  agreementStatusLabels, agreementStatusColors, type DebtAgreement,
} from "@/hooks/useDebtAgreements";
import { useContracts } from "@/hooks/useContracts";
import { format } from "date-fns";

const actionTypeValues = Object.keys(collectionActionLabels);
const agreementStatusValues = Object.keys(agreementStatusLabels);

function CollectionRulesTab() {
  const { data: rules = [], isLoading } = useCollectionRules();
  const create = useCreateCollectionRule();
  const update = useUpdateCollectionRule();
  const remove = useDeleteCollectionRule();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CollectionRule | null>(null);
  const [form, setForm] = useState({
    name: "", days_after_due: 0, action_type: "lembrete_vencimento",
    message_template: "", notify_webhook: false, block_owner_transfer: false,
    create_legal_card: false, department: "", active: true, sort_order: 0,
  });

  function openNew() {
    setEditing(null);
    setForm({ name: "", days_after_due: 0, action_type: "lembrete_vencimento", message_template: "", notify_webhook: false, block_owner_transfer: false, create_legal_card: false, department: "", active: true, sort_order: rules.length });
    setDialogOpen(true);
  }

  function openEdit(r: CollectionRule) {
    setEditing(r);
    setForm({ name: r.name, days_after_due: r.days_after_due, action_type: r.action_type, message_template: r.message_template || "", notify_webhook: r.notify_webhook, block_owner_transfer: r.block_owner_transfer, create_legal_card: r.create_legal_card, department: r.department || "", active: r.active, sort_order: r.sort_order });
    setDialogOpen(true);
  }

  function handleSave() {
    if (editing) {
      update.mutate({ id: editing.id, ...form } as any, { onSuccess: () => setDialogOpen(false) });
    } else {
      create.mutate(form as any, { onSuccess: () => setDialogOpen(false) });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Configure as regras automáticas de cobrança.</p>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Regra</Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>D+</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Webhook</TableHead>
                <TableHead>Bloqueia Repasse</TableHead>
                <TableHead>Card Jurídico</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : rules.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground"><Bell className="h-10 w-10 mx-auto mb-2 opacity-30" />Nenhuma regra configurada.</TableCell></TableRow>
              ) : (
                rules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono font-bold">{r.days_after_due < 0 ? `D${r.days_after_due}` : `D+${r.days_after_due}`}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell><Badge variant="secondary">{collectionActionLabels[r.action_type] || r.action_type}</Badge></TableCell>
                    <TableCell>{r.notify_webhook ? <Zap className="h-4 w-4 text-amber-500" /> : "—"}</TableCell>
                    <TableCell>{r.block_owner_transfer ? <Badge variant="destructive" className="text-xs">Sim</Badge> : "—"}</TableCell>
                    <TableCell>{r.create_legal_card ? <Badge className="text-xs">Sim</Badge> : "—"}</TableCell>
                    <TableCell><Badge variant={r.active ? "default" : "outline"}>{r.active ? "Ativo" : "Inativo"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Regra" : "Nova Regra de Cobrança"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Dias após vencimento *</Label><Input type="number" value={form.days_after_due} onChange={(e) => setForm({ ...form, days_after_due: Number(e.target.value) })} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de Ação *</Label>
              <Select value={form.action_type} onValueChange={(v) => setForm({ ...form, action_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{actionTypeValues.map((v) => <SelectItem key={v} value={v}>{collectionActionLabels[v]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Template Mensagem</Label><Textarea value={form.message_template} onChange={(e) => setForm({ ...form, message_template: e.target.value })} rows={3} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Departamento</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Ordem</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between"><Label>Disparar Webhook</Label><Switch checked={form.notify_webhook} onCheckedChange={(v) => setForm({ ...form, notify_webhook: v })} /></div>
              <div className="flex items-center justify-between"><Label>Bloquear Repasse</Label><Switch checked={form.block_owner_transfer} onCheckedChange={(v) => setForm({ ...form, block_owner_transfer: v })} /></div>
              <div className="flex items-center justify-between"><Label>Criar Card Jurídico</Label><Switch checked={form.create_legal_card} onCheckedChange={(v) => setForm({ ...form, create_legal_card: v })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || create.isPending || update.isPending}>{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DebtAgreementsTab() {
  const { data: agreements = [], isLoading } = useDebtAgreements();
  const { data: contracts = [] } = useContracts();
  const create = useCreateDebtAgreement();
  const update = useUpdateDebtAgreement();
  const remove = useDeleteDebtAgreement();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    contract_id: "",
    person_id: "",
    original_debt: 0,
    discount_percentage: 0,
    agreed_value: 0,
    installments_count: 1,
    first_due_date: "",
    status: "proposta",
    confession_term_notes: "",
    notes: "",
  });

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const totalActive = agreements.filter((a: any) => a.status === "ativo").reduce((s: number, a: any) => s + Number(a.agreed_value), 0);

  function openNew() {
    setEditing(null);
    setForm({ contract_id: "", person_id: "", original_debt: 0, discount_percentage: 0, agreed_value: 0, installments_count: 1, first_due_date: "", status: "proposta", confession_term_notes: "", notes: "" });
    setDialogOpen(true);
  }

  function openEdit(a: any) {
    setEditing(a);
    setForm({
      contract_id: a.contract_id, person_id: a.person_id,
      original_debt: Number(a.original_debt), discount_percentage: Number(a.discount_percentage),
      agreed_value: Number(a.agreed_value), installments_count: a.installments_count,
      first_due_date: a.first_due_date, status: a.status,
      confession_term_notes: a.confession_term_notes || "", notes: a.notes || "",
    });
    setDialogOpen(true);
  }

  // Auto-calc agreed_value when discount changes
  function updateDiscount(pct: number) {
    const agreed = Math.round(form.original_debt * (1 - pct / 100) * 100) / 100;
    setForm({ ...form, discount_percentage: pct, agreed_value: agreed });
  }

  function handleSave() {
    const payload = { ...form, confession_term_notes: form.confession_term_notes || null, notes: form.notes || null };
    if (editing) {
      update.mutate({ id: editing.id, ...payload } as any, { onSuccess: () => setDialogOpen(false) });
    } else {
      create.mutate(payload as any, { onSuccess: () => setDialogOpen(false) });
    }
  }

  // Get person options from contracts' parties
  const contractParties = contracts.find((c: any) => c.id === form.contract_id)?.contract_parties || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Acordos de renegociação de dívida e termos de confissão.</p>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Acordo</Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imóvel</TableHead>
                <TableHead>Devedor</TableHead>
                <TableHead>Dívida Original</TableHead>
                <TableHead>Desconto</TableHead>
                <TableHead>Valor Acordado</TableHead>
                <TableHead>Parcelas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : agreements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <Handshake className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    Nenhum acordo de inadimplência. Crie um acordo para renegociar dívidas.
                  </TableCell>
                </TableRow>
              ) : (
                agreements.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.contracts?.properties?.title || "—"}</TableCell>
                    <TableCell>{a.people?.name || "—"}</TableCell>
                    <TableCell>{fmt(Number(a.original_debt))}</TableCell>
                    <TableCell className="font-mono">{Number(a.discount_percentage)}%</TableCell>
                    <TableCell className="font-bold">{fmt(Number(a.agreed_value))}</TableCell>
                    <TableCell>{a.installments_count}x</TableCell>
                    <TableCell>
                      <Badge className={agreementStatusColors[a.status] || ""}>{agreementStatusLabels[a.status] || a.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove.mutate(a.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Acordo" : "Novo Acordo de Inadimplência"}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-1.5">
              <Label>Contrato *</Label>
              <Select value={form.contract_id} onValueChange={(v) => setForm({ ...form, contract_id: v, person_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {contracts.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.properties?.title || "Sem imóvel"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.contract_id && contractParties.length > 0 && (
              <div className="space-y-1.5">
                <Label>Devedor *</Label>
                <Select value={form.person_id} onValueChange={(v) => setForm({ ...form, person_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {contractParties.map((p: any) => (
                      <SelectItem key={p.person_id} value={p.person_id}>{p.people?.name || p.person_id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Dívida Original (R$) *</Label>
                <Input type="number" value={form.original_debt} onChange={(e) => { const v = Number(e.target.value); setForm({ ...form, original_debt: v, agreed_value: Math.round(v * (1 - form.discount_percentage / 100) * 100) / 100 }); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Desconto (%)</Label>
                <Input type="number" value={form.discount_percentage} onChange={(e) => updateDiscount(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Valor Acordado (R$)</Label>
                <Input type="number" value={form.agreed_value} onChange={(e) => setForm({ ...form, agreed_value: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nº Parcelas *</Label>
                <Input type="number" min={1} value={form.installments_count} onChange={(e) => setForm({ ...form, installments_count: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>1º Vencimento *</Label>
                <Input type="date" value={form.first_due_date} onChange={(e) => setForm({ ...form, first_due_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {agreementStatusValues.map((v) => <SelectItem key={v} value={v}>{agreementStatusLabels[v]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Termo de Confissão de Dívida</Label>
              <Textarea value={form.confession_term_notes} onChange={(e) => setForm({ ...form, confession_term_notes: e.target.value })} rows={3} placeholder="Cláusulas do termo de confissão..." />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.contract_id || !form.person_id || !form.first_due_date || create.isPending || update.isPending}>
              {editing ? "Salvar" : "Criar Acordo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function FinanceDefaulters() {
  const [search, setSearch] = useState("");
  const [riskDialogPerson, setRiskDialogPerson] = useState<{ id: string; name: string } | null>(null);
  const { data: agreements = [] } = useDebtAgreements();
  const activeAgreements = agreements.filter((a: any) => a.status === "ativo");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Inadimplência</h1>
          <p className="text-muted-foreground text-sm">Controle de atrasos, régua de cobrança e acordos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Exportar</Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setRiskDialogPerson({ id: "", name: "" })}>
            <Sparkles className="h-4 w-4" /> Análise de Risco IA
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Inadimplente</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">R$ 0,00</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><AlertTriangle className="h-3 w-3" /> 0 títulos em atraso</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Inquilinos Inadimplentes</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Users className="h-3 w-3" /> De 0 contratos ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Acordos Ativos</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{activeAgreements.length}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <FileText className="h-3 w-3" /> {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(activeAgreements.reduce((s: number, a: any) => s + Number(a.agreed_value), 0))} em acordos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Tempo Médio Atraso</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0 dias</div>
            <p className="text-xs text-muted-foreground">Média dos títulos em aberto</p>
          </CardContent>
        </Card>
      </div>

      {/* Predição de Inadimplência — IA Predictive Analytics */}
      <DefaultRiskPredictionWidget />

      <Tabs defaultValue="inadimplentes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inadimplentes">Inadimplentes</TabsTrigger>
          <TabsTrigger value="regua">Régua de Cobrança</TabsTrigger>
          <TabsTrigger value="acordos">Acordos</TabsTrigger>
        </TabsList>

        <TabsContent value="inadimplentes">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar inquilino, imóvel..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inquilino</TableHead>
                    <TableHead>Imóvel</TableHead>
                    <TableHead>Parcelas Atrasadas</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Dias em Atraso</TableHead>
                    <TableHead>Último Contato</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      Nenhum inadimplente encontrado. Os títulos vencidos aparecerão aqui automaticamente.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regua">
          <CollectionRulesTab />
        </TabsContent>

        <TabsContent value="acordos">
          <DebtAgreementsTab />
        </TabsContent>
      </Tabs>

      {riskDialogPerson && riskDialogPerson.id && (
        <DefaultRiskDialog
          open={!!riskDialogPerson?.id}
          onOpenChange={(o) => { if (!o) setRiskDialogPerson(null); }}
          personId={riskDialogPerson.id}
          personName={riskDialogPerson.name}
        />
      )}
    </div>
  );
}
