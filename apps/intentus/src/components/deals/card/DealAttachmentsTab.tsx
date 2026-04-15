import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useDealAttachments,
  useUploadDealAttachment,
  useDeleteDealAttachment,
} from "@/hooks/useDealAttachments";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Paperclip,
  Upload,
  Trash2,
  Download,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  Loader2,
} from "lucide-react";

function fileIcon(type: string | null) {
  if (!type) return <File className="h-4 w-4" />;
  if (type.startsWith("image")) return <FileImage className="h-4 w-4 text-blue-500" />;
  if (type.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
  if (type.includes("sheet") || type.includes("xls") || type.includes("csv"))
    return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentUploadDialog({
  open,
  onOpenChange,
  dealId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadDealAttachment();
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      upload.mutate({ dealId, file });
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            Adicionar Anexos
          </DialogTitle>
        </DialogHeader>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp,.zip,.rar"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
        >
          <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium">Clique ou arraste arquivos aqui</p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, DOC, XLS, imagens, ZIP (máx. 20MB)
          </p>
        </div>
        {upload.isPending && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Enviando...
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DealAttachmentsSection({ dealId }: { dealId: string }) {
  const { data: attachments } = useDealAttachments(dealId);
  const deleteAttachment = useDeleteDealAttachment();

  const handleDownload = async (fileUrl: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from("deal-attachments")
      .createSignedUrl(fileUrl, 60);
    if (error || !data?.signedUrl) return;
    window.open(data.signedUrl, "_blank");
  };

  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Paperclip className="h-4 w-4" />
        Anexos
        <Badge variant="secondary" className="h-4 min-w-[16px] px-1 text-[10px]">
          {attachments.length}
        </Badge>
      </div>
      <div className="space-y-1.5">
        {attachments.map((a: any) => (
          <div
            key={a.id}
            className="flex items-center gap-2 group rounded-md border px-3 py-2 hover:bg-muted/50 transition-colors"
          >
            {fileIcon(a.file_type)}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{a.file_name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(a.file_size)}
                {a.created_at && ` · ${format(new Date(a.created_at), "dd/MM/yyyy")}`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => handleDownload(a.file_url, a.file_name)}
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => deleteAttachment.mutate({ id: a.id, fileUrl: a.file_url, dealId })}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
