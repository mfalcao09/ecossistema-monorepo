/**
 * /api/atendimento/pagamentos
 *
 * GET  /api/atendimento/pagamentos?conversation_id=<uuid>
 *   — Lista cobranças pendentes do aluno vinculado ao contato da conversa.
 *     Responde 409 `contact_sem_aluno` quando o contato ainda não virou aluno
 *     (frontend usa isso pra desabilitar o botão).
 *
 * POST /api/atendimento/pagamentos/enviar-pix NÃO VIVE AQUI — vive em
 *   /api/atendimento/pagamentos/enviar-pix/route.ts (Next App Router).
 *
 * Sprint S4.5 · Etapa 2-B.
 */

import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

interface CobrancaRow {
  id: string;
  valor: number;
  mes_referencia: string;
  data_vencimento: string;
  status: "gerado" | "enviado" | "pago" | "vencido" | "cancelado";
  bolepix_linha_digitavel: string | null;
  bolepix_pix_copia_cola: string | null;
  bolepix_pdf_url: string | null;
  your_number: string | null;
  created_at: string;
}

interface AlunoBrief {
  id: string;
  nome: string;
  cpf: string;
  ra: string | null;
  curso: string | null;
  telefone: string | null;
}

export const GET = withPermission(
  "conversations",
  "view",
)(async (req: NextRequest, ctx) => {
  const conversationId = req.nextUrl.searchParams.get("conversation_id");
  if (!conversationId) {
    return NextResponse.json(
      { erro: "conversation_id é obrigatório" },
      { status: 400 },
    );
  }

  // 1. Busca conversation → contact → aluno
  const { data: conv, error: convErr } = await ctx.supabase
    .from("atendimento_conversations")
    .select("id, contact_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (convErr)
    return NextResponse.json({ erro: convErr.message }, { status: 500 });
  if (!conv)
    return NextResponse.json(
      { erro: "conversa não encontrada" },
      { status: 404 },
    );

  const { data: contact, error: contactErr } = await ctx.supabase
    .from("atendimento_contacts")
    .select("id, name, aluno_id")
    .eq("id", conv.contact_id)
    .maybeSingle();

  if (contactErr)
    return NextResponse.json({ erro: contactErr.message }, { status: 500 });
  if (!contact?.aluno_id) {
    return NextResponse.json(
      {
        erro: "contact_sem_aluno",
        message:
          "Este contato ainda não está vinculado a um aluno. Avance o lead até 'Matrícula ativa' ou vincule manualmente.",
      },
      { status: 409 },
    );
  }

  // 2. Dados do aluno
  const { data: aluno, error: alunoErr } = await ctx.supabase
    .from("alunos")
    .select("id, nome, cpf, ra, curso, telefone")
    .eq("id", contact.aluno_id)
    .maybeSingle();

  if (alunoErr)
    return NextResponse.json({ erro: alunoErr.message }, { status: 500 });
  if (!aluno)
    return NextResponse.json(
      { erro: "aluno referenciado mas não encontrado" },
      { status: 500 },
    );

  // 3. Cobranças pendentes (status IN gerado, enviado, vencido)
  const { data: cobrancas, error: cobrancasErr } = await ctx.supabase
    .from("cobrancas")
    .select(
      "id, valor, mes_referencia, data_vencimento, status, " +
        "bolepix_linha_digitavel, bolepix_pix_copia_cola, bolepix_pdf_url, your_number, created_at",
    )
    .eq("aluno_id", aluno.id)
    .in("status", ["gerado", "enviado", "vencido"])
    .order("data_vencimento", { ascending: true })
    .limit(50);

  if (cobrancasErr)
    return NextResponse.json({ erro: cobrancasErr.message }, { status: 500 });

  return NextResponse.json({
    aluno: aluno as unknown as AlunoBrief,
    cobrancas: (cobrancas ?? []) as unknown as CobrancaRow[],
  });
});
