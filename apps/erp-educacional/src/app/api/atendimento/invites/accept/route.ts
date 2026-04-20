import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET  /api/atendimento/invites/accept?token=...
 *   → valida token (auth NÃO obrigatória), retorna dados do convite para
 *     renderizar landing de aceite
 *
 * POST /api/atendimento/invites/accept?token=...
 *   (usuário autenticado) → marca invite accepted_at, cria ou atualiza
 *     atendimento_agents com role_id + team_id
 *
 * Rota NÃO usa withPermission — é a porta de entrada.
 */

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ erro: "Token obrigatório." }, { status: 400 });

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("agent_invites")
    .select("id, email, role_id, team_id, expires_at, accepted_at, revoked_at")
    .eq("token", token)
    .maybeSingle();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ erro: "Convite não encontrado." }, { status: 404 });
  if (data.revoked_at) return NextResponse.json({ erro: "Convite revogado." }, { status: 410 });
  if (data.accepted_at) return NextResponse.json({ erro: "Convite já aceito." }, { status: 410 });
  if (data.expires_at < nowIso) return NextResponse.json({ erro: "Convite expirado." }, { status: 410 });

  const { data: role } = await supabase
    .from("agent_roles")
    .select("name")
    .eq("id", data.role_id)
    .maybeSingle();

  return NextResponse.json({
    email: data.email,
    role_name: role?.name ?? null,
    has_team: !!data.team_id,
  });
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ erro: "Token obrigatório." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { erro: "Faça login primeiro para aceitar o convite." },
      { status: 401 },
    );
  }

  const nowIso = new Date().toISOString();

  const { data: invite, error: invErr } = await supabase
    .from("agent_invites")
    .select("id, email, role_id, team_id, expires_at, accepted_at, revoked_at")
    .eq("token", token)
    .maybeSingle();

  if (invErr) return NextResponse.json({ erro: invErr.message }, { status: 500 });
  if (!invite) return NextResponse.json({ erro: "Convite não encontrado." }, { status: 404 });
  if (invite.revoked_at) return NextResponse.json({ erro: "Convite revogado." }, { status: 410 });
  if (invite.accepted_at) return NextResponse.json({ erro: "Convite já aceito." }, { status: 410 });
  if (invite.expires_at < nowIso) return NextResponse.json({ erro: "Convite expirado." }, { status: 410 });

  // Casa email — se user logou com email diferente, rejeita
  const userEmail = user.email?.toLowerCase() ?? "";
  if (userEmail !== invite.email.toLowerCase()) {
    return NextResponse.json(
      { erro: `Convite é para ${invite.email}. Faça login com esse email.` },
      { status: 403 },
    );
  }

  // Upsert agent: se já existe, atualiza role_id; senão cria
  const { data: existing } = await supabase
    .from("atendimento_agents")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  let agentId: string;
  if (existing) {
    const { data: upd, error: updErr } = await supabase
      .from("atendimento_agents")
      .update({ role_id: invite.role_id })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (updErr) return NextResponse.json({ erro: updErr.message }, { status: 500 });
    agentId = upd.id;
  } else {
    const { data: ins, error: insErr } = await supabase
      .from("atendimento_agents")
      .insert({
        user_id: user.id,
        email: invite.email,
        name: user.user_metadata?.full_name ?? invite.email.split("@")[0],
        role_id: invite.role_id,
      })
      .select("id")
      .single();
    if (insErr) return NextResponse.json({ erro: insErr.message }, { status: 500 });
    agentId = ins.id;
  }

  // Vincula à team se houver
  if (invite.team_id) {
    await supabase
      .from("team_members")
      .upsert(
        { team_id: invite.team_id, agent_id: agentId },
        { onConflict: "team_id,agent_id" },
      );
  }

  // Marca convite aceito
  const { error: acceptErr } = await supabase
    .from("agent_invites")
    .update({ accepted_at: nowIso, accepted_by: user.id })
    .eq("id", invite.id);

  if (acceptErr) return NextResponse.json({ erro: acceptErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, agent_id: agentId });
}
