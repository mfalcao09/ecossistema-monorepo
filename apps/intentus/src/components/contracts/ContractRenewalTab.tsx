import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  RefreshCw, Plus, Scale, Settings, Check, Clock, History, X, Trash2, AlertTriangle,
  CheckCircle, Paperclip, Sparkles, Brain, ShieldCheck, TrendingDown,
} from "lucide-react";
import { RenovacaoRealizadaDialog } from "@/components/contracts/RenovacaoRealizadaDialog";
import { PricingAIDialog } from "@/components/contracts/PricingAIDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { useContracts } from "@/hooks/useContracts";
import { useProfiles } from "@/hooks/useDealCardFeatures";
import { contractTypeLabels } from "@/lib/contractSchema";
import {
  useContractRenewals,
  useCreateRenewal,
  useUpdateRenewal,
  useApplyRenewal,
  useRenewalTemplates,
  useSaveRenewalTemplate,
  renewalStatusLabels,
  renewalStatusColors,
  type ChecklistItem,
  type TemplateItem,
} from "@/hooks/useContractRenewals";
import { useBCBIndex, indexTypeLabels } from "@/hooks/useRentAdjustments";
import {
  usePredictPortfolio,
  RISK_LEVEL_LABELS,
  RISK_LEVEL_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  type PredictionResult,
  type RiskLevel,
} from "@/hooks/useRenewalPredictions";
import { toast } from "sonner";
import { format, addMonths, differenceInDays } from "date-fns";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/** Returns the real end date considering formalized renewals (aditivos). */
function getEffectiveEndDate(contract: any, renewals: any[]): Date {
  const base = contract.end_date ? new Date(contract.end_date) : new Date();
  const formalized = renewals.filter(
    (r: any) => r.contract_id === contract.id && r.status === "formalizada" && r.new_end_date,
  );
  if (formalized.length === 0) return base;
  const dates = formalized.map((r: any) => new Date(r.new_end_date));
  dates.push(base);
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

// ─── Renewal Dialog ───
function RenewalDialog({
  open, onOpenChange, contract, existingRenewal, template,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contract: any;
  existingRenewal?: any;
  template?: any;
}) {
  const createRenewal = useCreateRenewal();
  const updateRenewal = useUpdateRenewal();
  const applyRenewal = useApplyRenewal();

  const [termMonths, setTermMonths] = useState(12);
  const [adjustmentIndex, setAdjustmentIndex] = useState("igpm");
  const [adjustmentPct, setAdjustmentPct] = useState(0);
  const [manualPct, setManualPct] = useState(false);
  const [notes, setNotes] = useState("");
  const [createAddendum, setCreateAddendum] = useState(true);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  const { data: bcbData } = useBCBIndex(manualPct ? "" : adjustmentIndex);

  // Initialize from template/contract/existing
  useEffect(() => {
    if (!open) return;
    if (existingRenewal) {
      setTermMonths(existingRenewal.renewal_term_months || 12);
      setAdjustmentIndex(existingRenewal.adjustment_index || "igpm");
      setAdjustmentPct(Number(existingRenewal.adjustment_pct) || 0);
      setNotes(existingRenewal.notes || "");
      setCreateAddendum(false);
      const cl = typeof existingRenewal.checklist === "string"
        ? JSON.parse(existingRenewal.checklist)
        : existingRenewal.checklist || [];
      setChecklist(cl);
      setManualPct(existingRenewal.adjustment_index === "manual");
    } else {
      const defMonths = template?.default_term_months || 12;
      setTermMonths(defMonths);
      setAdjustmentIndex(contract?.adjustment_index || "igpm");
      setAdjustmentPct(0);
      setManualPct(false);
      setCreateAddendum(template?.auto_create_addendum ?? true);
      setNotes(template?.notes || "");
      const templateItems: TemplateItem[] = typeof template?.items === "string"
        ? JSON.parse(template.items) : template?.items || [];
      setChecklist(templateItems.map((i) => ({
        key: i.key, label: i.label, required: i.required, done: false,
      })));
    }
  }, [open, existingRenewal, template, contract]);

  // Auto-fill BCB percentage
  useEffect(() => {
    if (bcbData && !manualPct && !existingRenewal) {
      setAdjustmentPct(Number(bcbData.accumulated_12m?.toFixed(2)) || 0);
    }
  }, [bcbData, manualPct, existingRenewal]);

  const currentEnd = contract?.end_date ? new Date(contract.end_date) : new Date();
  const newEndDate = addMonths(currentEnd, termMonths);
  const previousValue = Number(contract?.monthly_value || 0);
  const newValue = Math.round(previousValue * (1 + adjustmentPct / 100) * 100) / 100;

  function toggleChecklist(idx: number) {
    setChecklist((prev) => prev.map((item, i) => i === idx ? { ...item, done: !item.done } : item));
  }

  function handleSave(statusOverride?: string) {
    const payload = {
      contract_id: contract.id,
      previous_end_date: contract.end_date,
      new_end_date: format(newEndDate, "yyyy-MM-dd"),
      previous_value: previousValue,
      new_value: newValue,
      adjustment_index: adjustmentIndex,
      adjustment_pct: adjustmentPct,
      renewal_term_months: termMonths,
      checklist,
      notes,
      status: statusOverride,
    };

    if (existingRenewal) {
      updateRenewal.mutate(
        { id: existingRenewal.id, ...payload },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createRenewal.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  }

  function handleApply() {
    if (!existingRenewal) return;
    applyRenewal.mutate({
      renewalId: existingRenewal.id,
      contractId: contract.id,
      newEndDate: format(newEndDate, "yyyy-MM-dd"),
      newValue: newValue !== previousValue ? newValue : null,
      createAddendum,
      notes,
    }, { onSuccess: () => onOpenChange(false) });
  }

  const isPending = createRenewal.isPending || updateRenewal.isPending || applyRenewal.isPending;
  const isApproved = existingRenewal?.status === "aprovada";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingRenewal ? "Editar Renovação" : "Nova Renovação"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Contract info */}
          <Card className="bg-muted/40">
            <CardContent className="pt-4 pb-3 space-y-1 text-sm">
              <p><strong>Imóvel:</strong> {contract?.properties?.title || "—"}</p>
              <p><strong>Vigência atual:</strong> {contract?.start_date ? format(new Date(contract.start_date), "dd/MM/yyyy") : "?"} — {contract?.end_date ? format(new Date(contract.end_date), "dd/MM/yyyy") : "?"}</p>
              <p><strong>Valor atual:</strong> {fmt(previousValue)}</p>
              <p><strong>Índice contratual:</strong> {indexTypeLabels[contract?.adjustment_index] || "Não definido"}</p>
            </CardContent>
          </Card>

          <Separator />

          {/* Term */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Prazo de Renovação (meses) *</Label>
              <Input type="number" min={1} value={termMonths} onChange={(e) => setTermMonths(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Nova Data de Término</Label>
              <Input type="date" value={format(newEndDate, "yyyy-MM-dd")} disabled className="bg-muted/50" />
            </div>
          </div>

          <Separator />

          {/* Adjustment */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Reajuste de Preço</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Índice</Label>
                <Select value={adjustmentIndex} onValueChange={(v) => {
                  setAdjustmentIndex(v);
                  setManualPct(v === "manual");
                  if (v !== "manual") setAdjustmentPct(0);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(indexTypeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Percentual (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={adjustmentPct}
                  onChange={(e) => { setAdjustmentPct(Number(e.target.value)); setManualPct(true); }}
                />
                {bcbData && !manualPct && (
                  <p className="text-xs text-muted-foreground">
                    Acumulado 12m via BCB: {bcbData.accumulated_12m?.toFixed(2)}%
                    {bcbData.latest_date && ` (ref. ${bcbData.latest_date})`}
                  </p>
                )}
              </div>
            </div>
            <Card className="bg-muted/50">
              <CardContent className="pt-3 pb-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor atual:</span>
                  <span>{fmt(previousValue)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-muted-foreground">Novo valor:</span>
                  <span className="text-primary">{fmt(newValue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Diferença:</span>
                  <span className="text-green-600">+{fmt(newValue - previousValue)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Checklist */}
          {checklist.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Checklist de Renovação</h4>
                <div className="space-y-2">
                  {checklist.map((item, idx) => (
                    <div key={item.key} className="flex items-center gap-3 rounded-md border p-2.5">
                      <Checkbox
                        checked={item.done}
                        onCheckedChange={() => toggleChecklist(idx)}
                      />
                      <div className="flex-1">
                        <span className={`text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>
                          {item.label}
                        </span>
                        {item.required && (
                          <Badge variant="outline" className="ml-2 text-xs">Obrigatório</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          {/* Addendum toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-1.5">
                <Scale className="h-4 w-4" /> Criar aditivo no jurídico?
              </Label>
              <p className="text-xs text-muted-foreground">
                Envia automaticamente um pedido de aditivo de renovação para o departamento jurídico.
              </p>
            </div>
            <Switch checked={createAddendum} onCheckedChange={setCreateAddendum} />
          </div>

          {/* Summary */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4 pb-3">
              <h4 className="font-semibold text-sm mb-2">Resumo da Renovação</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Vigência anterior:</span>
                  <p>{contract?.end_date ? format(new Date(contract.end_date), "dd/MM/yyyy") : "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Nova vigência até:</span>
                  <p className="font-bold">{format(newEndDate, "dd/MM/yyyy")}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Valor anterior:</span>
                  <p>{fmt(previousValue)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Novo valor:</span>
                  <p className="font-bold">{fmt(newValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {isApproved ? (
            <Button onClick={handleApply} disabled={isPending}>
              <Check className="h-4 w-4 mr-1" /> Formalizar e Aplicar
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => handleSave("rascunho")} disabled={isPending}>
                Salvar Rascunho
              </Button>
              {existingRenewal?.status === "rascunho" && (
                <Button onClick={() => handleSave("em_analise")} disabled={isPending}>
                  Enviar para Análise
                </Button>
              )}
              {existingRenewal?.status === "em_analise" && (
                <Button onClick={() => handleSave("aprovada")} disabled={isPending}>
                  Aprovar
                </Button>
              )}
              {!existingRenewal && (
                <Button onClick={() => handleSave("rascunho")} disabled={isPending} className="hidden">
                  {/* duplicate handled above */}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Template Config Dialog ───
function TemplateConfigDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: templates } = useRenewalTemplates();
  const saveTemplate = useSaveRenewalTemplate();

  const existing = templates?.[0];

  const [termMonths, setTermMonths] = useState(12);
  const [autoAddendum, setAutoAddendum] = useState(true);
  const [templateNotes, setTemplateNotes] = useState("");
  const [items, setItems] = useState<TemplateItem[]>([]);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setTermMonths(existing.default_term_months || 12);
      setAutoAddendum(existing.auto_create_addendum ?? true);
      setTemplateNotes(existing.notes || "");
      const parsed = typeof existing.items === "string" ? JSON.parse(existing.items) : existing.items || [];
      setItems(parsed);
    } else {
      setTermMonths(12);
      setAutoAddendum(true);
      setTemplateNotes("");
      setItems([
        { key: "notificar_locatario", label: "Notificar locatário sobre renovação", description: "Enviar comunicado formal", required: true },
        { key: "notificar_proprietario", label: "Notificar proprietário", description: "", required: true },
        { key: "atualizar_garantia", label: "Revisar/atualizar garantia locatícia", description: "", required: false },
        { key: "revisar_condominio", label: "Revisar valor de condomínio", description: "", required: false },
      ]);
    }
  }, [open, existing]);

  function addItem() {
    setItems((prev) => [...prev, { key: `item_${Date.now()}`, label: "", description: "", required: false }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof TemplateItem, value: any) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  function handleSave() {
    saveTemplate.mutate({
      id: existing?.id,
      items: items.filter((i) => i.label.trim()),
      default_term_months: termMonths,
      auto_create_addendum: autoAddendum,
      notes: templateNotes,
    }, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Template de Renovação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Prazo padrão (meses)</Label>
              <Input type="number" min={1} value={termMonths} onChange={(e) => setTermMonths(Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={autoAddendum} onCheckedChange={setAutoAddendum} />
              <Label className="text-sm">Criar aditivo automaticamente</Label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observações padrão</Label>
            <Textarea value={templateNotes} onChange={(e) => setTemplateNotes(e.target.value)} rows={2} />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Itens do Checklist</h4>
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar
              </Button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2 rounded-md border p-3">
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="Nome do item"
                    value={item.label}
                    onChange={(e) => updateItem(idx, "label", e.target.value)}
                  />
                  <Input
                    placeholder="Descrição (opcional)"
                    value={item.description}
                    onChange={(e) => updateItem(idx, "description", e.target.value)}
                    className="text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={item.required}
                      onCheckedChange={(v) => updateItem(idx, "required", !!v)}
                    />
                    <span className="text-xs text-muted-foreground">Obrigatório</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saveTemplate.isPending}>
            Salvar Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Tab ───
// ─── Prediction Insight Card ───────────────────────────────────────
function PredictionInsightCard({ prediction }: { prediction: PredictionResult }) {
  const riskColor: Record<RiskLevel, string> = {
    low: "border-green-500/30 bg-green-500/5",
    medium: "border-yellow-500/30 bg-yellow-500/5",
    high: "border-orange-500/30 bg-orange-500/5",
    critical: "border-red-500/30 bg-red-500/5",
  };

  return (
    <Card className={`${riskColor[prediction.risk_level]}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-semibold">Predição IA — Renovação</span>
          </div>
          <Badge variant="outline" className={RISK_LEVEL_COLORS[prediction.risk_level]}>
            {RISK_LEVEL_LABELS[prediction.risk_level]}
          </Badge>
        </div>

        {/* Score + Bar */}
        <div className="flex items-center gap-3">
          <div className="text-2xl font-bold">{prediction.renewal_probability}%</div>
          <div className="flex-1">
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  prediction.renewal_probability >= 70 ? "bg-green-500" :
                  prediction.renewal_probability >= 50 ? "bg-yellow-500" :
                  prediction.renewal_probability >= 30 ? "bg-orange-500" : "bg-red-500"
                }`}
                style={{ width: `${Math.max(prediction.renewal_probability, 3)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Probabilidade de renovação</p>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="p-2 rounded bg-muted/50">
            <p className="text-muted-foreground">Saúde Pagamentos</p>
            <p className="font-semibold">{prediction.payment_health}%</p>
          </div>
          <div className="p-2 rounded bg-muted/50">
            <p className="text-muted-foreground">Obrigações OK</p>
            <p className="font-semibold">{prediction.obligation_compliance}%</p>
          </div>
          <div className="p-2 rounded bg-muted/50">
            <p className="text-muted-foreground">Renovações anteriores</p>
            <p className="font-semibold">{prediction.renewal_history_count}</p>
          </div>
        </div>

        {/* Risk Factors */}
        {prediction.risk_factors.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Fatores de risco</p>
            <div className="space-y-1">
              {prediction.risk_factors.slice(0, 4).map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    f.impact === "positive" ? "bg-green-500" :
                    f.impact === "negative" ? "bg-red-500" : "bg-gray-400"
                  }`} />
                  <span className="truncate">{f.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {prediction.recommendations.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Recomendações</p>
            <div className="space-y-1">
              {prediction.recommendations.slice(0, 3).map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Badge variant="outline" className={`text-[10px] px-1 py-0 shrink-0 ${PRIORITY_COLORS[r.priority]}`}>
                    {PRIORITY_LABELS[r.priority]}
                  </Badge>
                  <span>{r.action}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground text-right">
          Modelo: {prediction.model_used} · {new Date(prediction.predicted_at).toLocaleString("pt-BR")}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Renewal Predictions Section ──────────────────────────────────
function RenewalPredictionsSection({ contracts }: { contracts: any[] }) {
  const { data: portfolio, isLoading } = usePredictPortfolio({
    limit: 20,
    days_ahead: 180,
    enabled: contracts.length > 0,
  });

  if (isLoading || !portfolio || portfolio.predictions.length === 0) return null;

  // Match predictions to contracts by id
  const predictionsMap = new Map(portfolio.predictions.map(p => [p.contract_id, p]));
  const atRiskPredictions = portfolio.predictions.filter(p => p.renewal_probability < 70);

  if (atRiskPredictions.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Brain className="h-5 w-5 text-purple-500" />
        Predições de Renovação (IA)
        <Badge variant="outline" className="text-purple-600 border-purple-300">
          {atRiskPredictions.length} em risco
        </Badge>
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {atRiskPredictions.slice(0, 6).map(p => (
          <PredictionInsightCard key={p.contract_id} prediction={p} />
        ))}
      </div>
    </div>
  );
}

export default function ContractRenewalTab() {
  const { canUsePricingAI } = usePermissions();
  const { data: contracts = [], isLoading: ctLoading } = useContracts({ status: "ativo" });
  const { data: renewals = [], isLoading: rnLoading } = useContractRenewals();
  const { data: templates } = useRenewalTemplates();
  const { data: profiles = [] } = useProfiles();
  const updateRenewal = useUpdateRenewal();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [selectedRenewal, setSelectedRenewal] = useState<any>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [contractPickerOpen, setContractPickerOpen] = useState(false);
  const [pickerContractId, setPickerContractId] = useState("");
  const [realizadaOpen, setRealizadaOpen] = useState(false);
  const [realizadaContract, setRealizadaContract] = useState<any>(null);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [pricingContract, setPricingContract] = useState<any>(null);

  const template = templates?.[0];
  const isLoading = ctLoading || rnLoading;

  const now = new Date();

  // Expired contracts: effectiveEndDate < today, no formalized renewal covering today
  const expiredContracts = contracts.filter((c: any) => {
    if (!c.end_date) return false;
    const eff = getEffectiveEndDate(c, renewals);
    return eff < now;
  });

  // Contracts expiring within 90 days (using effective end date), excluding already expired
  const expiringContracts = contracts.filter((c: any) => {
    if (!c.end_date) return false;
    const eff = getEffectiveEndDate(c, renewals);
    if (eff < now) return false; // already in expired block
    const days = differenceInDays(eff, now);
    return days <= 90;
  });

  // Renewals by status
  const inProgressRenewals = renewals.filter((r: any) => ["rascunho", "em_analise", "aprovada"].includes(r.status));
  const completedRenewals = renewals.filter((r: any) => ["formalizada", "cancelada"].includes(r.status));

  function openRenewForContract(contract: any) {
    setSelectedContract(contract);
    setSelectedRenewal(null);
    setDialogOpen(true);
  }

  function openRealizada(contract: any) {
    setRealizadaContract(contract);
    setRealizadaOpen(true);
  }

  function openRenewForExisting(renewal: any) {
    const contract = contracts.find((c: any) => c.id === renewal.contract_id);
    setSelectedContract(contract);
    setSelectedRenewal(renewal);
    setDialogOpen(true);
  }

  function handleNewFromPicker() {
    if (!pickerContractId) return;
    const contract = contracts.find((c: any) => c.id === pickerContractId);
    if (contract) {
      setContractPickerOpen(false);
      setPickerContractId("");
      openRenewForContract(contract);
    }
  }

  function getEffectiveDaysToExpiry(contract: any) {
    const eff = getEffectiveEndDate(contract, renewals);
    return differenceInDays(eff, now);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Gerencie renovações de contratos com cálculo de reajuste, checklist configurável e formalização jurídica.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setTemplateOpen(true)}>
            <Settings className="h-4 w-4 mr-1" /> Template
          </Button>
          <Button size="sm" onClick={() => setContractPickerOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova Renovação
          </Button>
        </div>
      </div>

      {/* Prediction Insights — IA Predictive Analytics */}
      <RenewalPredictionsSection contracts={contracts} />

      {/* Section 0: Expired contracts without renewal */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Contratos Vencidos sem Renovação
          {expiredContracts.length > 0 && <Badge variant="destructive">{expiredContracts.length}</Badge>}
        </h3>
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor Mensal</TableHead>
                  <TableHead>Vencido em</TableHead>
                  <TableHead>Dias Vencidos</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : expiredContracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <Check className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      Nenhum contrato vencido sem renovação.
                    </TableCell>
                  </TableRow>
                ) : (
                  expiredContracts.map((c: any) => {
                    const effDate = getEffectiveEndDate(c, renewals);
                    const daysOverdue = differenceInDays(now, effDate);
                    const hasInProgress = renewals.some((r: any) => r.contract_id === c.id && ["rascunho", "em_analise", "aprovada"].includes(r.status));
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.properties?.title || "—"}</TableCell>
                        <TableCell>{contractTypeLabels[c.contract_type] || c.contract_type}</TableCell>
                        <TableCell>{c.monthly_value ? fmt(Number(c.monthly_value)) : "—"}</TableCell>
                        <TableCell>{format(effDate, "dd/MM/yyyy")}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{daysOverdue} {daysOverdue === 1 ? "dia" : "dias"}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end flex-wrap">
                            {canUsePricingAI && (
                              <Button size="sm" variant="ghost" title="Precificação IA" onClick={() => { setPricingContract(c); setPricingOpen(true); }}>
                                <Sparkles className="h-3 w-3 text-primary" />
                              </Button>
                            )}
                            {!hasInProgress && (
                              <Button size="sm" variant="outline" onClick={() => openRenewForContract(c)}>
                                <RefreshCw className="h-3 w-3 mr-1" /> Iniciar Renovação
                              </Button>
                            )}
                            {hasInProgress && (
                              <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Em andamento</Badge>
                            )}
                            <Button size="sm" variant="outline" className="border-green-400 text-green-700 hover:bg-green-50" onClick={() => openRealizada(c)}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Renovação Realizada
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Section 1: Expiring contracts */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Contratos Próximos do Vencimento
          {expiringContracts.length > 0 && <Badge variant="secondary">{expiringContracts.length}</Badge>}
        </h3>
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor Mensal</TableHead>
                  <TableHead>Vigência Até</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : expiringContracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <Check className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      Nenhum contrato próximo do vencimento (90 dias).
                    </TableCell>
                  </TableRow>
                ) : (
                  expiringContracts.map((c: any) => {
                    const days = getEffectiveDaysToExpiry(c);
                    const effDate = getEffectiveEndDate(c, renewals);
                    const hasRenewal = renewals.some((r: any) => r.contract_id === c.id && !["cancelada", "formalizada"].includes(r.status));
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.properties?.title || "—"}</TableCell>
                        <TableCell>{contractTypeLabels[c.contract_type] || c.contract_type}</TableCell>
                        <TableCell>{c.monthly_value ? fmt(Number(c.monthly_value)) : "—"}</TableCell>
                        <TableCell>{format(effDate, "dd/MM/yyyy")}</TableCell>
                        <TableCell>
                          {days <= 30 ? (
                            <Badge className="bg-amber-100 text-amber-800">Vence em {days} dias</Badge>
                          ) : (
                            <Badge variant="secondary">Vence em {days} dias</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end flex-wrap">
                            {canUsePricingAI && (
                              <Button size="sm" variant="ghost" title="Precificação IA" onClick={() => { setPricingContract(c); setPricingOpen(true); }}>
                                <Sparkles className="h-3 w-3 text-primary" />
                              </Button>
                            )}
                            {!hasRenewal && (
                              <Button size="sm" variant="outline" onClick={() => openRenewForContract(c)}>
                                <RefreshCw className="h-3 w-3 mr-1" /> Iniciar Renovação
                              </Button>
                            )}
                            {hasRenewal && (
                              <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Em andamento</Badge>
                            )}
                            <Button size="sm" variant="outline" className="border-green-400 text-green-700 hover:bg-green-50" onClick={() => openRealizada(c)}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Renovação Realizada
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Section 2: In-progress renewals */}
      {inProgressRenewals.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            Renovações em Andamento
            <Badge variant="secondary">{inProgressRenewals.length}</Badge>
          </h3>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead>Contrato</TableHead>
                    <TableHead>Novo Prazo</TableHead>
                    <TableHead>Reajuste</TableHead>
                    <TableHead>Novo Valor</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inProgressRenewals.map((r: any) => {
                    const contract = contracts.find((c: any) => c.id === r.contract_id);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{(contract as any)?.properties?.title || "—"}</TableCell>
                        <TableCell>{r.new_end_date ? format(new Date(r.new_end_date), "dd/MM/yyyy") : "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{indexTypeLabels[r.adjustment_index] || "—"}</Badge>
                          <span className="ml-1 text-sm">{r.adjustment_pct}%</span>
                        </TableCell>
                        <TableCell>{r.new_value ? fmt(Number(r.new_value)) : "—"}</TableCell>
                        <TableCell>
                          <Select
                            value={r.assigned_to || ""}
                            onValueChange={(v) => {
                              updateRenewal.mutate({ id: r.id, assigned_to: v === "__none__" ? null : v });
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
                        <TableCell>
                          <Badge className={renewalStatusColors[r.status]}>{renewalStatusLabels[r.status]}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => openRenewForExisting(r)}>
                              Editar
                            </Button>
                            {r.status !== "cancelada" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => updateRenewal.mutate({ id: r.id, status: "cancelada" })}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Section 3: Completed */}
      {completedRenewals.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <History className="h-5 w-5 text-emerald-500" />
            Histórico de Renovações
            <Badge variant="secondary">{completedRenewals.length}</Badge>
          </h3>
          <Card>
            <CardContent className="pt-6">
              <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Contrato</TableHead>
                     <TableHead>Vigência Anterior</TableHead>
                     <TableHead>Nova Vigência</TableHead>
                     <TableHead>Valor Anterior</TableHead>
                     <TableHead>Novo Valor</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Aditivo</TableHead>
                     <TableHead>Data</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {completedRenewals.map((r: any) => {
                     const contract = contracts.find((c: any) => c.id === r.contract_id);
                     return (
                       <TableRow key={r.id}>
                         <TableCell className="font-medium">{(contract as any)?.properties?.title || "—"}</TableCell>
                         <TableCell>{r.previous_end_date ? format(new Date(r.previous_end_date), "dd/MM/yyyy") : "—"}</TableCell>
                         <TableCell>{r.new_end_date ? format(new Date(r.new_end_date), "dd/MM/yyyy") : "—"}</TableCell>
                         <TableCell>{r.previous_value ? fmt(Number(r.previous_value)) : "—"}</TableCell>
                         <TableCell className="font-bold">{r.new_value ? fmt(Number(r.new_value)) : "—"}</TableCell>
                         <TableCell>
                           <div className="flex items-center gap-1">
                             <Badge className={renewalStatusColors[r.status]}>{renewalStatusLabels[r.status]}</Badge>
                             {r.ai_extracted && (
                               <Badge variant="outline" className="text-xs gap-0.5 border-primary/40 text-primary">
                                 <Sparkles className="h-2.5 w-2.5" /> IA
                               </Badge>
                             )}
                           </div>
                         </TableCell>
                         <TableCell>
                           {r.addendum_file_path ? (
                             <button
                               className="flex items-center gap-1 text-xs text-primary hover:underline"
                               onClick={async () => {
                                 const { data } = await supabase.storage
                                   .from("contract-documents")
                                   .createSignedUrl(r.addendum_file_path, 300);
                                 if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                               }}
                             >
                               <Paperclip className="h-3 w-3" />
                               {r.addendum_title || "Aditivo"}
                             </button>
                           ) : (
                             <span className="text-muted-foreground text-xs">—</span>
                           )}
                         </TableCell>
                         <TableCell>{format(new Date(r.created_at), "dd/MM/yyyy")}</TableCell>
                       </TableRow>
                     );
                   })}
                 </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Contract picker for new renewal */}
      <Dialog open={contractPickerOpen} onOpenChange={setContractPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar Contrato para Renovação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Contrato Ativo *</Label>
              <Select value={pickerContractId} onValueChange={setPickerContractId}>
                <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
                <SelectContent>
                  {contracts.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.properties?.title || "Sem imóvel"} — {contractTypeLabels[c.contract_type] || c.contract_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContractPickerOpen(false)}>Cancelar</Button>
            <Button onClick={handleNewFromPicker} disabled={!pickerContractId}>Continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renewal dialog */}
      {selectedContract && (
        <RenewalDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          contract={selectedContract}
          existingRenewal={selectedRenewal}
          template={template}
        />
      )}

      {/* Renovação Realizada dialog */}
      {realizadaContract && (
        <RenovacaoRealizadaDialog
          open={realizadaOpen}
          onOpenChange={setRealizadaOpen}
          contract={realizadaContract}
        />
      )}

      <TemplateConfigDialog open={templateOpen} onOpenChange={setTemplateOpen} />

      {/* Pricing AI Dialog */}
      <PricingAIDialog
        open={pricingOpen}
        onOpenChange={setPricingOpen}
        contractId={pricingContract?.id}
        propertyId={pricingContract?.property_id}
        neighborhood={pricingContract?.properties?.neighborhood}
        city={pricingContract?.properties?.city}
        currentValue={pricingContract?.monthly_value ? Number(pricingContract.monthly_value) : undefined}
        adjustmentIndex={pricingContract?.adjustment_index}
        contractType={pricingContract?.contract_type}
      />
    </div>
  );
}
