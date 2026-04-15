import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RelationshipReportData {
  // Tickets
  totalTickets: number;
  resolvedTickets: number;
  slaMetCount: number;
  slaBrokenCount: number;
  // Contracts
  totalContracts: number;
  renewalCount: number;
  terminationCount: number;
  // Finance
  overdueInstallments: number;
  overdueAmount: number;
  // Maintenance
  maintenanceOpen: number;
  maintenanceClosed: number;
  // Satisfaction
  npsAverage: number | null;
  totalResponses: number;
  promoters: number;
  detractors: number;
  neutrals: number;
}

export function useRelationshipReports(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["relationship-reports", startDate, endDate],
    queryFn: async (): Promise<RelationshipReportData> => {
      const [ticketsRes, renewalsRes, terminationsRes, installmentsRes, maintenanceRes, responsesRes, contractsRes] = await Promise.all([
        supabase.from("support_tickets").select("id, status, sla_status, created_at", { count: "exact" })
          .gte("created_at", startDate).lte("created_at", endDate),
        supabase.from("contract_renewals").select("id", { count: "exact" })
          .gte("created_at", startDate).lte("created_at", endDate),
        supabase.from("contract_terminations").select("id", { count: "exact" })
          .gte("created_at", startDate).lte("created_at", endDate),
        supabase.from("contract_installments").select("id, amount, status")
          .eq("status", "atrasado"),
        supabase.from("maintenance_requests").select("id, status")
          .gte("created_at", startDate).lte("created_at", endDate),
        (supabase.from as any)("satisfaction_responses").select("score")
          .gte("responded_at", startDate).lte("responded_at", endDate),
        supabase.from("contracts").select("id", { count: "exact" })
          .gte("created_at", startDate).lte("created_at", endDate),
      ]);

      const tickets = (ticketsRes.data ?? []) as any[];
      const overdueInstalls = (installmentsRes.data ?? []) as any[];
      const maint = (maintenanceRes.data ?? []) as any[];
      const responses = (responsesRes.data ?? []) as any[];

      const promoters = responses.filter(r => r.score >= 9).length;
      const detractors = responses.filter(r => r.score <= 6).length;
      const neutrals = responses.length - promoters - detractors;
      const avg = responses.length > 0 ? responses.reduce((s, r) => s + r.score, 0) / responses.length : null;

      return {
        totalTickets: ticketsRes.count ?? tickets.length,
        resolvedTickets: tickets.filter(t => t.status === "resolvido").length,
        slaMetCount: tickets.filter(t => t.sla_status === "dentro").length,
        slaBrokenCount: tickets.filter(t => t.sla_status === "estourado").length,
        totalContracts: contractsRes.count ?? 0,
        renewalCount: renewalsRes.count ?? 0,
        terminationCount: terminationsRes.count ?? 0,
        overdueInstallments: overdueInstalls.length,
        overdueAmount: overdueInstalls.reduce((s: number, i: any) => s + Number(i.amount || 0), 0),
        maintenanceOpen: maint.filter(m => !["concluida", "cancelada"].includes(m.status)).length,
        maintenanceClosed: maint.filter(m => m.status === "concluida").length,
        npsAverage: avg,
        totalResponses: responses.length,
        promoters,
        detractors,
        neutrals,
      };
    },
    enabled: !!startDate && !!endDate,
  });
}
