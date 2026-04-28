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

  // P-193 + P-195 — tensões MT reais + alimentadores (CTMT) + energia anual
  const mtAnalytics = useMemo(() => {
    if (!data)
      return {
        tensoes: [] as string[],
        alimentadores: [] as Array<{
          nome: string;
          cod_id: string;
          energia_kwh: number;
        }>,
        energia_total_anual_kwh: 0,
      };
    const tensoesSet = new Set<string>();
    // Por cod_id — alimentador único pode aparecer em vários segments
    const alimMap = new Map<
      string,
      { nome: string; cod_id: string; energia_kwh: number }
    >();
    for (const f of data.features.mt.features ?? []) {
      const p = (f.properties as Record<string, unknown> | null) ?? {};
      const tensao = typeof p.tensao === "string" ? p.tensao.trim() : "";
      if (tensao && tensao !== "—" && !tensao.startsWith("null")) {
        tensoesSet.add(tensao);
      }
      const codId = typeof p.ctmt_cod_id === "string" ? p.ctmt_cod_id : "";
      const nome = typeof p.ctmt_nome === "string" ? p.ctmt_nome : "";
      const energia =
        typeof p.ctmt_energia_anual_kwh === "number"
          ? p.ctmt_energia_anual_kwh
          : Number(p.ctmt_energia_anual_kwh) || 0;
      if (codId && !alimMap.has(codId)) {
        alimMap.set(codId, {
          nome: nome || codId,
          cod_id: codId,
          energia_kwh: energia,
        });
      }
    }
    const tensoes = Array.from(tensoesSet).sort((a, b) => {
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      return Number.isFinite(numA) && Number.isFinite(numB) ? numB - numA : 0;
    });
    const alimentadores = Array.from(alimMap.values()).sort(
      (a, b) => b.energia_kwh - a.energia_kwh,
    );
    const energia_total_anual_kwh = alimentadores.reduce(
      (acc, a) => acc + a.energia_kwh,
      0,
    );
    return { tensoes, alimentadores, energia_total_anual_kwh };
  }, [data]);

  // Formata kWh em escala humana — < 1 GWh fica MWh, ≥ 1 GWh fica GWh.
  const fmtEnergia = (kwh: number): string => {
    if (kwh <= 0) return "—";
    if (kwh < 1_000_000) {
      return `${(kwh / 1000).toLocaleString("pt-BR", {
        maximumFractionDigits: 1,
      })} MWh/ano`;
    }
    return `${(kwh / 1_000_000).toLocaleString("pt-BR", {
      maximumFractionDigits: 2,
    })} GWh/ano`;
  };

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

  // Helper pra renderizar cada toggle BDGD no MESMO formato visual dos MAP_LAYERS
  const renderBdgdCard = (
    layerKey: "mt" | "bt" | "sub",
    label: string,
    description: string,
    color: string,
    count: number,
    extraInfo: string,
    isPoint = false,
    isActive = false,
    state: { active: boolean },
  ) => {
    const empty = count === 0;
    return (
      <div
        className={`rounded-lg border p-3 transition-all ${
          state.active
            ? "border-blue-300 bg-blue-50"
            : "border-gray-200 bg-white"
        } ${!mapReady || empty ? "opacity-60" : ""}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {isPoint ? (
              <span
                className="h-3 w-3 rounded-full flex-shrink-0 mt-0.5 border border-gray-700"
                style={{ backgroundColor: color, opacity: empty ? 0.4 : 1 }}
              />
            ) : (
              <span
                className="h-3 w-3 rounded-sm flex-shrink-0 mt-0.5"
                style={{ backgroundColor: color, opacity: empty ? 0.4 : 1 }}
              />
            )}
            <div className="min-w-0 flex-1">
              <span className="text-xs font-medium text-gray-800 leading-tight block">
                {label}
              </span>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">
                {description}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {empty ? "aguardando BDGD Sync" : extraInfo}
              </p>
            </div>
          </div>
          <div className="flex-shrink-0 pt-0.5">
            <Switch
              checked={state.active}
              disabled={!mapReady || empty}
              onCheckedChange={() => handleToggle(layerKey)}
              aria-label={`Toggle ${label}`}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Cada camada BDGD vira card individual igual aos MAP_LAYERS */}
      {renderBdgdCard(
        "mt",
        "BDGD — Média Tensão",
        "Rede 13.8/34.5 kV — concessionária local (ANEEL)",
        COLOR_MT,
        stats?.mt_count ?? 0,
        `${stats?.mt_count ?? 0} segmentos · ${((stats?.mt_length_m ?? 0) / 1000).toFixed(1)} km em 10km`,
        false,
        true,
        toggleMT,
      )}
      {renderBdgdCard(
        "bt",
        "BDGD — Baixa Tensão",
        "Rede 127/220/380 V — fiação local",
        COLOR_BT,
        stats?.bt_count ?? 0,
        `${stats?.bt_count ?? 0} segmentos · ${((stats?.bt_length_m ?? 0) / 1000).toFixed(1)} km em 10km`,
        false,
        true,
        toggleBT,
      )}
      {renderBdgdCard(
        "sub",
        "BDGD — Subestações",
        "Subestações de distribuição (existentes + planejadas)",
        COLOR_SUB,
        stats?.sub_count ?? 0,
        `${stats?.sub_count ?? 0} unidades em 10km`,
        true,
        true,
        toggleSUB,
      )}

      {!hasAny && (
        <p className="text-[10px] text-gray-500 italic leading-tight">
          BDGD ainda sem dados sincronizados.{" "}
          <a
            href="https://github.com/mfalcao09/ecossistema-monorepo/actions/workflows/bdgd-sync.yml"
            target="_blank"
            rel="noreferrer"
            className="text-amber-700 underline hover:text-amber-900"
          >
            Re-rodar BDGD Sync
          </a>
          .
        </p>
      )}

      {distribuidorasNomes.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="h-3 w-3 text-amber-700" />
            <p className="text-[10px] font-semibold text-gray-700">
              Concessionária(s) detectada(s)
              {data.source_tier === "t2" && (
                <span className="ml-1.5 text-[9px] font-normal text-purple-700">
                  · HD precision
                </span>
              )}
            </p>
          </div>
          <p className="text-[10px] text-gray-700 leading-tight">
            {distribuidorasNomes.slice(0, 3).join(" · ")}
            {distribuidorasNomes.length > 3 &&
              ` +${distribuidorasNomes.length - 3}`}
          </p>
        </div>
      )}

      {/* P-193 — tensões MT reais (resolvidas via JOIN CTMT + TTEN) */}
      {mtAnalytics.tensoes.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-amber-700" />
            <p className="text-[10px] font-semibold text-amber-900">
              Tensões MT em 10km
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {mtAnalytics.tensoes.slice(0, 8).map((t) => (
              <span
                key={t}
                className="text-[10px] font-mono bg-white border border-amber-200 rounded px-1.5 py-0.5 text-amber-800"
              >
                {t}
              </span>
            ))}
            {mtAnalytics.tensoes.length > 8 && (
              <span className="text-[10px] text-amber-700">
                +{mtAnalytics.tensoes.length - 8}
              </span>
            )}
          </div>
          {mtAnalytics.alimentadores.length > 0 && (
            <p className="text-[10px] text-gray-600 leading-tight">
              <span className="text-gray-500">Alimentadores:</span>{" "}
              {mtAnalytics.alimentadores.length} circuito
              {mtAnalytics.alimentadores.length === 1 ? "" : "s"} MT
              {mtAnalytics.alimentadores.length <= 3 &&
                ` (${mtAnalytics.alimentadores.map((a) => a.nome).join(", ")})`}
            </p>
          )}
        </div>
      )}

      {/* P-195 — Capacidade de absorção dos alimentadores MT (energia anual) */}
      {mtAnalytics.energia_total_anual_kwh > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-emerald-700" />
            <p className="text-[10px] font-semibold text-emerald-900">
              Capacidade dos alimentadores
            </p>
          </div>
          <p className="text-[11px] text-emerald-800 leading-tight">
            Total carregado em 10km:{" "}
            <span className="font-mono font-semibold">
              {fmtEnergia(mtAnalytics.energia_total_anual_kwh)}
            </span>
          </p>
          {mtAnalytics.alimentadores.slice(0, 3).map((a) => (
            <div
              key={a.cod_id}
              className="text-[10px] flex items-center justify-between gap-2"
            >
              <span className="text-gray-700 truncate" title={a.nome}>
                {a.nome}
              </span>
              <span className="font-mono text-emerald-800 flex-shrink-0">
                {fmtEnergia(a.energia_kwh)}
              </span>
            </div>
          ))}
          {mtAnalytics.alimentadores.length > 3 && (
            <p className="text-[9px] text-emerald-600 italic">
              +{mtAnalytics.alimentadores.length - 3} alimentadores menores
            </p>
          )}
          <p className="text-[9px] text-gray-500 italic leading-tight pt-1 border-t border-emerald-100">
            Energia consumida no último ciclo BDGD (kWh/ano). Compare com a
            demanda estimada do empreendimento pra avaliar viabilidade.
          </p>
        </div>
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
