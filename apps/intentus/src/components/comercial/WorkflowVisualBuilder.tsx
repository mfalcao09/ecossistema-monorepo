/**
 * WorkflowVisualBuilder — Editor visual drag-and-drop para criar automações.
 * Integra com useWorkflowBuilder + useCreateAutomation.
 */

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useWorkflowBuilder,
  NODE_TYPE_COLORS,
  NODE_TYPE_ICON_COLORS,
  NODE_TYPE_LABELS,
  type WorkflowNode,
  type NodeType,
} from "@/hooks/useWorkflowBuilder";
import {
  useCreateAutomation,
  TRIGGER_OPTIONS,
  ACTION_OPTIONS,
  TRIGGER_LABELS,
  ACTION_LABELS,
  type TriggerEvent,
  type ActionType,
} from "@/hooks/useCommercialAutomationEngine";
import {
  Zap,
  Plus,
  Trash2,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Clock,
  Target,
  Bell,
  Mail,
  ArrowRightLeft,
  UserPlus,
  PenLine,
  Webhook,
  ClipboardList,
  Loader2,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

// ─── Icon mapping ────────────────────────────────────────────────────────────

const ACTION_ICON_MAP: Record<string, LucideIcon> = {
  tarefa: ClipboardList,
  notificacao: Bell,
  lembrete: Clock,
  email: Mail,
  mover_deal: ArrowRightLeft,
  atribuir_responsavel: UserPlus,
  atualizar_campo: PenLine,
  webhook: Webhook,
};

const NODE_ICON_MAP: Record<NodeType, LucideIcon> = {
  trigger: Zap,
  condition: Target,
  action: CheckCircle2,
  delay: Clock,
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface WorkflowVisualBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function WorkflowVisualBuilder({ open, onOpenChange }: WorkflowVisualBuilderProps) {
  const builder = useWorkflowBuilder();
  const createAutomation = useCreateAutomation();
  const [addingType, setAddingType] = useState<NodeType | null>(null);

  const handleSave = useCallback(() => {
    const params = builder.toCreateParams();
    if (!params) {
      toast.error("Workflow incompleto — adicione gatilho e pelo menos uma ação");
      return;
    }
    createAutomation.mutate(params, {
      onSuccess: () => {
        builder.clearAll();
        onOpenChange(false);
      },
    });
  }, [builder, createAutomation, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Workflow Visual Builder
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Arraste e organize os blocos para criar sua automação visual. O gatilho inicia o fluxo, e as ações são executadas em sequência.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4 space-y-4">
            {/* ── Name + Description ──────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome da automação *</Label>
                <Input
                  value={builder.state.name}
                  onChange={(e) => builder.setName(e.target.value)}
                  placeholder="Ex: Follow-up pós-visita"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Descrição</Label>
                <Input
                  value={builder.state.description}
                  onChange={(e) => builder.setDescription(e.target.value)}
                  placeholder="Opcional"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* ── Workflow Canvas ─────────────────────────────── */}
            <div className="border rounded-lg bg-muted/20 p-4 min-h-[300px]">
              {builder.state.nodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Zap className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium">Comece adicionando um gatilho</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    O gatilho define quando a automação será disparada
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 gap-1.5"
                    onClick={() => setAddingType("trigger")}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Adicionar Gatilho
                  </Button>
                </div>
              ) : (
                <div className="space-y-0">
                  {builder.state.nodes.map((node, index) => (
                    <div key={node.id}>
                      <WorkflowNodeCard
                        node={node}
                        index={index}
                        total={builder.state.nodes.length}
                        onRemove={() => builder.removeNode(node.id)}
                        onMoveUp={() => index > 1 && builder.moveNode(index, index - 1)}
                        onMoveDown={() => index < builder.state.nodes.length - 1 && builder.moveNode(index, index + 1)}
                        onUpdate={(updates) => builder.updateNode(node.id, updates)}
                      />
                      {/* Connector line */}
                      {index < builder.state.nodes.length - 1 && (
                        <div className="flex justify-center py-1">
                          <div className="flex flex-col items-center">
                            <div className="w-px h-4 bg-border" />
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground -my-0.5" />
                            <div className="w-px h-4 bg-border" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add node buttons */}
                  <div className="flex justify-center pt-3">
                    <div className="flex flex-col items-center">
                      <div className="w-px h-4 bg-border" />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => setAddingType("action")}
                        >
                          <Plus className="h-3 w-3" /> Ação
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => setAddingType("delay")}
                        >
                          <Clock className="h-3 w-3" /> Atraso
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Summary ─────────────────────────────────────── */}
            {builder.state.nodes.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">
                  {builder.state.nodes.filter((n) => n.type === "trigger").length} gatilho
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {builder.state.nodes.filter((n) => n.type === "action").length} ações
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {builder.state.nodes.filter((n) => n.type === "delay").length} atrasos
                </Badge>
                {builder.isValid && (
                  <Badge className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    Workflow válido
                  </Badge>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* ── Footer ──────────────────────────────────────── */}
        <DialogFooter className="px-6 py-3 border-t gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => { builder.clearAll(); }}>
            Limpar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!builder.isValid || createAutomation.isPending}
            className="gap-1.5"
          >
            {createAutomation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Criar Automação
          </Button>
        </DialogFooter>

        {/* ── Add Node Dialog ─────────────────────────────── */}
        <AddNodeDialog
          type={addingType}
          onClose={() => setAddingType(null)}
          onAddTrigger={(trigger) => {
            builder.addTriggerNode(trigger);
            setAddingType(null);
          }}
          onAddAction={(action, config) => {
            builder.addActionNode(action, config);
            setAddingType(null);
          }}
          onAddDelay={(minutes) => {
            builder.addDelayNode(minutes);
            setAddingType(null);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

// ─── Workflow Node Card ──────────────────────────────────────────────────────

function WorkflowNodeCard({
  node,
  index,
  total,
  onRemove,
  onMoveUp,
  onMoveDown,
  onUpdate,
}: {
  node: WorkflowNode;
  index: number;
  total: number;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdate: (updates: Partial<WorkflowNode>) => void;
}) {
  const Icon = node.type === "action" && node.actionType
    ? ACTION_ICON_MAP[node.actionType] || CheckCircle2
    : NODE_ICON_MAP[node.type];

  const isTrigger = node.type === "trigger";

  return (
    <Card className={`border-2 ${NODE_TYPE_COLORS[node.type]} transition-all hover:shadow-md`}>
      <CardContent className="p-3 flex items-center gap-3">
        {/* Icon */}
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${NODE_TYPE_COLORS[node.type]}`}>
          <Icon className={`h-4 w-4 ${NODE_TYPE_ICON_COLORS[node.type]}`} />
        </div>

        {/* Label + details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[9px] px-1">
              {NODE_TYPE_LABELS[node.type]}
            </Badge>
            <span className="text-sm font-medium truncate">{node.label}</span>
          </div>
          {node.type === "action" && node.actionType && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {ACTION_LABELS[node.actionType]}
            </p>
          )}
          {node.type === "delay" && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Aguardar {node.delayMinutes}min antes da próxima ação
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          {!isTrigger && index > 1 && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveUp}>
              <ArrowUp className="h-3 w-3" />
            </Button>
          )}
          {!isTrigger && index < total - 1 && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveDown}>
              <ArrowDown className="h-3 w-3" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onRemove}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Add Node Dialog ─────────────────────────────────────────────────────────

function AddNodeDialog({
  type,
  onClose,
  onAddTrigger,
  onAddAction,
  onAddDelay,
}: {
  type: NodeType | null;
  onClose: () => void;
  onAddTrigger: (trigger: TriggerEvent) => void;
  onAddAction: (action: ActionType, config?: Record<string, unknown>) => void;
  onAddDelay: (minutes: number) => void;
}) {
  const [selectedTrigger, setSelectedTrigger] = useState<string>("");
  const [selectedAction, setSelectedAction] = useState<string>("");
  const [delayMinutes, setDelayMinutes] = useState(60);
  const [actionMessage, setActionMessage] = useState("");

  if (!type) return null;

  const handleConfirm = () => {
    if (type === "trigger" && selectedTrigger) {
      onAddTrigger(selectedTrigger as TriggerEvent);
    } else if (type === "action" && selectedAction) {
      const config: Record<string, unknown> = {};
      if (actionMessage) config.message = actionMessage;
      onAddAction(selectedAction as ActionType, config);
    } else if (type === "delay") {
      onAddDelay(delayMinutes);
    }
    // Reset state
    setSelectedTrigger("");
    setSelectedAction("");
    setDelayMinutes(60);
    setActionMessage("");
  };

  return (
    <Dialog open={!!type} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            Adicionar {NODE_TYPE_LABELS[type]}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {type === "trigger" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Quando disparar?</Label>
              <Select value={selectedTrigger} onValueChange={setSelectedTrigger}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione o gatilho" />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "action" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Qual ação executar?</Label>
                <Select value={selectedAction} onValueChange={setSelectedAction}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione a ação" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedAction && ["tarefa", "notificacao", "lembrete", "email"].includes(selectedAction) && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Mensagem</Label>
                  <Textarea
                    value={actionMessage}
                    onChange={(e) => setActionMessage(e.target.value)}
                    placeholder="Texto da tarefa, notificação ou email..."
                    rows={2}
                    className="text-sm"
                  />
                </div>
              )}
            </>
          )}

          {type === "delay" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Tempo de espera (minutos)</Label>
              <div className="flex gap-2">
                {[30, 60, 240, 1440, 4320, 10080].map((mins) => (
                  <Button
                    key={mins}
                    size="sm"
                    variant={delayMinutes === mins ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => setDelayMinutes(mins)}
                  >
                    {mins < 60 ? `${mins}min` : mins < 1440 ? `${mins / 60}h` : `${mins / 1440}d`}
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(Math.max(1, parseInt(e.target.value) || 60))}
                className="h-8 text-sm w-32"
                min={1}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={
              (type === "trigger" && !selectedTrigger) ||
              (type === "action" && !selectedAction)
            }
          >
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
