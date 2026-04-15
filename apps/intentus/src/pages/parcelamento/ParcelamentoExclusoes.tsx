/**
 * ParcelamentoExclusoes.tsx — Áreas de Exclusão Custom (US-65, Bloco J)
 *
 * Permite ao usuário desenhar polígonos de exclusão no mapa (lago, risco geológico,
 * servidão, etc.). O sistema subtrai essas áreas da área total usando Turf.js e
 * recalcula a área útil disponível. Persistido em `developments.exclusion_areas` (JSONB).
 *
 * Fluxo:
 *  1. Usuário clica "Adicionar área" → modo de desenho ativo
 *  2. Clica vértices no mapa → polígono vai se formando (preview em azul)
 *  3. Duplo-clique ou botão "Fechar" → fecha o polígono e salva
 *  4. Sistema calcula interseção com terreno (Turf) → computa área de exclusão
 *  5. Persiste no Supabase e recalcula área útil total
 *
 * Sessão 148 — Bloco J (Geo Avançado)
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { useEffect, useRef, useState, useCallback, useId } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  X,
  Layers,
  SquareDashedBottom,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import * as turf from "@turf/turf";
import { supabase } from "@/integrations/supabase/client";
import type { ExclusionArea } from "@/lib/parcelamento/types";
import { formatAreaM2 } from "@/lib/parcelamento/kmlParser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  project: {
    id: string;
    name?: string;
    area_m2?: number | null;
    centroid?: string | null;
    geometry_coordinates?: [number, number][] | null;
    exclusion_areas?: ExclusionArea[] | null;
  };
  onUpdate?: () => void;
}

type DrawMode = "idle" | "drawing" | "saving";

const EXCLUSION_TYPES: { value: ExclusionArea["type"]; label: string }[] = [
  { value: "lago", label: "Lago / Corpo d'água" },
  { value: "risco_geologico", label: "Risco geológico / Encosta" },
  { value: "servidao", label: "Servidão de passagem" },
  { value: "reservatorio", label: "Reservatório / Represa" },
  { value: "outro", label: "Outro" },
];

const TYPE_COLORS: Record<ExclusionArea["type"], string> = {
  lago: "#06b6d4",
  risco_geologico: "#ef4444",
  servidao: "#f59e0b",
  reservatorio: "#8b5cf6",
  outro: "#6b7280",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeExclusionAreaM2(coords: [number, number][]): number {
  if (coords.length < 3) return 0;
  try {
    const closed: [number, number][] =
      coords[0][0] === coords[coords.length - 1][0] &&
      coords[0][1] === coords[coords.length - 1][1]
        ? coords
        : [...coords, coords[0]];
    const poly = turf.polygon([closed.map((c) => [c[0], c[1]])]);
    const areaM2 = turf.area(poly); // Turf retorna m²
    return areaM2;
  } catch {
    return 0;
  }
}

/** Calcula área de interseção real entre a exclusão e o terreno */
function computeIntersectionAreaM2(
  exclusionCoords: [number, number][],
  terrenoCoords: [number, number][] | null
): number {
  if (!terrenoCoords || terrenoCoords.length < 3) {
    return computeExclusionAreaM2(exclusionCoords);
  }
  try {
    const closedEx: [number, number][] =
      exclusionCoords[0][0] === exclusionCoords[exclusionCoords.length - 1][0]
        ? exclusionCoords
        : [...exclusionCoords, exclusionCoords[0]];
    const closedTr: [number, number][] =
      terrenoCoords[0][0] === terrenoCoords[terrenoCoords.length - 1][0]
        ? terrenoCoords
        : [...terrenoCoords, terrenoCoords[0]];

    const polyEx = turf.polygon([closedEx.map((c) => [c[0], c[1]])]);
    const polyTr = turf.polygon([closedTr.map((c) => [c[0], c[1]])]);
    const inter = turf.intersect(turf.featureCollection([polyEx, polyTr]));
    if (!inter) return 0;
    return turf.area(inter);
  } catch {
    return computeExclusionAreaM2(exclusionCoords);
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ParcelamentoExclusoes({ project, onUpdate }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const drawCoordsRef = useRef<[number, number][]>([]);

  const [mapReady, setMapReady] = useState(false);
  const [mode, setMode] = useState<DrawMode>("idle");
  const [draftCoords, setDraftCoords] = useState<[number, number][]>([]);
  const [draftName, setDraftName] = useState("");
  const [draftType, setDraftType] = useState<ExclusionArea["type"]>("outro");
  const [areas, setAreas] = useState<ExclusionArea[]>(project.exclusion_areas ?? []);
  const [saving, setSaving] = useState(false);

  const uid = useId();

  // Área total disponível = area_m2 − soma das interseções
  const totalAreaM2 = project.area_m2 ?? 0;
  const totalExclusionM2 = areas.reduce((s, a) => s + a.area_m2, 0);
  const usefulAreaM2 = Math.max(0, totalAreaM2 - totalExclusionM2);
  const exclusionPct = totalAreaM2 > 0 ? (totalExclusionM2 / totalAreaM2) * 100 : 0;

  const centroid = (() => {
    try {
      if (!project.centroid) return null;
      const parsed = typeof project.centroid === "string" ? JSON.parse(project.centroid) : project.centroid;
      const coords = parsed?.coordinates ?? parsed;
      if (Array.isArray(coords) && coords.length === 2) return { lng: coords[0] as number, lat: coords[1] as number };
    } catch { /* noop */ }
    return null;
  })();

  // ── Inicializa Mapbox ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const center: [number, number] = centroid ? [centroid.lng, centroid.lat] : [-47.9, -15.8];

    if (!document.getElementById("mapbox-css-excl")) {
      const link = document.createElement("link");
      link.id = "mapbox-css-excl";
      link.rel = "stylesheet";
      link.href = "https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css";
      document.head.appendChild(link);
    }

    import("mapbox-gl").then((mod) => {
      const mb = mod.default;
      mb.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? "";

      const map = new mb.Map({
        container: mapContainerRef.current!,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center,
        zoom: centroid ? 14 : 4,
      });

      map.on("load", () => {
        // Boundary do terreno
        if (project.geometry_coordinates && project.geometry_coordinates.length > 0) {
          const closed: [number, number][] =
            project.geometry_coordinates[0][0] === project.geometry_coordinates[project.geometry_coordinates.length - 1][0]
              ? project.geometry_coordinates
              : [...project.geometry_coordinates, project.geometry_coordinates[0]];

          map.addSource("terreno-src", {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [closed.map((c) => [c[0], c[1]])] } },
          });
          map.addLayer({ id: "terreno-fill", type: "fill", source: "terreno-src", paint: { "fill-color": "#3b82f6", "fill-opacity": 0.08 } });
          map.addLayer({ id: "terreno-line", type: "line", source: "terreno-src", paint: { "line-color": "#3b82f6", "line-width": 2 } });
        }

        // Fonte para preview do polígono em desenho
        map.addSource("draw-preview", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "draw-fill", type: "fill", source: "draw-preview", paint: { "fill-color": "#f59e0b", "fill-opacity": 0.25 } });
        map.addLayer({ id: "draw-line", type: "line", source: "draw-preview", paint: { "line-color": "#f59e0b", "line-width": 2, "line-dasharray": [4, 2] } });

        // Fonte para áreas salvas
        map.addSource("exclusoes-src", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "exclusoes-fill", type: "fill", source: "exclusoes-src", paint: { "fill-color": ["get", "color"], "fill-opacity": 0.35 } });
        map.addLayer({ id: "exclusoes-line", type: "line", source: "exclusoes-src", paint: { "line-color": ["get", "color"], "line-width": 1.5 } });

        setMapReady(true);
      });

      mapRef.current = map;
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sincroniza áreas salvas no mapa ──────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const src = map.getSource("exclusoes-src") as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;

    src.setData({
      type: "FeatureCollection",
      features: areas.map((a) => {
        const closed: [number, number][] =
          a.coordinates[0][0] === a.coordinates[a.coordinates.length - 1][0]
            ? a.coordinates
            : [...a.coordinates, a.coordinates[0]];
        return {
          type: "Feature",
          properties: { name: a.name, color: TYPE_COLORS[a.type] ?? "#6b7280" },
          geometry: { type: "Polygon", coordinates: [closed.map((c) => [c[0], c[1]])] },
        };
      }),
    });
  }, [areas, mapReady]);

  // ── Handler de clique no mapa (modo desenho) ──────────────────────────────
  const handleMapClick = useCallback((e: { lngLat: { lng: number; lat: number } }) => {
    const map = mapRef.current;
    if (!map) return;

    import("mapbox-gl").then((mod) => {
      const mb = mod.default;
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      drawCoordsRef.current = [...drawCoordsRef.current, lngLat];
      setDraftCoords([...drawCoordsRef.current]);

      // Marcador de vértice
      const el = document.createElement("div");
      el.className = "w-3 h-3 bg-amber-400 border border-white rounded-full shadow";
      markersRef.current.push(new mb.Marker({ element: el }).setLngLat(lngLat).addTo(map));

      // Atualiza preview
      if (drawCoordsRef.current.length >= 3) {
        const closed = [...drawCoordsRef.current, drawCoordsRef.current[0]];
        (map.getSource("draw-preview") as mapboxgl.GeoJSONSource).setData({
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: [closed.map((c) => [c[0], c[1]])] },
        });
      } else if (drawCoordsRef.current.length === 2) {
        (map.getSource("draw-preview") as mapboxgl.GeoJSONSource).setData({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: drawCoordsRef.current.map((c) => [c[0], c[1]]) },
        });
      }
    });
  }, []);

  const handleMapDblClick = useCallback((e: { lngLat: { lng: number; lat: number }; preventDefault(): void }) => {
    e.preventDefault();
    finishDrawing();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Registra/desregistra listeners
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (mode === "drawing") {
      map.on("click", handleMapClick as Parameters<typeof map.on>[1]);
      map.on("dblclick", handleMapDblClick as Parameters<typeof map.on>[1]);
      map.getCanvas().style.cursor = "crosshair";
    }
    return () => {
      map.off("click", handleMapClick as Parameters<typeof map.on>[1]);
      map.off("dblclick", handleMapDblClick as Parameters<typeof map.on>[1]);
      map.getCanvas().style.cursor = "";
    };
  }, [mode, mapReady, handleMapClick, handleMapDblClick]);

  // ── Iniciar / cancelar desenho ────────────────────────────────────────────
  function startDrawing() {
    drawCoordsRef.current = [];
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    setDraftCoords([]);
    setDraftName("");
    setDraftType("outro");
    const map = mapRef.current;
    if (map?.getSource("draw-preview")) {
      (map.getSource("draw-preview") as mapboxgl.GeoJSONSource).setData({ type: "FeatureCollection", features: [] });
    }
    setMode("drawing");
    toast.info("Clique para adicionar vértices. Duplo-clique ou botão \"Fechar\" para finalizar.");
  }

  function cancelDrawing() {
    drawCoordsRef.current = [];
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    setDraftCoords([]);
    const map = mapRef.current;
    if (map?.getSource("draw-preview")) {
      (map.getSource("draw-preview") as mapboxgl.GeoJSONSource).setData({ type: "FeatureCollection", features: [] });
    }
    setMode("idle");
  }

  function finishDrawing() {
    if (drawCoordsRef.current.length < 3) {
      toast.warning("Adicione pelo menos 3 pontos para fechar o polígono.");
      return;
    }
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    setMode("saving");
  }

  // ── Salvar área de exclusão ───────────────────────────────────────────────
  async function handleSave() {
    if (!draftName.trim()) {
      toast.warning("Dê um nome para a área de exclusão.");
      return;
    }
    if (draftCoords.length < 3) {
      toast.warning("Polígono inválido. Reinicie o desenho.");
      return;
    }

    setSaving(true);
    try {
      const areaM2 = computeIntersectionAreaM2(draftCoords, project.geometry_coordinates ?? null);

      const newArea: ExclusionArea = {
        id: `excl-${uid}-${Date.now()}`,
        name: draftName.trim(),
        type: draftType,
        coordinates: draftCoords,
        area_m2: areaM2,
        created_at: new Date().toISOString(),
      };

      const updatedAreas = [...areas, newArea];

      const { error } = await supabase
        .from("developments")
        .update({ exclusion_areas: updatedAreas as unknown as object })
        .eq("id", project.id);

      if (error) throw error;

      setAreas(updatedAreas);
      drawCoordsRef.current = [];
      setDraftCoords([]);
      setMode("idle");

      const map = mapRef.current;
      if (map?.getSource("draw-preview")) {
        (map.getSource("draw-preview") as mapboxgl.GeoJSONSource).setData({ type: "FeatureCollection", features: [] });
      }

      onUpdate?.();
      toast.success(`Área "${newArea.name}" salva — ${formatAreaM2(areaM2)} excluídos.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  // ── Deletar área ──────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    const updated = areas.filter((a) => a.id !== id);
    try {
      const { error } = await supabase
        .from("developments")
        .update({ exclusion_areas: updated as unknown as object })
        .eq("id", project.id);
      if (error) throw error;
      setAreas(updated);
      onUpdate?.();
      toast.success("Área de exclusão removida.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover área");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Áreas de Exclusão</h2>
          <p className="text-sm text-gray-500 mt-1">
            Marque áreas não aproveitáveis do terreno (lagos, riscos geológicos, servidões).
            O sistema recalcula automaticamente a área útil disponível.
          </p>
        </div>
        {mode === "idle" && (
          <Button size="sm" onClick={startDrawing} disabled={!mapReady}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Adicionar área
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center p-3">
          <p className="text-xs text-gray-500">Área bruta</p>
          <p className="text-base font-bold text-gray-900">
            {totalAreaM2 > 0 ? formatAreaM2(totalAreaM2) : "—"}
          </p>
        </Card>
        <Card className="text-center p-3 border-red-200">
          <p className="text-xs text-gray-500">Excluído</p>
          <p className="text-base font-bold text-red-600">
            {totalExclusionM2 > 0 ? `−${formatAreaM2(totalExclusionM2)}` : "0 m²"}
          </p>
          {exclusionPct > 0 && (
            <p className="text-xs text-red-400">{exclusionPct.toFixed(1)}%</p>
          )}
        </Card>
        <Card className="text-center p-3 border-green-200">
          <p className="text-xs text-gray-500">Área útil</p>
          <p className="text-base font-bold text-green-700">
            {formatAreaM2(usefulAreaM2)}
          </p>
        </Card>
      </div>

      {/* Status de desenho */}
      {mode === "drawing" && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <SquareDashedBottom className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-800">
                  Clique para adicionar vértices ({draftCoords.length} ponto{draftCoords.length !== 1 ? "s" : ""}).
                  Duplo-clique ou clique em "Fechar" para finalizar.
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={cancelDrawing}>
                  <X className="w-3.5 h-3.5 mr-1" />
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  disabled={draftCoords.length < 3}
                  onClick={finishDrawing}
                >
                  Fechar polígono
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formulário de nome + tipo (após fechar polígono) */}
      {mode === "saving" && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Configurar área de exclusão</CardTitle>
            <CardDescription className="text-xs">
              Polígono com {draftCoords.length} vértices desenhado.
              Preencha as informações abaixo para salvar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Nome da área *
                </label>
                <Input
                  placeholder="Ex: Lago natural"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Tipo
                </label>
                <Select
                  value={draftType}
                  onValueChange={(v) => setDraftType(v as ExclusionArea["type"])}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXCLUSION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={cancelDrawing} disabled={saving}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !draftName.trim()}>
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    Salvar área
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mapa */}
      <div
        ref={mapContainerRef}
        className="w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm"
        style={{ height: 320 }}
      />

      {/* Lista de áreas salvas */}
      {areas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-gray-500" />
              Áreas cadastradas ({areas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {areas.map((area) => (
              <div
                key={area.id}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: TYPE_COLORS[area.type] }}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{area.name}</p>
                    <p className="text-xs text-gray-500">
                      {EXCLUSION_TYPES.find((t) => t.value === area.type)?.label} ·{" "}
                      {formatAreaM2(area.area_m2)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 text-gray-400 hover:text-red-600"
                  onClick={() => handleDelete(area.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {areas.length === 0 && mode === "idle" && (
        <Card className="border-dashed border-gray-300">
          <CardContent className="py-8 text-center">
            <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Nenhuma área de exclusão cadastrada.</p>
            <p className="text-xs text-gray-400 mt-1">
              Clique em "Adicionar área" e desenhe no mapa as regiões não aproveitáveis.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Nota */}
      <Card className="border-blue-100 bg-blue-50/40">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-xs text-blue-800 space-y-1">
              <p className="font-medium">Como funciona</p>
              <p className="text-blue-700">
                A área excluída é calculada como a interseção entre o polígono desenhado e o
                terreno principal (Lei 6.766 exige área aproveitável mínima de 35% para
                loteamentos). As exclusões são persistidas e refletem nos cálculos de
                viabilidade financeira.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
