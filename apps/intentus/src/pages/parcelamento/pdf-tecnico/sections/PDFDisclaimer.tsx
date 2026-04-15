/**
 * PDFDisclaimer.tsx — Secao Final: Disclaimer e Nota Legal
 * Sessao 146 — Bloco K
 */
import { View, Text } from "@react-pdf/renderer";
import { s, colors } from "../pdfStyles";

export default function PDFDisclaimer() {
  return (
    <View>
      <Text style={s.sectionTitle}>Nota Legal</Text>

      <Text style={s.paragraph}>
        Este relatorio tecnico foi gerado automaticamente pela plataforma Intentus Real Estate com
        base em dados fornecidos pelo usuario, fontes publicas e modelos de inteligencia artificial.
        As informacoes contidas neste documento tem carater exclusivamente informativo e nao
        constituem parecer tecnico profissional, aconselhamento juridico, financeiro ou urbanistico.
      </Text>

      <Text style={[s.paragraph, { marginTop: 6 }]}>
        Os dados de mercado (SINAPI, SECOVI, ABRAINC), censitarios (IBGE), ambientais (IBAMA,
        ICMBio, MapBiomas) e regulatorios (ITBI, Outorga, Zoneamento) sao obtidos de fontes
        publicas e podem estar sujeitos a atualizacoes, correcoes ou divergencias. Recomenda-se
        a verificacao independente junto aos orgaos competentes.
      </Text>

      <Text style={[s.paragraph, { marginTop: 6 }]}>
        Projecoes financeiras, simulacoes de Monte Carlo, analises de sensibilidade e cenarios
        de estruturacao (FII, CRI/CRA) sao baseados em premissas informadas e modelos
        estatisticos. Resultados reais podem diferir significativamente das projecoes apresentadas.
      </Text>

      <Text style={[s.paragraph, { marginTop: 6 }]}>
        A analise de conformidade legal e baseada em legislacao vigente (Lei 6.766/79, Lei 4.591/64,
        Estatuto da Cidade, Codigo Florestal) e nao substitui consultoria juridica especializada.
        O memorial descritivo deve ser validado por profissional habilitado com ART/RRT.
      </Text>

      <Text style={[s.paragraph, { marginTop: 6, fontFamily: "Helvetica-Bold" }]}>
        Intentus Real Estate — Tecnologia para Decisoes Imobiliarias Inteligentes
      </Text>

      <Text style={{ fontSize: 7, color: colors.gray500, marginTop: 10 }}>
        © {new Date().getFullYear()} Intentus Real Estate. Todos os direitos reservados.
        Este documento e confidencial e destinado exclusivamente ao destinatario autorizado.
      </Text>
    </View>
  );
}
