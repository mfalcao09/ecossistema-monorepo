/**
 * API Route — Seleção de Documentos Comprobatórios para Diploma Digital (Bug #F)
 *
 * GET    /api/processos/[id]/documentos-comprobatorios
 *   Lista TODOS os arquivos do processo (processo_arquivos) + sua seleção
 *   atual em diploma_documentos_comprobatorios (LEFT JOIN). Inclui:
 *     - tipo_xsd_sugerido (heurística por nome/tipo_documento)
 *     - signed URL (1h) para preview no front
 *     - flag selecionado + objeto Selecao com PDF/A status
 *
 * POST   /api/processos/[id]/documentos-comprobatorios
 *   Cria uma seleção. Body:
 *     {
 *       arquivo_origem_id: uuid,
 *       tipo_xsd: TipoDocumentoComprobatorio,
 *       numero_documento?: string|null,
 *       orgao_emissor?: string|null,
 *       uf_emissor?: string|null,    // 2 chars
 *       data_expedicao?: string|null, // YYYY-MM-DD
 *       observacao?: string|null      // até 500 chars (vai pro XML)
 *     }
 *   Falha 409 se já existe seleção ATIVA (sem deleted_at) para este arquivo.
 *
 * DELETE /api/processos/[id]/documentos-comprobatorios?ddc_id=uuid
 *   Soft-delete da seleção (UPDATE deleted_at=now(), deleted_by=auth.userId).
 *   NUNCA deleta o arquivo de origem.
 *
 * Padrões aplicados (ver memórias):
 * - skipCSRF: true em todas as mutations (feedback_csrf_skip)
 * - cache: 'no-store' implícito via NextResponse + dynamic
 * - Soft-delete via deleted_at (NEVER hard-delete em audit table)
 * - protegerRota com AuthContext propagado
 * - Service-role admin client para storage signed URLs
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  protegerRota,
  erroNaoEncontrado,
  erroInterno,
} from "@/lib/security/api-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// ── Constantes XSD v1.05 ──────────────────────────────────────────────────────

const TIPO_XSD_VALUES = [
  "DocumentoIdentidadeDoAluno",
  "ProvaConclusaoEnsinoMedio",
  "ProvaColacao",
  "ComprovacaoEstagioCurricular",
  "CertidaoNascimento",
  "CertidaoCasamento",
  "TituloEleitor",
  "AtoNaturalizacao",
  "Outros",
] as const;

type TipoXsd = (typeof TIPO_XSD_VALUES)[number];

const MINIMO_COMPROBATORIOS_XSD = 1;

// ── Heurística de tipo sugerido (nome + tipo_documento da IA) ────────────────

function sugerirTipoXsd(
  nomeOriginal: string,
  tipoDocumento: string | null
): TipoXsd {
  const haystack = `${nomeOriginal} ${tipoDocumento ?? ""}`.toLowerCase();

  if (/\b(rg|cnh|identidade|cpf|passaporte)\b/.test(haystack))
    return "DocumentoIdentidadeDoAluno";
  if (/(hist[oó]rico|ensino\s*m[eé]dio|conclus[aã]o)/.test(haystack))
    return "ProvaConclusaoEnsinoMedio";
  if (/(cola[cç][aã]o|ata\s*de\s*cola)/.test(haystack)) return "ProvaColacao";
  if (/(est[aá]gio)/.test(haystack)) return "ComprovacaoEstagioCurricular";
  if (/(certid[aã]o.*nasc|nascimento)/.test(haystack))
    return "CertidaoNascimento";
  if (/(certid[aã]o.*casamento|casamento)/.test(haystack))
    return "CertidaoCasamento";
  if (/(t[ií]tulo.*eleitor|eleitor)/.test(haystack)) return "TituloEleitor";
  if (/(naturaliza)/.test(haystack)) return "AtoNaturalizacao";
  return "Outros";
}

// ── Admin client (service-role) — só para signed URLs do storage ─────────────

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY/URL ausentes — necessárias para signed URLs de comprobatórios"
    );
  }
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── Helpers de validação inline (sem Zod aqui pra evitar import) ─────────────

function ehTipoXsdValido(v: unknown): v is TipoXsd {
  return typeof v === "string" && (TIPO_XSD_VALUES as readonly string[]).includes(v);
}

function ehUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

function normalizarOpcional(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

// ── GET ───────────────────────────────────────────────────────────────────────

async function handlerGET(
  request: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _auth: { userId: string; tenantId: string; email: string }
): Promise<NextResponse> {
  // Pega o id do processo do pathname (segmento posterior a "processos")
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const idx = segments.indexOf("processos");
  const processoId = idx >= 0 ? segments[idx + 1] : null;

  if (!processoId || !ehUuid(processoId)) {
    return NextResponse.json(
      { error: "processo_id inválido" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // 1. Verifica que o processo existe
  const { data: processo, error: procErr } = await supabase
    .from("processos_diploma")
    .select("id")
    .eq("id", processoId)
    .maybeSingle();

  if (procErr) {
    console.error("[documentos-comprobatorios GET] erro processo:", procErr);
    return erroInterno();
  }
  if (!processo) return erroNaoEncontrado();

  // 2. Lista arquivos do processo
  const { data: arquivos, error: arqErr } = await supabase
    .from("processo_arquivos")
    .select(
      "id, nome_original, tipo_documento, mime_type, tamanho_bytes, storage_path, created_at"
    )
    .eq("processo_id", processoId)
    .order("created_at", { ascending: false });

  if (arqErr) {
    console.error("[documentos-comprobatorios GET] erro arquivos:", arqErr);
    return erroInterno();
  }

  // 3. Lista seleções ativas (deleted_at IS NULL)
  const { data: selecoes, error: selErr } = await supabase
    .from("diploma_documentos_comprobatorios")
    .select(
      "id, arquivo_origem_id, tipo_xsd, numero_documento, orgao_emissor, uf_emissor, data_expedicao, observacao, pdfa_converted_at, pdfa_validation_ok, selecionado_em"
    )
    .eq("processo_id", processoId)
    .is("deleted_at", null);

  if (selErr) {
    console.error("[documentos-comprobatorios GET] erro selecoes:", selErr);
    return erroInterno();
  }

  // 4. Index por arquivo_origem_id
  const selecoesPorArquivo = new Map<string, (typeof selecoes)[number]>();
  for (const s of selecoes ?? []) {
    selecoesPorArquivo.set(s.arquivo_origem_id, s);
  }

  // 5. Signed URLs (1h) — paralelo
  const admin = getAdminClient();
  const itens = await Promise.all(
    (arquivos ?? []).map(async (arq) => {
      let urlPreview: string | null = null;
      try {
        const { data: urlData } = await admin.storage
          .from("documentos")
          .createSignedUrl(arq.storage_path, 3600);
        urlPreview = urlData?.signedUrl ?? null;
      } catch (err) {
        console.warn(
          "[documentos-comprobatorios GET] signed url falhou para",
          arq.id,
          err
        );
      }

      const selecao = selecoesPorArquivo.get(arq.id) ?? null;

      return {
        arquivo: {
          id: arq.id,
          nome_original: arq.nome_original,
          tipo_documento: arq.tipo_documento,
          mime_type: arq.mime_type,
          tamanho_bytes: arq.tamanho_bytes ?? 0,
          created_at: arq.created_at,
          url_preview: urlPreview,
        },
        tipo_xsd_sugerido: sugerirTipoXsd(arq.nome_original, arq.tipo_documento),
        selecao,
        selecionado: selecao !== null,
      };
    })
  );

  const totalSelecionados = itens.filter((i) => i.selecionado).length;

  return NextResponse.json({
    processo_id: processoId,
    total_arquivos: itens.length,
    total_selecionados: totalSelecionados,
    minimo_exigido: MINIMO_COMPROBATORIOS_XSD,
    atende_minimo: totalSelecionados >= MINIMO_COMPROBATORIOS_XSD,
    itens,
  });
}

// ── POST ──────────────────────────────────────────────────────────────────────

async function handlerPOST(
  request: NextRequest,
  auth: { userId: string; tenantId: string; email: string }
): Promise<NextResponse> {
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const idx = segments.indexOf("processos");
  const processoId = idx >= 0 ? segments[idx + 1] : null;

  if (!processoId || !ehUuid(processoId)) {
    return NextResponse.json(
      { error: "processo_id inválido" },
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Body JSON inválido" },
      { status: 400 }
    );
  }

  const arquivoOrigemId = body.arquivo_origem_id;
  const tipoXsd = body.tipo_xsd;

  if (!ehUuid(arquivoOrigemId)) {
    return NextResponse.json(
      { error: "arquivo_origem_id inválido" },
      { status: 400 }
    );
  }
  if (!ehTipoXsdValido(tipoXsd)) {
    return NextResponse.json(
      {
        error: "tipo_xsd inválido",
        detalhes: `Esperado um de: ${TIPO_XSD_VALUES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const numeroDocumento = normalizarOpcional(body.numero_documento, 50);
  const orgaoEmissor = normalizarOpcional(body.orgao_emissor, 50);
  const ufEmissorRaw = normalizarOpcional(body.uf_emissor, 2);
  const ufEmissor = ufEmissorRaw ? ufEmissorRaw.toUpperCase() : null;
  const dataExpedicao = normalizarOpcional(body.data_expedicao, 10);
  const observacao = normalizarOpcional(body.observacao, 500);

  // Valida formato data
  if (dataExpedicao && !/^\d{4}-\d{2}-\d{2}$/.test(dataExpedicao)) {
    return NextResponse.json(
      { error: "data_expedicao deve estar em YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Verifica que o arquivo pertence ao processo (não é outro processo)
  const { data: arquivo, error: arqErr } = await supabase
    .from("processo_arquivos")
    .select("id, processo_id")
    .eq("id", arquivoOrigemId)
    .maybeSingle();

  if (arqErr) {
    console.error("[documentos-comprobatorios POST] erro arquivo:", arqErr);
    return erroInterno();
  }
  if (!arquivo || arquivo.processo_id !== processoId) {
    return NextResponse.json(
      { error: "Arquivo não pertence a este processo" },
      { status: 404 }
    );
  }

  // Verifica que não existe seleção ATIVA para este arquivo
  const { data: existente } = await supabase
    .from("diploma_documentos_comprobatorios")
    .select("id")
    .eq("processo_id", processoId)
    .eq("arquivo_origem_id", arquivoOrigemId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existente) {
    return NextResponse.json(
      {
        error: "Já existe seleção ativa para este arquivo",
        detalhes:
          "Use DELETE para remover a seleção atual antes de criar outra (ou edite via DELETE+POST).",
        ddc_id: existente.id,
      },
      { status: 409 }
    );
  }

  // Insert
  const { data: inserido, error: insErr } = await supabase
    .from("diploma_documentos_comprobatorios")
    .insert({
      processo_id: processoId,
      arquivo_origem_id: arquivoOrigemId,
      tipo_xsd: tipoXsd,
      numero_documento: numeroDocumento,
      orgao_emissor: orgaoEmissor,
      uf_emissor: ufEmissor,
      data_expedicao: dataExpedicao,
      observacao,
      selecionado_por: auth.userId,
    })
    .select(
      "id, arquivo_origem_id, tipo_xsd, numero_documento, orgao_emissor, uf_emissor, data_expedicao, observacao, pdfa_converted_at, pdfa_validation_ok, selecionado_em"
    )
    .single();

  if (insErr || !inserido) {
    console.error("[documentos-comprobatorios POST] erro insert:", insErr);
    return NextResponse.json(
      {
        error: "Falha ao criar seleção",
        detalhes: insErr?.message ?? "erro desconhecido",
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { sucesso: true, selecao: inserido },
    { status: 201 }
  );
}

// ── DELETE ────────────────────────────────────────────────────────────────────

async function handlerDELETE(
  request: NextRequest,
  auth: { userId: string; tenantId: string; email: string }
): Promise<NextResponse> {
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const idx = segments.indexOf("processos");
  const processoId = idx >= 0 ? segments[idx + 1] : null;

  if (!processoId || !ehUuid(processoId)) {
    return NextResponse.json(
      { error: "processo_id inválido" },
      { status: 400 }
    );
  }

  const ddcId = url.searchParams.get("ddc_id");
  if (!ddcId || !ehUuid(ddcId)) {
    return NextResponse.json(
      { error: "ddc_id (query string) é obrigatório e deve ser UUID" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Verifica que a seleção pertence ao processo
  const { data: existente, error: getErr } = await supabase
    .from("diploma_documentos_comprobatorios")
    .select("id, processo_id, deleted_at")
    .eq("id", ddcId)
    .maybeSingle();

  if (getErr) {
    console.error("[documentos-comprobatorios DELETE] erro get:", getErr);
    return erroInterno();
  }
  if (!existente) return erroNaoEncontrado();
  if (existente.processo_id !== processoId) {
    return NextResponse.json(
      { error: "Seleção não pertence a este processo" },
      { status: 404 }
    );
  }
  if (existente.deleted_at) {
    return NextResponse.json(
      { error: "Seleção já foi removida anteriormente" },
      { status: 410 }
    );
  }

  // Soft-delete
  const { error: updErr } = await supabase
    .from("diploma_documentos_comprobatorios")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: auth.userId,
    })
    .eq("id", ddcId);

  if (updErr) {
    console.error("[documentos-comprobatorios DELETE] erro update:", updErr);
    return NextResponse.json(
      {
        error: "Falha ao remover seleção",
        detalhes: updErr.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ sucesso: true, ddc_id: ddcId });
}

// ── Exports protegidos ────────────────────────────────────────────────────────

export const GET = protegerRota(handlerGET, { skipCSRF: true });
export const POST = protegerRota(handlerPOST, { skipCSRF: true });
export const DELETE = protegerRota(handlerDELETE, { skipCSRF: true });
