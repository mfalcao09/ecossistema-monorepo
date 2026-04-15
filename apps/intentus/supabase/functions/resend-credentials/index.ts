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
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Authenticate caller
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

  // Only superadmin can resend credentials
  const { data: callerRoles } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId);

  const roles = (callerRoles || []).map((r: any) => r.role);
  if (!roles.includes("superadmin")) {
    return jsonResponse({ error: "Apenas superadmin pode reenviar credenciais" }, 403);
  }

  try {
    const { user_id, email } = await req.json();

    if (!user_id || !email) {
      return jsonResponse({ error: "user_id e email são obrigatórios" }, 400);
    }

    // Generate new temporary password
    const newPassword = crypto.randomUUID().replace(/-/g, "").substring(0, 12);

    // Update password in auth
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(user_id, {
      password: newPassword,
    });

    if (updateErr) {
      return jsonResponse({ error: `Erro ao atualizar senha: ${updateErr.message}` }, 500);
    }

    // Get tenant/company info for the email
    const { data: profile } = await adminClient
      .from("profiles")
      .select("tenant_id, name")
      .eq("user_id", user_id)
      .single();

    let companyName = "sua empresa";
    if (profile?.tenant_id) {
      const { data: tenant } = await adminClient
        .from("tenants")
        .select("name")
        .eq("id", profile.tenant_id)
        .single();
      if (tenant) companyName = tenant.name;
    }

    // Send email with new credentials
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return jsonResponse({
        success: true,
        temp_password: newPassword,
        email_sent: false,
        warning: "RESEND_API_KEY não configurada. Senha atualizada mas email não enviado.",
      });
    }

    const { Resend } = await import("npm:resend@2.0.0");
    const resend = new Resend(resendApiKey);

    await resend.emails.send({
      from: "Intentus <noreply@intentus.com.br>",
      to: [email],
      subject: "Intentus - Novas credenciais de acesso",
      html: `
        <h2>Novas credenciais de acesso - Intentus</h2>
        <p>Suas credenciais para a empresa <strong>${companyName}</strong> foram atualizadas.</p>
        <p><strong>Suas novas credenciais:</strong></p>
        <ul>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Nova senha temporária:</strong> ${newPassword}</li>
        </ul>
        <p><a href="https://app.intentus.com.br" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">Acessar a plataforma</a></p>
        <p style="margin-top:16px;">Recomendamos que você altere sua senha no primeiro acesso.</p>
        <p style="color:#888;font-size:13px;">Caso tenha problemas, use o link <a href="https://app.intentus.com.br/auth?tab=reset">Esqueci minha senha</a>.</p>
      `,
    });

    return jsonResponse({
      success: true,
      email_sent: true,
    });
  } catch (error) {
    console.error("resend-credentials error:", error);
    return jsonResponse({ error: "Erro ao reenviar credenciais" }, 500);
  }
});
