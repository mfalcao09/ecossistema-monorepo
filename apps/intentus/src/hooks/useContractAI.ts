import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeContractHtml, sanitizeAIText } from "@/lib/sanitizeHtml";

// ─── Types ───────────────────────────────────────────────────────

// contract-draft-ai
export interface DraftContractInput {
  contractType: string;
  parties: {
    role: string; // "locador" | "locatario" | "comprador" | "vendedor"
    name: string;
    cpfCnpj?: string;
    address?: string;
  }[];
  propertyDescription?: string;
  value?: number;
  monthlyValue?: number;
  startDate?: string;
  endDate?: string;
  paymentDueDay?: number;
  adjustmentIndex?: string;
  guaranteeType?: string;
  specialClauses?: string[];
  additionalInstructions?: string;
}

export interface DraftContractOutput {
  html: string;
  title: string;
  summary: string;
  clauses_count: number;
  model_used: string;
  tokens_used: number;
}

// extract-clauses-ai
export interface ExtractClausesInput {
  contractId?: string;
  text?: string;
  documentUrl?: string;
}

export interface ExtractedClause {
  number: string;
  title: string;
  content: string;
  category: string;
  risk_level: "low" | "medium" | "high";
  notes?: string;
}

export interface ExtractClausesOutput {
  clauses: ExtractedClause[];
  parties: { role: string; name: string; document?: string }[];
  summary: string;
  key_dates: { label: string; date: string }[];
  model_used: string;
  tokens_used: number;
}

// parse-contract-ai
export interface ParseContractInput {
  contractId: string;
  text?: string;
  documentUrl?: string;
}

export interface ParseContractOutput {
  contract_type: string;
  parties: any[];
  values: {
    total_value?: number;
    monthly_value?: number;
    guarantee_value?: number;
  };
  dates: {
    start_date?: string;
    end_date?: string;
    signed_at?: string;
  };
  clauses: any[];
  obligations: any[];
  risk_assessment: {
    score: number;
    factors: any[];
  };
  summary: string;
  model_used: string;
}

// default-risk-ai
export interface DefaultRiskInput {
  contractId: string;
}

export interface DefaultRiskOutput {
  risk_score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  factors: {
    factor: string;
    impact: number;
    description: string;
  }[];
  prediction: {
    probability_30d: number;
    probability_60d: number;
    probability_90d: number;
  };
  recommendations: string[];
  model_used: string;
}

// clm-ai-insights
export interface CLMAIInsightsInput {
  contractId?: string;
  analysisType?: "risk" | "compliance" | "optimization" | "full";
}

export interface CLMAIInsightsOutput {
  insights: {
    category: string;
    title: string;
    description: string;
    severity: "info" | "warning" | "critical";
    action?: string;
  }[];
  risk_score: number;
  summary: string;
  model_used: string;
}

// legal-chatbot
export interface LegalChatInput {
  message: string;
  contractId?: string;
  conversationHistory?: { role: "user" | "assistant"; content: string }[];
}

export interface LegalChatOutput {
  response: string;
  sources?: string[];
  relatedClauses?: string[];
  confidence: number;
  model_used: string;
}

// ─── Edge Function Caller ────────────────────────────────────────
async function callEdgeFunction<TInput, TOutput>(
  functionName: string,
  payload: TInput
): Promise<TOutput> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: payload,
  });

  if (error) {
    console.error(`Edge Function ${functionName} error:`, error);
    throw new Error(`Erro na função ${functionName}: ${error.message}`);
  }

  return data as TOutput;
}

// ─── Sanitization Helpers (defense-in-depth) ─────────────────────

function sanitizeDraftOutput(data: DraftContractOutput): DraftContractOutput {
  return {
    ...data,
    html: sanitizeContractHtml(data.html),
    title: sanitizeAIText(data.title),
    summary: sanitizeAIText(data.summary),
  };
}

function sanitizeExtractOutput(data: ExtractClausesOutput): ExtractClausesOutput {
  return {
    ...data,
    summary: sanitizeAIText(data.summary),
    clauses: data.clauses.map((c) => ({
      ...c,
      title: sanitizeAIText(c.title),
      content: sanitizeAIText(c.content),
      notes: c.notes ? sanitizeAIText(c.notes) : undefined,
    })),
    parties: data.parties.map((p) => ({
      ...p,
      name: sanitizeAIText(p.name),
      role: sanitizeAIText(p.role),
    })),
    key_dates: data.key_dates.map((d) => ({
      ...d,
      label: sanitizeAIText(d.label),
      date: sanitizeAIText(d.date),
    })),
  };
}

function sanitizeParseOutput(data: ParseContractOutput): ParseContractOutput {
  return {
    ...data,
    summary: sanitizeAIText(data.summary),
    contract_type: sanitizeAIText(data.contract_type),
  };
}

function sanitizeRiskOutput(data: DefaultRiskOutput): DefaultRiskOutput {
  return {
    ...data,
    factors: data.factors.map((f) => ({
      ...f,
      factor: sanitizeAIText(f.factor),
      description: sanitizeAIText(f.description),
    })),
    recommendations: data.recommendations.map(sanitizeAIText),
  };
}

function sanitizeInsightsOutput(data: CLMAIInsightsOutput): CLMAIInsightsOutput {
  return {
    ...data,
    summary: sanitizeAIText(data.summary),
    insights: data.insights.map((i) => ({
      ...i,
      title: sanitizeAIText(i.title),
      description: sanitizeAIText(i.description),
      action: i.action ? sanitizeAIText(i.action) : undefined,
    })),
  };
}

function sanitizeChatOutput(data: LegalChatOutput): LegalChatOutput {
  return {
    ...data,
    response: sanitizeAIText(data.response),
    sources: data.sources?.map(sanitizeAIText),
    relatedClauses: data.relatedClauses?.map(sanitizeAIText),
  };
}

// ─── Hooks ───────────────────────────────────────────────────────

/**
 * Gera minuta de contrato via IA
 * Edge Function: contract-draft-ai
 */
export function useDraftContract() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: DraftContractInput) => {
      const raw = await callEdgeFunction<DraftContractInput, DraftContractOutput>("contract-draft-ai", input);
      return sanitizeDraftOutput(raw);
    },
    onSuccess: () => {
      toast.success("Minuta gerada com sucesso!");
      qc.invalidateQueries({ queryKey: ["contracts"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao gerar minuta: ${err.message}`);
    },
  });
}

/**
 * Extrai cláusulas de um contrato/documento via IA
 * Edge Function: extract-clauses-ai
 */
export function useExtractClauses() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: ExtractClausesInput) => {
      const raw = await callEdgeFunction<ExtractClausesInput, ExtractClausesOutput>("extract-clauses-ai", input);
      return sanitizeExtractOutput(raw);
    },
    onSuccess: (_, variables) => {
      toast.success("Cláusulas extraídas com sucesso!");
      if (variables.contractId) {
        qc.invalidateQueries({ queryKey: ["contract-clauses", variables.contractId] });
      }
    },
    onError: (err: Error) => {
      toast.error(`Erro ao extrair cláusulas: ${err.message}`);
    },
  });
}

/**
 * Analisa/parseia um contrato completo via IA
 * Edge Function: parse-contract-ai
 */
export function useParseContract() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: ParseContractInput) => {
      const raw = await callEdgeFunction<ParseContractInput, ParseContractOutput>("parse-contract-ai", input);
      return sanitizeParseOutput(raw);
    },
    onSuccess: (_, variables) => {
      toast.success("Contrato analisado com sucesso!");
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["contract-ai-analysis", variables.contractId] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao analisar contrato: ${err.message}`);
    },
  });
}

/**
 * Calcula risco de inadimplência via IA
 * Edge Function: default-risk-ai
 */
export function useDefaultRisk() {
  return useMutation({
    mutationFn: async (input: DefaultRiskInput) => {
      const raw = await callEdgeFunction<DefaultRiskInput, DefaultRiskOutput>("default-risk-ai", input);
      return sanitizeRiskOutput(raw);
    },
    onSuccess: () => {
      toast.success("Análise de risco concluída!");
    },
    onError: (err: Error) => {
      toast.error(`Erro na análise de risco: ${err.message}`);
    },
  });
}

/**
 * Gera insights IA sobre contrato(s)
 * Edge Function: clm-ai-insights
 */
export function useCLMAIInsights() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CLMAIInsightsInput) => {
      const raw = await callEdgeFunction<CLMAIInsightsInput, CLMAIInsightsOutput>("clm-ai-insights", input);
      return sanitizeInsightsOutput(raw);
    },
    onSuccess: (_, variables) => {
      toast.success("Insights gerados!");
      if (variables.contractId) {
        qc.invalidateQueries({ queryKey: ["contract-ai-analysis", variables.contractId] });
      }
      qc.invalidateQueries({ queryKey: ["portfolio-insights"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro nos insights: ${err.message}`);
    },
  });
}

/**
 * Chatbot jurídico
 * Edge Function: legal-chatbot
 */
export function useLegalChatbot() {
  return useMutation({
    mutationFn: async (input: LegalChatInput) => {
      const raw = await callEdgeFunction<LegalChatInput, LegalChatOutput>("legal-chatbot", input);
      return sanitizeChatOutput(raw);
    },
    onError: (err: Error) => {
      toast.error(`Erro no chatbot: ${err.message}`);
    },
  });
}

// ─── Constants ───────────────────────────────────────────────────
export const CONTRACT_TYPE_OPTIONS = [
  { value: "locacao", label: "Locação" },
  { value: "venda", label: "Compra e Venda" },
  { value: "administracao", label: "Administração" },
  { value: "prestacao_servicos", label: "Prestação de Serviços" },
  { value: "obra", label: "Obra/Empreitada" },
  { value: "comissao", label: "Comissão" },
  { value: "fornecimento", label: "Fornecimento" },
  { value: "distrato", label: "Distrato" },
  { value: "aditivo", label: "Aditivo" },
  { value: "cessao", label: "Cessão" },
  { value: "nda", label: "NDA / Confidencialidade" },
  { value: "exclusividade", label: "Exclusividade" },
];

export const PARTY_ROLE_OPTIONS = [
  { value: "locador", label: "Locador" },
  { value: "locatario", label: "Locatário" },
  { value: "comprador", label: "Comprador" },
  { value: "vendedor", label: "Vendedor" },
  { value: "contratante", label: "Contratante" },
  { value: "contratado", label: "Contratado" },
  { value: "cedente", label: "Cedente" },
  { value: "cessionario", label: "Cessionário" },
  { value: "fiador", label: "Fiador" },
  { value: "testemunha", label: "Testemunha" },
];

export const GUARANTEE_TYPE_OPTIONS = [
  { value: "caucao", label: "Caução" },
  { value: "fiador", label: "Fiador" },
  { value: "seguro_fianca", label: "Seguro Fiança" },
  { value: "titulo_capitalizacao", label: "Título de Capitalização" },
  { value: "nenhuma", label: "Nenhuma" },
];

export const ADJUSTMENT_INDEX_OPTIONS = [
  { value: "IGPM", label: "IGP-M" },
  { value: "IPCA", label: "IPCA" },
  { value: "INPC", label: "INPC" },
  { value: "INCC", label: "INCC" },
  { value: "nenhum", label: "Sem reajuste" },
];
