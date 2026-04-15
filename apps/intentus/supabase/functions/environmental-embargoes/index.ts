/**
 * environmental-embargoes v1
 *
 * Edge Function multi-action para consulta de áreas embargadas e
 * autuações ambientais no Brasil.
 *
 * ACTIONS:
 *   check_ibama_embargoes   — Consulta áreas embargadas pelo IBAMA (US-126)
 *   check_icmbio_embargoes  — Consulta sobreposição com UCs do ICMBio
 *   get_embargo_details     — Detalhes de um embargo específico
 *
 * Sessão 143 — Bloco H Sprint 3
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 *
 * Fontes de dados:
 *   IBAMA — https://servicos.ibama.gov.br/ctf/publico/areasembargadas/ConsultaPublicaAreasEmbargadas.php
 *   ICMBio — https://www.gov.br/icmbio/pt-br/servicos/geoprocessamento/mapa-tematico-e-dados-geoestatisticos
 *
 * NOTA: Dados in-memory (lookup tables) com embargos de referência.
 * Em produção futura, pipeline de consulta ao WMS/WFS do IBAMA (SIG)
 * e APIs do ICMBio/SNUC para UC.
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
// Helpers
// ============================================================

function normalizeSearch(text: string): string {
  return text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function ok(data: unknown) {
  return { ok: true, data };
}

function fail(message: string, code = "INTERNAL_ERROR") {
  return { ok: false, error: { code, message } };
}

/**
 * Calcula distância aproximada entre dois pontos (km) via Haversine.
 * Usado para verificar proximidade de embargos ao terreno.
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
// Lookup Tables — Embargos IBAMA
// ============================================================

interface IbamaEmbargoEntry {
  id: string;
  numero_auto: string;
  data_embargo: string;
  municipio: string;
  uf: string;
  /** Centro aproximado da área embargada */
  lat: number;
  lng: number;
  /** Raio aproximado em km */
  raio_km: number;
  /** Área embargada em hectares */
  area_ha: number;
  infração: string;
  situacao: "vigente" | "suspenso" | "anulado";
  /** CPF/CNPJ do autuado (parcial) */
  autuado_doc: string;
  nome_autuado: string;
  bioma: string;
  tipo_vegetacao: string;
  /** Data da última atualização do status */
  ultima_atualizacao: string;
}

const IBAMA_EMBARGOS_DATA: IbamaEmbargoEntry[] = [
  {
    id: "EMB-001", numero_auto: "9105629/2023-IBAMA", data_embargo: "2023-06-15",
    municipio: "São Félix do Xingu", uf: "PA", lat: -6.6449, lng: -51.9897, raio_km: 3.5, area_ha: 850,
    infração: "Desmatamento ilegal em área de floresta amazônica sem autorização",
    situacao: "vigente", autuado_doc: "***456789**", nome_autuado: "Fazenda Boa Vista LTDA",
    bioma: "Amazônia", tipo_vegetacao: "Floresta Ombrófila Densa", ultima_atualizacao: "2025-12-01",
  },
  {
    id: "EMB-002", numero_auto: "7823451/2024-IBAMA", data_embargo: "2024-03-22",
    municipio: "Novo Progresso", uf: "PA", lat: -7.0607, lng: -55.3781, raio_km: 5.2, area_ha: 1200,
    infração: "Queimada em período proibido e desmatamento de APP",
    situacao: "vigente", autuado_doc: "***234567**", nome_autuado: "Agropecuária Progresso SA",
    bioma: "Amazônia", tipo_vegetacao: "Floresta Ombrófila Aberta", ultima_atualizacao: "2025-11-15",
  },
  {
    id: "EMB-003", numero_auto: "5412367/2023-IBAMA", data_embargo: "2023-09-10",
    municipio: "Chapada dos Guimarães", uf: "MT", lat: -15.4614, lng: -55.7497, raio_km: 1.8, area_ha: 320,
    infração: "Exploração de área sem licença ambiental em zona de amortecimento",
    situacao: "vigente", autuado_doc: "***789012**", nome_autuado: "Mineração Central LTDA",
    bioma: "Cerrado", tipo_vegetacao: "Cerrado Rupestre", ultima_atualizacao: "2025-10-20",
  },
  {
    id: "EMB-004", numero_auto: "3298765/2024-IBAMA", data_embargo: "2024-01-18",
    municipio: "Ribeirão Preto", uf: "SP", lat: -21.1767, lng: -47.8208, raio_km: 0.5, area_ha: 45,
    infração: "Supressão de vegetação nativa em APP de nascente sem autorização",
    situacao: "vigente", autuado_doc: "***345678**", nome_autuado: "Loteadora São José LTDA",
    bioma: "Mata Atlântica", tipo_vegetacao: "Floresta Estacional Semidecidual", ultima_atualizacao: "2025-09-30",
  },
  {
    id: "EMB-005", numero_auto: "6654321/2022-IBAMA", data_embargo: "2022-11-05",
    municipio: "Campinas", uf: "SP", lat: -22.9064, lng: -47.0616, raio_km: 0.3, area_ha: 18,
    infração: "Aterramento de área de várzea sem licença",
    situacao: "suspenso", autuado_doc: "***567890**", nome_autuado: "Construtora Horizonte SA",
    bioma: "Mata Atlântica", tipo_vegetacao: "Floresta Estacional Semidecidual", ultima_atualizacao: "2025-08-12",
  },
  {
    id: "EMB-006", numero_auto: "8876543/2024-IBAMA", data_embargo: "2024-07-20",
    municipio: "Piracicaba", uf: "SP", lat: -22.7338, lng: -47.6476, raio_km: 0.4, area_ha: 25,
    infração: "Desmatamento de mata ciliar em APP de córrego",
    situacao: "vigente", autuado_doc: "***678901**", nome_autuado: "Agro Piracicaba LTDA",
    bioma: "Mata Atlântica", tipo_vegetacao: "Floresta Estacional Semidecidual", ultima_atualizacao: "2026-01-15",
  },
  {
    id: "EMB-007", numero_auto: "4432198/2023-IBAMA", data_embargo: "2023-04-12",
    municipio: "Goiânia", uf: "GO", lat: -16.6869, lng: -49.2648, raio_km: 0.8, area_ha: 65,
    infração: "Loteamento irregular em área de preservação permanente",
    situacao: "vigente", autuado_doc: "***890123**", nome_autuado: "Urbanizadora Centro-Oeste LTDA",
    bioma: "Cerrado", tipo_vegetacao: "Mata de Galeria", ultima_atualizacao: "2025-12-20",
  },
  {
    id: "EMB-008", numero_auto: "2210987/2024-IBAMA", data_embargo: "2024-05-30",
    municipio: "Salvador", uf: "BA", lat: -12.9714, lng: -38.5124, raio_km: 0.6, area_ha: 35,
    infração: "Construção em dunas e restinga sem licenciamento",
    situacao: "vigente", autuado_doc: "***012345**", nome_autuado: "Imobiliária Litoral BA LTDA",
    bioma: "Mata Atlântica", tipo_vegetacao: "Restinga", ultima_atualizacao: "2025-11-28",
  },
  {
    id: "EMB-009", numero_auto: "1198765/2023-IBAMA", data_embargo: "2023-12-01",
    municipio: "Curitiba", uf: "PR", lat: -25.4284, lng: -49.2733, raio_km: 0.2, area_ha: 8,
    infração: "Movimentação de terra sem licença em área de manancial",
    situacao: "anulado", autuado_doc: "***234890**", nome_autuado: "Terraplanagem Sul LTDA",
    bioma: "Mata Atlântica", tipo_vegetacao: "Floresta Ombrófila Mista", ultima_atualizacao: "2025-07-10",
  },
  {
    id: "EMB-010", numero_auto: "7765432/2024-IBAMA", data_embargo: "2024-09-15",
    municipio: "Manaus", uf: "AM", lat: -3.1190, lng: -60.0217, raio_km: 8.0, area_ha: 2500,
    infração: "Desmatamento ilegal em larga escala para pecuária",
    situacao: "vigente", autuado_doc: "***456123**", nome_autuado: "Pecuária Amazonas SA",
    bioma: "Amazônia", tipo_vegetacao: "Floresta Ombrófila Densa", ultima_atualizacao: "2026-02-01",
  },
];

// ============================================================
// Lookup Tables — Unidades de Conservação ICMBio
// ============================================================

interface ICMBioUCEntry {
  id: string;
  nome: string;
  categoria: string;
  grupo: "proteção_integral" | "uso_sustentável";
  municipio: string;
  uf: string;
  lat: number;
  lng: number;
  raio_km: number;
  area_ha: number;
  zona_amortecimento_km: number;
  restricoes: string;
  ato_legal: string;
  plano_manejo: boolean;
}

const ICMBIO_UC_DATA: ICMBioUCEntry[] = [
  {
    id: "UC-001", nome: "Parque Nacional da Chapada dos Guimarães", categoria: "Parque Nacional",
    grupo: "proteção_integral", municipio: "Chapada dos Guimarães", uf: "MT",
    lat: -15.4080, lng: -55.8296, raio_km: 10.0, area_ha: 32630,
    zona_amortecimento_km: 3.0, restricoes: "Proibido: edificação, mineração, caça, desmatamento. Permitido: visitação em trilhas autorizadas.",
    ato_legal: "Decreto nº 97.656/1989", plano_manejo: true,
  },
  {
    id: "UC-002", nome: "Estação Ecológica de Piracicaba", categoria: "Estação Ecológica",
    grupo: "proteção_integral", municipio: "Piracicaba", uf: "SP",
    lat: -22.7100, lng: -47.6300, raio_km: 2.0, area_ha: 530,
    zona_amortecimento_km: 2.0, restricoes: "Acesso restrito a pesquisa científica. Proibido qualquer tipo de edificação ou exploração.",
    ato_legal: "Decreto Estadual nº 26.890/1987", plano_manejo: true,
  },
  {
    id: "UC-003", nome: "APA de Campinas", categoria: "Área de Proteção Ambiental",
    grupo: "uso_sustentável", municipio: "Campinas", uf: "SP",
    lat: -22.8800, lng: -47.0800, raio_km: 8.0, area_ha: 22300,
    zona_amortecimento_km: 0, restricoes: "Uso sustentável permitido com licenciamento. Restrições a empreendimentos de alto impacto. EIA/RIMA obrigatório.",
    ato_legal: "Lei Municipal nº 10.850/2001", plano_manejo: true,
  },
  {
    id: "UC-004", nome: "Parque Nacional da Tijuca", categoria: "Parque Nacional",
    grupo: "proteção_integral", municipio: "Rio de Janeiro", uf: "RJ",
    lat: -22.9608, lng: -43.2287, raio_km: 4.0, area_ha: 3953,
    zona_amortecimento_km: 1.0, restricoes: "Proibido: edificação, mineração, desmatamento. Zona de amortecimento com restrições.",
    ato_legal: "Decreto Federal nº 60.183/1967", plano_manejo: true,
  },
  {
    id: "UC-005", nome: "FLONA de Brasília", categoria: "Floresta Nacional",
    grupo: "uso_sustentável", municipio: "Brasília", uf: "DF",
    lat: -15.7870, lng: -47.9650, raio_km: 5.0, area_ha: 9346,
    zona_amortecimento_km: 2.0, restricoes: "Manejo florestal sustentável permitido. Edificação restrita a instalações de apoio.",
    ato_legal: "Decreto nº 1.298/1994", plano_manejo: true,
  },
  {
    id: "UC-006", nome: "APA da Serra da Mantiqueira", categoria: "Área de Proteção Ambiental",
    grupo: "uso_sustentável", municipio: "Campos do Jordão", uf: "SP",
    lat: -22.7500, lng: -45.5800, raio_km: 25.0, area_ha: 422873,
    zona_amortecimento_km: 0, restricoes: "Loteamentos com lotes mínimos de 5.000m². EIA/RIMA obrigatório para empreendimentos acima de 10ha.",
    ato_legal: "Decreto nº 91.304/1985", plano_manejo: false,
  },
];

// ============================================================
// Action Handlers
// ============================================================

interface CheckIbamaArgs {
  lat?: number;
  lng?: number;
  municipio?: string;
  uf?: string;
  /** Raio de busca em km (default: 10) */
  raio_busca_km?: number;
  /** Incluir embargos não-vigentes (default: false) */
  incluir_inativos?: boolean;
  limit?: number;
  offset?: number;
}

function handleCheckIbamaEmbargoes(_ctx: RequestContext, args: CheckIbamaArgs) {
  let results = [...IBAMA_EMBARGOS_DATA];

  // Filtra por situação
  if (!args.incluir_inativos) {
    results = results.filter((r) => r.situacao === "vigente");
  }

  // Filtra por coordenadas + raio (Haversine calculado uma única vez — fix Buchecha)
  if (args.lat != null && args.lng != null) {
    const raio = args.raio_busca_km || 10;
    results = results
      .map((r) => ({
        ...r,
        distancia_km: +haversineKm(args.lat!, args.lng!, r.lat, r.lng).toFixed(2),
      }))
      .filter((r) => r.distancia_km <= raio + r.raio_km)
      .sort((a, b) => a.distancia_km - b.distancia_km);
  }

  // Filtra por município
  if (args.municipio) {
    const search = normalizeSearch(args.municipio);
    results = results.filter((r) => normalizeSearch(r.municipio).includes(search));
  }

  // Filtra por UF
  if (args.uf) {
    results = results.filter((r) => r.uf === args.uf!.toUpperCase());
  }

  const total = results.length;
  const offset = args.offset || 0;
  const limit = Math.min(args.limit || 20, 50);
  const paged = results.slice(offset, offset + limit);

  // Determina nível de risco (avalia TODOS os resultados, não só a página — fix Buchecha)
  const risco = total === 0
    ? "baixo"
    : results.some((r) => r.distancia_km != null && r.distancia_km < 1)
      ? "critico"
      : results.some((r) => r.distancia_km != null && r.distancia_km < 5)
        ? "alto"
        : "moderado";

  return ok({
    embargos: paged,
    total,
    offset,
    limit,
    risco,
    resumo: total === 0
      ? "Nenhuma área embargada encontrada na região."
      : `${total} embargo(s) encontrado(s). Nível de risco: ${risco}.`,
    fonte: "IBAMA — Sistema de Áreas Embargadas",
    ultima_consulta: new Date().toISOString(),
  });
}

interface CheckICMBioArgs {
  lat?: number;
  lng?: number;
  municipio?: string;
  uf?: string;
  raio_busca_km?: number;
  limit?: number;
  offset?: number;
}

function handleCheckICMBioEmbargoes(_ctx: RequestContext, args: CheckICMBioArgs) {
  let results = [...ICMBIO_UC_DATA];

  // Filtra por coordenadas + raio (Haversine calculado uma única vez — fix Buchecha)
  if (args.lat != null && args.lng != null) {
    const raio = args.raio_busca_km || 15;
    results = results
      .map((r) => {
        const dist = +haversineKm(args.lat!, args.lng!, r.lat, r.lng).toFixed(2);
        const dentro_uc = dist <= r.raio_km;
        const dentro_zona_amortecimento = !dentro_uc && dist <= r.raio_km + r.zona_amortecimento_km;
        return {
          ...r,
          distancia_km: dist,
          dentro_uc,
          dentro_zona_amortecimento,
          impacto: dentro_uc
            ? (r.grupo === "proteção_integral" ? "bloqueante" : "restritivo")
            : dentro_zona_amortecimento
              ? "restritivo"
              : "informativo",
        };
      })
      .filter((r) => r.distancia_km <= raio + r.raio_km)
      .sort((a, b) => a.distancia_km - b.distancia_km);
  }

  // Filtra por município
  if (args.municipio) {
    const search = normalizeSearch(args.municipio);
    results = results.filter((r) => normalizeSearch(r.municipio).includes(search));
  }

  // Filtra por UF
  if (args.uf) {
    results = results.filter((r) => r.uf === args.uf!.toUpperCase());
  }

  const total = results.length;
  const offset = args.offset || 0;
  const limit = Math.min(args.limit || 20, 50);
  const paged = results.slice(offset, offset + limit);

  // Avalia risco contra TODOS os resultados, não só a página — fix Buchecha
  const algumBloqueante = results.some((r) => r.impacto === "bloqueante");
  const algumRestritivo = results.some((r) => r.impacto === "restritivo");
  const risco = algumBloqueante ? "critico" : algumRestritivo ? "alto" : total > 0 ? "moderado" : "baixo";

  return ok({
    unidades_conservacao: paged,
    total,
    offset,
    limit,
    risco,
    resumo: total === 0
      ? "Nenhuma Unidade de Conservação encontrada na região."
      : `${total} UC(s) encontrada(s). ${algumBloqueante ? "ATENÇÃO: terreno dentro de UC de proteção integral." : algumRestritivo ? "Terreno em zona de amortecimento ou APA — licenciamento especial necessário." : "UCs próximas mas sem sobreposição direta."}`,
    fonte: "ICMBio — Cadastro Nacional de Unidades de Conservação (CNUC)",
    ultima_consulta: new Date().toISOString(),
  });
}

interface GetEmbargoDetailsArgs {
  embargo_id: string;
}

function handleGetEmbargoDetails(_ctx: RequestContext, args: GetEmbargoDetailsArgs) {
  const embargo = IBAMA_EMBARGOS_DATA.find((e) => e.id === args.embargo_id);
  if (!embargo) return fail("Embargo não encontrado", "NOT_FOUND");

  return ok({
    ...embargo,
    recomendacoes: embargo.situacao === "vigente"
      ? [
          "Não realizar qualquer atividade na área embargada.",
          "Consultar o processo administrativo junto ao IBAMA para verificar possibilidade de desembargo.",
          "Contratar consultoria ambiental para avaliar o passivo.",
          "Verificar se há Termo de Ajustamento de Conduta (TAC) em andamento.",
        ]
      : embargo.situacao === "suspenso"
        ? [
            "Embargo suspenso — verificar decisão judicial e condições.",
            "Não iniciar obras até confirmação definitiva do desembargo.",
            "Solicitar certidão atualizada ao IBAMA.",
          ]
        : [
            "Embargo anulado — área liberada para uso.",
            "Recomendável obter certidão negativa atualizada do IBAMA.",
          ],
  });
}

// ============================================================
// Router
// ============================================================

type Action = "check_ibama_embargoes" | "check_icmbio_embargoes" | "get_embargo_details";

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const ctx = await buildContext(req);
    const body = await req.json();
    const action = body.action as Action;

    let result: unknown;

    switch (action) {
      case "check_ibama_embargoes":
        result = handleCheckIbamaEmbargoes(ctx, body);
        break;
      case "check_icmbio_embargoes":
        result = handleCheckICMBioEmbargoes(ctx, body);
        break;
      case "get_embargo_details":
        result = handleGetEmbargoDetails(ctx, body);
        break;
      default:
        result = fail(`Unknown action: ${action}`, "INVALID_ACTION");
    }

    return new Response(JSON.stringify(result), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify(fail(message, "INTERNAL_ERROR")), {
      status: message === "Unauthorized" || message === "Invalid token" ? 401 : 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
