import { useState, Component, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Info, Loader2, BarChart3, ExternalLink, ChevronDown, ChevronUp, Home } from "lucide-react";
import { usePricingAI } from "@/hooks/usePricingAI";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { createNotification } from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";
import { markdownToSafeHtml } from "@/lib/sanitizeHtml";

const fmt = (v: number | undefined | null) => {
  if (v == null || isNaN(v)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
};

const safePct = (v: number | undefined | null) => {
  if (v == null || isNaN(v)) return "0.00";
  return v.toFixed(2);
};

const marketPositionConfig = {
  abaixo: { icon: TrendingDown, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20", label: "Abaixo do mercado", badge: "bg-amber-100 text-amber-800" },
  alinhado: { icon: Minus, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20", label: "Alinhado com o mercado", badge: "bg-green-100 text-green-800" },
  acima: { icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20", label: "Acima do mercado", badge: "bg-blue-100 text-blue-800" },
};

const riskLevelConfig: Record<string, { color: string; label: string }> = {
  baixo: { color: "bg-green-100 text-green-800", label: "Baixo" },
  medio: { color: "bg-amber-100 text-amber-800", label: "Médio" },
  alto: { color: "bg-orange-100 text-orange-800", label: "Alto" },
  critico: { color: "bg-red-100 text-red-800", label: "Crítico" },
};

// Error Boundary para capturar erros de rendering sem crashar a página inteira
class PricingErrorBoundary extends Component<
  { children: ReactNode; onReset: () => void },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: ReactNode; onReset: () => void }) {
    super(props);
    this.state = { hasError: false, errorMsg: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error?.message || "Erro desconhecido" };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="py-8 text-center space-y-4">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
          <p className="text-sm text-muted-foreground">
            Ocorreu um erro ao exibir os resultados da análise.
          </p>
          <p className="text-xs text-muted-foreground">{this.state.errorMsg}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              this.setState({ hasError: false, errorMsg: "" });
              this.props.onReset();
            }}
          >
            Tentar Novamente
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface PricingAIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId?: string;
  propertyId?: string;
  neighborhood?: string;
  city?: string;
  currentValue?: number;
  adjustmentIndex?: string;
  contractType?: string;
  onApply?: (value: number, pct: number) => void;
}

const sourceColors: Record<string, { bg: string; text: string }> = {
  vivareal: { bg: "bg-purple-100", text: "text-purple-800" },
  zapimoveis: { bg: "bg-blue-100", text: "text-blue-800" },
  olx: { bg: "bg-orange-100", text: "text-orange-800" },
  quintoandar: { bg: "bg-pink-100", text: "text-pink-800" },
};

export function PricingAIDialog({
  open,
  onOpenChange,
  contractId,
  propertyId,
  neighborhood,
  city,
  currentValue,
  adjustmentIndex,
  contractType,
  onApply,
}: PricingAIDialogProps) {
  const { analyze, loading, result, error, reset } = usePricingAI();
  const { checkAutoComplete } = useOnboardingProgress();
  const [elapsed, setElapsed] = useState(0);
  const [intervalId, setIntervalId] = useState<ReturnType<typeof setInterval> | null>(null);
  const [showComparables, setShowComparables] = useState(false);

  function handleOpen(o: boolean) {
    if (!o) {
      reset();
      if (intervalId) {
        clearInterval(intervalId);
        setIntervalId(null);
      }
      setElapsed(0);
      setShowComparables(false);
    }
    onOpenChange(o);
  }

  async function handleAnalyze() {
    setElapsed(0);
    // Timer de progresso para feedback visual
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    setIntervalId(id);

    await analyze({
      contract_id: contractId,
      property_id: propertyId,
      neighborhood,
      city,
      current_value: currentValue,
      adjustment_index: adjustmentIndex,
      contract_type: contractType,
    });

    clearInterval(id);
    setIntervalId(null);
    // Wire onboarding: mark AI analysis as complete (on success)
    if (result && !error) {
      checkAutoComplete("ai_analysis_run");

      // Fire notification
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          createNotification({
            userId: user.id,
            title: "Análise de preço realizada",
            message: "Precificação IA analisou o imóvel e sugeriu um valor",
            category: "ia",
            referenceType: "contract",
            referenceId: contractId,
          });
        }
      });
    }
  }

  const pos = result?.market_position
    ? marketPositionConfig[result.market_position] ?? null
    : null;
  const PosIcon = pos?.icon;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            IA de Precificação de Aluguel
          </DialogTitle>
        </DialogHeader>

        <PricingErrorBoundary onReset={reset}>
          {!result && !loading && !error && (
            <div className="py-8 text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-lg">Análise Inteligente de Precificação</p>
                <p className="text-sm text-muted-foreground mt-1">
                  A IA analisará índices econômicos, histórico de preços e imóveis similares na região para sugerir o valor ideal.
                </p>
              </div>
              {currentValue != null && (
                <p className="text-sm text-muted-foreground">
                  Valor atual: <span className="font-semibold text-foreground">{fmt(currentValue)}</span>
                </p>
              )}
              <Button onClick={handleAnalyze} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Analisar com IA
              </Button>
            </div>
          )}

          {loading && (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Analisando mercado e calculando valor ideal...</p>
              {elapsed > 5 && (
                <p className="text-xs text-muted-foreground">
                  {elapsed < 30
                    ? "Buscando imóveis comparáveis na região..."
                    : elapsed < 50
                    ? "Processando dados de mercado e calculando..."
                    : "Quase pronto, finalizando análise..."}
                  <span className="ml-1 tabular-nums">({elapsed}s)</span>
                </p>
              )}
            </div>
          )}

          {error && !loading && !result && (
            <div className="py-8 text-center space-y-4">
              <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
              <p className="text-sm text-muted-foreground">
                {error}
              </p>
              <Button onClick={handleAnalyze} variant="outline" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Tentar Novamente
              </Button>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Main recommendation */}
              <Card className="border-primary/30">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Valor Recomendado</p>
                      <p className="text-3xl font-bold text-primary">{fmt(result.recommended_value)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="text-xs">
                          {(result.adjustment_pct ?? 0) > 0 ? "+" : ""}{safePct(result.adjustment_pct)}% {result.index_used || "N/A"}
                        </Badge>
                        {result.index_value != null && (
                          <span className="text-xs text-muted-foreground">Índice: {safePct(result.index_value)}%</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      {pos && PosIcon && (
                        <div className={`flex items-center gap-1 justify-end px-3 py-1.5 rounded-lg ${pos.bg}`}>
                          <PosIcon className={`h-4 w-4 ${pos.color}`} />
                          <span className={`text-xs font-medium ${pos.color}`}>{pos.label}</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">Confiança: <span className="font-semibold">{result.confidence ?? 0}%</span></p>
                    </div>
                  </div>
                  {(result.min_value != null || result.max_value != null) && (
                    <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                      {result.min_value != null && <span>Mínimo: <b>{fmt(result.min_value)}</b></span>}
                      {result.max_value != null && <span>Máximo: <b>{fmt(result.max_value)}</b></span>}
                      {currentValue != null && (
                        <span>Atual: <b>{fmt(currentValue)}</b></span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Reasoning */}
              {result.reasoning && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <p className="text-sm">{result.reasoning}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Market insights */}
              {result.market_insights && result.market_insights.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-600" /> Insights de Mercado
                  </p>
                  <ul className="space-y-1">
                    {result.market_insights.map((insight, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Risk factors */}
              {result.risk_factors && result.risk_factors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-amber-500" /> Fatores de Atenção
                  </p>
                  <ul className="space-y-1">
                    {result.risk_factors.map((factor, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-2">
                        <span className="text-amber-500 mt-0.5">•</span>
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AI Market Analysis - texto completo gerado pelo GPT-4o */}
              {result.ai_analysis && (
                <Card className="border-muted">
                  <CardContent className="pt-4">
                    <p className="text-sm font-medium flex items-center gap-1 mb-3">
                      <BarChart3 className="h-4 w-4 text-primary" /> Análise Detalhada de Mercado
                    </p>
                    <div
                      className="text-xs text-muted-foreground prose prose-xs dark:prose-invert max-w-none [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:my-1 [&_li]:my-0.5 [&_strong]:text-foreground"
                      dangerouslySetInnerHTML={{
                        __html: markdownToSafeHtml(result.ai_analysis),
                      }}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Top Comparables - v23 */}
              {result.top_comparables && result.top_comparables.length > 0 && (
                <div className="space-y-2">
                  <button
                    type="button"
                    className="flex items-center gap-2 text-sm font-medium w-full text-left hover:text-primary transition-colors"
                    onClick={() => setShowComparables(!showComparables)}
                  >
                    <Home className="h-4 w-4 text-primary" />
                    Imóveis Comparáveis Utilizados ({result.top_comparables.length})
                    {showComparables ? (
                      <ChevronUp className="h-4 w-4 ml-auto text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" />
                    )}
                  </button>
                  {showComparables && (
                    <div className="space-y-2">
                      {result.top_comparables.map((comp, i) => {
                        const sc = sourceColors[comp.source] || { bg: "bg-gray-100", text: "text-gray-800" };
                        return (
                          <Card key={i} className="border-muted">
                            <CardContent className="py-3 px-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate" title={comp.title}>
                                    {comp.title || `Imóvel ${i + 1}`}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="text-sm font-semibold text-primary">
                                      {fmt(comp.price)}
                                    </span>
                                    {comp.area > 0 && (
                                      <span className="text-xs text-muted-foreground">
                                        {comp.area}m² · R$ {comp.pricePerSqm?.toFixed(0)}/m²
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="text-xs text-muted-foreground">
                                      {comp.neighborhood}{comp.city ? `, ${comp.city}` : ""}
                                    </span>
                                    {comp.bedrooms > 0 && (
                                      <span className="text-xs text-muted-foreground">
                                        · {comp.bedrooms} quarto{comp.bedrooms > 1 ? "s" : ""}
                                      </span>
                                    )}
                                    <Badge className={`text-[10px] px-1.5 py-0 ${sc.bg} ${sc.text}`}>
                                      {comp.source}
                                    </Badge>
                                  </div>
                                </div>
                                {comp.url && (
                                  <a
                                    href={comp.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="shrink-0 flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                                  >
                                    Ver anúncio
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Stats summary */}
              {result.total_comparables != null && (
                <div className="flex gap-3 text-xs text-muted-foreground justify-center pt-1">
                  <span>📊 {result.total_comparables} comparáveis</span>
                  {result.total_listings != null && <span>🔍 {result.total_listings} imóveis analisados</span>}
                  {result.evaluation_id && <span className="font-mono">ID: {result.evaluation_id.slice(0, 8)}</span>}
                </div>
              )}
            </div>
          )}
        </PricingErrorBoundary>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpen(false)}>Fechar</Button>
          {result && (
            <Button
              onClick={() => {
                onApply?.(result.recommended_value, result.adjustment_pct ?? 0);
                handleOpen(false);
              }}
              className="gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Aplicar Valor Recomendado
            </Button>
          )}
          {result && (
            <Button variant="ghost" size="sm" onClick={handleAnalyze} disabled={loading}>
              <Sparkles className="h-4 w-4 mr-1" /> Nova Análise
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
