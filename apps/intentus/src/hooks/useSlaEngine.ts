/**
 * useSlaEngine — Engine de SLA para tempo de resposta e pipeline.
 * 100% frontend. Monitora tempo de resposta a leads, tempo em cada etapa, alertas de violação.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { useMemo } from "react";
import { differenceInHours, differenceInMinutes } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SlaViolation {
  entityType: "lead" | "deal";
  entityId: string;
  entityName: string;
  slaType: "first_response" | "stage_time" | "follow_up";
  slaTarget: string;
  actual: string;
  severity: "critical" | "warning";
  status: string;
  assignedTo: string | null;
}

export interface SlaKPIs {
  totalViolations: number;
  criticalViolations: number;
  avgFirstResponseMinutes: number;
  firstResponseTarget: number; // minutes
  firstResponseCompliance: number; // %
  avgStageTimeHours: number;
  leadsWithoutResponse: number;
  dealsStalled: number;
}

export interface SlaByBroker {
  userId: string;
  name: string;
  avgResponseMinutes: number;
  violations: number;
  compliance: number;
}

export interface SlaDashboard {
  kpis: SlaKPIs;
  violations: SlaViolation[];
  byBroker: SlaByBroker[];
}

// ─── SLA Targets (configurable defaults) ─────────────────────────────────────

const SLA_FIRST_RESPONSE_MINUTES = 60; // 1 hour
const SLA_STAGE_HOURS: Record<string, number> = {
  rascunho: 48, enviado_juridico: 72, analise_documental: 72, aguardando_documentos: 120,
  parecer_em_elaboracao: 72, minuta_em_elaboracao: 96, em_validacao: 48, ajustes_pendentes: 72,
  aprovado_comercial: 48, contrato_finalizado: 72, em_assinatura: 48,
};
const SLA_FOLLOW_UP_HOURS = 48; // 2 days without contact

// ─── Data hooks ──────────────────────────────────────────────────────────────

const QUERY_OPTS = { staleTime: 3 * 60 * 1000, refetchInterval: 5 * 60 * 1000, retry: 1 };

function useLeadsForSla() {
  return useQuery({
    queryKey: ["sla-leads"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, status, assigned_to, created_at, last_contact_at")
        .eq("tenant_id", tenantId)
        .not("status", "in", '("convertido","perdido")')
        .limit(500);
      if (error) throw error;
      return (data || []) as { id: string; name: string; status: string; assigned_to: string | null; created_at: string; last_contact_at: string | null }[];
    },
    ...QUERY_OPTS,
  });
}

function useDealsForSla() {
  return useQuery({
    queryKey: ["sla-deals"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("deal_requests")
        .select("id, status, assigned_to, updated_at, properties:property_id(title)")
        .eq("tenant_id", tenantId)
        .not("status", "in", '("concluido","cancelado")')
        .limit(500);
      if (error) throw error;
      return (data || []) as any[];
    },
    ...QUERY_OPTS,
  });
}

function useProfilesForSla() {
  return useQuery({
    queryKey: ["sla-profiles"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data } = await supabase.from("profiles").select("user_id, name").eq("tenant_id", tenantId).limit(100);
      return (data || []) as { user_id: string; name: string }[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

// ─── Computed SLA ────────────────────────────────────────────────────────────

export function useSlaEngine() {
  const { data: leads, isLoading: leadsLoading } = useLeadsForSla();
  const { data: deals, isLoading: dealsLoading } = useDealsForSla();
  const { data: profiles } = useProfilesForSla();

  const isLoading = leadsLoading || dealsLoading;

  const dashboard = useMemo((): SlaDashboard | null => {
    if (!leads || !deals) return null;

    const now = new Date();
    const profileMap = new Map<string, string>();
    if (profiles) for (const p of profiles) profileMap.set(p.user_id, p.name);

    const violations: SlaViolation[] = [];
    let totalFirstResponse = 0;
    let firstResponseCount = 0;
    let firstResponseCompliant = 0;
    let leadsWithoutResponse = 0;

    // Lead SLA checks
    for (const lead of leads) {
      const minutesSinceCreation = differenceInMinutes(now, new Date(lead.created_at));

      if (!lead.last_contact_at) {
        // No response yet
        if (minutesSinceCreation > SLA_FIRST_RESPONSE_MINUTES) {
          violations.push({
            entityType: "lead", entityId: lead.id, entityName: lead.name,
            slaType: "first_response", slaTarget: `${SLA_FIRST_RESPONSE_MINUTES}min`,
            actual: `${minutesSinceCreation}min`, severity: minutesSinceCreation > SLA_FIRST_RESPONSE_MINUTES * 4 ? "critical" : "warning",
            status: lead.status, assignedTo: lead.assigned_to ? profileMap.get(lead.assigned_to) || null : null,
          });
        }
        leadsWithoutResponse++;
      } else {
        // Has response — check response time
        const responseMinutes = differenceInMinutes(new Date(lead.last_contact_at), new Date(lead.created_at));
        totalFirstResponse += Math.max(0, responseMinutes);
        firstResponseCount++;
        if (responseMinutes <= SLA_FIRST_RESPONSE_MINUTES) firstResponseCompliant++;

        // Check follow-up SLA
        const hoursSinceContact = differenceInHours(now, new Date(lead.last_contact_at));
        if (hoursSinceContact > SLA_FOLLOW_UP_HOURS) {
          violations.push({
            entityType: "lead", entityId: lead.id, entityName: lead.name,
            slaType: "follow_up", slaTarget: `${SLA_FOLLOW_UP_HOURS}h`,
            actual: `${hoursSinceContact}h`, severity: hoursSinceContact > SLA_FOLLOW_UP_HOURS * 2 ? "critical" : "warning",
            status: lead.status, assignedTo: lead.assigned_to ? profileMap.get(lead.assigned_to) || null : null,
          });
        }
      }
    }

    // Deal SLA checks
    let dealsStalled = 0;
    let totalStageHours = 0;
    let stageCount = 0;

    for (const deal of deals) {
      const hoursInStage = differenceInHours(now, new Date(deal.updated_at));
      const targetHours = SLA_STAGE_HOURS[deal.status] || 72;
      totalStageHours += hoursInStage;
      stageCount++;

      if (hoursInStage > targetHours) {
        dealsStalled++;
        violations.push({
          entityType: "deal", entityId: deal.id, entityName: deal.properties?.title || "Negócio",
          slaType: "stage_time", slaTarget: `${targetHours}h`,
          actual: `${hoursInStage}h`, severity: hoursInStage > targetHours * 2 ? "critical" : "warning",
          status: deal.status, assignedTo: deal.assigned_to ? profileMap.get(deal.assigned_to) || null : null,
        });
      }
    }

    violations.sort((a, b) => (a.severity === "critical" ? 0 : 1) - (b.severity === "critical" ? 0 : 1));

    // Broker breakdown
    const brokerMap = new Map<string, { responses: number[]; violations: number; total: number }>();
    for (const lead of leads) {
      const bId = lead.assigned_to || "unassigned";
      if (!brokerMap.has(bId)) brokerMap.set(bId, { responses: [], violations: 0, total: 0 });
      const b = brokerMap.get(bId)!;
      b.total++;
      if (lead.last_contact_at) {
        b.responses.push(differenceInMinutes(new Date(lead.last_contact_at), new Date(lead.created_at)));
      }
    }
    for (const v of violations) {
      if (v.entityType === "lead" && v.assignedTo) {
        const bId = leads.find((l) => l.id === v.entityId)?.assigned_to || "unassigned";
        const b = brokerMap.get(bId);
        if (b) b.violations++;
      }
    }

    const byBroker: SlaByBroker[] = Array.from(brokerMap.entries())
      .map(([userId, s]) => ({
        userId,
        name: profileMap.get(userId) || "Sem responsável",
        avgResponseMinutes: s.responses.length > 0 ? Math.round(s.responses.reduce((a, b) => a + b, 0) / s.responses.length) : 0,
        violations: s.violations,
        compliance: s.total > 0 ? Math.round(((s.total - s.violations) / s.total) * 100) : 100,
      }))
      .sort((a, b) => b.violations - a.violations);

    const avgFirstResponse = firstResponseCount > 0 ? Math.round(totalFirstResponse / firstResponseCount) : 0;
    const compliance = firstResponseCount > 0 ? Math.round((firstResponseCompliant / firstResponseCount) * 100) : 100;
    const avgStageTime = stageCount > 0 ? Math.round(totalStageHours / stageCount) : 0;

    return {
      kpis: {
        totalViolations: violations.length,
        criticalViolations: violations.filter((v) => v.severity === "critical").length,
        avgFirstResponseMinutes: avgFirstResponse,
        firstResponseTarget: SLA_FIRST_RESPONSE_MINUTES,
        firstResponseCompliance: compliance,
        avgStageTimeHours: avgStageTime,
        leadsWithoutResponse,
        dealsStalled,
      },
      violations: violations.slice(0, 30),
      byBroker,
    };
  }, [leads, deals, profiles]);

  return { dashboard, isLoading };
}
