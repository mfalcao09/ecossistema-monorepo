/**
 * PDFEmbargos.tsx — Secao 8: Embargos Ambientais
 * Sessao 146 — Bloco K
 */
import { View, Text } from "@react-pdf/renderer";
import { s, colors, hexToRgba } from "../pdfStyles";
import { riskColor, formatNum, formatDate } from "../pdfHelpers";
import type { CheckIbamaResult, CheckICMBioResult } from "@/lib/parcelamento/environmental-embargoes-types";

interface Props {
  ibamaResult?: CheckIbamaResult | null;
  icmbioResult?: CheckICMBioResult | null;
}

export default function PDFEmbargos({ ibamaResult, icmbioResult }: Props) {
  return (
    <View>
      <Text style={s.sectionTitle}>8. Embargos Ambientais</Text>

      {/* IBAMA */}
      {ibamaResult?.data && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>IBAMA — Areas Embargadas</Text>
          <View style={[s.scoreBadge, { backgroundColor: hexToRgba(riskColor(ibamaResult.data.risco), 0.08) }]}>
            <Text style={[s.scoreValue, { color: riskColor(ibamaResult.data.risco), fontSize: 16 }]}>
              {ibamaResult.data.risco.toUpperCase()}
            </Text>
            <View>
              <Text style={s.scoreLabel}>{ibamaResult.data.resumo}</Text>
              <Text style={{ fontSize: 7, color: colors.gray500 }}>
                {ibamaResult.data.total} embargo(s) encontrado(s)
              </Text>
            </View>
          </View>
          {ibamaResult.data.embargos.length > 0 && (
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, { width: "15%" }]}>Auto</Text>
                <Text style={[s.tableHeaderCell, { width: "15%" }]}>Data</Text>
                <Text style={[s.tableHeaderCell, { width: "20%" }]}>Municipio</Text>
                <Text style={[s.tableHeaderCell, { width: "15%", textAlign: "right" }]}>Dist. km</Text>
                <Text style={[s.tableHeaderCell, { width: "20%" }]}>Situacao</Text>
                <Text style={[s.tableHeaderCell, { width: "15%" }]}>Bioma</Text>
              </View>
              {ibamaResult.data.embargos.slice(0, 10).map((e, i) => (
                <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.tableCell, { width: "15%" }]}>{e.numero_auto}</Text>
                  <Text style={[s.tableCell, { width: "15%" }]}>{formatDate(e.data_embargo)}</Text>
                  <Text style={[s.tableCell, { width: "20%" }]}>{e.municipio}/{e.uf}</Text>
                  <Text style={[s.tableCell, { width: "15%", textAlign: "right" }]}>{e.distancia_km != null ? formatNum(e.distancia_km, 1) : "—"}</Text>
                  <Text style={[s.tableCell, { width: "20%" }]}>{e.situacao}</Text>
                  <Text style={[s.tableCell, { width: "15%" }]}>{e.bioma}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ICMBio */}
      {icmbioResult?.data && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>ICMBio — Unidades de Conservacao</Text>
          <View style={[s.scoreBadge, { backgroundColor: hexToRgba(riskColor(icmbioResult.data.risco), 0.08) }]}>
            <Text style={[s.scoreValue, { color: riskColor(icmbioResult.data.risco), fontSize: 16 }]}>
              {icmbioResult.data.risco.toUpperCase()}
            </Text>
            <Text style={s.scoreLabel}>{icmbioResult.data.resumo}</Text>
          </View>
          {icmbioResult.data.unidades_conservacao.length > 0 && (
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, { width: "30%" }]}>Nome</Text>
                <Text style={[s.tableHeaderCell, { width: "20%" }]}>Categoria</Text>
                <Text style={[s.tableHeaderCell, { width: "15%", textAlign: "right" }]}>Dist. km</Text>
                <Text style={[s.tableHeaderCell, { width: "15%" }]}>Impacto</Text>
                <Text style={[s.tableHeaderCell, { width: "20%" }]}>Restricoes</Text>
              </View>
              {icmbioResult.data.unidades_conservacao.slice(0, 8).map((uc, i) => (
                <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.tableCell, { width: "30%" }]}>{uc.nome}</Text>
                  <Text style={[s.tableCell, { width: "20%" }]}>{uc.categoria}</Text>
                  <Text style={[s.tableCell, { width: "15%", textAlign: "right" }]}>{uc.distancia_km != null ? formatNum(uc.distancia_km, 1) : "—"}</Text>
                  <Text style={[uc.impacto === "bloqueante" ? s.badgeFail : uc.impacto === "restritivo" ? s.badgeWarn : s.badgePass, { width: "15%" }]}>
                    {uc.impacto ?? "—"}
                  </Text>
                  <Text style={[s.tableCell, { width: "20%" }]}>{uc.restricoes?.substring(0, 40)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
