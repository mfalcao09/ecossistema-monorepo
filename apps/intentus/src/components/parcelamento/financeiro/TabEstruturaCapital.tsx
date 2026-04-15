/**
 * Aba 7 — Estrutura de Capital
 *
 * 📚 CONCEITO PEDAGÓGICO
 * "Estrutura de Capital" é como o projeto vai ser financiado — de onde vem
 * o dinheiro para executar o empreendimento. As principais fontes são:
 *
 *   1. Capital Próprio (Equity — E)
 *      Dinheiro do incorporador / sócios. Não tem custo de juros, mas
 *      tem custo de oportunidade (o dinheiro poderia estar em outro investimento).
 *
 *   2. Dívida Bancária (Debt — D)
 *      Crédito imobiliário, CRI, financiamento de obra. Tem custo explícito
 *      (taxa de juros), mas permite alavancar o projeto.
 *
 *   3. SCP — Sociedade em Conta de Participação
 *      Investidores-sócios sem criar empresa nova. Comum em loteamentos.
 *
 * O WACC (Weighted Average Cost of Capital) é o custo médio ponderado dessas
 * fontes. Fórmula: WACC = (E/V × Re) + (D/V × Rd × (1-Tc))
 *
 * Consome dados de: premissas do cenário (equity_pct, divida_pct, custo_divida_anual_pct)
 * + KPIs calculados (wacc_pct, vpl, vpl_wacc)
 */

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import type { ParcelamentoFinancial } from "@/lib/parcelamento/types";
import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Props {
  financial: ParcelamentoFinancial | null | undefined;
}

function formatPct(value?: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

function formatCurrency(value?: number | null): string {
  if (value == null) return "—";
  if (Math.abs(value) >= 1_000_000)
    return `R$ ${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000)
    return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${value.toFixed(0)}`;
}

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#6b7280"]; // blue, purple, gray

export function TabEstruturaCapital({ financial }: Props) {
  const hasData = financial != null && financial.is_calculated;

  // Extrair dados do capital_structure (jsonb) ou das premissas
  const premissas = financial?.premissas as Record<string, number | undefined> | null;
  const capitalStructure = financial?.capital_structure as Record<string, number | undefined> | null;

  const equityPct = capitalStructure?.equity_pct ?? premissas?.equity_pct ?? null;
  const debtPct = capitalStructure?.divida_pct ?? premissas?.divida_pct ?? null;
  const custoDividaPct = capitalStructure?.custo_divida_anual_pct ?? premissas?.custo_divida_anual_pct ?? null;
  const waccPct = financial?.wacc_pct;
  const vpl = financial?.vpl;
  const vplWacc = financial?.vpl_wacc;
  const aliquotaIr = premissas?.aliquota_ir_pct ?? null;

  // Dados para o gráfico de pizza
  const pieData = [
    { name: "Equity", value: equityPct ?? 0 },
    { name: "Dívida", value: debtPct ?? 0 },
  ].filter((d) => d.value > 0);

  const totalInvestimento =
    (financial?.custo_obra_total ?? 0) +
    (financial?.custo_terreno ?? 0) +
    (financial?.custo_legalizacao ?? 0) +
    (financial?.custo_marketing ?? 0) +
    (financial?.custo_comissoes ?? 0);

  return (
    <div className="p-6 space-y-6">
      {/* Bloco pedagógico */}
      <Alert className="border-blue-100 bg-blue-50">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-sm text-blue-800">
          <strong>O que é a Estrutura de Capital?</strong> Define como o projeto
          será financiado: capital próprio (equity) vs. dívida bancária. O{" "}
          <em>WACC</em> mede o custo médio ponderado — o retorno mínimo que o
          projeto precisa gerar para remunerar todas as fontes de capital.
        </AlertDescription>
      </Alert>

      {hasData && equityPct != null && debtPct != null ? (
        <>
          {/* Fontes de Capital — dados reais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-semibold text-gray-600 mb-1">Capital Próprio (Equity)</p>
              <p className="text-2xl font-bold text-gray-800">{formatPct(equityPct)}</p>
              {totalInvestimento > 0 && (
                <p className="text-sm text-gray-600 mt-1">
                  {formatCurrency(totalInvestimento * (equityPct / 100))}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">Recursos do incorporador e sócios</p>
              <p className="text-xs text-gray-400 mt-0.5">Custo de oportunidade: ~15% a.a.</p>
            </div>

            <div className="rounded-xl border-2 border-purple-200 bg-purple-50 p-4">
              <p className="text-xs font-semibold text-gray-600 mb-1">Dívida Bancária (Debt)</p>
              <p className="text-2xl font-bold text-gray-800">{formatPct(debtPct)}</p>
              {totalInvestimento > 0 && (
                <p className="text-sm text-gray-600 mt-1">
                  {formatCurrency(totalInvestimento * (debtPct / 100))}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">Crédito imobiliário, CRI, financiamento</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Custo: {custoDividaPct != null ? `${custoDividaPct.toFixed(1)}% a.a.` : "—"}
              </p>
            </div>

            <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold text-gray-600 mb-1">SCP — Sócios Investidores</p>
              <p className="text-2xl font-bold text-gray-800">0%</p>
              <p className="text-xs text-gray-500 mt-1">Sociedade em Conta de Participação</p>
              <p className="text-xs text-gray-400 mt-0.5">Não configurado neste cenário</p>
            </div>
          </div>

          {/* WACC calculado */}
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
              WACC — Custo Médio Ponderado de Capital
            </p>
            <div className="flex items-center gap-6">
              <div className="text-center min-w-[80px]">
                <p className={`text-3xl font-bold ${waccPct != null ? "text-gray-800" : "text-gray-300"}`}>
                  {waccPct != null ? `${waccPct.toFixed(1)}%` : "—"}
                </p>
                <p className="text-xs text-gray-400 mt-1">ao ano</p>
              </div>
              <div className="flex-1 text-sm text-gray-500 space-y-1">
                {waccPct != null ? (
                  <>
                    <p>
                      O projeto precisa render pelo menos{" "}
                      <strong className="text-gray-700">{waccPct.toFixed(1)}% a.a.</strong>{" "}
                      para cobrir o custo de todas as fontes.
                    </p>
                    {vplWacc != null && (
                      <p className="text-xs">
                        VPL@WACC:{" "}
                        <strong className={vplWacc >= 0 ? "text-emerald-600" : "text-red-500"}>
                          {formatCurrency(vplWacc)}
                        </strong>
                        {vplWacc >= 0
                          ? " — o projeto gera valor acima do custo de capital"
                          : " — o projeto NÃO cobre o custo de capital"}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-gray-400">WACC será calculado pela simulação.</p>
                )}
              </div>
            </div>

            {/* Fórmula visual com valores reais */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg font-mono text-xs text-gray-600">
              WACC = (E/V × Re) + (D/V × Rd × (1 − Tc))
              {equityPct != null && debtPct != null && custoDividaPct != null && (
                <>
                  <br />
                  = ({equityPct}% × 15%) + ({debtPct}% × {custoDividaPct}% × (1 − {aliquotaIr ?? 15}%))
                  {waccPct != null && (
                    <>
                      <br />
                      = <strong className="text-gray-800">{waccPct.toFixed(2)}% a.a.</strong>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Gráfico de Pizza — Recharts */}
          {pieData.length > 0 && (
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
                Composição da Estrutura de Capital
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, value }: { name: string; value: number }) =>
                      `${name}: ${value}%`
                    }
                    labelLine={true}
                  >
                    {pieData.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value}%${
                        totalInvestimento > 0
                          ? ` (${formatCurrency(totalInvestimento * (value / 100))})`
                          : ""
                      }`,
                      name,
                    ]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Comparação VPL vs VPL@WACC */}
          {vpl != null && vplWacc != null && (
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Impacto do Custo de Capital no VPL
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500 mb-1">VPL (taxa de desconto)</p>
                  <p className={`text-xl font-bold ${vpl >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {formatCurrency(vpl)}
                  </p>
                </div>
                <div className="text-center p-4 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500 mb-1">VPL@WACC (custo de capital)</p>
                  <p className={`text-xl font-bold ${vplWacc >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {formatCurrency(vplWacc)}
                  </p>
                </div>
              </div>
              {vpl > 0 && vplWacc < 0 && (
                <p className="text-xs text-amber-600 mt-3 text-center">
                  ⚠ O projeto é viável pela taxa de desconto, mas NÃO cobre o WACC.
                  Considere aumentar o equity ou negociar taxa de dívida menor.
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        /* Estado vazio */
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center py-14 gap-3">
          <Info className="h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500 font-medium">
            Execute uma simulação para ver a estrutura de capital
          </p>
          <p className="text-xs text-gray-400 text-center max-w-xs">
            As premissas de equity, dívida e WACC serão exibidas aqui após a
            simulação financeira.
          </p>
        </div>
      )}
    </div>
  );
}
