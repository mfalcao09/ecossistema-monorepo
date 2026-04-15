/**
 * brazil-regulations v1
 *
 * Edge Function multi-action para regulações e tributos brasileiros
 * aplicáveis a parcelamento de solo.
 *
 * ACTIONS:
 *   calc_itbi          — Estima ITBI de um empreendimento (US-127)
 *   calc_outorga       — Estima outorga onerosa do direito de construir (US-128)
 *   check_lei_verde    — Verifica exigências de arborização municipal (US-129)
 *   validate_cnpj_spe  — Valida CNPJ de incorporador/SPE (US-132)
 *
 * Sessão 141 — Bloco H Sprint 1 (Quick Wins)
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// CORS (padrão Intentus)
// ============================================================

const ALLOWED_ORIGINS_RAW = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",").map((o: string) => o.trim()).filter(Boolean);

const DEV_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https:\/\/intentus-plataform-.+\.vercel\.app$/,
];
const PROD_ORIGINS = [
  "https://intentus-plataform.vercel.app",
  "https://app.intentusrealestate.com.br",
];

function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS_RAW.length > 0) return ALLOWED_ORIGINS_RAW.includes(origin);
  return PROD_ORIGINS.includes(origin) || DEV_PATTERNS.some((re) => re.test(origin));
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": isOriginAllowed(origin) ? origin : "",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

// ============================================================
// Context
// ============================================================

interface RequestContext {
  supabase: SupabaseClient;
  userId: string;
  tenantId: string;
}

async function buildContext(req: Request): Promise<RequestContext> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const token = authHeader.replace("Bearer ", "");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("Invalid token");

  // Get tenant_id from profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    supabase,
    userId: user.id,
    tenantId: profile?.tenant_id || user.id,
  };
}

// ============================================================
// ACTION 1: calc_itbi (US-127)
// ============================================================
/**
 * Estima o ITBI (Imposto sobre Transmissão de Bens Imóveis) de um
 * empreendimento com base no VGV e na alíquota municipal.
 *
 * O ITBI no Brasil é um imposto municipal cobrado na transmissão onerosa
 * de imóveis. A alíquota varia entre 1% e 3% dependendo do município.
 *
 * Referências legais:
 * - Art. 156, II da CF/88
 * - CTN Art. 35-42
 * - Legislação municipal específica de cada cidade
 *
 * Para loteamentos, o ITBI incide sobre:
 * 1. Aquisição do terreno pelo incorporador/loteador
 * 2. Cada venda de lote ao comprador final
 *
 * Passo a passo:
 * - Recebe: development_id (para puxar VGV e dados do projeto)
 *   OU valores manuais (vgv_total, valor_terreno, qtd_lotes, cidade, uf)
 * - Aplica alíquota municipal (tabela interna ou override manual)
 * - Retorna: ITBI sobre terreno, ITBI sobre vendas (por lote), total
 */

// Tabela de alíquotas ITBI por município (principais mercados)
// Fonte: legislação municipal vigente em 2025
const ITBI_ALIQUOTAS: Record<string, { aliquota_pct: number; fonte: string }> = {
  // São Paulo
  "SAO PAULO-SP": { aliquota_pct: 3.0, fonte: "Lei Municipal 11.154/91 art. 7° — SP" },
  "CAMPINAS-SP": { aliquota_pct: 2.5, fonte: "Lei Compl. 44/2013 — Campinas" },
  "PIRACICABA-SP": { aliquota_pct: 2.0, fonte: "Lei Municipal 2.790/1988 — Piracicaba" },
  "SOROCABA-SP": { aliquota_pct: 2.0, fonte: "Código Tributário Municipal — Sorocaba" },
  "RIBEIRAO PRETO-SP": { aliquota_pct: 2.0, fonte: "Lei Compl. 2.415/2009 — Rib. Preto" },
  "SAO JOSE DOS CAMPOS-SP": { aliquota_pct: 2.0, fonte: "Código Tributário Municipal — SJC" },
  "SANTOS-SP": { aliquota_pct: 3.0, fonte: "Código Tributário Municipal — Santos" },
  "JUNDIAI-SP": { aliquota_pct: 2.0, fonte: "Código Tributário Municipal — Jundiaí" },
  "BAURU-SP": { aliquota_pct: 2.0, fonte: "Código Tributário Municipal — Bauru" },
  "MARILIA-SP": { aliquota_pct: 2.0, fonte: "Código Tributário Municipal — Marília" },

  // Rio de Janeiro
  "RIO DE JANEIRO-RJ": { aliquota_pct: 3.0, fonte: "Lei Municipal 1.364/88 art. 6° — RJ" },
  "NITEROI-RJ": { aliquota_pct: 2.0, fonte: "Código Tributário Municipal — Niterói" },

  // Minas Gerais
  "BELO HORIZONTE-MG": { aliquota_pct: 3.0, fonte: "Lei Municipal 5.492/88 — BH" },
  "UBERLANDIA-MG": { aliquota_pct: 2.5, fonte: "Código Tributário Municipal — Uberlândia" },

  // Paraná
  "CURITIBA-PR": { aliquota_pct: 2.7, fonte: "Lei Compl. 40/2001 art. 11 — Curitiba" },
  "LONDRINA-PR": { aliquota_pct: 2.0, fonte: "Código Tributário Municipal — Londrina" },
  "MARINGA-PR": { aliquota_pct: 2.0, fonte: "Código Tributário Municipal — Maringá" },

  // Santa Catarina
  "FLORIANOPOLIS-SC": { aliquota_pct: 2.0, fonte: "Código Tributário Municipal — Florianópolis" },
  "JOINVILLE-SC": { aliquota_pct: 2.0, fonte: "Código Tributário Municipal — Joinville" },
  "BALNEARIO CAMBORIU-SC": { aliquota_pct: 2.0, fonte: "Código Tributário Municipal — BC" },

  // Rio Grande do Sul
  "PORTO ALEGRE-RS": { aliquota_pct: 3.0, fonte: "Lei Compl. 197/89 — POA" },
  "CAXIAS DO SUL-RS": { aliquota_pct: 2.0, fonte: "Código Tributário Municipal — Caxias" },

  // Goiás
  "GOIANIA-GO": { aliquota_pct: 2.0, fonte: "Código Tributário Municipal — Goiânia" },

  // Mato Grosso do Sul
  "CAMPO GRANDE-MS": { aliquota_pct: 2.0, fonte: "Lei Compl. 59/2003 — CG" },
  "CASSILANDIA-MS": { aliquota_pct: 2.0, fonte: "Código Tributário Municipal — Cassilândia" },
  "TRES LAGOAS-MS": { aliquota_pct: 2.0, fonte: "Código Tributário Municipal — Três Lagoas" },

  // Bahia
  "SALVADOR-BA": { aliquota_pct: 3.0, fonte: "Lei Municipal 7.186/2006 — Salvador" },

  // Distrito Federal
  "BRASILIA-DF": { aliquota_pct: 3.0, fonte: "Lei 3.830/2006 — DF" },
};

// Default por UF quando cidade não está na tabela
const ITBI_DEFAULT_UF: Record<string, number> = {
  SP: 2.0, RJ: 2.0, MG: 2.0, PR: 2.0, SC: 2.0, RS: 2.0,
  GO: 2.0, MS: 2.0, BA: 2.0, DF: 3.0, CE: 2.0, PE: 2.0,
  ES: 2.0, MT: 2.0, PA: 2.0, MA: 2.0, AM: 2.0, PI: 2.0,
  RN: 2.0, PB: 2.0, AL: 2.0, SE: 2.0, TO: 2.0, RO: 2.0,
  AC: 2.0, AP: 2.0, RR: 2.0,
};

interface ItbiArgs {
  development_id?: string;
  // OU valores manuais:
  vgv_total?: number;
  valor_terreno?: number;
  qtd_lotes?: number;
  cidade?: string;
  uf?: string;
  aliquota_override_pct?: number;
}

async function calcItbi(ctx: RequestContext, args: ItbiArgs): Promise<unknown> {
  let vgv = args.vgv_total ?? 0;
  let valorTerreno = args.valor_terreno ?? 0;
  let qtdLotes = args.qtd_lotes ?? 1;
  let cidade = args.cidade ?? "";
  let uf = args.uf ?? "";

  // Se informou development_id, puxa dados do banco
  if (args.development_id) {
    const { data: dev } = await ctx.supabase
      .from("developments")
      .select("name, city, state, vgv_total, area_total_m2")
      .eq("id", args.development_id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();

    if (dev) {
      cidade = cidade || dev.city || "";
      uf = uf || dev.state || "";
    }

    // Busca financeiro ativo para VGV
    const { data: fin } = await ctx.supabase
      .from("development_parcelamento_financial")
      .select("vgv_total, scenario_id")
      .eq("development_id", args.development_id)
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (fin) {
      vgv = vgv || fin.vgv_total || 0;

      // Busca premissas do cenário para terreno e lotes
      if (fin.scenario_id) {
        const { data: scenario } = await ctx.supabase
          .from("development_parcelamento_scenarios")
          .select("qtd_lotes, deep_premises")
          .eq("id", fin.scenario_id)
          .eq("tenant_id", ctx.tenantId)
          .maybeSingle();

        if (scenario) {
          qtdLotes = qtdLotes || scenario.qtd_lotes || 1;
          const dp = scenario.deep_premises as any;
          if (dp?.land?.valor_terreno) {
            valorTerreno = valorTerreno || dp.land.valor_terreno;
          }
        }
      }
    }
  }

  // Normaliza cidade para lookup
  const cidadeNorm = cidade.toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim();
  const ufNorm = uf.toUpperCase().trim();
  const lookupKey = `${cidadeNorm}-${ufNorm}`;

  // Determina alíquota
  let aliquota_pct: number;
  let fonte: string;
  let is_estimate: boolean;

  if (args.aliquota_override_pct != null && args.aliquota_override_pct > 0) {
    aliquota_pct = args.aliquota_override_pct;
    fonte = "Override manual informado pelo usuário";
    is_estimate = false;
  } else if (ITBI_ALIQUOTAS[lookupKey]) {
    aliquota_pct = ITBI_ALIQUOTAS[lookupKey].aliquota_pct;
    fonte = ITBI_ALIQUOTAS[lookupKey].fonte;
    is_estimate = false;
  } else {
    aliquota_pct = ITBI_DEFAULT_UF[ufNorm] ?? 2.0;
    fonte = `Estimativa padrão para ${ufNorm || "Brasil"} (alíquota média 2%)`;
    is_estimate = true;
  }

  // Cálculos
  const itbi_terreno = valorTerreno * (aliquota_pct / 100);
  const preco_medio_lote = qtdLotes > 0 ? vgv / qtdLotes : 0;
  const itbi_por_lote = preco_medio_lote * (aliquota_pct / 100);
  const itbi_total_vendas = vgv * (aliquota_pct / 100);
  const itbi_total = itbi_terreno + itbi_total_vendas;
  const itbi_pct_vgv = vgv > 0 ? (itbi_total / vgv) * 100 : 0;

  return {
    municipio: cidade || "Não informado",
    uf: uf || "N/A",
    aliquota_pct,
    fonte_legal: fonte,
    is_estimate,
    detalhamento: {
      valor_terreno: valorTerreno,
      itbi_terreno: Math.round(itbi_terreno * 100) / 100,
      vgv_total: vgv,
      qtd_lotes: qtdLotes,
      preco_medio_lote: Math.round(preco_medio_lote * 100) / 100,
      itbi_por_lote: Math.round(itbi_por_lote * 100) / 100,
      itbi_total_vendas: Math.round(itbi_total_vendas * 100) / 100,
    },
    resumo: {
      itbi_aquisicao_terreno: Math.round(itbi_terreno * 100) / 100,
      itbi_total_vendas_lotes: Math.round(itbi_total_vendas * 100) / 100,
      itbi_total: Math.round(itbi_total * 100) / 100,
      itbi_pct_vgv: Math.round(itbi_pct_vgv * 100) / 100,
    },
    nota_legal: "O ITBI sobre vendas é pago pelo comprador, mas impacta a atratividade do preço. "
      + "Incorporadores/loteadores devem considerar o ITBI da aquisição do terreno no custo do projeto. "
      + "Art. 156, II CF/88. Imunidade: integralização de capital social (Art. 156 §2° I CF).",
    dicas: [
      "Imunidade de ITBI na integralização do terreno em SPE (Art. 156 §2° I CF/88) — aplicável quando o terreno entra como capital social da SPE/incorporadora.",
      "Verificar se o município oferece desconto para primeiro imóvel.",
      is_estimate
        ? `⚠️ Alíquota estimada — confirme com a Prefeitura de ${cidade || "seu município"} a alíquota exata vigente.`
        : `Alíquota confirmada: ${fonte}`,
    ],
  };
}

// ============================================================
// ACTION 2: calc_outorga (US-128)
// ============================================================
/**
 * Estima a Outorga Onerosa do Direito de Construir (OODC).
 *
 * A OODC é uma contrapartida financeira paga ao município quando o
 * empreendimento utiliza coeficiente de aproveitamento acima do básico
 * definido no Plano Diretor.
 *
 * Referências legais:
 * - Estatuto da Cidade (Lei 10.257/2001), Art. 28-31
 * - Plano Diretor municipal de cada cidade
 *
 * Fórmula geral (varia por município):
 *   OODC = Ct × Fp × (CAut - CAb)
 *   Onde:
 *     Ct  = valor do terreno por m²
 *     Fp  = fator de planejamento (0 a 1, definido pelo município)
 *     CAut = coeficiente de aproveitamento utilizado
 *     CAb  = coeficiente de aproveitamento básico
 *
 * Para loteamentos:
 * - Muitos municípios ISENTAM loteamentos de OODC (pois o CA básico
 *   já é alto para uso residencial horizontal)
 * - Quando aplicável, incide sobre áreas comerciais dentro do loteamento
 *   ou sobre condomínios fechados com CA acima do básico
 */

interface OutorgaArgs {
  development_id?: string;
  area_terreno_m2?: number;
  area_construida_m2?: number;
  valor_m2_terreno?: number;
  coeficiente_basico?: number;  // CA básico do Plano Diretor
  coeficiente_maximo?: number;  // CA máximo da zona
  coeficiente_utilizado?: number; // CA pretendido
  fator_planejamento?: number;  // Fp (0-1)
  cidade?: string;
  uf?: string;
  tipo_empreendimento?: string; // loteamento_aberto | loteamento_fechado | condominio_lotes
}

// Tabela de parâmetros urbanísticos por município (simplificada)
const OUTORGA_PARAMS: Record<string, {
  ca_basico: number;
  ca_maximo: number;
  fp_padrao: number;
  isento_loteamento: boolean;
  fonte: string;
}> = {
  "SAO PAULO-SP": { ca_basico: 1.0, ca_maximo: 4.0, fp_padrao: 0.5, isento_loteamento: false, fonte: "PDE SP 2014 (Lei 16.050) — Zona Mista" },
  "CAMPINAS-SP": { ca_basico: 1.0, ca_maximo: 2.5, fp_padrao: 0.5, isento_loteamento: true, fonte: "PD Campinas 2018 (LC 189) — Macrozona Urbana" },
  "PIRACICABA-SP": { ca_basico: 1.0, ca_maximo: 2.0, fp_padrao: 0.5, isento_loteamento: true, fonte: "PD Piracicaba (LC 186/2006)" },
  "RIO DE JANEIRO-RJ": { ca_basico: 1.0, ca_maximo: 3.5, fp_padrao: 0.5, isento_loteamento: false, fonte: "PD Rio (LC 111/2011)" },
  "BELO HORIZONTE-MG": { ca_basico: 1.0, ca_maximo: 3.0, fp_padrao: 0.5, isento_loteamento: true, fonte: "PD BH (Lei 11.181/2019)" },
  "CURITIBA-PR": { ca_basico: 1.0, ca_maximo: 4.0, fp_padrao: 0.5, isento_loteamento: true, fonte: "PD Curitiba (Lei 14.771/2015)" },
  "GOIANIA-GO": { ca_basico: 1.5, ca_maximo: 3.0, fp_padrao: 0.5, isento_loteamento: true, fonte: "PD Goiânia (LC 171/2007)" },
  "CAMPO GRANDE-MS": { ca_basico: 1.0, ca_maximo: 2.0, fp_padrao: 0.5, isento_loteamento: true, fonte: "PD Campo Grande (LC 341/2018)" },
  "CASSILANDIA-MS": { ca_basico: 1.0, ca_maximo: 2.0, fp_padrao: 0.5, isento_loteamento: true, fonte: "PD Cassilândia (estimativa)" },
};

async function calcOutorga(ctx: RequestContext, args: OutorgaArgs): Promise<unknown> {
  let areaTerreno = args.area_terreno_m2 ?? 0;
  let areaConstruida = args.area_construida_m2 ?? 0;
  let valorM2 = args.valor_m2_terreno ?? 0;
  let cidade = args.cidade ?? "";
  let uf = args.uf ?? "";
  let tipoEmpreendimento = args.tipo_empreendimento ?? "";

  // Puxa dados do projeto se development_id informado
  if (args.development_id) {
    const { data: dev } = await ctx.supabase
      .from("developments")
      .select("city, state, area_total_m2, development_type")
      .eq("id", args.development_id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();

    if (dev) {
      cidade = cidade || dev.city || "";
      uf = uf || dev.state || "";
      areaTerreno = areaTerreno || dev.area_total_m2 || 0;
      tipoEmpreendimento = tipoEmpreendimento || dev.development_type || "";
    }
  }

  // Normaliza lookup
  const cidadeNorm = cidade.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const ufNorm = uf.toUpperCase().trim();
  const lookupKey = `${cidadeNorm}-${ufNorm}`;

  const params = OUTORGA_PARAMS[lookupKey] ?? {
    ca_basico: 1.0,
    ca_maximo: 2.0,
    fp_padrao: 0.5,
    isento_loteamento: true,
    fonte: `Parâmetros padrão estimados para ${cidade || "município não mapeado"}`,
  };

  const caBasico = args.coeficiente_basico ?? params.ca_basico;
  const caMaximo = args.coeficiente_maximo ?? params.ca_maximo;
  const fp = args.fator_planejamento ?? params.fp_padrao;

  // CA utilizado: se não informado, estima a partir de área construída / terreno
  let caUtilizado = args.coeficiente_utilizado ?? 0;
  if (caUtilizado === 0 && areaTerreno > 0 && areaConstruida > 0) {
    caUtilizado = areaConstruida / areaTerreno;
  }

  // Loteamentos geralmente são isentos de OODC
  // Fallback para loteamento_aberto se nenhuma fonte informou
  if (!tipoEmpreendimento) tipoEmpreendimento = "loteamento_aberto";
  const isLoteamento = tipoEmpreendimento.includes("loteamento") || tipoEmpreendimento === "desmembramento";
  const isento = isLoteamento && params.isento_loteamento;

  let outorgaValor = 0;
  let excedente_ca = 0;
  let formula_aplicada = "";

  if (!isento && caUtilizado > caBasico && areaTerreno > 0 && valorM2 > 0) {
    excedente_ca = caUtilizado - caBasico;
    // Limita ao máximo permitido
    const excedenteLimitado = Math.min(excedente_ca, caMaximo - caBasico);
    outorgaValor = valorM2 * areaTerreno * fp * excedenteLimitado;
    formula_aplicada = `OODC = ${valorM2.toFixed(2)} × ${areaTerreno.toFixed(0)} × ${fp} × ${excedenteLimitado.toFixed(2)} = R$ ${outorgaValor.toFixed(2)}`;
  }

  return {
    municipio: cidade || "Não informado",
    uf: uf || "N/A",
    fonte_legal: params.fonte,
    tipo_empreendimento: tipoEmpreendimento,
    parametros_urbanisticos: {
      ca_basico: caBasico,
      ca_maximo: caMaximo,
      ca_utilizado: Math.round(caUtilizado * 100) / 100,
      fator_planejamento: fp,
    },
    isento,
    motivo_isencao: isento
      ? `Loteamentos/desmembramentos são isentos de OODC neste município (CA básico suficiente para uso residencial horizontal).`
      : null,
    calculo: {
      area_terreno_m2: areaTerreno,
      area_construida_m2: areaConstruida,
      valor_m2_terreno: valorM2,
      excedente_ca: Math.round(excedente_ca * 100) / 100,
      outorga_valor: Math.round(outorgaValor * 100) / 100,
      formula: formula_aplicada || (isento ? "Isento — sem cálculo aplicável" : "Dados insuficientes para cálculo"),
    },
    nota_legal: "A Outorga Onerosa do Direito de Construir (OODC) é prevista no Estatuto da Cidade "
      + "(Lei 10.257/2001, Art. 28-31). Aplica-se quando o empreendimento excede o Coeficiente "
      + "de Aproveitamento Básico (CAb) definido no Plano Diretor. Para loteamentos abertos, "
      + "a maioria dos municípios isenta a OODC pois o CA básico já atende o uso horizontal.",
    dicas: [
      "Consulte o Plano Diretor do município para confirmar o CA básico e máximo da zona.",
      "Em muitos municípios, a OODC pode ser paga em obras/terrenos (contrapartida física).",
      isento
        ? "✅ Loteamento isento de OODC neste município."
        : outorgaValor > 0
          ? `⚠️ Outorga estimada em R$ ${outorgaValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} — incluir nos custos de legalização.`
          : "Informe área construída, valor do m² e CA utilizado para estimar a OODC.",
    ],
  };
}

// ============================================================
// ACTION 3: check_lei_verde (US-129)
// ============================================================
/**
 * Verifica exigências da "Lei do Verde" / legislação de arborização
 * municipal aplicável ao empreendimento.
 *
 * A "Lei do Verde" é um termo genérico para legislações municipais que
 * exigem arborização, áreas permeáveis e compensação ambiental em
 * novos loteamentos e empreendimentos imobiliários.
 *
 * Referências principais:
 * - SP: Lei 10.365/1987 + Decreto 53.889/2013 (compensação ambiental)
 * - Código Florestal (Lei 12.651/2012) — APP e RL
 * - Planos Diretores municipais — taxa de permeabilidade
 * - Resolução CONAMA 369/2006 — intervenção em APP
 *
 * Para loteamentos, as exigências típicas são:
 * 1. Arborização viária (1 árvore a cada X metros de calçada)
 * 2. Taxa de permeabilidade mínima (15-30% da área total)
 * 3. Área verde mínima (% da área total do loteamento)
 * 4. Compensação ambiental (mudas por m² impermeabilizado)
 * 5. Reserva Legal (20% para bioma Cerrado, 80% Amazônia)
 */

interface LeiVerdeArgs {
  development_id?: string;
  area_total_m2?: number;
  area_verde_m2?: number;
  area_permeavel_m2?: number;
  qtd_lotes?: number;
  extensao_vias_m?: number;  // metros lineares de vias
  cidade?: string;
  uf?: string;
  bioma?: string;
}

const LEI_VERDE_PARAMS: Record<string, {
  taxa_permeabilidade_min_pct: number;
  area_verde_min_pct: number;
  arvores_por_metro_via: number;  // 1 árvore a cada N metros
  compensacao_mudas_por_m2: number;
  fonte: string;
}> = {
  "SAO PAULO-SP": { taxa_permeabilidade_min_pct: 15, area_verde_min_pct: 15, arvores_por_metro_via: 10, compensacao_mudas_por_m2: 0.5, fonte: "Lei 10.365/87 + Decreto 53.889/13 — SP" },
  "CAMPINAS-SP": { taxa_permeabilidade_min_pct: 20, area_verde_min_pct: 10, arvores_por_metro_via: 12, compensacao_mudas_por_m2: 0.3, fonte: "LC 189/2018 — Campinas" },
  "PIRACICABA-SP": { taxa_permeabilidade_min_pct: 20, area_verde_min_pct: 10, arvores_por_metro_via: 12, compensacao_mudas_por_m2: 0.3, fonte: "PD Piracicaba (LC 186/2006)" },
  "RIO DE JANEIRO-RJ": { taxa_permeabilidade_min_pct: 15, area_verde_min_pct: 15, arvores_por_metro_via: 10, compensacao_mudas_por_m2: 0.5, fonte: "LC 198/2019 — RJ" },
  "BELO HORIZONTE-MG": { taxa_permeabilidade_min_pct: 20, area_verde_min_pct: 12, arvores_por_metro_via: 10, compensacao_mudas_por_m2: 0.3, fonte: "Lei 7.166/96 + PD BH" },
  "CURITIBA-PR": { taxa_permeabilidade_min_pct: 25, area_verde_min_pct: 15, arvores_por_metro_via: 8, compensacao_mudas_por_m2: 0.5, fonte: "Lei 14.771/2015 — Curitiba" },
  "GOIANIA-GO": { taxa_permeabilidade_min_pct: 20, area_verde_min_pct: 10, arvores_por_metro_via: 12, compensacao_mudas_por_m2: 0.3, fonte: "PD Goiânia (LC 171/2007)" },
  "CAMPO GRANDE-MS": { taxa_permeabilidade_min_pct: 20, area_verde_min_pct: 10, arvores_por_metro_via: 12, compensacao_mudas_por_m2: 0.3, fonte: "PD Campo Grande (LC 341/2018)" },
};

const DEFAULT_LEI_VERDE = {
  taxa_permeabilidade_min_pct: 20,
  area_verde_min_pct: 10,
  arvores_por_metro_via: 12,
  compensacao_mudas_por_m2: 0.3,
  fonte: "Parâmetros médios estimados (Lei 6.766/79 Art. 4° §1° — mínimo 35% área pública)",
};

// Reserva Legal mínima por bioma (Lei 12.651/2012)
const RL_POR_BIOMA: Record<string, number> = {
  amazonia: 80,
  cerrado_amazonia: 35,
  cerrado: 20,
  mata_atlantica: 20,
  caatinga: 20,
  pampa: 20,
  pantanal: 20,
};

async function checkLeiVerde(ctx: RequestContext, args: LeiVerdeArgs): Promise<unknown> {
  let areaTotal = args.area_total_m2 ?? 0;
  let areaVerde = args.area_verde_m2 ?? 0;
  let areaPermeavel = args.area_permeavel_m2 ?? 0;
  let qtdLotes = args.qtd_lotes ?? 0;
  let extensaoVias = args.extensao_vias_m ?? 0;
  let cidade = args.cidade ?? "";
  let uf = args.uf ?? "";
  let bioma = args.bioma ?? "cerrado";

  if (args.development_id) {
    const { data: dev } = await ctx.supabase
      .from("developments")
      .select("city, state, area_total_m2")
      .eq("id", args.development_id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();

    if (dev) {
      cidade = cidade || dev.city || "";
      uf = uf || dev.state || "";
      areaTotal = areaTotal || dev.area_total_m2 || 0;
    }

    // Tenta puxar qtd_lotes do cenário ativo
    const { data: fin } = await ctx.supabase
      .from("development_parcelamento_financial")
      .select("scenario_id")
      .eq("development_id", args.development_id)
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (fin?.scenario_id) {
      const { data: scenario } = await ctx.supabase
        .from("development_parcelamento_scenarios")
        .select("qtd_lotes")
        .eq("id", fin.scenario_id)
        .eq("tenant_id", ctx.tenantId)
        .maybeSingle();

      if (scenario) {
        qtdLotes = qtdLotes || scenario.qtd_lotes || 0;
      }
    }
  }

  // Lookup municipal
  const cidadeNorm = cidade.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const ufNorm = uf.toUpperCase().trim();
  const lookupKey = `${cidadeNorm}-${ufNorm}`;
  const params = LEI_VERDE_PARAMS[lookupKey] ?? DEFAULT_LEI_VERDE;

  // Cálculos de exigências
  const biomaNorm = bioma.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const rl_pct = RL_POR_BIOMA[biomaNorm] ?? 20;
  const rl_min_m2 = areaTotal * (rl_pct / 100);
  const area_verde_min_m2 = areaTotal * (params.area_verde_min_pct / 100);
  const area_permeavel_min_m2 = areaTotal * (params.taxa_permeabilidade_min_pct / 100);

  // Arborização viária
  const arvoresVias = extensaoVias > 0
    ? Math.ceil((extensaoVias * 2) / params.arvores_por_metro_via) // *2 = ambos os lados
    : 0;

  // Compensação ambiental (mudas)
  const areaImpermeabilizada = areaTotal - areaPermeavel;
  const mudasCompensacao = areaImpermeabilizada > 0
    ? Math.ceil(areaImpermeabilizada * params.compensacao_mudas_por_m2)
    : 0;

  // Checklist de conformidade
  const checks: Array<{
    item: string;
    status: "pass" | "warn" | "fail" | "pending";
    exigido: string;
    atual: string;
    recomendacao: string;
  }> = [];

  // Check 1: Área verde
  if (areaTotal > 0 && areaVerde > 0) {
    const areaVerdePct = (areaVerde / areaTotal) * 100;
    checks.push({
      item: "Área Verde Mínima",
      status: areaVerdePct >= params.area_verde_min_pct ? "pass" : "fail",
      exigido: `${params.area_verde_min_pct}% (${area_verde_min_m2.toFixed(0)} m²)`,
      atual: `${areaVerdePct.toFixed(1)}% (${areaVerde.toFixed(0)} m²)`,
      recomendacao: areaVerdePct >= params.area_verde_min_pct
        ? "Área verde atende à exigência municipal."
        : `Faltam ${(area_verde_min_m2 - areaVerde).toFixed(0)} m² de área verde para atingir o mínimo.`,
    });
  } else {
    checks.push({
      item: "Área Verde Mínima",
      status: "pending",
      exigido: `${params.area_verde_min_pct}% da área total`,
      atual: "Não informado",
      recomendacao: "Informe a área verde projetada para verificar conformidade.",
    });
  }

  // Check 2: Taxa de permeabilidade
  if (areaTotal > 0 && areaPermeavel > 0) {
    const permPct = (areaPermeavel / areaTotal) * 100;
    checks.push({
      item: "Taxa de Permeabilidade",
      status: permPct >= params.taxa_permeabilidade_min_pct ? "pass" : "fail",
      exigido: `${params.taxa_permeabilidade_min_pct}% (${area_permeavel_min_m2.toFixed(0)} m²)`,
      atual: `${permPct.toFixed(1)}% (${areaPermeavel.toFixed(0)} m²)`,
      recomendacao: permPct >= params.taxa_permeabilidade_min_pct
        ? "Permeabilidade atende à exigência."
        : `Faltam ${(area_permeavel_min_m2 - areaPermeavel).toFixed(0)} m² de área permeável.`,
    });
  } else {
    checks.push({
      item: "Taxa de Permeabilidade",
      status: "pending",
      exigido: `${params.taxa_permeabilidade_min_pct}% da área total`,
      atual: "Não informado",
      recomendacao: "Informe a área permeável projetada.",
    });
  }

  // Check 3: Reserva Legal
  checks.push({
    item: "Reserva Legal",
    status: "pending",
    exigido: `${rl_pct}% da área total (${rl_min_m2.toFixed(0)} m²) — Bioma ${bioma}`,
    atual: "Verificar com o CAR/SICAR",
    recomendacao: `No bioma ${bioma}, a Reserva Legal mínima é ${rl_pct}% (Lei 12.651/2012 Art. 12). Verifique o CAR registrado.`,
  });

  // Check 4: Arborização viária
  checks.push({
    item: "Arborização Viária",
    status: extensaoVias > 0 ? "warn" : "pending",
    exigido: `1 árvore a cada ${params.arvores_por_metro_via}m de calçada (ambos os lados)`,
    atual: extensaoVias > 0 ? `${arvoresVias} árvores estimadas para ${extensaoVias}m de vias` : "Extensão de vias não informada",
    recomendacao: extensaoVias > 0
      ? `Preveja o plantio de ${arvoresVias} mudas nas calçadas do loteamento.`
      : "Informe a extensão total de vias para estimar a arborização necessária.",
  });

  // Check 5: Compensação ambiental
  checks.push({
    item: "Compensação Ambiental (mudas)",
    status: areaPermeavel > 0 ? "warn" : "pending",
    exigido: `${params.compensacao_mudas_por_m2} muda/m² impermeabilizado`,
    atual: mudasCompensacao > 0 ? `${mudasCompensacao} mudas estimadas` : "Dados insuficientes",
    recomendacao: mudasCompensacao > 0
      ? `Providenciar ${mudasCompensacao} mudas para compensação ambiental junto ao órgão ambiental municipal.`
      : "Informe a área permeável para calcular a compensação.",
  });

  // Check 6: Lei 6.766 — 35% público (área verde + sistema viário + institucional)
  checks.push({
    item: "Área Pública Mínima (Lei 6.766)",
    status: "warn",
    exigido: "35% da gleba (Art. 4° §1° Lei 6.766/79) — inclui vias, áreas verdes e institucionais",
    atual: "Verificar no quadro de áreas do projeto",
    recomendacao: "A Lei 6.766/79 exige que no mínimo 35% da gleba seja destinada a áreas públicas. Confirme no Memorial Descritivo.",
  });

  const passCount = checks.filter(c => c.status === "pass").length;
  const failCount = checks.filter(c => c.status === "fail").length;
  const pendingCount = checks.filter(c => c.status === "pending").length;

  return {
    municipio: cidade || "Não informado",
    uf: uf || "N/A",
    bioma,
    fonte_legal: params.fonte,
    exigencias: {
      taxa_permeabilidade_min_pct: params.taxa_permeabilidade_min_pct,
      area_verde_min_pct: params.area_verde_min_pct,
      arvores_por_metro_via: params.arvores_por_metro_via,
      compensacao_mudas_por_m2: params.compensacao_mudas_por_m2,
      reserva_legal_pct: rl_pct,
    },
    estimativas: {
      area_verde_min_m2: Math.round(area_verde_min_m2),
      area_permeavel_min_m2: Math.round(area_permeavel_min_m2),
      reserva_legal_min_m2: Math.round(rl_min_m2),
      arvores_viarias: arvoresVias,
      mudas_compensacao: mudasCompensacao,
    },
    checklist: checks,
    resumo: {
      total_checks: checks.length,
      pass: passCount,
      fail: failCount,
      pending: pendingCount,
      warn: checks.filter(c => c.status === "warn").length,
    },
    nota_legal: "As exigências variam por município. Consulte o Plano Diretor e a legislação "
      + "ambiental local para valores oficiais. Os parâmetros apresentados são referências "
      + "e podem não refletir a legislação vigente mais recente.",
  };
}

// ============================================================
// ACTION 4: validate_cnpj_spe (US-132)
// ============================================================
/**
 * Valida um CNPJ de incorporador ou SPE (Sociedade de Propósito
 * Específico) usando a API ReceitaWS e aplica validações específicas
 * do mercado imobiliário.
 *
 * Validações:
 * 1. CNPJ válido (14 dígitos, dígitos verificadores)
 * 2. Situação cadastral ATIVA na Receita Federal
 * 3. CNAE compatível com atividade imobiliária
 * 4. Natureza jurídica compatível (SPE, LTDA, SA, SCP, etc.)
 * 5. Alertas de risco (CNPJ recente, capital social baixo, etc.)
 *
 * CNAEs imobiliários relevantes:
 * - 41.10-7 — Incorporação de empreendimentos imobiliários
 * - 41.20-4 — Construção de edifícios
 * - 68.10-2 — Atividades imobiliárias de imóveis próprios
 * - 68.21-8 — Intermediação compra/venda/aluguel de imóveis
 * - 68.22-6 — Gestão e administração de propriedade imobiliária
 * - 42.11-1 — Construção de rodovias, ferrovias e obras de urbanização
 */

interface ValidateCnpjArgs {
  cnpj: string;
}

// CNAEs imobiliários (código principal — 7 dígitos com divisão)
const CNAES_IMOBILIARIOS = [
  "41.10-7", "41.20-4", "42.11-1", "42.99-7",
  "43.11-8", "43.12-6", "43.13-4", "43.21-5", "43.22-3", "43.29-1",
  "43.30-4", "43.91-6", "43.99-1",
  "68.10-2", "68.21-8", "68.22-6",
  "64.62-0", // Holdings não-financeiras (SPEs)
];

// Naturezas jurídicas compatíveis
const NATUREZAS_COMPATIVEIS = [
  "Sociedade Empresária Limitada",
  "Sociedade Anônima Fechada",
  "Sociedade Anônima Aberta",
  "Sociedade Simples Pura",
  "Sociedade Simples Limitada",
  "Empresa Individual de Responsabilidade Limitada",
  "Sociedade em Conta de Participação",
  "Cooperativa",
];

function validateCnpjDigits(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  // Rejeita CNPJs com todos dígitos iguais
  if (/^(\d)\1{13}$/.test(digits)) return false;

  // Valida primeiro dígito verificador
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * weights1[i];
  let remainder = sum % 11;
  const d1 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(digits[12]) !== d1) return false;

  // Valida segundo dígito verificador
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * weights2[i];
  remainder = sum % 11;
  const d2 = remainder < 2 ? 0 : 11 - remainder;
  return parseInt(digits[13]) === d2;
}

async function validateCnpjSpe(_ctx: RequestContext, args: ValidateCnpjArgs): Promise<unknown> {
  const cnpjRaw = args.cnpj || "";
  const digits = cnpjRaw.replace(/\D/g, "");

  // Validação local dos dígitos
  if (!validateCnpjDigits(digits)) {
    return {
      valid: false,
      cnpj: cnpjRaw,
      error: "CNPJ inválido — dígitos verificadores não conferem.",
      checks: [{ check: "Dígitos verificadores", status: "fail", detail: "Cálculo matemático dos dígitos verificadores falhou." }],
    };
  }

  // Consulta ReceitaWS
  let receitaData: any = null;
  let receitaError: string | null = null;

  try {
    const resp = await fetch(`https://receitaws.com.br/v1/cnpj/${digits}`, {
      headers: { Accept: "application/json" },
    });

    if (resp.ok) {
      receitaData = await resp.json();
      if (receitaData.status === "ERROR") {
        receitaError = receitaData.message || "CNPJ não encontrado na Receita Federal";
        receitaData = null;
      }
    } else if (resp.status === 429) {
      receitaError = "Limite de consultas excedido na ReceitaWS. Tente novamente em alguns minutos.";
    } else {
      receitaError = `ReceitaWS retornou status ${resp.status}`;
    }
  } catch (e: any) {
    receitaError = `Erro ao consultar ReceitaWS: ${e.message}`;
  }

  if (!receitaData) {
    return {
      valid: false,
      cnpj: digits,
      cnpj_formatado: digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"),
      error: receitaError,
      checks: [
        { check: "Dígitos verificadores", status: "pass", detail: "CNPJ matematicamente válido." },
        { check: "Consulta Receita Federal", status: "fail", detail: receitaError },
      ],
    };
  }

  // Monta checks
  const checks: Array<{ check: string; status: "pass" | "warn" | "fail"; detail: string }> = [];

  // Check 1: Dígitos
  checks.push({ check: "Dígitos verificadores", status: "pass", detail: "CNPJ matematicamente válido." });

  // Check 2: Situação cadastral
  const situacao = (receitaData.situacao || "").toUpperCase();
  checks.push({
    check: "Situação Cadastral",
    status: situacao === "ATIVA" ? "pass" : "fail",
    detail: situacao === "ATIVA"
      ? `Situação ATIVA desde ${receitaData.data_situacao || "N/A"}.`
      : `Situação: ${receitaData.situacao} — CNPJ não pode operar como incorporador.`,
  });

  // Check 3: CNAE
  const cnaePrincipal = receitaData.atividade_principal?.[0]?.code || "";
  const cnaeTexto = receitaData.atividade_principal?.[0]?.text || "";
  const cnaeNorm = cnaePrincipal.replace(/[.\-\/]/g, "");
  const cnaeCompativel = CNAES_IMOBILIARIOS.some(c => cnaeNorm.startsWith(c.replace(/[.\-]/g, "").substring(0, 5)));
  checks.push({
    check: "CNAE Principal",
    status: cnaeCompativel ? "pass" : "warn",
    detail: cnaeCompativel
      ? `CNAE ${cnaePrincipal} (${cnaeTexto}) — compatível com atividade imobiliária.`
      : `CNAE ${cnaePrincipal} (${cnaeTexto}) — não é tipicamente imobiliário. Verifique CNAEs secundários.`,
  });

  // Check 4: Natureza jurídica
  const natureza = receitaData.natureza_juridica || "";
  const naturezaOk = NATUREZAS_COMPATIVEIS.some(n => natureza.toLowerCase().includes(n.toLowerCase()));
  checks.push({
    check: "Natureza Jurídica",
    status: naturezaOk ? "pass" : "warn",
    detail: naturezaOk
      ? `${natureza} — compatível com incorporação/SPE.`
      : `${natureza} — verifique se a natureza jurídica permite atividade imobiliária.`,
  });

  // Check 5: Capital social
  const capitalStr = receitaData.capital_social || "0";
  const capital = parseFloat(capitalStr.replace(/\./g, "").replace(",", "."));
  const capitalBaixo = capital < 100000;
  checks.push({
    check: "Capital Social",
    status: capitalBaixo ? "warn" : "pass",
    detail: capitalBaixo
      ? `Capital social de R$ ${capitalStr} — abaixo de R$ 100.000. Pode dificultar aprovações bancárias e habite-se.`
      : `Capital social de R$ ${capitalStr} — adequado.`,
  });

  // Check 6: Empresa recente
  const dataAbertura = receitaData.abertura || "";
  let empresaRecente = false;
  if (dataAbertura) {
    const [dia, mes, ano] = dataAbertura.split("/").map(Number);
    if (ano && mes && dia) {
      const abertura = new Date(ano, mes - 1, dia);
      const diffMeses = (Date.now() - abertura.getTime()) / (30 * 24 * 60 * 60 * 1000);
      empresaRecente = diffMeses < 6;
    }
  }
  checks.push({
    check: "Tempo de Atividade",
    status: empresaRecente ? "warn" : "pass",
    detail: empresaRecente
      ? `Empresa aberta em ${dataAbertura} — menos de 6 meses. SPEs recentes são comuns, mas verifique se o registro de incorporação está em andamento.`
      : `Empresa aberta em ${dataAbertura}.`,
  });

  // Resultado consolidado
  const failCount = checks.filter(c => c.status === "fail").length;
  const warnCount = checks.filter(c => c.status === "warn").length;
  const naturezaLower = (natureza ?? "").toLowerCase();
  const isSPE = naturezaLower.includes("propósito específico")
    || naturezaLower.includes("holding")
    || receitaData.nome?.toLowerCase()?.includes("spe");

  return {
    valid: failCount === 0,
    cnpj: digits,
    cnpj_formatado: digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"),
    dados_receita: {
      razao_social: receitaData.nome || "",
      nome_fantasia: receitaData.fantasia || "",
      situacao: receitaData.situacao || "",
      data_situacao: receitaData.data_situacao || "",
      natureza_juridica: natureza,
      cnae_principal: { codigo: cnaePrincipal, descricao: cnaeTexto },
      capital_social: capitalStr,
      data_abertura: dataAbertura,
      endereco: {
        logradouro: receitaData.logradouro || "",
        numero: receitaData.numero || "",
        bairro: receitaData.bairro || "",
        municipio: receitaData.municipio || "",
        uf: receitaData.uf || "",
        cep: receitaData.cep || "",
      },
      email: receitaData.email || "",
      telefone: receitaData.telefone || "",
    },
    is_spe: isSPE,
    checks,
    resumo: {
      total_checks: checks.length,
      pass: checks.filter(c => c.status === "pass").length,
      warn: warnCount,
      fail: failCount,
      status_geral: failCount > 0 ? "reprovado" : warnCount > 0 ? "aprovado_com_ressalvas" : "aprovado",
    },
    dicas: [
      isSPE ? "✅ Identificada como SPE — estrutura recomendada para patrimônio de afetação (Lei 10.931/04)." : null,
      !cnaeCompativel ? "⚠️ Considere incluir CNAE 41.10-7 (Incorporação) como atividade principal ou secundária." : null,
      capitalBaixo ? "⚠️ Capital social baixo pode dificultar aprovações de financiamento bancário para compradores." : null,
      situacao !== "ATIVA" ? "🚫 CNPJ não está ativo — regularize antes de prosseguir com qualquer registro de incorporação." : null,
    ].filter(Boolean),
  };
}

// ============================================================
// Router
// ============================================================

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const ctx = await buildContext(req);
    const body = await req.json();
    const action = body.action as string;

    let result: unknown;

    switch (action) {
      case "calc_itbi":
        result = await calcItbi(ctx, body);
        break;
      case "calc_outorga":
        result = await calcOutorga(ctx, body);
        break;
      case "check_lei_verde":
        result = await checkLeiVerde(ctx, body);
        break;
      case "validate_cnpj_spe":
        result = await validateCnpjSpe(ctx, body);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Ação desconhecida: ${action}` }),
          { status: 400, headers: { ...headers, "Content-Type": "application/json" } },
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("brazil-regulations error:", e);
    const status = e.message === "Unauthorized" || e.message === "Invalid token" ? 401
      : e.message === "No tenant found" ? 403
      : 500;
    return new Response(
      JSON.stringify({ error: e.message }),
      { status, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }
});
