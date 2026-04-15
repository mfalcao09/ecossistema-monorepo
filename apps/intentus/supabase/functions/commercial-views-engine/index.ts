// commercial-views-engine v1 — Advanced Filters + Custom Views Engine
// M02: CRUD puro com query building para filtros avançados e views customizáveis
// Supports: saved_filters, custom_views, field definitions per module

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ============ CORS ============
const PROD_ORIGINS = [
  "https://app.intentusrealestate.com.br",
  "https://intentus-plataform.vercel.app",
];
const DEV_PATTERNS = ["http://localhost:"];
const PREVIEW_RE = /^https:\/\/intentus-plataform-[a-z0-9]+-mfalcao09s-projects\.vercel\.app$/;

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed =
    PROD_ORIGINS.includes(origin) ||
    DEV_PATTERNS.some((p) => origin.startsWith(p)) ||
    PREVIEW_RE.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : PROD_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
  };
}

// ============ Auth ============
async function resolveAuth(supabase: any) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id, role, full_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return null;
  return { userId: user.id, ...profile };
}

// ============ Module Field Definitions ============
// Defines available fields per module for filter building
const MODULE_FIELDS: Record<string, Array<{
  field: string;
  label: string;
  type: "text" | "number" | "date" | "boolean" | "select" | "currency";
  options?: string[];
  table?: string;
}>> = {
  pipeline: [
    { field: "name", label: "Nome do Negócio", type: "text" },
    { field: "value", label: "Valor", type: "currency" },
    { field: "status", label: "Status", type: "select", options: ["active", "won", "lost", "archived"] },
    { field: "priority", label: "Prioridade", type: "select", options: ["low", "medium", "high", "urgent"] },
    { field: "expected_close_date", label: "Previsão Fechamento", type: "date" },
    { field: "created_at", label: "Data Criação", type: "date" },
    { field: "updated_at", label: "Última Atualização", type: "date" },
    { field: "assigned_to", label: "Responsável", type: "text" },
    { field: "source", label: "Origem", type: "text" },
    { field: "tags", label: "Tags", type: "text" },
  ],
  leads: [
    { field: "name", label: "Nome", type: "text" },
    { field: "email", label: "Email", type: "text" },
    { field: "phone", label: "Telefone", type: "text" },
    { field: "status", label: "Status", type: "select", options: ["new", "contacted", "qualified", "unqualified", "converted", "lost"] },
    { field: "source", label: "Origem", type: "select", options: ["website", "referral", "portal", "social", "ads", "organic", "manual", "chatbot"] },
    { field: "score", label: "Score", type: "number" },
    { field: "temperature", label: "Temperatura", type: "select", options: ["cold", "warm", "hot"] },
    { field: "assigned_to", label: "Responsável", type: "text" },
    { field: "created_at", label: "Data Criação", type: "date" },
    { field: "last_interaction_at", label: "Última Interação", type: "date" },
    { field: "budget_min", label: "Orçamento Mín", type: "currency" },
    { field: "budget_max", label: "Orçamento Máx", type: "currency" },
    { field: "interest_type", label: "Tipo Interesse", type: "select", options: ["buy", "rent", "invest"] },
  ],
  interactions: [
    { field: "type", label: "Tipo", type: "select", options: ["call", "email", "whatsapp", "visit", "meeting", "note"] },
    { field: "direction", label: "Direção", type: "select", options: ["inbound", "outbound"] },
    { field: "sentiment", label: "Sentimento", type: "select", options: ["positive", "neutral", "negative"] },
    { field: "quality_score", label: "Score Qualidade", type: "number" },
    { field: "duration_minutes", label: "Duração (min)", type: "number" },
    { field: "created_at", label: "Data", type: "date" },
    { field: "broker_name", label: "Corretor", type: "text" },
    { field: "summary", label: "Resumo", type: "text" },
  ],
  deals: [
    { field: "title", label: "Título", type: "text" },
    { field: "value", label: "Valor", type: "currency" },
    { field: "status", label: "Status", type: "select", options: ["negotiation", "proposal", "contract", "closed_won", "closed_lost"] },
    { field: "commission_rate", label: "Comissão %", type: "number" },
    { field: "closing_date", label: "Data Fechamento", type: "date" },
    { field: "created_at", label: "Data Criação", type: "date" },
    { field: "property_type", label: "Tipo Imóvel", type: "text" },
    { field: "deal_type", label: "Tipo Negócio", type: "select", options: ["sale", "rent", "exchange"] },
  ],
  brokers: [
    { field: "full_name", label: "Nome", type: "text" },
    { field: "email", label: "Email", type: "text" },
    { field: "creci", label: "CRECI", type: "text" },
    { field: "status", label: "Status", type: "select", options: ["active", "inactive", "on_leave"] },
    { field: "team", label: "Equipe", type: "text" },
    { field: "deals_count", label: "Total Negócios", type: "number" },
    { field: "win_rate", label: "Taxa Conversão %", type: "number" },
    { field: "avg_deal_value", label: "Ticket Médio", type: "currency" },
    { field: "created_at", label: "Data Cadastro", type: "date" },
  ],
  properties: [
    { field: "title", label: "Título", type: "text" },
    { field: "type", label: "Tipo", type: "select", options: ["apartment", "house", "land", "commercial", "rural", "condo"] },
    { field: "transaction_type", label: "Transação", type: "select", options: ["sale", "rent", "both"] },
    { field: "price", label: "Preço", type: "currency" },
    { field: "area_m2", label: "Área (m²)", type: "number" },
    { field: "bedrooms", label: "Quartos", type: "number" },
    { field: "bathrooms", label: "Banheiros", type: "number" },
    { field: "parking_spots", label: "Vagas", type: "number" },
    { field: "neighborhood", label: "Bairro", type: "text" },
    { field: "city", label: "Cidade", type: "text" },
    { field: "status", label: "Status", type: "select", options: ["available", "reserved", "sold", "rented", "inactive"] },
    { field: "created_at", label: "Data Cadastro", type: "date" },
    { field: "featured", label: "Destaque", type: "boolean" },
  ],
  contracts: [
    { field: "title", label: "Título", type: "text" },
    { field: "status", label: "Status", type: "select", options: ["draft", "review", "approved", "active", "expired", "terminated"] },
    { field: "type", label: "Tipo", type: "text" },
    { field: "value", label: "Valor", type: "currency" },
    { field: "start_date", label: "Início", type: "date" },
    { field: "end_date", label: "Fim", type: "date" },
    { field: "created_at", label: "Data Criação", type: "date" },
  ],
  visits: [
    { field: "status", label: "Status", type: "select", options: ["scheduled", "completed", "cancelled", "no_show"] },
    { field: "scheduled_at", label: "Data Agendada", type: "date" },
    { field: "property_title", label: "Imóvel", type: "text" },
    { field: "broker_name", label: "Corretor", type: "text" },
    { field: "feedback_score", label: "Nota Feedback", type: "number" },
    { field: "created_at", label: "Data Criação", type: "date" },
  ],
  tasks: [
    { field: "title", label: "Título", type: "text" },
    { field: "status", label: "Status", type: "select", options: ["pending", "in_progress", "completed", "cancelled"] },
    { field: "priority", label: "Prioridade", type: "select", options: ["low", "medium", "high", "urgent"] },
    { field: "due_date", label: "Data Limite", type: "date" },
    { field: "assigned_to", label: "Responsável", type: "text" },
    { field: "category", label: "Categoria", type: "text" },
    { field: "created_at", label: "Data Criação", type: "date" },
  ],
  reports: [
    { field: "type", label: "Tipo", type: "text" },
    { field: "period", label: "Período", type: "text" },
    { field: "created_at", label: "Data Criação", type: "date" },
  ],
};

// ============ Operators by Field Type ============
const OPERATORS_BY_TYPE: Record<string, string[]> = {
  text: ["equals", "not_equals", "contains", "not_contains", "starts_with", "ends_with", "is_empty", "is_not_empty"],
  number: ["equals", "not_equals", "greater_than", "less_than", "between", "is_empty", "is_not_empty"],
  currency: ["equals", "not_equals", "greater_than", "less_than", "between", "is_empty", "is_not_empty"],
  date: ["equals", "date_before", "date_after", "date_between", "date_last_n_days", "is_empty", "is_not_empty"],
  boolean: ["equals"],
  select: ["equals", "not_equals", "in", "not_in", "is_empty", "is_not_empty"],
};

// ============ Main Handler ============
Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const auth = await resolveAuth(supabase);
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let result: any;

    switch (action) {
      // ============ FILTERS ============
      case "get_module_fields":
        result = handleGetModuleFields(params);
        break;

      case "save_filter":
        result = await handleSaveFilter(admin, auth, params);
        break;

      case "list_filters":
        result = await handleListFilters(admin, auth, params);
        break;

      case "delete_filter":
        result = await handleDeleteFilter(admin, auth, params);
        break;

      case "apply_filter":
        result = handleApplyFilter(params);
        break;

      case "set_default_filter":
        result = await handleSetDefaultFilter(admin, auth, params);
        break;

      // ============ VIEWS ============
      case "save_view":
        result = await handleSaveView(admin, auth, params);
        break;

      case "list_views":
        result = await handleListViews(admin, auth, params);
        break;

      case "delete_view":
        result = await handleDeleteView(admin, auth, params);
        break;

      case "set_default_view":
        result = await handleSetDefaultView(admin, auth, params);
        break;

      case "duplicate_view":
        result = await handleDuplicateView(admin, auth, params);
        break;

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

// ============ HANDLERS ============

function handleGetModuleFields(params: any) {
  const { module } = params;
  const fields = MODULE_FIELDS[module] || [];
  const operators = Object.fromEntries(
    fields.map((f) => [f.field, OPERATORS_BY_TYPE[f.type] || []])
  );
  return { fields, operators, modules: Object.keys(MODULE_FIELDS) };
}

async function handleSaveFilter(admin: any, auth: any, params: any) {
  const { id, name, description, module, conditions, logic_operator, sort_config, is_shared, is_pinned } = params;

  const data: any = {
    tenant_id: auth.tenant_id,
    created_by: auth.userId,
    name,
    description: description || null,
    module,
    conditions: conditions || [],
    logic_operator: logic_operator || "AND",
    sort_config: sort_config || [],
    is_shared: is_shared || false,
    is_pinned: is_pinned || false,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    // Update existing
    const { data: updated, error } = await admin
      .from("saved_filters")
      .update(data)
      .eq("id", id)
      .eq("tenant_id", auth.tenant_id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return { filter: updated };
  } else {
    // Insert new
    const { data: created, error } = await admin
      .from("saved_filters")
      .insert(data)
      .select()
      .maybeSingle();
    if (error) throw error;
    return { filter: created };
  }
}

async function handleListFilters(admin: any, auth: any, params: any) {
  const { module } = params;
  let query = admin
    .from("saved_filters")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .order("is_pinned", { ascending: false })
    .order("use_count", { ascending: false })
    .order("updated_at", { ascending: false });

  if (module) {
    query = query.eq("module", module);
  }

  // Show own filters + shared filters
  query = query.or(`created_by.eq.${auth.userId},is_shared.eq.true`);

  const { data, error } = await query;
  if (error) throw error;
  return { filters: data || [] };
}

async function handleDeleteFilter(admin: any, auth: any, params: any) {
  const { id } = params;
  const { error } = await admin
    .from("saved_filters")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .eq("created_by", auth.userId);
  if (error) throw error;
  return { success: true };
}

function handleApplyFilter(params: any) {
  const { conditions, logic_operator } = params;
  if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
    return { query_parts: [], logic: "AND", description: "No filters applied" };
  }

  const queryParts = conditions.map((c: any) => {
    const { field, operator, value, value2 } = c;
    switch (operator) {
      case "equals": return { method: "eq", field, value };
      case "not_equals": return { method: "neq", field, value };
      case "contains": return { method: "ilike", field, value: `%${value}%` };
      case "not_contains": return { method: "not.ilike", field, value: `%${value}%` };
      case "starts_with": return { method: "ilike", field, value: `${value}%` };
      case "ends_with": return { method: "ilike", field, value: `%${value}` };
      case "greater_than": return { method: "gt", field, value };
      case "less_than": return { method: "lt", field, value };
      case "between": return { method: "gte", field, value, method2: "lte", value2 };
      case "in": return { method: "in", field, value: Array.isArray(value) ? value : [value] };
      case "not_in": return { method: "not.in", field, value: Array.isArray(value) ? value : [value] };
      case "is_empty": return { method: "is", field, value: null };
      case "is_not_empty": return { method: "not.is", field, value: null };
      case "date_before": return { method: "lt", field, value };
      case "date_after": return { method: "gt", field, value };
      case "date_between": return { method: "gte", field, value, method2: "lte", value2 };
      case "date_last_n_days": {
        const d = new Date();
        d.setDate(d.getDate() - Number(value));
        return { method: "gte", field, value: d.toISOString() };
      }
      default: return { method: "eq", field, value };
    }
  });

  const description = conditions.map((c: any) => {
    return `${c.field} ${c.operator} ${c.value}${c.value2 ? ` e ${c.value2}` : ""}`;
  }).join(` ${logic_operator || "AND"} `);

  return { query_parts: queryParts, logic: logic_operator || "AND", description };
}

async function handleSetDefaultFilter(admin: any, auth: any, params: any) {
  const { id, module } = params;
  // Unset current defaults for this module
  await admin
    .from("saved_filters")
    .update({ is_default: false })
    .eq("tenant_id", auth.tenant_id)
    .eq("module", module)
    .eq("created_by", auth.userId)
    .eq("is_default", true);

  if (id) {
    const { data, error } = await admin
      .from("saved_filters")
      .update({ is_default: true })
      .eq("id", id)
      .eq("tenant_id", auth.tenant_id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return { filter: data };
  }
  return { success: true };
}

// ============ VIEWS ============

async function handleSaveView(admin: any, auth: any, params: any) {
  const { id, name, description, module, columns, filter_id, sort_config, group_by, layout, color_rules, row_density, is_shared, is_pinned } = params;

  const data: any = {
    tenant_id: auth.tenant_id,
    created_by: auth.userId,
    name,
    description: description || null,
    module,
    columns: columns || [],
    filter_id: filter_id || null,
    sort_config: sort_config || [],
    group_by: group_by || null,
    layout: layout || "list",
    color_rules: color_rules || [],
    row_density: row_density || "comfortable",
    is_shared: is_shared || false,
    is_pinned: is_pinned || false,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { data: updated, error } = await admin
      .from("custom_views")
      .update(data)
      .eq("id", id)
      .eq("tenant_id", auth.tenant_id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return { view: updated };
  } else {
    const { data: created, error } = await admin
      .from("custom_views")
      .insert(data)
      .select()
      .maybeSingle();
    if (error) throw error;
    return { view: created };
  }
}

async function handleListViews(admin: any, auth: any, params: any) {
  const { module } = params;
  let query = admin
    .from("custom_views")
    .select("*, saved_filters(id, name, conditions, logic_operator)")
    .eq("tenant_id", auth.tenant_id)
    .order("is_pinned", { ascending: false })
    .order("use_count", { ascending: false })
    .order("updated_at", { ascending: false });

  if (module) {
    query = query.eq("module", module);
  }

  query = query.or(`created_by.eq.${auth.userId},is_shared.eq.true`);

  const { data, error } = await query;
  if (error) throw error;
  return { views: data || [] };
}

async function handleDeleteView(admin: any, auth: any, params: any) {
  const { id } = params;
  const { error } = await admin
    .from("custom_views")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .eq("created_by", auth.userId);
  if (error) throw error;
  return { success: true };
}

async function handleSetDefaultView(admin: any, auth: any, params: any) {
  const { id, module } = params;
  await admin
    .from("custom_views")
    .update({ is_default: false })
    .eq("tenant_id", auth.tenant_id)
    .eq("module", module)
    .eq("created_by", auth.userId)
    .eq("is_default", true);

  if (id) {
    const { data, error } = await admin
      .from("custom_views")
      .update({ is_default: true })
      .eq("id", id)
      .eq("tenant_id", auth.tenant_id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return { view: data };
  }
  return { success: true };
}

async function handleDuplicateView(admin: any, auth: any, params: any) {
  const { id, new_name } = params;
  const { data: original, error: fetchErr } = await admin
    .from("custom_views")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (fetchErr || !original) throw new Error("View not found");

  const { id: _id, created_at: _ca, updated_at: _ua, use_count: _uc, last_used_at: _lu, is_default: _def, ...rest } = original;
  const { data: duplicated, error } = await admin
    .from("custom_views")
    .insert({
      ...rest,
      name: new_name || `${original.name} (cópia)`,
      created_by: auth.userId,
      is_default: false,
      use_count: 0,
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return { view: duplicated };
}
