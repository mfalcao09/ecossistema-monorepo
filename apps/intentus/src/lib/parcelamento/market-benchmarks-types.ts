/**
 * Tipos para a Edge Function market-benchmarks v1
 *
 * Sessão 142 — Bloco H Sprint 2 (Benchmarks de Mercado)
 * US-121 (SINAPI), US-122 (SECOVI), US-123 (ABRAINC)
 *
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

// ============================================================
// US-121: SINAPI — Catálogo de Custos de Construção (CEF)
// ============================================================

/** Referência a um insumo do catálogo SINAPI */
export interface SinapiItem {
  codigo: string;
  descricao: string;
  unidade: string;
  custo_material: number;
  custo_mao_obra: number;
  custo_total: number;
  /** UF de referência dos preços */
  uf: string;
  /** Mês/ano de referência (ex: "2026-03") */
  referencia: string;
  /** Grupo/capítulo SINAPI */
  grupo: string;
  /** Se é composição (true) ou insumo simples (false) */
  is_composicao: boolean;
}

export interface SinapiRequest {
  action: "fetch_sinapi";
  /** UF para busca de preços (SP, RJ, MG, etc.) */
  uf: string;
  /** Código SINAPI exato (ex: "73964") */
  codigo?: string;
  /** Busca textual na descrição */
  busca?: string;
  /** Filtrar por grupo/capítulo */
  grupo?: string;
  /** Limitar resultados (default: 20) */
  limit?: number;
  /** development_id para cruzar com premissas */
  development_id?: string;
}

export interface SinapiCrossReference {
  /** Código SINAPI da premissa do projeto */
  sinapi_ref: string;
  /** Item de infraestrutura do projeto */
  item_projeto: string;
  /** Custo unitário usado no projeto (R$) */
  custo_projeto: number;
  /** Custo SINAPI mais recente (R$) */
  custo_sinapi: number;
  /** Desvio percentual: (projeto - sinapi) / sinapi * 100 */
  desvio_pct: number;
  /** "abaixo" | "dentro" | "acima" da faixa SINAPI */
  status: "abaixo" | "dentro" | "acima";
}

export interface SinapiResult {
  uf: string;
  referencia: string;
  total_encontrados: number;
  itens: SinapiItem[];
  /** Se development_id foi passado, cruzamento com premissas do projeto */
  cross_references?: SinapiCrossReference[];
  /** Resumo de custos médios por grupo */
  resumo_por_grupo?: Record<string, { media: number; min: number; max: number; qtd: number }>;
  fonte: string;
  nota: string;
}

// ============================================================
// US-122: SECOVI — Benchmarks Imobiliários
// ============================================================

/** Índice de preço por m² numa região */
export interface SecoviPrecoM2 {
  cidade: string;
  uf: string;
  regiao?: string;
  tipo_imovel: string;
  preco_m2_medio: number;
  preco_m2_min: number;
  preco_m2_max: number;
  variacao_12m_pct: number;
  referencia: string;
}

/** Indicador de velocidade de vendas */
export interface SecoviVelocidadeVendas {
  cidade: string;
  uf: string;
  tipo_imovel: string;
  /** Índice de Velocidade de Vendas (IVV) — % de unidades vendidas/lançadas */
  ivv_pct: number;
  /** Meses de estoque (oferta / vendas mensais) */
  meses_estoque: number;
  /** Absorção líquida mensal (unidades) */
  absorcao_liquida: number;
  referencia: string;
}

export interface SecoviRequest {
  action: "fetch_secovi";
  /** Cidade alvo (ex: "São Paulo", "Campinas") */
  cidade?: string;
  /** UF para filtrar dados regionais */
  uf?: string;
  /** Tipo de imóvel: "lote", "casa", "apartamento", "comercial" */
  tipo_imovel?: string;
  /** development_id para comparação automática */
  development_id?: string;
}

export interface SecoviComparativo {
  /** Preço/m² do projeto */
  preco_m2_projeto: number;
  /** Preço/m² médio SECOVI da região */
  preco_m2_mercado: number;
  /** Desvio percentual */
  desvio_pct: number;
  /** Posição: "abaixo_mercado" | "na_media" | "acima_mercado" | "premium" */
  posicao: "abaixo_mercado" | "na_media" | "acima_mercado" | "premium";
  /** IVV regional para referência */
  ivv_regional_pct: number;
  /** Recomendação textual */
  recomendacao: string;
}

export interface SecoviResult {
  precos: SecoviPrecoM2[];
  velocidade_vendas: SecoviVelocidadeVendas[];
  comparativo?: SecoviComparativo;
  total_cidades: number;
  referencia: string;
  fonte: string;
  nota: string;
}

// ============================================================
// US-123: ABRAINC — Indicadores do Setor
// ============================================================

/** Dados de lançamentos por região */
export interface AbraincLancamento {
  regiao: string;
  uf: string;
  tipo_programa: string;
  unidades_lancadas: number;
  unidades_vendidas: number;
  pct_vendido: number;
  vgv_lancado_milhoes: number;
  variacao_12m_pct: number;
  referencia: string;
}

/** Indicador de performance de incorporadoras */
export interface AbraincPerformance {
  segmento: string;
  /** Velocidade de vendas sobre oferta (VSO) */
  vso_pct: number;
  /** Distratos / vendas brutas */
  taxa_distrato_pct: number;
  /** Margem bruta média do segmento */
  margem_bruta_pct: number;
  /** Prazo médio de construção (meses) */
  prazo_medio_obra_meses: number;
  referencia: string;
}

export interface AbraincRequest {
  action: "fetch_abrainc";
  /** Região alvo: "Sudeste", "Sul", "Nordeste", etc. */
  regiao?: string;
  /** UF específica */
  uf?: string;
  /** Segmento: "MCMV", "MAP", "alto_padrao", "loteamento" */
  segmento?: string;
  /** development_id para comparação */
  development_id?: string;
}

export interface AbraincComparativo {
  /** VSO do projeto estimado */
  vso_projeto_pct: number;
  /** VSO médio ABRAINC do segmento */
  vso_segmento_pct: number;
  /** Status: "abaixo" | "na_media" | "acima" */
  posicao_vso: "abaixo" | "na_media" | "acima";
  /** Distrato estimado vs mercado */
  distrato_projeto_pct: number;
  distrato_segmento_pct: number;
  /** Recomendação */
  recomendacao: string;
}

export interface AbraincResult {
  lancamentos: AbraincLancamento[];
  performance: AbraincPerformance[];
  comparativo?: AbraincComparativo;
  total_regioes: number;
  referencia: string;
  fonte: string;
  nota: string;
}

// ============================================================
// Union types
// ============================================================

export type MarketBenchmarksRequest =
  | SinapiRequest
  | SecoviRequest
  | AbraincRequest;

export type MarketBenchmarksResult =
  | SinapiResult
  | SecoviResult
  | AbraincResult;
