import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Receipt, Calculator, FileText } from "lucide-react";
import { useIRWithholdings, useCreateIRWithholding, calculateIR, useIRBrackets } from "@/hooks/useIRWithholdings";
import { useContracts } from "@/hooks/useContracts";

export default function FinanceIRWithholding() {
  const { data: withholdings = [], isLoading } = useIRWithholdings();
  const { data: contracts = [] } = useContracts({ status: "ativo", contract_type: "locacao" });
  const { data: brackets } = useIRBrackets();
  const createIR = useCreateIRWithholding();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    contract_id: "",
    reference_month: "",
    gross_rent: 0,
    notes: "",
  });

  const selectedContract = contracts.find((c: any) => c.id === form.contract_id);
  const parties = selectedContract?.contract_parties || [];
  const tenant = parties.find((p: any) => p.role === "locatario");
  const owner = parties.find((p: any) => p.role === "proprietario");

  const irCalc = calculateIR(form.gross_rent, brackets);
  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const currentYear = new Date().getFullYear();
  const activeWithholdings = withholdings.filter((w: any) => w.status !== "cancelado");
  const yearTotal = useMemo(() =>
    activeWithholdings
      .filter((w: any) => w.reference_month?.startsWith(String(currentYear)))
      .reduce((s: number, w: any) => s + Number(w.ir_value), 0),
    [activeWithholdings, currentYear]
  );
  const distinctContracts = useMemo(() =>
    new Set(activeWithholdings.map((w: any) => w.contract_id)).size,
    [activeWithholdings]
  );

  function openNew() {
    setForm({ contract_id: "", reference_month: "", gross_rent: 0, notes: "" });
    setDialogOpen(true);
  }

  function handleContractChange(contractId: string) {
    const c = contracts.find((ct: any) => ct.id === contractId);
    setForm({ ...form, contract_id: contractId, gross_rent: Number(c?.monthly_value || 0) });
  }

  function handleSave() {
    if (!tenant || !owner) return;
    createIR.mutate({
      contract_id: form.contract_id,
      tenant_person_id: tenant.person_id,
      owner_person_id: owner.person_id,
      reference_month: form.reference_month,
      gross_rent: form.gross_rent,
      ...irCalc,
      notes: form.notes || undefined,
    }, { onSuccess: () => setDialogOpen(false) });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Retenção de IR para DIMOB</h1>
          <p className="text-muted-foreground text-sm">Registro de valores retidos na fonte para declaração DIMOB</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Retenção</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeWithholdings.length}</p>
                <p className="text-xs text-muted-foreground">Total de Registros</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Calculator className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{fmt(yearTotal)}</p>
                <p className="text-xs text-muted-foreground">IR Retido no Ano ({currentYear})</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{distinctContracts}</p>
                <p className="text-xs text-muted-foreground">Contratos com Retenção</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imóvel</TableHead>
                <TableHead>Locatário (PJ)</TableHead>
                <TableHead>Proprietário (PF)</TableHead>
                <TableHead>Mês Ref.</TableHead>
                <TableHead>Aluguel Bruto</TableHead>
                <TableHead>Alíquota</TableHead>
                <TableHead>IR Retido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : withholdings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    Nenhuma retenção de IR registrada.
                  </TableCell>
                </TableRow>
              ) : (
                withholdings.map((w: any) => (
                  <TableRow key={w.id} className={w.status === "cancelado" ? "opacity-50" : ""}>
                    <TableCell className="font-medium">
                      {w.contracts?.properties?.title || "—"}
                      {w.status === "cancelado" && <Badge variant="outline" className="ml-2">Cancelado</Badge>}
                    </TableCell>
                    <TableCell>{w.tenant?.name || "—"}</TableCell>
                    <TableCell>{w.owner?.name || "—"}</TableCell>
                    <TableCell>{w.reference_month}</TableCell>
                    <TableCell>{fmt(Number(w.gross_rent))}</TableCell>
                    <TableCell className="font-mono">{w.ir_rate}%</TableCell>
                    <TableCell className="font-bold">{fmt(Number(w.ir_value))}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Retenção de IR</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Contrato de Locação *</Label>
              <Select value={form.contract_id} onValueChange={handleContractChange}>
                <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
                <SelectContent>
                  {contracts.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.properties?.title || "Sem imóvel"} — {fmt(Number(c.monthly_value || 0))}/mês
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.contract_id && (
              <div className="text-sm space-y-1 rounded-lg border p-3 bg-muted/30">
                <p><span className="text-muted-foreground">Locatário:</span> {(tenant?.people as any)?.name || "Não definido"}</p>
                <p><span className="text-muted-foreground">Proprietário:</span> {(owner?.people as any)?.name || "Não definido"}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Mês Referência *</Label>
                <Input type="month" value={form.reference_month} onChange={(e) => setForm({ ...form, reference_month: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Aluguel Bruto *</Label>
                <Input type="number" step="0.01" value={form.gross_rent} onChange={(e) => setForm({ ...form, gross_rent: Number(e.target.value) })} />
              </div>
            </div>

            {form.gross_rent > 0 && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4 pb-4 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Base de cálculo:</span>
                    <span>{fmt(irCalc.ir_base)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Alíquota:</span>
                    <span>{irCalc.ir_rate}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Dedução:</span>
                    <span>{fmt(irCalc.ir_deduction)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t pt-1">
                    <span className="text-muted-foreground">IR Retido:</span>
                    <span className="text-primary">{fmt(irCalc.ir_value)}</span>
                  </div>
                  {irCalc.ir_value === 0 && (
                    <p className="text-xs text-green-600 mt-1">Isento — valor abaixo da faixa de tributação.</p>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.contract_id || !form.reference_month || createIR.isPending}>
              Registrar Retenção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
