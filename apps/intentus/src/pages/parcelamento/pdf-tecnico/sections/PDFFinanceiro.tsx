/**
 * PDFFinanceiro.tsx — Secao 3: Analise Financeira
 * Sessao 146 — Bloco K
 *
 * KPIs, fluxo de caixa (paginado), Monte Carlo, sensibilidade.
 */
import { View, Text } from "@react-pdf/renderer";
import { s, colors, hexToRgba } from "../pdfStyles";
import { formatBRL, formatBRLCompact, formatPct, formatNum, chunkArray } from "../pdfHelpers";
import type { ParcelamentoFinancial, ParcelamentoDevelopment } from "@/lib/parcelamento/types";

interface Props {
  project: ParcelamentoDevelopment;
  financial: ParcelamentoFinancial;
}

const CASH_FLOW_ROWS_PER_PAGE = 15;

export default function PDFFinanceiro({ project, financial }: Props) {
  const f = financial;

  return (
    <View>
      <Text style={s.sectionTitle}>3. Analise Financeira</Text>

      {/* KPI Grid */}
      <View style={s.kpiGrid}>
        <KpiCard label="VGV Estimado" value={formatBRL(project.vgv_estimado)} />
        <KpiCard label="VPL" value={formatBRL(f.vpl)} color={getVplColor(f.vpl)} />
        <KpiCard
          label="TIR Anual"
          value={formatPct(f.tir_anual)}
          sub={`WACC: ${formatPct(f.wacc_pct)}`}
          color={(f.tir_anual ?? 0) > (f.wacc_pct ?? 0) ? colors.accent : colors.danger}
        />
        <KpiCard label="Payback" value={f.payback_meses != null ? `${f.payback_meses} meses` : "N/D"} />
        <KpiCard label="Margem Liquida" value={formatPct(f.margem_liquida_pct)} />
        <KpiCard label="Custo Obra" value={formatBRL(f.custo_obra_total)} />
        <KpiCard label="Performance" value={f.performance_score != null ? `${f.performance_score.toFixed(0)}/100` : "N/D"} />
        <KpiCard label="Cenario" value={f.scenario_type ?? "realista"} />
      </View>

      {/* Custos detalhados */}
      <Text style={s.subSectionTitle}>Estrutura de Custos</Text>
      <View style={s.table}>
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCell, { width: "50%" }]}>Item</Text>
          <Text style={[s.tableHeaderCell, { width: "25%", textAlign: "right" }]}>Valor</Text>
          <Text style={[s.tableHeaderCell, { width: "25%", textAlign: "right" }]}>% VGV</Text>
        </View>
        <CostRow label="Custo de Obra" value={f.custo_obra_total} vgv={project.vgv_estimado} alt={false} />
        <CostRow label="Custo do Terreno" value={f.custo_terreno} vgv={project.vgv_estimado} alt />
        <CostRow label="Legalizacao" value={f.custo_legalizacao} vgv={project.vgv_estimado} alt={false} />
        <CostRow label="Marketing" value={f.custo_marketing} vgv={project.vgv_estimado} alt />
        <CostRow label="Comissoes" value={f.custo_comissoes} vgv={project.vgv_estimado} alt={false} />
      </View>

      {/* Fluxo de Caixa (paginado) */}
      {f.fluxo_caixa && f.fluxo_caixa.length > 0 && (
        <>
          <Text style={s.subSectionTitle}>Fluxo de Caixa Mensal</Text>
          {chunkArray(f.fluxo_caixa, CASH_FLOW_ROWS_PER_PAGE).map((chunk, ci) => (
            <View key={ci} wrap={false}>
              <View style={s.table}>
                <View style={s.tableHeader}>
                  <Text style={[s.tableHeaderCell, { width: "12%" }]}>Mes</Text>
                  <Text style={[s.tableHeaderCell, { width: "22%", textAlign: "right" }]}>Entrada</Text>
                  <Text style={[s.tableHeaderCell, { width: "22%", textAlign: "right" }]}>Saida</Text>
                  <Text style={[s.tableHeaderCell, { width: "22%", textAlign: "right" }]}>Saldo</Text>
                  <Text style={[s.tableHeaderCell, { width: "22%", textAlign: "right" }]}>Acumulado</Text>
                </View>
                {chunk.map((row, ri) => (
                  <View key={ri} style={ri % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                    <Text style={[s.tableCell, { width: "12%" }]}>{row.mes}</Text>
                    <Text style={[s.tableCell, { width: "22%", textAlign: "right" }]}>{formatBRLCompact(row.entrada)}</Text>
                    <Text style={[s.tableCell, { width: "22%", textAlign: "right", color: colors.danger }]}>{formatBRLCompact(row.saida)}</Text>
                    <Text style={[s.tableCell, { width: "22%", textAlign: "right", color: row.saldo >= 0 ? colors.accent : colors.danger }]}>{formatBRLCompact(row.saldo)}</Text>
                    <Text style={[s.tableCell, { width: "22%", textAlign: "right" }]}>{formatBRLCompact(row.saldo_acumulado)}</Text>
                  </View>
                ))}
              </View>
              {ci < chunkArray(f.fluxo_caixa!, CASH_FLOW_ROWS_PER_PAGE).length - 1 && (
                <Text style={{ fontSize: 7, color: colors.gray500, textAlign: "center", marginVertical: 4 }}>
                  Continua na proxima pagina...
                </Text>
              )}
            </View>
          ))}
        </>
      )}

      {/* Monte Carlo — resumo */}
      {f.monte_carlo && (
        <>
          <Text style={s.subSectionTitle}>Simulacao Monte Carlo</Text>
          <View style={s.alertInfo}>
            <Text style={s.alertText}>
              {f.monte_carlo.config.iterations.toLocaleString("pt-BR")} iteracoes |
              VGV +/-{f.monte_carlo.config.vgv_variation_pct}% |
              Custo +/-{f.monte_carlo.config.custo_variation_pct}% |
              Velocidade +/-{f.monte_carlo.config.velocidade_variation_pct}%
            </Text>
          </View>
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderCell, { width: "25%" }]}>KPI</Text>
              <Text style={[s.tableHeaderCell, { width: "15%", textAlign: "right" }]}>P5</Text>
              <Text style={[s.tableHeaderCell, { width: "15%", textAlign: "right" }]}>P50</Text>
              <Text style={[s.tableHeaderCell, { width: "15%", textAlign: "right" }]}>P95</Text>
              <Text style={[s.tableHeaderCell, { width: "15%", textAlign: "right" }]}>Media</Text>
              <Text style={[s.tableHeaderCell, { width: "15%", textAlign: "right" }]}>P(+)</Text>
            </View>
            <McRow label="VPL" stats={f.monte_carlo.vpl} fmt="brl" />
            <McRow label="TIR Anual" stats={f.monte_carlo.tir_anual} fmt="pct" alt />
            <McRow
              label="Margem Liq."
              stats={f.monte_carlo.margem_liquida_pct}
              fmt="pct"
            />
          </View>
        </>
      )}

      {/* Sensibilidade — top 5 tornado */}
      {f.sensitivity?.tornado_by_vpl && f.sensitivity.tornado_by_vpl.length > 0 && (
        <>
          <Text style={s.subSectionTitle}>Analise de Sensibilidade (Tornado VPL)</Text>
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderCell, { width: "30%" }]}>Variavel</Text>
              <Text style={[s.tableHeaderCell, { width: "17%", textAlign: "right" }]}>VPL Baixo</Text>
              <Text style={[s.tableHeaderCell, { width: "17%", textAlign: "right" }]}>VPL Base</Text>
              <Text style={[s.tableHeaderCell, { width: "17%", textAlign: "right" }]}>VPL Alto</Text>
              <Text style={[s.tableHeaderCell, { width: "19%", textAlign: "right" }]}>Impacto</Text>
            </View>
            {f.sensitivity.tornado_by_vpl.slice(0, 6).map((bar, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { width: "30%" }]}>{bar.label}</Text>
                <Text style={[s.tableCell, { width: "17%", textAlign: "right" }]}>{formatBRLCompact(bar.vpl.low)}</Text>
                <Text style={[s.tableCell, { width: "17%", textAlign: "right" }]}>{formatBRLCompact(bar.vpl.base)}</Text>
                <Text style={[s.tableCell, { width: "17%", textAlign: "right" }]}>{formatBRLCompact(bar.vpl.high)}</Text>
                <Text style={[s.tableCell, { width: "19%", textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{formatBRLCompact(bar.vpl.impact_range)}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

// --- Sub-components ---

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={[s.kpiCard, color ? { borderLeftColor: color } : {}]}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={s.kpiValue}>{value}</Text>
      {sub && <Text style={s.kpiUnit}>{sub}</Text>}
    </View>
  );
}

function CostRow({ label, value, vgv, alt }: { label: string; value?: number | null; vgv?: number | null; alt: boolean }) {
  const pct = value && vgv ? ((value / vgv) * 100).toFixed(1) + "%" : "—";
  return (
    <View style={alt ? s.tableRowAlt : s.tableRow}>
      <Text style={[s.tableCell, { width: "50%" }]}>{label}</Text>
      <Text style={[s.tableCell, { width: "25%", textAlign: "right" }]}>{formatBRL(value)}</Text>
      <Text style={[s.tableCell, { width: "25%", textAlign: "right" }]}>{pct}</Text>
    </View>
  );
}

function McRow({ label, stats, fmt, alt }: { label: string; stats: { p5: number; p50: number; p95: number; mean: number; prob_positive?: number }; fmt: "brl" | "pct"; alt?: boolean }) {
  const f = fmt === "brl" ? formatBRLCompact : formatPct;
  return (
    <View style={alt ? s.tableRowAlt : s.tableRow}>
      <Text style={[s.tableCell, { width: "25%" }]}>{label}</Text>
      <Text style={[s.tableCell, { width: "15%", textAlign: "right" }]}>{f(stats.p5)}</Text>
      <Text style={[s.tableCell, { width: "15%", textAlign: "right" }]}>{f(stats.p50)}</Text>
      <Text style={[s.tableCell, { width: "15%", textAlign: "right" }]}>{f(stats.p95)}</Text>
      <Text style={[s.tableCell, { width: "15%", textAlign: "right" }]}>{f(stats.mean)}</Text>
      <Text style={[s.tableCell, { width: "15%", textAlign: "right" }]}>{stats.prob_positive != null ? formatPct(stats.prob_positive * 100) : "—"}</Text>
    </View>
  );
}

function getVplColor(vpl?: number | null): string {
  if (vpl == null) return colors.gray500;
  return vpl >= 0 ? colors.accent : colors.danger;
}
