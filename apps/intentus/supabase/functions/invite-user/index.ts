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

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const VALID_ROLES = ["admin", "gerente", "corretor", "financeiro", "juridico", "manutencao"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // 1. Authenticate caller
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" });
  }

  const token = authHeader.replace("Bearer ", "");
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: { user: callerUser }, error: callerErr } = await adminClient.auth.getUser(token);
  if (callerErr || !callerUser) {
    return jsonResponse({ error: "Unauthorized" });
  }

  const callerId = callerUser.id;

  // 2. Get caller's profile and roles
  const { data: callerProfile } = await adminClient
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", callerId)
    .single();

  if (!callerProfile?.tenant_id) {
    return jsonResponse({ error: "Caller has no tenant" });
  }

  const { data: callerRoles } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId);

  const roles = (callerRoles || []).map((r) => r.role);
  const isSuperadmin = roles.includes("superadmin");
  const isAdminOrGerente = roles.includes("admin") || roles.includes("gerente");

  if (!isSuperadmin && !isAdminOrGerente) {
    return jsonResponse({ error: "Permissão insuficiente" });
  }

  try {
    const { email, name, role, tenant_id, password } = await req.json();

    if (!email || !name || !role) {
      return jsonResponse({ error: "email, name e role são obrigatórios" });
    }

    if (!VALID_ROLES.includes(role)) {
      return jsonResponse({ error: `Role inválida: ${role}` });
    }

    // Determine target tenant
    const targetTenantId = isSuperadmin && tenant_id ? tenant_id : callerProfile.tenant_id;

    // Non-superadmin can only create users in their own tenant
    if (!isSuperadmin && tenant_id && tenant_id !== callerProfile.tenant_id) {
      return jsonResponse({ error: "Não pode criar usuário em outro tenant" });
    }

    // 3. Check plan user limit
    if (targetTenantId !== MASTER_TENANT_ID) {
      const { data: tenant } = await adminClient
        .from("tenants")
        .select("plan_id")
        .eq("id", targetTenantId)
        .single();

      if (tenant?.plan_id) {
        const { data: plan } = await adminClient
          .from("plans")
          .select("max_users")
          .eq("id", tenant.plan_id)
          .single();

        if (plan?.max_users) {
          const { data: extras } = await adminClient
            .from("tenant_extra_resources")
            .select("quantity")
            .eq("tenant_id", targetTenantId)
            .eq("resource_type", "users")
            .eq("status", "ativo");

          const extraUsers = (extras ?? []).reduce((sum: number, e: any) => sum + (e.quantity || 0), 0);
          const effectiveMax = plan.max_users + extraUsers;

          const { count } = await adminClient
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", targetTenantId)
            .eq("active", true);

          const { data: saUsers } = await adminClient
            .from("user_roles")
            .select("user_id")
            .eq("role", "superadmin");
          const saCount = (saUsers ?? []).length;

          if (((count || 0) - saCount) >= effectiveMax) {
            return jsonResponse({
              error: `Limite de ${effectiveMax} usuários atingido para este plano.`,
            });
          }
        }
      }
    }

    // 4. Determine password: use provided or generate random
    const customPassword = typeof password === "string" && password.trim().length > 0;
    const finalPassword = customPassword
      ? password.trim()
      : crypto.randomUUID().replace(/-/g, "").substring(0, 12);

    // 5. Create user
    const { data: newUser, error: userErr } = await adminClient.auth.admin.createUser({
      email,
      password: finalPassword,
      email_confirm: true,
      user_metadata: { name },
    });

    if (userErr) {
      const msg = userErr.message?.toLowerCase() || "";
      if (msg.includes("already been registered") || msg.includes("already exists")) {
        return jsonResponse({ error: "Já existe um usuário com este e-mail." });
      }
      return jsonResponse({ error: `Erro ao criar usuário: ${userErr.message}` });
    }

    const newUserId = newUser.user.id;

    // 6. Link profile to tenant
    await new Promise((r) => setTimeout(r, 500));

    const { error: profileErr } = await adminClient
      .from("profiles")
      .update({ tenant_id: targetTenantId, name })
      .eq("user_id", newUserId);

    if (profileErr) {
      console.error("Profile update error:", profileErr.message);
    }

    // 7. Assign role
    const { error: roleErr } = await adminClient
      .from("user_roles")
      .insert({ user_id: newUserId, role, tenant_id: targetTenantId });

    if (roleErr) {
      console.error("Role assignment error:", roleErr.message);
      return jsonResponse({ error: `Usuário criado mas erro ao atribuir role: ${roleErr.message}` });
    }

    // 8. If no custom password, send credentials by email
    let emailSent = false;
    if (!customPassword) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        try {
          // Get tenant/company name for the email
          let companyName = "sua empresa";
          const { data: tenantData } = await adminClient
            .from("tenants")
            .select("name")
            .eq("id", targetTenantId)
            .single();
          if (tenantData) companyName = tenantData.name;

          const { Resend } = await import("npm:resend@2.0.0");
          const resend = new Resend(resendApiKey);

          await resend.emails.send({
            from: "Intentus <noreply@intentus.com.br>",
            to: [email],
            subject: "Intentus - Suas credenciais de acesso",
            html: `
              <h2>Bem-vindo(a) ao Intentus!</h2>
              <p>Você foi adicionado(a) à empresa <strong>${companyName}</strong>.</p>
              <p><strong>Suas credenciais de acesso:</strong></p>
              <ul>
                <li><strong>Email:</strong> ${email}</li>
                <li><strong>Senha temporária:</strong> ${finalPassword}</li>
              </ul>
              <p><a href="https://app.intentus.com.br" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">Acessar a plataforma</a></p>
              <p style="margin-top:16px;">Recomendamos que você altere sua senha no primeiro acesso.</p>
              <p style="color:#888;font-size:13px;">Caso tenha problemas, use o link <a href="https://app.intentus.com.br/auth?tab=reset">Esqueci minha senha</a>.</p>
            `,
          });
          emailSent = true;
        } catch (emailErr) {
          console.error("Email sending error:", emailErr);
        }
      }
    }

    return jsonResponse({
      success: true,
      user_id: newUserId,
      temp_password: finalPassword,
      email_sent: emailSent,
    });
  } catch (error) {
    console.error("invite-user error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Erro ao processar convite" },
    );
  }
});
