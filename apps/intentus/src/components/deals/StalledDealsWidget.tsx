import { useState, useMemo, useCallback } from "react";
import {
  useStalledDealsDashboard,
  useDetectStalledDeals,
  useSuggestStalledActions,
  STALL_LEVEL_LABELS,
  STALL_LEVEL_BG,
  URGENCY_COLORS,
  URGENCY_LABELS,
  type StalledDeal,
  type ActionSuggestion,
  type StallLevel,
} from "@/hooks/useStalledDeals";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Sparkles,
  Loader2,
  TrendingDown,
  User,
  ArrowRight,
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────
function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function StallScoreBar({ score, level }: { score: number; level: StallLevel }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = level === "critical" ? "bg-red-500" : "bg-amber-500";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums w-8 text-right">{Math.round(pct)}</span>
    </div>
  );
}

// ─── Suggestions Dialog ─────────────────────────────────────────────────────
function SuggestionsDialog({
  deal,
  open,
  onOpenChange,
}: {
  deal: StalledDeal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const suggestMutation = useSuggestStalledActions();
  const [suggestions, setSuggestions] = useState<ActionSuggestion[]>([]);

  const handleOpen = useCallback(
    (isOpen: boolean) => {
      if (isOpen && deal) {
        setSuggestions([]);
        suggestMutation.mutate(deal.deal_id, {
          onSuccess: (result) => setSuggestions(result.suggestions ?? []),
        });
      }
      onOpenChange(isOpen);
    },
    [deal, suggestMutation, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Sugestões de Ação
          </DialogTitle>
        </DialogHeader>

        {deal && (
          <div className="mb-4 p-3 rounded-lg bg-muted/50 text-sm space-y-1">
            <p className="font-medium">{deal.property_title || "Sem imóvel vinculado"}</p>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span>{deal.days_in_stage}d no estágio</span>
              <span>·</span>
              <Badge variant="outline" className={STALL_LEVEL_BG[deal.stall_level]}>
                {STALL_LEVEL_LABELS[deal.stall_level]}
              </Badge>
            </div>
          </div>
        )}

        {suggestMutation.isPending && (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Consultando IA...</span>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="space-y-3">
            {suggestions.map((s, i) => (
              <Card key={i} className="border">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{s.action}</p>
                    <Badge className={`text-[10px] shrink-0 ${URGENCY_COLORS[s.urgency]}`}>
                      {URGENCY_LABELS[s.urgency]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.reason}</p>
                  {s.talking_points.length > 0 && (
                    <div className="space-y-1 mt-1">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                        Pontos de conversa
                      </p>
                      <ul className="text-xs space-y-0.5 text-muted-foreground list-disc pl-4">
                        {s.talking_points.map((tp, j) => (
                          <li key={j}>{tp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {s.recommended_next_status && (
                    <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mt-1">
                      <ArrowRight className="h-3 w-3" />
                      <span>Mover para: {s.recommended_next_status}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!suggestMutation.isPending && suggestions.length === 0 && suggestMutation.isSuccess && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma sugestão gerada para este negócio.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Widget ────────────────────────────────────────────────────────────
export function StalledDealsWidget({ dealType }: { dealType?: string }) {
  const { data: dashboard, isLoading } = useStalledDealsDashboard({ deal_type: dealType });
  const [isOpen, setIsOpen] = useState(false);
  const [suggestDeal, setSuggestDeal] = useState<StalledDeal | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);

  if (isLoading || !dashboard || dashboard.total_stalled === 0) return null;

  return (
    <>
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <CardTitle className="text-sm font-semibold">
                    {dashboard.total_stalled} negócio{dashboard.total_stalled > 1 ? "s" : ""} estagnado{dashboard.total_stalled > 1 ? "s" : ""}
                  </CardTitle>
                </div>

                <div className="flex items-center gap-3">
                  {/* KPI badges */}
                  {dashboard.critical_count > 0 && (
                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 text-[10px]">
                      {dashboard.critical_count} crítico{dashboard.critical_count > 1 ? "s" : ""}
                    </Badge>
                  )}
                  {dashboard.warning_count > 0 && (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[10px]">
                      {dashboard.warning_count} atenção
                    </Badge>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>~{Math.round(dashboard.avg_days_stalled)}d média</span>
                  </div>
                  {dashboard.total_value_at_risk > 0 && (
                    <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                      <DollarSign className="h-3 w-3" />
                      <span>{fmtBRL(dashboard.total_value_at_risk)} em risco</span>
                    </div>
                  )}
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="px-4 pb-4 pt-0 space-y-2">
              {dashboard.top_stalled.map((deal) => (
                <div
                  key={deal.deal_id}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-background border hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
                >
                  {/* Level badge */}
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${STALL_LEVEL_BG[deal.stall_level]}`}
                  >
                    {STALL_LEVEL_LABELS[deal.stall_level]}
                  </Badge>

                  {/* Deal info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium truncate">
                      {deal.property_title || "Sem imóvel"}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{deal.status}</span>
                      <span>·</span>
                      <span>{deal.days_in_stage}d no estágio</span>
                      {deal.assigned_name && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-0.5">
                            <User className="h-3 w-3" />
                            {deal.assigned_name}
                          </span>
                        </>
                      )}
                      {deal.last_contact_days != null && deal.last_contact_days > 3 && (
                        <>
                          <span>·</span>
                          <span className="text-amber-600">{deal.last_contact_days}d sem contato</span>
                        </>
                      )}
                    </div>
                    <StallScoreBar score={deal.stall_score} level={deal.stall_level} />
                  </div>

                  {/* Value */}
                  {(deal.proposed_value > 0 || deal.proposed_monthly_value > 0) && (
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium">
                        {fmtBRL(deal.proposed_value || deal.proposed_monthly_value)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {deal.proposed_monthly_value > 0 ? "/mês" : "total"}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-amber-600 hover:text-amber-700 hover:bg-amber-100/50"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSuggestDeal(deal);
                      setSuggestOpen(true);
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    <span className="text-xs">Sugerir</span>
                  </Button>
                </div>
              ))}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <SuggestionsDialog
        deal={suggestDeal}
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
      />
    </>
  );
}

// ─── Stall Badge for KanbanBoard renderLabels ───────────────────────────────
export function useStallBadgeMap(dealType?: string) {
  const { data: stalledDeals } = useDetectStalledDeals({ deal_type: dealType });

  return useMemo(() => {
    const map = new Map<string, StalledDeal>();
    if (!stalledDeals) return map;
    for (const deal of stalledDeals) {
      map.set(deal.deal_id, deal);
    }
    return map;
  }, [stalledDeals]);
}

export function StallBadge({ deal }: { deal: StalledDeal }) {
  const color =
    deal.stall_level === "critical"
      ? "bg-red-500 text-white"
      : "bg-amber-500 text-white";
  return (
    <div
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}
      title={`Estagnado há ${deal.days_in_stage}d (score: ${Math.round(deal.stall_score)})`}
    >
      <TrendingDown className="h-2.5 w-2.5" />
      {deal.days_in_stage}d
    </div>
  );
}
