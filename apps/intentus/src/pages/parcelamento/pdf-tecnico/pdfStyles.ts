/**
 * pdfStyles.ts — Estilos compartilhados do Relatorio Tecnico PDF
 * Sessao 146 — Bloco K (Relatorios e Exportacao)
 *
 * Paleta corporativa Intentus + layout padronizado para 10-20 paginas.
 */
import { StyleSheet } from "@react-pdf/renderer";

export const colors = {
  primary: "#1e3a5f",
  primaryLight: "#2c5282",
  accent: "#38a169",
  warning: "#d69e2e",
  danger: "#e53e3e",
  gray100: "#f7fafc",
  gray200: "#edf2f7",
  gray300: "#e2e8f0",
  gray500: "#a0aec0",
  gray600: "#718096",
  gray700: "#4a5568",
  gray900: "#1a202c",
  white: "#ffffff",
  blue50: "#ebf8ff",
  green50: "#f0fff4",
  red50: "#fff5f5",
  yellow50: "#fffff0",
};

/** Converte hex para rgba (react-pdf nao suporta hex+alpha) */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const s = StyleSheet.create({
  // --- Page ---
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: colors.gray900,
    paddingTop: 50,
    paddingBottom: 50,
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
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    textAlign: "center",
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 13,
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

  // --- Header (fixed em todas as paginas) ---
  header: {
    position: "absolute",
    top: 15,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: colors.gray200,
    paddingBottom: 4,
  },
  headerBrand: {
    fontSize: 7,
    color: colors.gray500,
    letterSpacing: 1,
    textTransform: "uppercase" as any,
  },
  headerProject: {
    fontSize: 7,
    color: colors.gray600,
  },

  // --- Footer (fixed em todas as paginas) ---
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: colors.gray200,
    paddingTop: 4,
  },
  footerText: {
    fontSize: 7,
    color: colors.gray500,
  },

  // --- Section ---
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.primary,
  },
  subSectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.primaryLight,
    marginTop: 14,
    marginBottom: 6,
  },
  sectionNumber: {
    fontSize: 9,
    color: colors.gray500,
    marginRight: 6,
  },

  // --- KPI Grid ---
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  kpiCard: {
    width: "23%",
    backgroundColor: colors.gray100,
    borderRadius: 4,
    padding: 7,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  kpiLabel: {
    fontSize: 6.5,
    color: colors.gray500,
    textTransform: "uppercase" as any,
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: colors.gray900,
  },
  kpiUnit: {
    fontSize: 7,
    color: colors.gray500,
    marginTop: 1,
  },

  // --- Score badge ---
  scoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    padding: 8,
    borderRadius: 4,
  },
  scoreValue: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
  },
  scoreLabel: {
    fontSize: 9,
    color: colors.gray700,
  },

  // --- Info row ---
  infoRow: {
    flexDirection: "row",
    marginBottom: 3,
    paddingVertical: 1,
  },
  infoLabel: {
    width: "38%",
    fontSize: 8,
    color: colors.gray500,
  },
  infoValue: {
    width: "62%",
    fontSize: 8,
    color: colors.gray900,
  },

  // --- Two / Three columns ---
  twoCol: {
    flexDirection: "row",
    gap: 12,
  },
  threeCol: {
    flexDirection: "row",
    gap: 8,
  },
  col: {
    flex: 1,
  },

  // --- Table ---
  table: {
    marginVertical: 6,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 2,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: colors.white,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.gray200,
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.gray200,
    backgroundColor: colors.gray100,
  },
  tableCell: {
    fontSize: 7.5,
    color: colors.gray900,
  },

  // --- Status badges ---
  badgePass: {
    fontSize: 7,
    color: colors.accent,
    fontFamily: "Helvetica-Bold",
  },
  badgeWarn: {
    fontSize: 7,
    color: colors.warning,
    fontFamily: "Helvetica-Bold",
  },
  badgeFail: {
    fontSize: 7,
    color: colors.danger,
    fontFamily: "Helvetica-Bold",
  },

  // --- Alert boxes ---
  alertInfo: {
    backgroundColor: colors.blue50,
    borderRadius: 4,
    padding: 8,
    marginVertical: 6,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryLight,
  },
  alertSuccess: {
    backgroundColor: colors.green50,
    borderRadius: 4,
    padding: 8,
    marginVertical: 6,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  alertDanger: {
    backgroundColor: colors.red50,
    borderRadius: 4,
    padding: 8,
    marginVertical: 6,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  alertText: {
    fontSize: 8,
    color: colors.gray700,
    lineHeight: 1.4,
  },

  // --- Disclaimer ---
  disclaimer: {
    marginTop: 12,
    padding: 8,
    backgroundColor: colors.gray100,
    borderRadius: 4,
  },
  disclaimerText: {
    fontSize: 7,
    color: colors.gray500,
    lineHeight: 1.4,
  },

  // --- Paragraph ---
  paragraph: {
    fontSize: 8.5,
    color: colors.gray700,
    lineHeight: 1.5,
    marginBottom: 6,
  },

  // --- TOC ---
  tocEntry: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.gray200,
  },
  tocNumber: {
    fontSize: 9,
    color: colors.primary,
    fontFamily: "Helvetica-Bold",
    width: 20,
  },
  tocLabel: {
    fontSize: 9,
    color: colors.gray900,
    flex: 1,
  },
  tocPage: {
    fontSize: 9,
    color: colors.gray500,
    textAlign: "right",
  },

  // --- Horizontal rule ---
  hr: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.gray300,
    marginVertical: 8,
  },

  // --- Mini bar (for proportional bars in tables) ---
  miniBar: {
    height: 6,
    borderRadius: 2,
    marginTop: 2,
  },
});
