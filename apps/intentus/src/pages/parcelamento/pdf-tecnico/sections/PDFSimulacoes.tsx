/**
 * PDFSimulacoes.tsx — Secao 13: Simulacoes FII / CRI-CRA
 * Sessao 146 — Bloco K
 */
import { View, Text } from "@react-pdf/renderer";
import { s, colors } from "../pdfStyles";
import { formatBRL, formatPct, formatNum } from "../pdfHelpers";
import type { FiiCraPDFData } from "../types";

interface Props {
  fiiCra?: FiiCraPDFData | null;
}

export default function PDFSimulacoes({ fiiCra }: Props) {
  if (!fiiCra) return null;

  return (
    <View>
      <Text style={s.sectionTitle}>13. Simulacoes de Estruturacao</Text>

      {/* FII */}
      {fiiCra.fii && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>FII — Fundo de Investimento Imobiliario</Text>
          <View style={s.twoCol}>
            <View style={s.col}>
              {fiiCra.fii.patrimonio_liquido != null && (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Patrimonio Liquido</Text>
                  <Text style={s.infoValue}>{formatBRL(fiiCra.fii.patrimonio_liquido)}</Text>
                </View>
              )}
              {fiiCra.fii.valor_cota != null && (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Valor da Cota</Text>
                  <Text style={s.infoValue}>{formatBRL(fiiCra.fii.valor_cota)}</Text>
                </View>
              )}
              {fiiCra.fii.total_cotas != null && (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Total de Cotas</Text>
                  <Text style={s.infoValue}>{formatNum(fiiCra.fii.total_cotas, 0)}</Text>
                </View>
              )}
            </View>
            <View style={s.col}>
              {fiiCra.fii.dividend_yield != null && (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Dividend Yield a.a.</Text>
                  <Text style={[s.infoValue, { fontFamily: "Helvetica-Bold" }]}>
                    {formatPct(fiiCra.fii.dividend_yield)}
                  </Text>
                </View>
              )}
              {fiiCra.fii.tir_investidor != null && (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>TIR Investidor</Text>
                  <Text style={[s.infoValue, { fontFamily: "Helvetica-Bold" }]}>
                    {formatPct(fiiCra.fii.tir_investidor)}
                  </Text>
                </View>
              )}
              {fiiCra.fii.vpl != null && (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>VPL</Text>
                  <Text style={s.infoValue}>{formatBRL(fiiCra.fii.vpl)}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {/* CRI/CRA */}
      {fiiCra.criCra && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>CRI / CRA — Certificados de Recebiveis</Text>
          <View style={s.twoCol}>
            <View style={s.col}>
              {fiiCra.criCra.valor_emissao != null && (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Valor da Emissao</Text>
                  <Text style={s.infoValue}>{formatBRL(fiiCra.criCra.valor_emissao)}</Text>
                </View>
              )}
              {fiiCra.criCra.taxa_juros != null && (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Taxa de Juros a.a.</Text>
                  <Text style={s.infoValue}>{formatPct(fiiCra.criCra.taxa_juros)}</Text>
                </View>
              )}
              {fiiCra.criCra.prazo_meses != null && (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Prazo</Text>
                  <Text style={s.infoValue}>{fiiCra.criCra.prazo_meses} meses</Text>
                </View>
              )}
            </View>
            <View style={s.col}>
              {fiiCra.criCra.wal != null && (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>WAL (anos)</Text>
                  <Text style={s.infoValue}>{formatNum(fiiCra.criCra.wal, 2)}</Text>
                </View>
              )}
              {fiiCra.criCra.tir_emissao != null && (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>TIR da Emissao</Text>
                  <Text style={[s.infoValue, { fontFamily: "Helvetica-Bold" }]}>
                    {formatPct(fiiCra.criCra.tir_emissao)}
                  </Text>
                </View>
              )}
              {fiiCra.criCra.spread_cdi != null && (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Spread s/ CDI</Text>
                  <Text style={s.infoValue}>{formatPct(fiiCra.criCra.spread_cdi)}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Tranches */}
          {fiiCra.criCra.tranches && fiiCra.criCra.tranches.length > 0 && (
            <>
              <Text style={[s.subSectionTitle, { fontSize: 9 }]}>Tranches</Text>
              <View style={s.table}>
                <View style={s.tableHeader}>
                  <Text style={[s.tableHeaderCell, { width: "20%" }]}>Serie</Text>
                  <Text style={[s.tableHeaderCell, { width: "20%", textAlign: "right" }]}>Valor</Text>
                  <Text style={[s.tableHeaderCell, { width: "15%", textAlign: "right" }]}>Taxa</Text>
                  <Text style={[s.tableHeaderCell, { width: "15%", textAlign: "right" }]}>Prazo</Text>
                  <Text style={[s.tableHeaderCell, { width: "15%" }]}>Rating</Text>
                  <Text style={[s.tableHeaderCell, { width: "15%" }]}>Subordinacao</Text>
                </View>
                {fiiCra.criCra.tranches.map((t, i) => (
                  <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                    <Text style={[s.tableCell, { width: "20%" }]}>{t.serie ?? `Serie ${i + 1}`}</Text>
                    <Text style={[s.tableCell, { width: "20%", textAlign: "right" }]}>
                      {t.valor != null ? formatBRL(t.valor) : "—"}
                    </Text>
                    <Text style={[s.tableCell, { width: "15%", textAlign: "right" }]}>
                      {t.taxa != null ? formatPct(t.taxa) : "—"}
                    </Text>
                    <Text style={[s.tableCell, { width: "15%", textAlign: "right" }]}>
                      {t.prazo_meses ? `${t.prazo_meses}m` : "—"}
                    </Text>
                    <Text style={[s.tableCell, { width: "15%" }]}>{t.rating ?? "—"}</Text>
                    <Text style={[s.tableCell, { width: "15%" }]}>{t.subordinacao ?? "—"}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {/* Comparativo */}
      {fiiCra.comparativo && (
        <View wrap={false}>
          <Text style={s.subSectionTitle}>Comparativo de Estruturacao</Text>
          <Text style={s.paragraph}>{fiiCra.comparativo}</Text>
        </View>
      )}
    </View>
  );
}
