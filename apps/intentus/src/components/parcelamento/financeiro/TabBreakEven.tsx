/**
 * Aba 3 — Break-Even (Ponto de Equilíbrio)
 *
 * 📚 CONCEITO PEDAGÓGICO
 * Break-Even é o "ponto de equilíbrio" — o momento em que as receitas cobrem
 * exatamente todos os custos. A partir daí, cada real vendido vira lucro.
 *
 * Dois tipos de break-even no contexto imobiliário:
 *
 * 1. Break-Even de Unidades:
 *    Quantas unidades precisam ser vendidas para cobrir todos os custos?
 *    Exemplo: loteamento com 200 lotes a R$ 80k cada e custos de R$ 8M
 *    → precisa vender 100 lotes para cobrir os custos (50% do empreendimento)
 *
 * 2. Break-Even de Caixa (no tempo):
 *    Em que mês o saldo acumulado cruza zero pela última vez?
 *    Esse é o "payback" — o mês em que o investimento é recuperado.
 *
 * Por que isso importa?
 * Um break-even de 40% significa que você pode vender apenas 40% do projeto
 * e já cobriu todos os custos. Esse "colchão" de segurança é muito valorizado
 * por investidores e bancos na análise de risco do projeto.
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { ParcelamentoFinancial } from "@/lib/parcelamento/types";
import { CashFlowChartEntry, useParcelamentoCashFlowRows } from "@/hooks/useSimularFinanceiro";
import { TrendingUp, Info, Activity, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Props {
  financial: ParcelamentoFinancial | null | undefined;
  totalUnits?: number | null;
}

function formatCurrency(value?: number | null): string {
  if (value == null) return "—";
  if (Math.abs(value) >= 1_000_000)
    return `R$ ${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000)
    return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${value.toFixed(0)}`;
}

function formatChartValue(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return `${value.toFixed(0)}`;
}

function calcBreakEvenUnidades(
  financial: ParcelamentoFinancial | null | undefined,
  totalUnits?: number | null
): { unidades: number | null; pct: number | null; precoMedio: number | null } {
  if (!financial?.vgv_total || !totalUnits)
    return { unidades: null, pct: null, precoMedio: null };

  const precoMedio = financial.vgv_total / totalUnits;
  const custoTotal =
    (financial.custo_obra_total ?? 0) +
    (financial.custo_terreno ?? 0) +
    (financial.custo_legalizacao ?? 0) +
    (financial.custo_marketing ?? 0) +
    (financial.custo_comissoes ?? 0);

  if (precoMedio === 0) return { unidades: null, pct: null, precoMedio: null };
  const unidades = Math.ceil(custoTotal / precoMedio);
  const pct = (unidades / totalUnits) * 100;
  return { unidades, pct, precoMedio };
}

// Tooltip customizado
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-2">Mês {label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium">R$ {formatChartValue(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function TabBreakEven({ financial, totalUnits }: Props) {
  const { data: chartData, isLoading: loadingRows } = useParcelamentoCashFlowRows(
    financial?.id
  );

  const hasRows = chartData && chartData.length > 0;

  // Calcula saldo acumulado de entradas e saídas separadamente para o gráfico
  const breakEvenData = hasRows
    ? (() => {
        let accEntradas = 0;
        let accSaidas = 0;
        return chartData.map((r) => {
          accEntradas += r.entradas;
          accSaidas += r.saidas;
          return {
            mes: r.mes,
            receita_acumulada: accEntradas,
            custo_acumulado: accSaidas,
            saldo_acumulado: r.saldo_acumulado,
          };
        });
      })()
    : [];

  // Mês do break-even de caixa (saldo_acumulado cruza 0)
  const paybackMesCalc = hasRows
    ? chartData.find((r) => r.saldo_acumulado >= 0)?.mes ?? null
    : null;

  const paybackMes = financial?.payback_meses ?? paybackMesCalc;

  const { unidades, pct, precoMedio } = calcBreakEvenUnidades(financial, totalUnits);
  const hasFinancial = financial != null;

  const displayData =
    breakEvenData.length > 36
      ? breakEvenData.filter((_, i) => i % 3 === 0)
      : breakEvenData;

  return (
    <div className="p-6 space-y-6">
      {/* Bloco pedagógico */}
      <Alert className="border-blue-100 bg-blue-50">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-sm text-blue-800">
          <strong>O que é o Break-Even?</strong> É o ponto em que as receitas
          cobrem todos os custos — a "virada" do projeto. O gráfico abaixo
          mostra a <em>Receita Acumulada</em> (verde) crescendo até cruzar o{" "}
          <em>Custo Acumulado</em> (vermelho). O cruzamento é o break-even de
          caixa (payback). A linha laranja é o saldo líquido acumulado.
        </AlertDescription>
      </Alert>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Break-Even de Unidades</p>
          <p className="text-xl font-bold text-gray-900">
            {unidades != null ? `${unidades} lotes` : "—"}
          </p>
          {pct != null && (
            <p className="text-xs text-gray-400 mt-1">{pct.toFixed(1)}% do total</p>
          )}
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Payback (Break-Even de Caixa)</p>
          <p className="text-xl font-bold text-gray-900">
            {paybackMes != null ? `Mês ${paybackMes}` : "—"}
          </p>
          {paybackMes != null && (
            <p className="text-xs text-gray-400 mt-1">
              {(paybackMes / 12).toFixed(1)} anos
            </p>
          )}
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Preço Médio por Lote</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(precoMedio)}</p>
          {precoMedio != null && (
            <p className="text-xs text-gray-400 mt-1">VGV ÷ Qtd. unidades</p>
          )}
        </div>
      </div>

      {/* Barra visual de break-even */}
      {pct != null && (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-600 mb-3">
            Colchão de Segurança (% de vendas acima do break-even)
          </p>
          <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                pct <= 40 ? "bg-emerald-500" : pct <= 65 ? "bg-yellow-400" : "bg-red-400"
              }`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1.5">
            <span>0% vendido</span>
            <span className={`font-semibold ${pct <= 40 ? "text-emerald-600" : pct <= 65 ? "text-yellow-600" : "text-red-500"}`}>
              Break-even em {pct.toFixed(1)}% das unidades{" "}
              {pct <= 40 ? "✅ Excelente" : pct <= 65 ? "⚠️ Moderado" : "🔴 Atenção"}
            </span>
            <span>100% vendido</span>
          </div>
        </div>
      )}

      {/* Gráfico de cruzamento recharts */}
      {loadingRows ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : hasRows ? (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Receita Acumulada × Custo Acumulado (ponto de cruzamento = break-even)
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCusto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickFormatter={(v) => `M${v}`}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickFormatter={(v) => formatChartValue(v)}
                width={52}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {paybackMes != null && (
                <ReferenceLine
                  x={paybackMes}
                  stroke="#f97316"
                  strokeDasharray="4 4"
                  label={{ value: `Payback M${paybackMes}`, fontSize: 10, fill: "#f97316", position: "top" }}
                />
              )}
              <Area
                type="monotone"
                dataKey="receita_acumulada"
                name="Receita Acumulada"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#colorReceita)"
              />
              <Area
                type="monotone"
                dataKey="custo_acumulado"
                name="Custo Acumulado"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#colorCusto)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : hasFinancial ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center py-14 gap-3">
          <Activity className="h-8 w-8 text-gray-400" />
          <p className="text-sm text-gray-500">Carregando linhas do fluxo de caixa…</p>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center py-14 gap-3">
          <TrendingUp className="h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-400 font-medium">Sem dados para calcular break-even</p>
          <p className="text-xs text-gray-300">Simule um cenário para ver o ponto de equilíbrio</p>
        </div>
      )}
    </div>
  );
}
