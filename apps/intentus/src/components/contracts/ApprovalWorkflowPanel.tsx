/**
 * ApprovalWorkflowPanel — Painel de aprovação para um contrato específico
 *
 * Épico 2 — CLM Fase 2
 *
 * Funcionalidades:
 * - Exibe steps de aprovação em timeline visual
 * - Permite aprovar ou rejeitar cada step
 * - Mostra regra de aprovação aplicável
 * - Botão para iniciar workflow quando contrato está em "em_revisao"
 * - Status visual: pendente (amarelo), aprovado (verde), rejeitado (vermelho)
 *
 * Uso: inserir dentro da página de detalhe do contrato
 * <ApprovalWorkflowPanel contractId="..." contractType="venda" totalValue={500000} />
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Play,
  MessageSquare,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useContractApprovalSteps,
  useStartWorkflow,
  type ContractApprovalStep,
} from "@/hooks/useApprovalWorkflow";
import { useClmApprove, useClmReject } from "@/hooks/useClmLifecycle";
import {
  useApplicableRule,
  type ContractApprovalRule,
} from "@/hooks/useContractApprovalRules";
import { supabase } from "@/integrations/supabase/client";
import { createNotification } from "@/hooks/useNotifications";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Props ───────────────────────────────────────────────────────────────

interface ApprovalWorkflowPanelProps {
  contractId: string;
  contractType: string;
  contractStatus: string;
  totalValue: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return formatDistanceToNow(new Date(dateStr), {
      addSuffix: true,
      locale: ptBR,
    });
  } catch {
    return dateStr;
  }
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof Clock; bgClass: string }
> = {
  pendente: {
    label: "Pendente",
    color: "text-amber-600",
    icon: Clock,
    bgClass: "bg-amber-50 border-amber-200",
  },
  aprovado: {
    label: "Aprovado",
    color: "text-green-600",
    icon: CheckCircle2,
    bgClass: "bg-green-50 border-green-200",
  },
  rejeitado: {
    label: "Rejeitado",
    color: "text-red-600",
    icon: XCircle,
    bgClass: "bg-red-50 border-red-200",
  },
};

// ── Hook para buscar profile do usuário logado ──────────────────────────

function useCurrentProfile() {
  return useQuery({
    queryKey: ["current-profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, name, tenant_id")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      return profile as { id: string; name: string; tenant_id: string } | null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ── Sub-componente: Step da Timeline ────────────────────────────────────

function ApprovalStepItem({
  step,
  isCurrentUser,
  onApprove,
  onReject,
  isFirst,
  isLast,
  previousApproved,
}: {
  step: ContractApprovalStep;
  isCurrentUser: boolean;
  onApprove: (step: ContractApprovalStep) => void;
  onReject: (step: ContractApprovalStep) => void;
  isFirst: boolean;
  isLast: boolean;
  previousApproved: boolean;
}) {
  const config = STATUS_CONFIG[step.status] || STATUS_CONFIG.pendente;
  const StatusIcon = config.icon;

  const canAct =
    isCurrentUser &&
    step.status === "pendente" &&
    (isFirst || previousApproved);

  const isOverdue =
    step.status === "pendente" &&
    step.deadline &&
    new Date(step.deadline) < new Date();

  return (
    <div className="flex gap-3">
      {/* Linha da timeline */}
      <div className="flex flex-col items-center">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${config.bgClass}`}
        >
          <StatusIcon className={`h-4 w-4 ${config.color}`} />
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 bg-border min-h-[20px]" />
        )}
      </div>

      {/* Conteúdo do step */}
      <div className={`flex-1 pb-4 ${isLast ? "" : ""}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium">{step.step_name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge
                variant="outline"
                className={`text-[10px] ${config.color}`}
              >
                {config.label}
              </Badge>
              {isOverdue && (
                <Badge
                  variant="outline"
                  className="text-[10px] text-red-600 border-red-300"
                >
                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                  Prazo expirado
                </Badge>
              )}
            </div>
          </div>

          {/* Botões de ação */}
          {canAct && (
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-xs text-green-600 border-green-300 hover:bg-green-50"
                onClick={() => onApprove(step)}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Aprovar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-xs text-red-600 border-red-300 hover:bg-red-50"
                onClick={() => onReject(step)}
              >
                <XCircle className="h-3.5 w-3.5" />
                Rejeitar
              </Button>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
          {step.decided_at && (
            <span>Decidido {formatDate(step.decided_at)}</span>
          )}
          {step.deadline && step.status === "pendente" && (
            <span>Prazo: {formatDate(step.deadline)}</span>
          )}
        </div>

        {/* Comentário */}
        {step.comments && (
          <div className="mt-2 flex items-start gap-1.5 bg-muted/50 rounded p-2">
            <MessageSquare className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
            <p className="text-xs text-muted-foreground italic">
              {step.comments}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-componente: Info da Regra Aplicável ─────────────────────────────

function ApplicableRuleInfo({ rule }: { rule: ContractApprovalRule }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-800">
          Regra aplicável: {rule.name}
        </span>
      </div>
      {rule.description && (
        <p className="text-xs text-blue-600 mt-1 ml-6">
          {rule.description}
        </p>
      )}
      <div className="flex items-center gap-2 mt-2 ml-6">
        <span className="text-xs text-blue-600">
          {rule.approvers.length} step{rule.approvers.length !== 1 ? "s" : ""} de aprovação
        </span>
        <span className="text-xs text-blue-400">•</span>
        <span className="text-xs text-blue-600">
          {rule.require_all ? "Todos devem aprovar" : "Qualquer um aprova"}
        </span>
      </div>
    </div>
  );
}

// ── Componente Principal ────────────────────────────────────────────────

export default function ApprovalWorkflowPanel({
  contractId,
  contractType,
  contractStatus,
  totalValue,
}: ApprovalWorkflowPanelProps) {
  const { toast } = useToast();
  const { data: profile } = useCurrentProfile();
  const { data: steps, isLoading: stepsLoading } =
    useContractApprovalSteps(contractId);
  const { data: applicableRule, isLoading: ruleLoading } =
    useApplicableRule(contractType, totalValue);

  const approveMutation = useClmApprove();
  const rejectMutation = useClmReject();
  const startWorkflowMutation = useStartWorkflow();

  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingStep, setRejectingStep] = useState<ContractApprovalStep | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [approveComment, setApproveComment] = useState("");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [approvingStep, setApprovingStep] = useState<ContractApprovalStep | null>(null);

  const isLoading = stepsLoading || ruleLoading;
  const hasSteps = steps && steps.length > 0;

  // O workflow pode ser iniciado quando:
  // 1. Não há steps existentes
  // 2. Há uma regra aplicável
  // 3. Contrato está em status que permite iniciar (em_revisao ou rascunho)
  const canStartWorkflow =
    !hasSteps &&
    applicableRule &&
    profile &&
    ["em_revisao", "rascunho"].includes(contractStatus);

  // ── Handlers ──────────────────────────────────────────────────────

  function handleStartWorkflow() {
    if (!applicableRule || !profile) return;

    startWorkflowMutation.mutate(
      {
        contractId,
        approverSteps: applicableRule.approvers,
        approverId: profile.id,
        tenantId: profile.tenant_id,
      },
      {
        onSuccess: () => {
          toast({
            title: "Workflow iniciado",
            description: `${applicableRule.approvers.length} step(s) de aprovação criados.`,
          });

          // Fire notification
          supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
              createNotification({
                userId: user.id,
                title: "Aprovação solicitada",
                message: `Workflow de aprovação iniciado com ${applicableRule.approvers.length} step(s)`,
                category: "aprovacao",
                referenceType: "contract",
                referenceId: contractId,
              });
            }
          });
        },
        onError: (error) => {
          toast({
            title: "Erro ao iniciar workflow",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  }

  function handleApproveClick(step: ContractApprovalStep) {
    setApprovingStep(step);
    setApproveComment("");
    setShowApproveDialog(true);
  }

  function handleApproveConfirm() {
    if (!approvingStep) return;

    approveMutation.mutate(
      {
        approvalId: approvingStep.id,
        comments: approveComment.trim() || undefined,
        contractId,
      },
      {
        onSuccess: () => {
          // toast removido — useClmApprove já exibe toast.success("Aprovação registrada!")
          setShowApproveDialog(false);

          // Fire notification
          supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
              createNotification({
                userId: user.id,
                title: "Contrato aprovado",
                message: `Step "${approvingStep.step_name}" foi aprovado`,
                category: "aprovacao",
                referenceType: "contract",
                referenceId: contractId,
              });
            }
          });
        },
        onError: (error) => {
          toast({
            title: "Erro ao aprovar",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  }

  function handleRejectClick(step: ContractApprovalStep) {
    setRejectingStep(step);
    setRejectComment("");
    setShowRejectDialog(true);
  }

  function handleRejectConfirm() {
    if (!rejectingStep || !rejectComment.trim()) {
      toast({
        title: "Comentário obrigatório",
        description: "Informe o motivo da rejeição.",
        variant: "destructive",
      });
      return;
    }

    rejectMutation.mutate(
      {
        approvalId: rejectingStep.id,
        comments: rejectComment.trim(),
        contractId,
      },
      {
        onSuccess: () => {
          // toast removido — useClmReject já exibe toast.success("Rejeição registrada...")
          setShowRejectDialog(false);

          // Fire notification
          supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
              createNotification({
                userId: user.id,
                title: "Contrato rejeitado",
                message: `Step "${rejectingStep.step_name}" foi rejeitado`,
                category: "aprovacao",
                referenceType: "contract",
                referenceId: contractId,
              });
            }
          });
        },
        onError: (error) => {
          toast({
            title: "Erro ao rejeitar",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Workflow de Aprovação
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Valor do contrato: {formatCurrency(totalValue)}
        </p>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <>
            {/* Regra aplicável */}
            {applicableRule && <ApplicableRuleInfo rule={applicableRule} />}

            {/* Sem regra aplicável */}
            {!applicableRule && !hasSteps && (
              <div className="text-center py-6 text-muted-foreground">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">
                  Nenhuma regra de aprovação se aplica a este contrato.
                </p>
                <p className="text-xs mt-1">
                  Tipo: {contractType} | Valor: {formatCurrency(totalValue)}
                </p>
              </div>
            )}

            {/* Botão para iniciar workflow */}
            {canStartWorkflow && (
              <Button
                className="w-full gap-2"
                onClick={handleStartWorkflow}
                disabled={startWorkflowMutation.isPending}
              >
                <Play className="h-4 w-4" />
                {startWorkflowMutation.isPending
                  ? "Iniciando..."
                  : "Iniciar Workflow de Aprovação"}
              </Button>
            )}

            {/* Timeline de steps */}
            {hasSteps && (
              <div className="mt-2">
                {/* Resumo */}
                <div className="flex items-center gap-2 mb-4 text-xs">
                  {(() => {
                    const approved = steps.filter(
                      (s) => s.status === "aprovado"
                    ).length;
                    const total = steps.length;
                    const rejected = steps.filter(
                      (s) => s.status === "rejeitado"
                    ).length;

                    return (
                      <>
                        <Badge
                          variant="outline"
                          className="text-green-600 border-green-300"
                        >
                          {approved}/{total} aprovados
                        </Badge>
                        {rejected > 0 && (
                          <Badge
                            variant="outline"
                            className="text-red-600 border-red-300"
                          >
                            {rejected} rejeitado{rejected !== 1 ? "s" : ""}
                          </Badge>
                        )}
                        {approved === total && (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span className="font-medium">
                              Todas as aprovações concluídas
                            </span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Steps */}
                {steps.map((step, idx) => {
                  const previousApproved =
                    idx === 0 || steps[idx - 1]?.status === "aprovado";

                  return (
                    <ApprovalStepItem
                      key={step.id}
                      step={step}
                      isCurrentUser={profile?.id === step.approver_id}
                      onApprove={handleApproveClick}
                      onReject={handleRejectClick}
                      isFirst={idx === 0}
                      isLast={idx === steps.length - 1}
                      previousApproved={previousApproved}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* ══ DIALOG: Aprovar ══ */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Aprovar: {approvingStep?.step_name}
            </DialogTitle>
            <DialogDescription>
              Confirme a aprovação deste step. Você pode adicionar um
              comentário opcional.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              placeholder="Comentário opcional..."
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleApproveConfirm}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? "Aprovando..." : "Confirmar Aprovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ DIALOG: Rejeitar ══ */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Rejeitar: {rejectingStep?.step_name}
            </DialogTitle>
            <DialogDescription>
              O contrato voltará para o status &quot;Em Revisão&quot;.
              Informe o motivo da rejeição.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              placeholder="Motivo da rejeição (obrigatório)..."
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={4}
              className="border-red-200 focus-visible:ring-red-500"
            />
            {!rejectComment.trim() && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                O motivo é obrigatório para rejeição.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={
                rejectMutation.isPending || !rejectComment.trim()
              }
            >
              {rejectMutation.isPending
                ? "Rejeitando..."
                : "Confirmar Rejeição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
