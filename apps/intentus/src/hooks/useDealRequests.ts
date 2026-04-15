import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { createNotification } from "@/hooks/useNotifications";
import { triggerCommercialEvent } from "@/hooks/useCommercialAutomationEngine";
import { emitPulseEvent } from "@/hooks/usePulseFeed";

export type DealRequestStatus = "rascunho" | "enviado_juridico" | "analise_documental" | "aguardando_documentos" | "parecer_em_elaboracao" | "parecer_negativo" | "minuta_em_elaboracao" | "em_validacao" | "ajustes_pendentes" | "aprovado_comercial" | "contrato_finalizado" | "em_assinatura" | "concluido" | "cancelado";
export type DealRequestParty = { person_id: string; role: "locatario" | "comprador" | "proprietario" | "fiador" | "administrador" | "testemunha" };

export interface DealRequestFormData {
  property_id: string; parties: DealRequestParty[]; deal_type: "venda" | "locacao" | "administracao";
  proposed_value?: number; proposed_monthly_value?: number; proposed_start_date?: string; proposed_duration_months?: number;
  payment_terms?: string; guarantee_type?: string; commission_percentage?: number; commercial_notes?: string;
  earnest_money?: number; earnest_money_date?: string; captador_person_id?: string; vendedor_person_id?: string;
}

export function useCreateDealRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: DealRequestFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { data, error } = await supabase.from("deal_requests").insert({
        property_id: form.property_id, deal_type: form.deal_type, status: "enviado_juridico" as any,
        proposed_value: form.proposed_value || null, proposed_monthly_value: form.proposed_monthly_value || null,
        proposed_start_date: form.proposed_start_date || null, proposed_duration_months: form.proposed_duration_months || null,
        payment_terms: form.payment_terms || null, guarantee_type: form.guarantee_type || null,
        commission_percentage: form.commission_percentage || null, commercial_notes: form.commercial_notes || null,
        captador_person_id: form.captador_person_id || null, vendedor_person_id: form.vendedor_person_id || null,
        earnest_money: form.earnest_money || 0, earnest_money_date: form.earnest_money_date || null,
        created_by: user.id, submitted_at: new Date().toISOString(), tenant_id,
      } as any).select().single();
      if (error) throw error;
      if (form.parties.length > 0) {
        const { error: pErr } = await supabase.from("deal_request_parties").insert(form.parties.map((p) => ({ deal_request_id: data.id, person_id: p.person_id, role: p.role, tenant_id })));
        if (pErr) throw pErr;
      }
      await supabase.from("deal_request_history").insert({ deal_request_id: data.id, to_status: "enviado_juridico" as any, notes: "Solicitação enviada ao jurídico pelo comercial.", created_by: user.id, tenant_id });
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["deal-requests"] });
      toast.success("Solicitação enviada com sucesso ao jurídico!");
      // Fire-and-forget: dispara automações comerciais v2
      if (data?.id) {
        triggerCommercialEvent("deal_criado", data.id, "deal", { deal_type: data.deal_type, property_id: data.property_id, status: data.status });
        triggerCommercialEvent("proposta_enviada", data.id, "deal", { deal_type: data.deal_type, property_id: data.property_id, status: data.status });
        // Pulse Feed events
        emitPulseEvent({ event_type: "deal_created", entity_type: "deal", entity_id: data.id, entity_name: (data as any).properties?.title ?? null, metadata: { deal_type: data.deal_type, property_id: data.property_id } });
        emitPulseEvent({ event_type: "proposal_sent", entity_type: "deal", entity_id: data.id, entity_name: (data as any).properties?.title ?? null, metadata: { deal_type: data.deal_type } });
      }
    },
    onError: (err: Error) => toast.error(`Erro ao criar solicitação: ${err.message}`),
  });
}

export function useDealRequests() {
  return useQuery({
    queryKey: ["deal-requests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deal_requests").select(`*, properties:property_id ( id, title ), deal_request_parties ( id, person_id, role, people:person_id ( id, name ) )`).order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

const DEFAULT_SPLITS = { house: 50, captador: 25, vendedor: 25 };
function calcIRRF(base: number): number {
  if (base <= 2259.20) return 0; if (base <= 2826.65) return base * 0.075 - 169.44;
  if (base <= 3751.05) return base * 0.15 - 381.44; if (base <= 4664.68) return base * 0.225 - 662.77;
  return base * 0.275 - 896.00;
}
function calcINSS(base: number): number {
  const cap = 908.85;
  if (base <= 1412.00) return base * 0.075; if (base <= 2666.68) return base * 0.09;
  if (base <= 4000.03) return base * 0.12; return Math.min(base * 0.14, cap);
}

async function generateCommissionSplits(dealId: string, userId: string, overrides?: { house: number; captador: number; vendedor: number }) {
  const { data: existing } = await supabase.from("commission_splits").select("id").eq("deal_request_id", dealId);
  if (existing && existing.length > 0) return;
  const { data: deal, error: dealErr } = await supabase.from("deal_requests").select(`*, deal_request_parties ( id, person_id, role, people:person_id ( id, name ) )`).eq("id", dealId).single();
  if (dealErr || !deal) throw new Error("Negócio não encontrado");
  const commissionPct = deal.commission_percentage || 6;
  const baseValue = deal.deal_type === "locacao" ? Number(deal.proposed_monthly_value || 0) : Number(deal.proposed_value || 0);
  if (baseValue <= 0) return;
  const totalCommission = baseValue * commissionPct / 100;
  const splits = overrides || DEFAULT_SPLITS;
  const parties = deal.deal_request_parties || [];
  const proprietario = parties.find((p: any) => p.role === "proprietario");
  const comprador = parties.find((p: any) => ["comprador", "locatario"].includes(p.role));
  const tenant_id = await getAuthTenantId();
  const roles = [
    { role: "house", percentage: splits.house, person_id: null },
    { role: "captador", percentage: splits.captador, person_id: proprietario?.person_id || null },
    { role: "vendedor", percentage: splits.vendedor, person_id: comprador?.person_id || null },
  ];
  const inserts = roles.filter((r) => r.percentage > 0).map((r) => {
    const calcValue = totalCommission * r.percentage / 100;
    const inss = r.role !== "house" ? calcINSS(calcValue) : 0;
    const irrf = r.role !== "house" ? calcIRRF(calcValue - inss) : 0;
    const netValue = calcValue - inss - irrf;
    return { deal_request_id: dealId, contract_id: null, person_id: r.person_id, role: r.role, percentage: r.percentage, calculated_value: Math.round(calcValue * 100) / 100, tax_inss: Math.round(inss * 100) / 100, tax_irrf: Math.round(irrf * 100) / 100, net_value: Math.round(netValue * 100) / 100, status: "pendente", created_by: userId, tenant_id };
  });
  if (inserts.length > 0) {
    const { error } = await supabase.from("commission_splits").insert(inserts as any);
    if (error) throw error;
  }
}

export function useUpdateDealStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, fromStatus, toStatus, notes, commissionOverrides }: { dealId: string; fromStatus: string; toStatus: string; notes?: string; commissionOverrides?: { house: number; captador: number; vendedor: number } }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      if (toStatus === "aprovado_comercial") {
        const { data: ddChecks } = await supabase.from("due_diligence_checks" as any).select("status").eq("deal_request_id", dealId);
        const hasReprovado = (ddChecks || []).some((c: any) => c.status === "reprovado");
        if (hasReprovado) throw new Error("Existem verificações de due diligence reprovadas. Resolva antes de aprovar.");
      }
      const updatePayload: any = { status: toStatus };
      if (toStatus === "concluido") updatePayload.completed_at = new Date().toISOString();
      const { error: updateErr } = await supabase.from("deal_requests").update(updatePayload).eq("id", dealId);
      if (updateErr) throw updateErr;
      const { error: histErr } = await supabase.from("deal_request_history").insert({ deal_request_id: dealId, from_status: fromStatus as any, to_status: toStatus as any, notes: notes || null, created_by: user.id, tenant_id });
      if (histErr) throw histErr;
      if (toStatus === "concluido") await generateCommissionSplits(dealId, user.id, commissionOverrides);

      // Notify followers + assigned user
      try {
        const { data: deal } = await supabase.from("deal_requests").select("assigned_to, properties:property_id(title)").eq("id", dealId).single();
        const { data: followers } = await supabase.from("deal_request_followers" as any).select("user_id").eq("deal_request_id", dealId);
        const recipientIds = new Set<string>();
        if (deal?.assigned_to && deal.assigned_to !== user.id) recipientIds.add(deal.assigned_to);
        (followers || []).forEach((f: any) => { if (f.user_id !== user.id) recipientIds.add(f.user_id); });
        const dealTitle = (deal?.properties as any)?.title || "Negócio";
        for (const uid of recipientIds) {
          await createNotification({ userId: uid, title: "Negócio movimentado", message: `"${dealTitle}" movido de ${fromStatus} para ${toStatus}`, category: "negocios", referenceType: "deal_request", referenceId: dealId });
        }
      } catch { /* non-blocking */ }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["deal-requests"] }); qc.invalidateQueries({ queryKey: ["deal-request-history", variables.dealId] }); qc.invalidateQueries({ queryKey: ["commission-splits"] }); qc.invalidateQueries({ queryKey: ["commission-splits-all"] });
      toast.success(variables.toStatus === "concluido" ? "Negócio concluído! Comissões geradas automaticamente." : "Status atualizado com sucesso!");
      // Fire-and-forget: automações comerciais v2
      if (variables.dealId) {
        // Sempre dispara deal_movido_pipeline para qualquer mudança de status
        triggerCommercialEvent("deal_movido_pipeline", variables.dealId, "deal", { from_status: variables.fromStatus, to_status: variables.toStatus });
        // Triggers específicos para deal ganho/perdido
        if (variables.toStatus === "concluido") {
          triggerCommercialEvent("deal_ganho", variables.dealId, "deal", { from_status: variables.fromStatus });
        } else if (variables.toStatus === "cancelado") {
          triggerCommercialEvent("deal_perdido", variables.dealId, "deal", { from_status: variables.fromStatus });
        }
        // Pulse Feed events
        emitPulseEvent({ event_type: "deal_stage_changed", entity_type: "deal", entity_id: variables.dealId, metadata: { from_status: variables.fromStatus, to_status: variables.toStatus } });
        if (variables.toStatus === "concluido") {
          emitPulseEvent({ event_type: "deal_won", entity_type: "deal", entity_id: variables.dealId, metadata: { from_status: variables.fromStatus } });
        } else if (variables.toStatus === "cancelado") {
          emitPulseEvent({ event_type: "deal_lost", entity_type: "deal", entity_id: variables.dealId, metadata: { from_status: variables.fromStatus } });
        }
      }
    },
    onError: (err: Error) => toast.error(`Erro ao atualizar status: ${err.message}`),
  });
}

export function useDealRequestHistory(dealId: string) {
  return useQuery({
    queryKey: ["deal-request-history", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_request_history")
        .select("*, profiles:created_by ( name )")
        .eq("deal_request_id", dealId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!dealId,
  });
}

export function useDealRequestComments(dealId: string) {
  return useQuery({
    queryKey: ["deal-request-comments", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_request_comments")
        .select("*, profiles:created_by ( name )")
        .eq("deal_request_id", dealId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!dealId,
  });
}

export function useAddDealComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, message, mentionedUsers, propertyTitle, targetDepartment }: { dealId: string; message: string; mentionedUsers?: string[]; propertyTitle?: string; targetDepartment?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("deal_request_comments").insert({
        deal_request_id: dealId, message, created_by: user.id, tenant_id,
        mentioned_users: mentionedUsers || [],
        target_department: targetDepartment || null,
      } as any);
      if (error) throw error;

      // Create notifications for mentioned users
      if (mentionedUsers && mentionedUsers.length > 0) {
        const { data: authorProfile } = await supabase.from("profiles").select("name").eq("user_id", user.id).single();
        const authorName = authorProfile?.name || "Alguém";
        for (const uid of mentionedUsers) {
          if (uid !== user.id) {
            await createNotification({
              userId: uid, title: "Você foi mencionado",
              message: `Mencionado por ${authorName} em ${propertyTitle || "um negócio"}`,
              category: "negocios", referenceType: "deal_request", referenceId: dealId,
            });
          }
        }
      }
    },
    onSuccess: (_data, variables) => { qc.invalidateQueries({ queryKey: ["deal-request-comments", variables.dealId] }); toast.success("Mensagem enviada!"); },
    onError: (err: Error) => toast.error(`Erro ao enviar mensagem: ${err.message}`),
  });
}

export function useTenantProfiles() {
  return useQuery({
    queryKey: ["tenant-profiles"],
    queryFn: async () => {
      const tenant_id = await getAuthTenantId();
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name")
        .eq("tenant_id", tenant_id)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}
