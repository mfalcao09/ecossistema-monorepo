import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";
import type { SlaRules } from "@/lib/slaDefaults";
import { getTicketSlaHours, DEFAULT_SLA_RULES } from "@/lib/slaDefaults";

export const ticketCategoryLabels: Record<string, string> = {
  duvida_contratual: "Dúvida Contratual",
  manutencao: "Manutenção",
  renegociacao: "Renegociação",
  financeiro: "Financeiro",
  documentos: "Documentos",
  outro: "Outro",
};

export const ticketStatusLabels: Record<string, string> = {
  aberto: "Aberto",
  em_atendimento: "Em Atendimento",
  aguardando_cliente: "Aguardando Cliente",
  resolvido: "Resolvido",
  cancelado: "Cancelado",
};

export const ticketStatusColors: Record<string, string> = {
  aberto: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  em_atendimento: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  aguardando_cliente: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  resolvido: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelado: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export const ticketDepartmentLabels: Record<string, string> = {
  relacionamento: "Relacionamento",
  comercial: "Comercial",
  financeiro: "Financeiro",
  juridico: "Jurídico",
  manutencao: "Manutenção",
};

export const ticketPriorityLabels: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export const ticketPriorityColors: Record<string, string> = {
  baixa: "bg-slate-100 text-slate-800",
  media: "bg-blue-100 text-blue-800",
  alta: "bg-orange-100 text-orange-800",
  urgente: "bg-red-100 text-red-800",
};

// Auto-route by category
const categoryDepartmentMap: Record<string, string> = {
  duvida_contratual: "relacionamento",
  manutencao: "manutencao",
  renegociacao: "comercial",
  financeiro: "financeiro",
  documentos: "relacionamento",
  outro: "relacionamento",
};

export interface Ticket {
  id: string;
  tenant_id: string;
  contract_id: string | null;
  person_id: string;
  property_id: string | null;
  category: string;
  subject: string;
  description: string | null;
  priority: string;
  status: string;
  assigned_to: string | null;
  assigned_department: string | null;
  sla_deadline: string | null;
  resolved_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  people?: { id: string; full_name: string } | null;
  properties?: { id: string; title: string } | null;
  contracts?: { id: string; contract_type: string } | null;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_type: string;
  message: string;
  attachments: any;
  created_at: string;
}

export function useTickets(filters?: { status?: string; category?: string; department?: string }) {
  return useQuery({
    queryKey: ["support-tickets", filters],
    queryFn: async () => {
      let q = supabase
        .from("support_tickets")
        .select("*, people:person_id ( id, full_name ), properties:property_id ( id, title ), contracts:contract_id ( id, contract_type )")
        .order("created_at", { ascending: false });
      if (filters?.status) q = q.eq("status", filters.status as any);
      if (filters?.category) q = q.eq("category", filters.category as any);
      if (filters?.department) q = q.eq("assigned_department", filters.department as any);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as Ticket[];
    },
  });
}

export function useCreateTicket(slaRules?: SlaRules) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: {
      person_id: string;
      subject: string;
      category: string;
      description?: string;
      priority?: string;
      contract_id?: string;
      property_id?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const dept = categoryDepartmentMap[form.category] || "relacionamento";
      const rules = slaRules ?? DEFAULT_SLA_RULES;
      const slaHours = getTicketSlaHours(rules, form.priority || "media");
      const sla_deadline = slaHours > 0 ? new Date(Date.now() + slaHours * 3600000).toISOString() : null;

      const { error } = await supabase.from("support_tickets").insert({
        tenant_id,
        person_id: form.person_id,
        subject: form.subject,
        category: form.category as any,
        description: form.description || null,
        priority: (form.priority || "media") as any,
        contract_id: form.contract_id || null,
        property_id: form.property_id || null,
        assigned_department: dept as any,
        sla_deadline,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      toast.success("Ticket criado com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: {
      id: string;
      status?: string;
      assigned_to?: string;
      assigned_department?: string;
      priority?: string;
    }) => {
      const payload: Record<string, unknown> = { ...form };
      if (form.status === "resolvido") payload.resolved_at = new Date().toISOString();
      const { error } = await supabase.from("support_tickets").update(payload as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      toast.success("Ticket atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useTicketMessages(ticketId: string | undefined) {
  return useQuery({
    queryKey: ["ticket-messages", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_ticket_messages")
        .select("*")
        .eq("ticket_id", ticketId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as TicketMessage[];
    },
    enabled: !!ticketId,
  });
}

export function useSendTicketMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: { ticket_id: string; message: string; sender_type?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("support_ticket_messages").insert({
        ticket_id: form.ticket_id,
        sender_id: user.id,
        sender_type: (form.sender_type || "equipe") as any,
        message: form.message,
        tenant_id,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["ticket-messages", v.ticket_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
