import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const MASTER_UID = "85ba82c5-479d-4405-83ba-69359486780b";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const callerId = claimsData.claims.sub as string;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Check caller is superadmin
  const { data: callerRoles } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId);

  const isSuperadmin = (callerRoles || []).some((r) => r.role === "superadmin");
  if (!isSuperadmin) {
    return jsonResponse({ error: "Apenas superadmins podem excluir usuários." }, 403);
  }

  try {
    const { user_id } = await req.json();

    if (!user_id) {
      return jsonResponse({ error: "user_id é obrigatório" }, 400);
    }

    if (user_id === MASTER_UID) {
      return jsonResponse({ error: "Não é possível excluir o usuário master." }, 403);
    }

    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(user_id);
    if (deleteErr) {
      return jsonResponse({ error: `Erro ao excluir: ${deleteErr.message}` }, 500);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("delete-user error:", error);
    return jsonResponse(
      { error: "Erro ao processar solicitação" },
      500
    );
  }
});
