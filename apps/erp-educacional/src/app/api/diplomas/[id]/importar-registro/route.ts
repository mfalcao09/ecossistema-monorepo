import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { parseDiplomaDigitalRegistrado } from "@/lib/xml/parser-registro";
import {
  verificarAuth,
  erroNaoEncontrado,
  erroInterno,
} from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";
import crypto from "crypto";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/diplomas/[id]/importar-registro
//
// Recebe o XML do DiplomaDigital devolvido pela registradora (UFMS) após o
// registro, extrai os dados de registro e as assinaturas da registradora,
// e atualiza o diploma no banco de dados.
//
// Body: { xml_content: string }  (conteúdo do XML como string)
//
// O que este endpoint faz:
// 1. Parseia o XML para extrair DadosRegistro (livro, número, data, etc.)
// 2. Extrai assinaturas da registradora (ordens 3-5)
// 3. Salva o XML na tabela xml_gerados (tipo = "diploma_digital")
// 4. Atualiza o diploma com dados de registro
// 5. Atualiza fluxo_assinaturas com assinaturas da registradora
// 6. Muda status do diploma para "registrado"
// ─────────────────────────────────────────────────────────────────────────────

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();
  const { id: diplomaId } = await params;

  try {
    const body = await request.json();
    const { xml_content } = body;

    if (!xml_content || typeof xml_content !== "string") {
      return NextResponse.json(
        {
          error:
            "xml_content é obrigatório e deve ser uma string com o conteúdo do XML.",
        },
        { status: 400 },
      );
    }

    // ── 1. Verifica que o diploma existe ─────────────────────────────────────
    const { data: diploma, error: diplomaError } = await supabase
      .from("diplomas")
      .select("id, processo_id, status, codigo_validacao")
      .eq("id", diplomaId)
      .single();

    if (diplomaError || !diploma) {
      return erroNaoEncontrado();
    }

    // Só aceita importação se o diploma está aguardando registro
    const statusPermitidos = [
      "aguardando_assinatura",
      "assinado_emissora",
      "enviado_registradora",
      "aguardando_registro",
    ];
    if (!statusPermitidos.includes(diploma.status)) {
      return NextResponse.json(
        {
          error: `Status atual "${diploma.status}" não permite importação de registro.`,
          detalhes: `Status permitidos: ${statusPermitidos.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // ── 2. Parseia o XML ────────────────────────────────────────────────────
    const resultado = parseDiplomaDigitalRegistrado(xml_content);

    if (!resultado.sucesso) {
      return NextResponse.json(
        {
          error: "XML não pôde ser processado completamente.",
          avisos: resultado.erros,
          dados_parciais: resultado.dados_registro,
        },
        { status: 422 },
      );
    }

    const { dados_registro, assinaturas } = resultado;

    // ── 3. Salva o XML do DiplomaDigital na tabela xml_gerados ──────────────
    // Remove registro anterior do mesmo tipo se existir (re-importação)
    await supabase
      .from("xml_gerados")
      .delete()
      .eq("diploma_id", diplomaId)
      .eq("tipo", "diploma_digital");

    const { error: xmlInsertError } = await supabase
      .from("xml_gerados")
      .insert({
        diploma_id: diplomaId,
        processo_id: diploma.processo_id,
        tipo: "diploma_digital",
        versao_xsd: "1.05",
        conteudo_xml: xml_content,
        hash_sha256: sha256(xml_content),
        validado_xsd: true, // a registradora já validou
        erros_validacao: [],
        status: "registrado",
      });

    if (xmlInsertError) {
      console.error("Erro ao salvar XML do DiplomaDigital:", xmlInsertError);
      return NextResponse.json(
        { error: "Erro ao salvar XML no banco." },
        { status: 500 },
      );
    }

    // ── 4. Atualiza o diploma com dados de registro ─────────────────────────
    const updateDiploma: Record<string, unknown> = {
      status: "registrado",
      updated_at: new Date().toISOString(),
    };

    if (dados_registro.livro_registro)
      updateDiploma.livro_registro = dados_registro.livro_registro;
    if (dados_registro.numero_registro)
      updateDiploma.numero_registro = dados_registro.numero_registro;
    if (dados_registro.processo_sei)
      updateDiploma.processo_sei = dados_registro.processo_sei;
    if (dados_registro.data_registro)
      updateDiploma.data_registro = dados_registro.data_registro;
    if (dados_registro.codigo_validacao)
      updateDiploma.codigo_validacao = dados_registro.codigo_validacao;

    const { error: updateError } = await supabase
      .from("diplomas")
      .update(updateDiploma)
      .eq("id", diplomaId);

    if (updateError) {
      console.error("Erro ao atualizar diploma:", updateError);
      return NextResponse.json(
        { error: "Erro ao atualizar diploma com dados de registro." },
        { status: 500 },
      );
    }

    // ── 5. Atualiza fluxo_assinaturas com assinaturas da registradora ───────
    // Busca assinaturas existentes da registradora neste diploma
    const assinaturasRegistradora = assinaturas.filter(
      (a) => a.papel === "registradora",
    );

    if (assinaturasRegistradora.length > 0) {
      // Busca os registros de fluxo da registradora
      const { data: fluxoExistente } = await supabase
        .from("fluxo_assinaturas")
        .select("id, ordem, assinante_id, papel")
        .eq("diploma_id", diplomaId)
        .eq("papel", "registradora")
        .order("ordem");

      // Atualiza status das assinaturas da registradora para "assinado"
      if (fluxoExistente && fluxoExistente.length > 0) {
        for (const fluxo of fluxoExistente) {
          const assinaturaCorrespondente = assinaturasRegistradora.find(
            (a) => a.ordem_sugerida === fluxo.ordem,
          );
          await supabase
            .from("fluxo_assinaturas")
            .update({
              status: "assinado",
              data_assinatura:
                assinaturaCorrespondente?.data_assinatura ??
                new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", fluxo.id);
        }
      }
    }

    // ── 6. Resposta de sucesso ──────────────────────────────────────────────
    return NextResponse.json(
      {
        sucesso: true,
        diploma_id: diplomaId,
        status_atualizado: "registrado",
        dados_registro,
        assinaturas_encontradas: assinaturas.length,
        assinaturas_registradora: assinaturasRegistradora.length,
        proximos_passos: [
          "Gerar a RVDD (Representação Visual do Diploma Digital)",
          "Publicar o diploma no portal público",
          "Notificar o diplomado por e-mail",
        ],
        mensagem:
          "XML do DiplomaDigital importado com sucesso. Diploma atualizado para status 'registrado'.",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Erro no endpoint importar-registro:", error);
    return erroInterno();
  }
}
