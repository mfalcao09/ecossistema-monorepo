import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ============================================================
// useAuditTimeline — Hook avançado para trilha de auditoria
// Fase 4, Épico 2: Auditoria Completa com timeline visual
// ============================================================

export interface AuditEvent {
  id: string;
  contract_id: string;
  event_type: AuditEventType;
  event_category: AuditEventCategory;
  description: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  ip_address?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export type AuditEventType =
  | "contract_created"
  | "contract_updated"
  | "contract_deleted"
  | "status_changed"
  | "clause_added"
  | "clause_removed"
  | "clause_modified"
  | "party_added"
  | "party_removed"
  | "document_uploaded"
  | "document_removed"
  | "approval_requested"
  | "approval_granted"
  | "approval_rejected"
  | "signature_sent"
  | "signature_completed"
  | "signature_refused"
  | "version_created"
  | "comment_added"
  | "renewal_initiated"
  | "renewal_completed"
  | "obligation_created"
  | "obligation_fulfilled"
  | "alert_triggered"
  | "ai_analysis_run"
  | "export_generated"
  | "field_changed";

export type AuditEventCategory =
  | "lifecycle"
  | "content"
  | "approval"
  | "signature"
  | "document"
  | "financial"
  | "ai"
  | "system";

export interface AuditFilters {
  categories?: AuditEventCategory[];
  eventTypes?: AuditEventType[];
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  searchTerm?: string;
}

// Mapeamento de ícones e cores por categoria
export const AUDIT_CATEGORY_CONFIG: Record<AuditEventCategory, {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
}> = {
  lifecycle: { label: "Ciclo de Vida", color: "text-blue-700", bgColor: "bg-blue-100", icon: "RefreshCw" },
  content: { label: "Conteúdo", color: "text-purple-700", bgColor: "bg-purple-100", icon: "FileText" },
  approval: { label: "Aprovação", color: "text-amber-700", bgColor: "bg-amber-100", icon: "CheckCircle2" },
  signature: { label: "Assinatura", color: "text-green-700", bgColor: "bg-green-100", icon: "PenTool" },
  document: { label: "Documento", color: "text-cyan-700", bgColor: "bg-cyan-100", icon: "Paperclip" },
  financial: { label: "Financeiro", color: "text-emerald-700", bgColor: "bg-emerald-100", icon: "DollarSign" },
  ai: { label: "Inteligência Artificial", color: "text-violet-700", bgColor: "bg-violet-100", icon: "Brain" },
  system: { label: "Sistema", color: "text-gray-700", bgColor: "bg-gray-100", icon: "Settings" },
};

// Mapeamento de tipo de evento para categoria
export const EVENT_TYPE_TO_CATEGORY: Record<AuditEventType, AuditEventCategory> = {
  contract_created: "lifecycle",
  contract_updated: "lifecycle",
  contract_deleted: "lifecycle",
  status_changed: "lifecycle",
  clause_added: "content",
  clause_removed: "content",
  clause_modified: "content",
  party_added: "content",
  party_removed: "content",
  document_uploaded: "document",
  document_removed: "document",
  approval_requested: "approval",
  approval_granted: "approval",
  approval_rejected: "approval",
  signature_sent: "signature",
  signature_completed: "signature",
  signature_refused: "signature",
  version_created: "lifecycle",
  comment_added: "content",
  renewal_initiated: "lifecycle",
  renewal_completed: "lifecycle",
  obligation_created: "financial",
  obligation_fulfilled: "financial",
  alert_triggered: "system",
  ai_analysis_run: "ai",
  export_generated: "system",
  field_changed: "content",
};

// Descrições legíveis dos eventos
export const EVENT_TYPE_LABELS: Record<AuditEventType, string> = {
  contract_created: "Contrato criado",
  contract_updated: "Contrato atualizado",
  contract_deleted: "Contrato excluído",
  status_changed: "Status alterado",
  clause_added: "Cláusula adicionada",
  clause_removed: "Cláusula removida",
  clause_modified: "Cláusula modificada",
  party_added: "Parte adicionada",
  party_removed: "Parte removida",
  document_uploaded: "Documento anexado",
  document_removed: "Documento removido",
  approval_requested: "Aprovação solicitada",
  approval_granted: "Aprovação concedida",
  approval_rejected: "Aprovação rejeitada",
  signature_sent: "Enviado para assinatura",
  signature_completed: "Assinatura concluída",
  signature_refused: "Assinatura recusada",
  version_created: "Nova versão criada",
  comment_added: "Comentário adicionado",
  renewal_initiated: "Renovação iniciada",
  renewal_completed: "Renovação concluída",
  obligation_created: "Obrigação criada",
  obligation_fulfilled: "Obrigação cumprida",
  alert_triggered: "Alerta disparado",
  ai_analysis_run: "Análise de IA executada",
  export_generated: "Exportação gerada",
  field_changed: "Campo alterado",
};

// ============================================================
// Hook principal: buscar timeline de auditoria
// ============================================================
export function useAuditTimeline(contractId: string, filters?: AuditFilters) {
  return useQuery({
    queryKey: ["audit-timeline", contractId, filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from("contract_audit_trail")
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: false });

      // Aplicar filtros
      if (filters?.categories && filters.categories.length > 0) {
        query = query.in("event_category", filters.categories);
      }
      if (filters?.eventTypes && filters.eventTypes.length > 0) {
        query = query.in("event_type", filters.eventTypes);
      }
      if (filters?.dateFrom) {
        query = query.gte("created_at", filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte("created_at", filters.dateTo);
      }
      if (filters?.userId) {
        query = query.eq("performed_by", filters.userId);
      }
      if (filters?.searchTerm) {
        query = query.ilike("description", `%${filters.searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Mapear colunas do banco para a interface AuditEvent
      return ((data || []) as any[]).map((row) => ({
        id: row.id,
        contract_id: row.contract_id,
        event_type: row.event_type || row.action,
        event_category: row.event_category || EVENT_TYPE_TO_CATEGORY[row.event_type || row.action] || "system",
        description: row.description || row.action || "",
        field_name: row.field_name || row.field_changed,
        old_value: row.old_value,
        new_value: row.new_value,
        user_id: row.user_id || row.performed_by,
        user_name: row.user_name || row.performer_name,
        user_email: row.user_email,
        ip_address: row.ip_address,
        metadata: row.metadata || row.details,
        created_at: row.created_at,
      })) as AuditEvent[];
    },
    enabled: !!contractId,
  });
}

// ============================================================
// Hook: registrar evento de auditoria manualmente
// ============================================================
export function useRegisterAuditEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (event: {
      contract_id: string;
      event_type: AuditEventType;
      description: string;
      field_name?: string;
      old_value?: string;
      new_value?: string;
      metadata?: Record<string, any>;
    }) => {
      const category = EVENT_TYPE_TO_CATEGORY[event.event_type] || "system";

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const { data, error } = await (supabase as any)
        .from("contract_audit_trail")
        .insert({
          contract_id: event.contract_id,
          // Novas colunas (Fase 4)
          event_type: event.event_type,
          event_category: category,
          description: event.description,
          // Colunas legadas (compatibilidade)
          action: event.event_type,
          field_changed: event.field_name,
          performed_by: userId,
          details: event.metadata || {},
          // Colunas compartilhadas
          old_value: event.old_value,
          new_value: event.new_value,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["audit-timeline", variables.contract_id] });
    },
    onError: (error: Error) => {
      console.error("Erro ao registrar evento de auditoria:", error);
    },
  });
}

// ============================================================
// Hook: estatísticas de auditoria
// ============================================================
export function useAuditStats(contractId: string) {
  return useQuery({
    queryKey: ["audit-stats", contractId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contract_audit_trail")
        .select("event_type, event_category, created_at")
        .eq("contract_id", contractId);

      if (error) throw error;

      const events = (data || []) as Array<{ event_type: string; event_category: string; created_at: string }>;

      // Contar por categoria
      const byCategory: Record<string, number> = {};
      const byType: Record<string, number> = {};
      let lastEventDate: string | null = null;

      events.forEach((evt) => {
        byCategory[evt.event_category] = (byCategory[evt.event_category] || 0) + 1;
        byType[evt.event_type] = (byType[evt.event_type] || 0) + 1;
        if (!lastEventDate || evt.created_at > lastEventDate) {
          lastEventDate = evt.created_at;
        }
      });

      return {
        totalEvents: events.length,
        byCategory,
        byType,
        lastEventDate,
        uniqueCategories: Object.keys(byCategory).length,
      };
    },
    enabled: !!contractId,
  });
}

// ============================================================
// Hook: exportar auditoria para CSV
// ============================================================
export function useExportAudit() {
  return useMutation({
    mutationFn: async (contractId: string) => {
      const { data, error } = await (supabase as any)
        .from("contract_audit_trail")
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const events = (data || []) as AuditEvent[];

      // Gerar CSV
      const headers = [
        "Data/Hora",
        "Categoria",
        "Tipo",
        "Descrição",
        "Campo",
        "Valor Anterior",
        "Novo Valor",
        "Usuário",
      ].join(";");

      const rows = events.map((evt) =>
        [
          new Date(evt.created_at).toLocaleString("pt-BR"),
          AUDIT_CATEGORY_CONFIG[evt.event_category]?.label || evt.event_category,
          EVENT_TYPE_LABELS[evt.event_type] || evt.event_type,
          evt.description,
          evt.field_name || "",
          evt.old_value || "",
          evt.new_value || "",
          evt.user_name || evt.user_email || evt.user_id,
        ].join(";")
      );

      const csv = [headers, ...rows].join("\n");
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `auditoria_contrato_${contractId}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      return { totalExported: events.length };
    },
    onSuccess: (result) => {
      toast.success(`Auditoria exportada com ${result.totalExported} eventos`);
    },
    onError: (error: Error) => {
      toast.error("Erro ao exportar auditoria: " + error.message);
    },
  });
}

// ============================================================
// Helper: agrupar eventos por data
// ============================================================
export function groupEventsByDate(events: AuditEvent[]): Record<string, AuditEvent[]> {
  const groups: Record<string, AuditEvent[]> = {};

  events.forEach((event) => {
    const date = new Date(event.created_at).toLocaleDateString("pt-BR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(event);
  });

  return groups;
}

// ============================================================
// Helper: calcular hash SHA-256 para integridade
// ============================================================
export async function calculateAuditHash(events: AuditEvent[]): Promise<string> {
  const payload = events.map((e) => `${e.id}|${e.event_type}|${e.created_at}|${e.description}`).join("\n");
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
