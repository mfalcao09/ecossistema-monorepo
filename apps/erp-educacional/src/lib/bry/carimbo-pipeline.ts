// ─────────────────────────────────────────────────────────────────────────────
// carimbo-pipeline.ts
//
// Utilitários de servidor para aplicar carimbo do tempo e avançar o pipeline
// de emissão até o pacote para a registradora.
//
// Funções internas — sem contexto de Request/Auth — chamadas diretamente
// pelo finalize/route.ts (com o XML assinado já em memória) e pelo
// carimbo/route.ts (busca do storage).
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BryConfig } from "./config";
import { aplicarCarimboDoTempo } from "./timestamp-service";

// ─── Resultado do carimbo ────────────────────────────────────────────────────

export interface ResultadoCarimboInterno {
  ok: boolean;
  nonce?: string;
  erro?: string;
  jaCarimbado?: boolean;
}

// ─── Aplicar carimbo a um XML assinado ──────────────────────────────────────

/**
 * Aplica carimbo do tempo (BRy Timestamp Service) a um XML assinado.
 *
 * Prioridade de conteúdo:
 *   1. `xmlContentOverride` — passado diretamente do finalize (XML fresco da BRy)
 *   2. `xml_gerados.arquivo_url` — XML assinado no storage (CORRETO pós-finalize)
 *   3. `xml_gerados.conteudo_xml` — fallback (original não assinado — só se nenhum acima existir)
 *
 * É idempotente: retorna { ok: true, jaCarimbado: true } se carimbo já existe.
 *
 * @param supabase  Client Supabase com permissão de leitura/escrita em xml_gerados
 * @param bryConfig Configuração BRy (OAuth2 + URLs)
 * @param xmlGeradoId UUID da linha em xml_gerados
 * @param xmlContentOverride Conteúdo XML já assinado (string UTF-8) — passar quando disponível
 */
export async function aplicarCarimboXmlInterno(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  bryConfig: BryConfig,
  xmlGeradoId: string,
  xmlContentOverride?: string
): Promise<ResultadoCarimboInterno> {
  try {
    // ── Idempotência ──────────────────────────────────────────────────────
    const { data: xml } = await supabase
      .from("xml_gerados")
      .select("id, tipo, status, carimbo_tempo_base64, conteudo_xml, arquivo_url")
      .eq("id", xmlGeradoId)
      .single();

    if (!xml) return { ok: false, erro: "XML não encontrado" };
    if (xml.carimbo_tempo_base64) return { ok: true, jaCarimbado: true };

    // ── Obter conteúdo do XML assinado ─────────────────────────────────────
    let xmlContent: string | null = xmlContentOverride ?? null;

    // Prioridade: arquivo_url (XML assinado em storage) antes de conteudo_xml (original)
    if (!xmlContent && xml.arquivo_url) {
      try {
        const resp = await fetch(xml.arquivo_url, {
          signal: AbortSignal.timeout(12_000),
        });
        if (resp.ok) xmlContent = await resp.text();
      } catch {
        console.warn("[CarimboPipeline] Falha ao baixar XML do storage, tentando conteudo_xml");
      }
    }

    if (!xmlContent && xml.conteudo_xml) {
      xmlContent = xml.conteudo_xml;
    }

    if (!xmlContent) {
      return { ok: false, erro: "XML sem conteúdo disponível para carimbar" };
    }

    // ── Aplicar carimbo via BRy Timestamp Service (modo HASH) ─────────────
    const resultado = await aplicarCarimboDoTempo(bryConfig, xmlContent);

    // ── Persistir carimbo ─────────────────────────────────────────────────
    const { error: updateErr } = await supabase
      .from("xml_gerados")
      .update({
        carimbo_tempo_base64: resultado.carimboBase64,
        carimbo_tempo_nonce: String(resultado.nonce),
        carimbo_tempo_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", xmlGeradoId);

    if (updateErr) {
      console.error("[CarimboPipeline] Erro ao persistir carimbo:", updateErr);
      return { ok: false, erro: `Carimbo gerado mas falha ao salvar: ${updateErr.message}` };
    }

    return { ok: true, nonce: String(resultado.nonce) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido no carimbo";
    console.error("[CarimboPipeline] Exceção:", msg);
    return { ok: false, erro: msg };
  }
}

// ─── Verificar se todos os XMLs estão carimbados e avançar status ────────────

/**
 * Verifica se TODOS os XMLs de um diploma estão assinados E carimbados.
 * Se sim, avança o status do diploma para `aguardando_envio_registradora`.
 *
 * Guard: só avança se o status atual for `assinado` ou `aplicando_carimbo_tempo`
 * (não retrocede status de diplomados já em fases posteriores).
 *
 * @returns true se o pacote para registradora está pronto
 */
export async function verificarEAvancarPacote(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  diplomaId: string
): Promise<boolean> {
  const { data: xmls } = await supabase
    .from("xml_gerados")
    .select("id, tipo, status")
    .eq("diploma_id", diplomaId);

  if (!xmls || xmls.length === 0) return false;

  // Todos devem estar com status 'assinado'.
  // O carimbo do tempo (AD-RA) já está embutido na própria assinatura BRy —
  // não exigimos carimbo_tempo_base64 separado para avançar o pacote.
  const todosAssinados = xmls.every((x) => x.status === "assinado");

  if (!todosAssinados) return false;

  // Avançar status do diploma para aguardando_documentos (Etapa 2 — Acervo Digital).
  // Sprint 6: O acervo deve ser confirmado ANTES de ir para aguardando_envio_registradora.
  // A transição aguardando_documentos → aguardando_envio_registradora será feita
  // pelo endpoint de confirmação de acervo (Sprint 6 item 6.4).
  await supabase
    .from("diplomas")
    .update({
      status: "aguardando_documentos",
      updated_at: new Date().toISOString(),
    })
    .eq("id", diplomaId)
    .in("status", ["assinado", "aplicando_carimbo_tempo", "em_assinatura"]);

  console.log(`[CarimboPipeline] Diploma ${diplomaId} avançou para aguardando_documentos (Etapa 2 — Acervo).`);
  return true;
}
