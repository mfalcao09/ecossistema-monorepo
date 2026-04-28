/**
 * ParcelamentoDetalhe.tsx — Detalhe do Empreendimento de Parcelamento de Solo
 * Fase 4: Tab "Mapa & Camadas" funcional com Mapbox + toggles de camadas geoespaciais
 */
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  lazy,
  Suspense,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useParcelamentoProject } from "@/hooks/useParcelamentoProjects";
import {
  calculateUrbanistic,
  calculateViabilidadeScore,
  type UrbanisticResult as UrbCalcResult,
} from "@/lib/parcelamento/urbanisticCalc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Loader2,
  MapPin,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  Maximize2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { fetchGeoLayer } from "@/lib/parcelamento/geoLayersApi";
import type { GeoLayerKey } from "@/lib/parcelamento/types";
import * as turf from "@turf/turf";

import VGVReferenceBanner from "./VGVReferenceBanner";

// Lazy load Three.js e Relatórios para não impactar o bundle principal
const TerrainViewer3D = lazy(() => import("./TerrainViewer3D"));
const ParcelamentoRelatorios = lazy(() => import("./ParcelamentoRelatorios"));
const ParcelamentoRegulacoes = lazy(() => import("./ParcelamentoRegulacoes"));
const ParcelamentoBenchmarks = lazy(() => import("./ParcelamentoBenchmarks"));
const ParcelamentoCenso = lazy(() => import("./ParcelamentoCenso"));
const ParcelamentoEmbargos = lazy(() => import("./ParcelamentoEmbargos"));
const ParcelamentoExportDxf = lazy(() => import("./ParcelamentoExportDxf"));
const ParcelamentoMapBiomas = lazy(() => import("./ParcelamentoMapBiomas"));
const ParcelamentoZoneamento = lazy(() => import("./ParcelamentoZoneamento"));
const ParcelamentoMemorial = lazy(() => import("./ParcelamentoMemorial"));
const ParcelamentoCRI = lazy(() => import("./ParcelamentoCRI"));
const ParcelamentoFIICRA = lazy(() => import("./ParcelamentoFIICRA"));
// Bloco J — Geo Avançado (Sessão 148)
const ParcelamentoExportGeo = lazy(() => import("./ParcelamentoExportGeo"));
const ParcelamentoCorteTereno = lazy(() => import("./ParcelamentoCorteTereno"));
const ParcelamentoExclusoes = lazy(() => import("./ParcelamentoExclusoes"));
// Sessão 154 — BDGD ANEEL distribuição (Tier 1 nacional + Tier 2 HD on-demand)
const ParcelamentoBDGDPanel = lazy(() => import("./ParcelamentoBDGDPanel"));
// Sessão 155 — Sprint A+C: Hillshade + Slope Heatmap + Suitability Score
const ParcelamentoTopografiaPanel = lazy(
  () => import("./ParcelamentoTopografiaPanel"),
);
// Financeiro e Conformidade — inline nas tabs (sessão 150 — Fix UX)
const ParcelamentoFinanceiro = lazy(() => import("./ParcelamentoFinanceiro"));
const ParcelamentoConformidade = lazy(
  () => import("./ParcelamentoConformidade"),
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabKey =
  | "visao-geral"
  | "mapa"
  | "3d"
  | "financeiro"
  | "conformidade"
  | "regulacoes"
  | "benchmarks"
  | "censo"
  | "embargos"
  | "export-dxf"
  | "mapbiomas"
  | "zoneamento"
  | "memorial"
  | "cri"
  | "fii-cra"
  | "relatorios"
  | "export-geo"
  | "corte-tereno"
  | "exclusoes";

const TABS: { key: TabKey; label: string }[] = [
  { key: "visao-geral", label: "Visão Geral" },
  { key: "mapa", label: "Mapa & Camadas" },
  { key: "3d", label: "Análise 3D" },
  { key: "financeiro", label: "Financeiro" },
  { key: "conformidade", label: "Conformidade Legal" },
  { key: "regulacoes", label: "Regulações Brasil" },
  { key: "benchmarks", label: "Benchmarks Mercado" },
  { key: "censo", label: "Censo IBGE" },
  { key: "embargos", label: "Embargos Ambientais" },
  { key: "export-dxf", label: "Pré-Projeto DXF" },
  { key: "mapbiomas", label: "MapBiomas" },
  { key: "zoneamento", label: "Zoneamento Municipal" },
  { key: "memorial", label: "Memorial Descritivo" },
  { key: "cri", label: "Matrícula CRI" },
  { key: "fii-cra", label: "FII / CRI-CRA" },
  { key: "relatorios", label: "Relatórios" },
  // Bloco J — Geo Avançado (Sessão 148)
  { key: "export-geo", label: "Export Geometria" },
  { key: "corte-tereno", label: "Corte Transversal" },
  { key: "exclusoes", label: "Áreas de Exclusão" },
];

// ---------------------------------------------------------------------------
// Layer config for the map panel
// ---------------------------------------------------------------------------

interface LayerConfig {
  key: GeoLayerKey;
  label: string;
  color: string;
  description: string;
  /** Renderizar pontos (ex: subestações) com paint type circle */
  point?: boolean;
  /** Renderizar linha tracejada (ex: LT planejadas/expansão) */
  dashed?: boolean;
}

const MAP_LAYERS: LayerConfig[] = [
  {
    key: "sigef_privado",
    label: "SIGEF — Imóveis Certificados",
    color: "#f59e0b",
    description: "Áreas certificadas INCRA — sobreposição fundiária",
  },
  {
    key: "ibama_uc",
    label: "IBAMA — Unidades de Conservação",
    color: "#16a34a",
    description: "Áreas protegidas — restrição a parcelamento",
  },
  {
    key: "hidrografia",
    label: "IBGE — Hidrografia",
    color: "#0ea5e9",
    description: "Rios, lagos — APP 30-500 m",
  },
  {
    key: "rodovias_federais",
    label: "DNIT — Rodovias Federais",
    color: "#ef4444",
    description: "Faixa de domínio e non aedificandi",
  },
  {
    key: "aneel_lt_existentes",
    label: "ANEEL — LT Existentes (EPE)",
    color: "#a855f7",
    description: "Linhas em operação — kV, concessionária, ano",
  },
  {
    key: "aneel_lt_planejadas",
    label: "ANEEL — LT Planejadas (EPE)",
    color: "#f97316",
    description: "Expansão prevista do SIN — servidão futura",
    dashed: true,
  },
  {
    key: "aneel_subestacoes",
    label: "ANEEL — Subestações (EPE)",
    color: "#eab308",
    description: "Subestações existentes e planejadas",
    point: true,
  },
  {
    key: "aneel_dup",
    label: "ANEEL — Servidão LT (DUP)",
    color: "#dc2626",
    description:
      "Declaração de Utilidade Pública — restrição legal a construir",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Constrói um GeoJSON FeatureCollection do polígono do projeto a partir de
 * `geometry_coordinates` (array [lng,lat][]) ou `geometry` (GeoJSON/EWKT string).
 * Retorna null se não houver dados de geometria disponíveis.
 */
function buildProjectPolygonGeoJSON(project: {
  geometry_coordinates?: [number, number][] | null;
  geometry?: unknown;
}): GeoJSON.FeatureCollection | null {
  // Prefere geometry_coordinates — já é [lng, lat][] limpo
  if (
    project.geometry_coordinates &&
    project.geometry_coordinates.length >= 3
  ) {
    const coords = project.geometry_coordinates;
    // Fechar o anel se necessário
    const ring =
      coords[0][0] === coords[coords.length - 1][0] &&
      coords[0][1] === coords[coords.length - 1][1]
        ? coords
        : [...coords, coords[0]];
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: [ring] },
        },
      ],
    };
  }

  // Fallback: tentar parsear geometry (pode ser GeoJSON object ou string)
  if (project.geometry) {
    try {
      const geo =
        typeof project.geometry === "string"
          ? JSON.parse(project.geometry)
          : project.geometry;
      if (geo && (geo.type === "Polygon" || geo.type === "MultiPolygon")) {
        return {
          type: "FeatureCollection",
          features: [{ type: "Feature", properties: {}, geometry: geo }],
        };
      }
    } catch {
      /* EWKT ou formato não-parseable — ignora */
    }
  }

  return null;
}

/**
 * Adiciona o polígono do projeto como source + layers (fill + outline) no mapa Mapbox.
 * Retorna true se adicionou com sucesso.
 */
function addProjectBoundaryToMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: any,
  geojson: GeoJSON.FeatureCollection,
): boolean {
  try {
    if (map.getSource("src-project-boundary")) return true; // já adicionado

    console.log(
      "[Intentus] addProjectBoundaryToMap — features:",
      geojson.features.length,
    );

    map.addSource("src-project-boundary", { type: "geojson", data: geojson });

    map.addLayer({
      id: "layer-project-boundary-fill",
      type: "fill",
      source: "src-project-boundary",
      paint: { "fill-color": "#3b82f6", "fill-opacity": 0.18 },
    });

    map.addLayer({
      id: "layer-project-boundary-outline",
      type: "line",
      source: "src-project-boundary",
      paint: { "line-color": "#1e40af", "line-width": 3 },
    });

    console.log("[Intentus] Polígono adicionado ao mapa com sucesso");
    return true;
  } catch (err) {
    console.error("[Intentus] Erro ao adicionar polígono do projeto:", err);
    return false;
  }
}

/**
 * Calcula bounds a partir de geometry_coordinates como fallback quando bbox não está disponível.
 */
function boundsFromCoordinates(
  coords: [number, number][],
): [[number, number], [number, number]] | null {
  if (!coords || coords.length < 2) return null;
  let minLng = Infinity,
    maxLng = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

/**
 * Formata área SEMPRE em m² (decisão UX Marcelo, Sessão 130 CONT3).
 * Nome `formatHa` é histórico — função NÃO converte mais para hectares.
 */
function formatHa(area_m2: number | null | undefined): string {
  if (!area_m2) return "—";
  return `${area_m2.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} m²`;
}

function formatCurrency(value: number | null | undefined): string {
  if (!value) return "—";
  if (value >= 1_000_000)
    return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} M`;
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function getAnalysisStatusConfig(status: string | null | undefined) {
  if (status === "concluido")
    return {
      label: "Análise Concluída",
      icon: CheckCircle2,
      color: "text-green-600",
    };
  if (status === "em_processamento")
    return { label: "Processando...", icon: Loader2, color: "text-blue-600" };
  if (status === "erro")
    return {
      label: "Erro na Análise",
      icon: AlertTriangle,
      color: "text-red-600",
    };
  if (status === "em_analise")
    return { label: "Em Análise", icon: Clock, color: "text-purple-600" };
  if (status === "rascunho")
    return { label: "Rascunho", icon: Clock, color: "text-amber-600" };
  return { label: "Pendente", icon: Clock, color: "text-gray-500" };
}

// ---------------------------------------------------------------------------
// Cálculo preliminar — usado quando analysis_results ainda não tem score
// ---------------------------------------------------------------------------

/**
 * Computa uma análise preliminar a partir APENAS dos dados declarados no
 * wizard (Step 4: pcts de área pública/verde/viário/APP + lote mínimo).
 *
 * Essa é a "primeira análise" que Marcelo pediu (Sessão 130 CONT3):
 * não depende de Edge Functions geoespaciais — é pura aritmética sobre
 * `area_m2 * (1 - soma_pcts/100)` dividido pelo `lote_minimo_m2`.
 *
 * Retorna `null` se faltarem dados mínimos (área ou lote_minimo).
 */
function computePreliminaryAnalysis(
  project: NonNullable<ReturnType<typeof useParcelamentoProject>["data"]>,
): { urb: UrbCalcResult; score: number } | null {
  const area = project.area_m2;
  const loteMin = project.lote_minimo_m2;
  if (!area || area <= 0 || !loteMin || loteMin <= 0) return null;

  // APP: prefere o calculado (SRTM/EF) — se não tiver, usa o pct declarado.
  const appDeclarado = project.pct_app_declarado
    ? (area * project.pct_app_declarado) / 100
    : 0;
  const app_area_m2 = project.app_area_m2 ?? appDeclarado;

  // Reserva Legal: usa o pct salvo ou 20% (Cerrado/MA default).
  const reserva_legal_pct = project.reserva_legal_pct ?? 20;

  // Área pública mínima: usa o pct declarado (já inclui verde + viário
  // + institucional) — se não tiver, aplica default 35% Lei 6.766.
  const pctPublicaDeclarado =
    (project.pct_area_publica ?? 0) +
    (project.pct_area_verde ?? 0) +
    (project.pct_sistema_viario ?? 0);
  const area_publica_min_pct =
    pctPublicaDeclarado > 0 ? pctPublicaDeclarado : 35;

  // Declividade: se não tem da EF, usa default conservador (8% = terreno plano).
  const declividade_pct = project.slope_avg_pct ?? 8;

  const urb = calculateUrbanistic({
    area_total_m2: area,
    declividade_pct,
    app_area_m2,
    reserva_legal_pct,
    area_publica_min_pct,
    lote_min_m2: loteMin,
  });

  const score = calculateViabilidadeScore(urb, declividade_pct);

  return { urb, score };
}

// ---------------------------------------------------------------------------
// MapaPreview — mini mapa Mapbox compacto (sem painel de camadas)
// Usado na aba Visão Geral pra dar destaque imediato ao terreno.
// ---------------------------------------------------------------------------

function MapaPreview({
  project,
  onExpand,
}: {
  project: NonNullable<ReturnType<typeof useParcelamentoProject>["data"]>;
  onExpand: () => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
    if (!token) {
      setMapError("VITE_MAPBOX_TOKEN não configurado.");
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.13.0/mapbox-gl.css";
    document.head.appendChild(link);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mapInstance: any = null;

    // Parse centroid GeoJSON string if available
    let center: [number, number] = [-47.9, -15.8];
    if (project.centroid) {
      try {
        const parsed =
          typeof project.centroid === "string"
            ? JSON.parse(project.centroid)
            : project.centroid;
        if (parsed?.coordinates)
          center = [parsed.coordinates[0], parsed.coordinates[1]];
      } catch {
        /* fallback to default */
      }
    }

    import("mapbox-gl")
      .then((mod) => {
        const mapboxgl = mod.default;
        mapboxgl.accessToken = token;
        mapInstance = new mapboxgl.Map({
          container: mapContainerRef.current!,
          style: "mapbox://styles/mapbox/satellite-streets-v12",
          center,
          zoom: project.area_m2
            ? Math.max(10, 17 - Math.log2(project.area_m2 / 10000))
            : 12,
          interactive: true,
          attributionControl: false,
        });
        mapRef.current = mapInstance;

        mapInstance.on("load", () => {
          setMapReady(true);

          // Desenhar polígono do projeto no mapa
          console.log(
            "[Intentus] MapaPreview on load — geometry_coordinates:",
            project.geometry_coordinates?.length ?? "null",
            "geometry type:",
            typeof project.geometry,
          );
          const polyGeoJSON = buildProjectPolygonGeoJSON(project);
          if (polyGeoJSON) {
            addProjectBoundaryToMap(mapInstance, polyGeoJSON);
          } else {
            console.warn(
              "[Intentus] MapaPreview — sem dados de geometria para polígono",
            );
          }

          // Fit bounds: prioriza bbox JSONB, fallback de geometry_coordinates
          if (project.bbox) {
            const bbox = project.bbox as {
              west: number;
              south: number;
              east: number;
              north: number;
            };
            mapInstance.fitBounds(
              [
                [bbox.west, bbox.south],
                [bbox.east, bbox.north],
              ],
              { padding: 30, duration: 800 },
            );
          } else if (project.geometry_coordinates) {
            const bounds = boundsFromCoordinates(project.geometry_coordinates);
            if (bounds)
              mapInstance.fitBounds(bounds, { padding: 30, duration: 800 });
          }

          // Controle de zoom minimalista (sem compass pra não poluir)
          const nav = new mapboxgl.NavigationControl({
            showCompass: false,
            showZoom: true,
          });
          mapInstance.addControl(nav, "top-right");
        });
      })
      .catch(() => {
        setMapError("mapbox-gl não instalado. Execute: npm install");
      });

    return () => {
      link.remove();
      mapInstance?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-full w-full rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
      {mapError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <MapPin className="h-8 w-8 text-gray-300 mb-2" />
          <p className="text-xs text-gray-500 text-center px-4">{mapError}</p>
        </div>
      ) : (
        <>
          <div
            ref={mapContainerRef}
            style={{ width: "100%", height: "100%" }}
          />
          {!mapReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
              <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
            </div>
          )}
          {/* Botão Expandir — canto superior esquerdo pra não conflitar com controles */}
          <button
            type="button"
            onClick={onExpand}
            className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/95 backdrop-blur shadow-md border border-gray-200 text-xs font-medium text-gray-700 hover:bg-white hover:shadow-lg transition-all"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Expandir mapa
          </button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Visão Geral (layout 60/40 com mapa em destaque)
// ---------------------------------------------------------------------------

function TabVisaoGeral({
  project,
  onExpandMap,
}: {
  project: ReturnType<typeof useParcelamentoProject>["data"];
  onExpandMap: () => void;
}) {
  // Hook chamado SEMPRE no topo (regra dos hooks) — o memo não depende do
  // early-return abaixo pois o project é checado dentro.
  const preliminary = useMemo(
    () => (project ? computePreliminaryAnalysis(project) : null),
    [project],
  );

  if (!project) return null;

  // Score real (da EF) tem prioridade. Cálculo preliminar é fallback.
  const realScore = project.analysis_results?.viabilidade_score;
  const score = realScore ?? preliminary?.score;
  const isPreliminary = realScore === undefined && preliminary !== null;

  const scoreColor =
    score === undefined
      ? "text-gray-400"
      : score >= 70
        ? "text-green-600"
        : score >= 45
          ? "text-amber-600"
          : "text-red-600";

  // Lotes estimados: prefere total_units (pode ter sido ajustado manualmente);
  // cai pro cálculo preliminar se não tiver.
  const lotesValue =
    project.total_units != null
      ? project.total_units.toLocaleString("pt-BR")
      : preliminary?.urb.lotes_estimados != null
        ? preliminary.urb.lotes_estimados.toLocaleString("pt-BR")
        : "—";

  // APP: prefere o calculado da EF; cai no declarado pelo wizard.
  const appValue =
    project.app_area_m2 != null
      ? formatHa(project.app_area_m2)
      : preliminary?.urb.app_area_m2
        ? formatHa(preliminary.urb.app_area_m2)
        : "—";

  // Área líquida (apenas do preliminar — é o destaque do cálculo do wizard).
  const areaLiquidaValue = preliminary?.urb.area_loteavel_m2
    ? formatHa(preliminary.urb.area_loteavel_m2)
    : "—";

  // Aproveitamento (%) do preliminar.
  const aproveitamentoValue = preliminary?.urb.aproveitamento_pct
    ? `${preliminary.urb.aproveitamento_pct.toFixed(1)}%`
    : "—";

  const kpis = [
    { label: "Área Total", value: formatHa(project.area_m2) },
    { label: "Área Loteável", value: areaLiquidaValue },
    { label: "Lotes Estimados", value: lotesValue },
    { label: "VGV Estimado", value: formatCurrency(project.vgv_estimado) },
    {
      label: "Declividade Média",
      value:
        project.slope_avg_pct !== null && project.slope_avg_pct !== undefined
          ? `${project.slope_avg_pct.toFixed(1)}%`
          : "—",
    },
    { label: "APP", value: appValue },
    {
      label: "Reserva Legal",
      value: project.reserva_legal_pct ? `${project.reserva_legal_pct}%` : "—",
    },
    { label: "Aproveitamento", value: aproveitamentoValue },
  ];

  return (
    <div className="space-y-5 h-full flex flex-col">
      {/* Score banner */}
      {score !== undefined && (
        <div
          className={`rounded-xl border p-5 flex items-center gap-6 flex-shrink-0 ${
            score >= 70
              ? "bg-green-50 border-green-200"
              : score >= 45
                ? "bg-amber-50 border-amber-200"
                : "bg-red-50 border-red-200"
          }`}
        >
          <div className="text-center">
            <p className={`text-5xl font-black ${scoreColor}`}>{score}</p>
            <p className="text-xs text-gray-500">/ 100</p>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900">
                Score de Viabilidade
              </p>
              {isPreliminary && (
                <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px] font-medium">
                  Estimativa preliminar
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-0.5">
              {score >= 70
                ? "Empreendimento com alta viabilidade técnica e ambiental."
                : score >= 45
                  ? "Atenção: parâmetros precisam de ajustes antes de seguir."
                  : "Score baixo — revisar restrições e parâmetros urbanísticos."}
            </p>
            {isPreliminary && (
              <p className="text-xs text-blue-600 mt-1">
                Cálculo baseado apenas nos parâmetros declarados no wizard. As
                análises geoespaciais (declividade, APP, restrições) rodam em
                background e refinam este score automaticamente.
              </p>
            )}
          </div>
        </div>
      )}

      {/* VGV de Referência Permanente (US-100) */}
      <VGVReferenceBanner
        projectId={project.id}
        vgvEstimado={project.vgv_estimado}
        totalUnits={project.total_units}
        areaM2={project.area_m2}
        updatedAt={project.updated_at}
      />

      {/* Layout 60/40 — Mapa à esquerda, KPIs à direita */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[420px]">
        {/* Mapa — 60% (3 colunas de 5) */}
        <div className="lg:col-span-3" style={{ height: 420 }}>
          <MapaPreview project={project} onExpand={onExpandMap} />
        </div>

        {/* KPIs — 40% (2 colunas de 5) */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            {kpis.map(({ label, value }) => (
              <div
                key={label}
                className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
              >
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-base font-semibold text-gray-900 mt-1">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Analysis status */}
          {(() => {
            const cfg = getAnalysisStatusConfig(project.analysis_status);
            const Icon = cfg.icon;
            return (
              <div className="flex items-center gap-2 text-xs mt-auto pt-2">
                <Icon
                  className={`h-3.5 w-3.5 ${cfg.color} ${project.analysis_status === "em_processamento" ? "animate-spin" : ""}`}
                />
                <span className={cfg.color}>{cfg.label}</span>
                {project.analysis_status === "em_processamento" && (
                  <span className="text-gray-400">— rodando em background</span>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LTImpactPanel — Painel de impacto de Linhas de Transmissão (ANEEL/EPE)
//
// Mostra resumo do impacto das LTs no terreno: quantos km dentro de 5km/10km,
// quantas subestações próximas, e alerta se LT cruza o polígono do projeto.
// Cálculo via Turf no client (buffer geodésico + booleanPointInPolygon nos
// vértices das linestrings — suficientemente preciso para preview).
// ---------------------------------------------------------------------------

interface LTStats {
  ltExist5km: number;
  ltExist10km: number;
  ltExistDentro: number; // km de LT existente cortando o terreno (alerta)
  ltPlan5km: number;
  ltPlan10km: number;
  subEx5km: number;
  subEx10km: number;
  subPl5km: number;
  subPl10km: number;
  /** Tensões únicas das LTs em 10km (kV) — ordenado desc */
  tensoesKv: number[];
  /** Concessionárias presentes em 10km */
  concessionarias: string[];
  /** P-191 — Polígonos DUP que intersectam o terreno (restrição legal) */
  dupIntersect: Array<{
    empreem?: string;
    ato_legal?: string;
    modalidade?: string;
    tensao_kv?: number;
  }>;
  /** P-191 — Polígonos DUP em 10km do terreno (mas não intersectam) */
  dupProximos: number;
}

/** Soma o comprimento (km) da LineString que está dentro do polígono buffer.
 *  Aproximação: para cada par de vértices consecutivos, se ambos estão dentro
 *  conta o segmento inteiro; se só um conta metade. Para preview é OK. */
function lengthInsideBuffer(
  lineFeature: GeoJSON.Feature<GeoJSON.LineString>,
  bufferPoly: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
): number {
  const coords = lineFeature.geometry.coordinates;
  if (!coords || coords.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = turf.point(coords[i] as [number, number]);
    const b = turf.point(coords[i + 1] as [number, number]);
    const aIn = turf.booleanPointInPolygon(a, bufferPoly);
    const bIn = turf.booleanPointInPolygon(b, bufferPoly);
    if (!aIn && !bIn) continue;
    const segKm = turf.length(
      turf.lineString([coords[i], coords[i + 1]] as [number, number][]),
      { units: "kilometers" },
    );
    if (aIn && bIn) total += segKm;
    else total += segKm / 2;
  }
  return total;
}

function countPointsInside(
  fc: GeoJSON.FeatureCollection | undefined | null,
  bufferPoly: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
  filterStatus?: "existente" | "planejada",
): number {
  if (!fc?.features) return 0;
  let count = 0;
  for (const f of fc.features) {
    if (f.geometry?.type !== "Point") continue;
    if (filterStatus) {
      const status = (f.properties as Record<string, unknown> | null)?._status;
      if (status !== filterStatus) continue;
    }
    if (
      turf.booleanPointInPolygon(
        f as GeoJSON.Feature<GeoJSON.Point>,
        bufferPoly,
      )
    ) {
      count++;
    }
  }
  return count;
}

function LTImpactPanel({
  project,
  ltExistentes,
  ltPlanejadas,
  subestacoes,
  dup,
}: {
  project: NonNullable<ReturnType<typeof useParcelamentoProject>["data"]>;
  ltExistentes?: GeoJSON.FeatureCollection;
  ltPlanejadas?: GeoJSON.FeatureCollection;
  subestacoes?: GeoJSON.FeatureCollection;
  dup?: GeoJSON.FeatureCollection;
}) {
  const stats: LTStats | null = useMemo(() => {
    const polyFC = buildProjectPolygonGeoJSON(project);
    if (!polyFC?.features?.[0]) return null;
    const projectFeature = polyFC.features[0] as GeoJSON.Feature<
      GeoJSON.Polygon | GeoJSON.MultiPolygon
    >;

    let buf5: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null =
      null;
    let buf10: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null =
      null;
    try {
      buf5 = turf.buffer(projectFeature, 5, {
        units: "kilometers",
      }) as typeof buf5;
      buf10 = turf.buffer(projectFeature, 10, {
        units: "kilometers",
      }) as typeof buf10;
    } catch (err) {
      console.warn("[LTImpact] buffer falhou:", err);
      return null;
    }
    if (!buf5 || !buf10) return null;

    let ltExist5km = 0,
      ltExist10km = 0,
      ltExistDentro = 0;
    let ltPlan5km = 0,
      ltPlan10km = 0;
    const tensoesSet = new Set<number>();
    const concSet = new Set<string>();

    const procLines = (
      fc: GeoJSON.FeatureCollection | undefined,
      kind: "existentes" | "planejadas",
    ) => {
      if (!fc?.features) return;
      for (const f of fc.features) {
        if (f.geometry?.type !== "LineString") continue;
        const line = f as GeoJSON.Feature<GeoJSON.LineString>;
        const km10 = lengthInsideBuffer(line, buf10!);
        if (km10 <= 0) continue;
        const km5 = lengthInsideBuffer(line, buf5!);
        const kmDentro = lengthInsideBuffer(line, projectFeature);
        if (kind === "existentes") {
          ltExist10km += km10;
          ltExist5km += km5;
          ltExistDentro += kmDentro;
          const t = Number(
            (line.properties as Record<string, unknown> | null)?.Tensao,
          );
          if (Number.isFinite(t) && t > 0) tensoesSet.add(t);
          const c = (line.properties as Record<string, unknown> | null)
            ?.Concession;
          if (typeof c === "string" && c.trim()) concSet.add(c.trim());
        } else {
          ltPlan10km += km10;
          ltPlan5km += km5;
        }
      }
    };

    procLines(ltExistentes, "existentes");
    procLines(ltPlanejadas, "planejadas");

    // P-191 — DUP polígonos: intersecção com terreno e proximidade 10km
    const dupIntersect: LTStats["dupIntersect"] = [];
    let dupProximos = 0;
    if (dup?.features) {
      for (const f of dup.features) {
        const t = f.geometry?.type;
        if (t !== "Polygon" && t !== "MultiPolygon") continue;
        const dupPoly = f as GeoJSON.Feature<
          GeoJSON.Polygon | GeoJSON.MultiPolygon
        >;
        try {
          if (turf.booleanIntersects(dupPoly, projectFeature)) {
            const props = (f.properties ?? {}) as Record<string, unknown>;
            const tensao = Number(props.Tensao);
            dupIntersect.push({
              empreem:
                typeof props.EMPREEM === "string" ? props.EMPREEM : undefined,
              ato_legal:
                typeof props.ATO_LEGAL === "string"
                  ? props.ATO_LEGAL
                  : undefined,
              modalidade:
                typeof props.MODALIDADE === "string"
                  ? props.MODALIDADE
                  : undefined,
              tensao_kv:
                Number.isFinite(tensao) && tensao > 0 ? tensao : undefined,
            });
          } else if (turf.booleanIntersects(dupPoly, buf10!)) {
            dupProximos++;
          }
        } catch {
          /* turf.booleanIntersects pode falhar em geometrias inválidas */
        }
      }
    }

    return {
      ltExist5km,
      ltExist10km,
      ltExistDentro,
      ltPlan5km,
      ltPlan10km,
      subEx5km: countPointsInside(subestacoes, buf5, "existente"),
      subEx10km: countPointsInside(subestacoes, buf10, "existente"),
      subPl5km: countPointsInside(subestacoes, buf5, "planejada"),
      subPl10km: countPointsInside(subestacoes, buf10, "planejada"),
      tensoesKv: Array.from(tensoesSet).sort((a, b) => b - a),
      concessionarias: Array.from(concSet).sort(),
      dupIntersect,
      dupProximos,
    };
  }, [project, ltExistentes, ltPlanejadas, subestacoes, dup]);

  if (!stats) return null;

  const fmt = (km: number) =>
    km < 0.1
      ? "—"
      : `${km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;

  const hasAnyData =
    stats.ltExist10km > 0.1 ||
    stats.ltPlan10km > 0.1 ||
    stats.subEx10km > 0 ||
    stats.subPl10km > 0 ||
    stats.dupIntersect.length > 0 ||
    stats.dupProximos > 0;

  if (!hasAnyData) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <p className="text-xs font-semibold text-gray-700 mb-1">
          Impacto LT (ANEEL)
        </p>
        <p className="text-xs text-gray-500">
          Nenhuma linha de transmissão ou subestação detectada em 10km do
          terreno.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-800">
          Impacto LT (ANEEL/EPE)
        </p>
        <span className="text-[10px] text-gray-500">5km / 10km</span>
      </div>

      {stats.ltExistDentro > 0.05 && (
        <div className="rounded bg-red-100 border border-red-300 px-2 py-1.5">
          <p className="text-[11px] font-semibold text-red-700">
            ⚠️ LT existente cruza o terreno
          </p>
          <p className="text-[11px] text-red-600">
            {fmt(stats.ltExistDentro)} de servidão dentro do polígono do projeto
          </p>
        </div>
      )}

      {stats.dupIntersect.length > 0 && (
        <div className="rounded bg-red-100 border border-red-300 px-2 py-1.5 space-y-1">
          <p className="text-[11px] font-semibold text-red-700">
            🚫 Servidão LT (DUP) sobre o terreno
          </p>
          <p className="text-[11px] text-red-600">
            {stats.dupIntersect.length}{" "}
            {stats.dupIntersect.length === 1
              ? "polígono de servidão administrativa intersecta"
              : "polígonos de servidão administrativa intersectam"}{" "}
            o projeto — restrição legal a construir.
          </p>
          <ul className="text-[10px] text-red-700 space-y-0.5 mt-1">
            {stats.dupIntersect.slice(0, 3).map((d, i) => (
              <li key={i}>
                <span className="font-medium">{d.empreem || "DUP"}</span>
                {d.tensao_kv ? ` · ${d.tensao_kv} kV` : ""}
                {d.modalidade ? ` · ${d.modalidade}` : ""}
                {d.ato_legal ? (
                  <span className="block text-[9px] text-red-500 truncate">
                    {d.ato_legal}
                  </span>
                ) : null}
              </li>
            ))}
            {stats.dupIntersect.length > 3 && (
              <li className="text-[9px] text-red-500">
                +{stats.dupIntersect.length - 3} outras DUPs
              </li>
            )}
          </ul>
        </div>
      )}

      {stats.dupProximos > 0 && stats.dupIntersect.length === 0 && (
        <div className="text-[11px] flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-gray-700">
            <span className="h-2 w-3 rounded-sm bg-red-500/30 border border-red-600" />
            Servidão LT (DUP) próxima
          </span>
          <span className="font-mono text-gray-800">
            {stats.dupProximos} em 10km
          </span>
        </div>
      )}

      {stats.ltExist10km > 0.1 && (
        <div className="text-[11px] flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-gray-700">
            <span className="h-1.5 w-3 rounded-sm bg-purple-500" />
            LT Existentes
          </span>
          <span className="font-mono text-gray-800">
            {fmt(stats.ltExist5km)} / {fmt(stats.ltExist10km)}
          </span>
        </div>
      )}

      {stats.ltPlan10km > 0.1 && (
        <div className="text-[11px] flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-gray-700">
            <span className="h-1.5 w-3 border-t-2 border-dashed border-orange-500" />
            LT Planejadas
          </span>
          <span className="font-mono text-gray-800">
            {fmt(stats.ltPlan5km)} / {fmt(stats.ltPlan10km)}
          </span>
        </div>
      )}

      {stats.subEx10km + stats.subPl10km > 0 && (
        <div className="text-[11px] flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-gray-700">
            <span className="h-2 w-2 rounded-full bg-yellow-400 border border-gray-700" />
            Subestações
          </span>
          <span className="font-mono text-gray-800">
            {stats.subEx5km + stats.subPl5km} /{" "}
            {stats.subEx10km + stats.subPl10km}
          </span>
        </div>
      )}

      {stats.tensoesKv.length > 0 && (
        <div className="pt-1 border-t border-purple-100">
          <p className="text-[10px] text-gray-500 mb-1">Tensões em 10km</p>
          <div className="flex flex-wrap gap-1">
            {stats.tensoesKv.map((kv) => (
              <span
                key={kv}
                className="text-[10px] font-mono bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-700"
              >
                {kv} kV
              </span>
            ))}
          </div>
        </div>
      )}

      {stats.concessionarias.length > 0 && (
        <div className="pt-1 border-t border-purple-100">
          <p className="text-[10px] text-gray-500 mb-1">Concessionárias</p>
          <p className="text-[10px] text-gray-700 leading-tight">
            {stats.concessionarias.slice(0, 3).join(" • ")}
            {stats.concessionarias.length > 3 &&
              ` +${stats.concessionarias.length - 3}`}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Mapa & Camadas (Fase 4 — funcional)
// ---------------------------------------------------------------------------

function TabMapa({
  project,
}: {
  project: NonNullable<ReturnType<typeof useParcelamentoProject>["data"]>;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const [layerStates, setLayerStates] = useState<
    Record<
      GeoLayerKey,
      {
        active: boolean;
        loading: boolean;
        loaded: boolean;
        geojson?: GeoJSON.FeatureCollection;
      }
    >
  >(() => {
    const initial = {} as Record<
      GeoLayerKey,
      {
        active: boolean;
        loading: boolean;
        loaded: boolean;
        geojson?: GeoJSON.FeatureCollection;
      }
    >;
    MAP_LAYERS.forEach((l) => {
      initial[l.key] = { active: false, loading: false, loaded: false };
    });
    return initial;
  });

  // Init Mapbox
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
    if (!token) {
      setMapError("VITE_MAPBOX_TOKEN não configurado.");
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.13.0/mapbox-gl.css";
    document.head.appendChild(link);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mapInstance: any = null;

    // Parse centroid GeoJSON string if available
    let center: [number, number] = [-47.9, -15.8];
    if (project.centroid) {
      try {
        const parsed =
          typeof project.centroid === "string"
            ? JSON.parse(project.centroid)
            : project.centroid;
        if (parsed?.coordinates)
          center = [parsed.coordinates[0], parsed.coordinates[1]];
      } catch {
        /* fallback to default */
      }
    }

    import("mapbox-gl")
      .then((mod) => {
        const mapboxgl = mod.default;
        mapboxgl.accessToken = token;
        mapInstance = new mapboxgl.Map({
          container: mapContainerRef.current!,
          style: "mapbox://styles/mapbox/satellite-streets-v12",
          center,
          zoom: project.area_m2
            ? Math.max(10, 17 - Math.log2(project.area_m2 / 10000))
            : 12,
        });
        mapRef.current = mapInstance;

        mapInstance.on("load", () => {
          setMapReady(true);

          // Desenhar polígono do projeto no mapa
          console.log(
            "[Intentus] TabMapa on load — geometry_coordinates:",
            project.geometry_coordinates?.length ?? "null",
            "geometry type:",
            typeof project.geometry,
          );
          const polyGeoJSON = buildProjectPolygonGeoJSON(project);
          if (polyGeoJSON) {
            addProjectBoundaryToMap(mapInstance, polyGeoJSON);
          } else {
            console.warn(
              "[Intentus] TabMapa — sem dados de geometria para polígono",
            );
          }

          // Fit bounds ao polígono: prioriza bbox JSONB, fallback de geometry_coordinates
          if (project.bbox) {
            const bbox = project.bbox as {
              west: number;
              south: number;
              east: number;
              north: number;
            };
            mapInstance.fitBounds(
              [
                [bbox.west, bbox.south],
                [bbox.east, bbox.north],
              ],
              { padding: 60, duration: 1000 },
            );
          } else if (project.geometry_coordinates) {
            const bounds = boundsFromCoordinates(project.geometry_coordinates);
            if (bounds)
              mapInstance.fitBounds(bounds, { padding: 60, duration: 1000 });
          }

          // Add navigation control
          const nav = new mapboxgl.NavigationControl({ showCompass: true });
          mapInstance.addControl(nav, "top-right");

          // Add scale control
          const scale = new mapboxgl.ScaleControl({ unit: "metric" });
          mapInstance.addControl(scale, "bottom-left");
        });
      })
      .catch(() => {
        setMapError("mapbox-gl não instalado. Execute: npm install");
      });

    return () => {
      link.remove();
      mapInstance?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toggle a geo layer
  const toggleLayer = useCallback(
    async (layerConfig: LayerConfig) => {
      const key = layerConfig.key;
      const current = layerStates[key];

      if (!mapRef.current || !mapReady) return;

      // If already loaded, just toggle visibility
      if (current.loaded) {
        const newActive = !current.active;
        const visibility = newActive ? "visible" : "none";
        // Tentar cada sub-layer silenciosamente (fill, line, outline, circle)
        for (const suffix of ["", "-line", "-outline", "-circle"]) {
          try {
            mapRef.current.setLayoutProperty(
              `layer-${key}${suffix}`,
              "visibility",
              visibility,
            );
          } catch {
            /* layer may not exist */
          }
        }
        setLayerStates((prev) => ({
          ...prev,
          [key]: { ...prev[key], active: newActive },
        }));
        return;
      }

      // Fetch from EF and add to map
      setLayerStates((prev) => ({
        ...prev,
        [key]: { ...prev[key], loading: true, active: true },
      }));

      try {
        const bbox = project.bbox;
        if (!bbox) throw new Error("Bbox do projeto não disponível");

        console.log(`[Intentus] toggleLayer "${key}" — fetching from EF...`);
        const result = await fetchGeoLayer(project.id, key, {
          west: bbox.west,
          south: bbox.south,
          east: bbox.east,
          north: bbox.north,
        });

        console.log(
          `[Intentus] toggleLayer "${key}" — result ok:`,
          result.ok,
          "features:",
          result.data?.geojson?.features?.length ?? 0,
        );

        if (!result.ok) throw new Error(result.error?.message ?? "Erro na EF");

        const map = mapRef.current;
        if (!map) return;

        const geojson = result.data?.geojson ?? {
          type: "FeatureCollection",
          features: [],
        };

        // Se não retornou features, a camada está vazia nesta região
        if (!geojson.features || geojson.features.length === 0) {
          console.warn(
            `[Intentus] Camada "${key}" sem features na região do projeto`,
          );
        }

        map.addSource(`src-${key}`, { type: "geojson", data: geojson });

        // Fill layer para Polygons (UCs, SIGEF)
        map.addLayer({
          id: `layer-${key}`,
          type: "fill",
          source: `src-${key}`,
          paint: { "fill-color": layerConfig.color, "fill-opacity": 0.25 },
          filter: ["==", "$type", "Polygon"],
        });

        // Line layer para LineString (hidrografia, rodovias, LT)
        // line-dasharray quando layerConfig.dashed (LT planejadas)
        const linePaint: Record<string, unknown> = {
          "line-color": layerConfig.color,
          "line-width": layerConfig.dashed ? 3 : 2.5,
          "line-opacity": 0.9,
        };
        if (layerConfig.dashed) {
          linePaint["line-dasharray"] = [2, 2];
        }
        map.addLayer({
          id: `layer-${key}-line`,
          type: "line",
          source: `src-${key}`,
          paint: linePaint,
          filter: ["==", "$type", "LineString"],
        });

        // Circle layer para Points (subestações, ANEEL EPE layer 20+9)
        if (layerConfig.point) {
          map.addLayer({
            id: `layer-${key}-circle`,
            type: "circle",
            source: `src-${key}`,
            paint: {
              "circle-radius": 6,
              "circle-color": layerConfig.color,
              "circle-stroke-color": "#1f2937",
              "circle-stroke-width": 1.5,
              "circle-opacity": 0.9,
            },
            filter: ["==", "$type", "Point"],
          });
        }

        // Outline para Polygons apenas (não polui Points/Lines)
        map.addLayer({
          id: `layer-${key}-outline`,
          type: "line",
          source: `src-${key}`,
          paint: { "line-color": layerConfig.color, "line-width": 1.5 },
          filter: ["==", "$type", "Polygon"],
        });

        setLayerStates((prev) => ({
          ...prev,
          [key]: { active: true, loading: false, loaded: true, geojson },
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        setLayerStates((prev) => ({
          ...prev,
          [key]: { ...prev[key], loading: false, active: false },
        }));
        // toast is not imported here — use console for now
        console.warn(`Erro ao carregar camada ${key}:`, msg);
      }
    },
    [mapReady, layerStates, project.id, project.bbox],
  );

  return (
    <div className="flex flex-col gap-3" style={{ minHeight: 600 }}>
      {/* Map — ocupa ~70% da viewport disponível */}
      <div
        className="relative rounded-xl overflow-hidden border border-gray-200"
        style={{ height: "calc(100vh - 280px)", minHeight: 480 }}
      >
        {mapError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
            <MapPin className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 text-center px-6">{mapError}</p>
          </div>
        ) : (
          <>
            <div
              ref={mapContainerRef}
              style={{ width: "100%", height: "100%" }}
            />
            {!mapReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Toggles compactos em grid horizontal — abaixo do mapa */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-gray-600" />
          <h3 className="text-xs font-semibold text-gray-800 uppercase tracking-wide">
            Camadas
          </h3>
          {!mapReady && !mapError && (
            <span className="text-[10px] text-gray-400 italic">
              carregando mapa…
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
          {MAP_LAYERS.map((layer) => {
            const state = layerStates[layer.key];
            return (
              <button
                key={layer.key}
                onClick={() => mapReady && toggleLayer(layer)}
                disabled={!mapReady || state.loading}
                title={layer.description}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left transition-all ${
                  state.active
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                } ${!mapReady ? "opacity-50" : ""} ${
                  state.loading ? "cursor-wait" : "cursor-pointer"
                }`}
              >
                <div
                  className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: layer.color }}
                />
                <span className="text-[11px] font-medium text-gray-800 truncate flex-1">
                  {layer.label.replace(/^[A-Z]+ — /, "")}
                </span>
                {state.loading ? (
                  <Loader2 className="h-3 w-3 text-blue-500 animate-spin flex-shrink-0" />
                ) : (
                  <Switch
                    checked={state.active}
                    disabled={!mapReady}
                    onCheckedChange={() => toggleLayer(layer)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Alternar ${layer.label}`}
                    className="scale-75 flex-shrink-0"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Painéis de análise — 2 colunas em telas grandes pra economizar vertical */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 pt-1">
          {/* Painel impacto LT */}
          {(layerStates.aneel_lt_existentes.loaded ||
            layerStates.aneel_lt_planejadas.loaded ||
            layerStates.aneel_subestacoes.loaded ||
            layerStates.aneel_dup.loaded) && (
            <LTImpactPanel
              project={project}
              ltExistentes={layerStates.aneel_lt_existentes.geojson}
              ltPlanejadas={layerStates.aneel_lt_planejadas.geojson}
              subestacoes={layerStates.aneel_subestacoes.geojson}
              dup={layerStates.aneel_dup.geojson}
            />
          )}

          {/* Painel BDGD */}
          <Suspense fallback={null}>
            <ParcelamentoBDGDPanel
              map={mapRef.current}
              mapReady={mapReady}
              developmentId={project.id}
            />
          </Suspense>

          {/* Painel Topografia */}
          <Suspense fallback={null}>
            <ParcelamentoTopografiaPanel
              map={mapRef.current}
              mapReady={mapReady}
              project={project}
              ltExistentes={layerStates.aneel_lt_existentes.geojson}
              ltPlanejadas={layerStates.aneel_lt_planejadas.geojson}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Outer ErrorBoundary — protege a tab 3D de crashes fora do R3F Canvas
// ---------------------------------------------------------------------------

interface ThreeDErrorState {
  hasError: boolean;
  error: Error | null;
}

class ThreeDTabErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ThreeDErrorState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error): ThreeDErrorState {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-[500px] rounded-xl border-2 border-dashed border-red-200 bg-red-50/50">
          <p className="text-sm font-medium text-red-600">
            Erro na visualização 3D
          </p>
          <p className="text-xs text-red-400 mt-1 max-w-md text-center px-4">
            {this.state.error?.message ?? "Falha ao renderizar modelo 3D."}
          </p>
          <button
            className="mt-3 px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ParcelamentoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>("visao-geral");

  const {
    data: project,
    isLoading,
    error,
  } = useParcelamentoProject(id ?? null);

  // Score: prefere o da EF; cai no preliminar pro badge do header.
  // ATENÇÃO: useMemo DEVE ficar antes de qualquer conditional return (Rules of Hooks).
  const realScore = project?.analysis_results?.viabilidade_score;
  const preliminaryHeader = useMemo(
    () =>
      project && realScore === undefined
        ? computePreliminaryAnalysis(project)
        : null,
    [realScore, project],
  );
  const score = realScore ?? preliminaryHeader?.score;
  const isPreliminaryHeader =
    realScore === undefined && preliminaryHeader !== null;
  const scoreLabel =
    score !== undefined
      ? score >= 70
        ? "Alta Viabilidade"
        : score >= 45
          ? "Média Viabilidade"
          : "Baixa Viabilidade"
      : null;
  const scoreBadgeColor =
    score === undefined
      ? "bg-gray-100 text-gray-600"
      : score >= 70
        ? "bg-green-100 text-green-700"
        : score >= 45
          ? "bg-amber-100 text-amber-700"
          : "bg-red-100 text-red-700";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">
            {error
              ? `Erro: ${error.message}`
              : "Empreendimento não encontrado."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => navigate("/parcelamento")}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Projetos
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-600 truncate max-w-[250px]">
            {project.name}
          </span>
        </div>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                {project.city && project.state
                  ? `${project.city} — ${project.state}`
                  : "Localização não definida"}
              </span>
              {project.area_m2 != null && (
                <>
                  <span className="text-gray-300">•</span>
                  <span>
                    {project.area_m2.toLocaleString("pt-BR", {
                      maximumFractionDigits: 0,
                    })}{" "}
                    m²
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {score !== undefined && scoreLabel && (
              <Badge className={`${scoreBadgeColor} border-0 font-medium`}>
                Score {score}
                {isPreliminaryHeader ? "*" : ""} — {scoreLabel}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("financeiro")}
            >
              Financeiro
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("conformidade")}
            >
              Conformidade
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate(`/parcelamento/${id}/cad`)}
            >
              CAD Studio
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-1 border-b border-gray-100">
        <div className="flex gap-0.5 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-[13px] font-medium whitespace-nowrap rounded-t-md border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600 bg-blue-50/50"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div
        className={`flex-1 ${activeTab === "mapa" ? "p-2" : "p-6"} overflow-auto`}
      >
        {activeTab === "visao-geral" && (
          <TabVisaoGeral
            project={project}
            onExpandMap={() => setActiveTab("mapa")}
          />
        )}

        {activeTab === "mapa" && <TabMapa project={project} />}

        {/* Tab 3D — Lazy loaded Three.js — duplo ErrorBoundary (outer + inner WebGL) */}
        {activeTab === "3d" && (
          <ThreeDTabErrorBoundary>
            <Suspense
              fallback={
                <div className="flex flex-col items-center justify-center h-[500px] rounded-xl border border-gray-200 bg-gray-50/50">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                  <p className="text-sm text-gray-500">
                    Carregando visualização 3D...
                  </p>
                </div>
              }
            >
              <TerrainViewer3D project={project} />
            </Suspense>
          </ThreeDTabErrorBoundary>
        )}

        {/* Tab Relatórios — Lazy loaded PDF generation */}
        {activeTab === "relatorios" && (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-gray-200 bg-gray-50/50">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                <p className="text-sm text-gray-500">
                  Carregando módulo de relatórios...
                </p>
              </div>
            }
          >
            <ParcelamentoRelatorios project={project} />
          </Suspense>
        )}

        {/* Tab Regulações Brasil — Lazy loaded (Bloco H) */}
        {activeTab === "regulacoes" && (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-gray-200 bg-gray-50/50">
                <Loader2 className="w-8 h-8 text-lime-500 animate-spin mb-2" />
                <p className="text-sm text-gray-500">
                  Carregando regulações brasileiras...
                </p>
              </div>
            }
          >
            <ParcelamentoRegulacoes project={project} />
          </Suspense>
        )}

        {/* Tab Benchmarks de Mercado — Lazy loaded (Bloco H Sprint 2) */}
        {activeTab === "benchmarks" && (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-gray-200 bg-gray-50/50">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-2" />
                <p className="text-sm text-gray-500">
                  Carregando benchmarks de mercado...
                </p>
              </div>
            }
          >
            <ParcelamentoBenchmarks project={project} />
          </Suspense>
        )}

        {/* Tab Censo IBGE — Lazy loaded (Bloco H Sprint 3 — US-124) */}
        {activeTab === "censo" && (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-gray-200 bg-gray-50/50">
                <Loader2 className="w-8 h-8 text-violet-500 animate-spin mb-2" />
                <p className="text-sm text-gray-500">
                  Carregando dados censitários IBGE...
                </p>
              </div>
            }
          >
            <ParcelamentoCenso project={project} />
          </Suspense>
        )}

        {/* Tab Embargos Ambientais — Lazy loaded (Bloco H Sprint 3 — US-126) */}
        {activeTab === "embargos" && (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-gray-200 bg-gray-50/50">
                <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-2" />
                <p className="text-sm text-gray-500">
                  Carregando embargos ambientais...
                </p>
              </div>
            }
          >
            <ParcelamentoEmbargos project={project} />
          </Suspense>
        )}

        {/* Tab Pré-Projeto DXF — Lazy loaded (Bloco H Sprint 3 — US-131) */}
        {activeTab === "export-dxf" && (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-gray-200 bg-gray-50/50">
                <Loader2 className="w-8 h-8 text-teal-500 animate-spin mb-2" />
                <p className="text-sm text-gray-500">
                  Carregando exportador DXF...
                </p>
              </div>
            }
          >
            <ParcelamentoExportDxf project={project} />
          </Suspense>
        )}

        {/* Tab MapBiomas — Lazy loaded (Bloco H Sprint 4 — US-117) */}
        {activeTab === "mapbiomas" && (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-gray-200 bg-gray-50/50">
                <Loader2 className="w-8 h-8 text-green-500 animate-spin mb-2" />
                <p className="text-sm text-gray-500">Carregando MapBiomas...</p>
              </div>
            }
          >
            <ParcelamentoMapBiomas project={project} />
          </Suspense>
        )}

        {/* Tab Zoneamento Municipal — Lazy loaded (Bloco H Sprint 5 — US-125) */}
        {activeTab === "zoneamento" && (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-gray-200 bg-gray-50/50">
                <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mb-2" />
                <p className="text-sm text-gray-500">
                  Carregando zoneamento municipal...
                </p>
              </div>
            }
          >
            <ParcelamentoZoneamento project={project} />
          </Suspense>
        )}

        {/* Tab Memorial Descritivo — Lazy loaded (Bloco H Sprint 5 — US-130) */}
        {activeTab === "memorial" && (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-gray-200 bg-gray-50/50">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-2" />
                <p className="text-sm text-gray-500">
                  Carregando Memorial Descritivo...
                </p>
              </div>
            }
          >
            <ParcelamentoMemorial project={project} />
          </Suspense>
        )}

        {/* Tab Matrícula CRI — Lazy loaded (Bloco H Sprint 5 — US-133) */}
        {activeTab === "cri" && (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-gray-200 bg-gray-50/50">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-2" />
                <p className="text-sm text-gray-500">
                  Carregando Matrícula CRI...
                </p>
              </div>
            }
          >
            <ParcelamentoCRI project={project} />
          </Suspense>
        )}

        {/* Tab FII/CRI-CRA — Lazy loaded (Bloco H Sprint 5 — US-134/135) */}
        {activeTab === "fii-cra" && (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-gray-200 bg-gray-50/50">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-2" />
                <p className="text-sm text-gray-500">
                  Carregando Simulador FII/CRA...
                </p>
              </div>
            }
          >
            <ParcelamentoFIICRA project={project} />
          </Suspense>
        )}

        {/* Bloco J — Geo Avançado (Sessão 148) */}
        {activeTab === "export-geo" && (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-gray-200 bg-gray-50/50">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                <p className="text-sm text-gray-500">
                  Carregando Export Geometria...
                </p>
              </div>
            }
          >
            <ParcelamentoExportGeo
              project={{
                id: project.id,
                name: project.name,
                area_total_m2: project.area_m2 ?? undefined,
                centroid:
                  typeof project.centroid === "string"
                    ? project.centroid
                    : JSON.stringify(project.centroid),
                geometry_coordinates: project.geometry_coordinates ?? undefined,
              }}
            />
          </Suspense>
        )}

        {activeTab === "corte-tereno" && (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-gray-200 bg-gray-50/50">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                <p className="text-sm text-gray-500">
                  Carregando Corte Transversal...
                </p>
              </div>
            }
          >
            <ParcelamentoCorteTereno
              project={{
                id: project.id,
                name: project.name,
                centroid:
                  typeof project.centroid === "string"
                    ? project.centroid
                    : JSON.stringify(project.centroid),
                geometry_coordinates: project.geometry_coordinates ?? undefined,
              }}
            />
          </Suspense>
        )}

        {activeTab === "exclusoes" && (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-gray-200 bg-gray-50/50">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                <p className="text-sm text-gray-500">
                  Carregando Áreas de Exclusão...
                </p>
              </div>
            }
          >
            <ParcelamentoExclusoes
              project={{
                id: project.id,
                name: project.name,
                area_m2: project.area_m2 ?? undefined,
                centroid:
                  typeof project.centroid === "string"
                    ? project.centroid
                    : JSON.stringify(project.centroid),
                geometry_coordinates: project.geometry_coordinates ?? undefined,
                exclusion_areas: project.exclusion_areas ?? undefined,
              }}
            />
          </Suspense>
        )}

        {/* Tab Financeiro — Lazy loaded inline (Fix sessão 150) */}
        {activeTab === "financeiro" && (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-gray-200 bg-gray-50/50">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-2" />
                <p className="text-sm text-gray-500">
                  Carregando módulo financeiro...
                </p>
              </div>
            }
          >
            <ParcelamentoFinanceiro />
          </Suspense>
        )}

        {/* Tab Conformidade Legal — Lazy loaded inline (Fix sessão 150) */}
        {activeTab === "conformidade" && (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-gray-200 bg-gray-50/50">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                <p className="text-sm text-gray-500">
                  Carregando conformidade legal...
                </p>
              </div>
            }
          >
            <ParcelamentoConformidade />
          </Suspense>
        )}
      </div>
    </div>
  );
}
