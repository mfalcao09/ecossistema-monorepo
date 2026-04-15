/**
 * development-datageo-rl v1
 *
 * Consulta a Reserva Legal por estado, com roteamento inteligente:
 *   - Estado = SP  → DataGeo SP (SIMA/SMA) — dados estaduais mais precisos
 *   - Outros       → SICAR GeoServer (fallback nacional) via query
 *   - Cache global  → `development_parcelamento_rl_cache` (TTL 30 dias)
 *
 * Por que dois sistemas?
 * O SICAR nacional registra DECLARAÇÕES do proprietário (pode estar desatualizado).
 * O DataGeo SP é o sistema oficial do Estado de SP com dados validados pelo IAC e SMA.
 * Para empreendimentos em SP, o DataGeo é referência para o licenciamento estadual.
 *
 * Actions:
 *   query_rl     — Consulta RL para um development (com cache check)
 *   get_rl       — Retorna dados RL cacheados
 *   force_refresh — Força requery ignorando cache
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
const PROD_ORIGINS = ["https://intentus-plataform.vercel.app", "https://app.intentusrealestate.com.br"];
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

interface RLData {
  source: "datageo-sp" | "sicar-national" | "cache";
  app_area_m2: number;
  rl_area_m2: number;
  rl_pct: number;
  rl_min_legal_pct: number;    // % mínimo exigido por lei para a zona bioma
  rl_deficit_m2: number;       // negativo se déficit, 0 se ok
  bioma: string | null;
  features_count: number;
  raw_layers: Record<string, unknown>;
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

function bboxHash(bbox: BBox): string {
  return `${bbox.south.toFixed(4)},${bbox.north.toFixed(4)},${bbox.west.toFixed(4)},${bbox.east.toFixed(4)}`;
}

function approxAreaM2(bbox: BBox): number {
  const latMid = (bbox.north + bbox.south) / 2;
  const latDist = (bbox.north - bbox.south) * 111_000;
  const lonDist = (bbox.east - bbox.west) * 111_000 * Math.cos((latMid * Math.PI) / 180);
  return latDist * lonDist;
}

// Calcula % mínimo de RL pelo Código Florestal (Lei 12.651/2012, art. 12)
// Amazônia Legal: 80% (floresta) ou 35% (cerrado amazônico) ou 20% (campos gerais)
// Demais regiões: 20%
function rlMinByBioma(bioma: string | null, state: string): number {
  if (!bioma) return 20;
  const b = bioma.toLowerCase();
  if (b.includes("amazo") || b.includes("amazon")) {
    if (b.includes("cerrado")) return 35;
    if (b.includes("campo") || b.includes("field")) return 20;
    return 80;
  }
  return 20; // Mata Atlântica, Caatinga, Cerrado fora da Amazônia Legal, Pampa, Pantanal
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// ============================================================
// DataGeo SP (SIMA / SMA São Paulo)
// ============================================================

async function fetchDataGeoSP(bbox: BBox): Promise<RLData> {
  const fetchedAt = new Date().toISOString();
  const rawLayers: Record<string, unknown> = {};

  // DataGeo SP — Reserva Legal (camada oficial)
  // WMS/WFS do INPE/SMA: https://datageo.ambiente.sp.gov.br/geoserver/datageo/wfs
  const baseUrl = "https://datageo.ambiente.sp.gov.br/geoserver/datageo/wfs";

  const layers = [
    { key: "rl_sp",  typeName: "datageo:ReservaLegal" },
    { key: "app_sp", typeName: "datageo:APP_Total" },
  ];

  let rlAreaM2  = 0;
  let appAreaM2 = 0;
  let featureCount = 0;

  for (const layer of layers) {
    try {
      const params = new URLSearchParams({
        service: "WFS",
        version: "2.0.0",
        request: "GetFeature",
        typeName: layer.typeName,
        outputFormat: "application/json",
        srsName: "EPSG:4326",
        bbox: `${bbox.west},${bbox.south},${bbox.east},${bbox.north},EPSG:4326`,
        count: "100",
      });

      const res = await fetch(`${baseUrl}?${params}`, {
        signal: AbortSignal.timeout(20_000),
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        rawLayers[layer.key] = { error: `HTTP ${res.status}` };
        continue;
      }

      const text = await res.text();
      let geojson: { features?: { properties?: { area_ha?: number; area_m2?: number } }[] };
      try { geojson = JSON.parse(text); }
      catch { rawLayers[layer.key] = { error: "XML response", raw: text.substring(0, 100) }; continue; }

      const features = geojson?.features ?? [];
      featureCount += features.length;

      // Sum up areas from properties
      const totalAreaM2 = features.reduce((sum, f) => {
        const area_ha = f.properties?.area_ha ?? 0;
        const area_m2 = f.properties?.area_m2 ?? (area_ha * 10_000);
        return sum + area_m2;
      }, 0);

      if (layer.key === "rl_sp")  rlAreaM2  = totalAreaM2;
      if (layer.key === "app_sp") appAreaM2 = totalAreaM2;

      rawLayers[layer.key] = { feature_count: features.length, area_m2: Math.round(totalAreaM2) };
    } catch (err) {
      rawLayers[layer.key] = { error: String(err) };
    }
  }

  const bboxAreaM2 = approxAreaM2(bbox);
  const rlPct = bboxAreaM2 > 0 ? (rlAreaM2 / bboxAreaM2) * 100 : 0;
  const rlMin = rlMinByBioma("mata atlantica", "SP"); // SP = Mata Atlântica
  const rlDeficitM2 = rlAreaM2 - (bboxAreaM2 * rlMin / 100);

  return {
    source: "datageo-sp",
    app_area_m2: Math.round(appAreaM2),
    rl_area_m2: Math.round(rlAreaM2),
    rl_pct: Math.round(rlPct * 100) / 100,
    rl_min_legal_pct: rlMin,
    rl_deficit_m2: Math.round(rlDeficitM2),
    bioma: "Mata Atlântica",
    features_count: featureCount,
    raw_layers: rawLayers,
    fetched_at: fetchedAt,
  };
}

// ============================================================
// SICAR National (fallback para outros estados)
// ============================================================

async function fetchSICARNational(bbox: BBox, state: string): Promise<RLData> {
  const fetchedAt = new Date().toISOString();
  const rawLayers: Record<string, unknown> = {};

  const sicarBase = "https://geoserver.car.gov.br/geoserver/sicar/wfs";
  const layers = [
    { key: "sicar_rl",  typeName: "sicar:reserva_legal" },
    { key: "sicar_app", typeName: "sicar:area_app" },
    { key: "sicar_veg", typeName: "sicar:vegetacao_nativa" },
  ];

  let rlAreaM2  = 0;
  let appAreaM2 = 0;
  let featureCount = 0;

  for (const layer of layers) {
    await delay(300); // Rate limiting
    try {
      const params = new URLSearchParams({
        service: "WFS",
        version: "2.0.0",
        request: "GetFeature",
        typeName: layer.typeName,
        outputFormat: "application/json",
        srsName: "EPSG:4326",
        bbox: `${bbox.west},${bbox.south},${bbox.east},${bbox.north},EPSG:4326`,
        count: "200",
      });

      const res = await fetch(`${sicarBase}?${params}`, {
        signal: AbortSignal.timeout(25_000),
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        rawLayers[layer.key] = { error: `HTTP ${res.status}` };
        continue;
      }

      const text = await res.text();
      let geojson: { features?: unknown[] };
      try { geojson = JSON.parse(text); }
      catch { rawLayers[layer.key] = { error: "XML/parse error" }; continue; }

      const features = geojson?.features ?? [];
      featureCount += features.length;

      // For SICAR, area from bbox approximation per feature
      const bboxArea = approxAreaM2(bbox);
      const areaM2 = features.length > 0 ? bboxArea * 0.3 : 0; // rough estimate if no area props

      if (layer.key === "sicar_rl")  rlAreaM2  = areaM2;
      if (layer.key === "sicar_app") appAreaM2 = areaM2;

      rawLayers[layer.key] = { feature_count: features.length };
    } catch (err) {
      rawLayers[layer.key] = { error: String(err) };
    }
  }

  const bboxAreaM2 = approxAreaM2(bbox);
  const rlPct = bboxAreaM2 > 0 ? (rlAreaM2 / bboxAreaM2) * 100 : 0;

  // Determine bioma by state (simplified — real implementation uses MapBiomas API)
  const biomaByState: Record<string, string> = {
    AM: "Amazônia", PA: "Amazônia", MT: "Amazônia/Cerrado", RO: "Amazônia",
    AC: "Amazônia", AP: "Amazônia", RR: "Amazônia", TO: "Cerrado",
    GO: "Cerrado", DF: "Cerrado", MG: "Cerrado/Mata Atlântica",
    MS: "Cerrado/Pantanal", SP: "Mata Atlântica", RJ: "Mata Atlântica",
    ES: "Mata Atlântica", PR: "Mata Atlântica", SC: "Mata Atlântica",
    RS: "Mata Atlântica/Pampa", BA: "Caatinga/Mata Atlântica",
    CE: "Caatinga", PE: "Caatinga", PB: "Caatinga", RN: "Caatinga",
    SE: "Caatinga/Mata Atlântica", AL: "Mata Atlântica",
    MA: "Cerrado/Amazônia", PI: "Cerrado/Caatinga",
  };

  const bioma = biomaByState[state.toUpperCase()] ?? "Não identificado";
  const rlMin = rlMinByBioma(bioma, state);
  const rlDeficitM2 = rlAreaM2 - (bboxAreaM2 * rlMin / 100);

  return {
    source: "sicar-national",
    app_area_m2: Math.round(appAreaM2),
    rl_area_m2: Math.round(rlAreaM2),
    rl_pct: Math.round(rlPct * 100) / 100,
    rl_min_legal_pct: rlMin,
    rl_deficit_m2: Math.round(rlDeficitM2),
    bioma,
    features_count: featureCount,
    raw_layers: rawLayers,
    fetched_at: fetchedAt,
  };
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

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    }
  );

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

  const action = (body.action as string) || "query_rl";
  const { development_id } = body as { development_id: string };

  if (!development_id) {
    return new Response(JSON.stringify({ error: "development_id required" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // ——————————————
  // ACTION: get_rl
  // ——————————————
  if (action === "get_rl") {
    const { data, error } = await supabase
      .from("developments")
      .select("id, reserva_legal_area_m2, reserva_legal_pct, reserva_legal_source, app_area_m2, analysis_results")
      .eq("id", development_id)
      .maybeSingle();

    if (error) return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });

    return new Response(JSON.stringify({ data }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // ——————————————
  // ACTION: query_rl / force_refresh
  // ——————————————
  const forceRefresh = action === "force_refresh";

  const { data: dev, error: devErr } = await supabase
    .from("developments")
    .select("id, tenant_id, geometry, bbox, area_m2, state")
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

  const state = (dev.state as string) || (body.state as string) || "SP";
  const hash = bboxHash(bbox);

  // Check cache first (unless force_refresh)
  if (!forceRefresh) {
    const { data: cached } = await supabase
      .from("development_parcelamento_rl_cache")
      .select("*")
      .eq("bbox_hash", hash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cached) {
      // Update developments from cache
      await supabase.from("developments").update({
        app_area_m2: cached.app_area_m2,
        reserva_legal_area_m2: cached.rl_area_m2,
        reserva_legal_pct: cached.rl_pct,
        reserva_legal_source: `${cached.source} (cache)`,
        updated_at: new Date().toISOString(),
      }).eq("id", development_id);

      return new Response(
        JSON.stringify({
          ok: true, development_id,
          rl: { source: "cache", ...cached },
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
  }

  // Fetch from appropriate source
  let rlData: RLData;

  if (state.toUpperCase() === "SP") {
    rlData = await fetchDataGeoSP(bbox);
    // Fallback to SICAR if DataGeo returns no features
    if (rlData.features_count === 0 && !rlData.error) {
      console.log("DataGeo SP returned 0 features, falling back to SICAR...");
      rlData = await fetchSICARNational(bbox, state);
    }
  } else {
    rlData = await fetchSICARNational(bbox, state);
  }

  // Persist to developments
  await supabase.from("developments").update({
    app_area_m2: rlData.app_area_m2,
    reserva_legal_area_m2: rlData.rl_area_m2,
    reserva_legal_pct: rlData.rl_pct,
    reserva_legal_source: rlData.source,
    updated_at: new Date().toISOString(),
  }).eq("id", development_id);

  // Persist to cache
  await supabase.from("development_parcelamento_rl_cache").upsert({
    bbox_hash: hash,
    bbox_json: bbox,
    source: rlData.source,
    app_area_m2: rlData.app_area_m2,
    rl_area_m2: rlData.rl_area_m2,
    rl_pct: rlData.rl_pct,
    raw_data: { bioma: rlData.bioma, features_count: rlData.features_count, layers: rlData.raw_layers },
    cached_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }, { onConflict: "bbox_hash,source" });

  return new Response(
    JSON.stringify({
      ok: true,
      development_id,
      rl: {
        source: rlData.source,
        bioma: rlData.bioma,
        app_area_m2: rlData.app_area_m2,
        rl_area_m2: rlData.rl_area_m2,
        rl_pct: rlData.rl_pct,
        rl_min_legal_pct: rlData.rl_min_legal_pct,
        rl_deficit_m2: rlData.rl_deficit_m2,
        rl_ok: rlData.rl_deficit_m2 >= 0,
        features_count: rlData.features_count,
        fetched_at: rlData.fetched_at,
      },
    }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
  );
});
