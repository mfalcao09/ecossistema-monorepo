/**
 * clm-templates-api — Edge Function para templates de contrato
 *
 * Actions:
 * - "list": Lista templates ativos
 * - "render": Renderiza template com substituição de variáveis
 *
 * v1 — criação inicial (sessão 26)
 * v5 — Phase 1 Security: CORS whitelist, atomic use_count via RPC, error sanitization (sessão 35)
 * v8 — Phase 2 Architecture: migrado para middleware compartilhado (sessão 36 — Claudinho + Buchecha)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHandler, type HandlerContext } from "../_shared/middleware.ts";

/** Escapa caracteres especiais de regex */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ============================================================
// ACTION HANDLERS
// ============================================================

async function handleList(ctx: HandlerContext): Promise<Response> {
  const { data, error } = await ctx.supabase
    .from("legal_contract_templates")
    .select("id, name, template_type, content, variables, is_active, version, use_count, category, description, source, created_at, updated_at")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("templates list error:", error.message);
    return ctx.error("Erro ao buscar templates", 500);
  }

  return ctx.json(data ?? []);
}

async function handleRender(ctx: HandlerContext): Promise<Response> {
  const { template_id, variables } = ctx.body;

  if (!template_id) {
    return ctx.error("template_id é obrigatório", 400);
  }

  // Buscar template
  const { data: template, error: fetchErr } = await ctx.supabase
    .from("legal_contract_templates")
    .select("id, name, content, variables, use_count")
    .eq("id", template_id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  if (fetchErr || !template) {
    return ctx.error("Template não encontrado", 404);
  }

  // Substituir variáveis no conteúdo
  // Suporta formatos: {{variavel}}, {{VARIAVEL}}, {{ variavel }}
  let rendered = template.content || "";
  const vars = (variables as Record<string, unknown>) || {};

  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`\\{\\{\\s*${escapeRegex(key)}\\s*\\}\\}`, "gi");
    rendered = rendered.replace(regex, String(value));
  }

  // Incrementar use_count atomicamente via RPC (fire-and-forget)
  ctx.supabase
    .rpc("increment_template_use_count", { p_template_id: template_id })
    .then(() => {});

  return ctx.json({ rendered_content: rendered });
}

// ============================================================
// SERVE
// ============================================================

serve(
  createHandler({
    actions: {
      list: handleList,
      render: handleRender,
    },
    permissions: {
      list: "clm.template.read",
      render: "clm.template.read",
    },
  })
);
