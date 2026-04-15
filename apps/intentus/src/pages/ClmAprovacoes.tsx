/**
 * ClmAprovacoes — Central de Aprovações do CLM
 *
 * Página dedicada para gestão unificada de aprovações de contratos.
 * 3 tabs: Minhas Pendentes (ações inline), Histórico (filtros+paginação), Regras.
 *
 * Criado na sessão 49 (14/03/2026) — Claudinho + Buchecha pair programming.
 *
 * Hooks consumidos (todos pré-existentes):
 * - useMyPendingApprovals() — pendentes do usuário (Supabase direto)
 * - useApprovalHistory() — histórico via Edge Function
 * - useClmApprove/Reject() — mutations via Edge Function
 * - usePermissions() — RBAC guards
 */

import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  FileText,
  Send,
  Users,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { useMyPendingApprovals, type PendingApprovalItem } from "@/hooks/useApprovalWorkflow";
import { useApprovalHistory } from "@/hooks/useApprovalHistory";
import { useClmApprove, useClmReject } from "@/hooks/useClmLifecycle";
import { usePermissions } from "@/hooks/usePermissions";
import { CONTRACT_TYPE_LABELS } from "@/lib/clmApi";
import { ContractDetailDialog } from "@/components/contracts/ContractDetailDialog";
import ApprovalRulesManager from "@/components/contracts/ApprovalRulesManager";

// ── Helpers ─────────────────────────────────────────────────────

function formatCurrency(value: number | null | undefined): string {
  if (!value) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isThisMonth(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function getDeadlineUrgency(deadline: string | null | undefined): "ok" | "warning" | "overdue" | "none" {
  if (!deadline) return "none";
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff < 0) return "overdue";
  if (diff < 2 * 24 * 60 * 60 * 1000) return "warning"; // < 2 days
  return "ok";
}

function deadlineBadge(deadline: string | null | undefined) {
  const urgency = getDeadlineUrgency(deadline);
  if (urgency === "none") return null;

  const d = new Date(deadline!);
  const label = urgency === "overdue"
    ? `Atrasado ${Math.ceil((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))}d`
    : `Prazo: ${d.toLocaleDateString("pt-BR")}`;

  const colors = {
    ok: "bg-green-500/10 text-green-400 border-green-500/30",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    overdue: "bg-red-500/10 text-red-400 border-red-500/30",
  };

  return (
    <Badge variant="outline" className={`text-xs ${colors[urgency]}`}>
      {urgency === "overdue" ? <AlertTriangle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
      {label}
    </Badge>
  );
}

const DECISION_COLORS: Record<string, string> = {
  aprovado: "bg-green-500/10 text-green-400 border-green-500/30",
  rejeitado: "bg-red-500/10 text-red-400 border-red-500/30",
  delegado: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  pendente: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
};

const ITEMS_PER_PAGE = 10;

// ════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════════

export default function ClmAprovacoes() {
  const navigate = useNavigate();
  const { canApprove, canManageSettings } = usePermissions();

  // ── Data ────────────────────────────────────────────────────
  const { data: pendingApprovals = [], isLoading: loadingPending } = useMyPendingApprovals();
  const { data: historyApprovals = [], isLoading: loadingHistory } = useApprovalHistory();

  // ── Mutations ──────────────────────────────────────────────
  const approveM = useClmApprove();
  const rejectM = useClmReject();

  // ── Dialogs state ──────────────────────────────────────────
  const [approveTarget, setApproveTarget] = useState<PendingApprovalItem | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingApprovalItem | null>(null);
  const [approveComment, setApproveComment] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  // ── Contract detail dialog ────────────────────────────────
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

  // ── History filters ────────────────────────────────────────
  const [periodFilter, setPeriodFilter] = useState("all");
  const [decisionFilter, setDecisionFilter] = useState("all");
  const [historyPage, setHistoryPage] = useState(1);

  // ── KPIs (computed) ────────────────────────────────────────
  const kpis = useMemo(() => {
    const now = new Date();
    const pendingCount = pendingApprovals.length;
    const overdueCount = pendingApprovals.filter(
      (a) => a.deadline && new Date(a.deadline) < now
    ).length;
    const approvedMonth = historyApprovals.filter(
      (a) => a.status === "aprovado" && isThisMonth(a.decided_at)
    ).length;
    const rejectedMonth = historyApprovals.filter(
      (a) => a.status === "rejeitado" && isThisMonth(a.decided_at)
    ).length;
    return { pendingCount, overdueCount, approvedMonth, rejectedMonth };
  }, [pendingApprovals, historyApprovals]);

  // ── Filtered history ───────────────────────────────────────
  const filteredHistory = useMemo(() => {
    let result = [...historyApprovals];

    // Period filter
    if (periodFilter !== "all") {
      const days = parseInt(periodFilter);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      result = result.filter((a) => a.decided_at && new Date(a.decided_at) >= cutoff);
    }

    // Decision filter
    if (decisionFilter !== "all") {
      result = result.filter((a) => a.status === decisionFilter);
    }

    // Sort by decided_at DESC
    result.sort((a, b) => {
      const da = a.decided_at ? new Date(a.decided_at).getTime() : 0;
      const db = b.decided_at ? new Date(b.decided_at).getTime() : 0;
      return db - da;
    });

    return result;
  }, [historyApprovals, periodFilter, decisionFilter]);

  // ── Pagination ─────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / ITEMS_PER_PAGE));
  const paginatedHistory = filteredHistory.slice(
    (historyPage - 1) * ITEMS_PER_PAGE,
    historyPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  useMemo(() => setHistoryPage(1), [periodFilter, decisionFilter]);

  // ── Handlers ───────────────────────────────────────────────
  const handleApprove = useCallback(() => {
    if (!approveTarget) return;
    approveM.mutate(
      {
        approvalId: approveTarget.id,
        contractId: approveTarget.contract_id,
        comments: approveComment || undefined,
      },
      { onSettled: () => { setApproveTarget(null); setApproveComment(""); } }
    );
  }, [approveTarget, approveComment, approveM]);

  const handleReject = useCallback(() => {
    if (!rejectTarget || !rejectReason.trim()) return;
    rejectM.mutate(
      {
        approvalId: rejectTarget.id,
        contractId: rejectTarget.contract_id,
        comments: rejectReason.trim(),
      },
      { onSettled: () => { setRejectTarget(null); setRejectReason(""); } }
    );
  }, [rejectTarget, rejectReason, rejectM]);

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-[#1A1A2E] text-white p-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/contratos/command-center")}
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#E2A93B]/10">
            <Shield className="h-6 w-6 text-[#E2A93B]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Central de Aprovações</h1>
            <p className="text-sm text-gray-400">
              Gerencie aprovações pendentes, histórico e regras de workflow
            </p>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Pendentes"
          value={kpis.pendingCount}
          icon={<Clock className="h-5 w-5" />}
          color="yellow"
          loading={loadingPending}
        />
        <KPICard
          label="Atrasadas"
          value={kpis.overdueCount}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="red"
          loading={loadingPending}
        />
        <KPICard
          label="Aprovadas (mês)"
          value={kpis.approvedMonth}
          icon={<CheckCircle className="h-5 w-5" />}
          color="green"
          loading={loadingHistory}
        />
        <KPICard
          label="Rejeitadas (mês)"
          value={kpis.rejectedMonth}
          icon={<XCircle className="h-5 w-5" />}
          color="gray"
          loading={loadingHistory}
        />
      </div>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="bg-[#2D2D4E] border border-gray-700">
          <TabsTrigger value="pending" className="data-[state=active]:bg-[#E2A93B]/20 data-[state=active]:text-[#E2A93B]">
            Minhas Pendentes
            {kpis.pendingCount > 0 && (
              <Badge className="ml-2 bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                {kpis.pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-[#E2A93B]/20 data-[state=active]:text-[#E2A93B]">
            Histórico
          </TabsTrigger>
          {canManageSettings && (
            <TabsTrigger value="rules" className="data-[state=active]:bg-[#E2A93B]/20 data-[state=active]:text-[#E2A93B]">
              Regras de Aprovação
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Tab: Minhas Pendentes ─────────────────────────── */}
        <TabsContent value="pending" className="space-y-3">
          {loadingPending ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 bg-[#2D2D4E]" />
              ))}
            </div>
          ) : pendingApprovals.length === 0 ? (
            <Card className="bg-[#2D2D4E] border-gray-700">
              <CardContent className="flex flex-col items-center justify-center py-12 text-gray-400">
                <CheckCircle className="h-12 w-12 mb-4 text-green-400/50" />
                <p className="text-lg font-medium">Nenhuma aprovação pendente</p>
                <p className="text-sm mt-1">Todas as aprovações estão em dia</p>
              </CardContent>
            </Card>
          ) : (
            pendingApprovals.map((item) => (
              <Card key={item.id} className="bg-[#2D2D4E] border-gray-700 hover:border-gray-600 transition-colors">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Left: Info */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                        <span className="font-medium text-white">
                          {item.contract_title || `Contrato ${item.contract_id.slice(0, 8)}...`}
                        </span>
                        {item.contract_type && (
                          <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
                            {CONTRACT_TYPE_LABELS[item.contract_type as keyof typeof CONTRACT_TYPE_LABELS] || item.contract_type}
                          </Badge>
                        )}
                        {deadlineBadge(item.deadline)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          Step: {item.step_name || `Etapa ${item.step_order}`}
                        </span>
                        {item.contract_value > 0 && (
                          <span className="text-[#E2A93B] font-medium">
                            {formatCurrency(item.contract_value)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-gray-600 text-gray-300 hover:text-white hover:border-gray-500"
                        onClick={() => setSelectedContractId(item.contract_id)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Ver Contrato
                      </Button>
                      {canApprove && (
                        <>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => setApproveTarget(item)}
                            disabled={approveM.isPending}
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setRejectTarget(item)}
                            disabled={rejectM.isPending}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Rejeitar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Tab: Histórico ────────────────────────────────── */}
        <TabsContent value="history" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[160px] bg-[#2D2D4E] border-gray-700 text-white">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent className="bg-[#2D2D4E] border-gray-700">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Select value={decisionFilter} onValueChange={setDecisionFilter}>
              <SelectTrigger className="w-[160px] bg-[#2D2D4E] border-gray-700 text-white">
                <SelectValue placeholder="Decisão" />
              </SelectTrigger>
              <SelectContent className="bg-[#2D2D4E] border-gray-700">
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="rejeitado">Rejeitado</SelectItem>
                <SelectItem value="delegado">Delegado</SelectItem>
              </SelectContent>
            </Select>
            <span className="flex items-center text-sm text-gray-400 ml-auto">
              {filteredHistory.length} registro{filteredHistory.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Table */}
          {loadingHistory ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 bg-[#2D2D4E]" />
              ))}
            </div>
          ) : filteredHistory.length === 0 ? (
            <Card className="bg-[#2D2D4E] border-gray-700">
              <CardContent className="flex flex-col items-center justify-center py-12 text-gray-400">
                <FileText className="h-12 w-12 mb-4 text-gray-500/50" />
                <p className="text-lg font-medium">Nenhum registro encontrado</p>
                <p className="text-sm mt-1">Ajuste os filtros ou aguarde novas aprovações</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="rounded-lg border border-gray-700 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#2D2D4E] border-gray-700 hover:bg-[#2D2D4E]">
                      <TableHead className="text-gray-400">Contrato</TableHead>
                      <TableHead className="text-gray-400">Etapa</TableHead>
                      <TableHead className="text-gray-400">Decisão</TableHead>
                      <TableHead className="text-gray-400">Comentário</TableHead>
                      <TableHead className="text-gray-400 text-right">Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedHistory.map((item) => (
                      <TableRow
                        key={item.id}
                        className="border-gray-700 hover:bg-[#2D2D4E]/50 cursor-pointer"
                        onClick={() => setSelectedContractId(item.contract_id)}
                      >
                        <TableCell className="font-medium text-white">
                          {item.contract_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {item.step_name || `Etapa ${item.step_order}`}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs capitalize ${DECISION_COLORS[item.status] || ""}`}
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-400 max-w-[200px] truncate">
                          {item.comments || "—"}
                        </TableCell>
                        <TableCell className="text-right text-gray-400 text-sm">
                          {formatDate(item.decided_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={historyPage === 1}
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    className="border-gray-700 text-gray-300"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-gray-400">
                    Página {historyPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={historyPage === totalPages}
                    onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                    className="border-gray-700 text-gray-300"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Tab: Regras ───────────────────────────────────── */}
        {canManageSettings && (
          <TabsContent value="rules">
            <ApprovalRulesManager />
          </TabsContent>
        )}
      </Tabs>

      {/* ── Approve Dialog ──────────────────────────────────── */}
      <AlertDialog open={!!approveTarget} onOpenChange={(open) => { if (!open) { setApproveTarget(null); setApproveComment(""); } }}>
        <AlertDialogContent className="bg-[#2D2D4E] border-gray-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              Confirmar Aprovação
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Você está aprovando a etapa{" "}
              <span className="text-white font-medium">
                {approveTarget?.step_name || `Etapa ${approveTarget?.step_order}`}
              </span>{" "}
              do contrato{" "}
              <span className="text-white font-medium">
                {approveTarget?.contract_title || ""}
              </span>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Comentário (opcional)</label>
            <Textarea
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
              placeholder="Adicione um comentário sobre a aprovação..."
              className="bg-[#1A1A2E] border-gray-600 text-white placeholder:text-gray-500 resize-none"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-600 text-gray-300 hover:text-white bg-transparent">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={approveM.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {approveM.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-1" />
              )}
              Aprovar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Reject Dialog ───────────────────────────────────── */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectReason(""); } }}>
        <AlertDialogContent className="bg-[#2D2D4E] border-gray-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-400" />
              Confirmar Rejeição
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Você está rejeitando a etapa{" "}
              <span className="text-white font-medium">
                {rejectTarget?.step_name || `Etapa ${rejectTarget?.step_order}`}
              </span>{" "}
              do contrato{" "}
              <span className="text-white font-medium">
                {rejectTarget?.contract_title || ""}
              </span>
              . O contrato retornará para revisão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-sm text-gray-400">
              Motivo da rejeição <span className="text-red-400">*</span>
            </label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Descreva o motivo da rejeição..."
              className="bg-[#1A1A2E] border-gray-600 text-white placeholder:text-gray-500 resize-none"
              rows={3}
            />
            {rejectTarget && !rejectReason.trim() && (
              <p className="text-xs text-red-400">O motivo da rejeição é obrigatório</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-600 text-gray-300 hover:text-white bg-transparent">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={rejectM.isPending || !rejectReason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            >
              {rejectM.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-1" />
              )}
              Rejeitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Contract Detail Dialog ──────────────────────────── */}
      {selectedContractId && (
        <ContractDetailDialog
          contractId={selectedContractId}
          open={!!selectedContractId}
          onOpenChange={(open) => { if (!open) setSelectedContractId(null); }}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SUB-COMPONENTE: KPI Card
// ════════════════════════════════════════════════════════════════

function KPICard({
  label,
  value,
  icon,
  color,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "yellow" | "red" | "green" | "gray";
  loading: boolean;
}) {
  const colorMap = {
    yellow: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20" },
    red: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
    green: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20" },
    gray: { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/20" },
  };
  const c = colorMap[color];

  return (
    <Card className={`bg-[#2D2D4E] border-gray-700 ${c.border}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${c.bg}`}>
          <span className={c.text}>{icon}</span>
        </div>
        <div>
          {loading ? (
            <Skeleton className="h-7 w-12 bg-gray-600" />
          ) : (
            <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
          )}
          <p className="text-xs text-gray-400">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
