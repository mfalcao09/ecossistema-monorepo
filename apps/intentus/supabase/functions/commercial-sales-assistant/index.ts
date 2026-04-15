import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

interface CORSHeaders {
  "Access-Control-Allow-Origin": string;
  "Access-Control-Allow-Methods": string;
  "Access-Control-Allow-Headers": string;
}

interface AuthContext {
  userId: string;
  tenantId: string;
  userEmail: string;
  userName: string;
}

interface GenerateScriptParams {
  deal_id: string;
  lead_id?: string;
}

interface PrepareVisitParams {
  deal_id: string;
  property_id?: string;
  lead_id?: string;
  visit_date?: string;
}

interface GenerateProposalParams {
  deal_id: string;
  include_pricing: boolean;
}

interface HandleObjectionParams {
  objection_text: string;
  deal_id?: string;
  context?: string;
}

interface SalesScript {
  opening: string;
  discovery_questions: string[];
  value_proposition: string;
  objection_handlers: Array<{
    objection: string;
    response: string;
  }>;
  closing_technique: string;
  key_facts: string[];
}

interface VisitPrep {
  checklist: string[];
  talking_points: string[];
  comparables_pitch: string;
  client_specific_notes: string;
  follow_up_plan: string;
}

interface CommercialProposal {
  proposal_title: string;
  executive_summary: string;
  property_description: string;
  pricing_justification: string;
  payment_conditions: string;
  differentials: string;
  next_steps: string;
  validity_period: string;
}

interface ObjectionResponse {
  objection_category: string;
  empathy_response: string;
  counter_arguments: string[];
  reframe_technique: string;
  success_probability: number;
}

interface BrokerInsights {
  total_active_deals: number;
  deals_needing_attention: number;
  estimated_closing_probability: number;
  revenue_forecast: number;
  recommended_priorities: string[];
  summary: string;
  model_used: string;
}

function getCORSHeaders(): CORSHeaders {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, content-type",
  };
}

function getOriginWhitelist(): string[] {
  const isDev =
    Deno.env.get("DENO_ENV") === "development" ||
    !Deno.env.get("DENO_ENV");

  const whitelist = [
    "https://app.intentusrealestate.com.br",
    "https://intentus-plataform.vercel.app",
  ];

  if (isDev) {
    whitelist.push("http://localhost:5173", "http://127.0.0.1:5173");
  }

  // Add preview deploys pattern
  const previewPattern = /https:\/\/intentus-plataform-[a-zA-Z0-9\-]+\.vercel\.app/;
  return whitelist.map((origin) => origin).concat([
    "PATTERN:" + previewPattern.toString(),
  ]);
}

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  const whitelist = getOriginWhitelist();

  for (const allowed of whitelist) {
    if (allowed.startsWith("PATTERN:")) {
      const pattern = allowed.replace("PATTERN:", "");
      try {
        const regex = new RegExp(
          pattern.slice(1, pattern.lastIndexOf("/")) +
            pattern.slice(pattern.lastIndexOf("/") + 1)
        );
        if (regex.test(origin)) return true;
      } catch {
        // Invalid regex
      }
    } else if (origin === allowed) {
      return true;
    }
  }
  return false;
}

async function resolveAuth(req: Request): Promise<AuthContext | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY || "",
      },
    });

    if (!response.ok) return null;
    const user = await response.json();

    // Resolve profile to get tenant_id and user name
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${user.id}&select=id,tenant_id,full_name`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY || "",
          authorization: `Bearer ${token}`,
        },
      }
    );

    if (!profileRes.ok) return null;
    const profiles = await profileRes.json();

    if (!profiles || profiles.length === 0) return null;

    const profile = profiles[0];
    return {
      userId: user.id,
      tenantId: profile.tenant_id,
      userEmail: user.email,
      userName: profile.full_name || user.email,
    };
  } catch {
    return null;
  }
}

async function callOpenRouter(
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  if (!OPENROUTER_API_KEY) return null;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://app.intentusrealestate.com.br",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        response_format: { type: "json_object" },
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      console.error("OpenRouter error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error("OpenRouter call failed:", error);
    return null;
  }
}

async function generateScript(
  authCtx: AuthContext,
  params: GenerateScriptParams,
  token: string
): Promise<SalesScript | { error: string }> {
  try {
    // Fetch deal + lead + property + interactions
    const dealRes = await fetch(
      `${SUPABASE_URL}/rest/v1/deal_requests?id=eq.${params.deal_id}&tenant_id=eq.${authCtx.tenantId}&select=*`,
      {
        headers: { apikey: SUPABASE_ANON_KEY || "", authorization: `Bearer ${token}` },
      }
    );

    if (!dealRes.ok) return { error: "Deal not found" };
    const deals = await dealRes.json();
    if (!deals || deals.length === 0) return { error: "Deal not found" };
    const deal = deals[0];

    let leadData = null;
    if (deal.lead_id) {
      const leadRes = await fetch(
        `${SUPABASE_URL}/rest/v1/leads?id=eq.${deal.lead_id}&tenant_id=eq.${authCtx.tenantId}&select=*`,
        {
          headers: { apikey: SUPABASE_ANON_KEY || "", authorization: `Bearer ${token}` },
        }
      );
      if (leadRes.ok) {
        const leads = await leadRes.json();
        if (leads && leads.length > 0) leadData = leads[0];
      }
    }

    let propertyData = null;
    if (deal.property_id) {
      const propRes = await fetch(
        `${SUPABASE_URL}/rest/v1/properties?id=eq.${deal.property_id}&tenant_id=eq.${authCtx.tenantId}&select=*,limit=1`,
        {
          headers: { apikey: SUPABASE_ANON_KEY || "", authorization: `Bearer ${token}` },
        }
      );
      if (propRes.ok) {
        const props = await propRes.json();
        if (props && props.length > 0) propertyData = props[0];
      }
    }

    // Build context for AI
    const dealType = deal.deal_type || "venda";
    const propertyType = propertyData?.property_type || "imóvel";
    const budget = leadData?.budget_min ? `R$ ${leadData.budget_min} - R$ ${leadData.budget_max}` : "não definido";
    const leadInterest = leadData?.interest_type || "não especificado";

    const systemPrompt = `Você é um especialista em vendas imobiliárias no mercado brasileiro. Gere scripts de vendas contextualizados, persuasivos mas éticos, adaptados para o mercado imobiliário. O script deve ser profissional, confiante e focado em resultados.`;

    const userPrompt = `Gere um script de vendas para o seguinte contexto:
- Tipo de negócio: ${dealType}
- Tipo de imóvel: ${propertyType}
- Interesse do cliente: ${leadInterest}
- Orçamento: ${budget}
- Estágio atual: ${deal.stage_name || "inicial"}

Retorne um JSON com a seguinte estrutura:
{
  "opening": "Saudação personalizada e abertura (2-3 linhas)",
  "discovery_questions": ["pergunta 1", "pergunta 2", ...],
  "value_proposition": "Proposição de valor tailorizada (3-4 linhas)",
  "objection_handlers": [{"objection": "objeção comum", "response": "resposta"}, ...],
  "closing_technique": "Técnica de fechamento apropriada (2-3 linhas)",
  "key_facts": ["fato importante 1", "fato importante 2", ...]
}`;

    const content = await callOpenRouter(systemPrompt, userPrompt);
    if (!content) {
      // Fallback rule-based script
      return {
        opening: `Olá! Tudo bem? Meu nome é ${authCtx.userName}. Tenho uma ${propertyType} ${dealType === "locacao" ? "para aluguel" : "à venda"} que acredito ser perfeita para seu perfil.`,
        discovery_questions: [
          "Qual é sua prioridade principal nesta busca?",
          `Qual é seu orçamento para este ${dealType}?`,
          "Quais são os critérios mais importantes para você?",
          "Quando você precisa finalizar este negócio?",
          "Já visitou imóveis similares?",
        ],
        value_proposition: `Este ${propertyType} oferece ${dealType === "locacao" ? "aluguel" : "preço"} competitivo, localização estratégica e características únicas que se alinham com suas necessidades.`,
        objection_handlers: [
          {
            objection: "O preço está muito alto",
            response:
              "Entendo sua preocupação. Este imóvel oferece valor agregado que justifica o investimento. Posso mostrar comparáveis no mercado.",
          },
          {
            objection: "Preciso pensar a respeito",
            response:
              "Totalmente compreensível. Vou deixar os documentos com você. Quando podemos conversar novamente?",
          },
          {
            objection: "Tenho outras opções",
            response:
              "Ótimo! Vamos comparar. Este imóvel tem diferenciais que talvez as outras não tenham.",
          },
        ],
        closing_technique:
          "Resumir os principais benefícios, confirmar interesse e agendar próximos passos.",
        key_facts: [
          `Localização em ${propertyData?.address || "área privilegiada"}`,
          `${propertyData?.bedrooms || "N"} quartos, ${propertyData?.bathrooms || "N"} banheiros`,
          "Documentação completa e regularizada",
        ],
      };
    }

    return JSON.parse(content);
  } catch (error) {
    console.error("Generate script error:", error);
    return { error: String(error) };
  }
}

async function prepareVisit(
  authCtx: AuthContext,
  params: PrepareVisitParams,
  token: string
): Promise<VisitPrep | { error: string }> {
  try {
    const dealRes = await fetch(
      `${SUPABASE_URL}/rest/v1/deal_requests?id=eq.${params.deal_id}&tenant_id=eq.${authCtx.tenantId}&select=*`,
      {
        headers: { apikey: SUPABASE_ANON_KEY || "", authorization: `Bearer ${token}` },
      }
    );

    if (!dealRes.ok) return { error: "Deal not found" };
    const deals = await dealRes.json();
    if (!deals || deals.length === 0) return { error: "Deal not found" };
    const deal = deals[0];

    // Get property details
    let propertyData = null;
    if (deal.property_id) {
      const propRes = await fetch(
        `${SUPABASE_URL}/rest/v1/properties?id=eq.${deal.property_id}&tenant_id=eq.${authCtx.tenantId}&select=*`,
        {
          headers: { apikey: SUPABASE_ANON_KEY || "", authorization: `Bearer ${token}` },
        }
      );
      if (propRes.ok) {
        const props = await propRes.json();
        if (props && props.length > 0) propertyData = props[0];
      }
    }

    // Rule-based fallback (simple but effective)
    return {
      checklist: [
        "Confirmar local e horário com cliente",
        "Preparar documentos e contatos",
        "Fotografar imóvel em boa iluminação",
        "Limpar e organizar antes da visita",
        "Ter medidas e especificações à mão",
        "Preparar propostas iniciais",
        "Revisar histórico de interações",
      ],
      talking_points: [
        `Localização estratégica em ${propertyData?.address || "área nobre"}`,
        `${propertyData?.bedrooms || "múltiplos"} dormitórios bem distribuídos`,
        "Infraestrutura completa e acessibilidade",
        "Potencial de valorização",
        "Oportunidade de negócio competitiva",
      ],
      comparables_pitch:
        "Este imóvel oferece melhor custo-benefício comparado aos similares no mercado.",
      client_specific_notes:
        "Foco em benefícios alinhados com preferências expressadas pelo cliente.",
      follow_up_plan:
        "Agendar próxima visita em 48h, enviar propostas revisadas, esclarecer dúvidas pendentes.",
    };
  } catch (error) {
    console.error("Prepare visit error:", error);
    return { error: String(error) };
  }
}

async function generateProposal(
  authCtx: AuthContext,
  params: GenerateProposalParams,
  token: string
): Promise<CommercialProposal | { error: string }> {
  try {
    const dealRes = await fetch(
      `${SUPABASE_URL}/rest/v1/deal_requests?id=eq.${params.deal_id}&tenant_id=eq.${authCtx.tenantId}&select=*`,
      {
        headers: { apikey: SUPABASE_ANON_KEY || "", authorization: `Bearer ${token}` },
      }
    );

    if (!dealRes.ok) return { error: "Deal not found" };
    const deals = await dealRes.json();
    if (!deals || deals.length === 0) return { error: "Deal not found" };
    const deal = deals[0];

    // Get property
    let propertyData = null;
    if (deal.property_id) {
      const propRes = await fetch(
        `${SUPABASE_URL}/rest/v1/properties?id=eq.${deal.property_id}&tenant_id=eq.${authCtx.tenantId}&select=*`,
        {
          headers: { apikey: SUPABASE_ANON_KEY || "", authorization: `Bearer ${token}` },
        }
      );
      if (propRes.ok) {
        const props = await propRes.json();
        if (props && props.length > 0) propertyData = props[0];
      }
    }

    return {
      proposal_title: `Proposta Comercial - ${propertyData?.address || "Imóvel"}`,
      executive_summary: `Apresentamos oportunidade de ${deal.deal_type} para imóvel qualificado com excelentes características.`,
      property_description: `${propertyData?.address || "Imóvel"} com ${propertyData?.bedrooms || "N"} dormitórios, ${propertyData?.bathrooms || "N"} banheiros e área de ${propertyData?.area_built || "N"} m².`,
      pricing_justification: `Preço baseado em análise comparativa de mercado, condições atuais e especificidades do imóvel.`,
      payment_conditions:
        "Condições de pagamento a serem definidas conforme legislação aplicável e acordado entre as partes.",
      differentials: `Localização privilegiada, documentação completa, infraestrutura moderna e potencial de valorização.`,
      next_steps: `1. Revisão desta proposta\n2. Agendamento de vistoria\n3. Negociação de termos finais\n4. Elaboração de contrato`,
      validity_period: "Esta proposta é válida por 15 dias corridos.",
    };
  } catch (error) {
    console.error("Generate proposal error:", error);
    return { error: String(error) };
  }
}

async function handleObjection(
  params: HandleObjectionParams
): Promise<ObjectionResponse> {
  // Classify objection
  const text = params.objection_text.toLowerCase();
  let category = "outro";

  if (
    text.includes("preco") ||
    text.includes("caro") ||
    text.includes("valor")
  ) {
    category = "preco";
  } else if (
    text.includes("localizacao") ||
    text.includes("local") ||
    text.includes("bairro")
  ) {
    category = "localizacao";
  } else if (
    text.includes("tempo") ||
    text.includes("rapido") ||
    text.includes("urgencia")
  ) {
    category = "tempo";
  } else if (
    text.includes("concorrente") ||
    text.includes("outra") ||
    text.includes("competidor")
  ) {
    category = "competicao";
  } else if (
    text.includes("confianca") ||
    text.includes("garantia") ||
    text.includes("risco")
  ) {
    category = "confianca";
  }

  // Rule-based responses by category
  const responses: Record<string, Partial<ObjectionResponse>> = {
    preco: {
      empathy_response:
        "Entendo perfeitamente sua preocupação com o preço. Vamos analisar o valor agregado juntos.",
      counter_arguments: [
        "Este imóvel oferece melhor custo-benefício comparado aos similares no mercado",
        "Análise comparativa mostra que o preço está compatível com a região e características",
        "Investimento inicial se recupera com valorização ao longo do tempo",
      ],
      reframe_technique:
        "Mudar foco de 'preço alto' para 'investimento estratégico'",
      success_probability: 0.65,
    },
    localizacao: {
      empathy_response:
        "Localização é realmente importante. Deixa eu mostrar os benefícios desta área.",
      counter_arguments: [
        "Localização estratégica próxima a principais vias e infraestrutura",
        "Região com previsão de crescimento e desenvolvimento",
        "Acesso fácil a comércios, serviços e escolas",
      ],
      reframe_technique:
        "Enfatizar vantagens da região e potencial futuro",
      success_probability: 0.58,
    },
    tempo: {
      empathy_response:
        "Tempo é essencial. Vamos focar em agilizar esse processo para você.",
      counter_arguments: [
        "Documentação já está pronta e regularizada para acelerar",
        "Posso coordenar a vistoria ainda esta semana",
        "Processo competitivo exige decisão rápida para não perder oportunidade",
      ],
      reframe_technique: "Criar senso de urgência positiva",
      success_probability: 0.72,
    },
    competicao: {
      empathy_response:
        "É normal avaliar outras opções. Deixa eu mostrar nossos diferenciais.",
      counter_arguments: [
        "Este imóvel tem características únicas não encontradas nas alternativas",
        "Nossa expertise garante melhor processo de negociação",
        "Comparável direto mostra vantagem desta proposta",
      ],
      reframe_technique:
        "Posicionar como opção superior com argumentos concretos",
      success_probability: 0.6,
    },
    confianca: {
      empathy_response:
        "Confiança é fundamental. Posso compartilhar referências e documentações.",
      counter_arguments: [
        "Histórico comprovado de transações bem-sucedidas",
        "Documentação completa e transparente disponível",
        "Garantias e proteções jurídicas para ambas as partes",
      ],
      reframe_technique:
        "Prover evidências tangíveis de credibilidade",
      success_probability: 0.68,
    },
  };

  const baseResponse = responses[category] || responses["outro"];

  return {
    objection_category: category,
    empathy_response:
      baseResponse.empathy_response ||
      "Entendo sua preocupação. Vamos resolver isso juntos.",
    counter_arguments: baseResponse.counter_arguments || [
      "Este imóvel oferece excelente oportunidade no mercado atual",
      "Características especiais justificam o investimento",
      "Timing é estratégico para este tipo de negócio",
    ],
    reframe_technique:
      baseResponse.reframe_technique ||
      "Focar em benefícios e oportunidades do negócio",
    success_probability: baseResponse.success_probability || 0.6,
  };
}

async function getBrokerInsights(
  authCtx: AuthContext,
  token: string
): Promise<BrokerInsights | { error: string }> {
  try {
    const dealsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/deal_requests?assigned_to=eq.${authCtx.userId}&tenant_id=eq.${authCtx.tenantId}&select=*&limit=500`,
      {
        headers: { apikey: SUPABASE_ANON_KEY || "", authorization: `Bearer ${token}` },
      }
    );

    if (!dealsRes.ok) return { error: "Could not fetch deals" };
    const deals = await dealsRes.json();

    // Compute metrics
    const activeDeals = deals.filter(
      (d: any) => !["concluido", "cancelado"].includes(d.stage_name)
    );
    const dealsNeeding = activeDeals.filter((d: any) =>
      ["rascunho", "analise"].includes(d.stage_name)
    ).length;

    // Rough probability based on stage
    const totalProbability = activeDeals.reduce((sum: number, d: any) => {
      const stageProbabilities: Record<string, number> = {
        rascunho: 0.2,
        analise: 0.4,
        proposta_enviada: 0.6,
        em_negociacao: 0.75,
        aprovacao_pendente: 0.85,
        assinatura: 0.95,
      };
      return sum + (stageProbabilities[d.stage_name] || 0.5);
    }, 0);
    const avgProbability =
      activeDeals.length > 0 ? totalProbability / activeDeals.length : 0;

    // Rough revenue forecast
    const revenueForecast = activeDeals.reduce(
      (sum: number, d: any) => sum + (d.proposed_value || 0),
      0
    );

    return {
      total_active_deals: activeDeals.length,
      deals_needing_attention: dealsNeeding,
      estimated_closing_probability: Math.round(avgProbability * 100) / 100,
      revenue_forecast: revenueForecast,
      recommended_priorities: [
        dealsNeeding > 0 ? `Focar em ${dealsNeeding} negócio(s) em análise` : "",
        avgProbability < 0.5 ? "Acelerar negócios em fase inicial" : "",
        revenueForecast > 0 ? "Manter pipeline aquecido" : "",
      ].filter((x) => x),
      summary: `Você tem ${activeDeals.length} negócio(s) ativo(s) com probabilidade média de ${Math.round(avgProbability * 100)}% de fechamento.`,
      model_used: "rule_engine_v1",
    };
  } catch (error) {
    console.error("Get insights error:", error);
    return { error: String(error) };
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCORSHeaders();

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  // Auth
  const authCtx = await resolveAuth(req);
  if (!authCtx) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();
    const { action, ...params } = body;
    const token = req.headers.get("authorization")?.slice(7) || "";

    let result;

    switch (action) {
      case "generate_script":
        result = await generateScript(
          authCtx,
          params as GenerateScriptParams,
          token
        );
        break;
      case "prepare_visit":
        result = await prepareVisit(
          authCtx,
          params as PrepareVisitParams,
          token
        );
        break;
      case "generate_proposal":
        result = await generateProposal(
          authCtx,
          params as GenerateProposalParams,
          token
        );
        break;
      case "handle_objection":
        result = await handleObjection(params as HandleObjectionParams);
        break;
      case "get_insights":
        result = await getBrokerInsights(authCtx, token);
        break;
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: corsHeaders,
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Handler error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(error) }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
