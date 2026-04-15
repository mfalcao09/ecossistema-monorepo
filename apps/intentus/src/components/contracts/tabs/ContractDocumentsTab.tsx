import { useState, useRef } from "react";
import {
  useContractDocuments, useUploadContractDocument, useUpdateDocumentStatus, useDeleteContractDocument,
} from "@/hooks/useContractDocuments";
import { documentTypeLabels, documentStatusLabels, documentStatusColors } from "@/lib/clmSchema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, Download, Trash2, FileText, History, ScanSearch, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  contractId: string;
}

export function ContractDocumentsTab({ contractId }: Props) {
  const { data: docs, isLoading } = useContractDocuments(contractId);
  const upload = useUploadContractDocument();
  const updateStatus = useUpdateDocumentStatus();
  const deletDoc = useDeleteContractDocument();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("outro");
  const [notes, setNotes] = useState("");
  const [filterType, setFilterType] = useState("todos");

  // AI Analysis state
  const [analyzingDocId, setAnalyzingDocId] = useState<string | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiDocTitle, setAiDocTitle] = useState("");

  const handleUpload = async () => {
    const file = selectedFile || fileRef.current?.files?.[0];
    if (!file || !title.trim()) return;
    await upload.mutateAsync({ contractId, file, title: title.trim(), documentType: docType, notes });
    setTitle(""); setNotes(""); setDocType("outro"); setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    const { data } = await supabase.storage.from("contract-documents").createSignedUrl(filePath, 300);
    if (data?.signedUrl) {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = fileName;
      a.click();
    }
  };

  const handleAnalyzeWithAI = async (doc: any) => {
    if (!doc.file_path) { toast.error("Documento sem arquivo"); return; }
    const isPdf = doc.file_path.toLowerCase().includes(".pdf") || doc.mime_type === "application/pdf";
    if (!isPdf) {
      toast.error("Análise IA disponível apenas para PDFs");
      return;
    }
    setAnalyzingDocId(doc.id);
    setAiDocTitle(doc.title);
    setAiResult(null);
    setAiPanelOpen(true);
    try {
      // Get signed URL and fetch file
      const { data: urlData } = await supabase.storage.from("contract-documents").createSignedUrl(doc.file_path, 60);
      if (!urlData?.signedUrl) throw new Error("Não foi possível obter URL do arquivo");

      const resp = await fetch(urlData.signedUrl);
      const arrayBuffer = await resp.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const pdfBase64 = btoa(binary);

      const { data: funcData, error } = await supabase.functions.invoke("registry-ocr-ai", {
        body: { pdfBase64, docType: "generico" },
      });
      if (error) throw error;
      if (!funcData?.success) throw new Error(funcData?.error || "Análise falhou");
      setAiResult(funcData.result);
    } catch (err: any) {
      toast.error(`Erro na análise: ${err.message}`);
      setAiPanelOpen(false);
    } finally {
      setAnalyzingDocId(null);
    }
  };

  const filtered = docs?.filter((d) => filterType === "todos" || d.document_type === filterType) ?? [];

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      {/* Upload form */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2"><Upload className="h-4 w-4" /> Enviar Documento</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Input placeholder="Título do documento" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(documentTypeLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Observações (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div
          className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) setSelectedFile(file);
          }}
        >
          <Upload className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
          <p className="text-sm text-muted-foreground">
            {selectedFile ? selectedFile.name : "Arraste o arquivo aqui ou clique para selecionar"}
          </p>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleUpload} disabled={upload.isPending || (!selectedFile && !fileRef.current?.files?.[0])}>
            {upload.isPending ? "Enviando..." : "Enviar"}
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filtrar:</span>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {Object.entries(documentTypeLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Documents list */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum documento encontrado.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px]">{documentTypeLabels[doc.document_type] ?? doc.document_type}</Badge>
                    <Badge variant="secondary" className={`text-[10px] ${documentStatusColors[doc.status] ?? ""}`}>
                      {documentStatusLabels[doc.status] ?? doc.status}
                    </Badge>
                    {doc.version > 1 && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <History className="h-3 w-3" /> v{doc.version}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                  onClick={() => handleAnalyzeWithAI(doc)}
                  disabled={analyzingDocId === doc.id}>
                  {analyzingDocId === doc.id
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <ScanSearch className="h-3 w-3" />}
                  ✨ IA
                </Button>
                <Select
                  value={doc.status}
                  onValueChange={(s) => updateStatus.mutate({ id: doc.id, status: s, contractId })}
                >
                  <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(documentStatusLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Visualizar" onClick={async () => {
                  const { data } = await supabase.storage.from("contract-documents").createSignedUrl(doc.file_path, 300);
                  if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                }}>
                  <FileText className="h-3.5 w-3.5 text-primary" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(doc.file_path, doc.title)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deletDoc.mutate({ id: doc.id, filePath: doc.file_path, contractId })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Analysis Side Panel */}
      <Sheet open={aiPanelOpen} onOpenChange={setAiPanelOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-sm">
              <ScanSearch className="h-4 w-4" /> Análise IA — {aiDocTitle}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {analyzingDocId !== null && !aiResult && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Analisando documento com Gemini 2.5 Pro...</p>
              </div>
            )}
            {aiResult && (
              <>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground mb-1">Tipo detectado</p>
                    <p className="text-sm font-medium">{aiResult.tipo_documento_detectado}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground mb-2">Resumo Executivo</p>
                    <p className="text-sm">{aiResult.resumo_executivo}</p>
                  </CardContent>
                </Card>
                {aiResult.pontos_atencao?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium">Pontos de Atenção</p>
                    {aiResult.pontos_atencao.map((p: string, i: number) => (
                      <div key={i} className="flex gap-2 text-xs bg-yellow-500/10 text-yellow-700 rounded px-2 py-1.5">
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>
                )}
                {aiResult.campos_extraidos?.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium">Campos Extraídos ({aiResult.campos_extraidos.length})</p>
                    {aiResult.campos_extraidos.map((c: any, i: number) => (
                      <div key={i} className="flex items-start justify-between gap-2 rounded border px-3 py-2 bg-card">
                        <div>
                          <p className="text-xs text-muted-foreground">{c.campo} — p. {c.pagina}</p>
                          <p className="text-sm font-medium">{c.valor}</p>
                        </div>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${c.confianca === "alta" ? "text-green-600" : c.confianca === "media" ? "text-yellow-600" : "text-destructive"}`}>
                          {c.confianca}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
                {aiResult.dados_partes?.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium">Partes Envolvidas</p>
                    {aiResult.dados_partes.map((p: any, i: number) => (
                      <div key={i} className="rounded border px-3 py-2 bg-card text-sm">
                        <p className="font-medium">{p.nome}</p>
                        <p className="text-xs text-muted-foreground">{p.papel} • {p.documento}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
