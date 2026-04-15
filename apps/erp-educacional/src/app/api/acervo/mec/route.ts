import { protegerRota, verificarAuth } from '@/lib/security/api-guard'
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// GET /api/acervo/mec
// Endpoint público de fiscalização para o MEC/CEE.
// Autenticado via token no header: Authorization: Bearer <token>
// Portaria MEC 613/2022 — Art. 3º, §2º
//
// Filtros opcionais (query params):
//   tipo         — tipo de documento
//   status       — status do documento
//   origem       — nato_digital | digitalizado
//   desde        — ISO date (created_at >= ?)
//   ate          — ISO date (created_at <= ?)
//   limit        — max 200, default 100
//   offset       — paginação

export const GET = protegerRota(async (request: NextRequest, { userId, tenantId }) => {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // ── Autenticação por token ────────────────────────────
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : searchParams.get("token"); // fallback para ?token=xxx

    if (!token) {
      return NextResponse.json(
        { error: "Token de acesso obrigatório. Forneça via header Authorization: Bearer <token>" },
        { status: 401 }
      );
    }

    // Valida token na tabela acervo_mec_tokens
    const { data: mecToken, error: tokenErr } = await supabase
      .from("acervo_mec_tokens")
      .select("id, ativo, expira_em, descricao")
      .eq("token", token)
      .single();

    if (tokenErr || !mecToken) {
      return NextResponse.json({ error: "Token inválido ou não encontrado." }, { status: 403 });
    }

    if (!mecToken.ativo) {
      return NextResponse.json({ error: "Token desativado." }, { status: 403 });
    }

    if (mecToken.expira_em && new Date(mecToken.expira_em) < new Date()) {
      return NextResponse.json({ error: "Token expirado." }, { status: 403 });
    }

    // ── Filtros ───────────────────────────────────────────
    const tipo = searchParams.get("tipo");
    const status = searchParams.get("status");
    const origem = searchParams.get("origem");
    const desde = searchParams.get("desde");
    const ate = searchParams.get("ate");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100"), 200);
    const offset = parseInt(searchParams.get("offset") ?? "0");

    let query = supabase
      .from("documentos_digitais")
      .select(`
        id,
        tipo,
        titulo,
        destinatario_nome,
        destinatario_cpf,
        status,
        origem,
        codigo_verificacao,
        url_verificacao,
        arquivo_hash_sha256,
        publicado_em,
        created_at
      `)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (tipo) query = query.eq("tipo", tipo);
    if (status) query = query.eq("status", status);
    if (origem) query = query.eq("origem", origem);
    if (desde) query = query.gte("created_at", desde);
    if (ate) query = query.lte("created_at", ate);

    const { data: documentos, error: docErr, count } = await query;

    if (docErr) throw docErr;

    // ── Registra log de acesso ────────────────────────────
    const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown";
    const ua = request.headers.get("user-agent") ?? null;

    await supabase.from("acervo_mec_log").insert({
      token_id: mecToken.id,
      ip_origem: ip,
      user_agent: ua,
      filtros: { tipo, status, origem, desde, ate, limit, offset },
      total_retornado: (documentos ?? []).length,
    });

    // Atualiza último uso do token
    await supabase
      .from("acervo_mec_tokens")
      .update({ ultimo_uso_em: new Date().toISOString() })
      .eq("id", mecToken.id);

    // ── Resposta ─────────────────────────────────────────
    return NextResponse.json({
      ies: "Faculdades Integradas de Cassilândia — FIC",
      cnpj_ies: null, // Preencher quando CNPJ da IES estiver configurado
      total_retornado: (documentos ?? []).length,
      filtros_aplicados: { tipo, status, origem, desde, ate },
      documentos: documentos ?? [],
    }, {
      headers: {
        "Cache-Control": "no-store",
        "X-Acervo-Versao": "1.0",
        "X-Portaria": "MEC 613/2022",
      },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ erro: sanitizarErro(msg, 500) }, { status: 500 });
  }
}, { skipCSRF: true })

// POST /api/acervo/mec — gerencia tokens (apenas autenticados internamente)
export const POST = protegerRota(async (request: NextRequest, { userId, tenantId }) => {
  try {
    const supabase = await createClient();

    // Verifica sessão do usuário interno (ERP)
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const body = await request.json();
    const { action, token_id } = body;

    if (action === "criar") {
      const { descricao, expira_em } = body;
      if (!descricao) {
        return NextResponse.json({ error: "Descrição obrigatória." }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("acervo_mec_tokens")
        .insert({
          descricao,
          ativo: true,
          expira_em: expira_em ?? null,
          criado_por_user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data, { status: 201 });
    }

    if (action === "revogar") {
      if (!token_id) return NextResponse.json({ error: "token_id obrigatório." }, { status: 400 });
      const { error } = await supabase
        .from("acervo_mec_tokens")
        .update({ ativo: false })
        .eq("id", token_id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Ação inválida. Use: criar | revogar" }, { status: 400 });

  } catch (err) {
    return NextResponse.json({ erro: sanitizarErro((err as Error).message, 500) }, { status: 500 });
  }
})

// GET /api/acervo/mec/tokens — lista tokens (interno)
// Nota: implementado em /api/acervo/mec/tokens/route.ts
