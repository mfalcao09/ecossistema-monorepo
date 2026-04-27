import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { verificarAuth } from "@/lib/security/api-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/extracao/sessoes/[id]/arquivos/[arquivoId]/versoes
//
// Lista todas as versões registradas em `processo_arquivo_versoes` para
// o arquivo. Retorna ordem decrescente (mais nova primeiro), com signed
// URLs para preview de cada versão (TTL 600s).
//
// Usado pela UI: dialog de visualização do comprobatório expandível
// "Histórico de versões" com botão "Restaurar" em versões inativas.
// ═══════════════════════════════════════════════════════════════════════════

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; arquivoId: string }> },
) {
  const auth = await verificarAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id: sessaoId, arquivoId } = await params;

  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(sessaoId) || !uuidRe.test(arquivoId)) {
    return NextResponse.json({ erro: "ID inválido" }, { status: 400 });
  }

  const supabase = await createClient();

  // 1. Confirma que o arquivo pertence à sessão
  const { data: arquivoExistente } = await supabase
    .from("processo_arquivos")
    .select("id, sessao_id")
    .eq("id", arquivoId)
    .maybeSingle<{ id: string; sessao_id: string | null }>();

  if (!arquivoExistente || arquivoExistente.sessao_id !== sessaoId) {
    return NextResponse.json(
      {
        erro: "ARQUIVO_NAO_PERTENCE_A_SESSAO",
        mensagem: "Arquivo não pertence a esta sessão",
      },
      { status: 403 },
    );
  }

  // 2. Lista versões
  const admin = getAdmin();
  const { data: versoesRaw, error } = await admin
    .from("processo_arquivo_versoes")
    .select(
      "id, versao, storage_path, bucket, nome_original, mime_type, " +
        "tamanho_bytes, ativa, criada_em, criada_por, origem, " +
        "origem_versao_id, observacao",
    )
    .eq("processo_arquivo_id", arquivoId)
    .order("versao", { ascending: false });

  if (error) {
    return NextResponse.json(
      { erro: "Falha ao listar versões", detalhes: error.message },
      { status: 500 },
    );
  }

  // 3. Gera signed URL pra cada versão (preview)
  const versoes = await Promise.all(
    (
      (versoesRaw ?? []) as unknown as Array<{
        id: string;
        versao: number;
        storage_path: string;
        bucket: string;
        nome_original: string;
        mime_type: string;
        tamanho_bytes: number | null;
        ativa: boolean;
        criada_em: string;
        criada_por: string | null;
        origem: string;
        origem_versao_id: string | null;
        observacao: string | null;
      }>
    ).map(async (v) => {
      const { data: signed } = await admin.storage
        .from(v.bucket)
        .createSignedUrl(v.storage_path, 600);
      return {
        id: v.id,
        versao: v.versao,
        nome_original: v.nome_original,
        mime_type: v.mime_type,
        tamanho_bytes: v.tamanho_bytes,
        ativa: v.ativa,
        criada_em: v.criada_em,
        criada_por: v.criada_por,
        origem: v.origem,
        origem_versao_id: v.origem_versao_id,
        observacao: v.observacao,
        preview_url: signed?.signedUrl ?? null,
      };
    }),
  );

  return NextResponse.json({
    arquivo_id: arquivoId,
    versoes,
    total: versoes.length,
  });
}
