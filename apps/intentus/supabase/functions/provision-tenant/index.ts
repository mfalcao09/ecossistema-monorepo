import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PROVISION-TENANT] ${step}${d}`);
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

  // Auth: accept service_role Bearer, shared secret, or JWT from superadmin
  const authHeader = req.headers.get("authorization") || "";
  const webhookSecret = req.headers.get("x-webhook-secret");
  const expectedSecret = Deno.env.get("PROVISION_SECRET");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Validate caller
  const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
  const isWebhookAuth = expectedSecret && webhookSecret === expectedSecret;

  // Also accept authenticated superadmin users (for manual creation from UI)
  let isSuperadminUser = false;
  if (!isServiceRole && !isWebhookAuth && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const tempClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: userData } = await tempClient.auth.getUser(token);
    if (userData?.user) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const { data: roleData } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "superadmin")
        .maybeSingle();
      if (roleData) {
        isSuperadminUser = true;
        logStep("Authenticated as superadmin user", { userId: userData.user.id });
      }
    }
  }

  if (!isServiceRole && !isWebhookAuth && !isSuperadminUser) {
    logStep("Unauthorized request");
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json();
    logStep("Received payload", { keys: Object.keys(body) });

    const {
      // Company data
      company_name,
      slug,
      cnpj,
      stripe_price_id,
      stripe_subscription_id,
      settings,
      // Admin user data
      admin_email,
      admin_password,
      admin_name,
    } = body;

    if (!company_name || !admin_email) {
      return jsonResponse(
        { error: "company_name and admin_email are required" },
        400
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Find plan by stripe_price_id (if provided)
    let planId: string | null = null;
    if (stripe_price_id) {
      const { data: planData } = await supabase
        .from("plans")
        .select("id")
        .eq("stripe_price_id", stripe_price_id)
        .maybeSingle();
      planId = planData?.id || null;
      logStep("Plan lookup", { stripe_price_id, planId });
    }

    // 2. Check if tenant already exists (by slug or cnpj)
    let tenantId: string | null = null;

    if (slug) {
      const { data: existing } = await supabase
        .from("tenants")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (existing) tenantId = existing.id;
    }

    if (!tenantId && cnpj) {
      const { data: existing } = await supabase
        .from("tenants")
        .select("id")
        .eq("cnpj", cnpj)
        .maybeSingle();
      if (existing) tenantId = existing.id;
    }

    // 3. Create tenant if not exists
    if (!tenantId) {
      const finalSlug =
        slug ||
        company_name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .substring(0, 50) +
          "-" +
          Date.now().toString(36);

      const { data: tenant, error: tenantErr } = await supabase
        .from("tenants")
        .insert({
          name: company_name,
          slug: finalSlug,
          cnpj: cnpj || null,
          plan_id: planId,
          active: true,
          settings: settings || {},
        })
        .select("id")
        .single();

      if (tenantErr) {
        logStep("ERROR creating tenant", { error: tenantErr.message });
        return jsonResponse({ error: `Tenant creation failed: ${tenantErr.message}` }, 500);
      }
      tenantId = tenant.id;
      logStep("Tenant created", { tenantId });
    } else {
      // Update existing tenant with plan if needed
      if (planId) {
        await supabase
          .from("tenants")
          .update({ plan_id: planId, settings: settings || undefined })
          .eq("id", tenantId);
      }
      logStep("Tenant already exists, updated", { tenantId });
    }

    // 4. Create subscription
    if (planId && tenantId) {
      // Check if active subscription already exists
      const { data: existingSub } = await supabase
        .from("tenant_subscriptions")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("status", "ativo")
        .maybeSingle();

      if (!existingSub) {
        const now = new Date();
        const expiresAt = new Date(now);
        expiresAt.setMonth(expiresAt.getMonth() + 1);

        const { error: subErr } = await supabase
          .from("tenant_subscriptions")
          .insert({
            tenant_id: tenantId,
            plan_id: planId,
            status: "ativo",
            started_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
            stripe_subscription_id: stripe_subscription_id || null,
          });

        if (subErr) {
          logStep("ERROR creating subscription", { error: subErr.message });
        } else {
          logStep("Subscription created", { tenantId, planId });
        }
      } else {
        logStep("Active subscription already exists", { tenantId });
      }
    }

    // 5. Create admin user (auth.users)
    let userId: string | null = null;
    const generatedPassword =
      admin_password || crypto.randomUUID().replace(/-/g, "").substring(0, 16);

    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
      filter: admin_email,
    });
    const existingUser = existingUsers?.users?.[0] || null;

    if (existingUser) {
      userId = existingUser.id;
      logStep("User already exists", { userId, email: admin_email });
    } else {

      const { data: newUser, error: userErr } =
        await supabase.auth.admin.createUser({
          email: admin_email,
          password: generatedPassword,
          email_confirm: true,
          user_metadata: { name: admin_name || company_name },
        });

      if (userErr) {
        logStep("ERROR creating user", { error: userErr.message });
        return jsonResponse(
          {
            error: `User creation failed: ${userErr.message}`,
            tenantId,
          },
          500
        );
      }
      userId = newUser.user.id;
      logStep("User created", { userId, email: admin_email });
    }

    // 6. Link profile to tenant
    if (userId && tenantId) {
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ tenant_id: tenantId })
        .eq("user_id", userId);

      if (profileErr) {
        logStep("ERROR updating profile", { error: profileErr.message });
      } else {
        logStep("Profile linked to tenant", { userId, tenantId });
      }
    }

    // 7. Assign admin role
    if (userId && tenantId) {
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (!existingRole) {
        const { error: roleErr } = await supabase
          .from("user_roles")
          .insert({
            user_id: userId,
            role: "admin",
            tenant_id: tenantId,
          });

        if (roleErr) {
          logStep("ERROR assigning role", { error: roleErr.message });
        } else {
          logStep("Admin role assigned", { userId, tenantId });
        }
      } else {
        logStep("Admin role already exists", { userId });
      }
    }

    // 8. Send welcome email with credentials (non-blocking)
    if (userId && !existingUser) {
      try {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey) {
          const { Resend } = await import("npm:resend@2.0.0");
          const resend = new Resend(resendApiKey);
          await resend.emails.send({
            from: "Intentus <noreply@intentus.com.br>",
            to: [admin_email],
            subject: `Bem-vindo à Intentus - Suas credenciais de acesso`,
            html: `
              <h2>Bem-vindo à Intentus Real Estate!</h2>
              <p>Sua empresa <strong>${company_name}</strong> foi configurada com sucesso.</p>
              <p><strong>Suas credenciais de acesso:</strong></p>
              <ul>
                <li><strong>Email:</strong> ${admin_email}</li>
                <li><strong>Senha temporária:</strong> ${generatedPassword}</li>
              </ul>
              <p><a href="https://app.intentus.com.br" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">Acessar a plataforma</a></p>
              <p style="margin-top:16px;">Recomendamos que você altere sua senha no primeiro acesso.</p>
              <p style="color:#888;font-size:13px;">Caso tenha problemas com suas credenciais, use o link <a href="https://app.intentus.com.br/auth?tab=reset">Esqueci minha senha</a>.</p>
            `,
          });
          logStep("Welcome email sent", { to: admin_email });
        } else {
          logStep("WARNING: RESEND_API_KEY not configured, skipping welcome email");
        }
      } catch (emailErr) {
        logStep("WARNING: Failed to send welcome email", { error: String(emailErr) });
      }
    } else if (existingUser) {
      logStep("Skipping welcome email — user already existed", { email: admin_email });
    }

    return jsonResponse({
      success: true,
      tenant_id: tenantId,
      user_id: userId,
      plan_id: planId,
    });
  } catch (error) {
    logStep("ERROR", {
      message: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse(
      { error: "Erro ao provisionar tenant" },
      500
    );
  }
});
