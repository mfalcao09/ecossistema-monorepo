/**
 * PDFMapBiomas.tsx — Secao 9: Cobertura e Uso do Solo (MapBiomas)
 * Sessao 146 — Bloco K
 */
import { View, Text } from "@react-pdf/renderer";
import { s, colors, hexToRgba } from "../pdfStyles";
import { formatPct, formatNum, riskColor } from "../pdfHelpers";
import type { MapBiomasYearResult, TimeSeriesTrend } from "@/lib/parcelamento/mapbiomas-types";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/parcelamento/mapbiomas-types";

interface Props {
  landUse?: MapBiomasYearResult | null;
  trend?: TimeSeriesTrend | null;
}

export default function PDFMapBiomas({ landUse, trend }: Props) {
  return (
    <View>
      <Text style={s.sectionTitle}>9. Cobertura e Uso do Solo — MapBiomas</Text>

      {/* Distribuicao por classe */}
      {landUse && landUse.land_use_classes.length > 0 && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>Distribuicao de Classes ({landUse.year})</Text>

          {/* Resumo vegetacao nativa */}
          <View style={[s.scoreBadge, {
            backgroundColor: hexToRgba(
              landUse.native_vegetation_pct >= 20 ? colors.accent : colors.danger,
              0.08
            ),
          }]}>
            <Text style={[s.scoreValue, {
              color: landUse.native_vegetation_pct >= 20 ? colors.accent : colors.danger,
              fontSize: 18,
            }]}>
              {formatPct(landUse.native_vegetation_pct)}
            </Text>
            <Text style={s.scoreLabel}>Vegetacao Nativa</Text>
          </View>

          {/* Tabela de classes */}
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderCell, { width: "10%" }]}>Cod.</Text>
              <Text style={[s.tableHeaderCell, { width: "35%" }]}>Classe</Text>
              <Text style={[s.tableHeaderCell, { width: "20%", textAlign: "right" }]}>Area (ha)</Text>
              <Text style={[s.tableHeaderCell, { width: "15%", textAlign: "right" }]}>%</Text>
              <Text style={[s.tableHeaderCell, { width: "20%" }]}>Grupo</Text>
            </View>
            {landUse.land_use_classes
              .sort((a, b) => b.area_ha - a.area_ha)
              .slice(0, 12)
              .map((cls, i) => (
                <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.tableCell, { width: "10%" }]}>{cls.class_id}</Text>
                  <Text style={[s.tableCell, { width: "35%" }]}>
                    {CATEGORY_LABELS[cls.class_id] ?? cls.class_name ?? `Classe ${cls.class_id}`}
                  </Text>
                  <Text style={[s.tableCell, { width: "20%", textAlign: "right" }]}>
                    {formatNum(cls.area_ha, 1)}
                  </Text>
                  <Text style={[s.tableCell, { width: "15%", textAlign: "right" }]}>
                    {formatPct(cls.percentage)}
                  </Text>
                  <Text style={[s.tableCell, { width: "20%" }]}>{cls.group ?? "—"}</Text>
                </View>
              ))}
          </View>
        </View>
      )}

      {/* Tendencia temporal */}
      {trend && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>Tendencia Temporal</Text>

          <View style={[s.alertInfo, {
            backgroundColor: hexToRgba(
              trend.deforestation_trend === "increasing" ? colors.danger
                : trend.deforestation_trend === "stable" ? colors.warning
                : colors.accent,
              0.08
            ),
          }]}>
            <Text style={[s.alertText, { fontFamily: "Helvetica-Bold" }]}>
              Tendencia de desmatamento: {
                trend.deforestation_trend === "increasing" ? "CRESCENTE"
                  : trend.deforestation_trend === "stable" ? "ESTAVEL"
                  : "DECRESCENTE"
              }
            </Text>
            <Text style={[s.alertText, { marginTop: 2 }]}>
              {trend.change_summary}
            </Text>
          </View>

          {trend.yearly_changes && trend.yearly_changes.length > 0 && (
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, { width: "20%" }]}>Ano</Text>
                <Text style={[s.tableHeaderCell, { width: "25%", textAlign: "right" }]}>Veg. Nativa %</Text>
                <Text style={[s.tableHeaderCell, { width: "25%", textAlign: "right" }]}>Pastagem %</Text>
                <Text style={[s.tableHeaderCell, { width: "30%", textAlign: "right" }]}>Variacao Nativa</Text>
              </View>
              {trend.yearly_changes.slice(-8).map((yr, i) => (
                <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.tableCell, { width: "20%" }]}>{yr.year}</Text>
                  <Text style={[s.tableCell, { width: "25%", textAlign: "right" }]}>
                    {formatPct(yr.native_vegetation_pct)}
                  </Text>
                  <Text style={[s.tableCell, { width: "25%", textAlign: "right" }]}>
                    {formatPct(yr.pasture_pct ?? 0)}
                  </Text>
                  <Text style={[s.tableCell, {
                    width: "30%",
                    textAlign: "right",
                    color: (yr.native_change_pct ?? 0) < 0 ? colors.danger : colors.accent,
                  }]}>
                    {yr.native_change_pct != null ? formatPct(yr.native_change_pct) : "—"}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
