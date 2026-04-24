import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protegerRota } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// ═══════════════════════════════════════════════════════════════════
// GET /api/diplomas/[id]/comprobatorios
//
// Lista todos os diploma_documentos_comprobatorios de um diploma,
// com status implícito de conversão PDF/A:
//   - pdfa_storage_path IS NULL  → "pendente"
//   - pdfa_storage_path NOT NULL → "convertido"
//   - pdfa_validation_ok = false → "convertido_com_aviso"
//
// Inclui nome_original do arquivo de origem (processo_arquivos)
// para exibição na UI.
//
// Sprint 6 — item 6.4 (API)
// ═══════════════════════════════════════════════════════════════════

interface ComprobatorioItem {
  id: string;
  tipo_xsd: string;
  status_pdfa: "pendente" | "convertido" | "convertido_com_aviso";
  pdfa_storage_path: string | null;
  pdfa_tamanho_bytes: number | null;
  pdfa_converted_at: string | null;
  pdfa_validation_ok: boolean | null;
  selecionado_em: string | null;
  // Da tabela processo_arquivos:
  arquivo_nome_original: string | null;
  arquivo_mime_type: string | null;
  arquivo_tamanho_bytes: number | null;
}

export const GET = protegerRota(
  async (request) => {
    const url = new URL(request.url);
    const segments = url.pathname.split("/");
    const diplomaIdx = segments.indexOf("diplomas");
    const diplomaId = diplomaIdx >= 0 ? segments[diplomaIdx + 1] : null;

    if (!diplomaId) {
      return NextResponse.json(
        { error: "ID do diploma não fornecido" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Buscar processo_id do diploma
    const { data: diploma, error: errDiploma } = await supabase
      .from("diplomas")
      .select("id, processo_id")
      .eq("id", diplomaId)
      .single();

    if (errDiploma || !diploma) {
      return NextResponse.json(
        {
          error: sanitizarErro(
            errDiploma?.message || "Diploma não encontrado",
            404,
          ),
        },
        { status: 404 },
      );
    }

    if (!diploma.processo_id) {
      return NextResponse.json({
        comprobatorios: [],
        total: 0,
        total_convertidos: 0,
      });
    }

    // Buscar comprobatórios com dados do arquivo de origem
    const { data: ddcs, error: errDdcs } = await supabase
      .from("diploma_documentos_comprobatorios")
      .select(
        `
        id,
        tipo_xsd,
        pdfa_storage_path,
        pdfa_tamanho_bytes,
        pdfa_converted_at,
        pdfa_validation_ok,
        selecionado_em,
        arquivo_origem_id
      `,
      )
      .eq("processo_id", diploma.processo_id)
      .is("deleted_at", null)
      .order("selecionado_em", { ascending: true });

    if (errDdcs) {
      return NextResponse.json(
        { error: sanitizarErro(errDdcs.message, 500) },
        { status: 500 },
      );
    }

    if (!ddcs || ddcs.length === 0) {
      return NextResponse.json({
        comprobatorios: [],
        total: 0,
        total_convertidos: 0,
      });
    }

    // Buscar nomes dos arquivos de origem em lote
    const arquivoIds = ddcs
      .map((d) => d.arquivo_origem_id as string)
      .filter(Boolean);

    const arquivoMap: Record<
      string,
      { nome_original: string; mime_type: string; tamanho_bytes: number }
    > = {};

    if (arquivoIds.length > 0) {
      const { data: arquivos } = await supabase
        .from("processo_arquivos")
        .select("id, nome_original, mime_type, tamanho_bytes")
        .in("id", arquivoIds);

      for (const a of arquivos ?? []) {
        arquivoMap[a.id as string] = {
          nome_original: a.nome_original as string,
          mime_type: a.mime_type as string,
          tamanho_bytes: a.tamanho_bytes as number,
        };
      }
    }

    // Mapear para resposta com status explícito
    const comprobatorios: ComprobatorioItem[] = ddcs.map((ddc) => {
      let status_pdfa: ComprobatorioItem["status_pdfa"] = "pendente";
      if (ddc.pdfa_storage_path) {
        status_pdfa =
          ddc.pdfa_validation_ok === false
            ? "convertido_com_aviso"
            : "convertido";
      }

      const arquivo = arquivoMap[ddc.arquivo_origem_id as string];

      return {
        id: ddc.id as string,
        tipo_xsd: ddc.tipo_xsd as string,
        status_pdfa,
        pdfa_storage_path: (ddc.pdfa_storage_path as string | null) ?? null,
        pdfa_tamanho_bytes: (ddc.pdfa_tamanho_bytes as number | null) ?? null,
        pdfa_converted_at: (ddc.pdfa_converted_at as string | null) ?? null,
        pdfa_validation_ok: (ddc.pdfa_validation_ok as boolean | null) ?? null,
        selecionado_em: (ddc.selecionado_em as string | null) ?? null,
        arquivo_nome_original: arquivo?.nome_original ?? null,
        arquivo_mime_type: arquivo?.mime_type ?? null,
        arquivo_tamanho_bytes: arquivo?.tamanho_bytes ?? null,
      };
    });

    const total_convertidos = comprobatorios.filter(
      (c) => c.status_pdfa !== "pendente",
    ).length;

    return NextResponse.json({
      comprobatorios,
      total: comprobatorios.length,
      total_convertidos,
    });
  },
  { skipCSRF: true },
);

// ═══════════════════════════════════════════════════════════════════
// PATCH /api/diplomas/[id]/comprobatorios
// Confirmar acervo — avança status para aguardando_envio_registradora
// Body: { acao: "confirmar_comprobatorios" }
// ═══════════════════════════════════════════════════════════════════
export const PATCH = protegerRota(
  async (request) => {
    const url = new URL(request.url);
    const segments = url.pathname.split("/");
    const diplomaIdx = segments.indexOf("diplomas");
    const diplomaId = diplomaIdx >= 0 ? segments[diplomaIdx + 1] : null;

    if (!diplomaId) {
      return NextResponse.json(
        { error: "ID do diploma não fornecido" },
        { status: 400 },
      );
    }

    const body = await request.json();

    if (body.acao !== "confirmar_comprobatorios") {
      return NextResponse.json(
        { error: "Ação não reconhecida" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Verificar diploma + processo
    const { data: diploma, error: errDiploma } = await supabase
      .from("diplomas")
      .select("id, processo_id, status")
      .eq("id", diplomaId)
      .single();

    if (errDiploma || !diploma) {
      return NextResponse.json(
        {
          error: sanitizarErro(
            errDiploma?.message || "Diploma não encontrado",
            404,
          ),
        },
        { status: 404 },
      );
    }

    if (diploma.status !== "aguardando_documentos") {
      return NextResponse.json(
        {
          error: `Status atual (${diploma.status}) não permite confirmar acervo. Esperado: aguardando_documentos.`,
        },
        { status: 422 },
      );
    }

    if (!diploma.processo_id) {
      return NextResponse.json(
        { error: "Diploma sem processo vinculado." },
        { status: 422 },
      );
    }

    // Verificar que há pelo menos 1 comprobatório convertido
    const { data: convertidos, error: errCheck } = await supabase
      .from("diploma_documentos_comprobatorios")
      .select("id")
      .eq("processo_id", diploma.processo_id)
      .is("deleted_at", null)
      .not("pdfa_storage_path", "is", null);

    if (errCheck) {
      return NextResponse.json(
        { error: sanitizarErro(errCheck.message, 500) },
        { status: 500 },
      );
    }

    if (!convertidos || convertidos.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nenhum comprobatório convertido para PDF/A. Converta os documentos antes de confirmar o acervo.",
        },
        { status: 422 },
      );
    }

    // Avançar status para aguardando_envio_registradora
    const { error: errUpdate } = await supabase
      .from("diplomas")
      .update({
        status: "aguardando_envio_registradora",
        updated_at: new Date().toISOString(),
      })
      .eq("id", diplomaId)
      .eq("status", "aguardando_documentos");

    if (errUpdate) {
      return NextResponse.json(
        { error: sanitizarErro(errUpdate.message, 500) },
        { status: 500 },
      );
    }

    return NextResponse.json({
      sucesso: true,
      status_novo: "aguardando_envio_registradora",
      comprobatorios_convertidos: convertidos.length,
    });
  },
  { skipCSRF: true },
);
