/**
 * relationship-churn-interceptor — v1
 * F8: Churn Interceptor — Salvamento Automático
 *
 * 5 modes:
 *   - evaluate: Given prediction_id, match protocols & recommend actions
 *   - execute: Execute a specific action step (AI-generate message + log)
 *   - auto_scan: Scan all active high-risk predictions, auto-trigger protocols
 *   - create_offer: AI-generate a retention offer with ROI analysis
 *   - update_outcome: Record outcome of an interceptor action
 *
 * Squad: Claudinho (Claude) + Buchecha (MiniMax M2.7)
 * Created: 2026-03-21
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolvePersona, callGemini, logInteraction } from "../_shared/resolve-persona.ts";

// ── CORS whitelist ──────────────────────────────────────────
const PROD_ORIGINS = ["https://intentus-plataform.vercel.app", "https://app.intentusrealestate.com.br"];
const DEV_PATTERNS = [/^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/];
const PREVIEW_RE = /^https:\/\/intentus-plataform-.+\.vercel\.app$/;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const extra = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map(s => s.trim()).filter(Boolean);
  if (PROD_ORIGINS.includes(origin) || extra.includes(origin)) return true;
  if (PREVIEW_RE.test(origin)) return true;
  return DEV_PATTERNS.some(p => p.test(origin));
}

function buildCorsHeaders(req: Request) {
  const origin = req.headers.get("origin");
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin! : PROD_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

// ── Protocol Level Thresholds ───────────────────────────────
const DEFAULT_PROTOCOL_THRESHOLDS = {
  critical: { min_score: 80, risk_levels: ["critical"] },
  red: { min_score: 70, risk_levels: ["critical", "high"] },
  orange: { min_score: 60, risk_levels: ["high"] },
  yellow: { min_score: 40, risk_levels: ["high", "medium"] },
  green: { min_score: 0, risk_levels: ["medium", "low"] },
};

// ── AI Tool Declaration ─────────────────────────────────────
const INTERCEPTOR_TOOL = [
  {
    functionDeclarations: [
      {
        name: "retention_action_result",
        description: "Structured retention action output with personalized message and strategy",
        parameters: {
          type: "OBJECT",
          properties: {
            personalized_message: {
              type: "STRING",
              description: "Mensagem personalizada para o cliente, pronta para envio no canal especificado",
            },
            message_subject: {
              type: "STRING",
              description: "Assunto do email (se canal for email), ou título curto para WhatsApp/SMS",
            },
            tone_used: {
              type: "STRING",
              description: "Tom utilizado: empático, consultivo, urgente, conciliador, proativo",
            },
            cs_script: {
              type: "STRING",
              description: "Script completo para o CS usar em ligação ou conversa presencial",
            },
            talking_points: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Pontos-chave para abordar na conversa",
            },
            objection_handlers: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  objection: { type: "STRING", description: "Possível objeção do cliente" },
                  response: { type: "STRING", description: "Resposta recomendada" },
                },
                required: ["objection", "response"],
              },
              description: "Respostas para possíveis objeções",
            },
            risk_assessment: {
              type: "STRING",
              description: "Avaliação do risco e probabilidade de sucesso da abordagem",
            },
          },
          required: ["personalized_message", "message_subject", "tone_used", "cs_script"],
        },
      },
    ],
  },
];

const OFFER_TOOL = [
  {
    functionDeclarations: [
      {
        name: "retention_offer_result",
        description: "Structured retention offer with ROI analysis",
        parameters: {
          type: "OBJECT",
          properties: {
            offer_type: {
              type: "STRING",
              description: "discount / upgrade / gift / flexibility / maintenance_free / rent_freeze / custom",
            },
            offer_detail: {
              type: "OBJECT",
              properties: {
                description: { type: "STRING", description: "Descrição da oferta para o cliente" },
                internal_description: { type: "STRING", description: "Descrição interna para gestão" },
                discount_pct: { type: "NUMBER", description: "Percentual de desconto (se aplicável)" },
                duration_months: { type: "INTEGER", description: "Duração da oferta em meses" },
                conditions: { type: "STRING", description: "Condições para a oferta (ex: renovação mínima)" },
                value_brl: { type: "NUMBER", description: "Valor em R$ da oferta" },
              },
              required: ["description", "internal_description"],
            },
            justification: {
              type: "STRING",
              description: "Justificativa de negócio para a oferta",
            },
            roi_analysis: {
              type: "OBJECT",
              properties: {
                monthly_cost: { type: "NUMBER", description: "Custo mensal da oferta em R$" },
                total_cost: { type: "NUMBER", description: "Custo total da oferta em R$" },
                monthly_revenue_retained: { type: "NUMBER", description: "Receita mensal retida em R$" },
                ltv_retained: { type: "NUMBER", description: "LTV retido estimado em R$" },
                roi_pct: { type: "NUMBER", description: "ROI percentual da oferta" },
                payback_months: { type: "NUMBER", description: "Meses para recuperar investimento" },
              },
              required: ["monthly_cost", "total_cost", "monthly_revenue_retained", "ltv_retained", "roi_pct"],
            },
            success_probability: {
              type: "INTEGER",
              description: "0-100 probabilidade de o cliente aceitar a oferta",
            },
            alternative_offers: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  type: { type: "STRING" },
                  description: { type: "STRING" },
                  estimated_success: { type: "INTEGER" },
                },
                required: ["type", "description", "estimated_success"],
              },
              description: "Ofertas alternativas caso a principal seja recusada",
            },
          },
          required: ["offer_type", "offer_detail", "justification", "roi_analysis", "success_probability"],
        },
      },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────

async function getPredictionWithContext(serviceSupabase: any, predictionId: string) {
  const { data: prediction } = await serviceSupabase
    .from("churn_predictions")
    .select(`
      *,
      people(id, name, email, phone),
      contracts(id, monthly_value, start_date, end_date, status, contract_type,
        properties(street, neighborhood, city)
      )
    `)
    .eq("id", predictionId)
    .maybeSingle();

  if (!prediction) throw new Error("Prediction not found");
  return prediction;
}

async function getRecentInteractions(serviceSupabase: any, tenantId: string, personId: string | null, contractId: string | null) {
  if (!personId && !contractId) return [];

  const filters = [];
  if (personId) filters.push(`person_id.eq.${personId}`);
  if (contractId) filters.push(`contract_id.eq.${contractId}`);

  const { data: tickets = [] } = await serviceSupabase
    .from("support_tickets")
    .select("id, title, status, priority, created_at")
    .eq("tenant_id", tenantId)
    .or(filters.join(","))
    .order("created_at", { ascending: false })
    .limit(5);

  return tickets;
}

async function checkCooldown(serviceSupabase: any, protocolId: string, contractId: string, cooldownHours: number): Promise<boolean> {
  const cutoff = new Date(Date.now() - cooldownHours * 60 * 60 * 1000).toISOString();

  const { data: recentActions = [] } = await serviceSupabase
    .from("churn_interceptor_actions")
    .select("id")
    .eq("protocol_id", protocolId)
    .eq("contract_id", contractId)
    .gte("created_at", cutoff)
    .limit(1);

  return recentActions.length === 0; // true = can proceed (no recent actions)
}

async function matchProtocols(serviceSupabase: any, tenantId: string, prediction: any) {
  const { data: protocols = [] } = await serviceSupabase
    .from("churn_interceptor_protocols")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("priority", { ascending: false });

  const matched = [];

  for (const protocol of protocols) {
    const conditions = protocol.trigger_conditions || {};
    const minScore = conditions.min_score ?? 0;
    const maxScore = conditions.max_score ?? 100;
    const riskLevels = conditions.risk_levels || [];
    const signalPatterns = conditions.signal_patterns || [];

    // Score match
    if (prediction.score < minScore || prediction.score > maxScore) continue;

    // Risk level match
    if (riskLevels.length > 0 && !riskLevels.includes(prediction.risk_level)) continue;

    // Signal patterns match (at least one must exist in top_reasons)
    if (signalPatterns.length > 0) {
      const reasonCategories = (prediction.top_reasons || []).map((r: any) => r.category);
      const hasMatch = signalPatterns.some((p: string) => reasonCategories.includes(p));
      if (!hasMatch) continue;
    }

    // Cooldown check
    const canProceed = await checkCooldown(
      serviceSupabase,
      protocol.id,
      prediction.contract_id,
      protocol.cooldown_hours,
    );
    if (!canProceed) continue;

    matched.push(protocol);
  }

  return matched;
}

// ── Mode: Evaluate ──────────────────────────────────────────

async function handleEvaluate(serviceSupabase: any, tenantId: string, body: any) {
  const { predictionId } = body;
  if (!predictionId) throw new Error("predictionId is required");

  const prediction = await getPredictionWithContext(serviceSupabase, predictionId);
  const protocols = await matchProtocols(serviceSupabase, tenantId, prediction);

  return {
    prediction_id: predictionId,
    score: prediction.score,
    risk_level: prediction.risk_level,
    person_name: prediction.people?.name,
    contract_value: prediction.contracts?.monthly_value,
    matched_protocols: protocols.map((p: any) => ({
      id: p.id,
      name: p.name,
      level: p.protocol_level,
      action_count: (p.action_sequence || []).length,
      auto_execute: p.auto_execute,
      requires_approval: p.requires_approval,
      success_rate: p.success_rate,
    })),
    recommended_action: protocols.length > 0
      ? `${protocols.length} protocolo(s) correspondente(s). ${protocols[0].auto_execute ? "Execução automática disponível." : "Aprovação necessária."}`
      : "Nenhum protocolo correspondente. Considere criar um protocolo para este nível de risco.",
  };
}

// ── Mode: Execute ───────────────────────────────────────────

async function handleExecute(serviceSupabase: any, tenantId: string, userId: string, body: any) {
  const { predictionId, protocolId, stepNumber = 1, channel = "email" } = body;
  if (!predictionId) throw new Error("predictionId is required");

  const prediction = await getPredictionWithContext(serviceSupabase, predictionId);
  const recentInteractions = await getRecentInteractions(serviceSupabase, tenantId, prediction.person_id, prediction.contract_id);

  // Get protocol if provided
  let protocol = null;
  let actionStep = null;
  if (protocolId) {
    const { data } = await serviceSupabase
      .from("churn_interceptor_protocols")
      .select("*")
      .eq("id", protocolId)
      .maybeSingle();
    protocol = data;

    if (protocol?.action_sequence) {
      actionStep = protocol.action_sequence.find((s: any) => s.step === stepNumber);
    }
  }

  const actionType = actionStep?.type || channel;
  const persona = await resolvePersona("churn_interceptor", tenantId);

  const prompt = `Crie uma ação de retenção personalizada para este cliente em risco de churn.

DADOS DO CLIENTE:
- Nome: ${prediction.people?.name || "N/A"}
- Email: ${prediction.people?.email || "N/A"}
- Telefone: ${prediction.people?.phone || "N/A"}

DADOS DO CONTRATO:
- Imóvel: ${(prediction.contracts?.properties as any)?.street || "N/A"}, ${(prediction.contracts?.properties as any)?.neighborhood || ""}, ${(prediction.contracts?.properties as any)?.city || ""}
- Valor mensal: R$ ${(prediction.contracts?.monthly_value || 0).toLocaleString("pt-BR")}
- Status: ${prediction.contracts?.status || "N/A"}
- Início: ${prediction.contracts?.start_date || "N/A"}
- Fim: ${prediction.contracts?.end_date || "N/A"}

ANÁLISE DE CHURN:
- Score: ${prediction.score}/100 (${prediction.risk_level})
- Razões principais: ${JSON.stringify(prediction.top_reasons?.slice(0, 3) || [])}
- Ações recomendadas pelo preditor: ${JSON.stringify(prediction.recommended_actions?.slice(0, 3) || [])}
- Probabilidade de retenção: ${prediction.signals_summary?.retention_probability || "N/A"}%

INTERAÇÕES RECENTES:
${recentInteractions.map((t: any) => `- [${t.created_at}] ${t.title} (${t.status}, ${t.priority})`).join("\n") || "Nenhuma interação recente"}

CANAL DE COMUNICAÇÃO: ${actionType}
${protocol ? `PROTOCOLO: ${protocol.name} (Nível ${protocol.protocol_level})` : "Sem protocolo definido — use seu melhor julgamento"}
${protocol?.ai_context_instructions ? `INSTRUÇÕES ADICIONAIS: ${protocol.ai_context_instructions}` : ""}
TOM DESEJADO: ${protocol?.ai_tone || "empático e proativo"}

Gere a mensagem personalizada e o script para CS usando a ferramenta retention_action_result.`;

  const toolConfig = {
    functionCallingConfig: {
      mode: "ANY",
      allowedFunctionNames: ["retention_action_result"],
    },
  };

  const aiResponse = await callGemini({
    persona,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: INTERCEPTOR_TOOL,
    toolConfig,
  });

  if (!aiResponse.ok) throw new Error(`AI error: ${aiResponse.status}`);

  const aiData = await aiResponse.json();
  const candidate = aiData.candidates?.[0]?.content?.parts?.[0];
  let result: any;

  if (candidate?.functionCall) {
    result = candidate.functionCall.args;
  } else if (candidate?.text) {
    try { result = JSON.parse(candidate.text); } catch {
      result = {
        personalized_message: candidate.text,
        message_subject: "Mensagem de retenção",
        tone_used: "empático",
        cs_script: candidate.text,
      };
    }
  } else {
    throw new Error("No valid AI response");
  }

  // Save action
  const actionRow = {
    tenant_id: tenantId,
    prediction_id: predictionId,
    protocol_id: protocolId || null,
    person_id: prediction.person_id,
    contract_id: prediction.contract_id,
    step_number: stepNumber,
    action_type: actionType,
    action_detail: {
      channel: actionType,
      protocol_level: protocol?.protocol_level || null,
      talking_points: result.talking_points || [],
      objection_handlers: result.objection_handlers || [],
      risk_assessment: result.risk_assessment || null,
    },
    ai_message: result.personalized_message,
    ai_subject: result.message_subject,
    ai_tone_used: result.tone_used,
    ai_personalization_data: {
      person_name: prediction.people?.name,
      property: (prediction.contracts?.properties as any)?.street,
      churn_reasons: prediction.top_reasons?.slice(0, 3),
    },
    status: protocol?.requires_approval !== false ? "pending" : "approved",
    churn_score_at_action: prediction.score,
    risk_level_at_action: prediction.risk_level,
    scheduled_at: actionStep?.delay_hours
      ? new Date(Date.now() + actionStep.delay_hours * 60 * 60 * 1000).toISOString()
      : null,
  };

  const { data: action, error: actionError } = await serviceSupabase
    .from("churn_interceptor_actions")
    .insert(actionRow)
    .select()
    .single();

  if (actionError) console.error("Failed to save action:", actionError);

  // Update protocol stats
  if (protocolId) {
    await serviceSupabase.rpc("increment_field", {
      table_name: "churn_interceptor_protocols",
      field_name: "times_triggered",
      row_id: protocolId,
    }).catch(() => {
      // Fallback: manual increment
      serviceSupabase
        .from("churn_interceptor_protocols")
        .update({ times_triggered: (protocol?.times_triggered || 0) + 1 })
        .eq("id", protocolId)
        .then(() => {});
    });
  }

  return {
    action_id: action?.id,
    status: actionRow.status,
    message: result.personalized_message,
    subject: result.message_subject,
    tone: result.tone_used,
    cs_script: result.cs_script,
    talking_points: result.talking_points || [],
    objection_handlers: result.objection_handlers || [],
    risk_assessment: result.risk_assessment,
    scheduled_at: actionRow.scheduled_at,
  };
}

// ── Mode: Auto Scan ─────────────────────────────────────────

async function handleAutoScan(serviceSupabase: any, tenantId: string, userId: string) {
  // Find all active high-risk predictions that don't have recent interceptor actions
  const { data: predictions = [] } = await serviceSupabase
    .from("churn_predictions")
    .select(`
      id, score, risk_level, person_id, contract_id, top_reasons, recommended_actions, signals_summary,
      people(name, email),
      contracts(monthly_value, end_date, status)
    `)
    .eq("tenant_id", tenantId)
    .in("risk_level", ["critical", "high"])
    .gte("score", 60)
    .order("score", { ascending: false })
    .limit(50);

  const results = [];

  for (const prediction of predictions) {
    // Check if there are recent interceptor actions for this contract
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentActions = [] } = await serviceSupabase
      .from("churn_interceptor_actions")
      .select("id, status, outcome")
      .eq("contract_id", prediction.contract_id)
      .gte("created_at", thirtyDaysAgo)
      .not("status", "in", '("cancelled","failed")')
      .limit(1);

    if (recentActions.length > 0) {
      results.push({
        prediction_id: prediction.id,
        person_name: prediction.people?.name,
        score: prediction.score,
        status: "skipped",
        reason: "Ação recente já existe",
      });
      continue;
    }

    // Match protocols
    const protocols = await matchProtocols(serviceSupabase, tenantId, prediction);

    if (protocols.length === 0) {
      results.push({
        prediction_id: prediction.id,
        person_name: prediction.people?.name,
        score: prediction.score,
        status: "no_protocol",
        reason: "Nenhum protocolo correspondente",
      });
      continue;
    }

    // Use highest priority protocol
    const bestProtocol = protocols[0];

    if (bestProtocol.auto_execute) {
      // Auto-execute first step
      try {
        const actionResult = await handleExecute(serviceSupabase, tenantId, userId, {
          predictionId: prediction.id,
          protocolId: bestProtocol.id,
          stepNumber: 1,
          channel: (bestProtocol.action_sequence?.[0] as any)?.type || "email",
        });

        results.push({
          prediction_id: prediction.id,
          person_name: prediction.people?.name,
          score: prediction.score,
          status: "auto_executed",
          protocol_name: bestProtocol.name,
          action_id: actionResult.action_id,
        });
      } catch (err) {
        results.push({
          prediction_id: prediction.id,
          person_name: prediction.people?.name,
          score: prediction.score,
          status: "error",
          reason: (err as Error).message,
        });
      }
    } else {
      results.push({
        prediction_id: prediction.id,
        person_name: prediction.people?.name,
        score: prediction.score,
        status: "needs_approval",
        protocol_name: bestProtocol.name,
        protocol_id: bestProtocol.id,
      });
    }
  }

  return {
    scanned: predictions.length,
    auto_executed: results.filter(r => r.status === "auto_executed").length,
    needs_approval: results.filter(r => r.status === "needs_approval").length,
    skipped: results.filter(r => r.status === "skipped").length,
    no_protocol: results.filter(r => r.status === "no_protocol").length,
    errors: results.filter(r => r.status === "error").length,
    details: results,
  };
}

// ── Mode: Create Offer ──────────────────────────────────────

async function handleCreateOffer(serviceSupabase: any, tenantId: string, userId: string, body: any) {
  const { predictionId, maxBudget, preferredType } = body;
  if (!predictionId) throw new Error("predictionId is required");

  const prediction = await getPredictionWithContext(serviceSupabase, predictionId);
  const persona = await resolvePersona("churn_interceptor", tenantId);

  const monthlyValue = prediction.contracts?.monthly_value || 0;
  const contractMonths = prediction.contracts?.end_date
    ? Math.max(1, Math.ceil((new Date(prediction.contracts.end_date).getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000)))
    : 12;

  const prompt = `Crie uma oferta de retenção inteligente para este cliente em risco de churn.

DADOS DO CLIENTE:
- Nome: ${prediction.people?.name || "N/A"}
- Contrato: R$ ${monthlyValue.toLocaleString("pt-BR")}/mês
- Imóvel: ${(prediction.contracts?.properties as any)?.street || "N/A"}, ${(prediction.contracts?.properties as any)?.city || ""}
- Meses restantes: ${contractMonths}
- LTV estimado: R$ ${(monthlyValue * contractMonths).toLocaleString("pt-BR")}

ANÁLISE DE CHURN:
- Score: ${prediction.score}/100 (${prediction.risk_level})
- Razões: ${JSON.stringify(prediction.top_reasons?.slice(0, 3) || [])}

RESTRIÇÕES:
- Orçamento máximo: ${maxBudget ? `R$ ${maxBudget.toLocaleString("pt-BR")}` : "A definir"}
- Tipo preferido: ${preferredType || "qualquer — escolha o mais adequado"}
- O ROI deve ser positivo (custo da oferta < receita retida)

Considere o contexto do mercado imobiliário brasileiro e gere a oferta usando a ferramenta retention_offer_result.`;

  const toolConfig = {
    functionCallingConfig: {
      mode: "ANY",
      allowedFunctionNames: ["retention_offer_result"],
    },
  };

  const aiResponse = await callGemini({
    persona,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: OFFER_TOOL,
    toolConfig,
  });

  if (!aiResponse.ok) throw new Error(`AI error: ${aiResponse.status}`);

  const aiData = await aiResponse.json();
  const candidate = aiData.candidates?.[0]?.content?.parts?.[0];
  let result: any;

  if (candidate?.functionCall) {
    result = candidate.functionCall.args;
  } else if (candidate?.text) {
    try { result = JSON.parse(candidate.text); } catch {
      throw new Error("AI returned invalid offer structure");
    }
  } else {
    throw new Error("No valid AI response");
  }

  // Save offer
  const offerRow = {
    tenant_id: tenantId,
    prediction_id: predictionId,
    person_id: prediction.person_id,
    contract_id: prediction.contract_id,
    offer_type: result.offer_type,
    offer_detail: result.offer_detail || {},
    ai_justification: result.justification,
    ai_estimated_roi: result.roi_analysis || {},
    offer_value: result.roi_analysis?.total_cost || null,
    max_budget: maxBudget || null,
    status: "proposed",
    proposed_by: userId,
    valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };

  const { data: offer, error: offerError } = await serviceSupabase
    .from("churn_retention_offers")
    .insert(offerRow)
    .select()
    .single();

  if (offerError) console.error("Failed to save offer:", offerError);

  return {
    offer_id: offer?.id,
    offer_type: result.offer_type,
    offer_detail: result.offer_detail,
    justification: result.justification,
    roi_analysis: result.roi_analysis,
    success_probability: result.success_probability,
    alternative_offers: result.alternative_offers || [],
    valid_until: offerRow.valid_until,
  };
}

// ── Mode: Update Outcome ────────────────────────────────────

async function handleUpdateOutcome(serviceSupabase: any, tenantId: string, userId: string, body: any) {
  const { actionId, outcome, outcomeNotes, offerId, offerStatus, clientResponse, retentionMonths } = body;

  const results: any = {};

  if (actionId && outcome) {
    const { error } = await serviceSupabase
      .from("churn_interceptor_actions")
      .update({
        outcome,
        outcome_notes: outcomeNotes || null,
        outcome_recorded_by: userId,
        outcome_recorded_at: new Date().toISOString(),
      })
      .eq("id", actionId)
      .eq("tenant_id", tenantId);

    if (error) throw error;
    results.action_updated = true;

    // Update protocol success stats if retained
    if (outcome === "retained") {
      const { data: action } = await serviceSupabase
        .from("churn_interceptor_actions")
        .select("protocol_id")
        .eq("id", actionId)
        .maybeSingle();

      if (action?.protocol_id) {
        const { data: protocol } = await serviceSupabase
          .from("churn_interceptor_protocols")
          .select("times_triggered, times_succeeded")
          .eq("id", action.protocol_id)
          .maybeSingle();

        if (protocol) {
          const newSucceeded = (protocol.times_succeeded || 0) + 1;
          const newRate = protocol.times_triggered > 0
            ? Math.round((newSucceeded / protocol.times_triggered) * 10000) / 100
            : 0;

          await serviceSupabase
            .from("churn_interceptor_protocols")
            .update({
              times_succeeded: newSucceeded,
              success_rate: newRate,
            })
            .eq("id", action.protocol_id);
        }
      }
    }
  }

  if (offerId && offerStatus) {
    const updateData: any = { status: offerStatus };
    if (clientResponse) updateData.client_response = clientResponse;
    if (offerStatus === "accepted") {
      updateData.retention_confirmed = true;
      updateData.retention_months = retentionMonths || null;
      updateData.responded_at = new Date().toISOString();
    } else if (offerStatus === "declined") {
      updateData.retention_confirmed = false;
      updateData.responded_at = new Date().toISOString();
    } else if (offerStatus === "approved") {
      updateData.approved_by = userId;
      updateData.approved_at = new Date().toISOString();
    } else if (offerStatus === "sent") {
      updateData.sent_at = new Date().toISOString();
    }

    const { error } = await serviceSupabase
      .from("churn_retention_offers")
      .update(updateData)
      .eq("id", offerId)
      .eq("tenant_id", tenantId);

    if (error) throw error;
    results.offer_updated = true;
  }

  return results;
}

// ── Main Handler ────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await serviceSupabase
      .from("profiles")
      .select("id, tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "Profile/tenant not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = profile.tenant_id;
    const body = await req.json();
    const { mode } = body;

    let result: any;

    switch (mode) {
      case "evaluate":
        result = await handleEvaluate(serviceSupabase, tenantId, body);
        break;
      case "execute":
        result = await handleExecute(serviceSupabase, tenantId, profile.id, body);
        break;
      case "auto_scan":
        result = await handleAutoScan(serviceSupabase, tenantId, profile.id);
        break;
      case "create_offer":
        result = await handleCreateOffer(serviceSupabase, tenantId, profile.id, body);
        break;
      case "update_outcome":
        result = await handleUpdateOutcome(serviceSupabase, tenantId, profile.id, body);
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Invalid mode. Use: evaluate, execute, auto_scan, create_offer, update_outcome" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    // Log interaction
    logInteraction({
      tenantId,
      userId: user.id,
      functionKey: "churn_interceptor",
      inputSummary: `Interceptor mode=${mode}`,
      outputSummary: `Result keys: ${Object.keys(result || {}).join(", ")}`,
      responseTimeMs: Date.now() - startTime,
    }).catch(() => {});

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("relationship-churn-interceptor error:", e);

    if ((e as any)?.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit atingido. Tente novamente em instantes." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: (e as Error).message || "Erro interno no interceptor de churn" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
