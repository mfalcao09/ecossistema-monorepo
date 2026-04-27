/**
 * ParcelamentoTopografiaPanel — Sprint A + C (sessão 155)
 *
 * 3 features topográficas client-side:
 *  - Hillshade Mapbox nativo (raster-dem source + hillshade layer)
 *  - Slope Heatmap (grid colorido por classe de declividade, lendo elevation_grid)
 *  - Suitability Score (composição local: slope + APP + servidões)
 *
 * Cut/Fill 3D fica no TerrainViewer3D (aba "Análise 3D").
 */

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Mountain, Layers3, Target } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import * as turf from "@turf/turf";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapboxMap = any;

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: MapboxMap | null;
  mapReady: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  project: any;
  /** Camadas ANEEL/EPE ativas (LT existentes/planejadas) — usadas no suitability score */
  ltExistentes?: GeoJSON.FeatureCollection;
  ltPlanejadas?: GeoJSON.FeatureCollection;
}

// Classes de slope (% de declividade) com cores (Lei 6.766 + boas práticas)
// 0-3%   verde     — plano (ideal)
// 3-8%   verde-amarelo — suave (ótimo)
// 8-15%  amarelo   — moderado (aceitável)
// 15-30% laranja   — forte (restrição lei 6.766 art. 4 §3)
// 30-45% vermelho-claro — íngreme (não loteável Lei 6.766)
// >45%   vermelho — crítico (APP por declividade)
const SLOPE_COLORS = [
  { max: 3, color: "#16a34a", label: "0-3% plano" },
  { max: 8, color: "#84cc16", label: "3-8% suave" },
  { max: 15, color: "#eab308", label: "8-15% moderado" },
  { max: 30, color: "#f97316", label: "15-30% forte" },
  { max: 45, color: "#ef4444", label: "30-45% íngreme" },
  { max: 9999, color: "#7f1d1d", label: ">45% crítico" },
];

function colorForSlope(slopePct: number): string {
  for (const c of SLOPE_COLORS) {
    if (slopePct <= c.max) return c.color;
  }
  return SLOPE_COLORS[SLOPE_COLORS.length - 1].color;
}

interface SlopeCell {
  bbox: [number, number, number, number]; // minLng, minLat, maxLng, maxLat
  slope: number;
  elevation: number;
}

/**
 * Calcula slope (%) por célula a partir do grid de elevação + bbox do projeto.
 * Slope local = max(|dz/dx|, |dz/dy|) * 100 entre célula e vizinhos.
 */
function computeSlopeGrid(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  project: any,
): SlopeCell[] {
  const grid = project?.elevation_grid?.grid;
  const bbox = project?.elevation_grid?.bbox ?? project?.bbox;
  if (!grid || !Array.isArray(grid) || grid.length < 2 || !bbox) return [];

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (cols < 2) return [];

  const { south, north, west, east } = bbox as Record<string, number>;
  const cellLat = (north - south) / rows;
  const cellLng = (east - west) / cols;

  // Distância em metros (geodésica aproximada)
  const latMid = (north + south) / 2;
  const dyMeters = cellLat * 111_000;
  const dxMeters = cellLng * 111_000 * Math.cos((latMid * Math.PI) / 180);

  const cells: SlopeCell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const z = grid[r][c];
      if (typeof z !== "number") continue;
      const zRight = c + 1 < cols ? grid[r][c + 1] : z;
      const zDown = r + 1 < rows ? grid[r + 1][c] : z;
      const dzdx = Math.abs(zRight - z) / Math.max(1, dxMeters);
      const dzdy = Math.abs(zDown - z) / Math.max(1, dyMeters);
      const slopePct = Math.max(dzdx, dzdy) * 100;

      const cellWest = west + c * cellLng;
      const cellEast = cellWest + cellLng;
      // Lat invertida (grid topo-baixo vs lat sul-norte)
      const cellNorth = north - r * cellLat;
      const cellSouth = cellNorth - cellLat;

      cells.push({
        bbox: [cellWest, cellSouth, cellEast, cellNorth],
        slope: slopePct,
        elevation: z,
      });
    }
  }
  return cells;
}

function slopeGridToGeoJSON(cells: SlopeCell[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: cells.map((cell) => ({
      type: "Feature",
      properties: {
        slope: Math.round(cell.slope * 10) / 10,
        elevation: Math.round(cell.elevation * 10) / 10,
        color: colorForSlope(cell.slope),
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [cell.bbox[0], cell.bbox[1]],
            [cell.bbox[2], cell.bbox[1]],
            [cell.bbox[2], cell.bbox[3]],
            [cell.bbox[0], cell.bbox[3]],
            [cell.bbox[0], cell.bbox[1]],
          ],
        ],
      },
    })),
  };
}

// ----------------------------------------------------------------------------
// Suitability Score — composição local de fatores
// ----------------------------------------------------------------------------

interface SuitabilityResult {
  score: number; // 0-100
  classification: "Excelente" | "Bom" | "Regular" | "Restrito" | "Crítico";
  color: string;
  factors: { name: string; weight: number; value: number; impact: number }[];
}

function computeSuitability(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  project: any,
  ltExistentes?: GeoJSON.FeatureCollection,
): SuitabilityResult | null {
  if (!project) return null;

  // Slope médio (já vem da EF) — ideal <8%
  const slopeAvg = Number(project.slope_avg_pct ?? 0);
  // Slope penaliza não-linearmente: até 5% = 0, 5-15% = 0-30 pts, >30% = 80 pts
  let slopePenalty = 0;
  if (slopeAvg <= 5) slopePenalty = 0;
  else if (slopeAvg <= 15) slopePenalty = ((slopeAvg - 5) / 10) * 30;
  else if (slopeAvg <= 30) slopePenalty = 30 + ((slopeAvg - 15) / 15) * 30;
  else slopePenalty = 60 + Math.min(20, (slopeAvg - 30) * 1);

  // APP — penalidade por % declarado/calculado
  const areaM2 = Number(project.area_m2 ?? 0);
  const appPct =
    areaM2 > 0
      ? (Number(project.app_area_m2 ?? 0) / areaM2) * 100
      : Number(project.pct_app_declarado ?? 0);
  // APP até 10% = neutro; >10% começa a comer área útil
  const appPenalty = Math.max(0, (appPct - 10) * 0.8);

  // LT cruzando o terreno — alerta forte
  let ltPenalty = 0;
  try {
    if (ltExistentes && project.geometry_coordinates) {
      const ring = project.geometry_coordinates as [number, number][];
      if (ring.length >= 3) {
        const closed =
          ring[0][0] === ring[ring.length - 1][0] ? ring : [...ring, ring[0]];
        const poly = turf.polygon([closed]);
        for (const f of ltExistentes.features ?? []) {
          if (f.geometry?.type !== "LineString") continue;
          if (turf.booleanIntersects(f, poly)) {
            ltPenalty = 25; // LT cruza = -25 pts
            break;
          }
        }
      }
    }
  } catch (e) {
    console.warn("[Suitability] LT check falhou:", e);
  }

  // Reserva legal
  const rlPct = Number(project.reserva_legal_pct ?? 20);
  // RL > 20% (cerrado/MA) penaliza pq come área útil
  const rlPenalty = Math.max(0, (rlPct - 20) * 0.5);

  const factors = [
    { name: "Declividade", weight: 35, value: slopeAvg, impact: slopePenalty },
    { name: "APP", weight: 20, value: appPct, impact: appPenalty },
    {
      name: "Servidão LT",
      weight: 25,
      value: ltPenalty > 0 ? 1 : 0,
      impact: ltPenalty,
    },
    { name: "Reserva Legal", weight: 10, value: rlPct, impact: rlPenalty },
  ];

  const totalPenalty = slopePenalty + appPenalty + ltPenalty + rlPenalty;
  const score = Math.max(0, Math.round(100 - totalPenalty));

  let classification: SuitabilityResult["classification"];
  let color: string;
  if (score >= 85) {
    classification = "Excelente";
    color = "#16a34a";
  } else if (score >= 70) {
    classification = "Bom";
    color = "#84cc16";
  } else if (score >= 50) {
    classification = "Regular";
    color = "#eab308";
  } else if (score >= 30) {
    classification = "Restrito";
    color = "#f97316";
  } else {
    classification = "Crítico";
    color = "#ef4444";
  }

  return { score, classification, color, factors };
}

// ============================================================================
// Component
// ============================================================================

export default function ParcelamentoTopografiaPanel({
  map,
  mapReady,
  project,
  ltExistentes,
}: Props) {
  const [hillshadeOn, setHillshadeOn] = useState(false);
  const [slopeOn, setSlopeOn] = useState(false);

  const slopeCells = useMemo(() => computeSlopeGrid(project), [project]);
  const slopeFC = useMemo(() => slopeGridToGeoJSON(slopeCells), [slopeCells]);
  const slopeStats = useMemo(() => {
    if (!slopeCells.length) return null;
    const slopes = slopeCells.map((c) => c.slope);
    const max = Math.max(...slopes);
    const above30 = slopes.filter((s) => s > 30).length;
    return {
      max: Math.round(max * 10) / 10,
      above30Pct: Math.round((above30 / slopes.length) * 1000) / 10,
    };
  }, [slopeCells]);

  const suitability = useMemo(
    () => computeSuitability(project, ltExistentes),
    [project, ltExistentes],
  );

  // ---------------------------------------------------------------------------
  // Hillshade — Mapbox raster-dem nativo
  // ---------------------------------------------------------------------------
  const toggleHillshade = useCallback(() => {
    if (!map || !mapReady) return;
    const newOn = !hillshadeOn;
    setHillshadeOn(newOn);

    try {
      if (!map.getSource("src-hillshade-dem")) {
        map.addSource("src-hillshade-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.terrain-rgb",
          tileSize: 512,
          maxzoom: 14,
        });
      }
      if (!map.getLayer("layer-hillshade")) {
        map.addLayer(
          {
            id: "layer-hillshade",
            source: "src-hillshade-dem",
            type: "hillshade",
            paint: {
              "hillshade-shadow-color": "#1e293b",
              "hillshade-highlight-color": "#fef3c7",
              "hillshade-accent-color": "#475569",
              "hillshade-exaggeration": 0.6,
            },
          },
          "layer-project-boundary-fill",
        ); // sob o polígono do projeto
      }
      map.setLayoutProperty(
        "layer-hillshade",
        "visibility",
        newOn ? "visible" : "none",
      );
    } catch (e) {
      console.warn("[Topografia] hillshade falhou:", e);
    }
  }, [map, mapReady, hillshadeOn]);

  // ---------------------------------------------------------------------------
  // Slope heatmap — fill layer com data-driven color
  // ---------------------------------------------------------------------------
  const toggleSlope = useCallback(() => {
    if (!map || !mapReady) return;
    const newOn = !slopeOn;
    setSlopeOn(newOn);

    try {
      if (!map.getSource("src-slope-heatmap")) {
        map.addSource("src-slope-heatmap", { type: "geojson", data: slopeFC });
      } else {
        map.getSource("src-slope-heatmap").setData(slopeFC);
      }
      if (!map.getLayer("layer-slope-heatmap")) {
        map.addLayer(
          {
            id: "layer-slope-heatmap",
            source: "src-slope-heatmap",
            type: "fill",
            paint: {
              "fill-color": ["get", "color"],
              "fill-opacity": 0.55,
            },
          },
          "layer-project-boundary-fill",
        );
      }
      map.setLayoutProperty(
        "layer-slope-heatmap",
        "visibility",
        newOn ? "visible" : "none",
      );
    } catch (e) {
      console.warn("[Topografia] slope heatmap falhou:", e);
    }
  }, [map, mapReady, slopeOn, slopeFC]);

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Mountain className="h-3.5 w-3.5 text-emerald-700" />
          <p className="text-xs font-semibold text-gray-800">Topografia</p>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-gray-500">
          Copernicus 30m
        </span>
      </div>

      {/* Hillshade — relevo visual */}
      <div className="flex items-start justify-between gap-2 pt-1">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Layers3 className="h-3 w-3 text-emerald-600 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-[11px] font-medium text-gray-800 block">
              Relevo (Hillshade)
            </span>
            <span className="text-[10px] text-gray-500">
              Mapbox terrain-rgb · sombreamento global
            </span>
          </div>
        </div>
        <Switch
          checked={hillshadeOn}
          disabled={!mapReady}
          onCheckedChange={toggleHillshade}
          aria-label="Toggle hillshade"
        />
      </div>

      {/* Slope heatmap */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Mountain className="h-3 w-3 text-emerald-600 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-[11px] font-medium text-gray-800 block">
              Declividade (heatmap)
            </span>
            <span className="text-[10px] text-gray-500">
              {slopeCells.length > 0
                ? `${slopeCells.length} células · max ${slopeStats?.max ?? 0}%`
                : "Aguardando elevation_grid…"}
            </span>
          </div>
        </div>
        <Switch
          checked={slopeOn}
          disabled={!mapReady || slopeCells.length === 0}
          onCheckedChange={toggleSlope}
          aria-label="Toggle slope"
        />
      </div>

      {/* Legenda slope (só quando ativo) */}
      {slopeOn && slopeCells.length > 0 && (
        <div className="pt-1 border-t border-emerald-100">
          <p className="text-[10px] text-gray-500 mb-1">Classes (Lei 6.766)</p>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            {SLOPE_COLORS.map((c) => (
              <div key={c.label} className="flex items-center gap-1">
                <span
                  className="h-2 w-3 rounded-sm"
                  style={{ backgroundColor: c.color }}
                />
                <span className="text-[10px] text-gray-700">{c.label}</span>
              </div>
            ))}
          </div>
          {slopeStats && slopeStats.above30Pct > 5 && (
            <p className="text-[10px] text-red-600 mt-1">
              ⚠️ {slopeStats.above30Pct}% do terreno acima de 30% (não loteável)
            </p>
          )}
        </div>
      )}

      {/* Suitability Score */}
      {suitability && (
        <div className="pt-2 border-t border-emerald-100">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Target className="h-3 w-3 text-emerald-700" />
              <span className="text-[11px] font-semibold text-gray-800">
                Suitability Score
              </span>
            </div>
            <span
              className="text-[11px] font-bold px-1.5 rounded"
              style={{
                color: suitability.color,
                backgroundColor: `${suitability.color}1a`,
              }}
            >
              {suitability.score}/100 · {suitability.classification}
            </span>
          </div>
          <div className="space-y-0.5">
            {suitability.factors.map((f) => (
              <div
                key={f.name}
                className="flex items-center justify-between text-[10px] text-gray-600"
              >
                <span>{f.name}</span>
                <span className="font-mono">
                  {f.impact > 0 ? `−${Math.round(f.impact)}` : "0"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
