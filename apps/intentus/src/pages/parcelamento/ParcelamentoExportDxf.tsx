/**
 * ParcelamentoExportDxf.tsx — Exportação Pré-Projeto Urbanístico (Bloco H Sprint 3)
 *
 * Geração e download de pré-projetos urbanísticos:
 *   - DXF (AutoCAD R12) — formato padrão para prefeituras (US-131)
 *   - DWG (via ConvertAPI) — quando disponível
 *   - Quadro de Áreas
 *
 * Sessão 143 — Bloco H Sprint 3
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { useState } from "react";
import {
  FileDown,
  Loader2,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Info,
  FileText,
  Download,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGenerateDxf } from "@/hooks/useUrbanisticExport";
import type {
  GenerateDxfResult,
  LayoutSummary,
} from "@/lib/parcelamento/urbanistic-export-types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  project: {
    id: string;
    name?: string;
    city?: string;
    state?: string;
    area_total_m2?: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function downloadBase64(base64: string, filename: string, mimeType: string) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatNumber(v: number): string {
  return v.toLocaleString("pt-BR");
}

function formatArea(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(2)} ha`;
  return `${formatNumber(v)} m²`;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ParcelamentoExportDxf({ project }: Props) {
  const [convertDwg, setConvertDwg] = useState(false);
  const generateDxf = useGenerateDxf();
  const result = generateDxf.data as GenerateDxfResult | undefined;
  const dxfData = result?.data;

  const handleGenerate = () => {
    generateDxf.mutate({
      development_id: project.id,
      nome: project.name,
      municipio: project.city,
      uf: project.state,
      area_total_m2: project.area_total_m2,
      convert_to_dwg: convertDwg,
    });
  };

  const handleDownloadDxf = () => {
    if (dxfData?.dxf?.content_base64) {
      downloadBase64(
        dxfData.dxf.content_base64,
        dxfData.dxf.filename,
        "application/dxf"
      );
    }
  };

  const handleDownloadDwg = () => {
    if (dxfData?.dwg?.content_base64) {
      downloadBase64(
        dxfData.dwg.content_base64,
        dxfData.dwg.filename,
        "application/acad"
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <FileDown className="w-5 h-5 text-teal-600" />
        <h2 className="text-lg font-semibold text-gray-900">Pré-Projeto Urbanístico</h2>
        <Badge variant="outline" className="text-[10px]">DXF/DWG</Badge>
      </div>
      <p className="text-sm text-gray-500 -mt-2">
        Gere o pré-projeto urbanístico em formato DXF (AutoCAD) para submissão à prefeitura.
        Inclui lotes, vias, APPs, áreas verdes e institucionais com layers organizados.
      </p>

      {/* Controles */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-50">
              <Layers className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Gerar Arquivo DXF</h3>
              <p className="text-xs text-gray-500">
                Formato AutoCAD R12 — compatível com todas as versões do AutoCAD, BricsCAD, ZWCAD
              </p>
            </div>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generateDxf.isPending}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {generateDxf.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <FileDown className="w-4 h-4 mr-2" />
            )}
            {dxfData ? "Regenerar" : "Gerar Pré-Projeto"}
          </Button>
        </div>

        {/* Opção DWG */}
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={convertDwg}
            onChange={(e) => setConvertDwg(e.target.checked)}
            className="rounded border-gray-300"
          />
          Converter também para DWG (requer ConvertAPI)
        </label>

        {generateDxf.isError && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
            <AlertTriangle className="w-4 h-4" />
            {generateDxf.error?.message}
          </div>
        )}
      </div>

      {/* Resultado */}
      {dxfData && (
        <div className="space-y-4">
          {/* Download buttons */}
          <div className="rounded-xl border border-green-200 bg-green-50/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-sm font-semibold text-green-800">Pré-projeto gerado com sucesso</span>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleDownloadDxf} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1" />
                Download DXF ({(dxfData.dxf.size_bytes / 1024).toFixed(0)} KB)
              </Button>
              {dxfData.dwg && (
                <Button onClick={handleDownloadDwg} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-1" />
                  Download DWG
                </Button>
              )}
            </div>

            <p className="text-[10px] text-gray-500 mt-2">
              Formato: {dxfData.dxf.format} | {dxfData.nota}
            </p>
          </div>

          {/* Layout Summary */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-400" />
              Resumo do Layout
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[
                { label: "Lotes", value: formatNumber(dxfData.layout_summary.lotes) },
                { label: "Quadras", value: formatNumber(dxfData.layout_summary.quadras) },
                { label: "Vias", value: formatNumber(dxfData.layout_summary.vias) },
                { label: "APPs", value: formatNumber(dxfData.layout_summary.apps) },
                { label: "Áreas Verdes", value: formatNumber(dxfData.layout_summary.areas_verdes) },
                { label: "Áreas Institucionais", value: formatNumber(dxfData.layout_summary.areas_institucionais) },
                { label: "Área Total", value: formatArea(dxfData.layout_summary.area_total_m2) },
              ].map((item, i) => (
                <div key={i} className="p-2 rounded-lg bg-gray-50">
                  <p className="text-[10px] text-gray-500">{item.label}</p>
                  <p className="text-sm font-semibold text-gray-900">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Layers */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-gray-400" />
              Layers do Arquivo
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {dxfData.layers.map((layer: string, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-700 py-1">
                  <div className="w-2 h-2 rounded-full bg-teal-400" />
                  {layer}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-700">
          <p className="font-medium mb-1">Sobre o pré-projeto</p>
          <p>
            O arquivo DXF gerado é um pré-projeto urbanístico para fins de análise preliminar
            junto à prefeitura. Deve ser revisado e assinado por engenheiro/arquiteto responsável
            (CREA/CAU) antes da submissão formal. O layout é baseado nos parâmetros do empreendimento
            e nas exigências da Lei 6.766/79.
          </p>
        </div>
      </div>
    </div>
  );
}
