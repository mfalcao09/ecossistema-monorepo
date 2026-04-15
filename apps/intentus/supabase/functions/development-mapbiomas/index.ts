/**
 * development-mapbiomas v1
 *
 * Edge Function multi-action para consulta MapBiomas via Google Earth Engine REST API.
 * Retorna histórico de uso/cobertura do solo sobreposto ao terreno (10 anos).
 *
 * ACTIONS:
 *   fetch_land_use      — Consulta classificação MapBiomas para um ano específico
 *   fetch_time_series   — Histórico temporal (últimos N anos) com tendência
 *   get_cached          — Retorna dados já cacheados para um development
 *
 * Sessão 144 — Bloco H Sprint 4 — US-117
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 *
 * Fontes de dados:
 *   MapBiomas Collection 8 — projects/mapbiomas-workspace/public/collection8
 *   Google Earth Engine REST API — https://earthengine.googleapis.com/v1
 *
 * Autenticação: Service Account JWT → OAuth2 access token
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

interface LandUseClass {
  class_id: number;
  class_name: string;
  area_ha: number;
  percentage: number;
  color: string;
}

interface MapBiomasResult {
  reference_year: number;
  land_use_classes: LandUseClass[];
  dominant_class: string;
  native_vegetation_pct: number;
  agriculture_pct: number;
  urban_pct: number;
  water_pct: number;
  pixel_count: number;
  collection_version: string;
}

interface TimeSeriesTrend {
  deforestation_trend: "increasing" | "stable" | "decreasing";
  urbanization_trend: "increasing" | "stable" | "decreasing";
  native_veg_change_pct: number;
  years_analyzed: number[];
  change_summary: Record<string, { start_pct: number; end_pct: number; delta: number }>;
}

// ============================================================
// MapBiomas Collection 8 — Class Legend (Nível 1 + principais Nível 2)
// ============================================================

const MAPBIOMAS_CLASSES: Record<number, { name: string; category: string; color: string }> = {
  // Floresta
  1: { name: "Floresta", category: "native_vegetation", color: "#1f8d49" },
  3: { name: "Formação Florestal", category: "native_vegetation", color: "#1f8d49" },
  4: { name: "Formação Savânica", category: "native_vegetation", color: "#7dc975" },
  5: { name: "Mangue", category: "native_vegetation", color: "#04381d" },
  6: { name: "Floresta Alagável", category: "native_vegetation", color: "#007785" },
  49: { name: "Restinga Arborizada", category: "native_vegetation", color: "#02d659" },
  // Formação Natural Não Florestal
  10: { name: "Formação Natural Não Florestal", category: "native_vegetation", color: "#d6bc74" },
  11: { name: "Campo Alagado e Área Pantanosa", category: "native_vegetation", color: "#519799" },
  12: { name: "Formação Campestre", category: "native_vegetation", color: "#d6bc74" },
  32: { name: "Apicum", category: "native_vegetation", color: "#fc8114" },
  29: { name: "Afloramento Rochoso", category: "native_vegetation", color: "#ffaa5f" },
  50: { name: "Restinga Herbácea", category: "native_vegetation", color: "#ad5100" },
  13: { name: "Outras Formações Não Florestais", category: "native_vegetation", color: "#d89f5c" },
  // Agropecuária
  14: { name: "Agropecuária", category: "agriculture", color: "#FFFFB2" },
  15: { name: "Pastagem", category: "agriculture", color: "#ffd966" },
  18: { name: "Agricultura", category: "agriculture", color: "#E974ED" },
  19: { name: "Lavoura Temporária", category: "agriculture", color: "#C27BA0" },
  20: { name: "Cana", category: "agriculture", color: "#db7093" },
  39: { name: "Soja", category: "agriculture", color: "#f5b3c8" },
  40: { name: "Arroz", category: "agriculture", color: "#c71585" },
  62: { name: "Algodão", category: "agriculture", color: "#ff69b4" },
  41: { name: "Outras Lavouras Temporárias", category: "agriculture", color: "#f54ca9" },
  36: { name: "Lavoura Perene", category: "agriculture", color: "#d082de" },
  46: { name: "Café", category: "agriculture", color: "#b8006a" },
  47: { name: "Citrus", category: "agriculture", color: "#8b008b" },
  35: { name: "Dendê (Palma de Óleo)", category: "agriculture", color: "#9065d0" },
  48: { name: "Outras Lavouras Perenes", category: "agriculture", color: "#a9007b" },
  9: { name: "Silvicultura", category: "agriculture", color: "#7a5900" },
  21: { name: "Mosaico Agricultura e Pastagem", category: "agriculture", color: "#ffefc3" },
  // Área Não Vegetada
  22: { name: "Área Não Vegetada", category: "non_vegetated", color: "#d4271e" },
  23: { name: "Praia, Duna e Areal", category: "non_vegetated", color: "#ffa07a" },
  24: { name: "Área Urbanizada", category: "urban", color: "#d4271e" },
  30: { name: "Mineração", category: "non_vegetated", color: "#9c0027" },
  25: { name: "Outra Área Não Vegetada", category: "non_vegetated", color: "#db4d4f" },
  // Água
  26: { name: "Corpo D'Água", category: "water", color: "#0000FF" },
  33: { name: "Rio, Lago e Oceano", category: "water", color: "#2532e4" },
  31: { name: "Aquicultura", category: "water", color: "#091077" },
  // Não Observado
  27: { name: "Não Observado", category: "unobserved", color: "#ffffff" },
};

function getClassInfo(classId: number): { name: string; category: string; color: string } {
  return MAPBIOMAS_CLASSES[classId] || { name: `Classe ${classId}`, category: "unknown", color: "#cccccc" };
}

// ============================================================
// GEE Authentication — Service Account JWT → Access Token
// ============================================================

async function getGeeAccessToken(): Promise<string> {
  const email = Deno.env.get("GEE_SERVICE_ACCOUNT_EMAIL");
  const privateKeyJson = Deno.env.get("GEE_PRIVATE_KEY_JSON");

  if (!email || !privateKeyJson) {
    throw new Error("GEE credentials not configured (GEE_SERVICE_ACCOUNT_EMAIL / GEE_PRIVATE_KEY_JSON)");
  }

  let keyData: { private_key: string };
  try {
    keyData = JSON.parse(privateKeyJson);
  } catch {
    throw new Error("GEE_PRIVATE_KEY_JSON is not valid JSON");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: email,
    scope: "https://www.googleapis.com/auth/earthengine.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  // Base64url encode
  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const signingInput = `${enc(header)}.${enc(payload)}`;

  // Import RSA private key
  const pemBody = keyData.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Sign
  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${signingInput}.${signature}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`GEE token exchange failed (${tokenRes.status}): ${errText}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

// ============================================================
// GEE Earth Engine REST API — computePixels / computeStatistics
// ============================================================

const GEE_PROJECT = Deno.env.get("GEE_PROJECT_ID") || "gen-lang-client-0612830161";
const EE_API_BASE = `https://earthengine.googleapis.com/v1/projects/${GEE_PROJECT}`;

// MapBiomas Collection 8 asset
const MAPBIOMAS_ASSET = "projects/mapbiomas-workspace/public/collection8";

// Cache TTL (dias) — Buchecha fix: constante nomeada em vez de magic number
const CACHE_TTL_DAYS = 90;
const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

// Pixel area at 30m Landsat resolution: 30m × 30m = 900 m² = 0.09 ha
const PIXEL_AREA_HA = 0.09;

// Concurrency limit for GEE batch requests
const GEE_BATCH_SIZE = 3;

/**
 * Computes land use class distribution for a given geometry and year
 * using GEE REST API computePixels endpoint.
 */
async function computeLandUseForYear(
  accessToken: string,
  lat: number,
  lng: number,
  bufferRadiusM: number,
  year: number
): Promise<MapBiomasResult> {
  // MapBiomas Collection 8 has bands named "classification_YYYY"
  const bandName = `classification_${year}`;

  // Build Earth Engine expression for pixel counting by class
  // Strategy: Use computeFeatures with a reduceRegion to get histogram
  const expression = {
    expression: {
      functionInvocationValue: {
        functionName: "Image.reduceRegion",
        arguments: {
          image: {
            functionInvocationValue: {
              functionName: "Image.select",
              arguments: {
                input: {
                  functionInvocationValue: {
                    functionName: "Image.load",
                    arguments: {
                      id: { constantValue: MAPBIOMAS_ASSET },
                    },
                  },
                },
                bandSelectors: {
                  arrayValue: {
                    values: [{ constantValue: bandName }],
                  },
                },
              },
            },
          },
          reducer: {
            functionInvocationValue: {
              functionName: "Reducer.frequencyHistogram",
              arguments: {},
            },
          },
          geometry: {
            functionInvocationValue: {
              functionName: "Feature.buffer",
              arguments: {
                feature: {
                  functionInvocationValue: {
                    functionName: "Feature",
                    arguments: {
                      geometry: {
                        functionInvocationValue: {
                          functionName: "Geometry.Point",
                          arguments: {
                            coordinates: {
                              arrayValue: {
                                values: [
                                  { constantValue: lng },
                                  { constantValue: lat },
                                ],
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                distance: { constantValue: bufferRadiusM },
              },
            },
          },
          scale: { constantValue: 30 },
          bestEffort: { constantValue: true },
        },
      },
    },
  };

  const res = await fetch(`${EE_API_BASE}:computeValue`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(expression),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`GEE computeValue failed (${res.status}): ${errBody}`);
  }

  const result = await res.json();

  // Parse histogram result
  // The result is { "result": { "classification_YYYY": { "classId": pixelCount, ... } } }
  const histogram: Record<string, number> = result?.result?.[bandName] || {};

  let totalPixels = 0;
  const classEntries: { classId: number; pixelCount: number }[] = [];

  for (const [classIdStr, pixelCount] of Object.entries(histogram)) {
    const classId = parseInt(classIdStr, 10);
    const count = typeof pixelCount === "number" ? pixelCount : 0;
    if (count > 0) {
      classEntries.push({ classId, pixelCount: count });
      totalPixels += count;
    }
  }

  if (totalPixels === 0) {
    return {
      reference_year: year,
      land_use_classes: [],
      dominant_class: "Sem dados",
      native_vegetation_pct: 0,
      agriculture_pct: 0,
      urban_pct: 0,
      water_pct: 0,
      pixel_count: 0,
      collection_version: "collection8",
    };
  }

  const landUseClasses: LandUseClass[] = classEntries
    .map(({ classId, pixelCount }) => {
      const info = getClassInfo(classId);
      return {
        class_id: classId,
        class_name: info.name,
        area_ha: Math.round(pixelCount * PIXEL_AREA_HA * 100) / 100,
        percentage: Math.round((pixelCount / totalPixels) * 10000) / 100,
        color: info.color,
      };
    })
    .sort((a, b) => b.percentage - a.percentage);

  // Calculate category percentages
  let nativeVegPx = 0, agriPx = 0, urbanPx = 0, waterPx = 0;
  for (const { classId, pixelCount } of classEntries) {
    const cat = getClassInfo(classId).category;
    if (cat === "native_vegetation") nativeVegPx += pixelCount;
    else if (cat === "agriculture") agriPx += pixelCount;
    else if (cat === "urban") urbanPx += pixelCount;
    else if (cat === "water") waterPx += pixelCount;
  }

  return {
    reference_year: year,
    land_use_classes: landUseClasses,
    dominant_class: landUseClasses[0]?.class_name || "Sem dados",
    native_vegetation_pct: Math.round((nativeVegPx / totalPixels) * 10000) / 100,
    agriculture_pct: Math.round((agriPx / totalPixels) * 10000) / 100,
    urban_pct: Math.round((urbanPx / totalPixels) * 10000) / 100,
    water_pct: Math.round((waterPx / totalPixels) * 10000) / 100,
    pixel_count: totalPixels,
    collection_version: "collection8",
  };
}

// ============================================================
// Context
// ============================================================

async function buildContext(req: Request): Promise<RequestContext> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const token = authHeader.replace("Bearer ", "");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const serviceSupabase = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("Invalid token");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return { supabase, serviceSupabase, userId: user.id, tenantId: profile?.tenant_id || user.id };
}

// ============================================================
// Helper: Extract coordinates from development — Buchecha fix (DRY)
// ============================================================

interface DevCoords { lat: number; lng: number }

function extractCoordinates(dev: { centroid?: unknown; latitude?: number; longitude?: number }): DevCoords {
  if (dev.centroid) {
    try {
      const parsed = typeof dev.centroid === "string" ? JSON.parse(dev.centroid) : dev.centroid;
      return { lng: parsed.coordinates[0], lat: parsed.coordinates[1] };
    } catch {
      throw new Error("Invalid centroid format");
    }
  }
  if (dev.latitude && dev.longitude) {
    return { lat: dev.latitude, lng: dev.longitude };
  }
  throw new Error("Development has no coordinates");
}

async function fetchDevCoordinates(
  supabase: SupabaseClient,
  developmentId: string
): Promise<DevCoords> {
  const { data: dev } = await supabase
    .from("developments")
    .select("centroid, latitude, longitude")
    .eq("id", developmentId)
    .maybeSingle();

  if (!dev) throw new Error("Development not found");
  return extractCoordinates(dev);
}

// ============================================================
// ACTION: fetch_land_use
// Consulta classificação MapBiomas para um ano específico
// ============================================================

async function handleFetchLandUse(
  ctx: RequestContext,
  params: { development_id: string; year?: number; buffer_radius_m?: number }
): Promise<MapBiomasResult & { cached: boolean }> {
  const { development_id, buffer_radius_m = 1000 } = params;
  const year = params.year || new Date().getFullYear() - 1; // Default: ano anterior

  // Verificar cache
  const { data: cached } = await ctx.serviceSupabase
    .from("development_parcelamento_mapbiomas")
    .select("*")
    .eq("development_id", development_id)
    .eq("reference_year", year)
    .eq("buffer_radius_m", buffer_radius_m)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (cached) {
    return {
      reference_year: cached.reference_year,
      land_use_classes: cached.land_use_classes,
      dominant_class: cached.dominant_class,
      native_vegetation_pct: cached.native_vegetation_pct,
      agriculture_pct: cached.agriculture_pct,
      urban_pct: cached.urban_pct,
      water_pct: cached.water_pct,
      pixel_count: cached.pixel_count,
      collection_version: cached.collection_version,
      cached: true,
    };
  }

  // Buscar coordenadas (helper DRY — Buchecha fix)
  const { lat, lng } = await fetchDevCoordinates(ctx.supabase, development_id);

  // Consultar GEE
  const accessToken = await getGeeAccessToken();
  const result = await computeLandUseForYear(accessToken, lat, lng, buffer_radius_m, year);

  // Salvar cache (service role)
  await ctx.serviceSupabase
    .from("development_parcelamento_mapbiomas")
    .upsert({
      development_id,
      tenant_id: ctx.tenantId,
      latitude: lat,
      longitude: lng,
      buffer_radius_m,
      reference_year: year,
      land_use_classes: result.land_use_classes,
      dominant_class: result.dominant_class,
      native_vegetation_pct: result.native_vegetation_pct,
      agriculture_pct: result.agriculture_pct,
      urban_pct: result.urban_pct,
      water_pct: result.water_pct,
      pixel_count: result.pixel_count,
      collection_version: result.collection_version,
      spatial_resolution_m: 30,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    }, { onConflict: "development_id,reference_year,buffer_radius_m" });

  return { ...result, cached: false };
}

// ============================================================
// ACTION: fetch_time_series
// Histórico temporal (últimos N anos) com análise de tendência
// ============================================================

async function handleFetchTimeSeries(
  ctx: RequestContext,
  params: { development_id: string; start_year?: number; end_year?: number; buffer_radius_m?: number }
): Promise<{
  years: MapBiomasResult[];
  trend: TimeSeriesTrend;
  total_years: number;
  cached_years: number;
}> {
  const currentYear = new Date().getFullYear();
  const {
    development_id,
    start_year = currentYear - 10,
    end_year = currentYear - 1,
    buffer_radius_m = 1000,
  } = params;

  // Validação
  if (end_year < start_year) throw new Error("end_year must be >= start_year");
  if (end_year - start_year > 15) throw new Error("Maximum 15 years range");

  const years: MapBiomasResult[] = [];
  let cachedCount = 0;

  // Buscar coordenadas (helper DRY — Buchecha fix)
  const { lat, lng } = await fetchDevCoordinates(ctx.supabase, development_id);

  // Verificar cache para todos os anos
  const { data: cachedData } = await ctx.serviceSupabase
    .from("development_parcelamento_mapbiomas")
    .select("*")
    .eq("development_id", development_id)
    .eq("buffer_radius_m", buffer_radius_m)
    .gte("reference_year", start_year)
    .lte("reference_year", end_year)
    .gt("expires_at", new Date().toISOString());

  const cachedByYear = new Map<number, NonNullable<typeof cachedData>[number]>();
  for (const row of cachedData || []) {
    cachedByYear.set(row.reference_year, row);
  }

  // Obter access token uma vez (válido 1h)
  let accessToken: string | null = null;

  for (let y = start_year; y <= end_year; y++) {
    const cached = cachedByYear.get(y);
    if (cached) {
      years.push({
        reference_year: cached.reference_year,
        land_use_classes: cached.land_use_classes,
        dominant_class: cached.dominant_class,
        native_vegetation_pct: cached.native_vegetation_pct,
        agriculture_pct: cached.agriculture_pct,
        urban_pct: cached.urban_pct,
        water_pct: cached.water_pct,
        pixel_count: cached.pixel_count,
        collection_version: cached.collection_version,
      });
      cachedCount++;
    } else {
      // Lazy init access token
      if (!accessToken) {
        accessToken = await getGeeAccessToken();
      }
      const result = await computeLandUseForYear(accessToken, lat, lng, buffer_radius_m, y);
      years.push(result);

      // Cache (fire and forget)
      ctx.serviceSupabase
        .from("development_parcelamento_mapbiomas")
        .upsert({
          development_id,
          tenant_id: ctx.tenantId,
          latitude: lat,
          longitude: lng,
          buffer_radius_m,
          reference_year: y,
          land_use_classes: result.land_use_classes,
          dominant_class: result.dominant_class,
          native_vegetation_pct: result.native_vegetation_pct,
          agriculture_pct: result.agriculture_pct,
          urban_pct: result.urban_pct,
          water_pct: result.water_pct,
          pixel_count: result.pixel_count,
          collection_version: result.collection_version,
          spatial_resolution_m: 30,
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
        }, { onConflict: "development_id,reference_year,buffer_radius_m" })
        .then(({ error }) => { if (error) console.error(`Cache upsert failed (year ${y}):`, error.message); })
        .catch((e: Error) => console.error(`Cache upsert exception (year ${y}):`, e.message));
    }
  }

  // Sort by year
  years.sort((a, b) => a.reference_year - b.reference_year);

  // Calculate trend
  const trend = calculateTrend(years);

  // Save trend data to most recent cache entry
  if (years.length > 0) {
    const lastYear = years[years.length - 1].reference_year;
    await ctx.serviceSupabase
      .from("development_parcelamento_mapbiomas")
      .update({ trend_data: trend })
      .eq("development_id", development_id)
      .eq("reference_year", lastYear)
      .eq("buffer_radius_m", buffer_radius_m);
  }

  return {
    years,
    trend,
    total_years: years.length,
    cached_years: cachedCount,
  };
}

function calculateTrend(years: MapBiomasResult[]): TimeSeriesTrend {
  if (years.length < 2) {
    return {
      deforestation_trend: "stable",
      urbanization_trend: "stable",
      native_veg_change_pct: 0,
      years_analyzed: years.map((y) => y.reference_year),
      change_summary: {},
    };
  }

  const first = years[0];
  const last = years[years.length - 1];

  const nativeVegDelta = last.native_vegetation_pct - first.native_vegetation_pct;
  const urbanDelta = last.urban_pct - first.urban_pct;

  // Threshold: +/- 2% = stable
  const threshold = 2;

  const deforestation_trend: "increasing" | "stable" | "decreasing" =
    nativeVegDelta < -threshold ? "increasing" : nativeVegDelta > threshold ? "decreasing" : "stable";

  const urbanization_trend: "increasing" | "stable" | "decreasing" =
    urbanDelta > threshold ? "increasing" : urbanDelta < -threshold ? "decreasing" : "stable";

  // Build change summary for each category
  const changeSummary: Record<string, { start_pct: number; end_pct: number; delta: number }> = {
    native_vegetation: {
      start_pct: first.native_vegetation_pct,
      end_pct: last.native_vegetation_pct,
      delta: Math.round(nativeVegDelta * 100) / 100,
    },
    agriculture: {
      start_pct: first.agriculture_pct,
      end_pct: last.agriculture_pct,
      delta: Math.round((last.agriculture_pct - first.agriculture_pct) * 100) / 100,
    },
    urban: {
      start_pct: first.urban_pct,
      end_pct: last.urban_pct,
      delta: Math.round(urbanDelta * 100) / 100,
    },
    water: {
      start_pct: first.water_pct,
      end_pct: last.water_pct,
      delta: Math.round((last.water_pct - first.water_pct) * 100) / 100,
    },
  };

  return {
    deforestation_trend,
    urbanization_trend,
    native_veg_change_pct: Math.round(nativeVegDelta * 100) / 100,
    years_analyzed: years.map((y) => y.reference_year),
    change_summary: changeSummary,
  };
}

// ============================================================
// ACTION: get_cached
// Retorna todos os dados cacheados para um development
// ============================================================

async function handleGetCached(
  ctx: RequestContext,
  params: { development_id: string }
): Promise<{
  entries: Array<{
    reference_year: number;
    dominant_class: string;
    native_vegetation_pct: number;
    agriculture_pct: number;
    urban_pct: number;
    water_pct: number;
    fetched_at: string;
    expires_at: string;
  }>;
  count: number;
  has_trend: boolean;
}> {
  const { data } = await ctx.supabase
    .from("development_parcelamento_mapbiomas")
    .select("reference_year, dominant_class, native_vegetation_pct, agriculture_pct, urban_pct, water_pct, fetched_at, expires_at, trend_data")
    .eq("development_id", params.development_id)
    .order("reference_year", { ascending: true });

  const entries = (data || []).map((row) => ({
    reference_year: row.reference_year,
    dominant_class: row.dominant_class,
    native_vegetation_pct: row.native_vegetation_pct,
    agriculture_pct: row.agriculture_pct,
    urban_pct: row.urban_pct,
    water_pct: row.water_pct,
    fetched_at: row.fetched_at,
    expires_at: row.expires_at,
  }));

  return {
    entries,
    count: entries.length,
    has_trend: (data || []).some((r) => r.trend_data != null),
  };
}

// ============================================================
// Router
// ============================================================

Deno.serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  try {
    const { action, params } = await req.json();

    const ctx = await buildContext(req);

    let data: unknown;

    switch (action) {
      case "fetch_land_use":
        data = await handleFetchLandUse(ctx, params);
        break;
      case "fetch_time_series":
        data = await handleFetchTimeSeries(ctx, params);
        break;
      case "get_cached":
        data = await handleGetCached(ctx, params);
        break;
      default:
        return new Response(
          JSON.stringify({ error: { code: "INVALID_ACTION", message: `Unknown action: ${action}` } }),
          { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({ data }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message.includes("Unauthorized") || message.includes("Invalid token") ? 401 : 500;
    return new Response(
      JSON.stringify({ error: { code: status === 401 ? "UNAUTHORIZED" : "INTERNAL_ERROR", message } }),
      { status, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});
