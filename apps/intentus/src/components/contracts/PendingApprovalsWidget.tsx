/**
 * PendingApprovalsWidget — Widget de aprovações pendentes do usuário
 *
 * Épico 2 — CLM Fase 2
 * Fix Fase 3 (sessão 37): Click handler + acessibilidade (Claudinho+Buchecha)
 *
 * Exibe lista de aprovações pendentes do usuário logado com navegação ao detalhe.
 * Projetado para ser inserido em qualquer dashboard.
 *
 * Funcionalidades:
 * - Lista aprovações pendentes com nome do contrato e step
 * - Mostra prazo e status de urgência
 * - Click/Enter/Space abre detalhe do contrato (ContractDetailDialog)
 * - Badge de contagem no header
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  Clock,
  Shield,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { useMyPendingApprovals, type PendingApprovalItem } from "@/hooks/useApprovalWorkflow";
import { ContractDetailDialog } from "./ContractDetailDialog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Helpers ─────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(value);
}

function formatDeadline(dateStr: string | null): {
  text: string;
  isOverdue: boolean;
} {
  if (!dateStr) return { text: "Sem prazo", isOverdue: false };
  try {
    const deadline = new Date(dateStr);
    const isOverdue = deadline < new Date();
    return {
      text: formatDistanceToNow(deadline, {
        addSuffix: true,
        locale: ptBR,
      }),
      isOverdue,
    };
  } catch {
    return { text: "—", isOverdue: false };
  }
}

const TYPE_LABELS: Record<string, string> = {
  venda: "Venda",
  locacao: "Locação",
  administracao: "Administração",
  distrato: "Distrato",
  prestacao_servicos: "Prest. Serviços",
  obra: "Obra",
  comissao: "Comissão",
  fornecimento: "Fornecimento",
  aditivo: "Aditivo",
  cessao: "Cessão",
  nda: "NDA",
  exclusividade: "Exclusividade",
};

// ── Sub-componente: Item de Aprovação (clicável — abre detalhe do contrato) ──

function ApprovalItem({
  item,
  onClick,
}: {
  item: PendingApprovalItem;
  onClick: (contractId: string) => void;
}) {
  const deadline = formatDeadline(item.deadline);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(item.contract_id);
    }
  };

  return (
    <div
      className="flex items-center gap-3 py-2.5 px-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      onClick={() => onClick(item.contract_id)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Ver detalhes: ${item.contract_title}, etapa ${item.step_name}`}
    >
      {/* Ícone */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          deadline.isOverdue
            ? "bg-red-50 border border-red-200"
            : "bg-amber-50 border border-amber-200"
        }`}
      >
        {deadline.isOverdue ? (
          <AlertTriangle className="h-4 w-4 text-red-500" />
        ) : (
          <Clock className="h-4 w-4 text-amber-500" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {item.contract_title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="outline" className="text-[10px]">
            {TYPE_LABELS[item.contract_type] || item.contract_type}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Step: {item.step_name}
          </span>
        </div>
      </div>

      {/* Valor + prazo */}
      <div className="text-right flex-shrink-0">
        <p className="text-xs font-medium">
          {formatCurrency(item.contract_value)}
        </p>
        <p
          className={`text-[10px] ${
            deadline.isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"
          }`}
        >
          {deadline.isOverdue ? "Atrasado" : "Prazo"}: {deadline.text}
        </p>
      </div>

      {/* Seta (indicador visual de navegação) */}
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </div>
  );
}

// ── Componente Principal ────────────────────────────────────────────────

export default function PendingApprovalsWidget() {
  const { data: pending, isLoading } = useMyPendingApprovals();
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleItemClick = useCallback((contractId: string) => {
    setSelectedContractId(contractId);
  }, []);

  const overdueCount = (pending || []).filter(
    (p) => p.deadline && new Date(p.deadline) < new Date()
  ).length;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Aprovações Pendentes
            </CardTitle>
            {!isLoading && pending && pending.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-xs">
                  {pending.length} pendente{pending.length !== 1 ? "s" : ""}
                </Badge>
                {overdueCount > 0 && (
                  <Badge
                    variant="outline"
                    className="text-xs text-red-600 border-red-300"
                  >
                    {overdueCount} atrasada{overdueCount !== 1 ? "s" : ""}
                  </Badge>
                )}
                <button
                  onClick={() => navigate("/contratos/aprovacoes")}
                  className="text-xs text-primary hover:underline font-medium ml-1"
                >
                  Ver todas →
                </button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : !pending || pending.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <CheckCircle2 className="h-6 w-6 mx-auto mb-1.5 text-green-400" />
              <p className="text-xs">Nenhuma aprovação pendente</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {pending.map((item) => (
                <ApprovalItem key={item.id} item={item} onClick={handleItemClick} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de detalhe do contrato (aberto ao clicar em um item) */}
      <ContractDetailDialog
        contractId={selectedContractId}
        open={selectedContractId !== null}
        onOpenChange={(open) => { if (!open) setSelectedContractId(null); }}
      />
    </>
  );
}
