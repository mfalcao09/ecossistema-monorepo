/**
 * development-bdgd-proximity
 *
 * Retorna features BDGD (MT/BT/Subestações) próximas a um terreno de
 * parcelamento, com auto-fallback Tier 1 (índice nacional simplificado) →
 * Tier 2 (alta precisão por projeto, quando carregada).
 *
 * Input:
 *   { development_id: UUID, buffer_km?: number = 10, layers?: ('mt'|'bt'|'sub')[] }
 *
 * Output:
 *   {
 *     ok, source_tier: 't1'|'t2'|'mixed',
 *     hd_loaded: boolean, hd_loaded_at, hd_buffer_km,
 *     stats: { mt_count, bt_count, sub_count, mt_length_m, bt_length_m },
 *     features: { mt: GeoJSON.FeatureCollection, bt, sub }
 *   }
 *
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// CORS
// ============================================================
const ALLOWED_ORIGINS_RAW = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((o: string) => o.trim())
  .filter(Boolean);

const DEV_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https:\/\/intentus-plataform-.+\.vercel\.app$/,
  /^https:\/\/hom\.intentusrealestate\.com\.br$/,
  /^https:\/\/.+-mfalcao09s-projects\.vercel\.app$/,
];
const PROD_ORIGINS = [
  "https://intentus-plataform.vercel.app",
  "https://app.intentusrealestate.com.br",
  "https://hom.intentusrealestate.com.br",
];

function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS_RAW.length > 0)
    return ALLOWED_ORIGINS_RAW.includes(origin);
  return (
    PROD_ORIGINS.includes(origin) || DEV_PATTERNS.some((re) => re.test(origin))
  );
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": isOriginAllowed(origin) ? origin : "",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

// ============================================================
// Handler
// ============================================================

interface ProximityRow {
  layer: "mt" | "bt" | "sub";
  source_tier: "t1" | "t2";
  distribuidora: string;
  cod_aneel: string;
  cod_id: string | null;
  tensao: string | null;
  ctmt_nome: string | null; // P-193 — nome humano do alimentador MT
  ctmt_cod_id: string | null; // P-193 — código do alimentador (FK CTMT)
  ctmt_energia_anual_kwh: number | null; // P-195 — consumo anual no alimentador
  fases: string | null;
  comprimento_buffer_m: number | null;
  geom_geojson: GeoJSON.Geometry | null;
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const auth = req.headers.get("authorization");
  if (!auth) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const developmentId = body.development_id as string | undefined;
  const bufferKm = Number(body.buffer_km ?? 10);
  const layersFilter = (body.layers as string[] | undefined) ?? [
    "mt",
    "bt",
    "sub",
  ];
  if (!developmentId) {
    return new Response(JSON.stringify({ error: "development_id required" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Lê metadata Tier 2 do development
  const { data: dev } = await supabase
    .from("developments")
    .select("id, bdgd_hd_loaded_at, bdgd_hd_buffer_km, bdgd_hd_status")
    .eq("id", developmentId)
    .maybeSingle();

  // RPC retorna features com source_tier marcado
  const { data, error } = await supabase.rpc("bdgd_proximity_for_development", {
    p_development_id: developmentId,
    p_buffer_km: bufferKm,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const rows = (data ?? []) as ProximityRow[];
  const tiers = new Set(rows.map((r) => r.source_tier));
  const sourceTier = tiers.size === 1 ? Array.from(tiers)[0] : "mixed";

  // Agrupa por layer pra FeatureCollection
  const grouped: Record<string, GeoJSON.Feature[]> = {
    mt: [],
    bt: [],
    sub: [],
  };
  const stats = {
    mt_count: 0,
    bt_count: 0,
    sub_count: 0,
    mt_length_m: 0,
    bt_length_m: 0,
  };
  for (const r of rows) {
    if (!layersFilter.includes(r.layer)) continue;
    if (!r.geom_geojson) continue;
    grouped[r.layer].push({
      type: "Feature",
      properties: {
        distribuidora: r.distribuidora,
        cod_aneel: r.cod_aneel,
        cod_id: r.cod_id,
        tensao: r.tensao,
        ctmt_nome: r.ctmt_nome, // P-193
        ctmt_cod_id: r.ctmt_cod_id, // P-193
        ctmt_energia_anual_kwh: r.ctmt_energia_anual_kwh, // P-195
        fases: r.fases,
        comprimento_buffer_m: r.comprimento_buffer_m,
        source_tier: r.source_tier,
      },
      geometry: r.geom_geojson,
    });
    if (r.layer === "mt") {
      stats.mt_count++;
      stats.mt_length_m += Number(r.comprimento_buffer_m ?? 0);
    } else if (r.layer === "bt") {
      stats.bt_count++;
      stats.bt_length_m += Number(r.comprimento_buffer_m ?? 0);
    } else {
      stats.sub_count++;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      source_tier: sourceTier,
      hd_loaded: !!dev?.bdgd_hd_loaded_at,
      hd_loaded_at: dev?.bdgd_hd_loaded_at ?? null,
      hd_buffer_km: dev?.bdgd_hd_buffer_km ?? null,
      hd_status: dev?.bdgd_hd_status ?? "idle",
      buffer_km: bufferKm,
      stats,
      features: {
        mt: { type: "FeatureCollection", features: grouped.mt },
        bt: { type: "FeatureCollection", features: grouped.bt },
        sub: { type: "FeatureCollection", features: grouped.sub },
      },
    }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
