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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const token = authHeader.replace("Bearer ", "");

  // Validate the JWT
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser(token);

  if (userErr || !userData?.user) {
    console.error("Auth error:", userErr?.message);
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const callerId = userData.user.id;
  const masterUid = "85ba82c5-479d-4405-83ba-69359486780b";

  if (callerId !== masterUid) {
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);

    const roles = (callerRoles || []).map((r: any) => r.role);
    const allowed = roles.some((r: string) => ["admin", "gerente", "superadmin"].includes(r));
    if (!allowed) {
      return jsonResponse({ error: "Permissão insuficiente." }, 403);
    }
  }

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return jsonResponse({ error: "SUPABASE_DB_URL não configurada" }, 500);
  }

  console.log("DB URL prefix:", dbUrl.substring(0, 30));

  // Try to parse using URL API first (handles special chars, encoding, etc.)
  try {
    // Support both postgresql:// and postgres:// schemes
    const normalizedUrl = dbUrl.replace(/^postgres:\/\//, "postgresql://");
    const parsed = new URL(normalizedUrl);

    const host = parsed.hostname;
    const user = decodeURIComponent(parsed.username);
    const password = decodeURIComponent(parsed.password);
    const database = parsed.pathname.replace(/^\//, "");
    const port = parseInt(parsed.port || "5432");

    return jsonResponse({
      host,
      database,
      user,
      password,
      port,
      connection_string: dbUrl,
    });
  } catch (e) {
    console.error("URL parse failed:", e);
    return jsonResponse({ error: "Não foi possível interpretar SUPABASE_DB_URL: " + String(e) }, 500);
  }
});
