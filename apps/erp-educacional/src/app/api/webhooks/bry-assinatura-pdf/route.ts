import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { BryWebhookPayload } from "@/lib/bry/assinatura-pdf";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// ═══════════════════════════════════════════════════════════════════
// POST /api/webhooks/bry-assinatura-pdf
//
// Webhook chamado pela BRy após cada evento de assinatura de PDF.
// Eventos tratados:
//   - CONCLUIDO → salva URL do PDF assinado, marca status='assinado'
//   - CANCELADO / EXPIRADO → marca status='erro' com mensagem
//   - EM_ANDAMENTO → apenas loga (assinatura parcial)
//
// O externalId enviado no submit segue o formato:
//   "{diploma_id}:{tipo}" — ex: "abc-123:historico_escolar_pdf"
//
// Não há CSRF (webhook externo) — skipCSRF implícito (sem protegerRota).
// Segurança: validar header BRy-Signature (HMAC) quando disponível.
// ═══════════════════════════════════════════════════════════════════

export async function POST(request: Request): Promise<NextResponse> {
  let payload: BryWebhookPayload;

  try {
    payload = (await request.json()) as BryWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const { documentId, status, externalId, signedDocumentUrl } = payload;

  // Log para auditoria
  console.log("[Webhook BRy PDF]", { documentId, status, externalId });

  if (!documentId) {
    return NextResponse.json({ error: "documentId ausente" }, { status: 400 });
  }

  // ── Localizar o documento complementar pelo bry_document_id ──
  // Tentativa 1: via externalId ("{diploma_id}:{tipo}")
  // Tentativa 2: busca direta por bry_document_id
  const supabase = await createClient();

  type DocRow = {
    id: string;
    diploma_id: string;
    tipo: string;
    status: string;
  };

  let docRow: DocRow | null = null;

  if (externalId && externalId.includes(":")) {
    const [diplomaId, tipo] = externalId.split(":");
    const { data } = await supabase
      .from("diploma_documentos_complementares")
      .select("id, diploma_id, tipo, status")
      .eq("diploma_id", diplomaId)
      .eq("tipo", tipo)
      .single();
    docRow = data as DocRow | null;
  }

  if (!docRow) {
    const { data } = await supabase
      .from("diploma_documentos_complementares")
      .select("id, diploma_id, tipo, status")
      .eq("bry_document_id", documentId)
      .maybeSingle();
    docRow = data as DocRow | null;
  }

  if (!docRow) {
    // Documento não encontrado — responder 200 para BRy não retentar
    console.warn(
      "[Webhook BRy PDF] documento não encontrado:",
      documentId,
      externalId,
    );
    return NextResponse.json({ ok: true, aviso: "documento não encontrado" });
  }

  // ── Atualizar conforme status ──
  const agora = new Date().toISOString();
  const normalizado = (status ?? "").toUpperCase().replace(/-/g, "_");

  if (
    normalizado === "CONCLUIDO" ||
    normalizado === "SIGNED" ||
    normalizado === "COMPLETED" ||
    normalizado === "FINISHED"
  ) {
    // Todos assinaram — salvar URL do PDF assinado e marcar 'assinado'
    const updates: Record<string, unknown> = {
      status: "assinado",
      assinado_em: agora,
      bry_document_id: documentId,
      bry_webhook_payload: payload,
      updated_at: agora,
    };

    if (signedDocumentUrl) {
      updates.arquivo_assinado_url = signedDocumentUrl;
    }

    await supabase
      .from("diploma_documentos_complementares")
      .update(updates)
      .eq("id", docRow.id);

    // Verificar se todos os docs do diploma foram assinados → avançar status
    await verificarEAvancarStatusDiploma(supabase, docRow.diploma_id);
  } else if (
    normalizado === "CANCELADO" ||
    normalizado === "CANCELED" ||
    normalizado === "CANCELLED"
  ) {
    await supabase
      .from("diploma_documentos_complementares")
      .update({
        status: "erro",
        erro_mensagem: "Assinatura cancelada no BRy",
        bry_webhook_payload: payload,
        updated_at: agora,
      })
      .eq("id", docRow.id);
  } else if (normalizado === "EXPIRADO" || normalizado === "EXPIRED") {
    await supabase
      .from("diploma_documentos_complementares")
      .update({
        status: "erro",
        erro_mensagem: "Prazo de assinatura expirado no BRy",
        bry_webhook_payload: payload,
        updated_at: agora,
      })
      .eq("id", docRow.id);
  } else {
    // EM_ANDAMENTO ou outro — apenas salvar o payload para auditoria
    await supabase
      .from("diploma_documentos_complementares")
      .update({
        bry_document_id: documentId,
        bry_webhook_payload: payload,
        updated_at: agora,
      })
      .eq("id", docRow.id);
  }

  return NextResponse.json({ ok: true });
}

// ── Helper: avançar status do diploma se todos docs estiverem assinados ──
async function verificarEAvancarStatusDiploma(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  diplomaId: string,
): Promise<void> {
  const { data: docs } = await supabase
    .from("diploma_documentos_complementares")
    .select("status")
    .eq("diploma_id", diplomaId);

  if (!docs || docs.length === 0) return;

  const todosAssinados = docs.every(
    (d: { status: string }) => d.status === "assinado",
  );
  if (!todosAssinados) return;

  // Todos assinados → avançar diploma para aguardando_envio_registradora
  const { data: diploma } = await supabase
    .from("diplomas")
    .select("status")
    .eq("id", diplomaId)
    .single();

  if (!diploma) return;

  // Só avança se estiver em aguardando_documentos (não regride outros status)
  const statusQuePermitemAvancar = [
    "aguardando_documentos",
    "documentos_assinados",
  ];
  if (statusQuePermitemAvancar.includes(diploma.status)) {
    await supabase
      .from("diplomas")
      .update({
        status: "aguardando_envio_registradora",
        updated_at: new Date().toISOString(),
      })
      .eq("id", diplomaId);

    console.log(
      `[Webhook BRy PDF] Diploma ${diplomaId} avançado para aguardando_envio_registradora`,
    );
  }
}
