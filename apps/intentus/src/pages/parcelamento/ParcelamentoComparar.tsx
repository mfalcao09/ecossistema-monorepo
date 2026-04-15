/**
 * ParcelamentoComparar.tsx — Comparador de Empreendimentos
 * Sessão 147 (Bloco L — US-42): seleciona até 5 projetos e compara lado a lado.
 * Layout: projetos nas colunas, métricas nas linhas (recomendação Buchecha M2.7).
 */
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Mountain,
  Plus,
  X,
  GitCompareArrows,
  CheckCircle2,
  BarChart3,
  MapPin,
  TrendingUp,
  Loader2,
  ChevronsUpDown,
} from "lucide-react";
import { useParcelamentoProjects } from "@/hooks/useParcelamentoProjects";
import type { ParcelamentoDevelopment, AnalysisStatus } from "@/lib/parcelamento/types";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const MAX_COMPARE = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatArea(v: number | null | undefined) {
  if (!v) return "—";
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} m²`;
}

function formatCurrency(v: number | null | undefined) {
  if (!v) return "—";
  if (v >= 1_000_000)
    return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} M`;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function formatNumber(v: number | null | undefined) {
  if (!v) return "—";
  return v.toLocaleString("pt-BR");
}

const STATUS_LABELS: Record<AnalysisStatus, string> = {
  rascunho: "Rascunho",
  pendente: "Pendente",
  em_analise: "Em Análise",
  em_processamento: "Processando",
  concluido: "Análise Concluída",
  erro: "Erro",
  viavel: "Viável",
  rejeitado: "Rejeitado",
  monitorando: "Monitorando",
};

const TIPO_LABELS: Record<string, string> = {
  loteamento: "Loteamento Aberto",
  condominio: "Cond. Horizontal",
};

function getScoreColor(score: number | null | undefined) {
  if (!score) return "text-gray-400";
  if (score >= 70) return "text-emerald-600 font-black";
  if (score >= 45) return "text-amber-600 font-bold";
  return "text-red-600 font-bold";
}

// ---------------------------------------------------------------------------
// Linha da tabela de comparação
// ---------------------------------------------------------------------------

function CompareRow({
  label,
  values,
  highlight,
}: {
  label: string;
  values: (string | React.ReactNode)[];
  highlight?: boolean;
}) {
  return (
    <tr className={highlight ? "bg-blue-50/40" : "even:bg-gray-50/50"}>
      <td className="px-4 py-3 text-sm font-medium text-gray-600 whitespace-nowrap border-r border-gray-200 w-44 sticky left-0 bg-white z-10">
        {label}
      </td>
      {values.map((v, i) => (
        <td
          key={i}
          className="px-4 py-3 text-sm text-gray-800 text-center border-r border-gray-100 last:border-0 min-w-[160px]"
        >
          {v}
        </td>
      ))}
      {/* Colunas vazias para projetos não-selecionados (para manter grid) */}
      {Array.from({ length: MAX_COMPARE - values.length }).map((_, i) => (
        <td key={`empty-${i}`} className="px-4 py-3 border-r border-gray-100 last:border-0 min-w-[160px]" />
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Seletor de Projetos
// ---------------------------------------------------------------------------

function ProjectSelector({
  projects,
  selected,
  onSelect,
  onRemove,
}: {
  projects: ParcelamentoDevelopment[];
  selected: ParcelamentoDevelopment[];
  onSelect: (p: ParcelamentoDevelopment) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const available = projects.filter((p) => !selected.find((s) => s.id === p.id));
  const canAdd = selected.length < MAX_COMPARE;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Chips dos selecionados */}
      {selected.map((p) => (
        <div
          key={p.id}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-sm font-medium text-blue-800"
        >
          <Mountain className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="max-w-[140px] truncate">{p.name}</span>
          <button
            onClick={() => onRemove(p.id)}
            className="ml-0.5 rounded-full hover:bg-blue-200 transition-colors p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}

      {/* Botão adicionar */}
      {canAdd && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-full">
              <Plus className="h-3.5 w-3.5" />
              {selected.length === 0 ? "Selecionar projeto" : "Adicionar"}
              <ChevronsUpDown className="h-3 w-3 text-gray-400" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar projeto..." />
              <CommandList>
                <CommandEmpty>Nenhum projeto encontrado.</CommandEmpty>
                <CommandGroup>
                  {available.map((p) => (
                    <CommandItem
                      key={p.id}
                      onSelect={() => {
                        onSelect(p);
                        setOpen(false);
                      }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-sm">{p.name}</span>
                        <span className="text-xs text-gray-400">
                          {p.city ? `${p.city}, ` : ""}{p.state} · {TIPO_LABELS[p.tipo ?? ""] ?? p.tipo}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      {selected.length > 0 && (
        <span className="text-xs text-gray-400 ml-1">
          {selected.length}/{MAX_COMPARE} projetos selecionados
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ParcelamentoComparar() {
  const { data: projects = [], isLoading } = useParcelamentoProjects();
  const [selected, setSelected] = useState<ParcelamentoDevelopment[]>([]);

  const handleSelect = (p: ParcelamentoDevelopment) => {
    if (selected.length >= MAX_COMPARE) return;
    setSelected((prev) => [...prev, p]);
  };

  const handleRemove = (id: string) => {
    setSelected((prev) => prev.filter((p) => p.id !== id));
  };

  // Linha de cabeçalho: nomes dos projetos
  const headerNames = useMemo(() => selected.map((p) => p.name), [selected]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <GitCompareArrows className="h-5 w-5 text-blue-600" />
              Comparar Empreendimentos
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Selecione até {MAX_COMPARE} projetos para comparar lado a lado
            </p>
          </div>
          {selected.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected([])}
              className="text-gray-400 gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              Limpar seleção
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando projetos...
          </div>
        ) : (
          <ProjectSelector
            projects={projects}
            selected={selected}
            onSelect={handleSelect}
            onRemove={handleRemove}
          />
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto px-6 py-5">
        {selected.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 px-4">
            <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
              <GitCompareArrows className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              Selecione os projetos para comparar
            </h3>
            <p className="text-sm text-gray-500 text-center max-w-sm">
              Use o seletor acima para escolher até {MAX_COMPARE} empreendimentos.
              A tabela comparativa aparecerá automaticamente.
            </p>
          </div>
        ) : (
          /* Tabela comparativa */
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {/* Coluna de métrica (fixa) */}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 w-44 sticky left-0 bg-gray-50 z-10">
                    Métrica
                  </th>
                  {/* Colunas de projetos */}
                  {headerNames.map((name, i) => (
                    <th
                      key={i}
                      className="px-4 py-3 text-center text-sm font-semibold text-gray-800 border-r border-gray-100 last:border-0 min-w-[160px]"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Mountain className="h-4 w-4 text-blue-500" />
                        <span className="truncate max-w-[140px]" title={name}>{name}</span>
                      </div>
                    </th>
                  ))}
                  {/* Headers vazios */}
                  {Array.from({ length: MAX_COMPARE - selected.length }).map((_, i) => (
                    <th key={`empty-h-${i}`} className="px-4 py-3 border-r border-gray-100 last:border-0 min-w-[160px]">
                      <div className="flex flex-col items-center gap-1 opacity-30">
                        <Mountain className="h-4 w-4 text-gray-400" />
                        <span className="text-xs text-gray-400">—</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {/* SEÇÃO: LOCALIZAÇÃO */}
                <tr className="bg-blue-600">
                  <td colSpan={MAX_COMPARE + 1} className="px-4 py-2 text-xs font-bold text-white uppercase tracking-wider">
                    <MapPin className="h-3.5 w-3.5 inline mr-1.5" />
                    Localização e Tipo
                  </td>
                </tr>

                <CompareRow
                  label="Cidade / UF"
                  values={selected.map((p) =>
                    p.city ? `${p.city}, ${p.state}` : p.state ?? "—"
                  )}
                />
                <CompareRow
                  label="Tipo"
                  values={selected.map((p) =>
                    p.tipo ? (TIPO_LABELS[p.tipo] ?? p.tipo) : "—"
                  )}
                />
                <CompareRow
                  label="Status"
                  values={selected.map((p) => (
                    <Badge
                      key={p.id}
                      variant="outline"
                      className="text-xs font-medium"
                    >
                      {STATUS_LABELS[p.analysis_status ?? "pendente"]}
                    </Badge>
                  ))}
                />

                {/* SEÇÃO: DIMENSÕES */}
                <tr className="bg-green-600">
                  <td colSpan={MAX_COMPARE + 1} className="px-4 py-2 text-xs font-bold text-white uppercase tracking-wider">
                    <BarChart3 className="h-3.5 w-3.5 inline mr-1.5" />
                    Dimensões
                  </td>
                </tr>

                <CompareRow
                  label="Área total"
                  values={selected.map((p) => formatArea(p.area_m2))}
                />
                <CompareRow
                  label="Lotes estimados"
                  values={selected.map((p) => formatNumber(p.total_units))}
                />
                <CompareRow
                  label="Elevação mín."
                  values={selected.map((p) =>
                    p.elevation_min != null ? `${p.elevation_min.toFixed(0)} m` : "—"
                  )}
                />
                <CompareRow
                  label="Elevação máx."
                  values={selected.map((p) =>
                    p.elevation_max != null ? `${p.elevation_max.toFixed(0)} m` : "—"
                  )}
                />
                <CompareRow
                  label="Declividade méd."
                  values={selected.map((p) =>
                    p.slope_avg_pct != null ? `${p.slope_avg_pct.toFixed(1)}%` : "—"
                  )}
                />

                {/* SEÇÃO: FINANCEIRO */}
                <tr className="bg-indigo-600">
                  <td colSpan={MAX_COMPARE + 1} className="px-4 py-2 text-xs font-bold text-white uppercase tracking-wider">
                    <TrendingUp className="h-3.5 w-3.5 inline mr-1.5" />
                    Financeiro
                  </td>
                </tr>

                <CompareRow
                  label="VGV estimado"
                  values={selected.map((p) => formatCurrency(p.vgv_estimado))}
                  highlight
                />

                {/* SEÇÃO: AMBIENTAL */}
                <tr className="bg-emerald-600">
                  <td colSpan={MAX_COMPARE + 1} className="px-4 py-2 text-xs font-bold text-white uppercase tracking-wider">
                    Ambiental
                  </td>
                </tr>

                <CompareRow
                  label="APP (m²)"
                  values={selected.map((p) => formatArea(p.app_area_m2))}
                />
                <CompareRow
                  label="Reserva Legal"
                  values={selected.map((p) =>
                    p.reserva_legal_pct != null
                      ? `${p.reserva_legal_pct.toFixed(1)}%`
                      : "—"
                  )}
                />

                {/* SEÇÃO: VIABILIDADE */}
                <tr className="bg-amber-500">
                  <td colSpan={MAX_COMPARE + 1} className="px-4 py-2 text-xs font-bold text-white uppercase tracking-wider">
                    <CheckCircle2 className="h-3.5 w-3.5 inline mr-1.5" />
                    Viabilidade
                  </td>
                </tr>

                <CompareRow
                  label="Score"
                  values={selected.map((p) => {
                    const score = p.analysis_results?.viabilidade_score;
                    return (
                      <span className={`text-2xl ${getScoreColor(score)}`}>
                        {score ?? "—"}
                      </span>
                    );
                  })}
                  highlight
                />
                <CompareRow
                  label="Classificação"
                  values={selected.map((p) => {
                    const score = p.analysis_results?.viabilidade_score;
                    if (!score) return <span className="text-gray-400">—</span>;
                    if (score >= 70) return <Badge className="bg-emerald-100 text-emerald-700 border-0">Alta</Badge>;
                    if (score >= 45) return <Badge className="bg-amber-100 text-amber-700 border-0">Média</Badge>;
                    return <Badge className="bg-red-100 text-red-700 border-0">Baixa</Badge>;
                  })}
                />
                <CompareRow
                  label="Parecer"
                  values={selected.map((p) =>
                    p.analysis_results?.viabilidade_label ?? "—"
                  )}
                />
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
