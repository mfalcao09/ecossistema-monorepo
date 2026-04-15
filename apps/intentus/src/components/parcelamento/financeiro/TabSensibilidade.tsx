/**
 * Aba 5 — Análise de Sensibilidade ⭐ (Tornado Chart)
 *
 * 📚 CONCEITO PEDAGÓGICO
 * A análise de sensibilidade responde: "Qual variável tem mais poder de
 * destruir (ou salvar) este projeto?"
 *
 * Funciona assim: você muda uma variável de cada vez (mantendo as demais
 * fixas) e observa o impacto no VPL ou na TIR. As variáveis ordenadas
 * por impacto formam o "Gráfico Tornado" — as barras mais longas são os
 * riscos prioritários do empreendimento.
 *
 * Consome dados de: EF parcelamento-financial-calc action=compute_sensitivity
 * Persiste em: development_parcelamento_financial.sensitivity (jsonb)
 */

import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { ParcelamentoFinancial, SensitivityBar } from "@/lib/parcelamento/types";
import { useRunSensitivity, useActiveScenarioId } from "@/hooks/useSimularFinanceiro";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Sliders, Loader2, Play, AlertTriangle } from "lucide-react";

interface Props {
  financial: ParcelamentoFinancial | null | undefined;
}

// Cores do tornado
const COLOR_NEGATIVE = "#ef4444"; // red-500
const COLOR_POSITIVE = "#22c55e"; // green-500
const COLOR_SKIPPED = "#d1d5db";  // gray-300

function formatCurrency(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${v.toFixed(0)}`;
}

function formatPct(v: number | null): string {
  return v != null ? `${v.toFixed(1)}%` : "—";
}

/** Prepara dados para o gráfico tornado horizontal (barras divergentes do baseline) */
function buildTornadoData(
  bars: SensitivityBar[],
  kpi: "vpl" | "tir_anual"
) {
  return bars
    .filter((b) => !b.skipped)
    .map((b) => {
      const kpiData = b[kpi];
      return {
        label: b.label,
        variable: b.variable,
        base: kpiData.base,
        deltaLow: kpiData.delta_low,
        deltaHigh: kpiData.delta_high,
        low: kpiData.low,
        high: kpiData.high,
        impactRange: kpiData.impact_range,
      };
    })
    .sort((a, b) => b.impactRange - a.impactRange);
}

export function TabSensibilidade({ financial }: Props) {
  const { id: developmentId } = useParams<{ id: string }>();
  const { data: scenarioId } = useActiveScenarioId(developmentId);
  const runSensitivity = useRunSensitivity();
  const [kpiView, setKpiView] = useState<"vpl" | "tir_anual">("vpl");

  const sensitivity = financial?.sensitivity;
  const hasSensitivity = sensitivity != null && sensitivity.bars?.length > 0;

  const handleRun = () => {
    if (!scenarioId || !developmentId) return;
    runSensitivity.mutate({
      developmentId,
      scenarioId,
      financialId: financial?.id,
    });
  };

  const tornadoData = hasSensitivity
    ? buildTornadoData(
        kpiView === "vpl" ? sensitivity!.tornado_by_vpl : sensitivity!.tornado_by_tir,
        kpiView
      )
    : [];

  const skippedBars = hasSensitivity
    ? sensitivity!.bars.filter((b) => b.skipped)
    : [];

  return (
    <div className="p-6 space-y-6">
      {/* Bloco pedagógico */}
      <Alert className="border-blue-100 bg-blue-50">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-sm text-blue-800">
          <strong>O que é a Análise de Sensibilidade?</strong> Você "mexe" em
          uma variável de cada vez e observa o impacto no VPL e na TIR. As
          variáveis com barras mais longas no tornado são os riscos
          prioritários — onde o projeto é mais vulnerável (ou tem mais
          potencial).
        </AlertDescription>
      </Alert>

      {/* Botão para rodar */}
      {financial?.is_calculated && (
        <div className="flex items-center justify-between">
          <div>
            {hasSensitivity && (
              <p className="text-xs text-gray-400">
                Variação: ±{sensitivity!.config.variation_pct}% (multiplicativo)
                · ±{sensitivity!.config.variation_pp}pp (taxas)
                · {sensitivity!.bars.length} variáveis
                · {sensitivity!.elapsed_ms}ms
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant={hasSensitivity ? "outline" : "default"}
            className="gap-1.5"
            disabled={!scenarioId || runSensitivity.isPending}
            onClick={handleRun}
          >
            {runSensitivity.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {hasSensitivity ? "Recalcular" : "Rodar Sensibilidade"}
          </Button>
        </div>
      )}

      {runSensitivity.isError && (
        <Alert className="border-red-100 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-sm text-red-700">
            {(runSensitivity.error as Error)?.message ?? "Erro ao calcular sensibilidade"}
          </AlertDescription>
        </Alert>
      )}

      {/* Tornado Chart */}
      {hasSensitivity && (
        <>
          {/* Toggle VPL / TIR */}
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500 font-medium">Ordenar por:</p>
            {(["vpl", "tir_anual"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKpiView(k)}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${
                  kpiView === k
                    ? "bg-blue-100 text-blue-700 font-semibold"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {k === "vpl" ? "Impacto no VPL" : "Impacto na TIR"}
              </button>
            ))}
          </div>

          {/* Gráfico */}
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Sliders className="h-4 w-4 text-gray-400" />
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Tornado — {kpiView === "vpl" ? "Variação do VPL" : "Variação da TIR"}
              </p>
            </div>

            <ResponsiveContainer width="100%" height={Math.max(300, tornadoData.length * 44)}>
              <BarChart
                data={tornadoData}
                layout="vertical"
                margin={{ top: 5, right: 40, left: 140, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) =>
                    kpiView === "vpl" ? formatCurrency(v) : `${v.toFixed(1)}%`
                  }
                  fontSize={11}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={130}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: number) =>
                    kpiView === "vpl" ? formatCurrency(value) : `${value.toFixed(2)}%`
                  }
                  labelFormatter={(label: string) => label}
                />
                <ReferenceLine x={0} stroke="#6b7280" strokeWidth={1.5} />

                {/* Barra pessimista (delta_low) — parte do zero */}
                <Bar dataKey="deltaLow" name="Cenário Pessimista">
                  {tornadoData.map((entry, i) => (
                    <Cell
                      key={`low-${i}`}
                      fill={entry.deltaLow < 0 ? COLOR_NEGATIVE : COLOR_POSITIVE}
                    />
                  ))}
                </Bar>

                {/* Barra otimista (delta_high) — parte do zero */}
                <Bar dataKey="deltaHigh" name="Cenário Otimista">
                  {tornadoData.map((entry, i) => (
                    <Cell
                      key={`high-${i}`}
                      fill={entry.deltaHigh >= 0 ? COLOR_POSITIVE : COLOR_NEGATIVE}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabela detalhada */}
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
              <Sliders className="h-4 w-4 text-gray-400" />
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Detalhe por Variável
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["Variável", "Tipo", "Base", "Pessimista", "Otimista", "VPL Range", "TIR Range"].map(
                      (h) => (
                        <th key={h} className="text-left px-4 py-2 text-gray-500 font-medium text-xs">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sensitivity!.bars
                    .filter((b) => !b.skipped)
                    .sort((a, b) => b.vpl.impact_range - a.vpl.impact_range)
                    .map((bar) => (
                      <tr key={bar.variable} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-800 text-xs">{bar.label}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-500">
                            {bar.variation_type === "MULTIPLICATIVE"
                              ? "×%"
                              : bar.variation_type === "ADDITIVE_PP"
                              ? "±pp"
                              : "INT"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600 font-mono">
                          {bar.base_value.toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-red-600 font-mono">
                          {bar.low_value.toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-emerald-600 font-mono">
                          {bar.high_value.toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-mono">
                          {formatCurrency(bar.vpl.impact_range)}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-mono">
                          {formatPct(bar.tir_anual.impact_range)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Variáveis puladas */}
          {skippedBars.length > 0 && (
            <div className="rounded-xl border border-yellow-100 bg-yellow-50 p-4">
              <p className="text-xs font-semibold text-yellow-700 mb-2">
                Variáveis puladas ({skippedBars.length})
              </p>
              <div className="space-y-1">
                {skippedBars.map((b) => (
                  <p key={b.variable} className="text-xs text-yellow-600">
                    • <strong>{b.label}</strong>: {b.skip_reason ?? "variação insuficiente"}
                  </p>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Estado vazio — sem simulação */}
      {!financial?.is_calculated && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center py-14 gap-3">
          <Sliders className="h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500 font-medium">
            Primeiro, execute uma simulação financeira
          </p>
          <p className="text-xs text-gray-400 text-center max-w-xs">
            Clique em "Simular" no topo da página para calcular o cenário base.
            Depois, rode a sensibilidade aqui.
          </p>
        </div>
      )}

      {/* Simulação existe mas sensibilidade ainda não foi rodada */}
      {financial?.is_calculated && !hasSensitivity && !runSensitivity.isPending && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center py-14 gap-3">
          <Sliders className="h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500 font-medium">
            Análise de Sensibilidade ainda não foi calculada
          </p>
          <p className="text-xs text-gray-400 text-center max-w-xs">
            Clique em "Rodar Sensibilidade" acima para gerar o tornado chart com
            as 10 variáveis do cenário.
          </p>
        </div>
      )}
    </div>
  );
}
