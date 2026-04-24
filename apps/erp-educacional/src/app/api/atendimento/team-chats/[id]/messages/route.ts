import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

type Params = { params: Promise<{ id: string }> };

interface CreateMessageBody {
  body: string;
  reply_to_id?: string | null;
  mentions?: string[]; // agent_ids mencionados
  refs?: Array<{
    type: "conversation" | "deal" | "contact";
    id: string;
    label?: string;
  }>;
}

/**
 * GET  /api/atendimento/team-chats/[id]/messages?before=ISO&limit=50
 * POST /api/atendimento/team-chats/[id]/messages       — envia mensagem
 *
 * Autorização: autenticado + membro do chat.
 */

async function assertMember(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  chatId: string,
  userId: string,
) {
  const { data: agent } = await supabase
    .from("atendimento_agents")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!agent) return null;

  const { data: member } = await supabase
    .from("team_chat_members")
    .select("chat_id")
    .eq("chat_id", chatId)
    .eq("agent_id", agent.id)
    .maybeSingle();

  return member ? agent.id : null;
}

export const GET = withPermission(
  "team_chats",
  "view",
)(async (req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id: chatId } = await params;

  const agentId = await assertMember(ctx.supabase, chatId, ctx.userId);
  if (!agentId) {
    return NextResponse.json(
      { erro: "Não é membro desse chat." },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const before = url.searchParams.get("before");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  let query = ctx.supabase
    .from("team_messages")
    .select(
      "id, chat_id, author_id, body, reply_to_id, mentions, refs, reactions, edited_at, deleted_at, created_at, atendimento_agents:author_id(id, name, avatar_url)",
    )
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  // Retorna em ordem cronológica ascendente
  return NextResponse.json({ messages: (data ?? []).reverse() });
});

export const POST = withPermission(
  "team_chats",
  "create",
)(async (req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id: chatId } = await params;

  const agentId = await assertMember(ctx.supabase, chatId, ctx.userId);
  if (!agentId) {
    return NextResponse.json(
      { erro: "Não é membro desse chat." },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as CreateMessageBody | null;
  if (!body?.body || body.body.trim().length === 0) {
    return NextResponse.json({ erro: "body obrigatório." }, { status: 400 });
  }
  if (body.body.length > 8000) {
    return NextResponse.json(
      { erro: "Mensagem maior que 8000 chars." },
      { status: 400 },
    );
  }

  // Valida reply_to_id (se fornecido, deve pertencer ao mesmo chat)
  if (body.reply_to_id) {
    const { data: parent } = await ctx.supabase
      .from("team_messages")
      .select("id, chat_id")
      .eq("id", body.reply_to_id)
      .maybeSingle();
    if (!parent || parent.chat_id !== chatId) {
      return NextResponse.json(
        { erro: "reply_to_id inválido." },
        { status: 400 },
      );
    }
  }

  const mentions = Array.isArray(body.mentions)
    ? body.mentions.filter((x): x is string => typeof x === "string")
    : [];
  const refs = Array.isArray(body.refs)
    ? body.refs
        .filter(
          (r) => r && typeof r.id === "string" && typeof r.type === "string",
        )
        .slice(0, 10)
    : [];

  const { data, error } = await ctx.supabase
    .from("team_messages")
    .insert({
      chat_id: chatId,
      author_id: agentId,
      body: body.body.trim(),
      reply_to_id: body.reply_to_id ?? null,
      mentions,
      refs,
    })
    .select(
      "id, chat_id, author_id, body, reply_to_id, mentions, refs, reactions, created_at",
    )
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  // Atualiza last_read_at do próprio autor (ele acabou de enviar)
  await ctx.supabase
    .from("team_chat_members")
    .update({ last_read_at: data.created_at })
    .eq("chat_id", chatId)
    .eq("agent_id", agentId);

  return NextResponse.json({ message: data }, { status: 201 });
});
