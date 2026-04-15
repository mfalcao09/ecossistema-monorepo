/**
 * InstallmentManager — Gerenciador de Parcelas com Ações de Cobrança
 *
 * Lista parcelas vencidas com ações:
 * - Registrar pagamento (dialog com valor, data, método, comprovante)
 * - Marcar como atrasado
 * - Adicionar observações
 *
 * Pode ser usado standalone (todas as parcelas vencidas)
 * ou filtrado por contrato.
 *
 * Épico 4 — CLM Fase 2
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Receipt,
  CheckCircle,
  Clock,
  AlertTriangle,
  Banknote,
  CreditCard,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import {
  useOverdueInstallments,
  type OverdueInstallment,
} from "@/hooks/useDelinquencyMetrics";
import {
  useRegisterPayment,
  useUpdateInstallmentStatus,
  PAYMENT_METHODS,
  STATUS_COLORS,
} from "@/hooks/useInstallmentActions";

// ── Props ──────────────────────────────────────────────────────────────
interface InstallmentManagerProps {
  contractId?: string; // optional: filter by contract
}

// ── Formatters ─────────────────────────────────────────────────────────
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function getDaysLabel(days: number): string {
  if (days <= 0) return "No prazo";
  if (days === 1) return "1 dia";
  return `${days} dias`;
}

function getDaysBadgeColor(days: number): string {
  if (days <= 0) return "bg-green-100 text-green-800";
  if (days <= 30) return "bg-yellow-100 text-yellow-800";
  if (days <= 60) return "bg-orange-100 text-orange-800";
  if (days <= 90) return "bg-red-100 text-red-800";
  return "bg-red-200 text-red-900";
}

// ── Componente principal ───────────────────────────────────────────────
export default function InstallmentManager({ contractId }: InstallmentManagerProps) {
  const { toast } = useToast();
  const { data: allInstallments, isLoading } = useOverdueInstallments();
  const registerPayment = useRegisterPayment();
  const updateStatus = useUpdateInstallmentStatus();

  // Filter by contract if provided
  const installments = contractId
    ? allInstallments?.filter((i) => i.contractId === contractId)
    : allInstallments;

  // Payment dialog state
  const [paymentTarget, setPaymentTarget] = useState<OverdueInstallment | null>(null);
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  // ── Handlers ──────────────────────────────────────────────────────────
  function openPaymentDialog(inst: OverdueInstallment) {
    setPaymentTarget(inst);
    setPaidAmount(inst.amount.toString());
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMethod("pix");
    setPaymentRef("");
    setPaymentNotes("");
  }

  async function handleRegisterPayment() {
    if (!paymentTarget) return;
    const amount = parseFloat(paidAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }

    try {
      await registerPayment.mutateAsync({
        installmentId: paymentTarget.id,
        paidAmount: amount,
        paymentDate,
        paymentMethod,
        paymentReference: paymentRef || undefined,
        notes: paymentNotes || undefined,
      });
      toast({
        title: "Pagamento registrado",
        description: `Parcela ${paymentTarget.installmentNumber} — ${formatCurrency(amount)}`,
      });
      setPaymentTarget(null);
    } catch (err: any) {
      toast({
        title: "Erro ao registrar pagamento",
        description: err.message,
        variant: "destructive",
      });
    }
  }

  async function handleMarkOverdue(inst: OverdueInstallment) {
    try {
      await updateStatus.mutateAsync({
        installmentId: inst.id,
        status: "atrasado",
      });
      toast({ title: "Marcada como atrasada" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            Parcelas Vencidas
            {installments && (
              <Badge variant="destructive" className="ml-1 text-xs">
                {installments.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
          ) : !installments || installments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-400" />
              <p>Nenhuma parcela vencida</p>
              <p className="text-xs mt-1">Todas as parcelas estão em dia!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {installments.map((inst) => (
                <div
                  key={inst.id}
                  className="p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          Parcela {inst.installmentNumber}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[inst.status as keyof typeof STATUS_COLORS] || ""}`}
                        >
                          {inst.status}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${getDaysBadgeColor(inst.daysOverdue)}`}
                        >
                          <Clock className="h-2.5 w-2.5 mr-0.5" />
                          {getDaysLabel(inst.daysOverdue)}
                        </Badge>
                      </div>

                      {!contractId && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {inst.contractTitle}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>
                          Venc.: {format(new Date(inst.dueDate), "dd/MM/yyyy")}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          {inst.revenueType}
                        </Badge>
                      </div>
                    </div>

                    {/* Right: amount + actions */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-red-600">
                        {formatCurrency(inst.amount)}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Button
                          variant="default"
                          size="sm"
                          className="h-7 px-2.5 text-xs gap-1"
                          onClick={() => openPaymentDialog(inst)}
                        >
                          <Banknote className="h-3 w-3" />
                          Pagar
                        </Button>
                        {inst.status === "pendente" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 text-amber-600 hover:text-amber-700"
                            onClick={() => handleMarkOverdue(inst)}
                            disabled={updateStatus.isPending}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Atrasar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══ PAYMENT DIALOG ══ */}
      <Dialog open={!!paymentTarget} onOpenChange={() => setPaymentTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Registrar Pagamento
            </DialogTitle>
            <DialogDescription>
              {paymentTarget && (
                <>
                  Parcela {paymentTarget.installmentNumber} —{" "}
                  {paymentTarget.contractTitle}
                  <br />
                  Vencimento:{" "}
                  {format(new Date(paymentTarget.dueDate), "dd/MM/yyyy")} ·{" "}
                  Valor: {formatCurrency(paymentTarget.amount)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Paid amount */}
            <div className="space-y-2">
              <Label>Valor Pago (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </div>

            {/* Payment date */}
            <div className="space-y-2">
              <Label>Data do Pagamento</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            {/* Payment method */}
            <div className="space-y-2">
              <Label>Método de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reference */}
            <div className="space-y-2">
              <Label>
                Nº Comprovante{" "}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                placeholder="Ex: PIX-2026030700123"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>
                Observações{" "}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Textarea
                placeholder="Notas sobre o pagamento..."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentTarget(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRegisterPayment}
              disabled={registerPayment.isPending}
              className="gap-1.5"
            >
              {registerPayment.isPending ? (
                "Registrando..."
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Confirmar Pagamento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
