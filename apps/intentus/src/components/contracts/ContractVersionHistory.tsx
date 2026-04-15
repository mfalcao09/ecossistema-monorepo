/**
 * ContractVersionHistory — Timeline de versões do contrato
 *
 * Exibe o histórico completo de versões com tipo de mudança,
 * resumo, campos alterados e quem fez a alteração.
 *
 * Épico 3 — CLM Fase 2
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  History,
  FileText,
  ExternalLink,
  FilePlus,
  FileEdit,
  CheckCircle,
  PenTool,
  RefreshCw,
  FilePlus2,
  GitCompareArrows,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useContractVersions,
  CHANGE_TYPE_LABELS,
  CHANGE_TYPE_COLORS,
  type VersionChangeType,
  type ContractVersion,
} from "@/hooks/useContractVersions";
import { VersionComparisonDialog } from "./VersionComparisonDialog";

// ── Props ──────────────────────────────────────────────────────────────
interface ContractVersionHistoryProps {
  contractId: string;
}

// ── Icons por tipo de mudança ──────────────────────────────────────────
const CHANGE_TYPE_ICONS: Record<VersionChangeType, React.ReactNode> = {
  create: <FilePlus className="h-4 w-4" />,
  edit: <FileEdit className="h-4 w-4" />,
  approval: <CheckCircle className="h-4 w-4" />,
  signing: <PenTool className="h-4 w-4" />,
  renewal: <RefreshCw className="h-4 w-4" />,
  addendum: <FilePlus2 className="h-4 w-4" />,
};

// ── Componente principal ───────────────────────────────────────────────
export default function ContractVersionHistory({
  contractId,
}: ContractVersionHistoryProps) {
  const { data: versions, isLoading } = useContractVersions(contractId);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareOld, setCompareOld] = useState<ContractVersion | null>(null);
  const [compareNew, setCompareNew] = useState<ContractVersion | null>(null);

  const handleCompare = (version: ContractVersion, index: number) => {
    if (!versions || index >= versions.length - 1) return;
    // versions are sorted newest first, so index+1 is the previous version
    setCompareOld(versions[index + 1]);
    setCompareNew(version);
    setCompareOpen(true);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Histórico de Versões
          {versions && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {versions.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : !versions || versions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Nenhuma versão registrada</p>
            <p className="text-xs mt-1">
              As versões são criadas automaticamente a cada alteração no contrato.
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

            <div className="space-y-4">
              {versions.map((version, index) => (
                <div key={version.id} className="relative flex gap-3 pl-1">
                  {/* Timeline dot */}
                  <div
                    className={`
                      relative z-10 flex items-center justify-center
                      h-8 w-8 rounded-full border-2 bg-background flex-shrink-0
                      ${index === 0 ? "border-primary" : "border-muted-foreground/30"}
                    `}
                  >
                    <span
                      className={
                        index === 0
                          ? "text-primary"
                          : "text-muted-foreground/60"
                      }
                    >
                      {CHANGE_TYPE_ICONS[version.change_type]}
                    </span>
                  </div>

                  {/* Content */}
                  <div
                    className={`
                      flex-1 p-3 rounded-lg border transition-colors
                      ${index === 0 ? "bg-accent/50 border-primary/20" : "bg-card"}
                    `}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">
                          v{version.version_number}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${
                            CHANGE_TYPE_COLORS[version.change_type]
                          }`}
                        >
                          {CHANGE_TYPE_LABELS[version.change_type]}
                        </Badge>
                        {index === 0 && (
                          <Badge className="text-[10px] px-1.5 py-0">
                            Atual
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {format(
                          new Date(version.created_at),
                          "dd MMM yyyy 'às' HH:mm",
                          { locale: ptBR }
                        )}
                      </span>
                    </div>

                    {/* Summary */}
                    {version.change_summary && (
                      <p className="text-sm text-muted-foreground mt-1.5">
                        {version.change_summary}
                      </p>
                    )}

                    {/* Changed fields */}
                    {version.changed_fields &&
                      version.changed_fields.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span className="text-[11px] text-muted-foreground">
                            Campos:
                          </span>
                          {version.changed_fields.map((field) => (
                            <Badge
                              key={field}
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0"
                            >
                              {field}
                            </Badge>
                          ))}
                        </div>
                      )}

                    {/* Footer: author + PDF link */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t">
                      <span className="text-[11px] text-muted-foreground">
                        por{" "}
                        <span className="font-medium text-foreground">
                          {version.creator?.name || "Sistema"}
                        </span>
                      </span>

                      <div className="flex items-center gap-2">
                        {/* Compare button — only if there's a previous version and both have content */}
                        {versions && index < versions.length - 1 && (version.content_html || versions[index + 1]?.content_html) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[11px] gap-1"
                            title="Comparar com versão anterior"
                            onClick={() => handleCompare(version, index)}
                          >
                            <GitCompareArrows className="h-3 w-3" />
                            Comparar
                          </Button>
                        )}
                        {version.content_html && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[11px] gap-1"
                            title="Visualizar conteúdo HTML"
                          >
                            <FileText className="h-3 w-3" />
                            HTML
                          </Button>
                        )}
                        {version.content_pdf_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[11px] gap-1"
                            asChild
                          >
                            <a
                              href={version.content_pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3 w-3" />
                              PDF
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Version comparison dialog */}
      {compareOld && compareNew && (
        <VersionComparisonDialog
          open={compareOpen}
          onOpenChange={setCompareOpen}
          oldVersion={compareOld}
          newVersion={compareNew}
        />
      )}
    </Card>
  );
}
