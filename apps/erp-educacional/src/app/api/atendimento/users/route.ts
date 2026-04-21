import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

/**
 * GET /api/atendimento/users
 *   → lista agents com role + teams vinculados
 */

export const GET = withPermission("users", "view")(async (_req: NextRequest, ctx) => {
  const { data: agents, error } = await ctx.supabase
    .from("atendimento_agents")
    .select(
      "id, user_id, name, email, avatar_url, availability_status, role_id, created_at, " +
        "role:role_id(id, name, is_system)",
    )
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  // Teams por agent (agregado em uma só query)
  const agentIds = (agents ?? []).map((a) => a.id);
  const { data: memberships } = agentIds.length
    ? await ctx.supabase
        .from("team_members")
        .select("agent_id, teams:team_id(id, name, color_hex)")
        .in("agent_id", agentIds)
    : { data: [] as Array<{ agent_id: string; teams: { id: string; name: string; color_hex: string | null } | null }> };

  const teamsByAgent = new Map<string, Array<{ id: string; name: string; color_hex: string | null }>>();
  for (const m of memberships ?? []) {
    if (!m.teams) continue;
    const arr = teamsByAgent.get(m.agent_id) ?? [];
    arr.push(m.teams);
    teamsByAgent.set(m.agent_id, arr);
  }

  const users = (agents ?? []).map((a) => ({
    ...a,
    teams: teamsByAgent.get(a.id) ?? [],
  }));

  return NextResponse.json({ users });
});
