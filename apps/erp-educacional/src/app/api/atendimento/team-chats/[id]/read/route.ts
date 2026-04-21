import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/atendimento/team-chats/[id]/read
 *
 * Marca o chat como lido: atualiza last_read_at = NOW() para o agente autenticado.
 */
export const POST = withPermission("team_chats", "view")(async (_req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id: chatId } = await params;

  const { data: agent } = await ctx.supabase
    .from("atendimento_agents")
    .select("id")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (!agent) {
    return NextResponse.json({ erro: "Agente não encontrado." }, { status: 403 });
  }

  const { error } = await ctx.supabase
    .from("team_chat_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("chat_id", chatId)
    .eq("agent_id", agent.id);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
});
