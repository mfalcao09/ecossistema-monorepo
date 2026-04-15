/**
 * memorial-descritivo v1
 *
 * Edge Function multi-action para geração automática de Memorial Descritivo
 * em formato compatível com Cartório de Registro de Imóveis (Lei 6.015/73).
 *
 * ACTIONS:
 *   generate          — Gera memorial descritivo completo com Gemini 2.0 Flash
 *   get_memorial      — Retorna memorial salvo por ID
 *   list_memorials    — Lista memoriais de um development
 *
 * Sessão 145 — Bloco H Sprint 5 — US-130
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 *
 * Base legal:
 *   Lei 6.015/73 — Lei de Registros Públicos (Art. 176, §1°, II, 3)
 *   Lei 6.766/79 — Parcelamento do Solo Urbano (Art. 18, V)
 *   NBR 13.133  — Execução de Levantamento Topográfico
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
  userId: string;
  tenantId: string;
}

interface VertexCoordinate {
  id: string;
  label: string;
  lat: number;
  lng: number;
  utm_e?: number;
  utm_n?: number;
  utm_zone?: string;
}

interface BoundarySegment {
  from_vertex: string;
  to_vertex: string;
  azimuth_degrees: number;
  distance_m: number;
  confrontation: string;
}

interface MemorialInput {
  development_id: string;
  lot_id?: string;
  property_name: string;
  municipality: string;
  state: string;
  comarca: string;
  registration_number?: string;
  cns_code?: string;
  owner_name: string;
  owner_cpf_cnpj: string;
  vertices: VertexCoordinate[];
  boundary_segments: BoundarySegment[];
  total_area_m2: number;
  perimeter_m: number;
  datum?: string;
  meridiano_central?: string;
  responsible_technician?: string;
  crea_cau?: string;
  art_rrt?: string;
  additional_notes?: string;
}

interface MemorialRecord {
  id: string;
  development_id: string;
  lot_id: string | null;
  property_name: string;
  municipality: string;
  state: string;
  comarca: string;
  owner_name: string;
  total_area_m2: number;
  perimeter_m: number;
  vertex_count: number;
  memorial_text: string;
  memorial_html: string;
  technical_data: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Constants
// ============================================================

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_DATUM = "SIRGAS 2000";
const DEFAULT_MC = "MC -45°";
const MAX_INPUT_LEN = 500; // Buchecha fix P0: sanitize user inputs before LLM prompt

// Buchecha fix: strip control chars and limit length to prevent prompt injection
function sanitizeForPrompt(s: string, maxLen = MAX_INPUT_LEN): string {
  if (!s) return "";
  // Remove control characters and common injection patterns
  return s.replace(/[\x00-\x1F\x7F]/g, "").replace(/```/g, "").trim().slice(0, maxLen);
}

// ============================================================
// Helpers — Geometry
// ============================================================

function calcAzimuth(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  let azimuth = Math.atan2(y, x) * 180 / Math.PI;
  if (azimuth < 0) azimuth += 360;
  return azimuth;
}

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDMS(decimal: number, isLat: boolean): string {
  const abs = Math.abs(decimal);
  const d = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  const m = Math.floor(mFloat);
  const s = ((mFloat - m) * 60).toFixed(4);
  const dir = isLat ? (decimal >= 0 ? "N" : "S") : (decimal >= 0 ? "E" : "W");
  return `${d}°${String(m).padStart(2, "0")}'${String(s).padStart(7, "0")}"${dir}`;
}

function formatAzimuthDMS(degrees: number): string {
  const d = Math.floor(degrees);
  const mFloat = (degrees - d) * 60;
  const m = Math.floor(mFloat);
  const s = ((mFloat - m) * 60).toFixed(2);
  return `${d}°${String(m).padStart(2, "0")}'${String(s).padStart(5, "0")}"`;
}

function buildVertexTable(vertices: VertexCoordinate[], datum: string, mc: string): string {
  let table = `QUADRO DE COORDENADAS DOS VÉRTICES\n`;
  table += `Datum: ${datum} | Meridiano Central: ${mc}\n\n`;
  table += `| Vértice | Latitude | Longitude | UTM E (m) | UTM N (m) |\n`;
  table += `|---------|----------|-----------|-----------|----------|\n`;
  for (const v of vertices) {
    const lat = formatDMS(v.lat, true);
    const lng = formatDMS(v.lng, false);
    const utmE = v.utm_e ? v.utm_e.toFixed(3) : "-";
    const utmN = v.utm_n ? v.utm_n.toFixed(3) : "-";
    table += `| ${v.label} | ${lat} | ${lng} | ${utmE} | ${utmN} |\n`;
  }
  return table;
}

function buildBoundaryDescription(segments: BoundarySegment[], vertices: VertexCoordinate[]): string {
  const lines: string[] = [];
  for (const seg of segments) {
    const fromV = vertices.find((v) => v.label === seg.from_vertex);
    const toV = vertices.find((v) => v.label === seg.to_vertex);
    if (!fromV || !toV) continue;

    const azStr = formatAzimuthDMS(seg.azimuth_degrees);
    const distStr = seg.distance_m.toFixed(2);
    const confr = seg.confrontation || "proprietário";

    lines.push(
      `Do vértice ${seg.from_vertex}, segue com azimute ${azStr} e distância de ${distStr}m ` +
      `até o vértice ${seg.to_vertex}, confrontando com ${confr};`
    );
  }
  return lines.join("\n");
}

// ============================================================
// Gemini — Memorial formatting
// ============================================================

async function formatWithGemini(
  rawMemorial: string,
  input: MemorialInput,
): Promise<{ text: string; html: string }> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    // Fallback: return raw text without AI formatting
    return {
      text: rawMemorial,
      html: `<div style="font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.8;">${rawMemorial.replace(/\n/g, "<br/>")}</div>`,
    };
  }

  const prompt = `Você é um engenheiro agrimensor e perito em registros públicos.
Formate o memorial descritivo abaixo no padrão oficial aceito por Cartórios de Registro de Imóveis do Brasil,
conforme a Lei 6.015/73 (Art. 176, §1°, II, 3) e a Lei 6.766/79 (Art. 18, V).

REGRAS DE FORMATAÇÃO:
1. Texto em linguagem técnica formal, em terceira pessoa
2. Iniciar com "MEMORIAL DESCRITIVO" centralizado, seguido de dados do imóvel
3. Descrever o perímetro em sentido horário, começando pelo vértice inicial
4. Cada segmento: "Do vértice X, segue com azimute Y e distância Z até o vértice W, confrontando com [confrontante]"
5. Ao final, citar datum geodésico, área total, perímetro total
6. Incluir dados do responsável técnico (nome, CREA/CAU, ART/RRT)
7. Local, data e espaço para assinatura
8. NUNCA inventar dados — use APENAS os dados fornecidos

DADOS DO IMÓVEL:
Denominação: ${sanitizeForPrompt(input.property_name)}
Município/UF: ${sanitizeForPrompt(input.municipality)}/${sanitizeForPrompt(input.state)}
Comarca: ${sanitizeForPrompt(input.comarca)}
Matrícula: ${sanitizeForPrompt(input.registration_number || "A ser registrada")}
Proprietário: ${sanitizeForPrompt(input.owner_name)}
CPF/CNPJ: ${sanitizeForPrompt(input.owner_cpf_cnpj)}
Área Total: ${input.total_area_m2.toFixed(2)} m² (${(input.total_area_m2 / 10000).toFixed(4)} ha)
Perímetro: ${input.perimeter_m.toFixed(2)} m
Datum: ${input.datum || DEFAULT_DATUM}
Responsável Técnico: ${input.responsible_technician || "A definir"}
CREA/CAU: ${input.crea_cau || "A definir"}
ART/RRT: ${input.art_rrt || "A definir"}

DESCRIÇÃO DO PERÍMETRO (dados brutos):
${rawMemorial}

Retorne o memorial em JSON com dois campos:
- "text": versão texto puro
- "html": versão HTML formatada com estilos inline (Times New Roman 12pt, margens, tabelas com bordas)`;

  try {
    const resp = await fetch(`${GEMINI_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!resp.ok) {
      console.error("Gemini error:", await resp.text());
      return {
        text: rawMemorial,
        html: `<div style="font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.8;">${rawMemorial.replace(/\n/g, "<br/>")}</div>`,
      };
    }

    const json = await resp.json();
    const content = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error("Empty Gemini response");

    const parsed = JSON.parse(content);
    return {
      text: parsed.text || rawMemorial,
      html: parsed.html || `<div>${rawMemorial.replace(/\n/g, "<br/>")}</div>`,
    };
  } catch (err) {
    console.error("Gemini formatting failed:", err);
    return {
      text: rawMemorial,
      html: `<div style="font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.8;">${rawMemorial.replace(/\n/g, "<br/>")}</div>`,
    };
  }
}

// ============================================================
// ACTION: generate — Gera memorial descritivo completo
// ============================================================

async function handleGenerate(ctx: RequestContext, input: MemorialInput) {
  // 1. Auto-calculate segments if not provided
  const vertices = input.vertices;
  let segments = input.boundary_segments;

  if (!segments || segments.length === 0) {
    // Auto-calculate from vertices (closed polygon)
    segments = [];
    for (let i = 0; i < vertices.length; i++) {
      const from = vertices[i];
      const to = vertices[(i + 1) % vertices.length];
      segments.push({
        from_vertex: from.label,
        to_vertex: to.label,
        azimuth_degrees: calcAzimuth(from.lat, from.lng, to.lat, to.lng),
        distance_m: calcDistance(from.lat, from.lng, to.lat, to.lng),
        confrontation: "proprietário",
      });
    }
  }

  // 2. Calculate perimeter from segments; area must be provided by user (Shoelace formula needs planar coords)
  const perimeter = input.perimeter_m || segments.reduce((sum, s) => sum + s.distance_m, 0);
  const totalArea = input.total_area_m2; // Buchecha fix P0: area MUST come from user input (geodesic calc)

  // 3. Build raw memorial text
  const datum = input.datum || DEFAULT_DATUM;
  const mc = input.meridiano_central || DEFAULT_MC;
  const vertexTable = buildVertexTable(vertices, datum, mc);
  const boundaryDesc = buildBoundaryDescription(segments, vertices);

  const rawMemorial = `${vertexTable}\n\nDESCRIÇÃO DO PERÍMETRO:\n\n` +
    `Inicia-se a descrição deste perímetro no vértice ${vertices[0]?.label || "V-01"}, ` +
    `de coordenadas geográficas ${formatDMS(vertices[0]?.lat || 0, true)} e ` +
    `${formatDMS(vertices[0]?.lng || 0, false)}; deste, segue confrontando com os limites descritos:\n\n` +
    `${boundaryDesc}\n\n` +
    `Fechando assim o perímetro do imóvel denominado "${input.property_name}", ` +
    `com área total de ${totalArea.toFixed(2)} m² (${(totalArea / 10000).toFixed(4)} ha) ` +
    `e perímetro de ${perimeter.toFixed(2)} m.`;

  // 4. Format with Gemini
  const formatted = await formatWithGemini(rawMemorial, { ...input, total_area_m2: totalArea, perimeter_m: perimeter });

  // 5. Technical data
  const technicalData = {
    datum,
    meridiano_central: mc,
    vertices: vertices.map((v) => ({
      label: v.label,
      lat: v.lat,
      lng: v.lng,
      utm_e: v.utm_e,
      utm_n: v.utm_n,
      utm_zone: v.utm_zone,
    })),
    segments: segments.map((s) => ({
      from: s.from_vertex,
      to: s.to_vertex,
      azimuth: s.azimuth_degrees,
      distance_m: s.distance_m,
      confrontation: s.confrontation,
    })),
    responsible_technician: input.responsible_technician,
    crea_cau: input.crea_cau,
    art_rrt: input.art_rrt,
    registration_number: input.registration_number,
    cns_code: input.cns_code,
    generated_at: new Date().toISOString(),
    lei_6015_73: true,
    lei_6766_79: true,
  };

  // 6. Save to database
  const { data: saved, error: saveError } = await ctx.supabase
    .from("development_memorial_descritivo")
    .insert({
      development_id: input.development_id,
      lot_id: input.lot_id || null,
      tenant_id: ctx.tenantId,
      property_name: input.property_name,
      municipality: input.municipality,
      state: input.state,
      comarca: input.comarca,
      owner_name: input.owner_name,
      owner_cpf_cnpj: input.owner_cpf_cnpj,
      total_area_m2: totalArea,
      perimeter_m: perimeter,
      vertex_count: vertices.length,
      memorial_text: formatted.text,
      memorial_html: formatted.html,
      technical_data: technicalData,
      status: "generated",
      created_by: ctx.userId,
    })
    .select("id, created_at")
    .maybeSingle();

  if (saveError) {
    return { error: { code: "DB_ERROR", message: saveError.message } };
  }

  return {
    data: {
      id: saved?.id,
      property_name: input.property_name,
      municipality: input.municipality,
      state: input.state,
      total_area_m2: totalArea,
      perimeter_m: perimeter,
      vertex_count: vertices.length,
      segment_count: segments.length,
      memorial_text: formatted.text,
      memorial_html: formatted.html,
      technical_data: technicalData,
      status: "generated",
      created_at: saved?.created_at,
    },
  };
}

// ============================================================
// ACTION: get_memorial — Retorna memorial por ID
// ============================================================

async function handleGetMemorial(ctx: RequestContext, params: { memorial_id: string }) {
  const { data, error } = await ctx.supabase
    .from("development_memorial_descritivo")
    .select("*")
    .eq("id", params.memorial_id)
    .maybeSingle();

  if (error) return { error: { code: "DB_ERROR", message: error.message } };
  if (!data) return { error: { code: "NOT_FOUND", message: "Memorial não encontrado" } };

  return { data };
}

// ============================================================
// ACTION: list_memorials — Lista memoriais de um development
// ============================================================

async function handleListMemorials(ctx: RequestContext, params: { development_id: string; limit?: number }) {
  const limit = Math.min(params.limit || 20, 50);

  const { data, error } = await ctx.supabase
    .from("development_memorial_descritivo")
    .select("id, property_name, municipality, state, total_area_m2, perimeter_m, vertex_count, status, created_at, updated_at")
    .eq("development_id", params.development_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { error: { code: "DB_ERROR", message: error.message } };

  return { data: { memorials: data || [], count: (data || []).length } };
}

// ============================================================
// Main handler
// ============================================================

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    const authHeader = req.headers.get("authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_ANON_KEY") || "",
      {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: authHeader } },
      },
    );

    // Buchecha fix P0: parse body ONCE to avoid double-consume of stream
    const body = await req.json();
    const { action, params } = body;

    // Check if service role call — compare full Bearer token (not substring)
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const isServiceRole = serviceRoleKey.length > 0 && authHeader === `Bearer ${serviceRoleKey}`;

    let userId = "";
    let tenantId = "";

    if (isServiceRole) {
      // Service role — trust the body for userId/tenantId
      userId = body.user_id || "service";
      tenantId = body.tenant_id || "";
    } else {
      // Extract token from Bearer header
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Não autenticado" } }), {
          status: 401,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
      userId = user.id;

      // Get tenant
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle();
      tenantId = profile?.tenant_id || user.id;
    }

    const ctx: RequestContext = { supabase, userId, tenantId };

    let result;
    switch (action) {
      case "generate":
        result = await handleGenerate(ctx, params);
        break;
      case "get_memorial":
        result = await handleGetMemorial(ctx, params);
        break;
      case "list_memorials":
        result = await handleListMemorials(ctx, params);
        break;
      default:
        result = { error: { code: "UNKNOWN_ACTION", message: `Ação desconhecida: ${action}` } };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("memorial-descritivo error:", err);
    return new Response(
      JSON.stringify({ error: { code: "INTERNAL_ERROR", message: String(err) } }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }
});
