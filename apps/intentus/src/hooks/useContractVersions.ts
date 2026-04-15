/**
 * useContractVersions — Hook CRUD para versionamento de contratos
 *
 * Gerencia o histórico de versões de um contrato, incluindo
 * conteúdo HTML, PDF, campos alterados e tipo de mudança.
 *
 * Tabela: contract_versions
 * FK: contract_id → contracts(id), created_by → profiles(id)
 * Unique: (contract_id, version_number)
 * change_type check: create | edit | approval | signing | renewal | addendum
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";

// ── Types ──────────────────────────────────────────────────────────────
export type VersionChangeType =
  | "create"
  | "edit"
  | "approval"
  | "signing"
  | "renewal"
  | "addendum";

export interface ContractVersion {
  id: string;
  contract_id: string;
  version_number: number;
  content_html: string | null;
  content_pdf_url: string | null;
  change_summary: string | null;
  changed_fields: string[];
  change_type: VersionChangeType;
  created_by: string;
  tenant_id: string;
  created_at: string;
  // Joined from profiles table
  creator?: {
    id: string;
    name: string | null;
    avatar_url: string | null;
  };
}

export interface CreateContractVersionInput {
  contract_id: string;
  content_html?: string;
  content_pdf_url?: string;
  change_summary?: string;
  changed_fields?: string[];
  change_type: VersionChangeType;
}

// ── Labels e ícones para tipos de mudança ──────────────────────────────
export const CHANGE_TYPE_LABELS: Record<VersionChangeType, string> = {
  create: "Criação",
  edit: "Edição",
  approval: "Aprovação",
  signing: "Assinatura",
  renewal: "Renovação",
  addendum: "Aditivo",
};

export const CHANGE_TYPE_COLORS: Record<VersionChangeType, string> = {
  create: "bg-green-100 text-green-800",
  edit: "bg-blue-100 text-blue-800",
  approval: "bg-purple-100 text-purple-800",
  signing: "bg-emerald-100 text-emerald-800",
  renewal: "bg-amber-100 text-amber-800",
  addendum: "bg-orange-100 text-orange-800",
};

export const ALL_CHANGE_TYPES: VersionChangeType[] = [
  "create",
  "edit",
  "approval",
  "signing",
  "renewal",
  "addendum",
];

// ── Fetch functions ────────────────────────────────────────────────────
async function fetchContractVersions(contractId: string): Promise<ContractVersion[]> {
  const tenantId = await getAuthTenantId();
  const { data, error } = await supabase
    .from("contract_versions")
    .select(`
      *,
      creator:profiles!contract_versions_created_by_fkey (
        id, name, avatar_url
      )
    `)
    .eq("contract_id", contractId)
    .eq("tenant_id", tenantId)
    .order("version_number", { ascending: false });

  if (error) throw error;
  return (data as unknown as ContractVersion[]) || [];
}

async function fetchLatestVersion(contractId: string): Promise<ContractVersion | null> {
  const tenantId = await getAuthTenantId();
  const { data, error } = await supabase
    .from("contract_versions")
    .select(`
      *,
      creator:profiles!contract_versions_created_by_fkey (
        id, name, avatar_url
      )
    `)
    .eq("contract_id", contractId)
    .eq("tenant_id", tenantId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as ContractVersion | null;
}

async function createContractVersion(input: CreateContractVersionInput) {
  // Get current user profile (created_by FK)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id")
    .eq("user_id", user.id)
    .single();
  if (!profile) throw new Error("Perfil não encontrado");

  // Get next version number
  const { data: latest } = await supabase
    .from("contract_versions")
    .select("version_number")
    .eq("contract_id", input.contract_id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version_number ?? 0) + 1;

  const { data, error } = await supabase
    .from("contract_versions")
    .insert({
      contract_id: input.contract_id,
      version_number: nextVersion,
      content_html: input.content_html || null,
      content_pdf_url: input.content_pdf_url || null,
      change_summary: input.change_summary || null,
      changed_fields: input.changed_fields || [],
      change_type: input.change_type,
      created_by: profile.id,
      tenant_id: profile.tenant_id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Hooks ──────────────────────────────────────────────────────────────
export function useContractVersions(contractId: string | undefined) {
  return useQuery({
    queryKey: ["contract-versions", contractId],
    queryFn: () => fetchContractVersions(contractId!),
    enabled: !!contractId,
  });
}

export function useLatestContractVersion(contractId: string | undefined) {
  return useQuery({
    queryKey: ["contract-versions", contractId, "latest"],
    queryFn: () => fetchLatestVersion(contractId!),
    enabled: !!contractId,
  });
}

export function useCreateContractVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createContractVersion,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["contract-versions", vars.contract_id] });
    },
  });
}
