/**
 * development-contours v1 (Sprint D1, sessão 156)
 *
 * Gera curvas de nível (isolinhas) para um terreno via:
 *   1. Lê geometry + bbox do project no Supabase
 *   2. Gera grid de pontos cobrindo o terreno (densidade configurável)
 *   3. Profile GPServer da Esri retorna elevação por linha
 *   4. Monta matriz de elevações (rows × cols)
 *   5. Aplica algoritmo marching squares pra gerar isolinhas a cada Xm
 *   6. Retorna GeoJSON LineString[] + cacheia em development_contours
 *
 * API: ArcGIS Tools/ElevationSync/GPServer/Profile
 * Auth: ARCGIS_API_KEY_1 secret (Bearer token)
 *
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// CORS
// ============================================================
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

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowed =
    PROD_ORIGINS.includes(origin) || DEV_PATTERNS.some((re) => re.test(origin));
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

// ============================================================
// Tipos
// ============================================================

interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

interface ProfilePoint {
  x: number; // longitude
  y: number; // latitude
  z: number; // elevação metros
  m?: number; // distância acumulada
}

// ============================================================
// Geração da linha zigzag
// ============================================================

/**
 * Gera uma linha em zigzag cobrindo o bbox com N passes horizontais.
 * Cada pass percorre o terreno W→E ou E→W alternadamente, deslocando-se em Y.
 * Útil pra capturar elevação em grid denso com 1 só request Profile.
 */
function buildZigzagLine(bbox: BBox, passes: number): [number, number][] {
  const coords: [number, number][] = [];
  const dy = (bbox.north - bbox.south) / Math.max(1, passes - 1);
  for (let i = 0; i < passes; i++) {
    const y = bbox.south + i * dy;
    if (i % 2 === 0) {
      coords.push([bbox.west, y]);
      coords.push([bbox.east, y]);
    } else {
      coords.push([bbox.east, y]);
      coords.push([bbox.west, y]);
    }
  }
  return coords;
}

// ============================================================
// ArcGIS Profile GPServer — chamada
// ============================================================

const PROFILE_URL =
  "https://elevation.arcgis.com/arcgis/rest/services/Tools/ElevationSync/GPServer/Profile/execute";

async function callEsriProfile(
  apiKey: string,
  zigzagCoords: [number, number][],
  demResolution: "10m" | "24m" | "30m" | "90m" = "30m",
  maxSampleDistanceM = 30,
): Promise<ProfilePoint[]> {
  const inputLineFeatures = {
    geometryType: "esriGeometryPolyline",
    spatialReference: { wkid: 4326 },
    fields: [
      { name: "OID", type: "esriFieldTypeOID", alias: "OID" },
      { name: "ProfileID", type: "esriFieldTypeString", alias: "ProfileID" },
    ],
    features: [
      {
        attributes: { OID: 1, ProfileID: "main" },
        geometry: {
          paths: [zigzagCoords],
          spatialReference: { wkid: 4326 },
        },
      },
    ],
  };

  const params = new URLSearchParams({
    InputLineFeatures: JSON.stringify(inputLineFeatures),
    ProfileIDField: "ProfileID",
    DEMResolution: demResolution,
    MaximumSampleDistance: String(maxSampleDistanceM),
    MaximumSampleDistanceUnits: "Meters",
    f: "json",
    token: apiKey,
  });

  const res = await fetch(PROFILE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Esri Profile HTTP ${res.status}: ${text.substring(0, 300)}`,
    );
  }
  const data = await res.json();
  if (data?.error) {
    throw new Error(
      `Esri Profile error: ${JSON.stringify(data.error).substring(0, 300)}`,
    );
  }

  // Profile retorna OutputProfile com features tendo polyline com pontos m,z
  const out = data?.results?.find(
    (r: { paramName: string }) => r.paramName === "OutputProfile",
  );
  const features = out?.value?.features ?? [];
  const points: ProfilePoint[] = [];
  for (const f of features) {
    const paths = f.geometry?.paths ?? [];
    for (const path of paths) {
      for (const pt of path) {
        // Esri retorna [x, y, z, m]
        if (pt.length >= 3) {
          points.push({ x: pt[0], y: pt[1], z: pt[2], m: pt[3] });
        }
      }
    }
  }
  return points;
}

// ============================================================
// Marching Squares — geração de isolinhas
// ============================================================

/**
 * Implementação compacta de marching squares pra gerar isolinhas
 * a partir de matriz 2D de elevações.
 */
function marchingSquares(
  grid: number[][],
  threshold: number,
  rowToY: (r: number) => number,
  colToX: (c: number) => number,
): [number, number][][] {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (rows < 2 || cols < 2) return [];

  const segments: [[number, number], [number, number]][] = [];

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const tl = grid[r][c];
      const tr = grid[r][c + 1];
      const br = grid[r + 1][c + 1];
      const bl = grid[r + 1][c];
      if ([tl, tr, br, bl].some((v) => !Number.isFinite(v))) continue;

      const idx =
        (tl > threshold ? 8 : 0) +
        (tr > threshold ? 4 : 0) +
        (br > threshold ? 2 : 0) +
        (bl > threshold ? 1 : 0);

      const x0 = colToX(c);
      const x1 = colToX(c + 1);
      const y0 = rowToY(r);
      const y1 = rowToY(r + 1);

      const lerp = (a: number, b: number, va: number, vb: number) => {
        if (vb === va) return (a + b) / 2;
        return a + ((threshold - va) / (vb - va)) * (b - a);
      };

      // 4 arestas: top (tl→tr), right (tr→br), bottom (bl→br), left (tl→bl)
      const top: [number, number] = [lerp(x0, x1, tl, tr), y0];
      const right: [number, number] = [x1, lerp(y0, y1, tr, br)];
      const bottom: [number, number] = [lerp(x0, x1, bl, br), y1];
      const left: [number, number] = [x0, lerp(y0, y1, tl, bl)];

      switch (idx) {
        case 1:
        case 14:
          segments.push([left, bottom]);
          break;
        case 2:
        case 13:
          segments.push([bottom, right]);
          break;
        case 3:
        case 12:
          segments.push([left, right]);
          break;
        case 4:
        case 11:
          segments.push([top, right]);
          break;
        case 5:
          segments.push([left, top]);
          segments.push([bottom, right]);
          break;
        case 6:
        case 9:
          segments.push([top, bottom]);
          break;
        case 7:
        case 8:
          segments.push([left, top]);
          break;
        case 10:
          segments.push([top, right]);
          segments.push([left, bottom]);
          break;
        // 0 e 15: nada
      }
    }
  }

  // Concatena segments em linhas contíguas (greedy chain)
  const lines: [number, number][][] = [];
  const used = new Set<number>();
  const eq = (a: [number, number], b: [number, number]) =>
    Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;

  for (let i = 0; i < segments.length; i++) {
    if (used.has(i)) continue;
    const line: [number, number][] = [segments[i][0], segments[i][1]];
    used.add(i);
    let extended = true;
    while (extended) {
      extended = false;
      for (let j = 0; j < segments.length; j++) {
        if (used.has(j)) continue;
        const [a, b] = segments[j];
        if (eq(a, line[line.length - 1])) {
          line.push(b);
          used.add(j);
          extended = true;
        } else if (eq(b, line[line.length - 1])) {
          line.push(a);
          used.add(j);
          extended = true;
        } else if (eq(b, line[0])) {
          line.unshift(a);
          used.add(j);
          extended = true;
        } else if (eq(a, line[0])) {
          line.unshift(b);
          used.add(j);
          extended = true;
        }
      }
    }
    if (line.length >= 2) lines.push(line);
  }

  return lines;
}

// ============================================================
// Construção do grid a partir dos pontos do Profile
// ============================================================

function buildGridFromProfile(
  points: ProfilePoint[],
  bbox: BBox,
  rows: number,
  cols: number,
): number[][] {
  const grid: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(NaN),
  );
  const counts: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(0),
  );
  const dy = (bbox.north - bbox.south) / rows;
  const dx = (bbox.east - bbox.west) / cols;
  for (const p of points) {
    const r = Math.min(
      rows - 1,
      Math.max(0, Math.floor((p.y - bbox.south) / dy)),
    );
    const c = Math.min(
      cols - 1,
      Math.max(0, Math.floor((p.x - bbox.west) / dx)),
    );
    if (counts[r][c] === 0) grid[r][c] = p.z;
    else grid[r][c] = (grid[r][c] * counts[r][c] + p.z) / (counts[r][c] + 1);
    counts[r][c]++;
  }
  // Preenche células vazias com média de vizinhos (1 pass simples)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (Number.isFinite(grid[r][c])) continue;
      const neighbors: number[] = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          if (Number.isFinite(grid[nr][nc])) neighbors.push(grid[nr][nc]);
        }
      }
      if (neighbors.length > 0) {
        grid[r][c] = neighbors.reduce((a, b) => a + b, 0) / neighbors.length;
      }
    }
  }
  return grid;
}

// ============================================================
// bbox helper
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
// Handler
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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const arcgisKey = Deno.env.get("ARCGIS_API_KEY_1");
  const auth = req.headers.get("authorization");

  if (!auth) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  if (!arcgisKey) {
    return new Response(
      JSON.stringify({
        error:
          "ARCGIS_API_KEY_1 não configurada na Edge Function — adicione o secret no Supabase Dashboard",
        code: "ARCGIS_KEY_MISSING",
      }),
      { status: 503, headers: { ...cors, "Content-Type": "application/json" } },
    );
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
  const intervalM = Number(body.interval_m ?? 5);
  const demResolution = (body.dem_resolution as string) ?? "30m";
  if (!developmentId) {
    return new Response(JSON.stringify({ error: "development_id required" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // 1. Lê dev
  const { data: dev, error: devErr } = await supabase
    .from("developments")
    .select("id, name, geometry, bbox")
    .eq("id", developmentId)
    .maybeSingle();

  if (devErr || !dev) {
    return new Response(
      JSON.stringify({ error: devErr?.message ?? "Development not found" }),
      { status: 404, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // 2. bbox
  let bbox: BBox | null = null;
  if (dev.bbox && typeof dev.bbox === "object") {
    const b = dev.bbox as Record<string, number>;
    if (
      b.south != null &&
      b.north != null &&
      b.west != null &&
      b.east != null
    ) {
      bbox = b as BBox;
    }
  }
  if (!bbox && dev.geometry) bbox = bboxFromGeojson(dev.geometry);
  if (!bbox) {
    return new Response(
      JSON.stringify({
        error: "No bbox/geometry available for this development",
      }),
      { status: 422, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // 3. Zigzag — densidade depende do tamanho do terreno
  // Aproximação: 0.001° ≈ 110m. Pra terreno 0.01° (1km), 20 passes = ~50m de spacing
  const passes = 20;
  const zigzag = buildZigzagLine(bbox, passes);

  // 4. Esri Profile
  const sampleDistanceM =
    demResolution === "10m" ? 15 : demResolution === "30m" ? 30 : 50;

  let points: ProfilePoint[];
  try {
    points = await callEsriProfile(
      arcgisKey,
      zigzag,
      demResolution as "10m" | "24m" | "30m" | "90m",
      sampleDistanceM,
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: `Esri Profile call falhou: ${e instanceof Error ? e.message : String(e)}`,
        code: "ESRI_PROFILE_ERROR",
      }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  if (points.length < 50) {
    return new Response(
      JSON.stringify({
        error: `Esri retornou poucos pontos (${points.length}) — terreno pode estar fora da cobertura DEM ou parâmetros incorretos`,
        code: "INSUFFICIENT_POINTS",
        points_count: points.length,
      }),
      { status: 422, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // 5. Grid 50×50 a partir dos pontos
  const rows = passes;
  const cols = Math.max(20, Math.floor(points.length / passes));
  const grid = buildGridFromProfile(points, bbox, rows, cols);

  // 6. Estatísticas
  const allZ = points.map((p) => p.z).filter(Number.isFinite);
  const elevMin = Math.min(...allZ);
  const elevMax = Math.max(...allZ);

  // 7. Gera curvas a cada intervalM
  const features: GeoJSON.Feature[] = [];
  const startElev = Math.ceil(elevMin / intervalM) * intervalM;
  for (let elev = startElev; elev <= elevMax; elev += intervalM) {
    const lines = marchingSquares(
      grid,
      elev,
      (r) => bbox!.north - (r / (rows - 1)) * (bbox!.north - bbox!.south),
      (c) => bbox!.west + (c / (cols - 1)) * (bbox!.east - bbox!.west),
    );
    for (const line of lines) {
      features.push({
        type: "Feature",
        properties: {
          elevation: elev,
          // Curvas mestras a cada 5×interval (ex: 25m em interval 5m)
          master: elev % (intervalM * 5) === 0,
        },
        geometry: { type: "LineString", coordinates: line },
      });
    }
  }

  const featureCollection: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features,
  };

  // 8. Cache
  await supabase.from("development_contours").upsert(
    {
      development_id: developmentId,
      interval_m: intervalM,
      dem_resolution: demResolution,
      elev_min: elevMin,
      elev_max: elevMax,
      feature_count: features.length,
      geojson: featureCollection,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "development_id" },
  );

  return new Response(
    JSON.stringify({
      ok: true,
      development_id: developmentId,
      stats: {
        elev_min: elevMin,
        elev_max: elevMax,
        elev_range: elevMax - elevMin,
        sample_count: points.length,
        feature_count: features.length,
        interval_m: intervalM,
        dem_resolution: demResolution,
      },
      geojson: featureCollection,
    }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
