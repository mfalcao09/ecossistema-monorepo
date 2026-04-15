import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, RotateCcw, GripVertical, Save } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useMaintenanceCustomization } from "@/hooks/useMaintenanceCustomization";
import {
  getDefaultMaintenanceCustomization,
  stepTypeLabels,
  stepTypeColors,
  type MaintenanceCustomization,
  type InspectionPropertyType,
  type MaintenancePropertyType,
  type WorkflowStep,
  type WorkflowStepType,
} from "@/lib/maintenanceCustomizationDefaults";

export default function MaintenanceCustomizationTab() {
  const { config, isLoading, save, isSaving, reset, isResetting } = useMaintenanceCustomization();
  const [local, setLocal] = useState<MaintenanceCustomization | null>(null);
  const [dirty, setDirty] = useState(false);
  const [subTab, setSubTab] = useState("vistorias");

  // New type dialogs
  const [newPropTypeDialog, setNewPropTypeDialog] = useState<{ section: "inspection" | "maintenance" } | null>(null);
  const [newPropTypeKey, setNewPropTypeKey] = useState("");
  const [newPropTypeLabel, setNewPropTypeLabel] = useState("");

  // New workflow step dialog
  const [newStepDialog, setNewStepDialog] = useState(false);
  const [newStep, setNewStep] = useState({ name: "", type: "operacional" as WorkflowStepType, required: false, description: "" });

  const current = local ?? config;

  function update(fn: (draft: MaintenanceCustomization) => void) {
    const clone = JSON.parse(JSON.stringify(current)) as MaintenanceCustomization;
    fn(clone);
    setLocal(clone);
    setDirty(true);
  }

  async function handleSave() {
    if (!local) return;
    await save(local);
    setDirty(false);
    setLocal(null);
  }

  async function handleReset() {
    await reset();
    setLocal(null);
    setDirty(false);
  }

  function handleRestoreSection(section: "inspection" | "maintenance" | "workflow") {
    const defaults = getDefaultMaintenanceCustomization();
    update((d) => {
      if (section === "inspection") d.inspection_templates = defaults.inspection_templates;
      else if (section === "maintenance") d.maintenance_types = defaults.maintenance_types;
      else d.key_delivery_workflow = defaults.key_delivery_workflow;
    });
  }

  // ---- ADD PROPERTY TYPE ----
  function handleAddPropertyType() {
    if (!newPropTypeKey.trim() || !newPropTypeLabel.trim()) return;
    const key = newPropTypeKey.trim().toLowerCase().replace(/\s+/g, "_");
    update((d) => {
      if (newPropTypeDialog?.section === "inspection") {
        d.inspection_templates[key] = { label: newPropTypeLabel.trim(), categories: [] };
      } else {
        d.maintenance_types[key] = { label: newPropTypeLabel.trim(), categories: [] };
      }
    });
    setNewPropTypeDialog(null);
    setNewPropTypeKey("");
    setNewPropTypeLabel("");
  }

  // ---- ADD WORKFLOW STEP ----
  function handleAddStep() {
    if (!newStep.name.trim()) return;
    const steps = current.key_delivery_workflow.steps;
    const id = newStep.name.trim().toLowerCase().replace(/\s+/g, "_") + "_" + Date.now();
    update((d) => {
      d.key_delivery_workflow.steps.push({
        id,
        name: newStep.name.trim(),
        type: newStep.type,
        required: newStep.required,
        description: newStep.description.trim(),
        order: steps.length + 1,
      });
    });
    setNewStepDialog(false);
    setNewStep({ name: "", type: "operacional", required: false, description: "" });
  }

  // ---- DRAG DROP for workflow ----
  function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    update((d) => {
      const [moved] = d.key_delivery_workflow.steps.splice(result.source.index, 1);
      d.key_delivery_workflow.steps.splice(result.destination!.index, 0, moved);
      d.key_delivery_workflow.steps.forEach((s, i) => (s.order = i + 1));
    });
  }

  if (isLoading) return <div className="py-12 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Configure os modelos de vistoria, tipos de manutenção e o fluxo de entrega de chaves.</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={isResetting}>
            <RotateCcw className="h-4 w-4 mr-1" /> Restaurar Tudo
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty || isSaving}>
            <Save className="h-4 w-4 mr-1" /> {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          <TabsTrigger value="vistorias">Vistorias</TabsTrigger>
          <TabsTrigger value="manutencoes">Manutenções</TabsTrigger>
          <TabsTrigger value="chaves">Entrega de Chaves</TabsTrigger>
        </TabsList>

        {/* ===================== VISTORIAS ===================== */}
        <TabsContent value="vistorias" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Templates de Vistoria por Tipo de Imóvel</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleRestoreSection("inspection")}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar Padrão
              </Button>
              <Button variant="outline" size="sm" onClick={() => setNewPropTypeDialog({ section: "inspection" })}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Novo Tipo de Imóvel
              </Button>
            </div>
          </div>

          <Accordion type="multiple" className="space-y-2">
            {Object.entries(current.inspection_templates).map(([typeKey, propType]) => (
              <AccordionItem key={typeKey} value={typeKey} className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{propType.label}</span>
                    <Badge variant="secondary" className="text-xs">{propType.categories.length} categorias</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
                  {/* Delete property type button */}
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => update((d) => delete d.inspection_templates[typeKey])}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover tipo
                    </Button>
                  </div>

                  {propType.categories.map((cat, catIdx) => (
                    <Card key={catIdx}>
                      <CardHeader className="py-3 px-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{cat.name}</CardTitle>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => update((d) => d.inspection_templates[typeKey].categories.splice(catIdx, 1))}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="px-4 pb-3 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {cat.items.map((item, itemIdx) => (
                            <Badge key={itemIdx} variant="outline" className="gap-1 pr-1">
                              {item.name}
                              <button className="ml-1 hover:text-destructive" onClick={() => update((d) => d.inspection_templates[typeKey].categories[catIdx].items.splice(itemIdx, 1))}>
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                        <AddInlineItem onAdd={(name) => update((d) => d.inspection_templates[typeKey].categories[catIdx].items.push({ name, has_condition: true }))} placeholder="Novo item..." />
                      </CardContent>
                    </Card>
                  ))}

                  <AddInlineItem onAdd={(name) => update((d) => d.inspection_templates[typeKey].categories.push({ name, items: [] }))} placeholder="Nova categoria..." buttonLabel="Adicionar Categoria" />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        {/* ===================== MANUTENÇÕES ===================== */}
        <TabsContent value="manutencoes" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Tipos de Manutenção por Tipo de Imóvel</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleRestoreSection("maintenance")}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar Padrão
              </Button>
              <Button variant="outline" size="sm" onClick={() => setNewPropTypeDialog({ section: "maintenance" })}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Novo Tipo de Imóvel
              </Button>
            </div>
          </div>

          <Accordion type="multiple" className="space-y-2">
            {Object.entries(current.maintenance_types).map(([typeKey, propType]) => (
              <AccordionItem key={typeKey} value={typeKey} className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{propType.label}</span>
                    <Badge variant="secondary" className="text-xs">{propType.categories.length} categorias</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => update((d) => delete d.maintenance_types[typeKey])}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover tipo
                    </Button>
                  </div>

                  {propType.categories.map((cat, catIdx) => (
                    <Card key={catIdx}>
                      <CardHeader className="py-3 px-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{cat.name}</CardTitle>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => update((d) => d.maintenance_types[typeKey].categories.splice(catIdx, 1))}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="px-4 pb-3 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {cat.services.map((svc, svcIdx) => (
                            <Badge key={svcIdx} variant="outline" className="gap-1 pr-1">
                              {svc}
                              <button className="ml-1 hover:text-destructive" onClick={() => update((d) => d.maintenance_types[typeKey].categories[catIdx].services.splice(svcIdx, 1))}>
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                        <AddInlineItem onAdd={(name) => update((d) => d.maintenance_types[typeKey].categories[catIdx].services.push(name))} placeholder="Novo serviço..." />
                      </CardContent>
                    </Card>
                  ))}

                  <AddInlineItem onAdd={(name) => update((d) => d.maintenance_types[typeKey].categories.push({ name, services: [] }))} placeholder="Nova categoria..." buttonLabel="Adicionar Categoria" />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        {/* ===================== ENTREGA DE CHAVES ===================== */}
        <TabsContent value="chaves" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Fluxo de Entrega de Chaves</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleRestoreSection("workflow")}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar Padrão
              </Button>
              <Button variant="outline" size="sm" onClick={() => setNewStepDialog(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Nova Etapa
              </Button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">Arraste para reordenar. Etapas obrigatórias bloqueiam o avanço do fluxo.</p>

          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="workflow-steps">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                  {current.key_delivery_workflow.steps.map((step, idx) => (
                    <Draggable key={step.id} draggableId={step.id} index={idx}>
                      {(prov, snapshot) => (
                        <Card ref={prov.innerRef} {...prov.draggableProps} className={snapshot.isDragging ? "shadow-lg" : ""}>
                          <CardContent className="flex items-center gap-3 py-3 px-4">
                            <div {...prov.dragHandleProps} className="cursor-grab">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <span className="text-sm font-medium text-muted-foreground w-6">{idx + 1}.</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{step.name}</span>
                                <Badge className={stepTypeColors[step.type] + " text-xs"}>{stepTypeLabels[step.type]}</Badge>
                                {step.required && <Badge variant="destructive" className="text-xs">Obrigatório</Badge>}
                              </div>
                              {step.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{step.description}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1.5">
                                <Label className="text-xs text-muted-foreground">Obrig.</Label>
                                <Switch checked={step.required} onCheckedChange={(v) => update((d) => { d.key_delivery_workflow.steps[idx].required = v; })} />
                              </div>
                              <Select value={step.type} onValueChange={(v: WorkflowStepType) => update((d) => { d.key_delivery_workflow.steps[idx].type = v; })}>
                                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Object.entries(stepTypeLabels).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>{v}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => update((d) => { d.key_delivery_workflow.steps.splice(idx, 1); d.key_delivery_workflow.steps.forEach((s, i) => (s.order = i + 1)); })}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </TabsContent>
      </Tabs>

      {/* ---- New Property Type Dialog ---- */}
      <Dialog open={!!newPropTypeDialog} onOpenChange={(o) => !o && setNewPropTypeDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Novo Tipo de Imóvel</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Identificador (slug)</Label>
              <Input value={newPropTypeKey} onChange={(e) => setNewPropTypeKey(e.target.value)} placeholder="ex: rural" />
            </div>
            <div className="space-y-1.5">
              <Label>Nome de Exibição</Label>
              <Input value={newPropTypeLabel} onChange={(e) => setNewPropTypeLabel(e.target.value)} placeholder="ex: Rural/Fazenda" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewPropTypeDialog(null)}>Cancelar</Button>
            <Button onClick={handleAddPropertyType} disabled={!newPropTypeKey.trim() || !newPropTypeLabel.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- New Workflow Step Dialog ---- */}
      <Dialog open={newStepDialog} onOpenChange={setNewStepDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nova Etapa do Fluxo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome da Etapa *</Label>
              <Input value={newStep.name} onChange={(e) => setNewStep({ ...newStep, name: e.target.value })} placeholder="Ex: Verificação de Documentos" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={newStep.type} onValueChange={(v: WorkflowStepType) => setNewStep({ ...newStep, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(stepTypeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex items-end">
                <div className="flex items-center gap-2 pb-1">
                  <Switch checked={newStep.required} onCheckedChange={(v) => setNewStep({ ...newStep, required: v })} />
                  <Label>Obrigatório</Label>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição/Instruções</Label>
              <Textarea value={newStep.description} onChange={(e) => setNewStep({ ...newStep, description: e.target.value })} rows={2} placeholder="Instruções para esta etapa..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewStepDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddStep} disabled={!newStep.name.trim()}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Inline "Add" component ----
function AddInlineItem({ onAdd, placeholder, buttonLabel }: { onAdd: (name: string) => void; placeholder: string; buttonLabel?: string }) {
  const [value, setValue] = useState("");

  function submit() {
    if (!value.trim()) return;
    onAdd(value.trim());
    setValue("");
  }

  return (
    <div className="flex items-center gap-2">
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="h-8 text-sm" onKeyDown={(e) => e.key === "Enter" && submit()} />
      <Button variant="outline" size="sm" onClick={submit} disabled={!value.trim()}>
        <Plus className="h-3.5 w-3.5 mr-1" /> {buttonLabel || "Adicionar"}
      </Button>
    </div>
  );
}
