import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

/**
 * GET /api/atendimento/team-chats/agents
 *
 * Lista agentes para o seletor do NewChatModal. Usa permissão `team_chats:view`
 * (mais permissiva que `/api/atendimento/users` que exige `users:view`).
 */
export const GET = withPermission("team_chats", "view")(async (_req: NextRequest, ctx) => {
  const { data, error } = await ctx.supabase
    .from("atendimento_agents")
    .select("id, name, email, avatar_url, availability_status")
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ agents: data ?? [] });
});
