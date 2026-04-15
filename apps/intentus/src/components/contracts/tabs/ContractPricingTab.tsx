import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { markdownToSafeHtml } from "@/lib/sanitizeHtml";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  CalendarDays,
  BarChart3,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Home,
  History,
  Loader2,
  AlertTriangle,
  Info,
  CheckCircle,
} from "lucide-react";
import { PricingAIDialog } from "../PricingAIDialog";

const fmt = (v: number | undefined | null) => {
  if (v == null || isNaN(v)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
};

const sourceColors: Record<string, { bg: string; text: string }> = {
  vivareal: { bg: "bg-purple-100", text: "text-purple-800" },
  zapimoveis: { bg: "bg-blue-100", text: "text-blue-800" },
  olx: { bg: "bg-orange-100", text: "text-orange-800" },
  quintoandar: { bg: "bg-pink-100", text: "text-pink-800" },
};

interface PricingAnalysis {
  id: string;
  suggested_price: number | null;
  price_per_sqm: number | null;
  confidence: string | null;
  analysis_type: string | null;
  comparables_count: number;
  median_price: number | null;
  mean_price: number | null;
  min_price: number | null;
  max_price: number | null;
  sources: Record<string, number>;
  ai_analysis: string | null;
  top_comparables: any[];
  created_at: string;
}

interface ContractPricingTabProps {
  contractId: string;
  propertyId?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  currentValue?: number | null;
  adjustmentIndex?: string | null;
  contractType?: string | null;
}

export function ContractPricingTab({
  contractId,
  propertyId,
  neighborhood,
  city,
  currentValue,
  adjustmentIndex,
  contractType,
}: ContractPricingTabProps) {
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: analyses, isLoading, refetch } = useQuery({
    queryKey: ["pricing-analyses", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pricing_analyses" as any)
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as PricingAnalysis[];
    },
    enabled: !!contractId,
  });

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const confidenceColor = (c: string | null) => {
    if (!c) return "bg-gray-100 text-gray-800";
    const cl = c.toLowerCase();
    if (cl === "alta" || cl === "high") return "bg-green-100 text-green-800";
    if (cl === "media" || cl === "medium") return "bg-amber-100 text-amber-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <div className="space-y-4 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Histórico de Precificação IA</h3>
          {analyses && analyses.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {analyses.length} análise{analyses.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => setPricingDialogOpen(true)}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Nova Precificação
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!analyses || analyses.length === 0) && (
        <div className="py-10 text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <BarChart3 className="h-7 w-7 text-primary" />
          </div>
          <p className="text-sm font-medium">Nenhuma precificação realizada</p>
          <p className="text-xs text-muted-foreground">
            Clique em "Nova Precificação" para analisar o valor de mercado deste imóvel com IA.
          </p>
        </div>
      )}

      {/* Analysis list */}
      {analyses && analyses.length > 0 && (
        <div className="space-y-3">
          {analyses.map((a, idx) => {
            const isExpanded = expandedId === a.id;
            const isLatest = idx === 0;
            const sources = a.sources || {};
            const sourceList = Object.entries(sources);
            const topComps = Array.isArray(a.top_comparables) ? a.top_comparables : [];

            return (
              <Card
                key={a.id}
                className={`transition-all ${isLatest ? "border-primary/30" : "border-muted"}`}
              >
                <CardContent className="py-3 px-4">
                  {/* Summary row */}
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setExpandedId(isExpanded ? null : a.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div>
                          <p className="text-lg font-bold text-primary">
                            {fmt(a.suggested_price)}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {formatDate(a.created_at)}
                            </span>
                            {a.confidence && (
                              <Badge className={`text-[10px] px-1.5 py-0 ${confidenceColor(a.confidence)}`}>
                                Confiança: {a.confidence}
                              </Badge>
                            )}
                            {isLatest && (
                              <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary">
                                Mais recente
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right text-xs text-muted-foreground">
                          <p>{a.comparables_count} comparáveis</p>
                          {sourceList.length > 0 && (
                            <p>{sourceList.map(([s, c]) => `${s}: ${c}`).join(", ")}</p>
                          )}
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mt-4 pt-3 border-t space-y-3">
                      {/* Stats grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="rounded-lg bg-muted/50 p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">Mediana</p>
                          <p className="text-sm font-semibold">{fmt(a.median_price)}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">Média</p>
                          <p className="text-sm font-semibold">{fmt(a.mean_price)}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">Mínimo</p>
                          <p className="text-sm font-semibold">{fmt(a.min_price)}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">Máximo</p>
                          <p className="text-sm font-semibold">{fmt(a.max_price)}</p>
                        </div>
                      </div>

                      {/* AI Analysis */}
                      {a.ai_analysis && (
                        <div className="rounded-lg bg-muted/30 p-3">
                          <p className="text-xs font-medium flex items-center gap-1 mb-2">
                            <BarChart3 className="h-3.5 w-3.5 text-primary" /> Análise IA
                          </p>
                          <div
                            className="text-xs text-muted-foreground prose prose-xs dark:prose-invert max-w-none [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1 [&_p]:my-1 [&_li]:my-0.5 [&_strong]:text-foreground"
                            dangerouslySetInnerHTML={{
                              __html: markdownToSafeHtml(a.ai_analysis),
                            }}
                          />
                        </div>
                      )}

                      {/* Top comparables */}
                      {topComps.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium flex items-center gap-1">
                            <Home className="h-3.5 w-3.5 text-primary" />
                            Top Comparáveis ({topComps.length})
                          </p>
                          <div className="space-y-1.5">
                            {topComps.slice(0, 5).map((comp: any, ci: number) => {
                              const sc = sourceColors[comp.source] || { bg: "bg-gray-100", text: "text-gray-800" };
                              return (
                                <div
                                  key={ci}
                                  className="flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded bg-muted/30"
                                >
                                  <div className="min-w-0 flex-1">
                                    <span className="truncate block" title={comp.title}>
                                      {comp.title || `Imóvel ${ci + 1}`}
                                    </span>
                                    <span className="text-muted-foreground">
                                      {comp.neighborhood}{comp.city ? `, ${comp.city}` : ""}
                                      {comp.area > 0 ? ` · ${comp.area}m²` : ""}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-semibold text-primary">
                                      {fmt(comp.price)}
                                    </span>
                                    <Badge className={`text-[9px] px-1 py-0 ${sc.bg} ${sc.text}`}>
                                      {comp.source}
                                    </Badge>
                                    {comp.url && (
                                      <a
                                        href={comp.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pricing AI Dialog */}
      <PricingAIDialog
        open={pricingDialogOpen}
        onOpenChange={(open) => {
          setPricingDialogOpen(open);
          if (!open) {
            // Refresh history after dialog closes
            refetch();
          }
        }}
        contractId={contractId}
        propertyId={propertyId ?? undefined}
        neighborhood={neighborhood ?? undefined}
        city={city ?? undefined}
        currentValue={currentValue ?? undefined}
        adjustmentIndex={adjustmentIndex ?? undefined}
        contractType={contractType ?? undefined}
      />
    </div>
  );
}
