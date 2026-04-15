/**
 * PDFBenchmarks.tsx — Secao 6: Benchmarks de Mercado
 * Sessao 146 — Bloco K
 */
import { View, Text } from "@react-pdf/renderer";
import { s, colors } from "../pdfStyles";
import { formatBRL, formatPct, formatNum } from "../pdfHelpers";
import type { SinapiResult, SecoviResult, AbraincResult } from "@/lib/parcelamento/market-benchmarks-types";

interface Props {
  sinapi?: SinapiResult | null;
  secovi?: SecoviResult | null;
  abrainc?: AbraincResult | null;
}

export default function PDFBenchmarks({ sinapi, secovi, abrainc }: Props) {
  return (
    <View>
      <Text style={s.sectionTitle}>6. Benchmarks de Mercado</Text>

      {/* SINAPI */}
      {sinapi && sinapi.itens.length > 0 && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>SINAPI — Custos de Construcao ({sinapi.uf}, ref. {sinapi.referencia})</Text>
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderCell, { width: "12%" }]}>Codigo</Text>
              <Text style={[s.tableHeaderCell, { width: "43%" }]}>Descricao</Text>
              <Text style={[s.tableHeaderCell, { width: "10%" }]}>Unid.</Text>
              <Text style={[s.tableHeaderCell, { width: "17%", textAlign: "right" }]}>Custo Total</Text>
              <Text style={[s.tableHeaderCell, { width: "18%" }]}>Grupo</Text>
            </View>
            {sinapi.itens.slice(0, 15).map((item, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { width: "12%" }]}>{item.codigo}</Text>
                <Text style={[s.tableCell, { width: "43%" }]}>{item.descricao.substring(0, 60)}</Text>
                <Text style={[s.tableCell, { width: "10%" }]}>{item.unidade}</Text>
                <Text style={[s.tableCell, { width: "17%", textAlign: "right" }]}>{formatBRL(item.custo_total)}</Text>
                <Text style={[s.tableCell, { width: "18%" }]}>{item.grupo}</Text>
              </View>
            ))}
          </View>
          <Text style={{ fontSize: 7, color: colors.gray500, marginTop: 2 }}>
            Fonte: {sinapi.fonte}. {sinapi.nota}
          </Text>
        </View>
      )}

      {/* SECOVI */}
      {secovi && secovi.precos.length > 0 && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>SECOVI — Precos Imobiliarios (ref. {secovi.referencia})</Text>
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderCell, { width: "25%" }]}>Cidade</Text>
              <Text style={[s.tableHeaderCell, { width: "15%" }]}>Tipo</Text>
              <Text style={[s.tableHeaderCell, { width: "20%", textAlign: "right" }]}>R$/m2 Medio</Text>
              <Text style={[s.tableHeaderCell, { width: "20%", textAlign: "right" }]}>Faixa</Text>
              <Text style={[s.tableHeaderCell, { width: "20%", textAlign: "right" }]}>Var. 12m</Text>
            </View>
            {secovi.precos.slice(0, 10).map((p, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { width: "25%" }]}>{p.cidade}/{p.uf}</Text>
                <Text style={[s.tableCell, { width: "15%" }]}>{p.tipo_imovel}</Text>
                <Text style={[s.tableCell, { width: "20%", textAlign: "right" }]}>{formatBRL(p.preco_m2_medio)}</Text>
                <Text style={[s.tableCell, { width: "20%", textAlign: "right" }]}>{formatBRL(p.preco_m2_min)} - {formatBRL(p.preco_m2_max)}</Text>
                <Text style={[s.tableCell, { width: "20%", textAlign: "right", color: p.variacao_12m_pct >= 0 ? colors.accent : colors.danger }]}>{formatPct(p.variacao_12m_pct)}</Text>
              </View>
            ))}
          </View>
          {secovi.comparativo && (
            <View style={s.alertInfo}>
              <Text style={s.alertText}>
                Comparativo: Projeto {formatBRL(secovi.comparativo.preco_m2_projeto)}/m2 vs Mercado {formatBRL(secovi.comparativo.preco_m2_mercado)}/m2
                ({secovi.comparativo.posicao.replace(/_/g, " ")}). {secovi.comparativo.recomendacao}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ABRAINC */}
      {abrainc && abrainc.lancamentos.length > 0 && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>ABRAINC — Indicadores do Setor (ref. {abrainc.referencia})</Text>
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderCell, { width: "20%" }]}>Regiao</Text>
              <Text style={[s.tableHeaderCell, { width: "20%" }]}>Programa</Text>
              <Text style={[s.tableHeaderCell, { width: "15%", textAlign: "right" }]}>Lancadas</Text>
              <Text style={[s.tableHeaderCell, { width: "15%", textAlign: "right" }]}>Vendidas</Text>
              <Text style={[s.tableHeaderCell, { width: "15%", textAlign: "right" }]}>% Vend.</Text>
              <Text style={[s.tableHeaderCell, { width: "15%", textAlign: "right" }]}>Var. 12m</Text>
            </View>
            {abrainc.lancamentos.slice(0, 8).map((l, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { width: "20%" }]}>{l.regiao}</Text>
                <Text style={[s.tableCell, { width: "20%" }]}>{l.tipo_programa}</Text>
                <Text style={[s.tableCell, { width: "15%", textAlign: "right" }]}>{formatNum(l.unidades_lancadas, 0)}</Text>
                <Text style={[s.tableCell, { width: "15%", textAlign: "right" }]}>{formatNum(l.unidades_vendidas, 0)}</Text>
                <Text style={[s.tableCell, { width: "15%", textAlign: "right" }]}>{formatPct(l.pct_vendido)}</Text>
                <Text style={[s.tableCell, { width: "15%", textAlign: "right" }]}>{formatPct(l.variacao_12m_pct)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
