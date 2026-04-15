/**
 * ApprovalRulesManager — Interface CRUD para regras de aprovação
 *
 * Épico 2 — CLM Fase 2
 *
 * Funcionalidades:
 * - Listar regras de aprovação em tabela
 * - Criar nova regra via dialog
 * - Editar regra existente
 * - Ativar/desativar regra
 * - Visualizar steps de aprovação de cada regra
 *
 * Padrão shadcn/ui + react-hook-form style manual
 */

import { useState } from "react";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Users,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useContractApprovalRules,
  useCreateApprovalRule,
  useUpdateApprovalRule,
  useDeleteApprovalRule,
  type ContractApprovalRule,
  type ApproverStep,
  type CreateApprovalRuleInput,
} from "@/hooks/useContractApprovalRules";

// ── Constantes ──────────────────────────────────────────────────────────

const CONTRACT_TYPES = [
  { value: "venda", label: "Venda" },
  { value: "locacao", label: "Locação" },
  { value: "administracao", label: "Administração" },
  { value: "distrato", label: "Distrato" },
  { value: "prestacao_servicos", label: "Prest. Serviços" },
  { value: "obra", label: "Obra" },
  { value: "comissao", label: "Comissão" },
  { value: "fornecimento", label: "Fornecimento" },
  { value: "aditivo", label: "Aditivo" },
  { value: "cessao", label: "Cessão" },
  { value: "nda", label: "NDA" },
  { value: "exclusividade", label: "Exclusividade" },
];

const ROLES = [
  { value: "gerente", label: "Gerente" },
  { value: "juridico", label: "Jurídico" },
  { value: "admin", label: "Diretoria/Admin" },
  { value: "financeiro", label: "Financeiro" },
  { value: "comercial", label: "Comercial" },
];

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  CONTRACT_TYPES.map((t) => [t.value, t.label])
);

// ── Formatação ──────────────────────────────────────────────────────────

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(value);
}

// ── Estado do formulário ────────────────────────────────────────────────

interface RuleFormState {
  name: string;
  description: string;
  contract_types: string[];
  min_value: string;
  max_value: string;
  require_all: boolean;
  is_active: boolean;
  priority: string;
  approvers: ApproverStep[];
}

const EMPTY_FORM: RuleFormState = {
  name: "",
  description: "",
  contract_types: [],
  min_value: "",
  max_value: "",
  require_all: true,
  is_active: true,
  priority: "0",
  approvers: [
    { role: "gerente", step_name: "Aprovação Gerente", step_order: 1, deadline_hours: 48 },
  ],
};

function ruleToForm(rule: ContractApprovalRule): RuleFormState {
  return {
    name: rule.name,
    description: rule.description || "",
    contract_types: rule.contract_types || [],
    min_value: rule.min_value !== null ? String(rule.min_value) : "",
    max_value: rule.max_value !== null ? String(rule.max_value) : "",
    require_all: rule.require_all,
    is_active: rule.is_active,
    priority: String(rule.priority),
    approvers: rule.approvers.length > 0
      ? rule.approvers
      : [{ role: "gerente", step_name: "Aprovação Gerente", step_order: 1, deadline_hours: 48 }],
  };
}

// ── Componente Principal ────────────────────────────────────────────────

export default function ApprovalRulesManager() {
  const { toast } = useToast();
  const { checkAutoComplete } = useOnboardingProgress();
  const { data: rules, isLoading } = useContractApprovalRules(false);
  const createMutation = useCreateApprovalRule();
  const updateMutation = useUpdateApprovalRule();
  const deleteMutation = useDeleteApprovalRule();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ContractApprovalRule | null>(null);
  const [form, setForm] = useState<RuleFormState>(EMPTY_FORM);
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);

  // ── Handlers ──────────────────────────────────────────────────────

  function handleNew() {
    setEditingRule(null);
    setForm(EMPTY_FORM);
    setIsDialogOpen(true);
  }

  function handleEdit(rule: ContractApprovalRule) {
    setEditingRule(rule);
    setForm(ruleToForm(rule));
    setIsDialogOpen(true);
  }

  function handleToggleActive(rule: ContractApprovalRule) {
    updateMutation.mutate(
      { id: rule.id, is_active: !rule.is_active },
      {
        onSuccess: () => {
          toast({
            title: rule.is_active ? "Regra desativada" : "Regra ativada",
            description: `"${rule.name}" foi ${rule.is_active ? "desativada" : "ativada"}.`,
          });
        },
        onError: (error) => {
          toast({
            title: "Erro",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  }

  function handleDelete(rule: ContractApprovalRule) {
    if (!confirm(`Tem certeza que deseja excluir a regra "${rule.name}"?`)) return;

    deleteMutation.mutate(rule.id, {
      onSuccess: () => {
        toast({
          title: "Regra excluída",
          description: `"${rule.name}" foi desativada com sucesso.`,
        });
      },
      onError: (error) => {
        toast({
          title: "Erro",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  }

  function handleSave() {
    // Validação
    if (!form.name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    if (form.approvers.length === 0) {
      toast({
        title: "Adicione pelo menos um aprovador",
        variant: "destructive",
      });
      return;
    }

    const payload: CreateApprovalRuleInput = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      contract_types: form.contract_types,
      min_value: form.min_value ? Number(form.min_value) : null,
      max_value: form.max_value ? Number(form.max_value) : null,
      approvers: form.approvers,
      require_all: form.require_all,
      is_active: form.is_active,
      priority: Number(form.priority) || 0,
    };

    if (editingRule) {
      // Atualizar
      updateMutation.mutate(
        { id: editingRule.id, ...payload },
        {
          onSuccess: () => {
            toast({ title: "Regra atualizada com sucesso" });
            // Wire onboarding: mark approval configuration as complete
            checkAutoComplete("approval_configured");
            setIsDialogOpen(false);
          },
          onError: (error) => {
            toast({
              title: "Erro ao atualizar",
              description: error.message,
              variant: "destructive",
            });
          },
        }
      );
    } else {
      // Criar
      createMutation.mutate(payload, {
        onSuccess: () => {
          toast({ title: "Regra criada com sucesso" });
          // Wire onboarding: mark approval configuration as complete
          checkAutoComplete("approval_configured");
          setIsDialogOpen(false);
        },
        onError: (error) => {
          toast({
            title: "Erro ao criar",
            description: error.message,
            variant: "destructive",
          });
        },
      });
    }
  }

  // ── Handlers de steps ─────────────────────────────────────────────

  function addApproverStep() {
    const nextOrder = form.approvers.length + 1;
    setForm({
      ...form,
      approvers: [
        ...form.approvers,
        {
          role: "gerente",
          step_name: `Aprovação Step ${nextOrder}`,
          step_order: nextOrder,
          deadline_hours: 48,
        },
      ],
    });
  }

  function removeApproverStep(index: number) {
    const newApprovers = form.approvers
      .filter((_, i) => i !== index)
      .map((step, i) => ({ ...step, step_order: i + 1 }));
    setForm({ ...form, approvers: newApprovers });
  }

  function updateApproverStep(
    index: number,
    field: keyof ApproverStep,
    value: string | number
  ) {
    const newApprovers = [...form.approvers];
    newApprovers[index] = { ...newApprovers[index], [field]: value };

    // Auto-gerar step_name quando role muda
    if (field === "role") {
      const roleLabel = ROLES.find((r) => r.value === value)?.label || value;
      newApprovers[index].step_name = `Aprovação ${roleLabel}`;
    }

    setForm({ ...form, approvers: newApprovers });
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Shield className="h-4.5 w-4.5 text-primary" />
            Regras de Aprovação
          </CardTitle>
          <Button size="sm" onClick={handleNew} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Nova Regra
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Configure quais contratos precisam de aprovação e por quem.
        </p>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !rules || rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhuma regra de aprovação configurada.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={handleNew}
            >
              Criar primeira regra
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px]" />
                <TableHead>Nome</TableHead>
                <TableHead>Faixa de Valor</TableHead>
                <TableHead>Aprovadores</TableHead>
                <TableHead className="text-center">Prioridade</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <>
                  <TableRow
                    key={rule.id}
                    className={`cursor-pointer ${!rule.is_active ? "opacity-50" : ""}`}
                    onClick={() =>
                      setExpandedRuleId(
                        expandedRuleId === rule.id ? null : rule.id
                      )
                    }
                  >
                    <TableCell>
                      {expandedRuleId === rule.id ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {rule.name}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatCurrency(rule.min_value)} —{" "}
                      {rule.max_value
                        ? formatCurrency(rule.max_value)
                        : "Sem limite"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">
                          {rule.approvers.length} step
                          {rule.approvers.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs">
                        {rule.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {rule.is_active ? (
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          Ativa
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Inativa
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEdit(rule)}
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleToggleActive(rule)}
                          title={rule.is_active ? "Desativar" : "Ativar"}
                        >
                          {rule.is_active ? (
                            <XCircle className="h-3.5 w-3.5 text-orange-500" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDelete(rule)}
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Linha expandida: detalhes dos steps */}
                  {expandedRuleId === rule.id && (
                    <TableRow key={`${rule.id}-detail`}>
                      <TableCell colSpan={7} className="bg-muted/30 p-4">
                        <div className="space-y-2">
                          {rule.description && (
                            <p className="text-xs text-muted-foreground mb-3">
                              {rule.description}
                            </p>
                          )}

                          {rule.contract_types.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap mb-2">
                              <span className="text-xs text-muted-foreground">
                                Tipos:
                              </span>
                              {rule.contract_types.map((type) => (
                                <Badge
                                  key={type}
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {TYPE_LABELS[type] || type}
                                </Badge>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-1.5 mb-3">
                            <span className="text-xs text-muted-foreground">
                              Modo:
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px]"
                            >
                              {rule.require_all
                                ? "Todos devem aprovar"
                                : "Qualquer um pode aprovar"}
                            </Badge>
                          </div>

                          <p className="text-xs font-medium mb-2">
                            Steps de aprovação:
                          </p>
                          <div className="space-y-1.5">
                            {rule.approvers
                              .sort((a, b) => a.step_order - b.step_order)
                              .map((step, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-3 bg-background rounded px-3 py-2 border"
                                >
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] min-w-[24px] justify-center"
                                  >
                                    {step.step_order}
                                  </Badge>
                                  <span className="text-sm font-medium flex-1">
                                    {step.step_name}
                                  </span>
                                  <Badge variant="outline" className="text-[10px]">
                                    {ROLES.find((r) => r.value === step.role)
                                      ?.label || step.role}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    Prazo: {step.deadline_hours}h
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* ══ DIALOG: Criar/Editar Regra ══ */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Editar Regra de Aprovação" : "Nova Regra de Aprovação"}
            </DialogTitle>
            <DialogDescription>
              Configure quando e por quem os contratos devem ser aprovados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="rule-name">Nome da Regra *</Label>
              <Input
                id="rule-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Aprovação para contratos acima de R$ 100.000"
              />
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label htmlFor="rule-desc">Descrição</Label>
              <Textarea
                id="rule-desc"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Descreva quando esta regra se aplica..."
                rows={2}
              />
            </div>

            {/* Faixa de valor */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rule-min">Valor mínimo (R$)</Label>
                <Input
                  id="rule-min"
                  type="number"
                  value={form.min_value}
                  onChange={(e) =>
                    setForm({ ...form, min_value: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rule-max">Valor máximo (R$)</Label>
                <Input
                  id="rule-max"
                  type="number"
                  value={form.max_value}
                  onChange={(e) =>
                    setForm({ ...form, max_value: e.target.value })
                  }
                  placeholder="Sem limite"
                />
              </div>
            </div>

            {/* Tipos de contrato */}
            <div className="space-y-1.5">
              <Label>Tipos de contrato (vazio = todos)</Label>
              <div className="flex flex-wrap gap-1.5">
                {CONTRACT_TYPES.map((type) => {
                  const isSelected = form.contract_types.includes(type.value);
                  return (
                    <Badge
                      key={type.value}
                      variant={isSelected ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => {
                        const newTypes = isSelected
                          ? form.contract_types.filter(
                              (t) => t !== type.value
                            )
                          : [...form.contract_types, type.value];
                        setForm({ ...form, contract_types: newTypes });
                      }}
                    >
                      {type.label}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Prioridade + toggles */}
            <div className="grid grid-cols-3 gap-3 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="rule-priority">Prioridade</Label>
                <Input
                  id="rule-priority"
                  type="number"
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: e.target.value })
                  }
                  placeholder="0"
                />
                <p className="text-[10px] text-muted-foreground">
                  Maior = mais prioridade
                </p>
              </div>
              <div className="flex items-center gap-2 pb-1">
                <Switch
                  checked={form.require_all}
                  onCheckedChange={(v) =>
                    setForm({ ...form, require_all: v })
                  }
                />
                <Label className="text-xs">Todos devem aprovar</Label>
              </div>
              <div className="flex items-center gap-2 pb-1">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) =>
                    setForm({ ...form, is_active: v })
                  }
                />
                <Label className="text-xs">Regra ativa</Label>
              </div>
            </div>

            {/* Steps de aprovação */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Steps de Aprovação *
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addApproverStep}
                  className="gap-1 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  Adicionar Step
                </Button>
              </div>

              {form.approvers.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 p-2 rounded">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Adicione pelo menos um step de aprovação.
                </div>
              )}

              {form.approvers.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-end gap-2 bg-muted/30 p-3 rounded border"
                >
                  <div className="flex items-center justify-center w-6 h-8">
                    <Badge
                      variant="secondary"
                      className="text-[10px] h-5 w-5 justify-center p-0"
                    >
                      {idx + 1}
                    </Badge>
                  </div>

                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px]">Papel</Label>
                    <Select
                      value={step.role}
                      onValueChange={(v) =>
                        updateApproverStep(idx, "role", v)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px]">Nome do step</Label>
                    <Input
                      className="h-8 text-xs"
                      value={step.step_name}
                      onChange={(e) =>
                        updateApproverStep(idx, "step_name", e.target.value)
                      }
                    />
                  </div>

                  <div className="w-20 space-y-1">
                    <Label className="text-[10px]">Prazo (h)</Label>
                    <Input
                      className="h-8 text-xs"
                      type="number"
                      value={step.deadline_hours}
                      onChange={(e) =>
                        updateApproverStep(
                          idx,
                          "deadline_hours",
                          Number(e.target.value)
                        )
                      }
                    />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500"
                    onClick={() => removeApproverStep(idx)}
                    disabled={form.approvers.length <= 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                createMutation.isPending || updateMutation.isPending
              }
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Salvando..."
                : editingRule
                  ? "Salvar Alterações"
                  : "Criar Regra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
