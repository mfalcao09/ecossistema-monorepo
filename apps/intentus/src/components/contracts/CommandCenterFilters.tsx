import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Filter, X, RotateCcw } from "lucide-react";
import type { ContractKPIFilters } from "@/hooks/useContractKPIs";

interface CommandCenterFiltersProps {
  filters: ContractKPIFilters;
  onFiltersChange: (filters: ContractKPIFilters) => void;
}

const CONTRACT_TYPES = [
  { value: "venda", label: "Venda" },
  { value: "locacao", label: "Locação" },
  { value: "administracao", label: "Administração" },
  { value: "distrato", label: "Distrato" },
  { value: "prestacao_servicos", label: "Prestação de Serviços" },
  { value: "obra", label: "Obra" },
  { value: "comissao", label: "Comissão" },
  { value: "fornecimento", label: "Fornecimento" },
  { value: "aditivo", label: "Aditivo" },
  { value: "cessao", label: "Cessão" },
  { value: "nda", label: "NDA" },
  { value: "exclusividade", label: "Exclusividade" },
];

const CONTRACT_STATUSES = [
  { value: "rascunho", label: "Rascunho" },
  { value: "em_revisao", label: "Em Revisão" },
  { value: "em_aprovacao", label: "Em Aprovação" },
  { value: "aguardando_assinatura", label: "Aguardando Assinatura" },
  { value: "ativo", label: "Ativo" },
  { value: "renovado", label: "Renovado" },
  { value: "encerrado", label: "Encerrado" },
  { value: "cancelado", label: "Cancelado" },
];

export default function CommandCenterFilters({
  filters,
  onFiltersChange,
}: CommandCenterFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters =
    filters.dateFrom ||
    filters.dateTo ||
    filters.contractType ||
    filters.status;

  const activeFilterCount = [
    filters.dateFrom,
    filters.dateTo,
    filters.contractType,
    filters.status,
  ].filter(Boolean).length;

  function handleReset() {
    onFiltersChange({});
  }

  function updateFilter(key: keyof ContractKPIFilters, value: string | undefined) {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  }

  return (
    <Card>
      <CardContent className="p-3">
        {/* Linha compacta de filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle de expansão */}
          <Button
            variant={isExpanded ? "secondary" : "outline"}
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="gap-1.5"
          >
            <Filter className="h-3.5 w-3.5" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="ml-1 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>

          {/* Filtros inline (sempre visíveis) */}
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <div className="w-40">
              <Select
                value={filters.contractType || "all"}
                onValueChange={(v) =>
                  updateFilter("contractType", v === "all" ? undefined : v)
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {CONTRACT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-44">
              <Select
                value={filters.status || "all"}
                onValueChange={(v) =>
                  updateFilter("status", v === "all" ? undefined : v)
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {CONTRACT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botão de reset */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="gap-1 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              Limpar
            </Button>
          )}
        </div>

        {/* Filtros expandidos (período) */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Data início (de)
              </Label>
              <Input
                type="date"
                className="h-8 text-xs w-40"
                value={filters.dateFrom || ""}
                onChange={(e) =>
                  updateFilter("dateFrom", e.target.value || undefined)
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Data início (até)
              </Label>
              <Input
                type="date"
                className="h-8 text-xs w-40"
                value={filters.dateTo || ""}
                onChange={(e) =>
                  updateFilter("dateTo", e.target.value || undefined)
                }
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
