import { useState, useEffect, useMemo } from "react";
import {
  usePipelineTemplates,
  useCreatePipeline,
  useUpdatePipeline,
  useUpdatePipelineColumns,
  useDeletePipeline,
  type PipelineTemplate,
  type PipelineColumn,
} from "@/hooks/usePipelineTemplates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { dealRequestStatusLabels } from "@/lib/dealRequestSchema";
import {
  ArrowLeft, Plus, Pencil, Trash2, GripVertical, Star, GitBranch,
  ChevronUp, ChevronDown, X,
} from "lucide-react";

const dealTypeLabels: Record<string, string> = {
  venda: "Venda",
  locacao: "Locação",
  administracao: "Administração",
};

const ALL_STATUSES = Object.keys(dealRequestStatusLabels);

// ── Column Editor (inline) ──────────────────────────────────────────
interface ColumnEditorRow {
  id?: string;
  title: string;
  statuses: string[];
  color: string;
  icon: string;
  wip_limit: number | null;
}

function emptyColumn(): ColumnEditorRow {
  return { title: "", statuses: [], color: "#6366f1", icon: "", wip_limit: null };
}

function ColumnsEditor({
  columns,
  onChange,
}: {
  columns: ColumnEditorRow[];
  onChange: (cols: ColumnEditorRow[]) => void;
}) {
  const usedStatuses = useMemo(() => new Set(columns.flatMap((c) => c.statuses)), [columns]);

  const moveColumn = (idx: number, dir: -1 | 1) => {
    const next = [...columns];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const updateCol = (idx: number, patch: Partial<ColumnEditorRow>) => {
    const next = [...columns];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const removeCol = (idx: number) => {
    onChange(columns.filter((_, i) => i !== idx));
  };

  const addColumn = () => {
    onChange([...columns, emptyColumn()]);
  };

  const toggleStatus = (colIdx: number, status: string) => {
    const col = columns[colIdx];
    const has = col.statuses.includes(status);
    updateCol(colIdx, {
      statuses: has
        ? col.statuses.filter((s) => s !== status)
        : [...col.statuses, status],
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Colunas do Funil</Label>
        <Button variant="outline" size="sm" onClick={addColumn}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Coluna
        </Button>
      </div>

      {columns.length === 0 && (
        <p className="text-xs text-muted-foreground py-4 text-center">
          Nenhuma coluna. Clique em "+ Coluna" para adicionar.
        </p>
      )}

      {columns.map((col, idx) => (
        <Card key={idx} className="border-dashed">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                value={col.title}
                onChange={(e) => updateCol(idx, { title: e.target.value })}
                placeholder={`Coluna ${idx + 1}`}
                className="h-8 text-sm flex-1"
              />
              <input
                type="color"
                value={col.color}
                onChange={(e) => updateCol(idx, { color: e.target.value })}
                className="h-8 w-8 rounded cursor-pointer border"
                title="Cor da coluna"
              />
              <div className="flex gap-0.5">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveColumn(idx, -1)} disabled={idx === 0}>
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveColumn(idx, 1)} disabled={idx === columns.length - 1}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeCol(idx)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Status chips */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status agrupados nesta coluna:</p>
              <div className="flex flex-wrap gap-1">
                {ALL_STATUSES.map((st) => {
                  const isSelected = col.statuses.includes(st);
                  const usedElsewhere = !isSelected && usedStatuses.has(st);
                  return (
                    <Badge
                      key={st}
                      variant={isSelected ? "default" : "outline"}
                      className={`cursor-pointer text-[10px] px-1.5 py-0.5 select-none ${
                        usedElsewhere ? "opacity-30 cursor-not-allowed" : ""
                      } ${isSelected ? "bg-primary text-primary-foreground" : ""}`}
                      onClick={() => {
                        if (usedElsewhere) return;
                        toggleStatus(idx, st);
                      }}
                    >
                      {dealRequestStatusLabels[st] || st}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* WIP Limit */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Limite WIP:</Label>
              <Input
                type="number"
                min={0}
                value={col.wip_limit ?? ""}
                onChange={(e) => updateCol(idx, { wip_limit: e.target.value ? Math.max(0, Number(e.target.value)) : null })}
                placeholder="Sem limite"
                className="h-7 text-xs w-24"
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Create/Edit Pipeline Dialog ──────────────────────────────────────
interface PipelineFormData {
  name: string;
  deal_type: string;
  description: string;
  is_default: boolean;
  columns: ColumnEditorRow[];
}

function PipelineFormDialog({
  open,
  onOpenChange,
  editingPipeline,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPipeline: PipelineTemplate | null;
  onSubmit: (data: PipelineFormData) => void;
  isPending: boolean;
}) {
  const isEditing = !!editingPipeline;

  const [form, setForm] = useState<PipelineFormData>(() => initForm(editingPipeline));

  function initForm(p: PipelineTemplate | null): PipelineFormData {
    if (!p) return { name: "", deal_type: "venda", description: "", is_default: false, columns: [] };
    return {
      name: p.name,
      deal_type: p.deal_type,
      description: p.description || "",
      is_default: p.is_default,
      columns: (p.pipeline_columns || []).map((c) => ({
        id: c.id,
        title: c.title,
        statuses: c.statuses,
        color: c.color || "#6366f1",
        icon: c.icon || "",
        wip_limit: c.wip_limit,
      })),
    };
  }

  // Reset form when dialog opens with different pipeline
  const [lastId, setLastId] = useState<string | null>(null);
  useEffect(() => {
    if (open && (editingPipeline?.id ?? null) !== lastId) {
      setLastId(editingPipeline?.id ?? null);
      setForm(initForm(editingPipeline));
    }
  }, [open, editingPipeline?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = form.name.trim().length > 0 && form.columns.length > 0 && form.columns.every((c) => c.title.trim() && c.statuses.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Funil" : "Novo Funil"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1">
            <Label>Nome do Funil</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Pipeline de Vendas Premium"
            />
          </div>

          {/* Deal Type */}
          <div className="space-y-1">
            <Label>Tipo de Negócio</Label>
            <Select
              value={form.deal_type}
              onValueChange={(val) => setForm((f) => ({ ...f, deal_type: val }))}
              disabled={isEditing}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="venda">Venda</SelectItem>
                <SelectItem value="locacao">Locação</SelectItem>
                <SelectItem value="administracao">Administração</SelectItem>
              </SelectContent>
            </Select>
            {isEditing && <p className="text-xs text-muted-foreground">O tipo não pode ser alterado após a criação.</p>}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Descreva o objetivo deste funil..."
              rows={2}
            />
          </div>

          {/* Default toggle */}
          <div className="flex items-center gap-3">
            <Switch
              checked={form.is_default}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, is_default: checked }))}
            />
            <Label className="text-sm">Funil padrão para {dealTypeLabels[form.deal_type] || form.deal_type}</Label>
          </div>

          {/* Columns */}
          <ColumnsEditor columns={form.columns} onChange={(cols) => setForm((f) => ({ ...f, columns: cols }))} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={() => onSubmit(form)} disabled={!canSubmit || isPending}>
            {isPending ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Funil"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────
export default function PipelineManager() {
  const navigate = useNavigate();
  const { data: pipelines, isLoading } = usePipelineTemplates();
  const createPipeline = useCreatePipeline();
  const updatePipeline = useUpdatePipeline();
  const updateColumns = useUpdatePipelineColumns();
  const deletePipeline = useDeletePipeline();

  const [formOpen, setFormOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<PipelineTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PipelineTemplate | null>(null);

  const handleCreate = () => {
    setEditingPipeline(null);
    setFormOpen(true);
  };

  const handleEdit = (p: PipelineTemplate) => {
    setEditingPipeline(p);
    setFormOpen(true);
  };

  const handleSubmit = async (data: PipelineFormData) => {
    try {
      if (editingPipeline) {
        // Update pipeline metadata
        await updatePipeline.mutateAsync({
          id: editingPipeline.id,
          name: data.name,
          description: data.description || undefined,
          is_default: data.is_default,
        });
        // Update columns — if this fails, metadata was already saved (partial update)
        try {
          await updateColumns.mutateAsync({
            pipeline_template_id: editingPipeline.id,
            columns: data.columns.map((c, idx) => ({
              id: c.id,
              title: c.title,
              statuses: c.statuses,
              color: c.color,
              icon: c.icon,
              sort_order: idx + 1,
              wip_limit: c.wip_limit ?? undefined,
            })),
          });
        } catch (colErr) {
          toast.error("Metadados salvos, mas erro ao atualizar colunas. Tente editar novamente.");
          return;
        }
        setFormOpen(false);
      } else {
        // Create new
        await createPipeline.mutateAsync({
          name: data.name,
          deal_type: data.deal_type,
          description: data.description || undefined,
          is_default: data.is_default,
          columns: data.columns.map((c) => ({
            title: c.title,
            statuses: c.statuses,
            color: c.color,
            icon: c.icon,
            wip_limit: c.wip_limit ?? undefined,
          })),
        });
        setFormOpen(false);
      }
    } catch {
      // Error toast already handled by mutation hooks
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePipeline.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // toast handled by hook
    }
  };

  const handleToggleDefault = async (p: PipelineTemplate) => {
    if (p.is_default) {
      toast.info("Este já é o funil padrão.");
      return;
    }
    await updatePipeline.mutateAsync({ id: p.id, is_default: true });
  };

  // Group pipelines by deal_type
  const grouped = useMemo(() => (pipelines || []).reduce<Record<string, PipelineTemplate[]>>((acc, p) => {
    (acc[p.deal_type] = acc[p.deal_type] || []).push(p);
    return acc;
  }, {}), [pipelines]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/comercial/negocios")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
              <GitBranch className="h-5 w-5" /> Gerenciar Funis
            </h1>
            <p className="text-sm text-muted-foreground">
              Crie e configure funis personalizados para cada tipo de negócio
            </p>
          </div>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-1" /> Novo Funil
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!pipelines || pipelines.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <GitBranch className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-lg font-semibold">Nenhum funil configurado</p>
            <p className="text-sm text-muted-foreground mb-4">
              Crie seu primeiro funil para organizar seus negócios no Kanban.
            </p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-1" /> Criar Primeiro Funil
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pipeline cards grouped by deal_type */}
      {Object.entries(grouped).map(([dealType, items]) => (
        <div key={dealType} className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Badge variant="outline">{dealTypeLabels[dealType] || dealType}</Badge>
            <span className="text-xs text-muted-foreground font-normal">{items.length} funil(is)</span>
          </h2>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <Card key={p.id} className="relative hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <div className="flex items-center gap-1">
                      {p.is_default && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Padrão
                        </Badge>
                      )}
                    </div>
                  </div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                  )}
                </CardHeader>
                <CardContent className="pb-3 space-y-3">
                  {/* Column preview */}
                  <div className="flex flex-wrap gap-1">
                    {(p.pipeline_columns || []).map((col) => (
                      <Badge
                        key={col.id}
                        variant="outline"
                        className="text-[10px] px-1.5 py-0.5"
                        style={col.color ? { borderColor: col.color, color: col.color } : undefined}
                      >
                        {col.title} ({col.statuses.length})
                      </Badge>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 pt-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleEdit(p)}>
                      <Pencil className="h-3 w-3 mr-1" /> Editar
                    </Button>
                    {!p.is_default && (
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleToggleDefault(p)}>
                        <Star className="h-3 w-3 mr-1" /> Tornar Padrão
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive ml-auto"
                      onClick={() => setDeleteTarget(p)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Create/Edit Dialog */}
      <PipelineFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingPipeline={editingPipeline}
        onSubmit={handleSubmit}
        isPending={createPipeline.isPending || updatePipeline.isPending || updateColumns.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funil "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as colunas deste funil serão removidas.
              Os negócios não serão afetados — apenas a organização visual do Kanban.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePipeline.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
