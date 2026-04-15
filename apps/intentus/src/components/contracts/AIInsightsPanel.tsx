import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createNotification } from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
import {
  Brain,
  Shield,
  AlertTriangle,
  CheckCircle,
  FileWarning,
  Lightbulb,
  BarChart3,
  Play,
  Loader2,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Eye,
  RefreshCw,
  FileText,
  Calendar,
  Users,
  Info,
} from "lucide-react";
import {
  useAIOverview,
  usePortfolioInsights,
  useContractAIAnalysis,
  useRunAIAnalysis,
  RISK_LEVEL_LABELS,
  RISK_LEVEL_COLORS,
  RISK_SCORE_COLOR,
  RISK_SCORE_BG,
  RISK_SCORE_LABEL,
  type ContractAIOverview,
  type ContractAIAnalysis,
  type RiskFactor,
  type Suggestion,
  type FlaggedClause,
} from "@/hooks/useContractAIInsights";

// ── Subcomponentes ────────────────────────────────────────

function RiskScoreGauge({ score }: { score: number }) {
  const color = RISK_SCORE_BG(score);
  const label = RISK_SCORE_LABEL(score);
  const textColor = RISK_SCORE_COLOR(score);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="12"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeDasharray={`${(score / 100) * 264} 264`}
            strokeLinecap="round"
            className={textColor}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xl font-bold ${textColor}`}>{score}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

function RiskFactorItem({ factor }: { factor: RiskFactor }) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-orange-500" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium">{factor.category}</span>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 ${RISK_LEVEL_COLORS[factor.severity]}`}
          >
            {RISK_LEVEL_LABELS[factor.severity]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{factor.description}</p>
      </div>
    </div>
  );
}

function SuggestionItem({ suggestion }: { suggestion: Suggestion }) {
  const priorityIcons = {
    high: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />,
    medium: <Info className="h-3.5 w-3.5 text-yellow-500" />,
    low: <CheckCircle className="h-3.5 w-3.5 text-green-500" />,
  };

  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
      <Lightbulb className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium capitalize">{suggestion.type}</span>
          {priorityIcons[suggestion.priority]}
        </div>
        <p className="text-xs text-muted-foreground">{suggestion.description}</p>
      </div>
    </div>
  );
}

function FlaggedClauseItem({ clause }: { clause: FlaggedClause }) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-orange-50/50 dark:bg-orange-950/20">
      <FileWarning className="h-4 w-4 mt-0.5 shrink-0 text-orange-500" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium">Cláusula {clause.clause_number}</span>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 ${RISK_LEVEL_COLORS[clause.risk_level]}`}
          >
            {RISK_LEVEL_LABELS[clause.risk_level]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {clause.content_preview}
        </p>
        <p className="text-xs text-orange-600 mt-1">{clause.reason}</p>
      </div>
    </div>
  );
}

// ── Painel de Portfólio ──────────────────────────────────

function PortfolioOverview() {
  const { data: insights, isLoading } = usePortfolioInsights();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5" />
            Visão Geral do Portfólio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!insights) return null;

  const coveragePercent =
    insights.totalContracts > 0
      ? Math.round((insights.analyzedContracts / insights.totalContracts) * 100)
      : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-5 w-5 text-[#e2a93b]" />
          Visão Geral do Portfólio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Banner de dados simulados */}
        {insights.isSimulated && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <div>
              <p className="text-xs font-semibold">Dados Simulados</p>
              <p className="text-[11px] text-amber-700">
                Os insights abaixo foram gerados por regras locais, não por modelo de IA.
                Conecte um modelo de IA para análises reais.
              </p>
            </div>
          </div>
        )}

        {/* KPIs do portfólio */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="text-2xl font-bold">{insights.totalContracts}</div>
            <div className="text-xs text-muted-foreground">Total Contratos</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="text-2xl font-bold">{insights.analyzedContracts}</div>
            <div className="text-xs text-muted-foreground">Analisados por IA</div>
          </div>
        </div>

        {/* Cobertura de análise */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Cobertura de Análise</span>
            <span className="font-medium">{coveragePercent}%</span>
          </div>
          <Progress value={coveragePercent} className="h-2" />
        </div>

        {/* Risco médio */}
        {insights.analyzedContracts > 0 && (
          <>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <div className="text-xs text-muted-foreground">Risco Médio</div>
                <div className={`text-lg font-bold ${RISK_SCORE_COLOR(insights.avgRiskScore)}`}>
                  {insights.avgRiskScore}/100
                </div>
              </div>
              <RiskScoreGauge score={insights.avgRiskScore} />
            </div>

            {/* Distribuição de risco */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Distribuição de Risco
              </div>
              <div className="flex gap-2">
                <div className="flex-1 p-2 rounded bg-green-50 dark:bg-green-950/30 text-center">
                  <div className="text-lg font-bold text-green-600">{insights.lowRiskCount}</div>
                  <div className="text-[10px] text-green-600">Baixo</div>
                </div>
                <div className="flex-1 p-2 rounded bg-yellow-50 dark:bg-yellow-950/30 text-center">
                  <div className="text-lg font-bold text-yellow-600">{insights.mediumRiskCount}</div>
                  <div className="text-[10px] text-yellow-600">Médio</div>
                </div>
                <div className="flex-1 p-2 rounded bg-red-50 dark:bg-red-950/30 text-center">
                  <div className="text-lg font-bold text-red-600">{insights.highRiskCount}</div>
                  <div className="text-[10px] text-red-600">Alto</div>
                </div>
              </div>
            </div>

            {/* Cláusulas ausentes mais comuns */}
            {insights.commonMissingClauses.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Cláusulas Ausentes Mais Comuns
                </div>
                <div className="space-y-1">
                  {insights.commonMissingClauses.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/30">
                      <span>{c.clause}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {c.count}x
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top fatores de risco */}
            {insights.topRiskFactors.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Principais Fatores de Risco
                </div>
                <div className="space-y-1">
                  {insights.topRiskFactors.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/30">
                      <span>{f.category}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {f.count}x
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {insights.analyzedContracts === 0 && (
          <div className="text-center py-4">
            <Brain className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhum contrato analisado ainda.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Execute uma análise IA em um contrato para ver insights aqui.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Ranking de Contratos por Risco ──────────────────────

function ContractRiskRanking() {
  const { data: overview, isLoading } = useAIOverview();
  const [selectedContract, setSelectedContract] = useState<ContractAIOverview | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5" />
            Ranking de Risco
          </CardTitle>
        </CardHeader>
        <CardContent>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full mb-2" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const analyzed = (overview ?? []).filter((c) => c.hub_risk_score !== null);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5 text-[#e2a93b]" />
            Ranking de Risco por Contrato
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analyzed.length === 0 ? (
            <div className="text-center py-6">
              <Shield className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhuma análise disponível.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Selecione um contrato e execute a análise IA.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {analyzed.map((contract) => (
                <button
                  key={contract.contract_id}
                  onClick={() => setSelectedContract(contract)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                >
                  <RiskScoreGauge score={contract.hub_risk_score!} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {contract.title ?? contract.contract_number ?? "Sem título"}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {contract.contract_type && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {contract.contract_type}
                        </Badge>
                      )}
                      {contract.status && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {contract.status}
                        </Badge>
                      )}
                    </div>
                    {contract.hub_analyzed_at && (
                      <div className="text-[10px] text-muted-foreground mt-1">
                        Analisado em{" "}
                        {new Date(contract.hub_analyzed_at).toLocaleDateString("pt-BR")}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de detalhes */}
      <Dialog
        open={!!selectedContract}
        onOpenChange={() => setSelectedContract(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-[#e2a93b]" />
              Análise IA —{" "}
              {selectedContract?.title ??
                selectedContract?.contract_number ??
                "Contrato"}
            </DialogTitle>
          </DialogHeader>

          {selectedContract && (
            <div className="space-y-4">
              {/* Score e resumo */}
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                <RiskScoreGauge score={selectedContract.hub_risk_score!} />
                <div className="flex-1">
                  {selectedContract.hub_summary && (
                    <p className="text-sm">{selectedContract.hub_summary}</p>
                  )}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {selectedContract.model_used && (
                      <Badge variant="outline" className="text-[10px]">
                        Modelo: {selectedContract.model_used}
                      </Badge>
                    )}
                    {selectedContract.hub_analyzed_at && (
                      <Badge variant="outline" className="text-[10px]">
                        {new Date(selectedContract.hub_analyzed_at).toLocaleString("pt-BR")}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Fatores de risco */}
              {(selectedContract.hub_risk_factors ?? []).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Fatores de Risco
                  </h4>
                  <div className="space-y-2">
                    {selectedContract.hub_risk_factors!.map((f, i) => (
                      <RiskFactorItem key={i} factor={f} />
                    ))}
                  </div>
                </div>
              )}

              {/* Cláusulas ausentes */}
              {(selectedContract.hub_missing_clauses ?? []).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <FileWarning className="h-4 w-4 text-red-500" />
                    Cláusulas Ausentes
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedContract.hub_missing_clauses!.map((clause, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="bg-red-50 text-red-700 border-red-200"
                      >
                        {clause}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Sugestões */}
              {(selectedContract.hub_suggestions ?? []).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Lightbulb className="h-4 w-4 text-blue-500" />
                    Sugestões
                  </h4>
                  <div className="space-y-2">
                    {selectedContract.hub_suggestions!.map((s, i) => (
                      <SuggestionItem key={i} suggestion={s} />
                    ))}
                  </div>
                </div>
              )}

              {/* Cláusulas flagradas */}
              {(selectedContract.hub_flagged_clauses ?? []).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <FileWarning className="h-4 w-4 text-orange-500" />
                    Cláusulas Flagradas
                  </h4>
                  <div className="space-y-2">
                    {selectedContract.hub_flagged_clauses!.map((c, i) => (
                      <FlaggedClauseItem key={i} clause={c} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Análise Individual de Contrato ──────────────────────

interface ContractAnalysisPanelProps {
  contractId: string;
  contractTitle?: string;
}

export function ContractAnalysisPanel({
  contractId,
  contractTitle,
}: ContractAnalysisPanelProps) {
  const { data: analyses, isLoading } = useContractAIAnalysis(contractId);
  const runAnalysis = useRunAIAnalysis();

  const latestAnalysis = analyses?.[0];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-5 w-5 text-[#e2a93b]" />
            Análise IA
            {contractTitle && (
              <span className="text-muted-foreground font-normal text-sm">
                — {contractTitle}
              </span>
            )}
          </CardTitle>
          <Button
            size="sm"
            onClick={() => runAnalysis.mutate(contractId, {
              onSuccess: () => {
                // Fire notification
                supabase.auth.getUser().then(({ data: { user } }) => {
                  if (user) {
                    createNotification({
                      userId: user.id,
                      title: "Insights IA gerados",
                      message: "Análise IA do contrato foi concluída com sucesso",
                      category: "ia",
                      referenceType: "contract",
                      referenceId: contractId,
                    });
                  }
                });
              },
            })}
            disabled={runAnalysis.isPending}
            className="bg-[#e2a93b] hover:bg-[#c99430] text-white"
          >
            {runAnalysis.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Analisando...
              </>
            ) : latestAnalysis ? (
              <>
                <RefreshCw className="h-4 w-4 mr-1" />
                Reanalisar
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1" />
                Executar Análise
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !latestAnalysis ? (
          <div className="text-center py-8">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhuma análise IA disponível para este contrato.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Clique em &quot;Executar Análise&quot; para gerar insights.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Score e resumo */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              {latestAnalysis.risk_score !== null && (
                <RiskScoreGauge score={latestAnalysis.risk_score} />
              )}
              <div className="flex-1">
                {latestAnalysis.summary && (
                  <p className="text-sm">{latestAnalysis.summary}</p>
                )}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {latestAnalysis.model_used && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        latestAnalysis.model_used === "rule_engine_v1"
                          ? "bg-amber-50 text-amber-700 border-amber-300"
                          : ""
                      }`}
                    >
                      {latestAnalysis.model_used === "rule_engine_v1"
                        ? "⚠ Simulado (regras locais)"
                        : latestAnalysis.model_used}
                    </Badge>
                  )}
                  {latestAnalysis.processing_ms !== null && (
                    <Badge variant="outline" className="text-[10px]">
                      {latestAnalysis.processing_ms}ms
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    {new Date(latestAnalysis.created_at).toLocaleString("pt-BR")}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Fatores de risco */}
            {latestAnalysis.risk_factors.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Fatores de Risco ({latestAnalysis.risk_factors.length})
                </h4>
                <div className="space-y-2">
                  {latestAnalysis.risk_factors.map((f, i) => (
                    <RiskFactorItem key={i} factor={f} />
                  ))}
                </div>
              </div>
            )}

            {/* Cláusulas ausentes */}
            {latestAnalysis.missing_clauses.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <FileWarning className="h-4 w-4 text-red-500" />
                  Cláusulas Ausentes ({latestAnalysis.missing_clauses.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {latestAnalysis.missing_clauses.map((clause, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="bg-red-50 text-red-700 border-red-200"
                    >
                      {clause}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Sugestões */}
            {latestAnalysis.suggestions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Lightbulb className="h-4 w-4 text-blue-500" />
                  Sugestões ({latestAnalysis.suggestions.length})
                </h4>
                <div className="space-y-2">
                  {latestAnalysis.suggestions.map((s, i) => (
                    <SuggestionItem key={i} suggestion={s} />
                  ))}
                </div>
              </div>
            )}

            {/* Obrigações-chave */}
            {latestAnalysis.key_obligations.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Users className="h-4 w-4 text-purple-500" />
                  Obrigações-Chave
                </h4>
                <div className="space-y-1">
                  {latestAnalysis.key_obligations.map((o, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-2 rounded bg-purple-50/50 dark:bg-purple-950/20 text-xs"
                    >
                      <span className="font-medium shrink-0">{o.party}:</span>
                      <span className="text-muted-foreground">{o.obligation}</span>
                      {o.deadline && (
                        <Badge variant="outline" className="text-[10px] ml-auto shrink-0">
                          {o.deadline}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Datas-chave */}
            {latestAnalysis.key_dates.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  Datas-Chave
                </h4>
                <div className="flex flex-wrap gap-2">
                  {latestAnalysis.key_dates.map((d, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 p-1.5 rounded bg-blue-50/50 dark:bg-blue-950/20 text-xs"
                    >
                      <span className="font-medium">{d.label}:</span>
                      <span>{new Date(d.date).toLocaleDateString("pt-BR")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cláusulas flagradas */}
            {latestAnalysis.flagged_clauses.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <FileWarning className="h-4 w-4 text-orange-500" />
                  Cláusulas Flagradas ({latestAnalysis.flagged_clauses.length})
                </h4>
                <div className="space-y-2">
                  {latestAnalysis.flagged_clauses.map((c, i) => (
                    <FlaggedClauseItem key={i} clause={c} />
                  ))}
                </div>
              </div>
            )}

            {/* Histórico de análises */}
            {(analyses?.length ?? 0) > 1 && (
              <div className="pt-2 border-t">
                <h4 className="text-xs font-medium text-muted-foreground mb-2">
                  Histórico ({analyses!.length} análises)
                </h4>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {analyses!.slice(1).map((a) => (
                    <div
                      key={a.id}
                      className="shrink-0 p-2 rounded border text-xs text-center min-w-[80px]"
                    >
                      <div className={`font-bold ${RISK_SCORE_COLOR(a.risk_score ?? 0)}`}>
                        {a.risk_score ?? "—"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Componente Principal ─────────────────────────────────

export default function AIInsightsPanel() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-[#e2a93b]" />
            Insights com IA
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Análise inteligente do portfólio de contratos — riscos, cláusulas ausentes e sugestões.
          </p>
        </div>
      </div>

      {/* Layout em grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PortfolioOverview />
        <ContractRiskRanking />
      </div>
    </div>
  );
}
