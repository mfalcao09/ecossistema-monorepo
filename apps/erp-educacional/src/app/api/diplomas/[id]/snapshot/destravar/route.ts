import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protegerRota } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

interface DiplomaDestravarRow {
  id: string;
  dados_snapshot_extracao: unknown | null;
  dados_snapshot_travado: boolean | null;
}

interface XmlAssinadoRow {
  id: string;
  assinado_em: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/diplomas/[id]/snapshot/destravar
//
// Destrava (zera) o snapshot consolidado pra permitir nova consolidação
// após edição dos dados. Cria registro em `validacao_overrides` +
// `diploma_unlock_windows` pra auditoria permanente.
//
// Body:
//   { justificativa: string (min 20 chars) }
//
// Bloqueado se:
//   • Diploma sem snapshot (nada a destravar)
//   • Algum XML já foi assinado por BRy (não dá pra destravar após assinatura)
// ═══════════════════════════════════════════════════════════════════════════
export const POST = protegerRota(async (request, { userId }) => {
  const supabase = await createClient();

  const pathname = new URL(request.url).pathname;
  const segments = pathname.split("/");
  const idx = segments.indexOf("diplomas");
  const diplomaId = idx >= 0 ? segments[idx + 1] : null;

  if (!diplomaId || !/^[0-9a-f-]{36}$/i.test(diplomaId)) {
    return NextResponse.json(
      { error: "ID do diploma inválido" },
      { status: 400 },
    );
  }

  // 1. Body
  let body: { justificativa?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const justificativa = (body.justificativa ?? "").trim();
  if (justificativa.length < 20) {
    return NextResponse.json(
      {
        error:
          "Justificativa obrigatória (mínimo 20 caracteres) — esta ação é auditada.",
      },
      { status: 422 },
    );
  }
  if (justificativa.length > 2000) {
    return NextResponse.json(
      { error: "Justificativa não pode passar de 2000 caracteres" },
      { status: 422 },
    );
  }

  // 2. Busca diploma
  const { data: diplomaRaw, error: errDiploma } = await supabase
    .from("diplomas")
    .select("id, dados_snapshot_extracao, dados_snapshot_travado")
    .eq("id", diplomaId)
    .single();

  if (errDiploma || !diplomaRaw) {
    return NextResponse.json(
      {
        error: sanitizarErro(
          errDiploma?.message ?? "Diploma não encontrado",
          404,
        ),
      },
      { status: 404 },
    );
  }
  const diploma = diplomaRaw as unknown as DiplomaDestravarRow;

  if (!diploma.dados_snapshot_extracao) {
    return NextResponse.json(
      { error: "Diploma sem snapshot — nada a destravar" },
      { status: 422 },
    );
  }

  // 3. Bloqueio: sem assinaturas BRy ativas
  const { data: xmlsAssinados } = await supabase
    .from("xml_gerados")
    .select("id, assinado_em")
    .eq("diploma_id", diplomaId)
    .not("assinado_em", "is", null)
    .returns<XmlAssinadoRow[]>();

  if (xmlsAssinados && xmlsAssinados.length > 0) {
    return NextResponse.json(
      {
        error:
          "Não é possível destravar: já existe XML assinado para este diploma. Cancele as assinaturas primeiro.",
      },
      { status: 422 },
    );
  }

  // 4. Cria override + unlock window (snapshot a destravar = válido por 24h)
  const { data: override, error: errOverride } = await supabase
    .from("validacao_overrides")
    .insert({
      entidade_tipo: "diploma",
      entidade_id: diplomaId,
      regra_codigo: "SNAPSHOT_DESTRAVAR",
      valores_originais: {
        dados_snapshot_extracao: diploma.dados_snapshot_extracao,
      },
      justificativa,
      usuario_id: userId,
    })
    .select("id")
    .single();

  if (errOverride || !override) {
    return NextResponse.json(
      {
        error: sanitizarErro(
          errOverride?.message ?? "Falha ao registrar override",
          500,
        ),
      },
      { status: 500 },
    );
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error: errWindow } = await supabase
    .from("diploma_unlock_windows")
    .insert({
      diploma_id: diplomaId,
      override_id: override.id,
      usuario_id: userId,
      justificativa,
      expires_at: expiresAt,
    });

  if (errWindow) {
    return NextResponse.json(
      { error: sanitizarErro(errWindow.message, 500) },
      { status: 500 },
    );
  }

  // 5. Zera snapshot (permite reconsolidar)
  const { error: errUpdate } = await supabase
    .from("diplomas")
    .update({
      dados_snapshot_extracao: null,
      dados_snapshot_versao: null,
      dados_snapshot_gerado_em: null,
      dados_snapshot_travado: false,
      dados_snapshot_travado_em: null,
      dados_snapshot_travado_por: null,
    })
    .eq("id", diplomaId);

  if (errUpdate) {
    return NextResponse.json(
      { error: sanitizarErro(errUpdate.message, 500) },
      { status: 500 },
    );
  }

  return NextResponse.json({
    destravado: true,
    override_id: override.id,
    expires_at: expiresAt,
  });
});
