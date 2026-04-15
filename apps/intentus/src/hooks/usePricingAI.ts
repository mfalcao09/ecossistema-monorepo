import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { toast } from "sonner";

export interface ComparableItem {
  title: string;
  price: number;
  area: number;
  pricePerSqm: number;
  neighborhood: string;
  city: string;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  source: string;
  url: string;
}

export interface PricingRecommendation {
  recommended_value: number;
  min_value?: number;
  max_value?: number;
  adjustment_pct: number;
  index_used: string;
  index_value?: number;
  market_position: "abaixo" | "alinhado" | "acima";
  confidence: number;
  reasoning: string;
  market_insights?: string[];
  risk_factors?: string[];
  // Campos extras vindos da Edge Function
  evaluation_id?: string;
  total_listings?: number;
  total_comparables?: number;
  tier_used?: string;
  ai_analysis?: string;
  stats?: any;
  top_comparables?: ComparableItem[];
}

// Timeout de 200 segundos para a Edge Function v24 (poll até 180s para multi-source scraping)
const PRICING_AI_TIMEOUT_MS = 200_000;

/**
 * Mapeia a resposta da Edge Function pricing-ai (v22) para o formato
 * esperado pelo PricingAIDialog.
 *
 * A Edge Function retorna:
 * {
 *   success: true, evaluation_id, property_id, status: "concluida",
 *   stats: { suggested_value, suggested_min_value, suggested_max_value,
 *            confidence_score, avg_price_per_sqm, median_price_per_sqm, ... },
 *   ai_analysis: "...",
 *   total_listings, total_comparables, tier_used, ...
 * }
 *
 * O frontend espera:
 * { recommended_value, min_value, max_value, adjustment_pct, confidence,
 *   market_position, reasoning, market_insights, risk_factors, ... }
 */
function mapEdgeFunctionResponse(data: any, currentValue?: number): PricingRecommendation {
  const stats = data.stats || {};

  // Valor recomendado: vem de stats.suggested_value
  const recommendedValue = stats.suggested_value || data.suggested_value || 0;
  const minValue = stats.suggested_min_value || data.suggested_min_value;
  const maxValue = stats.suggested_max_value || data.suggested_max_value;
  const confidence = stats.confidence_score || data.confidence_score || 0;

  // Calcula adjustment_pct se temos valor atual
  let adjustmentPct = 0;
  if (currentValue && currentValue > 0 && recommendedValue > 0) {
    adjustmentPct = ((recommendedValue - currentValue) / currentValue) * 100;
  }

  // Determina market_position baseado na diferença
  let marketPosition: "abaixo" | "alinhado" | "acima" = "alinhado";
  if (currentValue && currentValue > 0 && recommendedValue > 0) {
    const diffPct = ((currentValue - recommendedValue) / recommendedValue) * 100;
    if (diffPct < -5) marketPosition = "abaixo";
    else if (diffPct > 5) marketPosition = "acima";
  }

  // Gera reasoning/insights a partir do ai_analysis ou stats
  const aiAnalysis = data.ai_analysis || "";
  const totalComparables = stats.total_comparables || data.total_comparables || 0;
  const tierUsed = stats.tier_used || data.tier_used || "";

  const tierLabels: Record<string, string> = {
    neighborhood: "mesmo bairro (alta precisão)",
    mixed_city: "bairro + cidade (boa precisão)",
    city: "mesma cidade (precisão moderada)",
    mixed_state: "cidade + estado (precisão baixa)",
    state: "apenas estado (precisão muito baixa)",
  };
  const tierLabel = tierLabels[tierUsed] || tierUsed;

  // Gera reasoning resumido
  const medianPriceSqm = stats.median_price_per_sqm || 0;
  const reasoning = aiAnalysis
    ? `Análise baseada em ${totalComparables} imóveis comparáveis (${tierLabel}). Mediana do m²: R$ ${medianPriceSqm.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`
    : `Análise baseada em ${totalComparables} imóveis comparáveis na região.`;

  // Gera market_insights a partir dos dados
  const insights: string[] = [];
  if (totalComparables > 0) {
    insights.push(`${totalComparables} imóveis comparáveis encontrados (${tierLabel})`);
  }
  if (stats.avg_price_per_sqm) {
    insights.push(`Preço médio/m²: R$ ${stats.avg_price_per_sqm.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  }
  if (medianPriceSqm) {
    insights.push(`Mediana/m²: R$ ${medianPriceSqm.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  }
  if (stats.sources && typeof stats.sources === "object") {
    const sourceList = Object.entries(stats.sources)
      .map(([src, count]) => `${src}: ${count}`)
      .join(", ");
    insights.push(`Fontes: ${sourceList}`);
  }

  // Fatores de risco
  const riskFactors: string[] = [];
  if (confidence < 50) {
    riskFactors.push("Confiança baixa — poucos comparáveis disponíveis na região");
  }
  if (tierUsed === "state" || tierUsed === "mixed_state") {
    riskFactors.push("Dados de mercado limitados ao nível de estado — precisão reduzida");
  }
  if (adjustmentPct > 15 || adjustmentPct < -15) {
    riskFactors.push(`Diferença significativa (${adjustmentPct > 0 ? "+" : ""}${adjustmentPct.toFixed(1)}%) entre valor atual e sugerido`);
  }

  return {
    recommended_value: recommendedValue,
    min_value: minValue,
    max_value: maxValue,
    adjustment_pct: Math.round(adjustmentPct * 100) / 100,
    index_used: tierLabel,
    index_value: undefined,
    market_position: marketPosition,
    confidence,
    reasoning,
    market_insights: insights,
    risk_factors: riskFactors,
    // Campos extras
    evaluation_id: data.evaluation_id,
    total_listings: data.total_listings,
    total_comparables: totalComparables,
    tier_used: tierUsed,
    ai_analysis: aiAnalysis,
    stats,
    top_comparables: Array.isArray(data.top_comparables) ? data.top_comparables : [],
  };
}

export function usePricingAI() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PricingRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const analyze = useCallback(async (params: {
    contract_id?: string;
    property_id?: string;
    neighborhood?: string;
    city?: string;
    current_value?: number;
    adjustment_index?: string;
    contract_type?: string;
  }) => {
    // Cancela requisição anterior se existir
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    // Timeout automático
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, PRICING_AI_TIMEOUT_MS);

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "pricing-ai",
        {
          body: params,
        }
      );

      // Verifica se foi cancelado durante a requisição
      if (controller.signal.aborted) {
        return null;
      }

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      // Validação: aceita tanto o formato novo (Edge Function v22) quanto o antigo
      if (!data) {
        throw new Error("Resposta vazia da IA de precificação");
      }

      let recommendation: PricingRecommendation;

      if (data.success && data.stats) {
        // Formato da Edge Function v22: { success, stats, ai_analysis, ... }
        recommendation = mapEdgeFunctionResponse(data, params.current_value);
      } else if (typeof data.recommended_value === "number") {
        // Formato legado (caso futuro): { recommended_value, ... }
        recommendation = {
          recommended_value: data.recommended_value,
          min_value: data.min_value ?? undefined,
          max_value: data.max_value ?? undefined,
          adjustment_pct: data.adjustment_pct ?? 0,
          index_used: data.index_used ?? "N/A",
          index_value: data.index_value ?? undefined,
          market_position: data.market_position ?? "alinhado",
          confidence: data.confidence ?? 0,
          reasoning: data.reasoning ?? "Análise concluída.",
          market_insights: Array.isArray(data.market_insights)
            ? data.market_insights
            : [],
          risk_factors: Array.isArray(data.risk_factors)
            ? data.risk_factors
            : [],
        };
      } else {
        throw new Error("Resposta inválida da IA de precificação — formato não reconhecido");
      }

      // Validação final: valor recomendado deve ser > 0
      if (!recommendation.recommended_value || recommendation.recommended_value <= 0) {
        throw new Error("Nenhum valor de mercado pôde ser calculado — sem comparáveis suficientes na região");
      }

      setResult(recommendation);

      // Persiste a análise na tabela pricing_analyses para histórico
      if (params.contract_id) {
        const confidenceLabel =
          recommendation.confidence >= 70 ? "Alta" :
          recommendation.confidence >= 40 ? "Media" : "Baixa";

        const sourcesMap: Record<string, number> = {};
        if (recommendation.stats?.sources && typeof recommendation.stats.sources === "object") {
          Object.assign(sourcesMap, recommendation.stats.sources);
        }

        const tenantId = await getAuthTenantId();
        const insertPayload = {
          contract_id: params.contract_id,
          property_id: params.property_id || null,
          tenant_id: tenantId,
          suggested_price: recommendation.recommended_value,
          price_per_sqm: recommendation.stats?.avg_price_per_sqm || null,
          confidence: confidenceLabel,
          analysis_type: params.contract_type === "rental" || params.contract_type === "lease" || params.contract_type === "locacao" || params.contract_type === "administracao" || (params.contract_type || "").includes("aluguel") ? "rental" : "sale",
          comparables_count: recommendation.total_comparables || 0,
          median_price: recommendation.stats?.median_price || recommendation.stats?.median_value || null,
          mean_price: recommendation.stats?.avg_price || recommendation.stats?.mean_value || null,
          min_price: recommendation.min_value || null,
          max_price: recommendation.max_value || null,
          percentile_25: recommendation.stats?.percentile_25 || null,
          percentile_75: recommendation.stats?.percentile_75 || null,
          top_comparables: recommendation.top_comparables || [],
          sources: sourcesMap,
          ai_analysis: recommendation.ai_analysis || null,
          search_params: {
            neighborhood: params.neighborhood,
            city: params.city,
            current_value: params.current_value,
            adjustment_index: params.adjustment_index,
            contract_type: params.contract_type,
            tier_used: recommendation.tier_used,
          },
        };

        // Fire-and-forget: não bloqueia o retorno da análise
        supabase
          .from("pricing_analyses" as any)
          .insert(insertPayload as any)
          .then(({ error: insertError }) => {
            if (insertError) {
              console.warn("[PricingAI] Falha ao salvar histórico:", insertError.message);
            }
          });
      }

      return recommendation;
    } catch (err: any) {
      // Ignora erros de abort (usuário cancelou)
      if (err?.name === "AbortError" || controller.signal.aborted) {
        return null;
      }

      const message =
        err?.message || "Erro desconhecido na análise de precificação";
      setError(message);
      toast.error("Erro na análise de precificação: " + message);
      return null;
    } finally {
      clearTimeout(timeoutId);
      // Só atualiza loading se não foi cancelado
      if (!controller.signal.aborted) {
        setLoading(false);
      }
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, []);

  const reset = useCallback(() => {
    // Cancela requisição em andamento ao resetar
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  return { analyze, loading, result, error, reset };
}
