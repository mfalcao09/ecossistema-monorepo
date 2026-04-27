/**
 * Parcelamento de Solo — Tipos compartilhados
 *
 * Este arquivo é o "contrato" (schema TypeScript) usado por todas as
 * camadas do módulo Parcelamento: páginas, hooks, componentes, libs.
 *
 * ⚠️ IMPORTANTE: os valores literais de `analysis_status` e `tipo` aqui
 * refletem o que já é usado nas páginas existentes (Dashboard, Detalhe,
 * Financeiro, Conformidade, Novo). Se o schema do banco (migrations da
 * Fase 1) usar valores diferentes (ex: "pending" em inglês no lugar de
 * "pendente"), essa divergência precisa ser reconciliada em uma sessão
 * futura — por um mapper ou migração de dados.
 *
 * Criado na sessão 126 para destravar módulo Parcelamento (arquivos
 * ausentes da Fase 3 — nunca foram commitados no repositório).
 */

// ---------------------------------------------------------------------------
// Enums / Unions
// ---------------------------------------------------------------------------

/**
 * Tipos de empreendimento que correspondem a parcelamento horizontal.
 * Mapeados para os valores reais do ENUM `development_type` no banco:
 * - loteamento  → loteamento aberto (Lei 6.766)
 * - condominio  → condomínio horizontal fechado
 */
export type ParcelamentoTipo = "loteamento" | "condominio";

/**
 * Categoria do projeto — sessão 129, introduzida pela nova arquitetura
 * de Masterplan vs Parcelamento Individual.
 *
 * - individual       : projeto único (padrão) — 1 área, 1 cálculo, 1 fluxo
 * - masterplan       : CONTAINER com múltiplas fases/sub-projetos dentro
 * - masterplan_phase : sub-projeto (loteamento/comercial) dentro de um masterplan
 *
 * A coluna `parent_development_id` referencia o masterplan pai quando
 * `project_type = masterplan_phase`.
 */
export type ParcelamentoProjectType =
  | "individual"
  | "masterplan"
  | "masterplan_phase";

/** Estado da análise de viabilidade — em português porque é o que as páginas já usam.
 *  Sessão 130: introduzidos "rascunho" (wizard incompleto) e "em_analise"
 *  (wizard completo, aguardando processamento de viabilidade).
 *  Sessão 147 (Bloco L): adicionados "viavel", "rejeitado", "monitorando"
 *  — status de negócio pós-análise. Transições: concluido→viavel/rejeitado/monitorando,
 *  viavel→monitorando/rejeitado, rejeitado→monitorando. */
export type AnalysisStatus =
  | "rascunho"
  | "pendente"
  | "em_analise"
  | "em_processamento"
  | "concluido"
  | "erro"
  | "viavel"
  | "rejeitado"
  | "monitorando";

/** Tipo de empreendimento urbanístico — declarado no Step 4 do wizard. */
export type TipoParcelamento =
  | "loteamento_aberto"
  | "loteamento_fechado"
  | "condominio_lotes"
  | "desmembramento";

/** Padrão do empreendimento — declarado no Step 4 do wizard. */
export type PadraoEmpreendimento = "popular" | "medio" | "alto" | "luxo";

/** Status de cada item do checklist de conformidade */
export type ComplianceStatus =
  | "pass"
  | "warn"
  | "fail"
  | "na"
  | "pending"
  // Valores usados pela EF parcelamento-legal-analysis v1:
  | "violation"
  | "warning"
  | "compliant"
  | "missing_info";

// ---------------------------------------------------------------------------
// Legal Analysis (Bloco B — Fase 5)
// ---------------------------------------------------------------------------

export interface LegalViolation {
  check_key: string;
  article: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  recommendation: string;
}

export interface LegalCompliantItem {
  check_key: string;
  article: string;
  description: string;
}

export interface LegalMissingInfo {
  check_key: string;
  description: string;
}

export interface LegalCitation {
  source_title: string;
  article: string;
  excerpt: string;
}

export interface LegalAnalysisResult {
  analysis_id: string | null;
  compliance_score: number;
  summary: string;
  violations: LegalViolation[];
  warnings: LegalViolation[];
  compliant_items: LegalCompliantItem[];
  missing_info: LegalMissingInfo[];
  parecer_textual: string;
  citations: LegalCitation[];
  tokens: { input: number; output: number };
  model: string;
  rag_chunks_used: number;
}

export interface LegalAnalysisCached {
  id: string;
  tenant_id: string;
  development_id: string;
  analysis_type: string;
  compliance_score: number | null;
  violations: LegalViolation[];
  warnings: LegalViolation[];
  recommendations: LegalCompliantItem[];
  missing_info: LegalMissingInfo[];
  parecer_textual: string | null;
  citations: LegalCitation[];
  model_used: string;
  tokens_input: number | null;
  tokens_output: number | null;
  created_at: string;
}

/**
 * Chaves REAIS das camadas retornadas pela EF `development-geo-layers`.
 * ⚠️ Atualizado na sessão 129: os valores antigos (`sigef_imoveis`,
 * `sicar_car`, `ibge_setores`, `dnit_rodovias`) NÃO existiam na EF real —
 * causavam 400. Os valores abaixo batem com o código da EF em produção.
 *
 * Sessão 153 (ANEEL/EPE): adicionados `aneel_lt_existentes`,
 * `aneel_lt_planejadas`, `aneel_subestacoes` como camadas oficiais EPE
 * (com Tensão kV, Concessionária, Ano operação). `linhas_transmissao`
 * (Overpass) mantido como legacy/fallback — não exibido por padrão na UI.
 */
export type GeoLayerKey =
  | "sigef_privado"
  | "hidrografia"
  | "ibama_uc"
  | "rodovias_federais"
  | "linhas_transmissao" // legacy Overpass — fallback only
  | "aneel_lt_existentes" // EPE oficial — base existente
  | "aneel_lt_planejadas" // EPE oficial — expansão planejada
  | "aneel_subestacoes"; // EPE oficial — existentes + planejadas

/** Tipo de cenário financeiro (Fase 5 suporta múltiplos cenários simultâneos) */
export type FinancialScenarioType =
  | "conservador"
  | "realista"
  | "otimista"
  | "custom";

/** Origem da reserva legal — estadual tem precedência sobre SICAR */
export type ReservaLegalSource =
  | "estadual_sp"
  | "estadual_ms"
  | "estadual_mg"
  | "sicar_federal"
  | "estimativa";

/** Formato do arquivo de geometria original enviado pelo usuário */
export type ParcelamentoFileFormat =
  | "kml"
  | "kmz"
  | "dxf"
  | "geojson"
  | "shp"
  | "manual";

// ---------------------------------------------------------------------------
// Geometria e bounding box
// ---------------------------------------------------------------------------

export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

// ---------------------------------------------------------------------------
// Elevation Grid (Bloco D — Fase 5 — Three.js 3D)
// ---------------------------------------------------------------------------

/** Ponto individual no grid de elevação (SRTM 30m DEM) */
export interface ElevationPoint {
  lat: number;
  lng: number;
  elevation: number;
}

/**
 * Grid de elevação armazenado em `developments.elevation_grid` JSONB.
 * Gerado pela EF `development-elevation` (OpenTopography SRTM GL1 30m).
 * Max 20×20 pontos (downsampled se necessário).
 */
export interface ElevationGrid {
  resolution: string;
  sampleCount: number;
  coordinates: ElevationPoint[];
}

// ---------------------------------------------------------------------------
// Resultados de análise
// ---------------------------------------------------------------------------

/**
 * Resultado agregado da análise de viabilidade.
 * O campo `viabilidade_score` (0-100) é consumido no Dashboard para
 * classificar o projeto (verde ≥70, amarelo ≥45, vermelho <45).
 */
export interface AnalysisResults {
  viabilidade_score?: number;
  viabilidade_label?: string;
  geo?: Record<string, unknown>;
  financial?: Record<string, unknown>;
  legal?: Record<string, unknown>;
}

/**
 * Resultado dos cálculos urbanísticos (áreas úteis, verdes, sistema viário,
 * número estimado de lotes). Usado no Step 3 do wizard.
 */
export interface UrbanisticResult {
  area_util_m2?: number;
  area_verde_m2?: number;
  area_sistema_viario_m2?: number;
  area_institucional_m2?: number;
  lotes_qtd_estimada?: number;
  densidade_hab_ha?: number;
  alertas_lei6766?: string[];
}

// ---------------------------------------------------------------------------
// Projeto principal (developments)
// ---------------------------------------------------------------------------

/**
 * Representa um projeto de parcelamento de solo.
 * Mapeia a linha da tabela `developments` filtrada por `tipo IN (...)`.
 */
export interface ParcelamentoDevelopment {
  // Identificação
  id: string;
  tenant_id: string;
  user_id?: string | null;
  name: string;
  tipo: ParcelamentoTipo | null;

  // Masterplan hierarchy (sessão 129)
  project_type?: ParcelamentoProjectType | null;
  parent_development_id?: string | null;
  phase_order?: number | null;
  launch_date?: string | null;

  // Localização
  state: string | null;
  city: string | null;

  // Geometria (GeoJSON — pode vir como objeto ou string JSON do Postgres)
  geometry?: GeoJSON.MultiPolygon | GeoJSON.Polygon | string | null;
  centroid?: GeoJSON.Point | string | null;
  bbox?: BoundingBox | null;

  // Medidas
  area_m2?: number | null;
  area_ha?: number | null;
  perimeter_m?: number | null;

  // Elevação (SRTM / OpenTopography)
  elevation_min?: number | null;
  elevation_max?: number | null;
  elevation_avg?: number | null;
  slope_avg_pct?: number | null;

  // Ambiental
  app_area_m2?: number | null;
  reserva_legal_area_m2?: number | null;
  reserva_legal_pct?: number | null;
  reserva_legal_source?: ReservaLegalSource | null;

  // Parâmetros de parcelamento
  total_units?: number | null;
  vgv_estimado?: number | null;

  // Parâmetros urbanísticos declarados (Sessão 130 — Step 4 do wizard)
  tipo_parcelamento?: TipoParcelamento | null;
  padrao_empreendimento?: PadraoEmpreendimento | null;
  pct_area_publica?: number | null;
  pct_area_verde?: number | null;
  pct_sistema_viario?: number | null;
  pct_app_declarado?: number | null;
  lote_minimo_m2?: number | null;
  description?: string | null;

  // Análise de viabilidade
  analysis_status: AnalysisStatus | null;
  analysis_results?: AnalysisResults | null;

  // Arquivo de origem
  source_file_url?: string | null;
  source_file_format?: ParcelamentoFileFormat | null;
  source_file_name?: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;

  // Soft delete (Bloco L — Sessão 147)
  deleted_at?: string | null;

  // Geo avançado (Bloco J — Sessão 148)
  /** US-65: Áreas de exclusão custom (lago, risco etc.) — [{id, name, coordinates, area_m2}] */
  exclusion_areas?: ExclusionArea[] | null;
  /** US-60/62: Coordenadas do polígono principal [[lng,lat],...] em WGS-84 (JSONB espelho do geometry) */
  geometry_coordinates?: [number, number][] | null;
}

/** Área de exclusão customizada (US-65 Bloco J) */
export interface ExclusionArea {
  id: string;
  name: string;
  /** Tipo de exclusão para UX */
  type: "lago" | "risco_geologico" | "servidao" | "reservatorio" | "outro";
  /** Polígono em [lng, lat][] WGS-84 */
  coordinates: [number, number][];
  /** Área em m² (calculada via Turf) */
  area_m2: number;
  /** ISO timestamp de criação */
  created_at: string;
}

// ---------------------------------------------------------------------------
// Análise financeira (Fase 5)
// ---------------------------------------------------------------------------

/** Linha do fluxo de caixa mês-a-mês */
export interface CashFlowEntry {
  mes: number;
  entrada: number;
  saida: number;
  saldo: number;
  saldo_acumulado?: number;
}

// ---------------------------------------------------------------------------
// Monte Carlo result (EF parcelamento-financial-calc action=run_monte_carlo)
// ---------------------------------------------------------------------------

export interface MonteCarloKpiStats {
  mean: number;
  std?: number;
  p5: number;
  p25?: number;
  p50: number;
  p75?: number;
  p95: number;
  prob_positive?: number;
  prob_above_desconto?: number;
  histogram?: { bucket_min: number; bucket_max: number; count: number }[];
}

export interface MonteCarloResult {
  config: {
    iterations: number;
    vgv_variation_pct: number;
    custo_variation_pct: number;
    velocidade_variation_pct: number;
  };
  vpl: MonteCarloKpiStats;
  tir_anual: MonteCarloKpiStats;
  payback_meses: { mean: number; p50: number; p95: number };
  margem_liquida_pct: { mean: number; p5: number; p50: number; p95: number };
  elapsed_ms: number;
}

// ---------------------------------------------------------------------------
// Sensitivity result (EF action=compute_sensitivity)
// ---------------------------------------------------------------------------

export interface SensitivityBarKpi {
  base: number;
  low: number;
  high: number;
  delta_low: number;
  delta_high: number;
  impact_range: number;
}

export interface SensitivityBar {
  variable: string;
  label: string;
  variation_type: "MULTIPLICATIVE" | "ADDITIVE_PP" | "INTEGER";
  base_value: number;
  low_value: number;
  high_value: number;
  vpl: SensitivityBarKpi;
  tir_anual: SensitivityBarKpi;
  payback_meses: SensitivityBarKpi;
  margem_liquida_pct: SensitivityBarKpi;
  skipped?: boolean;
  skip_reason?: string;
}

export interface SensitivityResult {
  config: {
    variation_pct: number;
    variation_pp: number;
    variables: string[];
  };
  baseline: {
    vpl: number;
    tir_anual: number | null;
    payback_meses: number | null;
    margem_liquida_pct: number;
  };
  bars: SensitivityBar[];
  tornado_by_vpl: SensitivityBar[];
  tornado_by_tir: SensitivityBar[];
  elapsed_ms: number;
}

// ---------------------------------------------------------------------------
// Efficient Frontier result (EF action=efficient_frontier)
// ---------------------------------------------------------------------------

export interface EfficientFrontierPoint {
  equity_pct: number;
  divida_pct: number;
  vpl: number;
  vpl_wacc: number | null;
  tir_anual: number | null;
  payback_meses: number | null;
  margem_liquida_pct: number;
  wacc_pct: number;
  performance_score: number;
  dominated: boolean;
  realistic: boolean;
}

export interface EfficientFrontierOptimal {
  by_vpl_wacc: EfficientFrontierPoint | null;
  by_tir: EfficientFrontierPoint | null;
  by_min_wacc: EfficientFrontierPoint | null;
  by_performance_score: EfficientFrontierPoint | null;
}

export interface EfficientFrontierResult {
  config: {
    equity_min_pct: number;
    equity_max_pct: number;
    step_pct: number;
    realistic_max_divida_pct: number;
  };
  points: EfficientFrontierPoint[];
  optimal: EfficientFrontierOptimal;
  optimal_realistic: EfficientFrontierOptimal;
  elapsed_ms: number;
}

export interface ParcelamentoFinancial {
  id: string;
  development_id: string;
  tenant_id: string;
  version: number;
  scenario_type: FinancialScenarioType;
  scenario_label?: string | null;

  // Premissas monetárias
  vgv_total?: number | null;
  custo_obra_total?: number | null;
  custo_terreno?: number | null;
  custo_legalizacao?: number | null;
  custo_marketing?: number | null;
  custo_comissoes?: number | null;
  cub_referencia?: number | null;

  // Prazos
  prazo_obra_meses?: number | null;

  // Fluxo de caixa
  fluxo_caixa?: CashFlowEntry[] | null;

  // KPIs calculados
  payback_meses?: number | null;
  payback_descontado_meses?: number | null;
  tir_anual?: number | null;
  vpl?: number | null;
  vpl_wacc?: number | null;
  wacc_pct?: number | null;
  margem_liquida_pct?: number | null;
  performance_score?: number | null;

  // Blocos JSONB flexíveis
  premissas?: Record<string, unknown> | null;
  capital_structure?: Record<string, unknown> | null;
  monte_carlo?: MonteCarloResult | null;
  sensitivity?: SensitivityResult | null;
  efficient_frontier?: EfficientFrontierResult | null;
  kpi_metadata?: Record<string, unknown> | null;

  // IA
  ai_summary?: string | null;

  // Status de cálculo
  is_calculated: boolean;
  calculated_at?: string | null;

  // Timestamps
  created_at: string;
  created_by?: string | null;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Conformidade legal
// ---------------------------------------------------------------------------

export interface ParcelamentoCompliance {
  id: string;
  development_id: string;
  tenant_id: string;

  // Identificação do check
  check_key: string;
  check_label: string;
  legal_basis?: string | null;

  // Valores
  required_value?: string | null;
  actual_value?: string | null;

  // Status
  status: ComplianceStatus;

  // Explicação pela IA (Gemini 3.1 Pro na Fase 5)
  ai_explanation?: string | null;
  ai_explanation_model?: string | null;

  // Timestamps
  evaluated_at: string;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Arquivos, camadas geo, relatórios
// ---------------------------------------------------------------------------

export interface ParcelamentoFile {
  id: string;
  development_id: string;
  tenant_id: string;
  uploaded_by: string;
  file_name: string;
  storage_path: string;
  file_type: ParcelamentoFileFormat;
  file_size_bytes?: number | null;
  created_at: string;
}

export interface ParcelamentoGeoLayer {
  id: string;
  development_id: string;
  tenant_id: string;
  layer_key: GeoLayerKey;
  geojson: GeoJSON.FeatureCollection;
  source?: string | null;
  fetched_at: string;
}

export interface ParcelamentoReport {
  id: string;
  development_id: string;
  tenant_id: string;
  report_type: "executivo" | "tecnico";
  pdf_url: string;
  generated_by: string;
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Wizard de novo projeto (ParcelamentoNovo.tsx)
// ---------------------------------------------------------------------------

export interface NewProjectStep1 {
  name: string;
  tipo: ParcelamentoTipo;
  state: string;
  city: string;
}

export interface NewProjectStep2 {
  geometry?: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  bbox?: BoundingBox;
  file_name?: string;
  file_format?: ParcelamentoFileFormat;
  area_m2?: number;
  perimeter_m?: number;
}

/**
 * Step 3 (Sessão 130 — novo fluxo): mapa + dados de localização e descrição.
 * A cidade é cravada via reverse geocoding (não "Região Metropolitana"),
 * área em m² (não hectares), descrição opcional.
 */
export interface NewProjectStep3 {
  city?: string;
  state?: string;
  description?: string;
  area_m2?: number;
  perimeter_m?: number;
}

/**
 * Step 4 (Sessão 130): parâmetros urbanísticos declarados.
 * A soma dos percentuais (pública + verde + viário + APP) deve ser ≤ 100 —
 * o restante vira "Área Líquida de Lotes".
 */
export interface NewProjectStep4 {
  tipo_parcelamento?: TipoParcelamento;
  padrao_empreendimento?: PadraoEmpreendimento;
  pct_area_publica?: number;
  pct_area_verde?: number;
  pct_sistema_viario?: number;
  pct_app_declarado?: number;
  lote_minimo_m2?: number;
}

export interface NewProjectWizardState {
  step1?: NewProjectStep1;
  step2?: NewProjectStep2;
  step3?: NewProjectStep3;
  step4?: NewProjectStep4;
}

// ---------------------------------------------------------------------------
// Payloads de mutation
// ---------------------------------------------------------------------------

export interface CreateParcelamentoProjectPayload {
  name: string;
  tipo: ParcelamentoTipo;
  state: string;
  city: string;
}

export interface UpdateParcelamentoGeometryPayload {
  projectId: string;
  geometry: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  bbox: BoundingBox;
  area_m2?: number;
  perimeter_m?: number;
  file_name?: string;
  file_format?: ParcelamentoFileFormat;
}

export interface SaveAnalysisResultsPayload {
  projectId: string;
  analysis_results: AnalysisResults;
  vgv_estimado?: number;
  total_units?: number;
}

/**
 * Payload do Step 3 (localização finalizada) + Step 4 (parâmetros urbanísticos)
 * do novo wizard (Sessão 130). Usado pelo hook `useUpdateParcelamentoParams`.
 *
 * Marca o projeto como "em_analise" ao concluir o wizard.
 */
export interface UpdateParcelamentoParamsPayload {
  projectId: string;
  // Step 3 — localização
  city?: string | null;
  state?: string | null;
  description?: string | null;
  // Step 4 — parâmetros urbanísticos
  tipo_parcelamento?: TipoParcelamento | null;
  padrao_empreendimento?: PadraoEmpreendimento | null;
  pct_area_publica?: number | null;
  pct_area_verde?: number | null;
  pct_sistema_viario?: number | null;
  pct_app_declarado?: number | null;
  lote_minimo_m2?: number | null;
  // Marca para concluir o wizard → "em_analise"
  finalize?: boolean;
}
