// skills-registry-crud/matcher.ts
// Delegates full-text matching to SQL RPC match_skills_fts.
import type { SupabaseClient } from "../_shared/supabase-admin.ts";

export interface SkillMatch {
  id: string;
  business_id: string;
  name: string;
  version: string;
  description: string | null;
  tags: string[];
  input_schema: unknown;
  output_schema: unknown;
  tool_refs: unknown;
  markdown_path: string | null;
  score: number;
}

export async function matchSkills(
  supabase: SupabaseClient,
  query: string,
  businessId: string,
  limit = 5,
): Promise<SkillMatch[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase.rpc("match_skills_fts", {
    q, biz: businessId, lim: limit,
  });
  if (error) {
    console.error("[skills] rpc failed:", error.message);
    return [];
  }
  return (data ?? []) as SkillMatch[];
}
