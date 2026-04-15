/**
 * PendingApprovalsList — Lista de aprovações pendentes do usuário com ações
 * Extraído de ClmCommandCenter.tsx (Fase 2.1 — Decomposição)
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, CheckCircle, XCircle } from "lucide-react";

interface ApprovalEntry {
  id: string;
  contract_id: string;
  step_name: string;
  step_order: number;
  status: string;
}

interface PendingApprovalsListProps {
  approvals: ApprovalEntry[] | undefined;
  isLoading: boolean;
  onApprove: (approvalId: string, contractId: string) => void;
  onReject: (approvalId: string, contractId: string) => void;
}

export function PendingApprovalsList({
  approvals,
  isLoading,
  onApprove,
  onReject,
}: PendingApprovalsListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  }

  const pending = approvals?.filter((a) => a.status === "pendente") || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Minhas Aprovações Pendentes
          </CardTitle>
          <Badge variant="outline">{pending.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma aprovação pendente no momento.
          </p>
        ) : (
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {pending.map((approval) => (
              <li
                key={approval.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {approval.step_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Etapa {approval.step_order} · Contrato {approval.contract_id.slice(0, 8)}...
                  </p>
                </div>
                <div className="flex items-center gap-1.5 ml-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-green-400 border-green-500/30 hover:bg-green-500/10"
                    onClick={() => onApprove(approval.id, approval.contract_id)}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
                    onClick={() => onReject(approval.id, approval.contract_id)}
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Rejeitar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
