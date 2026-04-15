import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import {
  Upload, ScanSearch, AlertTriangle, CheckCircle, FileText, Download,
  ChevronRight, Copy, RefreshCw, Loader2, X, Plus, Trash2, Settings,
  BookOpen, ListChecks, ArrowLeftRight, User, Building2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { exportToCSV } from "@/lib/csvExport";
import { useExtractionTemplates, useSaveExtractionTemplate } from "@/hooks/usePropertyDocuments";

const DOC_TYPE_LABELS: Record<string, string> = {
  matricula: "Matrícula de Imóvel",
  contrato_social: "Contrato/Estatuto Social",
  procuracao: "Procuração",
  generico: "Documento Genérico",
};

const RISK_COLORS: Record<string, string> = {
  alto: "bg-red-500/20 text-red-700 border-red-200",
  medio: "bg-yellow-500/20 text-yellow-700 border-yellow-200",
  baixo: "bg-green-500/20 text-green-700 border-green-200",
};

const SITUATION_COLORS: Record<string, string> = {
  regular: "text-green-600",
  atencao: "text-yellow-600",
  irregular: "text-red-600",
};

export default function LegalRegistryOCR() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [docType, setDocType] = useState<string>("matricula");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentResult, setCurrentResult] = useState<any>(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [newTemplateFields, setNewTemplateFields] = useState<string[]>([""]);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [analysisPage, setAnalysisPage] = useState(0);
  const PAGE_SIZE = 20;

  const { data: analyses = [], isLoading } = useQuery({
    queryKey: ["legal-registry-analyses", analysisPage],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_registry_analyses")
        .select("*")
        .order("created_at", { ascending: false })
        .range(analysisPage * PAGE_SIZE, (analysisPage + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return data;
    },
  });

  const { data: templates = [] } = useExtractionTemplates();
  const saveTemplate = useSaveExtractionTemplate();

  function handleFileSelect(file: File) {
    if (!file.type.includes("pdf")) {
      toast.error("Apenas arquivos PDF são suportados");
      return;
    }
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPdfPreviewUrl(url);
    setCurrentResult(null);
  }

  useEffect(() => {
    return () => { if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl); };
  }, [pdfPreviewUrl]);

  async function handleAnalyze() {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setCurrentResult(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();

      // Upload file to storage
      const filePath = `${tenant_id}/ocr/${Date.now()}_${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("property-docs")
        .upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      // Create analysis record
      const { data: record, error: insertError } = await supabase
        .from("legal_registry_analyses")
        .insert({
          tenant_id,
          created_by: user.id,
          analysis_status: "processando",
          doc_type: docType,
          file_path: filePath,
        })
        .select().single();
      if (insertError) throw insertError;
      setCurrentAnalysisId(record.id);

      // Read file as base64
      const arrayBuffer = await selectedFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const pdfBase64 = btoa(binary);

      // Call edge function
      const { data: funcData, error: funcError } = await supabase.functions.invoke("registry-ocr-ai", {
        body: { pdfBase64, docType, analysisId: record.id },
      });

      if (funcError) throw funcError;
      if (!funcData?.success) throw new Error(funcData?.error || "Análise falhou");

      setCurrentResult(funcData.result);
      qc.invalidateQueries({ queryKey: ["legal-registry-analyses"] });
      toast.success("Análise concluída com sucesso!");
    } catch (err: any) {
      toast.error(`Erro na análise: ${err.message}`);
      if (currentAnalysisId) {
        await supabase.from("legal_registry_analyses").update({
          analysis_status: "erro",
          error_message: err.message,
        }).eq("id", currentAnalysisId);
        qc.invalidateQueries({ queryKey: ["legal-registry-analyses"] });
      }
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function loadPreviousAnalysis(analysis: any) {
    if (!analysis.structured_result) {
      toast.error("Esta análise não possui resultado estruturado");
      return;
    }
    setCurrentResult(analysis.structured_result);
    setDocType(analysis.doc_type || "matricula");
    setCurrentAnalysisId(analysis.id);
    if (analysis.file_path) {
      const { data } = await supabase.storage.from("property-docs").createSignedUrl(analysis.file_path, 3600);
      if (data?.signedUrl) setPdfPreviewUrl(data.signedUrl);
    }
  }

  function handleExportCSV() {
    if (!currentResult) return;
    if (docType === "matricula") {
      const rows = [
        ...(currentResult.historico || []).map((h: any) => ({ tipo: "Histórico", ...h })),
        ...(currentResult.gravames || []).map((g: any) => ({ tipo: "Gravame", ...g })),
        ...(currentResult.transferencias || []).map((t: any) => ({ tipo: "Transferência", ...t })),
      ];
      exportToCSV(rows, `analise_matricula_${Date.now()}`);
    } else {
      exportToCSV(currentResult.campos_extraidos || [], `analise_documento_${Date.now()}`);
    }
    toast.success("Exportado!");
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  }

  const concluidas = analyses.filter((a: any) => a.analysis_status === "concluido").length;
  const comAlertas = analyses.filter((a: any) => Array.isArray(a.alerts) && a.alerts.length > 0).length;
  const hasResult = !!currentResult;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">OCR & IA Documental</h1>
          <p className="text-muted-foreground text-sm">Análise inteligente de documentos imobiliários via Gemini 2.5 Pro</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowTemplateEditor(!showTemplateEditor)}>
            <Settings className="h-4 w-4 mr-1" /> Templates
          </Button>
          {hasResult && (
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-1" /> Exportar CSV
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold">{analyses.length}</div>
          <p className="text-xs text-muted-foreground">Total de Análises</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold text-green-600">{concluidas}</div>
          <p className="text-xs text-muted-foreground">Concluídas</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold text-destructive">{comAlertas}</div>
          <p className="text-xs text-muted-foreground">Com Alertas</p>
        </CardContent></Card>
      </div>

      {/* Template Editor */}
      {showTemplateEditor && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Templates de Extração Personalizados</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input placeholder="Nome do template" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} />
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Campos para extrair:</p>
              {newTemplateFields.map((f, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={f} onChange={(e) => {
                    const next = [...newTemplateFields];
                    next[i] = e.target.value;
                    setNewTemplateFields(next);
                  }} placeholder={`Campo ${i + 1}`} className="h-8" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setNewTemplateFields(newTemplateFields.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setNewTemplateFields([...newTemplateFields, ""])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Campo
              </Button>
            </div>
            <Button size="sm" onClick={() => {
              if (!newTemplateName || newTemplateFields.filter(Boolean).length === 0) {
                toast.error("Preencha o nome e ao menos um campo");
                return;
              }
              saveTemplate.mutate({ name: newTemplateName, docType, fields: newTemplateFields.filter(Boolean).map(f => ({ name: f, type: "text" })) });
              setNewTemplateName("");
              setNewTemplateFields([""]);
            }}>Salvar Template</Button>

            {templates.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Templates salvos:</p>
                {templates.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="text-xs">{DOC_TYPE_LABELS[t.doc_type] || t.doc_type}</Badge>
                    <span>{t.name}</span>
                    <span className="text-muted-foreground text-xs">({t.fields?.length || 0} campos)</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main split-screen area */}
      <div className={`grid gap-4 ${hasResult || isAnalyzing ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
        {/* Left: Upload + Analysis Result */}
        <div className="space-y-4">
          {/* Upload area */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex gap-2">
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAnalyze} disabled={!selectedFile || isAnalyzing} className="shrink-0">
                  {isAnalyzing ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Analisando...</> : <><ScanSearch className="h-4 w-4 mr-1" /> Analisar</>}
                </Button>
              </div>
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFileSelect(f); }}
              >
                <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-1" />
                <p className="text-sm text-muted-foreground">
                  {selectedFile ? <><span className="font-medium text-foreground">{selectedFile.name}</span> ({(selectedFile.size / 1024).toFixed(0)} KB)</> : "Arraste o PDF aqui ou clique para selecionar"}
                </p>
                <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
              </div>
            </CardContent>
          </Card>

          {/* Analysis Result */}
          {isAnalyzing && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analisando documento com Gemini 2.5 Pro...</span>
                </div>
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </CardContent>
            </Card>
          )}

          {hasResult && docType === "matricula" && (
            <MatriculaResult result={currentResult} onCopy={copyToClipboard} />
          )}

          {hasResult && docType !== "matricula" && (
            <GenericDocResult result={currentResult} onCopy={copyToClipboard} />
          )}
        </div>

        {/* Right: PDF Preview */}
        {(hasResult || isAnalyzing) && pdfPreviewUrl && (
          <Card className="overflow-hidden">
            <CardHeader className="py-2 px-4 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Documento Original
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPdfPreviewUrl(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <iframe
                src={pdfPreviewUrl}
                className="w-full"
                style={{ height: "calc(100vh - 300px)", minHeight: 500 }}
                title="PDF Preview"
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* History */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Histórico de Análises</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : analyses.length === 0 && analysisPage === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma análise realizada.</p>
          ) : (
            <>
              <div className="divide-y">
                {analyses.map((a: any) => (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 cursor-pointer" onClick={() => loadPreviousAnalysis(a)}>
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{DOC_TYPE_LABELS[a.doc_type] || "Documento"}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(a.created_at), "dd/MM/yyyy HH:mm")}</p>
                    </div>
                    <Badge variant={a.analysis_status === "concluido" ? "default" : a.analysis_status === "erro" ? "destructive" : "secondary"} className="text-xs shrink-0">
                      {a.analysis_status}
                    </Badge>
                    {Array.isArray(a.alerts) && a.alerts.length > 0 && (
                      <Badge variant="destructive" className="text-xs shrink-0">{a.alerts.length} alertas</Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between px-4 py-2 border-t">
                <Button variant="ghost" size="sm" disabled={analysisPage === 0} onClick={() => setAnalysisPage(p => p - 1)}>
                  ← Anterior
                </Button>
                <span className="text-xs text-muted-foreground">Página {analysisPage + 1}</span>
                <Button variant="ghost" size="sm" disabled={analyses.length < PAGE_SIZE} onClick={() => setAnalysisPage(p => p + 1)}>
                  Próxima →
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MatriculaResult({ result, onCopy }: { result: any; onCopy: (t: string) => void }) {
  return (
    <div className="space-y-3">
      {/* Resumo */}
      <Card className={`border-l-4 ${result.resumo?.situacao_geral === "regular" ? "border-l-green-500" : result.resumo?.situacao_geral === "atencao" ? "border-l-yellow-500" : "border-l-red-500"}`}>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Resumo da Matrícula
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ["Matrícula", result.resumo?.numero_matricula],
              ["Cartório", result.resumo?.cartorio],
              ["Município", result.resumo?.municipio],
              ["Área Total", result.resumo?.area_total],
              ["Área Construída", result.resumo?.area_construida],
              ["Inscrição Municipal", result.resumo?.inscricao_municipal],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="flex items-start gap-1">
                <span className="text-muted-foreground text-xs">{k}:</span>
                <span className="font-medium text-xs flex-1">{v}
                  <button className="ml-1 opacity-50 hover:opacity-100" onClick={() => onCopy(v as string)}><Copy className="h-3 w-3 inline" /></button>
                </span>
              </div>
            ))}
          </div>
          <p className="text-sm">{result.resumo?.descricao_imovel}</p>
          <div className={`flex items-center gap-1 text-sm font-medium ${SITUATION_COLORS[result.resumo?.situacao_geral]}`}>
            {result.resumo?.situacao_geral === "regular" ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            Situação: {result.resumo?.situacao_geral?.toUpperCase()}
          </div>
          {result.resumo?.alertas?.map((a: string, i: number) => (
            <div key={i} className="flex items-start gap-2 text-xs text-yellow-700 bg-yellow-500/10 rounded px-2 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{a}</span>
            </div>
          ))}
          {result.resumo?.recomendacoes?.map((r: string, i: number) => (
            <div key={i} className="flex items-start gap-2 text-xs text-blue-700 bg-blue-500/10 rounded px-2 py-1.5">
              <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{r}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Tabs defaultValue="proprietario">
        <TabsList className="w-full">
          <TabsTrigger value="proprietario" className="flex-1 text-xs"><User className="h-3 w-3 mr-1" /> Proprietário</TabsTrigger>
          <TabsTrigger value="historico" className="flex-1 text-xs"><BookOpen className="h-3 w-3 mr-1" /> Histórico</TabsTrigger>
          <TabsTrigger value="gravames" className="flex-1 text-xs"><AlertTriangle className="h-3 w-3 mr-1" /> Gravames</TabsTrigger>
          <TabsTrigger value="transferencias" className="flex-1 text-xs"><ArrowLeftRight className="h-3 w-3 mr-1" /> Transmissões</TabsTrigger>
        </TabsList>

        <TabsContent value="proprietario">
          {result.proprietario_atual && (
            <Card><CardContent className="pt-4 pb-3 space-y-2">
              {[
                ["Nome", result.proprietario_atual.nome],
                ["Documento", result.proprietario_atual.documento],
                ["Forma de Aquisição", result.proprietario_atual.forma_aquisicao],
                ["Data de Aquisição", result.proprietario_atual.data_aquisicao],
                ["Página", result.proprietario_atual.pagina_referencia],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex items-start gap-2 text-sm">
                  <span className="text-muted-foreground min-w-[140px] shrink-0 text-xs">{k}:</span>
                  <span className="font-medium text-xs">{v}</span>
                  <button className="opacity-50 hover:opacity-100 ml-auto" onClick={() => onCopy(String(v))}><Copy className="h-3 w-3" /></button>
                </div>
              ))}
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="historico">
          <div className="space-y-2">
            {(result.historico || []).map((h: any, i: number) => (
              <Card key={i}><CardContent className="pt-3 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">{h.numero_ato}</Badge>
                      <span className="text-xs font-medium">{h.tipo}</span>
                      <span className="text-xs text-muted-foreground ml-auto">p. {h.pagina}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{h.descricao}</p>
                    <p className="text-xs mt-1">{h.data} • {h.partes?.join(", ")}</p>
                  </div>
                </div>
              </CardContent></Card>
            ))}
            {(!result.historico || result.historico.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum histórico extraído</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="gravames">
          <div className="space-y-2">
            {(result.gravames || []).map((g: any, i: number) => (
              <Card key={i} className={`border ${RISK_COLORS[g.nivel_risco] || ""}`}>
                <CardContent className="pt-3 pb-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="font-medium text-sm">{g.tipo}</span>
                    <Badge variant="secondary" className={`text-[10px] ml-auto ${RISK_COLORS[g.nivel_risco]}`}>
                      {g.nivel_risco?.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-muted-foreground">p. {g.pagina}</span>
                  </div>
                  <p className="text-xs">Credor: <span className="font-medium">{g.credor}</span></p>
                  <p className="text-xs">Valor: <span className="font-medium">{g.valor}</span> • Status: {g.status}</p>
                  <p className="text-xs">Constituído: {g.data_constituicao} {g.data_vencimento ? `• Vence: ${g.data_vencimento}` : ""}</p>
                  <p className="text-xs text-muted-foreground italic">{g.descricao_risco}</p>
                </CardContent>
              </Card>
            ))}
            {(!result.gravames || result.gravames.length === 0) && (
              <div className="flex items-center gap-2 text-green-600 text-sm py-4 justify-center">
                <CheckCircle className="h-4 w-4" /> Nenhum gravame ou ônus identificado
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="transferencias">
          <div className="space-y-2">
            {(result.transferencias || []).map((t: any, i: number) => (
              <Card key={i}><CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-2 text-xs mb-1">
                  <span className="font-medium">{t.de}</span>
                  <ArrowLeftRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">{t.para}</span>
                  <span className="ml-auto text-muted-foreground">p. {t.pagina}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t.data} • {t.tipo_negocio} • {t.valor}</p>
              </CardContent></Card>
            ))}
            {(!result.transferencias || result.transferencias.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma transferência identificada</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GenericDocResult({ result, onCopy }: { result: any; onCopy: (t: string) => void }) {
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" /> {result.tipo_documento_detectado || "Documento"}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          <p className="text-sm text-muted-foreground">{result.resumo_executivo}</p>
          {result.pontos_atencao?.map((p: string, i: number) => (
            <div key={i} className="flex items-start gap-2 text-xs text-yellow-700 bg-yellow-500/10 rounded px-2 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{p}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Tabs defaultValue="campos">
        <TabsList>
          <TabsTrigger value="campos" className="text-xs"><ListChecks className="h-3 w-3 mr-1" /> Campos Extraídos</TabsTrigger>
          <TabsTrigger value="partes" className="text-xs"><User className="h-3 w-3 mr-1" /> Partes</TabsTrigger>
        </TabsList>
        <TabsContent value="campos">
          <div className="space-y-1.5">
            {(result.campos_extraidos || []).map((c: any, i: number) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border px-3 py-2 bg-card">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{c.campo} <span className="text-[10px]">— p. {c.pagina}</span></p>
                  <p className="text-sm font-medium truncate">{c.valor}</p>
                </div>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${c.confianca === "alta" ? "text-green-600" : c.confianca === "media" ? "text-yellow-600" : "text-red-600"}`}>
                  {c.confianca}
                </Badge>
                <button className="opacity-50 hover:opacity-100 shrink-0" onClick={() => onCopy(c.valor)}><Copy className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="partes">
          <div className="space-y-2">
            {(result.dados_partes || []).map((p: any, i: number) => (
              <Card key={i}><CardContent className="pt-3 pb-3 text-sm">
                <p className="font-medium">{p.nome}</p>
                <p className="text-xs text-muted-foreground">{p.papel} • {p.documento}</p>
              </CardContent></Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
