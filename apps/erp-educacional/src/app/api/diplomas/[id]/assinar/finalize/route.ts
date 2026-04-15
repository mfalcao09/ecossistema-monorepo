import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verificarAuth, erroNaoEncontrado } from "@/lib/security/api-guard";
import { validarCSRF } from "@/lib/security/csrf";
import { verificarRateLimitERP, adicionarHeadersRateLimit, adicionarHeadersRetryAfter } from "@/lib/security/rate-limit";
import { logDataModification } from "@/lib/security/security-logger";
import { registrarCustodiaAsync } from "@/lib/security/cadeia-custodia";
import { getBryConfig, bryFinalize, verificarEAvancarPacote } from "@/lib/bry";
import type { PerfilAssinatura } from "@/lib/bry";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/diplomas/[id]/assinar/finalize
//
// Etapa 3 do fluxo BRy: recebe signatureValue (da extensão) → chama BRy Finalize
// → retorna XML assinado em Base64.
//
// Body (JSON):
//   - xml_gerado_id: UUID
//   - passo: número do passo
//   - signature_value: base64 (signedAttributes cifrado pela extensão)
//   - certificate: chave pública em Base64
//   - perfil: 'ADRT' | 'ADRA'
//   - include_xpath_enveloped?: boolean
// ─────────────────────────────────────────────────────────────────────────────

// Finalize inclui auto-carimbo no último passo: BRy Finalize + download XML +
// upload storage + BRy Timestamp — pode exceder 10s facilmente.
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const {
      xml_gerado_id,
      passo,
      signature_value,
      certificate,
      perfil,
      include_xpath_enveloped,
    } = body as {
      xml_gerado_id: string;
      passo: number;
      signature_value: string;
      certificate: string;
      perfil: PerfilAssinatura;
      include_xpath_enveloped?: boolean;
    };

    if (!xml_gerado_id || !signature_value || !certificate || !perfil) {
      return NextResponse.json(
        { erro: "Campos obrigatórios: xml_gerado_id, signature_value, certificate, perfil" },
        { status: 400 }
      );
    }

    // ── Buscar outbox do passo ──────────────────────────────────────────────
    const { data: outbox, error: outboxErr } = await supabase
      .from("outbox_assinaturas")
      .select("*")
      .eq("xml_gerado_id", xml_gerado_id)
      .eq("passo", passo)
      .single();

    if (outboxErr || !outbox) {
      return NextResponse.json(
        { erro: `Passo ${passo} não encontrado no outbox — execute Initialize primeiro` },
        { status: 404 }
      );
    }

    if (outbox.status !== "inicializado" && outbox.status !== "assinado_extensao") {
      return NextResponse.json(
        { erro: `Passo ${passo} está no status "${outbox.status}" — esperado "inicializado"` },
        { status: 422 }
      );
    }

    if (!outbox.initialized_document) {
      return NextResponse.json(
        { erro: "initializedDocument ausente no outbox — re-execute Initialize" },
        { status: 422 }
      );
    }

    // ── Obter XML original ──────────────────────────────────────────────────
    // Prioridade: conteudo_xml (banco) → arquivo_url (storage)
    const { data: xml } = await supabase
      .from("xml_gerados")
      .select("conteudo_xml, arquivo_url")
      .eq("id", xml_gerado_id)
      .single();

    let xmlContent: string | null = null;

    if (xml?.conteudo_xml) {
      xmlContent = xml.conteudo_xml;
    } else if (xml?.arquivo_url) {
      const xmlResponse = await fetch(xml.arquivo_url);
      xmlContent = await xmlResponse.text();
    }

    if (!xmlContent) {
      return NextResponse.json({ erro: "XML sem conteúdo — gere o XML antes de assinar" }, { status: 422 });
    }

    // ── Chamar BRy Finalize ─────────────────────────────────────────────────
    const bryResponse = await bryFinalize(bryConfig, {
      nonce: outbox.nonce,
      certificate,
      profile: perfil,
      xmlContent,
      signatureValue: signature_value,
      initializedDocument: outbox.initialized_document,
      includeXPathEnveloped: include_xpath_enveloped ?? undefined,
    });

    // Extrair resultado
    const doc = bryResponse.documentos?.[0];
    const xmlAssinadoBase64 = doc?.content ?? null;
    const downloadUrl = doc?.links?.[0]?.href ?? null;

    // ── Atualizar outbox ────────────────────────────────────────────────────
    await supabase
      .from("outbox_assinaturas")
      .update({
        status: "finalizado",
        signature_value,
        xml_assinado_base64: xmlAssinadoBase64,
        download_url: downloadUrl,
        signed_at: new Date().toISOString(),
        finalized_at: new Date().toISOString(),
      })
      .eq("id", outbox.id);

    // ── Se o XML assinado foi retornado, atualizar xml_gerados ──────────────
    // NOTA: Só atualiza o xml_gerados quando TODOS os passos daquele XML
    // estiverem finalizados. Para o caso de um único passo (último), atualiza direto.
    // Para multi-passo, o frontend deve orquestrar e chamar este endpoint
    // para cada passo sequencialmente — o XML de saída de um passo
    // vira o XML de entrada do próximo.

    // ── Verificar se TODOS os passos deste XML estão finalizados ───────────────
    // IMPORTANTE: verificar SEMPRE, independente de xmlAssinadoBase64.
    // A BRy pode retornar apenas downloadUrl (sem conteúdo inline) no último passo.
    // Se só verificarmos quando xmlAssinadoBase64 != null, o auto-carimbo nunca dispara
    // nesses casos.
    let todosPassosFinalizados = false;
    let xmlAssinadoUtf8: string | null = null; // para o carimbo (sem re-fetch do storage)

    const { data: outboxAll } = await supabase
      .from("outbox_assinaturas")
      .select("status")
      .eq("xml_gerado_id", xml_gerado_id);

    todosPassosFinalizados = outboxAll?.every((o) => o.status === "finalizado") ?? false;

    if (todosPassosFinalizados) {
      const nomeArquivo = `assinado/${diplomaId}/${xml_gerado_id}_assinado.xml`;

      // ── Obter conteúdo do XML assinado final ────────────────────────────
      // Prioridade: 1) conteúdo inline da BRy (Base64)
      //             2) downloadUrl retornado pela BRy
      //             3) nenhum (carimbo buscará do arquivo_url no storage)
      if (xmlAssinadoBase64) {
        const xmlDecodificado = Buffer.from(xmlAssinadoBase64, "base64");
        xmlAssinadoUtf8 = xmlDecodificado.toString("utf8");

        // Upload para storage
        const { error: uploadErr } = await supabase.storage
          .from("xml-diplomas")
          .upload(nomeArquivo, xmlDecodificado, {
            contentType: "application/xml",
            upsert: true,
          });

        if (!uploadErr) {
          const { data: urlData } = supabase.storage
            .from("xml-diplomas")
            .getPublicUrl(nomeArquivo);

          await supabase
            .from("xml_gerados")
            .update({
              status: "assinado",
              arquivo_url: urlData.publicUrl,
              updated_at: new Date().toISOString(),
            })
            .eq("id", xml_gerado_id);
        }

      } else if (downloadUrl) {
        // BRy retornou link em vez de conteúdo inline — baixar e re-upload
        console.log("[Finalize] xmlAssinadoBase64 ausente, baixando de downloadUrl:", downloadUrl);
        try {
          const dlResp = await fetch(downloadUrl, {
            signal: AbortSignal.timeout(15_000),
          });
          if (dlResp.ok) {
            const arrayBuf = await dlResp.arrayBuffer();
            const xmlDecodificado = Buffer.from(arrayBuf);
            xmlAssinadoUtf8 = xmlDecodificado.toString("utf8");

            // Upload para storage
            const { error: uploadErr } = await supabase.storage
              .from("xml-diplomas")
              .upload(nomeArquivo, xmlDecodificado, {
                contentType: "application/xml",
                upsert: true,
              });

            if (!uploadErr) {
              const { data: urlData } = supabase.storage
                .from("xml-diplomas")
                .getPublicUrl(nomeArquivo);

              await supabase
                .from("xml_gerados")
                .update({
                  status: "assinado",
                  arquivo_url: urlData.publicUrl,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", xml_gerado_id);
            }
          } else {
            console.warn("[Finalize] downloadUrl retornou status:", dlResp.status);
          }
        } catch (dlErr) {
          console.warn("[Finalize] Falha ao baixar XML de downloadUrl:", dlErr);
          // Continuar — o auto-carimbo tentará usar arquivo_url do banco se existir
        }

      } else {
        console.warn("[Finalize] Todos passos OK mas sem xmlAssinadoBase64 nem downloadUrl — XML não salvo no storage");
      }
    }

    // ── Verificar se TODOS os XMLs do diploma estão assinados ───────────────
    const { data: xmlsTodos } = await supabase
      .from("xml_gerados")
      .select("status")
      .eq("diploma_id", diplomaId);

    const diplomaAssinado = xmlsTodos?.every((x) => x.status === "assinado");

    let pacotePronto = false;

    if (diplomaAssinado) {
      await supabase
        .from("diplomas")
        .update({ status: "assinado", updated_at: new Date().toISOString() })
        .eq("id", diplomaId);

      // Log e cadeia de custódia
      void logDataModification(req, auth.userId, "diplomas", "update", 1, {
        acao: "assinatura_finalizada",
        modo: "bry_initialize_finalize",
      });

      void registrarCustodiaAsync({
        diplomaId,
        etapa: "assinatura_emissora",
        status: "sucesso",
        request: req,
        userId: auth.userId,
        detalhes: { modo: "bry_initialize_finalize", passo },
      });

      // Avançar status para aguardando_envio_registradora quando todos
      // os XMLs estão assinados. O carimbo do tempo (AD-RA) já está
      // embutido na própria assinatura BRy — não é necessário chamar
      // o serviço de carimbo separado.
      pacotePronto = await verificarEAvancarPacote(supabase, diplomaId);
    }

    // ── Resposta ────────────────────────────────────────────────────────────
    const response = NextResponse.json({
      ok: true,
      passo,
      status: "finalizado",
      xml_assinado_base64: xmlAssinadoBase64,
      download_url: downloadUrl,
      diploma_totalmente_assinado: diplomaAssinado ?? false,
      pacote_pronto: pacotePronto, // true = diploma pronto para registradora
    });
    adicionarHeadersRateLimit(response.headers, rateLimit);
    return response;

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    console.error("[BRy Finalize Error]", msg);

    const response = NextResponse.json({ erro: msg }, { status: 500 });
    adicionarHeadersRateLimit(response.headers, rateLimit);
    return response;
  }
}
