import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { verificarAuth } from "@/lib/security/api-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/extracao/sessoes/[id]/arquivos/[arquivoId]/substituir
//
// Persiste no banco a substituição de um arquivo do comprobatório.
// O front (handleSubstituirArquivo) já fez upload do novo arquivo no
// Supabase Storage com path `{tenant_id}/{user_id}/sub_{idx}_{ts}.{ext}`;
// esta rota só persiste os metadados na tabela `processo_arquivos`.
//
// Sessão 2026-04-26: criada porque a substituição era 100% client-side.
// O auto-save da sessão só persiste destino_xml / destino_acervo / tipo_xsd,
// deixando storage_path / nome_original / mime_type / tamanho_bytes
// dessincronizados. F5 revertia pro arquivo original.
// ═══════════════════════════════════════════════════════════════════════════

const bodySchema = z.object({
  storage_path: z.string().min(1),
  bucket: z.string().min(1).optional(),
  nome_original: z.string().min(1),
  mime_type: z.string().min(1),
  tamanho_bytes: z.number().int().nonnegative(),
});

const STATUS_EDITAVEIS = new Set([
  "rascunho",
  "aguardando_revisao",
  "concluido",
  "convertido_em_processo",
]);

export async function PATCH(
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

  const bodyRaw = await request.json().catch(() => null);
  if (!bodyRaw) {
    return NextResponse.json(
      { erro: "Body vazio ou inválido" },
      { status: 400 },
    );
  }
  const parsed = bodySchema.safeParse(bodyRaw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Body inválido", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const novo = parsed.data;

  const supabase = await createClient();

  // 1. Sessão deve existir + estar editável
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

  // 2. Bloqueio: se há diploma assinado/publicado vinculado, recusa
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
            "O processo possui diploma(s) publicado(s) ou assinado(s). Substituição bloqueada.",
        },
        { status: 403 },
      );
    }
  }

  // 3. Confirma que o arquivo pertence à sessão (defesa contra IDs forjados)
  const { data: arquivoExistente } = await supabase
    .from("processo_arquivos")
    .select("id, sessao_id, storage_path")
    .eq("id", arquivoId)
    .maybeSingle<{
      id: string;
      sessao_id: string | null;
      storage_path: string;
    }>();

  if (!arquivoExistente || arquivoExistente.sessao_id !== sessaoId) {
    return NextResponse.json(
      {
        erro: "ARQUIVO_NAO_PERTENCE_A_SESSAO",
        mensagem: "Arquivo não pertence a esta sessão",
      },
      { status: 403 },
    );
  }

  // 4. Atualiza metadados do arquivo
  const { error: errUpdate } = await supabase
    .from("processo_arquivos")
    .update({
      storage_path: novo.storage_path,
      bucket: novo.bucket ?? "processo-arquivos",
      nome_original: novo.nome_original,
      mime_type: novo.mime_type,
      tamanho_bytes: novo.tamanho_bytes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", arquivoId)
    .eq("sessao_id", sessaoId);

  if (errUpdate) {
    console.error("[substituir/route] update falhou:", errUpdate);
    return NextResponse.json(
      {
        erro: "Falha ao persistir substituição",
        detalhes: errUpdate.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    arquivo_id: arquivoId,
    storage_path_anterior: arquivoExistente.storage_path,
    storage_path_novo: novo.storage_path,
    nome_arquivo_novo: novo.nome_original,
    auditoria_user_id: auth.userId,
  });
}
