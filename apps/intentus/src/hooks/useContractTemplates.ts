import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

// ── Tipos ────────────────────────────────────────────────
export type TemplateType =
  | "venda"
  | "locacao"
  | "administracao"
  | "distrato"
  | "prestacao_servicos"
  | "obra"
  | "comissao"
  | "fornecimento"
  | "aditivo"
  | "cessao"
  | "nda"
  | "exclusividade"
  | "outro";

export interface TemplateVariable {
  type: "text" | "number" | "date" | "select" | "textarea";
  label: string;
  required: boolean;
  options?: string[];
  default?: string;
}

export interface ContractTemplate {
  id: string;
  name: string;
  template_type: string;
  content: string;
  version: number;
  is_active: boolean;
  variables: Record<string, TemplateVariable>;
  use_count: number;
  category: string | null;
  description: string | null;
  source: string | null;
  approved_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateInput {
  name: string;
  template_type: string;
  content: string;
  variables?: Record<string, TemplateVariable>;
  category?: string;
  description?: string;
}

export interface UpdateTemplateInput {
  id: string;
  name?: string;
  template_type?: string;
  content?: string;
  variables?: Record<string, TemplateVariable>;
  category?: string;
  description?: string;
  is_active?: boolean;
}

// ── Labels e Cores ───────────────────────────────────────
export const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  venda: "Compra e Venda",
  locacao: "Locação",
  administracao: "Administração",
  distrato: "Distrato",
  prestacao_servicos: "Prestação de Serviços",
  obra: "Obra",
  comissao: "Comissão",
  fornecimento: "Fornecimento",
  aditivo: "Aditivo",
  cessao: "Cessão",
  nda: "NDA",
  exclusividade: "Exclusividade",
  outro: "Outro",
};

export const TEMPLATE_TYPE_COLORS: Record<string, string> = {
  venda: "bg-green-100 text-green-800",
  locacao: "bg-blue-100 text-blue-800",
  administracao: "bg-purple-100 text-purple-800",
  distrato: "bg-red-100 text-red-800",
  prestacao_servicos: "bg-orange-100 text-orange-800",
  obra: "bg-yellow-100 text-yellow-800",
  comissao: "bg-teal-100 text-teal-800",
  fornecimento: "bg-indigo-100 text-indigo-800",
  aditivo: "bg-cyan-100 text-cyan-800",
  cessao: "bg-pink-100 text-pink-800",
  nda: "bg-gray-100 text-gray-800",
  exclusividade: "bg-amber-100 text-amber-800",
  outro: "bg-slate-100 text-slate-800",
};

export const CATEGORY_LABELS: Record<string, string> = {
  incorporacao: "Incorporação",
  locacao: "Locação",
  servicos: "Serviços",
  comercial: "Comercial",
  juridico: "Jurídico",
  administrativo: "Administrativo",
};

// ── Funções de fetch ─────────────────────────────────────
async function fetchTemplates(): Promise<ContractTemplate[]> {
  const tenantId = await getAuthTenantId();
  const { data, error } = await (supabase as any)
    .from("legal_contract_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name");

  if (error) throw error;
  return (data ?? []) as ContractTemplate[];
}

async function fetchTemplateById(id: string): Promise<ContractTemplate> {
  const tenantId = await getAuthTenantId();
  const { data, error } = await (supabase as any)
    .from("legal_contract_templates")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (error) throw error;
  return data as ContractTemplate;
}

async function createTemplate(input: CreateTemplateInput): Promise<ContractTemplate> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Usuário não autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", userData.user.id)
    .single();

  if (!profile) throw new Error("Perfil não encontrado");

  const { data, error } = await (supabase as any)
    .from("legal_contract_templates")
    .insert({
      name: input.name,
      template_type: input.template_type,
      content: input.content,
      variables: input.variables ?? {},
      category: input.category ?? null,
      description: input.description ?? null,
      source: "contract",
      created_by: userData.user.id,
      tenant_id: profile.tenant_id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ContractTemplate;
}

async function updateTemplate(input: UpdateTemplateInput): Promise<ContractTemplate> {
  const updates: Record<string, any> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.template_type !== undefined) updates.template_type = input.template_type;
  if (input.content !== undefined) updates.content = input.content;
  if (input.variables !== undefined) updates.variables = input.variables;
  if (input.category !== undefined) updates.category = input.category;
  if (input.description !== undefined) updates.description = input.description;
  if (input.is_active !== undefined) updates.is_active = input.is_active;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await (supabase as any)
    .from("legal_contract_templates")
    .update(updates)
    .eq("id", input.id)
    .select()
    .single();

  if (error) throw error;
  return data as ContractTemplate;
}

async function deleteTemplate(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("legal_contract_templates")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

async function duplicateTemplate(id: string): Promise<ContractTemplate> {
  const original = await fetchTemplateById(id);

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Usuário não autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", userData.user.id)
    .single();

  if (!profile) throw new Error("Perfil não encontrado");

  const { data, error } = await (supabase as any)
    .from("legal_contract_templates")
    .insert({
      name: `${original.name} (Cópia)`,
      template_type: original.template_type,
      content: original.content,
      variables: original.variables,
      category: original.category,
      description: original.description,
      source: "contract",
      created_by: userData.user.id,
      tenant_id: profile.tenant_id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ContractTemplate;
}

// ── Hooks ────────────────────────────────────────────────
export function useContractTemplates() {
  return useQuery({
    queryKey: ["contract-templates"],
    queryFn: fetchTemplates,
  });
}

export function useContractTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ["contract-templates", id],
    queryFn: () => fetchTemplateById(id!),
    enabled: !!id,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-templates"] });
      toast.success("Template criado com sucesso!");
    },
    onError: (err: Error) => toast.error(`Erro ao criar template: ${err.message}`),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-templates"] });
      toast.success("Template atualizado!");
    },
    onError: (err: Error) => toast.error(`Erro ao atualizar: ${err.message}`),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-templates"] });
      toast.success("Template excluído!");
    },
    onError: (err: Error) => toast.error(`Erro ao excluir: ${err.message}`),
  });
}

export function useDuplicateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: duplicateTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-templates"] });
      toast.success("Template duplicado!");
    },
    onError: (err: Error) => toast.error(`Erro ao duplicar: ${err.message}`),
  });
}
