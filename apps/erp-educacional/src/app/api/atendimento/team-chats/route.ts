import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

/**
 * GET  /api/atendimento/team-chats  — lista chats do agente autenticado (DM, group, team)
 * POST /api/atendimento/team-chats  — cria chat (dm, group ou team)
 *
 * Body POST:
 *   {
 *     kind:     "dm" | "group" | "team",
 *     title?:   string,              // obrigatório p/ group e team (snapshot)
 *     team_id?: string,              // obrigatório se kind="team"
 *     member_agent_ids: string[]     // agents participantes (exceto criador, que é adicionado automaticamente)
 *   }
 *
 * Para kind="team": member_agent_ids é ignorado e substituído pelos team_members.
 */

interface CreateChatBody {
  kind: "dm" | "group" | "team";
  title?: string;
  team_id?: string;
  member_agent_ids?: string[];
}

export const GET = withPermission("team_chats", "view")(async (_req: NextRequest, ctx) => {
  // Resolve agent_id do usuário
  const { data: agent } = await ctx.supabase
    .from("atendimento_agents")
    .select("id")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (!agent) {
    return NextResponse.json({ chats: [] });
  }

  // Chats em que o agent é membro
  const { data: memberships, error: memErr } = await ctx.supabase
    .from("team_chat_members")
    .select("chat_id, last_read_at, muted")
    .eq("agent_id", agent.id);

  if (memErr) return NextResponse.json({ erro: memErr.message }, { status: 500 });
  const chatIds = (memberships ?? []).map((m) => m.chat_id);

  if (chatIds.length === 0) {
    return NextResponse.json({ chats: [], agent_id: agent.id });
  }

  const { data: chats, error: chatsErr } = await ctx.supabase
    .from("team_chats")
    .select("id, kind, team_id, title, created_by, last_message_at, created_at, teams:team_id(id, name, color_hex)")
    .in("id", chatIds)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (chatsErr) return NextResponse.json({ erro: chatsErr.message }, { status: 500 });

  // Para cada chat: membros + unread_count
  const results = await Promise.all(
    (chats ?? []).map(async (c) => {
      const membership = memberships!.find((m) => m.chat_id === c.id)!;

      const [membersRes, unreadRes, lastMsgRes] = await Promise.all([
        ctx.supabase
          .from("team_chat_members")
          .select("agent_id, last_read_at, muted, atendimento_agents:agent_id(id, name, email, avatar_url, availability_status)")
          .eq("chat_id", c.id),
        ctx.supabase
          .from("team_messages")
          .select("id", { count: "exact", head: true })
          .eq("chat_id", c.id)
          .gt("created_at", membership.last_read_at)
          .neq("author_id", agent.id),
        ctx.supabase
          .from("team_messages")
          .select("id, body, author_id, created_at, deleted_at")
          .eq("chat_id", c.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      return {
        ...c,
        members: membersRes.data ?? [],
        unread_count: unreadRes.count ?? 0,
        muted: membership.muted,
        last_read_at: membership.last_read_at,
        last_message: lastMsgRes.data ?? null,
      };
    }),
  );

  return NextResponse.json({ chats: results, agent_id: agent.id });
});

export const POST = withPermission("team_chats", "create")(async (req: NextRequest, ctx) => {
  const body = (await req.json().catch(() => null)) as CreateChatBody | null;
  if (!body) return NextResponse.json({ erro: "Body inválido." }, { status: 400 });
  if (!["dm", "group", "team"].includes(body.kind)) {
    return NextResponse.json({ erro: "kind inválido." }, { status: 400 });
  }

  // Resolve agent do criador
  const { data: creator } = await ctx.supabase
    .from("atendimento_agents")
    .select("id")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (!creator) {
    return NextResponse.json({ erro: "Usuário não vinculado a um agente." }, { status: 403 });
  }

  // Valida membros
  let memberIds: string[] = Array.isArray(body.member_agent_ids) ? [...body.member_agent_ids] : [];

  if (body.kind === "team") {
    if (!body.team_id) {
      return NextResponse.json({ erro: "team_id obrigatório para kind=team." }, { status: 400 });
    }
    // Checa se o team existe
    const { data: team } = await ctx.supabase
      .from("teams")
      .select("id, name")
      .eq("id", body.team_id)
      .maybeSingle();
    if (!team) return NextResponse.json({ erro: "Equipe não encontrada." }, { status: 404 });

    // Se já existe um team_chat para esse team_id, retorna o existente (idempotente)
    const { data: existing } = await ctx.supabase
      .from("team_chats")
      .select("id")
      .eq("kind", "team")
      .eq("team_id", body.team_id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ chat: existing, reused: true });
    }

    // Popula com os team_members
    const { data: tms } = await ctx.supabase
      .from("team_members")
      .select("agent_id")
      .eq("team_id", body.team_id);
    memberIds = (tms ?? []).map((m) => m.agent_id);
    // Inclui o criador
    if (!memberIds.includes(creator.id)) memberIds.push(creator.id);
  } else if (body.kind === "dm") {
    if (memberIds.length !== 1) {
      return NextResponse.json({ erro: "DM requer exatamente 1 outro member_agent_ids." }, { status: 400 });
    }
    if (memberIds[0] === creator.id) {
      return NextResponse.json({ erro: "Não é possível iniciar DM consigo mesmo." }, { status: 400 });
    }

    // Busca DM existente entre os 2 (idempotente)
    const { data: myDms } = await ctx.supabase
      .from("team_chat_members")
      .select("chat_id, team_chats!inner(kind)")
      .eq("agent_id", creator.id);
    const myDmIds = (myDms ?? [])
      .filter((r: { team_chats?: unknown }) => {
        const tc = r.team_chats as { kind?: string } | { kind?: string }[] | undefined;
        if (!tc) return false;
        const kind = Array.isArray(tc) ? tc[0]?.kind : tc.kind;
        return kind === "dm";
      })
      .map((r) => r.chat_id);

    if (myDmIds.length > 0) {
      const { data: peerIn } = await ctx.supabase
        .from("team_chat_members")
        .select("chat_id")
        .eq("agent_id", memberIds[0])
        .in("chat_id", myDmIds);
      if ((peerIn ?? []).length > 0) {
        return NextResponse.json({ chat: { id: peerIn![0].chat_id }, reused: true });
      }
    }

    memberIds.push(creator.id);
  } else {
    // group
    if (!body.title || body.title.trim().length < 2) {
      return NextResponse.json({ erro: "title obrigatório para group." }, { status: 400 });
    }
    if (!memberIds.includes(creator.id)) memberIds.push(creator.id);
  }

  // Cria o chat
  const { data: chat, error: chatErr } = await ctx.supabase
    .from("team_chats")
    .insert({
      kind: body.kind,
      title: body.title?.trim() || null,
      team_id: body.kind === "team" ? body.team_id : null,
      created_by: creator.id,
    })
    .select("id, kind, team_id, title, created_by, created_at")
    .single();

  if (chatErr || !chat) {
    return NextResponse.json({ erro: chatErr?.message ?? "Erro ao criar chat." }, { status: 500 });
  }

  // Insere membros (dedup)
  const uniqueMembers = Array.from(new Set(memberIds));
  const rows = uniqueMembers.map((agent_id) => ({ chat_id: chat.id, agent_id }));
  const { error: memErr } = await ctx.supabase.from("team_chat_members").insert(rows);

  if (memErr) {
    // Compensação mínima: deleta o chat
    await ctx.supabase.from("team_chats").delete().eq("id", chat.id);
    return NextResponse.json({ erro: memErr.message }, { status: 500 });
  }

  return NextResponse.json({ chat, members: uniqueMembers }, { status: 201 });
});
