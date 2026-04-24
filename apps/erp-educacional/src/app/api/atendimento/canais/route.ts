/**
 * GET  /api/atendimento/canais  — lista canais configurados
 * POST /api/atendimento/canais  — cria novo canal + inbox operacional
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

type TipoCanal =
  | "whatsapp-cloud"
  | "whatsapp-qr"
  | "instagram"
  | "messenger"
  | "email"
  | "telegram"
  | "webchat"
  | "sms"
  | "reclame-aqui";

// ---------------------------------------------------------------------------
// Supabase (service role — operações de escrita seguras)
// ---------------------------------------------------------------------------
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Supabase env vars ausentes");
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface NovoCanalPayload {
  tipo: TipoCanal;
  nome: string;
  cor: string;
  ambiente: "demo" | "producao";
  config: Record<string, string | boolean>;
  atendimento: {
    departamento: string;
    saudacao: string;
    foraExpediente: string;
    sincronizarContatos: boolean;
    criarCardCrm: boolean;
  };
}

// ---------------------------------------------------------------------------
// GET — lista canais
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("atendimento_canais")
      .select(
        "id, tipo, nome, cor, ambiente, status, receber_mensagens, identificador, ultima_atividade_at, inbox_id",
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[canais:GET]", err);
    return NextResponse.json(
      { error: "Erro ao listar canais" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — criar canal
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  let body: NovoCanalPayload;
  try {
    body = (await req.json()) as NovoCanalPayload;
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const { tipo, nome, cor, ambiente, config, atendimento } = body;

  // Validação básica
  if (!tipo || !nome || nome.trim().length < 3) {
    return NextResponse.json(
      { error: "nome inválido (mínimo 3 caracteres)" },
      { status: 422 },
    );
  }

  try {
    const supabase = getSupabase();

    // ------------------------------------------------------------------
    // 1. Montar provider_config por tipo de canal
    //    Fase 1: tokens em texto simples no JSONB.
    //    Fase 2 (TODO SC-29): mover tokens para Vault; guardar vault_key.
    // ------------------------------------------------------------------
    const providerConfig = buildProviderConfig(tipo, config);

    // ------------------------------------------------------------------
    // 2. Status inicial
    // ------------------------------------------------------------------
    const statusInicial =
      ambiente === "demo"
        ? "demo"
        : tipo === "whatsapp-qr"
          ? "aguardando"
          : "aguardando";

    // ------------------------------------------------------------------
    // 3. Criar canal em atendimento_canais
    // ------------------------------------------------------------------
    const { data: canal, error: canalErr } = await supabase
      .from("atendimento_canais")
      .insert({
        tipo,
        nome: nome.trim(),
        cor: cor || "#16a34a",
        ambiente,
        status: statusInicial,
        provider_config: providerConfig,
        atendimento_config: {
          departamento: atendimento.departamento,
          saudacao: atendimento.saudacao,
          fora_expediente: atendimento.foraExpediente,
          sincronizar_contatos: atendimento.sincronizarContatos,
          criar_card_crm: atendimento.criarCardCrm,
        },
      })
      .select("*")
      .single();

    if (canalErr) throw canalErr;

    // ------------------------------------------------------------------
    // 4. Para whatsapp-cloud em produção: criar inbox operacional e
    //    vincular de volta ao canal.
    //    O identificador real (número de telefone) é preenchido após
    //    verificação bem-sucedida via /connect-meta.
    // ------------------------------------------------------------------
    if (tipo === "whatsapp-cloud" && ambiente !== "demo") {
      const inboxResult = await criarInboxWhatsappCloud(
        supabase,
        canal.id,
        nome,
        providerConfig,
      );
      if (inboxResult.inboxId) {
        await supabase
          .from("atendimento_canais")
          .update({ inbox_id: inboxResult.inboxId })
          .eq("id", canal.id);
        canal.inbox_id = inboxResult.inboxId;
      }
    }

    return NextResponse.json(canal, { status: 201 });
  } catch (err) {
    console.error("[canais:POST]", err);
    return NextResponse.json(
      { error: "Erro ao criar canal", detail: String(err) },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildProviderConfig(
  tipo: TipoCanal,
  config: Record<string, string | boolean>,
): Record<string, unknown> {
  switch (tipo) {
    case "whatsapp-cloud":
      return {
        app_id: config["app_id"] ?? "",
        phone_number_id: config["phone_id"] ?? "",
        waba_id: config["waba_id"] ?? "",
        // Fase 1: access_token em texto. Fase 2: mover para Vault (SC-29).
        access_token: config["token"] ?? "",
        app_secret: config["app_secret"] ?? "",
      };
    case "whatsapp-qr":
      return { maturado: config["maturado"] === true };
    case "instagram":
    case "messenger":
      return {
        fb_conectado: config["fb_conectado"] === true,
        page_id: config["page_id"] ?? "",
        page_name: config["page_name"] ?? "",
        // access_token recebido via OAuth callback
        access_token: config["access_token"] ?? "",
      };
    case "email":
      return {
        provedor: config["provedor"] ?? "",
        imap_host: config["imap_host"] ?? "",
        email: config["email"] ?? "",
        // Fase 2: senha para Vault
        senha: config["senha"] ?? "",
        oauth_concluido: config["oauth_concluido"] === true,
      };
    case "telegram":
      return {
        // Fase 2: bot_token para Vault
        bot_token: config["bot_token"] ?? "",
      };
    default:
      return {};
  }
}

async function criarInboxWhatsappCloud(
  supabase: ReturnType<typeof getSupabase>,
  canalId: string,
  nome: string,
  providerConfig: Record<string, unknown>,
): Promise<{ inboxId: string | null }> {
  const { data: inbox, error } = await supabase
    .from("atendimento_inboxes")
    .insert({
      name: nome,
      channel_type: "whatsapp",
      enabled: true,
      provider_config: {
        phone_number_id: providerConfig["phone_number_id"],
        waba_id: providerConfig["waba_id"],
        access_token: providerConfig["access_token"],
        canal_id: canalId, // backreference
      },
    })
    .select("id")
    .single();

  if (error) {
    console.error("[criarInboxWhatsappCloud]", error);
    return { inboxId: null };
  }
  return { inboxId: inbox.id as string };
}
