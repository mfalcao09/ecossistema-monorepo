/**
 * PDFTableOfContents.tsx — Sumario do Relatorio Tecnico
 * Sessao 146 — Bloco K
 */
import { View, Text } from "@react-pdf/renderer";
import { s } from "../pdfStyles";
import type { ReportTecnicoPDFProps } from "../types";

interface Props {
  data: ReportTecnicoPDFProps;
}

interface TocItem {
  num: string;
  label: string;
  available: boolean;
}

export default function PDFTableOfContents({ data }: Props) {
  const items: TocItem[] = [
    { num: "1", label: "Terreno e Topografia", available: true },
    { num: "2", label: "Parametros Urbanisticos", available: true },
    {
      num: "3",
      label: "Analise Financeira",
      available: !!(data.financial?.is_calculated),
    },
    {
      num: "4",
      label: "Conformidade Legal",
      available: !!data.legalAnalysis,
    },
    {
      num: "5",
      label: "Regulacoes Brasileiras",
      available: !!(data.itbi || data.outorga || data.leiVerde || data.cnpjSpe),
    },
    {
      num: "6",
      label: "Benchmarks de Mercado",
      available: !!(data.sinapi || data.secovi || data.abrainc),
    },
    {
      num: "7",
      label: "Dados Censitarios IBGE",
      available: !!(data.censusIncome?.length || data.censusDemographics?.length),
    },
    {
      num: "8",
      label: "Embargos Ambientais",
      available: !!(data.ibamaResult?.data || data.icmbioResult?.data),
    },
    {
      num: "9",
      label: "MapBiomas — Uso do Solo",
      available: !!data.mapBiomasLatest,
    },
    {
      num: "10",
      label: "Zoneamento Municipal",
      available: !!data.zoneamento,
    },
    {
      num: "11",
      label: "Memorial Descritivo",
      available: !!data.memorial?.memorial_text,
    },
    {
      num: "12",
      label: "Matricula CRI",
      available: !!(data.matriculas && data.matriculas.length > 0),
    },
    {
      num: "13",
      label: "Simulacoes FII / CRI-CRA",
      available: !!(data.fiiCra?.fii_simulations?.length || data.fiiCra?.cra_simulations?.length),
    },
  ];

  return (
    <View>
      <Text style={s.sectionTitle}>Sumario</Text>
      {items.map((item) => (
        <View key={item.num} style={s.tocEntry}>
          <Text style={s.tocNumber}>{item.num}</Text>
          <Text style={[s.tocLabel, !item.available && { color: "#a0aec0" }]}>
            {item.label}
            {!item.available && " (dados nao disponiveis)"}
          </Text>
        </View>
      ))}
    </View>
  );
}
