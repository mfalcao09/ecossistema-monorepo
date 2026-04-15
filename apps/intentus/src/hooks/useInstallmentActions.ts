/**
 * useInstallmentActions — Ações de cobrança sobre parcelas
 *
 * Permite:
 * - Registrar pagamento (muda status para 'pago')
 * - Marcar como atrasado
 * - Marcar como cancelado
 * - Atualizar notas/observações
 *
 * installment_status enum: pendente | pago | atrasado | cancelado
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────
export type InstallmentStatus = "pendente" | "pago" | "atrasado" | "cancelado";

export interface RegisterPaymentInput {
  installmentId: string;
  paidAmount: number;
  paymentDate: string;        // YYYY-MM-DD
  paymentMethod?: string;     // PIX, boleto, transferência, etc.
  paymentReference?: string;  // Nº do comprovante
  notes?: string;
}

export interface UpdateInstallmentStatusInput {
  installmentId: string;
  status: InstallmentStatus;
  notes?: string;
}

export interface UpdateInstallmentNotesInput {
  installmentId: string;
  notes: string;
}

export const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto Bancário" },
  { value: "transferencia", label: "Transferência Bancária" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "cheque", label: "Cheque" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "deposito", label: "Depósito" },
  { value: "outro", label: "Outro" },
];

export const STATUS_LABELS: Record<InstallmentStatus, string> = {
  pendente: "Pendente",
  pago: "Pago",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

export const STATUS_COLORS: Record<InstallmentStatus, string> = {
  pendente: "bg-yellow-100 text-yellow-800",
  pago: "bg-green-100 text-green-800",
  atrasado: "bg-red-100 text-red-800",
  cancelado: "bg-gray-100 text-gray-500",
};

// ── Mutation functions ─────────────────────────────────────────────────
async function registerPayment(input: RegisterPaymentInput) {
  const { data, error } = await supabase
    .from("contract_installments")
    .update({
      status: "pago" as any,
      paid_amount: input.paidAmount,
      payment_date: input.paymentDate,
      payment_method: input.paymentMethod || null,
      payment_reference: input.paymentReference || null,
      notes: input.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.installmentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function updateStatus(input: UpdateInstallmentStatusInput) {
  const updateData: Record<string, any> = {
    status: input.status as any,
    updated_at: new Date().toISOString(),
  };
  if (input.notes !== undefined) updateData.notes = input.notes;

  // If marking as non-paid, clear payment fields
  if (input.status !== "pago") {
    updateData.paid_amount = null;
    updateData.payment_date = null;
    updateData.payment_method = null;
    updateData.payment_reference = null;
  }

  const { data, error } = await supabase
    .from("contract_installments")
    .update(updateData)
    .eq("id", input.installmentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function updateNotes(input: UpdateInstallmentNotesInput) {
  const { data, error } = await supabase
    .from("contract_installments")
    .update({
      notes: input.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.installmentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Batch: mark all overdue pending installments
async function markAllOverdue() {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("contract_installments")
    .update({
      status: "atrasado" as any,
      updated_at: new Date().toISOString(),
    })
    .eq("status", "pendente" as any)
    .lt("due_date", today)
    .select();

  if (error) throw error;
  return data;
}

// ── Hooks ──────────────────────────────────────────────────────────────
export function useRegisterPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: registerPayment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delinquency-kpis"] });
      qc.invalidateQueries({ queryKey: ["aging-buckets"] });
      qc.invalidateQueries({ queryKey: ["overdue-contracts"] });
      qc.invalidateQueries({ queryKey: ["overdue-installments"] });
      qc.invalidateQueries({ queryKey: ["contract-installments"] });
    },
  });
}

export function useUpdateInstallmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateStatus,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delinquency-kpis"] });
      qc.invalidateQueries({ queryKey: ["aging-buckets"] });
      qc.invalidateQueries({ queryKey: ["overdue-contracts"] });
      qc.invalidateQueries({ queryKey: ["overdue-installments"] });
      qc.invalidateQueries({ queryKey: ["contract-installments"] });
    },
  });
}

export function useUpdateInstallmentNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateNotes,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-installments"] });
    },
  });
}

export function useMarkAllOverdue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAllOverdue,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delinquency-kpis"] });
      qc.invalidateQueries({ queryKey: ["aging-buckets"] });
      qc.invalidateQueries({ queryKey: ["overdue-contracts"] });
      qc.invalidateQueries({ queryKey: ["overdue-installments"] });
      qc.invalidateQueries({ queryKey: ["contract-installments"] });
    },
  });
}
