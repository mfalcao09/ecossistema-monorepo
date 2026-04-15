/**
 * ReportTecnicoPDF.tsx — Orquestrador do Relatorio Tecnico PDF
 * Sessao 146 — Bloco K (Relatorios e Exportacao)
 *
 * Monta um Document com 10-20 paginas, delegando cada secao
 * para sub-componentes modulares. Secoes com dados ausentes
 * sao omitidas automaticamente.
 */
import { Document } from "@react-pdf/renderer";
import PDFPageWrapper from "./PDFPageWrapper";
import PDFCover from "./sections/PDFCover";
import PDFTableOfContents from "./sections/PDFTableOfContents";
import PDFTerreno from "./sections/PDFTerreno";
import PDFUrbanistico from "./sections/PDFUrbanistico";
import PDFFinanceiro from "./sections/PDFFinanceiro";
import PDFLegal from "./sections/PDFLegal";
import PDFRegulacoes from "./sections/PDFRegulacoes";
import PDFBenchmarks from "./sections/PDFBenchmarks";
import PDFCenso from "./sections/PDFCenso";
import PDFEmbargos from "./sections/PDFEmbargos";
import PDFMapBiomas from "./sections/PDFMapBiomas";
import PDFZoneamento from "./sections/PDFZoneamento";
import PDFMemorial from "./sections/PDFMemorial";
import PDFMatricula from "./sections/PDFMatricula";
import PDFSimulacoes from "./sections/PDFSimulacoes";
import PDFDisclaimer from "./sections/PDFDisclaimer";
import type { ReportTecnicoPDFProps } from "./types";

export default function ReportTecnicoPDF(props: ReportTecnicoPDFProps) {
  const {
    project,
    financial,
    legalAnalysis,
    itbi,
    outorga,
    leiVerde,
    cnpjSpe,
    sinapi,
    secovi,
    abrainc,
    censusIncome,
    censusDemographics,
    censusHousing,
    ibamaResult,
    icmbioResult,
    mapBiomasLatest,
    mapBiomasTrend,
    zoneamento,
    memorial,
    matriculas,
    fiiCra,
  } = props;

  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const projectName = project?.name ?? "Empreendimento";

  return (
    <Document
      title={`Relatorio Tecnico — ${projectName}`}
      author="Intentus Real Estate"
      subject="Analise Tecnica de Parcelamento de Solo"
      creator="Intentus Real Estate Platform"
    >
      {/* ───── Capa ───── */}
      <PDFCover project={project} dateStr={dateStr} />

      {/* ───── Sumario ───── */}
      <PDFPageWrapper projectName={projectName} dateStr={dateStr}>
        <PDFTableOfContents
          hasFinancial={!!financial}
          hasLegal={!!legalAnalysis}
          hasRegulacoes={!!(itbi || outorga || leiVerde || cnpjSpe)}
          hasBenchmarks={!!(sinapi || secovi || abrainc)}
          hasCenso={!!(censusIncome?.length || censusDemographics?.length || censusHousing?.length)}
          hasEmbargos={!!(ibamaResult?.data || icmbioResult?.data)}
          hasMapBiomas={!!(mapBiomasLatest || mapBiomasTrend)}
          hasZoneamento={!!zoneamento}
          hasMemorial={!!memorial}
          hasMatricula={!!(matriculas && matriculas.length > 0)}
          hasSimulacoes={!!fiiCra}
        />
      </PDFPageWrapper>

      {/* ───── Secao 1: Terreno ───── */}
      <PDFPageWrapper projectName={projectName} dateStr={dateStr}>
        <PDFTerreno project={project} />
      </PDFPageWrapper>

      {/* ───── Secao 2: Urbanistico ───── */}
      <PDFPageWrapper projectName={projectName} dateStr={dateStr}>
        <PDFUrbanistico project={project} />
      </PDFPageWrapper>

      {/* ───── Secao 3: Financeiro ───── */}
      {financial && (
        <PDFPageWrapper projectName={projectName} dateStr={dateStr}>
          <PDFFinanceiro financial={financial} />
        </PDFPageWrapper>
      )}

      {/* ───── Secao 4: Legal ───── */}
      {legalAnalysis && (
        <PDFPageWrapper projectName={projectName} dateStr={dateStr}>
          <PDFLegal legalAnalysis={legalAnalysis} />
        </PDFPageWrapper>
      )}

      {/* ───── Secao 5: Regulacoes ───── */}
      {(itbi || outorga || leiVerde || cnpjSpe) && (
        <PDFPageWrapper projectName={projectName} dateStr={dateStr}>
          <PDFRegulacoes itbi={itbi} outorga={outorga} leiVerde={leiVerde} cnpjSpe={cnpjSpe} />
        </PDFPageWrapper>
      )}

      {/* ───── Secao 6: Benchmarks ───── */}
      {(sinapi || secovi || abrainc) && (
        <PDFPageWrapper projectName={projectName} dateStr={dateStr}>
          <PDFBenchmarks sinapi={sinapi} secovi={secovi} abrainc={abrainc} />
        </PDFPageWrapper>
      )}

      {/* ───── Secao 7: Censo IBGE ───── */}
      {(censusIncome?.length || censusDemographics?.length || censusHousing?.length) && (
        <PDFPageWrapper projectName={projectName} dateStr={dateStr}>
          <PDFCenso income={censusIncome} demographics={censusDemographics} housing={censusHousing} />
        </PDFPageWrapper>
      )}

      {/* ───── Secao 8: Embargos ───── */}
      {(ibamaResult?.data || icmbioResult?.data) && (
        <PDFPageWrapper projectName={projectName} dateStr={dateStr}>
          <PDFEmbargos ibamaResult={ibamaResult} icmbioResult={icmbioResult} />
        </PDFPageWrapper>
      )}

      {/* ───── Secao 9: MapBiomas ───── */}
      {(mapBiomasLatest || mapBiomasTrend) && (
        <PDFPageWrapper projectName={projectName} dateStr={dateStr}>
          <PDFMapBiomas landUse={mapBiomasLatest} trend={mapBiomasTrend} />
        </PDFPageWrapper>
      )}

      {/* ───── Secao 10: Zoneamento ───── */}
      {zoneamento && (
        <PDFPageWrapper projectName={projectName} dateStr={dateStr}>
          <PDFZoneamento zoneamento={zoneamento} />
        </PDFPageWrapper>
      )}

      {/* ───── Secao 11: Memorial Descritivo ───── */}
      {memorial && (
        <PDFPageWrapper projectName={projectName} dateStr={dateStr}>
          <PDFMemorial memorial={memorial} />
        </PDFPageWrapper>
      )}

      {/* ───── Secao 12: Matricula ───── */}
      {matriculas && matriculas.length > 0 && (
        <PDFPageWrapper projectName={projectName} dateStr={dateStr}>
          <PDFMatricula matricula={matriculas[0]} />
        </PDFPageWrapper>
      )}

      {/* ───── Secao 13: Simulacoes ───── */}
      {fiiCra && (
        <PDFPageWrapper projectName={projectName} dateStr={dateStr}>
          <PDFSimulacoes fiiCra={fiiCra} />
        </PDFPageWrapper>
      )}

      {/* ───── Disclaimer ───── */}
      <PDFPageWrapper projectName={projectName} dateStr={dateStr}>
        <PDFDisclaimer />
      </PDFPageWrapper>
    </Document>
  );
}
