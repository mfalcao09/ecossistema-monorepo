import { useState } from "react";
import { useInstallments, useGenerateInstallments, useGenerateRecurringInstallments, useUpdateInstallment, type Installment } from "@/hooks/useContracts";
import { createNotification } from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useInstallmentLineItems, useCreateLineItem, useDeleteLineItem, type InstallmentLineItem } from "@/hooks/useInstallmentLineItems";
import {
  installmentStatusLabels,
  installmentStatusColors,
} from "@/lib/contractSchema";
import { lineItemTypeLabels } from "@/lib/intakeStatus";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { CalendarDays, DollarSign, Plus, CheckCircle2, ChevronDown, ChevronRight, Trash2, ListPlus } from "lucide-react";

interface ContractInstallmentsProps {
  contractId: string;
  totalValue: number | null;
  monthlyValue: number | null;
  startDate: string | null;
  contractType: string;
}

export function ContractInstallments({
  contractId,
  totalValue,
  monthlyValue,
  startDate,
  contractType,
}: ContractInstallmentsProps) {
  const { data: installments, isLoading } = useInstallments(contractId);
  const generateInstallments = useGenerateInstallments();
  const generateRecurring = useGenerateRecurringInstallments();
  const updateInstallment = useUpdateInstallment();
  const [generateOpen, setGenerateOpen] = useState(false);
  const [genMode, setGenMode] = useState<"simple" | "composed">("composed");
  const [numInstallments, setNumInstallments] = useState(12);
  const [genStartDate, setGenStartDate] = useState(startDate ?? new Date().toISOString().split("T")[0]);
  const [genTotalValue, setGenTotalValue] = useState(
    contractType === "locacao" ? (monthlyValue ?? 0) * 12 : (totalValue ?? 0)
  );
  // Line item composition for recurring
  const [compItems, setCompItems] = useState([
    { description: "Aluguel", item_type: "aluguel", amount: monthlyValue ?? 0 },
  ]);

  const handleGenerate = () => {
    if (genMode === "composed" && (contractType === "locacao" || contractType === "administracao")) {
      const totalMonthly = compItems.reduce((s, i) => s + i.amount, 0);
      generateRecurring.mutate(
        {
          contractId,
          monthlyValue: totalMonthly,
          numberOfMonths: numInstallments,
          startDate: genStartDate,
          lineItems: compItems.filter((i) => i.amount > 0),
        },
        { onSuccess: () => setGenerateOpen(false) }
      );
    } else {
      generateInstallments.mutate(
        {
          contractId,
          totalValue: genTotalValue,
          numberOfInstallments: numInstallments,
          startDate: genStartDate,
        },
        { onSuccess: () => setGenerateOpen(false) }
      );
    }
  };

  const handleMarkPaid = (inst: Installment) => {
    updateInstallment.mutate(
      {
        id: inst.id,
        status: "pago",
        paid_amount: inst.amount,
        payment_date: new Date().toISOString().split("T")[0],
      },
      {
        onSuccess: () => {
          // Fire notification
          supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
              createNotification({
                userId: user.id,
                title: "Parcela paga",
                message: `Parcela de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(inst.amount)} foi marcada como paga`,
                category: "financeiro",
                referenceType: "contract",
                referenceId: contractId,
              });
            }
          });
        },
      }
    );
  };

  const formatCurrency = (value: number | null) => {
    if (value == null) return "—";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date + "T00:00:00").toLocaleDateString("pt-BR");
  };

  const paidTotal = installments?.filter((i) => i.status === "pago").reduce((s, i) => s + (i.paid_amount ?? i.amount), 0) ?? 0;
  const pendingTotal = installments?.filter((i) => i.status !== "pago" && i.status !== "cancelado").reduce((s, i) => s + i.amount, 0) ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold font-display">Parcelas / Mensalidades</h3>
        {(!installments || installments.length === 0) && (
          <Button size="sm" onClick={() => setGenerateOpen(true)}>
            <Plus className="mr-1 h-3 w-3" />
            Gerar Parcelas
          </Button>
        )}
      </div>

      {/* Summary cards */}
      {installments && installments.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Total de Parcelas</p>
            <p className="text-lg font-bold font-display">{installments.length}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-600" /> Recebido</p>
            <p className="text-lg font-bold font-display text-emerald-700">{formatCurrency(paidTotal)}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3 text-amber-600" /> A Receber</p>
            <p className="text-lg font-bold font-display text-amber-700">{formatCurrency(pendingTotal)}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : installments && installments.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">#</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead>Data Pgto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {installments.map((inst) => (
                <InstallmentRow
                  key={inst.id}
                  inst={inst}
                  contractType={contractType}
                  formatCurrency={formatCurrency}
                  formatDate={formatDate}
                  onMarkPaid={() => handleMarkPaid(inst)}
                  isPending={updateInstallment.isPending}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>Nenhuma parcela gerada. Clique em "Gerar Parcelas" para começar.</p>
        </div>
      )}

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Gerar Parcelas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(contractType === "locacao" || contractType === "administracao") && (
              <div className="flex gap-2">
                <Button variant={genMode === "composed" ? "default" : "outline"} size="sm" onClick={() => setGenMode("composed")}>
                  Com Composição
                </Button>
                <Button variant={genMode === "simple" ? "default" : "outline"} size="sm" onClick={() => setGenMode("simple")}>
                  Simples
                </Button>
              </div>
            )}

            {genMode === "composed" && (contractType === "locacao" || contractType === "administracao") ? (
              <>
                <div>
                  <label className="text-sm font-medium">Composição Mensal (Aluguel + Encargos)</label>
                  <div className="space-y-2 mt-2">
                    {compItems.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <Select value={item.item_type} onValueChange={(v) => {
                          const updated = [...compItems];
                          updated[idx] = { ...updated[idx], item_type: v, description: lineItemTypeLabels[v] || v };
                          setCompItems(updated);
                        }}>
                          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(lineItemTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input
                          className="h-8 text-xs flex-1"
                          type="number"
                          step="0.01"
                          value={item.amount}
                          onChange={(e) => {
                            const updated = [...compItems];
                            updated[idx] = { ...updated[idx], amount: Number(e.target.value) };
                            setCompItems(updated);
                          }}
                        />
                        {compItems.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCompItems(compItems.filter((_, i) => i !== idx))}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setCompItems([...compItems, { description: "", item_type: "iptu", amount: 0 }])}>
                      <Plus className="h-3 w-3 mr-1" /> Adicionar Item
                    </Button>
                    <p className="text-sm font-medium">
                      Total mensal: {formatCurrency(compItems.reduce((s, i) => s + i.amount, 0))}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="text-sm font-medium">Valor Total (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={genTotalValue}
                  onChange={(e) => setGenTotalValue(Number(e.target.value))}
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Número de Parcelas</label>
              <Input
                type="number"
                min={1}
                max={360}
                value={numInstallments}
                onChange={(e) => setNumInstallments(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Data do Primeiro Vencimento</label>
              <Input
                type="date"
                value={genStartDate}
                onChange={(e) => setGenStartDate(e.target.value)}
              />
            </div>
            {genMode === "simple" && (
              <p className="text-sm text-muted-foreground">
                Cada parcela: {formatCurrency(numInstallments > 0 ? genTotalValue / numInstallments : 0)}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancelar</Button>
              <Button onClick={handleGenerate} disabled={generateInstallments.isPending || generateRecurring.isPending}>
                {(generateInstallments.isPending || generateRecurring.isPending) ? "Gerando..." : "Gerar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Expandable installment row with line items ── */
function InstallmentRow({
  inst, contractType, formatCurrency, formatDate, onMarkPaid, isPending,
}: {
  inst: Installment; contractType: string;
  formatCurrency: (v: number | null) => string; formatDate: (d: string | null) => string;
  onMarkPaid: () => void; isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLease = contractType === "locacao" || contractType === "administracao";
  const canExpand = isLease && inst.installment_number > 0;

  return (
    <>
      <TableRow className={canExpand ? "cursor-pointer" : ""} onClick={() => canExpand && setExpanded(!expanded)}>
        <TableCell className="font-medium">
          <div className="flex items-center gap-1">
            {canExpand && (expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
            {inst.installment_number === 0 ? (
              <Badge variant="outline" className="text-xs">Taxa</Badge>
            ) : inst.installment_number}
          </div>
        </TableCell>
        <TableCell>{formatDate(inst.due_date)}</TableCell>
        <TableCell>{formatCurrency(inst.amount)}</TableCell>
        <TableCell>{inst.paid_amount ? formatCurrency(inst.paid_amount) : "—"}</TableCell>
        <TableCell>{formatDate(inst.payment_date)}</TableCell>
        <TableCell>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className={installmentStatusColors[inst.status] ?? ""}>
              {installmentStatusLabels[inst.status] ?? inst.status}
            </Badge>
            {(inst as any).revenue_type === "propria" && (
              <Badge variant="outline" className="text-xs border-primary/50 text-primary">Receita</Badge>
            )}
          </div>
        </TableCell>
        <TableCell>
          {inst.status === "pendente" || inst.status === "atrasado" ? (
            <Button variant="ghost" size="sm" className="text-emerald-700 hover:text-emerald-800"
              onClick={(e) => { e.stopPropagation(); onMarkPaid(); }} disabled={isPending}>
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          ) : null}
        </TableCell>
      </TableRow>
      {expanded && <LineItemsPanel installmentId={inst.id} />}
    </>
  );
}

/* ── Line items sub-panel for installment composition ── */
function LineItemsPanel({ installmentId }: { installmentId: string }) {
  const { data: items = [], isLoading } = useInstallmentLineItems(installmentId);
  const createItem = useCreateLineItem();
  const deleteItem = useDeleteLineItem();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ description: "", item_type: "aluguel", amount: 0 });

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  function handleAdd() {
    if (!form.description || form.amount <= 0) return;
    createItem.mutate({ installment_id: installmentId, ...form }, {
      onSuccess: () => { setAdding(false); setForm({ description: "", item_type: "aluguel", amount: 0 }); },
    });
  }

  return (
    <TableRow>
      <TableCell colSpan={7} className="bg-muted/30 p-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Composição (Aluguel + Encargos)</span>
            <Button variant="outline" size="sm" onClick={() => setAdding(!adding)}>
              <ListPlus className="h-3 w-3 mr-1" /> Adicionar Item
            </Button>
          </div>
          {isLoading ? <p className="text-xs text-muted-foreground">Carregando...</p> : items.length === 0 && !adding ? (
            <p className="text-xs text-muted-foreground py-2">
              Nenhum item de composição. Adicione itens como Aluguel, IPTU, Condomínio para separar o cálculo da taxa de administração.
            </p>
          ) : (
            <div className="space-y-1">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded border bg-background px-3 py-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{lineItemTypeLabels[item.item_type] || item.item_type}</Badge>
                    <span>{item.description}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">{fmt(Number(item.amount))}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                      onClick={() => deleteItem.mutate({ id: item.id, installmentId })}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {adding && (
            <div className="flex items-end gap-2 rounded border bg-background p-2">
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={form.item_type} onValueChange={(v) => setForm({ ...form, item_type: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(lineItemTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Descrição</Label>
                <Input className="h-8 text-xs" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Aluguel Jan/2026" />
              </div>
              <div className="space-y-1 w-28">
                <Label className="text-xs">Valor (R$)</Label>
                <Input className="h-8 text-xs" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
              </div>
              <Button size="sm" className="h-8" onClick={handleAdd} disabled={createItem.isPending}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
