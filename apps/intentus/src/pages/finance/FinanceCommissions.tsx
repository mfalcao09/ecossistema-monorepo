import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, DollarSign, Users, Building, Search, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  useAllCommissionSplits,
  useCreateCommissionSplit,
  useUpdateCommissionSplit,
  useDeleteCommissionSplit,
  commissionRoleLabels,
  commissionStatusLabels,
  type CommissionSplit,
} from "@/hooks/useCommissionSplits";

const roleValues = Object.keys(commissionRoleLabels);
const statusValues = Object.keys(commissionStatusLabels);

export default function FinanceCommissions() {
  const { data: splits = [], isLoading } = useAllCommissionSplits();
  const create = useCreateCommissionSplit();
  const update = useUpdateCommissionSplit();
  const remove = useDeleteCommissionSplit();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CommissionSplit | null>(null);
  const [form, setForm] = useState({
    contract_id: null as string | null,
    deal_request_id: null as string | null,
    person_id: null as string | null,
    role: "house",
    percentage: 0,
    calculated_value: 0,
    status: "pendente",
    payment_date: null as string | null,
    nf_number: "",
    rpa_number: "",
    tax_inss: 0,
    tax_irrf: 0,
    net_value: 0,
    notes: "",
  });

  const totalPendente = splits.filter(s => s.status === "pendente").reduce((sum, s) => sum + Number(s.calculated_value), 0);
  const totalPago = splits.filter(s => s.status === "pago").reduce((sum, s) => sum + Number(s.calculated_value), 0);
  const houseSplits = splits.filter(s => s.role === "house");
  const brokerSplits = splits.filter(s => s.role !== "house");

  function openEdit(s: CommissionSplit) {
    setEditing(s);
    setForm({
      contract_id: s.contract_id,
      deal_request_id: s.deal_request_id,
      person_id: s.person_id,
      role: s.role,
      percentage: s.percentage,
      calculated_value: s.calculated_value,
      status: s.status,
      payment_date: s.payment_date,
      nf_number: s.nf_number || "",
      rpa_number: s.rpa_number || "",
      tax_inss: s.tax_inss,
      tax_irrf: s.tax_irrf,
      net_value: s.net_value,
      notes: s.notes || "",
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (editing) {
      // Item 12: Block payment without NF/RPA for non-house roles
      if (form.status === "pago" && form.role !== "house") {
        if (!form.nf_number && !form.rpa_number) {
          toast.error("É necessário informar o Nº da NF (PJ) ou RPA (PF) antes de marcar como pago.");
          return;
        }
      }
      update.mutate({ id: editing.id, ...form } as any, { onSuccess: () => setDialogOpen(false) });
    }
  }

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Comissões</h1>
          <p className="text-muted-foreground text-sm">Rateio de comissões entre imobiliária, captador e vendedor</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pendente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{fmt(totalPendente)}</div>
            <p className="text-xs text-muted-foreground mt-1">{splits.filter(s => s.status === "pendente").length} rateios pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{fmt(totalPago)}</div>
            <p className="text-xs text-muted-foreground mt-1">{splits.filter(s => s.status === "pago").length} comissões pagas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receita House</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              {fmt(houseSplits.reduce((s, c) => s + Number(c.calculated_value), 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">A Pagar Corretores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              {fmt(brokerSplits.filter(s => s.status !== "pago").reduce((s, c) => s + Number(c.net_value), 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="todos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="todos">Todos os Rateios</TabsTrigger>
          <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        {["todos", "pendentes", "pagos"].map((tab) => {
          const filtered = tab === "pendentes" ? splits.filter(s => s.status === "pendente")
            : tab === "pagos" ? splits.filter(s => s.status === "pago")
            : splits;
          return (
            <TabsContent key={tab} value={tab}>
              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Papel</TableHead>
                        <TableHead>%</TableHead>
                        <TableHead>Valor Bruto</TableHead>
                        <TableHead>INSS</TableHead>
                        <TableHead>IRRF</TableHead>
                        <TableHead>Valor Líquido</TableHead>
                        <TableHead>NF/RPA</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
                      ) : filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                            <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-30" />
                            Nenhum rateio de comissão encontrado. Os rateios são criados a partir dos contratos/negócios.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell>
                              <Badge variant={s.role === "house" ? "default" : "secondary"}>
                                {commissionRoleLabels[s.role] || s.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono">{s.percentage}%</TableCell>
                            <TableCell className="font-medium">{fmt(Number(s.calculated_value))}</TableCell>
                            <TableCell className="text-muted-foreground">{fmt(Number(s.tax_inss))}</TableCell>
                            <TableCell className="text-muted-foreground">{fmt(Number(s.tax_irrf))}</TableCell>
                            <TableCell className="font-bold">{fmt(Number(s.net_value))}</TableCell>
                            <TableCell className="font-mono text-sm">
                              {s.nf_number || s.rpa_number || (
                                s.role !== "house" ? (
                                  <span className="flex items-center gap-1 text-amber-600 text-xs">
                                    <AlertCircle className="h-3 w-3" /> Pendente
                                  </span>
                                ) : "—"
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={s.status === "pago" ? "default" : s.status === "pendente" ? "secondary" : "outline"}>
                                {commissionStatusLabels[s.status] || s.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Rateio de Comissão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Papel</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roleValues.map((v) => <SelectItem key={v} value={v}>{commissionRoleLabels[v]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusValues.map((v) => <SelectItem key={v} value={v}>{commissionStatusLabels[v]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Percentual (%)</Label>
                <Input type="number" value={form.percentage} onChange={(e) => setForm({ ...form, percentage: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Valor Bruto (R$)</Label>
                <Input type="number" value={form.calculated_value} onChange={(e) => setForm({ ...form, calculated_value: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Valor Líquido (R$)</Label>
                <Input type="number" value={form.net_value} onChange={(e) => setForm({ ...form, net_value: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Retenção INSS (R$)</Label>
                <Input type="number" value={form.tax_inss} onChange={(e) => setForm({ ...form, tax_inss: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Retenção IRRF (R$)</Label>
                <Input type="number" value={form.tax_irrf} onChange={(e) => setForm({ ...form, tax_irrf: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nº Nota Fiscal</Label>
                <Input value={form.nf_number} onChange={(e) => setForm({ ...form, nf_number: e.target.value })} placeholder="Para corretor PJ" />
              </div>
              <div className="space-y-1.5">
                <Label>Nº RPA</Label>
                <Input value={form.rpa_number} onChange={(e) => setForm({ ...form, rpa_number: e.target.value })} placeholder="Para corretor PF" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Data de Pagamento</Label>
              <Input type="date" value={form.payment_date || ""} onChange={(e) => setForm({ ...form, payment_date: e.target.value || null })} />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={update.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
