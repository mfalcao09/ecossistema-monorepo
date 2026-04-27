/**
 * ParcelamentoBDGDPanel — painel BDGD ANEEL (rede de distribuição local)
 *
 * Mostra MT/BT/Subestações próximos ao terreno (buffer 5km/10km).
 * Auto-fallback Tier 1 (índice nacional ~10m) → Tier 2 (alta precisão por
 * projeto, on-demand via GHA).
 *
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Loader2,
  Zap,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  fetchBDGDProximity,
  triggerBDGDHd,
  type BDGDProximityResponse,
  type BDGDHDStatus,
} from "@/lib/parcelamento/bdgdApi";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapboxMap = any;

const COLOR_MT = "#dc2626"; // vermelho — Média Tensão
const COLOR_BT = "#fb923c"; // laranja — Baixa Tensão
const COLOR_SUB = "#facc15"; // amarelo — Subestações

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: MapboxMap | null;
  mapReady: boolean;
  developmentId: string;
}

interface LayerToggle {
  active: boolean;
  loaded: boolean;
}

export default function ParcelamentoBDGDPanel({
  map,
  mapReady,
  developmentId,
}: Props) {
  const [data, setData] = useState<BDGDProximityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hdLoading, setHdLoading] = useState(false);
  const [hdMessage, setHdMessage] = useState<string | null>(null);

  const [toggleMT, setToggleMT] = useState<LayerToggle>({
    active: false,
    loaded: false,
  });
  const [toggleBT, setToggleBT] = useState<LayerToggle>({
    active: false,
    loaded: false,
  });
  const [toggleSUB, setToggleSUB] = useState<LayerToggle>({
    active: false,
    loaded: false,
  });

  // ---------------------------------------------------------------------------
  // Carrega proximity uma vez (data fica em memória; toggles ativam camadas)
  // ---------------------------------------------------------------------------
  const loadProximity = useCallback(async () => {
    if (!developmentId || loading) return;
    setLoading(true);
    setError(null);
    const r = await fetchBDGDProximity(developmentId, 10, ["mt", "bt", "sub"]);
    setLoading(false);
    if (!r.ok) {
      setError(r.error.message);
      return;
    }
    setData(r.data);
  }, [developmentId, loading]);

  useEffect(() => {
    loadProximity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [developmentId]);

  // ---------------------------------------------------------------------------
  // Adiciona camada Mapbox quando toggle ativa
  // ---------------------------------------------------------------------------
  const ensureLayer = useCallback(
    (
      layerKey: "mt" | "bt" | "sub",
      fc: GeoJSON.FeatureCollection,
      color: string,
      isPoint: boolean,
    ) => {
      if (!map) return false;
      const sourceId = `src-bdgd-${layerKey}`;
      const layerId = `layer-bdgd-${layerKey}`;
      try {
        if (map.getSource(sourceId)) {
          // já existe — atualiza data
          map.getSource(sourceId).setData(fc);
        } else {
          map.addSource(sourceId, { type: "geojson", data: fc });
          if (isPoint) {
            map.addLayer({
              id: layerId,
              type: "circle",
              source: sourceId,
              paint: {
                "circle-radius": 7,
                "circle-color": color,
                "circle-stroke-color": "#0f172a",
                "circle-stroke-width": 2,
                "circle-opacity": 0.95,
              },
            });
          } else {
            map.addLayer({
              id: layerId,
              type: "line",
              source: sourceId,
              paint: {
                "line-color": color,
                "line-width": layerKey === "mt" ? 2.5 : 1.8,
                "line-opacity": 0.85,
              },
            });
          }
        }
        return true;
      } catch (e) {
        console.warn(`[BDGD] ensureLayer ${layerKey} falhou`, e);
        return false;
      }
    },
    [map],
  );

  const setLayerVisible = useCallback(
    (layerKey: "mt" | "bt" | "sub", visible: boolean) => {
      if (!map) return;
      const layerId = `layer-bdgd-${layerKey}`;
      try {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(
            layerId,
            "visibility",
            visible ? "visible" : "none",
          );
        }
      } catch {
        /* layer pode não existir ainda */
      }
    },
    [map],
  );

  const handleToggle = useCallback(
    (layerKey: "mt" | "bt" | "sub") => {
      if (!data || !mapReady) return;
      const fc = data.features[layerKey];
      const color =
        layerKey === "mt" ? COLOR_MT : layerKey === "bt" ? COLOR_BT : COLOR_SUB;
      const isPoint = layerKey === "sub";
      const state =
        layerKey === "mt" ? toggleMT : layerKey === "bt" ? toggleBT : toggleSUB;
      const setState =
        layerKey === "mt"
          ? setToggleMT
          : layerKey === "bt"
            ? setToggleBT
            : setToggleSUB;

      const newActive = !state.active;
      if (newActive && !state.loaded) {
        ensureLayer(layerKey, fc, color, isPoint);
        setState({ active: true, loaded: true });
      } else {
        setLayerVisible(layerKey, newActive);
        setState({ ...state, active: newActive });
      }
    },
    [
      data,
      mapReady,
      toggleMT,
      toggleBT,
      toggleSUB,
      ensureLayer,
      setLayerVisible,
    ],
  );

  // ---------------------------------------------------------------------------
  // Tier 2 — disparar carregamento HD
  // ---------------------------------------------------------------------------
  const handleLoadHD = useCallback(async () => {
    if (hdLoading) return;
    setHdLoading(true);
    setHdMessage(null);
    const r = await triggerBDGDHd(developmentId, 5);
    setHdLoading(false);
    if (!r.ok) {
      if (r.error.code === "GITHUB_TOKEN_MISSING") {
        setHdMessage(
          "⚠️ Configuração pendente: secret GITHUB_TRIGGER_TOKEN ainda não foi adicionado à Edge Function. Avise o Marcelo.",
        );
      } else {
        setHdMessage(`Erro: ${r.error.message}`);
      }
      return;
    }
    if (r.data.already_in_progress) {
      setHdMessage("Já está em processamento — aguarde");
    } else {
      setHdMessage(`✅ Disparado. Acompanhar em: ${r.data.actions_url}`);
    }
    // recarrega proximity em 60s (workflow demora 2-15min)
    setTimeout(() => loadProximity(), 60_000);
  }, [developmentId, hdLoading, loadProximity]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const stats = data?.stats;
  const distribuidorasNomes = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    for (const fc of [data.features.mt, data.features.bt, data.features.sub]) {
      for (const f of fc.features ?? []) {
        const d = (f.properties as Record<string, unknown> | null)
          ?.distribuidora;
        if (typeof d === "string" && d.trim()) set.add(d.trim());
      }
    }
    return Array.from(set);
  }, [data]);

  if (loading && !data) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
        <div className="flex items-center gap-2 text-xs text-amber-800">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Carregando rede BDGD…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50/50 p-3">
        <div className="flex items-center gap-2 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5" />
          BDGD: {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const hasAny =
    (stats?.mt_count ?? 0) + (stats?.bt_count ?? 0) + (stats?.sub_count ?? 0) >
    0;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-amber-700" />
          <p className="text-xs font-semibold text-gray-800">
            Rede Distribuição (BDGD)
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-gray-500">
          {data.source_tier === "t2" ? (
            <span className="text-purple-700 font-semibold">HD</span>
          ) : (
            "Índice 10m"
          )}
        </span>
      </div>

      {!hasAny && (
        <p className="text-[11px] text-gray-500 italic">
          Nenhum segmento de distribuição em 10km. Os dados nacionais ainda
          podem não ter sido sincronizados — rode o workflow BDGD Sync.
        </p>
      )}

      {hasAny && (
        <>
          {/* MT */}
          <div className="flex items-start justify-between gap-2 pt-1">
            <div className="flex items-start gap-2 flex-1">
              <span
                className="h-1.5 w-3 rounded-sm mt-1"
                style={{ backgroundColor: COLOR_MT }}
              />
              <div className="min-w-0">
                <span className="text-[11px] font-medium text-gray-800 block">
                  Média Tensão (13.8/34.5 kV)
                </span>
                <span className="text-[10px] text-gray-500">
                  {stats?.mt_count ?? 0} segmentos ·{" "}
                  {((stats?.mt_length_m ?? 0) / 1000).toFixed(1)} km
                </span>
              </div>
            </div>
            <Switch
              checked={toggleMT.active}
              disabled={!mapReady || (stats?.mt_count ?? 0) === 0}
              onCheckedChange={() => handleToggle("mt")}
              aria-label="Toggle MT"
            />
          </div>

          {/* BT */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 flex-1">
              <span
                className="h-1.5 w-3 rounded-sm mt-1"
                style={{ backgroundColor: COLOR_BT }}
              />
              <div className="min-w-0">
                <span className="text-[11px] font-medium text-gray-800 block">
                  Baixa Tensão (127/220/380 V)
                </span>
                <span className="text-[10px] text-gray-500">
                  {stats?.bt_count ?? 0} segmentos ·{" "}
                  {((stats?.bt_length_m ?? 0) / 1000).toFixed(1)} km
                </span>
              </div>
            </div>
            <Switch
              checked={toggleBT.active}
              disabled={!mapReady || (stats?.bt_count ?? 0) === 0}
              onCheckedChange={() => handleToggle("bt")}
              aria-label="Toggle BT"
            />
          </div>

          {/* SUB */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 flex-1">
              <span
                className="h-2 w-2 rounded-full mt-1 border border-gray-700"
                style={{ backgroundColor: COLOR_SUB }}
              />
              <div className="min-w-0">
                <span className="text-[11px] font-medium text-gray-800 block">
                  Subestações distribuição
                </span>
                <span className="text-[10px] text-gray-500">
                  {stats?.sub_count ?? 0} unidades
                </span>
              </div>
            </div>
            <Switch
              checked={toggleSUB.active}
              disabled={!mapReady || (stats?.sub_count ?? 0) === 0}
              onCheckedChange={() => handleToggle("sub")}
              aria-label="Toggle SUB"
            />
          </div>

          {distribuidorasNomes.length > 0 && (
            <div className="pt-2 border-t border-amber-100">
              <p className="text-[10px] text-gray-500 mb-1">
                Concessionária(s)
              </p>
              <p className="text-[10px] text-gray-700 leading-tight">
                {distribuidorasNomes.slice(0, 3).join(" · ")}
                {distribuidorasNomes.length > 3 &&
                  ` +${distribuidorasNomes.length - 3}`}
              </p>
            </div>
          )}
        </>
      )}

      {/* Tier 2 — alta precisão */}
      <div className="pt-2 border-t border-amber-100 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-purple-600" />
          <p className="text-[11px] font-semibold text-purple-900">
            Alta precisão (Tier 2)
          </p>
        </div>
        {data.hd_loaded && (
          <div className="flex items-center gap-1.5 text-[10px] text-green-700">
            <CheckCircle2 className="h-3 w-3" />
            HD carregado · raio {data.hd_buffer_km}km
          </div>
        )}
        {data.hd_status === "queued" && !data.hd_loaded && (
          <div className="flex items-center gap-1.5 text-[10px] text-amber-700">
            <Clock className="h-3 w-3" />
            Em fila — workflow GHA disparado
          </div>
        )}
        {data.hd_status === "loading" && (
          <div className="flex items-center gap-1.5 text-[10px] text-blue-700">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processando — pode levar 2-15min
          </div>
        )}
        <Button
          size="sm"
          variant="outline"
          className="w-full h-7 text-[11px] border-purple-300 text-purple-700 hover:bg-purple-50"
          disabled={
            hdLoading ||
            data.hd_status === "queued" ||
            data.hd_status === "loading"
          }
          onClick={handleLoadHD}
        >
          {hdLoading ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Disparando…
            </>
          ) : data.hd_loaded ? (
            "Recarregar precisão milimétrica"
          ) : (
            "Carregar precisão milimétrica"
          )}
        </Button>
        {hdMessage && (
          <p className="text-[10px] text-gray-600 leading-tight">{hdMessage}</p>
        )}
        <p className="text-[10px] text-gray-500 leading-tight italic">
          Carrega geometria sem simplify (raio 5km) — para memorial descritivo,
          georreferenciamento de servidão e projeto executivo.
        </p>
      </div>
    </div>
  );
}
