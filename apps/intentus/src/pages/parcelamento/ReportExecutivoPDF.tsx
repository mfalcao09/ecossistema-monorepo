/**
 * ReportExecutivoPDF.tsx — Relatório Executivo para Investidores (PDF)
 * Bloco C — Fase 5 do módulo Parcelamento de Solo
 *
 * Gera um PDF de 2 páginas usando @react-pdf/renderer:
 *   Página 1: Capa com nome do projeto, localização, tipo, data
 *   Página 2: KPIs financeiros, viabilidade, conformidade, terreno
 *
 * Uso: <PDFDownloadLink document={<ReportExecutivoPDF ... />} fileName="...">
 */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type {
  ParcelamentoDevelopment,
  ParcelamentoFinancial,
  LegalAnalysisCached,
} from "@/lib/parcelamento/types";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const colors = {
  primary: "#1e3a5f",
  primaryLight: "#2c5282",
  accent: "#38a169",
  warning: "#d69e2e",
  danger: "#e53e3e",
  gray100: "#f7fafc",
  gray200: "#edf2f7",
  gray500: "#a0aec0",
  gray700: "#4a5568",
  gray900: "#1a202c",
  white: "#ffffff",
};

const styles = StyleSheet.create({
  // --- Page ---
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: colors.gray900,
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 40,
  },

  // --- Cover ---
  coverContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  coverBrand: {
    fontSize: 10,
    letterSpacing: 4,
    color: colors.gray500,
    textTransform: "uppercase" as any,
    marginBottom: 24,
  },
  coverTitle: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    textAlign: "center",
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 14,
    color: colors.gray700,
    textAlign: "center",
    marginBottom: 32,
  },
  coverDivider: {
    width: 60,
    height: 3,
    backgroundColor: colors.accent,
    marginBottom: 32,
  },
  coverMeta: {
    fontSize: 10,
    color: colors.gray500,
    textAlign: "center",
    marginBottom: 4,
  },
  coverFooter: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  coverFooterText: {
    fontSize: 8,
    color: colors.gray500,
  },

  // --- Content page ---
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginBottom: 12,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  subSectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.primaryLight,
    marginTop: 16,
    marginBottom: 8,
  },

  // --- KPI Grid ---
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  kpiCard: {
    width: "23%",
    backgroundColor: colors.gray100,
    borderRadius: 4,
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  kpiLabel: {
    fontSize: 7,
    color: colors.gray500,
    textTransform: "uppercase" as any,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: colors.gray900,
  },
  kpiUnit: {
    fontSize: 8,
    color: colors.gray500,
    marginTop: 1,
  },

  // --- Score badge ---
  scoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    padding: 10,
    borderRadius: 6,
  },
  scoreValue: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
  },
  scoreLabel: {
    fontSize: 10,
    color: colors.gray700,
  },

  // --- Info row ---
  infoRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  infoLabel: {
    width: "35%",
    fontSize: 9,
    color: colors.gray500,
  },
  infoValue: {
    width: "65%",
    fontSize: 9,
    color: colors.gray900,
  },

  // --- Footer ---
  pageFooter: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: colors.gray200,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 7,
    color: colors.gray500,
  },

  // --- Disclaimer ---
  disclaimer: {
    marginTop: 16,
    padding: 8,
    backgroundColor: colors.gray100,
    borderRadius: 4,
  },
  disclaimerText: {
    fontSize: 7,
    color: colors.gray500,
    lineHeight: 1.4,
  },

  // --- Two columns ---
  twoCol: {
    flexDirection: "row",
    gap: 16,
  },
  col: {
    flex: 1,
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBRL(value: number | null | undefined): string {
  if (value == null) return "N/D";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return "N/D";
  return `${value.toFixed(1)}%`;
}

function formatNum(value: number | null | undefined, decimals = 1): string {
  if (value == null) return "N/D";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function viabilidadeColor(score: number | null | undefined): string {
  if (score == null) return colors.gray500;
  if (score >= 70) return colors.accent;
  if (score >= 45) return colors.warning;
  return colors.danger;
}

function viabilidadeLabel(score: number | null | undefined): string {
  if (score == null) return "Pendente";
  if (score >= 70) return "Viavel";
  if (score >= 45) return "Atencao";
  return "Inviavel";
}

/** Converte hex para rgba (react-pdf não suporta hex+alpha) — fix Buchecha review */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReportExecutivoPDFProps {
  project: ParcelamentoDevelopment;
  financial?: ParcelamentoFinancial | null;
  legalAnalysis?: LegalAnalysisCached | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReportExecutivoPDF({
  project,
  financial,
  legalAnalysis,
}: ReportExecutivoPDFProps) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const viabScore = project.analysis_results?.viabilidade_score ?? null;
  const viabColor = viabilidadeColor(viabScore);

  return (
    <Document
      title={`Relatorio Executivo - ${project.name}`}
      author="Intentus Real Estate"
      subject="Analise de Viabilidade"
    >
      {/* ================================================================ */}
      {/* PAGINA 1 — CAPA                                                  */}
      {/* ================================================================ */}
      <Page size="A4" style={styles.page}>
        <View style={styles.coverContainer}>
          <Text style={styles.coverBrand}>Intentus Real Estate</Text>
          <Text style={styles.coverTitle}>{project.name}</Text>
          <Text style={styles.coverSubtitle}>
            Relatorio Executivo de Viabilidade
          </Text>
          <View style={styles.coverDivider} />
          <Text style={styles.coverMeta}>
            {project.city ?? "—"}, {project.state ?? "—"}
          </Text>
          <Text style={styles.coverMeta}>
            {project.tipo === "loteamento"
              ? "Loteamento"
              : project.tipo === "condominio"
              ? "Condominio Horizontal"
              : "Parcelamento de Solo"}
          </Text>
          <Text style={styles.coverMeta}>{dateStr}</Text>
        </View>

        <View style={styles.coverFooter}>
          <Text style={styles.coverFooterText}>
            Documento gerado automaticamente pela plataforma Intentus
          </Text>
          <Text style={styles.coverFooterText}>Confidencial</Text>
        </View>
      </Page>

      {/* ================================================================ */}
      {/* PAGINA 2 — DADOS E KPIs                                         */}
      {/* ================================================================ */}
      <Page size="A4" style={styles.page}>
        {/* Viabilidade */}
        <Text style={styles.sectionTitle}>Viabilidade do Empreendimento</Text>

        <View
          style={[
            styles.scoreBadge,
            { backgroundColor: hexToRgba(viabColor, 0.08) },
          ]}
        >
          <Text style={[styles.scoreValue, { color: viabColor }]}>
            {viabScore != null ? viabScore.toFixed(0) : "—"}
          </Text>
          <View>
            <Text style={[styles.scoreLabel, { fontFamily: "Helvetica-Bold" }]}>
              {viabilidadeLabel(viabScore)}
            </Text>
            <Text style={{ fontSize: 8, color: colors.gray500 }}>
              Score de viabilidade (0-100)
            </Text>
          </View>
        </View>

        {/* Dados do terreno + Financeiro */}
        <View style={styles.twoCol}>
          {/* Coluna 1: Terreno */}
          <View style={styles.col}>
            <Text style={styles.subSectionTitle}>Terreno</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Area total</Text>
              <Text style={styles.infoValue}>
                {project.area_m2
                  ? `${formatNum(project.area_m2, 0)} m2 (${formatNum(
                      (project.area_m2 ?? 0) / 10000,
                      2,
                    )} ha)`
                  : "N/D"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Perimetro</Text>
              <Text style={styles.infoValue}>
                {project.perimeter_m
                  ? `${formatNum(project.perimeter_m, 0)} m`
                  : "N/D"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Elevacao</Text>
              <Text style={styles.infoValue}>
                {project.elevation_min != null && project.elevation_max != null
                  ? `${formatNum(project.elevation_min, 0)}m - ${formatNum(
                      project.elevation_max,
                      0,
                    )}m (desnivel ${formatNum(
                      (project.elevation_max ?? 0) - (project.elevation_min ?? 0),
                      0,
                    )}m)`
                  : "N/D"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Declividade media</Text>
              <Text style={styles.infoValue}>
                {project.slope_avg_pct != null
                  ? formatPct(project.slope_avg_pct)
                  : "N/D"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Lotes estimados</Text>
              <Text style={styles.infoValue}>
                {project.total_units ?? "N/D"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>APP</Text>
              <Text style={styles.infoValue}>
                {project.app_area_m2
                  ? `${formatNum(project.app_area_m2, 0)} m2`
                  : "N/D"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Reserva Legal</Text>
              <Text style={styles.infoValue}>
                {project.reserva_legal_pct != null
                  ? `${formatPct(project.reserva_legal_pct)} (${
                      project.reserva_legal_source ?? "estimativa"
                    })`
                  : "N/D"}
              </Text>
            </View>
          </View>

          {/* Coluna 2: Parametros Urbanisticos */}
          <View style={styles.col}>
            <Text style={styles.subSectionTitle}>Parametros Urbanisticos</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tipo</Text>
              <Text style={styles.infoValue}>
                {project.tipo_parcelamento?.replace(/_/g, " ") ?? "N/D"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Padrao</Text>
              <Text style={styles.infoValue}>
                {project.padrao_empreendimento ?? "N/D"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Area publica</Text>
              <Text style={styles.infoValue}>
                {project.pct_area_publica != null
                  ? formatPct(project.pct_area_publica)
                  : "N/D"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Area verde</Text>
              <Text style={styles.infoValue}>
                {project.pct_area_verde != null
                  ? formatPct(project.pct_area_verde)
                  : "N/D"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Sistema viario</Text>
              <Text style={styles.infoValue}>
                {project.pct_sistema_viario != null
                  ? formatPct(project.pct_sistema_viario)
                  : "N/D"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Lote minimo</Text>
              <Text style={styles.infoValue}>
                {project.lote_minimo_m2
                  ? `${formatNum(project.lote_minimo_m2, 0)} m2`
                  : "N/D"}
              </Text>
            </View>
          </View>
        </View>

        {/* KPIs Financeiros */}
        {financial && financial.is_calculated && (
          <>
            <Text style={styles.subSectionTitle}>Indicadores Financeiros</Text>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>VGV Estimado</Text>
                <Text style={styles.kpiValue}>
                  {formatBRL(project.vgv_estimado)}
                </Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>VPL</Text>
                <Text style={styles.kpiValue}>
                  {formatBRL(financial.vpl)}
                </Text>
              </View>
              <View
                style={[
                  styles.kpiCard,
                  {
                    borderLeftColor:
                      (financial.tir_anual ?? 0) > (financial.wacc_pct ?? 0)
                        ? colors.accent
                        : colors.danger,
                  },
                ]}
              >
                <Text style={styles.kpiLabel}>TIR Anual</Text>
                <Text style={styles.kpiValue}>
                  {formatPct(financial.tir_anual)}
                </Text>
                <Text style={styles.kpiUnit}>
                  WACC: {formatPct(financial.wacc_pct)}
                </Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Payback</Text>
                <Text style={styles.kpiValue}>
                  {financial.payback_meses != null
                    ? `${financial.payback_meses} meses`
                    : "N/D"}
                </Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Margem Liquida</Text>
                <Text style={styles.kpiValue}>
                  {formatPct(financial.margem_liquida_pct)}
                </Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Custo Obra</Text>
                <Text style={styles.kpiValue}>
                  {formatBRL(financial.custo_obra_total)}
                </Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Performance</Text>
                <Text style={styles.kpiValue}>
                  {financial.performance_score != null
                    ? `${financial.performance_score.toFixed(0)}/100`
                    : "N/D"}
                </Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Cenario</Text>
                <Text style={styles.kpiValue}>
                  {financial.scenario_type ?? "realista"}
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Conformidade Legal */}
        {legalAnalysis && (
          <>
            <Text style={styles.subSectionTitle}>Conformidade Legal</Text>
            <View
              style={[
                styles.scoreBadge,
                {
                  backgroundColor:
                    (legalAnalysis.compliance_score ?? 0) >= 70
                      ? hexToRgba(colors.accent, 0.08)
                      : (legalAnalysis.compliance_score ?? 0) >= 45
                      ? hexToRgba(colors.warning, 0.08)
                      : hexToRgba(colors.danger, 0.08),
                },
              ]}
            >
              <Text
                style={[
                  styles.scoreValue,
                  {
                    color: viabilidadeColor(legalAnalysis.compliance_score),
                    fontSize: 18,
                  },
                ]}
              >
                {legalAnalysis.compliance_score?.toFixed(0) ?? "—"}
              </Text>
              <View>
                <Text style={{ fontSize: 9, color: colors.gray700 }}>
                  Score de conformidade (0-100)
                </Text>
                <Text style={{ fontSize: 8, color: colors.gray500 }}>
                  {(legalAnalysis.violations?.length ?? 0)} violacoes ·{" "}
                  {(legalAnalysis.warnings?.length ?? 0)} alertas ·{" "}
                  {(legalAnalysis.recommendations?.length ?? 0)} conforme
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            AVISO LEGAL: Este relatorio foi gerado automaticamente pela
            plataforma Intentus Real Estate com base em dados fornecidos pelo
            usuario e analises computacionais. Nao substitui parecer tecnico
            profissional (engenheiro civil, advogado, topografo). Os valores
            financeiros sao estimativas baseadas em premissas declaradas e nao
            constituem garantia de resultado. Consulte profissionais
            habilitados antes de tomar decisoes de investimento.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.pageFooter}>
          <Text style={styles.footerText}>
            Intentus Real Estate — {dateStr}
          </Text>
          <Text style={styles.footerText}>Pagina 2 de 2</Text>
        </View>
      </Page>
    </Document>
  );
}
