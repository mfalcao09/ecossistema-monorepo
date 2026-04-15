// clm-seed-demo v1 — Seed de dados de demonstração para onboarding CLM
// Cria propriedades, contratos, templates, obrigações e partes para tenant do usuário
// Todas as entidades marcadas com metadata { is_demo: true } para cleanup
// Chamada manual via frontend (botão "Experimentar com dados de exemplo")

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Dados de demonstração ──────────────────────────────────

const DEMO_PROPERTIES = [
  {
    title: "Apartamento 302 — Ed. Solar das Flores",
    property_type: "apartamento",
    neighborhood: "Centro",
    city: "Piracicaba",
    state: "SP",
    zip_code: "13400-010",
    street: "Rua Governador Pedro de Toledo",
    number: "302",
    area_total: 72,
    area_built: 65,
    bedrooms: 2,
    bathrooms: 1,
    parking_spaces: 1,
    is_demo: true,
  },
  {
    title: "Casa 3 quartos — Jd. Nova América",
    property_type: "casa",
    neighborhood: "Nova América",
    city: "Piracicaba",
    state: "SP",
    zip_code: "13420-280",
    street: "Rua das Acácias",
    number: "150",
    area_total: 200,
    area_built: 140,
    bedrooms: 3,
    bathrooms: 2,
    parking_spaces: 2,
    is_demo: true,
  },
  {
    title: "Sala Comercial 45m² — Office Park",
    property_type: "comercial",
    neighborhood: "Paulista",
    city: "Piracicaba",
    state: "SP",
    zip_code: "13416-150",
    street: "Av. Independência",
    number: "1200",
    complement: "Sala 504",
    area_total: 45,
    area_built: 45,
    bedrooms: 0,
    bathrooms: 1,
    parking_spaces: 1,
    is_demo: true,
  },
];

const DEMO_PEOPLE = [
  { name: "Carlos Eduardo Mendes", cpf_cnpj: "123.456.789-00", email: "carlos.demo@example.com", phone: "(19) 99999-0001", person_type: "fisica", is_demo: true },
  { name: "Maria Fernanda Silva", cpf_cnpj: "987.654.321-00", email: "maria.demo@example.com", phone: "(19) 99999-0002", person_type: "fisica", is_demo: true },
  { name: "Tech Solutions Ltda", cpf_cnpj: "12.345.678/0001-90", email: "contato.demo@techsolutions.com", phone: "(19) 3333-0001", person_type: "juridica", is_demo: true },
  { name: "Ana Paula Rodrigues", cpf_cnpj: "456.789.123-00", email: "ana.demo@example.com", phone: "(19) 99999-0003", person_type: "fisica", is_demo: true },
];

const DEMO_TEMPLATES = [
  {
    name: "Contrato de Locação Residencial Padrão",
    template_type: "locacao",
    description: "Template completo para locação residencial com cláusulas de reajuste, multa e garantias.",
    content: `<h1>CONTRATO DE LOCAÇÃO RESIDENCIAL</h1>
<p>Pelo presente instrumento particular, as partes:</p>
<p><strong>LOCADOR:</strong> {{locador_nome}}, inscrito no CPF/CNPJ sob nº {{locador_documento}}</p>
<p><strong>LOCATÁRIO:</strong> {{locatario_nome}}, inscrito no CPF/CNPJ sob nº {{locatario_documento}}</p>
<p>Têm entre si justo e contratado o seguinte:</p>
<h2>CLÁUSULA 1ª — DO OBJETO</h2>
<p>O LOCADOR dá em locação ao LOCATÁRIO o imóvel situado em {{imovel_endereco}}, pelo prazo de {{prazo_meses}} meses.</p>
<h2>CLÁUSULA 2ª — DO VALOR</h2>
<p>O valor do aluguel mensal é de R$ {{valor_mensal}}, com vencimento todo dia {{dia_vencimento}}.</p>
<h2>CLÁUSULA 3ª — DO REAJUSTE</h2>
<p>O aluguel será reajustado anualmente pelo índice {{indice_reajuste}}.</p>`,
    is_active: true,
    is_demo: true,
  },
  {
    name: "Contrato de Locação Comercial",
    template_type: "locacao",
    description: "Template para locação de salas e espaços comerciais com cláusulas específicas de uso.",
    content: `<h1>CONTRATO DE LOCAÇÃO COMERCIAL</h1>
<p><strong>LOCADOR:</strong> {{locador_nome}}</p>
<p><strong>LOCATÁRIO:</strong> {{locatario_nome}}</p>
<h2>CLÁUSULA 1ª — DO OBJETO E DESTINAÇÃO</h2>
<p>O imóvel localizado em {{imovel_endereco}} é destinado exclusivamente para fins comerciais.</p>
<h2>CLÁUSULA 2ª — DO PRAZO E VALOR</h2>
<p>Prazo: {{prazo_meses}} meses. Aluguel: R$ {{valor_mensal}}/mês.</p>`,
    is_active: true,
    is_demo: true,
  },
];

// ── MAIN HANDLER ──────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Pegar user do Authorization header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return jsonResponse({ error: "Invalid token" }, 401);
  }

  // Resolver tenant_id do usuário
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.tenant_id) {
    return jsonResponse({ error: "No tenant found" }, 400);
  }

  const tenantId = profile.tenant_id;
  const userId = user.id;

  // Parse body para action
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch { /* empty body = seed */ }

  const action = (body.action as string) || "seed";

  console.log(`[clm-seed-demo] Action: ${action}, tenant: ${tenantId}`);

  try {
    if (action === "cleanup") {
      return await handleCleanup(supabase, tenantId);
    }

    if (action === "check") {
      return await handleCheck(supabase, tenantId);
    }

    // Default: seed
    return await handleSeed(supabase, tenantId, userId);
  } catch (error) {
    console.error("[clm-seed-demo] Error:", error);
    return jsonResponse({ error: "Internal error", detail: String(error) }, 500);
  }
});

// ── Seed: criar dados de demonstração ──────────────────────
async function handleSeed(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  userId: string,
) {
  // Verificar se já tem dados demo
  const { count: existingDemo } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("is_demo", true);

  if ((existingDemo || 0) > 0) {
    return jsonResponse({ success: true, skipped: true, reason: "demo_data_exists" });
  }

  const created: Record<string, number> = { properties: 0, people: 0, contracts: 0, templates: 0 };

  // 1. Criar pessoas
  const peopleIds: string[] = [];
  for (const person of DEMO_PEOPLE) {
    const { data, error } = await supabase
      .from("people")
      .insert({ ...person, tenant_id: tenantId, created_by: userId })
      .select("id")
      .single();
    if (error) {
      console.error("[clm-seed-demo] Failed to create person:", error.message);
      continue;
    }
    peopleIds.push(data.id);
    created.people++;
  }

  // 2. Criar propriedades
  const propertyIds: string[] = [];
  for (const prop of DEMO_PROPERTIES) {
    const { data, error } = await supabase
      .from("properties")
      .insert({ ...prop, tenant_id: tenantId, created_by: userId })
      .select("id")
      .single();
    if (error) {
      console.error("[clm-seed-demo] Failed to create property:", error.message);
      continue;
    }
    propertyIds.push(data.id);
    created.properties++;
  }

  // 3. Criar contratos (1 ativo, 1 rascunho, 1 em aprovação)
  const now = new Date();
  const contractConfigs = [
    {
      contract_number: "DEMO-001",
      contract_type: "locacao",
      status: "ativo",
      start_date: new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().split("T")[0],
      end_date: new Date(now.getFullYear() + 1, now.getMonth() - 6, 1).toISOString().split("T")[0],
      monthly_value: 2500,
      adjustment_index: "IGPM",
      adjustment_date: new Date(now.getFullYear(), now.getMonth() + 6, 1).toISOString().split("T")[0],
      property_idx: 0,
      locador_idx: 0,
      locatario_idx: 1,
    },
    {
      contract_number: "DEMO-002",
      contract_type: "locacao",
      status: "rascunho",
      start_date: null,
      end_date: null,
      monthly_value: 4200,
      adjustment_index: "IPCA",
      adjustment_date: null,
      property_idx: 1,
      locador_idx: 0,
      locatario_idx: 3,
    },
    {
      contract_number: "DEMO-003",
      contract_type: "locacao",
      status: "ativo",
      start_date: new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().split("T")[0],
      end_date: new Date(now.getFullYear(), now.getMonth() + 1, 15).toISOString().split("T")[0], // Vence em ~45 dias
      monthly_value: 3800,
      adjustment_index: "IGPM",
      adjustment_date: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0],
      property_idx: 2,
      locador_idx: 0,
      locatario_idx: 2, // empresa
    },
  ];

  const contractIds: string[] = [];
  for (const cfg of contractConfigs) {
    const propertyId = propertyIds[cfg.property_idx];
    if (!propertyId) continue;

    const { data, error } = await supabase
      .from("contracts")
      .insert({
        contract_number: cfg.contract_number,
        contract_type: cfg.contract_type,
        status: cfg.status,
        start_date: cfg.start_date,
        end_date: cfg.end_date,
        monthly_value: cfg.monthly_value,
        adjustment_index: cfg.adjustment_index,
        adjustment_date: cfg.adjustment_date,
        property_id: propertyId,
        tenant_id: tenantId,
        created_by: userId,
        has_intermediation: false,
        is_demo: true,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[clm-seed-demo] Failed to create contract:", error.message);
      continue;
    }

    contractIds.push(data.id);
    created.contracts++;

    // Criar partes do contrato
    const locadorId = peopleIds[cfg.locador_idx];
    const locatarioId = peopleIds[cfg.locatario_idx];
    if (locadorId) {
      await supabase.from("contract_parties").insert({
        contract_id: data.id,
        people_id: locadorId,
        role: "locador",
        tenant_id: tenantId,
      });
    }
    if (locatarioId) {
      await supabase.from("contract_parties").insert({
        contract_id: data.id,
        people_id: locatarioId,
        role: "locatario",
        tenant_id: tenantId,
      });
    }
  }

  // 4. Criar templates
  for (const tpl of DEMO_TEMPLATES) {
    const { error } = await supabase
      .from("legal_contract_templates")
      .insert({
        ...tpl,
        tenant_id: tenantId,
        created_by: userId,
      });
    if (error) {
      console.error("[clm-seed-demo] Failed to create template:", error.message);
      continue;
    }
    created.templates++;
  }

  console.log(`[clm-seed-demo] Seed complete:`, created);

  return jsonResponse({
    success: true,
    created,
    contract_ids: contractIds,
    property_ids: propertyIds,
  });
}

// ── Cleanup: remover dados de demonstração ─────────────────
async function handleCleanup(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
) {
  const deleted: Record<string, number> = {};

  // Ordem de deleção (respeitar FKs): parties → contracts → properties → people → templates

  // 1. Buscar contract IDs demo
  const { data: demoContracts } = await supabase
    .from("contracts")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_demo", true);

  const contractIds = (demoContracts || []).map((c: any) => c.id);

  if (contractIds.length > 0) {
    // Deletar contract_parties dos contratos demo
    const { count: partiesCount } = await supabase
      .from("contract_parties")
      .delete({ count: "exact" })
      .in("contract_id", contractIds);
    deleted.contract_parties = partiesCount || 0;

    // Deletar contratos demo
    const { count: contractsCount } = await supabase
      .from("contracts")
      .delete({ count: "exact" })
      .eq("tenant_id", tenantId)
      .eq("is_demo", true);
    deleted.contracts = contractsCount || 0;
  }

  // 2. Deletar propriedades demo
  const { count: propsCount } = await supabase
    .from("properties")
    .delete({ count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("is_demo", true);
  deleted.properties = propsCount || 0;

  // 3. Deletar pessoas demo
  const { count: peopleCount } = await supabase
    .from("people")
    .delete({ count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("is_demo", true);
  deleted.people = peopleCount || 0;

  // 4. Deletar templates demo
  const { count: templatesCount } = await supabase
    .from("legal_contract_templates")
    .delete({ count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("is_demo", true);
  deleted.templates = templatesCount || 0;

  console.log(`[clm-seed-demo] Cleanup complete:`, deleted);
  return jsonResponse({ success: true, deleted });
}

// ── Check: verificar se dados demo existem ─────────────────
async function handleCheck(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
) {
  const { count } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("is_demo", true);

  return jsonResponse({ has_demo_data: (count || 0) > 0, demo_count: count || 0 });
}
