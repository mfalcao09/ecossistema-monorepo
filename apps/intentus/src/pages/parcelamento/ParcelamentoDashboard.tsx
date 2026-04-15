/**
 * ParcelamentoDashboard.tsx — Painel principal do módulo de Parcelamento de Solo
 * Sessão 147 (Bloco L): filtros avançados (cidade, VGV, score) + menu de transição
 * de status + botão enviar para lixeira nos cards.
 */
import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Mountain,
  Plus,
  Search,
  MapPin,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCcw,
  FileEdit,
  Hourglass,
  MoreVertical,
  Trash2,
  CheckCheck,
  XCircle,
  Eye,
  SlidersHorizontal,
  GitMerge,
} from "lucide-react";
import { useParcelamentoProjects, useTrashProject, useUpdateProjectStatus, ALLOWED_STATUS_TRANSITIONS } from "@/hooks/useParcelamentoProjects";
import type { ParcelamentoDevelopment, AnalysisStatus } from "@/lib/parcelamento/types";
import NovoProjetoDialog from "@/components/parcelamento/NovoProjetoDialog";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatHa(area_m2: number | null | undefined): string {
  if (!area_m2) return "—";
  return `${area_m2.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} m²`;
}

function formatCurrency(value: number | null | undefined): string {
  if (!value) return "—";
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })} M`;
  }
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function getStatusConfig(status: AnalysisStatus | null) {
  const map: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    rascunho:        { label: "Rascunho",          color: "bg-amber-100 text-amber-700",    icon: FileEdit    },
    em_analise:      { label: "Em Análise",         color: "bg-purple-100 text-purple-700",  icon: Hourglass   },
    concluido:       { label: "Análise Concluída",  color: "bg-green-100 text-green-700",    icon: CheckCircle2 },
    em_processamento:{ label: "Processando",        color: "bg-blue-100 text-blue-700",      icon: Loader2     },
    pendente:        { label: "Pendente",           color: "bg-gray-100 text-gray-600",      icon: Clock       },
    erro:            { label: "Erro",               color: "bg-red-100 text-red-700",        icon: AlertTriangle },
    viavel:          { label: "Viável",             color: "bg-emerald-100 text-emerald-700",icon: CheckCheck  },
    rejeitado:       { label: "Rejeitado",          color: "bg-rose-100 text-rose-700",      icon: XCircle     },
    monitorando:     { label: "Monitorando",        color: "bg-sky-100 text-sky-700",        icon: Eye         },
  };
  return map[status ?? "pendente"] ?? map.pendente;
}

const STATUS_LABELS: Record<AnalysisStatus, string> = {
  rascunho: "Rascunho",
  em_analise: "Em Análise",
  concluido: "Análise Concluída",
  em_processamento: "Processando",
  pendente: "Pendente",
  erro: "Erro",
  viavel: "Viável",
  rejeitado: "Rejeitado",
  monitorando: "Monitorando",
};

function getScoreColor(score: number | null | undefined): string {
  if (!score) return "text-gray-400";
  if (score >= 70) return "text-green-600";
  if (score >= 45) return "text-amber-600";
  return "text-red-600";
}

const TIPO_LABELS: Record<string, string> = {
  loteamento: "Loteamento Aberto",
  condominio: "Cond. Horizontal",
};

// Faixas de VGV para filtro
type VgvFaixa = "todos" | "ate5m" | "5m_20m" | "20m_50m" | "acima50m";
const VGV_FAIXAS: { value: VgvFaixa; label: string; min: number; max: number }[] = [
  { value: "ate5m",    label: "Até R$ 5M",          min: 0,          max: 5_000_000   },
  { value: "5m_20m",  label: "R$ 5M – R$ 20M",     min: 5_000_000,  max: 20_000_000  },
  { value: "20m_50m", label: "R$ 20M – R$ 50M",    min: 20_000_000, max: 50_000_000  },
  { value: "acima50m",label: "Acima de R$ 50M",     min: 50_000_000, max: Infinity    },
];

// Faixas de score para filtro
type ScoreFaixa = "todos" | "alto" | "medio" | "baixo";

// ---------------------------------------------------------------------------
// StatsCard
// ---------------------------------------------------------------------------

function StatsCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <div className={`h-8 w-8 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProjectCard
// ---------------------------------------------------------------------------

function ProjectCard({
  project, onResumeDraft, onTrash,
}: {
  project: ParcelamentoDevelopment;
  onResumeDraft: (id: string) => void;
  onTrash: (project: ParcelamentoDevelopment) => void;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const statusCfg = getStatusConfig(project.analysis_status);
  const StatusIcon = statusCfg.icon;
  const score = project.analysis_results?.viabilidade_score;
  const isRascunho = project.analysis_status === "rascunho";

  const updateStatus = useUpdateProjectStatus();

  const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[project.analysis_status ?? "pendente"] ?? [];

  const handleClick = (e: React.MouseEvent) => {
    // Se o clique vem do DropdownMenu, não navegar
    if ((e.target as HTMLElement).closest("[data-no-navigate]")) return;
    if (isRascunho) {
      onResumeDraft(project.id);
    } else {
      navigate(`/parcelamento/${project.id}`);
    }
  };

  const handleStatusChange = async (newStatus: AnalysisStatus) => {
    try {
      await updateStatus.mutateAsync({
        projectId: project.id,
        currentStatus: project.analysis_status!,
        newStatus,
      });
      toast({ title: `Status alterado para "${STATUS_LABELS[newStatus]}"` });
    } catch {
      toast({ title: "Erro ao alterar status", variant: "destructive" });
    }
  };

  return (
    <div
      onClick={handleClick}
      className="group relative rounded-xl border border-gray-200 bg-white p-5 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
    >
      {/* Menu de ações (⋮) */}
      <div
        data-no-navigate
        className="absolute top-3 right-3 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="h-4 w-4 text-gray-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {/* Transições de status disponíveis */}
            {allowedTransitions.length > 0 && (
              <>
                <p className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Mover para
                </p>
                {allowedTransitions.map((s) => {
                  const cfg = getStatusConfig(s);
                  const SIcon = cfg.icon;
                  return (
                    <DropdownMenuItem
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      disabled={updateStatus.isPending}
                    >
                      <SIcon className="h-4 w-4 mr-2" />
                      {STATUS_LABELS[s]}
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              onClick={() => onTrash(project)}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Mover para lixeira
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-3 pr-6">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-700 transition-colors">
            {project.name}
          </h3>
          <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">
              {project.city ? `${project.city} — ` : ""}
              {project.state ?? "UF não informada"}
            </span>
          </div>
        </div>

        {score !== undefined ? (
          <div className="ml-3 text-center flex-shrink-0">
            <p className={`text-2xl font-black ${getScoreColor(score)}`}>{score}</p>
            <p className="text-xs text-gray-400">score</p>
          </div>
        ) : (
          <div className="ml-3 flex-shrink-0">
            <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-gray-300" />
            </div>
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 my-3">
        <div className="text-center">
          <p className="text-sm font-bold text-gray-900">{formatHa(project.area_m2)}</p>
          <p className="text-xs text-gray-400">Área total</p>
        </div>
        <div className="text-center border-x border-gray-100">
          <p className="text-sm font-bold text-gray-900">
            {project.total_units ? project.total_units.toLocaleString("pt-BR") : "—"}
          </p>
          <p className="text-xs text-gray-400">Lotes est.</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-gray-900">
            {formatCurrency(project.vgv_estimado)}
          </p>
          <p className="text-xs text-gray-400">VGV est.</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <Badge className={`text-xs font-medium gap-1 ${statusCfg.color} border-0`}>
          <StatusIcon
            className={`h-3 w-3 ${
              project.analysis_status === "em_processamento" ? "animate-spin" : ""
            }`}
          />
          {statusCfg.label}
        </Badge>

        {project.tipo && (
          <span className="text-xs text-gray-400">
            {TIPO_LABELS[project.tipo] ?? project.tipo}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({ hasFilters, onCreate }: { hasFilters: boolean; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <Mountain className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {hasFilters ? "Nenhum projeto encontrado" : "Nenhum projeto criado ainda"}
      </h3>
      <p className="text-sm text-gray-500 text-center max-w-xs mb-6">
        {hasFilters
          ? "Tente ajustar os filtros para encontrar o projeto desejado."
          : "Crie o primeiro projeto de parcelamento de solo para começar a análise de viabilidade."}
      </p>
      {!hasFilters && (
        <Button onClick={onCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Criar Primeiro Projeto
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

type StatusFilter =
  | "todos" | "rascunho" | "em_analise" | "concluido"
  | "em_processamento" | "pendente" | "erro"
  | "viavel" | "rejeitado" | "monitorando";

export default function ParcelamentoDashboard() {
  const { data: projects = [], isLoading, error, refetch, isFetching } = useParcelamentoProjects();
  const trashProject = useTrashProject();
  const { toast } = useToast();

  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [ufFilter, setUfFilter]         = useState<string>("todos");
  const [cidadeFilter, setCidadeFilter] = useState<string>("todos");
  const [vgvFilter, setVgvFilter]       = useState<VgvFaixa>("todos");
  const [scoreFilter, setScoreFilter]   = useState<ScoreFaixa>("todos");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dialogOpen, setDialogOpen]     = useState(false);
  const [resumeProjectId, setResumeProjectId] = useState<string | null>(null);
  const [trashTarget, setTrashTarget]   = useState<ParcelamentoDevelopment | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      setResumeProjectId(null);
      setDialogOpen(true);
    }
  }, [searchParams]);

  const handleResumeDraft = (id: string) => {
    setResumeProjectId(id);
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setResumeProjectId(null);
      if (searchParams.get("novo") === "1") {
        const next = new URLSearchParams(searchParams);
        next.delete("novo");
        setSearchParams(next, { replace: true });
      }
    }
  };

  const handleConfirmTrash = async () => {
    if (!trashTarget) return;
    try {
      await trashProject.mutateAsync(trashTarget.id);
      toast({ title: `"${trashTarget.name}" movido para a lixeira.` });
    } catch {
      toast({ title: "Erro ao mover para lixeira", variant: "destructive" });
    } finally {
      setTrashTarget(null);
    }
  };

  // Listas únicas para filtros
  const ufs = useMemo(() => {
    const set = new Set(projects.map((p) => p.state).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [projects]);

  const cidades = useMemo(() => {
    const set = new Set(
      projects
        .filter((p) => ufFilter === "todos" || p.state === ufFilter)
        .map((p) => p.city)
        .filter(Boolean) as string[]
    );
    return Array.from(set).sort();
  }, [projects, ufFilter]);

  // Reset cidade quando UF muda
  useEffect(() => {
    setCidadeFilter("todos");
  }, [ufFilter]);

  // Filtered projects
  const filtered = useMemo(() => {
    return projects.filter((p) => {
      // Busca por nome ou cidade
      if (
        search &&
        !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.city?.toLowerCase().includes(search.toLowerCase())
      )
        return false;

      // Status
      if (statusFilter !== "todos" && p.analysis_status !== statusFilter) return false;

      // UF
      if (ufFilter !== "todos" && p.state !== ufFilter) return false;

      // Cidade
      if (cidadeFilter !== "todos" && p.city !== cidadeFilter) return false;

      // VGV faixa
      if (vgvFilter !== "todos") {
        const faixa = VGV_FAIXAS.find((f) => f.value === vgvFilter);
        if (faixa) {
          const vgv = p.vgv_estimado ?? 0;
          if (vgv < faixa.min || vgv >= faixa.max) return false;
        }
      }

      // Score faixa
      if (scoreFilter !== "todos") {
        const score = p.analysis_results?.viabilidade_score;
        if (score === undefined || score === null) return false;
        if (scoreFilter === "alto"  && score < 70)  return false;
        if (scoreFilter === "medio" && (score < 45 || score >= 70)) return false;
        if (scoreFilter === "baixo" && score >= 45) return false;
      }

      return true;
    });
  }, [projects, search, statusFilter, ufFilter, cidadeFilter, vgvFilter, scoreFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = projects.length;
    const areaTotal = projects.reduce((acc, p) => acc + (p.area_m2 ?? 0), 0);
    const vgvTotal = projects.reduce((acc, p) => acc + (p.vgv_estimado ?? 0), 0);
    const scores = projects
      .map((p) => p.analysis_results?.viabilidade_score)
      .filter((s): s is number => s !== undefined);
    const scoreMedio =
      scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null;
    return { total, areaTotal, vgvTotal, scoreMedio };
  }, [projects]);

  const hasFilters =
    search !== "" || statusFilter !== "todos" || ufFilter !== "todos" ||
    cidadeFilter !== "todos" || vgvFilter !== "todos" || scoreFilter !== "todos";

  const clearFilters = () => {
    setSearch(""); setStatusFilter("todos"); setUfFilter("todos");
    setCidadeFilter("todos"); setVgvFilter("todos"); setScoreFilter("todos");
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
        <AlertTriangle className="h-8 w-8 text-red-400" />
        <p className="text-sm">Erro ao carregar projetos.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Mountain className="h-5 w-5 text-blue-600" />
            Parcelamento de Solo
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Projetos horizontais — Loteamentos e Condomínios
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Projeto
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Stats */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl border border-gray-200 bg-gray-50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              label="Total de Projetos"
              value={stats.total}
              sub={`${projects.filter((p) => p.analysis_status === "concluido").length} com análise concluída`}
              icon={Mountain} color="bg-blue-600"
            />
            <StatsCard
              label="Área Total"
              value={`${stats.areaTotal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} m²`}
              sub="Soma de todos os terrenos"
              icon={MapPin} color="bg-green-600"
            />
            <StatsCard
              label="VGV Total Estimado"
              value={formatCurrency(stats.vgvTotal)}
              sub="Estimativa de lançamento"
              icon={TrendingUp} color="bg-indigo-600"
            />
            <StatsCard
              label="Score Médio"
              value={stats.scoreMedio !== null ? stats.scoreMedio : "—"}
              sub={
                stats.scoreMedio !== null
                  ? stats.scoreMedio >= 70 ? "Viabilidade alta"
                  : stats.scoreMedio >= 45 ? "Viabilidade média"
                  : "Revisar parâmetros"
                  : "Projetos sem análise"
              }
              icon={BarChart3}
              color={
                stats.scoreMedio === null ? "bg-gray-400"
                : stats.scoreMedio >= 70 ? "bg-green-600"
                : stats.scoreMedio >= 45 ? "bg-amber-500"
                : "bg-red-500"
              }
            />
          </div>
        )}

        {/* Filtros básicos */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome ou cidade..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="em_analise">Em Análise</SelectItem>
                <SelectItem value="em_processamento">Processando</SelectItem>
                <SelectItem value="concluido">Análise Concluída</SelectItem>
                <SelectItem value="viavel">Viável</SelectItem>
                <SelectItem value="monitorando">Monitorando</SelectItem>
                <SelectItem value="rejeitado">Rejeitado</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="erro">Com Erro</SelectItem>
              </SelectContent>
            </Select>

            {ufs.length > 0 && (
              <Select value={ufFilter} onValueChange={setUfFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os estados</SelectItem>
                  {ufs.map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced((v) => !v)}
              className={`gap-1.5 whitespace-nowrap ${showAdvanced ? "border-blue-400 text-blue-600" : ""}`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros avançados
              {(vgvFilter !== "todos" || scoreFilter !== "todos" || cidadeFilter !== "todos") && (
                <span className="ml-1 h-2 w-2 rounded-full bg-blue-500 inline-block" />
              )}
            </Button>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-gray-500 whitespace-nowrap"
              >
                Limpar filtros
              </Button>
            )}
          </div>

          {/* Filtros avançados */}
          {showAdvanced && (
            <div className="flex flex-col sm:flex-row gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
              {/* Cidade */}
              {cidades.length > 0 && (
                <Select value={cidadeFilter} onValueChange={setCidadeFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Cidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as cidades</SelectItem>
                    {cidades.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* VGV faixa */}
              <Select value={vgvFilter} onValueChange={(v) => setVgvFilter(v as VgvFaixa)}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Faixa de VGV" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Qualquer VGV</SelectItem>
                  {VGV_FAIXAS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Score faixa */}
              <Select value={scoreFilter} onValueChange={(v) => setScoreFilter(v as ScoreFaixa)}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Score de Viabilidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Qualquer score</SelectItem>
                  <SelectItem value="alto">Alto (≥ 70)</SelectItem>
                  <SelectItem value="medio">Médio (45–69)</SelectItem>
                  <SelectItem value="baixo">Baixo ({"<"} 45)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Results count */}
        {!isLoading && projects.length > 0 && (
          <p className="text-sm text-gray-500">
            {filtered.length === projects.length
              ? `${projects.length} projeto${projects.length !== 1 ? "s" : ""}`
              : `${filtered.length} de ${projects.length} projetos`}
          </p>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-52 rounded-xl border border-gray-200 bg-gray-50 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasFilters={hasFilters} onCreate={() => setDialogOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onResumeDraft={handleResumeDraft}
                onTrash={setTrashTarget}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialog novo projeto */}
      <NovoProjetoDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        resumeProjectId={resumeProjectId}
      />

      {/* Confirm trash dialog */}
      <AlertDialog open={!!trashTarget} onOpenChange={(o) => { if (!o) setTrashTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mover para a lixeira?</AlertDialogTitle>
            <AlertDialogDescription>
              O projeto <strong>"{trashTarget?.name}"</strong> será movido para a lixeira.
              Você pode restaurá-lo a qualquer momento em{" "}
              <span className="font-medium text-gray-700">Parcelamento → Lixeira</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmTrash}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Mover para lixeira
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
