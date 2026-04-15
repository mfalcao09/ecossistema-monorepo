/**
 * geoExport.ts — Export de geometria de terreno em múltiplos formatos (US-60, Bloco J)
 *
 * Formatos suportados (100% client-side, sem Edge Functions):
 *   - GeoJSON  → JSON string padrão RFC 7946
 *   - KML      → Keyhole Markup Language (Google Earth)
 *   - KMZ      → KML comprimido (ZIP via JSZip)
 *   - DXF      → AutoCAD Drawing Exchange Format R12 (polilinha 2D)
 *
 * Sessão 148 — Bloco J (Geo Avançado)
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

// ---------------------------------------------------------------------------
// Helpers de download
// ---------------------------------------------------------------------------

/** Dispara download de uma string como arquivo */
export function downloadString(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  triggerBlobDownload(blob, filename);
}

/** Dispara download de um Blob */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Slug safe para nomes de arquivo */
function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .toLowerCase()
    .slice(0, 60);
}

// ---------------------------------------------------------------------------
// GeoJSON (RFC 7946)
// ---------------------------------------------------------------------------

/**
 * Gera GeoJSON FeatureCollection com o polígono do terreno.
 * Fecha o anel automaticamente (primeiro === último ponto).
 */
export function buildGeoJSON(
  coords: [number, number][],
  name: string,
  area_m2: number
): string {
  const ring: [number, number][] =
    coords.length > 0 &&
    coords[0][0] === coords[coords.length - 1][0] &&
    coords[0][1] === coords[coords.length - 1][1]
      ? coords
      : [...coords, coords[0]];

  const geojson = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          name,
          area_m2: Math.round(area_m2),
          source: "Intentus Real Estate Platform",
        },
        geometry: {
          type: "Polygon",
          coordinates: [ring.map((c) => [c[0], c[1]])],
        },
      },
    ],
  };
  return JSON.stringify(geojson, null, 2);
}

export function exportAsGeoJSON(
  coords: [number, number][],
  name: string,
  area_m2: number
): void {
  const content = buildGeoJSON(coords, name, area_m2);
  downloadString(content, `${slugify(name)}_terreno.geojson`, "application/geo+json");
}

// ---------------------------------------------------------------------------
// KML
// ---------------------------------------------------------------------------

/**
 * Gera string KML com o polígono (estilo amarelo semitransparente).
 */
export function buildKML(coords: [number, number][], name: string): string {
  const closed: [number, number][] =
    coords.length > 0 &&
    coords[0][0] === coords[coords.length - 1][0] &&
    coords[0][1] === coords[coords.length - 1][1]
      ? coords
      : [...coords, coords[0]];

  const coordStr = closed.map((c) => `${c[0]},${c[1]},0`).join(" ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${name}</name>
    <description>Exportado pelo Intentus Real Estate Platform</description>
    <Style id="terreno-style">
      <LineStyle>
        <color>ff0000ff</color>
        <width>2</width>
      </LineStyle>
      <PolyStyle>
        <color>660000ff</color>
      </PolyStyle>
    </Style>
    <Placemark>
      <name>${name}</name>
      <styleUrl>#terreno-style</styleUrl>
      <Polygon>
        <extrude>0</extrude>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coordStr}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;
}

export function exportAsKML(coords: [number, number][], name: string): void {
  const content = buildKML(coords, name);
  downloadString(content, `${slugify(name)}_terreno.kml`, "application/vnd.google-earth.kml+xml");
}

// ---------------------------------------------------------------------------
// KMZ (KML comprimido com JSZip)
// ---------------------------------------------------------------------------

export async function exportAsKMZ(coords: [number, number][], name: string): Promise<void> {
  // Importação dinâmica — JSZip já é usado em kmlParser.ts da mesma forma
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let JSZip: any;
  try {
    JSZip = (await import("jszip")).default;
  } catch {
    throw new Error("Biblioteca JSZip não disponível. KMZ não suportado neste ambiente.");
  }

  const kmlContent = buildKML(coords, name);
  const zip = new JSZip();
  zip.file("doc.kml", kmlContent);

  const blob: Blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  triggerBlobDownload(blob, `${slugify(name)}_terreno.kmz`);
}

// ---------------------------------------------------------------------------
// DXF (AutoCAD R12 — polilinha 2D fechada)
// ---------------------------------------------------------------------------

/**
 * Gera string DXF R12 com LWPOLYLINE fechada representando o terreno.
 * Compatível com AutoCAD, QGIS, LibreCAD e outros softwares CAD.
 */
export function buildDXF(coords: [number, number][], name: string): string {
  // DXF usa coordenadas em m — aqui usamos lng/lat diretamente (graus decimais).
  // Para precisão em CAD, o usuário deve reprojetar em software dedicado.
  const polylineVertices = coords
    .map(
      ([lng, lat]) =>
        ` 10\n${lng.toFixed(8)}\n 20\n${lat.toFixed(8)}\n 30\n0.0`
    )
    .join("\n");

  return `  0\nSECTION\n  2\nHEADER\n  9\n$ACADVER\n  1\nAC1009\n` +
    `  9\n$EXTMIN\n 10\n${Math.min(...coords.map((c) => c[0])).toFixed(8)}\n` +
    ` 20\n${Math.min(...coords.map((c) => c[1])).toFixed(8)}\n 30\n0.0\n` +
    `  9\n$EXTMAX\n 10\n${Math.max(...coords.map((c) => c[0])).toFixed(8)}\n` +
    ` 20\n${Math.max(...coords.map((c) => c[1])).toFixed(8)}\n 30\n0.0\n` +
    `  0\nENDSEC\n  0\nSECTION\n  2\nENTITIES\n` +
    `  0\nLWPOLYLINE\n  8\nTERRENO\n  6\nCONTINUOUS\n 62\n3\n` +
    ` 70\n1\n` + // flag 1 = closed
    ` 90\n${coords.length}\n` +
    polylineVertices + `\n` +
    `  0\nTEXT\n  8\nTEXTOS\n 10\n${coords[0][0].toFixed(8)}\n 20\n${coords[0][1].toFixed(8)}\n 30\n0.0\n` +
    ` 40\n0.00005\n  1\n${name}\n` +
    `  0\nENDSEC\n  0\nEOF\n`;
}

export function exportAsDXF(coords: [number, number][], name: string): void {
  const content = buildDXF(coords, name);
  downloadString(content, `${slugify(name)}_terreno.dxf`, "application/dxf");
}

// ---------------------------------------------------------------------------
// Export registry — mapa de formato → função de download
// ---------------------------------------------------------------------------

export type GeoExportFormat = "geojson" | "kml" | "kmz" | "dxf";

export interface GeoExportOption {
  format: GeoExportFormat;
  label: string;
  ext: string;
  description: string;
  icon: string; // lucide icon name
}

export const GEO_EXPORT_OPTIONS: GeoExportOption[] = [
  {
    format: "geojson",
    label: "GeoJSON",
    ext: ".geojson",
    description: "Padrão web para dados geoespaciais. Compatível com QGIS, Mapbox, PostGIS.",
    icon: "Globe",
  },
  {
    format: "kml",
    label: "KML",
    ext: ".kml",
    description: "Google Earth / Maps. Visualização e compartilhamento.",
    icon: "MapPin",
  },
  {
    format: "kmz",
    label: "KMZ",
    ext: ".kmz",
    description: "KML comprimido (ZIP). Menor tamanho, compatível com Google Earth.",
    icon: "Package",
  },
  {
    format: "dxf",
    label: "DXF",
    ext: ".dxf",
    description: "AutoCAD R12. Para escritórios de engenharia e arquitetura.",
    icon: "Ruler",
  },
];
