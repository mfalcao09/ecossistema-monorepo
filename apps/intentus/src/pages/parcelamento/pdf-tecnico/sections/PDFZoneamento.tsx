/**
 * PDFZoneamento.tsx — Secao 10: Zoneamento Municipal
 * Sessao 146 — Bloco K
 */
import { View, Text } from "@react-pdf/renderer";
import { s, colors } from "../pdfStyles";
import { formatNum, formatPct } from "../pdfHelpers";
import type { ZoneamentoPDFData } from "../types";

interface Props {
  zoneamento?: ZoneamentoPDFData | null;
}

export default function PDFZoneamento({ zoneamento }: Props) {
  if (!zoneamento) return null;

  return (
    <View>
      <Text style={s.sectionTitle}>10. Zoneamento Municipal</Text>

      {/* Info basica */}
      <View wrap={false}>
        <View style={s.twoCol}>
          <View style={s.col}>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Municipio</Text>
              <Text style={s.infoValue}>{zoneamento.municipio ?? "—"}</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Zona</Text>
              <Text style={s.infoValue}>{zoneamento.zona ?? "—"}</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Classificacao</Text>
              <Text style={s.infoValue}>{zoneamento.classificacao ?? "—"}</Text>
            </View>
          </View>
          <View style={s.col}>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Uso permitido</Text>
              <Text style={s.infoValue}>{zoneamento.uso_permitido ?? "—"}</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Lei municipal</Text>
              <Text style={s.infoValue}>{zoneamento.lei_municipal ?? "—"}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Coeficientes */}
      {zoneamento.coeficiente_aproveitamento && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>Coeficiente de Aproveitamento</Text>
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderCell, { width: "33%" }]}>Minimo</Text>
              <Text style={[s.tableHeaderCell, { width: "34%" }]}>Basico</Text>
              <Text style={[s.tableHeaderCell, { width: "33%" }]}>Maximo</Text>
            </View>
            <View style={s.tableRow}>
              <Text style={[s.tableCell, { width: "33%", textAlign: "center" }]}>
                {zoneamento.coeficiente_aproveitamento.minimo ?? "—"}
              </Text>
              <Text style={[s.tableCell, { width: "34%", textAlign: "center" }]}>
                {zoneamento.coeficiente_aproveitamento.basico ?? "—"}
              </Text>
              <Text style={[s.tableCell, { width: "33%", textAlign: "center" }]}>
                {zoneamento.coeficiente_aproveitamento.maximo ?? "—"}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Gabarito */}
      {zoneamento.gabarito && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>Gabarito</Text>
          <View style={s.twoCol}>
            <View style={s.col}>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Altura maxima</Text>
                <Text style={s.infoValue}>
                  {zoneamento.gabarito.altura_maxima_m != null
                    ? `${formatNum(zoneamento.gabarito.altura_maxima_m, 1)} m`
                    : "—"}
                </Text>
              </View>
            </View>
            <View style={s.col}>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Pavimentos maximos</Text>
                <Text style={s.infoValue}>
                  {zoneamento.gabarito.pavimentos_maximos ?? "—"}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Recuos */}
      {zoneamento.recuos && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>Recuos</Text>
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderCell, { width: "25%" }]}>Frontal</Text>
              <Text style={[s.tableHeaderCell, { width: "25%" }]}>Lateral</Text>
              <Text style={[s.tableHeaderCell, { width: "25%" }]}>Fundos</Text>
              <Text style={[s.tableHeaderCell, { width: "25%" }]}>Entre Blocos</Text>
            </View>
            <View style={s.tableRow}>
              <Text style={[s.tableCell, { width: "25%", textAlign: "center" }]}>
                {zoneamento.recuos.frontal_m != null ? `${zoneamento.recuos.frontal_m} m` : "—"}
              </Text>
              <Text style={[s.tableCell, { width: "25%", textAlign: "center" }]}>
                {zoneamento.recuos.lateral_m != null ? `${zoneamento.recuos.lateral_m} m` : "—"}
              </Text>
              <Text style={[s.tableCell, { width: "25%", textAlign: "center" }]}>
                {zoneamento.recuos.fundos_m != null ? `${zoneamento.recuos.fundos_m} m` : "—"}
              </Text>
              <Text style={[s.tableCell, { width: "25%", textAlign: "center" }]}>
                {zoneamento.recuos.entre_blocos_m != null ? `${zoneamento.recuos.entre_blocos_m} m` : "—"}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Parametros adicionais */}
      {(zoneamento.taxa_ocupacao_max != null || zoneamento.taxa_permeabilidade_min != null) && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>Parametros Urbanisticos</Text>
          <View style={s.twoCol}>
            <View style={s.col}>
              {zoneamento.taxa_ocupacao_max != null && (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Taxa de Ocupacao Max.</Text>
                  <Text style={s.infoValue}>{formatPct(zoneamento.taxa_ocupacao_max)}</Text>
                </View>
              )}
            </View>
            <View style={s.col}>
              {zoneamento.taxa_permeabilidade_min != null && (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Taxa de Permeabilidade Min.</Text>
                  <Text style={s.infoValue}>{formatPct(zoneamento.taxa_permeabilidade_min)}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Observacoes */}
      {zoneamento.observacoes && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>Observacoes</Text>
          <Text style={s.paragraph}>{zoneamento.observacoes}</Text>
        </View>
      )}
    </View>
  );
}
