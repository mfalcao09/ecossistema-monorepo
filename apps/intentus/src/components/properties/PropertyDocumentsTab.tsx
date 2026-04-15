import { useState, useRef } from "react";
import { usePropertyDocuments, useUploadPropertyDocument, useUpdatePropertyDocumentStatus, useDeletePropertyDocument, usePropertyDocumentToken, useCreatePropertyDocumentToken } from "@/hooks/usePropertyDocuments";
import { propertyDocTypeLabels, propertyDocStatusLabels, propertyDocStatusColors, propertyDocCategoryLabels } from "@/lib/propertyDocSchema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, Download, Trash2, FileText, QrCode, AlertTriangle, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PropertyQRCodeDialog } from "./PropertyQRCodeDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarIcon } from "lucide-react";

interface Props {
  propertyId: string;
}

export function PropertyDocumentsTab({ propertyId }: Props) {
  const { data: docs, isLoading } = usePropertyDocuments(propertyId);
  const upload = useUploadPropertyDocument();
  const updateStatus = useUpdatePropertyDocumentStatus();
  const deleteDoc = useDeletePropertyDocument();
  const { data: token } = usePropertyDocumentToken(propertyId);
  const createToken = useCreatePropertyDocumentToken();

  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("outro");
  const [docCategory, setDocCategory] = useState("geral");
  const [notes, setNotes] = useState("");
  const [expiresAt, setExpiresAt] = useState<Date | undefined>();
  const [reminderDays, setReminderDays] = useState("30");
  const [filterType, setFilterType] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [qrOpen, setQrOpen] = useState(false);

  const handleUpload = async () => {
    const file = selectedFile || fileRef.current?.files?.[0];
    if (!file || !title.trim()) {
      toast.error("Preencha o título e selecione um arquivo");
      return;
    }
    await upload.mutateAsync({
      propertyId,
      file,
      title: title.trim(),
      documentType: docType,
      documentCategory: docCategory,
      notes,
      expiresAt: expiresAt?.toISOString(),
      reminderDays: parseInt(reminderDays),
    });
    setTitle(""); setNotes(""); setDocType("outro"); setDocCategory("geral");
    setSelectedFile(null); setExpiresAt(undefined);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    const { data } = await supabase.storage.from("property-docs").createSignedUrl(filePath, 300);
    if (data?.signedUrl) {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = fileName;
      a.click();
    }
  };

  const filtered = docs?.filter((d) => {
    const typeOk = filterType === "todos" || d.document_type === filterType;
    const statusOk = filterStatus === "todos" || d.status === filterStatus;
    return typeOk && statusOk;
  }) ?? [];

  const getExpiryBadge = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const days = differenceInDays(new Date(expiresAt), new Date());
    if (days < 0) return <Badge variant="destructive" className="text-[10px]">Vencido</Badge>;
    if (days <= 7) return <Badge className="text-[10px] bg-destructive/20 text-destructive">Vence em {days}d</Badge>;
    if (days <= 30) return <Badge className="text-[10px] bg-yellow-500/20 text-yellow-700">Vence em {days}d</Badge>;
    return <Badge variant="outline" className="text-[10px] text-green-600">{format(new Date(expiresAt), "dd/MM/yyyy")}</Badge>;
  };

  const vencidos = docs?.filter(d => d.expires_at && differenceInDays(new Date(d.expires_at), new Date()) < 0).length ?? 0;
  const aVencer = docs?.filter(d => d.expires_at && differenceInDays(new Date(d.expires_at), new Date()) >= 0 && differenceInDays(new Date(d.expires_at), new Date()) <= 30).length ?? 0;

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      {docs && docs.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          <Card><CardContent className="pt-3 pb-2"><div className="text-lg font-bold">{docs.length}</div><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
          <Card><CardContent className="pt-3 pb-2"><div className="text-lg font-bold text-destructive">{vencidos}</div><p className="text-xs text-muted-foreground">Vencidos</p></CardContent></Card>
          <Card><CardContent className="pt-3 pb-2"><div className="text-lg font-bold text-yellow-600">{aVencer}</div><p className="text-xs text-muted-foreground">A Vencer (30d)</p></CardContent></Card>
          <Card><CardContent className="pt-3 pb-2"><div className="text-lg font-bold text-green-600">{docs.filter(d => d.status === "regular").length}</div><p className="text-xs text-muted-foreground">Regulares</p></CardContent></Card>
        </div>
      )}

      {/* Upload form */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2"><Upload className="h-4 w-4" /> Enviar Documento</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <Input placeholder="Título do documento" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(propertyDocTypeLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={docCategory} onValueChange={setDocCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(propertyDocCategoryLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Observações (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="justify-start h-9">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {expiresAt ? format(expiresAt, "dd/MM/yyyy") : "Data de vencimento (opcional)"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent mode="single" selected={expiresAt} onSelect={setExpiresAt} locale={ptBR} />
            </PopoverContent>
          </Popover>
          <Select value={reminderDays} onValueChange={setReminderDays}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Lembrar 7 dias antes</SelectItem>
              <SelectItem value="15">Lembrar 15 dias antes</SelectItem>
              <SelectItem value="30">Lembrar 30 dias antes</SelectItem>
              <SelectItem value="60">Lembrar 60 dias antes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div
          className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) setSelectedFile(f); }}
        >
          <Upload className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
          <p className="text-sm text-muted-foreground">{selectedFile ? selectedFile.name : "Arraste o arquivo ou clique"}</p>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleUpload} disabled={upload.isPending || (!selectedFile && !fileRef.current?.files?.[0])}>
            {upload.isPending ? "Enviando..." : "Enviar"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            if (token) { setQrOpen(true); } else { createToken.mutate({ propertyId }, { onSuccess: () => setQrOpen(true) }); }
          }} disabled={createToken.isPending}>
            <QrCode className="h-4 w-4 mr-1" />
            {token ? "Ver QR Code" : "Gerar QR Code"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Filtrar:</span>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {Object.entries(propertyDocTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(propertyDocStatusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Documents list */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum documento encontrado.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc: any) => (
            <div key={doc.id} className="flex items-center justify-between rounded-lg border bg-card p-3 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{propertyDocTypeLabels[doc.document_type] ?? doc.document_type}</Badge>
                    <Badge variant="secondary" className={`text-[10px] ${propertyDocStatusColors[doc.status] ?? ""}`}>
                      {propertyDocStatusLabels[doc.status] ?? doc.status}
                    </Badge>
                    {doc.version > 1 && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <History className="h-3 w-3" /> v{doc.version}
                      </span>
                    )}
                    {getExpiryBadge(doc.expires_at)}
                    {doc.expires_at && differenceInDays(new Date(doc.expires_at), new Date()) < 0 && (
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Select value={doc.status} onValueChange={(s) => updateStatus.mutate({ id: doc.id, status: s, propertyId })}>
                  <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(propertyDocStatusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Visualizar" onClick={async () => {
                  const { data } = await supabase.storage.from("property-docs").createSignedUrl(doc.file_path, 300);
                  if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                }}>
                  <FileText className="h-3.5 w-3.5 text-primary" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(doc.file_path, doc.title)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteDoc.mutate({ id: doc.id, filePath: doc.file_path, propertyId })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PropertyQRCodeDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        propertyId={propertyId}
        token={token}
      />
    </div>
  );
}
