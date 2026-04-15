/**
 * kmlParser.ts — Parser de arquivos KML/KMZ para extração de geometria de terrenos
 *
 * Suporta KML puro e KMZ (ZIP contendo doc.kml).
 * Retorna coordenadas no formato [lng, lat][] compatível com GeoJSON e Mapbox.
 *
 * US-62 (Bloco J Sessão 148): Validação de geometria — auto-intersecção (via Turf kinks),
 * área zero, e coordenadas fora do Brasil.
 */

import * as turf from "@turf/turf";

// ---------------------------------------------------------------------------
// Types — alinhados com o contrato esperado por ParcelamentoNovo.tsx
// ---------------------------------------------------------------------------

/**
 * Resultado da validação do polígono (US-62).
 * isValid=true apenas quando não há erros (warnings são tolerados).
 */
export interface ValidationResult {
  isValid: boolean;
  /** Erros bloqueantes — o polígono NÃO deve ser aceito */
  errors: string[];
  /** Avisos não-bloqueantes — polígono aceito mas com ressalvas */
  warnings: string[];
  /** Nº de auto-intersecções detectadas (0 = limpo) */
  selfIntersectionCount: number;
}

/**
 * Resultado do parse — objeto `data` que o componente armazena em estado.
 * coordinates: pares [lng, lat] indexáveis por [0] e [1] (compatível com GeoJSON).
 */
export interface KMLParseResult {
  /** Coordenadas do polígono principal: [lng, lat][] */
  coordinates: [number, number][];
  /** Nome do placemark (ou "Área" se ausente) */
  name: string;
  /** Área estimada em m² (fórmula esférica) */
  area_m2: number;
  /** Perímetro em metros (Haversine) */
  perimeter_m: number;
  /** Centróide geométrico {lng, lat} */
  centroid: { lng: number; lat: number };
}

/** Retorno de parseKmlFile */
export interface ParseKmlFileReturn {
  ok: boolean;
  data?: KMLParseResult;
  error?: string | null;
  /** Resultado da validação de geometria (US-62). Sempre presente quando ok=true. */
  validation?: ValidationResult;
}

// ---------------------------------------------------------------------------
// Geo math helpers
// ---------------------------------------------------------------------------

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine distance between two [lng, lat] points in meters */
function haversineDistance(a: [number, number], b: [number, number]): number {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const c =
    sinDLat * sinDLat +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(c));
}

/** Área aproximada em m² — fórmula esférica (Shoelace adaptado) */
function computeArea(coords: [number, number][]): number {
  if (coords.length < 3) return 0;
  let area = 0;
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area +=
      toRad(coords[j][0] - coords[i][0]) *
      (2 + Math.sin(toRad(coords[i][1])) + Math.sin(toRad(coords[j][1])));
  }
  return Math.abs((area * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

/** Perímetro em metros — soma de segmentos Haversine */
function computePerimeter(coords: [number, number][]): number {
  if (coords.length < 2) return 0;
  let perimeter = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    perimeter += haversineDistance(coords[i], coords[i + 1]);
  }
  return perimeter;
}

/** Centróide aritmético {lng, lat} */
function computeCentroid(coords: [number, number][]): { lng: number; lat: number } {
  if (coords.length === 0) return { lng: 0, lat: 0 };
  const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return { lng, lat };
}

// ---------------------------------------------------------------------------
// KML string parser
// ---------------------------------------------------------------------------

/** Parseia string de coordenadas KML "lng,lat,alt lng,lat,alt ..." → [lng, lat][] */
function parseCoordinateString(raw: string): [number, number][] {
  return raw
    .trim()
    .split(/\s+/)
    .map((triplet) => {
      const parts = triplet.split(",").map(Number);
      if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
      return [parts[0], parts[1]] as [number, number];
    })
    .filter((c): c is [number, number] => c !== null);
}

interface RawPolygon {
  name: string;
  coordinates: [number, number][];
  area_m2: number;
}

function extractPolygonsFromKML(kmlString: string): RawPolygon[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(kmlString, "text/xml");

  // Check for XML parse error
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Arquivo KML inválido ou corrompido");
  }

  const placemarks = Array.from(doc.querySelectorAll("Placemark"));
  const polygons: RawPolygon[] = [];

  for (const placemark of placemarks) {
    const nameEl = placemark.querySelector("name");
    const name = nameEl?.textContent?.trim() || "Área";

    // Polygon > outerBoundaryIs > LinearRing > coordinates
    const coordsEls = placemark.querySelectorAll(
      "Polygon outerBoundaryIs LinearRing coordinates"
    );
    for (const coordsEl of coordsEls) {
      const coords = parseCoordinateString(coordsEl.textContent ?? "");
      if (coords.length < 3) continue;
      polygons.push({ name, coordinates: coords, area_m2: computeArea(coords) });
    }

    // Fallback: LineString coordinates (some exports use LineString for area)
    if (polygons.length === 0) {
      const lineEls = placemark.querySelectorAll("LineString coordinates");
      for (const lineEl of lineEls) {
        const coords = parseCoordinateString(lineEl.textContent ?? "");
        if (coords.length < 3) continue;
        polygons.push({ name, coordinates: coords, area_m2: computeArea(coords) });
      }
    }
  }

  return polygons;
}

// ---------------------------------------------------------------------------
// KMZ reader (ZIP contendo doc.kml ou qualquer .kml)
// ---------------------------------------------------------------------------

async function readKMZ(file: File): Promise<string> {
  // Dynamic import para não travar o bundle quando JSZip não for necessário
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let JSZip: any;
  try {
    JSZip = (await import("jszip")).default;
  } catch {
    throw new Error("Biblioteca JSZip não disponível. KMZ não suportado neste ambiente.");
  }

  const zip = await JSZip.loadAsync(file);

  // Encontrar qualquer arquivo .kml dentro do ZIP
  const kmlEntry = Object.values(zip.files).find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (f: any) => typeof f.name === "string" && f.name.toLowerCase().endsWith(".kml")
  ) as { async: (type: string) => Promise<string> } | undefined;

  if (!kmlEntry) {
    throw new Error("Nenhum arquivo .kml encontrado dentro do KMZ");
  }

  return kmlEntry.async("string");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// US-62: Validação de geometria do polígono
// ---------------------------------------------------------------------------

/**
 * BBox aproximado do Brasil (mainland + ilhas oceânicas).
 * Lng: -73.99 (Acre) a -28.65 (Martim Vaz)
 * Lat: -33.75 (Chuí/RS) a 5.27 (Uiramutã/RR)
 * Margem extra de 1° para evitar falsos positivos em bordas.
 */
const BRAZIL_BBOX = {
  minLng: -75.0,
  maxLng: -27.5,
  minLat: -35.0,
  maxLat: 6.5,
};

/**
 * Valida a geometria do polígono extraído do KML/KMZ.
 *
 * Verificações:
 *  1. Área próxima de zero (< 100 m²) — polígono inválido
 *  2. Auto-intersecção — via turf.kinks() — polígono inválido
 *  3. Coordenadas fora do Brasil — aviso não bloqueante
 */
export function validatePolygon(coords: [number, number][]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let selfIntersectionCount = 0;

  // ── 1. Área zero ────────────────────────────────────────────────────────
  const area = computeArea(coords);
  if (area < 100) {
    errors.push(
      `Área do polígono é praticamente zero (${area.toFixed(1)} m²). ` +
        "Verifique se o arquivo KMZ contém um polígono válido."
    );
  }

  // ── 2. Auto-intersecção via Turf ─────────────────────────────────────────
  try {
    // Turf.polygon exige o anel fechado (primeiro = último ponto)
    const closed: [number, number][] =
      coords.length > 0 &&
      coords[0][0] === coords[coords.length - 1][0] &&
      coords[0][1] === coords[coords.length - 1][1]
        ? coords
        : [...coords, coords[0]];

    const turfPoly = turf.polygon([closed.map((c) => [c[0], c[1]])]);
    const kinks = turf.kinks(turfPoly);
    selfIntersectionCount = kinks.features.length;

    if (selfIntersectionCount > 0) {
      errors.push(
        `Polígono auto-intersectante: ${selfIntersectionCount} cruzamento(s) detectado(s). ` +
          "O arquivo pode estar corrompido ou usar uma projeção incompatível."
      );
    }
  } catch {
    warnings.push(
      "Não foi possível verificar auto-intersecção do polígono. " +
        "Prossiga com cautela."
    );
  }

  // ── 3. Coordenadas fora do Brasil ────────────────────────────────────────
  const outOfBound = coords.some(
    ([lng, lat]) =>
      lng < BRAZIL_BBOX.minLng ||
      lng > BRAZIL_BBOX.maxLng ||
      lat < BRAZIL_BBOX.minLat ||
      lat > BRAZIL_BBOX.maxLat
  );
  if (outOfBound) {
    warnings.push(
      "Algumas coordenadas estão fora dos limites do Brasil. " +
        "Verifique se o arquivo usa projeção WGS-84 (EPSG:4326)."
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    selfIntersectionCount,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parseia um arquivo KML ou KMZ e retorna os dados do polígono principal.
 *
 * Retorno: { ok, data?, error?, validation? }
 * - data.coordinates: [lng, lat][] — compatível com GeoJSON / Mapbox
 * - data.area_m2, data.perimeter_m, data.centroid, data.name
 * - validation: resultado das verificações US-62 (auto-intersecção, área, bbox)
 */
export async function parseKmlFile(file: File): Promise<ParseKmlFileReturn> {
  try {
    let kmlString: string;

    const lower = file.name.toLowerCase();
    if (lower.endsWith(".kmz")) {
      kmlString = await readKMZ(file);
    } else {
      kmlString = await file.text();
    }

    const rawPolygons = extractPolygonsFromKML(kmlString);

    if (rawPolygons.length === 0) {
      return {
        ok: false,
        error:
          "Nenhum polígono encontrado no arquivo. Verifique se o KMZ/KML contém um Polygon ou LinearRing.",
      };
    }

    // Polígono principal = maior área
    const primary = rawPolygons.reduce(
      (best, p) => (p.area_m2 > best.area_m2 ? p : best),
      rawPolygons[0]
    );

    const data: KMLParseResult = {
      coordinates: primary.coordinates,
      name: primary.name,
      area_m2: primary.area_m2,
      perimeter_m: computePerimeter(primary.coordinates),
      centroid: computeCentroid(primary.coordinates),
    };

    // US-62: Validar geometria do polígono principal
    const validation = validatePolygon(primary.coordinates);

    return { ok: true, data, validation };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao processar arquivo";
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

/**
 * Formata área SEMPRE em m² (com separador de milhar pt-BR).
 *
 * ⚠️ Sessão 130 CONT3 — decisão UX Marcelo: NUNCA exibir hectares no
 * frontend do módulo Parcelamento. Usuários do setor preferem m² direto.
 * Mantida como alias de `formatAreaM2` para compatibilidade backward.
 */
export function formatArea(area_m2: number): string {
  return formatAreaM2(area_m2);
}

/**
 * Formata área SEMPRE em m² (sem conversão automática pra hectares).
 * Usado no wizard de novo projeto (Sessão 130) — decisão de UX do Marcelo:
 * usuários do setor preferem ver m² direto, mesmo em áreas grandes.
 */
export function formatAreaM2(area_m2: number): string {
  return `${area_m2.toLocaleString("pt-BR", {
    maximumFractionDigits: 0,
  })} m²`;
}

/** Formata perímetro em metros ou km */
export function formatPerimeter(perimeter_m: number): string {
  if (perimeter_m >= 1_000) {
    return `${(perimeter_m / 1_000).toLocaleString("pt-BR", {
      maximumFractionDigits: 2,
    })} km`;
  }
  return `${perimeter_m.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} m`;
}
