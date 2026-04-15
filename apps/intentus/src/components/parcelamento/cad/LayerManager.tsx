import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { CADLayer } from "@/types/cad";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Layers,
  ChevronRight,
  ChevronDown,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LayerManagerProps {
  layers: CADLayer[];
  activeLayerId: string;
  onActiveLayerChange: (id: string) => void;
  onLayerVisibilityToggle: (id: string) => void;
  onLayerLockToggle: (id: string) => void;
  onLayerRename: (id: string, name: string) => void;
  onLayerAdd: () => void;
}

export function LayerManager({
  layers,
  activeLayerId,
  onActiveLayerChange,
  onLayerVisibilityToggle,
  onLayerLockToggle,
  onLayerRename,
  onLayerAdd,
}: LayerManagerProps) {
  const [open, setOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  function startEdit(layer: CADLayer) {
    setEditingId(layer.id);
    setEditingName(layer.name);
  }

  function commitEdit() {
    if (editingId && editingName.trim()) {
      onLayerRename(editingId, editingName.trim());
    }
    setEditingId(null);
  }

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-52 bg-background/95 backdrop-blur border border-border rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <button
        className="flex items-center gap-2 w-full px-3 py-2.5 hover:bg-accent/50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <Layers className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium flex-1 text-left">Layers</span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {open && (
        <>
          <div className="border-t border-border max-h-64 overflow-y-auto">
            {[...layers].sort((a, b) => a.order - b.order).map((layer) => (
              <div
                key={layer.id}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1.5 group cursor-pointer transition-colors",
                  activeLayerId === layer.id
                    ? "bg-primary/10"
                    : "hover:bg-accent/40"
                )}
                onClick={() => onActiveLayerChange(layer.id)}
              >
                {/* Color dot */}
                <div
                  className="w-3 h-3 rounded-sm shrink-0 border border-border/50"
                  style={{ backgroundColor: layer.color }}
                />

                {/* Name */}
                {editingId === layer.id ? (
                  <Input
                    className="h-5 text-xs px-1 py-0 flex-1"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className={cn(
                      "text-xs flex-1 truncate",
                      !layer.visible && "text-muted-foreground line-through opacity-60"
                    )}
                  >
                    {layer.name}
                  </span>
                )}

                {/* Actions */}
                {editingId === layer.id ? (
                  <div className="flex gap-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); commitEdit(); }}
                      className="p-0.5 text-green-600 hover:text-green-700"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                      className="p-0.5 text-red-500 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); startEdit(layer); }}
                      className="p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onLayerVisibilityToggle(layer.id); }}
                      className="p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onLayerLockToggle(layer.id); }}
                      className="p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      {layer.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-border p-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 gap-1.5 text-xs text-muted-foreground"
              onClick={onLayerAdd}
            >
              <Plus className="h-3.5 w-3.5" />
              Nova Layer
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
