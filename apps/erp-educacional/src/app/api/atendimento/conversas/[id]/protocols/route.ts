/**
 * GET  /api/atendimento/conversas/[id]/protocols — lista protocolos da conversa
 * POST /api/atendimento/conversas/[id]/protocols — abre novo protocolo
 *
 * Trigger `atnd_s4_bump_protocol_count` incrementa
 * atendimento_conversations.protocol_count automaticamente.
 */

import { NextRequest, NextResponse } from "next/server";
import { protegerRota } from "@/lib/security/api-guard";
import { createAdminClient } from "@/lib/supabase/admin";

function getConversationId(req: NextRequest): string {
  const parts = req.nextUrl.pathname.split("/");
  return parts[parts.length - 2];
}

export const GET = protegerRota(
  async (req: NextRequest, _ctx) => {
    const convId = getConversationId(req);
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("protocols")
      .select(
        "id, protocol_number, subject, description, status, assignee_id, resolved_at, created_by, created_at, " +
          "process_type_id, aluno_id, " +
          "process_type:atendimento_process_types ( id, key, name )",
      )
      .eq("conversation_id", convId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { erro: "Erro ao buscar protocolos" },
        { status: 500 },
      );
    }
    return NextResponse.json({ protocols: data ?? [] });
  },
  { skipCSRF: true },
);

export const POST = protegerRota(
  async (req: NextRequest, ctx) => {
    const convId = getConversationId(req);
    const supabase = createAdminClient();

    let body: {
      subject?: string;
      description?: string;
      assignee_id?: string;
      process_type_id?: string;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
    }

    if (!body.subject?.trim()) {
      return NextResponse.json(
        { erro: "subject obrigatório" },
        { status: 400 },
      );
    }

    // S4.5: auto-vincular aluno_id do contact (se existir)
    const { data: conv } = await supabase
      .from("atendimento_conversations")
      .select("contact_id")
      .eq("id", convId)
      .maybeSingle();

    let alunoId: string | null = null;
    if (conv?.contact_id) {
      const { data: contact } = await supabase
        .from("atendimento_contacts")
        .select("aluno_id")
        .eq("id", conv.contact_id)
        .maybeSingle();
      alunoId = contact?.aluno_id ?? null;
    }

    const { data, error } = await supabase
      .from("protocols")
      .insert({
        conversation_id: convId,
        subject: body.subject,
        description: body.description?.trim() || null,
        assignee_id: body.assignee_id ?? null,
        process_type_id: body.process_type_id ?? null,
        aluno_id: alunoId,
        created_by: ctx.userId,
      })
      .select("*, process_type:atendimento_process_types ( id, key, name )")
      .single();

    if (error || !data) {
      console.error("[POST protocol]", error);
      return NextResponse.json(
        { erro: "Erro ao criar protocolo" },
        { status: 500 },
      );
    }

    return NextResponse.json({ protocol: data }, { status: 201 });
  },
  { skipCSRF: true },
);

export const PATCH = protegerRota(
  async (req: NextRequest, _ctx) => {
    // Resolver / cancelar: ?protocol_id=UUID body { status: 'resolved'|'canceled' }
    const supabase = createAdminClient();
    const protocolId = req.nextUrl.searchParams.get("protocol_id");
    if (!protocolId) {
      return NextResponse.json(
        { erro: "protocol_id obrigatório" },
        { status: 400 },
      );
    }

    let body: { status?: string; resolved_at?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
    }

    const campos: Record<string, unknown> = {};
    if (body.status && ["open", "resolved", "canceled"].includes(body.status)) {
      campos.status = body.status;
      if (body.status === "resolved") {
        campos.resolved_at = body.resolved_at ?? new Date().toISOString();
      }
    }

    if (Object.keys(campos).length === 0) {
      return NextResponse.json(
        { erro: "Nenhum campo válido" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("protocols")
      .update(campos)
      .eq("id", protocolId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { erro: "Erro ao atualizar protocolo" },
        { status: 500 },
      );
    }
    return NextResponse.json({ protocol: data });
  },
  { skipCSRF: true },
);
