// ============================================================
// Edge Function: property-favorites-api
// Feature: CRUD de favoritos de imóveis
// Autor: Claude (Opus) — full-feature-pipeline test
// Padrões: action routing, resolveAuth, .maybeSingle(), soft delete
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// ---- Types ----
interface AuthContext {
  user: { id: string };
  tenantId: string;
  profileId: string;
}

// ---- Zod Schemas ----
const ToggleSchema = z.object({
  action: z.literal("toggle"),
  propertyId: z.string().uuid("propertyId deve ser UUID válido"),
});

const UpdateNotesSchema = z.object({
  action: z.literal("update_notes"),
  favoriteId: z.string().uuid("favoriteId deve ser UUID válido"),
  notes: z.string().max(500, "Notas devem ter no máximo 500 caracteres").nullable(),
});

const UpdateNotifySchema = z.object({
  action: z.literal("update_notify"),
  favoriteId: z.string().uuid("favoriteId deve ser UUID válido"),
  notifyOnChange: z.boolean(),
});

const CheckSchema = z.object({
  action: z.literal("check"),
  propertyId: z.string().uuid("propertyId deve ser UUID válido"),
});

// ---- CORS Headers ----
const ALLOWED_ORIGINS = [
  "https://app.intentusrealestate.com.br",
  "https://intentus-plataform.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  // Fix (Buchecha review): rejeitar origins desconhecidos explicitamente
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowedOrigin || ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

// ---- Auth Helper ----
async function resolveAuth(req: Request, supabase: any): Promise<AuthContext> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) throw new Error("Missing authorization header");

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("Invalid or expired token");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) throw new Error("Profile not found");
  if (!profile.tenant_id) throw new Error("Tenant not found");

  return {
    user,
    tenantId: profile.tenant_id,
    profileId: profile.id,
  };
}

// ---- Supabase Client ----
function getSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ---- Handlers ----

async function handleList(supabase: any, auth: AuthContext) {
  const { data, error } = await supabase
    .from("property_favorites")
    .select(`
      id,
      property_id,
      notes,
      notify_on_change,
      created_at,
      properties:property_id (
        id,
        title,
        street,
        city,
        state,
        neighborhood,
        status,
        purpose,
        property_type,
        sale_price,
        rental_price
      )
    `)
    .eq("tenant_id", auth.tenantId)
    .eq("user_id", auth.profileId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  return data || [];
}

async function handleToggle(supabase: any, auth: AuthContext, params: z.infer<typeof ToggleSchema>) {
  // Fix (Buchecha review): validar que property pertence ao tenant
  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("id", params.propertyId)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (!property) throw new Error("Property not found or access denied");

  // Verificar se já existe (incluindo soft-deleted)
  const { data: existing } = await supabase
    .from("property_favorites")
    .select("id, deleted_at")
    .eq("tenant_id", auth.tenantId)
    .eq("user_id", auth.profileId)
    .eq("property_id", params.propertyId)
    .maybeSingle();

  if (existing && existing.deleted_at === null) {
    // Fix (Buchecha review): padronizar check de deleted_at
    // Existe e está ativo → soft delete
    const { error } = await supabase
      .from("property_favorites")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", existing.id);

    if (error) throw error;
    return { toggled: "removed", favoriteId: existing.id };
  }

  if (existing && existing.deleted_at !== null) {
    // Existe mas foi deletado → reativar
    const { error } = await supabase
      .from("property_favorites")
      .update({ deleted_at: null, updated_at: new Date().toISOString() })
      .eq("id", existing.id);

    if (error) throw error;
    return { toggled: "added", favoriteId: existing.id };
  }

  // Não existe → criar novo
  const { data, error } = await supabase
    .from("property_favorites")
    .insert({
      tenant_id: auth.tenantId,
      user_id: auth.profileId,
      property_id: params.propertyId,
    })
    .select("id")
    .maybeSingle();

  if (error) throw error;
  // Fix (Buchecha review): null check explícito no insert
  if (!data) throw new Error("Failed to create favorite");
  return { toggled: "added", favoriteId: data.id };
}

async function handleUpdateNotes(supabase: any, auth: AuthContext, params: z.infer<typeof UpdateNotesSchema>) {
  const { data, error } = await supabase
    .from("property_favorites")
    .update({ notes: params.notes })
    .eq("id", params.favoriteId)
    .eq("tenant_id", auth.tenantId)
    .eq("user_id", auth.profileId)
    .is("deleted_at", null)
    .select("id, notes")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Favorite not found or access denied");
  return data;
}

async function handleUpdateNotify(supabase: any, auth: AuthContext, params: z.infer<typeof UpdateNotifySchema>) {
  const { data, error } = await supabase
    .from("property_favorites")
    .update({ notify_on_change: params.notifyOnChange })
    .eq("id", params.favoriteId)
    .eq("tenant_id", auth.tenantId)
    .eq("user_id", auth.profileId)
    .is("deleted_at", null)
    .select("id, notify_on_change")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Favorite not found or access denied");
  return data;
}

async function handleCheck(supabase: any, auth: AuthContext, params: z.infer<typeof CheckSchema>) {
  const { data } = await supabase
    .from("property_favorites")
    .select("id")
    .eq("tenant_id", auth.tenantId)
    .eq("user_id", auth.profileId)
    .eq("property_id", params.propertyId)
    .is("deleted_at", null)
    .maybeSingle();

  return { isFavorite: !!data, favoriteId: data?.id || null };
}

async function handleCount(supabase: any, auth: AuthContext) {
  const { count, error } = await supabase
    .from("property_favorites")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", auth.tenantId)
    .eq("user_id", auth.profileId)
    .is("deleted_at", null);

  if (error) throw error;
  return { count: count || 0 };
}

// ---- Main Handler ----
serve(async (req: Request) => {
  const cors = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    const body = await req.json();
    const { action, ...params } = body;

    const supabase = getSupabaseClient();
    const auth = await resolveAuth(req, supabase);

    const handlers: Record<string, () => Promise<any>> = {
      list: () => handleList(supabase, auth),
      toggle: () => {
        const parsed = ToggleSchema.parse({ action, ...params });
        return handleToggle(supabase, auth, parsed);
      },
      update_notes: () => {
        const parsed = UpdateNotesSchema.parse({ action, ...params });
        return handleUpdateNotes(supabase, auth, parsed);
      },
      update_notify: () => {
        const parsed = UpdateNotifySchema.parse({ action, ...params });
        return handleUpdateNotify(supabase, auth, parsed);
      },
      check: () => {
        const parsed = CheckSchema.parse({ action, ...params });
        return handleCheck(supabase, auth, parsed);
      },
      count: () => handleCount(supabase, auth),
    };

    const handler = handlers[action];
    if (!handler) {
      return new Response(
        JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
        { status: 400, headers: cors }
      );
    }

    const data = await handler();
    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: cors }
    );
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.errors.map((e) => e.message).join(", ")
      : error instanceof Error
        ? error.message
        : "Internal server error";

    const status = error instanceof z.ZodError ? 400 : 500;

    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status, headers: cors }
    );
  }
});
