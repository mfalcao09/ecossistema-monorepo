/**
 * Aba 8 — Fronteira Eficiente (Capital Structure Risk × Return)
 *
 * 📚 CONCEITO PEDAGÓGICO
 * A Fronteira Eficiente vem da teoria de Markowitz (Nobel de Economia, 1990).
 *
 * No contexto de loteamentos, aplicamos assim:
 *   • Eixo X: WACC (custo médio ponderado de capital) — proxy de risco
 *   • Eixo Y: VPL@WACC (valor presente líquido descontado pelo WACC)
 *
 * Cada ponto é uma estrutura de capital diferente (% equity × % dívida).
 * Pontos na "fronteira" oferecem o melhor retorno para cada nível de risco.
 * Pontos "dominados" (Pareto) ficam abaixo da fronteira — sempre há uma
 * alternativa que entrega mais retorno com mesmo ou menor risco.
 *
 * Consome dados de: EF parcelamento-financial-calc action=efficient_frontier
 * Persiste em: development_parcelamento_financial.efficient_frontier (jsonb)
 */

import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import type {
  ParcelamentoFinancial,
  EfficientFrontierPoint,
  EfficientFrontierOptimal,
} from "@/lib/parcelamento/types";
import { useRunEfficientFrontier, useActiveScenarioId } from "@/hooks/useSimularFinanceiro";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, TrendingUp, Loader2, Play, AlertTriangle, Star } from "lucide-react";

interface Props {
  financial: ParcelamentoFinancial | null | undefined;
}

function formatCurrency(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${v.toFixed(0)}`;
}

function formatPct(v: number | null | undefined): string {
  return v != null ? `${v.toFixed(1)}%` : "—";
}

/** Custom tooltip do scatter */
function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: EfficientFrontierPoint }> }) {
  if (!active || !payload?.[0]) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-gray-800">
        Equity {p.equity_pct}% · Dívida {p.divida_pct}%
      </p>
      <p>WACC: <span className="font-mono">{formatPct(p.wacc_pct)}</span></p>
      <p>VPL@WACC: <span className="font-mono">{p.vpl_wacc != null ? formatCurrency(p.vpl_wacc) : "—"}</span></p>
      <p>TIR: <span className="font-mono">{formatPct(p.tir_anual)}</span></p>
      <p>Payback: <span className="font-mono">{p.payback_meses ?? "—"} meses</span></p>
      <p>Score: <span className="font-mono">{p.performance_score.toFixed(0)}/100</span></p>
      {p.dominated && <p className="text-red-500 font-medium">⚠ Ponto dominado</p>}
      {!p.realistic && <p className="text-amber-500 font-medium">⚠ Irrealista (LTV {">"} limite)</p>}
    </div>
  );
}

/** Card de ponto ótimo */
function OptimalCard({
  label,
  point,
  icon,
}: {
  label: string;
  point: EfficientFrontierPoint | null;
  icon: string;
}) {
  if (!point) return null;
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="text-xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">{label}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
            <p className="text-gray-500">Equity / Dívida</p>
            <p className="font-mono text-gray-800">{point.equity_pct}% / {point.divida_pct}%</p>
            <p className="text-gray-500">WACC</p>
            <p className="font-mono text-gray-800">{formatPct(point.wacc_pct)}</p>
            <p className="text-gray-500">VPL@WACC</p>
            <p className="font-mono text-gray-800">{point.vpl_wacc != null ? formatCurrency(point.vpl_wacc) : "—"}</p>
            <p className="text-gray-500">TIR Anual</p>
            <p className="font-mono text-gray-800">{formatPct(point.tir_anual)}</p>
            <p className="text-gray-500">Score</p>
            <p className="font-mono text-gray-800">{point.performance_score.toFixed(0)}/100</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TabFronteiraEficiente({ financial }: Props) {
  const { id: developmentId } = useParams<{ id: string }>();
  const { data: scenarioId } = useActiveScenarioId(developmentId);
  const runFrontier = useRunEfficientFrontier();
  const [showUnrealistic, setShowUnrealistic] = useState(false);

  const frontier = financial?.efficient_frontier;
  const hasFrontier = frontier != null && frontier.points?.length > 0;

  const handleRun = () => {
    if (!scenarioId || !developmentId) return;
    runFrontier.mutate({
      developmentId,
      scenarioId,
      financialId: financial?.id,
      step_pct: 5, // 21 pontos para um scatter mais rico
    });
  };

  // Separar pontos fronteira vs dominados
  const allPoints = hasFrontier ? frontier!.points : [];
  const visiblePoints = showUnrealistic
    ? allPoints
    : allPoints.filter((p) => p.realistic);
  const frontierPoints = visiblePoints.filter((p) => !p.dominated);
  const dominatedPoints = visiblePoints.filter((p) => p.dominated);

  const optimal: EfficientFrontierOptimal | null = hasFrontier
    ? (showUnrealistic ? frontier!.optimal : frontier!.optimal_realistic)
    : null;

  return (
    <div className="p-6 space-y-6">
      {/* Bloco pedagógico */}
      <Alert className="border-blue-100 bg-blue-50">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-sm text-blue-800">
          <strong>O que é a Fronteira Eficiente?</strong> Para cada nível de
          risco (WACC), existe uma estrutura de capital (equity × dívida) que
          maximiza o retorno (VPL). Pontos na fronteira são as melhores
          combinações. Pontos "dominados" estão abaixo — sempre há uma
          alternativa melhor. Pontos irrealistas (dívida {">"} 85%) são filtrados
          por padrão (LTV bancário típico).
        </AlertDescription>
      </Alert>

      {/* Botão para rodar */}
      {financial?.is_calculated && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {hasFrontier && (
              <>
                <p className="text-xs text-gray-400">
                  {frontier!.points.length} pontos
                  · step {frontier!.config.step_pct}%
                  · LTV max {frontier!.config.realistic_max_divida_pct}%
                  · {frontier!.elapsed_ms}ms
                </p>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showUnrealistic}
                    onChange={(e) => setShowUnrealistic(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300"
                  />
                  <span className="text-xs text-gray-500">Mostrar irrealistas</span>
                </label>
              </>
            )}
          </div>
          <Button
            size="sm"
            variant={hasFrontier ? "outline" : "default"}
            className="gap-1.5"
            disabled={!scenarioId || runFrontier.isPending}
            onClick={handleRun}
          >
            {runFrontier.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {hasFrontier ? "Recalcular" : "Rodar Fronteira"}
          </Button>
        </div>
      )}

      {runFrontier.isError && (
        <Alert className="border-red-100 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-sm text-red-700">
            {(runFrontier.error as Error)?.message ?? "Erro ao calcular fronteira"}
          </AlertDescription>
        </Alert>
      )}

      {/* Scatter Plot */}
      {hasFrontier && (
        <>
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-gray-400" />
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Fronteira Eficiente — WACC × VPL@WACC
              </p>
            </div>

            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="wacc_pct"
                  name="WACC"
                  unit="%"
                  fontSize={11}
                  label={{ value: "WACC (%)", position: "insideBottom", offset: -5, fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="vpl_wacc"
                  name="VPL@WACC"
                  fontSize={11}
                  tickFormatter={(v: number) => formatCurrency(v)}
                  label={{ value: "VPL@WACC", angle: -90, position: "insideLeft", fontSize: 11 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />

                {/* Pontos da fronteira (não-dominados) */}
                <Scatter
                  name="Fronteira"
                  data={frontierPoints}
                  fill="#3b82f6"
                  stroke="#1d4ed8"
                  strokeWidth={1}
                  r={6}
                />

                {/* Pontos dominados */}
                {dominatedPoints.length > 0 && (
                  <Scatter
                    name="Dominados"
                    data={dominatedPoints}
                    fill="#d1d5db"
                    stroke="#9ca3af"
                    strokeWidth={1}
                    r={4}
                    opacity={0.6}
                  />
                )}

                {/* Linha zero VPL */}
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="5 5" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Cards de pontos ótimos */}
          {optimal && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Star className="h-4 w-4 text-amber-500" />
                <p className="text-sm font-semibold text-gray-800">
                  Pontos Ótimos {!showUnrealistic && "(realistas)"}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <OptimalCard label="Melhor VPL@WACC" point={optimal.by_vpl_wacc} icon="💰" />
                <OptimalCard label="Melhor TIR" point={optimal.by_tir} icon="📈" />
                <OptimalCard label="Menor WACC (risco)" point={optimal.by_min_wacc} icon="🛡️" />
                <OptimalCard label="Melhor Score" point={optimal.by_performance_score} icon="⭐" />
              </div>
            </div>
          )}

          {/* Tabela completa */}
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Todos os Pontos ({visiblePoints.length})
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["Equity %", "Dívida %", "WACC", "VPL@WACC", "TIR", "Payback", "Score", "Status"].map(
                      (h) => (
                        <th key={h} className="text-left px-3 py-2 text-gray-500 font-medium text-xs">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visiblePoints.map((p, i) => (
                    <tr
                      key={i}
                      className={`border-t border-gray-100 ${
                        p.dominated ? "opacity-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="px-3 py-2 text-xs font-mono">{p.equity_pct}%</td>
                      <td className="px-3 py-2 text-xs font-mono">{p.divida_pct}%</td>
                      <td className="px-3 py-2 text-xs font-mono">{formatPct(p.wacc_pct)}</td>
                      <td className="px-3 py-2 text-xs font-mono">
                        {p.vpl_wacc != null ? formatCurrency(p.vpl_wacc) : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono">{formatPct(p.tir_anual)}</td>
                      <td className="px-3 py-2 text-xs font-mono">
                        {p.payback_meses ?? "—"} {p.payback_meses != null ? "m" : ""}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono">{p.performance_score.toFixed(0)}</td>
                      <td className="px-3 py-2 text-xs">
                        {p.dominated ? (
                          <span className="text-gray-400">Dominado</span>
                        ) : !p.realistic ? (
                          <span className="text-amber-500">Irrealista</span>
                        ) : (
                          <span className="text-emerald-600 font-medium">Fronteira</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Estados vazios */}
      {!financial?.is_calculated && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center py-14 gap-3">
          <TrendingUp className="h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500 font-medium">
            Primeiro, execute uma simulação financeira
          </p>
          <p className="text-xs text-gray-400 text-center max-w-xs">
            Clique em "Simular" no topo da página para calcular o cenário base.
          </p>
        </div>
      )}

      {financial?.is_calculated && !hasFrontier && !runFrontier.isPending && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center py-14 gap-3">
          <TrendingUp className="h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500 font-medium">
            Fronteira Eficiente ainda não foi calculada
          </p>
          <p className="text-xs text-gray-400 text-center max-w-xs">
            Clique em "Rodar Fronteira" acima para simular diferentes
            combinações de equity × dívida e encontrar o ponto ótimo.
          </p>
        </div>
      )}
    </div>
  );
}
