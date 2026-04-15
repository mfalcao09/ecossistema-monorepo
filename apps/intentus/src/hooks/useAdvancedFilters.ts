// useAdvancedFilters.ts — M02: Advanced Filters + Custom Views (Frontend-Only)
// Direct Supabase queries for saved_filters + custom_views tables

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ============ TYPES ============

export type FilterOperator =
  | "equals" | "not_equals"
  | "contains" | "not_contains"
  | "starts_with" | "ends_with"
  | "greater_than" | "less_than" | "between"
  | "in" | "not_in"
  | "is_empty" | "is_not_empty"
  | "date_before" | "date_after" | "date_between" | "date_last_n_days";

export type FieldType = "text" | "number" | "date" | "boolean" | "select" | "currency";

export type CrmModule =
  | "pipeline" | "leads" | "interactions" | "deals"
  | "brokers" | "properties" | "contracts" | "visits" | "tasks" | "reports";

export type ViewLayout = "list" | "grid" | "kanban" | "table" | "calendar";
export type RowDensity = "compact" | "comfortable" | "spacious";
export type LogicOperator = "AND" | "OR";

export interface FieldDefinition {
  field: string;
  label: string;
  type: FieldType;
  options?: string[];
}

export interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: any;
  value2?: any;
}

export interface SortConfig {
  field: string;
  direction: "asc" | "desc";
}

export interface SavedFilter {
  id: string;
  tenant_id: string;
  created_by: string;
  name: string;
  description: string | null;
  module: CrmModule;
  conditions: FilterCondition[];
  logic_operator: LogicOperator;
  sort_config: SortConfig[];
  is_default: boolean;
  is_shared: boolean;
  is_pinned: boolean;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ColumnConfig {
  field: string;
  label: string;
  width: number;
  visible: boolean;
  order: number;
  align?: "left" | "center" | "right";
  format?: string;
}

export interface ColorRule {
  field: string;
  operator: FilterOperator;
  value: any;
  color: string;
  bgColor: string;
}

export interface CustomView {
  id: string;
  tenant_id: string;
  created_by: string;
  name: string;
  description: string | null;
  module: CrmModule;
  columns: ColumnConfig[];
  filter_id: string | null;
  sort_config: SortConfig[];
  group_by: string | null;
  layout: ViewLayout;
  color_rules: ColorRule[];
  row_density: RowDensity;
  is_default: boolean;
  is_shared: boolean;
  is_pinned: boolean;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
  saved_filters?: SavedFilter | null;
}

export interface QueryPart {
  method: string;
  field: string;
  value: any;
  method2?: string;
  value2?: any;
}

// ============ MODULE FIELD DEFINITIONS ============

const MODULE_FIELDS: Record<CrmModule, FieldDefinition[]> = {
  pipeline: [
    { field: "name", label: "Nome do Negócio", type: "text" },
    { field: "value", label: "Valor", type: "currency" },
    { field: "status", label: "Status", type: "select", options: ["active", "won", "lost", "archived"] },
    { field: "priority", label: "Prioridade", type: "select", options: ["low", "medium", "high", "urgent"] },
    { field: "expected_close_date", label: "Previsão Fechamento", type: "date" },
    { field: "created_at", label: "Data Criação", type: "date" },
    { field: "updated_at", label: "Última Atualização", type: "date" },
    { field: "assigned_to", label: "Responsável", type: "text" },
    { field: "source", label: "Origem", type: "text" },
  ],
  leads: [
    { field: "name", label: "Nome", type: "text" },
    { field: "email", label: "Email", type: "text" },
    { field: "phone", label: "Telefone", type: "text" },
    { field: "status", label: "Status", type: "select", options: ["new", "contacted", "qualified", "unqualified", "converted", "lost"] },
    { field: "source", label: "Origem", type: "select", options: ["website", "referral", "portal", "social", "ads", "organic", "manual", "chatbot"] },
    { field: "score", label: "Score", type: "number" },
    { field: "temperature", label: "Temperatura", type: "select", options: ["cold", "warm", "hot"] },
    { field: "assigned_to", label: "Responsável", type: "text" },
    { field: "created_at", label: "Data Criação", type: "date" },
    { field: "last_interaction_at", label: "Última Interação", type: "date" },
    { field: "budget_min", label: "Orçamento Mín", type: "currency" },
    { field: "budget_max", label: "Orçamento Máx", type: "currency" },
    { field: "interest_type", label: "Tipo Interesse", type: "select", options: ["buy", "rent", "invest"] },
  ],
  interactions: [
    { field: "type", label: "Tipo", type: "select", options: ["call", "email", "whatsapp", "visit", "meeting", "note"] },
    { field: "direction", label: "Direção", type: "select", options: ["inbound", "outbound"] },
    { field: "sentiment", label: "Sentimento", type: "select", options: ["positive", "neutral", "negative"] },
    { field: "quality_score", label: "Score Qualidade", type: "number" },
    { field: "duration_minutes", label: "Duração (min)", type: "number" },
    { field: "created_at", label: "Data", type: "date" },
    { field: "broker_name", label: "Corretor", type: "text" },
    { field: "summary", label: "Resumo", type: "text" },
  ],
  deals: [
    { field: "title", label: "Título", type: "text" },
    { field: "value", label: "Valor", type: "currency" },
    { field: "status", label: "Status", type: "select", options: ["negotiation", "proposal", "contract", "closed_won", "closed_lost"] },
    { field: "commission_rate", label: "Comissão %", type: "number" },
    { field: "closing_date", label: "Data Fechamento", type: "date" },
    { field: "created_at", label: "Data Criação", type: "date" },
    { field: "property_type", label: "Tipo Imóvel", type: "text" },
    { field: "deal_type", label: "Tipo Negócio", type: "select", options: ["sale", "rent", "exchange"] },
  ],
  brokers: [
    { field: "full_name", label: "Nome", type: "text" },
    { field: "email", label: "Email", type: "text" },
    { field: "creci", label: "CRECI", type: "text" },
    { field: "status", label: "Status", type: "select", options: ["active", "inactive", "on_leave"] },
    { field: "team", label: "Equipe", type: "text" },
    { field: "created_at", label: "Data Cadastro", type: "date" },
  ],
  properties: [
    { field: "title", label: "Título", type: "text" },
    { field: "type", label: "Tipo", type: "select", options: ["apartment", "house", "land", "commercial", "rural", "condo"] },
    { field: "transaction_type", label: "Transação", type: "select", options: ["sale", "rent", "both"] },
    { field: "price", label: "Preço", type: "currency" },
    { field: "area_m2", label: "Área (m²)", type: "number" },
    { field: "bedrooms", label: "Quartos", type: "number" },
    { field: "bathrooms", label: "Banheiros", type: "number" },
    { field: "parking_spots", label: "Vagas", type: "number" },
    { field: "neighborhood", label: "Bairro", type: "text" },
    { field: "city", label: "Cidade", type: "text" },
    { field: "status", label: "Status", type: "select", options: ["available", "reserved", "sold", "rented", "inactive"] },
    { field: "created_at", label: "Data Cadastro", type: "date" },
    { field: "featured", label: "Destaque", type: "boolean" },
  ],
  contracts: [
    { field: "title", label: "Título", type: "text" },
    { field: "status", label: "Status", type: "select", options: ["draft", "review", "approved", "active", "expired", "terminated"] },
    { field: "type", label: "Tipo", type: "text" },
    { field: "value", label: "Valor", type: "currency" },
    { field: "start_date", label: "Início", type: "date" },
    { field: "end_date", label: "Fim", type: "date" },
    { field: "created_at", label: "Data Criação", type: "date" },
  ],
  visits: [
    { field: "status", label: "Status", type: "select", options: ["scheduled", "completed", "cancelled", "no_show"] },
    { field: "scheduled_at", label: "Data Agendada", type: "date" },
    { field: "property_title", label: "Imóvel", type: "text" },
    { field: "broker_name", label: "Corretor", type: "text" },
    { field: "feedback_score", label: "Nota Feedback", type: "number" },
    { field: "created_at", label: "Data Criação", type: "date" },
  ],
  tasks: [
    { field: "title", label: "Título", type: "text" },
    { field: "status", label: "Status", type: "select", options: ["pending", "in_progress", "completed", "cancelled"] },
    { field: "priority", label: "Prioridade", type: "select", options: ["low", "medium", "high", "urgent"] },
    { field: "due_date", label: "Data Limite", type: "date" },
    { field: "assigned_to", label: "Responsável", type: "text" },
    { field: "category", label: "Categoria", type: "text" },
    { field: "created_at", label: "Data Criação", type: "date" },
  ],
  reports: [
    { field: "type", label: "Tipo", type: "text" },
    { field: "period", label: "Período", type: "text" },
    { field: "created_at", label: "Data Criação", type: "date" },
  ],
};

// ============ OPERATORS ============

const OPERATORS_BY_TYPE: Record<FieldType, FilterOperator[]> = {
  text: ["equals", "not_equals", "contains", "not_contains", "starts_with", "ends_with", "is_empty", "is_not_empty"],
  number: ["equals", "not_equals", "greater_than", "less_than", "between", "is_empty", "is_not_empty"],
  currency: ["equals", "not_equals", "greater_than", "less_than", "between", "is_empty", "is_not_empty"],
  date: ["equals", "date_before", "date_after", "date_between", "date_last_n_days", "is_empty", "is_not_empty"],
  boolean: ["equals"],
  select: ["equals", "not_equals", "in", "not_in", "is_empty", "is_not_empty"],
};

// ============ HELPERS ============

export function getModuleFields(module: CrmModule): FieldDefinition[] {
  return MODULE_FIELDS[module] || [];
}

export function getOperatorsForField(module: CrmModule, fieldName: string): FilterOperator[] {
  const field = MODULE_FIELDS[module]?.find((f) => f.field === fieldName);
  if (!field) return [];
  return OPERATORS_BY_TYPE[field.type] || [];
}

export function getFieldType(module: CrmModule, fieldName: string): FieldType | null {
  const field = MODULE_FIELDS[module]?.find((f) => f.field === fieldName);
  return field?.type || null;
}

export function getAllModules(): CrmModule[] {
  return Object.keys(MODULE_FIELDS) as CrmModule[];
}

export function getModuleLabel(module: CrmModule): string {
  const labels: Record<CrmModule, string> = {
    pipeline: "Pipeline",
    leads: "Leads",
    interactions: "Interações",
    deals: "Negócios",
    brokers: "Corretores",
    properties: "Imóveis",
    contracts: "Contratos",
    visits: "Visitas",
    tasks: "Tarefas",
    reports: "Relatórios",
  };
  return labels[module] || module;
}

export function getOperatorLabel(op: FilterOperator): string {
  const labels: Record<FilterOperator, string> = {
    equals: "Igual a",
    not_equals: "Diferente de",
    contains: "Contém",
    not_contains: "Não contém",
    starts_with: "Começa com",
    ends_with: "Termina com",
    greater_than: "Maior que",
    less_than: "Menor que",
    between: "Entre",
    in: "Em",
    not_in: "Não está em",
    is_empty: "Está vazio",
    is_not_empty: "Não está vazio",
    date_before: "Antes de",
    date_after: "Depois de",
    date_between: "Entre datas",
    date_last_n_days: "Últimos N dias",
  };
  return labels[op] || op;
}

export function getLayoutLabel(layout: ViewLayout): string {
  const labels: Record<ViewLayout, string> = {
    list: "Lista",
    grid: "Grade",
    kanban: "Kanban",
    table: "Tabela",
    calendar: "Calendário",
  };
  return labels[layout] || layout;
}

export function getLayoutIcon(layout: ViewLayout): string {
  const icons: Record<ViewLayout, string> = {
    list: "List",
    grid: "LayoutGrid",
    kanban: "Columns3",
    table: "Table",
    calendar: "Calendar",
  };
  return icons[layout] || "List";
}

export function getDensityLabel(density: RowDensity): string {
  return { compact: "Compacto", comfortable: "Confortável", spacious: "Espaçoso" }[density];
}

export function buildQueryParts(conditions: FilterCondition[], logicOp: LogicOperator = "AND"): { query_parts: QueryPart[]; logic: LogicOperator; description: string } {
  if (!conditions.length) return { query_parts: [], logic: "AND", description: "Sem filtros" };

  const queryParts: QueryPart[] = conditions.map((c) => {
    switch (c.operator) {
      case "equals": return { method: "eq", field: c.field, value: c.value };
      case "not_equals": return { method: "neq", field: c.field, value: c.value };
      case "contains": return { method: "ilike", field: c.field, value: `%${c.value}%` };
      case "not_contains": return { method: "not.ilike", field: c.field, value: `%${c.value}%` };
      case "starts_with": return { method: "ilike", field: c.field, value: `${c.value}%` };
      case "ends_with": return { method: "ilike", field: c.field, value: `%${c.value}` };
      case "greater_than": return { method: "gt", field: c.field, value: c.value };
      case "less_than": return { method: "lt", field: c.field, value: c.value };
      case "between": return { method: "gte", field: c.field, value: c.value, method2: "lte", value2: c.value2 };
      case "in": return { method: "in", field: c.field, value: Array.isArray(c.value) ? c.value : [c.value] };
      case "not_in": return { method: "not.in", field: c.field, value: Array.isArray(c.value) ? c.value : [c.value] };
      case "is_empty": return { method: "is", field: c.field, value: null };
      case "is_not_empty": return { method: "not.is", field: c.field, value: null };
      case "date_before": return { method: "lt", field: c.field, value: c.value };
      case "date_after": return { method: "gt", field: c.field, value: c.value };
      case "date_between": return { method: "gte", field: c.field, value: c.value, method2: "lte", value2: c.value2 };
      case "date_last_n_days": {
        const d = new Date();
        d.setDate(d.getDate() - Number(c.value));
        return { method: "gte", field: c.field, value: d.toISOString() };
      }
      default: return { method: "eq", field: c.field, value: c.value };
    }
  });

  const description = conditions
    .map((c) => `${c.field} ${getOperatorLabel(c.operator)} ${c.value}${c.value2 ? ` e ${c.value2}` : ""}`)
    .join(` ${logicOp} `);

  return { query_parts: queryParts, logic: logicOp, description };
}

// ============ QUERIES ============

export function useFilters(module?: CrmModule) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["advanced-filters", module],
    queryFn: async () => {
      let query = supabase
        .from("saved_filters" as any)
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("use_count" as any, { ascending: false })
        .order("updated_at", { ascending: false });

      if (module) {
        query = query.eq("module", module);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as SavedFilter[];
    },
    enabled: !!session,
  });
}

export function useViews(module?: CrmModule) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["custom-views", module],
    queryFn: async () => {
      let query = supabase
        .from("custom_views" as any)
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("use_count" as any, { ascending: false })
        .order("updated_at", { ascending: false });

      if (module) {
        query = query.eq("module", module);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as CustomView[];
    },
    enabled: !!session,
  });
}

// ============ MUTATIONS ============

export function useSaveFilter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id?: string;
      name: string;
      description?: string;
      module: CrmModule;
      conditions: FilterCondition[];
      logic_operator?: LogicOperator;
      sort_config?: SortConfig[];
      is_shared?: boolean;
      is_pinned?: boolean;
    }) => {
      const payload: any = {
        name: params.name,
        description: params.description || null,
        module: params.module,
        conditions: params.conditions,
        logic_operator: params.logic_operator || "AND",
        sort_config: params.sort_config || [],
        is_shared: params.is_shared || false,
        is_pinned: params.is_pinned || false,
        updated_at: new Date().toISOString(),
      };

      if (params.id) {
        const { data, error } = await supabase
          .from("saved_filters" as any)
          .update(payload)
          .eq("id", params.id)
          .select()
          .maybeSingle();
        if (error) throw error;
        return data as unknown as SavedFilter;
      } else {
        const { data, error } = await supabase
          .from("saved_filters" as any)
          .insert(payload)
          .select()
          .maybeSingle();
        if (error) throw error;
        return data as unknown as SavedFilter;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advanced-filters"] });
      toast.success("Filtro salvo com sucesso");
    },
    onError: (e: any) => toast.error(`Erro ao salvar filtro: ${e.message}`),
  });
}

export function useDeleteFilter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("saved_filters" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advanced-filters"] });
      toast.success("Filtro excluído");
    },
    onError: (e: any) => toast.error(`Erro ao excluir filtro: ${e.message}`),
  });
}

export function useSetDefaultFilter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; module: CrmModule }) => {
      // Unset all defaults for module
      await supabase
        .from("saved_filters" as any)
        .update({ is_default: false })
        .eq("module", params.module)
        .eq("is_default", true);

      const { data, error } = await supabase
        .from("saved_filters" as any)
        .update({ is_default: true })
        .eq("id", params.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as unknown as SavedFilter;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advanced-filters"] });
      toast.success("Filtro padrão definido");
    },
  });
}

export function useSaveView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id?: string;
      name: string;
      description?: string;
      module: CrmModule;
      columns: ColumnConfig[];
      filter_id?: string;
      sort_config?: SortConfig[];
      group_by?: string;
      layout?: ViewLayout;
      color_rules?: ColorRule[];
      row_density?: RowDensity;
      is_shared?: boolean;
      is_pinned?: boolean;
    }) => {
      const payload: any = {
        name: params.name,
        description: params.description || null,
        module: params.module,
        columns: params.columns,
        filter_id: params.filter_id || null,
        sort_config: params.sort_config || [],
        group_by: params.group_by || null,
        layout: params.layout || "list",
        color_rules: params.color_rules || [],
        row_density: params.row_density || "comfortable",
        is_shared: params.is_shared || false,
        is_pinned: params.is_pinned || false,
        updated_at: new Date().toISOString(),
      };

      if (params.id) {
        const { data, error } = await supabase
          .from("custom_views" as any)
          .update(payload)
          .eq("id", params.id)
          .select()
          .maybeSingle();
        if (error) throw error;
        return data as unknown as CustomView;
      } else {
        const { data, error } = await supabase
          .from("custom_views" as any)
          .insert(payload)
          .select()
          .maybeSingle();
        if (error) throw error;
        return data as unknown as CustomView;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-views"] });
      toast.success("View salva com sucesso");
    },
    onError: (e: any) => toast.error(`Erro ao salvar view: ${e.message}`),
  });
}

export function useDeleteView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("custom_views" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-views"] });
      toast.success("View excluída");
    },
    onError: (e: any) => toast.error(`Erro ao excluir view: ${e.message}`),
  });
}

export function useSetDefaultView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; module: CrmModule }) => {
      await supabase
        .from("custom_views" as any)
        .update({ is_default: false })
        .eq("module", params.module)
        .eq("is_default", true);

      const { data, error } = await supabase
        .from("custom_views" as any)
        .update({ is_default: true })
        .eq("id", params.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as unknown as CustomView;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-views"] });
      toast.success("View padrão definida");
    },
  });
}

export function useDuplicateView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; newName?: string }) => {
      const { data: original, error: fetchErr } = await supabase
        .from("custom_views" as any)
        .select("*")
        .eq("id", params.id)
        .maybeSingle();
      if (fetchErr || !original) throw new Error("View não encontrada");

      const og = original as any;
      const { data, error } = await supabase
        .from("custom_views" as any)
        .insert({
          name: params.newName || `${og.name} (cópia)`,
          description: og.description,
          module: og.module,
          columns: og.columns,
          filter_id: og.filter_id,
          sort_config: og.sort_config,
          group_by: og.group_by,
          layout: og.layout,
          color_rules: og.color_rules,
          row_density: og.row_density,
          is_shared: false,
          is_pinned: false,
          is_default: false,
        })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as unknown as CustomView;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-views"] });
      toast.success("View duplicada com sucesso");
    },
    onError: (e: any) => toast.error(`Erro ao duplicar: ${e.message}`),
  });
}
