/**
 * useContractApprovalRules — Hook CRUD para regras de aprovação de contratos
 *
 * Épico 2 — CLM Fase 2
 *
 * Funcionalidades:
 * - Listar regras de aprovação (com cache react-query)
 * - Criar nova regra
 * - Atualizar regra existente
 * - Excluir regra (soft-delete via is_active)
 * - Buscar regra aplicável para um contrato (por tipo + valor)
 *
 * Tabela: contract_approval_rules
 * FK: created_by → profiles(id)
 * RLS: tenant isolation via profiles.tenant_id
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Tipos ───────────────────────────────────────────────────────────────

export interface ApproverStep {
  role: string;
  step_name: string;
  step_order: number;
  deadline_hours: number;
}

export interface ContractApprovalRule {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  contract_types: string[];
  min_value: number | null;
  max_value: number | null;
  approvers: ApproverStep[];
  require_all: boolean;
  is_active: boolean;
  priority: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateApprovalRuleInput {
  name: string;
  description?: string;
  contract_types?: string[];
  min_value?: number | null;
  max_value?: number | null;
  approvers: ApproverStep[];
  require_all?: boolean;
  is_active?: boolean;
  priority?: number;
}

export interface UpdateApprovalRuleInput {
  id: string;
  name?: string;
  description?: string | null;
  contract_types?: string[];
  min_value?: number | null;
  max_value?: number | null;
  approvers?: ApproverStep[];
  require_all?: boolean;
  is_active?: boolean;
  priority?: number;
}

// ── Funções de acesso ao Supabase ───────────────────────────────────────

async function fetchApprovalRules(): Promise<ContractApprovalRule[]> {
  const { data, error } = await supabase
    .from("contract_approval_rules")
    .select("*")
    .order("priority", { ascending: true })
    .order("min_value", { ascending: true });

  if (error) throw new Error(`Erro ao buscar regras de aprovação: ${error.message}`);

  // Parse approvers de jsonb para ApproverStep[]
  return (data || []).map((rule: Record<string, unknown>) => ({
    ...rule,
    approvers: Array.isArray(rule.approvers) ? rule.approvers : [],
    contract_types: Array.isArray(rule.contract_types) ? rule.contract_types : [],
    min_value: rule.min_value ? Number(rule.min_value) : null,
    max_value: rule.max_value ? Number(rule.max_value) : null,
  })) as ContractApprovalRule[];
}

async function createApprovalRule(
  input: CreateApprovalRuleInput
): Promise<ContractApprovalRule> {
  // Buscar profile.id do usuário logado para created_by
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) throw new Error("Usuário não autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id")
    .eq("user_id", userData.user.id)
    .single();

  if (!profile) throw new Error("Perfil não encontrado");

  const { data, error } = await supabase
    .from("contract_approval_rules")
    .insert({
      tenant_id: profile.tenant_id,
      name: input.name,
      description: input.description || null,
      contract_types: input.contract_types || [],
      min_value: input.min_value ?? null,
      max_value: input.max_value ?? null,
      approvers: input.approvers,
      require_all: input.require_all ?? true,
      is_active: input.is_active ?? true,
      priority: input.priority ?? 0,
      created_by: profile.id,
    } as Record<string, unknown>)
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar regra: ${error.message}`);
  return data as unknown as ContractApprovalRule;
}

async function updateApprovalRule(
  input: UpdateApprovalRuleInput
): Promise<ContractApprovalRule> {
  const { id, ...updates } = input;

  // Limpar campos undefined
  const cleanUpdates: Record<string, unknown> = {};
  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  });

  cleanUpdates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("contract_approval_rules")
    .update(cleanUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Erro ao atualizar regra: ${error.message}`);
  return data as unknown as ContractApprovalRule;
}

async function deleteApprovalRule(id: string): Promise<void> {
  // Soft delete: apenas desativa a regra
  const { error } = await supabase
    .from("contract_approval_rules")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`Erro ao excluir regra: ${error.message}`);
}

/**
 * Busca a regra de aprovação aplicável para um contrato
 * com base no tipo e valor do contrato.
 * Retorna a regra de maior prioridade que se aplica.
 */
async function findApplicableRule(
  contractType: string,
  totalValue: number
): Promise<ContractApprovalRule | null> {
  const { data, error } = await supabase
    .from("contract_approval_rules")
    .select("*")
    .eq("is_active", true)
    .order("priority", { ascending: false }); // Maior prioridade primeiro

  if (error) throw new Error(`Erro ao buscar regra aplicável: ${error.message}`);
  if (!data || data.length === 0) return null;

  // Filtrar regras aplicáveis:
  // 1. contract_types vazio = aplica a todos
  // 2. contract_types contém o tipo do contrato
  // 3. Valor dentro da faixa min_value/max_value
  const applicableRules = (data as Record<string, unknown>[])
    .map((rule) => ({
      ...rule,
      approvers: Array.isArray(rule.approvers) ? rule.approvers : [],
      contract_types: Array.isArray(rule.contract_types) ? rule.contract_types : [],
      min_value: rule.min_value ? Number(rule.min_value) : null,
      max_value: rule.max_value ? Number(rule.max_value) : null,
    }))
    .filter((rule) => {
      // Checar tipo de contrato
      const types = rule.contract_types as string[];
      if (types.length > 0 && !types.includes(contractType)) {
        return false;
      }

      // Checar faixa de valor
      const minVal = rule.min_value as number | null;
      const maxVal = rule.max_value as number | null;

      if (minVal !== null && totalValue < minVal) return false;
      if (maxVal !== null && totalValue > maxVal) return false;

      return true;
    });

  if (applicableRules.length === 0) return null;

  // Retorna a de maior prioridade (já ordenadas desc)
  return applicableRules[0] as unknown as ContractApprovalRule;
}

// ── Hooks React Query ───────────────────────────────────────────────────

const QUERY_KEY = "contract-approval-rules";

/**
 * Hook para listar todas as regras de aprovação
 * @param onlyActive - se true, filtra apenas regras ativas (default: false, mostra todas)
 */
export function useContractApprovalRules(onlyActive = false) {
  return useQuery({
    queryKey: [QUERY_KEY, { onlyActive }],
    queryFn: async () => {
      const rules = await fetchApprovalRules();
      return onlyActive ? rules.filter((r) => r.is_active) : rules;
    },
    staleTime: 2 * 60 * 1000, // 2 min
  });
}

/**
 * Hook para buscar a regra aplicável para um contrato específico
 */
export function useApplicableRule(contractType: string, totalValue: number) {
  return useQuery({
    queryKey: [QUERY_KEY, "applicable", contractType, totalValue],
    queryFn: () => findApplicableRule(contractType, totalValue),
    enabled: !!contractType && totalValue > 0,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook para criar uma nova regra de aprovação
 */
export function useCreateApprovalRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createApprovalRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/**
 * Hook para atualizar uma regra existente
 */
export function useUpdateApprovalRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateApprovalRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/**
 * Hook para excluir (desativar) uma regra
 */
export function useDeleteApprovalRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteApprovalRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
