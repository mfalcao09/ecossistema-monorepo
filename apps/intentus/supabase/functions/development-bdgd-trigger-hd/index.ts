/**
 * development-bdgd-trigger-hd
 *
 * Dispara o workflow GHA `bdgd-load-hd.yml` pra carregar Tier 2 (alta
 * precisão BDGD por projeto). Atualiza `developments.bdgd_hd_status='queued'`.
 *
 * Input:
 *   { development_id: UUID, buffer_km?: number = 5 }
 *
 * Requer secret `GITHUB_TRIGGER_TOKEN` na Edge Function (PAT com scope
 * `actions:write` no repo `mfalcao09/ecossistema-monorepo`).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REPO_OWNER = "mfalcao09";
const REPO_NAME = "ecossistema-monorepo";
const WORKFLOW_FILE = "bdgd-load-hd.yml";
const REF = "main";

// CORS — mesmos PROD_ORIGINS que development-geo-layers e development-bdgd-proximity
const DEV_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https:\/\/intentus-plataform-.+\.vercel\.app$/,
  /^https:\/\/hom\.intentusrealestate\.com\.br$/,
  /^https:\/\/.+-mfalcao09s-projects\.vercel\.app$/,
];
const PROD_ORIGINS = [
  "https://intentus-plataform.vercel.app",
  "https://app.intentusrealestate.com.br",
  "https://hom.intentusrealestate.com.br",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowed =
    PROD_ORIGINS.includes(origin) || DEV_PATTERNS.some((re) => re.test(origin));
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const githubToken = Deno.env.get("GITHUB_TRIGGER_TOKEN");
  const auth = req.headers.get("authorization");

  if (!auth) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  if (!githubToken) {
    return new Response(
      JSON.stringify({
        error: "GITHUB_TRIGGER_TOKEN não configurado na Edge Function",
        code: "GITHUB_TOKEN_MISSING",
      }),
      { status: 503, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const developmentId = body.development_id as string | undefined;
  const bufferKm = String(body.buffer_km ?? 5);
  if (!developmentId) {
    return new Response(JSON.stringify({ error: "development_id required" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Confirma que o dev existe e o user tem acesso (RLS faz o resto)
  const { data: dev, error: devErr } = await supabase
    .from("developments")
    .select("id, name, tenant_id, bdgd_hd_status")
    .eq("id", developmentId)
    .maybeSingle();
  if (devErr || !dev) {
    return new Response(
      JSON.stringify({ error: "Development not found or no access" }),
      { status: 404, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
  if (dev.bdgd_hd_status === "queued" || dev.bdgd_hd_status === "loading") {
    return new Response(
      JSON.stringify({
        ok: true,
        already_in_progress: true,
        status: dev.bdgd_hd_status,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // Marca como queued
  await supabase
    .from("developments")
    .update({ bdgd_hd_status: "queued" })
    .eq("id", developmentId);

  // Dispara workflow_dispatch
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
  const ghRes = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ref: REF,
      inputs: { development_id: developmentId, buffer_km: bufferKm },
    }),
  });

  if (!ghRes.ok) {
    const text = await ghRes.text();
    // rollback status se GH falhou
    await supabase
      .from("developments")
      .update({ bdgd_hd_status: "failed" })
      .eq("id", developmentId);
    return new Response(
      JSON.stringify({
        error: `GitHub API ${ghRes.status}: ${text.substring(0, 200)}`,
      }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      status: "queued",
      workflow: WORKFLOW_FILE,
      development_id: developmentId,
      buffer_km: bufferKm,
      actions_url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}`,
    }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
