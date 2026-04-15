/**
 * VersionComparisonDialog — Comparação visual entre duas versões de contrato
 *
 * Suporta dois modos (toggle):
 * 1. Side-by-side: versão antiga à esquerda, nova à direita
 * 2. Inline (unificado): diff inline com palavras marcadas
 *
 * Épico: Contract Versioning com Diff Visual
 */

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Columns2, AlignJustify, Plus, Minus, Equal } from "lucide-react";
import {
  stripHtml,
  computeWordDiff,
  computeSideBySide,
  computeDiffStats,
  type DiffSegment,
  type SideBySideLine,
} from "@/lib/diffUtils";
import type { ContractVersion } from "@/hooks/useContractVersions";
import { CHANGE_TYPE_LABELS } from "@/hooks/useContractVersions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oldVersion: ContractVersion;
  newVersion: ContractVersion;
}

type ViewMode = "side-by-side" | "inline";

export function VersionComparisonDialog({ open, onOpenChange, oldVersion, newVersion }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("side-by-side");

  const oldText = useMemo(() => stripHtml(oldVersion.content_html || ""), [oldVersion.content_html]);
  const newText = useMemo(() => stripHtml(newVersion.content_html || ""), [newVersion.content_html]);

  const wordDiff = useMemo(() => computeWordDiff(oldText, newText), [oldText, newText]);
  const sideBySide = useMemo(() => computeSideBySide(oldText, newText), [oldText, newText]);
  const stats = useMemo(() => computeDiffStats(oldText, newText), [oldText, newText]);

  const hasChanges = stats.added > 0 || stats.removed > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            Comparar Versões
            <Badge variant="outline" className="text-xs font-normal">
              v{oldVersion.version_number} → v{newVersion.version_number}
            </Badge>
          </DialogTitle>
          <DialogDescription className="flex items-center gap-4 text-xs">
            <span>
              <strong>v{oldVersion.version_number}</strong>{" "}
              ({CHANGE_TYPE_LABELS[oldVersion.change_type]},{" "}
              {format(new Date(oldVersion.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })})
            </span>
            <span>→</span>
            <span>
              <strong>v{newVersion.version_number}</strong>{" "}
              ({CHANGE_TYPE_LABELS[newVersion.change_type]},{" "}
              {format(new Date(newVersion.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })})
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Stats + Mode toggle */}
        <div className="flex items-center justify-between shrink-0 pb-2 border-b">
          <div className="flex items-center gap-3 text-xs">
            {stats.added > 0 && (
              <span className="flex items-center gap-1 text-green-600">
                <Plus className="h-3 w-3" /> {stats.added} adicionadas
              </span>
            )}
            {stats.removed > 0 && (
              <span className="flex items-center gap-1 text-red-600">
                <Minus className="h-3 w-3" /> {stats.removed} removidas
              </span>
            )}
            {!hasChanges && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Equal className="h-3 w-3" /> Sem diferenças textuais
              </span>
            )}
          </div>

          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="h-8">
              <TabsTrigger value="side-by-side" className="text-xs h-6 px-2 gap-1">
                <Columns2 className="h-3 w-3" /> Lado a lado
              </TabsTrigger>
              <TabsTrigger value="inline" className="text-xs h-6 px-2 gap-1">
                <AlignJustify className="h-3 w-3" /> Unificado
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Diff content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {!hasChanges ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              O conteúdo textual das duas versões é idêntico.
            </div>
          ) : viewMode === "side-by-side" ? (
            <SideBySideView lines={sideBySide} />
          ) : (
            <InlineView segments={wordDiff} />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Side-by-side view ─── */
function SideBySideView({ lines }: { lines: SideBySideLine[] }) {
  return (
    <div className="font-mono text-xs">
      {/* Header */}
      <div className="grid grid-cols-2 gap-px bg-muted sticky top-0 z-10">
        <div className="bg-red-50 dark:bg-red-950/30 px-2 py-1 text-red-700 dark:text-red-400 font-semibold">
          Versão anterior
        </div>
        <div className="bg-green-50 dark:bg-green-950/30 px-2 py-1 text-green-700 dark:text-green-400 font-semibold">
          Versão nova
        </div>
      </div>

      {lines.map((line, i) => (
        <div key={i} className="grid grid-cols-2 gap-px">
          <div
            className={`px-2 py-0.5 flex gap-2 ${
              line.left.type === "removed"
                ? "bg-red-50 dark:bg-red-950/20"
                : line.left.type === "empty"
                  ? "bg-muted/30"
                  : ""
            }`}
          >
            <span className="text-muted-foreground w-6 text-right select-none shrink-0">
              {line.lineNumLeft ?? ""}
            </span>
            <span className={line.left.type === "removed" ? "text-red-700 dark:text-red-400" : ""}>
              {line.left.text || "\u00A0"}
            </span>
          </div>
          <div
            className={`px-2 py-0.5 flex gap-2 ${
              line.right.type === "added"
                ? "bg-green-50 dark:bg-green-950/20"
                : line.right.type === "empty"
                  ? "bg-muted/30"
                  : ""
            }`}
          >
            <span className="text-muted-foreground w-6 text-right select-none shrink-0">
              {line.lineNumRight ?? ""}
            </span>
            <span className={line.right.type === "added" ? "text-green-700 dark:text-green-400" : ""}>
              {line.right.text || "\u00A0"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Inline (unified) view ─── */
function InlineView({ segments }: { segments: DiffSegment[] }) {
  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap p-3">
      {segments.map((seg, i) => {
        if (seg.added) {
          return (
            <span
              key={i}
              className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 rounded px-0.5"
            >
              {seg.value}
            </span>
          );
        }
        if (seg.removed) {
          return (
            <span
              key={i}
              className="bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 line-through rounded px-0.5"
            >
              {seg.value}
            </span>
          );
        }
        return <span key={i}>{seg.value}</span>;
      })}
    </div>
  );
}
