/**
 * ParcelamentoMapBiomas.tsx — Uso e Cobertura do Solo (Bloco H Sprint 4)
 *
 * Visualização de dados MapBiomas via Google Earth Engine:
 *   - Classificação do ano atual
 *   - Série temporal (últimos 10 anos) com gráfico de barras empilhadas
 *   - Tendência de desmatamento/urbanização
 *
 * Sessão 144 — Bloco H Sprint 4 (US-117)
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { useState } from "react";
import {
  TreePine,
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Layers,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Info,
  Leaf,
  Building2,
  Droplets,
  Wheat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  useFetchLandUse,
  useFetchTimeSeries,
} from "@/hooks/useMapBiomas";
import type {
  MapBiomasYearResult,
  FetchTimeSeriesResult,
} from "@/lib/parcelamento/mapbiomas-types";
import {
  CATEGORY_LABELS as CAT_LABELS,
  TREND_LABELS as TREND_LBL,
} from "@/lib/parcelamento/mapbiomas-types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  project: {
    id: string;
    name?: string;
    city?: string;
    state?: string;
  };
}

// ---------------------------------------------------------------------------
// Trend Icon helper
// ---------------------------------------------------------------------------

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "increasing") return <TrendingUp className="h-4 w-4 text-red-500" />;
  if (trend === "decreasing") return <TrendingDown className="h-4 w-4 text-green-500" />;
  return <Minus className="h-4 w-4 text-gray-400" />;
}

function trendColor(trend: string): string {
  if (trend === "increasing") return "text-red-600";
  if (trend === "decreasing") return "text-green-600";
  return "text-gray-500";
}

// ---------------------------------------------------------------------------
// Category icon
// ---------------------------------------------------------------------------

function CategoryIcon({ category }: { category: string }) {
  switch (category) {
    case "native_vegetation": return <Leaf className="h-4 w-4 text-green-600" />;
    case "agriculture": return <Wheat className="h-4 w-4 text-amber-500" />;
    case "urban": return <Building2 className="h-4 w-4 text-red-500" />;
    case "water": return <Droplets className="h-4 w-4 text-blue-500" />;
    default: return <Layers className="h-4 w-4 text-gray-400" />;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ParcelamentoMapBiomas({ project }: Props) {
  const currentYear = new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState(currentYear - 1);
  const [bufferRadius, setBufferRadius] = useState(1000);
  const [yearResult, setYearResult] = useState<MapBiomasYearResult | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<FetchTimeSeriesResult["data"] | null>(null);

  const fetchLandUse = useFetchLandUse();
  const fetchTimeSeries = useFetchTimeSeries();

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleFetchYear = () => {
    fetchLandUse.mutate(
      { development_id: project.id, year: selectedYear, buffer_radius_m: bufferRadius },
      {
        onSuccess: (res) => {
          if (res?.data) setYearResult(res.data);
        },
      }
    );
  };

  const handleFetchTimeSeries = () => {
    fetchTimeSeries.mutate(
      {
        development_id: project.id,
        start_year: currentYear - 10,
        end_year: currentYear - 1,
        buffer_radius_m: bufferRadius,
      },
      {
        onSuccess: (res) => {
          if (res?.data) setTimeSeriesData(res.data);
        },
      }
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TreePine className="h-5 w-5 text-green-600" />
          <h2 className="text-lg font-semibold">MapBiomas — Uso e Cobertura do Solo</h2>
          <Badge variant="outline" className="text-xs">GEE</Badge>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Dados do MapBiomas Collection 8 via Google Earth Engine. Resolução 30m (Landsat).
        Histórico de classificação do uso e cobertura do solo na área do empreendimento.
      </p>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg border">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Ano de Referência</label>
          <div className="flex items-center gap-2">
            <Slider
              value={[selectedYear]}
              min={2000}
              max={currentYear - 1}
              step={1}
              onValueChange={([v]) => setSelectedYear(v)}
              className="flex-1"
            />
            <span className="text-sm font-mono font-medium w-12 text-right">{selectedYear}</span>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Raio do Buffer (m)</label>
          <div className="flex items-center gap-2">
            <Slider
              value={[bufferRadius]}
              min={500}
              max={5000}
              step={500}
              onValueChange={([v]) => setBufferRadius(v)}
              className="flex-1"
            />
            <span className="text-sm font-mono font-medium w-16 text-right">{bufferRadius}m</span>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <Button
            size="sm"
            onClick={handleFetchYear}
            disabled={fetchLandUse.isPending}
          >
            {fetchLandUse.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Calendar className="h-4 w-4 mr-1" />
            )}
            Consultar Ano
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleFetchTimeSeries}
            disabled={fetchTimeSeries.isPending}
          >
            {fetchTimeSeries.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <BarChart3 className="h-4 w-4 mr-1" />
            )}
            Série 10 Anos
          </Button>
        </div>
      </div>

      {/* Errors */}
      {fetchLandUse.isError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          {fetchLandUse.error?.message || "Erro ao consultar MapBiomas"}
        </div>
      )}
      {fetchTimeSeries.isError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          {fetchTimeSeries.error?.message || "Erro ao consultar série temporal"}
        </div>
      )}

      {/* Year Result Card */}
      {yearResult && (
        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Classificação — {yearResult.reference_year}
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {yearResult.pixel_count.toLocaleString("pt-BR")} pixels
              </Badge>
              <Badge variant="outline" className="text-xs">
                {yearResult.collection_version}
              </Badge>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard
              icon={<Leaf className="h-5 w-5 text-green-600" />}
              label="Vegetação Nativa"
              value={`${yearResult.native_vegetation_pct}%`}
              color="green"
            />
            <SummaryCard
              icon={<Wheat className="h-5 w-5 text-amber-500" />}
              label="Agropecuária"
              value={`${yearResult.agriculture_pct}%`}
              color="amber"
            />
            <SummaryCard
              icon={<Building2 className="h-5 w-5 text-red-500" />}
              label="Área Urbana"
              value={`${yearResult.urban_pct}%`}
              color="red"
            />
            <SummaryCard
              icon={<Droplets className="h-5 w-5 text-blue-500" />}
              label="Corpos D'Água"
              value={`${yearResult.water_pct}%`}
              color="blue"
            />
          </div>

          {/* Classe dominante */}
          <div className="p-3 bg-muted/40 rounded-lg flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>Classe dominante: <strong>{yearResult.dominant_class}</strong></span>
          </div>

          {/* Land Use Classes Table */}
          {yearResult.land_use_classes.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-2">Cor</th>
                    <th className="py-2 pr-2">Classe</th>
                    <th className="py-2 pr-2 text-right">Área (ha)</th>
                    <th className="py-2 text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {yearResult.land_use_classes.slice(0, 10).map((cls) => (
                    <tr key={cls.class_id} className="border-b border-muted/30">
                      <td className="py-1.5 pr-2">
                        <div
                          className="h-3 w-3 rounded-sm"
                          style={{ backgroundColor: cls.color }}
                        />
                      </td>
                      <td className="py-1.5 pr-2">{cls.class_name}</td>
                      <td className="py-1.5 pr-2 text-right font-mono">
                        {cls.area_ha.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-1.5 text-right font-mono font-medium">
                        {cls.percentage.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Stacked bar (visual simples) */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Distribuição Visual
            </label>
            <div className="h-6 rounded-full overflow-hidden flex">
              {yearResult.land_use_classes.map((cls) => (
                <div
                  key={cls.class_id}
                  style={{
                    width: `${cls.percentage}%`,
                    backgroundColor: cls.color,
                    minWidth: cls.percentage > 0.5 ? "2px" : "0",
                  }}
                  title={`${cls.class_name}: ${cls.percentage.toFixed(1)}%`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Time Series Result */}
      {timeSeriesData && (
        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Série Temporal — {timeSeriesData.total_years} anos
            </h3>
            <Badge variant="secondary" className="text-xs">
              {timeSeriesData.cached_years} em cache
            </Badge>
          </div>

          {/* Trend Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Desmatamento</span>
                <TrendIcon trend={timeSeriesData.trend.deforestation_trend} />
              </div>
              <span className={`text-sm font-medium ${trendColor(timeSeriesData.trend.deforestation_trend)}`}>
                {TREND_LBL[timeSeriesData.trend.deforestation_trend] || timeSeriesData.trend.deforestation_trend}
              </span>
              <p className="text-xs text-muted-foreground mt-1">
                Vegetação nativa: {timeSeriesData.trend.native_veg_change_pct > 0 ? "+" : ""}
                {timeSeriesData.trend.native_veg_change_pct}%
              </p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Urbanização</span>
                <TrendIcon trend={timeSeriesData.trend.urbanization_trend} />
              </div>
              <span className={`text-sm font-medium ${trendColor(timeSeriesData.trend.urbanization_trend)}`}>
                {TREND_LBL[timeSeriesData.trend.urbanization_trend] || timeSeriesData.trend.urbanization_trend}
              </span>
            </div>
          </div>

          {/* Change Summary */}
          {timeSeriesData.trend.change_summary && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-2">Categoria</th>
                    <th className="py-2 pr-2 text-right">Início (%)</th>
                    <th className="py-2 pr-2 text-right">Fim (%)</th>
                    <th className="py-2 text-right">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(timeSeriesData.trend.change_summary).map(([key, val]) => (
                    <tr key={key} className="border-b border-muted/30">
                      <td className="py-1.5 pr-2 flex items-center gap-1.5">
                        <CategoryIcon category={key} />
                        {CAT_LABELS[key] || key}
                      </td>
                      <td className="py-1.5 pr-2 text-right font-mono">{val.start_pct.toFixed(1)}</td>
                      <td className="py-1.5 pr-2 text-right font-mono">{val.end_pct.toFixed(1)}</td>
                      <td className={`py-1.5 text-right font-mono font-medium ${val.delta > 0 ? "text-green-600" : val.delta < 0 ? "text-red-600" : ""}`}>
                        {val.delta > 0 ? "+" : ""}{val.delta.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Mini timeline bars */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Evolução Anual — Vegetação Nativa vs Agropecuária
            </label>
            <div className="space-y-1">
              {timeSeriesData.years.map((yr) => (
                <div key={yr.reference_year} className="flex items-center gap-2">
                  <span className="text-xs font-mono w-10 text-muted-foreground">{yr.reference_year}</span>
                  <div className="flex-1 h-4 rounded overflow-hidden flex bg-muted/30">
                    <div
                      className="h-full"
                      style={{ width: `${yr.native_vegetation_pct}%`, backgroundColor: "#1f8d49" }}
                      title={`Vegetação: ${yr.native_vegetation_pct}%`}
                    />
                    <div
                      className="h-full"
                      style={{ width: `${yr.agriculture_pct}%`, backgroundColor: "#ffd966" }}
                      title={`Agropecuária: ${yr.agriculture_pct}%`}
                    />
                    <div
                      className="h-full"
                      style={{ width: `${yr.urban_pct}%`, backgroundColor: "#d4271e" }}
                      title={`Urbano: ${yr.urban_pct}%`}
                    />
                    <div
                      className="h-full"
                      style={{ width: `${yr.water_pct}%`, backgroundColor: "#2532e4" }}
                      title={`Água: ${yr.water_pct}%`}
                    />
                  </div>
                  <span className="text-xs font-mono w-12 text-right text-green-700">
                    {yr.native_vegetation_pct.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: "#1f8d49" }} /> Vegetação
              </span>
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: "#ffd966" }} /> Agropecuária
              </span>
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: "#d4271e" }} /> Urbano
              </span>
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: "#2532e4" }} /> Água
              </span>
            </div>
          </div>

          {/* Nota */}
          <div className="p-3 bg-muted/30 rounded-lg flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>
              Dados MapBiomas Collection 8 (Landsat 30m). Consulta via Google Earth Engine REST API.
              Cache de 90 dias. Tendência calculada por comparação primeiro/último ano do período.
            </span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!yearResult && !timeSeriesData && !fetchLandUse.isPending && !fetchTimeSeries.isPending && (
        <div className="text-center py-12 text-muted-foreground">
          <TreePine className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Selecione um ano e clique em "Consultar Ano" ou "Série 10 Anos"</p>
          <p className="text-xs mt-1">
            Os dados serão consultados diretamente do MapBiomas via Google Earth Engine
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="p-3 rounded-lg border bg-card">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="text-lg font-bold">{value}</span>
    </div>
  );
}
