/**
 * ParcelamentoExportGeo.tsx — Export de geometria do terreno (US-60, Bloco J)
 *
 * Permite exportar as coordenadas do terreno em múltiplos formatos:
 *   GeoJSON · KML · KMZ · DXF
 *
 * Sessão 148 — Bloco J (Geo Avançado)
 */

import { useState } from "react";
import {
  Download,
  Globe,
  MapPin,
  Package,
  Ruler,
  CheckCircle2,
  AlertCircle,
  Info,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  exportAsGeoJSON,
  exportAsKML,
  exportAsKMZ,
  exportAsDXF,
  GEO_EXPORT_OPTIONS,
  type GeoExportFormat,
} from "@/lib/parcelamento/geoExport";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  project: {
    id: string;
    name?: string;
    area_total_m2?: number;
    /** JSON string do centróide (geography Point) */
    centroid?: string | null;
    /** Coordenadas brutas do polígono — salvas no banco como JSONB */
    geometry_coordinates?: [number, number][] | null;
  };
}

// ---------------------------------------------------------------------------
// Icon resolver
// ---------------------------------------------------------------------------

const ICONS: Record<string, React.ElementType> = {
  Globe,
  MapPin,
  Package,
  Ruler,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ParcelamentoExportGeo({ project }: Props) {
  const [loading, setLoading] = useState<GeoExportFormat | null>(null);
  const [exported, setExported] = useState<Set<GeoExportFormat>>(new Set());

  const coords = project.geometry_coordinates;
  const name = project.name ?? "terreno";
  const area = project.area_total_m2 ?? 0;

  const hasCoords = coords && coords.length >= 3;

  async function handleExport(format: GeoExportFormat) {
    if (!coords || coords.length < 3) {
      toast.error("Coordenadas do terreno não disponíveis. Verifique se o KMZ foi importado.");
      return;
    }

    setLoading(format);
    try {
      switch (format) {
        case "geojson":
          exportAsGeoJSON(coords, name, area);
          break;
        case "kml":
          exportAsKML(coords, name);
          break;
        case "kmz":
          await exportAsKMZ(coords, name);
          break;
        case "dxf":
          exportAsDXF(coords, name);
          break;
      }
      setExported((prev) => new Set([...prev, format]));
      toast.success(`Arquivo ${format.toUpperCase()} exportado com sucesso!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao exportar";
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Export de Geometria</h2>
          <p className="text-sm text-gray-500 mt-1">
            Baixe as coordenadas do terreno em múltiplos formatos para uso em
            softwares de engenharia, GIS e compartilhamento.
          </p>
        </div>
        {hasCoords && (
          <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {coords!.length} vértices
          </Badge>
        )}
      </div>

      {/* Sem coordenadas */}
      {!hasCoords && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Geometria não disponível
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  O projeto não possui coordenadas salvas. Certifique-se de que o
                  arquivo KMZ foi importado corretamente na criação do projeto.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards de formato */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {GEO_EXPORT_OPTIONS.map((opt) => {
          const Icon = ICONS[opt.icon] ?? Download;
          const isLoading = loading === opt.format;
          const isDone = exported.has(opt.format);

          return (
            <Card
              key={opt.format}
              className={`transition-all ${
                isDone
                  ? "border-green-300 bg-green-50/30"
                  : "border-gray-200 hover:border-blue-300 hover:shadow-sm"
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-blue-600" />
                    </div>
                    <CardTitle className="text-sm font-semibold">{opt.label}</CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-xs font-mono">
                    {opt.ext}
                  </Badge>
                </div>
                <CardDescription className="text-xs text-gray-500 mt-1">
                  {opt.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  size="sm"
                  className="w-full"
                  variant={isDone ? "outline" : "default"}
                  disabled={!hasCoords || isLoading}
                  onClick={() => handleExport(opt.format)}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : isDone ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 mr-2 text-green-600" />
                      Baixar novamente
                    </>
                  ) : (
                    <>
                      <Download className="w-3 h-3 mr-2" />
                      Exportar {opt.label}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Nota técnica */}
      <Card className="border-blue-100 bg-blue-50/40">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-xs text-blue-800 space-y-1">
              <p className="font-medium">Notas sobre os formatos exportados</p>
              <ul className="space-y-0.5 text-blue-700">
                <li>
                  • <strong>GeoJSON / KML / KMZ</strong>: coordenadas em graus decimais WGS-84
                  (EPSG:4326).
                </li>
                <li>
                  • <strong>DXF</strong>: coordenadas em graus decimais. Para uso em CAD
                  com unidades métricas, reprojetar para UTM no QGIS ou AutoCAD Map 3D.
                </li>
                <li>
                  • Para converter DXF para DWG, use o AutoCAD ou a função de
                  Pré-Projeto DXF {">"} ConvertAPI nesta mesma plataforma.
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas do terreno */}
      {hasCoords && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Resumo do Polígono Exportado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500">Vértices</p>
                <p className="text-lg font-bold text-gray-900">{coords!.length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Área total</p>
                <p className="text-lg font-bold text-gray-900">
                  {area > 0
                    ? `${area.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} m²`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Projeção</p>
                <p className="text-lg font-bold text-gray-900">WGS-84</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
