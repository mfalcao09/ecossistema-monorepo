/**
 * ParcelamentoCorteTereno.tsx — Corte Transversal / Perfil de Elevação (US-63, Bloco J)
 *
 * Fluxo:
 *  1. Usuário clica "Iniciar corte" e define 2 pontos no mapa Mapbox
 *  2. Sistema amostra ~50 pontos ao longo da linha com Turf.js
 *  3. Busca elevação SRTM 90m via OpenTopoData API (sem auth, CORS aberto)
 *  4. Plota perfil de elevação com Recharts (LineChart)
 *  5. Exibe estatísticas: cota mínima, máxima, desnível, declividade média
 *
 * Sessão 148 — Bloco J (Geo Avançado)
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import {
  Crosshair,
  Loader2,
  Info,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Minus,
  MapPin,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import * as turf from "@turf/turf";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ElevationPoint {
  distancia_m: number;   // distância acumulada ao longo do eixo (m)
  elevacao_m: number;    // altitude SRTM (m acima do nível do mar)
  lng: number;
  lat: number;
}

interface ElevationStats {
  minElev: number;
  maxElev: number;
  desnivelTotal: number;
  declividade: number; // %
  comprimentoM: number;
}

interface Props {
  project: {
    id: string;
    name?: string;
    centroid?: string | null;
    geometry_coordinates?: [number, number][] | null;
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SAMPLE_COUNT = 50; // nº de pontos amostrados ao longo do eixo
const OPENTOPO_BATCH = 100; // máx pontos por request OpenTopoData

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Interpola N pontos ao longo de uma linha GeoJSON usando Turf */
function sampleLinePoints(
  start: [number, number],
  end: [number, number],
  n: number
): { lng: number; lat: number; distancia_m: number }[] {
  const line = turf.lineString([
    [start[0], start[1]],
    [end[0], end[1]],
  ]);
  const totalKm = turf.length(line, { units: "kilometers" });
  const step = totalKm / (n - 1);

  const pts: { lng: number; lat: number; distancia_m: number }[] = [];
  for (let i = 0; i < n; i++) {
    const dist = i * step;
    const pt = turf.along(line, dist, { units: "kilometers" });
    pts.push({
      lng: pt.geometry.coordinates[0],
      lat: pt.geometry.coordinates[1],
      distancia_m: dist * 1000,
    });
  }
  return pts;
}

/** Busca elevações via OpenTopoData (SRTM 90m — público, CORS aberto) */
async function fetchElevations(
  points: { lng: number; lat: number }[]
): Promise<number[]> {
  // OpenTopoData aceita até 100 pontos por request
  const batches: { lng: number; lat: number }[][] = [];
  for (let i = 0; i < points.length; i += OPENTOPO_BATCH) {
    batches.push(points.slice(i, i + OPENTOPO_BATCH));
  }

  const allElevations: number[] = [];
  for (const batch of batches) {
    const locations = batch
      .map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`)
      .join("|");
    const url = `https://api.opentopodata.org/v1/srtm90m?locations=${locations}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`OpenTopoData: HTTP ${resp.status}`);
    const json = await resp.json();
    if (json.status !== "OK") throw new Error(`OpenTopoData: ${json.error ?? "erro"}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const elevs = json.results.map((r: any) => (r.elevation ?? 0) as number);
    allElevations.push(...elevs);
  }
  return allElevations;
}

function computeStats(pts: ElevationPoint[]): ElevationStats {
  const elevs = pts.map((p) => p.elevacao_m);
  const minElev = Math.min(...elevs);
  const maxElev = Math.max(...elevs);
  const desnivelTotal = maxElev - minElev;
  const comprimentoM = pts[pts.length - 1]?.distancia_m ?? 0;
  const declividade = comprimentoM > 0 ? (desnivelTotal / comprimentoM) * 100 : 0;
  return { minElev, maxElev, desnivelTotal, declividade, comprimentoM };
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

interface TooltipPayload {
  payload?: { distancia_m: number; elevacao_m: number };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length || !payload[0].payload) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md p-3 text-xs">
      <p className="font-semibold text-gray-700">
        Distância: {(d.distancia_m / 1000).toFixed(3)} km
      </p>
      <p className="text-blue-600 font-bold">Elevação: {d.elevacao_m.toFixed(1)} m</p>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ParcelamentoCorteTereno({ project }: Props) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const [mapReady, setMapReady] = useState(false);
  const [mode, setMode] = useState<"idle" | "picking1" | "picking2" | "loading" | "done">("idle");
  const [pointA, setPointA] = useState<[number, number] | null>(null);
  const [pointB, setPointB] = useState<[number, number] | null>(null);
  const [elevData, setElevData] = useState<ElevationPoint[]>([]);
  const [stats, setStats] = useState<ElevationStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Centróide do projeto para posicionar o mapa
  const centroid = (() => {
    try {
      if (!project.centroid) return null;
      const parsed = JSON.parse(project.centroid);
      const coords = parsed?.coordinates ?? parsed;
      if (Array.isArray(coords) && coords.length === 2) {
        return { lng: coords[0] as number, lat: coords[1] as number };
      }
    } catch { /* noop */ }
    return null;
  })();

  // ── Inicializa Mapbox ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: [number, number] = centroid
      ? [centroid.lng, centroid.lat]
      : [-47.9, -15.8]; // Brasília como fallback

    // Injeta CSS do Mapbox dinamicamente (padrão do projeto)
    if (!document.getElementById("mapbox-css-corte")) {
      const link = document.createElement("link");
      link.id = "mapbox-css-corte";
      link.rel = "stylesheet";
      link.href = "https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css";
      document.head.appendChild(link);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapboxgl = (window as any).mapboxgl as typeof import("mapbox-gl");
    if (!mapboxgl) {
      import("mapbox-gl").then((mod) => {
        const mb = mod.default;
        mb.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
        initMap(mb, center);
      });
    } else {
      mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
      initMap(mapboxgl, center);
    }

    function initMap(mb: typeof import("mapbox-gl"), c: [number, number]) {
      const map = new mb.Map({
        container: containerRef.current!,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: c,
        zoom: centroid ? 14 : 4,
      });

      map.on("load", () => {
        // Desenha boundary do terreno se disponível
        if (project.geometry_coordinates && project.geometry_coordinates.length > 0) {
          const closed: [number, number][] =
            project.geometry_coordinates[0][0] === project.geometry_coordinates[project.geometry_coordinates.length - 1][0]
              ? project.geometry_coordinates
              : [...project.geometry_coordinates, project.geometry_coordinates[0]];

          map.addSource("terreno-boundary", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "Polygon", coordinates: [closed.map((c) => [c[0], c[1]])] },
            },
          });
          map.addLayer({
            id: "terreno-fill",
            type: "fill",
            source: "terreno-boundary",
            paint: { "fill-color": "#3b82f6", "fill-opacity": 0.1 },
          });
          map.addLayer({
            id: "terreno-line",
            type: "line",
            source: "terreno-boundary",
            paint: { "line-color": "#3b82f6", "line-width": 2 },
          });
        }
        setMapReady(true);
      });

      mapRef.current = map;
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handler de clique no mapa ─────────────────────────────────────────────
  const handleMapClick = useCallback(
    (e: { lngLat: { lng: number; lat: number } }) => {
      const map = mapRef.current;
      if (!map) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mb = (map as any).constructor as typeof import("mapbox-gl");

      if (mode === "picking1") {
        const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        setPointA(lngLat);

        // Adiciona marcador A (verde)
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        const el = document.createElement("div");
        el.className = "w-5 h-5 bg-green-500 border-2 border-white rounded-full shadow-lg";
        markersRef.current.push(new mb.Marker({ element: el }).setLngLat(lngLat).addTo(map));

        setMode("picking2");
        toast.info("Ponto A definido. Clique no segundo ponto (B).");
      } else if (mode === "picking2") {
        const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        setPointB(lngLat);

        // Adiciona marcador B (vermelho)
        const el = document.createElement("div");
        el.className = "w-5 h-5 bg-red-500 border-2 border-white rounded-full shadow-lg";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        markersRef.current.push(new (map as any).constructor.Marker({ element: el }).setLngLat(lngLat).addTo(map));

        // Remove listener e calcula
        map.off("click", handleMapClick as Parameters<typeof map.off>[1]);
        map.getCanvas().style.cursor = "";
        runAnalysis(pointA!, lngLat);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, pointA]
  );

  // Registra/desregistra listener de clique
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (mode === "picking1" || mode === "picking2") {
      map.on("click", handleMapClick as Parameters<typeof map.on>[1]);
      map.getCanvas().style.cursor = "crosshair";
    }
    return () => {
      map.off("click", handleMapClick as Parameters<typeof map.off>[1]);
      map.getCanvas().style.cursor = "";
    };
  }, [mode, mapReady, handleMapClick]);

  // ── Análise de elevação ───────────────────────────────────────────────────
  async function runAnalysis(a: [number, number], b: [number, number]) {
    setMode("loading");
    setError(null);
    try {
      const samples = sampleLinePoints(a, b, SAMPLE_COUNT);
      const elevs = await fetchElevations(samples);

      const pts: ElevationPoint[] = samples.map((s, i) => ({
        distancia_m: s.distancia_m,
        elevacao_m: elevs[i],
        lng: s.lng,
        lat: s.lat,
      }));

      // Desenha linha de corte no mapa
      const map = mapRef.current;
      if (map) {
        if (map.getSource("corte-line")) {
          (map.getSource("corte-line") as mapboxgl.GeoJSONSource).setData({
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: [a, b] },
          });
        } else {
          map.addSource("corte-line", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: [a, b] },
            },
          });
          map.addLayer({
            id: "corte-layer",
            type: "line",
            source: "corte-line",
            paint: { "line-color": "#ef4444", "line-width": 2, "line-dasharray": [4, 2] },
          });
        }
      }

      setElevData(pts);
      setStats(computeStats(pts));
      setMode("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao buscar elevações";
      setError(msg);
      setMode("idle");
      toast.error(msg);
    }
  }

  function handleReset() {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    const map = mapRef.current;
    if (map?.getLayer("corte-layer")) {
      map.removeLayer("corte-layer");
      map.removeSource("corte-line");
    }
    setPointA(null);
    setPointB(null);
    setElevData([]);
    setStats(null);
    setError(null);
    setMode("idle");
  }

  function handleStart() {
    handleReset();
    setMode("picking1");
    toast.info("Clique no Ponto A (início do corte) no mapa.");
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Corte Transversal</h2>
          <p className="text-sm text-gray-500 mt-1">
            Defina dois pontos no mapa para gerar o perfil de elevação (SRTM 90m).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mode === "done" && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Novo corte
            </Button>
          )}
          {(mode === "idle" || mode === "done") && (
            <Button size="sm" onClick={handleStart}>
              <Crosshair className="w-3.5 h-3.5 mr-1.5" />
              {mode === "done" ? "Redefinir pontos" : "Iniciar corte"}
            </Button>
          )}
        </div>
      </div>

      {/* Status do modo */}
      {(mode === "picking1" || mode === "picking2") && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
              <p className="text-sm text-blue-800">
                {mode === "picking1"
                  ? "Clique no mapa para definir o Ponto A (início do corte)"
                  : "Clique no mapa para definir o Ponto B (fim do corte)"}
              </p>
              <Badge variant="outline" className="ml-auto text-blue-700 border-blue-300">
                {mode === "picking1" ? "Ponto A" : "Ponto B"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {mode === "loading" && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
              <p className="text-sm text-amber-800">
                Buscando elevações SRTM ao longo de {SAMPLE_COUNT} pontos...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Erro ao buscar elevações</p>
                <p className="text-xs text-red-700 mt-0.5">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mapa */}
      <div
        ref={containerRef}
        className="w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm"
        style={{ height: 300 }}
      />

      {/* Gráfico de perfil */}
      {mode === "done" && elevData.length > 0 && stats && (
        <>
          {/* Estatísticas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="text-center p-3">
              <p className="text-xs text-gray-500">Cota mínima</p>
              <p className="text-lg font-bold text-blue-600">{stats.minElev.toFixed(1)} m</p>
            </Card>
            <Card className="text-center p-3">
              <p className="text-xs text-gray-500">Cota máxima</p>
              <p className="text-lg font-bold text-blue-600">{stats.maxElev.toFixed(1)} m</p>
            </Card>
            <Card className="text-center p-3">
              <p className="text-xs text-gray-500">Desnível total</p>
              <p className="text-lg font-bold text-orange-600">{stats.desnivelTotal.toFixed(1)} m</p>
            </Card>
            <Card className="text-center p-3">
              <p className="text-xs text-gray-500">Declividade média</p>
              <p className={`text-lg font-bold ${stats.declividade > 30 ? "text-red-600" : stats.declividade > 12 ? "text-amber-600" : "text-green-600"}`}>
                {stats.declividade.toFixed(1)}%
              </p>
            </Card>
          </div>

          {/* Perfil de elevação */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Perfil de Elevação — {(stats.comprimentoM / 1000).toFixed(3)} km
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={elevData} margin={{ top: 10, right: 20, bottom: 20, left: 40 }}>
                  <defs>
                    <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="distancia_m"
                    tickFormatter={(v) => `${(v / 1000).toFixed(2)} km`}
                    tick={{ fontSize: 10, fill: "#6b7280" }}
                    label={{ value: "Distância", position: "insideBottom", offset: -10, fontSize: 11, fill: "#6b7280" }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#6b7280" }}
                    tickFormatter={(v) => `${v}m`}
                    label={{ value: "Elevação", angle: -90, position: "insideLeft", fontSize: 11, fill: "#6b7280" }}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine
                    y={stats.minElev}
                    stroke="#10b981"
                    strokeDasharray="4 2"
                    label={{ value: `Min ${stats.minElev.toFixed(0)}m`, fontSize: 9, fill: "#10b981" }}
                  />
                  <ReferenceLine
                    y={stats.maxElev}
                    stroke="#ef4444"
                    strokeDasharray="4 2"
                    label={{ value: `Max ${stats.maxElev.toFixed(0)}m`, fontSize: 9, fill: "#ef4444" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="elevacao_m"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#elevGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: "#3b82f6" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Interpretação */}
          <Card className="border-blue-100 bg-blue-50/40">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-xs text-blue-800 space-y-1">
                  <p className="font-medium">Interpretação</p>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="flex items-center gap-1">
                      <TrendingDown className="w-3 h-3 text-green-600" />
                      <span className="text-green-700">0–12%: Plano a suave</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Minus className="w-3 h-3 text-amber-500" />
                      <span className="text-amber-700">12–30%: Moderado</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-red-600" />
                      <span className="text-red-700">{">"}30%: Íngreme (restrito Lei 6.766)</span>
                    </span>
                  </div>
                  <p className="text-blue-700">
                    Fonte: SRTM 90m (NASA) via OpenTopoData. Resolução ~90m — para análises precisas,
                    usar levantamento topográfico local.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
