import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useLabels, useDealLabels, useToggleDealLabel, useCreateLabel, useUpdateLabel, useDeleteLabel } from "@/hooks/useLabels";
import { ArrowLeft, Pencil, X } from "lucide-react";

const COLOR_PALETTE = [
  ["#4ade80", "#facc15", "#fb923c", "#f87171", "#c084fc"],
  ["#16a34a", "#ca8a04", "#ea580c", "#dc2626", "#9333ea"],
  ["#166534", "#a16207", "#9a3412", "#991b1b", "#6b21a8"],
  ["#7dd3fc", "#67e8f9", "#86efac", "#f9a8d4", "#d4d4d8"],
  ["#38bdf8", "#22d3ee", "#22c55e", "#ec4899", "#a3a3a3"],
  ["#0284c7", "#0891b2", "#15803d", "#be185d", "#525252"],
];

interface DealLabelsPopoverProps {
  dealId: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type View = "list" | "edit" | "create";

export function DealLabelsPopover({ dealId, trigger, open: controlledOpen, onOpenChange: controlledOnOpenChange }: DealLabelsPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;
  const [view, setView] = useState<View>("list");
  const [search, setSearch] = useState("");
  const [editingLabel, setEditingLabel] = useState<{ id: string; name: string; color: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#4ade80");

  const { data: allLabels } = useLabels();
  const { data: dealLabels } = useDealLabels(dealId);
  const toggleLabel = useToggleDealLabel();
  const createLabel = useCreateLabel();
  const updateLabel = useUpdateLabel();
  const deleteLabel = useDeleteLabel();

  const activeLabelIds = new Set(dealLabels?.map((dl: any) => dl.label_id) || []);

  const filtered = (allLabels || []).filter((l: any) =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = (labelId: string) => {
    toggleLabel.mutate({ dealId, labelId, active: activeLabelIds.has(labelId) });
  };

  const handleStartEdit = (label: any) => {
    setEditingLabel(label);
    setNewName(label.name);
    setNewColor(label.color);
    setView("edit");
  };

  const handleStartCreate = () => {
    setEditingLabel(null);
    setNewName("");
    setNewColor("#4ade80");
    setView("create");
  };

  const handleSave = () => {
    if (view === "edit" && editingLabel) {
      updateLabel.mutate({ id: editingLabel.id, name: newName, color: newColor });
    } else {
      createLabel.mutate({ name: newName, color: newColor });
    }
    setView("list");
  };

  const handleDelete = () => {
    if (editingLabel) {
      deleteLabel.mutate(editingLabel.id);
      setView("list");
    }
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setView("list"); }}>
      {trigger && <PopoverTrigger asChild>{trigger}</PopoverTrigger>}
      <PopoverContent className="w-72 p-0" align="start">
        {view === "list" ? (
          <>
            <div className="flex items-center justify-between px-3 py-2.5 border-b">
              <span className="text-sm font-semibold">Etiquetas</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="px-3 pt-2">
              <Input
                placeholder="Buscar etiquetas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="px-3 py-2 space-y-1.5 max-h-60 overflow-y-auto">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Etiquetas</p>
              {filtered.map((label: any) => (
                <div key={label.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={activeLabelIds.has(label.id)}
                    onCheckedChange={() => handleToggle(label.id)}
                  />
                  <button
                    className="flex-1 h-8 rounded text-left px-3 text-sm font-medium text-white truncate"
                    style={{ backgroundColor: label.color }}
                    onClick={() => handleToggle(label.id)}
                  >
                    {label.name}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleStartEdit(label)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="border-t px-3 py-2">
              <Button variant="secondary" className="w-full text-sm" onClick={handleStartCreate}>
                Criar uma nova etiqueta
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 px-3 py-2.5 border-b">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setView("list")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold flex-1 text-center">
                {view === "edit" ? "Editar etiqueta" : "Criar etiqueta"}
              </span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="px-3 py-3 space-y-3">
              {/* Preview */}
              <div className="flex justify-center">
                <div
                  className="h-9 w-full max-w-[220px] rounded px-3 flex items-center text-sm font-medium text-white"
                  style={{ backgroundColor: newColor }}
                >
                  {newName}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Título</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-8 text-sm mt-1"
                />
              </div>

              {/* Color grid */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Selecionar uma cor</label>
                <div className="mt-1.5 space-y-1">
                  {COLOR_PALETTE.map((row, ri) => (
                    <div key={ri} className="flex gap-1">
                      {row.map((c) => (
                        <button
                          key={c}
                          className="h-7 w-7 rounded transition-transform hover:scale-110 flex items-center justify-center"
                          style={{ backgroundColor: c }}
                          onClick={() => setNewColor(c)}
                        >
                          {newColor === c && (
                            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="flex-1" onClick={handleSave}>
                  Salvar
                </Button>
                {view === "edit" && editingLabel && (
                  <Button size="sm" variant="destructive" onClick={handleDelete}>
                    Excluir
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
