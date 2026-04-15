/**
 * usePropertyMatching — Matching Imóvel-Cliente com IA scoring.
 * 100% frontend. Cruza leads (budget, region, interest_type) com properties.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { useMemo } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MatchResult {
  leadId: string;
  leadName: string;
  propertyId: string;
  propertyTitle: string;
  matchScore: number;
  matchFactors: { factor: string; score: number; weight: number }[];
  propertyCity: string;
  propertyNeighborhood: string;
  propertyPrice: number;
  propertyType: string;
  leadBudgetMin: number;
  leadBudgetMax: number;
  leadRegion: string;
}

export interface MatchDashboard {
  totalMatches: number;
  highMatches: number; // score >= 70
  avgScore: number;
  topMatches: MatchResult[];
  matchesByLead: { leadId: string; leadName: string; count: number; bestScore: number }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function num(v: unknown): number { const n = Number(v); return isNaN(n) ? 0 : n; }
function normalize(s: string): string { return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(); }

const QUERY_OPTS = { staleTime: 5 * 60 * 1000, refetchInterval: 10 * 60 * 1000, retry: 1 };

// ─── Data hooks ──────────────────────────────────────────────────────────────

function useActiveLeads() {
  return useQuery({
    queryKey: ["matching-leads"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, budget_min, budget_max, preferred_region, interest_type, status")
        .eq("tenant_id", tenantId)
        .not("status", "in", '("convertido","perdido")')
        .limit(200);
      if (error) throw error;
      return (data || []) as { id: string; name: string; budget_min: unknown; budget_max: unknown; preferred_region: string | null; interest_type: string | null; status: string }[];
    },
    ...QUERY_OPTS,
  });
}

function useAvailableProperties() {
  return useQuery({
    queryKey: ["matching-properties"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("properties")
        .select("id, title, property_type, purpose, sale_price, rental_price, city, neighborhood, area_total, rooms, status")
        .eq("tenant_id", tenantId)
        .eq("status", "disponivel")
        .limit(300);
      if (error) throw error;
      return (data || []) as any[];
    },
    ...QUERY_OPTS,
  });
}

// ─── Matching engine ─────────────────────────────────────────────────────────

function computeMatch(
  lead: { budget_min: unknown; budget_max: unknown; preferred_region: string | null; interest_type: string | null },
  prop: { sale_price: unknown; rental_price: unknown; city: string; neighborhood: string; property_type: string; purpose: string },
): { score: number; factors: { factor: string; score: number; weight: number }[] } {
  const factors: { factor: string; score: number; weight: number }[] = [];

  // Budget match (40% weight)
  const budgetMin = num(lead.budget_min);
  const budgetMax = num(lead.budget_max);
  const propPrice = num(prop.sale_price || prop.rental_price);

  let budgetScore = 50; // default neutral
  if (budgetMin > 0 && budgetMax > 0 && propPrice > 0) {
    if (propPrice >= budgetMin && propPrice <= budgetMax) budgetScore = 100;
    else if (propPrice >= budgetMin * 0.8 && propPrice <= budgetMax * 1.2) budgetScore = 70;
    else if (propPrice < budgetMin * 0.5 || propPrice > budgetMax * 2) budgetScore = 10;
    else budgetScore = 40;
  } else if (budgetMax > 0 && propPrice > 0) {
    budgetScore = propPrice <= budgetMax ? 90 : propPrice <= budgetMax * 1.3 ? 60 : 20;
  }
  factors.push({ factor: "Orçamento", score: budgetScore, weight: 40 });

  // Region match (35% weight)
  let regionScore = 30;
  if (lead.preferred_region) {
    const normRegion = normalize(lead.preferred_region);
    const normCity = normalize(prop.city || "");
    const normNeighborhood = normalize(prop.neighborhood || "");
    if (normRegion.includes(normNeighborhood) || normNeighborhood.includes(normRegion)) regionScore = 100;
    else if (normRegion.includes(normCity) || normCity.includes(normRegion)) regionScore = 70;
    else regionScore = 15;
  }
  factors.push({ factor: "Região", score: regionScore, weight: 35 });

  // Type match (25% weight)
  let typeScore = 50;
  if (lead.interest_type) {
    const normInterest = normalize(lead.interest_type);
    const normType = normalize(prop.property_type || "");
    const normPurpose = normalize(prop.purpose || "");
    if (normInterest.includes(normType) || normType.includes(normInterest)) typeScore = 100;
    else if (normInterest.includes("aluguel") && normPurpose.includes("locacao")) typeScore = 80;
    else if (normInterest.includes("compra") && normPurpose.includes("venda")) typeScore = 80;
    else typeScore = 30;
  }
  factors.push({ factor: "Tipo", score: typeScore, weight: 25 });

  const totalScore = Math.round(factors.reduce((s, f) => s + (f.score * f.weight) / 100, 0));
  return { score: totalScore, factors };
}

// ─── Computed matches ────────────────────────────────────────────────────────

export function usePropertyMatching() {
  const { data: leads, isLoading: leadsLoading } = useActiveLeads();
  const { data: properties, isLoading: propsLoading } = useAvailableProperties();

  const isLoading = leadsLoading || propsLoading;

  const dashboard = useMemo((): MatchDashboard | null => {
    if (!leads || !properties) return null;

    const allMatches: MatchResult[] = [];

    for (const lead of leads) {
      if (!lead.budget_min && !lead.budget_max && !lead.preferred_region && !lead.interest_type) continue;

      for (const prop of properties) {
        const { score, factors } = computeMatch(lead, prop);
        if (score >= 40) {
          allMatches.push({
            leadId: lead.id,
            leadName: lead.name,
            propertyId: prop.id,
            propertyTitle: prop.title,
            matchScore: score,
            matchFactors: factors,
            propertyCity: prop.city,
            propertyNeighborhood: prop.neighborhood,
            propertyPrice: num(prop.sale_price || prop.rental_price),
            propertyType: prop.property_type,
            leadBudgetMin: num(lead.budget_min),
            leadBudgetMax: num(lead.budget_max),
            leadRegion: lead.preferred_region || "",
          });
        }
      }
    }

    allMatches.sort((a, b) => b.matchScore - a.matchScore);
    const topMatches = allMatches.slice(0, 20);
    const highMatches = allMatches.filter(m => m.matchScore >= 70).length;
    const avgScore = allMatches.length > 0 ? Math.round(allMatches.reduce((s, m) => s + m.matchScore, 0) / allMatches.length) : 0;

    // Group by lead
    const leadMap = new Map<string, { name: string; count: number; best: number }>();
    for (const m of allMatches) {
      if (!leadMap.has(m.leadId)) leadMap.set(m.leadId, { name: m.leadName, count: 0, best: 0 });
      const entry = leadMap.get(m.leadId)!;
      entry.count++;
      if (m.matchScore > entry.best) entry.best = m.matchScore;
    }

    const matchesByLead = Array.from(leadMap.entries())
      .map(([leadId, s]) => ({ leadId, leadName: s.name, count: s.count, bestScore: s.best }))
      .sort((a, b) => b.bestScore - a.bestScore)
      .slice(0, 10);

    return { totalMatches: allMatches.length, highMatches, avgScore, topMatches, matchesByLead };
  }, [leads, properties]);

  return { dashboard, isLoading };
}
