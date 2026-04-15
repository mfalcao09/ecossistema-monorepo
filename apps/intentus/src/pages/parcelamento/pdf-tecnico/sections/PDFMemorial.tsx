/**
 * PDFMemorial.tsx — Secao 11: Memorial Descritivo (US-30)
 * Sessao 146 — Bloco K
 */
import { View, Text } from "@react-pdf/renderer";
import { s, colors } from "../pdfStyles";
import { formatNum, formatDate } from "../pdfHelpers";
import type { MemorialPDFData } from "../types";

interface Props {
  memorial?: MemorialPDFData | null;
}

export default function PDFMemorial({ memorial }: Props) {
  if (!memorial) return null;

  return (
    <View>
      <Text style={s.sectionTitle}>11. Memorial Descritivo</Text>

      {/* Info basica */}
      <View wrap={false}>
        <View style={s.twoCol}>
          <View style={s.col}>
            {memorial.proprietario && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Proprietario</Text>
                <Text style={s.infoValue}>{memorial.proprietario}</Text>
              </View>
            )}
            {memorial.matricula && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Matricula</Text>
                <Text style={s.infoValue}>{memorial.matricula}</Text>
              </View>
            )}
          </View>
          <View style={s.col}>
            {memorial.area_total_m2 != null && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Area Total</Text>
                <Text style={s.infoValue}>
                  {formatNum(memorial.area_total_m2, 2)} m2 ({formatNum(memorial.area_total_m2 / 10000, 4)} ha)
                </Text>
              </View>
            )}
            {memorial.perimetro_m != null && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Perimetro</Text>
                <Text style={s.infoValue}>{formatNum(memorial.perimetro_m, 2)} m</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Vertices */}
      {memorial.vertices && memorial.vertices.length > 0 && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>Quadro de Coordenadas</Text>
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderCell, { width: "15%" }]}>Vertice</Text>
              <Text style={[s.tableHeaderCell, { width: "25%", textAlign: "right" }]}>Latitude</Text>
              <Text style={[s.tableHeaderCell, { width: "25%", textAlign: "right" }]}>Longitude</Text>
              <Text style={[s.tableHeaderCell, { width: "35%" }]}>Confrontante</Text>
            </View>
            {memorial.vertices.slice(0, 20).map((v, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { width: "15%" }]}>{v.label ?? `V${i + 1}`}</Text>
                <Text style={[s.tableCell, { width: "25%", textAlign: "right" }]}>
                  {v.lat != null ? v.lat.toFixed(6) : "—"}
                </Text>
                <Text style={[s.tableCell, { width: "25%", textAlign: "right" }]}>
                  {v.lng != null ? v.lng.toFixed(6) : "—"}
                </Text>
                <Text style={[s.tableCell, { width: "35%" }]}>{v.confrontante ?? "—"}</Text>
              </View>
            ))}
          </View>
          {memorial.vertices.length > 20 && (
            <Text style={{ fontSize: 7, color: colors.gray500, marginTop: 2 }}>
              Exibindo 20 de {memorial.vertices.length} vertices. Documento completo disponivel no memorial tecnico.
            </Text>
          )}
        </View>
      )}

      {/* Texto do memorial */}
      {memorial.memorial_text && (
        <View>
          <Text style={s.subSectionTitle}>Descricao do Perimetro</Text>
          <Text style={s.paragraph}>{memorial.memorial_text}</Text>
        </View>
      )}

      {/* Nota legal */}
      <View wrap={false} style={{ marginTop: 8 }}>
        <Text style={{ fontSize: 7, color: colors.gray500, fontStyle: "italic" }}>
          Memorial descritivo gerado conforme Lei 6.015/73 (Registros Publicos) e NBR 13.133 (Execucao de Levantamento Topografico).
          Este documento tem carater informativo e deve ser validado por profissional habilitado (engenheiro agrimensor / topografo) com ART.
        </Text>
      </View>
    </View>
  );
}
