import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verificarAuth } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// GET /api/documentos/[id] — busca documento por ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("documentos_digitais")
      .select(
        `
        *,
        instituicoes ( id, nome_fantasia, razao_social, cnpj ),
        documentos_digitais_log ( id, evento, status_antes, status_depois, detalhes, created_at )
      `,
      )
      .eq("id", id)
      .order("created_at", {
        referencedTable: "documentos_digitais_log",
        ascending: false,
      })
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: sanitizarErro("Documento não encontrado", 404) },
        { status: 404 },
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    const msg = sanitizarErro(
      err instanceof Error ? err.message : "Erro interno",
      500,
    );
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/documentos/[id] — atualiza status ou dados do documento
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const { acao } = body;

    if (acao === "publicar") {
      const { publicarDocumento } = await import("@/lib/documentos/engine");
      await publicarDocumento(id);
      return NextResponse.json({
        ok: true,
        mensagem: "Documento publicado com sucesso.",
      });
    }

    if (acao === "revogar") {
      const { atualizarStatus } = await import("@/lib/documentos/engine");
      await atualizarStatus(
        id,
        "revogado",
        body.motivo ?? "Revogado pelo administrador",
      );
      return NextResponse.json({ ok: true, mensagem: "Documento revogado." });
    }

    if (acao === "registrar_arquivo") {
      const { registrarArquivo } = await import("@/lib/documentos/engine");
      await registrarArquivo({
        documento_id: id,
        arquivo_url: body.arquivo_url,
        arquivo_hash_sha256: body.arquivo_hash_sha256,
        arquivo_tamanho_bytes: body.arquivo_tamanho_bytes,
      });
      return NextResponse.json({ ok: true, mensagem: "Arquivo registrado." });
    }

    if (acao === "registrar_assinatura") {
      const { registrarAssinatura } = await import("@/lib/documentos/engine");
      await registrarAssinatura({
        documento_id: id,
        assinatura_provedor: body.assinatura_provedor,
        assinatura_detalhes: body.assinatura_detalhes,
        arquivo_url_assinado: body.arquivo_url_assinado,
        arquivo_hash_assinado: body.arquivo_hash_assinado,
        carimbo_tempo_url: body.carimbo_tempo_url,
      });
      return NextResponse.json({
        ok: true,
        mensagem: "Assinatura registrada.",
      });
    }

    return NextResponse.json(
      { error: sanitizarErro("Ação não reconhecida.", 400) },
      { status: 400 },
    );
  } catch (err) {
    const msg = sanitizarErro(
      err instanceof Error ? err.message : "Erro interno",
      500,
    );
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
