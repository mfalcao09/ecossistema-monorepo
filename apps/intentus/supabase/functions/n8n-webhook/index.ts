import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function verifyWebhookSecret(req: Request): boolean {
  const secret = Deno.env.get("N8N_WEBHOOK_SECRET");
  if (!secret) {
    console.error("N8N_WEBHOOK_SECRET not configured");
    return false;
  }
  const provided = req.headers.get("x-webhook-secret");
  return provided === secret;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate via webhook secret
  if (!verifyWebhookSecret(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    if (req.method === "POST") {
      return await handlePost(supabase, req);
    }
    if (req.method === "GET") {
      return await handleGet(supabase, req);
    }
    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error("Webhook error:", err);
    return jsonResponse({ error: "Erro ao processar webhook" }, 500);
  }
});

// ─── POST: cadastra lead com deduplicação ───────────────────────────
async function handlePost(supabase: any, req: Request) {
  const body = await req.json();
  const { name, phone, phone2, email, cpf_cnpj, notes } = body;

  if (!name || (!phone && !cpf_cnpj)) {
    return jsonResponse(
      { error: "Campos obrigatórios: name e (phone ou cpf_cnpj)" },
      400
    );
  }

  // Verificação de duplicidade por telefone ou CPF
  let existing = null;

  if (phone) {
    const { data } = await supabase
      .from("people")
      .select("id, name, phone, cpf_cnpj")
      .eq("phone", phone)
      .maybeSingle();
    if (data) existing = data;
  }

  if (!existing && cpf_cnpj) {
    const { data } = await supabase
      .from("people")
      .select("id, name, phone, cpf_cnpj")
      .eq("cpf_cnpj", cpf_cnpj)
      .maybeSingle();
    if (data) existing = data;
  }

  if (existing) {
    return jsonResponse({
      action: "duplicate_found",
      message: `Pessoa já cadastrada: ${existing.name}`,
      person: existing,
    });
  }

  // Inserir como lead — usa um user_id de serviço (service role ignora RLS)
  const { data: newPerson, error } = await supabase
    .from("people")
    .insert({
      name,
      phone: phone || null,
      phone2: phone2 || null,
      email: email || null,
      cpf_cnpj: cpf_cnpj || null,
      notes: notes || null,
      person_type: "lead",
      created_by: "00000000-0000-0000-0000-000000000000", // system/webhook
    })
    .select()
    .single();

  if (error) {
    console.error("Insert error:", error);
    return jsonResponse({ error: "Erro ao cadastrar lead" }, 500);
  }

  return jsonResponse(
    { action: "created", message: "Lead cadastrado com sucesso", person: newPerson },
    201
  );
}

// ─── GET: consulta pessoas com filtros ──────────────────────────────
async function handleGet(supabase: any, req: Request) {
  const url = new URL(req.url);
  const phone = url.searchParams.get("phone");
  const cpf_cnpj = url.searchParams.get("cpf_cnpj");
  const name = url.searchParams.get("name");
  const person_type = url.searchParams.get("person_type");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  let query = supabase
    .from("people")
    .select("id, name, phone, phone2, email, cpf_cnpj, person_type, city, state, created_at", { count: "exact" });

  if (phone) query = query.eq("phone", phone);
  if (cpf_cnpj) query = query.eq("cpf_cnpj", cpf_cnpj);
  if (name) {
    const safeName = name.replace(/[%_\\]/g, '\\$&').slice(0, 100);
    query = query.ilike("name", `%${safeName}%`);
  }
  if (person_type) query = query.eq("person_type", person_type);

  query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Query error:", error);
    return jsonResponse({ error: "Erro ao buscar dados" }, 500);
  }

  return jsonResponse({ data, total: count, limit, offset });
}
