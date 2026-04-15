/**
 * ParcelamentoFIICRA — Bloco H Sprint 5
 *
 * Tab de simulação FII (Fundo de Investimento Imobiliário) e
 * CRI/CRA (Certificados de Recebíveis Imobiliários/Agrícolas).
 *
 * Sessão 145 — Bloco H Sprint 5 (US-134/135)
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { useState, useCallback } from "react";
import {
  Building2,
  TrendingUp,
  Scale,
  Loader2,
  AlertCircle,
  BarChart3,
  Landmark,
  ArrowRightLeft,
  History,
} from "lucide-react";
import { useSimulateFii, useSimulateCriCra, useCompareStructures, useListSimulations } from "@/hooks/useFiiCra";
import {
  STRUCTURE_TYPE_LABELS,
  STRUCTURE_TYPE_COLORS,
} from "@/lib/parcelamento/fii-cra-types";
import type {
  SimulateFiiResult,
  SimulateCriCraResult,
  CompareStructuresResult,
  ListSimulationsResult,
} from "@/lib/parcelamento/fii-cra-types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  project: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCurrency(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPct(n: number): string {
  return `${fmt(n, 2)}%`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ParcelamentoFIICRA({ project }: Props) {
  const developmentId = (project?.id as string) || "";

  // Active sub-tab
  const [activeMode, setActiveMode] = useState<"fii" | "cri-cra" | "compare" | "history">("fii");

  // FII form state
  const [fiiForm, setFiiForm] = useState({
    vgv_total: 50000000,
    monthly_revenue: 400000,
    vacancy_rate: 5,
    admin_fee_pct: 0.25,
    management_fee_pct: 1.0,
    num_quotas: 50000,
    expected_yield_annual: 10,
    projection_years: 10,
  });

  // CRI/CRA form state
  const [craForm, setCraForm] = useState({
    total_receivables: 30000000,
    duration_months: 120,
    spread_over_cdi: 2.5,
    subordination_pct: 20,
    credit_enhancement: "subordination" as string,
    expected_default_rate: 3,
    cdi_rate: 13.75,
  });

  // Results
  const [fiiResult, setFiiResult] = useState<SimulateFiiResult | null>(null);
  const [craResult, setCraResult] = useState<SimulateCriCraResult | null>(null);
  const [compareResult, setCompareResult] = useState<CompareStructuresResult | null>(null);
  const [simulations, setSimulations] = useState<ListSimulationsResult | null>(null);

  // Mutations
  const fiiMut = useSimulateFii();
  const craMut = useSimulateCriCra();
  const compareMut = useCompareStructures();
  const listMut = useListSimulations();

  // Handlers
  const handleSimulateFii = useCallback(() => {
    fiiMut.mutate(
      { development_id: developmentId, ...fiiForm },
      { onSuccess: (data) => setFiiResult(data) },
    );
  }, [developmentId, fiiForm, fiiMut]);

  const handleSimulateCra = useCallback(() => {
    craMut.mutate(
      { development_id: developmentId, ...craForm },
      { onSuccess: (data) => setCraResult(data) },
    );
  }, [developmentId, craForm, craMut]);

  const handleCompare = useCallback(() => {
    compareMut.mutate(
      { development_id: developmentId, fii_params: fiiForm, cri_cra_params: craForm },
      { onSuccess: (data) => setCompareResult(data) },
    );
  }, [developmentId, fiiForm, craForm, compareMut]);

  const handleLoadHistory = useCallback(() => {
    listMut.mutate(
      { development_id: developmentId },
      { onSuccess: (data) => setSimulations(data) },
    );
  }, [developmentId, listMut]);

  // Sub-tab buttons
  const modes = [
    { key: "fii" as const, label: "Simular FII", icon: Building2 },
    { key: "cri-cra" as const, label: "Simular CRI/CRA", icon: Landmark },
    { key: "compare" as const, label: "Comparar", icon: ArrowRightLeft },
    { key: "history" as const, label: "Histórico", icon: History },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
          <TrendingUp className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Simulação FII / CRI-CRA</h3>
          <p className="text-sm text-gray-500">
            Simule a constituição de FII ou securitização de recebíveis (CRI/CRA) para este empreendimento
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b pb-2">
        {modes.map((m) => (
          <button
            key={m.key}
            onClick={() => {
              setActiveMode(m.key);
              if (m.key === "history") handleLoadHistory();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeMode === m.key
                ? "bg-purple-100 text-purple-700 font-medium"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <m.icon className="w-4 h-4" />
            {m.label}
          </button>
        ))}
      </div>

      {/* FII Simulation */}
      {activeMode === "fii" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">VGV Total (R$)</label>
              <input type="number" className="w-full border rounded px-3 py-2 text-sm"
                value={fiiForm.vgv_total} onChange={(e) => setFiiForm({ ...fiiForm, vgv_total: +e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Receita Mensal (R$)</label>
              <input type="number" className="w-full border rounded px-3 py-2 text-sm"
                value={fiiForm.monthly_revenue} onChange={(e) => setFiiForm({ ...fiiForm, monthly_revenue: +e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Vacância (%)</label>
              <input type="number" step="0.1" className="w-full border rounded px-3 py-2 text-sm"
                value={fiiForm.vacancy_rate} onChange={(e) => setFiiForm({ ...fiiForm, vacancy_rate: +e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nº de Cotas</label>
              <input type="number" className="w-full border rounded px-3 py-2 text-sm"
                value={fiiForm.num_quotas} onChange={(e) => setFiiForm({ ...fiiForm, num_quotas: +e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Taxa Admin (%)</label>
              <input type="number" step="0.01" className="w-full border rounded px-3 py-2 text-sm"
                value={fiiForm.admin_fee_pct} onChange={(e) => setFiiForm({ ...fiiForm, admin_fee_pct: +e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Taxa Gestão (%)</label>
              <input type="number" step="0.01" className="w-full border rounded px-3 py-2 text-sm"
                value={fiiForm.management_fee_pct} onChange={(e) => setFiiForm({ ...fiiForm, management_fee_pct: +e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Yield Esperado (% a.a.)</label>
              <input type="number" step="0.1" className="w-full border rounded px-3 py-2 text-sm"
                value={fiiForm.expected_yield_annual} onChange={(e) => setFiiForm({ ...fiiForm, expected_yield_annual: +e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Projeção (anos)</label>
              <input type="number" min="1" max="30" className="w-full border rounded px-3 py-2 text-sm"
                value={fiiForm.projection_years} onChange={(e) => setFiiForm({ ...fiiForm, projection_years: +e.target.value })} />
            </div>
          </div>
          <button onClick={handleSimulateFii} disabled={fiiMut.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
            {fiiMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
            Simular FII
          </button>

          {fiiMut.isError && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" /> {fiiMut.error?.message}
            </div>
          )}

          {fiiResult?.data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-purple-50 rounded-lg p-3">
                  <p className="text-xs text-purple-600">Valor da Cota</p>
                  <p className="text-lg font-bold text-purple-900">{fmtCurrency(fiiResult.data.quota_value)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-green-600">Distribuição Mensal/Cota</p>
                  <p className="text-lg font-bold text-green-900">{fmtCurrency(fiiResult.data.monthly_distribution_per_quota)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-600">Dividend Yield</p>
                  <p className="text-lg font-bold text-blue-900">{fmtPct(fiiResult.data.dividend_yield_annual)}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <p className="text-xs text-amber-600">TIR Projetada</p>
                  <p className="text-lg font-bold text-amber-900">{fmtPct(fiiResult.data.irr_projected)}</p>
                </div>
              </div>

              {fiiResult.data.projections && fiiResult.data.projections.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Ano</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Receita Bruta</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Receita Líquida</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Distribuição/Cota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fiiResult.data.projections.slice(0, 10).map((p: Record<string, number>, i: number) => (
                        <tr key={i} className={i % 2 ? "bg-gray-50/50" : ""}>
                          <td className="px-3 py-2 font-medium">{p.year || i + 1}</td>
                          <td className="px-3 py-2 text-right">{fmtCurrency(p.gross_revenue || 0)}</td>
                          <td className="px-3 py-2 text-right">{fmtCurrency(p.net_revenue || 0)}</td>
                          <td className="px-3 py-2 text-right">{fmtCurrency(p.distribution_per_quota || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CRI/CRA Simulation */}
      {activeMode === "cri-cra" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Total Recebíveis (R$)</label>
              <input type="number" className="w-full border rounded px-3 py-2 text-sm"
                value={craForm.total_receivables} onChange={(e) => setCraForm({ ...craForm, total_receivables: +e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Prazo (meses)</label>
              <input type="number" className="w-full border rounded px-3 py-2 text-sm"
                value={craForm.duration_months} onChange={(e) => setCraForm({ ...craForm, duration_months: +e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Spread sobre CDI (%)</label>
              <input type="number" step="0.1" className="w-full border rounded px-3 py-2 text-sm"
                value={craForm.spread_over_cdi} onChange={(e) => setCraForm({ ...craForm, spread_over_cdi: +e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">CDI Atual (%)</label>
              <input type="number" step="0.01" className="w-full border rounded px-3 py-2 text-sm"
                value={craForm.cdi_rate} onChange={(e) => setCraForm({ ...craForm, cdi_rate: +e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Subordinação (%)</label>
              <input type="number" step="1" className="w-full border rounded px-3 py-2 text-sm"
                value={craForm.subordination_pct} onChange={(e) => setCraForm({ ...craForm, subordination_pct: +e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Default Esperado (%)</label>
              <input type="number" step="0.1" className="w-full border rounded px-3 py-2 text-sm"
                value={craForm.expected_default_rate} onChange={(e) => setCraForm({ ...craForm, expected_default_rate: +e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Reforço de Crédito</label>
              <select className="w-full border rounded px-3 py-2 text-sm"
                value={craForm.credit_enhancement} onChange={(e) => setCraForm({ ...craForm, credit_enhancement: e.target.value })}>
                <option value="subordination">Subordinação</option>
                <option value="overcollateral">Sobrecolateralização</option>
                <option value="reserve_fund">Fundo de Reserva</option>
                <option value="fianca">Fiança Bancária</option>
              </select>
            </div>
          </div>
          <button onClick={handleSimulateCra} disabled={craMut.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
            {craMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Landmark className="w-4 h-4" />}
            Simular CRI/CRA
          </button>

          {craMut.isError && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" /> {craMut.error?.message}
            </div>
          )}

          {craResult?.data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-indigo-50 rounded-lg p-3">
                  <p className="text-xs text-indigo-600">Tranche Sênior</p>
                  <p className="text-lg font-bold text-indigo-900">{fmtCurrency(craResult.data.senior_tranche_value)}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <p className="text-xs text-amber-600">Tranche Subordinada</p>
                  <p className="text-lg font-bold text-amber-900">{fmtCurrency(craResult.data.subordinated_tranche_value)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-green-600">WAL (anos)</p>
                  <p className="text-lg font-bold text-green-900">{fmt(craResult.data.wal_years)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-600">Taxa Efetiva (% a.a.)</p>
                  <p className="text-lg font-bold text-blue-900">{fmtPct(craResult.data.effective_rate_annual)}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Custo Total de Juros</h4>
                <p className="text-2xl font-bold text-gray-900">{fmtCurrency(craResult.data.total_interest_cost)}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Compare */}
      {activeMode === "compare" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Compare a constituição de FII vs securitização CRI/CRA usando os parâmetros configurados nas abas anteriores.
          </p>
          <button onClick={handleCompare} disabled={compareMut.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50">
            {compareMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
            Comparar Estruturas
          </button>

          {compareMut.isError && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" /> {compareMut.error?.message}
            </div>
          )}

          {compareResult?.data && (
            <div className="space-y-4">
              <div className="bg-teal-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-teal-800 mb-1">Recomendação</h4>
                <p className="text-sm text-teal-700">{compareResult.data.recommendation}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="w-4 h-4 text-purple-600" />
                    <h4 className="font-medium text-purple-900">FII</h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">TIR</span><span className="font-medium">{fmtPct(compareResult.data.fii_irr || 0)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Dividend Yield</span><span className="font-medium">{fmtPct(compareResult.data.fii_dy || 0)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Liquidez</span><span className="font-medium">{compareResult.data.fii_liquidity || "Alta"}</span></div>
                  </div>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Landmark className="w-4 h-4 text-indigo-600" />
                    <h4 className="font-medium text-indigo-900">CRI/CRA</h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Taxa Efetiva</span><span className="font-medium">{fmtPct(compareResult.data.cra_rate || 0)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">WAL</span><span className="font-medium">{fmt(compareResult.data.cra_wal || 0)} anos</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Risco</span><span className="font-medium">{compareResult.data.cra_risk || "Médio"}</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {activeMode === "history" && (
        <div className="space-y-4">
          {listMut.isPending && (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando histórico...
            </div>
          )}

          {simulations?.data?.simulations && simulations.data.simulations.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Tipo</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Data</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Valor Principal</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {simulations.data.simulations.map((s: Record<string, unknown>, i: number) => (
                    <tr key={i} className={i % 2 ? "bg-gray-50/50" : ""}>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: STRUCTURE_TYPE_COLORS[String(s.type)] + "20",
                            color: STRUCTURE_TYPE_COLORS[String(s.type)],
                          }}>
                          {STRUCTURE_TYPE_LABELS[String(s.type)] || String(s.type)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-600">{new Date(String(s.created_at)).toLocaleDateString("pt-BR")}</td>
                      <td className="px-3 py-2 text-right font-medium">{fmtCurrency(Number(s.principal_value) || 0)}</td>
                      <td className="px-3 py-2 text-gray-500">{String(s.status || "completed")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !listMut.isPending && (
              <div className="text-center text-gray-400 py-8">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma simulação salva para este empreendimento.</p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
