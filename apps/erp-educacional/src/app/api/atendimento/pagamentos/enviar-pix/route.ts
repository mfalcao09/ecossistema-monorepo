/**
 * POST /api/atendimento/pagamentos/enviar-pix
 *
 * Body: { conversation_id: uuid, cobranca_id: uuid }
 *
 * Fluxo:
 *   1. Valida conversation → contact → aluno e que a cobrança é daquele aluno.
 *   2. Idempotência por `Idempotency-Key` header (reusa `@ecossistema/billing`
 *      cache). Mesma chave em <7d → retorna resultado cached sem side-effects.
 *   3. Chama o endpoint Python existente `/api/financeiro/gerar-pix-demanda`
 *      — que lida com mTLS Inter, multa/juros, rate-limit 1-PIX-por-dia.
 *   4. Insere `atendimento_messages` (sender_type='agent', status='pending'),
 *      worker `dispatch-scheduled-messages` pega e envia via Meta (S5).
 *      Realtime `atendimento_messages` já publica — ChatPanel atualiza.
 *
 * Sprint S4.5 · Etapa 2-B.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  checkIdempotency,
  setIdempotency,
} from "@ecossistema/billing";
import { withPermission } from "@/lib/atendimento/permissions";

const postSchema = z.object({
  conversation_id: z.string().uuid(),
  cobranca_id: z.string().uuid(),
});

interface GerarPixResponse {
  pix_copia_cola: string;
  valor: number;
  valido_ate: string;
  dias_atraso: number;
  pix_demanda_id: string;
  ja_existia: boolean;
}

function formatValor(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatData(iso: string): string {
  // ISO 'YYYY-MM-DD' → 'DD/MM/YYYY'
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}

function buildMessageContent(args: {
  alunoNome: string;
  valor: number;
  validoAte: string;
  pixCopiaCola: string;
  pdfUrl: string | null;
  diasAtraso: number;
}): string {
  const primeiro = args.alunoNome.split(" ")[0];
  const parts: string[] = [
    `Olá, ${primeiro}! 👋`,
    "",
    "Aqui está seu PIX para pagamento:",
    "",
    `💰 Valor: R$ ${formatValor(args.valor)}`,
    `📅 Válido até: ${formatData(args.validoAte)}`,
  ];
  if (args.diasAtraso > 0) {
    parts.push(
      `⚠️ ${args.diasAtraso} dia${args.diasAtraso > 1 ? "s" : ""} em atraso — multa/juros já inclusos`,
    );
  }
  parts.push("");
  parts.push(`💚 PIX copia-cola:`);
  parts.push(args.pixCopiaCola);
  if (args.pdfUrl) {
    parts.push("");
    parts.push(`📎 Baixar boleto PDF: ${args.pdfUrl}`);
  }
  parts.push("");
  parts.push("Qualquer dúvida é só responder aqui.");
  return parts.join("\n");
}

export const POST = withPermission(
  "conversations",
  "edit",
)(async (req: NextRequest, ctx) => {
  const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "payload inválido", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { conversation_id, cobranca_id } = parsed.data;

  const idempotencyKey = req.headers.get("idempotency-key")?.trim() ?? "";
  if (idempotencyKey) {
    const cached = await checkIdempotency(idempotencyKey, ctx.supabase);
    if (cached) {
      return NextResponse.json(
        { cached: true, ...(cached.result as Record<string, unknown>) },
        { status: 200 },
      );
    }
  }

  // 1. Valida: conversation → contact → aluno + cobrança pertence ao aluno
  const { data: conv } = await ctx.supabase
    .from("atendimento_conversations")
    .select("id, contact_id, inbox_id")
    .eq("id", conversation_id)
    .maybeSingle();
  if (!conv)
    return NextResponse.json(
      { erro: "conversa não encontrada" },
      { status: 404 },
    );

  const { data: contact } = await ctx.supabase
    .from("atendimento_contacts")
    .select("id, name, aluno_id")
    .eq("id", conv.contact_id)
    .maybeSingle();
  if (!contact?.aluno_id) {
    return NextResponse.json(
      { erro: "contact_sem_aluno" },
      { status: 409 },
    );
  }

  const { data: cobranca } = await ctx.supabase
    .from("cobrancas")
    .select("id, aluno_id, status, bolepix_pdf_url")
    .eq("id", cobranca_id)
    .maybeSingle();
  if (!cobranca)
    return NextResponse.json(
      { erro: "cobrança não encontrada" },
      { status: 404 },
    );
  if (cobranca.aluno_id !== contact.aluno_id) {
    return NextResponse.json(
      { erro: "cobrança não pertence ao aluno desta conversa" },
      { status: 403 },
    );
  }
  if (cobranca.status === "pago" || cobranca.status === "cancelado") {
    return NextResponse.json(
      { erro: `cobrança em status '${cobranca.status}' — não pode reenviar` },
      { status: 409 },
    );
  }

  const { data: aluno } = await ctx.supabase
    .from("alunos")
    .select("id, nome")
    .eq("id", contact.aluno_id)
    .maybeSingle();
  if (!aluno)
    return NextResponse.json(
      { erro: "aluno não encontrado" },
      { status: 500 },
    );

  // 2. Delega emissão PIX ao endpoint Python existente.
  //    Ele já lida com mTLS Inter, multa/juros, idempotência 1-PIX-por-dia.
  const origin = req.nextUrl.origin;
  const pixRes = await fetch(`${origin}/api/financeiro/gerar-pix-demanda`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Passa o cookie de auth pra o Python poder escrever (mesma origem).
      cookie: req.headers.get("cookie") ?? "",
    },
    body: JSON.stringify({
      aluno_id: aluno.id,
      canal: "whatsapp",
      cobranca_id: cobranca.id,
    }),
  });

  if (!pixRes.ok) {
    const msg = await pixRes.text().catch(() => "");
    console.error(
      `[enviar-pix] gerar-pix-demanda falhou (${pixRes.status}): ${msg}`,
    );
    return NextResponse.json(
      {
        erro: "falha ao gerar PIX",
        status: pixRes.status,
        details: msg.slice(0, 500),
      },
      { status: 502 },
    );
  }

  const pix = (await pixRes.json()) as GerarPixResponse;

  // 3. Cria mensagem outbound que o worker dispatch-scheduled-messages
  //    envia via Meta. Status 'pending' é suficiente — ver cron S5.
  const content = buildMessageContent({
    alunoNome: aluno.nome,
    valor: pix.valor,
    validoAte: pix.valido_ate,
    pixCopiaCola: pix.pix_copia_cola,
    pdfUrl: cobranca.bolepix_pdf_url,
    diasAtraso: pix.dias_atraso,
  });

  const { data: message, error: msgErr } = await ctx.supabase
    .from("atendimento_messages")
    .insert({
      conversation_id,
      sender_type: "agent",
      sender_id: ctx.userId,
      message_type: "text",
      content_type: "text",
      content,
      status: "pending",
      metadata: {
        source: "atendimento_pagamentos_enviar_pix",
        cobranca_id: cobranca.id,
        pix_demanda_id: pix.pix_demanda_id,
        valor: pix.valor,
        valido_ate: pix.valido_ate,
      },
    })
    .select()
    .single();

  if (msgErr) {
    console.error(
      `[enviar-pix] falha inserindo atendimento_messages: ${msgErr.message}`,
    );
    return NextResponse.json(
      { erro: "PIX gerado, mas falha ao enfileirar mensagem", details: msgErr.message },
      { status: 500 },
    );
  }

  const result = {
    ok: true,
    ja_existia: pix.ja_existia,
    valor: pix.valor,
    valido_ate: pix.valido_ate,
    dias_atraso: pix.dias_atraso,
    message_id: message?.id,
  };

  if (idempotencyKey) {
    await setIdempotency(idempotencyKey, result, ctx.supabase);
  }

  return NextResponse.json(result, { status: 201 });
});
