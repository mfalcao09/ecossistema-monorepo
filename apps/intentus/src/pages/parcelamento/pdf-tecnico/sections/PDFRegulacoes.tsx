/**
 * PDFRegulacoes.tsx — Secao 5: Regulacoes Brasileiras
 * Sessao 146 — Bloco K
 */
import { View, Text } from "@react-pdf/renderer";
import { s, colors } from "../pdfStyles";
import { formatBRL, formatPct, formatNum } from "../pdfHelpers";
import type { ItbiResult, OutorgaResult, LeiVerdeResult, CnpjSpeResult } from "@/lib/parcelamento/brazil-regulations-types";

interface Props {
  itbi?: ItbiResult | null;
  outorga?: OutorgaResult | null;
  leiVerde?: LeiVerdeResult | null;
  cnpjSpe?: CnpjSpeResult | null;
}

export default function PDFRegulacoes({ itbi, outorga, leiVerde, cnpjSpe }: Props) {
  return (
    <View>
      <Text style={s.sectionTitle}>5. Regulacoes Brasileiras</Text>

      {/* ITBI */}
      {itbi && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>ITBI — Imposto de Transmissao</Text>
          <View style={s.twoCol}>
            <View style={s.col}>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Municipio</Text>
                <Text style={s.infoValue}>{itbi.municipio}/{itbi.uf}</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Aliquota</Text>
                <Text style={s.infoValue}>{formatPct(itbi.aliquota_pct)}</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Fonte legal</Text>
                <Text style={s.infoValue}>{itbi.fonte_legal}</Text>
              </View>
            </View>
            <View style={s.col}>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>ITBI aquisicao terreno</Text>
                <Text style={s.infoValue}>{formatBRL(itbi.resumo.itbi_aquisicao_terreno)}</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>ITBI total vendas</Text>
                <Text style={s.infoValue}>{formatBRL(itbi.resumo.itbi_total_vendas_lotes)}</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>ITBI total</Text>
                <Text style={[s.infoValue, { fontFamily: "Helvetica-Bold" }]}>{formatBRL(itbi.resumo.itbi_total)}</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>% do VGV</Text>
                <Text style={s.infoValue}>{formatPct(itbi.resumo.itbi_pct_vgv)}</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Outorga Onerosa */}
      {outorga && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>Outorga Onerosa</Text>
          <View style={s.twoCol}>
            <View style={s.col}>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Municipio</Text>
                <Text style={s.infoValue}>{outorga.municipio}/{outorga.uf}</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>CA Basico / Maximo</Text>
                <Text style={s.infoValue}>{outorga.parametros_urbanisticos.ca_basico} / {outorga.parametros_urbanisticos.ca_maximo}</Text>
              </View>
            </View>
            <View style={s.col}>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Isento?</Text>
                <Text style={s.infoValue}>{outorga.isento ? `Sim — ${outorga.motivo_isencao}` : "Nao"}</Text>
              </View>
              {!outorga.isento && (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Valor outorga</Text>
                  <Text style={[s.infoValue, { fontFamily: "Helvetica-Bold" }]}>{formatBRL(outorga.calculo.outorga_valor)}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Lei do Verde */}
      {leiVerde && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>Lei do Verde / Permeabilidade</Text>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Municipio</Text>
            <Text style={s.infoValue}>{leiVerde.municipio}/{leiVerde.uf} — Bioma: {leiVerde.bioma}</Text>
          </View>
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderCell, { width: "35%" }]}>Item</Text>
              <Text style={[s.tableHeaderCell, { width: "15%" }]}>Status</Text>
              <Text style={[s.tableHeaderCell, { width: "20%" }]}>Exigido</Text>
              <Text style={[s.tableHeaderCell, { width: "30%" }]}>Atual</Text>
            </View>
            {leiVerde.checklist.map((item, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { width: "35%" }]}>{item.item}</Text>
                <Text style={[item.status === "pass" ? s.badgePass : item.status === "fail" ? s.badgeFail : s.badgeWarn, { width: "15%" }]}>
                  {item.status === "pass" ? "OK" : item.status === "fail" ? "FALHA" : "ALERTA"}
                </Text>
                <Text style={[s.tableCell, { width: "20%" }]}>{item.exigido}</Text>
                <Text style={[s.tableCell, { width: "30%" }]}>{item.atual}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* CNPJ SPE */}
      {cnpjSpe && cnpjSpe.dados_receita && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>Validacao CNPJ/SPE</Text>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>CNPJ</Text>
            <Text style={s.infoValue}>{cnpjSpe.cnpj_formatado}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Razao Social</Text>
            <Text style={s.infoValue}>{cnpjSpe.dados_receita.razao_social}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Situacao</Text>
            <Text style={s.infoValue}>{cnpjSpe.dados_receita.situacao}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>SPE?</Text>
            <Text style={[s.infoValue, { fontFamily: "Helvetica-Bold" }]}>
              {cnpjSpe.is_spe ? "Sim" : "Nao"}
            </Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Status geral</Text>
            <Text style={s.infoValue}>{cnpjSpe.resumo?.status_geral ?? "—"}</Text>
          </View>
        </View>
      )}
    </View>
  );
}
