/**
 * PDFCenso.tsx — Secao 7: Dados Censitarios IBGE
 * Sessao 146 — Bloco K
 */
import { View, Text } from "@react-pdf/renderer";
import { s, colors } from "../pdfStyles";
import { formatBRL, formatPct, formatNum } from "../pdfHelpers";
import type { CensusIncomeItem, CensusDemographicsItem, CensusHousingItem } from "@/lib/parcelamento/ibge-census-types";

interface Props {
  income?: CensusIncomeItem[] | null;
  demographics?: CensusDemographicsItem[] | null;
  housing?: CensusHousingItem[] | null;
}

export default function PDFCenso({ income, demographics, housing }: Props) {
  return (
    <View>
      <Text style={s.sectionTitle}>7. Dados Censitarios IBGE</Text>

      {/* Renda */}
      {income && income.length > 0 && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>Renda Domiciliar</Text>
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderCell, { width: "30%" }]}>Municipio</Text>
              <Text style={[s.tableHeaderCell, { width: "17%", textAlign: "right" }]}>Renda Media</Text>
              <Text style={[s.tableHeaderCell, { width: "17%", textAlign: "right" }]}>Per Capita</Text>
              <Text style={[s.tableHeaderCell, { width: "18%", textAlign: "right" }]}>{">"} 5 SM</Text>
              <Text style={[s.tableHeaderCell, { width: "18%" }]}>Classe</Text>
            </View>
            {income.slice(0, 10).map((item, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { width: "30%" }]}>{item.municipio_nome}/{item.uf}</Text>
                <Text style={[s.tableCell, { width: "17%", textAlign: "right" }]}>{formatBRL(item.renda_domiciliar_media)}</Text>
                <Text style={[s.tableCell, { width: "17%", textAlign: "right" }]}>{formatBRL(item.renda_per_capita)}</Text>
                <Text style={[s.tableCell, { width: "18%", textAlign: "right" }]}>{formatPct(item.pct_renda_acima_5sm)}</Text>
                <Text style={[s.tableCell, { width: "18%" }]}>{item.classe_predominante}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Demografia */}
      {demographics && demographics.length > 0 && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>Demografia</Text>
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderCell, { width: "25%" }]}>Municipio</Text>
              <Text style={[s.tableHeaderCell, { width: "15%", textAlign: "right" }]}>Populacao</Text>
              <Text style={[s.tableHeaderCell, { width: "15%", textAlign: "right" }]}>Dens. hab/km2</Text>
              <Text style={[s.tableHeaderCell, { width: "15%", textAlign: "right" }]}>Cresc. a.a.</Text>
              <Text style={[s.tableHeaderCell, { width: "15%", textAlign: "right" }]}>% Urbana</Text>
              <Text style={[s.tableHeaderCell, { width: "15%", textAlign: "right" }]}>Idade Med.</Text>
            </View>
            {demographics.slice(0, 5).map((d, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { width: "25%" }]}>{d.municipio_nome}/{d.uf}</Text>
                <Text style={[s.tableCell, { width: "15%", textAlign: "right" }]}>{formatNum(d.populacao_total, 0)}</Text>
                <Text style={[s.tableCell, { width: "15%", textAlign: "right" }]}>{formatNum(d.densidade_hab_km2, 0)}</Text>
                <Text style={[s.tableCell, { width: "15%", textAlign: "right" }]}>{formatPct(d.taxa_crescimento_anual_pct)}</Text>
                <Text style={[s.tableCell, { width: "15%", textAlign: "right" }]}>{formatPct(d.populacao_urbana_pct)}</Text>
                <Text style={[s.tableCell, { width: "15%", textAlign: "right" }]}>{formatNum(d.idade_media, 0)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Domicilios */}
      {housing && housing.length > 0 && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>Domicilios</Text>
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderCell, { width: "25%" }]}>Municipio</Text>
              <Text style={[s.tableHeaderCell, { width: "12%", textAlign: "right" }]}>Total</Text>
              <Text style={[s.tableHeaderCell, { width: "12%", textAlign: "right" }]}>% Propr.</Text>
              <Text style={[s.tableHeaderCell, { width: "12%", textAlign: "right" }]}>% Alug.</Text>
              <Text style={[s.tableHeaderCell, { width: "12%", textAlign: "right" }]}>% Esgoto</Text>
              <Text style={[s.tableHeaderCell, { width: "12%", textAlign: "right" }]}>% Agua</Text>
              <Text style={[s.tableHeaderCell, { width: "15%", textAlign: "right" }]}>Deficit</Text>
            </View>
            {housing.slice(0, 5).map((h, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { width: "25%" }]}>{h.municipio_nome}/{h.uf}</Text>
                <Text style={[s.tableCell, { width: "12%", textAlign: "right" }]}>{formatNum(h.total_domicilios, 0)}</Text>
                <Text style={[s.tableCell, { width: "12%", textAlign: "right" }]}>{formatPct(h.domicilios_proprios_pct)}</Text>
                <Text style={[s.tableCell, { width: "12%", textAlign: "right" }]}>{formatPct(h.domicilios_alugados_pct)}</Text>
                <Text style={[s.tableCell, { width: "12%", textAlign: "right" }]}>{formatPct(h.domicilios_com_esgoto_pct)}</Text>
                <Text style={[s.tableCell, { width: "12%", textAlign: "right" }]}>{formatPct(h.domicilios_com_agua_rede_pct)}</Text>
                <Text style={[s.tableCell, { width: "15%", textAlign: "right" }]}>{formatNum(h.deficit_habitacional_estimado, 0)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
