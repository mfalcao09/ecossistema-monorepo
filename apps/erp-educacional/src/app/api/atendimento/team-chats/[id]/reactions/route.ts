import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

type Params = { params: Promise<{ id: string }> };

interface ReactionBody {
  message_id: string;
  emoji: string;
  toggle?: boolean; // default true: adiciona se ausente, remove se presente
}

/**
 * POST /api/atendimento/team-chats/[id]/reactions
 *
 * Body: { message_id, emoji, toggle? }
 *
 * Atualiza `reactions` JSONB da mensagem (add/remove agent_id do array do emoji).
 * Faz read-modify-write — aceitável para chat interno (não é hot path).
 */
export const POST = withPermission("team_chats", "create")(async (req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id: chatId } = await params;

  const body = (await req.json().catch(() => null)) as ReactionBody | null;
  if (!body?.message_id || !body?.emoji) {
    return NextResponse.json({ erro: "message_id e emoji obrigatórios." }, { status: 400 });
  }
  if (body.emoji.length > 8) {
    return NextResponse.json({ erro: "emoji inválido." }, { status: 400 });
  }

  const { data: agent } = await ctx.supabase
    .from("atendimento_agents")
    .select("id")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!agent) {
    return NextResponse.json({ erro: "Agente não encontrado." }, { status: 403 });
  }

  // Checa que é membro do chat
  const { data: member } = await ctx.supabase
    .from("team_chat_members")
    .select("chat_id")
    .eq("chat_id", chatId)
    .eq("agent_id", agent.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ erro: "Não é membro desse chat." }, { status: 403 });
  }

  // Busca a mensagem
  const { data: msg } = await ctx.supabase
    .from("team_messages")
    .select("id, reactions, chat_id")
    .eq("id", body.message_id)
    .maybeSingle();
  if (!msg || msg.chat_id !== chatId) {
    return NextResponse.json({ erro: "Mensagem não encontrada." }, { status: 404 });
  }

  const reactions = (typeof msg.reactions === "object" && msg.reactions !== null
    ? msg.reactions
    : {}) as Record<string, string[]>;
  const existing = Array.isArray(reactions[body.emoji]) ? reactions[body.emoji] : [];

  const has = existing.includes(agent.id);
  const toggle = body.toggle ?? true;

  let nextArr: string[];
  if (has && toggle) {
    nextArr = existing.filter((id) => id !== agent.id);
  } else if (!has) {
    nextArr = [...existing, agent.id];
  } else {
    nextArr = existing;
  }

  const nextReactions: Record<string, string[]> = { ...reactions };
  if (nextArr.length === 0) {
    delete nextReactions[body.emoji];
  } else {
    nextReactions[body.emoji] = nextArr;
  }

  const { error } = await ctx.supabase
    .from("team_messages")
    .update({ reactions: nextReactions })
    .eq("id", body.message_id);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ reactions: nextReactions });
});
