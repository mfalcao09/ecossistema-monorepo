/**
 * Aba 4 — Comparação de Cenários
 *
 * 📚 CONCEITO PEDAGÓGICO
 * Todo projeto imobiliário tem incertezas: e se as vendas andarem mais devagar?
 * E se o custo da obra subir com a inflação? E se o preço de venda for menor?
 *
 * Por isso criamos 3 cenários simultâneos:
 *   • Conservador: premissas pessimistas (vendas lentas, custo alto, preço baixo)
 *   • Realista: expectativa mais provável (base de cálculo principal)
 *   • Otimista: tudo vai bem (vendas rápidas, custo dentro, preço bom)
 *
 * Ao comparar lado a lado, você responde a pergunta mais importante do
 * investidor: "No pior caso, ainda vale a pena?"
 *
 * Se o VPL do cenário conservador ainda for positivo, o projeto é robusto.
 * Se depender do cenário otimista para dar certo, o risco é alto.
 */

import { useParams } from "react-router-dom";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { ParcelamentoFinancial, FinancialScenarioType } from "@/lib/parcelamento/types";
import { useAllParcelamentoFinancials } from "@/hooks/useParcelamentoProjects";
import { Info, GitCompare, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface Props {
  financial: ParcelamentoFinancial | null | undefined;
}

const SCENARIO_CONFIG: Record<
  FinancialScenarioType,
  { label: string; color: string; badge: string; chartColor: string }
> = {
  conservador: {
    label: "Conservador",
    color: "border-red-200 bg-red-50",
    badge: "destructive",
    chartColor: "#ef4444",
  },
  realista: {
    label: "Realista (Base)",
    color: "border-blue-200 bg-blue-50",
    badge: "default",
    chartColor: "#3b82f6",
  },
  otimista: {
    label: "Otimista",
    color: "border-emerald-200 bg-emerald-50",
    badge: "secondary",
    chartColor: "#10b981",
  },
  custom: {
    label: "Personalizado",
    color: "border-purple-200 bg-purple-50",
    badge: "outline",
    chartColor: "#8b5cf6",
  },
};

function formatCurrency(value?: number | null): string {
  if (value == null) return "—";
  if (Math.abs(value) >= 1_000_000)
    return `R$ ${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000)
    return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${value.toFixed(0)}`;
}

function formatPct(value?: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

/** Ícone de tendência comparativa */
function TrendIcon({ value, baseline, invert }: { value?: number | null; baseline?: number | null; invert?: boolean }) {
  if (value == null || baseline == null) return null;
  const diff = value - baseline;
  const isGood = invert ? diff < 0 : diff > 0;
  if (Math.abs(diff) < 0.01) return <Minus className="h-3 w-3 text-gray-400" />;
  if (isGood) return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  return <TrendingDown className="h-3 w-3 text-red-400" />;
}

function ScenarioCard({ scenario, baseline }: { scenario: ParcelamentoFinancial; baseline?: ParcelamentoFinancial }) {
  const tipo = scenario.scenario_type ?? "realista";
  const config = SCENARIO_CONFIG[tipo] ?? SCENARIO_CONFIG.realista;

  const custoTotal =
    (scenario.custo_obra_total ?? 0) +
    (scenario.custo_terreno ?? 0) +
    (scenario.custo_legalizacao ?? 0) +
    (scenario.custo_marketing ?? 0) +
    (scenario.custo_comissoes ?? 0);

  const margemPct =
    scenario.vgv_total && custoTotal > 0
      ? ((scenario.vgv_total - custoTotal) / scenario.vgv_total) * 100
      : null;

  const isBaseline = scenario.id === baseline?.id;

  const rows = [
    { label: "VGV Total", value: formatCurrency(scenario.vgv_total), raw: scenario.vgv_total, baseRaw: baseline?.vgv_total },
    { label: "Custo Total", value: formatCurrency(custoTotal > 0 ? custoTotal : null), raw: custoTotal, baseRaw: null, invert: true },
    { label: "Margem Bruta", value: margemPct != null ? `${margemPct.toFixed(1)}%` : "—", raw: margemPct, baseRaw: null },
    { label: "VPL", value: formatCurrency(scenario.vpl), raw: scenario.vpl, baseRaw: baseline?.vpl },
    { label: "TIR Anual", value: formatPct(scenario.tir_anual), raw: scenario.tir_anual, baseRaw: baseline?.tir_anual },
    { label: "Payback", value: scenario.payback_meses != null ? `${scenario.payback_meses} meses` : "—", raw: scenario.payback_meses, baseRaw: baseline?.payback_meses, invert: true },
    { label: "WACC", value: formatPct(scenario.wacc_pct), raw: scenario.wacc_pct, baseRaw: baseline?.wacc_pct, invert: true },
    { label: "Score", value: scenario.performance_score != null ? `${Math.round(scenario.performance_score)}/100` : "—", raw: scenario.performance_score, baseRaw: baseline?.performance_score },
  ];

  return (
    <div className={`rounded-xl border-2 p-5 ${config.color}`}>
      <div className="flex items-center justify-between mb-4">
        <p className="font-semibold text-gray-800">{config.label}</p>
        <div className="flex items-center gap-2">
          {isBaseline && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">BASE</span>
          )}
          <Badge variant={config.badge as any}>{scenario.scenario_label ?? config.label}</Badge>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        {rows.map(({ label, value, raw, baseRaw, invert }) => (
          <div key={label} className="flex justify-between items-center">
            <span className="text-gray-500">{label}</span>
            <div className="flex items-center gap-1.5">
              {!isBaseline && <TrendIcon value={raw} baseline={baseRaw} invert={invert} />}
              <span className="font-medium text-gray-800">{value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TabComparacao({ financial }: Props) {
  const { id: developmentId } = useParams<{ id: string }>();
  const { data: allFinancials, isLoading } = useAllParcelamentoFinancials(developmentId ?? null);

  // Combina cenários do DB com o financial ativo (prop) para evitar lista vazia
  const scenarios = (() => {
    if (allFinancials && allFinancials.length > 0) return allFinancials;
    if (financial) return [financial];
    return [];
  })();

  // Cenário realista é a baseline de comparação
  const baseline = scenarios.find((s) => s.scenario_type === "realista") ?? scenarios[0];

  // Dados para radar chart (normaliza cada KPI de 0-100 para comparação visual)
  const radarData = scenarios.length > 1
    ? (() => {
        const maxVpl = Math.max(...scenarios.map((s) => Math.abs(s.vpl ?? 0)), 1);
        const maxTir = Math.max(...scenarios.map((s) => Math.abs(s.tir_anual ?? 0)), 1);
        const maxScore = 100;
        // Fix Buchecha: usar threshold absoluto (120m = 10 anos) em vez de relativo ao pior cenário
        const maxReasonablePayback = 120;

        const dimensions = [
          { key: "VPL", getter: (s: ParcelamentoFinancial) => ((s.vpl ?? 0) / maxVpl) * 100 },
          { key: "TIR", getter: (s: ParcelamentoFinancial) => ((s.tir_anual ?? 0) / maxTir) * 100 },
          { key: "Payback", getter: (s: ParcelamentoFinancial) => s.payback_meses != null ? Math.max(0, 100 - (s.payback_meses / maxReasonablePayback) * 100) : 0 },
          { key: "Score", getter: (s: ParcelamentoFinancial) => ((s.performance_score ?? 0) / maxScore) * 100 },
          { key: "Margem", getter: (s: ParcelamentoFinancial) => Math.min(100, Math.max(0, (s.margem_liquida_pct ?? 0) * 2)) },
        ];

        return dimensions.map((dim) => {
          const point: Record<string, string | number> = { dimension: dim.key };
          scenarios.forEach((s) => {
            const tipo = s.scenario_type ?? "realista";
            const config = SCENARIO_CONFIG[tipo] ?? SCENARIO_CONFIG.realista;
            point[config.label] = Math.round(dim.getter(s));
          });
          return point;
        });
      })()
    : [];

  return (
    <div className="p-6 space-y-6">
      {/* Bloco pedagógico */}
      <Alert className="border-blue-100 bg-blue-50">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-sm text-blue-800">
          <strong>Por que comparar cenários?</strong> As incertezas de um
          loteamento são altas — custo da obra, velocidade de vendas, taxa de
          juros, preço final. A comparação entre cenários <em>conservador</em>,{" "}
          <em>realista</em> e <em>otimista</em> responde a pergunta mais
          importante: "No pior caso, o projeto ainda é viável?"
        </AlertDescription>
      </Alert>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Cenários em cards */}
      {!isLoading && scenarios.length > 0 && (
        <div className={`grid grid-cols-1 gap-4 ${
          scenarios.length === 1 ? "md:grid-cols-1 max-w-md" :
          scenarios.length === 2 ? "md:grid-cols-2" :
          scenarios.length === 3 ? "md:grid-cols-3" :
          "md:grid-cols-2 xl:grid-cols-4"
        }`}>
          {scenarios.map((s) => (
            <ScenarioCard key={s.id} scenario={s} baseline={baseline} />
          ))}
        </div>
      )}

      {/* Aviso quando há apenas 1 cenário */}
      {!isLoading && scenarios.length === 1 && (
        <Alert className="border-amber-100 bg-amber-50">
          <Info className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-sm text-amber-800">
            Existe apenas o cenário <strong>realista</strong>. Para uma comparação
            completa, simule também os cenários <em>conservador</em> e{" "}
            <em>otimista</em> usando o botão "Novo cenário" no topo da página.
          </AlertDescription>
        </Alert>
      )}

      {/* Radar Chart — só com 2+ cenários */}
      {!isLoading && scenarios.length > 1 && radarData.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Comparativo Visual — Radar de Desempenho
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: "#6b7280" }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: "#9ca3af" }} />
              {scenarios.map((s) => {
                const tipo = s.scenario_type ?? "realista";
                const config = SCENARIO_CONFIG[tipo] ?? SCENARIO_CONFIG.realista;
                return (
                  <Radar
                    key={s.id}
                    name={config.label}
                    dataKey={config.label}
                    stroke={config.chartColor}
                    fill={config.chartColor}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                );
              })}
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabela comparativa resumida */}
      {!isLoading && scenarios.length > 1 && (
        <div className="rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Resumo Comparativo
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium text-xs">Indicador</th>
                  {scenarios.map((s) => (
                    <th key={s.id} className="text-right px-4 py-2 text-gray-500 font-medium text-xs">
                      {SCENARIO_CONFIG[s.scenario_type ?? "realista"]?.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "VGV Total", fmt: (s: ParcelamentoFinancial) => formatCurrency(s.vgv_total) },
                  { label: "VPL", fmt: (s: ParcelamentoFinancial) => formatCurrency(s.vpl) },
                  { label: "VPL@WACC", fmt: (s: ParcelamentoFinancial) => formatCurrency(s.vpl_wacc) },
                  { label: "TIR Anual", fmt: (s: ParcelamentoFinancial) => formatPct(s.tir_anual) },
                  { label: "WACC", fmt: (s: ParcelamentoFinancial) => formatPct(s.wacc_pct) },
                  { label: "Payback", fmt: (s: ParcelamentoFinancial) => s.payback_meses != null ? `${s.payback_meses} m` : "—" },
                  { label: "Margem Líquida", fmt: (s: ParcelamentoFinancial) => formatPct(s.margem_liquida_pct) },
                  { label: "Performance Score", fmt: (s: ParcelamentoFinancial) => s.performance_score != null ? `${Math.round(s.performance_score)}/100` : "—" },
                ].map(({ label, fmt }) => (
                  <tr key={label} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-600">{label}</td>
                    {scenarios.map((s) => (
                      <td key={s.id} className="px-4 py-2 text-right font-medium text-gray-800 font-mono text-xs">
                        {fmt(s)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Conclusão automática */}
      {!isLoading && scenarios.length > 1 && (() => {
        const conservador = scenarios.find((s) => s.scenario_type === "conservador");
        if (!conservador) return null;
        const vplPositivo = (conservador.vpl ?? 0) > 0;
        return (
          <div className={`rounded-xl border-2 p-4 ${vplPositivo ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
            <p className={`text-sm font-semibold ${vplPositivo ? "text-emerald-800" : "text-red-800"}`}>
              {vplPositivo
                ? "✅ Projeto robusto — VPL positivo mesmo no cenário conservador"
                : "⚠️ Atenção — VPL negativo no cenário conservador, revise as premissas"}
            </p>
            <p className={`text-xs mt-1 ${vplPositivo ? "text-emerald-600" : "text-red-600"}`}>
              VPL conservador: {formatCurrency(conservador.vpl)} · TIR: {formatPct(conservador.tir_anual)}
            </p>
          </div>
        );
      })()}

      {/* Empty state */}
      {!isLoading && scenarios.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center py-16 gap-3">
          <GitCompare className="h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-400 font-medium">
            Nenhum cenário simulado ainda
          </p>
          <p className="text-xs text-gray-300">
            Simule ao menos o cenário realista para ativar a comparação
          </p>
        </div>
      )}
    </div>
  );
}
