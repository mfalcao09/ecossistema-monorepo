import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { verificarAuth } from "@/lib/security/api-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/extracao/sessoes/[id]/arquivos/[arquivoId]/restaurar/[versaoId]
//
// Restaura uma versão anterior do arquivo de comprobatório (Sessão 2026-04-26):
//   1. Pega a versão alvo (deve pertencer ao mesmo arquivo)
//   2. Desativa a versão atualmente ativa
//   3. Cria nova versão (clone da alvo) marcada como `ativa=true` com
//      `origem='restauracao'` e `origem_versao_id` apontando pra alvo
//   4. Sync `processo_arquivos.storage_path/nome/mime/tamanho` pra nova versão
//
// Por que clonar em vez de só reativar a antiga? Pra preservar a cronologia
// linear de versões — cada toggle gera um registro temporal claro. A
// observação documenta "Restauração de v{N}".
// ═══════════════════════════════════════════════════════════════════════════

const STATUS_EDITAVEIS = new Set([
  "rascunho",
  "aguardando_revisao",
  "concluido",
  "convertido_em_processo",
]);

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string; arquivoId: string; versaoId: string }>;
  },
) {
  const auth = await verificarAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id: sessaoId, arquivoId, versaoId } = await params;

  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    !uuidRe.test(sessaoId) ||
    !uuidRe.test(arquivoId) ||
    !uuidRe.test(versaoId)
  ) {
    return NextResponse.json({ erro: "ID inválido" }, { status: 400 });
  }

  const supabase = await createClient();

  // 1. Sessão editável
  const { data: sessao } = await supabase
    .from("extracao_sessoes")
    .select("id, status, processo_id")
    .eq("id", sessaoId)
    .maybeSingle<{
      id: string;
      status: string;
      processo_id: string | null;
    }>();

  if (!sessao) {
    return NextResponse.json(
      { erro: "Sessão não encontrada" },
      { status: 404 },
    );
  }
  if (!STATUS_EDITAVEIS.has(sessao.status)) {
    return NextResponse.json(
      {
        erro: "STATUS_NAO_EDITAVEL",
        mensagem: `Sessão em status "${sessao.status}" não pode ser editada`,
      },
      { status: 409 },
    );
  }

  // 2. Bloqueio: diploma assinado/publicado vinculado
  const STATUS_DIPLOMA_BLOQUEADO = new Set([
    "assinado",
    "registrado",
    "rvdd_gerado",
    "publicado",
  ]);
  if (sessao.processo_id) {
    const { data: diplomas } = await supabase
      .from("diplomas")
      .select("id, status")
      .eq("processo_id", sessao.processo_id)
      .limit(50);
    const bloqueado = (diplomas ?? []).some((d: { status: string }) =>
      STATUS_DIPLOMA_BLOQUEADO.has(d.status),
    );
    if (bloqueado) {
      return NextResponse.json(
        {
          erro: "DIPLOMA_PUBLICADO",
          mensagem:
            "O processo possui diploma(s) publicado(s) ou assinado(s). Restauração bloqueada.",
        },
        { status: 403 },
      );
    }
  }

  // 3. Arquivo deve pertencer à sessão
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

  const admin = getAdmin();

  // 4. Versão alvo deve pertencer ao mesmo arquivo + não pode estar ativa
  const { data: alvo } = await admin
    .from("processo_arquivo_versoes")
    .select(
      "id, processo_arquivo_id, versao, storage_path, bucket, nome_original, mime_type, tamanho_bytes, ativa",
    )
    .eq("id", versaoId)
    .maybeSingle<{
      id: string;
      processo_arquivo_id: string;
      versao: number;
      storage_path: string;
      bucket: string;
      nome_original: string;
      mime_type: string;
      tamanho_bytes: number | null;
      ativa: boolean;
    }>();

  if (!alvo || alvo.processo_arquivo_id !== arquivoId) {
    return NextResponse.json(
      {
        erro: "VERSAO_NAO_PERTENCE_AO_ARQUIVO",
        mensagem: "Versão não pertence a este arquivo",
      },
      { status: 403 },
    );
  }

  if (alvo.ativa) {
    return NextResponse.json(
      {
        erro: "JA_ATIVA",
        mensagem: "Esta versão já é a ativa.",
      },
      { status: 409 },
    );
  }

  // 5. Calcula próxima versão
  const { data: ultima } = await admin
    .from("processo_arquivo_versoes")
    .select("versao")
    .eq("processo_arquivo_id", arquivoId)
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle<{ versao: number }>();

  const proximaVersao = (ultima?.versao ?? 0) + 1;

  // 6. Desativa atual
  const { error: errDeactivate } = await admin
    .from("processo_arquivo_versoes")
    .update({ ativa: false })
    .eq("processo_arquivo_id", arquivoId)
    .eq("ativa", true);

  if (errDeactivate) {
    return NextResponse.json(
      {
        erro: "Falha ao desativar versão atual",
        detalhes: errDeactivate.message,
      },
      { status: 500 },
    );
  }

  // 7. INSERT clone da alvo como nova versão ativa
  const { data: novaVersao, error: errInsert } = await admin
    .from("processo_arquivo_versoes")
    .insert({
      processo_arquivo_id: arquivoId,
      versao: proximaVersao,
      storage_path: alvo.storage_path,
      bucket: alvo.bucket,
      nome_original: alvo.nome_original,
      mime_type: alvo.mime_type,
      tamanho_bytes: alvo.tamanho_bytes,
      ativa: true,
      criada_por: auth.userId,
      origem: "restauracao",
      origem_versao_id: alvo.id,
      observacao: `Restauração de v${alvo.versao}`,
    })
    .select("id, versao")
    .single();

  if (errInsert || !novaVersao) {
    // Reverte desativação — best effort
    if (ultima) {
      await admin
        .from("processo_arquivo_versoes")
        .update({ ativa: true })
        .eq("processo_arquivo_id", arquivoId)
        .eq("versao", ultima.versao);
    }
    return NextResponse.json(
      {
        erro: "Falha ao restaurar versão",
        detalhes: errInsert?.message ?? "INSERT vazio",
      },
      { status: 500 },
    );
  }

  // 8. Sync em processo_arquivos
  const { error: errSync } = await admin
    .from("processo_arquivos")
    .update({
      storage_path: alvo.storage_path,
      nome_original: alvo.nome_original,
      mime_type: alvo.mime_type,
      tamanho_bytes: alvo.tamanho_bytes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", arquivoId)
    .eq("sessao_id", sessaoId);

  if (errSync) {
    console.error("[restaurar] Sync em processo_arquivos falhou:", errSync);
  }

  return NextResponse.json({
    ok: true,
    arquivo_id: arquivoId,
    versao_restaurada: alvo.versao,
    versao_nova: novaVersao.versao,
    versao_nova_id: novaVersao.id,
    nome_arquivo_restaurado: alvo.nome_original,
  });
}
