/**
 * POST /api/atendimento/canais/[id]/connect-meta
 *
 * Recebe o `code` retornado pelo Embedded Signup da Meta, troca por um
 * token permanente server-to-server e ativa o canal + inbox operacional.
 *
 * Fluxo:
 *   1. Frontend abre popup via FB.login({ config_id: '1140027898257109' })
 *   2. Usuário autoriza → Meta retorna { code, waba_id, phone_number_id }
 *   3. Frontend chama este endpoint com esses dados
 *   4. Aqui trocamos code → token via Meta Graph API
 *   5. Gravamos credenciais, buscamos o número de telefone real, atualizamos
 *      o canal e o inbox operacional.
 *
 * Env vars necessárias (Nexvy como Tech Provider):
 *   META_APP_ID            = 1289456453376034
 *   META_APP_SECRET        = <nexvy app secret>
 *   NEXT_PUBLIC_APP_URL    = https://erp.fic.edu.br  (para URL do webhook)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

const META_GRAPH = "https://graph.facebook.com/v20.0";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Supabase env vars ausentes");
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: canalId } = await params;

  // ------------------------------------------------------------------
  // 1. Validar env vars do Nexvy (Tech Provider)
  // ------------------------------------------------------------------
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://erp.fic.edu.br";

  if (!appId || !appSecret) {
    console.error("[connect-meta] META_APP_ID ou META_APP_SECRET ausentes");
    return NextResponse.json(
      { error: "Configuração Meta incompleta no servidor" },
      { status: 500 },
    );
  }

  // ------------------------------------------------------------------
  // 2. Receber payload do frontend
  // ------------------------------------------------------------------
  let body: { code: string; waba_id: string; phone_number_id: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const { code, waba_id, phone_number_id } = body;
  if (!code || !waba_id || !phone_number_id) {
    return NextResponse.json(
      { error: "code, waba_id e phone_number_id são obrigatórios" },
      { status: 422 },
    );
  }

  // ------------------------------------------------------------------
  // 3. Verificar que o canal existe
  // ------------------------------------------------------------------
  const supabase = getSupabase();
  const { data: canal, error: canalErr } = await supabase
    .from("atendimento_canais")
    .select("id, nome, tipo, inbox_id, provider_config")
    .eq("id", canalId)
    .single();

  if (canalErr || !canal) {
    return NextResponse.json(
      { error: "Canal não encontrado" },
      { status: 404 },
    );
  }

  // ------------------------------------------------------------------
  // 4. Trocar code → access_token (server-to-server, nunca no frontend)
  // ------------------------------------------------------------------
  let accessToken: string;
  try {
    const tokenRes = await fetch(
      `https://graph.facebook.com/oauth/access_token` +
        `?client_id=${appId}` +
        `&client_secret=${encodeURIComponent(appSecret)}` +
        `&code=${encodeURIComponent(code)}`,
    );
    const tokenData = (await tokenRes.json()) as Record<string, unknown>;

    if (!tokenData["access_token"]) {
      console.error("[connect-meta] Falha na troca de token:", tokenData);
      return NextResponse.json(
        { error: "Falha ao obter token da Meta", detail: tokenData },
        { status: 502 },
      );
    }
    accessToken = String(tokenData["access_token"]);
  } catch (err) {
    console.error("[connect-meta] Erro na chamada Meta oauth:", err);
    return NextResponse.json(
      { error: "Erro de rede ao contatar Meta" },
      { status: 502 },
    );
  }

  // ------------------------------------------------------------------
  // 5. Buscar número de telefone real (display_phone_number)
  // ------------------------------------------------------------------
  let identificador = phone_number_id; // fallback
  try {
    const phoneRes = await fetch(
      `${META_GRAPH}/${phone_number_id}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const phoneData = (await phoneRes.json()) as Record<string, unknown>;
    if (phoneData["display_phone_number"]) {
      identificador = String(phoneData["display_phone_number"]);
    }
  } catch {
    // Não bloqueia — usamos o phone_number_id como fallback
    console.warn("[connect-meta] Não foi possível buscar display_phone_number");
  }

  // ------------------------------------------------------------------
  // 6. Registrar webhook na WABA do cliente
  // ------------------------------------------------------------------
  const webhookUrl = `${appUrl}/api/atendimento/webhook`;
  const verifyToken =
    process.env.META_WEBHOOK_VERIFY_TOKEN ?? "fic-meta-webhook-2026";

  try {
    const subRes = await fetch(`${META_GRAPH}/${waba_id}/subscribed_apps`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        callback_url: webhookUrl,
        verify_token: verifyToken,
        fields: ["messages"],
      }),
    });
    const subData = (await subRes.json()) as Record<string, unknown>;
    if (!subData["success"]) {
      console.warn("[connect-meta] WABA subscription warning:", subData);
      // Não bloqueia — o webhook pode já estar configurado
    }
  } catch (err) {
    console.warn("[connect-meta] Erro ao registrar webhook WABA:", err);
    // Não bloqueia
  }

  // ------------------------------------------------------------------
  // 7. Atualizar canal com credenciais reais
  //    Fase 1: access_token em texto no provider_config.
  //    Fase 2 (TODO SC-29): mover para Vault — guardar vault_key aqui.
  // ------------------------------------------------------------------
  const novoProviderConfig = {
    ...(canal.provider_config as Record<string, unknown>),
    phone_number_id,
    waba_id,
    access_token: accessToken,
    app_id: appId,
  };

  const { error: updateCanalErr } = await supabase
    .from("atendimento_canais")
    .update({
      provider_config: novoProviderConfig,
      identificador,
      status: "ativo",
      conectado_at: new Date().toISOString(),
    })
    .eq("id", canalId);

  if (updateCanalErr) {
    console.error("[connect-meta] Erro ao atualizar canal:", updateCanalErr);
    return NextResponse.json(
      { error: "Erro ao salvar credenciais" },
      { status: 500 },
    );
  }

  // ------------------------------------------------------------------
  // 8. Criar ou atualizar inbox operacional (atendimento_inboxes)
  // ------------------------------------------------------------------
  const inboxProviderConfig = {
    phone_number_id,
    waba_id,
    access_token: accessToken,
    canal_id: canalId,
  };

  let inboxId: string | null = canal.inbox_id as string | null;

  if (inboxId) {
    // Atualizar inbox existente
    await supabase
      .from("atendimento_inboxes")
      .update({
        provider_config: inboxProviderConfig,
        enabled: true,
      })
      .eq("id", inboxId);
  } else {
    // Criar novo inbox
    const { data: novoInbox, error: inboxErr } = await supabase
      .from("atendimento_inboxes")
      .insert({
        name: canal.nome as string,
        channel_type: "whatsapp",
        enabled: true,
        provider_config: inboxProviderConfig,
      })
      .select("id")
      .single();

    if (inboxErr) {
      console.error("[connect-meta] Erro ao criar inbox:", inboxErr);
    } else {
      inboxId = novoInbox.id as string;
      // Vincular inbox ao canal
      await supabase
        .from("atendimento_canais")
        .update({ inbox_id: inboxId })
        .eq("id", canalId);
    }
  }

  // ------------------------------------------------------------------
  // 9. Retornar canal atualizado
  // ------------------------------------------------------------------
  const { data: canalAtualizado } = await supabase
    .from("atendimento_canais")
    .select(
      "id, tipo, nome, cor, ambiente, status, receber_mensagens, identificador, inbox_id, ultima_atividade_at",
    )
    .eq("id", canalId)
    .single();

  return NextResponse.json({
    canal: canalAtualizado,
    inbox_id: inboxId,
    identificador,
  });
}
