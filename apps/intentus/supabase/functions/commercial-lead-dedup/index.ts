/**
 * commercial-lead-dedup — Edge Function para detecção e merge de duplicados.
 * Actions: scan_all, check_duplicate, merge_duplicates, dismiss_duplicate, get_dashboard, get_history
 * v2: CORS fix, auth fix, dismiss, history, pulse events, improved dashboard.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// ─── CORS ────────────────────────────────────────────────────────────────────

const PROD_ORIGINS = [
  "https://intentus-plataform.vercel.app",
  "https://app.intentusrealestate.com.br",
];
const DEV_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const PREVIEW_REGEX = /^https:\/\/intentus-plataform-.+\.vercel\.app$/;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (PROD_ORIGINS.includes(origin)) return true;
  if (DEV_REGEX.test(origin)) return true;
  if (PREVIEW_REGEX.test(origin)) return true;
  const extra = Deno.env.get("ALLOWED_ORIGINS");
  if (extra) {
    for (const o of extra.split(",")) {
      if (o.trim() === origin) return true;
    }
  }
  return false;
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = isAllowedOrigin(origin) ? origin : PROD_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

// ─── Auth ────────────────────────────────────────────────────────────────────

interface AuthContext {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  tenantId: string;
}

async function resolveAuth(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Não autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

  return { supabase, userId: user.id, tenantId: profile.tenant_id };
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface DupRecord {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  cpf_cnpj?: string | null;
  source?: string | null;
  status?: string | null;
  lead_score?: number | null;
  assigned_to?: string | null;
  created_at: string;
  entity_type: "lead" | "person";
}

interface MatchResult {
  score: number;
  matchTypes: string[];
}

// ─── Matching Algorithms ─────────────────────────────────────────────────────

function normalizeStr(s: string): string {
  if (!s) return "";
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function normalizePhone(p: string): string {
  if (!p) return "";
  return p.replace(/\D/g, "").replace(/^55/, "").replace(/^0/, "");
}

function normalizeCpf(d: string): string {
  if (!d) return "";
  return d.replace(/[\.\-\/]/g, "");
}

function levenshtein(a: string, b: string): number {
  const al = a.length, bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  const dp: number[][] = Array.from({ length: al + 1 }, (_, i) => {
    const row = new Array(bl + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= bl; j++) dp[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  const maxLen = Math.max(al, bl);
  return maxLen === 0 ? 1.0 : 1.0 - dp[al][bl] / maxLen;
}

function calcMatchScore(r1: DupRecord, r2: DupRecord): MatchResult {
  let score = 0;
  const matchTypes: string[] = [];

  // CPF/CNPJ (definitivo)
  if (r1.cpf_cnpj && r2.cpf_cnpj) {
    const c1 = normalizeCpf(r1.cpf_cnpj), c2 = normalizeCpf(r2.cpf_cnpj);
    if (c1 && c2 && c1 === c2) { score += 50; matchTypes.push("cpf"); }
  }

  // Email
  if (r1.email && r2.email) {
    if (r1.email.toLowerCase().trim() === r2.email.toLowerCase().trim()) {
      score += 40; matchTypes.push("email");
    }
  }

  // Phone
  if (r1.phone && r2.phone) {
    const p1 = normalizePhone(r1.phone), p2 = normalizePhone(r2.phone);
    if (p1.length >= 10 && p2.length >= 10 && p1 === p2) {
      score += 30; matchTypes.push("phone");
    }
  }

  // Name (Levenshtein)
  if (r1.name && r2.name) {
    const n1 = normalizeStr(r1.name), n2 = normalizeStr(r2.name);
    const sim = levenshtein(n1, n2);

    // Check swapped first/last name
    const parts1 = n1.split(" "), parts2 = n2.split(" ");
    let swapped = false;
    if (parts1.length >= 2 && parts2.length >= 2 &&
        parts1[0] === parts2[parts2.length - 1] &&
        parts1[parts1.length - 1] === parts2[0]) {
      swapped = true;
    }

    if (sim > 0.9) { score += Math.floor(30 * sim); matchTypes.push("name"); }
    else if (sim > 0.8) { score += Math.floor(20 * sim); matchTypes.push("name_fuzzy"); }
    else if (swapped) { score += 15; matchTypes.push("name_swapped"); }
  }

  return { score: Math.min(score, 100), matchTypes };
}

// ─── Union-Find ──────────────────────────────────────────────────────────────

class UnionFind {
  parent: Map<string, string> = new Map();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    if (this.parent.get(x) !== x) this.parent.set(x, this.find(this.parent.get(x)!));
    return this.parent.get(x)!;
  }
  union(a: string, b: string) {
    const pa = this.find(a), pb = this.find(b);
    if (pa !== pb) this.parent.set(pa, pb);
  }
}

// ─── Pulse Event Helper ──────────────────────────────────────────────────────

async function emitPulse(
  sb: ReturnType<typeof createClient>,
  tenantId: string,
  userId: string,
  eventType: string,
  title: string,
  description: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    await sb.from("pulse_events").insert({
      tenant_id: tenantId,
      user_id: userId,
      event_type: eventType,
      title,
      description,
      priority: "medium",
      metadata,
    });
  } catch (_) { /* non-blocking */ }
}

// ─── Main Handler ────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { supabase, userId, tenantId } = await resolveAuth(req);
    const { action, ...params } = await req.json();
    let result: unknown = null;

    // ── Fetch records helper ──
    async function fetchAllRecords(limit = 1000): Promise<DupRecord[]> {
      const [leadsRes, peopleRes] = await Promise.all([
        supabase.from("leads")
          .select("id, name, email, phone, cpf_cnpj, source, status, lead_score, assigned_to, created_at")
          .eq("tenant_id", tenantId)
          .is("is_deleted", null)
          .limit(limit),
        supabase.from("people")
          .select("id, name, email, phone, cpf_cnpj, created_at")
          .eq("tenant_id", tenantId)
          .limit(limit),
      ]);
      if (leadsRes.error) throw leadsRes.error;
      if (peopleRes.error) throw peopleRes.error;
      return [
        ...((leadsRes.data || []) as any[]).map((r: any) => ({ ...r, entity_type: "lead" as const })),
        ...((peopleRes.data || []) as any[]).map((r: any) => ({ ...r, entity_type: "person" as const })),
      ];
    }

    switch (action) {
      // ──────────────────────────────────────────────────────────────────────
      case "scan_all": {
        const allRecords = await fetchAllRecords();
        const minScore = params.min_score || 40;

        // Find matching pairs
        const pairs: Array<{ r1: DupRecord; r2: DupRecord; score: number; matchTypes: string[] }> = [];
        for (let i = 0; i < allRecords.length; i++) {
          for (let j = i + 1; j < allRecords.length; j++) {
            const m = calcMatchScore(allRecords[i], allRecords[j]);
            if (m.score >= minScore && m.matchTypes.length > 0) {
              pairs.push({ r1: allRecords[i], r2: allRecords[j], ...m });
            }
          }
        }

        // Cluster with union-find
        const uf = new UnionFind();
        for (const p of pairs) uf.union(p.r1.id, p.r2.id);

        const clusterMap = new Map<string, DupRecord[]>();
        for (const rec of allRecords) {
          if (!pairs.some(p => p.r1.id === rec.id || p.r2.id === rec.id)) continue;
          const root = uf.find(rec.id);
          if (!clusterMap.has(root)) clusterMap.set(root, []);
          clusterMap.get(root)!.push(rec);
        }

        // Build clusters with scores
        const clusters = [];
        for (const [, records] of clusterMap) {
          if (records.length < 2) continue;
          // Pick best primary (highest score, most data)
          const primary = records.reduce((best, cur) => {
            const bScore = best.lead_score || 0;
            const cScore = cur.lead_score || 0;
            const bData = [best.email, best.phone, best.cpf_cnpj].filter(Boolean).length;
            const cData = [cur.email, cur.phone, cur.cpf_cnpj].filter(Boolean).length;
            return (cScore > bScore || (cScore === bScore && cData > bData)) ? cur : best;
          });

          const duplicates = records.filter(r => r.id !== primary.id).map(dup => {
            const m = calcMatchScore(primary, dup);
            return {
              id: dup.id, name: dup.name, email: dup.email, phone: dup.phone,
              cpf_cnpj: dup.cpf_cnpj, source: dup.source, status: dup.status,
              entity_type: dup.entity_type, created_at: dup.created_at,
              match_types: m.matchTypes, score: m.score,
            };
          });

          const avgScore = Math.round(duplicates.reduce((s, d) => s + d.score, 0) / duplicates.length);
          clusters.push({
            primary_id: primary.id, primary_name: primary.name,
            primary_email: primary.email, primary_phone: primary.phone,
            entity_type: primary.entity_type, cluster_score: avgScore,
            duplicates: duplicates.sort((a, b) => b.score - a.score),
          });
        }

        clusters.sort((a, b) => b.cluster_score - a.cluster_score);

        result = {
          clusters: clusters.slice(0, 50),
          total_clusters: clusters.length,
          total_scanned: allRecords.length,
          scanned_at: new Date().toISOString(),
        };
        break;
      }

      // ──────────────────────────────────────────────────────────────────────
      case "check_duplicate": {
        const { name, email, phone, cpf_cnpj } = params;
        const allRecords = await fetchAllRecords();

        const checkRecord: DupRecord = {
          id: "__check__", name: name || "", email, phone, cpf_cnpj,
          created_at: new Date().toISOString(), entity_type: "lead",
        };

        const matches = [];
        for (const rec of allRecords) {
          const m = calcMatchScore(checkRecord, rec);
          if (m.score > 30 && m.matchTypes.length > 0) {
            matches.push({
              id: rec.id, name: rec.name, email: rec.email, phone: rec.phone,
              cpf_cnpj: rec.cpf_cnpj, entity_type: rec.entity_type,
              source: rec.source, status: rec.status, created_at: rec.created_at,
              match_types: m.matchTypes, score: m.score,
            });
          }
        }

        matches.sort((a, b) => b.score - a.score);
        result = { matches: matches.slice(0, 10), found: matches.length > 0 };
        break;
      }

      // ──────────────────────────────────────────────────────────────────────
      case "merge_duplicates": {
        const { primary_id, duplicate_id, entity_type } = params;
        if (!primary_id || !duplicate_id) throw new Error("primary_id e duplicate_id obrigatórios");

        const table = entity_type === "person" ? "people" : "leads";

        // Fetch both records
        const [primaryRes, dupRes] = await Promise.all([
          supabase.from(table).select("*").eq("id", primary_id).eq("tenant_id", tenantId).maybeSingle(),
          supabase.from(table).select("*").eq("id", duplicate_id).eq("tenant_id", tenantId).maybeSingle(),
        ]);
        if (primaryRes.error) throw primaryRes.error;
        if (dupRes.error) throw dupRes.error;
        if (!primaryRes.data) throw new Error("Registro principal não encontrado");
        if (!dupRes.data) throw new Error("Registro duplicado não encontrado");

        // Merge: fill empty fields on primary with duplicate data
        const primary = primaryRes.data as Record<string, unknown>;
        const dup = dupRes.data as Record<string, unknown>;
        const fillFields = ["email", "phone", "cpf_cnpj", "notes", "preferred_region", "budget_min", "budget_max"];
        const updates: Record<string, unknown> = {};
        for (const f of fillFields) {
          if (!primary[f] && dup[f]) updates[f] = dup[f];
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from(table).update(updates).eq("id", primary_id).eq("tenant_id", tenantId);
        }

        // Move references
        if (entity_type !== "person") {
          await Promise.all([
            supabase.from("deal_requests").update({ lead_id: primary_id }).eq("lead_id", duplicate_id).eq("tenant_id", tenantId),
            supabase.from("interactions").update({ lead_id: primary_id }).eq("lead_id", duplicate_id).eq("tenant_id", tenantId),
            supabase.from("lead_interactions").update({ lead_id: primary_id }).eq("lead_id", duplicate_id),
          ]);
        } else {
          await Promise.all([
            supabase.from("contract_parties").update({ person_id: primary_id }).eq("person_id", duplicate_id).eq("tenant_id", tenantId),
            supabase.from("interactions").update({ person_id: primary_id }).eq("person_id", duplicate_id).eq("tenant_id", tenantId),
          ]);
        }

        // Soft-delete duplicate
        await supabase.from(table).update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        }).eq("id", duplicate_id).eq("tenant_id", tenantId);

        // Log merge in automation_logs
        try {
          await supabase.from("commercial_automation_logs").insert({
            tenant_id: tenantId,
            automation_name: "dedup_merge",
            trigger_event: "manual_merge",
            action_type: "merge_duplicate",
            action_details: { primary_id, duplicate_id, entity_type, fields_merged: Object.keys(updates) },
            status: "completed",
            entity_type: entity_type === "person" ? "person" : "lead",
            entity_id: primary_id,
          });
        } catch (_) { /* non-blocking */ }

        // Pulse event
        await emitPulse(supabase, tenantId, userId, "duplicate_merged",
          "Duplicado mesclado",
          `${(dup as any).name} mesclado com ${(primary as any).name}`,
          { primary_id, duplicate_id, entity_type },
        );

        result = { success: true, merged: { primary_id, duplicate_id, entity_type, fields_filled: Object.keys(updates) } };
        break;
      }

      // ──────────────────────────────────────────────────────────────────────
      case "dismiss_duplicate": {
        const { primary_id, duplicate_id } = params;
        if (!primary_id || !duplicate_id) throw new Error("primary_id e duplicate_id obrigatórios");

        // Log dismissal so it doesn't appear again
        await supabase.from("commercial_automation_logs").insert({
          tenant_id: tenantId,
          automation_name: "dedup_dismiss",
          trigger_event: "manual_dismiss",
          action_type: "dismiss_duplicate",
          action_details: { primary_id, duplicate_id },
          status: "completed",
          entity_type: "lead",
          entity_id: primary_id,
        });

        result = { success: true, dismissed: { primary_id, duplicate_id } };
        break;
      }

      // ──────────────────────────────────────────────────────────────────────
      case "get_dashboard": {
        const allRecords = await fetchAllRecords();

        // Count matches by type
        let emailMatches = 0, phoneMatches = 0, cpfMatches = 0, nameMatches = 0;
        let totalPairs = 0;

        for (let i = 0; i < allRecords.length; i++) {
          for (let j = i + 1; j < allRecords.length; j++) {
            const m = calcMatchScore(allRecords[i], allRecords[j]);
            if (m.score >= 40 && m.matchTypes.length > 0) {
              totalPairs++;
              if (m.matchTypes.includes("cpf")) cpfMatches++;
              if (m.matchTypes.includes("email")) emailMatches++;
              if (m.matchTypes.includes("phone")) phoneMatches++;
              if (m.matchTypes.includes("name") || m.matchTypes.includes("name_fuzzy") || m.matchTypes.includes("name_swapped")) nameMatches++;
            }
          }
        }

        // Recently merged (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const mergedRes = await supabase.from("commercial_automation_logs")
          .select("id", { count: "exact" })
          .eq("tenant_id", tenantId)
          .eq("automation_name", "dedup_merge")
          .gte("created_at", thirtyDaysAgo.toISOString());

        const recentlyMerged = mergedRes.count || 0;

        // Recently dismissed
        const dismissedRes = await supabase.from("commercial_automation_logs")
          .select("id", { count: "exact" })
          .eq("tenant_id", tenantId)
          .eq("automation_name", "dedup_dismiss")
          .gte("created_at", thirtyDaysAgo.toISOString());

        const recentlyDismissed = dismissedRes.count || 0;

        // Data quality score
        const totalRecords = allRecords.length;
        const dataQuality = totalRecords > 0
          ? Math.max(0, Math.round(100 - (totalPairs / totalRecords) * 100))
          : 100;

        // Completeness score
        const withEmail = allRecords.filter(r => r.email).length;
        const withPhone = allRecords.filter(r => r.phone).length;
        const withCpf = allRecords.filter(r => r.cpf_cnpj).length;
        const completeness = totalRecords > 0
          ? Math.round(((withEmail + withPhone + withCpf) / (totalRecords * 3)) * 100)
          : 100;

        result = {
          total_records: totalRecords,
          total_potential_duplicates: totalPairs,
          duplicates_by_type: { email: emailMatches, phone: phoneMatches, cpf: cpfMatches, name: nameMatches },
          recently_merged: recentlyMerged,
          recently_dismissed: recentlyDismissed,
          data_quality_score: dataQuality,
          data_completeness_score: completeness,
          records_with_email: withEmail,
          records_with_phone: withPhone,
          records_with_cpf: withCpf,
        };
        break;
      }

      // ──────────────────────────────────────────────────────────────────────
      case "get_history": {
        const limit = params.limit || 50;
        const { data: logs, error } = await supabase.from("commercial_automation_logs")
          .select("id, automation_name, action_type, action_details, status, created_at, entity_type, entity_id")
          .eq("tenant_id", tenantId)
          .in("automation_name", ["dedup_merge", "dedup_dismiss"])
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) throw error;

        result = { history: logs || [] };
        break;
      }

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[commercial-lead-dedup]", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
