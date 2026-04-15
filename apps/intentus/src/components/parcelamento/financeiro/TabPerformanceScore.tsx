/**
 * Aba 6 — Performance Score (0-100)
 *
 * 📚 CONCEITO PEDAGÓGICO
 * O Performance Score é um "placar geral" do projeto — de 0 a 100 —
 * calculado combinando 4 dimensões de análise:
 *
 *   1. Rentabilidade (40% do score)
 *      Quão boa é a margem? A TIR supera a TMA (taxa mínima de atratividade)?
 *      VPL positivo? Quanto maior a margem líquida, maior o score nesta dimensão.
 *
 *   2. Liquidez (25% do score)
 *      O projeto consegue se auto-financiar? O pior saldo acumulado é
 *      administrável? Projetos que dependem de muito capital de terceiros
 *      pontuam menos aqui.
 *
 *   3. Prazo e Velocidade (20% do score)
 *      O payback é razoável para o mercado? As vendas projetadas são
 *      compatíveis com a velocidade de absorção do mercado local?
 *
 *   4. Margem de Segurança (15% do score)
 *      Quanto o projeto aguenta de "desvio" antes de ficar inviável?
 *      Projetos com break-even acima de 70% das unidades têm pouca margem.
 *
 * Classificação:
 *   ≥ 75 — Excelente (verde) — investimento robusto
 *   50-74 — Bom (azul) — projeto viável com atenção a riscos
 *   30-49 — Regular (amarelo) — revisar premissas antes de avançar
 *   < 30 — Fraco (vermelho) — risco elevado
 */

import { ParcelamentoFinancial } from "@/lib/parcelamento/types";
import { useParcelamentoCashFlowRows } from "@/hooks/useSimularFinanceiro";
import { Info, Award, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Props {
  financial: ParcelamentoFinancial | null | undefined;
}

interface Dimension {
  label: string;
  score: number | null;
  peso: number;
  descricao: string;
  detalhe?: string;
}

// ---------------------------------------------------------------------------
// Cálculo das 4 dimensões — client-side, usando dados já disponíveis
// ---------------------------------------------------------------------------

/**
 * Rentabilidade (0-100) — peso 40%
 * Combina: margem_liquida_pct (40pts), TIR vs TMA (35pts), VPL positivo (25pts)
 */
function calcRentabilidade(f: ParcelamentoFinancial): { score: number; detalhe: string } {
  let score = 0;
  const parts: string[] = [];

  // Sub1: Margem Líquida (0-40pts)
  // Benchmark: <10% fraco, 15% ok, 20% bom, 30%+ excelente
  const margem = f.margem_liquida_pct ?? 0;
  const margemPts = Math.min(40, Math.max(0, (margem / 30) * 40));
  score += margemPts;
  parts.push(`Margem ${margem.toFixed(1)}% → ${margemPts.toFixed(0)}pts`);

  // Sub2: TIR vs TMA (0-35pts) — TMA assumida = taxa_desconto (geralmente 15%)
  // Se TIR >= 2× TMA → 35pts, TIR >= TMA → 25pts, TIR >= 0.5×TMA → 15pts
  const tir = f.tir_anual ?? 0;
  const tma = 15; // benchmark mercado BR (SELIC+spread)
  let tirPts = 0;
  if (tir >= tma * 2) tirPts = 35;
  else if (tir >= tma * 1.5) tirPts = 30;
  else if (tir >= tma) tirPts = 25;
  else if (tir >= tma * 0.5) tirPts = 15;
  else if (tir > 0) tirPts = 8;
  score += tirPts;
  parts.push(`TIR ${tir.toFixed(1)}% vs TMA ${tma}% → ${tirPts}pts`);

  // Sub3: VPL positivo (0-25pts)
  // Fix Buchecha: fórmula anterior dava 15pts para VPL=-200k (inconsistente).
  // Nova: escala linear de 0 a 12pts para VPL negativo até -500k, 0pts abaixo disso.
  const vpl = f.vpl ?? 0;
  const vplPts = vpl > 0 ? 25 : vpl === 0 ? 12 : Math.max(0, 12 + (vpl / 500_000) * 12);
  score += Math.min(25, Math.max(0, vplPts));
  parts.push(`VPL ${vpl > 0 ? "positivo" : "negativo"} → ${Math.min(25, Math.max(0, vplPts)).toFixed(0)}pts`);

  return { score: Math.round(Math.min(100, score)), detalhe: parts.join(" · ") };
}

/**
 * Liquidez (0-100) — peso 25%
 * Usa WACC e payback descontado como proxy de auto-financiamento.
 * Se houver dados de cash flow, considera a exposição máxima de caixa.
 */
function calcLiquidez(f: ParcelamentoFinancial, minSaldo?: number): { score: number; detalhe: string } {
  let score = 0;
  const parts: string[] = [];

  // Sub1: WACC (custo de capital) — WACC baixo = boa liquidez (0-40pts)
  const wacc = f.wacc_pct ?? 15;
  const waccPts = Math.min(40, Math.max(0, 40 - (wacc / 25) * 40));
  score += waccPts;
  parts.push(`WACC ${wacc.toFixed(1)}% → ${waccPts.toFixed(0)}pts`);

  // Sub2: Payback descontado vs prazo (0-35pts)
  const paybackDesc = f.payback_descontado_meses ?? f.payback_meses;
  if (paybackDesc != null) {
    const pbPts = paybackDesc <= 24 ? 35 : paybackDesc <= 36 ? 28 : paybackDesc <= 48 ? 20 : paybackDesc <= 60 ? 12 : 5;
    score += pbPts;
    parts.push(`Payback desc. ${paybackDesc}m → ${pbPts}pts`);
  }

  // Sub3: Exposição de caixa (0-25pts) — se disponível via cash flow
  if (minSaldo != null && f.vgv_total && f.vgv_total > 0) {
    const exposicaoPct = Math.abs(Math.min(0, minSaldo)) / f.vgv_total * 100;
    const expPts = exposicaoPct <= 10 ? 25 : exposicaoPct <= 20 ? 20 : exposicaoPct <= 35 ? 14 : exposicaoPct <= 50 ? 8 : 3;
    score += expPts;
    parts.push(`Exposição ${exposicaoPct.toFixed(0)}% do VGV → ${expPts}pts`);
  } else {
    // Sem dados de cash flow, dá pontuação neutra
    score += 12;
    parts.push("Exposição caixa: dados insuficientes → 12pts");
  }

  return { score: Math.round(Math.min(100, score)), detalhe: parts.join(" · ") };
}

/**
 * Prazo e Velocidade (0-100) — peso 20%
 * Benchmark mercado BR: payback 24-36m bom, >60m fraco.
 */
function calcPrazo(f: ParcelamentoFinancial): { score: number; detalhe: string } {
  let score = 0;
  const parts: string[] = [];

  // Payback simples (0-60pts)
  const pb = f.payback_meses;
  if (pb != null) {
    const pbPts = pb <= 18 ? 60 : pb <= 24 ? 50 : pb <= 36 ? 40 : pb <= 48 ? 28 : pb <= 60 ? 18 : 8;
    score += pbPts;
    parts.push(`Payback ${pb}m → ${pbPts}pts`);
  }

  // Prazo de obra (0-40pts) — obras curtas são preferíveis
  const prazo = f.prazo_obra_meses;
  if (prazo != null) {
    const prazoPts = prazo <= 18 ? 40 : prazo <= 24 ? 32 : prazo <= 36 ? 24 : prazo <= 48 ? 16 : 8;
    score += prazoPts;
    parts.push(`Prazo obra ${prazo}m → ${prazoPts}pts`);
  } else {
    score += 20; // neutro
    parts.push("Prazo obra: não informado → 20pts");
  }

  return { score: Math.round(Math.min(100, score)), detalhe: parts.join(" · ") };
}

/**
 * Margem de Segurança (0-100) — peso 15%
 * Quanto o projeto aguenta de desvio.
 * Break-even < 50% = excelente segurança. > 70% = arriscado.
 */
function calcSeguranca(f: ParcelamentoFinancial): { score: number; detalhe: string } {
  let score = 0;
  const parts: string[] = [];

  // Sub1: Break-even implícito (custo/VGV) — (0-50pts)
  const vgv = f.vgv_total ?? 0;
  const custoTotal =
    (f.custo_obra_total ?? 0) +
    (f.custo_terreno ?? 0) +
    (f.custo_legalizacao ?? 0) +
    (f.custo_marketing ?? 0) +
    (f.custo_comissoes ?? 0);

  if (vgv > 0 && custoTotal > 0) {
    const bePct = (custoTotal / vgv) * 100;
    const bePts = bePct <= 35 ? 50 : bePct <= 50 ? 40 : bePct <= 65 ? 28 : bePct <= 80 ? 15 : 5;
    score += bePts;
    parts.push(`Break-even ${bePct.toFixed(0)}% do VGV → ${bePts}pts`);
  }

  // Sub2: TIR > WACC (0-30pts) — spread de segurança
  const tir = f.tir_anual ?? 0;
  const wacc = f.wacc_pct ?? 15;
  const spread = tir - wacc;
  const spreadPts = spread >= 15 ? 30 : spread >= 10 ? 25 : spread >= 5 ? 18 : spread >= 0 ? 10 : 3;
  score += spreadPts;
  parts.push(`Spread TIR-WACC ${spread.toFixed(1)}pp → ${spreadPts}pts`);

  // Sub3: VPL positivo como colchão (0-20pts)
  const vplPts = (f.vpl ?? 0) > 0 ? 20 : (f.vpl ?? 0) === 0 ? 10 : 3;
  score += vplPts;
  parts.push(`VPL ${(f.vpl ?? 0) > 0 ? "+" : "−"} → ${vplPts}pts`);

  return { score: Math.round(Math.min(100, score)), detalhe: parts.join(" · ") };
}

// ---------------------------------------------------------------------------
// Componentes visuais
// ---------------------------------------------------------------------------

function ScoreCircle({ score }: { score: number | null }) {
  const s = score ?? 0;
  const color =
    s >= 75
      ? "#10b981"
      : s >= 50
      ? "#3b82f6"
      : s >= 30
      ? "#f59e0b"
      : "#ef4444";

  const label =
    s >= 75
      ? "Excelente"
      : s >= 50
      ? "Bom"
      : s >= 30
      ? "Regular"
      : score == null
      ? "—"
      : "Fraco";

  const circumference = 2 * Math.PI * 54;
  const strokeDash = (s / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle
          cx="70" cy="70" r="54"
          fill="none" stroke="#f3f4f6" strokeWidth="12"
        />
        {score != null && (
          <circle
            cx="70" cy="70" r="54"
            fill="none" stroke={color} strokeWidth="12"
            strokeDasharray={`${strokeDash} ${circumference}`}
            strokeLinecap="round"
            transform="rotate(-90 70 70)"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        )}
        <text
          x="70" y="65" textAnchor="middle"
          fontSize="28" fontWeight="700"
          fill={score != null ? color : "#9ca3af"}
        >
          {score != null ? s : "—"}
        </text>
        <text x="70" y="85" textAnchor="middle" fontSize="11" fill="#6b7280">
          {label}
        </text>
      </svg>
    </div>
  );
}

function DimensionBar({ label, score, peso, descricao, detalhe }: Dimension) {
  const s = score ?? 0;
  const color =
    s >= 75
      ? "bg-emerald-500"
      : s >= 50
      ? "bg-blue-500"
      : s >= 30
      ? "bg-amber-400"
      : "bg-red-400";

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <div>
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className="text-xs text-gray-400 ml-2">({peso}% do score)</span>
        </div>
        <span className="text-sm font-bold text-gray-800">
          {score != null ? `${s}/100` : "—"}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        {score != null && (
          <div
            className={`h-full rounded-full ${color}`}
            style={{ width: `${s}%`, transition: "width 0.5s ease" }}
          />
        )}
      </div>
      <p className="text-xs text-gray-400 mt-1">{descricao}</p>
      {detalhe && (
        <p className="text-[10px] text-gray-300 mt-0.5 font-mono">{detalhe}</p>
      )}
    </div>
  );
}

/** Indicador inline de status */
function StatusIndicator({ score }: { score: number | null }) {
  if (score == null) return null;
  const s = score;
  const cfg =
    s >= 75 ? { icon: TrendingUp, color: "text-emerald-500", label: "Excelente" } :
    s >= 50 ? { icon: TrendingUp, color: "text-blue-500", label: "Bom" } :
    s >= 30 ? { icon: Minus, color: "text-amber-500", label: "Regular" } :
    { icon: TrendingDown, color: "text-red-500", label: "Fraco" };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function TabPerformanceScore({ financial }: Props) {
  const hasData = financial != null && financial.is_calculated;

  // Busca cash flow rows para calcular exposição máxima de caixa (dimensão Liquidez)
  const { data: cashFlowRows } = useParcelamentoCashFlowRows(financial?.id);
  const minSaldoAcumulado = cashFlowRows && cashFlowRows.length > 0
    ? Math.min(...cashFlowRows.map((r) => r.saldo_acumulado))
    : undefined;

  // Score global — usa o valor calculado pela EF (performance_score) se disponível
  const globalScore: number | null = hasData
    ? (financial.performance_score != null ? Math.round(financial.performance_score) : null)
    : null;

  // Calcula as 4 dimensões client-side usando os KPIs disponíveis
  const rentabilidade = hasData ? calcRentabilidade(financial) : null;
  const liquidez = hasData ? calcLiquidez(financial, minSaldoAcumulado) : null;
  const prazo = hasData ? calcPrazo(financial) : null;
  const seguranca = hasData ? calcSeguranca(financial) : null;

  // Score ponderado client-side (usado apenas se a EF não calculou)
  const clientScore = rentabilidade && liquidez && prazo && seguranca
    ? Math.round(
        rentabilidade.score * 0.4 +
        liquidez.score * 0.25 +
        prazo.score * 0.2 +
        seguranca.score * 0.15
      )
    : null;

  // Usa EF score se disponível, senão client-side
  const displayScore = globalScore ?? clientScore;

  const dimensions: Dimension[] = [
    {
      label: "Rentabilidade",
      score: rentabilidade?.score ?? null,
      peso: 40,
      descricao: "Margem líquida, TIR vs TMA, VPL positivo",
      detalhe: rentabilidade?.detalhe,
    },
    {
      label: "Liquidez",
      score: liquidez?.score ?? null,
      peso: 25,
      descricao: "Auto-financiamento, WACC, exposição máxima de caixa",
      detalhe: liquidez?.detalhe,
    },
    {
      label: "Prazo e Velocidade",
      score: prazo?.score ?? null,
      peso: 20,
      descricao: "Payback vs benchmark de mercado, prazo de obra",
      detalhe: prazo?.detalhe,
    },
    {
      label: "Margem de Segurança",
      score: seguranca?.score ?? null,
      peso: 15,
      descricao: "Break-even de custos, spread TIR-WACC, colchão de VPL",
      detalhe: seguranca?.detalhe,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Bloco pedagógico */}
      <Alert className="border-blue-100 bg-blue-50">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-sm text-blue-800">
          <strong>O que é o Performance Score?</strong> Um índice de 0 a 100
          calculado combinando 4 dimensões: Rentabilidade (40%),
          Liquidez (25%), Prazo e Velocidade (20%) e Margem de Segurança (15%).
          Permite comparar projetos diferentes em uma única nota.
        </AlertDescription>
      </Alert>

      {/* Score principal + dimensões */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Círculo */}
        <div className="flex flex-col items-center justify-center bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Score Geral
          </p>
          <ScoreCircle score={displayScore} />
          {displayScore != null && <StatusIndicator score={displayScore} />}
          {!hasData && (
            <p className="text-xs text-gray-300 text-center mt-3">
              Aguardando simulação financeira
            </p>
          )}
          {hasData && displayScore != null && globalScore == null && (
            <p className="text-[10px] text-gray-300 text-center mt-2">
              Calculado localmente (ponderação 40/25/20/15)
            </p>
          )}
        </div>

        {/* Dimensões */}
        <div className="md:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Dimensões
          </p>
          {dimensions.map((d) => (
            <DimensionBar key={d.label} {...d} />
          ))}
        </div>
      </div>

      {/* Resumo rápido dos KPIs que alimentam o score */}
      {hasData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Margem Líquida", value: financial.margem_liquida_pct != null ? `${financial.margem_liquida_pct.toFixed(1)}%` : "—", ok: (financial.margem_liquida_pct ?? 0) >= 15 },
            { label: "TIR Anual", value: financial.tir_anual != null ? `${financial.tir_anual.toFixed(1)}%` : "—", ok: (financial.tir_anual ?? 0) >= 15 },
            { label: "Payback", value: financial.payback_meses != null ? `${financial.payback_meses} meses` : "—", ok: (financial.payback_meses ?? 99) <= 36 },
            { label: "WACC", value: financial.wacc_pct != null ? `${financial.wacc_pct.toFixed(1)}%` : "—", ok: (financial.wacc_pct ?? 99) <= 18 },
          ].map(({ label, value, ok }) => (
            <div key={label} className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
              <p className="text-xs text-gray-500">{label}</p>
              <p className={`text-base font-semibold mt-0.5 ${ok ? "text-emerald-600" : "text-gray-800"}`}>
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Benchmarks do mercado */}
      <div className="rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
          <Award className="h-4 w-4 text-gray-400" />
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Benchmarks de Mercado (ABRAINC / SECOVI)
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Indicador", "Mínimo Aceitável", "Bom", "Excelente", "Seu Projeto"].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-2 text-gray-500 font-medium text-xs"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              {
                label: "Margem Líquida",
                min: "≥ 15%",
                bom: "≥ 20%",
                excelente: "≥ 30%",
                atual: financial?.margem_liquida_pct != null ? `${financial.margem_liquida_pct.toFixed(1)}%` : "—",
                ok: (financial?.margem_liquida_pct ?? 0) >= 15,
              },
              {
                label: "TIR Anual",
                min: "≥ SELIC + 2%",
                bom: "≥ SELIC + 5%",
                excelente: "≥ SELIC + 10%",
                atual: financial?.tir_anual != null ? `${financial.tir_anual.toFixed(1)}%` : "—",
                ok: (financial?.tir_anual ?? 0) >= 15,
              },
              {
                label: "Payback",
                min: "≤ 5 anos",
                bom: "≤ 3 anos",
                excelente: "≤ 2 anos",
                atual: financial?.payback_meses != null ? `${financial.payback_meses} meses` : "—",
                ok: (financial?.payback_meses ?? 999) <= 60,
              },
              {
                label: "Break-Even",
                min: "≤ 65% do VGV",
                bom: "≤ 50%",
                excelente: "≤ 35%",
                atual: (() => {
                  if (!financial?.vgv_total) return "—";
                  const custo = (financial.custo_obra_total ?? 0) + (financial.custo_terreno ?? 0) +
                    (financial.custo_legalizacao ?? 0) + (financial.custo_marketing ?? 0) + (financial.custo_comissoes ?? 0);
                  return custo > 0 ? `${((custo / financial.vgv_total) * 100).toFixed(0)}%` : "—";
                })(),
                ok: (() => {
                  if (!financial?.vgv_total) return false;
                  const custo = (financial.custo_obra_total ?? 0) + (financial.custo_terreno ?? 0) +
                    (financial.custo_legalizacao ?? 0) + (financial.custo_marketing ?? 0) + (financial.custo_comissoes ?? 0);
                  return custo > 0 && (custo / financial.vgv_total) <= 0.65;
                })(),
              },
            ].map(({ label, min, bom, excelente, atual, ok }) => (
              <tr key={label} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-700">{label}</td>
                <td className="px-4 py-2.5 text-red-400 text-xs">{min}</td>
                <td className="px-4 py-2.5 text-blue-500 text-xs">{bom}</td>
                <td className="px-4 py-2.5 text-emerald-600 text-xs font-medium">{excelente}</td>
                <td className={`px-4 py-2.5 text-xs font-semibold ${ok ? "text-emerald-600" : "text-gray-800"}`}>
                  {atual}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
