import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protegerRota } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// ═══════════════════════════════════════════════════════════════════
// POST /api/diplomas/[id]/acervo
// Upload de documento tratado para o acervo acadêmico digital
//
// Body: FormData com campos:
//   - arquivo: File (imagem tratada ou PDF)
//   - tipo: string (tipo do documento, ex: "diploma_fisico", "rg", "historico_papel")
//   - descricao?: string
// ═══════════════════════════════════════════════════════════════════
export const POST = protegerRota(
  async (request, { userId }) => {
    const supabase = await createClient();

    // Extrair ID do diploma da URL
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

    // Verificar diploma existe e está no status correto
    const { data: diploma, error: errDiploma } = await supabase
      .from("diplomas")
      .select("id, status")
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

    const statusPermitidos = [
      "aguardando_digitalizacao",
      "documentos_assinados",
      "acervo_completo",
      "erro",
    ];
    if (!statusPermitidos.includes(diploma.status)) {
      return NextResponse.json(
        {
          error: `Status atual (${diploma.status}) não permite upload de acervo.`,
        },
        { status: 422 },
      );
    }

    // Parse FormData
    const formData = await request.formData();
    const arquivo = formData.get("arquivo") as File | null;
    const tipo = formData.get("tipo") as string | null;
    const descricao = formData.get("descricao") as string | null;

    if (!arquivo) {
      return NextResponse.json(
        { error: "Arquivo é obrigatório" },
        { status: 400 },
      );
    }
    if (!tipo) {
      return NextResponse.json(
        { error: "Tipo do documento é obrigatório" },
        { status: 400 },
      );
    }

    // Validar tipo e tamanho
    const tiposPermitidos = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (!tiposPermitidos.includes(arquivo.type)) {
      return NextResponse.json(
        { error: "Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou PDF." },
        { status: 400 },
      );
    }
    if (arquivo.size > 10 * 1024 * 1024) {
      // 10MB
      return NextResponse.json(
        { error: "Arquivo muito grande. Máximo: 10MB." },
        { status: 400 },
      );
    }

    try {
      // Upload ao storage
      const timestamp = Date.now();
      const ext = arquivo.name.split(".").pop() ?? "jpg";
      const storagePath = `diplomas/${diplomaId}/acervo/${tipo}_${timestamp}.${ext}`;

      const arrayBuffer = await arquivo.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      const { error: errUpload } = await supabase.storage
        .from("documentos")
        .upload(storagePath, buffer, {
          contentType: arquivo.type,
          upsert: true,
        });

      if (errUpload) {
        return NextResponse.json(
          { error: sanitizarErro(errUpload.message, 500) },
          { status: 500 },
        );
      }

      // Registrar no banco (referência polimórfica — schema atual)
      const { data: doc, error: errInsert } = await supabase
        .from("documentos_digitais")
        .insert({
          referencia_tabela: "diplomas",
          referencia_id: diplomaId,
          tipo: `acervo_${tipo}`,
          status: "pendente",
          arquivo_url: `documentos/${storagePath}`,
          gerado_em: new Date().toISOString(),
          gerado_por_user_id: userId,
          metadados: {
            descricao: descricao,
            tipo_original: tipo,
            nome_arquivo_original: arquivo.name,
            tamanho_bytes: arquivo.size,
            content_type: arquivo.type,
            decreto_10278: true, // Conformidade com Decreto 10.278/2020
          },
        })
        .select("id")
        .single();

      if (errInsert) {
        return NextResponse.json(
          { error: sanitizarErro(errInsert.message, 500) },
          { status: 500 },
        );
      }

      // Atualizar status se necessário
      if (diploma.status === "documentos_assinados") {
        await supabase
          .from("diplomas")
          .update({
            status: "aguardando_digitalizacao",
            updated_at: new Date().toISOString(),
          })
          .eq("id", diplomaId);
      }

      return NextResponse.json({
        sucesso: true,
        documento_id: doc?.id,
        arquivo_url: `documentos/${storagePath}`,
      });
    } catch (err: any) {
      return NextResponse.json(
        { error: sanitizarErro(err.message ?? "Erro no upload", 500) },
        { status: 500 },
      );
    }
  },
  { skipCSRF: true },
);

// ═══════════════════════════════════════════════════════════════════
// GET /api/diplomas/[id]/acervo
// Lista documentos do acervo digital
// ═══════════════════════════════════════════════════════════════════
export const GET = protegerRota(
  async (request) => {
    const supabase = await createClient();

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

    const { data: docs, error } = await supabase
      .from("documentos_digitais")
      .select("*")
      .eq("referencia_tabela", "diplomas")
      .eq("referencia_id", diplomaId)
      .like("tipo", "acervo_%")
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: sanitizarErro(error.message, 500) },
        { status: 500 },
      );
    }

    return NextResponse.json({ documentos: docs ?? [] });
  },
  { skipCSRF: true },
);

// ═══════════════════════════════════════════════════════════════════
// PATCH /api/diplomas/[id]/acervo
// Marcar acervo como completo
// Body: { acao: "finalizar" }
// ═══════════════════════════════════════════════════════════════════
export const PATCH = protegerRota(
  async (request, { userId }) => {
    const supabase = await createClient();

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

    if (body.acao === "finalizar") {
      // Verificar se há pelo menos 1 doc no acervo
      const { data: docs } = await supabase
        .from("documentos_digitais")
        .select("id")
        .eq("referencia_tabela", "diplomas")
        .eq("referencia_id", diplomaId)
        .like("tipo", "acervo_%");

      if (!docs || docs.length === 0) {
        return NextResponse.json(
          {
            error:
              "Nenhum documento no acervo. Adicione pelo menos um documento antes de finalizar.",
          },
          { status: 422 },
        );
      }

      const { error } = await supabase
        .from("diplomas")
        .update({
          status: "acervo_completo",
          updated_at: new Date().toISOString(),
        })
        .eq("id", diplomaId);

      if (error) {
        return NextResponse.json(
          { error: sanitizarErro(error.message, 500) },
          { status: 500 },
        );
      }

      // Log
      supabase
        .from("documentos_digitais_log")
        .insert({
          documento_id: diplomaId,
          evento: "acervo_finalizado",
          status_antes: "pendente",
          status_depois: "pendente",
          usuario_id: userId,
          detalhes: {
            tipo: "acervo_finalizado",
            total_documentos: docs.length,
          },
        })
        .then(() => {});

      return NextResponse.json({
        sucesso: true,
        status_novo: "acervo_completo",
        total_documentos: docs.length,
      });
    }

    return NextResponse.json(
      { error: "Ação não reconhecida" },
      { status: 400 },
    );
  },
  { skipCSRF: true },
);
