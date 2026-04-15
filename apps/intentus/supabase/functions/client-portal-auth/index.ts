import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(message: string, status = 400) {
  return json({ error: message }, status);
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return err("Method not allowed", 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const action = body.action;

    // ─── GENERATE TOKEN ───
    if (action === "generate") {
      const { person_id, email, tenant_id } = body;
      if (!person_id || !email || !tenant_id) {
        return err("person_id, email e tenant_id são obrigatórios");
      }

      // Validate person exists and belongs to tenant
      const { data: person } = await supabase
        .from("people")
        .select("id")
        .eq("id", person_id)
        .eq("tenant_id", tenant_id)
        .single();

      if (!person) {
        return err("Pessoa não encontrada", 404);
      }

      // Delete expired tokens for this person
      await supabase
        .from("client_portal_tokens")
        .delete()
        .eq("person_id", person_id)
        .lt("expires_at", new Date().toISOString());

      // Generate secure token
      const rawToken = crypto.randomUUID();
      const tokenHash = await sha256(rawToken);

      // Token valid for 30 minutes
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      const { error: insertErr } = await supabase
        .from("client_portal_tokens")
        .insert({
          person_id,
          email,
          token_hash: tokenHash,
          expires_at: expiresAt,
          tenant_id,
        });

      if (insertErr) {
        console.error("Token insert error:", insertErr);
        return err("Erro ao gerar token", 500);
      }

      // Return raw token (only time it's visible)
      return json({
        token: rawToken,
        expires_at: expiresAt,
      });
    }

    // ─── VALIDATE TOKEN ───
    if (action === "validate") {
      const { token } = body;
      if (!token) {
        return err("token é obrigatório");
      }

      const tokenHash = await sha256(token);

      const { data: tokenRecord, error: tokenErr } = await supabase
        .from("client_portal_tokens")
        .select("person_id, email, tenant_id, expires_at")
        .eq("token_hash", tokenHash)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (tokenErr || !tokenRecord) {
        return err("Token inválido ou expirado", 401);
      }

      // Get person data
      const { data: person } = await supabase
        .from("people")
        .select("id, name, email, phone, person_type")
        .eq("id", tokenRecord.person_id)
        .single();

      return json({
        valid: true,
        person,
        tenant_id: tokenRecord.tenant_id,
      });
    }

    return err("Ação inválida. Use: generate, validate");
  } catch (error) {
    console.error("client-portal-auth error:", error);
    return err("Erro ao processar solicitação", 500);
  }
});
