/**
 * ParcelamentoLixeira.tsx — Lixeira do módulo de Parcelamento de Solo
 * Sessão 147 (Bloco L — US-16/17): lista projetos deletados + botão restaurar.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Trash2,
  RotateCcw,
  Mountain,
  MapPin,
  Clock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useTrashedParcelamentoProjects, useRestoreProject } from "@/hooks/useParcelamentoProjects";
import type { ParcelamentoDevelopment } from "@/lib/parcelamento/types";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `${diffDays} dias atrás`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatArea(area_m2: number | null | undefined): string {
  if (!area_m2) return "—";
  return `${area_m2.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} m²`;
}

const TIPO_LABELS: Record<string, string> = {
  loteamento: "Loteamento",
  condominio: "Cond. Horizontal",
};

// ---------------------------------------------------------------------------
// TrashCard
// ---------------------------------------------------------------------------

function TrashCard({
  project,
  onRestore,
}: {
  project: ParcelamentoDevelopment;
  onRestore: (project: ParcelamentoDevelopment) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4 hover:border-gray-300 transition-colors">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Ícone */}
        <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
          <Mountain className="h-5 w-5 text-gray-400" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-700 truncate">{project.name}</p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <MapPin className="h-3 w-3" />
              {project.city ? `${project.city}, ` : ""}{project.state ?? "—"}
            </span>
            {project.tipo && (
              <Badge variant="outline" className="text-xs py-0 border-gray-200 text-gray-500">
                {TIPO_LABELS[project.tipo] ?? project.tipo}
              </Badge>
            )}
            <span className="text-xs text-gray-400">{formatArea(project.area_m2)}</span>
          </div>
        </div>
      </div>

      {/* Data de deleção + ação */}
      <div className="flex items-center gap-4 flex-shrink-0 ml-4">
        <div className="text-right hidden sm:block">
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Excluído {project.deleted_at ? formatRelativeDate(project.deleted_at) : "—"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRestore(project)}
          className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restaurar
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ParcelamentoLixeira() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: trashed = [], isLoading, error, refetch } = useTrashedParcelamentoProjects();
  const restoreProject = useRestoreProject();

  const [restoreTarget, setRestoreTarget] = useState<ParcelamentoDevelopment | null>(null);

  const handleConfirmRestore = async () => {
    if (!restoreTarget) return;
    try {
      await restoreProject.mutateAsync(restoreTarget.id);
      toast({ title: `"${restoreTarget.name}" restaurado com sucesso.` });
    } catch {
      toast({ title: "Erro ao restaurar projeto", variant: "destructive" });
    } finally {
      setRestoreTarget(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-gray-500" />
            Lixeira — Parcelamento de Solo
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Projetos excluídos. Restaure qualquer projeto abaixo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/parcelamento")}
            className="gap-1.5"
          >
            <Mountain className="h-3.5 w-3.5" />
            Ver todos os projetos
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
            <AlertTriangle className="h-8 w-8 text-red-400" />
            <p className="text-sm">Erro ao carregar lixeira.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : trashed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <Trash2 className="h-8 w-8 text-gray-300" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Lixeira vazia</h3>
            <p className="text-sm text-gray-500 text-center max-w-xs">
              Nenhum projeto foi excluído. Projetos movidos para a lixeira aparecem aqui e podem ser restaurados a qualquer momento.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 mb-4">
              {trashed.length} projeto{trashed.length !== 1 ? "s" : ""} na lixeira
            </p>
            {trashed.map((project) => (
              <TrashCard
                key={project.id}
                project={project}
                onRestore={setRestoreTarget}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirm restore dialog */}
      <AlertDialog
        open={!!restoreTarget}
        onOpenChange={(o) => { if (!o) setRestoreTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              O projeto <strong>"{restoreTarget?.name}"</strong> será restaurado e voltará
              a aparecer no dashboard de Parcelamento de Solo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRestore}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restaurar projeto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
