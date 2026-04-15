/**
 * clm-compliance-monitor — Auto-Compliance Monitoring
 * F2 Item #1 — Sessão 58
 *
 * 5 módulos: Prazos, Garantias, Obrigações, Documentação, Financeiro
 * 18 regras BR imobiliárias (Lei 8.245/91, Código Civil, CDC)
 * 3 actions: scan_all (cron), scan_contract (on-demand), get_dashboard
 * IA corretiva via Gemini 2.0 Flash (OpenRouter)
 * Self-contained (inline CORS/auth/RBAC)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ── CORS ────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS_RAW = Deno.env.get("ALLOWED_ORIGINS") ?? "";
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_RAW.split(",").map((s) => s.trim()).filter(Boolean);
const DEV_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const PREVIEW_PATTERN = /^https:\/\/intentus-plataform-.+\.vercel\.app$/;

const PROD_ORIGINS = ["https://intentus-plataform.vercel.app", "https://app.intentusrealestate.com.br"];

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (PROD_ORIGINS.includes(origin)) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (DEV_PATTERN.test(origin)) return true;
  if (PREVIEW_PATTERN.test(origin)) return true;
  return false;
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = isOriginAllowed(origin) ? origin : PROD_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// ── RBAC ────────────────────────────────────────────────────────────────
const ALLOWED_ROLES = ["superadmin", "admin", "gerente", "juridico", "financeiro"];

// ── Types ───────────────────────────────────────────────────────────────
interface RuleResult {
  rule_code: string;
  rule_name: string;
  module: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  status: "pass" | "fail" | "warning" | "not_applicable";
  description: string;
  legal_basis?: string;
  remediation?: string;
}

interface ContractData {
  id: string;
  tenant_id: string;
  status: string;
  contract_type: string;
  start_date: string | null;
  end_date: string | null;
  monthly_value: number | null;
  total_value: number | null;
  adjustment_index: string | null;
  guarantee_type: string | null;
  guarantee_value: number | null;
  notes: string | null;
  property_id: string | null;
  created_at: string;
  contract_parties?: any[];
  contract_obligations?: any[];
  contract_installments?: any[];
  contract_documents?: any[];
}

// ── Compliance Rules (5 modules, 18 rules) ──────────────────────────────

function checkPrazos(c: ContractData): RuleResult[] {
  const results: RuleResult[] = [];
  const isLocacao = ["locacao", "administracao"].includes(c.contract_type);

  // PZ-01: Prazo de vigência explícito
  results.push({
    rule_code: "PZ-01",
    rule_name: "Prazo de vigência definido",
    module: "prazos",
    severity: "critical",
    status: c.start_date && c.end_date ? "pass" : "fail",
    description: c.start_date && c.end_date
      ? "Contrato possui datas de início e fim definidas"
      : "Contrato sem prazo de vigência explícito — obrigatório por lei",
    legal_basis: "Código Civil Art. 421, Lei 8.245/91 Art. 3",
    remediation: "Definir datas de início e término no contrato",
  });

  // PZ-02: Contrato vencido sem renovação
  if (c.end_date && c.status === "ativo") {
    const endDate = new Date(c.end_date);
    const now = new Date();
    const isExpired = endDate < now;
    results.push({
      rule_code: "PZ-02",
      rule_name: "Contrato dentro da vigência",
      module: "prazos",
      severity: "high",
      status: isExpired ? "fail" : "pass",
      description: isExpired
        ? `Contrato vencido em ${endDate.toLocaleDateString("pt-BR")} mas ainda com status "ativo"`
        : "Contrato dentro do período de vigência",
      legal_basis: "Lei 8.245/91 Art. 46-47",
      remediation: "Renovar o contrato ou alterar status para 'expirado'",
    });
  }

  // PZ-03: Contrato próximo do vencimento (30 dias)
  if (c.end_date && c.status === "ativo") {
    const endDate = new Date(c.end_date);
    const now = new Date();
    const daysToExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysToExpiry > 0 && daysToExpiry <= 30) {
      results.push({
        rule_code: "PZ-03",
        rule_name: "Alerta de vencimento próximo",
        module: "prazos",
        severity: "medium",
        status: "warning",
        description: `Contrato vence em ${daysToExpiry} dias (${endDate.toLocaleDateString("pt-BR")})`,
        legal_basis: "Lei 8.245/91 Art. 46",
        remediation: "Iniciar processo de renovação ou notificar partes sobre término",
      });
    }
  }

  // PZ-04: Cláusula de reajuste em locações > 12 meses
  if (isLocacao && c.start_date && c.end_date) {
    const months = Math.ceil((new Date(c.end_date).getTime() - new Date(c.start_date).getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (months > 12) {
      results.push({
        rule_code: "PZ-04",
        rule_name: "Índice de reajuste definido",
        module: "prazos",
        severity: "high",
        status: c.adjustment_index ? "pass" : "fail",
        description: c.adjustment_index
          ? `Índice de reajuste definido: ${c.adjustment_index}`
          : "Locação > 12 meses sem índice de reajuste — obrigatório",
        legal_basis: "Lei 8.245/91 Art. 18, Lei 10.192/2001",
        remediation: "Definir índice de reajuste (IGPM, IPCA, INPC) no contrato",
      });
    }
  }

  return results;
}

function checkGarantias(c: ContractData): RuleResult[] {
  const results: RuleResult[] = [];
  const isLocacao = ["locacao", "administracao"].includes(c.contract_type);

  if (!isLocacao) {
    results.push({
      rule_code: "GA-01",
      rule_name: "Garantia locatícia",
      module: "garantias",
      severity: "high",
      status: "not_applicable",
      description: "Verificação de garantia não aplicável para contratos de venda",
    });
    return results;
  }

  // GA-01: Garantia definida em locações
  results.push({
    rule_code: "GA-01",
    rule_name: "Garantia locatícia definida",
    module: "garantias",
    severity: "high",
    status: c.guarantee_type ? "pass" : "fail",
    description: c.guarantee_type
      ? `Garantia definida: ${c.guarantee_type}`
      : "Contrato de locação sem garantia locatícia definida",
    legal_basis: "Lei 8.245/91 Art. 37",
    remediation: "Definir tipo de garantia: caução, fiança, seguro fiança ou cessão fiduciária",
  });

  // GA-02: Valor da garantia
  if (c.guarantee_type && c.guarantee_type !== "fianca") {
    const hasValue = c.guarantee_value && c.guarantee_value > 0;
    results.push({
      rule_code: "GA-02",
      rule_name: "Valor da garantia registrado",
      module: "garantias",
      severity: "medium",
      status: hasValue ? "pass" : "warning",
      description: hasValue
        ? `Valor da garantia: R$ ${c.guarantee_value!.toLocaleString("pt-BR")}`
        : "Garantia sem valor registrado no sistema",
      legal_basis: "Lei 8.245/91 Art. 38",
      remediation: "Registrar valor da garantia no contrato",
    });
  }

  // GA-03: Caução limitada a 3 meses de aluguel
  if (c.guarantee_type === "caucao" && c.guarantee_value && c.monthly_value) {
    const maxCaucao = c.monthly_value * 3;
    const exceeds = c.guarantee_value > maxCaucao;
    results.push({
      rule_code: "GA-03",
      rule_name: "Caução dentro do limite legal",
      module: "garantias",
      severity: "critical",
      status: exceeds ? "fail" : "pass",
      description: exceeds
        ? `Caução R$ ${c.guarantee_value.toLocaleString("pt-BR")} excede limite legal de 3x aluguel (R$ ${maxCaucao.toLocaleString("pt-BR")})`
        : "Valor de caução dentro do limite de 3 aluguéis",
      legal_basis: "Lei 8.245/91 Art. 38 §2",
      remediation: `Reduzir caução para no máximo R$ ${maxCaucao.toLocaleString("pt-BR")} (3x aluguel mensal)`,
    });
  }

  return results;
}

function checkObrigacoes(c: ContractData): RuleResult[] {
  const results: RuleResult[] = [];
  const obligations = c.contract_obligations ?? [];

  // OB-01: Obrigações cadastradas
  results.push({
    rule_code: "OB-01",
    rule_name: "Obrigações contratuais registradas",
    module: "obrigacoes",
    severity: "medium",
    status: obligations.length > 0 ? "pass" : "warning",
    description: obligations.length > 0
      ? `${obligations.length} obrigação(ões) registrada(s)`
      : "Nenhuma obrigação contratual registrada — recomendado cadastrar para monitoramento",
    remediation: "Cadastrar obrigações do contrato (prazos, entregas, manutenções)",
  });

  // OB-02: Obrigações vencidas sem resolução
  const overdue = obligations.filter((o: any) => {
    if (o.status === "completed" || o.status === "cancelled") return false;
    if (!o.due_date) return false;
    return new Date(o.due_date) < new Date();
  });

  if (overdue.length > 0) {
    results.push({
      rule_code: "OB-02",
      rule_name: "Obrigações em dia",
      module: "obrigacoes",
      severity: "high",
      status: "fail",
      description: `${overdue.length} obrigação(ões) vencida(s) sem resolução`,
      remediation: "Verificar e resolver obrigações vencidas ou marcar como concluídas",
    });
  } else if (obligations.length > 0) {
    results.push({
      rule_code: "OB-02",
      rule_name: "Obrigações em dia",
      module: "obrigacoes",
      severity: "high",
      status: "pass",
      description: "Todas as obrigações estão dentro do prazo",
    });
  }

  // OB-03: Obrigações próximas do vencimento (7 dias)
  const upcoming = obligations.filter((o: any) => {
    if (o.status === "completed" || o.status === "cancelled") return false;
    if (!o.due_date) return false;
    const days = Math.ceil((new Date(o.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days > 0 && days <= 7;
  });

  if (upcoming.length > 0) {
    results.push({
      rule_code: "OB-03",
      rule_name: "Obrigações com vencimento próximo",
      module: "obrigacoes",
      severity: "medium",
      status: "warning",
      description: `${upcoming.length} obrigação(ões) vencem nos próximos 7 dias`,
      remediation: "Priorizar resolução das obrigações próximas do vencimento",
    });
  }

  return results;
}

function checkDocumentacao(c: ContractData): RuleResult[] {
  const results: RuleResult[] = [];
  const parties = c.contract_parties ?? [];

  // DC-01: Partes identificadas
  results.push({
    rule_code: "DC-01",
    rule_name: "Partes contratantes identificadas",
    module: "documentacao",
    severity: "critical",
    status: parties.length >= 2 ? "pass" : "fail",
    description: parties.length >= 2
      ? `${parties.length} parte(s) registrada(s) no contrato`
      : "Contrato deve ter ao menos 2 partes identificadas (locador/locatário ou vendedor/comprador)",
    legal_basis: "Código Civil Art. 104, Lei 8.245/91",
    remediation: "Cadastrar todas as partes contratantes com qualificação completa",
  });

  // DC-02: Qualificação das partes (CPF/CNPJ)
  const partiesWithDoc = parties.filter((p: any) => p.people?.cpf_cnpj);
  if (parties.length > 0) {
    results.push({
      rule_code: "DC-02",
      rule_name: "Qualificação completa das partes",
      module: "documentacao",
      severity: "high",
      status: partiesWithDoc.length === parties.length ? "pass" : "fail",
      description: partiesWithDoc.length === parties.length
        ? "Todas as partes possuem CPF/CNPJ registrado"
        : `${parties.length - partiesWithDoc.length} parte(s) sem CPF/CNPJ registrado`,
      legal_basis: "Código Civil Art. 104",
      remediation: "Completar qualificação de todas as partes com CPF/CNPJ",
    });
  }

  // DC-03: Imóvel vinculado
  results.push({
    rule_code: "DC-03",
    rule_name: "Imóvel vinculado ao contrato",
    module: "documentacao",
    severity: "high",
    status: c.property_id ? "pass" : "fail",
    description: c.property_id
      ? "Contrato possui imóvel vinculado"
      : "Contrato sem imóvel vinculado — necessário para identificação do objeto",
    legal_basis: "Código Civil Art. 481, Lei 8.245/91 Art. 1",
    remediation: "Vincular o imóvel objeto do contrato",
  });

  // DC-04: Valor definido
  const hasValue = (c.monthly_value && c.monthly_value > 0) || (c.total_value && c.total_value > 0);
  results.push({
    rule_code: "DC-04",
    rule_name: "Valor contratual definido",
    module: "documentacao",
    severity: "critical",
    status: hasValue ? "pass" : "fail",
    description: hasValue
      ? "Valor contratual registrado"
      : "Contrato sem valor definido — elemento essencial",
    legal_basis: "Código Civil Art. 481-482, Lei 8.245/91 Art. 17",
    remediation: "Definir valor mensal (locação) ou total (venda) do contrato",
  });

  return results;
}

function checkFinanceiro(c: ContractData): RuleResult[] {
  const results: RuleResult[] = [];
  const installments = c.contract_installments ?? [];
  const isLocacao = ["locacao", "administracao"].includes(c.contract_type);

  if (installments.length === 0) {
    results.push({
      rule_code: "FN-01",
      rule_name: "Parcelas financeiras registradas",
      module: "financeiro",
      severity: "medium",
      status: "warning",
      description: "Nenhuma parcela financeira registrada — recomendado para controle de inadimplência",
      remediation: "Cadastrar parcelas/boletos para monitoramento financeiro",
    });
    return results;
  }

  // FN-01: Parcelas registradas
  results.push({
    rule_code: "FN-01",
    rule_name: "Parcelas financeiras registradas",
    module: "financeiro",
    severity: "medium",
    status: "pass",
    description: `${installments.length} parcela(s) registrada(s)`,
  });

  // FN-02: Parcelas em atraso
  const overdue = installments.filter((i: any) => {
    if (i.status === "paid" || i.status === "cancelled") return false;
    if (!i.due_date) return false;
    return new Date(i.due_date) < new Date();
  });

  results.push({
    rule_code: "FN-02",
    rule_name: "Adimplência financeira",
    module: "financeiro",
    severity: "critical",
    status: overdue.length > 0 ? "fail" : "pass",
    description: overdue.length > 0
      ? `${overdue.length} parcela(s) em atraso — risco de inadimplência`
      : "Todas as parcelas em dia",
    legal_basis: isLocacao ? "Lei 8.245/91 Art. 9 III (despejo por falta de pagamento)" : "Código Civil Art. 475",
    remediation: overdue.length > 0
      ? "Entrar em contato com devedor e iniciar processo de cobrança"
      : undefined,
  });

  // FN-03: Valor total de inadimplência
  if (overdue.length > 0) {
    const totalOverdue = overdue.reduce((sum: number, i: any) => sum + (i.amount || 0), 0);
    results.push({
      rule_code: "FN-03",
      rule_name: "Valor em atraso",
      module: "financeiro",
      severity: totalOverdue > (c.monthly_value ?? 0) * 3 ? "critical" : "high",
      status: "fail",
      description: `Valor total em atraso: R$ ${totalOverdue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      legal_basis: "Lei 8.245/91 Art. 62 I",
      remediation: "Iniciar notificação extrajudicial ou ação de cobrança/despejo",
    });
  }

  return results;
}

// ── Run all rules for one contract ──────────────────────────────────────
function runComplianceCheck(contract: ContractData): RuleResult[] {
  return [
    ...checkPrazos(contract),
    ...checkGarantias(contract),
    ...checkObrigacoes(contract),
    ...checkDocumentacao(contract),
    ...checkFinanceiro(contract),
  ];
}

function computeScore(results: RuleResult[]): number {
  const applicable = results.filter((r) => r.status !== "not_applicable");
  if (applicable.length === 0) return 100;

  const weights: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
  let maxWeight = 0;
  let deductions = 0;

  for (const r of applicable) {
    const w = weights[r.severity] ?? 1;
    maxWeight += w;
    if (r.status === "fail") deductions += w;
    else if (r.status === "warning") deductions += w * 0.3;
  }

  if (maxWeight === 0) return 100;
  return Math.max(0, Math.round(100 - (deductions / maxWeight) * 100));
}

// ── IA Corrective Actions ───────────────────────────────────────────────
async function generateCorrectiveActions(
  contract: ContractData,
  failures: RuleResult[],
): Promise<Array<{ priority: string; action: string; module: string; estimated_effort: string }>> {
  if (failures.length === 0) return [];

  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    // Fallback: return rule remediations as corrective actions
    return failures
      .filter((f) => f.remediation)
      .slice(0, 5)
      .map((f) => ({
        priority: f.severity === "critical" ? "alta" : f.severity === "high" ? "média" : "baixa",
        action: f.remediation!,
        module: f.module,
        estimated_effort: f.severity === "critical" ? "imediato" : "1-3 dias",
      }));
  }

  try {
    const failureSummary = failures.map((f) => `[${f.severity}] ${f.rule_name}: ${f.description}`).join("\n");

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Você é um especialista em compliance imobiliário brasileiro. Analise as violações de compliance e sugira ações corretivas priorizadas. Responda em JSON com: { "actions": [{ "priority": "alta|média|baixa", "action": "descrição da ação", "module": "módulo", "estimated_effort": "prazo estimado" }] }. Máximo 5 ações. Foco em Lei 8.245/91, Código Civil e práticas do mercado imobiliário brasileiro.`,
          },
          {
            role: "user",
            content: `Contrato tipo: ${contract.contract_type}, status: ${contract.status}\n\nViolações encontradas:\n${failureSummary}`,
          },
        ],
        max_tokens: 800,
        temperature: 0.3,
      }),
    });

    if (!resp.ok) throw new Error(`OpenRouter ${resp.status}`);
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    return parsed.actions ?? [];
  } catch (err) {
    console.error("AI corrective actions error:", err);
    // Fallback to rule-based
    return failures
      .filter((f) => f.remediation)
      .slice(0, 5)
      .map((f) => ({
        priority: f.severity === "critical" ? "alta" : f.severity === "high" ? "média" : "baixa",
        action: f.remediation!,
        module: f.module,
        estimated_effort: f.severity === "critical" ? "imediato" : "1-3 dias",
      }));
  }
}

// ── Persist results ─────────────────────────────────────────────────────
async function persistCheck(
  supabase: any,
  contractId: string,
  tenantId: string,
  results: RuleResult[],
  correctiveActions: any[],
  modelUsed: string,
) {
  const score = computeScore(results);
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const warnings = results.filter((r) => r.status === "warning").length;
  const na = results.filter((r) => r.status === "not_applicable").length;
  const modules = [...new Set(results.map((r) => r.module))];

  // Insert check
  const { data: check, error: checkErr } = await supabase
    .from("compliance_checks")
    .insert({
      contract_id: contractId,
      tenant_id: tenantId,
      overall_score: score,
      total_rules: results.length,
      passed,
      failed,
      warnings,
      not_applicable: na,
      modules_checked: modules,
      checked_by: "system",
      model_used: modelUsed,
      corrective_actions: correctiveActions,
    })
    .select("id")
    .single();

  if (checkErr) {
    console.error("Error persisting check:", checkErr);
    return null;
  }

  // Insert violations (only fails and warnings)
  const violations = results
    .filter((r) => r.status === "fail" || r.status === "warning")
    .map((r) => ({
      check_id: check.id,
      contract_id: contractId,
      tenant_id: tenantId,
      rule_code: r.rule_code,
      rule_name: r.rule_name,
      module: r.module,
      severity: r.severity,
      status: "open",
      description: r.description,
      legal_basis: r.legal_basis ?? null,
      remediation: r.remediation ?? null,
    }));

  if (violations.length > 0) {
    const { error: violErr } = await supabase.from("compliance_violations").insert(violations);
    if (violErr) console.error("Error persisting violations:", violErr);
  }

  return { checkId: check.id, score, passed, failed, warnings, na };
}

// ── Main Handler ────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let body: any = {};
    try { body = await req.json(); } catch { /* empty body OK for cron */ }

    const action = body.action ?? "scan_all";

    // Auth — service role for cron, user auth for on-demand
    let supabase: any;
    let tenantId: string | null = null;

    if (action === "scan_all") {
      // Cron job uses service role — no user auth
      supabase = createClient(supabaseUrl, supabaseKey);
    } else {
      // On-demand: require user auth
      const authHeader = req.headers.get("authorization") ?? "";
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
      }
      supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
      }

      // Resolve tenant
      const { data: profile } = await supabase.from("profiles").select("tenant_id, role").eq("user_id", user.id).maybeSingle();
      if (!profile?.tenant_id) {
        return new Response(JSON.stringify({ error: "Tenant not found" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
      }
      tenantId = profile.tenant_id;

      // RBAC check
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("tenant_id", tenantId);
      const userRoles = (roles ?? []).map((r: any) => r.role);
      if (!userRoles.some((r: string) => ALLOWED_ROLES.includes(r))) {
        // Fallback to profile role
        if (!ALLOWED_ROLES.includes(profile.role ?? "")) {
          return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
        }
      }
    }

    // ── Action: scan_all (cron) ─────────────────────────────────────
    if (action === "scan_all") {
      // Fetch all active contracts across all tenants
      const { data: contracts, error: fetchErr } = await supabase
        .from("contracts")
        .select("id, tenant_id, status, contract_type, start_date, end_date, monthly_value, total_value, adjustment_index, guarantee_type, guarantee_value, notes, property_id, created_at, contract_parties(id, role, people(name, cpf_cnpj)), contract_obligations(id, title, due_date, status), contract_installments(id, due_date, amount, status)")
        .in("status", ["ativo", "em_revisao", "em_aprovacao", "vigencia_pendente", "em_alteracao"]);

      if (fetchErr) throw fetchErr;

      const results: any[] = [];
      for (const contract of (contracts ?? [])) {
        const ruleResults = runComplianceCheck(contract);
        const failures = ruleResults.filter((r) => r.status === "fail");
        const correctiveActions = await generateCorrectiveActions(contract, failures);
        const persisted = await persistCheck(supabase, contract.id, contract.tenant_id, ruleResults, correctiveActions, failures.length > 0 ? "gemini-2.0-flash" : "rule_engine");

        if (persisted && persisted.failed > 0) {
          // Send notification for contracts with failures
          try {
            // Get users for this tenant
            const { data: users } = await supabase
              .from("profiles")
              .select("user_id")
              .eq("tenant_id", contract.tenant_id);

            for (const u of (users ?? [])) {
              await supabase.from("notifications").insert({
                user_id: u.user_id,
                title: `Compliance: ${persisted.failed} violação(ões) detectada(s)`,
                message: `Score ${persisted.score}/100 — ${failures.map((f) => f.rule_name).slice(0, 3).join(", ")}`,
                category: "alerta",
                reference_type: "contract",
                reference_id: contract.id,
                tenant_id: contract.tenant_id,
              });
            }
          } catch (notifErr) {
            console.error("Notification error:", notifErr);
          }
        }

        results.push({
          contract_id: contract.id,
          score: persisted?.score ?? computeScore(ruleResults),
          failed: persisted?.failed ?? 0,
          warnings: persisted?.warnings ?? 0,
        });
      }

      return new Response(JSON.stringify({
        action: "scan_all",
        contracts_scanned: results.length,
        results,
        timestamp: new Date().toISOString(),
      }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ── Action: scan_contract (on-demand) ───────────────────────────
    if (action === "scan_contract") {
      const contractId = body.contract_id;
      if (!contractId) {
        return new Response(JSON.stringify({ error: "contract_id required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const { data: contract, error: fetchErr } = await supabase
        .from("contracts")
        .select("id, tenant_id, status, contract_type, start_date, end_date, monthly_value, total_value, adjustment_index, guarantee_type, guarantee_value, notes, property_id, created_at, contract_parties(id, role, people(name, cpf_cnpj)), contract_obligations(id, title, due_date, status), contract_installments(id, due_date, amount, status), contract_documents(id, document_type, file_name)")
        .eq("id", contractId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (!contract) {
        return new Response(JSON.stringify({ error: "Contract not found" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const ruleResults = runComplianceCheck(contract);
      const failures = ruleResults.filter((r) => r.status === "fail");
      const correctiveActions = await generateCorrectiveActions(contract, failures);
      const persisted = await persistCheck(supabase, contract.id, tenantId!, ruleResults, correctiveActions, failures.length > 0 ? "gemini-2.0-flash" : "rule_engine");

      return new Response(JSON.stringify({
        action: "scan_contract",
        contract_id: contractId,
        score: computeScore(ruleResults),
        total_rules: ruleResults.length,
        passed: ruleResults.filter((r) => r.status === "pass").length,
        failed: failures.length,
        warnings: ruleResults.filter((r) => r.status === "warning").length,
        not_applicable: ruleResults.filter((r) => r.status === "not_applicable").length,
        rules: ruleResults,
        corrective_actions: correctiveActions,
        check_id: persisted?.checkId,
      }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ── Action: get_dashboard ───────────────────────────────────────
    if (action === "get_dashboard") {
      // Latest check per contract
      const { data: latestChecks } = await supabase
        .from("compliance_checks")
        .select("id, contract_id, overall_score, total_rules, passed, failed, warnings, not_applicable, modules_checked, corrective_actions, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      // Deduplicate — keep only latest per contract
      const byContract = new Map<string, any>();
      for (const check of (latestChecks ?? [])) {
        if (!byContract.has(check.contract_id)) {
          byContract.set(check.contract_id, check);
        }
      }
      const uniqueChecks = [...byContract.values()];

      // Open violations
      const { data: openViolations } = await supabase
        .from("compliance_violations")
        .select("id, contract_id, rule_code, rule_name, module, severity, status, description, legal_basis, remediation, created_at")
        .eq("tenant_id", tenantId)
        .eq("status", "open")
        .order("severity", { ascending: true });

      // Aggregate
      const avgScore = uniqueChecks.length > 0
        ? Math.round(uniqueChecks.reduce((s, c) => s + c.overall_score, 0) / uniqueChecks.length)
        : 0;

      const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
      for (const v of (openViolations ?? [])) {
        bySeverity[v.severity as keyof typeof bySeverity]++;
      }

      const byModule = {} as Record<string, number>;
      for (const v of (openViolations ?? [])) {
        byModule[v.module] = (byModule[v.module] ?? 0) + 1;
      }

      // Contracts at risk (score < 60)
      const atRisk = uniqueChecks.filter((c) => c.overall_score < 60);

      // Recent history (last 10 checks)
      const { data: recentHistory } = await supabase
        .from("compliance_checks")
        .select("id, contract_id, overall_score, failed, warnings, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(20);

      return new Response(JSON.stringify({
        action: "get_dashboard",
        summary: {
          total_contracts: uniqueChecks.length,
          avg_score: avgScore,
          contracts_compliant: uniqueChecks.filter((c) => c.overall_score >= 80).length,
          contracts_at_risk: atRisk.length,
          total_open_violations: (openViolations ?? []).length,
          violations_by_severity: bySeverity,
          violations_by_module: byModule,
        },
        contracts: uniqueChecks.map((c) => ({
          contract_id: c.contract_id,
          score: c.overall_score,
          failed: c.failed,
          warnings: c.warnings,
          last_checked: c.created_at,
          corrective_actions: c.corrective_actions,
        })),
        open_violations: openViolations ?? [],
        recent_history: recentHistory ?? [],
      }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ── Action: resolve_violation ────────────────────────────────────
    if (action === "resolve_violation") {
      const { violation_id, resolution_status, resolution_notes } = body;
      if (!violation_id || !resolution_status) {
        return new Response(JSON.stringify({ error: "violation_id and resolution_status required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const validStatuses = ["resolved", "waived", "false_positive", "acknowledged"];
      if (!validStatuses.includes(resolution_status)) {
        return new Response(JSON.stringify({ error: `Invalid status. Valid: ${validStatuses.join(", ")}` }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const { data: { user } } = await supabase.auth.getUser();

      const { data: updated, error: updateErr } = await supabase
        .from("compliance_violations")
        .update({
          status: resolution_status,
          resolution_notes: resolution_notes ?? null,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
        })
        .eq("id", violation_id)
        .eq("tenant_id", tenantId)
        .select("id, status")
        .single();

      if (updateErr) throw updateErr;

      return new Response(JSON.stringify({
        action: "resolve_violation",
        violation: updated,
      }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("Compliance monitor error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
