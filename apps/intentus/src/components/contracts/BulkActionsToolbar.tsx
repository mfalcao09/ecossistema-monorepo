/**
 * BulkActionsToolbar — Floating toolbar for bulk contract operations (Sessão 57, F1 Item #5)
 *
 * Appears at the bottom of the screen when 1+ contracts are selected.
 * 6 actions: Transition, Export CSV, Export PDF (future), Delete, Assign, Renew
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowRightLeft, Download, Trash2, UserPlus, RefreshCw, X, Loader2, CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CONTRACT_STATUS_LABELS, VALID_TRANSITIONS, type ContractStatus } from "@/lib/clmApi";
import {
  useBulkTransition,
  useBulkDelete,
  useBulkAssign,
  useBulkRenewal,
  exportContractsCsv,
} from "@/hooks/useBulkContractOps";
import type { ContractWithRelations } from "@/hooks/useContracts";
import { usePermissions } from "@/hooks/usePermissions";

interface Props {
  selectedContracts: ContractWithRelations[];
  selectedIds: Set<string>;
  onClearSelection: () => void;
}

export function BulkActionsToolbar({ selectedContracts, selectedIds, onClearSelection }: Props) {
  const count = selectedIds.size;
  const { canDeleteContract, canTransitionContract } = usePermissions();

  // Mutations
  const bulkTransition = useBulkTransition();
  const bulkDelete = useBulkDelete();
  const bulkAssign = useBulkAssign();
  const bulkRenewal = useBulkRenewal();

  // UI state
  const [showTransition, setShowTransition] = useState(false);
  const [targetStatus, setTargetStatus] = useState<ContractStatus | "">("");
  const [showDelete, setShowDelete] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [assignName, setAssignName] = useState("");
  const [showRenewal, setShowRenewal] = useState(false);

  const isPending = bulkTransition.isPending || bulkDelete.isPending || bulkAssign.isPending || bulkRenewal.isPending;

  if (count === 0) return null;

  // Compute common transition targets (statuses all selected contracts can reach)
  const commonTargets = (() => {
    const targetSets = selectedContracts.map((c) => new Set(VALID_TRANSITIONS[c.status as ContractStatus] ?? []));
    if (targetSets.length === 0) return [];
    const first = targetSets[0];
    return [...first].filter((t) => targetSets.every((s) => s.has(t)));
  })();

  const handleTransition = async () => {
    if (!targetStatus) return;
    await bulkTransition.mutateAsync({
      contractIds: [...selectedIds],
      toStatus: targetStatus as ContractStatus,
    });
    setShowTransition(false);
    setTargetStatus("");
    onClearSelection();
  };

  const handleDelete = async () => {
    await bulkDelete.mutateAsync([...selectedIds]);
    setShowDelete(false);
    onClearSelection();
  };

  const handleAssign = async () => {
    if (!assignName.trim()) return;
    await bulkAssign.mutateAsync({
      contractIds: [...selectedIds],
      responsibleName: assignName.trim(),
    });
    setShowAssign(false);
    setAssignName("");
    onClearSelection();
  };

  const handleRenewal = async () => {
    await bulkRenewal.mutateAsync([...selectedIds]);
    setShowRenewal(false);
    onClearSelection();
  };

  const renewableCount = selectedContracts.filter((c) => c.status === "ativo" || c.status === "expirado").length;

  return (
    <>
      {/* Floating toolbar */}
      <div className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "bg-card border shadow-xl rounded-xl px-4 py-3",
        "flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-200",
      )}>
        <div className="flex items-center gap-2 pr-3 border-r">
          <CheckSquare className="h-4 w-4 text-primary" />
          <Badge variant="secondary" className="text-xs font-semibold">
            {count} selecionado{count > 1 ? "s" : ""}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Transition */}
          {canTransitionContract && commonTargets.length > 0 && (
            <Button
              size="sm" variant="outline" className="text-xs gap-1.5 h-8"
              onClick={() => setShowTransition(true)}
              disabled={isPending}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" /> Transição
            </Button>
          )}

          {/* Export CSV */}
          <Button
            size="sm" variant="outline" className="text-xs gap-1.5 h-8"
            onClick={() => exportContractsCsv(selectedContracts)}
            disabled={isPending}
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>

          {/* Assign */}
          <Button
            size="sm" variant="outline" className="text-xs gap-1.5 h-8"
            onClick={() => setShowAssign(true)}
            disabled={isPending}
          >
            <UserPlus className="h-3.5 w-3.5" /> Atribuir
          </Button>

          {/* Renewal */}
          {renewableCount > 0 && (
            <Button
              size="sm" variant="outline" className="text-xs gap-1.5 h-8"
              onClick={() => setShowRenewal(true)}
              disabled={isPending}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Renovar ({renewableCount})
            </Button>
          )}

          {/* Delete */}
          {canDeleteContract && (
            <Button
              size="sm" variant="outline" className="text-xs gap-1.5 h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => setShowDelete(true)}
              disabled={isPending}
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </Button>
          )}
        </div>

        {/* Clear selection */}
        <Button size="icon" variant="ghost" className="h-7 w-7 ml-1" onClick={onClearSelection}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Transition dialog */}
      <AlertDialog open={showTransition} onOpenChange={setShowTransition}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transição em lote — {count} contrato(s)</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Selecione o novo status para os {count} contrato(s) selecionados:</p>
                <Select value={targetStatus} onValueChange={(v) => setTargetStatus(v as ContractStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {commonTargets.map((s) => (
                      <SelectItem key={s} value={s}>{CONTRACT_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Apenas transições válidas para todos os contratos selecionados são exibidas.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkTransition.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleTransition} disabled={!targetStatus || bulkTransition.isPending}>
              {bulkTransition.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Excluir {count} contrato(s) permanentemente</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>Tem certeza que deseja excluir {count} contrato(s)?</p>
                <p className="mt-2 text-destructive font-semibold">
                  Esta ação é irreversível. Todas as parcelas, partes, obrigações e redlining vinculados serão removidos permanentemente.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDelete.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={bulkDelete.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDelete.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir {count} contrato(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign dialog */}
      <AlertDialog open={showAssign} onOpenChange={setShowAssign}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atribuir responsável — {count} contrato(s)</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Digite o nome do responsável para os {count} contrato(s) selecionados:</p>
                <input
                  type="text"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Nome do responsável"
                  value={assignName}
                  onChange={(e) => setAssignName(e.target.value)}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkAssign.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAssign} disabled={!assignName.trim() || bulkAssign.isPending}>
              {bulkAssign.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Atribuir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Renewal dialog */}
      <AlertDialog open={showRenewal} onOpenChange={setShowRenewal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renovar {renewableCount} contrato(s) em lote</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  {renewableCount} de {count} contrato(s) selecionado(s) podem ser renovados (status ativo ou expirado).
                </p>
                <p className="mt-2 text-muted-foreground text-xs">
                  Os contratos serão transicionados para o status "Renovado" com registro no histórico.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkRenewal.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRenewal} disabled={bulkRenewal.isPending}>
              {bulkRenewal.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Renovar {renewableCount} contrato(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
