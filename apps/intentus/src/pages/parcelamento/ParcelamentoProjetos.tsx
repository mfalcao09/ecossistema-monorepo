/**
 * ParcelamentoProjetos.tsx — Detalhamento de Projetos (visão tabular densa)
 *
 * Sessão 130 CONT3 Passo 5.3: página nova dedicada ao trabalho executivo
 * de refinamento dos projetos (eventual geração de PDFs, discussão técnica
 * avançada). Distinta do Dashboard (cards) — aqui é tabela densa com
 * ordenação, busca e visão de TODAS as métricas por projeto.
 *
 * Esta é a base mínima — evoluirá para incluir: bulk actions, export CSV,
 * comparador lado-a-lado, botão "Gerar PDF Executivo" por linha.
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  Search,
  FileSearch,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  FileEdit,
  Hourglass,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  FileDown,
  Mountain,
} from "lucide-react";
import { useParcelamentoProjects } from "@/hooks/useParcelamentoProjects";
import type { ParcelamentoDevelopment } from "@/lib/parcelamento/types";

// ---------------------------------------------------------------------------
// Helpers — área SEMPRE em m² (decisão UX Marcelo)
// ---------------------------------------------------------------------------

function formatArea(area_m2: number | null | undefined): string {
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
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function getStatusConfig(status: ParcelamentoDevelopment["analysis_status"]) {
  const map = {
    rascunho: { label: "Rascunho", color: "bg-amber-100 text-amber-700", icon: FileEdit },
    em_analise: { label: "Em Análise", color: "bg-purple-100 text-purple-700", icon: Hourglass },
    concluido: { label: "Concluída", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
    em_processamento: { label: "Processando", color: "bg-blue-100 text-blue-700", icon: Loader2 },
    pendente: { label: "Pendente", color: "bg-gray-100 text-gray-600", icon: Clock },
    erro: { label: "Erro", color: "bg-red-100 text-red-700", icon: AlertTriangle },
  };
  return map[status ?? "pendente"] ?? map.pendente;
}

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

// ---------------------------------------------------------------------------
// Sort state
// ---------------------------------------------------------------------------

type SortKey = "name" | "city" | "area_m2" | "total_units" | "vgv_estimado" | "score" | "status";
type SortDir = "asc" | "desc";

interface SortState {
  key: SortKey;
  dir: SortDir;
}

function SortHeader({
  label,
  sortKey,
  sort,
  setSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  setSort: (s: SortState) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={`px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <button
        onClick={() =>
          setSort({
            key: sortKey,
            dir: active && sort.dir === "asc" ? "desc" : "asc",
          })
        }
        className={`inline-flex items-center gap-1 hover:text-gray-900 transition-colors ${
          align === "right" ? "justify-end" : ""
        } ${active ? "text-gray-900" : ""}`}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

type StatusFilter =
  | "todos"
  | "rascunho"
  | "em_analise"
  | "concluido"
  | "em_processamento"
  | "pendente"
  | "erro";

export default function ParcelamentoProjetos() {
  const navigate = useNavigate();
  const { data: projects = [], isLoading, error, refetch } = useParcelamentoProjects();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [ufFilter, setUfFilter] = useState<string>("todos");
  const [sort, setSort] = useState<SortState>({ key: "name", dir: "asc" });

  // Unique UFs
  const ufs = useMemo(() => {
    const set = new Set(projects.map((p) => p.state).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [projects]);

  // Filter + sort
  const rows = useMemo(() => {
    const filtered = projects.filter((p) => {
      if (
        search &&
        !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.city?.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      if (statusFilter !== "todos" && p.analysis_status !== statusFilter) return false;
      if (ufFilter !== "todos" && p.state !== ufFilter) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      const getVal = (p: ParcelamentoDevelopment): string | number => {
        switch (sort.key) {
          case "name":
            return p.name ?? "";
          case "city":
            return `${p.state ?? ""}-${p.city ?? ""}`;
          case "area_m2":
            return p.area_m2 ?? 0;
          case "total_units":
            return p.total_units ?? 0;
          case "vgv_estimado":
            return p.vgv_estimado ?? 0;
          case "score":
            return p.analysis_results?.viabilidade_score ?? 0;
          case "status":
            return p.analysis_status ?? "";
          default:
            return 0;
        }
      };
      const va = getVal(a);
      const vb = getVal(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "pt-BR") * dir;
    });

    return sorted;
  }, [projects, search, statusFilter, ufFilter, sort]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500 py-20">
        <AlertTriangle className="h-8 w-8 text-red-400" />
        <p className="text-sm">Erro ao carregar projetos.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Mountain className="h-3.5 w-3.5" />
            <span>Parcelamento de Solo</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileSearch className="h-6 w-6 text-lime-600" />
            Detalhamento de Projetos
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Visão tabular densa para análise comparativa, refinamento executivo e geração de relatórios.
          </p>
        </div>

        <Button variant="outline" className="gap-2" disabled title="Em breve — exportar CSV">
          <FileDown className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nome ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Status</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="em_analise">Em Análise</SelectItem>
            <SelectItem value="em_processamento">Processando</SelectItem>
            <SelectItem value="concluido">Concluída</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="erro">Erro</SelectItem>
          </SelectContent>
        </Select>

        <Select value={ufFilter} onValueChange={setUfFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="UF" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as UFs</SelectItem>
            {ufs.map((uf) => (
              <SelectItem key={uf} value={uf}>
                {uf}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="text-xs text-gray-500 ml-auto">
          {rows.length} de {projects.length} projeto{projects.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Carregando projetos...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <FileSearch className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              Nenhum projeto encontrado
            </h3>
            <p className="text-sm text-gray-500 text-center max-w-xs">
              Ajuste os filtros ou crie um novo projeto pelo Dashboard.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <SortHeader label="Projeto" sortKey="name" sort={sort} setSort={setSort} />
                  <SortHeader label="Localização" sortKey="city" sort={sort} setSort={setSort} />
                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide text-left">
                    Tipo
                  </th>
                  <SortHeader
                    label="Área"
                    sortKey="area_m2"
                    sort={sort}
                    setSort={setSort}
                    align="right"
                  />
                  <SortHeader
                    label="Lotes"
                    sortKey="total_units"
                    sort={sort}
                    setSort={setSort}
                    align="right"
                  />
                  <SortHeader
                    label="VGV"
                    sortKey="vgv_estimado"
                    sort={sort}
                    setSort={setSort}
                    align="right"
                  />
                  <SortHeader
                    label="Score"
                    sortKey="score"
                    sort={sort}
                    setSort={setSort}
                    align="right"
                  />
                  <SortHeader label="Status" sortKey="status" sort={sort} setSort={setSort} />
                  <th className="px-3 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const statusCfg = getStatusConfig(p.analysis_status);
                  const StatusIcon = statusCfg.icon;
                  const score = p.analysis_results?.viabilidade_score;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/parcelamento/${p.id}`)}
                      className="border-b border-gray-100 last:border-0 hover:bg-blue-50/40 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-900 truncate max-w-[220px]">
                          {p.name}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-600">
                        {p.city ? `${p.city} — ${p.state ?? ""}` : p.state ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-gray-600">
                        {p.tipo ? TIPO_LABELS[p.tipo] ?? p.tipo : "—"}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-gray-900">
                        {formatArea(p.area_m2)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-gray-900">
                        {p.total_units ? p.total_units.toLocaleString("pt-BR") : "—"}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-gray-900">
                        {formatCurrency(p.vgv_estimado)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {score !== undefined ? (
                          <span className={`font-bold ${getScoreColor(score)}`}>{score}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Badge className={`text-xs font-medium gap-1 ${statusCfg.color} border-0`}>
                          <StatusIcon
                            className={`h-3 w-3 ${
                              p.analysis_status === "em_processamento" ? "animate-spin" : ""
                            }`}
                          />
                          {statusCfg.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <ExternalLink className="h-4 w-4 text-gray-300 inline" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
