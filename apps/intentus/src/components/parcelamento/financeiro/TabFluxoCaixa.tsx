/**
 * Aba 1 — Fluxo de Caixa
 *
 * 📚 CONCEITO PEDAGÓGICO
 * O Fluxo de Caixa é o "extrato bancário do empreendimento no tempo".
 * Mês a mês, registra tudo que entra (vendas, liberações bancárias) e tudo
 * que sai (obra, taxas, comissões). O saldo acumulado mostra em que momento
 * o projeto precisará de mais dinheiro e quando começa a "devolver" o capital.
 *
 * Exemplo simples:
 *   Mês 1: entrada R$ 200k (sinal de vendas) — saída R$ 400k (terraplanagem)
 *          → saldo do mês: -R$ 200k | saldo acumulado: -R$ 200k
 *   Mês 6: entrada R$ 1,2M (liberação bancária) — saída R$ 600k (infraestrutura)
 *          → saldo do mês: +R$ 600k | saldo acumulado: -R$ 800k → melhorando!
 *
 * O VPL (Valor Presente Líquido) traz todo esse fluxo futuro para o valor de
 * hoje, descontando a taxa mínima de atratividade (TMA). Se VPL > 0, o
 * projeto gera valor acima do custo de oportunidade do dinheiro.
 */

import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  ReferenceLine,
} from "recharts";
import { ParcelamentoFinancial } from "@/lib/parcelamento/types";
import { CashFlowChartEntry, useParcelamentoCashFlowRows } from "@/hooks/useSimularFinanceiro";
import { TrendingUp, TrendingDown, BarChart3, Info, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Props {
  financial: ParcelamentoFinancial | null | undefined;
  projectName?: string;
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

function KpiCard({
  label,
  value,
  positive,
  sub,
}: {
  label: string;
  value: string;
  positive?: boolean;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p
        className={`text-lg font-semibold ${
          positive === undefined
            ? "text-gray-900"
            : positive
            ? "text-emerald-600"
            : "text-red-500"
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// Tooltip customizado para o gráfico
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

export function TabFluxoCaixa({ financial, projectName }: Props) {
  const { data: chartData, isLoading: loadingRows } = useParcelamentoCashFlowRows(
    financial?.id
  );

  const hasRows = chartData && chartData.length > 0;
  const hasFinancial = financial != null;

  // KPIs do header do financial
  const totalEntradas = hasRows
    ? chartData.reduce((a, r) => a + r.entradas, 0)
    : null;
  const totalSaidas = hasRows
    ? chartData.reduce((a, r) => a + r.saidas, 0)
    : null;
  const saldoFinal = hasRows ? chartData[chartData.length - 1]?.saldo_acumulado : null;
  const mesExposicaoMax = hasRows
    ? chartData.reduce(
        (min, r) => (r.saldo_acumulado < min.saldo_acumulado ? r : min),
        chartData[0]
      )
    : null;

  // Agrupamento para gráfico (a cada 3 meses se horizonte > 36 meses)
  const displayData: CashFlowChartEntry[] =
    hasRows && chartData.length > 36
      ? chartData.filter((_, i) => i % 3 === 0)
      : chartData ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Bloco pedagógico */}
      <Alert className="border-blue-100 bg-blue-50">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-sm text-blue-800">
          <strong>O que é o Fluxo de Caixa?</strong> É o "extrato bancário" do
          empreendimento — registra mês a mês tudo que entra (vendas, repasse
          bancário) e tudo que sai (obra, taxas, comissões). O{" "}
          <em>saldo acumulado</em> (linha laranja) mostra o momento de maior
          necessidade de capital ("pior mês") e quando o projeto começa a
          devolver o investimento.
        </AlertDescription>
      </Alert>

      {/* KPIs (só mostra se houver dados) */}
      {(hasFinancial || hasRows) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="VGV Líquido"
            value={formatCurrency(financial?.vgv_total)}
            positive={true}
          />
          <KpiCard
            label="VPL"
            value={formatCurrency(financial?.vpl)}
            positive={(financial?.vpl ?? 0) >= 0}
            sub={`TMA ${financial ? "15" : "—"}% a.a.`}
          />
          <KpiCard
            label="TIR Anual"
            value={financial?.tir_anual != null ? `${financial.tir_anual.toFixed(1)}%` : "—"}
            positive={(financial?.tir_anual ?? 0) >= 15}
          />
          <KpiCard
            label="Payback"
            value={
              financial?.payback_meses != null
                ? `${financial.payback_meses} meses`
                : "—"
            }
            sub={financial?.payback_meses ? `${(financial.payback_meses / 12).toFixed(1)} anos` : undefined}
          />
        </div>
      )}

      {/* Gráfico recharts */}
      {loadingRows ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : hasRows ? (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Fluxo de Caixa — Entradas × Saídas × Saldo Acumulado
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickFormatter={(v) => `M${v}`}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickFormatter={(v) => `${formatChartValue(v)}`}
                width={52}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              />
              <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1.5} />
              <Bar dataKey="entradas" name="Entradas" fill="#10b981" opacity={0.85} radius={[2, 2, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill="#ef4444" opacity={0.75} radius={[2, 2, 0, 0]} />
              <Line
                type="monotone"
                dataKey="saldo_acumulado"
                name="Saldo Acumulado"
                stroke="#f97316"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
          {chartData.length > 36 && (
            <p className="text-xs text-gray-400 text-center mt-2">
              * Agrupado a cada 3 meses para melhor visualização ({chartData.length} meses no total)
            </p>
          )}
        </div>
      ) : hasFinancial ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center py-16 gap-3">
          <BarChart3 className="h-8 w-8 text-gray-400" />
          <p className="text-sm text-gray-500 font-medium">Simulação calculada — carregando linhas do fluxo…</p>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center py-16 gap-3">
          <BarChart3 className="h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-400 font-medium">Sem simulação calculada</p>
          <p className="text-xs text-gray-300">
            Clique em "Simular" no header para calcular o fluxo de caixa
          </p>
        </div>
      )}

      {/* Tabela resumo */}
      {hasRows && (
        <div className="rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Resumo Mensal (primeiros 24 meses)
            </p>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                {["Mês", "Entradas", "Saídas", "Saldo do Mês", "Saldo Acumulado"].map((h) => (
                  <th key={h} className="text-left px-4 py-2 text-gray-500 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chartData.slice(0, 24).map((row) => (
                <tr key={row.mes} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-700">M{row.mes}</td>
                  <td className="px-4 py-2 text-emerald-600">{formatCurrency(row.entradas)}</td>
                  <td className="px-4 py-2 text-red-500">{formatCurrency(row.saidas)}</td>
                  <td className={`px-4 py-2 font-medium ${row.saldo >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    <span className="flex items-center gap-1">
                      {row.saldo >= 0
                        ? <TrendingUp className="h-3 w-3" />
                        : <TrendingDown className="h-3 w-3" />}
                      {formatCurrency(row.saldo)}
                    </span>
                  </td>
                  <td className={`px-4 py-2 font-semibold ${row.saldo_acumulado >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {formatCurrency(row.saldo_acumulado)}
                  </td>
                </tr>
              ))}
              {chartData.length > 24 && (
                <tr className="border-t border-gray-100">
                  <td colSpan={5} className="px-4 py-2 text-xs text-gray-400 text-center">
                    + {chartData.length - 24} meses adicionais
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Totais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-t border-gray-100 bg-gray-50">
            <div>
              <p className="text-xs text-gray-500">Total Entradas</p>
              <p className="text-sm font-semibold text-emerald-600">{formatCurrency(totalEntradas)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Saídas</p>
              <p className="text-sm font-semibold text-red-500">{formatCurrency(totalSaidas)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Saldo Final</p>
              <p className={`text-sm font-semibold ${(saldoFinal ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {formatCurrency(saldoFinal)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Pior Mês (Exposição)</p>
              <p className="text-sm font-semibold text-orange-500">
                {mesExposicaoMax ? `M${mesExposicaoMax.mes}: ${formatCurrency(mesExposicaoMax.saldo_acumulado)}` : "—"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
