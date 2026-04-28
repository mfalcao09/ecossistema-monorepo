/**
 * development-geo-layers v4
 *
 * Busca camadas geoespaciais para terrenos de parcelamento de solo.
 * Persiste cache em `development_parcelamento_geo_layers`.
 *
 * v4 (sessão 155 — P-191): camada `aneel_dup` adicionada via SIGEL ANEEL
 * FeatureServer (`DadosAbertos/DUP/FeatureServer/0`). Polígonos de servidão
 * administrativa (Declaração de Utilidade Pública) cobrindo BR inteiro.
 * Schema: `EMPREEM`, `ATO_LEGAL`, `Tensao` (kV), `MODALIDADE`, `STATUS_TEXT`.
 * `fetchEPELayer` refatorada em `fetchArcGISLayer` genérica reusável.
 *
 * v3 (sessão 153 — ANEEL/EPE): camadas oficiais de transmissão via EPE
 * ArcGIS REST (https://gisepeprd2.epe.gov.br) — schema `Tensao` (kV),
 * `Concession` (proprietário), `Ano_Opera`, `Extensao` (km). Substitui
 * Overpass `power=line` (que não tinha tensão nem proprietário) para a
 * UI do parcelamento; legacy `linhas_transmissao` mantido por compat.
 *
 * v2: Migrou de WFS governamentais (instáveis) para Overpass API (OSM)
 * como fonte primária para hidrografia, rodovias.
 *
 * Actions:
 *   fetch_layers   — Busca e cacheia todas as camadas solicitadas
 *   get_layers     — Retorna camadas já cacheadas do development
 *   invalidate     — Limpa cache de uma ou todas as camadas
 *
 * Fontes (v3):
 *   SIGEF (INCRA)         : Overpass API (boundary=cadastral) + fallback vazio
 *   Hidrografia (IBGE)    : Overpass API (waterway=river|stream|canal)
 *   IBAMA UCs             : Overpass API (boundary=protected_area) + fallback vazio
 *   Rodovias (DNIT)       : Overpass API (highway=trunk|primary|secondary)
 *   Linhas Transmissão    : Overpass API (power=line) — LEGACY
 *   ANEEL LT Existentes   : EPE WMS_Webmap_EPE/MapServer/21 — OFICIAL
 *   ANEEL LT Planejadas   : EPE WMS_Webmap_EPE/MapServer/10 — OFICIAL
 *   ANEEL Subestações     : EPE WMS_Webmap_EPE/MapServer/20 — OFICIAL
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
  // Preview/staging do monorepo Vercel — qualquer subdomínio hom.* do Intentus
  /^https:\/\/hom\.intentusrealestate\.com\.br$/,
  // Vercel preview deploys do monorepo (branches)
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
// Types
// ============================================================

interface BBox {
  south: number;
  north: number;
  west: number;
  east: number;
}

interface GeoJSONFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: {
    type: string;
    coordinates: unknown;
  };
}

interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

interface LayerResult {
  layer_key: string;
  source_url: string;
  geojson: GeoJSONFeatureCollection | null;
  feature_count: number;
  fetched_at: string;
  error?: string;
}

// ============================================================
// Overpass API helper
// ============================================================

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
];

/**
 * Converte elementos Overpass (way com geometry) para GeoJSON FeatureCollection.
 */
function overpassToGeoJSON(elements: unknown[]): GeoJSONFeatureCollection {
  const features: GeoJSONFeature[] = [];

  for (const elem of elements) {
    const e = elem as {
      type: string;
      id: number;
      tags?: Record<string, string>;
      geometry?: { lat: number; lon: number }[];
      bounds?: {
        minlat: number;
        minlon: number;
        maxlat: number;
        maxlon: number;
      };
      members?: {
        type: string;
        ref: number;
        role: string;
        geometry?: { lat: number; lon: number }[];
      }[];
    };

    if (!e.tags) continue;

    if (e.type === "way" && e.geometry && e.geometry.length > 0) {
      const coords = e.geometry.map((p) => [p.lon, p.lat]);
      // Detectar se é polígono (primeiro == último ponto) ou linha
      const isPolygon =
        coords.length >= 4 &&
        coords[0][0] === coords[coords.length - 1][0] &&
        coords[0][1] === coords[coords.length - 1][1];

      features.push({
        type: "Feature",
        properties: { ...e.tags, osm_id: e.id },
        geometry: isPolygon
          ? { type: "Polygon", coordinates: [coords] }
          : { type: "LineString", coordinates: coords },
      });
    } else if (e.type === "relation" && e.members) {
      // Relações: extrair geometria dos membros outer
      const outerCoords: [number, number][][] = [];
      for (const member of e.members) {
        if (member.role === "outer" && member.geometry) {
          outerCoords.push(member.geometry.map((p) => [p.lon, p.lat]));
        }
      }
      if (outerCoords.length > 0) {
        features.push({
          type: "Feature",
          properties: { ...e.tags, osm_id: e.id },
          geometry:
            outerCoords.length === 1
              ? { type: "Polygon", coordinates: outerCoords }
              : {
                  type: "MultiPolygon",
                  coordinates: outerCoords.map((ring) => [ring]),
                },
        });
      }
    }
  }

  return { type: "FeatureCollection", features };
}

/**
 * Executa query Overpass com retry em múltiplos mirrors.
 */
async function queryOverpass(
  query: string,
  layerKey: string,
  timeoutMs = 25_000,
): Promise<LayerResult> {
  const fetchedAt = new Date().toISOString();

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        // Se é rate limit ou server busy, tentar próximo mirror
        if (
          res.status === 429 ||
          res.status === 504 ||
          text.includes("too busy")
        ) {
          console.log(
            `[${layerKey}] ${endpoint} busy (${res.status}), trying next...`,
          );
          continue;
        }
        return {
          layer_key: layerKey,
          source_url: endpoint,
          geojson: null,
          feature_count: 0,
          fetched_at: fetchedAt,
          error: `HTTP ${res.status}: ${text.substring(0, 100)}`,
        };
      }

      const contentType = res.headers.get("content-type") || "";
      const text = await res.text();

      // Overpass pode retornar HTML de erro mesmo com 200
      if (
        contentType.includes("html") ||
        (text.includes("Error") && text.includes("runtime error"))
      ) {
        console.log(
          `[${layerKey}] ${endpoint} returned error HTML, trying next...`,
        );
        continue;
      }

      const data = JSON.parse(text);
      const elements = data?.elements || [];
      const geojson = overpassToGeoJSON(elements);

      return {
        layer_key: layerKey,
        source_url: endpoint,
        geojson,
        feature_count: geojson.features.length,
        fetched_at: fetchedAt,
      };
    } catch (err) {
      console.log(`[${layerKey}] ${endpoint} failed: ${err}`);
      continue;
    }
  }

  // Todos os mirrors falharam — retorna FeatureCollection vazia (não null)
  // para que o cache seja populado e evite re-tentativas constantes
  return {
    layer_key: layerKey,
    source_url: OVERPASS_ENDPOINTS[0],
    geojson: { type: "FeatureCollection", features: [] },
    feature_count: 0,
    fetched_at: fetchedAt,
    error: "All Overpass mirrors unavailable — empty result cached",
  };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================================
// Layer fetchers (Overpass-based)
// ============================================================

function buildOverpassQuery(bbox: BBox, filters: string, timeout = 20): string {
  // Overpass bbox format: south,west,north,east
  const b = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  return `[out:json][timeout:${timeout}];(${filters.replace(/{BBOX}/g, b)});out geom;`;
}

async function fetchSIGEF(bbox: BBox): Promise<LayerResult> {
  // SIGEF = imóveis certificados INCRA. No OSM: boundary=cadastral ou landuse
  // Expandir bbox em 50% para pegar propriedades vizinhas
  const expanded = expandBbox(bbox, 0.5);
  const query = buildOverpassQuery(
    expanded,
    `
    way["boundary"="cadastral"]({BBOX});
    relation["boundary"="cadastral"]({BBOX});
    way["landuse"~"farmland|farm"]({BBOX});
  `,
  );
  return queryOverpass(query, "sigef_privado");
}

async function fetchHidrografia(bbox: BBox): Promise<LayerResult> {
  // Hidrografia: rios, córregos, canais
  const expanded = expandBbox(bbox, 0.3);
  const query = buildOverpassQuery(
    expanded,
    `
    way["waterway"~"river|stream|canal|drain|ditch"]({BBOX});
    way["natural"="water"]({BBOX});
    relation["natural"="water"]({BBOX});
  `,
  );
  return queryOverpass(query, "hidrografia");
}

async function fetchIBAMAUC(bbox: BBox): Promise<LayerResult> {
  // Unidades de Conservação: boundary=protected_area ou leisure=nature_reserve
  const expanded = expandBbox(bbox, 1.0); // Expandir mais — UCs são grandes
  const query = buildOverpassQuery(
    expanded,
    `
    way["boundary"="protected_area"]({BBOX});
    relation["boundary"="protected_area"]({BBOX});
    way["leisure"="nature_reserve"]({BBOX});
    relation["leisure"="nature_reserve"]({BBOX});
  `,
    25,
  );
  return queryOverpass(query, "ibama_uc");
}

async function fetchRodovias(bbox: BBox): Promise<LayerResult> {
  // Rodovias federais e estaduais
  const expanded = expandBbox(bbox, 0.5);
  const query = buildOverpassQuery(
    expanded,
    `
    way["highway"~"trunk|primary|secondary|motorway"]({BBOX});
  `,
  );
  return queryOverpass(query, "rodovias_federais");
}

async function fetchLinhasTransmissao(bbox: BBox): Promise<LayerResult> {
  // Linhas de transmissão elétrica
  const expanded = expandBbox(bbox, 0.5);
  const query = buildOverpassQuery(
    expanded,
    `
    way["power"="line"]({BBOX});
    way["power"="minor_line"]({BBOX});
  `,
  );
  return queryOverpass(query, "linhas_transmissao");
}

// ============================================================
// EPE ArcGIS REST helpers (LT Existentes/Planejadas + Subestações)
// ============================================================

/**
 * Buffer absoluto em graus — ~0.1° equivale a ~11km em latitude no centro
 * do Brasil. Usado para ANEEL/EPE pra cobrir o raio de 10km solicitado pelo
 * Marcelo (briefing parcelamento Bloco H — proximidade de servidão).
 */
function expandBboxByDegrees(bbox: BBox, deltaDeg: number): BBox {
  return {
    south: bbox.south - deltaDeg,
    north: bbox.north + deltaDeg,
    west: bbox.west - deltaDeg,
    east: bbox.east + deltaDeg,
  };
}

const EPE_MAPSERVER_URL =
  "https://gisepeprd2.epe.gov.br/arcgis/rest/services/SMA/WMS_Webmap_EPE/MapServer";

const SIGEL_DUP_URL =
  "https://sigel.aneel.gov.br/arcgis/rest/services/DadosAbertos/DUP/FeatureServer";

/**
 * Query genérica em qualquer Layer ArcGIS REST (MapServer/FeatureServer)
 * retornando GeoJSON. Suporta timeout 25s e graceful fallback (FC vazio).
 *
 * `sourceLabel` aparece nas mensagens de erro ("EPE HTTP 500..." vs
 * "SIGEL HTTP 500...") pra debugar de qual servidor veio a falha.
 */
async function fetchArcGISLayer(
  baseUrl: string,
  layerId: number,
  layerKey: string,
  bbox: BBox,
  bufferDeg = 0.1,
  timeoutMs = 25_000,
  sourceLabel = "ArcGIS",
): Promise<LayerResult> {
  const fetchedAt = new Date().toISOString();
  const expanded = expandBboxByDegrees(bbox, bufferDeg);

  const geometry = JSON.stringify({
    xmin: expanded.west,
    ymin: expanded.south,
    xmax: expanded.east,
    ymax: expanded.north,
    spatialReference: { wkid: 4326 },
  });

  const params = new URLSearchParams({
    where: "1=1",
    geometry,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "*",
    outSR: "4326",
    returnGeometry: "true",
    f: "geojson",
  });

  const url = `${baseUrl}/${layerId}/query?${params.toString()}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        layer_key: layerKey,
        source_url: url,
        geojson: { type: "FeatureCollection", features: [] },
        feature_count: 0,
        fetched_at: fetchedAt,
        error: `${sourceLabel} HTTP ${res.status}: ${text.substring(0, 100)}`,
      };
    }

    const text = await res.text();

    if (text.startsWith("<") || text.includes('error":{')) {
      try {
        const parsed = JSON.parse(text);
        if (parsed?.error) {
          return {
            layer_key: layerKey,
            source_url: url,
            geojson: { type: "FeatureCollection", features: [] },
            feature_count: 0,
            fetched_at: fetchedAt,
            error: `${sourceLabel} error: ${parsed.error.message ?? "unknown"}`,
          };
        }
      } catch {
        /* não é JSON */
      }
    }

    const data = JSON.parse(text);

    if (data?.type !== "FeatureCollection" || !Array.isArray(data.features)) {
      return {
        layer_key: layerKey,
        source_url: url,
        geojson: { type: "FeatureCollection", features: [] },
        feature_count: 0,
        fetched_at: fetchedAt,
        error: `${sourceLabel} returned non-FeatureCollection payload`,
      };
    }

    return {
      layer_key: layerKey,
      source_url: url,
      geojson: data as GeoJSONFeatureCollection,
      feature_count: data.features.length,
      fetched_at: fetchedAt,
    };
  } catch (err) {
    return {
      layer_key: layerKey,
      source_url: url,
      geojson: { type: "FeatureCollection", features: [] },
      feature_count: 0,
      fetched_at: fetchedAt,
      error: `${sourceLabel} fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// EPE wrappers (MapServer SMA/WMS_Webmap_EPE)
async function fetchLTExistentes(bbox: BBox): Promise<LayerResult> {
  return fetchArcGISLayer(
    EPE_MAPSERVER_URL,
    21,
    "aneel_lt_existentes",
    bbox,
    0.12,
    25_000,
    "EPE",
  );
}

async function fetchLTPlanejadas(bbox: BBox): Promise<LayerResult> {
  return fetchArcGISLayer(
    EPE_MAPSERVER_URL,
    10,
    "aneel_lt_planejadas",
    bbox,
    0.12,
    25_000,
    "EPE",
  );
}

/**
 * SIGEL ANEEL DUP — Declaração de Utilidade Pública (servidão administrativa
 * de LT/Subestações de transmissão). Polygons cobrindo BR inteiro.
 *
 * P-191. bufferDeg generoso (0.5° ≈ 55km) porque DUPs são extensas e podem
 * impactar empreendimentos mesmo se o ponto de cruzamento estiver longe do
 * terreno. Útil pra alertar restrição legal antes de aprovar projeto.
 */
async function fetchANEELDup(bbox: BBox): Promise<LayerResult> {
  return fetchArcGISLayer(
    SIGEL_DUP_URL,
    0,
    "aneel_dup",
    bbox,
    0.5,
    25_000,
    "SIGEL",
  );
}

async function fetchSubestacoes(bbox: BBox): Promise<LayerResult> {
  // Existentes (20) + Planejadas (9) num só layer key — diferenciamos por
  // `properties.status` injetado abaixo. Reduz toggles e cliques pro user.
  const existentes = await fetchArcGISLayer(
    EPE_MAPSERVER_URL,
    20,
    "aneel_subestacoes",
    bbox,
    0.12,
    25_000,
    "EPE",
  );
  const planejadas = await fetchArcGISLayer(
    EPE_MAPSERVER_URL,
    9,
    "aneel_subestacoes",
    bbox,
    0.12,
    25_000,
    "EPE",
  );

  const features = [
    ...(existentes.geojson?.features ?? []).map((f) => ({
      ...f,
      properties: { ...f.properties, _status: "existente" },
    })),
    ...(planejadas.geojson?.features ?? []).map((f) => ({
      ...f,
      properties: { ...f.properties, _status: "planejada" },
    })),
  ];

  const errors = [existentes.error, planejadas.error]
    .filter(Boolean)
    .join(" | ");

  return {
    layer_key: "aneel_subestacoes",
    source_url: existentes.source_url,
    geojson: { type: "FeatureCollection", features },
    feature_count: features.length,
    fetched_at: new Date().toISOString(),
    error: errors || undefined,
  };
}

/**
 * Expande a bbox por um fator (0.5 = 50% em cada direção).
 * Isso é necessário porque a área de influência de rios, rodovias etc.
 * pode estar fora da bbox do terreno mas ainda impactar o empreendimento.
 */
function expandBbox(bbox: BBox, factor: number): BBox {
  const dLat = (bbox.north - bbox.south) * factor;
  const dLng = (bbox.east - bbox.west) * factor;
  return {
    south: bbox.south - dLat,
    north: bbox.north + dLat,
    west: bbox.west - dLng,
    east: bbox.east + dLng,
  };
}

// ============================================================
// All layers map
// ============================================================

const LAYER_FETCHERS: Record<string, (bbox: BBox) => Promise<LayerResult>> = {
  sigef_privado: fetchSIGEF,
  hidrografia: fetchHidrografia,
  ibama_uc: fetchIBAMAUC,
  rodovias_federais: fetchRodovias,
  linhas_transmissao: fetchLinhasTransmissao, // legacy Overpass — kept for compat
  aneel_lt_existentes: fetchLTExistentes, // EPE layer 21 — oficial
  aneel_lt_planejadas: fetchLTPlanejadas, // EPE layer 10 — oficial
  aneel_subestacoes: fetchSubestacoes, // EPE layers 20+9 — oficial
  aneel_dup: fetchANEELDup, // SIGEL ANEEL DUP — servidão LT nacional (P-191)
};

const DEFAULT_LAYERS = Object.keys(LAYER_FETCHERS);

// ============================================================
// BBox helpers
// ============================================================

function bboxFromGeojson(geojson: unknown): BBox | null {
  try {
    const g = geojson as { type: string; coordinates: unknown };
    if (!g?.type || !g?.coordinates) return null;
    const coords: number[][] = [];
    function collect(c: unknown) {
      if (Array.isArray(c) && typeof c[0] === "number")
        coords.push(c as number[]);
      else if (Array.isArray(c)) c.forEach(collect);
    }
    collect(g.coordinates);
    if (coords.length === 0) return null;
    return {
      south: Math.min(...coords.map((c) => c[1])),
      north: Math.max(...coords.map((c) => c[1])),
      west: Math.min(...coords.map((c) => c[0])),
      east: Math.max(...coords.map((c) => c[0])),
    };
  } catch {
    return null;
  }
}

// ============================================================
// Main handler
// ============================================================

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
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("authorization");

  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser(token);
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

  const action = (body.action as string) || "fetch_layers";
  const { development_id } = body as { development_id: string };

  if (!development_id) {
    return new Response(JSON.stringify({ error: "development_id required" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // ——————————————
  // ACTION: get_layers
  // ——————————————
  if (action === "get_layers") {
    const { data, error } = await supabase
      .from("development_parcelamento_geo_layers")
      .select("id, layer_key, feature_count, fetched_at, is_active, geojson")
      .eq("development_id", development_id)
      .eq("is_active", true)
      .order("fetched_at", { ascending: false });

    if (error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // ——————————————
  // ACTION: invalidate
  // ——————————————
  if (action === "invalidate") {
    const layerKey = body.layer_key as string | undefined;
    const q = supabase
      .from("development_parcelamento_geo_layers")
      .update({ is_active: false })
      .eq("development_id", development_id);

    if (layerKey) q.eq("layer_key", layerKey);
    const { error } = await q;

    if (error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    return new Response(
      JSON.stringify({ ok: true, invalidated: layerKey ?? "all" }),
      {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // ——————————————
  // ACTION: fetch_layers
  // ——————————————
  if (action !== "fetch_layers") {
    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // Load development
  const { data: dev, error: devErr } = await supabase
    .from("developments")
    .select("id, tenant_id, geometry, bbox")
    .eq("id", development_id)
    .maybeSingle();

  if (devErr || !dev) {
    return new Response(
      JSON.stringify({ error: devErr?.message ?? "Development not found" }),
      {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // Determine bbox
  let bbox: BBox | null = null;
  if (dev.bbox) bbox = dev.bbox as BBox;
  if (!bbox && dev.geometry) bbox = bboxFromGeojson(dev.geometry);
  if (!bbox && body.bbox) bbox = body.bbox as BBox;

  if (!bbox) {
    return new Response(
      JSON.stringify({ error: "No geometry available. Upload KML/KMZ first." }),
      { status: 422, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // Determine which layers to fetch
  const requestedLayers =
    (body.layers as string[] | undefined) ?? DEFAULT_LAYERS;
  const validLayers = requestedLayers.filter((k) => k in LAYER_FETCHERS);

  if (validLayers.length === 0) {
    return new Response(
      JSON.stringify({
        error: "No valid layer keys provided",
        available: DEFAULT_LAYERS,
      }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // Fetch layers SEQUENTIALLY para não sobrecarregar Overpass (rate limit)
  const results: LayerResult[] = [];
  for (const key of validLayers) {
    const result = await LAYER_FETCHERS[key](bbox);
    results.push(result);
    // Delay entre requests para evitar rate limit do Overpass
    if (validLayers.indexOf(key) < validLayers.length - 1) {
      await delay(500);
    }
  }

  // Persist to geo_layers table.
  // FIX (sessão 156): NÃO soft-delete antes — só desativa as layers que
  // ATUALMENTE retornaram dados novos. Se uma camada falhou/retornou vazio
  // (timeout EPE, erro temporário), preservamos o cache anterior bom.
  const tenantId = dev.tenant_id as string;

  // Layer keys que retornaram features > 0 nessa execução
  const layersWithData = results
    .filter((r) => r.geojson !== null && r.feature_count > 0)
    .map((r) => r.layer_key);

  // Só desativa cache antigo das layers que TÊM dados novos pra substituir
  if (layersWithData.length > 0) {
    await supabase
      .from("development_parcelamento_geo_layers")
      .update({ is_active: false })
      .eq("development_id", development_id)
      .in("layer_key", layersWithData);
  }

  // Pra layers que retornaram vazio mas a layer_key foi requisitada,
  // mantemos cache antigo intacto. Só inserimos as que têm dados novos
  // OU as que já não têm cache nenhum (ex: primeira vez).
  const insertRows = results
    .filter((r) => r.geojson !== null && r.feature_count > 0)
    .map((r) => ({
      development_id,
      tenant_id: tenantId,
      layer_key: r.layer_key,
      geojson: r.geojson,
      source: r.source_url,
      feature_count: r.feature_count,
      fetched_at: r.fetched_at,
      is_active: true,
    }));

  let insertError: string | null = null;
  if (insertRows.length > 0) {
    const { error: insertErr } = await supabase
      .from("development_parcelamento_geo_layers")
      .insert(insertRows);

    if (insertErr) {
      console.error("Insert error:", insertErr);
      insertError = insertErr.message;
    }
  }

  // Summary
  const summary = results.map((r) => ({
    layer_key: r.layer_key,
    feature_count: r.feature_count,
    ok: !r.error || r.feature_count > 0,
    error: r.error,
    fetched_at: r.fetched_at,
  }));

  const successCount = summary.filter((s) => s.ok).length;

  return new Response(
    JSON.stringify({
      ok: true,
      development_id,
      fetched: successCount,
      total: validLayers.length,
      layers: summary,
      cached: !insertError,
      cache_error: insertError,
      source: "overpass-api-v2",
    }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
