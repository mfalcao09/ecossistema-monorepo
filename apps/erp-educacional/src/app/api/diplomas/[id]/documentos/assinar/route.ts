import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protegerRota } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";
import { getBryConfig } from "@/lib/bry/config";
import { submitDocumentoBry } from "@/lib/bry/assinatura-pdf";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// ═══════════════════════════════════════════════════════════════════
// POST /api/diplomas/[id]/documentos/assinar
//
// Envia os documentos complementares gerados (Histórico, Termos)
// ao BRy HUB Signer para coleta de assinaturas eletrônicas.
//
// Pré-requisito: diploma com docs no status 'pendente'
//   (gerados por POST /api/diplomas/[id]/documentos)
//
// Fluxo:
//   1. Busca documentos complementares com status 'pendente'
//   2. Baixa o PDF de cada documento do Supabase Storage
//   3. Busca os signatários do diploma (fluxo_assinaturas)
//   4. Submete cada PDF ao BRy via submitDocumentoBry()
//   5. Salva bry_document_id e muda status para 'enviado_assinatura'
//
// Após assinaturas: BRy chama /api/webhooks/bry-assinatura-pdf
// ═══════════════════════════════════════════════════════════════════

const DOC_TITULOS: Record<string, string> = {
  historico_escolar_pdf: "Histórico Escolar Digital",
  termo_expedicao: "Termo de Expedição de Diploma",
  termo_responsabilidade: "Termo de Responsabilidade",
};

export const POST = protegerRota(
  async (request) => {
    const supabase = await createClient();

    // Extrair diploma ID da URL
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

    // ── 1. Verificar config BRy ──
    const bryConfig = getBryConfig();
    if (!bryConfig) {
      return NextResponse.json(
        {
          error:
            "Integração BRy não configurada. Verifique BRY_CLIENT_ID e BRY_CLIENT_SECRET.",
        },
        { status: 503 },
      );
    }

    // ── 2. Verificar status do diploma ──
    const { data: diploma, error: errDiploma } = await supabase
      .from("diplomas")
      .select("id, status, diplomados(nome)")
      .eq("id", diplomaId)
      .single();

    if (errDiploma || !diploma) {
      return NextResponse.json(
        { error: sanitizarErro("Diploma não encontrado", 404) },
        { status: 404 },
      );
    }

    const statusPermitidos = ["aguardando_documentos", "gerando_documentos"];
    if (!statusPermitidos.includes(diploma.status)) {
      return NextResponse.json(
        {
          error: `Status atual (${diploma.status}) não permite envio para assinatura. Necessário: aguardando_documentos.`,
        },
        { status: 422 },
      );
    }

    // ── 3. Buscar documentos pendentes ──
    const { data: docs, error: errDocs } = await supabase
      .from("diploma_documentos_complementares")
      .select("id, tipo, status, arquivo_url, arquivo_path")
      .eq("diploma_id", diplomaId)
      .in("status", ["pendente", "erro"]); // Permite re-tentativa em caso de erro

    if (errDocs || !docs || docs.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nenhum documento gerado encontrado. Execute POST /documentos primeiro.",
        },
        { status: 422 },
      );
    }

    // ── 4. Buscar signatários do fluxo de assinaturas ──
    type FluxoRow = {
      ordem: number;
      assinantes: {
        nome: string;
        cpf: string | null;
        email: string | null;
        cargo: string | null;
        outro_cargo: string | null;
      } | null;
    };

    const { data: fluxo } = await supabase
      .from("fluxo_assinaturas")
      .select("ordem, assinantes(nome, cpf, email, cargo, outro_cargo)")
      .eq("diploma_id", diplomaId)
      .eq("papel", "emissora")
      .order("ordem", { ascending: true });

    const signatarios = ((fluxo as FluxoRow[] | null) ?? [])
      .filter(
        (f) => f.assinantes?.nome && f.assinantes?.cpf && f.assinantes?.email,
      )
      .map((f) => ({
        nome: f.assinantes!.nome,
        cpf: f.assinantes!.cpf!,
        email: f.assinantes!.email!,
        cargo:
          f.assinantes!.outro_cargo ?? f.assinantes!.cargo ?? "Não informado",
      }));

    if (signatarios.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nenhum signatário com nome, CPF e e-mail cadastrado para este diploma. " +
            "Configure os signatários em Assinantes antes de enviar para assinatura.",
        },
        { status: 422 },
      );
    }

    // ── 5. Baixar e submeter cada PDF ao BRy ──
    const diplomadoNome =
      (diploma.diplomados as { nome?: string } | null)?.nome ?? "Diplomado";
    const resultados: Array<{
      tipo: string;
      documentoId: string;
      ok: boolean;
      erro?: string;
    }> = [];

    for (const doc of docs) {
      try {
        // Baixar PDF do Storage
        let pdfBytes: Uint8Array;

        if (doc.arquivo_path) {
          const { data: fileData, error: errFile } = await supabase.storage
            .from("documentos")
            .download(doc.arquivo_path);

          if (errFile || !fileData) {
            throw new Error(
              `Erro ao baixar PDF do storage: ${errFile?.message ?? "arquivo não encontrado"}`,
            );
          }

          const arrayBuffer = await fileData.arrayBuffer();
          pdfBytes = new Uint8Array(arrayBuffer);
        } else if (doc.arquivo_url) {
          // Fallback: baixar via URL pública
          const res = await fetch(doc.arquivo_url, {
            signal: AbortSignal.timeout(20_000),
          });
          if (!res.ok)
            throw new Error(`Erro ao baixar PDF via URL: ${res.status}`);
          pdfBytes = new Uint8Array(await res.arrayBuffer());
        } else {
          throw new Error("Documento sem arquivo_path e sem arquivo_url");
        }

        // Submeter ao BRy
        const titulo = `${DOC_TITULOS[doc.tipo] ?? doc.tipo} — ${diplomadoNome}`;
        const externalId = `${diplomaId}:${doc.tipo}`;
        const nomeArquivo = `${doc.tipo}.pdf`;

        const resultado = await submitDocumentoBry(bryConfig, {
          pdfBytes,
          nomeArquivo,
          titulo,
          signatarios,
          externalId,
        });

        // Salvar bry_document_id e marcar como enviado_assinatura
        await supabase
          .from("diploma_documentos_complementares")
          .update({
            status: "enviado_assinatura",
            bry_document_id: resultado.documentoId,
            erro_mensagem: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", doc.id);

        resultados.push({
          tipo: doc.tipo,
          documentoId: resultado.documentoId,
          ok: true,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        console.error(`[API assinar] erro no tipo ${doc.tipo}:`, msg);

        // Marcar como erro mas continuar para os demais
        await supabase
          .from("diploma_documentos_complementares")
          .update({
            status: "erro",
            erro_mensagem: msg.slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq("id", doc.id);

        resultados.push({
          tipo: doc.tipo,
          documentoId: "",
          ok: false,
          erro: msg.slice(0, 200),
        });
      }
    }

    const enviados = resultados.filter((r) => r.ok).length;
    const erros = resultados.filter((r) => !r.ok).length;

    // Avançar status do diploma se ao menos 1 foi enviado
    if (enviados > 0) {
      await supabase
        .from("diplomas")
        .update({
          status: "aguardando_documentos", // permanece em aguardando — avança só quando assinado
          updated_at: new Date().toISOString(),
        })
        .eq("id", diplomaId);
    }

    return NextResponse.json(
      {
        sucesso: enviados > 0,
        enviados,
        erros,
        resultados,
      },
      { status: erros > 0 && enviados === 0 ? 500 : 200 },
    );
  },
  { skipCSRF: true },
);
