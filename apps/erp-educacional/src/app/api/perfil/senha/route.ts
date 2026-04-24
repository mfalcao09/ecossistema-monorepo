import { protegerRota } from "@/lib/security/api-guard";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { validar, schemas } from "@/lib/security/validation";
import { sanitizarErro } from "@/lib/security/sanitize-error";
import {
  verificarRateLimit,
  adicionarHeadersRateLimit,
} from "@/lib/portal/rate-limit";
import { logAuthAttempt } from "@/lib/security/security-logger";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// POST /api/perfil/senha — altera a senha do usuário logado
// Verifica senha atual antes de alterar
// SEGURANÇA: Rate limit de 5 tentativas por minuto (proteção contra brute force)
export const POST = protegerRota(
  async (request: NextRequest, { userId, tenantId }) => {
    // ── Rate Limiting (proteção contra brute force) ──────────
    const rateLimit = await verificarRateLimit(request, "alterar_senha");
    if (!rateLimit.allowed) {
      const headers = new Headers({
        "Retry-After": String(Math.ceil((rateLimit.reset - Date.now()) / 1000)),
      });
      adicionarHeadersRateLimit(headers, rateLimit);
      return NextResponse.json(
        {
          error: "Muitas tentativas de alteração de senha. Aguarde um momento.",
        },
        { status: 429, headers },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user)
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    // ── Validar input ────────────────────────────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const resultado = validar(body, schemas.alterarSenha);
    if (!resultado.ok) {
      return NextResponse.json(
        { error: "Dados inválidos", detalhes: resultado.erros },
        { status: 400 },
      );
    }

    const { senha_atual, nova_senha } = resultado.data as {
      senha_atual: string;
      nova_senha: string;
    };

    // Verifica senha atual tentando um signIn
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: senha_atual,
    });
    if (signInError) {
      // Log password change failure (non-blocking)
      void logAuthAttempt(request, false, user.id, {
        motivo: "Senha atual inválida",
        acao: "alterar_senha",
      });
      return NextResponse.json(
        { error: "Credenciais inválidas" },
        { status: 400 },
      );
    }

    // Atualiza senha via admin client para não depender de e-mail
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      user.id,
      {
        password: nova_senha,
      },
    );

    if (updateError) {
      console.error("[API] Erro ao alterar senha:", updateError.message);
      // Log password change error (non-blocking)
      void logAuthAttempt(request, false, user.id, {
        motivo: "Erro ao alterar senha",
        acao: "alterar_senha",
        erro: updateError.message,
      });
      return NextResponse.json(
        { error: sanitizarErro(updateError.message, 500) },
        { status: 500 },
      );
    }
    // Log successful password change (non-blocking)
    void logAuthAttempt(request, true, user.id, {
      acao: "alterar_senha",
    });
    return NextResponse.json({ success: true });
  },
);
