import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://app.intentusrealestate.com.br",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function ok(data: unknown) {
  return jsonResponse({ data, error: null });
}

function err(msg: string, status = 400) {
  return jsonResponse({ data: null, error: msg }, status);
}

async function getTenantId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  // Try app_metadata first, fallback to profiles table, then user.id
  const metaTenant = (user.app_metadata?.tenant_id as string) ?? null;
  if (metaTenant) return metaTenant;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return profile?.tenant_id || user.id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const tenantId = await getTenantId(req);
  if (!tenantId) return err("Unauthorized", 401);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }

  const action = body.action as string;

  // ─── CREATE PROJECT ───────────────────────────────────────────────────────
  if (action === "create_project") {
    const { development_id, name, created_by } = body as {
      development_id: string;
      name?: string;
      created_by?: string;
    };
    if (!development_id) return err("development_id obrigatório");

    const defaultSettings = {
      grid_size: 10,
      snap_enabled: true,
      snap_threshold: 10,
      show_grid: true,
      show_dimensions: true,
      grid_unit: "m",
    };

    const { data, error } = await supabaseAdmin
      .from("parcelamento_cad_projects")
      .insert({
        tenant_id: tenantId,
        development_id,
        name: name ?? "Novo Projeto CAD",
        canvas_state: {},
        settings: defaultSettings,
        created_by: created_by ?? null,
      })
      .select()
      .maybeSingle();

    if (error) return err(error.message);
    return ok(data);
  }

  // ─── GET PROJECT ──────────────────────────────────────────────────────────
  if (action === "get_project") {
    const { project_id, development_id } = body as {
      project_id?: string;
      development_id?: string;
    };

    if (project_id) {
      const { data, error } = await supabaseAdmin
        .from("parcelamento_cad_projects")
        .select("*")
        .eq("id", project_id)
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) return err(error.message);
      return ok(data);
    }

    if (development_id) {
      // Retorna o projeto mais recente do development
      const { data, error } = await supabaseAdmin
        .from("parcelamento_cad_projects")
        .select("*")
        .eq("development_id", development_id)
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return err(error.message);
      return ok(data);
    }

    return err("project_id ou development_id obrigatório");
  }

  // ─── LIST PROJECTS ────────────────────────────────────────────────────────
  if (action === "list_projects") {
    const { development_id } = body as { development_id: string };
    if (!development_id) return err("development_id obrigatório");

    const { data, error } = await supabaseAdmin
      .from("parcelamento_cad_projects")
      .select("id, name, version, settings, created_at, updated_at, created_by")
      .eq("development_id", development_id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });

    if (error) return err(error.message);
    return ok(data ?? []);
  }

  // ─── SAVE CANVAS ──────────────────────────────────────────────────────────
  if (action === "save_canvas") {
    const { project_id, canvas_state } = body as {
      project_id: string;
      canvas_state: Record<string, unknown>;
    };
    if (!project_id) return err("project_id obrigatório");
    if (canvas_state === undefined) return err("canvas_state obrigatório");

    // Incrementa versão
    const { data: existing } = await supabaseAdmin
      .from("parcelamento_cad_projects")
      .select("version")
      .eq("id", project_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const newVersion = ((existing?.version as number) ?? 0) + 1;

    const { data, error } = await supabaseAdmin
      .from("parcelamento_cad_projects")
      .update({ canvas_state, version: newVersion })
      .eq("id", project_id)
      .eq("tenant_id", tenantId)
      .select()
      .maybeSingle();

    if (error) return err(error.message);
    return ok(data);
  }

  // ─── UPDATE SETTINGS ──────────────────────────────────────────────────────
  if (action === "update_settings") {
    const { project_id, settings } = body as {
      project_id: string;
      settings: Record<string, unknown>;
    };
    if (!project_id) return err("project_id obrigatório");
    if (!settings) return err("settings obrigatório");

    const { data, error } = await supabaseAdmin
      .from("parcelamento_cad_projects")
      .update({ settings })
      .eq("id", project_id)
      .eq("tenant_id", tenantId)
      .select()
      .maybeSingle();

    if (error) return err(error.message);
    return ok(data);
  }

  // ─── UPDATE NAME ──────────────────────────────────────────────────────────
  if (action === "update_name") {
    const { project_id, name } = body as { project_id: string; name: string };
    if (!project_id || !name) return err("project_id e name obrigatórios");

    const { data, error } = await supabaseAdmin
      .from("parcelamento_cad_projects")
      .update({ name })
      .eq("id", project_id)
      .eq("tenant_id", tenantId)
      .select()
      .maybeSingle();

    if (error) return err(error.message);
    return ok(data);
  }

  // ─── DELETE PROJECT ───────────────────────────────────────────────────────
  if (action === "delete_project") {
    const { project_id } = body as { project_id: string };
    if (!project_id) return err("project_id obrigatório");

    const { data, error } = await supabaseAdmin
      .from("parcelamento_cad_projects")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", project_id)
      .eq("tenant_id", tenantId)
      .select()
      .maybeSingle();

    if (error) return err(error.message);
    return ok({ deleted: true, id: project_id });
  }

  // ─── SAVE ELEMENTS (bulk sync) ────────────────────────────────────────────
  if (action === "save_elements") {
    const { project_id, elements } = body as {
      project_id: string;
      elements: Array<{
        id?: string;
        element_type: string;
        label?: string;
        coordinates?: unknown;
        properties?: Record<string, unknown>;
        layer_name?: string;
        style?: Record<string, unknown>;
        fabric_object_id?: string;
        sort_order?: number;
      }>;
    };
    if (!project_id) return err("project_id obrigatório");
    if (!Array.isArray(elements)) return err("elements deve ser array");

    // Delete e re-insere todos os elementos do projeto
    const { error: delError } = await supabaseAdmin
      .from("parcelamento_cad_elements")
      .delete()
      .eq("project_id", project_id)
      .eq("tenant_id", tenantId);

    if (delError) return err(delError.message);

    if (elements.length === 0) return ok({ saved: 0 });

    const rows = elements.map((el) => ({
      project_id,
      tenant_id: tenantId,
      element_type: el.element_type,
      label: el.label ?? null,
      coordinates: el.coordinates ?? null,
      properties: el.properties ?? {},
      layer_name: el.layer_name ?? "default",
      style: el.style ?? {},
      fabric_object_id: el.fabric_object_id ?? null,
      sort_order: el.sort_order ?? 0,
    }));

    const { data, error } = await supabaseAdmin
      .from("parcelamento_cad_elements")
      .insert(rows)
      .select();

    if (error) return err(error.message);
    return ok({ saved: data?.length ?? 0 });
  }

  return err(`Ação desconhecida: ${action}`);
});
