/**
 * PDFLegal.tsx — Secao 4: Conformidade Legal
 * Sessao 146 — Bloco K
 */
import { View, Text } from "@react-pdf/renderer";
import { s, colors, hexToRgba } from "../pdfStyles";
import { viabilidadeColor, statusLabel } from "../pdfHelpers";
import type { LegalAnalysisCached } from "@/lib/parcelamento/types";

interface Props {
  legalAnalysis: LegalAnalysisCached;
}

export default function PDFLegal({ legalAnalysis }: Props) {
  const la = legalAnalysis;
  const scoreColor = viabilidadeColor(la.compliance_score);

  return (
    <View>
      <Text style={s.sectionTitle}>4. Conformidade Legal</Text>

      {/* Score */}
      <View style={[s.scoreBadge, { backgroundColor: hexToRgba(scoreColor, 0.08) }]}>
        <Text style={[s.scoreValue, { color: scoreColor, fontSize: 20 }]}>
          {la.compliance_score?.toFixed(0) ?? "—"}
        </Text>
        <View>
          <Text style={{ fontSize: 9, color: colors.gray700, fontFamily: "Helvetica-Bold" }}>
            Score de Conformidade (0-100)
          </Text>
          <Text style={{ fontSize: 7, color: colors.gray500 }}>
            {la.violations?.length ?? 0} violacoes | {la.warnings?.length ?? 0} alertas | {la.recommendations?.length ?? 0} conforme
          </Text>
        </View>
      </View>

      {/* Violacoes */}
      {la.violations && la.violations.length > 0 && (
        <>
          <Text style={s.subSectionTitle}>Violacoes</Text>
          {la.violations.map((v, i) => (
            <View key={i} style={[s.alertDanger, { marginVertical: 3 }]}>
              <Text style={[s.alertText, { fontFamily: "Helvetica-Bold" }]}>
                {v.article} — {v.description}
              </Text>
              <Text style={[s.alertText, { marginTop: 2 }]}>
                Severidade: {v.severity} | Recomendacao: {v.recommendation}
              </Text>
            </View>
          ))}
        </>
      )}

      {/* Alertas */}
      {la.warnings && la.warnings.length > 0 && (
        <>
          <Text style={s.subSectionTitle}>Alertas</Text>
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderCell, { width: "20%" }]}>Artigo</Text>
              <Text style={[s.tableHeaderCell, { width: "45%" }]}>Descricao</Text>
              <Text style={[s.tableHeaderCell, { width: "35%" }]}>Recomendacao</Text>
            </View>
            {la.warnings.map((w, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { width: "20%" }]}>{w.article}</Text>
                <Text style={[s.tableCell, { width: "45%" }]}>{w.description}</Text>
                <Text style={[s.tableCell, { width: "35%" }]}>{w.recommendation}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Itens Conformes */}
      {la.recommendations && la.recommendations.length > 0 && (
        <>
          <Text style={s.subSectionTitle}>Itens Conformes</Text>
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderCell, { width: "25%" }]}>Artigo</Text>
              <Text style={[s.tableHeaderCell, { width: "75%" }]}>Descricao</Text>
            </View>
            {la.recommendations.map((r, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { width: "25%" }]}>{r.article}</Text>
                <Text style={[s.tableCell, { width: "75%" }]}>{r.description}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Parecer Textual */}
      {la.parecer_textual && (
        <>
          <Text style={s.subSectionTitle}>Parecer Tecnico</Text>
          <Text style={s.paragraph}>{la.parecer_textual}</Text>
        </>
      )}

      {/* Citations */}
      {la.citations && la.citations.length > 0 && (
        <>
          <Text style={s.subSectionTitle}>Fontes Legais</Text>
          {la.citations.map((c, i) => (
            <View key={i} style={s.infoRow}>
              <Text style={[s.infoLabel, { width: "30%" }]}>{c.source_title} — {c.article}</Text>
              <Text style={[s.infoValue, { width: "70%", fontSize: 7 }]}>{c.excerpt}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}
