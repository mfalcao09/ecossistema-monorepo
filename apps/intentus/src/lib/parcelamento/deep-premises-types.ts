/**
 * Premissas Profundas — Bloco F (Parcelamento de Solo)
 *
 * Types para o modal de 4 abas: Projeto / Vendas / Terreno / Custos.
 * Armazenado como JSONB na coluna `deep_premises` da tabela
 * `development_parcelamento_scenarios`.
 *
 * Sessão 138 — Claudinho + Buchecha (MiniMax M2.7)
 */

// ---------------------------------------------------------------------------
// Aba 1: Projeto
// ---------------------------------------------------------------------------

/** Tipo do empreendimento (loteamento aberto vs fechado) */
export type TipoEmpreendimento = "aberto" | "fechado";

export interface ProjectPremises {
  /** Nome do cenário (ex: "Cenário Realista — Abr/2026") */
  nome: string;
  /** Tipo do empreendimento */
  tipo_empreendimento: TipoEmpreendimento;
  /** Total de lotes planejados */
  total_lotes: number;
  /** Área média do lote em m² */
  area_media_lote_m2: number;
  /** Preço médio por m² de lote (R$/m²) */
  preco_m2: number;
  /** Prazo de obra em meses */
  prazo_obra_meses: number;
  /** Prazo de comercialização em meses */
  prazo_comercializacao_meses: number;
  /** Mês de início das vendas (0 = no lançamento) */
  mes_inicio_vendas: number;
}

// ---------------------------------------------------------------------------
// Aba 2: Vendas
// ---------------------------------------------------------------------------

/** Índice de correção monetária */
export type IndiceCorrecao = "IPCA" | "INCC" | "IGPM" | "nenhum";

export interface SalesPremises {
  /** Velocidade de vendas — % do VGV vendido por mês */
  velocidade_vendas_pct_mes: number;
  /** % de entrada no ato da compra */
  entrada_pct: number;
  /** Quantidade de parcelas mensais */
  parcelas_qtd: number;
  /** % de balão final (última parcela reforçada) */
  balao_final_pct: number;
  /** % de vendas à vista (sobre o total de lotes) */
  vendas_vista_pct: number;
  /** % de desconto para pagamento à vista */
  desconto_vista_pct: number;
  /** Juros do parcelamento ao mês (%) — 0 = sem juros */
  juros_parcelamento_pct_mes: number;
  /** Índice de correção monetária das parcelas */
  indice_correcao: IndiceCorrecao;
  /** Taxa mensal do índice de correção (%) — calculada ou informada */
  indice_correcao_mensal_pct: number;
  /** Comissão do corretor (%) — sobre o preço de venda */
  comissao_corretor_pct: number;
  /** % de inadimplência esperada */
  inadimplencia_pct: number;
}

// ---------------------------------------------------------------------------
// Aba 3: Terreno
// ---------------------------------------------------------------------------

/** Modalidade de aquisição do terreno */
export type ModalidadeTerreno = "a_vista" | "parcelada" | "permuta_fisica" | "permuta_financeira";

export interface LandPremises {
  /** Modalidade de aquisição do terreno */
  modalidade: ModalidadeTerreno;
  /** Valor total do terreno (R$) */
  valor_terreno: number;
  /** Quantidade de parcelas (se modalidade = "parcelada") */
  parcelas_terreno: number;
  /** Juros das parcelas do terreno ao mês (%) */
  juros_terreno_pct_mes: number;
  /** % de permuta em lotes (se modalidade = "permuta_fisica") */
  permuta_lotes_pct: number;
  /** % de permuta financeira sobre VGV (se modalidade = "permuta_financeira") */
  permuta_financeira_pct: number;
  /** Comissão do corretor do terreno (%) */
  comissao_terreno_pct: number;
  /** Split da comissão: % que vai para o empreendedor (resto vai pro terreneiro) */
  split_empreendedor_pct: number;
}

// ---------------------------------------------------------------------------
// Aba 4: Custos
// ---------------------------------------------------------------------------

/** Tipo de pavimentação */
export type TipoPavimentacao = "PAVER" | "CBUQ" | "sem_pavimentacao";

/** Tipo de meio-fio */
export type TipoMeioFio = "concreto_extrudado" | "concreto_pre_moldado" | "granito" | "nenhum";

/** Tipo de rede elétrica */
export type TipoRedeEletrica = "aerea" | "subterranea";

/** Item de infraestrutura — cada categoria com toggle ON/OFF */
export interface InfrastructureItem {
  /** Identificador único da categoria */
  id: InfrastructureCategoryId;
  /** Nome amigável */
  label: string;
  /** Toggle ON/OFF */
  enabled: boolean;
  /** Custo unitário (R$/m² ou R$/m linear, conforme categoria) */
  custo_unitario: number;
  /** Unidade de medida (m², m linear, unidade, verba) */
  unidade: "m2" | "ml" | "un" | "vb";
  /** Quantidade estimada (pode ser auto-calculada ou manual) */
  quantidade: number;
  /** Custo total calculado = custo_unitario × quantidade */
  custo_total: number;
  /** Referência SINAPI (se disponível) */
  sinapi_ref?: string;
  /** Valor do cenário pessimista (R$/unidade) */
  custo_unitario_pessimista?: number;
}

/** IDs fixos das 8 categorias de infraestrutura */
export type InfrastructureCategoryId =
  | "terraplanagem"
  | "drenagem"
  | "pavimentacao"
  | "meio_fio"
  | "rede_agua"
  | "rede_esgoto"
  | "rede_eletrica"
  | "iluminacao";

/** Parâmetros do sistema viário — alimentam a visualização gráfica */
export interface RoadSystemParams {
  /** Largura da calçada esquerda (metros) */
  calcada_esquerda_m: number;
  /** Largura da pista de rolamento (metros) */
  pista_m: number;
  /** Largura da calçada direita (metros) */
  calcada_direita_m: number;
  /** Tipo de pavimentação */
  tipo_pavimentacao: TipoPavimentacao;
  /** Tipo de meio-fio */
  tipo_meio_fio: TipoMeioFio;
  /** Tipo de rede elétrica */
  tipo_rede_eletrica: TipoRedeEletrica;
  /** Custo de pavimentação por m² (R$/m²) */
  custo_pavimentacao_m2: number;
  /** Custo de meio-fio por metro linear (R$/ml) */
  custo_meio_fio_ml: number;
}

/** Parâmetros de terraplanagem — base: declividade DEM */
export interface EarthworkParams {
  /** Declividade média do terreno (%) — extraída do DEM */
  declividade_media_pct: number;
  /** Volume estimado de corte (m³) */
  volume_corte_m3: number;
  /** Volume estimado de aterro (m³) */
  volume_aterro_m3: number;
  /** Custo por m³ de terraplanagem (R$/m³) */
  custo_m3: number;
  /** Flag: usar dados do DEM automaticamente? */
  usar_dem: boolean;
}

/** Garantias para a prefeitura */
export interface MunicipalGuaranteeParams {
  /** Tipo de garantia */
  tipo: "seguro_garantia" | "lotes_caucionados" | "nenhum";
  /** Valor ou % dos lotes caucionados */
  valor_ou_pct: number;
  /** Custo do seguro garantia (% sobre o valor de obra) */
  custo_seguro_pct: number;
}

export interface CostsPremises {
  /** Custo base estimado por m² de área total (R$/m²) — referência rápida */
  custo_base_m2: number;
  /** Tabela de infraestrutura editável — 8 categorias */
  infraestrutura: InfrastructureItem[];
  /** Parâmetros do sistema viário */
  sistema_viario: RoadSystemParams;
  /** Parâmetros de terraplanagem */
  terraplanagem: EarthworkParams;
  /** Taxas e contingências */
  despesas_gerais_pct: number;
  /** % de contingência sobre o custo total */
  contingencia_pct: number;
  /** Taxa de desconto do VPL (% a.a.) — TMA */
  taxa_desconto_anual_pct: number;
  /** Garantia para prefeitura */
  garantia_prefeitura: MunicipalGuaranteeParams;
  // --- Financiamento e tributação (migrados do modal antigo) ---
  /** Capital próprio (%) */
  equity_pct: number;
  /** Custo da dívida ao ano (%) */
  custo_divida_anual_pct: number;
  /** Regime tributário */
  regime_tributario: "lucro_real" | "lucro_presumido" | "ret_afetacao" | "nao_definido";
  /** Patrimônio de afetação ativo? */
  patrimonio_afetacao: boolean;
  /** RET ativo? */
  ret_ativo: boolean;
  /** Alíquota efetiva de IR (%) */
  aliquota_ir_pct: number;
}

// ---------------------------------------------------------------------------
// Tipo consolidado — o que é salvo como JSONB
// ---------------------------------------------------------------------------

export interface DeepPremises {
  project: ProjectPremises;
  sales: SalesPremises;
  land: LandPremises;
  costs: CostsPremises;
}

// ---------------------------------------------------------------------------
// Defaults — valores de referência para mercado brasileiro
// ---------------------------------------------------------------------------

export const DEFAULT_INFRASTRUCTURE: InfrastructureItem[] = [
  {
    id: "terraplanagem",
    label: "Terraplanagem",
    enabled: true,
    custo_unitario: 18,
    unidade: "m2",
    quantidade: 0,
    custo_total: 0,
    sinapi_ref: "SINAPI 73964/6",
  },
  {
    id: "drenagem",
    label: "Drenagem Pluvial",
    enabled: true,
    custo_unitario: 35,
    unidade: "ml",
    quantidade: 0,
    custo_total: 0,
    sinapi_ref: "SINAPI 90101",
  },
  {
    id: "pavimentacao",
    label: "Pavimentação",
    enabled: true,
    custo_unitario: 85,
    unidade: "m2",
    quantidade: 0,
    custo_total: 0,
    sinapi_ref: "SINAPI 94993",
  },
  {
    id: "meio_fio",
    label: "Meio-Fio e Sarjeta",
    enabled: true,
    custo_unitario: 42,
    unidade: "ml",
    quantidade: 0,
    custo_total: 0,
    sinapi_ref: "SINAPI 92393",
  },
  {
    id: "rede_agua",
    label: "Rede de Água",
    enabled: true,
    custo_unitario: 65,
    unidade: "ml",
    quantidade: 0,
    custo_total: 0,
    sinapi_ref: "SINAPI 89356",
  },
  {
    id: "rede_esgoto",
    label: "Rede de Esgoto",
    enabled: true,
    custo_unitario: 80,
    unidade: "ml",
    quantidade: 0,
    custo_total: 0,
    sinapi_ref: "SINAPI 89449",
  },
  {
    id: "rede_eletrica",
    label: "Rede Elétrica",
    enabled: true,
    custo_unitario: 55,
    unidade: "ml",
    quantidade: 0,
    custo_total: 0,
    sinapi_ref: "SINAPI 91926",
  },
  {
    id: "iluminacao",
    label: "Iluminação Pública",
    enabled: true,
    custo_unitario: 3500,
    unidade: "un",
    quantidade: 0,
    custo_total: 0,
    sinapi_ref: "SINAPI 97592",
  },
];

export const DEFAULT_ROAD_SYSTEM: RoadSystemParams = {
  calcada_esquerda_m: 2.5,
  pista_m: 7,
  calcada_direita_m: 2.5,
  tipo_pavimentacao: "CBUQ",
  tipo_meio_fio: "concreto_extrudado",
  tipo_rede_eletrica: "aerea",
  custo_pavimentacao_m2: 85,
  custo_meio_fio_ml: 42,
};

export const DEFAULT_EARTHWORK: EarthworkParams = {
  declividade_media_pct: 5,
  volume_corte_m3: 0,
  volume_aterro_m3: 0,
  custo_m3: 18,
  usar_dem: false,
};

export const DEFAULT_GUARANTEE: MunicipalGuaranteeParams = {
  tipo: "nenhum",
  valor_ou_pct: 0,
  custo_seguro_pct: 0,
};

export const DEFAULT_PROJECT_PREMISES: ProjectPremises = {
  nome: "Cenário Realista",
  tipo_empreendimento: "aberto",
  total_lotes: 100,
  area_media_lote_m2: 250,
  preco_m2: 480,
  prazo_obra_meses: 24,
  prazo_comercializacao_meses: 36,
  mes_inicio_vendas: 1,
};

export const DEFAULT_SALES_PREMISES: SalesPremises = {
  velocidade_vendas_pct_mes: 4,
  entrada_pct: 20,
  parcelas_qtd: 60,
  balao_final_pct: 0,
  vendas_vista_pct: 15,
  desconto_vista_pct: 5,
  juros_parcelamento_pct_mes: 0.8,
  indice_correcao: "INCC",
  indice_correcao_mensal_pct: 0.5,
  comissao_corretor_pct: 5,
  inadimplencia_pct: 3,
};

export const DEFAULT_LAND_PREMISES: LandPremises = {
  modalidade: "parcelada",
  valor_terreno: 2_000_000,
  parcelas_terreno: 12,
  juros_terreno_pct_mes: 0,
  permuta_lotes_pct: 0,
  permuta_financeira_pct: 0,
  comissao_terreno_pct: 3,
  split_empreendedor_pct: 50,
};

export const DEFAULT_COSTS_PREMISES: CostsPremises = {
  custo_base_m2: 120,
  infraestrutura: DEFAULT_INFRASTRUCTURE,
  sistema_viario: DEFAULT_ROAD_SYSTEM,
  terraplanagem: DEFAULT_EARTHWORK,
  despesas_gerais_pct: 5,
  contingencia_pct: 10,
  taxa_desconto_anual_pct: 15,
  garantia_prefeitura: DEFAULT_GUARANTEE,
  equity_pct: 40,
  custo_divida_anual_pct: 14,
  regime_tributario: "lucro_presumido",
  patrimonio_afetacao: false,
  ret_ativo: false,
  aliquota_ir_pct: 5.93,
};

export const DEFAULT_DEEP_PREMISES: DeepPremises = {
  project: DEFAULT_PROJECT_PREMISES,
  sales: DEFAULT_SALES_PREMISES,
  land: DEFAULT_LAND_PREMISES,
  costs: DEFAULT_COSTS_PREMISES,
};

// ---------------------------------------------------------------------------
// Helpers — cálculos derivados
// ---------------------------------------------------------------------------

/** VGV bruto = total_lotes × area_media × preço/m² */
export function calcVGVBruto(p: ProjectPremises): number {
  return p.total_lotes * p.area_media_lote_m2 * p.preco_m2;
}

/** VGV líquido = VGV bruto × (1 - inadimplência) × (1 - comissão) */
export function calcVGVLiquido(
  project: ProjectPremises,
  sales: SalesPremises
): number {
  const bruto = calcVGVBruto(project);
  return bruto * (1 - sales.inadimplencia_pct / 100) * (1 - sales.comissao_corretor_pct / 100);
}

/** Preço médio do lote = area_media × preço/m² */
export function calcPrecoMedioLote(p: ProjectPremises): number {
  return p.area_media_lote_m2 * p.preco_m2;
}

/** Largura total da via = calçada esq + pista + calçada dir */
export function calcLarguraTotalVia(r: RoadSystemParams): number {
  return r.calcada_esquerda_m + r.pista_m + r.calcada_direita_m;
}

/** Custo total de infraestrutura (soma dos itens habilitados) */
export function calcCustoInfraTotal(items: InfrastructureItem[]): number {
  return items
    .filter((i) => i.enabled)
    .reduce((acc, i) => acc + i.custo_unitario * i.quantidade, 0);
}

/** Rodapé consolidado: infra + despesas gerais + contingência + garantia */
export function calcCustoTotalConsolidado(costs: CostsPremises): number {
  const infraTotal = calcCustoInfraTotal(costs.infraestrutura);
  const despGerais = infraTotal * (costs.despesas_gerais_pct / 100);
  const contingencia = infraTotal * (costs.contingencia_pct / 100);

  let garantia = 0;
  if (costs.garantia_prefeitura.tipo === "seguro_garantia") {
    garantia = infraTotal * (costs.garantia_prefeitura.custo_seguro_pct / 100);
  }

  return infraTotal + despGerais + contingencia + garantia;
}
