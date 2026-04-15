import { useState, useMemo } from "react";
import { useContractRedlining, useCreateRedlining, useUpdateRedliningStatus, useDeleteRedlining, RedliningStatus } from "@/hooks/useContractRedlining";
import { useSuggestRedlines, type RedlineSuggestion, type SuggestRedlinesResult } from "@/hooks/useRedliningAI";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ChevronDown, Trash2, GitBranch, AlertCircle, Sparkles, Check, X, Shield, AlertTriangle, AlertOctagon, Info, Scale, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { computeWordDiff, type DiffSegment } from "@/lib/diffUtils";

const STATUS_LABELS: Record<RedliningStatus, string> = {
  aberto: "Em aberto",
  aceito: "Aceito",
  recusado: "Recusado",
  incorporado: "Incorporado",
};

const STATUS_COLORS: Record<RedliningStatus, string> = {
  aberto: "bg-amber-100 text-amber-800 border-amber-200",
  aceito: "bg-green-100 text-green-800 border-green-200",
  recusado: "bg-red-100 text-red-800 border-red-200",
  incorporado: "bg-blue-100 text-blue-800 border-blue-200",
};

const CATEGORY_LABELS: Record<string, string> = {
  legal_compliance: "Compliance Legal",
  risk_mitigation: "Mitigação de Risco",
  clarity: "Clareza",
  fairness: "Equilíbrio Contratual",
  market_practice: "Prática de Mercado",
  missing_clause: "Cláusula Ausente",
};

const CATEGORY_COLORS: Record<string, string> = {
  legal_compliance: "bg-purple-100 text-purple-800 border-purple-200",
  risk_mitigation: "bg-red-100 text-red-800 border-red-200",
  clarity: "bg-blue-100 text-blue-800 border-blue-200",
  fairness: "bg-amber-100 text-amber-800 border-amber-200",
  market_practice: "bg-green-100 text-green-800 border-green-200",
  missing_clause: "bg-orange-100 text-orange-800 border-orange-200",
};

const PRIORITY_LABELS: Record<string, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const PRIORITY_COLORS: Record<string, string> = {
  alta: "bg-red-100 text-red-700",
  media: "bg-amber-100 text-amber-700",
  baixa: "bg-green-100 text-green-700",
};

const RISK_ICONS: Record<string, typeof Shield> = {
  low: Shield,
  medium: AlertTriangle,
  high: AlertOctagon,
  critical: AlertOctagon,
};

const RISK_COLORS: Record<string, string> = {
  low: "text-green-600 bg-green-50 border-green-200",
  medium: "text-amber-600 bg-amber-50 border-amber-200",
  high: "text-orange-600 bg-orange-50 border-orange-200",
  critical: "text-red-600 bg-red-50 border-red-200",
};

const RISK_LABELS: Record<string, string> = {
  low: "Risco Baixo",
  medium: "Risco Médio",
  high: "Risco Alto",
  critical: "Risco Crítico",
};

interface Props {
  contractId: string;
  contractType?: string;
}

export function ContractRedliningTab({ contractId, contractType }: Props) {
  const { data: entries = [], isLoading } = useContractRedlining(contractId);
  const createMutation = useCreateRedlining();
  const updateStatus = useUpdateRedliningStatus();
  const deleteMutation = useDeleteRedlining();
  const suggestMutation = useSuggestRedlines();
  const { canSuggestRedlining } = usePermissions();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    clause_name: "",
    original_text: "",
    proposed_text: "",
    reason: "",
    requested_by: "",
  });

  // AI suggestions state
  const [aiResult, setAiResult] = useState<SuggestRedlinesResult | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [acceptedIds, setAcceptedIds] = useState<Set<number>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<number>>(new Set());
  // Contract text for AI (user pastes or we fetch)
  const [contractTextInput, setContractTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clause_name.trim() || !form.reason.trim()) return;
    await createMutation.mutateAsync({
      contract_id: contractId,
      clause_name: form.clause_name.trim(),
      original_text: form.original_text.trim() || undefined,
      proposed_text: form.proposed_text.trim() || undefined,
      reason: form.reason.trim(),
      requested_by: form.requested_by.trim() || undefined,
    });
    setForm({ clause_name: "", original_text: "", proposed_text: "", reason: "", requested_by: "" });
    setShowForm(false);
  };

  const handleSuggestRedlines = async () => {
    if (!contractTextInput.trim()) {
      setShowTextInput(true);
      return;
    }
    setShowTextInput(false);
    const result = await suggestMutation.mutateAsync({
      contractId,
      contractText: contractTextInput.trim(),
      contractType,
    });
    setAiResult(result);
    setShowAiPanel(true);
    setAcceptedIds(new Set());
    setRejectedIds(new Set());
  };

  const handleAcceptSuggestion = async (suggestion: RedlineSuggestion, index: number) => {
    await createMutation.mutateAsync({
      contract_id: contractId,
      clause_name: suggestion.clause_name,
      original_text: suggestion.original_text || undefined,
      proposed_text: suggestion.proposed_text || undefined,
      reason: `[IA - ${CATEGORY_LABELS[suggestion.category] || suggestion.category}] ${suggestion.reason}${suggestion.legal_basis ? ` (Base legal: ${suggestion.legal_basis})` : ""}`,
      requested_by: "IA Redlining",
    });
    setAcceptedIds((prev) => new Set(prev).add(index));
  };

  const handleRejectSuggestion = (index: number) => {
    setRejectedIds((prev) => new Set(prev).add(index));
  };

  const openCount = entries.filter((e) => e.status === "aberto").length;

  const pendingSuggestions = aiResult?.suggestions.filter((_, i) => !acceptedIds.has(i) && !rejectedIds.has(i)) || [];

  return (
    <div className="space-y-4 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Redlining de Cláusulas</span>
          {openCount > 0 && (
            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
              <AlertCircle className="h-2.5 w-2.5 mr-1" />
              {openCount} em aberto
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canSuggestRedlining && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1 border-purple-200 text-purple-700 hover:bg-purple-50"
              onClick={handleSuggestRedlines}
              disabled={suggestMutation.isPending}
            >
              {suggestMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              {suggestMutation.isPending ? "Analisando..." : "Sugerir com IA"}
            </Button>
          )}
          <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-3 w-3" /> Registrar Contestação
          </Button>
        </div>
      </div>

      {/* Contract text input for AI */}
      {showTextInput && canSuggestRedlining && (
        <div className="border rounded-lg p-4 space-y-3 bg-purple-50/30 border-purple-200">
          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Texto do Contrato para Análise IA
          </p>
          <p className="text-xs text-muted-foreground">
            Cole o texto completo do contrato abaixo para que a IA possa analisar e sugerir alterações.
          </p>
          <Textarea
            placeholder="Cole aqui o texto do contrato..."
            className="text-xs min-h-[120px] resize-none"
            value={contractTextInput}
            onChange={(e) => setContractTextInput(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setShowTextInput(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="text-xs gap-1 bg-purple-600 hover:bg-purple-700"
              onClick={handleSuggestRedlines}
              disabled={!contractTextInput.trim() || suggestMutation.isPending}
            >
              {suggestMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {suggestMutation.isPending ? "Analisando..." : "Analisar Contrato"}
            </Button>
          </div>
        </div>
      )}

      {/* AI Suggestions Panel */}
      {showAiPanel && aiResult && (
        <div className="border rounded-lg overflow-hidden border-purple-200">
          {/* Risk Banner */}
          <div className={cn("flex items-center gap-2 px-4 py-2 border-b", RISK_COLORS[aiResult.overall_risk])}>
            {(() => {
              const RiskIcon = RISK_ICONS[aiResult.overall_risk] || Info;
              return <RiskIcon className="h-4 w-4" />;
            })()}
            <span className="text-xs font-semibold">{RISK_LABELS[aiResult.overall_risk] || "Análise"}</span>
            <span className="text-xs ml-1">— {aiResult.contract_summary}</span>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                <Sparkles className="h-2.5 w-2.5 mr-1" />
                {aiResult.suggestions.length} sugestões
              </Badge>
              {pendingSuggestions.length === 0 && (
                <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => setShowAiPanel(false)}>
                  Fechar
                </Button>
              )}
            </div>
          </div>

          {/* Suggestions List */}
          <div className="divide-y">
            {aiResult.suggestions.map((suggestion, idx) => {
              const isAccepted = acceptedIds.has(idx);
              const isRejected = rejectedIds.has(idx);
              if (isAccepted || isRejected) {
                return (
                  <div key={idx} className={cn("px-4 py-2 text-xs", isAccepted ? "bg-green-50/50" : "bg-gray-50/50")}>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      {isAccepted ? (
                        <><Check className="h-3 w-3 text-green-600" /> Aceita — {suggestion.clause_name}</>
                      ) : (
                        <><X className="h-3 w-3 text-red-500" /> Descartada — {suggestion.clause_name}</>
                      )}
                    </span>
                  </div>
                );
              }
              return (
                <AISuggestionCard
                  key={idx}
                  suggestion={suggestion}
                  onAccept={() => handleAcceptSuggestion(suggestion, idx)}
                  onReject={() => handleRejectSuggestion(idx)}
                  isAccepting={createMutation.isPending}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* New entry form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nova Contestação</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Cláusula Contestada *</Label>
              <Input
                placeholder="Ex: Cláusula 5ª – Reajuste"
                className="h-8 text-xs"
                value={form.clause_name}
                onChange={(e) => setForm((f) => ({ ...f, clause_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Solicitado por</Label>
              <Input
                placeholder="Nome do cliente / parte"
                className="h-8 text-xs"
                value={form.requested_by}
                onChange={(e) => setForm((f) => ({ ...f, requested_by: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Motivo da Contestação *</Label>
            <Textarea
              placeholder="Descreva o motivo da contestação ou alteração solicitada..."
              className="text-xs min-h-[72px] resize-none"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Texto Original (opcional)</Label>
              <Textarea
                placeholder="Texto atual da cláusula..."
                className="text-xs min-h-[56px] resize-none"
                value={form.original_text}
                onChange={(e) => setForm((f) => ({ ...f, original_text: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Texto Proposto (opcional)</Label>
              <Textarea
                placeholder="Redação proposta pelo cliente..."
                className="text-xs min-h-[56px] resize-none"
                value={form.proposed_text}
                onChange={(e) => setForm((f) => ({ ...f, proposed_text: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="submit" size="sm" className="text-xs" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      )}

      <Separator />

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-30" />
          Nenhuma contestação registrada.
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <Collapsible key={entry.id}>
              <div className="border rounded-lg overflow-hidden">
                <div className="flex items-center gap-3 p-3 bg-card">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 flex-1 text-left min-w-0">
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-semibold truncate">{entry.clause_name}</span>
                      {entry.requested_by === "IA Redlining" && (
                        <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-600 border-purple-200 shrink-0">
                          <Sparkles className="h-2 w-2 mr-0.5" /> IA
                        </Badge>
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <div className="flex items-center gap-2 shrink-0">
                    <Select
                      value={entry.status}
                      onValueChange={(val) => updateStatus.mutate({ id: entry.id, status: val as RedliningStatus, contractId })}
                    >
                      <SelectTrigger className="h-6 text-[10px] w-28 px-2 border-0">
                        <Badge variant="outline" className={cn("text-[10px] cursor-pointer", STATUS_COLORS[entry.status])}>
                          {STATUS_LABELS[entry.status]}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABELS) as RedliningStatus[]).map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">{STATUS_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost" size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate({ id: entry.id, contractId })}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <CollapsibleContent>
                  <div className="px-4 pb-3 pt-1 space-y-2 bg-muted/20 border-t text-xs">
                    {entry.requested_by && (
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">Solicitado por:</span> {entry.requested_by}
                      </p>
                    )}
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Motivo:</span> {entry.reason}
                    </p>
                    {(entry.original_text || entry.proposed_text) && (
                      <div className="space-y-2 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {entry.original_text && (
                            <div className="space-y-1">
                              <p className="font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Texto Original</p>
                              <div className="rounded bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-2 text-muted-foreground leading-relaxed">
                                {entry.original_text}
                              </div>
                            </div>
                          )}
                          {entry.proposed_text && (
                            <div className="space-y-1">
                              <p className="font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Texto Proposto</p>
                              <div className="rounded bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30 p-2 text-muted-foreground leading-relaxed">
                                {entry.proposed_text}
                              </div>
                            </div>
                          )}
                        </div>
                        {entry.original_text && entry.proposed_text && (
                          <RedliningInlineDiff original={entry.original_text} proposed={entry.proposed_text} />
                        )}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground pt-1">
                      Registrado em {format(parseISO(entry.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── AI Suggestion Card ─── */
function AISuggestionCard({
  suggestion,
  onAccept,
  onReject,
  isAccepting,
}: {
  suggestion: RedlineSuggestion;
  onAccept: () => void;
  onReject: () => void;
  isAccepting: boolean;
}) {
  const segments = useMemo(
    () =>
      suggestion.original_text && suggestion.proposed_text
        ? computeWordDiff(suggestion.original_text, suggestion.proposed_text)
        : [],
    [suggestion.original_text, suggestion.proposed_text],
  );

  return (
    <div className="px-4 py-3 space-y-2 bg-card hover:bg-muted/20 transition-colors">
      {/* Header: clause name + badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <Scale className="h-3.5 w-3.5 text-purple-500 shrink-0" />
        <span className="text-xs font-semibold">{suggestion.clause_name}</span>
        <Badge variant="outline" className={cn("text-[9px]", CATEGORY_COLORS[suggestion.category])}>
          {CATEGORY_LABELS[suggestion.category] || suggestion.category}
        </Badge>
        <Badge variant="outline" className={cn("text-[9px]", PRIORITY_COLORS[suggestion.priority])}>
          {PRIORITY_LABELS[suggestion.priority]}
        </Badge>
        <Badge variant="outline" className="text-[9px] bg-gray-100 text-gray-600">
          {suggestion.confidence}% confiança
        </Badge>
      </div>

      {/* Reason */}
      <p className="text-xs text-muted-foreground">{suggestion.reason}</p>

      {/* Legal basis */}
      {suggestion.legal_basis && (
        <p className="text-[10px] text-purple-600 dark:text-purple-400">
          <span className="font-medium">Base legal:</span> {suggestion.legal_basis}
        </p>
      )}

      {/* Risk if unchanged */}
      {suggestion.risk_if_unchanged && (
        <p className="text-[10px] text-red-600 dark:text-red-400">
          <span className="font-medium">Risco se não alterar:</span> {suggestion.risk_if_unchanged}
        </p>
      )}

      {/* Diff preview */}
      {segments.length > 0 && (
        <div className="rounded border bg-card p-2 text-[11px] leading-relaxed whitespace-pre-wrap">
          {segments.map((seg: DiffSegment, i: number) => {
            if (seg.added) {
              return (
                <span key={i} className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 rounded px-0.5">
                  {seg.value}
                </span>
              );
            }
            if (seg.removed) {
              return (
                <span key={i} className="bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 line-through rounded px-0.5">
                  {seg.value}
                </span>
              );
            }
            return <span key={i}>{seg.value}</span>;
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-1">
        <Button
          size="sm"
          variant="ghost"
          className="text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={onReject}
        >
          <X className="h-3 w-3 mr-1" /> Descartar
        </Button>
        <Button
          size="sm"
          className="text-xs h-7 bg-green-600 hover:bg-green-700"
          onClick={onAccept}
          disabled={isAccepting}
        >
          {isAccepting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
          Aceitar
        </Button>
      </div>
    </div>
  );
}

/* ─── Inline word diff between original and proposed text ─── */
function RedliningInlineDiff({ original, proposed }: { original: string; proposed: string }) {
  const segments = useMemo(() => computeWordDiff(original, proposed), [original, proposed]);

  return (
    <div className="space-y-1">
      <p className="font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Diff Visual</p>
      <div className="rounded border bg-card p-2 text-xs leading-relaxed whitespace-pre-wrap">
        {segments.map((seg: DiffSegment, i: number) => {
          if (seg.added) {
            return (
              <span
                key={i}
                className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 rounded px-0.5"
              >
                {seg.value}
              </span>
            );
          }
          if (seg.removed) {
            return (
              <span
                key={i}
                className="bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 line-through rounded px-0.5"
              >
                {seg.value}
              </span>
            );
          }
          return <span key={i}>{seg.value}</span>;
        })}
      </div>
    </div>
  );
}
