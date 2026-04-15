import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verificarAuth, erroNaoEncontrado, erroInterno } from "@/lib/security/api-guard";
import { validarCSRF } from "@/lib/security/csrf";
import { verificarRateLimitERP, adicionarHeadersRateLimit, adicionarHeadersRetryAfter } from "@/lib/security/rate-limit";
import { getBryConfig, bryInitialize } from "@/lib/bry";
import type { PerfilAssinatura, TipoAssinanteBry } from "@/lib/bry";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/diplomas/[id]/assinar/initialize
//
// Etapa 1 do fluxo BRy: envia XML + certificado → recebe signedAttributes
// para cifrar com a extensão BRy no browser.
//
// Body (JSON):
//   - xml_gerado_id: UUID do xml_gerados
//   - passo: número do passo (1, 2, 3)
//   - certificate: chave pública em Base64
//   - tipo_assinante: 'Representantes' | 'IESEmissoraDadosDiploma' | ...
//   - perfil: 'ADRT' | 'ADRA'
//   - specific_node_name?: 'DadosDiploma' | 'DadosRegistro' | null
//   - specific_node_namespace?: string | null
//   - include_xpath_enveloped?: boolean
// ─────────────────────────────────────────────────────────────────────────────

// BRy Initialize inclui auth OAuth2 + chamada BRy API — pode levar >10s com retries.
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── Auth + CSRF + Rate Limit ──────────────────────────────────────────────
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  const csrfError = validarCSRF(req);
  if (csrfError) return csrfError;

  const rateLimit = await verificarRateLimitERP(req, "assinatura", auth.userId);
  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      { erro: "Muitas requisições. Tente novamente em instantes." },
      { status: 429 }
    );
    adicionarHeadersRetryAfter(response.headers, rateLimit);
    return response;
  }

  // ── Configuração BRy ──────────────────────────────────────────────────────
  const bryConfig = getBryConfig();
  if (!bryConfig) {
    return NextResponse.json(
      {
        erro: "Credenciais BRy não configuradas. Configure BRY_CLIENT_ID e BRY_CLIENT_SECRET nas variáveis de ambiente.",
      },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const { id: diplomaId } = await params;

  try {
    // ── Ler body ────────────────────────────────────────────────────────────
    const body = await req.json();
    const {
      xml_gerado_id,
      passo,
      certificate,
      tipo_assinante,
      perfil,
      specific_node_name,
      specific_node_namespace,
      include_xpath_enveloped,
    } = body as {
      xml_gerado_id: string;
      passo: number;
      certificate: string;
      tipo_assinante: TipoAssinanteBry;
      perfil: PerfilAssinatura;
      specific_node_name?: string | null;
      specific_node_namespace?: string | null;
      include_xpath_enveloped?: boolean;
    };

    // Validações básicas
    if (!xml_gerado_id || !certificate || !tipo_assinante || !perfil) {
      return NextResponse.json(
        { erro: "Campos obrigatórios: xml_gerado_id, certificate, tipo_assinante, perfil" },
        { status: 400 }
      );
    }

    // ── Buscar diploma ──────────────────────────────────────────────────────
    const { data: diploma, error: diplomaErr } = await supabase
      .from("diplomas")
      .select("id, status")
      .eq("id", diplomaId)
      .single();

    if (diplomaErr || !diploma) return erroNaoEncontrado();

    // Status que permitem iniciar/continuar assinatura:
    // - xml_gerado: XMLs prontos, primeira assinatura
    // - aguardando_assinatura_emissora: transição explícita para assinar
    // - em_assinatura: assinatura em andamento (múltiplos passos)
    // - assinatura_com_erro: retry após erro
    const statusPermitidos = [
      "xml_gerado",
      "aguardando_assinatura_emissora",
      "em_assinatura",
      "assinatura_com_erro",
    ];
    if (!statusPermitidos.includes(diploma.status)) {
      return NextResponse.json(
        { erro: `Diploma não pode ser assinado no status "${diploma.status}"` },
        { status: 422 }
      );
    }

    // ── Buscar XML ──────────────────────────────────────────────────────────
    const { data: xml, error: xmlErr } = await supabase
      .from("xml_gerados")
      .select("id, tipo, conteudo_xml, arquivo_url, status")
      .eq("id", xml_gerado_id)
      .eq("diploma_id", diplomaId)
      .single();

    if (xmlErr || !xml) {
      return NextResponse.json(
        { erro: "XML não encontrado para este diploma" },
        { status: 404 }
      );
    }

    // ── Obter conteúdo do XML ───────────────────────────────────────────────
    // Prioridade: conteudo_xml (banco) → arquivo_url (storage)
    let xmlContent: string | null = null;

    if (xml.conteudo_xml) {
      xmlContent = xml.conteudo_xml;
    } else if (xml.arquivo_url) {
      const xmlResponse = await fetch(xml.arquivo_url);
      if (!xmlResponse.ok) {
        return NextResponse.json(
          { erro: "Não foi possível baixar o conteúdo do XML do storage" },
          { status: 500 }
        );
      }
      xmlContent = await xmlResponse.text();
    }

    if (!xmlContent) {
      return NextResponse.json(
        { erro: "XML sem conteúdo — gere o XML antes de assinar" },
        { status: 422 }
      );
    }

    // ── Gerar nonce (Big Integer aleatório, exigido pela BRy) ──────────────
    const { randomBytes } = await import("crypto");
    const nonce = BigInt(`0x${randomBytes(16).toString("hex")}`).toString();

    // ── Chamar BRy Initialize ───────────────────────────────────────────────
    const bryResponse = await bryInitialize(bryConfig, {
      nonce,
      certificate,
      profile: perfil,
      xmlContent,
      specificNodeName: specific_node_name ?? null,
      specificNodeNamespace: specific_node_namespace ?? null,
      includeXPathEnveloped: include_xpath_enveloped ?? undefined,
    });

    // ── Salvar no outbox ────────────────────────────────────────────────────
    await supabase.from("outbox_assinaturas").upsert(
      {
        diploma_id: diplomaId,
        xml_gerado_id: xml_gerado_id,
        passo,
        tipo_assinante,
        perfil,
        specific_node: specific_node_name ?? null,
        status: "inicializado",
        nonce,
        signed_attributes: bryResponse.signedAttributes[0]?.content ?? null,
        initialized_document: bryResponse.initializedDocuments[0]?.content ?? null,
        certificate,
        initialized_at: new Date().toISOString(),
      },
      { onConflict: "xml_gerado_id,passo" }
    );

    // Atualizar status do diploma para "em andamento" se ainda não está
    if (diploma.status === "xml_gerado" || diploma.status === "aguardando_assinatura_emissora" || diploma.status === "assinatura_com_erro") {
      await supabase
        .from("diplomas")
        .update({ status: "em_assinatura", updated_at: new Date().toISOString() })
        .eq("id", diplomaId);
    }

    // ── Resposta ────────────────────────────────────────────────────────────
    const response = NextResponse.json({
      ok: true,
      nonce,
      signedAttributes: bryResponse.signedAttributes,
      initializedDocuments: bryResponse.initializedDocuments,
    });
    adicionarHeadersRateLimit(response.headers, rateLimit);
    return response;

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    console.error("[BRy Initialize Error]", msg);
    const response = NextResponse.json({ erro: msg }, { status: 500 });
    adicionarHeadersRateLimit(response.headers, rateLimit);
    return response;
  }
}
