/**
 * development-sicar-query v1
 *
 * Consulta o SICAR (Sistema de Cadastro Ambiental Rural) via GeoServer WFS nacional
 * para obter registros CAR que intersectam o polígono do desenvolvimento.
 * Extrai área de APP e Reserva Legal declaradas e persiste no cache.
 *
 * Actions:
 *   query_sicar    — Consulta SICAR e persiste resultados
 *   get_sicar      — Retorna dados SICAR cacheados do development
 *
 * API: https://geoserver.car.gov.br/geoserver/sicar/wfs (WFS OGC)
 * Layers disponíveis:
 *   sicar:area_imovel      — Polígono do imóvel rural (CAR)
 *   sicar:area_app         — Área de Preservação Permanente declarada
 *   sicar:reserva_legal    — Reserva Legal declarada
 *   sicar:vegetacao_nativa — Vegetação nativa remanescente
 *   sicar:uso_consolidado  — Uso consolidado (antropização antes de 2008)
 *
 * Sessão 119 — Fase 2 Parcelamento de Solo
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// CORS
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
function isOriginAllowed(origin: string) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS_RAW.length > 0) return ALLOWED_ORIGINS_RAW.includes(origin);
  return PROD_ORIGINS.includes(origin) || DEV_PATTERNS.some((re) => re.test(origin));
}
function corsHeaders(req: Request) {
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

interface BBox { south: number; north: number; west: number; east: number; }

interface SICARResult {
  layer_key: string;
  feature_count: number;
  area_m2_total: number;
  geojson: unknown;
  fetched_at: string;
  error?: string;
}

// ============================================================
// Helpers
// ============================================================

function bboxFromGeojson(geojson: unknown): BBox | null {
  try {
    const g = geojson as { type: string; coordinates: unknown };
    if (!g?.type || !g?.coordinates) return null;
    const coords: number[][] = [];
    function collect(c: unknown) {
      if (Array.isArray(c) && typeof c[0] === "number") coords.push(c as number[]);
      else if (Array.isArray(c)) c.forEach(collect);
    }
    collect(g.coordinates);
    if (coords.length === 0) return null;
    return {
      south: Math.min(...coords.map((c) => c[1])),
      north: Math.max(...coords.map((c) => c[1])),
      west:  Math.min(...coords.map((c) => c[0])),
      east:  Math.max(...coords.map((c) => c[0])),
    };
  } catch { return null; }
}

// Approximate area from bbox in m² (Haversine approximation)
function areaFromGeojsonFeature(feature: unknown): number {
  try {
    const f = feature as { geometry?: { type: string; coordinates: unknown } };
    if (!f?.geometry) return 0;
    // Simple bbox area as approximation (PostGIS has the precise calculation)
    const bbox = bboxFromGeojson(f.geometry);
    if (!bbox) return 0;
    const latMid = (bbox.north + bbox.south) / 2;
    const latDist = (bbox.north - bbox.south) * 111_000;
    const lonDist = (bbox.east - bbox.west) * 111_000 * Math.cos((latMid * Math.PI) / 180);
    return latDist * lonDist;
  } catch { return 0; }
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// ============================================================
// SICAR WFS fetch
// ============================================================

const SICAR_BASE = "https://geoserver.car.gov.br/geoserver/sicar/wfs";

const SICAR_LAYERS: Record<string, string> = {
  sicar_imovel:          "sicar:area_imovel",
  sicar_app:             "sicar:area_app",
  sicar_rl:              "sicar:reserva_legal",
  sicar_veg_nativa:      "sicar:vegetacao_nativa",
  sicar_uso_consolidado: "sicar:uso_consolidado",
};

async function fetchSICARLayer(
  layerKey: string, typeName: string, bbox: BBox, retries = 2
): Promise<SICARResult> {
  const bboxStr = `${bbox.west},${bbox.south},${bbox.east},${bbox.north},EPSG:4326`;
  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeName,
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    bbox: bboxStr,
    count: "200",
  });
  const url = `${SICAR_BASE}?${params}`;
  const fetchedAt = new Date().toISOString();

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(25_000),
        headers: { Accept: "application/json, application/geo+json" },
      });

      if (!res.ok) {
        if (attempt < retries) { await delay(1500 * (attempt + 1)); continue; }
        return { layer_key: layerKey, feature_count: 0, area_m2_total: 0, geojson: null, fetched_at: fetchedAt, error: `HTTP ${res.status}` };
      }

      const text = await res.text();
      let geojson: unknown;
      try { geojson = JSON.parse(text); }
      catch { geojson = { type: "FeatureCollection", features: [], _raw_xml: text.substring(0, 200) }; }

      const fc = geojson as { features?: unknown[] };
      const features = fc?.features ?? [];
      const area_m2_total = features.reduce((sum, f) => sum + areaFromGeojsonFeature(f), 0);

      return {
        layer_key: layerKey,
        feature_count: features.length,
        area_m2_total: Math.round(area_m2_total),
        geojson,
        fetched_at: fetchedAt,
      };
    } catch (err) {
      if (attempt < retries) { await delay(1500 * (attempt + 1)); continue; }
      return { layer_key: layerKey, feature_count: 0, area_m2_total: 0, geojson: null, fetched_at: fetchedAt, error: String(err) };
    }
  }
  return { layer_key: layerKey, feature_count: 0, area_m2_total: 0, geojson: null, fetched_at: fetchedAt, error: "Max retries exceeded" };
}

// ============================================================
// Main handler
// ============================================================

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader  = req.headers.get("authorization");

  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const action = (body.action as string) || "query_sicar";
  const { development_id } = body as { development_id: string };

  if (!development_id) {
    return new Response(JSON.stringify({ error: "development_id required" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // ——————————————
  // ACTION: get_sicar
  // ——————————————
  if (action === "get_sicar") {
    const { data, error } = await supabase
      .from("development_parcelamento_geo_layers")
      .select("id, layer_key, feature_count, fetched_at, geojson")
      .eq("development_id", development_id)
      .like("layer_key", "sicar_%")
      .eq("is_active", true)
      .order("fetched_at", { ascending: false });

    if (error) return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });

    return new Response(JSON.stringify({ data }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // ——————————————
  // ACTION: query_sicar
  // ——————————————
  if (action !== "query_sicar") {
    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Load development
  const { data: dev, error: devErr } = await supabase
    .from("developments")
    .select("id, tenant_id, geometry, bbox, area_m2")
    .eq("id", development_id)
    .maybeSingle();

  if (devErr || !dev) {
    return new Response(JSON.stringify({ error: devErr?.message ?? "Not found" }), {
      status: 404, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Determine bbox
  let bbox: BBox | null = null;
  if (dev.bbox) bbox = dev.bbox as BBox;
  if (!bbox && dev.geometry) bbox = bboxFromGeojson(dev.geometry);
  if (!bbox && body.bbox) bbox = body.bbox as BBox;

  if (!bbox) {
    return new Response(
      JSON.stringify({ error: "No geometry available. Upload KML/KMZ first." }),
      { status: 422, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  // Fetch all SICAR layers in parallel
  const requestedKeys = (body.layers as string[] | undefined) ?? Object.keys(SICAR_LAYERS);
  const validKeys = requestedKeys.filter((k) => k in SICAR_LAYERS);

  const results = await Promise.all(
    validKeys.map((key) => fetchSICARLayer(key, SICAR_LAYERS[key], bbox!))
  );

  // Soft-delete old SICAR entries
  await supabase
    .from("development_parcelamento_geo_layers")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("development_id", development_id)
    .in("layer_key", validKeys);

  const tenantId = dev.tenant_id as string;

  // Insert new results
  const insertRows = results
    .filter((r) => r.geojson !== null)
    .map((r) => ({
      development_id,
      tenant_id: tenantId,
      layer_key: r.layer_key,
      geojson: r.geojson,
      feature_count: r.feature_count,
      fetched_at: r.fetched_at,
      is_active: true,
    }));

  if (insertRows.length > 0) {
    await supabase.from("development_parcelamento_geo_layers").insert(insertRows);
  }

  // Persist RL and APP summary to developments and rl_cache
  const appResult   = results.find((r) => r.layer_key === "sicar_app");
  const rlResult    = results.find((r) => r.layer_key === "sicar_rl");
  const devAreaM2   = (dev.area_m2 as number) || 0;

  const appAreaM2 = appResult?.area_m2_total ?? 0;
  const rlAreaM2  = rlResult?.area_m2_total ?? 0;
  const rlPct     = devAreaM2 > 0 ? (rlAreaM2 / devAreaM2) * 100 : 0;

  // Update developments with RL/APP data
  await supabase
    .from("developments")
    .update({
      app_area_m2: appAreaM2,
      reserva_legal_area_m2: rlAreaM2,
      reserva_legal_pct: Math.round(rlPct * 100) / 100,
      reserva_legal_source: "sicar",
      updated_at: new Date().toISOString(),
    })
    .eq("id", development_id);

  // Persist to rl_cache (global, no tenant)
  if (rlAreaM2 > 0 || appAreaM2 > 0) {
    const bboxHash = `${bbox.south.toFixed(4)},${bbox.north.toFixed(4)},${bbox.west.toFixed(4)},${bbox.east.toFixed(4)}`;
    await supabase
      .from("development_parcelamento_rl_cache")
      .upsert({
        bbox_hash: bboxHash,
        bbox_json: bbox,
        source: "sicar",
        app_area_m2: appAreaM2,
        rl_area_m2: rlAreaM2,
        rl_pct: Math.round(rlPct * 100) / 100,
        raw_data: { results: results.map((r) => ({ key: r.layer_key, count: r.feature_count })) },
        cached_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      }, { onConflict: "bbox_hash,source" })
      .select();
  }

  const summary = results.map((r) => ({
    layer_key: r.layer_key,
    feature_count: r.feature_count,
    area_m2: r.area_m2_total,
    ok: !r.error,
    error: r.error,
  }));

  return new Response(
    JSON.stringify({
      ok: true,
      development_id,
      sicar: {
        app_area_m2: appAreaM2,
        rl_area_m2: rlAreaM2,
        rl_pct: Math.round(rlPct * 100) / 100,
      },
      layers: summary,
    }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
  );
});
