/**
 * types.ts — Props do Relatorio Tecnico PDF
 * Sessao 146 — Bloco K (Relatorios e Exportacao)
 *
 * Agrega TODOS os dados que alimentam as 15 secoes do relatorio.
 */
import type {
  ParcelamentoDevelopment,
  ParcelamentoFinancial,
  LegalAnalysisCached,
} from "@/lib/parcelamento/types";
import type {
  ItbiResult,
  OutorgaResult,
  LeiVerdeResult,
  CnpjSpeResult,
} from "@/lib/parcelamento/brazil-regulations-types";
import type {
  SinapiResult,
  SecoviResult,
  AbraincResult,
} from "@/lib/parcelamento/market-benchmarks-types";
import type {
  CensusIncomeItem,
  CensusDemographicsItem,
  CensusHousingItem,
} from "@/lib/parcelamento/ibge-census-types";
import type {
  CheckIbamaResult,
  CheckICMBioResult,
} from "@/lib/parcelamento/environmental-embargoes-types";
import type {
  MapBiomasYearResult,
  TimeSeriesTrend,
} from "@/lib/parcelamento/mapbiomas-types";
import type { MatriculaRecord } from "@/lib/parcelamento/cri-matricula-types";

/* ─── Zoneamento ─── */
export interface ZoneamentoPDFData {
  municipio?: string;
  zona?: string;
  classificacao?: string;
  uso_permitido?: string;
  lei_municipal?: string;
  coeficiente_aproveitamento?: {
    minimo?: number;
    basico?: number;
    maximo?: number;
  };
  gabarito?: {
    altura_maxima_m?: number;
    pavimentos_maximos?: number;
  };
  recuos?: {
    frontal_m?: number;
    lateral_m?: number;
    fundos_m?: number;
    entre_blocos_m?: number;
  };
  taxa_ocupacao_max?: number;
  taxa_permeabilidade_min?: number;
  observacoes?: string;
}

/* ─── Memorial Descritivo ─── */
export interface MemorialVertex {
  label?: string;
  lat?: number;
  lng?: number;
  confrontante?: string;
}

export interface MemorialPDFData {
  proprietario?: string;
  matricula?: string;
  area_total_m2?: number;
  perimetro_m?: number;
  vertices?: MemorialVertex[];
  memorial_text?: string;
}

/* ─── FII / CRI-CRA ─── */
export interface FiiSimulationPDF {
  patrimonio_liquido?: number;
  valor_cota?: number;
  total_cotas?: number;
  dividend_yield?: number;
  tir_investidor?: number;
  vpl?: number;
}

export interface CriCraTranche {
  serie?: string;
  valor?: number;
  taxa?: number;
  prazo_meses?: number;
  rating?: string;
  subordinacao?: string;
}

export interface CriCraSimulationPDF {
  valor_emissao?: number;
  taxa_juros?: number;
  prazo_meses?: number;
  wal?: number;
  tir_emissao?: number;
  spread_cdi?: number;
  tranches?: CriCraTranche[];
}

export interface FiiCraPDFData {
  fii?: FiiSimulationPDF | null;
  criCra?: CriCraSimulationPDF | null;
  comparativo?: string | null;
}

/**
 * Props consolidadas do Relatorio Tecnico.
 * Todos os campos sao opcionais — secoes ausentes sao omitidas do PDF.
 */
export interface ReportTecnicoPDFProps {
  project: ParcelamentoDevelopment;
  financial?: ParcelamentoFinancial | null;
  legalAnalysis?: LegalAnalysisCached | null;

  // Regulacoes Brasil
  itbi?: ItbiResult | null;
  outorga?: OutorgaResult | null;
  leiVerde?: LeiVerdeResult | null;
  cnpjSpe?: CnpjSpeResult | null;

  // Benchmarks
  sinapi?: SinapiResult | null;
  secovi?: SecoviResult | null;
  abrainc?: AbraincResult | null;

  // Censo IBGE
  censusIncome?: CensusIncomeItem[] | null;
  censusDemographics?: CensusDemographicsItem[] | null;
  censusHousing?: CensusHousingItem[] | null;

  // Embargos
  ibamaResult?: CheckIbamaResult | null;
  icmbioResult?: CheckICMBioResult | null;

  // MapBiomas
  mapBiomasLatest?: MapBiomasYearResult | null;
  mapBiomasTrend?: TimeSeriesTrend | null;

  // Zoneamento
  zoneamento?: ZoneamentoPDFData | null;

  // Memorial Descritivo
  memorial?: MemorialPDFData | null;

  // CRI Matricula
  matriculas?: MatriculaRecord[] | null;

  // FII/CRA
  fiiCra?: FiiCraPDFData | null;
}
