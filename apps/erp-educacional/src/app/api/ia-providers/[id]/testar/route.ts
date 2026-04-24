import { protegerRota } from "@/lib/security/api-guard";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

interface ModeloItem {
  id: string;
  name: string;
}

interface TesteResult {
  ok: boolean;
  modelos?: ModeloItem[];
  erro?: string;
}

// ── Modelos Anthropic hardcoded ─────────────────────────────────────────────
const ANTHROPIC_MODELS: ModeloItem[] = [
  { id: "claude-opus-4-1", name: "Claude Opus 4.1" },
  { id: "claude-opus-4", name: "Claude Opus 4" },
  { id: "claude-sonnet-4", name: "Claude Sonnet 4" },
  { id: "claude-haiku-3-5", name: "Claude Haiku 3.5" },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" },
  { id: "claude-3-5-haiku", name: "Claude 3.5 Haiku" },
];

// ── Teste OpenAI Compatible ─────────────────────────────────────────────────

async function testarOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  headersExtras?: Record<string, string>,
): Promise<TesteResult> {
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...headersExtras,
      },
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return {
        ok: false,
        erro: `HTTP ${res.status}: ${txt.substring(0, 200)}`,
      };
    }

    const data = await res.json();
    const modelos: ModeloItem[] = (data.data ?? []).map(
      (m: { id: string; name?: string }) => ({
        id: m.id,
        name: m.name || m.id,
      }),
    );

    return { ok: true, modelos };
  } catch (err) {
    return {
      ok: false,
      erro: err instanceof Error ? err.message : "Erro de conexão",
    };
  }
}

// ── Teste Google GenAI ──────────────────────────────────────────────────────

async function testarGoogleGenAI(
  baseUrl: string,
  apiKey: string,
): Promise<TesteResult> {
  try {
    const res = await fetch(`${baseUrl}/models?key=${apiKey}`);

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return {
        ok: false,
        erro: `HTTP ${res.status}: ${txt.substring(0, 200)}`,
      };
    }

    const data = await res.json();

    const modelos: ModeloItem[] = (data.models ?? [])
      .filter((m: { supportedGenerationMethods?: string[] }) =>
        m.supportedGenerationMethods?.includes("generateContent"),
      )
      .map((m: { name: string; displayName?: string }) => ({
        id: m.name.replace(/^models\//, ""),
        name: m.displayName || m.name.replace(/^models\//, ""),
      }));

    return { ok: true, modelos };
  } catch (err) {
    return {
      ok: false,
      erro: err instanceof Error ? err.message : "Erro de conexão",
    };
  }
}

// ── Teste Anthropic Messages ────────────────────────────────────────────────

async function testarAnthropicMessages(
  baseUrl: string,
  apiKey: string,
  headersExtras?: Record<string, string>,
): Promise<TesteResult> {
  try {
    const res = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
        ...headersExtras,
      },
      body: JSON.stringify({
        model: "claude-sonnet-4",
        max_tokens: 10,
        messages: [{ role: "user", content: "test" }],
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return {
        ok: false,
        erro: `HTTP ${res.status}: ${txt.substring(0, 200)}`,
      };
    }

    return { ok: true, modelos: ANTHROPIC_MODELS };
  } catch (err) {
    return {
      ok: false,
      erro: err instanceof Error ? err.message : "Erro de conexão",
    };
  }
}

// ── Route Handler ───────────────────────────────────────────────────────────

function extractId(pathname: string): string | null {
  const parts = pathname.split("/");
  const idx = parts.indexOf("ia-providers");
  return idx >= 0 ? parts[idx + 1] || null : null;
}

export const POST = protegerRota(
  async (request: NextRequest) => {
    const admin = getAdminClient();
    const providerId = extractId(request.nextUrl.pathname);

    if (!providerId) {
      return NextResponse.json(
        { erro: "ID do provider é obrigatório" },
        { status: 400 },
      );
    }

    const { data: provider, error: fetchError } = await admin
      .from("ia_providers")
      .select("*")
      .eq("id", providerId)
      .single();

    if (fetchError || !provider) {
      return NextResponse.json(
        { erro: "Provider não encontrado" },
        { status: 404 },
      );
    }

    if (!provider.api_key) {
      return NextResponse.json(
        { ok: false, erro: "Provider sem chave de API configurada" },
        { status: 400 },
      );
    }

    let resultado: TesteResult;

    switch (provider.formato_api) {
      case "openai_compatible":
        resultado = await testarOpenAICompatible(
          provider.base_url,
          provider.api_key,
          provider.headers_extras,
        );
        break;
      case "google_genai":
        resultado = await testarGoogleGenAI(
          provider.base_url,
          provider.api_key,
        );
        break;
      case "anthropic_messages":
        resultado = await testarAnthropicMessages(
          provider.base_url,
          provider.api_key,
          provider.headers_extras,
        );
        break;
      default:
        return NextResponse.json(
          {
            ok: false,
            erro: `Formato "${provider.formato_api}" não suportado`,
          },
          { status: 400 },
        );
    }

    if (!resultado.ok) {
      return NextResponse.json(
        { ok: false, erro: resultado.erro },
        { status: 400 },
      );
    }

    // Salvar modelos no banco no formato {id, name}
    const { error: updateError } = await admin
      .from("ia_providers")
      .update({
        modelos_disponiveis: resultado.modelos,
        modelos_atualizados_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", providerId);

    if (updateError) {
      console.error("Erro ao salvar modelos:", updateError);
    }

    return NextResponse.json({
      ok: true,
      modelos: resultado.modelos?.length ?? 0,
      mensagem: `Conectado! ${resultado.modelos?.length ?? 0} modelos descobertos.`,
    });
  },
  { skipCSRF: true },
);
