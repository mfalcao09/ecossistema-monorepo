// commercial-broker-assistant v1 — Assistente IA para Corretores Imobiliários
// Self-contained Edge Function (inline CORS, auth/tenant, IA suggestions + history)
// Actions: suggest_script, generate_proposal, prepare_meeting, analyze_profile
// OpenRouter → Gemini 2.0 Flash with JSON mode + fallback rule-based
// Sessão 81 — Pair programming Claudinho + Buchecha

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS ──
const PROD_ORIGINS = [
  "https://intentus-plataform.vercel.app",
  "https://app.intentusrealestate.com.br",
];
const DEV_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const PREVIEW_REGEX = /^https:\/\/intentus-plataform-.+\.vercel\.app$/;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (PROD_ORIGINS.includes(origin)) return true;
  if (DEV_REGEX.test(origin)) return true;
  if (PREVIEW_REGEX.test(origin)) return true;
  const extra = Deno.env.get("ALLOWED_ORIGINS");
  if (extra) {
    for (const o of extra.split(",")) {
      if (o.trim() === origin) return true;
    }
  }
  return false;
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin");
  const allowed = isAllowedOrigin(origin) ? origin! : PROD_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// ── AI Helper ──
async function callAI(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) return null;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        response_format: { type: "json_object" },
        temperature: 0.4,
        max_tokens: 2048,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!res.ok) { console.error("AI error:", res.status, await res.text()); return null; }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch (e) { console.error("AI call failed:", e); return null; }
}

// ── Auth / Tenant ──
interface AuthCtx {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  tenantId: string;
  brokerName: string;
}

async function resolveAuth(req: Request): Promise<AuthCtx> {
  const authHeader = req.headers.get("authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.tenant_id) throw new Error("Tenant not found");

  return { supabase, userId: user.id, tenantId: profile.tenant_id, brokerName: profile.name || "Corretor" };
}

// ── Helpers ──
function fmtCurrency(v: number | null | undefined): string {
  if (v == null || isNaN(Number(v))) return "Não informado";
  return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "Não informado";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
}

// ── Data Fetchers ──
async function fetchLeadContext(ctx: AuthCtx, leadId: string) {
  const { data: lead } = await ctx.supabase
    .from("leads")
    .select("id, name, email, phone, source, status, interest_type, preferred_region, budget_min, budget_max, notes, lead_score, created_at, last_contact_at, person_id")
    .eq("id", leadId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!lead) return null;

  let interactions: any[] = [];
  if (lead.person_id) {
    const { data } = await ctx.supabase
      .from("interactions")
      .select("interaction_type, notes, created_at")
      .eq("person_id", lead.person_id)
      .order("created_at", { ascending: false })
      .limit(10);
    interactions = data || [];
  }

  return { lead, interactions };
}

async function fetchDealContext(ctx: AuthCtx, dealId: string) {
  const { data: deal } = await ctx.supabase
    .from("deal_requests")
    .select("id, property_id, deal_type, status, proposed_value, proposed_monthly_value, proposed_start_date, proposed_duration_months, payment_terms, guarantee_type, commission_percentage, commercial_notes, created_at, updated_at, properties:property_id(id, title, address_street, address_city, address_neighborhood)")
    .eq("id", dealId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!deal) return null;

  const { data: parties } = await ctx.supabase
    .from("deal_request_parties")
    .select("role, people:person_id(name, email, phone)")
    .eq("deal_request_id", dealId)
    .limit(10);

  const { data: history } = await ctx.supabase
    .from("deal_request_history")
    .select("field_changed, old_value, new_value, created_at")
    .eq("deal_request_id", dealId)
    .order("created_at", { ascending: false })
    .limit(10);

  return { deal, parties: parties || [], history: history || [] };
}

async function fetchPersonContext(ctx: AuthCtx, personId: string) {
  const { data: person } = await ctx.supabase
    .from("people")
    .select("id, name, email, phone, document_number, person_type, address_city, address_neighborhood, notes, created_at")
    .eq("id", personId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!person) return null;

  const { data: deals } = await ctx.supabase
    .from("deal_request_parties")
    .select("role, deal_requests:deal_request_id(id, deal_type, status, proposed_value, proposed_monthly_value)")
    .eq("person_id", personId)
    .limit(10);

  const { data: interactions } = await ctx.supabase
    .from("interactions")
    .select("interaction_type, notes, created_at")
    .eq("person_id", personId)
    .order("created_at", { ascending: false })
    .limit(15);

  return { person, deals: deals || [], interactions: interactions || [] };
}

// ── Save suggestion ──
async function saveSuggestion(
  ctx: AuthCtx,
  type: string,
  entityType: string,
  entityId: string,
  entityName: string | null,
  content: Record<string, unknown>,
  modelUsed: string
) {
  try {
    await ctx.supabase.from("ai_broker_suggestions").insert({
      tenant_id: ctx.tenantId,
      suggestion_type: type,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      broker_id: ctx.userId,
      suggestion_content: content,
      model_used: modelUsed,
    });
  } catch (e) { console.error("Failed to save suggestion:", e); }
}

// ═══════════════════════════════════════════════════════════════
// ACTION 1: suggest_script — Sugestões de scripts de vendas
// ═══════════════════════════════════════════════════════════════
async function handleSuggestScript(ctx: AuthCtx, body: any) {
  const { entity_type, entity_id, scenario } = body;
  if (!entity_type || !entity_id) throw new Error("entity_type and entity_id required");

  let contextData: any = null;
  let entityName = "";

  if (entity_type === "lead") {
    contextData = await fetchLeadContext(ctx, entity_id);
    entityName = contextData?.lead?.name || "";
  } else if (entity_type === "deal") {
    contextData = await fetchDealContext(ctx, entity_id);
    entityName = contextData?.deal?.properties?.title || `Negócio ${entity_id.slice(0, 8)}`;
  }
  if (!contextData) throw new Error(`${entity_type} not found`);

  const systemPrompt = `Você é um coach de vendas especializado em mercado imobiliário brasileiro.
Gere scripts e sugestões de abordagem para corretores. Sempre em português brasileiro.
Responda em JSON com esta estrutura:
{
  "scripts": [
    {
      "title": "Título curto do script",
      "scenario": "Cenário de uso",
      "opening": "Frase de abertura",
      "body": "Corpo principal do script (2-4 parágrafos)",
      "closing": "Frase de fechamento",
      "tips": ["Dica 1", "Dica 2"],
      "tone": "formal|casual|consultivo"
    }
  ],
  "general_tips": ["Dica geral 1", "Dica geral 2"],
  "objection_handlers": [
    { "objection": "Objeção comum", "response": "Resposta sugerida" }
  ]
}`;

  const contextSummary = entity_type === "lead"
    ? `Lead: ${contextData.lead.name}. Status: ${contextData.lead.status}. Interesse: ${contextData.lead.interest_type || "N/I"}. Região: ${contextData.lead.preferred_region || "N/I"}. Orçamento: ${fmtCurrency(contextData.lead.budget_min)} - ${fmtCurrency(contextData.lead.budget_max)}. Score: ${contextData.lead.lead_score ?? "N/A"}. Origem: ${contextData.lead.source}. Último contato: ${fmtDate(contextData.lead.last_contact_at)}. Interações recentes: ${contextData.interactions.length}. ${contextData.lead.notes ? `Obs: ${contextData.lead.notes}` : ""}`
    : `Negócio: ${contextData.deal.properties?.title || "Sem imóvel"}. Tipo: ${contextData.deal.deal_type}. Status: ${contextData.deal.status}. Valor proposto: ${fmtCurrency(contextData.deal.proposed_value || contextData.deal.proposed_monthly_value)}. Pagamento: ${contextData.deal.payment_terms || "N/I"}. Garantia: ${contextData.deal.guarantee_type || "N/I"}. Partes: ${contextData.parties.map((p: any) => `${p.people?.name || "?"} (${p.role})`).join(", ")}`;

  const userPrompt = `Corretor: ${ctx.brokerName}
Contexto: ${contextSummary}
${scenario ? `Cenário específico: ${scenario}` : "Gere 3 scripts para cenários diferentes (primeiro contato, follow-up, fechamento)."}
Gere scripts de abordagem contextualizados, naturais e profissionais.`;

  const aiResult = await callAI(systemPrompt, userPrompt);
  let result: any;
  let modelUsed = "gemini-2.0-flash";

  if (aiResult) {
    try { result = JSON.parse(aiResult); } catch { result = null; }
  }

  if (!result) {
    modelUsed = "rule_engine_v1";
    result = generateFallbackScripts(entity_type, contextData);
  }

  await saveSuggestion(ctx, "suggest_script", entity_type, entity_id, entityName, result, modelUsed);
  return { ...result, model_used: modelUsed };
}

function generateFallbackScripts(entityType: string, data: any) {
  const name = entityType === "lead" ? data.lead.name : (data.deal?.properties?.title || "Cliente");
  return {
    scripts: [
      {
        title: "Primeiro Contato",
        scenario: "Abordagem inicial",
        opening: `Olá ${name}, tudo bem? Sou ${name} da Intentus Real Estate.`,
        body: "Notei seu interesse em imóveis na nossa região. Gostaria de entender melhor o que você busca para poder ajudar da melhor forma. Qual o tipo de imóvel ideal para você?",
        closing: "Posso agendar uma conversa rápida de 15 minutos para entendermos suas necessidades?",
        tips: ["Seja cordial e direto", "Demonstre conhecimento da região", "Não pressione no primeiro contato"],
        tone: "consultivo",
      },
      {
        title: "Follow-up",
        scenario: "Retomada de contato",
        opening: `${name}, espero que esteja bem!`,
        body: "Estou entrando em contato para dar continuidade à nossa conversa. Surgiram algumas oportunidades que podem ser do seu interesse. Preparei uma seleção personalizada baseada no que conversamos.",
        closing: "Tem disponibilidade esta semana para visitarmos alguns imóveis?",
        tips: ["Referencie a conversa anterior", "Traga novidades concretas", "Ofereça algo de valor"],
        tone: "casual",
      },
      {
        title: "Fechamento",
        scenario: "Condução ao fechamento",
        opening: `${name}, que bom conversar novamente!`,
        body: "Depois de analisarmos todas as opções, acredito que encontramos a melhor alternativa. Vamos revisar os pontos principais e alinhar os próximos passos para garantir as melhores condições?",
        closing: "Podemos agendar a assinatura para esta semana? Quanto antes fecharmos, melhores condições garantimos.",
        tips: ["Crie senso de urgência sutil", "Reforce os benefícios", "Facilite o próximo passo"],
        tone: "formal",
      },
    ],
    general_tips: [
      "Personalize sempre — use o nome do cliente",
      "Escute mais do que fale nos primeiros contatos",
      "Mantenha registro de todas as interações",
    ],
    objection_handlers: [
      { objection: "Está muito caro", response: "Entendo sua preocupação com o valor. Vamos analisar o custo-benefício considerando localização, valorização e condições de pagamento." },
      { objection: "Preciso pensar", response: "Claro, é uma decisão importante. Que tal eu preparar um comparativo para facilitar sua análise? Posso enviar até amanhã." },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
// ACTION 2: generate_proposal — Gerar proposta comercial
// ═══════════════════════════════════════════════════════════════
async function handleGenerateProposal(ctx: AuthCtx, body: any) {
  const { deal_id } = body;
  if (!deal_id) throw new Error("deal_id required");

  const dealCtx = await fetchDealContext(ctx, deal_id);
  if (!dealCtx) throw new Error("Deal not found");
  const { deal, parties } = dealCtx;

  const systemPrompt = `Você é um especialista em propostas comerciais imobiliárias no Brasil.
Gere uma proposta profissional e completa. Sempre em português brasileiro.
Responda em JSON:
{
  "proposal_title": "Título da proposta",
  "executive_summary": "Resumo executivo (2-3 frases)",
  "property_description": "Descrição do imóvel e localização",
  "financial_terms": {
    "value": "Valor formatado",
    "payment_conditions": "Condições de pagamento",
    "guarantee": "Tipo de garantia",
    "duration": "Prazo",
    "adjustments": "Reajuste (se locação)"
  },
  "parties_involved": [{ "name": "Nome", "role": "Papel", "responsibilities": "Responsabilidades" }],
  "benefits": ["Benefício 1", "Benefício 2"],
  "next_steps": ["Passo 1", "Passo 2"],
  "validity": "Validade da proposta",
  "additional_notes": "Observações adicionais"
}`;

  const prop = deal.properties as any;
  const userPrompt = `Gere uma proposta comercial para:
Imóvel: ${prop?.title || "N/I"} — ${prop?.address_street || ""}, ${prop?.address_neighborhood || ""}, ${prop?.address_city || ""}
Tipo: ${deal.deal_type === "locacao" ? "Locação" : deal.deal_type === "venda" ? "Venda" : "Administração"}
Valor: ${deal.deal_type === "locacao" ? `Mensal: ${fmtCurrency(deal.proposed_monthly_value)}` : fmtCurrency(deal.proposed_value)}
Duração: ${deal.proposed_duration_months ? `${deal.proposed_duration_months} meses` : "N/I"}
Pagamento: ${deal.payment_terms || "N/I"}
Garantia: ${deal.guarantee_type || "N/I"}
Comissão: ${deal.commission_percentage ? `${deal.commission_percentage}%` : "N/I"}
Partes: ${parties.map((p: any) => `${p.people?.name || "?"} (${p.role})`).join(", ") || "Não definidas"}
Notas: ${deal.commercial_notes || "Nenhuma"}
Corretor: ${ctx.brokerName}`;

  const aiResult = await callAI(systemPrompt, userPrompt);
  let result: any;
  let modelUsed = "gemini-2.0-flash";

  if (aiResult) {
    try { result = JSON.parse(aiResult); } catch { result = null; }
  }

  if (!result) {
    modelUsed = "rule_engine_v1";
    result = {
      proposal_title: `Proposta — ${prop?.title || "Imóvel"}`,
      executive_summary: `Proposta de ${deal.deal_type === "locacao" ? "locação" : "venda"} do imóvel ${prop?.title || ""} no valor de ${deal.deal_type === "locacao" ? fmtCurrency(deal.proposed_monthly_value) + "/mês" : fmtCurrency(deal.proposed_value)}.`,
      property_description: `${prop?.title || "Imóvel"}, localizado em ${prop?.address_street || ""}, ${prop?.address_neighborhood || ""}, ${prop?.address_city || ""}.`,
      financial_terms: {
        value: deal.deal_type === "locacao" ? fmtCurrency(deal.proposed_monthly_value) + "/mês" : fmtCurrency(deal.proposed_value),
        payment_conditions: deal.payment_terms || "A definir",
        guarantee: deal.guarantee_type || "A definir",
        duration: deal.proposed_duration_months ? `${deal.proposed_duration_months} meses` : "A definir",
        adjustments: deal.deal_type === "locacao" ? "Reajuste anual pelo IGPM/IPCA" : "N/A",
      },
      parties_involved: parties.map((p: any) => ({
        name: p.people?.name || "A definir",
        role: p.role,
        responsibilities: p.role === "proprietario" ? "Proprietário do imóvel" : p.role === "inquilino" ? "Locatário" : p.role,
      })),
      benefits: [
        "Imóvel em localização privilegiada",
        "Condições de pagamento flexíveis",
        "Acompanhamento profissional durante todo o processo",
      ],
      next_steps: [
        "Revisão e aprovação da proposta pelas partes",
        "Análise documental",
        "Elaboração e assinatura do contrato",
      ],
      validity: "15 dias a partir da emissão",
      additional_notes: deal.commercial_notes || "",
    };
  }

  const entityName = prop?.title || `Negócio ${deal_id.slice(0, 8)}`;
  await saveSuggestion(ctx, "generate_proposal", "deal", deal_id, entityName, result, modelUsed);
  return { ...result, model_used: modelUsed };
}

// ═══════════════════════════════════════════════════════════════
// ACTION 3: prepare_meeting — Brief pré-reunião
// ═══════════════════════════════════════════════════════════════
async function handlePrepareMeeting(ctx: AuthCtx, body: any) {
  const { entity_type, entity_id, meeting_type } = body;
  if (!entity_type || !entity_id) throw new Error("entity_type and entity_id required");

  let contextData: any = null;
  let entityName = "";

  if (entity_type === "lead") {
    contextData = await fetchLeadContext(ctx, entity_id);
    entityName = contextData?.lead?.name || "";
  } else if (entity_type === "deal") {
    contextData = await fetchDealContext(ctx, entity_id);
    entityName = contextData?.deal?.properties?.title || "";
  } else if (entity_type === "person") {
    contextData = await fetchPersonContext(ctx, entity_id);
    entityName = contextData?.person?.name || "";
  }
  if (!contextData) throw new Error(`${entity_type} not found`);

  const systemPrompt = `Você é um assistente de preparação de reuniões para corretores imobiliários no Brasil.
Crie um brief completo e prático para o corretor se preparar. Em português brasileiro.
Responda em JSON:
{
  "meeting_brief": {
    "title": "Título do brief",
    "client_summary": "Resumo do cliente (2-3 frases)",
    "key_interests": ["Interesse 1", "Interesse 2"],
    "history_summary": "Resumo do histórico de interações",
    "potential_objections": [{ "objection": "Objeção", "preparation": "Como se preparar" }],
    "talking_points": ["Ponto 1", "Ponto 2"],
    "questions_to_ask": ["Pergunta 1", "Pergunta 2"],
    "documents_to_prepare": ["Documento 1", "Documento 2"],
    "goals": ["Objetivo 1", "Objetivo 2"],
    "risk_factors": ["Risco 1"],
    "recommended_approach": "Abordagem recomendada (2-3 frases)"
  }
}`;

  let contextSummary = "";
  if (entity_type === "lead") {
    const l = contextData.lead;
    contextSummary = `Lead: ${l.name}. Status: ${l.status}. Score: ${l.lead_score ?? "N/A"}. Interesse: ${l.interest_type || "N/I"}. Região: ${l.preferred_region || "N/I"}. Orçamento: ${fmtCurrency(l.budget_min)}-${fmtCurrency(l.budget_max)}. Origem: ${l.source}. Último contato: ${fmtDate(l.last_contact_at)}. Interações: ${contextData.interactions.length}. ${contextData.interactions.slice(0, 3).map((i: any) => `[${i.interaction_type}: ${(i.notes || "").slice(0, 80)}]`).join(" ")}`;
  } else if (entity_type === "deal") {
    const d = contextData.deal;
    const prop = d.properties as any;
    contextSummary = `Negócio: ${prop?.title || "N/I"}. Tipo: ${d.deal_type}. Status: ${d.status}. Valor: ${fmtCurrency(d.proposed_value || d.proposed_monthly_value)}. Garantia: ${d.guarantee_type || "N/I"}. Partes: ${contextData.parties.map((p: any) => `${p.people?.name || "?"} (${p.role})`).join(", ")}. Histórico: ${contextData.history.length} mudanças.`;
  } else {
    const p = contextData.person;
    contextSummary = `Pessoa: ${p.name}. Tipo: ${p.person_type}. Cidade: ${p.address_city || "N/I"}. Bairro: ${p.address_neighborhood || "N/I"}. Deals: ${contextData.deals.length}. Interações: ${contextData.interactions.length}. Últimas: ${contextData.interactions.slice(0, 3).map((i: any) => `[${i.interaction_type}]`).join(" ")}`;
  }

  const userPrompt = `Prepare um brief para reunião do corretor ${ctx.brokerName}.
Tipo de reunião: ${meeting_type || "Geral"}
Contexto: ${contextSummary}`;

  const aiResult = await callAI(systemPrompt, userPrompt);
  let result: any;
  let modelUsed = "gemini-2.0-flash";

  if (aiResult) {
    try { result = JSON.parse(aiResult); } catch { result = null; }
  }

  if (!result) {
    modelUsed = "rule_engine_v1";
    result = {
      meeting_brief: {
        title: `Brief — ${entityName || entity_type}`,
        client_summary: `Cliente ${entityName} com interesse em imóveis na região.`,
        key_interests: entity_type === "lead" ? [contextData.lead.interest_type || "Não especificado", contextData.lead.preferred_region || "Região não definida"] : ["Acompanhamento do negócio"],
        history_summary: `${entity_type === "lead" ? contextData.interactions.length : entity_type === "deal" ? contextData.history.length : contextData.interactions.length} interações registradas no sistema.`,
        potential_objections: [
          { objection: "Preço acima do orçamento", preparation: "Prepare comparativos de mercado e opções de financiamento" },
          { objection: "Localização", preparation: "Liste os pontos positivos da região (transporte, comércio, escolas)" },
        ],
        talking_points: ["Entender necessidades atualizadas", "Apresentar opções compatíveis", "Discutir condições de pagamento"],
        questions_to_ask: ["O que mudou desde nosso último contato?", "Há algum prazo para a decisão?", "Quais são os critérios mais importantes?"],
        documents_to_prepare: ["Portfólio de imóveis compatíveis", "Tabela de preços atualizada", "Simulação de financiamento"],
        goals: ["Avançar no relacionamento", "Definir próximos passos concretos"],
        risk_factors: ["Cliente pode estar avaliando concorrentes"],
        recommended_approach: "Abordagem consultiva, focando em entender as necessidades antes de apresentar soluções. Demonstre conhecimento do mercado local.",
      },
    };
  }

  await saveSuggestion(ctx, "prepare_meeting", entity_type, entity_id, entityName, result, modelUsed);
  return { ...result, model_used: modelUsed };
}

// ═══════════════════════════════════════════════════════════════
// ACTION 4: analyze_profile — Análise de perfil do cliente
// ═══════════════════════════════════════════════════════════════
async function handleAnalyzeProfile(ctx: AuthCtx, body: any) {
  const { entity_type, entity_id } = body;
  if (!entity_type || !entity_id) throw new Error("entity_type and entity_id required");

  let contextData: any = null;
  let entityName = "";

  if (entity_type === "lead") {
    contextData = await fetchLeadContext(ctx, entity_id);
    entityName = contextData?.lead?.name || "";
  } else if (entity_type === "person") {
    contextData = await fetchPersonContext(ctx, entity_id);
    entityName = contextData?.person?.name || "";
  } else if (entity_type === "deal") {
    contextData = await fetchDealContext(ctx, entity_id);
    entityName = contextData?.deal?.properties?.title || "";
  }
  if (!contextData) throw new Error(`${entity_type} not found`);

  const systemPrompt = `Você é um analista de perfil de clientes para o mercado imobiliário brasileiro.
Analise o perfil do cliente e forneça insights acionáveis para o corretor. Em português brasileiro.
Responda em JSON:
{
  "profile_analysis": {
    "client_name": "Nome",
    "engagement_score": 0-100,
    "engagement_level": "alto|medio|baixo",
    "buyer_persona": "Tipo de comprador (ex: Investidor, Primeiro imóvel, Upgrade, etc.)",
    "communication_preference": "Preferência de comunicação inferida",
    "decision_stage": "Estágio de decisão (pesquisa|comparação|decisão|negociação)",
    "strengths": ["Ponto forte 1"],
    "risks": ["Risco 1"],
    "recommended_actions": [
      { "action": "Ação", "priority": "alta|media|baixa", "reason": "Motivo" }
    ],
    "ideal_properties": {
      "type": "Tipo ideal",
      "region": "Região ideal",
      "budget_range": "Faixa de orçamento",
      "key_features": ["Feature 1"]
    },
    "personality_insights": "Insights sobre perfil comportamental (1-2 frases)"
  }
}`;

  let contextSummary = "";
  if (entity_type === "lead") {
    const l = contextData.lead;
    const daysSinceCreation = Math.floor((Date.now() - new Date(l.created_at).getTime()) / 86400000);
    const daysSinceContact = l.last_contact_at ? Math.floor((Date.now() - new Date(l.last_contact_at).getTime()) / 86400000) : null;
    contextSummary = `Lead: ${l.name}. Email: ${l.email || "N/I"}. Tel: ${l.phone || "N/I"}. Status: ${l.status}. Score: ${l.lead_score ?? "N/A"}. Interesse: ${l.interest_type || "N/I"}. Região: ${l.preferred_region || "N/I"}. Orçamento: ${fmtCurrency(l.budget_min)}-${fmtCurrency(l.budget_max)}. Origem: ${l.source}. Criado há: ${daysSinceCreation} dias. Último contato: ${daysSinceContact != null ? `há ${daysSinceContact} dias` : "nunca"}. Total interações: ${contextData.interactions.length}. Notas: ${l.notes || "Nenhuma"}. Tipos interação: ${[...new Set(contextData.interactions.map((i: any) => i.interaction_type))].join(", ") || "Nenhuma"}`;
  } else if (entity_type === "person") {
    const p = contextData.person;
    contextSummary = `Pessoa: ${p.name}. Tipo: ${p.person_type}. Doc: ${p.document_number || "N/I"}. Cidade: ${p.address_city || "N/I"}. Bairro: ${p.address_neighborhood || "N/I"}. Deals: ${contextData.deals.length} (${contextData.deals.map((d: any) => `${d.role}: ${d.deal_requests?.deal_type} ${d.deal_requests?.status}`).join("; ")}). Interações: ${contextData.interactions.length}. Tipos: ${[...new Set(contextData.interactions.map((i: any) => i.interaction_type))].join(", ") || "Nenhuma"}`;
  } else {
    const d = contextData.deal;
    contextSummary = `Negócio: ${d.properties?.title || "N/I"}. Tipo: ${d.deal_type}. Status: ${d.status}. Valor: ${fmtCurrency(d.proposed_value || d.proposed_monthly_value)}. Partes: ${contextData.parties.map((p: any) => `${p.people?.name || "?"} (${p.role})`).join(", ")}`;
  }

  const userPrompt = `Analise o perfil do cliente para o corretor ${ctx.brokerName}:
${contextSummary}`;

  const aiResult = await callAI(systemPrompt, userPrompt);
  let result: any;
  let modelUsed = "gemini-2.0-flash";

  if (aiResult) {
    try { result = JSON.parse(aiResult); } catch { result = null; }
  }

  if (!result) {
    modelUsed = "rule_engine_v1";
    const interactionCount = entity_type === "lead" ? contextData.interactions.length : entity_type === "person" ? contextData.interactions.length : 0;
    const engagementScore = Math.min(100, interactionCount * 15 + 20);
    result = {
      profile_analysis: {
        client_name: entityName,
        engagement_score: engagementScore,
        engagement_level: engagementScore >= 70 ? "alto" : engagementScore >= 40 ? "medio" : "baixo",
        buyer_persona: "A definir — necessita mais interações",
        communication_preference: "Inferido: WhatsApp/Telefone",
        decision_stage: interactionCount >= 5 ? "negociação" : interactionCount >= 3 ? "comparação" : interactionCount >= 1 ? "pesquisa" : "pesquisa",
        strengths: ["Cliente ativo no sistema", "Dados de contato disponíveis"],
        risks: interactionCount === 0 ? ["Sem interações registradas — risco de perder interesse"] : ["Monitorar frequência de contato"],
        recommended_actions: [
          { action: "Agendar contato proativo", priority: "alta", reason: "Manter o engajamento do cliente" },
          { action: "Preparar seleção de imóveis compatíveis", priority: "media", reason: "Demonstrar proatividade" },
        ],
        ideal_properties: {
          type: entity_type === "lead" ? (contextData.lead.interest_type || "A definir") : "A definir",
          region: entity_type === "lead" ? (contextData.lead.preferred_region || "A definir") : "A definir",
          budget_range: entity_type === "lead" ? `${fmtCurrency(contextData.lead.budget_min)} - ${fmtCurrency(contextData.lead.budget_max)}` : "A definir",
          key_features: ["Necessita levantamento com o cliente"],
        },
        personality_insights: "Perfil ainda em construção. Recomenda-se mais interações para traçar um perfil comportamental preciso.",
      },
    };
  }

  await saveSuggestion(ctx, "analyze_profile", entity_type, entity_id, entityName, result, modelUsed);
  return { ...result, model_used: modelUsed };
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  try {
    const ctx = await resolveAuth(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "suggest_script";

    let result: any;
    switch (action) {
      case "suggest_script":
        result = await handleSuggestScript(ctx, body);
        break;
      case "generate_proposal":
        result = await handleGenerateProposal(ctx, body);
        break;
      case "prepare_meeting":
        result = await handlePrepareMeeting(ctx, body);
        break;
      case "analyze_profile":
        result = await handleAnalyzeProfile(ctx, body);
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...headers, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Handler error:", e);
    const status = e.message === "Unauthorized" ? 401 : e.message?.includes("not found") ? 404 : 500;
    return new Response(
      JSON.stringify({ error: status === 500 ? "Erro interno do servidor" : e.message }),
      { status, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});
