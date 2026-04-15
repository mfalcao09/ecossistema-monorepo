import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Sparkles, AlertTriangle, CalendarDays, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { obligationTypeLabels, responsiblePartyLabels, recurrenceLabels } from "@/lib/clmSchema";

export interface AIExtractedObligation {
  title: string;
  description: string;
  obligation_type: string;
  responsible_party: string;
  due_date: string | null;
  recurrence: string | null;
  alert_days_before: number;
  source_clause: string;
  /** UI-only: whether the user wants to import this obligation */
  selected?: boolean;
}

interface Props {
  obligations: AIExtractedObligation[];
  onChange: (obligations: AIExtractedObligation[]) => void;
}

const OBLIGATION_TYPE_OPTIONS = Object.entries(obligationTypeLabels);
const RESPONSIBLE_OPTIONS = Object.entries(responsiblePartyLabels);
const RECURRENCE_OPTIONS = Object.entries(recurrenceLabels);

export function ObligationPreviewPanel({ obligations, onChange }: Props) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleSelect = (index: number) => {
    onChange(obligations.map((o, i) => i === index ? { ...o, selected: !o.selected } : o));
  };

  const toggleSelectAll = () => {
    const allSelected = obligations.every((o) => o.selected !== false);
    onChange(obligations.map((o) => ({ ...o, selected: !allSelected })));
  };

  const updateField = (index: number, key: string, value: any) => {
    onChange(obligations.map((o, i) => i === index ? { ...o, [key]: value } : o));
  };

  const removeObligation = (index: number) => {
    onChange(obligations.filter((_, i) => i !== index));
  };

  const addObligation = () => {
    onChange([...obligations, {
      title: "",
      description: "",
      obligation_type: "operacional",
      responsible_party: "administradora",
      due_date: "",
      recurrence: null,
      alert_days_before: 30,
      source_clause: "",
      selected: true,
    }]);
    setExpandedIndex(obligations.length);
  };

  const selectedCount = obligations.filter((o) => o.selected !== false).length;

  if (obligations.length === 0) {
    return (
      <div className="space-y-4 py-2">
        <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Nenhuma obrigação foi identificada pela IA neste contrato. Você pode adicionar manualmente.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addObligation}>
          <Plus className="mr-1 h-3 w-3" /> Adicionar Obrigação
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      {/* Header info */}
      <div className="flex items-start gap-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
        <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">
            A IA identificou <strong>{obligations.length}</strong> obrigação(ões) no contrato.
            Revise, edite ou desmarque as que não deseja importar.
          </p>
        </div>
      </div>

      {/* Select all / count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selectedCount === obligations.length}
            onCheckedChange={toggleSelectAll}
            id="select-all-obligations"
          />
          <label htmlFor="select-all-obligations" className="text-xs text-muted-foreground cursor-pointer">
            Selecionar todas ({selectedCount}/{obligations.length})
          </label>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addObligation}>
          <Plus className="mr-1 h-3 w-3" /> Adicionar
        </Button>
      </div>

      {/* Obligation cards */}
      <div className="space-y-2">
        {obligations.map((obl, index) => {
          const isExpanded = expandedIndex === index;
          const isSelected = obl.selected !== false;

          return (
            <div
              key={index}
              className={`rounded-lg border transition-colors ${isSelected ? "bg-card" : "bg-muted/30 opacity-60"}`}
            >
              {/* Collapsed view */}
              <div className="flex items-center gap-2 px-3 py-2">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleSelect(index)}
                />
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{obl.title || "(sem título)"}</p>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {obligationTypeLabels[obl.obligation_type] ?? obl.obligation_type}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {responsiblePartyLabels[obl.responsible_party] ?? obl.responsible_party}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    {obl.due_date && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {new Date(obl.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
                      </span>
                    )}
                    {obl.recurrence && (
                      <span>{recurrenceLabels[obl.recurrence] ?? obl.recurrence}</span>
                    )}
                    {obl.source_clause && (
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {obl.source_clause}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive"
                  onClick={() => removeObligation(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Expanded edit form */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t pt-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Título *</label>
                      <Input
                        value={obl.title}
                        onChange={(e) => updateField(index, "title", e.target.value)}
                        placeholder="Ex: Pagamento mensal do aluguel"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Data de Vencimento</label>
                      <Input
                        type="date"
                        value={obl.due_date || ""}
                        onChange={(e) => updateField(index, "due_date", e.target.value || null)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                      <Select
                        value={obl.obligation_type}
                        onValueChange={(v) => updateField(index, "obligation_type", v)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {OBLIGATION_TYPE_OPTIONS.map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Responsável</label>
                      <Select
                        value={obl.responsible_party}
                        onValueChange={(v) => updateField(index, "responsible_party", v)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RESPONSIBLE_OPTIONS.map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Recorrência</label>
                      <Select
                        value={obl.recurrence || "nenhuma"}
                        onValueChange={(v) => updateField(index, "recurrence", v === "nenhuma" ? null : v)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nenhuma">Sem recorrência</SelectItem>
                          {RECURRENCE_OPTIONS.map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Alerta (dias antes)</label>
                      <Input
                        type="number"
                        value={obl.alert_days_before}
                        onChange={(e) => updateField(index, "alert_days_before", Number(e.target.value))}
                        min={1}
                        max={365}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                    <Textarea
                      value={obl.description}
                      onChange={(e) => updateField(index, "description", e.target.value)}
                      placeholder="Detalhes da obrigação..."
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Cláusula de Referência</label>
                    <Input
                      value={obl.source_clause}
                      onChange={(e) => updateField(index, "source_clause", e.target.value)}
                      placeholder="Ex: Cláusula 5ª, §2º"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
