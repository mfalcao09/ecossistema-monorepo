import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protegerRota } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// Tipo local — cast necessário pois o Supabase JS não infere corretamente
// com .select() de string concatenada.
interface DiplomaTravarRow {
  id: string;
  dados_snapshot_extracao: unknown | null;
  dados_snapshot_versao: number | null;
  dados_snapshot_travado: boolean | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/diplomas/[id]/snapshot/travar
//
// Trava definitivamente o snapshot do diploma. Ação MANUAL e EXPLÍCITA do
// usuário (botão "Confirmar e liberar assinaturas"). Após travado:
//   • Snapshot imutável permanentemente (PATCH /snapshot retornará 422).
//   • Os 2 fluxos BRy podem ser iniciados:
//       - Fluxo XML (XAdES via BRy Cloud)
//       - Fluxo PDF (HUB Signer via /documentos/assinar)
//
// Validações:
//   • Diploma existe
//   • Tem snapshot (não legado)
//   • Ainda não está travado (idempotência amigável)
// ═══════════════════════════════════════════════════════════════════════════
export const POST = protegerRota(async (request, { userId }) => {
  const supabase = await createClient();

  const pathname = new URL(request.url).pathname;
  const segments = pathname.split("/");
  const idx = segments.indexOf("diplomas");
  const diplomaId = idx >= 0 ? segments[idx + 1] : null;

  if (!diplomaId) {
    return NextResponse.json(
      { error: "ID do diploma não fornecido" },
      { status: 400 },
    );
  }

  const { data: diplomaRaw, error: errDiploma } = await supabase
    .from("diplomas")
    .select(
      "id, dados_snapshot_extracao, dados_snapshot_versao, dados_snapshot_travado",
    )
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
  const diploma = diplomaRaw as unknown as DiplomaTravarRow;

  if (!diploma.dados_snapshot_extracao) {
    return NextResponse.json(
      {
        error:
          "Diploma sem snapshot — não pode ser travado (possivelmente legado ou erro na criação).",
      },
      { status: 422 },
    );
  }

  if (diploma.dados_snapshot_travado) {
    // Idempotente: já travado retorna 200 com os dados atuais
    return NextResponse.json({
      ja_travado: true,
      versao: diploma.dados_snapshot_versao,
    });
  }

  const agora = new Date().toISOString();

  const { error: errUpdate } = await supabase
    .from("diplomas")
    .update({
      dados_snapshot_travado: true,
      dados_snapshot_travado_em: agora,
      dados_snapshot_travado_por: userId,
    })
    .eq("id", diplomaId)
    .eq("dados_snapshot_travado", false); // optimistic — evita race

  if (errUpdate) {
    return NextResponse.json(
      { error: sanitizarErro(errUpdate.message, 500) },
      { status: 500 },
    );
  }

  return NextResponse.json({
    travado: true,
    travado_em: agora,
    travado_por: userId,
    versao: diploma.dados_snapshot_versao,
  });
});
