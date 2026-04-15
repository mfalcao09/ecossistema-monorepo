/**
 * ParcelamentoZoneamento.tsx — Tab de Zoneamento Municipal
 *
 * Sessão 145 — Bloco H Sprint 5 (US-125)
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 *
 * Funcionalidades:
 *   - Análise de PDF Plano Diretor via Gemini 2.0 Flash
 *   - Entrada manual de parâmetros de zoneamento
 *   - Visualização de histórico de análises
 *   - Status workflow: generated → reviewed → approved → submitted
 *   - Confidence score para validação de extrações automatizadas
 */

import { useState, useRef } from "react";
import { type ParcelamentoDevelopment } from "@/lib/parcelamento/types";
import {
  useAnalyzeZoneamentoPdf,
  useAnalyzeZoneamentoManual,
  useGetZoning,
  useListZonings,
} from "@/hooks/useZoneamento";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  History,
  Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getStatusLabel,
  getStatusColor,
  ZONING_CLASSIFICATIONS,
  ZONING_USE_TYPES,
  type ZoneamentoRecord,
} from "@/lib/parcelamento/zoneamento-types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ParcelamentoZoneamentoProps {
  project: ParcelamentoDevelopment;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ParcelamentoZoneamento({ project }: ParcelamentoZoneamentoProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mutations
  const analyzeZoneamentoPdf = useAnalyzeZoneamentoPdf();
  const analyzeZoneamentoManual = useAnalyzeZoneamentoManual();
  const getZoning = useGetZoning();
  const listZonings = useListZonings();

  // State
  const [activeTab, setActiveTab] = useState<"extract" | "manual" | "history">("extract");
  const [currentZoning, setCurrentZoning] = useState<ZoneamentoRecord | null>(null);
  const [zoningHistory, setZoningHistory] = useState<ZoneamentoRecord[]>([]);
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Manual form state
  const [manualForm, setManualForm] = useState({
    ca_basico: "" as string | number,
    ca_maximo: "" as string | number,
    ca_minimo: "" as string | number,
    to_percentual: "" as string | number,
    gabarito_andares: "" as string | number,
    gabarito_altura_m: "" as string | number,
    recuo_frontal_m: "" as string | number,
    recuo_lateral_m: "" as string | number,
    recuo_fundos_m: "" as string | number,
    zona_classificacao: "",
    permeabilidade_percentual: "" as string | number,
    usos_permitidos: "" as string,
    usos_proibidos: "" as string,
    observacoes: "",
  });

  // ---------------------------------------------------------------------------
  // Handlers: PDF extraction
  // ---------------------------------------------------------------------------

  const handlePdfUpload = async (file: File) => {
    if (!file.type.includes("pdf")) {
      toast({ description: "Por favor, selecione um arquivo PDF", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      try {
        analyzeZoneamentoPdf.mutate(
          {
            development_id: project.id,
            pdf_base64: base64,
            municipality: project.city || "",
            state: project.state || "",
          },
          {
            onSuccess: (result) => {
              if (result.data) {
                setCurrentZoning(result.data);
                toast({ description: "Plano Diretor analisado com sucesso" });
              } else if (result.error) {
                toast({
                  description: `Erro: ${result.error.message}`,
                  variant: "destructive",
                });
              }
            },
            onError: () => {
              toast({
                description: "Erro ao analisar Plano Diretor",
                variant: "destructive",
              });
            },
          }
        );
      } catch (err) {
        toast({
          description: "Erro ao ler arquivo PDF",
          variant: "destructive",
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // ---------------------------------------------------------------------------
  // Handlers: Manual entry
  // ---------------------------------------------------------------------------

  const handleManualSubmit = async () => {
    try {
      const params: any = {
        development_id: project.id,
      };

      // Parse numeric fields
      if (manualForm.ca_basico) params.ca_basico = parseFloat(String(manualForm.ca_basico));
      if (manualForm.ca_maximo) params.ca_maximo = parseFloat(String(manualForm.ca_maximo));
      if (manualForm.ca_minimo) params.ca_minimo = parseFloat(String(manualForm.ca_minimo));
      if (manualForm.to_percentual) params.to_percentual = parseFloat(String(manualForm.to_percentual));
      if (manualForm.gabarito_andares) params.gabarito_andares = parseInt(String(manualForm.gabarito_andares));
      if (manualForm.gabarito_altura_m) params.gabarito_altura_m = parseFloat(String(manualForm.gabarito_altura_m));
      if (manualForm.recuo_frontal_m) params.recuo_frontal_m = parseFloat(String(manualForm.recuo_frontal_m));
      if (manualForm.recuo_lateral_m) params.recuo_lateral_m = parseFloat(String(manualForm.recuo_lateral_m));
      if (manualForm.recuo_fundos_m) params.recuo_fundos_m = parseFloat(String(manualForm.recuo_fundos_m));
      if (manualForm.zona_classificacao) params.zona_classificacao = manualForm.zona_classificacao;
      if (manualForm.permeabilidade_percentual) params.permeabilidade_percentual = parseFloat(String(manualForm.permeabilidade_percentual));
      if (manualForm.usos_permitidos) params.usos_permitidos = manualForm.usos_permitidos.split(",").map(u => u.trim());
      if (manualForm.usos_proibidos) params.usos_proibidos = manualForm.usos_proibidos.split(",").map(u => u.trim());
      if (manualForm.observacoes) params.observacoes = manualForm.observacoes;

      analyzeZoneamentoManual.mutate(params, {
        onSuccess: (result) => {
          if (result.data) {
            setCurrentZoning(result.data);
            setManualForm({
              ca_basico: "",
              ca_maximo: "",
              ca_minimo: "",
              to_percentual: "",
              gabarito_andares: "",
              gabarito_altura_m: "",
              recuo_frontal_m: "",
              recuo_lateral_m: "",
              recuo_fundos_m: "",
              zona_classificacao: "",
              permeabilidade_percentual: "",
              usos_permitidos: "",
              usos_proibidos: "",
              observacoes: "",
            });
            toast({ description: "Zoneamento salvo com sucesso" });
          } else if (result.error) {
            toast({
              description: `Erro: ${result.error.message}`,
              variant: "destructive",
            });
          }
        },
        onError: () => {
          toast({
            description: "Erro ao salvar zoneamento",
            variant: "destructive",
          });
        },
      });
    } catch (err) {
      toast({
        description: "Erro ao processar formulário",
        variant: "destructive",
      });
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers: History
  // ---------------------------------------------------------------------------

  const loadCurrentZoning = async () => {
    setIsLoadingCurrent(true);
    getZoning.mutate(
      { development_id: project.id },
      {
        onSuccess: (result) => {
          setIsLoadingCurrent(false);
          if (result.data) {
            setCurrentZoning(result.data);
          } else if (result.error?.code !== "NOT_FOUND") {
            toast({
              description: `Erro: ${result.error?.message || "Não foi possível carregar"}`,
              variant: "destructive",
            });
          }
        },
        onError: () => {
          setIsLoadingCurrent(false);
          toast({
            description: "Erro ao carregar zoneamento",
            variant: "destructive",
          });
        },
      }
    );
  };

  const loadZoningHistory = async () => {
    setIsLoadingHistory(true);
    listZonings.mutate(
      { development_id: project.id, limit: 10 },
      {
        onSuccess: (result) => {
          setIsLoadingHistory(false);
          if (result.data) {
            setZoningHistory(
              result.data.zonings as unknown as ZoneamentoRecord[]
            );
          } else if (result.error) {
            toast({
              description: `Erro: ${result.error.message}`,
              variant: "destructive",
            });
          }
        },
        onError: () => {
          setIsLoadingHistory(false);
          toast({
            description: "Erro ao carregar histórico",
            variant: "destructive",
          });
        },
      }
    );
  };

  // ---------------------------------------------------------------------------
  // Render: Current zoning summary
  // ---------------------------------------------------------------------------

  const renderZoneamentoSummary = (zoning: ZoneamentoRecord) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-lg">{zoning.zona_classificacao || "Zona não especificada"}</h4>
          <p className="text-sm text-gray-500">
            Atualizado em {new Date(zoning.updated_at).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={zoning.confidence_score! >= 80 ? "default" : "secondary"}>
            Confiança: {zoning.confidence_score || 0}%
          </Badge>
          <Badge
            style={{
              backgroundColor: getStatusColor(zoning.status),
              color: "white",
            }}
          >
            {getStatusLabel(zoning.status)}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Coeficiente de Aproveitamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {zoning.ca_basico && <p className="text-sm">Básico: {zoning.ca_basico}</p>}
            {zoning.ca_maximo && <p className="text-sm">Máximo: {zoning.ca_maximo}</p>}
            {zoning.ca_minimo && <p className="text-sm">Mínimo: {zoning.ca_minimo}</p>}
            {!zoning.ca_basico && <p className="text-xs text-gray-500">Não informado</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Taxa de Ocupação & Gabarito</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {zoning.to_percentual && <p className="text-sm">TO: {zoning.to_percentual}%</p>}
            {zoning.gabarito_andares && <p className="text-sm">Andares: {zoning.gabarito_andares}</p>}
            {zoning.gabarito_altura_m && <p className="text-sm">Altura: {zoning.gabarito_altura_m}m</p>}
            {!zoning.to_percentual && !zoning.gabarito_andares && (
              <p className="text-xs text-gray-500">Não informado</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recuos (metros)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {zoning.recuo_frontal_m && <p className="text-sm">Frontal: {zoning.recuo_frontal_m}m</p>}
            {zoning.recuo_lateral_m && <p className="text-sm">Lateral: {zoning.recuo_lateral_m}m</p>}
            {zoning.recuo_fundos_m && <p className="text-sm">Fundos: {zoning.recuo_fundos_m}m</p>}
            {!zoning.recuo_frontal_m && <p className="text-xs text-gray-500">Não informado</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Permeabilidade & Usos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {zoning.permeabilidade_percentual && <p className="text-sm">Perm.: {zoning.permeabilidade_percentual}%</p>}
            {zoning.usos_permitidos?.length ? (
              <p className="text-xs text-gray-600">Usos: {zoning.usos_permitidos.length} permitido(s)</p>
            ) : null}
            {!zoning.permeabilidade_percentual && !zoning.usos_permitidos?.length && (
              <p className="text-xs text-gray-500">Não informado</p>
            )}
          </CardContent>
        </Card>
      </div>

      {zoning.observacoes && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Observações:</strong> {zoning.observacoes}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Zoneamento Municipal</h2>
          <p className="text-gray-600">
            Análise dos parâmetros de zoneamento do Plano Diretor
          </p>
        </div>
      </div>

      {currentZoning && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription>
            Zoneamento já cadastrado. Você pode visualizar o histórico ou adicionar uma nova análise.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="extract" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            PDF Plano Diretor
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Entrada Manual
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* Extract from PDF */}
        <TabsContent value="extract" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload do Plano Diretor</CardTitle>
              <CardDescription>
                Selecione um PDF do Plano Diretor municipal. O sistema usará IA para extrair automaticamente os parâmetros de zoneamento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm font-medium">Clique para selecionar ou arraste o PDF</p>
                <p className="text-xs text-gray-500 mt-1">Apenas PDFs (máx 10MB)</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handlePdfUpload(e.target.files[0]);
                  }
                }}
              />

              {analyzeZoneamentoPdf.isPending && (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription>Analisando Plano Diretor com IA...</AlertDescription>
                </Alert>
              )}

              {currentZoning && (
                <div className="space-y-4">
                  <h4 className="font-semibold">Resultado da Análise</h4>
                  {renderZoneamentoSummary(currentZoning)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual Entry */}
        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Entrada Manual de Zoneamento</CardTitle>
              <CardDescription>
                Preencha os parâmetros de zoneamento conforme especificado no Plano Diretor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Coeficientes */}
              <div className="space-y-4">
                <h4 className="font-semibold">Coeficiente de Aproveitamento (CA)</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>CA Básico</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={manualForm.ca_basico}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, ca_basico: e.target.value })
                      }
                      placeholder="Ex: 2.0"
                    />
                  </div>
                  <div>
                    <Label>CA Máximo</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={manualForm.ca_maximo}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, ca_maximo: e.target.value })
                      }
                      placeholder="Ex: 3.5"
                    />
                  </div>
                  <div>
                    <Label>CA Mínimo</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={manualForm.ca_minimo}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, ca_minimo: e.target.value })
                      }
                      placeholder="Ex: 0.5"
                    />
                  </div>
                </div>
              </div>

              {/* Taxa de Ocupação e Gabarito */}
              <div className="space-y-4">
                <h4 className="font-semibold">Taxa de Ocupação (TO) e Gabarito</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>TO (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={manualForm.to_percentual}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, to_percentual: e.target.value })
                      }
                      placeholder="Ex: 60"
                    />
                  </div>
                  <div>
                    <Label>Permeabilidade (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={manualForm.permeabilidade_percentual}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, permeabilidade_percentual: e.target.value })
                      }
                      placeholder="Ex: 20"
                    />
                  </div>
                  <div>
                    <Label>Gabarito (andares)</Label>
                    <Input
                      type="number"
                      value={manualForm.gabarito_andares}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, gabarito_andares: e.target.value })
                      }
                      placeholder="Ex: 8"
                    />
                  </div>
                  <div>
                    <Label>Altura Máxima (m)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={manualForm.gabarito_altura_m}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, gabarito_altura_m: e.target.value })
                      }
                      placeholder="Ex: 24"
                    />
                  </div>
                </div>
              </div>

              {/* Recuos */}
              <div className="space-y-4">
                <h4 className="font-semibold">Recuos (metros)</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Frontal (m)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={manualForm.recuo_frontal_m}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, recuo_frontal_m: e.target.value })
                      }
                      placeholder="Ex: 5"
                    />
                  </div>
                  <div>
                    <Label>Lateral (m)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={manualForm.recuo_lateral_m}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, recuo_lateral_m: e.target.value })
                      }
                      placeholder="Ex: 3"
                    />
                  </div>
                  <div>
                    <Label>Fundos (m)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={manualForm.recuo_fundos_m}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, recuo_fundos_m: e.target.value })
                      }
                      placeholder="Ex: 5"
                    />
                  </div>
                </div>
              </div>

              {/* Zona e Usos */}
              <div className="space-y-4">
                <h4 className="font-semibold">Classificação de Zona</h4>
                <div>
                  <Label>Zona</Label>
                  <select
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    value={manualForm.zona_classificacao}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, zona_classificacao: e.target.value })
                    }
                  >
                    <option value="">Selecione uma zona...</option>
                    {ZONING_CLASSIFICATIONS.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Usos */}
              <div className="space-y-4">
                <h4 className="font-semibold">Usos Permitidos e Proibidos</h4>
                <div>
                  <Label>Usos Permitidos (separados por vírgula)</Label>
                  <Textarea
                    value={manualForm.usos_permitidos}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, usos_permitidos: e.target.value })
                    }
                    placeholder="Ex: Habitação multifamiliar, Comércio varejista, Serviços profissionais"
                  />
                </div>
                <div>
                  <Label>Usos Proibidos (separados por vírgula)</Label>
                  <Textarea
                    value={manualForm.usos_proibidos}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, usos_proibidos: e.target.value })
                    }
                    placeholder="Ex: Indústria pesada, Armazém"
                  />
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-4">
                <h4 className="font-semibold">Observações</h4>
                <Textarea
                  value={manualForm.observacoes}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, observacoes: e.target.value })
                  }
                  placeholder="Notas adicionais sobre zoneamento, condições especiais, etc."
                />
              </div>

              <Button
                onClick={handleManualSubmit}
                disabled={analyzeZoneamentoManual.isPending}
                className="w-full"
              >
                {analyzeZoneamentoManual.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Salvar Zoneamento
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-4">
          <Button onClick={loadZoningHistory} disabled={isLoadingHistory} className="w-full">
            {isLoadingHistory && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Carregar Histórico
          </Button>

          {zoningHistory.length > 0 && (
            <div className="space-y-4">
              {zoningHistory.map((zoning) => (
                <Card key={zoning.id} className="cursor-pointer hover:shadow-md transition">
                  <CardHeader
                    className="pb-2"
                    onClick={() => setCurrentZoning(zoning)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">
                        {zoning.zona_classificacao || "Zona não especificada"}
                      </CardTitle>
                      <Badge
                        style={{
                          backgroundColor: getStatusColor(zoning.status),
                          color: "white",
                        }}
                      >
                        {getStatusLabel(zoning.status)}
                      </Badge>
                    </div>
                    <CardDescription>
                      {new Date(zoning.updated_at).toLocaleDateString("pt-BR")} • Confiança:{" "}
                      {zoning.confidence_score || 0}%
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}

          {zoningHistory.length === 0 && !isLoadingHistory && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Nenhum zoneamento cadastrado ainda.</AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>

      {currentZoning && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Zoneamento Atual</h4>
          {renderZoneamentoSummary(currentZoning)}
        </div>
      )}
    </div>
  );
}
