import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDevelopmentDashboard(developmentId?: string) {
  return useQuery({
    queryKey: ["development-dashboard", developmentId],
    enabled: !!developmentId,
    queryFn: async () => {
      const [unitsRes, proposalsRes, contractsRes, tasksRes] = await Promise.all([
        supabase.from("development_units").select("id, status, valor_tabela, price, created_at").eq("development_id", developmentId!),
        supabase.from("development_proposals").select("id, status, valor_total_proposto, broker_person_id, created_at, client_person_id, broker:people!development_proposals_broker_person_id_fkey(full_name)").eq("development_id", developmentId!),
        supabase.from("development_contracts").select("id, status, created_at, proposal_id").order("created_at", { ascending: false }),
        supabase.from("development_tasks").select("id, status, due_date").eq("development_id", developmentId!),
      ]);

      if (unitsRes.error) throw unitsRes.error;
      if (proposalsRes.error) throw proposalsRes.error;
      if (contractsRes.error) throw contractsRes.error;
      if (tasksRes.error) throw tasksRes.error;

      const units = unitsRes.data ?? [];
      const proposals = proposalsRes.data ?? [];
      const contracts = contractsRes.data ?? [];
      const tasks = tasksRes.data ?? [];

      // VGV
      const totalVGV = units.reduce((s, u) => s + (Number(u.valor_tabela) || Number(u.price) || 0), 0);
      const soldUnits = units.filter(u => u.status === "vendido");
      const soldVGV = soldUnits.reduce((s, u) => s + (Number(u.valor_tabela) || Number(u.price) || 0), 0);

      // Conversion
      const approved = proposals.filter(p => p.status === "aprovada").length;
      const conversionRate = proposals.length > 0 ? Math.round((approved / proposals.length) * 100) : 0;

      // Average ticket
      const approvedProposals = proposals.filter(p => p.status === "aprovada");
      const avgTicket = approvedProposals.length > 0
        ? approvedProposals.reduce((s, p) => s + Number(p.valor_total_proposto), 0) / approvedProposals.length
        : 0;

      // Stale units (disponivel for more than 90 days)
      const now = new Date();
      const staleUnits = units.filter(u => {
        if (u.status !== "disponivel") return false;
        const created = new Date(u.created_at);
        const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays > 90;
      });

      // Broker ranking
      const brokerMap = new Map<string, { name: string; count: number; volume: number }>();
      for (const p of approvedProposals) {
        const brokerId = p.broker_person_id || "sem_corretor";
        const brokerName = (p.broker as any)?.full_name || "Sem corretor";
        const existing = brokerMap.get(brokerId) || { name: brokerName, count: 0, volume: 0 };
        existing.count += 1;
        existing.volume += Number(p.valor_total_proposto);
        brokerMap.set(brokerId, existing);
      }
      const brokerRanking = Array.from(brokerMap.values()).sort((a, b) => b.volume - a.volume);

      // Overdue tasks
      const overdueTasks = tasks.filter(t => {
        if (t.status === "concluida") return false;
        if (!t.due_date) return false;
        return new Date(t.due_date) < now;
      });

      // Proposals by month (last 6 months)
      const proposalsByMonth: { month: string; count: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
        const count = proposals.filter(p => p.created_at.startsWith(key)).length;
        proposalsByMonth.push({ month: label, count });
      }

      return {
        totalVGV,
        soldVGV,
        pctVGV: totalVGV > 0 ? Math.round((soldVGV / totalVGV) * 100) : 0,
        totalUnits: units.length,
        availableUnits: units.filter(u => u.status === "disponivel").length,
        soldUnitsCount: soldUnits.length,
        totalProposals: proposals.length,
        approvedProposals: approved,
        conversionRate,
        avgTicket,
        staleUnitsCount: staleUnits.length,
        brokerRanking,
        overdueTasks: overdueTasks.length,
        totalContracts: contracts.length,
        activeContracts: contracts.filter(c => c.status === "ativo").length,
        proposalsByMonth,
      };
    },
  });
}
