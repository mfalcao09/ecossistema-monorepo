import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { GripVertical, ChevronDown, RotateCcw, BarChart3, PieChart, Settings2, Eye, EyeOff, TrendingUp } from "lucide-react";
import { DASHBOARD_BLOCKS, type BlockDef, type BlockPref, type DashboardPrefs } from "@/lib/dashboardKpiCatalog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPrefs: DashboardPrefs;
  onSave: (prefs: DashboardPrefs) => Promise<void>;
  onReset: () => Promise<void>;
  isSaving: boolean;
  isResetting: boolean;
  catalogBlocks?: BlockDef[];
}

export default function DashboardCustomizeDialog({ open, onOpenChange, currentPrefs, onSave, onReset, isSaving, isResetting, catalogBlocks }: Props) {
  const [blocks, setBlocks] = useState<BlockPref[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setBlocks(currentPrefs.blocks.map((b, i) => ({ ...b, order: i })));
      setExpandedKey(null);
    }
  }, [open, currentPrefs]);

  const toggleBlock = (key: string) => {
    setBlocks((prev) => prev.map((b) => (b.key === key ? { ...b, visible: !b.visible } : b)));
  };

  const toggleKpi = (blockKey: string, kpiKey: string) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.key === blockKey
          ? { ...b, kpis: b.kpis.map((k) => (k.key === kpiKey ? { ...k, visible: !k.visible } : k)) }
          : b
      )
    );
  };

  const toggleChart = (blockKey: string) => {
    setBlocks((prev) =>
      prev.map((b) => (b.key === blockKey ? { ...b, chartEnabled: !b.chartEnabled } : b))
    );
  };

  const setChartType = (blockKey: string, type: "pie" | "bar") => {
    setBlocks((prev) =>
      prev.map((b) => (b.key === blockKey ? { ...b, chartType: type } : b))
    );
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(blocks);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setBlocks(items.map((b, i) => ({ ...b, order: i })));
  };

  const handleSave = async () => {
    await onSave({ blocks: blocks.map((b, i) => ({ ...b, order: i })) });
    onOpenChange(false);
  };

  const handleReset = async () => {
    await onReset();
    onOpenChange(false);
  };

  const effectiveBlocks = catalogBlocks || DASHBOARD_BLOCKS;
  const catalogMap = useMemo(() => Object.fromEntries(effectiveBlocks.map((b) => [b.key, b])), [effectiveBlocks]);

  const activeCount = blocks.filter((b) => b.visible).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Settings2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg">Personalizar Dashboard</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Ative blocos, escolha KPIs e gráficos • Arraste para reordenar
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Badge variant="secondary" className="text-xs font-normal gap-1">
              <Eye className="h-3 w-3" />
              {activeCount} de {blocks.length} blocos ativos
            </Badge>
          </div>
        </DialogHeader>

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="blocks">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2 mt-1">
                {blocks.map((block, index) => {
                  const catalog = catalogMap[block.key];
                  if (!catalog) return null;
                  const Icon = catalog.icon;
                  const hasChartKpis = !!catalog.chartKpis?.length;
                  const activeKpis = block.kpis.filter((k) => k.visible).length;
                  const totalKpis = block.kpis.length;
                  const isExpanded = expandedKey === block.key;

                  // Group KPIs by group
                  const kpiGroups = catalog.kpis.reduce<Record<string, typeof catalog.kpis>>((acc, kpi) => {
                    const group = kpi.group || "__default__";
                    if (!acc[group]) acc[group] = [];
                    acc[group].push(kpi);
                    return acc;
                  }, {});

                  return (
                    <Draggable key={block.key} draggableId={block.key} index={index}>
                      {(prov, snapshot) => (
                        <div
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          className={cn(
                            "border rounded-xl bg-card transition-all duration-200",
                            snapshot.isDragging && "shadow-lg ring-2 ring-primary/20",
                            !block.visible && "opacity-60",
                            isExpanded && "ring-1 ring-primary/30"
                          )}
                        >
                          <Collapsible
                            open={isExpanded}
                            onOpenChange={(o) => setExpandedKey(o ? block.key : null)}
                          >
                            <div className="flex items-center gap-2.5 p-3">
                              <div {...prov.dragHandleProps} className="cursor-grab hover:text-foreground transition-colors">
                                <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                              </div>
                              <div
                                className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                                style={{ backgroundColor: `${catalog.accentColor}15` }}
                              >
                                <Icon className="h-4 w-4" style={{ color: catalog.accentColor }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium leading-none">{catalog.label}</span>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                                    {activeKpis}/{totalKpis}
                                  </Badge>
                                  {hasChartKpis && block.chartEnabled && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal gap-0.5" style={{ borderColor: `${catalog.accentColor}40`, color: catalog.accentColor }}>
                                      {block.chartType === "pie" ? <PieChart className="h-2.5 w-2.5" /> : <BarChart3 className="h-2.5 w-2.5" />}
                                      Gráfico
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <Switch checked={block.visible} onCheckedChange={() => toggleBlock(block.key)} />
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isExpanded && "rotate-180")} />
                                </Button>
                              </CollapsibleTrigger>
                            </div>
                            <CollapsibleContent>
                              <div className="px-4 pb-4 space-y-4">
                                <Separator />

                                {/* KPIs Section */}
                                <div>
                                  <div className="flex items-center gap-2 mb-2.5">
                                    <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Indicadores</span>
                                  </div>
                                  <div className="space-y-3">
                                    {Object.entries(kpiGroups).map(([group, kpis]) => (
                                      <div key={group}>
                                        {group !== "__default__" && (
                                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-1.5 ml-1">{group}</p>
                                        )}
                                        <div className="space-y-1">
                                          {kpis.map((kpiCatalog) => {
                                            const kpiPref = block.kpis.find((k) => k.key === kpiCatalog.key);
                                            return (
                                              <div key={kpiCatalog.key} className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-muted/50 transition-colors">
                                                <span className={cn("text-xs", kpiPref?.visible ? "text-foreground" : "text-muted-foreground line-through")}>{kpiCatalog.label}</span>
                                                <Switch
                                                  className="scale-75"
                                                  checked={kpiPref?.visible ?? true}
                                                  onCheckedChange={() => toggleKpi(block.key, kpiCatalog.key)}
                                                />
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Chart Section */}
                                {hasChartKpis && (
                                  <>
                                    <Separator />
                                    <div>
                                      <div className="flex items-center justify-between mb-2.5">
                                        <div className="flex items-center gap-2">
                                          <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Visualização</span>
                                        </div>
                                        <Switch checked={block.chartEnabled ?? false} onCheckedChange={() => toggleChart(block.key)} />
                                      </div>
                                      {block.chartEnabled && (
                                        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40">
                                          <ToggleGroup
                                            type="single"
                                            value={block.chartType === "none" ? undefined : block.chartType}
                                            onValueChange={(v) => { if (v) setChartType(block.key, v as "pie" | "bar"); }}
                                            variant="outline"
                                            size="sm"
                                            className="gap-1"
                                          >
                                            <ToggleGroupItem value="pie" className="gap-1.5 text-xs px-3 data-[state=on]:bg-background data-[state=on]:shadow-sm">
                                              <PieChart className="h-3.5 w-3.5" /> Pizza
                                            </ToggleGroupItem>
                                            <ToggleGroupItem value="bar" className="gap-1.5 text-xs px-3 data-[state=on]:bg-background data-[state=on]:shadow-sm">
                                              <BarChart3 className="h-3.5 w-3.5" /> Barras
                                            </ToggleGroupItem>
                                          </ToggleGroup>
                                          <div className="flex-1 flex justify-end">
                                            {block.chartType === "pie" ? (
                                              <PieChart className="h-8 w-8 text-muted-foreground/30" />
                                            ) : (
                                              <BarChart3 className="h-8 w-8 text-muted-foreground/30" />
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <DialogFooter className="flex-col gap-2 sm:flex-row mt-2">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={isResetting} className="gap-1.5 text-muted-foreground hover:text-destructive">
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar Padrão
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-1.5">
            {isSaving ? "Salvando..." : "Salvar Preferências"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
