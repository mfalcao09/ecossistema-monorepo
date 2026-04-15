/**
 * geoTransform.ts
 * Utilitários para conversão de coordenadas geográficas ↔ pixels do canvas
 * e cálculos geométricos (área, perímetro, distância).
 */

// ─── Haversine distance (metros) ─────────────────────────────────────────────

const R = 6371000; // Earth radius in meters

export function haversineM(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number]
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ─── Polygon area (Shoelace formula in meters²) ──────────────────────────────

function toRadians(deg: number) {
  return (deg * Math.PI) / 180;
}

export function computeAreaM2(coords: [number, number][]): number {
  if (coords.length < 3) return 0;
  // Use spherical excess formula approximated for small polygons
  // Convert to meters using a local equirectangular projection
  const latRef = coords[0][1];
  const cosLat = Math.cos(toRadians(latRef));
  const pts = coords.map(([lng, lat]) => ({
    x: toRadians(lng) * R * cosLat,
    y: toRadians(lat) * R,
  }));
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return Math.abs(area / 2);
}

export function computePerimeterM(coords: [number, number][], closed = true): number {
  let perim = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    perim += haversineM(coords[i], coords[i + 1]);
  }
  if (closed && coords.length > 2) {
    perim += haversineM(coords[coords.length - 1], coords[0]);
  }
  return perim;
}

export function segmentLengthM(p1: [number, number], p2: [number, number]): number {
  return haversineM(p1, p2);
}

// ─── Snap-to-vertex ──────────────────────────────────────────────────────────

/**
 * Given a cursor in geo coords and a list of existing elements,
 * find the nearest vertex within `thresholdPx` pixels (using map projection).
 * Returns the snapped coordinate or null.
 */
export function findSnapVertex(
  cursor: [number, number],
  allVertices: [number, number][],
  thresholdPx: number,
  projectFn: (coord: [number, number]) => { x: number; y: number }
): [number, number] | null {
  const cursorPx = projectFn(cursor);
  let bestDist = Infinity;
  let bestCoord: [number, number] | null = null;

  for (const v of allVertices) {
    const vPx = projectFn(v);
    const dx = cursorPx.x - vPx.x;
    const dy = cursorPx.y - vPx.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < thresholdPx && dist < bestDist) {
      bestDist = dist;
      bestCoord = v;
    }
  }
  return bestCoord;
}

// ─── Format helpers ───────────────────────────────────────────────────────────

export function formatArea(m2: number): string {
  if (m2 >= 10000) return `${(m2 / 10000).toFixed(2)} ha`;
  return `${m2.toFixed(0)} m²`;
}

export function formatLength(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${m.toFixed(1)} m`;
}

// ─── Midpoint ────────────────────────────────────────────────────────────────

export function midpoint(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number]
): [number, number] {
  return [(lng1 + lng2) / 2, (lat1 + lat2) / 2];
}

// ─── Bounding box center ──────────────────────────────────────────────────────

export function coordsCenter(coords: [number, number][]): [number, number] {
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return [
    (Math.min(...lngs) + Math.max(...lngs)) / 2,
    (Math.min(...lats) + Math.max(...lats)) / 2,
  ];
}

// ─── SVG path from pixel points ───────────────────────────────────────────────

export function buildSvgPath(
  pixelPoints: { x: number; y: number }[],
  closed = true
): string {
  if (pixelPoints.length === 0) return '';
  const parts = pixelPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`);
  if (closed) parts.push('Z');
  return parts.join(' ');
}

// ─── Pixel distance ───────────────────────────────────────────────────────────

export function pixelDist(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
