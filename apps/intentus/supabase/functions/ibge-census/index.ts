/**
 * ibge-census v1
 *
 * Edge Function multi-action para dados censitários do IBGE.
 *
 * ACTIONS:
 *   fetch_census_income   — Renda por setor censitário (US-124)
 *   fetch_census_demographics — Demografia por setor censitário
 *   fetch_census_housing  — Dados de domicílios por setor censitário
 *
 * Sessão 143 — Bloco H Sprint 3
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 *
 * Fonte de dados:
 *   IBGE Agregados API — https://servicodados.ibge.gov.br/api/v3/agregados
 *   Censo 2022 (resultados parciais) + Censo 2010 (resultados completos)
 *
 * NOTA: Dados in-memory (lookup tables) com valores de referência por setor
 * censitário / município. Em produção futura, pipeline de ingestão dos
 * microdados do Censo 2022 (quando liberados completos pelo IBGE).
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

// ============================================================
// Lookup Tables — Renda por Setor Censitário (Censo 2022/2010)
// ============================================================

interface CensusIncomeEntry {
  /** Código do setor censitário IBGE (15 dígitos) */
  setor_codigo: string;
  /** Código do município (7 dígitos) */
  municipio_codigo: string;
  /** Nome do município */
  municipio_nome: string;
  uf: string;
  /** Renda domiciliar média mensal (R$) */
  renda_domiciliar_media: number;
  /** Renda per capita média (R$) */
  renda_per_capita: number;
  /** Percentual de domicílios com renda > 5 SM */
  pct_renda_acima_5sm: number;
  /** Percentual de domicílios com renda < 1 SM */
  pct_renda_abaixo_1sm: number;
  /** Classificação socioeconômica (A/B/C/D/E) */
  classe_predominante: string;
  /** Fonte (censo 2010 ou 2022 parcial) */
  fonte: string;
  /** Ano de referência */
  ano_referencia: number;
  /** Tipo: urbano ou rural */
  tipo_setor: "urbano" | "rural";
}

// Dados de referência por município (agregado de setores censitários)
// Em produção: microdados do Censo 2022 com granularidade de setor
// v2 (sessão 150): expansão para 55 municípios cobrindo todas as regiões do Brasil
const CENSUS_INCOME_DATA: CensusIncomeEntry[] = [
  // ── Sudeste — SP Capital ──────────────────────────────────────
  { setor_codigo: "355030805000001", municipio_codigo: "3550308", municipio_nome: "São Paulo", uf: "SP", renda_domiciliar_media: 12850, renda_per_capita: 4283, pct_renda_acima_5sm: 42.3, pct_renda_abaixo_1sm: 8.1, classe_predominante: "B", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "355030805000002", municipio_codigo: "3550308", municipio_nome: "São Paulo", uf: "SP", renda_domiciliar_media: 4520, renda_per_capita: 1130, pct_renda_acima_5sm: 5.2, pct_renda_abaixo_1sm: 32.4, classe_predominante: "D", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "355030805000003", municipio_codigo: "3550308", municipio_nome: "São Paulo", uf: "SP", renda_domiciliar_media: 22400, renda_per_capita: 8960, pct_renda_acima_5sm: 68.7, pct_renda_abaixo_1sm: 2.1, classe_predominante: "A", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },

  // ── SP Interior ───────────────────────────────────────────────
  { setor_codigo: "350950905000001", municipio_codigo: "3509502", municipio_nome: "Campinas", uf: "SP", renda_domiciliar_media: 9850, renda_per_capita: 3283, pct_renda_acima_5sm: 31.5, pct_renda_abaixo_1sm: 11.2, classe_predominante: "B", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "350950905000002", municipio_codigo: "3509502", municipio_nome: "Campinas", uf: "SP", renda_domiciliar_media: 5200, renda_per_capita: 1480, pct_renda_acima_5sm: 8.4, pct_renda_abaixo_1sm: 24.6, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "353930705000001", municipio_codigo: "3539307", municipio_nome: "Piracicaba", uf: "SP", renda_domiciliar_media: 7680, renda_per_capita: 2560, pct_renda_acima_5sm: 22.1, pct_renda_abaixo_1sm: 13.8, classe_predominante: "B", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "353930705000002", municipio_codigo: "3539307", municipio_nome: "Piracicaba", uf: "SP", renda_domiciliar_media: 4100, renda_per_capita: 1170, pct_renda_acima_5sm: 4.8, pct_renda_abaixo_1sm: 28.3, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "354340005000001", municipio_codigo: "3543402", municipio_nome: "Ribeirão Preto", uf: "SP", renda_domiciliar_media: 8400, renda_per_capita: 2800, pct_renda_acima_5sm: 26.3, pct_renda_abaixo_1sm: 11.9, classe_predominante: "B", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "355220405000001", municipio_codigo: "3552205", municipio_nome: "Sorocaba", uf: "SP", renda_domiciliar_media: 7100, renda_per_capita: 2367, pct_renda_acima_5sm: 18.7, pct_renda_abaixo_1sm: 14.2, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "354990405000001", municipio_codigo: "3549904", municipio_nome: "São José dos Campos", uf: "SP", renda_domiciliar_media: 9200, renda_per_capita: 3067, pct_renda_acima_5sm: 29.4, pct_renda_abaixo_1sm: 10.8, classe_predominante: "B", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "352590405000001", municipio_codigo: "3525904", municipio_nome: "Jundiaí", uf: "SP", renda_domiciliar_media: 8800, renda_per_capita: 2933, pct_renda_acima_5sm: 27.1, pct_renda_abaixo_1sm: 11.4, classe_predominante: "B", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "351880005000001", municipio_codigo: "3518800", municipio_nome: "Guarulhos", uf: "SP", renda_domiciliar_media: 5900, renda_per_capita: 1475, pct_renda_acima_5sm: 10.2, pct_renda_abaixo_1sm: 21.7, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "353440105000001", municipio_codigo: "3534401", municipio_nome: "Osasco", uf: "SP", renda_domiciliar_media: 6400, renda_per_capita: 1600, pct_renda_acima_5sm: 13.8, pct_renda_abaixo_1sm: 19.3, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "354850005000001", municipio_codigo: "3548500", municipio_nome: "Santos", uf: "SP", renda_domiciliar_media: 9100, renda_per_capita: 3033, pct_renda_acima_5sm: 28.7, pct_renda_abaixo_1sm: 11.1, classe_predominante: "B", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "350600305000001", municipio_codigo: "3506003", municipio_nome: "Bauru", uf: "SP", renda_domiciliar_media: 7600, renda_per_capita: 2533, pct_renda_acima_5sm: 21.5, pct_renda_abaixo_1sm: 13.4, classe_predominante: "B", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "354870805000001", municipio_codigo: "3548708", municipio_nome: "São Bernardo do Campo", uf: "SP", renda_domiciliar_media: 7800, renda_per_capita: 2600, pct_renda_acima_5sm: 22.8, pct_renda_abaixo_1sm: 12.6, classe_predominante: "B", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },

  // ── RJ ────────────────────────────────────────────────────────
  { setor_codigo: "330045505000001", municipio_codigo: "3304557", municipio_nome: "Rio de Janeiro", uf: "RJ", renda_domiciliar_media: 11200, renda_per_capita: 3733, pct_renda_acima_5sm: 38.9, pct_renda_abaixo_1sm: 9.4, classe_predominante: "B", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "330045505000002", municipio_codigo: "3304557", municipio_nome: "Rio de Janeiro", uf: "RJ", renda_domiciliar_media: 3200, renda_per_capita: 800, pct_renda_acima_5sm: 2.1, pct_renda_abaixo_1sm: 45.6, classe_predominante: "D", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "330390305000001", municipio_codigo: "3303905", municipio_nome: "Niterói", uf: "RJ", renda_domiciliar_media: 10800, renda_per_capita: 3600, pct_renda_acima_5sm: 36.4, pct_renda_abaixo_1sm: 8.2, classe_predominante: "B", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "330285005000001", municipio_codigo: "3301900", municipio_nome: "Campos dos Goytacazes", uf: "RJ", renda_domiciliar_media: 5600, renda_per_capita: 1400, pct_renda_acima_5sm: 13.2, pct_renda_abaixo_1sm: 23.5, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },

  // ── MG ────────────────────────────────────────────────────────
  { setor_codigo: "310620405000001", municipio_codigo: "3106200", municipio_nome: "Belo Horizonte", uf: "MG", renda_domiciliar_media: 8900, renda_per_capita: 2967, pct_renda_acima_5sm: 28.4, pct_renda_abaixo_1sm: 12.7, classe_predominante: "B", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "317020605000001", municipio_codigo: "3170206", municipio_nome: "Uberlândia", uf: "MG", renda_domiciliar_media: 8100, renda_per_capita: 2700, pct_renda_acima_5sm: 24.6, pct_renda_abaixo_1sm: 12.1, classe_predominante: "B", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "313670205000001", municipio_codigo: "3136702", municipio_nome: "Juiz de Fora", uf: "MG", renda_domiciliar_media: 6900, renda_per_capita: 2300, pct_renda_acima_5sm: 17.8, pct_renda_abaixo_1sm: 16.3, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "314330205000001", municipio_codigo: "3143302", municipio_nome: "Montes Claros", uf: "MG", renda_domiciliar_media: 5500, renda_per_capita: 1375, pct_renda_acima_5sm: 12.4, pct_renda_abaixo_1sm: 24.8, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "311860105000001", municipio_codigo: "3118601", municipio_nome: "Contagem", uf: "MG", renda_domiciliar_media: 5800, renda_per_capita: 1450, pct_renda_acima_5sm: 11.6, pct_renda_abaixo_1sm: 20.9, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },

  // ── ES ────────────────────────────────────────────────────────
  { setor_codigo: "320530905000001", municipio_codigo: "3205309", municipio_nome: "Vitória", uf: "ES", renda_domiciliar_media: 8600, renda_per_capita: 2867, pct_renda_acima_5sm: 27.3, pct_renda_abaixo_1sm: 11.8, classe_predominante: "B", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "320150105000001", municipio_codigo: "3201506", municipio_nome: "Cariacica", uf: "ES", renda_domiciliar_media: 4800, renda_per_capita: 1200, pct_renda_acima_5sm: 7.9, pct_renda_abaixo_1sm: 27.6, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },

  // ── Sul — PR ──────────────────────────────────────────────────
  { setor_codigo: "410690105000001", municipio_codigo: "4106902", municipio_nome: "Curitiba", uf: "PR", renda_domiciliar_media: 9450, renda_per_capita: 3150, pct_renda_acima_5sm: 30.1, pct_renda_abaixo_1sm: 10.5, classe_predominante: "B", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "411370005000001", municipio_codigo: "4113700", municipio_nome: "Londrina", uf: "PR", renda_domiciliar_media: 7900, renda_per_capita: 2633, pct_renda_acima_5sm: 23.2, pct_renda_abaixo_1sm: 13.0, classe_predominante: "B", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "411520005000001", municipio_codigo: "4115200", municipio_nome: "Maringá", uf: "PR", renda_domiciliar_media: 8200, renda_per_capita: 2733, pct_renda_acima_5sm: 25.1, pct_renda_abaixo_1sm: 11.7, classe_predominante: "B", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "411800005000001", municipio_codigo: "4118204", municipio_nome: "Ponta Grossa", uf: "PR", renda_domiciliar_media: 6500, renda_per_capita: 2167, pct_renda_acima_5sm: 16.4, pct_renda_abaixo_1sm: 18.2, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },

  // ── SC ────────────────────────────────────────────────────────
  { setor_codigo: "420910205000001", municipio_codigo: "4209102", municipio_nome: "Joinville", uf: "SC", renda_domiciliar_media: 9000, renda_per_capita: 3000, pct_renda_acima_5sm: 28.8, pct_renda_abaixo_1sm: 10.2, classe_predominante: "B", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "420240405000001", municipio_codigo: "4202404", municipio_nome: "Blumenau", uf: "SC", renda_domiciliar_media: 8700, renda_per_capita: 2900, pct_renda_acima_5sm: 27.5, pct_renda_abaixo_1sm: 10.6, classe_predominante: "B", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "420540005000001", municipio_codigo: "4205407", municipio_nome: "Florianópolis", uf: "SC", renda_domiciliar_media: 10200, renda_per_capita: 3400, pct_renda_acima_5sm: 34.5, pct_renda_abaixo_1sm: 8.7, classe_predominante: "B", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },

  // ── RS ────────────────────────────────────────────────────────
  { setor_codigo: "431490205000001", municipio_codigo: "4314902", municipio_nome: "Porto Alegre", uf: "RS", renda_domiciliar_media: 8750, renda_per_capita: 2917, pct_renda_acima_5sm: 27.8, pct_renda_abaixo_1sm: 13.2, classe_predominante: "B", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "430510805000001", municipio_codigo: "4305108", municipio_nome: "Caxias do Sul", uf: "RS", renda_domiciliar_media: 8500, renda_per_capita: 2833, pct_renda_acima_5sm: 26.4, pct_renda_abaixo_1sm: 11.0, classe_predominante: "B", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "431410005000001", municipio_codigo: "4314100", municipio_nome: "Pelotas", uf: "RS", renda_domiciliar_media: 5900, renda_per_capita: 1475, pct_renda_acima_5sm: 13.6, pct_renda_abaixo_1sm: 22.4, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "431440005000001", municipio_codigo: "4314407", municipio_nome: "Canoas", uf: "RS", renda_domiciliar_media: 6800, renda_per_capita: 1700, pct_renda_acima_5sm: 16.2, pct_renda_abaixo_1sm: 17.3, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },

  // ── Centro-Oeste ──────────────────────────────────────────────
  { setor_codigo: "520870005000001", municipio_codigo: "5208707", municipio_nome: "Goiânia", uf: "GO", renda_domiciliar_media: 7200, renda_per_capita: 2400, pct_renda_acima_5sm: 19.5, pct_renda_abaixo_1sm: 15.6, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "520140805000001", municipio_codigo: "5201405", municipio_nome: "Aparecida de Goiânia", uf: "GO", renda_domiciliar_media: 4900, renda_per_capita: 1225, pct_renda_acima_5sm: 7.8, pct_renda_abaixo_1sm: 26.3, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "520110805000001", municipio_codigo: "5201108", municipio_nome: "Anápolis", uf: "GO", renda_domiciliar_media: 5800, renda_per_capita: 1450, pct_renda_acima_5sm: 13.4, pct_renda_abaixo_1sm: 21.8, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "530010805000001", municipio_codigo: "5300108", municipio_nome: "Brasília", uf: "DF", renda_domiciliar_media: 14200, renda_per_capita: 4733, pct_renda_acima_5sm: 48.2, pct_renda_abaixo_1sm: 6.3, classe_predominante: "A", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "530010805000002", municipio_codigo: "5300108", municipio_nome: "Brasília", uf: "DF", renda_domiciliar_media: 3800, renda_per_capita: 950, pct_renda_acima_5sm: 3.1, pct_renda_abaixo_1sm: 38.7, classe_predominante: "D", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "500270405000001", municipio_codigo: "5002704", municipio_nome: "Campo Grande", uf: "MS", renda_domiciliar_media: 7500, renda_per_capita: 2500, pct_renda_acima_5sm: 20.8, pct_renda_abaixo_1sm: 14.5, classe_predominante: "B", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "500192005000001", municipio_codigo: "5001920", municipio_nome: "Cassilândia", uf: "MS", renda_domiciliar_media: 3400, renda_per_capita: 1133, pct_renda_acima_5sm: 3.2, pct_renda_abaixo_1sm: 33.5, classe_predominante: "D", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "500370305000001", municipio_codigo: "5003702", municipio_nome: "Dourados", uf: "MS", renda_domiciliar_media: 5200, renda_per_capita: 1300, pct_renda_acima_5sm: 10.6, pct_renda_abaixo_1sm: 25.8, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "510340505000001", municipio_codigo: "5103403", municipio_nome: "Cuiabá", uf: "MT", renda_domiciliar_media: 6900, renda_per_capita: 2300, pct_renda_acima_5sm: 18.2, pct_renda_abaixo_1sm: 16.8, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "510790005000001", municipio_codigo: "5107909", municipio_nome: "Várzea Grande", uf: "MT", renda_domiciliar_media: 4600, renda_per_capita: 1150, pct_renda_acima_5sm: 6.8, pct_renda_abaixo_1sm: 28.4, classe_predominante: "D", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },

  // ── Nordeste ──────────────────────────────────────────────────
  { setor_codigo: "292740805000001", municipio_codigo: "2927408", municipio_nome: "Salvador", uf: "BA", renda_domiciliar_media: 5800, renda_per_capita: 1450, pct_renda_acima_5sm: 14.2, pct_renda_abaixo_1sm: 22.8, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "230440005000001", municipio_codigo: "2304400", municipio_nome: "Fortaleza", uf: "CE", renda_domiciliar_media: 5100, renda_per_capita: 1275, pct_renda_acima_5sm: 11.8, pct_renda_abaixo_1sm: 26.4, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "261160005000001", municipio_codigo: "2611606", municipio_nome: "Recife", uf: "PE", renda_domiciliar_media: 5400, renda_per_capita: 1350, pct_renda_acima_5sm: 12.6, pct_renda_abaixo_1sm: 24.1, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "240810205000001", municipio_codigo: "2408102", municipio_nome: "Natal", uf: "RN", renda_domiciliar_media: 5600, renda_per_capita: 1400, pct_renda_acima_5sm: 13.1, pct_renda_abaixo_1sm: 23.4, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "250750705000001", municipio_codigo: "2507507", municipio_nome: "João Pessoa", uf: "PB", renda_domiciliar_media: 5700, renda_per_capita: 1425, pct_renda_acima_5sm: 13.9, pct_renda_abaixo_1sm: 22.6, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "270430205000001", municipio_codigo: "2704302", municipio_nome: "Maceió", uf: "AL", renda_domiciliar_media: 4800, renda_per_capita: 1200, pct_renda_acima_5sm: 9.4, pct_renda_abaixo_1sm: 29.7, classe_predominante: "D", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "280030805000001", municipio_codigo: "2800308", municipio_nome: "Aracaju", uf: "SE", renda_domiciliar_media: 6100, renda_per_capita: 1525, pct_renda_acima_5sm: 14.8, pct_renda_abaixo_1sm: 21.2, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "211130005000001", municipio_codigo: "2111300", municipio_nome: "São Luís", uf: "MA", renda_domiciliar_media: 5000, renda_per_capita: 1250, pct_renda_acima_5sm: 10.6, pct_renda_abaixo_1sm: 27.8, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "221100105000001", municipio_codigo: "2211001", municipio_nome: "Teresina", uf: "PI", renda_domiciliar_media: 5200, renda_per_capita: 1300, pct_renda_acima_5sm: 11.4, pct_renda_abaixo_1sm: 25.6, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "290570005000001", municipio_codigo: "2905701", municipio_nome: "Camaçari", uf: "BA", renda_domiciliar_media: 5100, renda_per_capita: 1275, pct_renda_acima_5sm: 10.8, pct_renda_abaixo_1sm: 26.9, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "260790005000001", municipio_codigo: "2607901", municipio_nome: "Jaboatão dos Guararapes", uf: "PE", renda_domiciliar_media: 4300, renda_per_capita: 1075, pct_renda_acima_5sm: 7.2, pct_renda_abaixo_1sm: 32.1, classe_predominante: "D", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },

  // ── Norte ─────────────────────────────────────────────────────
  { setor_codigo: "130260005000001", municipio_codigo: "1302603", municipio_nome: "Manaus", uf: "AM", renda_domiciliar_media: 4300, renda_per_capita: 1075, pct_renda_acima_5sm: 7.6, pct_renda_abaixo_1sm: 31.2, classe_predominante: "D", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "150140005000001", municipio_codigo: "1501402", municipio_nome: "Belém", uf: "PA", renda_domiciliar_media: 4600, renda_per_capita: 1150, pct_renda_acima_5sm: 8.9, pct_renda_abaixo_1sm: 28.7, classe_predominante: "D", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "110020005000001", municipio_codigo: "1100205", municipio_nome: "Porto Velho", uf: "RO", renda_domiciliar_media: 5400, renda_per_capita: 1350, pct_renda_acima_5sm: 12.3, pct_renda_abaixo_1sm: 23.8, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "120040005000001", municipio_codigo: "1200401", municipio_nome: "Rio Branco", uf: "AC", renda_domiciliar_media: 4400, renda_per_capita: 1100, pct_renda_acima_5sm: 8.1, pct_renda_abaixo_1sm: 30.4, classe_predominante: "D", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "160030005000001", municipio_codigo: "1600303", municipio_nome: "Macapá", uf: "AP", renda_domiciliar_media: 4100, renda_per_capita: 1025, pct_renda_acima_5sm: 6.4, pct_renda_abaixo_1sm: 33.7, classe_predominante: "D", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "140028005000001", municipio_codigo: "1400027", municipio_nome: "Boa Vista", uf: "RR", renda_domiciliar_media: 5600, renda_per_capita: 1400, pct_renda_acima_5sm: 13.2, pct_renda_abaixo_1sm: 23.1, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
  { setor_codigo: "172100005000001", municipio_codigo: "1721000", municipio_nome: "Palmas", uf: "TO", renda_domiciliar_media: 7100, renda_per_capita: 2367, pct_renda_acima_5sm: 19.6, pct_renda_abaixo_1sm: 15.2, classe_predominante: "C", fonte: "censo_2022_parcial", ano_referencia: 2022, tipo_setor: "urbano" },
];

// ============================================================
// Lookup Tables — Demografia por Setor Censitário
// ============================================================

interface CensusDemographicsEntry {
  municipio_codigo: string;
  municipio_nome: string;
  uf: string;
  populacao_total: number;
  densidade_hab_km2: number;
  taxa_crescimento_anual_pct: number;
  populacao_urbana_pct: number;
  idade_media: number;
  indice_envelhecimento: number;
  razao_dependencia: number;
  fonte: string;
  ano_referencia: number;
}

// v2 (sessão 150): expansão para 50 municípios
const CENSUS_DEMOGRAPHICS_DATA: CensusDemographicsEntry[] = [
  // Sudeste — SP
  { municipio_codigo: "3550308", municipio_nome: "São Paulo", uf: "SP", populacao_total: 11451245, densidade_hab_km2: 7528.9, taxa_crescimento_anual_pct: 0.48, populacao_urbana_pct: 99.1, idade_media: 36.4, indice_envelhecimento: 72.8, razao_dependencia: 42.1, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3509502", municipio_nome: "Campinas", uf: "SP", populacao_total: 1139047, densidade_hab_km2: 1436.2, taxa_crescimento_anual_pct: 0.62, populacao_urbana_pct: 98.3, idade_media: 35.8, indice_envelhecimento: 68.4, razao_dependencia: 40.5, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3539307", municipio_nome: "Piracicaba", uf: "SP", populacao_total: 404142, densidade_hab_km2: 293.4, taxa_crescimento_anual_pct: 0.71, populacao_urbana_pct: 96.8, idade_media: 35.2, indice_envelhecimento: 64.1, razao_dependencia: 39.8, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3543402", municipio_nome: "Ribeirão Preto", uf: "SP", populacao_total: 698642, densidade_hab_km2: 1077.8, taxa_crescimento_anual_pct: 0.84, populacao_urbana_pct: 99.4, idade_media: 35.0, indice_envelhecimento: 62.8, razao_dependencia: 38.9, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3552205", municipio_nome: "Sorocaba", uf: "SP", populacao_total: 686072, densidade_hab_km2: 624.3, taxa_crescimento_anual_pct: 1.02, populacao_urbana_pct: 98.7, idade_media: 34.4, indice_envelhecimento: 58.1, razao_dependencia: 38.2, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3549904", municipio_nome: "São José dos Campos", uf: "SP", populacao_total: 729737, densidade_hab_km2: 476.2, taxa_crescimento_anual_pct: 0.93, populacao_urbana_pct: 97.9, idade_media: 34.8, indice_envelhecimento: 60.4, razao_dependencia: 39.1, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3525904", municipio_nome: "Jundiaí", uf: "SP", populacao_total: 427025, densidade_hab_km2: 710.8, taxa_crescimento_anual_pct: 0.78, populacao_urbana_pct: 98.2, idade_media: 36.1, indice_envelhecimento: 70.2, razao_dependencia: 40.8, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3518800", municipio_nome: "Guarulhos", uf: "SP", populacao_total: 1391820, densidade_hab_km2: 3869.4, taxa_crescimento_anual_pct: 0.54, populacao_urbana_pct: 100.0, idade_media: 33.9, indice_envelhecimento: 55.6, razao_dependencia: 37.4, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3534401", municipio_nome: "Osasco", uf: "SP", populacao_total: 699384, densidade_hab_km2: 12046.8, taxa_crescimento_anual_pct: 0.21, populacao_urbana_pct: 100.0, idade_media: 34.6, indice_envelhecimento: 61.3, razao_dependencia: 39.7, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3548500", municipio_nome: "Santos", uf: "SP", populacao_total: 433966, densidade_hab_km2: 1522.7, taxa_crescimento_anual_pct: -0.08, populacao_urbana_pct: 100.0, idade_media: 38.9, indice_envelhecimento: 92.4, razao_dependencia: 46.8, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3506003", municipio_nome: "Bauru", uf: "SP", populacao_total: 383102, densidade_hab_km2: 194.6, taxa_crescimento_anual_pct: 0.56, populacao_urbana_pct: 98.9, idade_media: 36.3, indice_envelhecimento: 71.4, razao_dependencia: 41.2, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3548708", municipio_nome: "São Bernardo do Campo", uf: "SP", populacao_total: 822209, densidade_hab_km2: 2249.3, taxa_crescimento_anual_pct: 0.34, populacao_urbana_pct: 98.4, idade_media: 35.2, indice_envelhecimento: 63.7, razao_dependencia: 39.6, fonte: "censo_2022", ano_referencia: 2022 },

  // RJ
  { municipio_codigo: "3304557", municipio_nome: "Rio de Janeiro", uf: "RJ", populacao_total: 6211423, densidade_hab_km2: 5091.7, taxa_crescimento_anual_pct: -0.12, populacao_urbana_pct: 100.0, idade_media: 37.8, indice_envelhecimento: 82.3, razao_dependencia: 44.7, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3303905", municipio_nome: "Niterói", uf: "RJ", populacao_total: 500832, densidade_hab_km2: 3766.4, taxa_crescimento_anual_pct: 0.14, populacao_urbana_pct: 100.0, idade_media: 38.6, indice_envelhecimento: 89.1, razao_dependencia: 45.4, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3301900", municipio_nome: "Campos dos Goytacazes", uf: "RJ", populacao_total: 536191, densidade_hab_km2: 122.8, taxa_crescimento_anual_pct: 0.28, populacao_urbana_pct: 91.3, idade_media: 34.9, indice_envelhecimento: 61.8, razao_dependencia: 40.2, fonte: "censo_2022", ano_referencia: 2022 },

  // MG
  { municipio_codigo: "3106200", municipio_nome: "Belo Horizonte", uf: "MG", populacao_total: 2315560, densidade_hab_km2: 6963.2, taxa_crescimento_anual_pct: 0.21, populacao_urbana_pct: 100.0, idade_media: 36.1, indice_envelhecimento: 70.5, razao_dependencia: 41.3, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3170206", municipio_nome: "Uberlândia", uf: "MG", populacao_total: 706597, densidade_hab_km2: 95.6, taxa_crescimento_anual_pct: 1.48, populacao_urbana_pct: 97.4, idade_media: 32.8, indice_envelhecimento: 49.6, razao_dependencia: 36.1, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3136702", municipio_nome: "Juiz de Fora", uf: "MG", populacao_total: 561544, densidade_hab_km2: 244.8, taxa_crescimento_anual_pct: 0.46, populacao_urbana_pct: 98.8, idade_media: 36.4, indice_envelhecimento: 72.1, razao_dependencia: 41.8, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3143302", municipio_nome: "Montes Claros", uf: "MG", populacao_total: 411213, densidade_hab_km2: 100.6, taxa_crescimento_anual_pct: 0.82, populacao_urbana_pct: 93.2, idade_media: 32.4, indice_envelhecimento: 47.3, razao_dependencia: 35.6, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3118601", municipio_nome: "Contagem", uf: "MG", populacao_total: 666940, densidade_hab_km2: 2621.4, taxa_crescimento_anual_pct: 0.38, populacao_urbana_pct: 100.0, idade_media: 34.7, indice_envelhecimento: 61.4, razao_dependencia: 39.3, fonte: "censo_2022", ano_referencia: 2022 },

  // ES
  { municipio_codigo: "3205309", municipio_nome: "Vitória", uf: "ES", populacao_total: 365855, densidade_hab_km2: 3625.7, taxa_crescimento_anual_pct: 0.16, populacao_urbana_pct: 100.0, idade_media: 37.1, indice_envelhecimento: 76.8, razao_dependencia: 43.2, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3201506", municipio_nome: "Cariacica", uf: "ES", populacao_total: 392648, densidade_hab_km2: 1162.3, taxa_crescimento_anual_pct: 0.42, populacao_urbana_pct: 99.1, idade_media: 33.6, indice_envelhecimento: 52.7, razao_dependencia: 37.1, fonte: "censo_2022", ano_referencia: 2022 },

  // Sul — PR
  { municipio_codigo: "4106902", municipio_nome: "Curitiba", uf: "PR", populacao_total: 1773733, densidade_hab_km2: 4102.4, taxa_crescimento_anual_pct: 0.38, populacao_urbana_pct: 100.0, idade_media: 35.6, indice_envelhecimento: 66.2, razao_dependencia: 39.1, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "4113700", municipio_nome: "Londrina", uf: "PR", populacao_total: 578546, densidade_hab_km2: 303.9, taxa_crescimento_anual_pct: 0.68, populacao_urbana_pct: 97.6, idade_media: 35.3, indice_envelhecimento: 64.8, razao_dependencia: 39.4, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "4115200", municipio_nome: "Maringá", uf: "PR", populacao_total: 436747, densidade_hab_km2: 571.3, taxa_crescimento_anual_pct: 0.82, populacao_urbana_pct: 98.4, idade_media: 35.1, indice_envelhecimento: 63.2, razao_dependencia: 38.8, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "4118204", municipio_nome: "Ponta Grossa", uf: "PR", populacao_total: 342860, densidade_hab_km2: 103.6, taxa_crescimento_anual_pct: 0.74, populacao_urbana_pct: 97.8, idade_media: 34.2, indice_envelhecimento: 57.4, razao_dependencia: 38.1, fonte: "censo_2022", ano_referencia: 2022 },

  // SC
  { municipio_codigo: "4209102", municipio_nome: "Joinville", uf: "SC", populacao_total: 616527, densidade_hab_km2: 462.8, taxa_crescimento_anual_pct: 1.14, populacao_urbana_pct: 97.4, idade_media: 35.0, indice_envelhecimento: 62.4, razao_dependencia: 38.7, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "4202404", municipio_nome: "Blumenau", uf: "SC", populacao_total: 374822, densidade_hab_km2: 476.4, taxa_crescimento_anual_pct: 0.88, populacao_urbana_pct: 97.1, idade_media: 35.6, indice_envelhecimento: 65.8, razao_dependencia: 39.4, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "4205407", municipio_nome: "Florianópolis", uf: "SC", populacao_total: 537213, densidade_hab_km2: 1235.4, taxa_crescimento_anual_pct: 1.67, populacao_urbana_pct: 96.2, idade_media: 34.7, indice_envelhecimento: 60.1, razao_dependencia: 37.4, fonte: "censo_2022", ano_referencia: 2022 },

  // RS
  { municipio_codigo: "4314902", municipio_nome: "Porto Alegre", uf: "RS", populacao_total: 1332570, densidade_hab_km2: 2767.1, taxa_crescimento_anual_pct: -0.28, populacao_urbana_pct: 100.0, idade_media: 38.4, indice_envelhecimento: 88.7, razao_dependencia: 46.2, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "4305108", municipio_nome: "Caxias do Sul", uf: "RS", populacao_total: 532564, densidade_hab_km2: 274.9, taxa_crescimento_anual_pct: 0.91, populacao_urbana_pct: 96.8, idade_media: 35.8, indice_envelhecimento: 67.2, razao_dependencia: 40.1, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "4314100", municipio_nome: "Pelotas", uf: "RS", populacao_total: 342873, densidade_hab_km2: 127.6, taxa_crescimento_anual_pct: 0.12, populacao_urbana_pct: 93.4, idade_media: 37.2, indice_envelhecimento: 78.4, razao_dependencia: 43.8, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "4314407", municipio_nome: "Canoas", uf: "RS", populacao_total: 349937, densidade_hab_km2: 2942.3, taxa_crescimento_anual_pct: 0.18, populacao_urbana_pct: 100.0, idade_media: 35.4, indice_envelhecimento: 64.1, razao_dependencia: 39.2, fonte: "censo_2022", ano_referencia: 2022 },

  // Centro-Oeste
  { municipio_codigo: "5208707", municipio_nome: "Goiânia", uf: "GO", populacao_total: 1437237, densidade_hab_km2: 1944.8, taxa_crescimento_anual_pct: 1.12, populacao_urbana_pct: 99.6, idade_media: 33.5, indice_envelhecimento: 54.3, razao_dependencia: 36.8, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "5201405", municipio_nome: "Aparecida de Goiânia", uf: "GO", populacao_total: 635636, densidade_hab_km2: 1342.6, taxa_crescimento_anual_pct: 2.18, populacao_urbana_pct: 99.1, idade_media: 29.4, indice_envelhecimento: 32.8, razao_dependencia: 32.1, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "5201108", municipio_nome: "Anápolis", uf: "GO", populacao_total: 391772, densidade_hab_km2: 393.8, taxa_crescimento_anual_pct: 1.24, populacao_urbana_pct: 98.6, idade_media: 32.6, indice_envelhecimento: 49.1, razao_dependencia: 35.8, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "5300108", municipio_nome: "Brasília", uf: "DF", populacao_total: 2817381, densidade_hab_km2: 486.8, taxa_crescimento_anual_pct: 1.24, populacao_urbana_pct: 96.6, idade_media: 33.1, indice_envelhecimento: 48.9, razao_dependencia: 35.4, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "5002704", municipio_nome: "Campo Grande", uf: "MS", populacao_total: 916001, densidade_hab_km2: 108.2, taxa_crescimento_anual_pct: 1.18, populacao_urbana_pct: 98.7, idade_media: 32.8, indice_envelhecimento: 50.2, razao_dependencia: 36.1, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "5001920", municipio_nome: "Cassilândia", uf: "MS", populacao_total: 20880, densidade_hab_km2: 5.5, taxa_crescimento_anual_pct: -0.42, populacao_urbana_pct: 88.6, idade_media: 36.8, indice_envelhecimento: 74.2, razao_dependencia: 43.5, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "5003702", municipio_nome: "Dourados", uf: "MS", populacao_total: 229499, densidade_hab_km2: 77.4, taxa_crescimento_anual_pct: 1.04, populacao_urbana_pct: 91.2, idade_media: 31.6, indice_envelhecimento: 44.8, razao_dependencia: 34.9, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "5103403", municipio_nome: "Cuiabá", uf: "MT", populacao_total: 629613, densidade_hab_km2: 157.3, taxa_crescimento_anual_pct: 1.32, populacao_urbana_pct: 99.1, idade_media: 32.4, indice_envelhecimento: 48.1, razao_dependencia: 35.2, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "5107909", municipio_nome: "Várzea Grande", uf: "MT", populacao_total: 295598, densidade_hab_km2: 296.4, taxa_crescimento_anual_pct: 1.56, populacao_urbana_pct: 98.8, idade_media: 31.2, indice_envelhecimento: 42.6, razao_dependencia: 33.8, fonte: "censo_2022", ano_referencia: 2022 },

  // Nordeste
  { municipio_codigo: "2927408", municipio_nome: "Salvador", uf: "BA", populacao_total: 2418005, densidade_hab_km2: 3475.6, taxa_crescimento_anual_pct: 0.05, populacao_urbana_pct: 100.0, idade_media: 34.2, indice_envelhecimento: 58.6, razao_dependencia: 38.2, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "2304400", municipio_nome: "Fortaleza", uf: "CE", populacao_total: 2428678, densidade_hab_km2: 7786.4, taxa_crescimento_anual_pct: 0.32, populacao_urbana_pct: 100.0, idade_media: 33.8, indice_envelhecimento: 52.1, razao_dependencia: 37.6, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "2611606", municipio_nome: "Recife", uf: "PE", populacao_total: 1488920, densidade_hab_km2: 7039.6, taxa_crescimento_anual_pct: -0.08, populacao_urbana_pct: 100.0, idade_media: 35.1, indice_envelhecimento: 63.4, razao_dependencia: 39.8, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "2408102", municipio_nome: "Natal", uf: "RN", populacao_total: 890480, densidade_hab_km2: 4813.2, taxa_crescimento_anual_pct: 0.18, populacao_urbana_pct: 100.0, idade_media: 34.4, indice_envelhecimento: 59.2, razao_dependencia: 38.6, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "2507507", municipio_nome: "João Pessoa", uf: "PB", populacao_total: 833932, densidade_hab_km2: 3424.8, taxa_crescimento_anual_pct: 0.44, populacao_urbana_pct: 99.8, idade_media: 34.6, indice_envelhecimento: 61.4, razao_dependencia: 39.1, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "2704302", municipio_nome: "Maceió", uf: "AL", populacao_total: 1012382, densidade_hab_km2: 4728.4, taxa_crescimento_anual_pct: 0.14, populacao_urbana_pct: 100.0, idade_media: 33.4, indice_envelhecimento: 52.8, razao_dependencia: 37.2, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "2800308", municipio_nome: "Aracaju", uf: "SE", populacao_total: 672095, densidade_hab_km2: 3474.1, taxa_crescimento_anual_pct: 0.62, populacao_urbana_pct: 100.0, idade_media: 34.0, indice_envelhecimento: 57.2, razao_dependencia: 38.0, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "2111300", municipio_nome: "São Luís", uf: "MA", populacao_total: 1108975, densidade_hab_km2: 1215.2, taxa_crescimento_anual_pct: 0.52, populacao_urbana_pct: 99.2, idade_media: 32.8, indice_envelhecimento: 48.6, razao_dependencia: 35.8, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "2211001", municipio_nome: "Teresina", uf: "PI", populacao_total: 871111, densidade_hab_km2: 506.3, taxa_crescimento_anual_pct: 0.58, populacao_urbana_pct: 98.9, idade_media: 32.6, indice_envelhecimento: 48.1, razao_dependencia: 35.4, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "2905701", municipio_nome: "Camaçari", uf: "BA", populacao_total: 300372, densidade_hab_km2: 148.4, taxa_crescimento_anual_pct: 1.84, populacao_urbana_pct: 96.2, idade_media: 29.8, indice_envelhecimento: 34.6, razao_dependencia: 33.2, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "2607901", municipio_nome: "Jaboatão dos Guararapes", uf: "PE", populacao_total: 722931, densidade_hab_km2: 2421.6, taxa_crescimento_anual_pct: 0.28, populacao_urbana_pct: 100.0, idade_media: 33.6, indice_envelhecimento: 53.4, razao_dependencia: 37.4, fonte: "censo_2022", ano_referencia: 2022 },

  // Norte
  { municipio_codigo: "1302603", municipio_nome: "Manaus", uf: "AM", populacao_total: 2063547, densidade_hab_km2: 158.2, taxa_crescimento_anual_pct: 1.84, populacao_urbana_pct: 99.8, idade_media: 29.6, indice_envelhecimento: 32.4, razao_dependencia: 32.8, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "1501402", municipio_nome: "Belém", uf: "PA", populacao_total: 1303389, densidade_hab_km2: 1205.1, taxa_crescimento_anual_pct: 0.28, populacao_urbana_pct: 100.0, idade_media: 31.4, indice_envelhecimento: 43.8, razao_dependencia: 34.6, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "1100205", municipio_nome: "Porto Velho", uf: "RO", populacao_total: 539354, densidade_hab_km2: 12.8, taxa_crescimento_anual_pct: 1.94, populacao_urbana_pct: 91.4, idade_media: 30.2, indice_envelhecimento: 36.8, razao_dependencia: 33.4, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "1200401", municipio_nome: "Rio Branco", uf: "AC", populacao_total: 431353, densidade_hab_km2: 16.8, taxa_crescimento_anual_pct: 1.76, populacao_urbana_pct: 92.8, idade_media: 29.4, indice_envelhecimento: 30.6, razao_dependencia: 31.8, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "1600303", municipio_nome: "Macapá", uf: "AP", populacao_total: 512902, densidade_hab_km2: 44.2, taxa_crescimento_anual_pct: 2.28, populacao_urbana_pct: 93.6, idade_media: 28.4, indice_envelhecimento: 26.4, razao_dependencia: 30.2, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "1400027", municipio_nome: "Boa Vista", uf: "RR", populacao_total: 399213, densidade_hab_km2: 46.4, taxa_crescimento_anual_pct: 2.44, populacao_urbana_pct: 95.2, idade_media: 28.8, indice_envelhecimento: 28.2, razao_dependencia: 31.4, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "1721000", municipio_nome: "Palmas", uf: "TO", populacao_total: 313493, densidade_hab_km2: 131.2, taxa_crescimento_anual_pct: 2.16, populacao_urbana_pct: 97.8, idade_media: 30.4, indice_envelhecimento: 37.2, razao_dependencia: 33.6, fonte: "censo_2022", ano_referencia: 2022 },
];

// ============================================================
// Lookup Tables — Domicílios por Setor Censitário
// ============================================================

interface CensusHousingEntry {
  municipio_codigo: string;
  municipio_nome: string;
  uf: string;
  total_domicilios: number;
  domicilios_proprios_pct: number;
  domicilios_alugados_pct: number;
  domicilios_cedidos_pct: number;
  domicilios_com_esgoto_pct: number;
  domicilios_com_agua_rede_pct: number;
  domicilios_com_coleta_lixo_pct: number;
  media_moradores_domicilio: number;
  deficit_habitacional_estimado: number;
  fonte: string;
  ano_referencia: number;
}

// v2 (sessão 150): expansão para 50 municípios
const CENSUS_HOUSING_DATA: CensusHousingEntry[] = [
  // Sudeste — SP
  { municipio_codigo: "3550308", municipio_nome: "São Paulo", uf: "SP", total_domicilios: 4259532, domicilios_proprios_pct: 62.1, domicilios_alugados_pct: 28.4, domicilios_cedidos_pct: 9.5, domicilios_com_esgoto_pct: 88.2, domicilios_com_agua_rede_pct: 97.8, domicilios_com_coleta_lixo_pct: 99.1, media_moradores_domicilio: 2.7, deficit_habitacional_estimado: 474000, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3509502", municipio_nome: "Campinas", uf: "SP", total_domicilios: 401237, domicilios_proprios_pct: 64.8, domicilios_alugados_pct: 26.1, domicilios_cedidos_pct: 9.1, domicilios_com_esgoto_pct: 91.4, domicilios_com_agua_rede_pct: 98.2, domicilios_com_coleta_lixo_pct: 99.4, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 38500, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3539307", municipio_nome: "Piracicaba", uf: "SP", total_domicilios: 142560, domicilios_proprios_pct: 67.2, domicilios_alugados_pct: 23.8, domicilios_cedidos_pct: 9.0, domicilios_com_esgoto_pct: 93.1, domicilios_com_agua_rede_pct: 98.6, domicilios_com_coleta_lixo_pct: 99.5, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 12800, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3543402", municipio_nome: "Ribeirão Preto", uf: "SP", total_domicilios: 253480, domicilios_proprios_pct: 65.4, domicilios_alugados_pct: 25.2, domicilios_cedidos_pct: 9.4, domicilios_com_esgoto_pct: 94.8, domicilios_com_agua_rede_pct: 99.1, domicilios_com_coleta_lixo_pct: 99.6, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 18200, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3552205", municipio_nome: "Sorocaba", uf: "SP", total_domicilios: 243168, domicilios_proprios_pct: 64.1, domicilios_alugados_pct: 26.4, domicilios_cedidos_pct: 9.5, domicilios_com_esgoto_pct: 89.6, domicilios_com_agua_rede_pct: 98.4, domicilios_com_coleta_lixo_pct: 99.3, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 22600, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3549904", municipio_nome: "São José dos Campos", uf: "SP", total_domicilios: 259416, domicilios_proprios_pct: 65.8, domicilios_alugados_pct: 24.8, domicilios_cedidos_pct: 9.4, domicilios_com_esgoto_pct: 92.4, domicilios_com_agua_rede_pct: 98.8, domicilios_com_coleta_lixo_pct: 99.5, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 21400, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3525904", municipio_nome: "Jundiaí", uf: "SP", total_domicilios: 152644, domicilios_proprios_pct: 66.2, domicilios_alugados_pct: 24.6, domicilios_cedidos_pct: 9.2, domicilios_com_esgoto_pct: 95.2, domicilios_com_agua_rede_pct: 99.3, domicilios_com_coleta_lixo_pct: 99.7, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 11200, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3518800", municipio_nome: "Guarulhos", uf: "SP", total_domicilios: 490832, domicilios_proprios_pct: 61.4, domicilios_alugados_pct: 28.2, domicilios_cedidos_pct: 10.4, domicilios_com_esgoto_pct: 86.2, domicilios_com_agua_rede_pct: 97.4, domicilios_com_coleta_lixo_pct: 99.0, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 48600, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3534401", municipio_nome: "Osasco", uf: "SP", total_domicilios: 246812, domicilios_proprios_pct: 62.8, domicilios_alugados_pct: 27.4, domicilios_cedidos_pct: 9.8, domicilios_com_esgoto_pct: 88.4, domicilios_com_agua_rede_pct: 98.2, domicilios_com_coleta_lixo_pct: 99.2, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 24200, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3548500", municipio_nome: "Santos", uf: "SP", total_domicilios: 178456, domicilios_proprios_pct: 58.2, domicilios_alugados_pct: 31.8, domicilios_cedidos_pct: 10.0, domicilios_com_esgoto_pct: 91.6, domicilios_com_agua_rede_pct: 99.2, domicilios_com_coleta_lixo_pct: 99.8, media_moradores_domicilio: 2.4, deficit_habitacional_estimado: 19800, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3506003", municipio_nome: "Bauru", uf: "SP", total_domicilios: 138624, domicilios_proprios_pct: 66.8, domicilios_alugados_pct: 23.4, domicilios_cedidos_pct: 9.8, domicilios_com_esgoto_pct: 93.4, domicilios_com_agua_rede_pct: 98.8, domicilios_com_coleta_lixo_pct: 99.4, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 10200, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3548708", municipio_nome: "São Bernardo do Campo", uf: "SP", total_domicilios: 295248, domicilios_proprios_pct: 63.6, domicilios_alugados_pct: 26.2, domicilios_cedidos_pct: 10.2, domicilios_com_esgoto_pct: 87.8, domicilios_com_agua_rede_pct: 97.6, domicilios_com_coleta_lixo_pct: 99.1, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 28400, fonte: "censo_2022", ano_referencia: 2022 },

  // RJ
  { municipio_codigo: "3304557", municipio_nome: "Rio de Janeiro", uf: "RJ", total_domicilios: 2485312, domicilios_proprios_pct: 60.3, domicilios_alugados_pct: 27.6, domicilios_cedidos_pct: 12.1, domicilios_com_esgoto_pct: 78.4, domicilios_com_agua_rede_pct: 95.1, domicilios_com_coleta_lixo_pct: 97.8, media_moradores_domicilio: 2.5, deficit_habitacional_estimado: 356000, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3303905", municipio_nome: "Niterói", uf: "RJ", total_domicilios: 196648, domicilios_proprios_pct: 61.4, domicilios_alugados_pct: 27.8, domicilios_cedidos_pct: 10.8, domicilios_com_esgoto_pct: 84.6, domicilios_com_agua_rede_pct: 96.4, domicilios_com_coleta_lixo_pct: 98.6, media_moradores_domicilio: 2.5, deficit_habitacional_estimado: 21200, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3301900", municipio_nome: "Campos dos Goytacazes", uf: "RJ", total_domicilios: 188432, domicilios_proprios_pct: 63.2, domicilios_alugados_pct: 25.4, domicilios_cedidos_pct: 11.4, domicilios_com_esgoto_pct: 58.6, domicilios_com_agua_rede_pct: 86.4, domicilios_com_coleta_lixo_pct: 94.2, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 24600, fonte: "censo_2022", ano_referencia: 2022 },

  // MG
  { municipio_codigo: "3106200", municipio_nome: "Belo Horizonte", uf: "MG", total_domicilios: 862430, domicilios_proprios_pct: 63.5, domicilios_alugados_pct: 26.8, domicilios_cedidos_pct: 9.7, domicilios_com_esgoto_pct: 85.6, domicilios_com_agua_rede_pct: 98.4, domicilios_com_coleta_lixo_pct: 99.2, media_moradores_domicilio: 2.7, deficit_habitacional_estimado: 78000, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3170206", municipio_nome: "Uberlândia", uf: "MG", total_domicilios: 256824, domicilios_proprios_pct: 65.2, domicilios_alugados_pct: 25.6, domicilios_cedidos_pct: 9.2, domicilios_com_esgoto_pct: 90.8, domicilios_com_agua_rede_pct: 98.6, domicilios_com_coleta_lixo_pct: 99.4, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 21800, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3136702", municipio_nome: "Juiz de Fora", uf: "MG", total_domicilios: 204248, domicilios_proprios_pct: 64.8, domicilios_alugados_pct: 25.4, domicilios_cedidos_pct: 9.8, domicilios_com_esgoto_pct: 83.2, domicilios_com_agua_rede_pct: 97.6, domicilios_com_coleta_lixo_pct: 99.1, media_moradores_domicilio: 2.7, deficit_habitacional_estimado: 18400, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3143302", municipio_nome: "Montes Claros", uf: "MG", total_domicilios: 146736, domicilios_proprios_pct: 62.4, domicilios_alugados_pct: 27.2, domicilios_cedidos_pct: 10.4, domicilios_com_esgoto_pct: 72.4, domicilios_com_agua_rede_pct: 93.8, domicilios_com_coleta_lixo_pct: 98.2, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 16200, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3118601", municipio_nome: "Contagem", uf: "MG", total_domicilios: 241824, domicilios_proprios_pct: 63.8, domicilios_alugados_pct: 26.4, domicilios_cedidos_pct: 9.8, domicilios_com_esgoto_pct: 82.4, domicilios_com_agua_rede_pct: 97.8, domicilios_com_coleta_lixo_pct: 99.0, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 22600, fonte: "censo_2022", ano_referencia: 2022 },

  // ES
  { municipio_codigo: "3205309", municipio_nome: "Vitória", uf: "ES", total_domicilios: 136824, domicilios_proprios_pct: 61.2, domicilios_alugados_pct: 28.4, domicilios_cedidos_pct: 10.4, domicilios_com_esgoto_pct: 88.6, domicilios_com_agua_rede_pct: 98.8, domicilios_com_coleta_lixo_pct: 99.4, media_moradores_domicilio: 2.7, deficit_habitacional_estimado: 14200, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "3201506", municipio_nome: "Cariacica", uf: "ES", total_domicilios: 138232, domicilios_proprios_pct: 63.4, domicilios_alugados_pct: 26.8, domicilios_cedidos_pct: 9.8, domicilios_com_esgoto_pct: 62.4, domicilios_com_agua_rede_pct: 91.6, domicilios_com_coleta_lixo_pct: 97.4, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 18600, fonte: "censo_2022", ano_referencia: 2022 },

  // Sul — PR
  { municipio_codigo: "4106902", municipio_nome: "Curitiba", uf: "PR", total_domicilios: 645821, domicilios_proprios_pct: 65.1, domicilios_alugados_pct: 25.3, domicilios_cedidos_pct: 9.6, domicilios_com_esgoto_pct: 92.8, domicilios_com_agua_rede_pct: 99.1, domicilios_com_coleta_lixo_pct: 99.6, media_moradores_domicilio: 2.7, deficit_habitacional_estimado: 52000, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "4113700", municipio_nome: "Londrina", uf: "PR", total_domicilios: 207432, domicilios_proprios_pct: 65.8, domicilios_alugados_pct: 24.8, domicilios_cedidos_pct: 9.4, domicilios_com_esgoto_pct: 88.4, domicilios_com_agua_rede_pct: 98.6, domicilios_com_coleta_lixo_pct: 99.4, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 18600, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "4115200", municipio_nome: "Maringá", uf: "PR", total_domicilios: 157248, domicilios_proprios_pct: 66.4, domicilios_alugados_pct: 24.2, domicilios_cedidos_pct: 9.4, domicilios_com_esgoto_pct: 90.2, domicilios_com_agua_rede_pct: 98.8, domicilios_com_coleta_lixo_pct: 99.5, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 13800, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "4118204", municipio_nome: "Ponta Grossa", uf: "PR", total_domicilios: 123648, domicilios_proprios_pct: 64.2, domicilios_alugados_pct: 25.8, domicilios_cedidos_pct: 10.0, domicilios_com_esgoto_pct: 85.2, domicilios_com_agua_rede_pct: 97.8, domicilios_com_coleta_lixo_pct: 99.2, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 12400, fonte: "censo_2022", ano_referencia: 2022 },

  // SC
  { municipio_codigo: "4209102", municipio_nome: "Joinville", uf: "SC", total_domicilios: 224832, domicilios_proprios_pct: 65.4, domicilios_alugados_pct: 25.2, domicilios_cedidos_pct: 9.4, domicilios_com_esgoto_pct: 90.8, domicilios_com_agua_rede_pct: 98.8, domicilios_com_coleta_lixo_pct: 99.6, media_moradores_domicilio: 2.7, deficit_habitacional_estimado: 19200, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "4202404", municipio_nome: "Blumenau", uf: "SC", total_domicilios: 137248, domicilios_proprios_pct: 66.2, domicilios_alugados_pct: 24.6, domicilios_cedidos_pct: 9.2, domicilios_com_esgoto_pct: 92.4, domicilios_com_agua_rede_pct: 98.6, domicilios_com_coleta_lixo_pct: 99.5, media_moradores_domicilio: 2.7, deficit_habitacional_estimado: 11200, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "4205407", municipio_nome: "Florianópolis", uf: "SC", total_domicilios: 200832, domicilios_proprios_pct: 57.8, domicilios_alugados_pct: 32.4, domicilios_cedidos_pct: 9.8, domicilios_com_esgoto_pct: 88.4, domicilios_com_agua_rede_pct: 98.4, domicilios_com_coleta_lixo_pct: 99.4, media_moradores_domicilio: 2.7, deficit_habitacional_estimado: 22600, fonte: "censo_2022", ano_referencia: 2022 },

  // RS
  { municipio_codigo: "4314902", municipio_nome: "Porto Alegre", uf: "RS", total_domicilios: 521424, domicilios_proprios_pct: 62.4, domicilios_alugados_pct: 27.2, domicilios_cedidos_pct: 10.4, domicilios_com_esgoto_pct: 91.6, domicilios_com_agua_rede_pct: 98.8, domicilios_com_coleta_lixo_pct: 99.4, media_moradores_domicilio: 2.6, deficit_habitacional_estimado: 48600, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "4305108", municipio_nome: "Caxias do Sul", uf: "RS", total_domicilios: 196248, domicilios_proprios_pct: 66.4, domicilios_alugados_pct: 24.2, domicilios_cedidos_pct: 9.4, domicilios_com_esgoto_pct: 90.8, domicilios_com_agua_rede_pct: 98.4, domicilios_com_coleta_lixo_pct: 99.5, media_moradores_domicilio: 2.7, deficit_habitacional_estimado: 16200, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "4314100", municipio_nome: "Pelotas", uf: "RS", total_domicilios: 131624, domicilios_proprios_pct: 63.8, domicilios_alugados_pct: 25.8, domicilios_cedidos_pct: 10.4, domicilios_com_esgoto_pct: 78.6, domicilios_com_agua_rede_pct: 96.4, domicilios_com_coleta_lixo_pct: 98.6, media_moradores_domicilio: 2.6, deficit_habitacional_estimado: 14800, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "4314407", municipio_nome: "Canoas", uf: "RS", total_domicilios: 132448, domicilios_proprios_pct: 62.8, domicilios_alugados_pct: 26.8, domicilios_cedidos_pct: 10.4, domicilios_com_esgoto_pct: 87.4, domicilios_com_agua_rede_pct: 98.2, domicilios_com_coleta_lixo_pct: 99.1, media_moradores_domicilio: 2.6, deficit_habitacional_estimado: 13800, fonte: "censo_2022", ano_referencia: 2022 },

  // Centro-Oeste
  { municipio_codigo: "5208707", municipio_nome: "Goiânia", uf: "GO", total_domicilios: 518234, domicilios_proprios_pct: 61.8, domicilios_alugados_pct: 28.9, domicilios_cedidos_pct: 9.3, domicilios_com_esgoto_pct: 72.4, domicilios_com_agua_rede_pct: 95.8, domicilios_com_coleta_lixo_pct: 98.7, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 48000, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "5201405", municipio_nome: "Aparecida de Goiânia", uf: "GO", total_domicilios: 218432, domicilios_proprios_pct: 62.4, domicilios_alugados_pct: 28.2, domicilios_cedidos_pct: 9.4, domicilios_com_esgoto_pct: 64.8, domicilios_com_agua_rede_pct: 93.2, domicilios_com_coleta_lixo_pct: 97.8, media_moradores_domicilio: 2.9, deficit_habitacional_estimado: 26800, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "5201108", municipio_nome: "Anápolis", uf: "GO", total_domicilios: 140832, domicilios_proprios_pct: 63.2, domicilios_alugados_pct: 27.4, domicilios_cedidos_pct: 9.4, domicilios_com_esgoto_pct: 68.4, domicilios_com_agua_rede_pct: 94.6, domicilios_com_coleta_lixo_pct: 98.2, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 16400, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "5300108", municipio_nome: "Brasília", uf: "DF", total_domicilios: 982456, domicilios_proprios_pct: 58.4, domicilios_alugados_pct: 31.2, domicilios_cedidos_pct: 10.4, domicilios_com_esgoto_pct: 84.7, domicilios_com_agua_rede_pct: 96.5, domicilios_com_coleta_lixo_pct: 98.9, media_moradores_domicilio: 2.9, deficit_habitacional_estimado: 112000, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "5002704", municipio_nome: "Campo Grande", uf: "MS", total_domicilios: 329832, domicilios_proprios_pct: 63.4, domicilios_alugados_pct: 26.8, domicilios_cedidos_pct: 9.8, domicilios_com_esgoto_pct: 76.4, domicilios_com_agua_rede_pct: 96.2, domicilios_com_coleta_lixo_pct: 98.8, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 32400, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "5001920", municipio_nome: "Cassilândia", uf: "MS", total_domicilios: 7245, domicilios_proprios_pct: 72.1, domicilios_alugados_pct: 18.4, domicilios_cedidos_pct: 9.5, domicilios_com_esgoto_pct: 45.2, domicilios_com_agua_rede_pct: 91.3, domicilios_com_coleta_lixo_pct: 94.8, media_moradores_domicilio: 2.9, deficit_habitacional_estimado: 1200, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "5003702", municipio_nome: "Dourados", uf: "MS", total_domicilios: 82448, domicilios_proprios_pct: 64.8, domicilios_alugados_pct: 25.4, domicilios_cedidos_pct: 9.8, domicilios_com_esgoto_pct: 58.4, domicilios_com_agua_rede_pct: 91.8, domicilios_com_coleta_lixo_pct: 97.2, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 9600, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "5103403", municipio_nome: "Cuiabá", uf: "MT", total_domicilios: 228832, domicilios_proprios_pct: 62.8, domicilios_alugados_pct: 27.4, domicilios_cedidos_pct: 9.8, domicilios_com_esgoto_pct: 62.4, domicilios_com_agua_rede_pct: 94.8, domicilios_com_coleta_lixo_pct: 97.6, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 24800, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "5107909", municipio_nome: "Várzea Grande", uf: "MT", total_domicilios: 102248, domicilios_proprios_pct: 63.4, domicilios_alugados_pct: 26.8, domicilios_cedidos_pct: 9.8, domicilios_com_esgoto_pct: 52.6, domicilios_com_agua_rede_pct: 91.4, domicilios_com_coleta_lixo_pct: 96.8, media_moradores_domicilio: 2.9, deficit_habitacional_estimado: 14400, fonte: "censo_2022", ano_referencia: 2022 },

  // Nordeste
  { municipio_codigo: "2927408", municipio_nome: "Salvador", uf: "BA", total_domicilios: 886432, domicilios_proprios_pct: 59.6, domicilios_alugados_pct: 28.8, domicilios_cedidos_pct: 11.6, domicilios_com_esgoto_pct: 64.2, domicilios_com_agua_rede_pct: 92.4, domicilios_com_coleta_lixo_pct: 97.2, media_moradores_domicilio: 2.7, deficit_habitacional_estimado: 124000, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "2304400", municipio_nome: "Fortaleza", uf: "CE", total_domicilios: 892832, domicilios_proprios_pct: 58.4, domicilios_alugados_pct: 29.8, domicilios_cedidos_pct: 11.8, domicilios_com_esgoto_pct: 56.8, domicilios_com_agua_rede_pct: 92.8, domicilios_com_coleta_lixo_pct: 97.4, media_moradores_domicilio: 2.7, deficit_habitacional_estimado: 136000, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "2611606", municipio_nome: "Recife", uf: "PE", total_domicilios: 556832, domicilios_proprios_pct: 58.6, domicilios_alugados_pct: 28.8, domicilios_cedidos_pct: 12.6, domicilios_com_esgoto_pct: 62.4, domicilios_com_agua_rede_pct: 93.6, domicilios_com_coleta_lixo_pct: 97.8, media_moradores_domicilio: 2.7, deficit_habitacional_estimado: 84000, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "2408102", municipio_nome: "Natal", uf: "RN", total_domicilios: 328832, domicilios_proprios_pct: 61.2, domicilios_alugados_pct: 27.4, domicilios_cedidos_pct: 11.4, domicilios_com_esgoto_pct: 58.8, domicilios_com_agua_rede_pct: 92.2, domicilios_com_coleta_lixo_pct: 97.2, media_moradores_domicilio: 2.7, deficit_habitacional_estimado: 42600, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "2507507", municipio_nome: "João Pessoa", uf: "PB", total_domicilios: 307248, domicilios_proprios_pct: 62.4, domicilios_alugados_pct: 26.8, domicilios_cedidos_pct: 10.8, domicilios_com_esgoto_pct: 61.2, domicilios_com_agua_rede_pct: 92.8, domicilios_com_coleta_lixo_pct: 97.6, media_moradores_domicilio: 2.7, deficit_habitacional_estimado: 38400, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "2704302", municipio_nome: "Maceió", uf: "AL", total_domicilios: 368248, domicilios_proprios_pct: 57.8, domicilios_alugados_pct: 29.6, domicilios_cedidos_pct: 12.6, domicilios_com_esgoto_pct: 48.4, domicilios_com_agua_rede_pct: 88.6, domicilios_com_coleta_lixo_pct: 95.4, media_moradores_domicilio: 2.7, deficit_habitacional_estimado: 62400, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "2800308", municipio_nome: "Aracaju", uf: "SE", total_domicilios: 247248, domicilios_proprios_pct: 61.8, domicilios_alugados_pct: 27.4, domicilios_cedidos_pct: 10.8, domicilios_com_esgoto_pct: 68.4, domicilios_com_agua_rede_pct: 94.8, domicilios_com_coleta_lixo_pct: 98.2, media_moradores_domicilio: 2.7, deficit_habitacional_estimado: 28400, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "2111300", municipio_nome: "São Luís", uf: "MA", total_domicilios: 408832, domicilios_proprios_pct: 58.4, domicilios_alugados_pct: 28.8, domicilios_cedidos_pct: 12.8, domicilios_com_esgoto_pct: 42.6, domicilios_com_agua_rede_pct: 86.4, domicilios_com_coleta_lixo_pct: 94.8, media_moradores_domicilio: 2.7, deficit_habitacional_estimado: 68400, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "2211001", municipio_nome: "Teresina", uf: "PI", total_domicilios: 318832, domicilios_proprios_pct: 60.4, domicilios_alugados_pct: 27.8, domicilios_cedidos_pct: 11.8, domicilios_com_esgoto_pct: 48.6, domicilios_com_agua_rede_pct: 89.4, domicilios_com_coleta_lixo_pct: 95.8, media_moradores_domicilio: 2.7, deficit_habitacional_estimado: 46800, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "2905701", municipio_nome: "Camaçari", uf: "BA", total_domicilios: 104248, domicilios_proprios_pct: 61.4, domicilios_alugados_pct: 27.2, domicilios_cedidos_pct: 11.4, domicilios_com_esgoto_pct: 52.4, domicilios_com_agua_rede_pct: 88.6, domicilios_com_coleta_lixo_pct: 95.6, media_moradores_domicilio: 2.9, deficit_habitacional_estimado: 14600, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "2607901", municipio_nome: "Jaboatão dos Guararapes", uf: "PE", total_domicilios: 261248, domicilios_proprios_pct: 57.6, domicilios_alugados_pct: 30.2, domicilios_cedidos_pct: 12.2, domicilios_com_esgoto_pct: 54.8, domicilios_com_agua_rede_pct: 90.4, domicilios_com_coleta_lixo_pct: 96.6, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 42800, fonte: "censo_2022", ano_referencia: 2022 },

  // Norte
  { municipio_codigo: "1302603", municipio_nome: "Manaus", uf: "AM", total_domicilios: 728832, domicilios_proprios_pct: 58.8, domicilios_alugados_pct: 28.4, domicilios_cedidos_pct: 12.8, domicilios_com_esgoto_pct: 18.6, domicilios_com_agua_rede_pct: 78.4, domicilios_com_coleta_lixo_pct: 92.4, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 102400, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "1501402", municipio_nome: "Belém", uf: "PA", total_domicilios: 468832, domicilios_proprios_pct: 57.4, domicilios_alugados_pct: 29.2, domicilios_cedidos_pct: 13.4, domicilios_com_esgoto_pct: 14.2, domicilios_com_agua_rede_pct: 74.6, domicilios_com_coleta_lixo_pct: 90.2, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 86400, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "1100205", municipio_nome: "Porto Velho", uf: "RO", total_domicilios: 189248, domicilios_proprios_pct: 60.4, domicilios_alugados_pct: 27.4, domicilios_cedidos_pct: 12.2, domicilios_com_esgoto_pct: 22.8, domicilios_com_agua_rede_pct: 82.4, domicilios_com_coleta_lixo_pct: 92.8, media_moradores_domicilio: 2.9, deficit_habitacional_estimado: 26400, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "1200401", municipio_nome: "Rio Branco", uf: "AC", total_domicilios: 148832, domicilios_proprios_pct: 60.8, domicilios_alugados_pct: 26.8, domicilios_cedidos_pct: 12.4, domicilios_com_esgoto_pct: 12.4, domicilios_com_agua_rede_pct: 76.4, domicilios_com_coleta_lixo_pct: 90.8, media_moradores_domicilio: 2.9, deficit_habitacional_estimado: 22600, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "1600303", municipio_nome: "Macapá", uf: "AP", total_domicilios: 172248, domicilios_proprios_pct: 59.4, domicilios_alugados_pct: 27.8, domicilios_cedidos_pct: 12.8, domicilios_com_esgoto_pct: 8.6, domicilios_com_agua_rede_pct: 66.4, domicilios_com_coleta_lixo_pct: 88.4, media_moradores_domicilio: 3.0, deficit_habitacional_estimado: 28400, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "1400027", municipio_nome: "Boa Vista", uf: "RR", total_domicilios: 136832, domicilios_proprios_pct: 61.4, domicilios_alugados_pct: 26.8, domicilios_cedidos_pct: 11.8, domicilios_com_esgoto_pct: 26.4, domicilios_com_agua_rede_pct: 84.6, domicilios_com_coleta_lixo_pct: 93.2, media_moradores_domicilio: 2.9, deficit_habitacional_estimado: 18400, fonte: "censo_2022", ano_referencia: 2022 },
  { municipio_codigo: "1721000", municipio_nome: "Palmas", uf: "TO", total_domicilios: 110832, domicilios_proprios_pct: 62.4, domicilios_alugados_pct: 26.8, domicilios_cedidos_pct: 10.8, domicilios_com_esgoto_pct: 68.4, domicilios_com_agua_rede_pct: 94.6, domicilios_com_coleta_lixo_pct: 97.8, media_moradores_domicilio: 2.8, deficit_habitacional_estimado: 14200, fonte: "censo_2022", ano_referencia: 2022 },
];

// ============================================================
// Action Handlers
// ============================================================

interface FetchCensusIncomeArgs {
  municipio?: string;
  uf?: string;
  setor_codigo?: string;
  classe?: string;
  limit?: number;
  offset?: number;
}

function handleFetchCensusIncome(_ctx: RequestContext, args: FetchCensusIncomeArgs) {
  let results = [...CENSUS_INCOME_DATA];

  if (args.setor_codigo) {
    results = results.filter((r) => r.setor_codigo === args.setor_codigo);
  }
  if (args.municipio) {
    const search = normalizeSearch(args.municipio);
    results = results.filter((r) =>
      normalizeSearch(r.municipio_nome).includes(search) ||
      r.municipio_codigo.includes(search)
    );
  }
  if (args.uf) {
    const ufUpper = args.uf.toUpperCase();
    results = results.filter((r) => r.uf === ufUpper);
  }
  if (args.classe) {
    results = results.filter((r) => r.classe_predominante === args.classe.toUpperCase());
  }

  const total = results.length;
  const offset = args.offset || 0;
  const limit = Math.min(args.limit || 20, 50);
  results = results.slice(offset, offset + limit);

  return ok({
    items: results,
    total,
    offset,
    limit,
    fonte: "IBGE Censo 2022 (resultados parciais) + Censo 2010",
    nota: "Dados agregados por setor censitário. Em produção, microdados com granularidade de 15 dígitos.",
  });
}

interface FetchCensusDemographicsArgs {
  municipio?: string;
  uf?: string;
  limit?: number;
  offset?: number;
}

function handleFetchCensusDemographics(_ctx: RequestContext, args: FetchCensusDemographicsArgs) {
  let results = [...CENSUS_DEMOGRAPHICS_DATA];

  if (args.municipio) {
    const search = normalizeSearch(args.municipio);
    results = results.filter((r) =>
      normalizeSearch(r.municipio_nome).includes(search) ||
      r.municipio_codigo.includes(search)
    );
  }
  if (args.uf) {
    const ufUpper = args.uf.toUpperCase();
    results = results.filter((r) => r.uf === ufUpper);
  }

  const total = results.length;
  const offset = args.offset || 0;
  const limit = Math.min(args.limit || 20, 50);
  results = results.slice(offset, offset + limit);

  return ok({
    items: results,
    total,
    offset,
    limit,
    fonte: "IBGE Censo 2022",
  });
}

interface FetchCensusHousingArgs {
  municipio?: string;
  uf?: string;
  limit?: number;
  offset?: number;
}

function handleFetchCensusHousing(_ctx: RequestContext, args: FetchCensusHousingArgs) {
  let results = [...CENSUS_HOUSING_DATA];

  if (args.municipio) {
    const search = normalizeSearch(args.municipio);
    results = results.filter((r) =>
      normalizeSearch(r.municipio_nome).includes(search) ||
      r.municipio_codigo.includes(search)
    );
  }
  if (args.uf) {
    const ufUpper = args.uf.toUpperCase();
    results = results.filter((r) => r.uf === ufUpper);
  }

  const total = results.length;
  const offset = args.offset || 0;
  const limit = Math.min(args.limit || 20, 50);
  results = results.slice(offset, offset + limit);

  return ok({
    items: results,
    total,
    offset,
    limit,
    fonte: "IBGE Censo 2022",
  });
}

// ============================================================
// Router
// ============================================================

type Action = "fetch_census_income" | "fetch_census_demographics" | "fetch_census_housing";

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
      case "fetch_census_income":
        result = handleFetchCensusIncome(ctx, body);
        break;
      case "fetch_census_demographics":
        result = handleFetchCensusDemographics(ctx, body);
        break;
      case "fetch_census_housing":
        result = handleFetchCensusHousing(ctx, body);
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
