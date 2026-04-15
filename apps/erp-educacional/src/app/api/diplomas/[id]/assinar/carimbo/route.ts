import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verificarAuth, erroNaoEncontrado } from "@/lib/security/api-guard";
import { validarCSRF } from "@/lib/security/csrf";
import {
  verificarRateLimitERP,
  adicionarHeadersRateLimit,
  adicionarHeadersRetryAfter,
} from "@/lib/security/rate-limit";
import { logDataModification } from "@/lib/security/security-logger";
import { registrarCustodiaAsync } from "@/lib/security/cadeia-custodia";
import { getBryConfig, aplicarCarimboDoTempo } from "@/lib/bry";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/diplomas/[id]/assinar/carimbo
//
// Aplica carimbo do tempo (timestamp) em um XML assinado do diploma.
// Deve ser chamado APÓS todos os passos de assinatura (incluindo AD-RA)
// estarem finalizados para um dado xml_gerado_id.
//
// Body (JSON):
//   - xml_gerado_id: UUID do XML assinado
//
// O carimbo é aplicado via hash SHA256 do XML final assinado e armazenado
// no campo `carimbo_tempo` da tabela outbox_assinaturas (último passo AD-RA)
// e no campo `carimbo_tempo_base64` da tabela xml_gerados.
// ─────────────────────────────────────────────────────────────────────────────

// BRy auth + fetch XML storage + timestamp service pode exceder 10s facilmente.
// 60s é suficiente para cobrir retries de 429 (até ~10.5s) + XML fetch (12s) + timestamp (30s).
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
      { erro: "Credenciais BRy não configuradas." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const { id: diplomaId } = await params;

  try {
    const body = await req.json();
    const { xml_gerado_id } = body as { xml_gerado_id: string };

    if (!xml_gerado_id) {
      return NextResponse.json(
        { erro: "Campo obrigatório: xml_gerado_id" },
        { status: 400 }
      );
    }

    // ── Validar diploma ────────────────────────────────────────────────────
    const { data: diploma, error: diplomaErr } = await supabase
      .from("diplomas")
      .select("id, status")
      .eq("id", diplomaId)
      .single();

    if (diplomaErr || !diploma) return erroNaoEncontrado();

    // Carimbo pode ser aplicado quando está em_assinatura ou já assinado
    const statusPermitidos = ["em_assinatura", "assinado"];
    if (!statusPermitidos.includes(diploma.status)) {
      return NextResponse.json(
        {
          erro: `Diploma no status "${diploma.status}" — carimbo só pode ser aplicado após assinatura`,
        },
        { status: 422 }
      );
    }

    // ── Verificar se todos os passos de assinatura estão finalizados ───────
    const { data: outboxAll, error: outboxErr } = await supabase
      .from("outbox_assinaturas")
      .select("id, passo, status, perfil")
      .eq("xml_gerado_id", xml_gerado_id)
      .order("passo");

    if (outboxErr || !outboxAll || outboxAll.length === 0) {
      return NextResponse.json(
        { erro: "Nenhum passo de assinatura encontrado para este XML" },
        { status: 404 }
      );
    }

    const todosFinaliz = outboxAll.every((o) => o.status === "finalizado");
    if (!todosFinaliz) {
      const pendentes = outboxAll
        .filter((o) => o.status !== "finalizado")
        .map((o) => `Passo ${o.passo} (${o.status})`)
        .join(", ");
      return NextResponse.json(
        {
          erro: `Nem todos os passos estão finalizados. Pendentes: ${pendentes}`,
        },
        { status: 422 }
      );
    }

    // ── Buscar XML assinado ─────────────────────────────────────────────────
    const { data: xml, error: xmlErr } = await supabase
      .from("xml_gerados")
      .select("id, tipo, conteudo_xml, arquivo_url, status, carimbo_tempo_base64")
      .eq("id", xml_gerado_id)
      .eq("diploma_id", diplomaId)
      .single();

    if (xmlErr || !xml) {
      return NextResponse.json(
        { erro: "XML não encontrado para este diploma" },
        { status: 404 }
      );
    }

    // Se já tem carimbo, retorna sucesso idempotente
    if (xml.carimbo_tempo_base64) {
      const response = NextResponse.json({
        ok: true,
        ja_carimbado: true,
        xml_gerado_id,
        tipo: xml.tipo,
        mensagem: "Este XML já possui carimbo do tempo",
      });
      adicionarHeadersRateLimit(response.headers, rateLimit);
      return response;
    }

    // ── Obter conteúdo do XML assinado ──────────────────────────────────────
    // ATENÇÃO: arquivo_url aponta para o XML ASSINADO (pós-finalize).
    // conteudo_xml é o XML original NÃO assinado.
    // O carimbo DEVE ser sobre o XML assinado → prioridade: arquivo_url.
    let xmlContent: string | null = null;

    if (xml.arquivo_url) {
      const xmlResponse = await fetch(xml.arquivo_url, {
        signal: AbortSignal.timeout(12_000),
      });
      if (!xmlResponse.ok) {
        return NextResponse.json(
          { erro: "Não foi possível baixar o XML assinado do storage" },
          { status: 500 }
        );
      }
      xmlContent = await xmlResponse.text();
    } else if (xml.conteudo_xml) {
      // Fallback: XML original (apenas quando arquivo_url ainda não existe)
      xmlContent = xml.conteudo_xml;
    }

    if (!xmlContent) {
      return NextResponse.json(
        { erro: "XML sem conteúdo — assine antes de aplicar carimbo" },
        { status: 422 }
      );
    }

    // ── Aplicar carimbo do tempo ────────────────────────────────────────────
    const resultado = await aplicarCarimboDoTempo(bryConfig, xmlContent);

    // ── Salvar carimbo no xml_gerados ──────────────────────────────────────
    const { error: updateErr } = await supabase
      .from("xml_gerados")
      .update({
        carimbo_tempo_base64: resultado.carimboBase64,
        carimbo_tempo_nonce: resultado.nonce,
        carimbo_tempo_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", xml_gerado_id);

    if (updateErr) {
      console.error("[Carimbo] Erro ao salvar:", updateErr);
      return NextResponse.json(
        { erro: "Carimbo gerado com sucesso mas falha ao salvar no banco" },
        { status: 500 }
      );
    }

    // ── Log e cadeia de custódia ────────────────────────────────────────────
    void logDataModification(req, auth.userId, "xml_gerados", "update", 1, {
      acao: "carimbo_do_tempo",
      xml_gerado_id,
      tipo: xml.tipo,
    });

    void registrarCustodiaAsync({
      diplomaId,
      etapa: "carimbo_do_tempo",
      status: "sucesso",
      request: req,
      userId: auth.userId,
      detalhes: {
        xml_gerado_id,
        tipo: xml.tipo,
        nonce: resultado.nonce,
      },
    });

    // ── Resposta ────────────────────────────────────────────────────────────
    const response = NextResponse.json({
      ok: true,
      xml_gerado_id,
      tipo: xml.tipo,
      nonce: resultado.nonce,
      carimbo_base64_preview: resultado.carimboBase64.slice(0, 80) + "...",
      mensagem: "Carimbo do tempo aplicado com sucesso",
    });
    adicionarHeadersRateLimit(response.headers, rateLimit);
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    console.error("[BRy Carimbo Error]", msg);
    const response = NextResponse.json({ erro: msg }, { status: 500 });
    adicionarHeadersRateLimit(response.headers, rateLimit);
    return response;
  }
}
