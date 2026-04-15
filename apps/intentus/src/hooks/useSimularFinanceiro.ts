/**
 * useSimularFinanceiro — Sprint 1, Fase 5 Bloco A
 *
 * Encapsula o fluxo completo de simulação financeira:
 *   1. save_scenario  → persiste as premissas em development_parcelamento_scenarios
 *   2. simulate       → calcula VPL/TIR/Payback/Fluxo e persiste em
 *                       development_parcelamento_financial + cash_flow_rows
 *   3. Invalida cache → React Query busca os dados atualizados automaticamente
 *
 * Também expõe:
 *   - useParcelamentoCashFlowRows: busca as linhas mensais do fluxo de caixa
 *     para o gráfico recharts (TabFluxoCaixa)
 *
 * Contrato da EF parcelamento-financial-calc (v3):
 *   POST /functions/v1/parcelamento-financial-calc
 *   { action: "save_scenario", scenario: ScenarioPayload } → { data: Scenario }
 *   { action: "simulate", scenario_id, scenario_type? }    → { ok, financial_id, kpis, ... }
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { parcelamentoQueryKeys } from "./useParcelamentoProjects";
import type {
  MonteCarloResult,
  SensitivityResult,
  EfficientFrontierResult,
} from "@/lib/parcelamento/types";
import type { DeepPremises } from "@/lib/parcelamento/deep-premises-types";
import { DEFAULT_DEEP_PREMISES } from "@/lib/parcelamento/deep-premises-types";

// ---------------------------------------------------------------------------
// Types — premissas do cenário (espelho do tipo Scenario da EF)
// ---------------------------------------------------------------------------

export interface ScenarioFormValues {
  nome: string;
  prazo_obra_meses: number;
  prazo_comercializacao_meses: number;
  mes_inicio_vendas: number;
  preco_medio_lote: number;
  qtd_lotes: number;
  velocidade_vendas_pct_mes: number;
  inadimplencia_pct: number;
  taxa_desconto_anual_pct: number;
  entrada_pct: number;
  parcelas_qtd: number;
  balao_final_pct: number;
  equity_pct: number;
  divida_pct: number;
  custo_divida_anual_pct: number;
  regime_tributario: "lucro_real" | "lucro_presumido" | "ret_afetacao" | "nao_definido";
  patrimonio_afetacao: boolean;
  ret_ativo: boolean;
  aliquota_ir_pct: number;
  indice_correcao_mensal_pct: number;
}

export interface CashFlowDbRow {
  id: string;
  mes_numero: number;
  entrada_vendas: number;
  entrada_financiamento: number;
  entrada_outras: number;
  saida_terreno: number;
  saida_projeto: number;
  saida_infraestrutura: number;
  saida_legalizacao: number;
  saida_obras_comp: number;
  saida_marketing: number;
  saida_tributos: number;
  saida_administrativo: number;
  saida_contingencia: number;
  saida_financeiro: number;
}

export interface CashFlowChartEntry {
  mes: number;
  entradas: number;
  saidas: number;
  saldo: number;
  saldo_acumulado: number;
}

// ---------------------------------------------------------------------------
// Valores default do formulário (referência de mercado BR)
// ---------------------------------------------------------------------------
export const SCENARIO_DEFAULTS: ScenarioFormValues = {
  nome: "Cenário Realista",
  prazo_obra_meses: 24,
  prazo_comercializacao_meses: 36,
  mes_inicio_vendas: 1,
  preco_medio_lote: 120_000,
  qtd_lotes: 100,
  velocidade_vendas_pct_mes: 4,
  inadimplencia_pct: 3,
  taxa_desconto_anual_pct: 15,
  entrada_pct: 20,
  parcelas_qtd: 60,
  balao_final_pct: 0,
  equity_pct: 40,
  divida_pct: 60,
  custo_divida_anual_pct: 14,
  regime_tributario: "lucro_presumido",
  patrimonio_afetacao: false,
  ret_ativo: false,
  aliquota_ir_pct: 5.93,
  indice_correcao_mensal_pct: 0,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mapeia as rows do banco (detalhadas) para o formato agregado do gráfico */
export function mapRowsToChartEntries(rows: CashFlowDbRow[]): CashFlowChartEntry[] {
  let acc = 0;
  return rows.map((r) => {
    const entradas = r.entrada_vendas + r.entrada_financiamento + r.entrada_outras;
    const saidas =
      r.saida_terreno +
      r.saida_projeto +
      r.saida_infraestrutura +
      r.saida_legalizacao +
      r.saida_obras_comp +
      r.saida_marketing +
      r.saida_tributos +
      r.saida_administrativo +
      r.saida_contingencia +
      r.saida_financeiro;
    const saldo = entradas - saidas;
    acc += saldo;
    return {
      mes: r.mes_numero,
      entradas,
      saidas,
      saldo,
      saldo_acumulado: acc,
    };
  });
}

// ---------------------------------------------------------------------------
// Hook: busca as linhas mensais do fluxo de caixa
// ---------------------------------------------------------------------------

export function useParcelamentoCashFlowRows(financialId: string | null | undefined) {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["parcelamento", "cash_flow_rows", tenantId, financialId],
    enabled: !!tenantId && !!financialId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CashFlowChartEntry[]> => {
      const { data, error } = await supabase
        .from("development_parcelamento_cash_flow_rows")
        .select("*")
        .eq("financial_id", financialId!)
        .order("mes_numero", { ascending: true });

      if (error) throw error;
      return mapRowsToChartEntries((data ?? []) as unknown as CashFlowDbRow[]);
    },
  });
}

// ---------------------------------------------------------------------------
// Hook principal: salva cenário + dispara simulação
// ---------------------------------------------------------------------------

interface SimularFinanceiroArgs {
  developmentId: string;
  tenantId: string;
  formValues: ScenarioFormValues;
  scenarioType?: "otimista" | "realista" | "pessimista";
}

interface SimularFinanceiroResult {
  financial_id: string;
  scenario_id: string;
  kpis: {
    vgv_total: number;
    custo_obra_total: number;
    vpl: number;
    vpl_wacc: number | null;
    tir_anual: number | null;
    payback_meses: number | null;
    payback_descontado_meses: number | null;
    margem_liquida_pct: number;
    wacc_pct: number;
    performance_score: number;
  };
}

export function useSimularFinanceiro() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: SimularFinanceiroArgs): Promise<SimularFinanceiroResult> => {
      const { developmentId, formValues, scenarioType = "realista" } = args;

      // ── Step 1: save_scenario ──────────────────────────────────────────────
      const scenarioPayload = {
        ...formValues,
        development_id: developmentId,
        tenant_id: args.tenantId,
        is_active: true,
        // wacc_pct: null → será calculado pela EF
        wacc_pct: null,
      };

      const { data: saveData, error: saveError } = await supabase.functions.invoke(
        "parcelamento-financial-calc",
        { body: { action: "save_scenario", scenario: scenarioPayload } }
      );

      if (saveError || !saveData?.data?.id) {
        throw new Error(
          saveError?.message ?? saveData?.error ?? "Falha ao salvar cenário"
        );
      }

      const scenarioId = saveData.data.id as string;

      // ── Step 2: simulate ───────────────────────────────────────────────────
      const { data: simData, error: simError } = await supabase.functions.invoke(
        "parcelamento-financial-calc",
        {
          body: {
            action: "simulate",
            scenario_id: scenarioId,
            scenario_type: scenarioType,
          },
        }
      );

      if (simError || !simData?.ok) {
        throw new Error(
          simError?.message ?? simData?.error ?? "Falha ao executar simulação"
        );
      }

      return {
        financial_id: simData.financial_id as string,
        scenario_id: scenarioId,
        kpis: simData.kpis,
      };
    },

    onSuccess: (result, variables) => {
      // Invalida financial + lista de projetos para que os KPIs atualizem
      queryClient.invalidateQueries({
        queryKey: parcelamentoQueryKeys.financial(tenantId, variables.developmentId),
      });
      queryClient.invalidateQueries({
        queryKey: parcelamentoQueryKeys.projects(tenantId),
      });
      // Invalida as cash_flow_rows (nova financial_id vai ser buscada pelo financial ativo)
      queryClient.invalidateQueries({
        queryKey: ["parcelamento", "cash_flow_rows", tenantId],
      });
      // Invalida active_scenario + deep_premises (novo cenário pode ter sido criado)
      queryClient.invalidateQueries({
        queryKey: ["parcelamento", "active_scenario", tenantId, variables.developmentId],
      });
      if (result.scenario_id) {
        queryClient.invalidateQueries({
          queryKey: parcelamentoQueryKeys.deepPremises(result.scenario_id),
        });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Hook: busca o cenário ativo de um development (para ações avançadas)
// ---------------------------------------------------------------------------

export function useActiveScenarioId(developmentId: string | null | undefined) {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["parcelamento", "active_scenario", tenantId, developmentId],
    enabled: !!tenantId && !!developmentId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("development_parcelamento_scenarios")
        .select("id")
        .eq("tenant_id", tenantId!)
        .eq("development_id", developmentId!)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.id ?? null;
    },
  });
}

// ---------------------------------------------------------------------------
// Hook: Monte Carlo
// ---------------------------------------------------------------------------

interface RunMonteCarloArgs {
  developmentId: string;
  scenarioId: string;
  financialId?: string;
  iterations?: number;
  vgv_variation_pct?: number;
  custo_variation_pct?: number;
  velocidade_variation_pct?: number;
}

export function useRunMonteCarlo() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: RunMonteCarloArgs): Promise<MonteCarloResult> => {
      const { data, error } = await supabase.functions.invoke(
        "parcelamento-financial-calc",
        {
          body: {
            action: "run_monte_carlo",
            scenario_id: args.scenarioId,
            financial_id: args.financialId,
            iterations: args.iterations,
            vgv_variation_pct: args.vgv_variation_pct,
            custo_variation_pct: args.custo_variation_pct,
            velocidade_variation_pct: args.velocidade_variation_pct,
          },
        }
      );

      if (error || !data?.ok) {
        throw new Error(
          error?.message ?? data?.error?.message ?? data?.error ?? "Falha no Monte Carlo"
        );
      }

      return data.monte_carlo as MonteCarloResult;
    },

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: parcelamentoQueryKeys.financial(tenantId, variables.developmentId),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Hook: Compute Sensitivity (Tornado Chart)
// ---------------------------------------------------------------------------

interface RunSensitivityArgs {
  developmentId: string;
  scenarioId: string;
  financialId?: string;
  variation_pct?: number;
  variation_pp?: number;
  variables?: string[];
}

export function useRunSensitivity() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: RunSensitivityArgs): Promise<SensitivityResult> => {
      const { data, error } = await supabase.functions.invoke(
        "parcelamento-financial-calc",
        {
          body: {
            action: "compute_sensitivity",
            scenario_id: args.scenarioId,
            financial_id: args.financialId,
            variation_pct: args.variation_pct,
            variation_pp: args.variation_pp,
            variables: args.variables,
          },
        }
      );

      if (error || !data?.ok) {
        throw new Error(
          error?.message ?? data?.error?.message ?? data?.error ?? "Falha na análise de sensibilidade"
        );
      }

      return data.sensitivity as SensitivityResult;
    },

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: parcelamentoQueryKeys.financial(tenantId, variables.developmentId),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Hook: Efficient Frontier
// ---------------------------------------------------------------------------

interface RunEfficientFrontierArgs {
  developmentId: string;
  scenarioId: string;
  financialId?: string;
  equity_min_pct?: number;
  equity_max_pct?: number;
  step_pct?: number;
  realistic_max_divida_pct?: number;
}

export function useRunEfficientFrontier() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: RunEfficientFrontierArgs): Promise<EfficientFrontierResult> => {
      const { data, error } = await supabase.functions.invoke(
        "parcelamento-financial-calc",
        {
          body: {
            action: "efficient_frontier",
            scenario_id: args.scenarioId,
            financial_id: args.financialId,
            equity_min_pct: args.equity_min_pct,
            equity_max_pct: args.equity_max_pct,
            step_pct: args.step_pct,
            realistic_max_divida_pct: args.realistic_max_divida_pct,
          },
        }
      );

      if (error || !data?.ok) {
        throw new Error(
          error?.message ?? data?.error?.message ?? data?.error ?? "Falha na fronteira eficiente"
        );
      }

      return data.efficient_frontier as EfficientFrontierResult;
    },

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: parcelamentoQueryKeys.financial(tenantId, variables.developmentId),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Helper: merge stored deep_premises com defaults (proteção contra schema drift)
// ---------------------------------------------------------------------------

/**
 * Faz merge profundo de premissas armazenadas no banco com os defaults atuais.
 * Se o JSONB foi salvo com uma versão anterior (menos campos), os campos novos
 * são preenchidos automaticamente com DEFAULT_DEEP_PREMISES.
 */
export function mergeDeepPremises(stored: Partial<DeepPremises> | null): DeepPremises {
  if (!stored) return structuredClone(DEFAULT_DEEP_PREMISES);

  return {
    project: { ...DEFAULT_DEEP_PREMISES.project, ...(stored.project ?? {}) },
    sales: { ...DEFAULT_DEEP_PREMISES.sales, ...(stored.sales ?? {}) },
    land: { ...DEFAULT_DEEP_PREMISES.land, ...(stored.land ?? {}) },
    costs: {
      ...DEFAULT_DEEP_PREMISES.costs,
      ...(stored.costs ?? {}),
      // Merge profundo para arrays/objetos aninhados
      infraestrutura:
        stored.costs?.infraestrutura ?? DEFAULT_DEEP_PREMISES.costs.infraestrutura,
      sistema_viario: {
        ...DEFAULT_DEEP_PREMISES.costs.sistema_viario,
        ...(stored.costs?.sistema_viario ?? {}),
      },
      terraplanagem: {
        ...DEFAULT_DEEP_PREMISES.costs.terraplanagem,
        ...(stored.costs?.terraplanagem ?? {}),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Hook: carrega deep_premises de um cenário (JSONB)
// ---------------------------------------------------------------------------

export function useDeepPremises(scenarioId: string | null | undefined) {
  return useQuery({
    queryKey: parcelamentoQueryKeys.deepPremises(scenarioId ?? null),
    enabled: !!scenarioId,
    staleTime: 5 * 60_000,
    retry: (failureCount, error) => {
      // Não fazer retry para cenário não encontrado
      if (error instanceof Error && error.message?.includes("PGRST116")) return false;
      return failureCount < 2;
    },
    queryFn: async (): Promise<DeepPremises | null> => {
      if (!scenarioId) return null;

      const { data, error } = await supabase
        .from("development_parcelamento_scenarios" as never)
        .select("deep_premises")
        .eq("id", scenarioId)
        .maybeSingle();

      if (error) throw error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = (data as any)?.deep_premises;

      // Cenário sem deep_premises (legado) ou null
      if (!raw) return null;

      // Se por algum motivo o JSONB vier como string (não deveria com PostgREST)
      if (typeof raw === "string") {
        try {
          return mergeDeepPremises(JSON.parse(raw) as Partial<DeepPremises>);
        } catch {
          console.warn(`[useDeepPremises] JSONB corrompido no cenário ${scenarioId}`);
          return null;
        }
      }

      return mergeDeepPremises(raw as Partial<DeepPremises>);
    },
  });
}
