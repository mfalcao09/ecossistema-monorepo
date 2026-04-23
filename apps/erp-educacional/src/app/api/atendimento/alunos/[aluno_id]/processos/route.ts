/**
 * GET /api/atendimento/alunos/[aluno_id]/processos
 *
 * Lista todos os protocolos (= processos acadêmicos) de um aluno, com o
 * tipo de processo humanizado e dados da conversa de origem.
 *
 * Sprint S4.5 · Etapa 2-B.
 */

import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

type RouteParams = { aluno_id: string };

export const GET = withPermission(
  "contacts",
  "view",
)<RouteParams>(async (_req: NextRequest, ctx) => {
  const { aluno_id } = (await ctx.params) as RouteParams;

  // Confere que o aluno existe
  const { data: aluno, error: alunoErr } = await ctx.supabase
    .from("alunos")
    .select("id, nome, cpf, ra, curso, telefone, email, status")
    .eq("id", aluno_id)
    .maybeSingle();

  if (alunoErr)
    return NextResponse.json({ erro: alunoErr.message }, { status: 500 });
  if (!aluno)
    return NextResponse.json(
      { erro: "aluno não encontrado" },
      { status: 404 },
    );

  // Protocols do aluno + join com tipo + conversation origin
  const { data, error } = await ctx.supabase
    .from("protocols")
    .select(
      `
        id,
        protocol_number,
        subject,
        description,
        status,
        assignee_id,
        created_by,
        resolved_at,
        created_at,
        updated_at,
        conversation_id,
        process_type:atendimento_process_types ( id, key, name )
      `,
    )
    .eq("aluno_id", aluno_id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error)
    return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({
    aluno,
    processos: data ?? [],
  });
});
