import React from "react";
import { cn } from "@/lib/utils";
import { CADTool, CADElementCategory } from "@/types/cad";
import {
  MousePointer2,
  Move,
  Minus,
  Pentagon,
  Type,
  Trash2,
  Undo2,
  Redo2,
  Save,
  Loader2,
  Home,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_LABELS, CADElementCategory as Cat } from "@/types/cad";
import { useNavigate } from "react-router-dom";

interface CADToolbarProps {
  activeTool: CADTool;
  onToolChange: (tool: CADTool) => void;
  activeCategory: CADElementCategory;
  onCategoryChange: (cat: CADElementCategory) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saving: boolean;
  projectName: string;
  developmentId: string;
}

const TOOLS: { tool: CADTool; icon: React.ReactNode; label: string; shortcut: string }[] = [
  { tool: 'select',  icon: <MousePointer2 className="h-4 w-4" />, label: 'Selecionar',   shortcut: 'V' },
  { tool: 'pan',     icon: <Move className="h-4 w-4" />,           label: 'Mover Mapa',   shortcut: 'Space' },
  { tool: 'line',    icon: <Minus className="h-4 w-4" />,          label: 'Linha',         shortcut: 'L' },
  { tool: 'polygon', icon: <Pentagon className="h-4 w-4" />,       label: 'Polígono',      shortcut: 'P' },
  { tool: 'text',    icon: <Type className="h-4 w-4" />,           label: 'Texto',         shortcut: 'T' },
  { tool: 'delete',  icon: <Trash2 className="h-4 w-4" />,         label: 'Deletar',       shortcut: 'Del' },
];

const DRAW_CATEGORIES: CADElementCategory[] = [
  'lote', 'quadra', 'via', 'area_verde', 'area_institucional', 'app',
  'reserva_legal', 'area_lazer', 'line', 'annotation',
];

export function CADToolbar({
  activeTool,
  onToolChange,
  activeCategory,
  onCategoryChange,
  onUndo,
  onRedo,
  onSave,
  canUndo,
  canRedo,
  saving,
  projectName,
  developmentId,
}: CADToolbarProps) {
  const navigate = useNavigate();

  return (
    <TooltipProvider delayDuration={300}>
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-background border-b border-border shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => navigate(`/parcelamento/${developmentId}`)}
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </Button>

        <div className="h-5 w-px bg-border mx-1" />

        <span className="text-sm font-medium truncate max-w-[200px]">{projectName}</span>

        <div className="flex-1" />

        {/* Undo/Redo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onUndo} disabled={!canUndo}>
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Desfazer (Ctrl+Z)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRedo} disabled={!canRedo}>
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refazer (Ctrl+Y)</TooltipContent>
        </Tooltip>

        <div className="h-5 w-px bg-border mx-1" />

        <Button
          size="sm"
          className="gap-1.5"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      {/* Left tools panel */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1 bg-background/95 backdrop-blur border border-border rounded-xl shadow-lg p-2">
        {TOOLS.map(({ tool, icon, label, shortcut }) => (
          <Tooltip key={tool}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onToolChange(tool)}
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
                  activeTool === tool
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {icon}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {label} <span className="text-muted-foreground ml-1">[{shortcut}]</span>
            </TooltipContent>
          </Tooltip>
        ))}

        {/* Category selector - only shown for draw tools */}
        {(activeTool === 'polygon' || activeTool === 'line') && (
          <>
            <div className="h-px bg-border my-1" />
            <Select
              value={activeCategory}
              onValueChange={(v) => onCategoryChange(v as CADElementCategory)}
            >
              <SelectTrigger className="h-8 w-9 p-0 justify-center border-0 shadow-none focus:ring-0 bg-transparent">
                <div
                  className="w-4 h-4 rounded-sm border border-border"
                  style={{ backgroundColor: getCategoryColor(activeCategory) }}
                />
              </SelectTrigger>
              <SelectContent side="right" align="start" className="w-48">
                {DRAW_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-sm border border-border"
                        style={{ backgroundColor: getCategoryColor(cat) }}
                      />
                      <span>{CATEGORY_LABELS[cat]}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

function getCategoryColor(cat: CADElementCategory): string {
  const colors: Record<CADElementCategory, string> = {
    lote: '#3b82f6',
    quadra: '#8b5cf6',
    via: '#6b7280',
    area_verde: '#22c55e',
    area_institucional: '#f59e0b',
    app: '#06b6d4',
    reserva_legal: '#84cc16',
    area_lazer: '#f97316',
    annotation: '#9ca3af',
    line: '#374151',
  };
  return colors[cat] ?? '#9ca3af';
}
