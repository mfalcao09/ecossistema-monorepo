/**
 * PDFMatricula.tsx — Secao 12: Registro Imobiliario (CRI / Matricula)
 * Sessao 146 — Bloco K
 */
import { View, Text } from "@react-pdf/renderer";
import { s, colors } from "../pdfStyles";
import { formatDate } from "../pdfHelpers";
import type { MatriculaRecord } from "@/lib/parcelamento/cri-matricula-types";

interface Props {
  matricula?: MatriculaRecord | null;
}

export default function PDFMatricula({ matricula }: Props) {
  if (!matricula) return null;

  return (
    <View>
      <Text style={s.sectionTitle}>12. Registro Imobiliario</Text>

      {/* Dados basicos */}
      <View wrap={false}>
        <Text style={s.subSectionTitle}>Dados da Matricula</Text>
        <View style={s.twoCol}>
          <View style={s.col}>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Numero</Text>
              <Text style={[s.infoValue, { fontFamily: "Helvetica-Bold" }]}>
                {matricula.numero_matricula ?? "—"}
              </Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Cartorio</Text>
              <Text style={s.infoValue}>{matricula.cartorio_nome ?? "—"}</Text>
            </View>
            {matricula.cartorio_cns && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>CNS</Text>
                <Text style={s.infoValue}>{matricula.cartorio_cns}</Text>
              </View>
            )}
          </View>
          <View style={s.col}>
            {matricula.comarca && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Comarca</Text>
                <Text style={s.infoValue}>{matricula.comarca}</Text>
              </View>
            )}
            {matricula.data_abertura && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Data abertura</Text>
                <Text style={s.infoValue}>{formatDate(matricula.data_abertura)}</Text>
              </View>
            )}
            {matricula.livro && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Livro / Folha</Text>
                <Text style={s.infoValue}>{matricula.livro}{matricula.folha ? ` / ${matricula.folha}` : ""}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Averbacoes */}
      {matricula.averbacoes && matricula.averbacoes.length > 0 && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>Averbacoes</Text>
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderCell, { width: "10%" }]}>#</Text>
              <Text style={[s.tableHeaderCell, { width: "15%" }]}>Data</Text>
              <Text style={[s.tableHeaderCell, { width: "20%" }]}>Tipo</Text>
              <Text style={[s.tableHeaderCell, { width: "55%" }]}>Descricao</Text>
            </View>
            {matricula.averbacoes.slice(0, 10).map((av, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { width: "10%" }]}>{av.numero ?? i + 1}</Text>
                <Text style={[s.tableCell, { width: "15%" }]}>{av.data ? formatDate(av.data) : "—"}</Text>
                <Text style={[s.tableCell, { width: "20%" }]}>{av.tipo ?? "—"}</Text>
                <Text style={[s.tableCell, { width: "55%" }]}>{av.descricao?.substring(0, 80) ?? "—"}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Onus */}
      {matricula.onus && matricula.onus.length > 0 && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>Onus e Gravames</Text>
          {matricula.onus.map((o, i) => (
            <View key={i} style={[s.alertDanger, { marginVertical: 2 }]}>
              <Text style={[s.alertText, { fontFamily: "Helvetica-Bold" }]}>
                {o.tipo ?? "Onus"} {o.data ? `— ${formatDate(o.data)}` : ""}
              </Text>
              <Text style={s.alertText}>{o.descricao ?? "—"}</Text>
              {o.beneficiario && (
                <Text style={[s.alertText, { marginTop: 1 }]}>
                  Beneficiario: {o.beneficiario}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Status */}
      {matricula.status && (
        <View wrap={false} style={{ marginTop: 4 }}>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Status da matricula</Text>
            <Text style={[s.infoValue, { fontFamily: "Helvetica-Bold" }]}>{matricula.status}</Text>
          </View>
        </View>
      )}
    </View>
  );
}
