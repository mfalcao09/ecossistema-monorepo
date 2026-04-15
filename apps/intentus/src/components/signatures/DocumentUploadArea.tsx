import { useCallback, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPTED = ".pdf,.docx,.doc,.png,.jpg,.jpeg,.txt";
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

interface Props {
  onFilesSelected: (files: File[]) => void;
  compact?: boolean;
  files?: FileWithHash[];
  onRemoveFile?: (index: number) => void;
}

export interface FileWithHash {
  file: File;
  hash?: string;
  progress?: number;
}

async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export { computeSha256 };

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function DocumentUploadArea({ onFilesSelected, compact, files, onRemoveFile }: Props) {
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      const valid = Array.from(fileList).filter((f) => f.size <= MAX_SIZE);
      if (valid.length > 0) onFilesSelected(valid);
    },
    [onFilesSelected]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "border-2 border-dashed rounded-lg transition-colors cursor-pointer text-center",
          compact ? "p-4" : "p-8",
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
        )}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.multiple = true;
          input.accept = ACCEPTED;
          input.onchange = () => handleFiles(input.files);
          input.click();
        }}
      >
        <Upload className={cn("mx-auto text-muted-foreground", compact ? "h-5 w-5 mb-1" : "h-8 w-8 mb-2")} />
        <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
          {compact
            ? "Arraste um documento aqui para criar um envelope rápido"
            : "Arraste documentos aqui ou clique para selecionar"}
        </p>
        <p className="text-[11px] text-muted-foreground/60 mt-1">
          PDF, DOCX, PNG, JPG — máx. 20MB
        </p>
      </div>

      {files && files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 border rounded-md px-3 py-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{f.file.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatSize(f.file.size)}
                  {f.hash && <span className="ml-2 font-mono">SHA-256: {f.hash.slice(0, 12)}…</span>}
                </p>
              </div>
              {onRemoveFile && (
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onRemoveFile(i)}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
