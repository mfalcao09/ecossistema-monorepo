/**
 * cri-matricula v1
 *
 * Edge Function multi-action para gerenciamento de matrículas de propriedades
 * registradas em Cartório de Registro de Imóveis (CRI).
 *
 * Como não existe API pública para CRI no Brasil, esta EF fornece:
 *  - Registro manual de dados de matrícula (número matrícula, cartório, dados proprietário)
 *  - Validação de formato de matrícula (padrão cartório)
 *  - Detecção de duplicatas
 *  - Armazenamento estruturado em development_cri_matriculas
 *
 * ACTIONS:
 *   register_matricula   — Salva dados de matrícula manualmente inseridos
 *   get_matricula        — Retorna matrícula por ID
 *   list_matriculas      — Lista matrículas do development
 *   validate_matricula   — Valida formato + duplicatas
 *
 * AUTENTICAÇÃO:
 *   - User auth: leitura/escrita do tenant próprio
 *   - Service Role: acesso irrestrito (EF-to-EF)
 *
 * Sessão 145 — Bloco H Sprint 5 — US-133
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// CORS (padrão Intentus)
// ============================================================

const ALLOWED_ORIGINS_RAW = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",").map((o: string) => o.trim()).filter(Boolean);

const DEV_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https:\/\/intentus-plataform-[a-zA-Z0-9-]+\.vercel\.app$/,
];
const PROD_ORIGINS = [
  "https://intentus-plataform.vercel.app",
  "https://app.intentusrealestate.com.br",
];

function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS_RAW.length > 0) return ALLOWED_ORIGINS_RAW.includes(origin);
  return PROD_ORIGINS.includes(origin) || DEV_PATTERNS.some((re) => re.test(origin));
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": isOriginAllowed(origin) ? origin : "",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

// ============================================================
// Types
// ============================================================

interface RequestContext {
  supabase: SupabaseClient;
  userId: string;
  tenantId: string;
}

interface AverbacaoItem {
  id: string;
  numero_averbacao: string;
  data: string;
  tipo: "divisao" | "desmembramento" | "remembramento" | "retificacao" | "outro";
  descricao: string;
  novas_areas?: { lote_numero: string; area_m2: number }[];
}

interface OnusItem {
  id: string;
  numero_onus: string;
  data: string;
  tipo: "hipoteca" | "penhora" | "arresto" | "caução" | "outro";
  credor_nome: string;
  valor_garantido?: number;
  data_liberacao?: string;
  descricao: string;
}

interface MatriculaRecord {
  id: string;
  development_id: string;
  tenant_id: string;
  numero_matricula: string;
  cartorio_nome: string;
  cartorio_codigo: string;
  comarca: string;
  uf: string;
  proprietario_nome: string;
  proprietario_cpf_cnpj?: string;
  area_terreno_m2: number;
  data_registro: string;
  averbacoes: AverbacaoItem[];
  onus: OnusItem[];
  status: "ativo" | "cancelado" | "extinto";
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Matrícula Format Validation
// ============================================================

function validateMatriculaFormat(numero: string, cartorio_codigo: string): boolean {
  // Formato esperado: 5-6 dígitos + código cartório
  // Exemplo: "12345" ou "123456" + "0001-2"
  const numericPart = numero.replace(/\D/g, "");
  return (
    numericPart.length >= 5 &&
    numericPart.length <= 6 &&
    cartorio_codigo.length > 0 &&
    /^\d{4,}-\d$/.test(cartorio_codigo)
  );
}

// ============================================================
// ACTION: Register Matrícula
// ============================================================

async function actionRegisterMatricula(
  ctx: RequestContext,
  body: {
    development_id: string;
    numero_matricula: string;
    cartorio_nome: string;
    cartorio_codigo: string;
    comarca: string;
    uf: string;
    proprietario_nome: string;
    proprietario_cpf_cnpj?: string;
    area_terreno_m2: number;
    data_registro: string;
    averbacoes?: AverbacaoItem[];
    onus?: OnusItem[];
    observacoes?: string;
  }
): Promise<{ ok: boolean; data?: MatriculaRecord; error?: { code: string; message: string } }> {
  try {
    // Validate format
    if (!validateMatriculaFormat(body.numero_matricula, body.cartorio_codigo)) {
      return {
        ok: false,
        error: {
          code: "INVALID_FORMAT",
          message: "Formato de matrícula inválido. Esperado: 5-6 dígitos + código cartório (XXXX-X)",
        },
      };
    }

    // Check development exists & belongs to tenant
    const { data: dev, error: devErr } = await ctx.supabase
      .from("developments")
      .select("id, tenant_id")
      .eq("id", body.development_id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();

    if (devErr || !dev) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Development não encontrado" },
      };
    }

    // Insert matrícula
    const { data, error } = await ctx.supabase
      .from("development_cri_matriculas")
      .insert({
        development_id: body.development_id,
        tenant_id: ctx.tenantId,
        numero_matricula: body.numero_matricula,
        cartorio_nome: body.cartorio_nome,
        cartorio_codigo: body.cartorio_codigo,
        comarca: body.comarca,
        uf: body.uf,
        proprietario_nome: body.proprietario_nome,
        proprietario_cpf_cnpj: body.proprietario_cpf_cnpj || null,
        area_terreno_m2: body.area_terreno_m2,
        data_registro: body.data_registro,
        averbacoes: body.averbacoes || [],
        onus: body.onus || [],
        status: "ativo",
        observacoes: body.observacoes || null,
      })
      .select()
      .maybeSingle();

    if (error) {
      return {
        ok: false,
        error: {
          code: error.code || "INSERT_ERROR",
          message: error.message,
        },
      };
    }

    return { ok: true, data: data as MatriculaRecord };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : "Erro desconhecido",
      },
    };
  }
}

// ============================================================
// ACTION: Get Matrícula
// ============================================================

async function actionGetMatricula(
  ctx: RequestContext,
  matricula_id: string
): Promise<{ ok: boolean; data?: MatriculaRecord; error?: { code: string; message: string } }> {
  try {
    const { data, error } = await ctx.supabase
      .from("development_cri_matriculas")
      .select()
      .eq("id", matricula_id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();

    if (error) {
      return {
        ok: false,
        error: { code: error.code || "QUERY_ERROR", message: error.message },
      };
    }

    if (!data) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Matrícula não encontrada" },
      };
    }

    return { ok: true, data: data as MatriculaRecord };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : "Erro desconhecido",
      },
    };
  }
}

// ============================================================
// ACTION: List Matrículas
// ============================================================

async function actionListMatriculas(
  ctx: RequestContext,
  body: {
    development_id: string;
    only_active?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<{
  ok: boolean;
  data?: {
    matriculas: MatriculaRecord[];
    total: number;
    offset: number;
    limit: number;
  };
  error?: { code: string; message: string };
}> {
  try {
    const limit = body.limit || 20;
    const offset = body.offset || 0;

    let query = ctx.supabase
      .from("development_cri_matriculas")
      .select("*", { count: "exact" })
      .eq("development_id", body.development_id)
      .eq("tenant_id", ctx.tenantId);

    if (body.only_active) {
      query = query.eq("status", "ativo");
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return {
        ok: false,
        error: { code: error.code || "QUERY_ERROR", message: error.message },
      };
    }

    return {
      ok: true,
      data: {
        matriculas: (data || []) as MatriculaRecord[],
        total: count || 0,
        offset,
        limit,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : "Erro desconhecido",
      },
    };
  }
}

// ============================================================
// ACTION: Validate Matrícula
// ============================================================

async function actionValidateMatricula(
  ctx: RequestContext,
  body: {
    numero_matricula: string;
    cartorio_codigo: string;
    development_id?: string;
  }
): Promise<{
  ok: boolean;
  data?: {
    is_valid: boolean;
    format_ok: boolean;
    duplicated: boolean;
    message: string;
    sugestao?: string;
  };
  error?: { code: string; message: string };
}> {
  try {
    const format_ok = validateMatriculaFormat(body.numero_matricula, body.cartorio_codigo);

    if (!format_ok) {
      return {
        ok: true,
        data: {
          is_valid: false,
          format_ok: false,
          duplicated: false,
          message: "Formato de matrícula inválido",
          sugestao: "Use formato: XXXXX ou XXXXXX + código cartório (XXXX-X)",
        },
      };
    }

    // Check for duplicates
    let duplicateQuery = ctx.supabase
      .from("development_cri_matriculas")
      .select("id")
      .eq("numero_matricula", body.numero_matricula)
      .eq("cartorio_codigo", body.cartorio_codigo)
      .eq("tenant_id", ctx.tenantId);

    if (body.development_id) {
      duplicateQuery = duplicateQuery.eq("development_id", body.development_id);
    }

    const { data: duplicates, error: dupError } = await duplicateQuery;

    if (dupError && dupError.code !== "PGRST116") {
      return {
        ok: false,
        error: { code: dupError.code || "QUERY_ERROR", message: dupError.message },
      };
    }

    const duplicated = (duplicates?.length || 0) > 0;

    return {
      ok: true,
      data: {
        is_valid: !duplicated,
        format_ok: true,
        duplicated,
        message: duplicated
          ? "Matrícula já registrada neste imóvel"
          : "Matrícula válida e disponível",
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : "Erro desconhecido",
      },
    };
  }
}

// ============================================================
// Router
// ============================================================

async function handleRequest(req: Request, isPreFlight: boolean): Promise<Response> {
  if (isPreFlight) {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const body = await req.json();
    const authHeader = req.headers.get("authorization");

    // Create auth clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: "CONFIG_ERROR", message: "Missing env vars" } }),
        { status: 500, headers: corsHeaders(req) }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { authorization: authHeader || "" } },
    });

    // Extract token from Bearer header
    const token = authHeader?.replace("Bearer ", "") || "";

    // Get user
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(token);

    if (authErr || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: "UNAUTHORIZED", message: "Invalid token" } }),
        { status: 401, headers: corsHeaders(req) }
      );
    }

    // Get tenant
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileErr || !profile?.tenant_id) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: "TENANT_ERROR", message: "Tenant not found" } }),
        { status: 403, headers: corsHeaders(req) }
      );
    }

    const ctx: RequestContext = {
      supabase,
      userId: user.id,
      tenantId: profile.tenant_id,
    };

    // Route action
    let result;
    switch (body.action) {
      case "register_matricula":
        result = await actionRegisterMatricula(ctx, body);
        break;
      case "get_matricula":
        result = await actionGetMatricula(ctx, body.matricula_id);
        break;
      case "list_matriculas":
        result = await actionListMatriculas(ctx, body);
        break;
      case "validate_matricula":
        result = await actionValidateMatricula(ctx, body);
        break;
      default:
        return new Response(
          JSON.stringify({ ok: false, error: { code: "UNKNOWN_ACTION", message: `Action '${body.action}' not found` } }),
          { status: 400, headers: corsHeaders(req) }
        );
    }

    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 400,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: "REQUEST_ERROR",
          message: err instanceof Error ? err.message : "Unknown error",
        },
      }),
      { status: 400, headers: corsHeaders(req) }
    );
  }
}

// ============================================================
// Deno.serve
// ============================================================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleRequest(req, true);
  }
  return handleRequest(req, false);
});
