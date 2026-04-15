import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verificarAuth, erroNaoEncontrado } from "@/lib/security/api-guard";
import { validarCSRF } from "@/lib/security/csrf";
import { verificarRateLimitERP, adicionarHeadersRateLimit, adicionarHeadersRetryAfter } from "@/lib/security/rate-limit";
import { logDataModification } from "@/lib/security/security-logger";
import { registrarCustodiaAsync } from "@/lib/security/cadeia-custodia";
import { getBryConfig, getPassosAssinaturaDinamicos } from "@/lib/bry";
import type { TipoDocumentoBry, AssinanteBanco } from "@/lib/bry";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/diplomas/[id]/assinar
//
// Retorna o estado atual da assinatura do diploma:
// - Quais XMLs precisam ser assinados
// - Quais passos cada XML tem (conforme tipo)
// - Status de cada passo (via outbox_assinaturas)
// - Se BRy está configurado ou não
//
// O frontend usa esta resposta para renderizar a UI de assinatura.
// ─────────────────────────────────────────────────────────────────────────────

// Mapear tipo do xml_gerados para TipoDocumentoBry
function mapTipoXml(tipo: string): TipoDocumentoBry | null {
  const mapa: Record<string, TipoDocumentoBry> = {
    documentacao_academica: "XMLDocumentacaoAcademica",
    doc_academica_registro: "XMLDocumentacaoAcademica",
    diplomado: "XMLDiplomado",
    historico_escolar: "XMLHistoricoEscolar",
    curriculo_escolar: "XMLCurriculoEscolar",
  };
  return mapa[tipo] ?? null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  const rateLimit = await verificarRateLimitERP(req, "api_read", auth.userId);
  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      { erro: "Muitas requisições." },
      { status: 429 }
    );
    adicionarHeadersRetryAfter(response.headers, rateLimit);
    return response;
  }

  const supabase = await createClient();
  const { id: diplomaId } = await params;

  try {
    // Buscar diploma
    const { data: diploma, error: diplomaErr } = await supabase
      .from("diplomas")
      .select("id, status")
      .eq("id", diplomaId)
      .single();

    if (diplomaErr || !diploma) return erroNaoEncontrado();

    // Buscar XMLs válidos
    const { data: xmls } = await supabase
      .from("xml_gerados")
      .select("id, tipo, status, validado_xsd")
      .eq("diploma_id", diplomaId)
      .eq("validado_xsd", true)
      .order("tipo");

    // Buscar outbox existente
    const { data: outbox } = await supabase
      .from("outbox_assinaturas")
      .select("*")
      .eq("diploma_id", diplomaId)
      .order("passo");

    // BRy configurado?
    const bryConfig = getBryConfig();
    const bryConfigurado = !!bryConfig;

    // Buscar assinantes ativos para gerar passos dinâmicos
    const { data: assinantes } = await supabase
      .from("assinantes")
      .select("id, nome, cpf, cargo, tipo_certificado, ordem_assinatura, ativo")
      .eq("ativo", true)
      .order("ordem_assinatura", { ascending: true });

    // Montar resposta com passos para cada XML
    const xmlsComPassos = (xmls ?? []).map((xml) => {
      const tipoBry = mapTipoXml(xml.tipo);
      const passos = tipoBry
        ? getPassosAssinaturaDinamicos(tipoBry, (assinantes ?? []) as AssinanteBanco[])
        : [];

      // Mesclar com outbox existente
      const passosComStatus = passos.map((p) => {
        const ob = outbox?.find(
          (o) => o.xml_gerado_id === xml.id && o.passo === p.passo
        );
        return {
          ...p,
          status: ob?.status ?? "pendente",
          nonce: ob?.nonce ?? null,
          initialized_at: ob?.initialized_at ?? null,
          signed_at: ob?.signed_at ?? null,
          finalized_at: ob?.finalized_at ?? null,
          erro_mensagem: ob?.erro_mensagem ?? null,
        };
      });

      return {
        xml_gerado_id: xml.id,
        tipo: xml.tipo,
        tipo_bry: tipoBry,
        status_xml: xml.status,
        passos: passosComStatus,
      };
    });

    // Incluir assinantes na resposta para o frontend filtrar por certificado
    const assinantesResumo = (assinantes ?? []).map((a) => ({
      id: a.id,
      nome: a.nome,
      cpf: a.cpf,
      tipo_certificado: a.tipo_certificado,
      cargo: a.cargo,
    }));

    const response = NextResponse.json({
      diploma_id: diplomaId,
      status_diploma: diploma.status,
      bry_configurado: bryConfigurado,
      bry_ambiente: bryConfig?.isHomologacao ? "homologacao" : bryConfig ? "producao" : null,
      xmls: xmlsComPassos,
      assinantes: assinantesResumo,
    });
    adicionarHeadersRateLimit(response.headers, rateLimit);
    return response;

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    const response = NextResponse.json({ erro: msg }, { status: 500 });
    adicionarHeadersRateLimit(response.headers, rateLimit);
    return response;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/diplomas/[id]/assinar
//
// Modo mock (quando BRy NÃO está configurado) — simula assinatura.
// Quando BRy ESTÁ configurado, retorna 400 orientando a usar /initialize + /finalize.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  const csrfError = validarCSRF(req);
  if (csrfError) return csrfError;

  const bryConfig = getBryConfig();

  // Se BRy está configurado, redirecionar para as rotas initialize/finalize
  if (bryConfig) {
    return NextResponse.json(
      {
        erro: "BRy está configurado. Use as rotas /initialize e /finalize para o fluxo real de assinatura.",
        rotas: {
          estado: "GET /api/diplomas/{id}/assinar",
          initialize: "POST /api/diplomas/{id}/assinar/initialize",
          finalize: "POST /api/diplomas/{id}/assinar/finalize",
        },
      },
      { status: 400 }
    );
  }

  // Modo mock (sem BRy configurado)
  const rateLimit = await verificarRateLimitERP(req, "assinatura", auth.userId);
  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      { erro: "Muitas requisições." },
      { status: 429 }
    );
    adicionarHeadersRetryAfter(response.headers, rateLimit);
    return response;
  }

  const supabase = await createClient();
  const { id: diplomaId } = await params;

  try {
    const { data: diploma } = await supabase
      .from("diplomas")
      .select("id, status")
      .eq("id", diplomaId)
      .single();

    if (!diploma) return erroNaoEncontrado();

    const statusPermitidos = ["xml_gerado", "aguardando_assinatura_emissora", "em_assinatura", "assinatura_com_erro"];
    if (!statusPermitidos.includes(diploma.status)) {
      return NextResponse.json(
        { erro: `Status atual "${diploma.status}" não permite assinatura mock.` },
        { status: 422 }
      );
    }

    const { data: xmls } = await supabase
      .from("xml_gerados")
      .select("id, tipo, status")
      .eq("diploma_id", diplomaId)
      .eq("validado_xsd", true)
      .in("status", ["gerado", "assinatura_pendente"]);

    if (!xmls || xmls.length === 0) {
      return NextResponse.json(
        { erro: "Nenhum XML válido encontrado para assinatura mock." },
        { status: 422 }
      );
    }

    // Simular assinatura
    const resultados = [];
    for (const xml of xmls) {
      const mockJobId = `MOCK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      await supabase
        .from("xml_gerados")
        .update({ status: "assinado", updated_at: new Date().toISOString() })
        .eq("id", xml.id);

      resultados.push({ xml_id: xml.id, tipo: xml.tipo, status: "mock" as const, job_id: mockJobId });
    }

    await supabase
      .from("diplomas")
      .update({ status: "assinado", updated_at: new Date().toISOString() })
      .eq("id", diplomaId);

    // Log (non-blocking)
    void logDataModification(req, auth.userId, "diplomas", "update", 1, {
      acao: "assinatura_mock",
      xmls_processados: resultados.length,
    });

    void registrarCustodiaAsync({
      diplomaId,
      etapa: "assinatura_emissora",
      status: "sucesso",
      request: req,
      userId: auth.userId,
      detalhes: { modo: "mock", resultados },
    });

    const response = NextResponse.json({
      ok: true,
      novo_status: "assinado",
      modo: "mock",
      aviso: "Assinatura em modo SIMULAÇÃO. Configure BRY_CLIENT_ID e BRY_CLIENT_SECRET para assinatura real via BRy.",
      xmls: resultados,
    });
    adicionarHeadersRateLimit(response.headers, rateLimit);
    return response;

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    const response = NextResponse.json({ erro: msg }, { status: 500 });
    adicionarHeadersRateLimit(response.headers, rateLimit);
    return response;
  }
}
