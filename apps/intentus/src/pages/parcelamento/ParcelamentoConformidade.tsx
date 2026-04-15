/**
 * Parcelamento de Solo — Conformidade Legal (Bloco B — Fase 5)
 *
 * Análise de conformidade via RAG + Gemini:
 * - Checklist Lei 6.766/79 (loteamentos)
 * - Checklist Lei 4.591/64 (incorporações/condomínios de lotes)
 * - Score de compliance 0-100
 * - Parecer textual completo com citações
 * - Integração com base de conhecimento jurídico (pgvector)
 */
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useParcelamentoProject,
  useParcelamentoCompliance,
  useLatestLegalAnalysis,
  useRunLegalAnalysis,
} from "@/hooks/useParcelamentoProjects";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Play,
  BookOpen,
  FileText,
  ChevronDown,
  ChevronUp,
  Scale,
  Sparkles,
} from "lucide-react";
import type { LegalAnalysisResult, ComplianceStatus } from "@/lib/parcelamento/types";
import DOMPurify from "dompurify";

// ---------------------------------------------------------------------------
// Status config — mapeia todos os status possíveis (stub + EF nova)
// ---------------------------------------------------------------------------
const STATUS_CONFIG: Record<
  string,
  { icon: typeof CheckCircle2; color: string; bg: string; border: string; label: string }
> = {
  // Novos status (EF parcelamento-legal-analysis v1)
  compliant: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", border: "border-green-200", label: "Conforme" },
  violation: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200", label: "Violação" },
  warning: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", label: "Atenção" },
  missing_info: { icon: ShieldQuestion, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", label: "Info Pendente" },
  // Status legados (stub da Fase 3)
  ok: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", border: "border-green-200", label: "Conforme" },
  pass: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", border: "border-green-200", label: "Conforme" },
  atencao: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", label: "Atenção" },
  warn: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", label: "Atenção" },
  nao_conforme: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200", label: "Não Conforme" },
  fail: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200", label: "Não Conforme" },
  pendente: { icon: Clock, color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200", label: "Pendente" },
  pending: { icon: Clock, color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200", label: "Pendente" },
  na: { icon: Clock, color: "text-gray-400", bg: "bg-gray-50", border: "border-gray-200", label: "N/A" },
};

const DEFAULT_STATUS = STATUS_CONFIG.pending;

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? DEFAULT_STATUS;
}

// ---------------------------------------------------------------------------
// Score ring component
// ---------------------------------------------------------------------------
function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const color =
    score >= 80 ? "#16a34a" : score >= 60 ? "#d97706" : score >= 40 ? "#ea580c" : "#dc2626";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={10}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - filled}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color }}>
          {Math.round(score)}
        </span>
        <span className="text-xs text-gray-500">/ 100</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Analysis type selector
// ---------------------------------------------------------------------------
type AnalysisType = "completa" | "lei_6766" | "lei_4591";

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function ParcelamentoConformidade() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: project, isLoading: loadingProject } = useParcelamentoProject(id ?? null);
  const { data: compliance, isLoading: loadingCompliance } = useParcelamentoCompliance(id ?? null);
  const { data: cachedAnalysis, isLoading: loadingAnalysis } = useLatestLegalAnalysis(id ?? null);

  const runAnalysis = useRunLegalAnalysis();

  const [analysisType, setAnalysisType] = useState<AnalysisType>("completa");
  const [liveResult, setLiveResult] = useState<LegalAnalysisResult | null>(null);
  const [showParecer, setShowParecer] = useState(false);
  const [showCitations, setShowCitations] = useState(false);

  const isLoading = loadingProject || loadingCompliance || loadingAnalysis;

  // Use live result if available, otherwise cached
  const result = liveResult;
  const score = result?.compliance_score ?? cachedAnalysis?.compliance_score ?? null;
  const parecer = result?.parecer_textual ?? cachedAnalysis?.parecer_textual ?? null;
  const violations = result?.violations ?? cachedAnalysis?.violations ?? [];
  const warnings = result?.warnings ?? cachedAnalysis?.warnings ?? [];
  const compliantItems = result?.compliant_items ?? cachedAnalysis?.recommendations ?? [];
  const missingInfo = result?.missing_info ?? cachedAnalysis?.missing_info ?? [];
  const citations = result?.citations ?? cachedAnalysis?.citations ?? [];

  // Count by status from compliance checks
  const statusGroups = {
    violation: 0,
    warning: 0,
    compliant: 0,
    missing_info: 0,
    other: 0,
  };
  if (compliance) {
    for (const c of compliance) {
      const s = c.status as string;
      if (s === "violation" || s === "fail" || s === "nao_conforme") statusGroups.violation++;
      else if (s === "warning" || s === "warn" || s === "atencao") statusGroups.warning++;
      else if (s === "compliant" || s === "pass" || s === "ok") statusGroups.compliant++;
      else if (s === "missing_info") statusGroups.missing_info++;
      else statusGroups.other++;
    }
  }

  async function handleRunAnalysis() {
    if (!id) return;
    try {
      const data = await runAnalysis.mutateAsync({
        developmentId: id,
        analysisType,
      });
      setLiveResult(data);
    } catch {
      // Error handled by React Query
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => navigate(`/parcelamento/${id}`)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            {project?.name ?? "Projeto"}
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-gray-900">Conformidade Legal</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Scale className="h-5 w-5 text-indigo-600" />
              Conformidade Legal
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Lei 6.766/79 · Lei 4.591/64 · Código Florestal · Análise RAG + Gemini
            </p>
          </div>

          {/* Analysis controls */}
          <div className="flex items-center gap-3">
            <select
              value={analysisType}
              onChange={(e) => setAnalysisType(e.target.value as AnalysisType)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
            >
              <option value="completa">Análise Completa</option>
              <option value="lei_6766">Só Lei 6.766 (Loteamento)</option>
              <option value="lei_4591">Só Lei 4.591 (Incorporação)</option>
            </select>
            <button
              onClick={handleRunAnalysis}
              disabled={runAnalysis.isPending || !id}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {runAnalysis.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Analisar com IA
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {runAnalysis.isError && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Erro na análise: {runAnalysis.error?.message || "Erro desconhecido"}
        </div>
      )}

      {!isLoading && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Score + Summary */}
          {score != null && (
            <div className="flex gap-6 items-start">
              <ScoreRing score={score} />
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  Score de Conformidade
                </h2>
                <p className="text-sm text-gray-600 mb-3">
                  {result?.summary ?? (score >= 80
                    ? "O projeto apresenta boa conformidade com a legislação vigente."
                    : score >= 60
                    ? "Existem pontos de atenção que precisam ser endereçados."
                    : "Violações críticas identificadas — ação corretiva necessária.")}
                </p>
                {result?.model && (
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>Modelo: {result.model}</span>
                    <span>Tokens: {result.tokens?.input ?? 0} in / {result.tokens?.output ?? 0} out</span>
                    <span>RAG chunks: {result.rag_chunks_used ?? 0}</span>
                  </div>
                )}
                {cachedAnalysis && !result && (
                  <p className="text-xs text-gray-400">
                    Última análise: {new Date(cachedAnalysis.created_at).toLocaleDateString("pt-BR")} — {cachedAnalysis.model_used}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Status summary cards */}
          {compliance && compliance.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { key: "compliant", icon: ShieldCheck, color: "text-green-600", bg: "bg-green-50", label: "Conforme", count: statusGroups.compliant },
                { key: "warning", icon: ShieldAlert, color: "text-amber-600", bg: "bg-amber-50", label: "Atenção", count: statusGroups.warning },
                { key: "violation", icon: Shield, color: "text-red-600", bg: "bg-red-50", label: "Violações", count: statusGroups.violation },
                { key: "missing", icon: ShieldQuestion, color: "text-blue-600", bg: "bg-blue-50", label: "Info Pendente", count: statusGroups.missing_info + statusGroups.other },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.key} className={`rounded-xl p-4 ${card.bg} border`}>
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${card.color}`} />
                      <span className={`text-sm font-medium ${card.color}`}>{card.label}</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{card.count}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Violations */}
          {violations.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                <XCircle className="h-4 w-4" />
                Violações ({violations.length})
              </h3>
              <div className="space-y-2">
                {violations.map((v, i) => (
                  <div key={`v-${i}`} className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <div className="flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{v.description}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{v.article} · Severidade: {v.severity}</p>
                        {v.recommendation && (
                          <p className="text-xs text-red-700 mt-2 bg-red-100 rounded px-2 py-1">
                            Recomendação: {v.recommendation}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                Pontos de Atenção ({warnings.length})
              </h3>
              <div className="space-y-2">
                {warnings.map((w, i) => (
                  <div key={`w-${i}`} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{w.description}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{w.article} · Severidade: {w.severity}</p>
                        {w.recommendation && (
                          <p className="text-xs text-amber-700 mt-2 bg-amber-100 rounded px-2 py-1">
                            Sugestão: {w.recommendation}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compliant items */}
          {compliantItems.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Itens Conformes ({compliantItems.length})
              </h3>
              <div className="space-y-1.5">
                {compliantItems.map((c, i) => (
                  <div key={`c-${i}`} className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-900">{c.description}</p>
                        <p className="text-xs text-gray-500">{c.article}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing info */}
          {missingInfo.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
                <ShieldQuestion className="h-4 w-4" />
                Informações Pendentes ({missingInfo.length})
              </h3>
              <div className="space-y-1.5">
                {missingInfo.map((m, i) => (
                  <div key={`m-${i}`} className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <div className="flex items-start gap-2">
                      <ShieldQuestion className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-700">{m.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Parecer textual */}
          {parecer && (
            <div>
              <button
                onClick={() => setShowParecer((p) => !p)}
                className="flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:text-indigo-800"
              >
                <FileText className="h-4 w-4" />
                Parecer Jurídico Completo
                {showParecer ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showParecer && (
                <div
                  className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-5 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(parecer.replace(/\n/g, "<br />")),
                  }}
                />
              )}
            </div>
          )}

          {/* Citations */}
          {citations.length > 0 && (
            <div>
              <button
                onClick={() => setShowCitations((c) => !c)}
                className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-800"
              >
                <BookOpen className="h-4 w-4" />
                Citações e Fontes ({citations.length})
                {showCitations ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showCitations && (
                <div className="mt-3 space-y-2">
                  {citations.map((cit, i) => (
                    <div key={`cit-${i}`} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <p className="text-xs font-medium text-gray-700">
                        {cit.source_title} — {cit.article}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 italic">
                        {`"${cit.excerpt?.substring(0, 200)}${(cit.excerpt?.length ?? 0) > 200 ? "..." : ""}"`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Compliance checks list (from DB table) */}
          {compliance && compliance.length > 0 && !result && !cachedAnalysis && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Checklist de Conformidade</h3>
              <div className="space-y-2">
                {compliance.map((check) => {
                  const config = getStatusConfig(check.status);
                  const Icon = config.icon;
                  return (
                    <div key={check.id} className={`rounded-lg border ${config.border} p-4 ${config.bg}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${config.color}`} />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{check.check_label}</p>
                            {check.legal_basis && (
                              <p className="text-xs text-gray-500 mt-0.5">{check.legal_basis}</p>
                            )}
                            {check.ai_explanation && (
                              <p className="text-xs text-gray-600 mt-2 italic">{check.ai_explanation}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          {check.actual_value && (
                            <p className="text-xs text-gray-600">
                              Atual: <span className="font-medium">{check.actual_value}</span>
                            </p>
                          )}
                          {check.required_value && (
                            <p className="text-xs text-gray-500">Exigido: {check.required_value}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!score && (!compliance || compliance.length === 0) && (
            <div className="flex flex-col items-center justify-center h-48 rounded-xl border-2 border-dashed border-gray-200 text-center">
              <Scale className="h-10 w-10 mb-3 text-indigo-200" />
              <p className="text-sm text-gray-500 font-medium">Nenhuma análise de conformidade realizada</p>
              <p className="text-xs text-gray-400 mt-1 max-w-md">
                Clique em &quot;Analisar com IA&quot; para executar o checklist automático
                das Leis 6.766/79 e 4.591/64 usando inteligência artificial com base de conhecimento jurídico.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
