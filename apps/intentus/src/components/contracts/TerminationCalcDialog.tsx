import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, FileDown, Save } from "lucide-react";
import {
  useTerminationCalcItems,
  useCreateCalcItem,
  useUpdateCalcItem,
  useDeleteCalcItem,
  useCalcTemplates,
  useBulkInsertCalcItems,
  useSaveCalcSummary,
  itemTypeLabels,
  type CalcItem,
} from "@/hooks/useTerminationCalc";
import { calculateTerminationPenalty } from "@/lib/terminationCalc";
import { toast } from "sonner";

interface ContractData {
  monthly_value?: number;
  start_date?: string;
  end_date?: string;
  condo_value?: number;
}

interface TerminationCalcDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  terminationId: string;
  contractData: ContractData;
  noticeDate: string | null;
  propertyTitle: string;
  onSaved?: () => void;
}

interface LocalItem {
  id?: string;
  item_type: string;
  description: string;
  direction: "debito" | "credito";
  amount: number;
  formula_notes: string;
  sort_order: number;
  isNew?: boolean;
}

export function TerminationCalcDialog({
  open,
  onOpenChange,
  terminationId,
  contractData,
  noticeDate,
  propertyTitle,
  onSaved,
}: TerminationCalcDialogProps) {
  const { data: savedItems = [], isLoading } = useTerminationCalcItems(open ? terminationId : undefined);
  const { data: templates = [] } = useCalcTemplates();
  const createItem = useCreateCalcItem();
  const updateItem = useUpdateCalcItem();
  const deleteItem = useDeleteCalcItem();
  const bulkInsert = useBulkInsertCalcItems();
  const saveSummary = useSaveCalcSummary();

  const [localItems, setLocalItems] = useState<LocalItem[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Load saved items into local state
  useEffect(() => {
    if (open && !isLoading && !initialized) {
      if (savedItems.length > 0) {
        setLocalItems(savedItems.map((it) => ({
          id: it.id,
          item_type: it.item_type,
          description: it.description,
          direction: it.direction as "debito" | "credito",
          amount: Number(it.amount),
          formula_notes: it.formula_notes || "",
          sort_order: it.sort_order,
        })));
      }
      setInitialized(true);
    }
  }, [open, isLoading, savedItems, initialized]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setInitialized(false);
      setLocalItems([]);
    }
  }, [open]);

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  // Pre-calculate items from contract data
  function preCalculate(itemType: string): { amount: number; formula: string } {
    const mv = contractData.monthly_value || 0;
    const notice = noticeDate ? new Date(noticeDate) : new Date();

    if (itemType === "multa" && mv && contractData.start_date && contractData.end_date && noticeDate) {
      const result = calculateTerminationPenalty({
        monthlyValue: mv,
        startDate: contractData.start_date,
        endDate: contractData.end_date,
        noticeDate,
      });
      return {
        amount: result.proportionalPenalty,
        formula: `3× aluguel (${fmt(result.fullPenalty)}) × ${result.remainingMonths}/${result.totalContractMonths} meses`,
      };
    }

    if (itemType === "aluguel_proporcional" && mv) {
      const dayOfMonth = notice.getDate();
      const daysInMonth = new Date(notice.getFullYear(), notice.getMonth() + 1, 0).getDate();
      const proRata = Math.round((mv / daysInMonth) * dayOfMonth * 100) / 100;
      return {
        amount: proRata,
        formula: `${fmt(mv)} / ${daysInMonth} × ${dayOfMonth} dias`,
      };
    }

    if (itemType === "condominio" && contractData.condo_value) {
      const dayOfMonth = notice.getDate();
      const daysInMonth = new Date(notice.getFullYear(), notice.getMonth() + 1, 0).getDate();
      const proRata = Math.round((contractData.condo_value / daysInMonth) * dayOfMonth * 100) / 100;
      return {
        amount: proRata,
        formula: `${fmt(contractData.condo_value)} / ${daysInMonth} × ${dayOfMonth} dias`,
      };
    }

    return { amount: 0, formula: "" };
  }

  function applyTemplate() {
    const activeTemplates = templates.filter((t) => t.active);
    if (activeTemplates.length === 0) {
      toast.info("Nenhum template configurado. Adicione itens manualmente ou configure um template nas configurações.");
      return;
    }

    const newItems: LocalItem[] = activeTemplates.map((t, idx) => {
      const pre = preCalculate(t.item_type);
      return {
        item_type: t.item_type,
        description: t.description,
        direction: t.direction as "debito" | "credito",
        amount: pre.amount,
        formula_notes: pre.formula || t.default_formula || "",
        sort_order: idx,
        isNew: true,
      };
    });

    setLocalItems(newItems);
    toast.success(`${newItems.length} itens aplicados do template`);
  }

  function addItem() {
    setLocalItems((prev) => [
      ...prev,
      {
        item_type: "outro",
        description: "",
        direction: "debito",
        amount: 0,
        formula_notes: "",
        sort_order: prev.length,
        isNew: true,
      },
    ]);
  }

  function updateLocal(index: number, field: keyof LocalItem, value: unknown) {
    setLocalItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  }

  function removeLocal(index: number) {
    setLocalItems((prev) => prev.filter((_, i) => i !== index));
  }

  const totals = useMemo(() => {
    const debitos = localItems.filter((i) => i.direction === "debito").reduce((s, i) => s + i.amount, 0);
    const creditos = localItems.filter((i) => i.direction === "credito").reduce((s, i) => s + i.amount, 0);
    return {
      debitos: Math.round(debitos * 100) / 100,
      creditos: Math.round(creditos * 100) / 100,
      saldo: Math.round((debitos - creditos) * 100) / 100,
    };
  }, [localItems]);

  async function handleSave() {
    try {
      // Delete existing items
      for (const existing of savedItems) {
        await deleteItem.mutateAsync({ id: existing.id, terminationId });
      }

      // Insert all current items
      if (localItems.length > 0) {
        const items = localItems.map((it, idx) => ({
          termination_id: terminationId,
          item_type: it.item_type,
          description: it.description,
          direction: it.direction,
          amount: it.amount,
          formula_notes: it.formula_notes || null,
          sort_order: idx,
        }));
        await bulkInsert.mutateAsync({ terminationId, items });
      }

      // Save summary
      await saveSummary.mutateAsync({
        terminationId,
        summary: {
          total_debitos: totals.debitos,
          total_creditos: totals.creditos,
          saldo: totals.saldo,
          itens_count: localItems.length,
          calculated_at: new Date().toISOString(),
        },
        penaltyValue: totals.saldo,
      });

      onSaved?.();
      onOpenChange(false);
    } catch {
      // Errors handled by mutation hooks
    }
  }

  const isSaving = createItem.isPending || deleteItem.isPending || bulkInsert.isPending || saveSummary.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cálculo Rescisório — {propertyTitle}</DialogTitle>
        </DialogHeader>

        {/* Contract info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Aluguel:</span>
            <p className="font-medium">{contractData.monthly_value ? fmt(contractData.monthly_value) : "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Início:</span>
            <p className="font-medium">{contractData.start_date || "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Fim:</span>
            <p className="font-medium">{contractData.end_date || "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Aviso Prévio:</span>
            <p className="font-medium">{noticeDate || "—"}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={applyTemplate}>
            <FileDown className="h-4 w-4 mr-1" /> Aplicar Template
          </Button>
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar Item
          </Button>
        </div>

        {/* Items table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-[130px]">Direção</TableHead>
                <TableHead className="w-[130px]">Valor (R$)</TableHead>
                <TableHead>Fórmula/Obs</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {localItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum item. Clique em "Aplicar Template" ou "Adicionar Item".
                  </TableCell>
                </TableRow>
              ) : (
                localItems.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Select value={item.item_type} onValueChange={(v) => updateLocal(idx, "item_type", v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(itemTypeLabels).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.description}
                        onChange={(e) => updateLocal(idx, "description", e.target.value)}
                        className="h-8 text-xs"
                        placeholder="Descrição do item"
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={item.direction} onValueChange={(v) => updateLocal(idx, "direction", v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="debito">Débito</SelectItem>
                          <SelectItem value="credito">Crédito</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.amount}
                        onChange={(e) => updateLocal(idx, "amount", Number(e.target.value))}
                        className="h-8 text-xs text-right"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.formula_notes}
                        onChange={(e) => updateLocal(idx, "formula_notes", e.target.value)}
                        className="h-8 text-xs"
                        placeholder="Como calculou?"
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLocal(idx)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Summary */}
        <Card className="bg-muted/50">
          <CardContent className="pt-4 pb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Débitos (inquilino deve):</span>
              <span className="font-medium text-destructive">{fmt(totals.debitos)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Créditos (inquilino recebe):</span>
              <span className="font-medium text-green-600">- {fmt(totals.creditos)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between text-base font-bold">
              <span>Saldo Final:</span>
              <span className={totals.saldo >= 0 ? "text-destructive" : "text-green-600"}>
                {totals.saldo >= 0
                  ? `${fmt(totals.saldo)} (inquilino deve)`
                  : `${fmt(Math.abs(totals.saldo))} (devolver ao inquilino)`}
              </span>
            </div>
          </CardContent>
        </Card>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-1" /> Salvar Cálculo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
