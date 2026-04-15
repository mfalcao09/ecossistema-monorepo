/**
 * development-elevation v1
 *
 * Busca dados de elevação SRTM 30m via OpenTopography API para um terreno de
 * parcelamento de solo. Atualiza a tabela `developments` com dados de elevação e
 * armazena grid de amostras em `elevation_grid`.
 *
 * Actions:
 *   fetch_elevation  — Busca e persiste dados de elevação para um development_id
 *   get_status       — Retorna status atual de elevação do development
 *
 * APIs:
 *   Primary  : OpenTopography SRTM GL1 30m (https://portal.opentopography.org/API/globaldem)
 *   Fallback : Open-Elevation API (https://api.open-elevation.com/api/v1/lookup) — 90m Copernicus
 *
 * Sessão 119 — Fase 2 Parcelamento de Solo
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// CORS (whitelist padrão Intentus)
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
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

// ============================================================
// Types
// ============================================================

interface BoundingBox {
  south: number;
  north: number;
  west: number;
  east: number;
}

interface ElevationStats {
  min: number;
  max: number;
  avg: number;
  slopeAvgPct: number;
  source: string;
  resolution: string;
  sampleCount: number;
  grid: number[][];
  bbox: BoundingBox;
  fetchedAt: string;
}

// ============================================================
// OpenTopography SRTM 30m (primary)
// ============================================================

async function fetchOpenTopography(bbox: BoundingBox): Promise<ElevationStats | null> {
  const apiKey = Deno.env.get("OPENTOPO_API_KEY");
  if (!apiKey) {
    console.warn("OPENTOPO_API_KEY not set — skipping primary");
    return null;
  }

  // Limit bbox size to avoid rate limits (max 0.5° × 0.5°)
  const latSpan = bbox.north - bbox.south;
  const lonSpan = bbox.east - bbox.west;
  if (latSpan > 0.6 || lonSpan > 0.6) {
    console.warn("BBox too large for OpenTopography — truncating to 0.5° × 0.5°");
    const centerLat = (bbox.north + bbox.south) / 2;
    const centerLon = (bbox.east + bbox.west) / 2;
    bbox = {
      south: centerLat - 0.25,
      north: centerLat + 0.25,
      west: centerLon - 0.25,
      east: centerLon + 0.25,
    };
  }

  const params = new URLSearchParams({
    demtype: "SRTMGL1_E",        // SRTM 30m ellipsoidal
    south: bbox.south.toFixed(6),
    north: bbox.north.toFixed(6),
    west: bbox.west.toFixed(6),
    east: bbox.east.toFixed(6),
    outputFormat: "AAIGrid",     // ASCII Grid — text parseable
    API_Key: apiKey,
  });

  const url = `https://portal.opentopography.org/API/globaldem?${params}`;
  console.log("OpenTopography request:", url.replace(apiKey, "***"));

  const res = await fetch(url, {
    signal: AbortSignal.timeout(25_000),
    headers: { Accept: "text/plain, application/octet-stream" },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`OpenTopography error ${res.status}:`, body.substring(0, 300));
    return null;
  }

  const text = await res.text();
  return parseAAIGrid(text, bbox, "srtm-30m", "30m (SRTM GL1)");
}

// ============================================================
// AAIGrid parser
// ============================================================

function parseAAIGrid(
  raw: string, bbox: BoundingBox, source: string, resolution: string
): ElevationStats | null {
  const lines = raw.trim().split("\n");
  if (lines.length < 7) {
    console.error("AAIGrid: too few lines:", lines.length);
    return null;
  }

  // Parse header: ncols, nrows, xllcorner, yllcorner, cellsize, NODATA_value
  const header: Record<string, number> = {};
  let dataStart = 0;
  for (let i = 0; i < 10; i++) {
    const parts = lines[i].trim().split(/\s+/);
    if (parts.length === 2 && isNaN(Number(parts[0].charAt(0)))) {
      header[parts[0].toLowerCase()] = Number(parts[1]);
      dataStart = i + 1;
    } else {
      break;
    }
  }

  const nodata = header["nodata_value"] ?? -9999;
  const ncols = header["ncols"] ?? 0;
  const nrows = header["nrows"] ?? 0;

  if (ncols === 0 || nrows === 0) {
    console.error("AAIGrid: invalid dimensions", header);
    return null;
  }

  // Parse data rows
  const allValues: number[] = [];
  const grid: number[][] = [];

  for (let r = 0; r < nrows; r++) {
    const lineIdx = dataStart + r;
    if (lineIdx >= lines.length) break;
    const rowVals = lines[lineIdx].trim().split(/\s+/).map(Number);
    const row: number[] = [];
    for (const v of rowVals) {
      if (v !== nodata && !isNaN(v)) {
        allValues.push(v);
        row.push(Math.round(v * 10) / 10); // 1 decimal place
      }
    }
    if (row.length > 0) grid.push(row);
  }

  if (allValues.length === 0) {
    console.error("AAIGrid: no valid elevation values found");
    return null;
  }

  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const avg = allValues.reduce((a, b) => a + b, 0) / allValues.length;

  // Approximate slope: elevation range / horizontal distance
  // bbox diagonal in meters ≈ sqrt((latΔ * 111000)² + (lonΔ * 111000 * cos(lat))²)
  const latMid = (bbox.north + bbox.south) / 2;
  const latDist = (bbox.north - bbox.south) * 111_000;
  const lonDist = (bbox.east - bbox.west) * 111_000 * Math.cos((latMid * Math.PI) / 180);
  const diagDist = Math.sqrt(latDist * latDist + lonDist * lonDist);
  const slopeAvgPct = diagDist > 0 ? ((max - min) / diagDist) * 100 : 0;

  // Downsample grid for storage (keep max 20×20 = 400 points)
  const sampledGrid = downsampleGrid(grid, 20, 20);

  return {
    min: Math.round(min * 10) / 10,
    max: Math.round(max * 10) / 10,
    avg: Math.round(avg * 10) / 10,
    slopeAvgPct: Math.round(slopeAvgPct * 100) / 100,
    source,
    resolution,
    sampleCount: allValues.length,
    grid: sampledGrid,
    bbox,
    fetchedAt: new Date().toISOString(),
  };
}

function downsampleGrid(
  grid: number[][], maxRows: number, maxCols: number
): number[][] {
  if (grid.length === 0) return [];
  const rowStep = Math.max(1, Math.floor(grid.length / maxRows));
  const result: number[][] = [];
  for (let r = 0; r < grid.length; r += rowStep) {
    const row = grid[r];
    const colStep = Math.max(1, Math.floor(row.length / maxCols));
    const sampledRow: number[] = [];
    for (let c = 0; c < row.length; c += colStep) {
      sampledRow.push(row[c]);
    }
    result.push(sampledRow);
  }
  return result;
}

// ============================================================
// Open-Elevation fallback (90m Copernicus / SRTM)
// ============================================================

async function fetchOpenElevationFallback(bbox: BoundingBox): Promise<ElevationStats | null> {
  // Sample a 5×5 grid of points from the bbox
  const rows = 5, cols = 5;
  const locations: { latitude: number; longitude: number }[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      locations.push({
        latitude:  bbox.south + (r / (rows - 1)) * (bbox.north - bbox.south),
        longitude: bbox.west  + (c / (cols - 1)) * (bbox.east  - bbox.west),
      });
    }
  }

  const body = JSON.stringify({ locations });
  const res = await fetch("https://api.open-elevation.com/api/v1/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    console.error("Open-Elevation fallback error:", res.status);
    return null;
  }

  const data = await res.json() as { results: { elevation: number }[] };
  const elevations = data.results?.map((r) => r.elevation).filter((e) => e != null) ?? [];

  if (elevations.length === 0) return null;

  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  const avg = elevations.reduce((a, b) => a + b, 0) / elevations.length;

  const latMid = (bbox.north + bbox.south) / 2;
  const latDist = (bbox.north - bbox.south) * 111_000;
  const lonDist = (bbox.east - bbox.west) * 111_000 * Math.cos((latMid * Math.PI) / 180);
  const diagDist = Math.sqrt(latDist * latDist + lonDist * lonDist);
  const slopeAvgPct = diagDist > 0 ? ((max - min) / diagDist) * 100 : 0;

  // Build 5×5 grid
  const grid: number[][] = [];
  for (let r = 0; r < rows; r++) {
    grid.push(elevations.slice(r * cols, (r + 1) * cols));
  }

  return {
    min: Math.round(min * 10) / 10,
    max: Math.round(max * 10) / 10,
    avg: Math.round(avg * 10) / 10,
    slopeAvgPct: Math.round(slopeAvgPct * 100) / 100,
    source: "open-elevation-90m",
    resolution: "90m (Copernicus/SRTM GL3 fallback)",
    sampleCount: elevations.length,
    grid,
    bbox,
    fetchedAt: new Date().toISOString(),
  };
}

// ============================================================
// Extract bbox from GeoJSON geometry
// ============================================================

function bboxFromGeojson(geojson: unknown): BoundingBox | null {
  try {
    const g = geojson as { type: string; coordinates: unknown };
    if (!g?.type || !g?.coordinates) return null;

    const coords: number[][] = [];
    function collect(c: unknown) {
      if (Array.isArray(c) && typeof c[0] === "number") {
        coords.push(c as number[]);
      } else if (Array.isArray(c)) {
        c.forEach(collect);
      }
    }
    collect(g.coordinates);

    if (coords.length === 0) return null;

    const lons = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);

    return {
      south: Math.min(...lats),
      north: Math.max(...lats),
      west: Math.min(...lons),
      east: Math.max(...lons),
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

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("authorization");

  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // Verify auth
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const action = (body.action as string) || "fetch_elevation";

  // ——————————————
  // ACTION: get_status
  // ——————————————
  if (action === "get_status") {
    const { development_id } = body as { development_id: string };
    if (!development_id) {
      return new Response(JSON.stringify({ error: "development_id required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase
      .from("developments")
      .select("id, name, analysis_status, elevation_source, elevation_min, elevation_max, elevation_avg, slope_avg_pct, elevation_grid")
      .eq("id", development_id)
      .maybeSingle();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ data }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // ——————————————
  // ACTION: fetch_elevation
  // ——————————————
  if (action !== "fetch_elevation") {
    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { development_id } = body as { development_id: string };
  if (!development_id) {
    return new Response(JSON.stringify({ error: "development_id required" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Load development geometry
  const { data: dev, error: devErr } = await supabase
    .from("developments")
    .select("id, name, tenant_id, geometry, bbox, analysis_status")
    .eq("id", development_id)
    .maybeSingle();

  if (devErr || !dev) {
    return new Response(JSON.stringify({ error: devErr?.message ?? "Development not found" }), {
      status: 404, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Mark as geo_analyzing
  await supabase.from("developments")
    .update({ analysis_status: "geo_analyzing", updated_at: new Date().toISOString() })
    .eq("id", development_id);

  // Determine bbox
  let bbox: BoundingBox | null = null;

  if (dev.bbox && typeof dev.bbox === "object") {
    const b = dev.bbox as Record<string, number>;
    if (b.south != null && b.north != null && b.west != null && b.east != null) {
      bbox = b as BoundingBox;
    }
  }

  if (!bbox && dev.geometry) {
    bbox = bboxFromGeojson(dev.geometry);
  }

  if (!bbox) {
    // If no geometry yet, check body for manual bbox
    if (body.bbox) {
      bbox = body.bbox as BoundingBox;
    }
  }

  if (!bbox) {
    await supabase.from("developments")
      .update({ analysis_status: "error", updated_at: new Date().toISOString() })
      .eq("id", development_id);
    return new Response(
      JSON.stringify({ error: "No geometry or bbox available for this development. Upload a KML/KMZ first." }),
      { status: 422, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  // Fetch elevation data
  let stats: ElevationStats | null = null;
  let source = "unknown";

  try {
    stats = await fetchOpenTopography(bbox);
    if (stats) source = "opentopography-srtm-30m";
  } catch (err) {
    console.error("OpenTopography fetch failed:", err);
  }

  if (!stats) {
    console.log("Falling back to Open-Elevation...");
    try {
      stats = await fetchOpenElevationFallback(bbox);
      if (stats) source = "open-elevation-fallback";
    } catch (err) {
      console.error("Open-Elevation fallback failed:", err);
    }
  }

  if (!stats) {
    await supabase.from("developments")
      .update({ analysis_status: "error", updated_at: new Date().toISOString() })
      .eq("id", development_id);
    return new Response(
      JSON.stringify({ error: "All elevation sources failed. Please try again." }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  // Persist to developments
  const { error: updateErr } = await supabase
    .from("developments")
    .update({
      elevation_source: source,
      elevation_min: stats.min,
      elevation_max: stats.max,
      elevation_avg: stats.avg,
      slope_avg_pct: stats.slopeAvgPct,
      elevation_grid: {
        grid: stats.grid,
        resolution: stats.resolution,
        sampleCount: stats.sampleCount,
        fetchedAt: stats.fetchedAt,
        bbox: stats.bbox,
      },
      analysis_status: "geo_analyzing", // full geo_done only after all layers
      updated_at: new Date().toISOString(),
    })
    .eq("id", development_id);

  if (updateErr) {
    console.error("DB update error:", updateErr);
    return new Response(JSON.stringify({ error: updateErr.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      development_id,
      elevation: {
        source: stats.source,
        resolution: stats.resolution,
        min: stats.min,
        max: stats.max,
        avg: stats.avg,
        slopeAvgPct: stats.slopeAvgPct,
        sampleCount: stats.sampleCount,
        fetchedAt: stats.fetchedAt,
      },
    }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
  );
});
