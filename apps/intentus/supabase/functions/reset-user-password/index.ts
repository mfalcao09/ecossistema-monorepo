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

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;

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

  // Check caller permissions
  const { data: callerRoles } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId);

  const roles = (callerRoles || []).map((r: any) => r.role);
  const isSuperadmin = roles.includes("superadmin");
  const isAdminOrGerente = roles.includes("admin") || roles.includes("gerente");

  if (!isSuperadmin && !isAdminOrGerente) {
    return jsonResponse({ error: "Permissão insuficiente" }, 403);
  }

  try {
    const { user_id, new_password } = await req.json();

    if (!user_id || !new_password) {
      return jsonResponse({ error: "user_id e new_password são obrigatórios" }, 400);
    }

    if (!PASSWORD_REGEX.test(new_password)) {
      return jsonResponse({ error: "Senha deve conter maiúscula, minúscula, número e caractere especial (mín. 8 caracteres)" }, 400);
    }

    // Non-superadmin can only reset passwords for users in their own tenant
    if (!isSuperadmin) {
      const { data: callerProfile } = await adminClient
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", callerId)
        .single();

      const { data: targetProfile } = await adminClient
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user_id)
        .single();

      if (!callerProfile || !targetProfile || callerProfile.tenant_id !== targetProfile.tenant_id) {
        return jsonResponse({ error: "Não pode resetar senha de usuário de outro tenant" }, 403);
      }
    }

    const { error: updateErr } = await adminClient.auth.admin.updateUserById(user_id, {
      password: new_password,
    });

    if (updateErr) {
      return jsonResponse({ error: `Erro ao atualizar senha: ${updateErr.message}` }, 500);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("reset-user-password error:", error);
    return jsonResponse(
      { error: "Erro ao processar solicitação" },
      500
    );
  }
});
