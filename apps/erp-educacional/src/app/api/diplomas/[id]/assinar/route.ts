import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verificarAuth, erroNaoEncontrado } from "@/lib/security/api-guard";
import { verificarRateLimitERP, adicionarHeadersRateLimit, adicionarHeadersRetryAfter } from "@/lib/security/rate-limit";
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
// POST /api/diplomas/[id]/assinar — REMOVIDO
//
// Este endpoint não existe mais. O modo simulação foi eliminado.
// Use o fluxo real: /initialize → assinatura certificado A3 → /finalize
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  _ctx: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    {
      erro: "Este endpoint foi removido. Assinatura simulada não é mais suportada.",
      rotas: {
        estado: "GET /api/diplomas/{id}/assinar",
        initialize: "POST /api/diplomas/{id}/assinar/initialize",
        finalize: "POST /api/diplomas/{id}/assinar/finalize",
      },
    },
    { status: 410 }
  );
}
