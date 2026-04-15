// AdvancedFiltersPage.tsx — M02: Filtros Avançados + Views Customizáveis
// 3 tabs: Filtros | Views | Configuração

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Filter, Eye, Settings, Plus, Trash2, Save, Copy, Pin, PinOff,
  Share2, Star, StarOff, Play, X, GripVertical, ChevronDown, ChevronUp,
  List, LayoutGrid, Columns3, Table, Calendar, Search, RotateCcw,
  ArrowUpDown, Layers, Palette, SlidersHorizontal, Check
} from "lucide-react";
import {
  useFilters,
  useViews,
  useSaveFilter,
  useDeleteFilter,
  useSetDefaultFilter,
  useSaveView,
  useDeleteView,
  useSetDefaultView,
  useDuplicateView,
  getModuleFields,
  getOperatorsForField,
  getAllModules,
  getModuleLabel,
  getOperatorLabel,
  getLayoutLabel,
  getDensityLabel,
  buildQueryParts,
  type CrmModule,
  type FilterCondition,
  type FilterOperator,
  type LogicOperator,
  type ColumnConfig,
  type SortConfig,
  type ViewLayout,
  type RowDensity,
  type SavedFilter,
  type CustomView,
  type FieldDefinition,
} from "@/hooks/useAdvancedFilters";

// ============ MAIN PAGE ============

export default function AdvancedFiltersPage() {
  const [activeTab, setActiveTab] = useState("filters");
  const [selectedModule, setSelectedModule] = useState<CrmModule>("leads");

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SlidersHorizontal className="h-6 w-6 text-purple-500" />
            Filtros Avançados & Views
          </h1>
          <p className="text-muted-foreground mt-1">
            Crie filtros personalizados e views customizáveis para cada módulo do CRM
          </p>
        </div>
        {/* Module selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Módulo:</span>
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value as CrmModule)}
            className="border rounded-md px-3 py-2 text-sm bg-background"
          >
            {getAllModules().map((m) => (
              <option key={m} value={m}>{getModuleLabel(m)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="filters" className="flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtros
          </TabsTrigger>
          <TabsTrigger value="views" className="flex items-center gap-2">
            <Eye className="h-4 w-4" /> Views
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" /> Configuração
          </TabsTrigger>
        </TabsList>

        <TabsContent value="filters">
          <FiltersTab module={selectedModule} />
        </TabsContent>

        <TabsContent value="views">
          <ViewsTab module={selectedModule} />
        </TabsContent>

        <TabsContent value="config">
          <ConfigTab module={selectedModule} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ FILTERS TAB ============

function FiltersTab({ module }: { module: CrmModule }) {
  const { data: filters, isLoading } = useFilters(module);
  const saveFilter = useSaveFilter();
  const deleteFilter = useDeleteFilter();
  const setDefault = useSetDefaultFilter();

  const [isCreating, setIsCreating] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [filterDesc, setFilterDesc] = useState("");
  const [logicOp, setLogicOp] = useState<LogicOperator>("AND");
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<string | null>(null);

  const fields = getModuleFields(module);

  const addCondition = () => {
    const first = fields[0];
    if (!first) return;
    const ops = getOperatorsForField(module, first.field);
    setConditions([...conditions, {
      id: crypto.randomUUID(),
      field: first.field,
      operator: ops[0] || "equals",
      value: "",
    }]);
  };

  const updateCondition = (id: string, updates: Partial<FilterCondition>) => {
    setConditions(conditions.map((c) => c.id === id ? { ...c, ...updates } : c));
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter((c) => c.id !== id));
  };

  const handleSave = () => {
    if (!filterName.trim() || conditions.length === 0) return;
    saveFilter.mutate({
      id: editingId || undefined,
      name: filterName,
      description: filterDesc,
      module,
      conditions,
      logic_operator: logicOp,
    }, {
      onSuccess: () => {
        resetForm();
      },
    });
  };

  const handleEdit = (f: SavedFilter) => {
    setEditingId(f.id);
    setFilterName(f.name);
    setFilterDesc(f.description || "");
    setLogicOp(f.logic_operator);
    setConditions(f.conditions || []);
    setIsCreating(true);
  };

  const handlePreview = () => {
    const result = buildQueryParts(conditions, logicOp);
    setPreviewResult(result.description);
  };

  const resetForm = () => {
    setIsCreating(false);
    setEditingId(null);
    setFilterName("");
    setFilterDesc("");
    setLogicOp("AND");
    setConditions([]);
    setPreviewResult(null);
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{filters?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Filtros Salvos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{filters?.filter(f => f.is_shared).length || 0}</p>
            <p className="text-xs text-muted-foreground">Compartilhados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{filters?.filter(f => f.is_default).length || 0}</p>
            <p className="text-xs text-muted-foreground">Padrões</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{filters?.filter(f => f.is_pinned).length || 0}</p>
            <p className="text-xs text-muted-foreground">Fixados</p>
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit Filter */}
      {!isCreating ? (
        <Button onClick={() => setIsCreating(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Filtro
        </Button>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {editingId ? "Editar Filtro" : "Novo Filtro"} — {getModuleLabel(module)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Nome</label>
                <Input
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  placeholder="Ex: Leads quentes do mês"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Descrição (opcional)</label>
                <Input
                  value={filterDesc}
                  onChange={(e) => setFilterDesc(e.target.value)}
                  placeholder="Descrição do filtro"
                />
              </div>
            </div>

            {/* Logic operator */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Combinar condições com:</span>
              <Button
                variant={logicOp === "AND" ? "default" : "outline"}
                size="sm"
                onClick={() => setLogicOp("AND")}
              >E (AND)</Button>
              <Button
                variant={logicOp === "OR" ? "default" : "outline"}
                size="sm"
                onClick={() => setLogicOp("OR")}
              >OU (OR)</Button>
            </div>

            {/* Conditions */}
            <div className="space-y-2">
              {conditions.map((cond, idx) => (
                <ConditionRow
                  key={cond.id}
                  condition={cond}
                  fields={fields}
                  module={module}
                  index={idx}
                  logicOp={logicOp}
                  onUpdate={(updates) => updateCondition(cond.id, updates)}
                  onRemove={() => removeCondition(cond.id)}
                />
              ))}

              <Button variant="outline" size="sm" onClick={addCondition} className="gap-1">
                <Plus className="h-3 w-3" /> Adicionar Condição
              </Button>
            </div>

            {/* Preview */}
            {previewResult && (
              <div className="bg-muted p-3 rounded-md text-sm">
                <span className="font-medium">Preview: </span>{previewResult}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saveFilter.isPending || !filterName.trim() || conditions.length === 0} className="gap-1">
                <Save className="h-4 w-4" /> {saveFilter.isPending ? "Salvando..." : "Salvar Filtro"}
              </Button>
              <Button variant="outline" onClick={handlePreview} className="gap-1">
                <Play className="h-4 w-4" /> Preview
              </Button>
              <Button variant="ghost" onClick={resetForm} className="gap-1">
                <X className="h-4 w-4" /> Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saved Filters List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" /> Filtros Salvos — {getModuleLabel(module)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : !filters?.length ? (
            <p className="text-muted-foreground text-sm">Nenhum filtro salvo para {getModuleLabel(module)}</p>
          ) : (
            <div className="space-y-2">
              {filters.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    {f.is_pinned && <Pin className="h-4 w-4 text-blue-500" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{f.name}</span>
                        {f.is_default && <Badge variant="secondary" className="text-xs">Padrão</Badge>}
                        {f.is_shared && <Badge variant="outline" className="text-xs">Compartilhado</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {f.conditions?.length || 0} condições · {f.logic_operator} · Usado {f.use_count}x
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(f)} title="Editar">
                      <SlidersHorizontal className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => setDefault.mutate({ id: f.id, module })}
                      title="Definir como padrão"
                    >
                      {f.is_default ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => deleteFilter.mutate(f.id)}
                      title="Excluir"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============ CONDITION ROW ============

function ConditionRow({
  condition, fields, module, index, logicOp, onUpdate, onRemove,
}: {
  condition: FilterCondition;
  fields: FieldDefinition[];
  module: CrmModule;
  index: number;
  logicOp: LogicOperator;
  onUpdate: (updates: Partial<FilterCondition>) => void;
  onRemove: () => void;
}) {
  const operators = getOperatorsForField(module, condition.field);
  const currentField = fields.find((f) => f.field === condition.field);
  const needsValue2 = ["between", "date_between"].includes(condition.operator);
  const noValue = ["is_empty", "is_not_empty"].includes(condition.operator);

  return (
    <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
      {index > 0 && (
        <Badge variant="outline" className="text-xs shrink-0">{logicOp}</Badge>
      )}

      {/* Field */}
      <select
        value={condition.field}
        onChange={(e) => {
          const ops = getOperatorsForField(module, e.target.value);
          onUpdate({ field: e.target.value, operator: ops[0] || "equals", value: "" });
        }}
        className="border rounded px-2 py-1.5 text-sm bg-background min-w-[140px]"
      >
        {fields.map((f) => (
          <option key={f.field} value={f.field}>{f.label}</option>
        ))}
      </select>

      {/* Operator */}
      <select
        value={condition.operator}
        onChange={(e) => onUpdate({ operator: e.target.value as FilterOperator })}
        className="border rounded px-2 py-1.5 text-sm bg-background min-w-[120px]"
      >
        {operators.map((op) => (
          <option key={op} value={op}>{getOperatorLabel(op)}</option>
        ))}
      </select>

      {/* Value */}
      {!noValue && (
        <>
          {currentField?.type === "select" && currentField.options ? (
            condition.operator === "in" || condition.operator === "not_in" ? (
              <select
                multiple
                value={Array.isArray(condition.value) ? condition.value : []}
                onChange={(e) => {
                  const vals = Array.from(e.target.selectedOptions, (o) => o.value);
                  onUpdate({ value: vals });
                }}
                className="border rounded px-2 py-1.5 text-sm bg-background min-w-[140px] max-h-[80px]"
              >
                {currentField.options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : (
              <select
                value={condition.value || ""}
                onChange={(e) => onUpdate({ value: e.target.value })}
                className="border rounded px-2 py-1.5 text-sm bg-background min-w-[140px]"
              >
                <option value="">Selecione...</option>
                {currentField.options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            )
          ) : currentField?.type === "boolean" ? (
            <select
              value={condition.value?.toString() || ""}
              onChange={(e) => onUpdate({ value: e.target.value === "true" })}
              className="border rounded px-2 py-1.5 text-sm bg-background min-w-[100px]"
            >
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          ) : currentField?.type === "date" ? (
            <Input
              type={condition.operator === "date_last_n_days" ? "number" : "date"}
              value={condition.value || ""}
              onChange={(e) => onUpdate({ value: e.target.value })}
              className="min-w-[140px] text-sm"
              placeholder={condition.operator === "date_last_n_days" ? "Nº de dias" : ""}
            />
          ) : (
            <Input
              type={["number", "currency"].includes(currentField?.type || "") ? "number" : "text"}
              value={condition.value || ""}
              onChange={(e) => onUpdate({ value: e.target.value })}
              className="min-w-[140px] text-sm"
              placeholder="Valor"
            />
          )}

          {/* Value2 for between */}
          {needsValue2 && (
            <>
              <span className="text-xs text-muted-foreground">e</span>
              <Input
                type={currentField?.type === "date" ? "date" : "number"}
                value={condition.value2 || ""}
                onChange={(e) => onUpdate({ value2: e.target.value })}
                className="min-w-[140px] text-sm"
                placeholder="Valor 2"
              />
            </>
          )}
        </>
      )}

      <Button variant="ghost" size="sm" onClick={onRemove} className="text-destructive shrink-0">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ============ VIEWS TAB ============

function ViewsTab({ module }: { module: CrmModule }) {
  const { data: views, isLoading } = useViews(module);
  const { data: filters } = useFilters(module);
  const saveView = useSaveView();
  const deleteView = useDeleteView();
  const setDefault = useSetDefaultView();
  const duplicateView = useDuplicateView();

  const [isCreating, setIsCreating] = useState(false);
  const [viewName, setViewName] = useState("");
  const [viewDesc, setViewDesc] = useState("");
  const [layout, setLayout] = useState<ViewLayout>("list");
  const [density, setDensity] = useState<RowDensity>("comfortable");
  const [groupBy, setGroupBy] = useState("");
  const [filterId, setFilterId] = useState("");
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fields = getModuleFields(module);
  const layouts: ViewLayout[] = ["list", "grid", "kanban", "table", "calendar"];
  const densities: RowDensity[] = ["compact", "comfortable", "spacious"];

  const initColumns = useCallback(() => {
    setColumns(fields.map((f, i) => ({
      field: f.field,
      label: f.label,
      width: 150,
      visible: i < 6,
      order: i,
    })));
  }, [fields]);

  const handleNew = () => {
    setIsCreating(true);
    setEditingId(null);
    setViewName("");
    setViewDesc("");
    setLayout("list");
    setDensity("comfortable");
    setGroupBy("");
    setFilterId("");
    initColumns();
  };

  const handleEdit = (v: CustomView) => {
    setEditingId(v.id);
    setViewName(v.name);
    setViewDesc(v.description || "");
    setLayout(v.layout);
    setDensity(v.row_density);
    setGroupBy(v.group_by || "");
    setFilterId(v.filter_id || "");
    setColumns(v.columns?.length ? v.columns : fields.map((f, i) => ({
      field: f.field, label: f.label, width: 150, visible: i < 6, order: i,
    })));
    setIsCreating(true);
  };

  const toggleColumn = (field: string) => {
    setColumns(columns.map((c) => c.field === field ? { ...c, visible: !c.visible } : c));
  };

  const moveColumn = (field: string, direction: "up" | "down") => {
    const idx = columns.findIndex((c) => c.field === field);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= columns.length) return;
    const newCols = [...columns];
    [newCols[idx], newCols[newIdx]] = [newCols[newIdx], newCols[idx]];
    setColumns(newCols.map((c, i) => ({ ...c, order: i })));
  };

  const handleSave = () => {
    if (!viewName.trim()) return;
    saveView.mutate({
      id: editingId || undefined,
      name: viewName,
      description: viewDesc,
      module,
      columns: columns.filter((c) => c.visible),
      filter_id: filterId || undefined,
      group_by: groupBy || undefined,
      layout,
      row_density: density,
    }, {
      onSuccess: () => {
        setIsCreating(false);
        setEditingId(null);
      },
    });
  };

  const layoutIcons: Record<ViewLayout, React.ReactNode> = {
    list: <List className="h-4 w-4" />,
    grid: <LayoutGrid className="h-4 w-4" />,
    kanban: <Columns3 className="h-4 w-4" />,
    table: <Table className="h-4 w-4" />,
    calendar: <Calendar className="h-4 w-4" />,
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{views?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Views Salvas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{views?.filter(v => v.layout === "kanban").length || 0}</p>
            <p className="text-xs text-muted-foreground">Kanban</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{views?.filter(v => v.is_shared).length || 0}</p>
            <p className="text-xs text-muted-foreground">Compartilhadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{views?.filter(v => v.is_default).length || 0}</p>
            <p className="text-xs text-muted-foreground">Padrões</p>
          </CardContent>
        </Card>
      </div>

      {!isCreating ? (
        <Button onClick={handleNew} className="gap-2">
          <Plus className="h-4 w-4" /> Nova View
        </Button>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {editingId ? "Editar View" : "Nova View"} — {getModuleLabel(module)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name + Desc */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Nome</label>
                <Input value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="Ex: Pipeline Kanban" />
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Input value={viewDesc} onChange={(e) => setViewDesc(e.target.value)} placeholder="Descrição da view" />
              </div>
            </div>

            {/* Layout */}
            <div>
              <label className="text-sm font-medium mb-2 block">Layout</label>
              <div className="flex gap-2">
                {layouts.map((l) => (
                  <Button
                    key={l}
                    variant={layout === l ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLayout(l)}
                    className="gap-1"
                  >
                    {layoutIcons[l]} {getLayoutLabel(l)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Density */}
            <div>
              <label className="text-sm font-medium mb-2 block">Densidade</label>
              <div className="flex gap-2">
                {densities.map((d) => (
                  <Button
                    key={d}
                    variant={density === d ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDensity(d)}
                  >
                    {getDensityLabel(d)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Group By */}
            <div>
              <label className="text-sm font-medium">Agrupar por</label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="border rounded px-3 py-2 text-sm bg-background w-full"
              >
                <option value="">Sem agrupamento</option>
                {fields.map((f) => (
                  <option key={f.field} value={f.field}>{f.label}</option>
                ))}
              </select>
            </div>

            {/* Linked Filter */}
            <div>
              <label className="text-sm font-medium">Filtro vinculado</label>
              <select
                value={filterId}
                onChange={(e) => setFilterId(e.target.value)}
                className="border rounded px-3 py-2 text-sm bg-background w-full"
              >
                <option value="">Nenhum filtro</option>
                {filters?.map((f) => (
                  <option key={f.id} value={f.id}>{f.name} ({f.conditions?.length || 0} condições)</option>
                ))}
              </select>
            </div>

            {/* Columns */}
            <div>
              <label className="text-sm font-medium mb-2 block">Colunas visíveis</label>
              <div className="space-y-1 max-h-[300px] overflow-y-auto border rounded-md p-2">
                {columns.map((col) => (
                  <div key={col.field} className="flex items-center justify-between p-1.5 rounded hover:bg-muted/50">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleColumn(col.field)}
                        className={`h-5 w-5 rounded border flex items-center justify-center ${col.visible ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"}`}
                      >
                        {col.visible && <Check className="h-3 w-3" />}
                      </button>
                      <span className={`text-sm ${col.visible ? "" : "text-muted-foreground"}`}>{col.label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => moveColumn(col.field, "up")} className="h-6 w-6 p-0">
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => moveColumn(col.field, "down")} className="h-6 w-6 p-0">
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {columns.filter(c => c.visible).length} de {columns.length} colunas visíveis
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saveView.isPending || !viewName.trim()} className="gap-1">
                <Save className="h-4 w-4" /> {saveView.isPending ? "Salvando..." : "Salvar View"}
              </Button>
              <Button variant="ghost" onClick={() => { setIsCreating(false); setEditingId(null); }} className="gap-1">
                <X className="h-4 w-4" /> Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Views List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="h-5 w-5" /> Views Salvas — {getModuleLabel(module)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : !views?.length ? (
            <p className="text-muted-foreground text-sm">Nenhuma view salva para {getModuleLabel(module)}</p>
          ) : (
            <div className="space-y-2">
              {views.map((v) => (
                <div key={v.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-md bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                      {layoutIcons[v.layout]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{v.name}</span>
                        <Badge variant="outline" className="text-xs">{getLayoutLabel(v.layout)}</Badge>
                        {v.is_default && <Badge variant="secondary" className="text-xs">Padrão</Badge>}
                        {v.is_shared && <Badge variant="outline" className="text-xs">Compartilhada</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {v.columns?.length || 0} colunas · {getDensityLabel(v.row_density)}
                        {v.group_by ? ` · Agrupado: ${v.group_by}` : ""} · Usado {v.use_count}x
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(v)} title="Editar">
                      <SlidersHorizontal className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => duplicateView.mutate({ id: v.id })} title="Duplicar">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => setDefault.mutate({ id: v.id, module })}
                      title="Definir como padrão"
                    >
                      {v.is_default ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => deleteView.mutate(v.id)}
                      className="text-destructive hover:text-destructive"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============ CONFIG TAB ============

function ConfigTab({ module }: { module: CrmModule }) {
  const { data: filters } = useFilters(module);
  const { data: views } = useViews(module);
  const setDefaultFilter = useSetDefaultFilter();
  const setDefaultView = useSetDefaultView();

  const defaultFilter = filters?.find((f) => f.is_default);
  const defaultView = views?.find((v) => v.is_default);
  const fields = getModuleFields(module);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configurações — {getModuleLabel(module)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Default filter */}
          <div>
            <label className="text-sm font-medium block mb-2">Filtro padrão para {getModuleLabel(module)}</label>
            <select
              value={defaultFilter?.id || ""}
              onChange={(e) => {
                if (e.target.value) {
                  setDefaultFilter.mutate({ id: e.target.value, module });
                }
              }}
              className="border rounded px-3 py-2 text-sm bg-background w-full"
            >
              <option value="">Nenhum filtro padrão</option>
              {filters?.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              O filtro padrão será aplicado automaticamente ao abrir o módulo
            </p>
          </div>

          {/* Default view */}
          <div>
            <label className="text-sm font-medium block mb-2">View padrão para {getModuleLabel(module)}</label>
            <select
              value={defaultView?.id || ""}
              onChange={(e) => {
                if (e.target.value) {
                  setDefaultView.mutate({ id: e.target.value, module });
                }
              }}
              className="border rounded px-3 py-2 text-sm bg-background w-full"
            >
              <option value="">Nenhuma view padrão</option>
              {views?.map((v) => (
                <option key={v.id} value={v.id}>{v.name} ({getLayoutLabel(v.layout)})</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              A view padrão define o layout e colunas ao abrir o módulo
            </p>
          </div>

          {/* Module Info */}
          <div>
            <label className="text-sm font-medium block mb-2">Campos disponíveis em {getModuleLabel(module)}</label>
            <div className="flex flex-wrap gap-2">
              {fields.map((f) => (
                <Badge key={f.field} variant="outline" className="text-xs">
                  {f.label}
                  <span className="ml-1 text-muted-foreground">({f.type})</span>
                </Badge>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-medium mb-2">Resumo do módulo</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Filtros salvos</p>
                <p className="font-medium">{filters?.length || 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Views salvas</p>
                <p className="font-medium">{views?.length || 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Campos filtráveis</p>
                <p className="font-medium">{fields.length}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* All Modules Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5" /> Todos os Módulos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {getAllModules().map((m) => (
              <div key={m} className={`p-3 border rounded-lg text-center ${m === module ? "border-primary bg-primary/5" : ""}`}>
                <p className="font-medium text-sm">{getModuleLabel(m)}</p>
                <p className="text-xs text-muted-foreground">{getModuleFields(m).length} campos</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
