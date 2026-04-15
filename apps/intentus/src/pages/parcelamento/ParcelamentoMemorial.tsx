/**
 * ParcelamentoMemorial.tsx — Memorial Descritivo (Bloco H Sprint 5)
 *
 * Geração e visualização de Memorial Descritivo conforme Lei 6.015/73:
 *   - Descrição de limites da propriedade
 *   - Vértices com coordenadas geográficas
 *   - Dados técnicos de área, perímetro, datum
 *   - Histórico de memoriais gerados
 *
 * Sessão 145 — Bloco H Sprint 5 (US-130)
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { useState } from "react";
import DOMPurify from "dompurify";
import {
  FileText,
  Loader2,
  Plus,
  Trash2,
  Copy,
  Download,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Ruler,
  Layers,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useGenerateMemorial,
  useListMemorials,
  useGetMemorial,
} from "@/hooks/useMemorialDescritivo";
import type {
  VertexCoordinate,
  GenerateMemorialParams,
  MemorialSummary,
  MemorialRecord,
} from "@/lib/parcelamento/memorial-descritivo-types";
import {
  MEMORIAL_STATUS_LABELS,
  MEMORIAL_STATUS_COLORS,
  BRAZILIAN_STATES,
} from "@/lib/parcelamento/memorial-descritivo-types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  project: {
    id: string;
    name?: string;
    municipality?: string;
    state?: string;
    centroid?: string | null;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadgeColor(status: string): string {
  const color = MEMORIAL_STATUS_COLORS[status];
  if (!color) return "bg-gray-100 text-gray-800";
  // Convert hex to TW class approximation
  if (color === "#f59e0b") return "bg-amber-100 text-amber-800";
  if (color === "#3b82f6") return "bg-blue-100 text-blue-800";
  if (color === "#22c55e") return "bg-green-100 text-green-800";
  if (color === "#8b5cf6") return "bg-purple-100 text-purple-800";
  if (color === "#10b981") return "bg-emerald-100 text-emerald-800";
  return "bg-gray-100 text-gray-800";
}

function generateVertexId(): string {
  return `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function calculateAreaFromVertices(vertices: VertexCoordinate[]): number {
  if (vertices.length < 3) return 0;

  // Shoelace formula for polygon area (simplified, not handling earth curvature)
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].lng * vertices[j].lat;
    area -= vertices[j].lng * vertices[i].lat;
  }
  return Math.abs(area / 2) * 111320 * 111320; // rough conversion to m²
}

function calculatePerimeterFromVertices(vertices: VertexCoordinate[]): number {
  if (vertices.length < 2) return 0;

  let perimeter = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    const dx = vertices[j].lng - vertices[i].lng;
    const dy = vertices[j].lat - vertices[i].lat;
    // Rough distance in meters (not handling earth curvature)
    perimeter += Math.sqrt(dx * dx + dy * dy) * 111320;
  }
  return perimeter;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ParcelamentoMemorial({ project }: Props) {
  // Form state
  const [propertyName, setPropertyName] = useState(project.name || "");
  const [municipality, setMunicipality] = useState(project.municipality || "");
  const [state, setState] = useState<string>(project.state || "SP");
  const [comarca, setComarca] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerCpfCnpj, setOwnerCpfCnpj] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [cnsCode, setCnsCode] = useState("");
  const [technician, setTechnician] = useState("");
  const [creaCau, setCreaCau] = useState("");
  const [artRrt, setArtRrt] = useState("");
  const [datum, setDatum] = useState("SIRGAS 2000");
  const [meridianoCentral, setMeridianoCentral] = useState("51°W");
  const [vertices, setVertices] = useState<VertexCoordinate[]>([
    { id: generateVertexId(), label: "V1", lat: -22.5, lng: -51.5 },
    { id: generateVertexId(), label: "V2", lat: -22.5, lng: -51.4 },
    { id: generateVertexId(), label: "V3", lat: -22.6, lng: -51.4 },
  ]);
  const [additionalNotes, setAdditionalNotes] = useState("");

  // Results state
  const [generatedMemorial, setGeneratedMemorial] = useState<MemorialRecord | null>(null);
  const [memorialsList, setMemorialsList] = useState<MemorialSummary[]>([]);
  const [selectedMemorial, setSelectedMemorial] = useState<MemorialRecord | null>(null);

  // Mutations
  const generateMutation = useGenerateMemorial();
  const listMutation = useListMemorials();
  const getMutation = useGetMemorial();

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleAddVertex = () => {
    const nextLabel = `V${vertices.length + 1}`;
    const lastVertex = vertices[vertices.length - 1];
    setVertices([
      ...vertices,
      {
        id: generateVertexId(),
        label: nextLabel,
        lat: lastVertex.lat,
        lng: lastVertex.lng,
      },
    ]);
  };

  const handleRemoveVertex = (id: string) => {
    if (vertices.length > 3) {
      setVertices(vertices.filter((v) => v.id !== id));
    }
  };

  const handleUpdateVertex = (
    id: string,
    field: "label" | "lat" | "lng",
    value: unknown
  ) => {
    setVertices(
      vertices.map((v) =>
        v.id === id ? { ...v, [field]: value } : v
      )
    );
  };

  const handleGenerateMemorial = async () => {
    const area = calculateAreaFromVertices(vertices);
    const perimeter = calculatePerimeterFromVertices(vertices);

    const params: GenerateMemorialParams = {
      development_id: project.id,
      property_name: propertyName,
      municipality,
      state,
      comarca,
      owner_name: ownerName,
      owner_cpf_cnpj: ownerCpfCnpj,
      vertices,
      total_area_m2: area,
      perimeter_m: perimeter,
      datum,
      meridiano_central: meridianoCentral,
      registration_number: registrationNumber || undefined,
      cns_code: cnsCode || undefined,
      responsible_technician: technician || undefined,
      crea_cau: creaCau || undefined,
      art_rrt: artRrt || undefined,
      additional_notes: additionalNotes || undefined,
    };

    try {
      const result = await generateMutation.mutateAsync(params);
      if (result.data) {
        setGeneratedMemorial(result.data as MemorialRecord);
        setSelectedMemorial(result.data as MemorialRecord);
      } else if (result.error) {
        alert(`Erro: ${result.error.message}`);
      }
    } catch (err) {
      alert(`Erro ao gerar memorial: ${err instanceof Error ? err.message : "desconhecido"}`);
    }
  };

  const handleListMemorials = async () => {
    try {
      const result = await listMutation.mutateAsync({
        development_id: project.id,
        limit: 10,
      });
      if (result.data) {
        setMemorialsList(result.data.memorials);
      } else if (result.error) {
        alert(`Erro: ${result.error.message}`);
      }
    } catch (err) {
      alert(`Erro ao listar memoriais: ${err instanceof Error ? err.message : "desconhecido"}`);
    }
  };

  const handleLoadMemorial = async (memorialId: string) => {
    try {
      const result = await getMutation.mutateAsync({
        memorial_id: memorialId,
      });
      if (result.data) {
        setSelectedMemorial(result.data as MemorialRecord);
      } else if (result.error) {
        alert(`Erro: ${result.error.message}`);
      }
    } catch (err) {
      alert(`Erro ao carregar memorial: ${err instanceof Error ? err.message : "desconhecido"}`);
    }
  };

  const handleCopyToClipboard = () => {
    if (selectedMemorial?.memorial_text) {
      navigator.clipboard.writeText(selectedMemorial.memorial_text);
      alert("Memorial copiado para clipboard!");
    }
  };

  const handleDownloadPDF = () => {
    if (selectedMemorial?.memorial_html) {
      const blob = new Blob([selectedMemorial.memorial_html], {
        type: "text/html",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `memorial_${selectedMemorial.property_name}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-blue-50">
          <FileText className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Memorial Descritivo</h2>
          <p className="text-sm text-gray-500 mt-1">
            Geração de memorial conforme Lei 6.015/73 — Descrição de limites da propriedade
          </p>
        </div>
      </div>

      {/* Form Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados do Imóvel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Row 1: Property info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome do Imóvel
              </label>
              <Input
                value={propertyName}
                onChange={(e) => setPropertyName(e.target.value)}
                placeholder="Ex: Lote 15, Quadra A"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Município
              </label>
              <Input
                value={municipality}
                onChange={(e) => setMunicipality(e.target.value)}
                placeholder="Ex: Piracicaba"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
              >
                {BRAZILIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Comarca & Registration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Comarca
              </label>
              <Input
                value={comarca}
                onChange={(e) => setComarca(e.target.value)}
                placeholder="Ex: Comarca de Piracicaba"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número de Registro (opcional)
              </label>
              <Input
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder="Ex: 12345"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código CNS (opcional)
              </label>
              <Input
                value={cnsCode}
                onChange={(e) => setCnsCode(e.target.value)}
                placeholder="Ex: CNS-001"
              />
            </div>
          </div>

          {/* Row 3: Owner info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome do Proprietário
              </label>
              <Input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Ex: João Silva"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CPF/CNPJ
              </label>
              <Input
                value={ownerCpfCnpj}
                onChange={(e) => setOwnerCpfCnpj(e.target.value)}
                placeholder="Ex: 123.456.789-00"
              />
            </div>
          </div>

          {/* Row 4: Technical info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Profissional Responsável (opcional)
              </label>
              <Input
                value={technician}
                onChange={(e) => setTechnician(e.target.value)}
                placeholder="Ex: José Silva"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CREA/CAU (opcional)
              </label>
              <Input
                value={creaCau}
                onChange={(e) => setCreaCau(e.target.value)}
                placeholder="Ex: SP123456"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ART/RRT (opcional)
              </label>
              <Input
                value={artRrt}
                onChange={(e) => setArtRrt(e.target.value)}
                placeholder="Ex: 2024/00001"
              />
            </div>
          </div>

          {/* Row 5: Datum & Meridiano */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Datum (Sistema de Referência)
              </label>
              <select
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
              >
                <option value="SIRGAS 2000">SIRGAS 2000</option>
                <option value="SAD-69">SAD-69</option>
                <option value="WGS-84">WGS-84</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meridiano Central
              </label>
              <Input
                value={meridianoCentral}
                onChange={(e) => setMeridianoCentral(e.target.value)}
                placeholder="Ex: 51°W"
              />
            </div>
          </div>

          {/* Additional notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas Adicionais (opcional)
            </label>
            <textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Observações especiais sobre o imóvel..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Vertices Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Vértices da Poligonal</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={handleAddVertex}
            disabled={generateMutation.isPending}
          >
            <Plus className="w-4 h-4 mr-1" />
            Adicionar Vértice
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Rótulo</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Latitude</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Longitude</th>
                  <th className="text-center py-2 px-3 font-semibold text-gray-700">Ação</th>
                </tr>
              </thead>
              <tbody>
                {vertices.map((vertex) => (
                  <tr key={vertex.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <Input
                        value={vertex.label}
                        onChange={(e) =>
                          handleUpdateVertex(vertex.id, "label", e.target.value)
                        }
                        className="text-sm w-16"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Input
                        type="number"
                        value={vertex.lat}
                        onChange={(e) =>
                          handleUpdateVertex(vertex.id, "lat", parseFloat(e.target.value))
                        }
                        step="0.000001"
                        className="text-sm"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Input
                        type="number"
                        value={vertex.lng}
                        onChange={(e) =>
                          handleUpdateVertex(vertex.id, "lng", parseFloat(e.target.value))
                        }
                        step="0.000001"
                        className="text-sm"
                      />
                    </td>
                    <td className="py-2 px-3 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveVertex(vertex.id)}
                        disabled={vertices.length <= 3 || generateMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-gray-700">
            <p className="font-medium mb-1">Dados calculados:</p>
            <p>Área estimada: {calculateAreaFromVertices(vertices).toLocaleString("pt-BR")} m²</p>
            <p>Perímetro estimado: {calculatePerimeterFromVertices(vertices).toLocaleString("pt-BR")} m</p>
          </div>
        </CardContent>
      </Card>

      {/* Generate Button */}
      <div className="flex gap-3">
        <Button
          size="lg"
          onClick={handleGenerateMemorial}
          disabled={generateMutation.isPending || !propertyName || !ownerName}
        >
          {generateMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <FileText className="w-4 h-4 mr-2" />
          )}
          {generateMutation.isPending ? "Gerando..." : "Gerar Memorial"}
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={handleListMemorials}
          disabled={listMutation.isPending}
        >
          {listMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Clock className="w-4 h-4 mr-2" />
          )}
          Carregar Histórico
        </Button>
      </div>

      {/* Results Section */}
      {selectedMemorial && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <CardTitle className="text-lg">Memorial Gerado</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyToClipboard}
              >
                <Copy className="w-4 h-4 mr-1" />
                Copiar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadPDF}
              >
                <Download className="w-4 h-4 mr-1" />
                Download
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Technical Data Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-white border border-gray-200">
                <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                  <Ruler className="w-4 h-4" />
                  Área
                </div>
                <p className="font-semibold text-gray-900">
                  {selectedMemorial.total_area_m2?.toLocaleString("pt-BR")} m²
                </p>
              </div>
              <div className="p-3 rounded-lg bg-white border border-gray-200">
                <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                  <MapPin className="w-4 h-4" />
                  Perímetro
                </div>
                <p className="font-semibold text-gray-900">
                  {selectedMemorial.perimeter_m?.toLocaleString("pt-BR")} m
                </p>
              </div>
              <div className="p-3 rounded-lg bg-white border border-gray-200">
                <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                  <Layers className="w-4 h-4" />
                  Vértices
                </div>
                <p className="font-semibold text-gray-900">{selectedMemorial.vertex_count}</p>
              </div>
              <div className="p-3 rounded-lg bg-white border border-gray-200">
                <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                  <Clock className="w-4 h-4" />
                  Status
                </div>
                <Badge className={statusBadgeColor(selectedMemorial.status)}>
                  {MEMORIAL_STATUS_LABELS[selectedMemorial.status]}
                </Badge>
              </div>
            </div>

            {/* HTML Preview */}
            <div className="mt-4 p-4 rounded-lg border border-gray-200 bg-white max-h-96 overflow-y-auto">
              <div
                className="prose prose-sm text-gray-700"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(selectedMemorial.memorial_html || ""),
                }}
              />
            </div>

            {/* Additional info */}
            <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
              <div>
                <p className="font-medium text-gray-700">Criado em:</p>
                <p>{new Date(selectedMemorial.created_at).toLocaleString("pt-BR")}</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Atualizado em:</p>
                <p>{new Date(selectedMemorial.updated_at).toLocaleString("pt-BR")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History Section */}
      {memorialsList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Memoriais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {memorialsList.map((memorial) => (
                <button
                  key={memorial.id}
                  onClick={() => handleLoadMemorial(memorial.id)}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-blue-50 transition-colors flex items-start justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{memorial.property_name}</p>
                      <Badge className={statusBadgeColor(memorial.status)}>
                        {MEMORIAL_STATUS_LABELS[memorial.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {memorial.municipality}, {memorial.state} • {memorial.total_area_m2?.toLocaleString("pt-BR")} m² • {memorial.vertex_count} vértices
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(memorial.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="ml-4 text-gray-400">→</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!selectedMemorial && memorialsList.length === 0 && (
        <Card className="border-dashed border-gray-300">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-600 font-medium">Nenhum memorial gerado ainda</p>
            <p className="text-sm text-gray-500 mt-1">
              Preencha os dados acima e clique em "Gerar Memorial" para começar
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
