/**
 * report-share-link — Edge Function para links expiráveis de relatórios (US-31)
 * Sessão 146 — Bloco K
 *
 * Actions:
 *   - create_link: gera token + data de expiração
 *   - validate_link: verifica se token é válido (não expirado, ativo)
 *   - list_links: lista links ativos de um development
 *   - revoke_link: desativa um link
 *
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CreateLinkRequest {
  action: "create_link";
  tenant_id: string;
  development_id: string;
  report_type?: "executivo" | "tecnico";
  expires_in_hours?: number; // default 72h
  created_by: string;
}

interface ValidateLinkRequest {
  action: "validate_link";
  token: string;
}

interface ListLinksRequest {
  action: "list_links";
  tenant_id: string;
  development_id: string;
}

interface RevokeLinkRequest {
  action: "revoke_link";
  tenant_id: string;
  link_id: string;
}

type ActionRequest = CreateLinkRequest | ValidateLinkRequest | ListLinksRequest | RevokeLinkRequest;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as ActionRequest;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    switch (body.action) {
      // ─── CREATE LINK ───
      case "create_link": {
        const { tenant_id, development_id, report_type, expires_in_hours, created_by } = body as CreateLinkRequest;

        if (!tenant_id || !development_id || !created_by) {
          return jsonResponse({ error: { code: "MISSING_PARAMS", message: "tenant_id, development_id e created_by são obrigatórios" } }, 400);
        }

        const hours = expires_in_hours ?? 72;
        const expiresAt = new Date(Date.now() + hours * 3600_000).toISOString();

        const { data, error } = await supabase
          .from("parcelamento_share_links")
          .insert({
            tenant_id,
            development_id,
            report_type: report_type ?? "tecnico",
            expires_at: expiresAt,
            created_by,
          })
          .select("id, token, expires_at, report_type")
          .single();

        if (error) {
          return jsonResponse({ error: { code: "DB_ERROR", message: error.message } }, 500);
        }

        // Build the shareable URL
        const baseUrl = Deno.env.get("PUBLIC_APP_URL") || "https://app.intentusrealestate.com.br";
        const shareUrl = `${baseUrl}/share/${data.token}`;

        return jsonResponse({
          link: {
            id: data.id,
            token: data.token,
            url: shareUrl,
            expires_at: data.expires_at,
            report_type: data.report_type,
            expires_in_hours: hours,
          },
        });
      }

      // ─── VALIDATE LINK ───
      case "validate_link": {
        const { token } = body as ValidateLinkRequest;

        if (!token) {
          return jsonResponse({ error: { code: "MISSING_TOKEN", message: "Token é obrigatório" } }, 400);
        }

        const { data, error } = await supabase
          .from("parcelamento_share_links")
          .select("id, tenant_id, development_id, report_type, expires_at, is_active")
          .eq("token", token)
          .eq("is_active", true)
          .maybeSingle();

        if (error) {
          return jsonResponse({ error: { code: "DB_ERROR", message: error.message } }, 500);
        }

        if (!data) {
          return jsonResponse({ valid: false, reason: "Link não encontrado ou desativado" });
        }

        const now = new Date();
        const expiresAt = new Date(data.expires_at);

        if (now > expiresAt) {
          return jsonResponse({ valid: false, reason: "Link expirado" });
        }

        // Increment access count
        await supabase
          .from("parcelamento_share_links")
          .update({
            accessed_count: (data as any).accessed_count + 1,
            last_accessed_at: now.toISOString(),
          })
          .eq("id", data.id);

        return jsonResponse({
          valid: true,
          link: {
            development_id: data.development_id,
            tenant_id: data.tenant_id,
            report_type: data.report_type,
            expires_at: data.expires_at,
          },
        });
      }

      // ─── LIST LINKS ───
      case "list_links": {
        const { tenant_id, development_id } = body as ListLinksRequest;

        const { data, error } = await supabase
          .from("parcelamento_share_links")
          .select("id, token, report_type, expires_at, created_at, accessed_count, is_active")
          .eq("tenant_id", tenant_id)
          .eq("development_id", development_id)
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) {
          return jsonResponse({ error: { code: "DB_ERROR", message: error.message } }, 500);
        }

        return jsonResponse({ links: data ?? [] });
      }

      // ─── REVOKE LINK ───
      case "revoke_link": {
        const { tenant_id, link_id } = body as RevokeLinkRequest;

        const { error } = await supabase
          .from("parcelamento_share_links")
          .update({ is_active: false })
          .eq("id", link_id)
          .eq("tenant_id", tenant_id);

        if (error) {
          return jsonResponse({ error: { code: "DB_ERROR", message: error.message } }, 500);
        }

        return jsonResponse({ success: true });
      }

      default:
        return jsonResponse({ error: { code: "UNKNOWN_ACTION", message: `Action "${(body as any).action}" não reconhecida` } }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Erro interno" } }, 500);
  }
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
