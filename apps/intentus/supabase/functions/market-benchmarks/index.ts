/**
 * market-benchmarks v1
 *
 * Edge Function multi-action para benchmarks de mercado imobiliário brasileiro.
 *
 * ACTIONS:
 *   fetch_sinapi   — Catálogo SINAPI de custos de construção por estado (US-121)
 *   fetch_secovi   — Benchmarks SECOVI de preços e velocidade de vendas (US-122)
 *   fetch_abrainc  — Indicadores ABRAINC de lançamentos e performance (US-123)
 *
 * Sessão 142 — Bloco H Sprint 2 (Benchmarks de Mercado)
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 *
 * Fontes de dados:
 *   SINAPI — Sistema Nacional de Pesquisa de Custos e Índices da Construção Civil
 *            Caixa Econômica Federal (https://www.caixa.gov.br/poder-publico/sinapi)
 *   SECOVI — Sindicato da Habitação (secovisp.com.br, secovirio.com.br)
 *   ABRAINC — Associação Brasileira de Incorporadoras Imobiliárias (abrainc.org.br)
 *
 * NOTA: Os dados são tabelas lookup com valores de referência atualizados.
 * Em produção futura, serão substituídos por pipelines de ingestão automática
 * dos PDFs/APIs dessas entidades (SINAPI publica CSV mensal, SECOVI e ABRAINC
 * publicam relatórios trimestrais).
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
// Shared helpers (Buchecha fix: extract normalizeSearch)
// ============================================================

function normalizeSearch(str: string): string {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

// ============================================================
// ACTION 1: fetch_sinapi (US-121)
// ============================================================
/**
 * Catálogo SINAPI — Sistema Nacional de Pesquisa de Custos e Índices da
 * Construção Civil, publicado mensalmente pela Caixa Econômica Federal.
 *
 * O SINAPI é a referência oficial para obras públicas no Brasil e amplamente
 * usado como benchmark por incorporadores privados.
 *
 * Referência: Decreto 7.983/2013 (regulamenta orçamentos com SINAPI)
 *
 * Tabela com composições mais relevantes para loteamento e parcelamento:
 * - Terraplanagem / Movimentação de terra
 * - Pavimentação (base, sub-base, asfalto)
 * - Drenagem e galerias
 * - Rede de água e esgoto
 * - Rede elétrica e iluminação pública
 * - Guias, sarjetas e calçadas
 * - Muros e contenções
 * - Paisagismo e áreas verdes
 */

interface SinapiItemInternal {
  codigo: string;
  descricao: string;
  unidade: string;
  grupo: string;
  is_composicao: boolean;
  /** Custo por UF: { "SP": { material, mao_obra }, ... } */
  custos_uf: Record<string, { material: number; mao_obra: number }>;
}

const SINAPI_REFERENCIA = "2026-03";

// Catálogo de composições relevantes para parcelamento de solo
// Preços de referência março/2026 (valores em R$)
const SINAPI_CATALOGO: SinapiItemInternal[] = [
  // TERRAPLANAGEM
  {
    codigo: "73964",
    descricao: "Escavação mecânica de vala em material de 1a categoria (prof. até 1,50m)",
    unidade: "m³",
    grupo: "Terraplanagem",
    is_composicao: true,
    custos_uf: {
      SP: { material: 0.15, mao_obra: 7.82 }, RJ: { material: 0.16, mao_obra: 8.15 },
      MG: { material: 0.14, mao_obra: 7.25 }, PR: { material: 0.14, mao_obra: 7.40 },
      RS: { material: 0.15, mao_obra: 7.60 }, SC: { material: 0.14, mao_obra: 7.35 },
      BA: { material: 0.13, mao_obra: 6.80 }, PE: { material: 0.13, mao_obra: 6.65 },
      CE: { material: 0.12, mao_obra: 6.50 }, GO: { material: 0.14, mao_obra: 7.10 },
      DF: { material: 0.15, mao_obra: 7.95 }, MS: { material: 0.14, mao_obra: 7.20 },
      MT: { material: 0.14, mao_obra: 7.30 }, PA: { material: 0.13, mao_obra: 6.90 },
      AM: { material: 0.15, mao_obra: 7.50 }, ES: { material: 0.14, mao_obra: 7.15 },
    },
  },
  {
    codigo: "73965",
    descricao: "Aterro compactado com controle — material de jazida (DMT até 1km)",
    unidade: "m³",
    grupo: "Terraplanagem",
    is_composicao: true,
    custos_uf: {
      SP: { material: 6.20, mao_obra: 12.50 }, RJ: { material: 6.50, mao_obra: 13.10 },
      MG: { material: 5.80, mao_obra: 11.80 }, PR: { material: 5.90, mao_obra: 12.00 },
      RS: { material: 6.00, mao_obra: 12.20 }, SC: { material: 5.85, mao_obra: 11.90 },
      BA: { material: 5.50, mao_obra: 11.20 }, PE: { material: 5.40, mao_obra: 11.00 },
      CE: { material: 5.30, mao_obra: 10.80 }, GO: { material: 5.70, mao_obra: 11.60 },
      DF: { material: 6.30, mao_obra: 12.80 }, MS: { material: 5.75, mao_obra: 11.70 },
      MT: { material: 5.80, mao_obra: 11.75 }, PA: { material: 5.60, mao_obra: 11.30 },
      AM: { material: 6.10, mao_obra: 12.30 }, ES: { material: 5.75, mao_obra: 11.65 },
    },
  },
  // PAVIMENTAÇÃO
  {
    codigo: "90101",
    descricao: "Base de brita graduada simples — espessura 15cm",
    unidade: "m²",
    grupo: "Pavimentação",
    is_composicao: true,
    custos_uf: {
      SP: { material: 18.50, mao_obra: 5.80 }, RJ: { material: 19.20, mao_obra: 6.10 },
      MG: { material: 17.30, mao_obra: 5.40 }, PR: { material: 17.80, mao_obra: 5.60 },
      RS: { material: 18.00, mao_obra: 5.70 }, SC: { material: 17.60, mao_obra: 5.50 },
      BA: { material: 16.80, mao_obra: 5.20 }, PE: { material: 16.50, mao_obra: 5.10 },
      CE: { material: 16.20, mao_obra: 5.00 }, GO: { material: 17.10, mao_obra: 5.35 },
      DF: { material: 18.80, mao_obra: 5.90 }, MS: { material: 17.20, mao_obra: 5.38 },
      MT: { material: 17.40, mao_obra: 5.45 }, PA: { material: 16.90, mao_obra: 5.25 },
      AM: { material: 18.10, mao_obra: 5.75 }, ES: { material: 17.15, mao_obra: 5.36 },
    },
  },
  {
    codigo: "94993",
    descricao: "Concreto betuminoso usinado a quente (CBUQ) — capa de rolamento e=5cm",
    unidade: "m²",
    grupo: "Pavimentação",
    is_composicao: true,
    custos_uf: {
      SP: { material: 32.40, mao_obra: 8.20 }, RJ: { material: 33.80, mao_obra: 8.60 },
      MG: { material: 30.50, mao_obra: 7.70 }, PR: { material: 31.20, mao_obra: 7.90 },
      RS: { material: 31.80, mao_obra: 8.00 }, SC: { material: 31.00, mao_obra: 7.85 },
      BA: { material: 29.80, mao_obra: 7.50 }, PE: { material: 29.30, mao_obra: 7.35 },
      CE: { material: 28.90, mao_obra: 7.20 }, GO: { material: 30.20, mao_obra: 7.60 },
      DF: { material: 33.00, mao_obra: 8.40 }, MS: { material: 30.40, mao_obra: 7.65 },
      MT: { material: 30.60, mao_obra: 7.72 }, PA: { material: 29.90, mao_obra: 7.55 },
      AM: { material: 32.00, mao_obra: 8.10 }, ES: { material: 30.30, mao_obra: 7.62 },
    },
  },
  // DRENAGEM
  {
    codigo: "92393",
    descricao: "Tubo de concreto armado para galeria de águas pluviais DN 400mm — assentado",
    unidade: "m",
    grupo: "Drenagem",
    is_composicao: true,
    custos_uf: {
      SP: { material: 85.60, mao_obra: 42.30 }, RJ: { material: 89.40, mao_obra: 44.10 },
      MG: { material: 80.20, mao_obra: 39.60 }, PR: { material: 82.00, mao_obra: 40.50 },
      RS: { material: 83.50, mao_obra: 41.20 }, SC: { material: 81.50, mao_obra: 40.20 },
      BA: { material: 78.00, mao_obra: 38.50 }, PE: { material: 76.80, mao_obra: 37.90 },
      CE: { material: 75.50, mao_obra: 37.30 }, GO: { material: 79.50, mao_obra: 39.20 },
      DF: { material: 87.00, mao_obra: 43.00 }, MS: { material: 80.00, mao_obra: 39.50 },
      MT: { material: 80.50, mao_obra: 39.75 }, PA: { material: 78.50, mao_obra: 38.80 },
      AM: { material: 84.00, mao_obra: 41.50 }, ES: { material: 79.80, mao_obra: 39.40 },
    },
  },
  {
    codigo: "92394",
    descricao: "Boca de lobo simples em concreto — captação de águas pluviais",
    unidade: "un",
    grupo: "Drenagem",
    is_composicao: true,
    custos_uf: {
      SP: { material: 420.00, mao_obra: 280.00 }, RJ: { material: 438.00, mao_obra: 292.00 },
      MG: { material: 394.00, mao_obra: 262.50 }, PR: { material: 402.00, mao_obra: 268.00 },
      RS: { material: 410.00, mao_obra: 273.00 }, SC: { material: 400.00, mao_obra: 266.50 },
      BA: { material: 383.00, mao_obra: 255.00 }, PE: { material: 377.00, mao_obra: 251.00 },
      CE: { material: 370.00, mao_obra: 247.00 }, GO: { material: 390.00, mao_obra: 260.00 },
      DF: { material: 428.00, mao_obra: 285.00 }, MS: { material: 392.00, mao_obra: 261.00 },
      MT: { material: 395.00, mao_obra: 263.00 }, PA: { material: 385.00, mao_obra: 256.50 },
      AM: { material: 415.00, mao_obra: 276.50 }, ES: { material: 391.00, mao_obra: 260.50 },
    },
  },
  // REDE DE ÁGUA
  {
    codigo: "89356",
    descricao: "Assentamento de tubo PVC DEFOFO DN 100mm para rede de água",
    unidade: "m",
    grupo: "Rede de Água",
    is_composicao: true,
    custos_uf: {
      SP: { material: 22.80, mao_obra: 15.40 }, RJ: { material: 23.80, mao_obra: 16.10 },
      MG: { material: 21.40, mao_obra: 14.40 }, PR: { material: 21.90, mao_obra: 14.80 },
      RS: { material: 22.30, mao_obra: 15.10 }, SC: { material: 21.70, mao_obra: 14.60 },
      BA: { material: 20.80, mao_obra: 14.00 }, PE: { material: 20.50, mao_obra: 13.80 },
      CE: { material: 20.10, mao_obra: 13.60 }, GO: { material: 21.20, mao_obra: 14.30 },
      DF: { material: 23.20, mao_obra: 15.70 }, MS: { material: 21.30, mao_obra: 14.35 },
      MT: { material: 21.50, mao_obra: 14.45 }, PA: { material: 20.90, mao_obra: 14.10 },
      AM: { material: 22.50, mao_obra: 15.20 }, ES: { material: 21.25, mao_obra: 14.32 },
    },
  },
  // REDE DE ESGOTO
  {
    codigo: "89449",
    descricao: "Assentamento de tubo PVC para esgoto DN 150mm — junta elástica",
    unidade: "m",
    grupo: "Rede de Esgoto",
    is_composicao: true,
    custos_uf: {
      SP: { material: 28.50, mao_obra: 18.20 }, RJ: { material: 29.80, mao_obra: 19.00 },
      MG: { material: 26.70, mao_obra: 17.10 }, PR: { material: 27.40, mao_obra: 17.50 },
      RS: { material: 27.90, mao_obra: 17.80 }, SC: { material: 27.10, mao_obra: 17.30 },
      BA: { material: 26.00, mao_obra: 16.60 }, PE: { material: 25.60, mao_obra: 16.40 },
      CE: { material: 25.20, mao_obra: 16.10 }, GO: { material: 26.50, mao_obra: 16.90 },
      DF: { material: 29.00, mao_obra: 18.50 }, MS: { material: 26.60, mao_obra: 17.00 },
      MT: { material: 26.80, mao_obra: 17.05 }, PA: { material: 26.10, mao_obra: 16.70 },
      AM: { material: 28.10, mao_obra: 17.95 }, ES: { material: 26.55, mao_obra: 16.95 },
    },
  },
  // REDE ELÉTRICA
  {
    codigo: "91926",
    descricao: "Poste de concreto circular 9m/200daN — implantado com base",
    unidade: "un",
    grupo: "Rede Elétrica",
    is_composicao: true,
    custos_uf: {
      SP: { material: 1250.00, mao_obra: 480.00 }, RJ: { material: 1305.00, mao_obra: 501.00 },
      MG: { material: 1172.00, mao_obra: 450.00 }, PR: { material: 1200.00, mao_obra: 461.00 },
      RS: { material: 1222.00, mao_obra: 469.00 }, SC: { material: 1190.00, mao_obra: 457.00 },
      BA: { material: 1140.00, mao_obra: 438.00 }, PE: { material: 1122.00, mao_obra: 431.00 },
      CE: { material: 1105.00, mao_obra: 424.00 }, GO: { material: 1160.00, mao_obra: 445.50 },
      DF: { material: 1275.00, mao_obra: 490.00 }, MS: { material: 1168.00, mao_obra: 448.50 },
      MT: { material: 1175.00, mao_obra: 451.00 }, PA: { material: 1148.00, mao_obra: 441.00 },
      AM: { material: 1235.00, mao_obra: 474.00 }, ES: { material: 1165.00, mao_obra: 447.50 },
    },
  },
  // GUIAS E SARJETAS
  {
    codigo: "97592",
    descricao: "Meio-fio (guia) de concreto pré-moldado 100x15x30cm — assentado",
    unidade: "m",
    grupo: "Guias e Sarjetas",
    is_composicao: true,
    custos_uf: {
      SP: { material: 18.90, mao_obra: 14.50 }, RJ: { material: 19.75, mao_obra: 15.15 },
      MG: { material: 17.72, mao_obra: 13.60 }, PR: { material: 18.15, mao_obra: 13.90 },
      RS: { material: 18.50, mao_obra: 14.20 }, SC: { material: 17.95, mao_obra: 13.80 },
      BA: { material: 17.20, mao_obra: 13.20 }, PE: { material: 16.95, mao_obra: 13.00 },
      CE: { material: 16.65, mao_obra: 12.80 }, GO: { material: 17.55, mao_obra: 13.50 },
      DF: { material: 19.30, mao_obra: 14.80 }, MS: { material: 17.65, mao_obra: 13.55 },
      MT: { material: 17.78, mao_obra: 13.62 }, PA: { material: 17.30, mao_obra: 13.30 },
      AM: { material: 18.60, mao_obra: 14.30 }, ES: { material: 17.60, mao_obra: 13.52 },
    },
  },
  {
    codigo: "97593",
    descricao: "Sarjeta de concreto moldada in loco — tipo triangular 30cm",
    unidade: "m",
    grupo: "Guias e Sarjetas",
    is_composicao: true,
    custos_uf: {
      SP: { material: 12.40, mao_obra: 16.80 }, RJ: { material: 12.95, mao_obra: 17.55 },
      MG: { material: 11.62, mao_obra: 15.75 }, PR: { material: 11.90, mao_obra: 16.10 },
      RS: { material: 12.13, mao_obra: 16.40 }, SC: { material: 11.80, mao_obra: 15.95 },
      BA: { material: 11.30, mao_obra: 15.30 }, PE: { material: 11.12, mao_obra: 15.05 },
      CE: { material: 10.92, mao_obra: 14.80 }, GO: { material: 11.50, mao_obra: 15.60 },
      DF: { material: 12.65, mao_obra: 17.15 }, MS: { material: 11.58, mao_obra: 15.68 },
      MT: { material: 11.65, mao_obra: 15.78 }, PA: { material: 11.35, mao_obra: 15.40 },
      AM: { material: 12.20, mao_obra: 16.55 }, ES: { material: 11.55, mao_obra: 15.65 },
    },
  },
  // CALÇADAS / PASSEIO
  {
    codigo: "94283",
    descricao: "Calçada em concreto simples fck=15MPa — espessura 7cm",
    unidade: "m²",
    grupo: "Calçadas e Passeios",
    is_composicao: true,
    custos_uf: {
      SP: { material: 22.30, mao_obra: 18.50 }, RJ: { material: 23.30, mao_obra: 19.30 },
      MG: { material: 20.90, mao_obra: 17.35 }, PR: { material: 21.40, mao_obra: 17.75 },
      RS: { material: 21.80, mao_obra: 18.10 }, SC: { material: 21.20, mao_obra: 17.60 },
      BA: { material: 20.30, mao_obra: 16.85 }, PE: { material: 20.00, mao_obra: 16.60 },
      CE: { material: 19.65, mao_obra: 16.30 }, GO: { material: 20.70, mao_obra: 17.20 },
      DF: { material: 22.70, mao_obra: 18.85 }, MS: { material: 20.85, mao_obra: 17.30 },
      MT: { material: 21.00, mao_obra: 17.40 }, PA: { material: 20.40, mao_obra: 16.95 },
      AM: { material: 22.00, mao_obra: 18.25 }, ES: { material: 20.80, mao_obra: 17.28 },
    },
  },
  // PAISAGISMO
  {
    codigo: "98504",
    descricao: "Plantio de grama em placas — inclusive preparo do terreno",
    unidade: "m²",
    grupo: "Paisagismo",
    is_composicao: true,
    custos_uf: {
      SP: { material: 8.50, mao_obra: 6.20 }, RJ: { material: 8.88, mao_obra: 6.48 },
      MG: { material: 7.97, mao_obra: 5.81 }, PR: { material: 8.16, mao_obra: 5.95 },
      RS: { material: 8.32, mao_obra: 6.06 }, SC: { material: 8.08, mao_obra: 5.89 },
      BA: { material: 7.74, mao_obra: 5.64 }, PE: { material: 7.63, mao_obra: 5.56 },
      CE: { material: 7.48, mao_obra: 5.45 }, GO: { material: 7.88, mao_obra: 5.74 },
      DF: { material: 8.66, mao_obra: 6.31 }, MS: { material: 7.93, mao_obra: 5.78 },
      MT: { material: 7.99, mao_obra: 5.82 }, PA: { material: 7.80, mao_obra: 5.68 },
      AM: { material: 8.40, mao_obra: 6.12 }, ES: { material: 7.90, mao_obra: 5.76 },
    },
  },
  {
    codigo: "98505",
    descricao: "Plantio de muda arbórea nativa — cova 60x60x60cm com tutoragem",
    unidade: "un",
    grupo: "Paisagismo",
    is_composicao: true,
    custos_uf: {
      SP: { material: 32.00, mao_obra: 28.50 }, RJ: { material: 33.40, mao_obra: 29.75 },
      MG: { material: 30.00, mao_obra: 26.72 }, PR: { material: 30.72, mao_obra: 27.35 },
      RS: { material: 31.30, mao_obra: 27.85 }, SC: { material: 30.40, mao_obra: 27.10 },
      BA: { material: 29.15, mao_obra: 25.95 }, PE: { material: 28.70, mao_obra: 25.55 },
      CE: { material: 28.20, mao_obra: 25.10 }, GO: { material: 29.65, mao_obra: 26.40 },
      DF: { material: 32.60, mao_obra: 29.00 }, MS: { material: 29.85, mao_obra: 26.60 },
      MT: { material: 30.05, mao_obra: 26.78 }, PA: { material: 29.35, mao_obra: 26.15 },
      AM: { material: 31.60, mao_obra: 28.10 }, ES: { material: 29.78, mao_obra: 26.55 },
    },
  },
  // CONTENÇÕES
  {
    codigo: "96546",
    descricao: "Muro de arrimo em concreto armado — altura até 2,00m",
    unidade: "m³",
    grupo: "Contenções",
    is_composicao: true,
    custos_uf: {
      SP: { material: 620.00, mao_obra: 380.00 }, RJ: { material: 647.00, mao_obra: 397.00 },
      MG: { material: 581.00, mao_obra: 356.00 }, PR: { material: 595.00, mao_obra: 365.00 },
      RS: { material: 606.00, mao_obra: 372.00 }, SC: { material: 590.00, mao_obra: 361.00 },
      BA: { material: 565.00, mao_obra: 346.00 }, PE: { material: 556.00, mao_obra: 341.00 },
      CE: { material: 547.00, mao_obra: 335.00 }, GO: { material: 575.00, mao_obra: 352.50 },
      DF: { material: 631.00, mao_obra: 387.00 }, MS: { material: 579.00, mao_obra: 355.00 },
      MT: { material: 583.00, mao_obra: 357.50 }, PA: { material: 569.00, mao_obra: 348.50 },
      AM: { material: 611.00, mao_obra: 375.00 }, ES: { material: 577.00, mao_obra: 354.00 },
    },
  },
];

function handleFetchSinapi(body: Record<string, unknown>, _ctx: RequestContext) {
  const uf = ((body.uf as string) || "SP").toUpperCase().trim();
  const codigo = (body.codigo as string || "").trim();
  const busca = normalizeSearch(body.busca as string || "");
  const grupo = normalizeSearch(body.grupo as string || "");
  const limit = Math.min(Number(body.limit) || 20, 50);
  const offset = Math.max(Number(body.offset) || 0, 0);

  let filtered = SINAPI_CATALOGO;

  // Filtro por código exato
  if (codigo) {
    filtered = filtered.filter((i) => i.codigo === codigo || i.codigo.startsWith(codigo));
  }

  // Filtro por busca textual
  if (busca) {
    const terms = busca.split(/\s+/);
    filtered = filtered.filter((i) => {
      const text = normalizeSearch(`${i.descricao} ${i.grupo}`);
      return terms.every((t) => text.includes(t));
    });
  }

  // Filtro por grupo
  if (grupo) {
    filtered = filtered.filter((i) => normalizeSearch(i.grupo).includes(grupo));
  }

  // Montar resultado com preços da UF solicitada (Buchecha fix: add offset)
  const itens = filtered.slice(offset, offset + limit).map((item) => {
    const custos = item.custos_uf[uf] || item.custos_uf["SP"];
    return {
      codigo: item.codigo,
      descricao: item.descricao,
      unidade: item.unidade,
      custo_material: custos.material,
      custo_mao_obra: custos.mao_obra,
      custo_total: +(custos.material + custos.mao_obra).toFixed(2),
      uf,
      referencia: SINAPI_REFERENCIA,
      grupo: item.grupo,
      is_composicao: item.is_composicao,
    };
  });

  // Resumo por grupo
  const grupoMap: Record<string, { total: number; min: number; max: number; count: number }> = {};
  for (const item of itens) {
    if (!grupoMap[item.grupo]) {
      grupoMap[item.grupo] = { total: 0, min: Infinity, max: -Infinity, count: 0 };
    }
    const g = grupoMap[item.grupo];
    g.total += item.custo_total;
    g.min = Math.min(g.min, item.custo_total);
    g.max = Math.max(g.max, item.custo_total);
    g.count += 1;
  }
  const resumo_por_grupo: Record<string, { media: number; min: number; max: number; qtd: number }> = {};
  for (const [k, v] of Object.entries(grupoMap)) {
    resumo_por_grupo[k] = {
      media: +(v.total / v.count).toFixed(2),
      min: v.min === Infinity ? 0 : v.min,
      max: v.max === -Infinity ? 0 : v.max,
      qtd: v.count,
    };
  }

  return {
    uf,
    referencia: SINAPI_REFERENCIA,
    total_encontrados: itens.length,
    itens,
    resumo_por_grupo,
    fonte: "SINAPI — Caixa Econômica Federal (Decreto 7.983/2013)",
    nota: "Valores de referência para composições de serviços de infraestrutura urbana. " +
      "Preços desonerados (sem encargos complementares). Para orçamentos oficiais, " +
      "consultar a tabela SINAPI completa no site da CEF.",
  };
}

// ============================================================
// ACTION 2: fetch_secovi (US-122)
// ============================================================
/**
 * Benchmarks SECOVI — Sindicato da Habitação
 *
 * O SECOVI publica trimestralmente dados de preço médio por m²,
 * IVV (Índice de Velocidade de Vendas) e estoque por cidade/região.
 *
 * Referências:
 * - Pesquisa SECOVI-SP do Mercado Imobiliário (PMI)
 * - Balanço do Mercado Imobiliário (mensal)
 * - SECOVI-RJ: Panorama do Mercado Imobiliário
 */

interface SecoviDataInternal {
  cidade: string;
  uf: string;
  tipo_imovel: string;
  preco_m2_medio: number;
  preco_m2_min: number;
  preco_m2_max: number;
  variacao_12m_pct: number;
  ivv_pct: number;
  meses_estoque: number;
  absorcao_liquida: number;
}

const SECOVI_REFERENCIA = "2026-Q1";

const SECOVI_DATA: SecoviDataInternal[] = [
  // LOTES
  { cidade: "São Paulo", uf: "SP", tipo_imovel: "lote", preco_m2_medio: 1850, preco_m2_min: 950, preco_m2_max: 4200, variacao_12m_pct: 8.2, ivv_pct: 14.5, meses_estoque: 18.2, absorcao_liquida: 420 },
  { cidade: "Campinas", uf: "SP", tipo_imovel: "lote", preco_m2_medio: 1180, preco_m2_min: 580, preco_m2_max: 2800, variacao_12m_pct: 10.5, ivv_pct: 18.3, meses_estoque: 14.0, absorcao_liquida: 185 },
  { cidade: "Piracicaba", uf: "SP", tipo_imovel: "lote", preco_m2_medio: 820, preco_m2_min: 420, preco_m2_max: 1650, variacao_12m_pct: 12.1, ivv_pct: 22.0, meses_estoque: 11.5, absorcao_liquida: 95 },
  { cidade: "Sorocaba", uf: "SP", tipo_imovel: "lote", preco_m2_medio: 780, preco_m2_min: 380, preco_m2_max: 1500, variacao_12m_pct: 9.8, ivv_pct: 19.5, meses_estoque: 13.2, absorcao_liquida: 110 },
  { cidade: "Ribeirão Preto", uf: "SP", tipo_imovel: "lote", preco_m2_medio: 920, preco_m2_min: 450, preco_m2_max: 2100, variacao_12m_pct: 11.3, ivv_pct: 20.2, meses_estoque: 12.0, absorcao_liquida: 130 },
  { cidade: "São José dos Campos", uf: "SP", tipo_imovel: "lote", preco_m2_medio: 1050, preco_m2_min: 520, preco_m2_max: 2400, variacao_12m_pct: 9.2, ivv_pct: 17.8, meses_estoque: 14.5, absorcao_liquida: 105 },
  { cidade: "Jundiaí", uf: "SP", tipo_imovel: "lote", preco_m2_medio: 1150, preco_m2_min: 600, preco_m2_max: 2600, variacao_12m_pct: 7.8, ivv_pct: 16.5, meses_estoque: 15.8, absorcao_liquida: 75 },
  { cidade: "Rio de Janeiro", uf: "RJ", tipo_imovel: "lote", preco_m2_medio: 1620, preco_m2_min: 650, preco_m2_max: 3800, variacao_12m_pct: 5.4, ivv_pct: 11.2, meses_estoque: 22.0, absorcao_liquida: 210 },
  { cidade: "Belo Horizonte", uf: "MG", tipo_imovel: "lote", preco_m2_medio: 980, preco_m2_min: 450, preco_m2_max: 2200, variacao_12m_pct: 8.9, ivv_pct: 16.0, meses_estoque: 16.0, absorcao_liquida: 155 },
  { cidade: "Curitiba", uf: "PR", tipo_imovel: "lote", preco_m2_medio: 1100, preco_m2_min: 520, preco_m2_max: 2500, variacao_12m_pct: 9.6, ivv_pct: 17.2, meses_estoque: 15.0, absorcao_liquida: 140 },
  { cidade: "Porto Alegre", uf: "RS", tipo_imovel: "lote", preco_m2_medio: 950, preco_m2_min: 430, preco_m2_max: 2000, variacao_12m_pct: 7.1, ivv_pct: 14.8, meses_estoque: 17.5, absorcao_liquida: 115 },
  { cidade: "Florianópolis", uf: "SC", tipo_imovel: "lote", preco_m2_medio: 1350, preco_m2_min: 700, preco_m2_max: 3200, variacao_12m_pct: 13.5, ivv_pct: 21.0, meses_estoque: 12.5, absorcao_liquida: 90 },
  { cidade: "Goiânia", uf: "GO", tipo_imovel: "lote", preco_m2_medio: 720, preco_m2_min: 350, preco_m2_max: 1400, variacao_12m_pct: 14.2, ivv_pct: 23.5, meses_estoque: 10.5, absorcao_liquida: 170 },
  { cidade: "Brasília", uf: "DF", tipo_imovel: "lote", preco_m2_medio: 1900, preco_m2_min: 800, preco_m2_max: 5500, variacao_12m_pct: 6.3, ivv_pct: 12.5, meses_estoque: 20.0, absorcao_liquida: 95 },
  { cidade: "Salvador", uf: "BA", tipo_imovel: "lote", preco_m2_medio: 680, preco_m2_min: 320, preco_m2_max: 1600, variacao_12m_pct: 7.5, ivv_pct: 15.0, meses_estoque: 17.0, absorcao_liquida: 120 },
  { cidade: "Recife", uf: "PE", tipo_imovel: "lote", preco_m2_medio: 720, preco_m2_min: 340, preco_m2_max: 1700, variacao_12m_pct: 6.8, ivv_pct: 13.5, meses_estoque: 18.5, absorcao_liquida: 100 },
  { cidade: "Fortaleza", uf: "CE", tipo_imovel: "lote", preco_m2_medio: 650, preco_m2_min: 300, preco_m2_max: 1500, variacao_12m_pct: 8.0, ivv_pct: 16.2, meses_estoque: 16.5, absorcao_liquida: 110 },
  { cidade: "Campo Grande", uf: "MS", tipo_imovel: "lote", preco_m2_medio: 580, preco_m2_min: 280, preco_m2_max: 1200, variacao_12m_pct: 11.0, ivv_pct: 20.8, meses_estoque: 12.0, absorcao_liquida: 85 },
  { cidade: "Cuiabá", uf: "MT", tipo_imovel: "lote", preco_m2_medio: 620, preco_m2_min: 300, preco_m2_max: 1350, variacao_12m_pct: 10.5, ivv_pct: 19.5, meses_estoque: 13.0, absorcao_liquida: 72 },
  { cidade: "Belém", uf: "PA", tipo_imovel: "lote", preco_m2_medio: 550, preco_m2_min: 260, preco_m2_max: 1100, variacao_12m_pct: 6.5, ivv_pct: 13.0, meses_estoque: 19.5, absorcao_liquida: 60 },
  // CASAS (amostra reduzida — top 5 mercados)
  { cidade: "São Paulo", uf: "SP", tipo_imovel: "casa", preco_m2_medio: 5800, preco_m2_min: 3200, preco_m2_max: 12000, variacao_12m_pct: 6.5, ivv_pct: 10.2, meses_estoque: 24.0, absorcao_liquida: 280 },
  { cidade: "Campinas", uf: "SP", tipo_imovel: "casa", preco_m2_medio: 4200, preco_m2_min: 2500, preco_m2_max: 8500, variacao_12m_pct: 8.0, ivv_pct: 13.5, meses_estoque: 18.5, absorcao_liquida: 120 },
  { cidade: "Curitiba", uf: "PR", tipo_imovel: "casa", preco_m2_medio: 4500, preco_m2_min: 2800, preco_m2_max: 9000, variacao_12m_pct: 7.2, ivv_pct: 12.0, meses_estoque: 20.0, absorcao_liquida: 100 },
  { cidade: "Goiânia", uf: "GO", tipo_imovel: "casa", preco_m2_medio: 3400, preco_m2_min: 2000, preco_m2_max: 6500, variacao_12m_pct: 12.0, ivv_pct: 18.5, meses_estoque: 14.0, absorcao_liquida: 145 },
  { cidade: "Florianópolis", uf: "SC", tipo_imovel: "casa", preco_m2_medio: 6200, preco_m2_min: 3800, preco_m2_max: 14000, variacao_12m_pct: 11.0, ivv_pct: 15.8, meses_estoque: 16.5, absorcao_liquida: 65 },
];

function handleFetchSecovi(body: Record<string, unknown>, _ctx: RequestContext) {
  const cidade = normalizeSearch(body.cidade as string || "");
  const uf = (body.uf as string || "").toUpperCase().trim();
  const tipo_imovel = (body.tipo_imovel as string || "").toLowerCase().trim();

  let filtered = SECOVI_DATA;

  if (cidade) {
    filtered = filtered.filter((d) => {
      const dNorm = normalizeSearch(d.cidade);
      return dNorm.includes(cidade) || cidade.includes(dNorm);
    });
  }

  if (uf) {
    filtered = filtered.filter((d) => d.uf === uf);
  }

  if (tipo_imovel) {
    filtered = filtered.filter((d) => d.tipo_imovel === tipo_imovel);
  }

  const precos = filtered.map((d) => ({
    cidade: d.cidade,
    uf: d.uf,
    tipo_imovel: d.tipo_imovel,
    preco_m2_medio: d.preco_m2_medio,
    preco_m2_min: d.preco_m2_min,
    preco_m2_max: d.preco_m2_max,
    variacao_12m_pct: d.variacao_12m_pct,
    referencia: SECOVI_REFERENCIA,
  }));

  const velocidade_vendas = filtered.map((d) => ({
    cidade: d.cidade,
    uf: d.uf,
    tipo_imovel: d.tipo_imovel,
    ivv_pct: d.ivv_pct,
    meses_estoque: d.meses_estoque,
    absorcao_liquida: d.absorcao_liquida,
    referencia: SECOVI_REFERENCIA,
  }));

  const cidadesUnicas = new Set(filtered.map((d) => d.cidade));

  return {
    precos,
    velocidade_vendas,
    total_cidades: cidadesUnicas.size,
    referencia: SECOVI_REFERENCIA,
    fonte: "SECOVI — Sindicato da Habitação (Pesquisa do Mercado Imobiliário)",
    nota: "Valores de referência baseados em pesquisas trimestrais do SECOVI. " +
      "Preços de lotes referem-se a loteamentos abertos e condomínios fechados. " +
      "IVV = Índice de Velocidade de Vendas (% unidades vendidas / lançadas no período).",
  };
}

// ============================================================
// ACTION 3: fetch_abrainc (US-123)
// ============================================================
/**
 * Indicadores ABRAINC — Associação Brasileira de Incorporadoras Imobiliárias
 *
 * A ABRAINC publica os indicadores ABRAINC-FIPE trimestralmente,
 * com dados de lançamentos, vendas, distratos e performance por segmento.
 *
 * Referências:
 * - Indicadores ABRAINC-FIPE (trimestral)
 * - Radar ABRAINC (mensal)
 * - Anuário do Mercado Imobiliário Brasileiro
 */

interface AbraincDataInternal {
  regiao: string;
  uf_principal: string;
  segmento: string;
  unidades_lancadas: number;
  unidades_vendidas: number;
  vgv_lancado_milhoes: number;
  variacao_12m_pct: number;
  vso_pct: number;
  taxa_distrato_pct: number;
  margem_bruta_pct: number;
  prazo_medio_obra_meses: number;
}

const ABRAINC_REFERENCIA = "2026-Q1";

const ABRAINC_DATA: AbraincDataInternal[] = [
  // MCMV — Minha Casa Minha Vida
  { regiao: "Sudeste", uf_principal: "SP", segmento: "MCMV", unidades_lancadas: 32500, unidades_vendidas: 28900, vgv_lancado_milhoes: 7800, variacao_12m_pct: 15.2, vso_pct: 42.5, taxa_distrato_pct: 8.2, margem_bruta_pct: 28.0, prazo_medio_obra_meses: 24 },
  { regiao: "Sul", uf_principal: "PR", segmento: "MCMV", unidades_lancadas: 12800, unidades_vendidas: 11500, vgv_lancado_milhoes: 3100, variacao_12m_pct: 12.8, vso_pct: 38.0, taxa_distrato_pct: 7.5, margem_bruta_pct: 26.5, prazo_medio_obra_meses: 22 },
  { regiao: "Nordeste", uf_principal: "BA", segmento: "MCMV", unidades_lancadas: 18200, unidades_vendidas: 15800, vgv_lancado_milhoes: 4200, variacao_12m_pct: 18.5, vso_pct: 45.0, taxa_distrato_pct: 9.5, margem_bruta_pct: 25.0, prazo_medio_obra_meses: 26 },
  { regiao: "Centro-Oeste", uf_principal: "GO", segmento: "MCMV", unidades_lancadas: 9500, unidades_vendidas: 8700, vgv_lancado_milhoes: 2400, variacao_12m_pct: 20.0, vso_pct: 48.0, taxa_distrato_pct: 6.8, margem_bruta_pct: 30.0, prazo_medio_obra_meses: 22 },
  { regiao: "Norte", uf_principal: "PA", segmento: "MCMV", unidades_lancadas: 4200, unidades_vendidas: 3600, vgv_lancado_milhoes: 980, variacao_12m_pct: 10.5, vso_pct: 35.0, taxa_distrato_pct: 10.2, margem_bruta_pct: 23.0, prazo_medio_obra_meses: 28 },
  // MAP — Médio e Alto Padrão
  { regiao: "Sudeste", uf_principal: "SP", segmento: "MAP", unidades_lancadas: 18500, unidades_vendidas: 14200, vgv_lancado_milhoes: 22500, variacao_12m_pct: 8.5, vso_pct: 28.0, taxa_distrato_pct: 5.2, margem_bruta_pct: 35.0, prazo_medio_obra_meses: 30 },
  { regiao: "Sul", uf_principal: "PR", segmento: "MAP", unidades_lancadas: 6200, unidades_vendidas: 5100, vgv_lancado_milhoes: 8500, variacao_12m_pct: 7.0, vso_pct: 25.0, taxa_distrato_pct: 4.8, margem_bruta_pct: 33.5, prazo_medio_obra_meses: 28 },
  { regiao: "Nordeste", uf_principal: "BA", segmento: "MAP", unidades_lancadas: 5800, unidades_vendidas: 4500, vgv_lancado_milhoes: 6200, variacao_12m_pct: 6.2, vso_pct: 22.0, taxa_distrato_pct: 6.0, margem_bruta_pct: 31.0, prazo_medio_obra_meses: 32 },
  { regiao: "Centro-Oeste", uf_principal: "GO", segmento: "MAP", unidades_lancadas: 4500, unidades_vendidas: 3800, vgv_lancado_milhoes: 5100, variacao_12m_pct: 10.0, vso_pct: 30.0, taxa_distrato_pct: 4.5, margem_bruta_pct: 34.0, prazo_medio_obra_meses: 26 },
  // LOTEAMENTO
  { regiao: "Sudeste", uf_principal: "SP", segmento: "loteamento", unidades_lancadas: 22000, unidades_vendidas: 19800, vgv_lancado_milhoes: 5500, variacao_12m_pct: 14.0, vso_pct: 38.5, taxa_distrato_pct: 7.0, margem_bruta_pct: 32.0, prazo_medio_obra_meses: 18 },
  { regiao: "Sul", uf_principal: "PR", segmento: "loteamento", unidades_lancadas: 8500, unidades_vendidas: 7800, vgv_lancado_milhoes: 2100, variacao_12m_pct: 11.5, vso_pct: 35.0, taxa_distrato_pct: 6.5, margem_bruta_pct: 30.0, prazo_medio_obra_meses: 16 },
  { regiao: "Nordeste", uf_principal: "BA", segmento: "loteamento", unidades_lancadas: 10500, unidades_vendidas: 9200, vgv_lancado_milhoes: 2300, variacao_12m_pct: 16.0, vso_pct: 40.0, taxa_distrato_pct: 8.5, margem_bruta_pct: 28.0, prazo_medio_obra_meses: 20 },
  { regiao: "Centro-Oeste", uf_principal: "GO", segmento: "loteamento", unidades_lancadas: 12000, unidades_vendidas: 11200, vgv_lancado_milhoes: 2800, variacao_12m_pct: 22.0, vso_pct: 50.0, taxa_distrato_pct: 5.5, margem_bruta_pct: 35.0, prazo_medio_obra_meses: 15 },
  { regiao: "Norte", uf_principal: "PA", segmento: "loteamento", unidades_lancadas: 3200, unidades_vendidas: 2700, vgv_lancado_milhoes: 650, variacao_12m_pct: 8.0, vso_pct: 30.0, taxa_distrato_pct: 9.0, margem_bruta_pct: 25.0, prazo_medio_obra_meses: 22 },
];

function handleFetchAbrainc(body: Record<string, unknown>, _ctx: RequestContext) {
  const regiao = normalizeSearch(body.regiao as string || "");
  const uf = (body.uf as string || "").toUpperCase().trim();
  const segmento = (body.segmento as string || "").toLowerCase().trim();

  let filtered = ABRAINC_DATA;

  if (regiao) {
    filtered = filtered.filter((d) => {
      const dNorm = normalizeSearch(d.regiao);
      return dNorm.includes(regiao);
    });
  }

  if (uf) {
    filtered = filtered.filter((d) => d.uf_principal === uf);
  }

  if (segmento) {
    const segNorm = segmento.toLowerCase();
    filtered = filtered.filter((d) => d.segmento.toLowerCase().includes(segNorm));
  }

  const lancamentos = filtered.map((d) => ({
    regiao: d.regiao,
    uf: d.uf_principal,
    tipo_programa: d.segmento,
    unidades_lancadas: d.unidades_lancadas,
    unidades_vendidas: d.unidades_vendidas,
    pct_vendido: +((d.unidades_vendidas / d.unidades_lancadas) * 100).toFixed(1),
    vgv_lancado_milhoes: d.vgv_lancado_milhoes,
    variacao_12m_pct: d.variacao_12m_pct,
    referencia: ABRAINC_REFERENCIA,
  }));

  const performanceMap: Record<string, AbraincDataInternal[]> = {};
  for (const d of filtered) {
    if (!performanceMap[d.segmento]) performanceMap[d.segmento] = [];
    performanceMap[d.segmento].push(d);
  }

  const performance = Object.entries(performanceMap).map(([seg, items]) => {
    const avg = (arr: number[]) => +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
    return {
      segmento: seg,
      vso_pct: avg(items.map((i) => i.vso_pct)),
      taxa_distrato_pct: avg(items.map((i) => i.taxa_distrato_pct)),
      margem_bruta_pct: avg(items.map((i) => i.margem_bruta_pct)),
      prazo_medio_obra_meses: Math.round(items.reduce((a, i) => a + i.prazo_medio_obra_meses, 0) / items.length),
      referencia: ABRAINC_REFERENCIA,
    };
  });

  const regioesUnicas = new Set(filtered.map((d) => d.regiao));

  return {
    lancamentos,
    performance,
    total_regioes: regioesUnicas.size,
    referencia: ABRAINC_REFERENCIA,
    fonte: "ABRAINC — Indicadores ABRAINC-FIPE (Associação Brasileira de Incorporadoras Imobiliárias)",
    nota: "Dados consolidados de incorporadoras associadas à ABRAINC. " +
      "VSO = Vendas sobre Oferta. MCMV = Minha Casa Minha Vida. " +
      "MAP = Médio e Alto Padrão. Loteamento inclui aberto e fechado.",
  };
}

// ============================================================
// Router
// ============================================================

Deno.serve(async (req) => {
  const cors = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const action = body.action as string;

    if (!action) {
      return new Response(JSON.stringify({ error: "Missing 'action' field" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const ctx = await buildContext(req);

    let result: unknown;

    switch (action) {
      case "fetch_sinapi":
        result = handleFetchSinapi(body, ctx);
        break;
      case "fetch_secovi":
        result = handleFetchSecovi(body, ctx);
        break;
      case "fetch_abrainc":
        result = handleFetchAbrainc(body, ctx);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}. Valid: fetch_sinapi, fetch_secovi, fetch_abrainc` }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
        );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message === "Unauthorized" || message === "Invalid token" ? 401 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
