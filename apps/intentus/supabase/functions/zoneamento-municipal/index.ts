/**
 * zoneamento-municipal v1
 *
 * Edge Function multi-action para extração de parâmetros de zoneamento
 * a partir de PDFs do Plano Diretor usando Gemini 2.0 Flash (multimodal).
 *
 * ACTIONS:
 *   analyze_pdf        — Extrai zoneamento de PDF (base64 ou URL)
 *   analyze_manual     — Valida e normaliza dados tipados manualmente
 *   get_zoning         — Retorna zoneamento cacheado
 *   list_zonings       — Lista todas as análises de zoneamento
 *
 * Sessão 145 — Bloco H Sprint 5 — US-125
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 *
 * Fontes de dados:
 *   Gemini 2.0 Flash (multimodal) — https://ai.google.dev/api/rest
 *   Supabase PostgreSQL — development_zoneamento_municipal
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// CORS (padrão Intentus)
// ============================================================

const ALLOWED_ORIGINS_RAW = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",").map((o: string) => o.trim()).filter(Boolean);

const DEV_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https:\/\/intentus-plataform-[a-zA-Z0-9-]+\.vercel\.app$/,
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
// Types
// ============================================================

interface RequestContext {
  supabase: SupabaseClient;
  serviceSupabase: SupabaseClient;
  userId: string;
  tenantId: string;
}

interface ZoneamentoData {
  development_id: string;
  ca_basico?: number;
  ca_maximo?: number;
  ca_minimo?: number;
  to_percentual?: number;
  gabarito_andares?: number;
  gabarito_altura_m?: number;
  recuo_frontal_m?: number;
  recuo_lateral_m?: number;
  recuo_fundos_m?: number;
  zona_classificacao?: string;
  permeabilidade_percentual?: number;
  usos_permitidos?: string[];
  usos_proibidos?: string[];
  observacoes?: string;
  confidence_score?: number;
  status?: string;
}

interface ZoneamentoRecord extends ZoneamentoData {
  id: string;
  created_at: string;
  updated_at: string;
}

interface ZoneamentoResult {
  data?: ZoneamentoRecord;
  error?: { code: string; message: string };
}

interface ListZoneamentosResult {
  data?: {
    zonings: Omit<ZoneamentoRecord, "observacoes">[];
    count: number;
  };
  error?: { code: string; message: string };
}

// ============================================================
// Gemini 2.0 Flash — Multimodal PDF Extraction
// ============================================================

async function extractZoneamentoFromPdf(
  pdfBase64: string,
  municipality: string,
  state: string
): Promise<{ data: ZoneamentoData; confidence: number }> {
  const apiKey = Deno.env.get("GOOGLE_API_KEY") || Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY or GEMINI_API_KEY not configured");
  }

  const prompt = `You are a Brazilian real estate zoning expert. Analyze this Plano Diretor (municipal master plan) PDF and extract ONLY the following parameters in JSON format:

{
  "ca_basico": <number or null>,
  "ca_maximo": <number or null>,
  "ca_minimo": <number or null>,
  "to_percentual": <number 0-100 or null>,
  "gabarito_andares": <integer floors or null>,
  "gabarito_altura_m": <number meters or null>,
  "recuo_frontal_m": <number meters or null>,
  "recuo_lateral_m": <number meters or null>,
  "recuo_fundos_m": <number meters or null>,
  "zona_classificacao": <string zone name or null>,
  "permeabilidade_percentual": <number 0-100 or null>,
  "usos_permitidos": <array of strings or empty array>,
  "usos_proibidos": <array of strings or empty array>,
  "observacoes": <string with additional notes or empty string>,
  "confidence_score": <number 0-100>
}

Municipality: ${municipality}, State: ${state}

Return ONLY valid JSON, no markdown code blocks.`;

  const reqBody = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
          {
            inlineData: {
              mimeType: "application/pdf",
              data: pdfBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reqBody),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API failed (${res.status}): ${errText}`);
  }

  const responseData = await res.json();

  if (!responseData.candidates || !responseData.candidates[0]) {
    throw new Error("No response from Gemini API");
  }

  const content = responseData.candidates[0].content?.parts?.[0]?.text;
  if (!content) {
    throw new Error("Empty response from Gemini API");
  }

  const extracted = JSON.parse(content);
  return {
    data: extracted,
    confidence: extracted.confidence_score || 0,
  };
}

// ============================================================
// ACTION: analyze_pdf
// ============================================================

async function analyzePdf(
  ctx: RequestContext,
  params: {
    development_id: string;
    pdf_base64?: string;
    pdf_url?: string;
    municipality: string;
    state: string;
  }
): Promise<ZoneamentoResult> {
  let pdfBase64 = params.pdf_base64;

  if (!pdfBase64 && params.pdf_url) {
    const pdfRes = await fetch(params.pdf_url);
    if (!pdfRes.ok) {
      return { error: { code: "PDF_FETCH_ERROR", message: `Failed to fetch PDF from URL: ${pdfRes.status}` } };
    }
    const buffer = await pdfRes.arrayBuffer();
    pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }

  if (!pdfBase64) {
    return { error: { code: "INVALID_INPUT", message: "pdf_base64 or pdf_url required" } };
  }

  // Buchecha fix: limit PDF size to ~10MB base64 (~7.5MB raw)
  const MAX_PDF_BASE64_LEN = 10 * 1024 * 1024;
  if (pdfBase64.length > MAX_PDF_BASE64_LEN) {
    return { error: { code: "PDF_TOO_LARGE", message: `PDF excede o limite de 10MB (${(pdfBase64.length / 1024 / 1024).toFixed(1)}MB recebido)` } };
  }

  try {
    const { data: extracted, confidence } = await extractZoneamentoFromPdf(
      pdfBase64,
      params.municipality,
      params.state
    );

    const zoneData: ZoneamentoData = {
      development_id: params.development_id,
      ca_basico: extracted.ca_basico,
      ca_maximo: extracted.ca_maximo,
      ca_minimo: extracted.ca_minimo,
      to_percentual: extracted.to_percentual,
      gabarito_andares: extracted.gabarito_andares,
      gabarito_altura_m: extracted.gabarito_altura_m,
      recuo_frontal_m: extracted.recuo_frontal_m,
      recuo_lateral_m: extracted.recuo_lateral_m,
      recuo_fundos_m: extracted.recuo_fundos_m,
      zona_classificacao: extracted.zona_classificacao,
      permeabilidade_percentual: extracted.permeabilidade_percentual,
      usos_permitidos: extracted.usos_permitidos || [],
      usos_proibidos: extracted.usos_proibidos || [],
      observacoes: extracted.observacoes || "",
      confidence_score: confidence,
      status: "generated",
    };

    // Upsert to development_zoneamento_municipal
    const { data, error } = await ctx.serviceSupabase
      .from("development_zoneamento_municipal")
      .upsert(
        { ...zoneData, updated_at: new Date().toISOString() },
        { onConflict: "development_id" }
      )
      .select()
      .maybeSingle();

    if (error) {
      return { error: { code: "DB_ERROR", message: error.message } };
    }

    return { data: data as ZoneamentoRecord };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { error: { code: "EXTRACT_ERROR", message: msg } };
  }
}

// ============================================================
// ACTION: analyze_manual
// ============================================================

async function analyzeManual(
  ctx: RequestContext,
  params: {
    development_id: string;
    ca_basico?: number;
    ca_maximo?: number;
    ca_minimo?: number;
    to_percentual?: number;
    gabarito_andares?: number;
    gabarito_altura_m?: number;
    recuo_frontal_m?: number;
    recuo_lateral_m?: number;
    recuo_fundos_m?: number;
    zona_classificacao?: string;
    permeabilidade_percentual?: number;
    usos_permitidos?: string[];
    usos_proibidos?: string[];
    observacoes?: string;
  }
): Promise<ZoneamentoResult> {
  if (!params.development_id) {
    return { error: { code: "INVALID_INPUT", message: "development_id required" } };
  }

  const zoneData: ZoneamentoData = {
    development_id: params.development_id,
    ca_basico: params.ca_basico,
    ca_maximo: params.ca_maximo,
    ca_minimo: params.ca_minimo,
    to_percentual: params.to_percentual,
    gabarito_andares: params.gabarito_andares,
    gabarito_altura_m: params.gabarito_altura_m,
    recuo_frontal_m: params.recuo_frontal_m,
    recuo_lateral_m: params.recuo_lateral_m,
    recuo_fundos_m: params.recuo_fundos_m,
    zona_classificacao: params.zona_classificacao,
    permeabilidade_percentual: params.permeabilidade_percentual,
    usos_permitidos: params.usos_permitidos || [],
    usos_proibidos: params.usos_proibidos || [],
    observacoes: params.observacoes || "",
    confidence_score: 100,
    status: "generated",
  };

  const { data, error } = await ctx.serviceSupabase
    .from("development_zoneamento_municipal")
    .upsert(
      { ...zoneData, updated_at: new Date().toISOString() },
      { onConflict: "development_id" }
    )
    .select()
    .maybeSingle();

  if (error) {
    return { error: { code: "DB_ERROR", message: error.message } };
  }

  return { data: data as ZoneamentoRecord };
}

// ============================================================
// ACTION: get_zoning
// ============================================================

async function getZoning(
  ctx: RequestContext,
  params: { development_id: string }
): Promise<ZoneamentoResult> {
  const { data, error } = await ctx.serviceSupabase
    .from("development_zoneamento_municipal")
    .select("*")
    .eq("development_id", params.development_id)
    .maybeSingle();

  if (error) {
    return { error: { code: "DB_ERROR", message: error.message } };
  }

  if (!data) {
    return { error: { code: "NOT_FOUND", message: "Zoneamento não encontrado" } };
  }

  return { data: data as ZoneamentoRecord };
}

// ============================================================
// ACTION: list_zonings
// ============================================================

async function listZonings(
  ctx: RequestContext,
  params: { development_id: string; limit?: number }
): Promise<ListZoneamentosResult> {
  const limit = params.limit || 10;

  const { data, error, count } = await ctx.serviceSupabase
    .from("development_zoneamento_municipal")
    .select("id, development_id, ca_basico, ca_maximo, to_percentual, zona_classificacao, confidence_score, status, created_at, updated_at", { count: "exact" })
    .eq("development_id", params.development_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { error: { code: "DB_ERROR", message: error.message } };
  }

  return { data: { zonings: (data || []) as Omit<ZoneamentoRecord, "observacoes">[], count: count || 0 } };
}

// ============================================================
// Main Handler
// ============================================================

async function handleRequest(req: Request, ctx: RequestContext): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders(req),
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: corsHeaders(req),
    });
  }

  const { action, params } = body;

  let result;
  try {
    switch (action) {
      case "analyze_pdf":
        result = await analyzePdf(ctx, params);
        break;
      case "analyze_manual":
        result = await analyzeManual(ctx, params);
        break;
      case "get_zoning":
        result = await getZoning(ctx, params);
        break;
      case "list_zonings":
        result = await listZonings(ctx, params);
        break;
      default:
        result = { error: { code: "UNKNOWN_ACTION", message: `Action '${action}' not supported` } };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    result = { error: { code: "INTERNAL_ERROR", message: msg } };
  }

  return new Response(JSON.stringify(result), {
    status: result.error ? 400 : 200,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

// ============================================================
// Deno Deploy Entry
// ============================================================

Deno.serve(async (req) => {
  const authHeader = req.headers.get("authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase configuration" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Extract token from Bearer header
  const token = authHeader?.replace("Bearer ", "") || "";

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { authorization: authHeader || "" } },
  });

  const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const ctx: RequestContext = {
    supabase,
    serviceSupabase,
    userId: user.id,
    tenantId: profile?.tenant_id || user.id,
  };

  return handleRequest(req, ctx);
});
