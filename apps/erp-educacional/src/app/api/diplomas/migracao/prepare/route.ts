import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verificarAuth } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/diplomas/migracao/prepare
//
// Prepara upload direto ao Supabase Storage em BATCHES.
// Pode ser chamado de duas formas:
//
// 1ª chamada (sem job_id): cria o job e retorna job_id + storage_prefix + session_token
//    Input:  { files: Array<{ pasta; nome }> }
//    Output: { job_id, storage_prefix, session_token, uploads: [...] }
//
// Chamadas subsequentes (com job_id): reutiliza o job existente
//    Input:  { files: [...], job_id, storage_prefix, session_token }
//    Output: { job_id, storage_prefix, session_token, uploads: [...] }
//
// Limite: máx 30 arquivos por chamada (batch). O frontend divide a lista.
//
// Proteção: session_token = HMAC(job_id + user_id) — impede reutilização
// de URLs por outros usuários ou após a sessão.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

const BATCH_SIZE = 30;
const HMAC_SECRET = process.env.MIGRATION_HMAC_SECRET || "fic-diploma-digital-2026";

function gerarSessionToken(jobId: string, userId: string): string {
  return crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(`${jobId}:${userId}`)
    .digest("hex")
    .slice(0, 32);
}

export async function POST(req: NextRequest) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();

  // Ler body
  let files: Array<{ pasta: string; nome: string }>;
  let existingJobId: string | null = null;
  let existingPrefix: string | null = null;
  let existingSessionToken: string | null = null;
  let totalArquivos: number | null = null;

  try {
    const body = await req.json();
    files = body.files;
    existingJobId = body.job_id ?? null;
    existingPrefix = body.storage_prefix ?? null;
    existingSessionToken = body.session_token ?? null;
    totalArquivos = body.total_arquivos ?? null;
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: "Nenhum arquivo informado." }, { status: 400 });
  }

  // Limitar batch size
  if (files.length > BATCH_SIZE) {
    return NextResponse.json(
      { error: `Máximo de ${BATCH_SIZE} arquivos por batch. Recebidos: ${files.length}.` },
      { status: 400 }
    );
  }

  let jobId: string;
  let storagePrefix: string;
  let sessionToken: string;

  if (existingJobId && existingPrefix && existingSessionToken) {
    // ── Chamada subsequente: validar session_token ──
    const expectedToken = gerarSessionToken(existingJobId, auth.userId);
    if (existingSessionToken !== expectedToken) {
      return NextResponse.json(
        { error: "Token de sessão inválido. Não é possível reutilizar URLs de outra sessão." },
        { status: 403 }
      );
    }
    jobId = existingJobId;
    storagePrefix = existingPrefix;
    sessionToken = existingSessionToken;
  } else {
    // ── 1ª chamada: criar job + prefixo ──
    storagePrefix = `uploads/temp/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const { data: job, error: jobErr } = await supabase
      .from("migracao_jobs")
      .insert({
        tipo: "lote",
        status: "pendente",
        arquivo_fonte: `Migração em Pasta (${totalArquivos ?? files.length} arquivos)`,
        criado_por: auth.userId,
      })
      .select("id")
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: "Erro ao criar job." }, { status: 500 });
    }

    jobId = job.id;
    sessionToken = gerarSessionToken(jobId, auth.userId);
  }

  // ── Gerar URLs assinadas em sequência (não paralelo, evita rate limit) ──
  const uploads: Array<{
    pasta: string;
    nome: string;
    path: string;
    signed_url: string | null;
    token: string | null;
    error: string | null;
  }> = [];

  for (const { pasta, nome } of files) {
    const path = `${storagePrefix}/${pasta}/${nome}`;
    const { data, error } = await supabase.storage
      .from("documentos-digitais")
      .createSignedUploadUrl(path);

    if (error || !data) {
      uploads.push({ pasta, nome, path, signed_url: null, token: null, error: error?.message ?? "Erro desconhecido" });
    } else {
      uploads.push({
        pasta,
        nome,
        path,
        signed_url: data.signedUrl,
        token: data.token,
        error: null,
      });
    }
  }

  // Verificar falhas
  const falhas = uploads.filter((u) => u.error);
  if (falhas.length > 0) {
    // Retorna parcial — o frontend pode tentar novamente só as falhas
    return NextResponse.json({
      job_id: jobId,
      storage_prefix: storagePrefix,
      session_token: sessionToken,
      uploads: uploads.filter((u) => !u.error),
      falhas,
      error: `${falhas.length} de ${files.length} URLs falharam.`,
    }, { status: 207 }); // 207 Multi-Status
  }

  return NextResponse.json({
    job_id: jobId,
    storage_prefix: storagePrefix,
    session_token: sessionToken,
    uploads,
  });
}
