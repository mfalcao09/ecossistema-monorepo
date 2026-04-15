/**
 * useContractParties — Hook CRUD para partes contratuais
 *
 * Gerencia as partes envolvidas em um contrato (compradores, vendedores,
 * fiadores, testemunhas, intermediadores, locadores, locatários etc).
 *
 * Tabela: contract_parties
 * FK: person_id → people(id), contract_id → contracts(id)
 * Enum contract_party_role: locatario | comprador | proprietario | fiador |
 *   administrador | testemunha | locador | vendedor | intermediador
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";

// ── Types ──────────────────────────────────────────────────────────────
export type ContractPartyRole =
  | "locatario"
  | "comprador"
  | "proprietario"
  | "fiador"
  | "administrador"
  | "testemunha"
  | "locador"
  | "vendedor"
  | "intermediador";

export interface ContractParty {
  id: string;
  contract_id: string;
  person_id: string;
  role: ContractPartyRole;
  legal_representative_name: string | null;
  legal_representative_cpf: string | null;
  ownership_percentage: number | null;
  created_at: string;
  tenant_id: string;
  // Joined from people table
  person?: {
    id: string;
    name: string;
    cpf_cnpj: string | null;
    email: string | null;
    phone: string | null;
    entity_type: string | null;
    person_type: string | null;
    profession: string | null;
    marital_status: string | null;
    nationality: string | null;
  };
}

export interface CreateContractPartyInput {
  contract_id: string;
  person_id: string;
  role: ContractPartyRole;
  legal_representative_name?: string;
  legal_representative_cpf?: string;
  ownership_percentage?: number;
}

export interface UpdateContractPartyInput {
  id: string;
  role?: ContractPartyRole;
  legal_representative_name?: string | null;
  legal_representative_cpf?: string | null;
  ownership_percentage?: number | null;
}

// ── Role labels ────────────────────────────────────────────────────────
export const PARTY_ROLE_LABELS: Record<ContractPartyRole, string> = {
  locatario: "Locatário",
  comprador: "Comprador",
  proprietario: "Proprietário",
  fiador: "Fiador",
  administrador: "Administrador",
  testemunha: "Testemunha",
  locador: "Locador",
  vendedor: "Vendedor",
  intermediador: "Intermediador",
};

export const ALL_PARTY_ROLES: ContractPartyRole[] = [
  "comprador",
  "vendedor",
  "locatario",
  "locador",
  "proprietario",
  "fiador",
  "administrador",
  "intermediador",
  "testemunha",
];

// ── Fetch functions ────────────────────────────────────────────────────
async function fetchContractParties(contractId: string): Promise<ContractParty[]> {
  const tenantId = await getAuthTenantId();
  const { data, error } = await supabase
    .from("contract_parties")
    .select(`
      *,
      person:people!contract_parties_person_id_fkey (
        id, name, cpf_cnpj, email, phone, entity_type, person_type,
        profession, marital_status, nationality
      )
    `)
    .eq("contract_id", contractId)
    .eq("tenant_id", tenantId)
    .order("role", { ascending: true });

  if (error) throw error;
  return (data as unknown as ContractParty[]) || [];
}

async function createContractParty(input: CreateContractPartyInput) {
  // Get tenant_id from user profile
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();
  if (!profile) throw new Error("Perfil não encontrado");

  const { data, error } = await supabase
    .from("contract_parties")
    .insert({
      contract_id: input.contract_id,
      person_id: input.person_id,
      role: input.role,
      legal_representative_name: input.legal_representative_name || null,
      legal_representative_cpf: input.legal_representative_cpf || null,
      ownership_percentage: input.ownership_percentage ?? null,
      tenant_id: profile.tenant_id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function updateContractParty(input: UpdateContractPartyInput) {
  const { id, ...fields } = input;
  const { data, error } = await supabase
    .from("contract_parties")
    .update(fields)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function deleteContractParty(id: string) {
  const { error } = await supabase
    .from("contract_parties")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ── Search people for autocomplete ─────────────────────────────────────
export interface PersonSearchResult {
  id: string;
  name: string;
  cpf_cnpj: string | null;
  email: string | null;
  phone: string | null;
  entity_type: string | null;
}

async function searchPeople(query: string): Promise<PersonSearchResult[]> {
  if (!query || query.length < 2) return [];

  const tenantId = await getAuthTenantId();
  const { data, error } = await supabase
    .from("people")
    .select("id, name, cpf_cnpj, email, phone, entity_type")
    .eq("tenant_id", tenantId)
    .or(`name.ilike.%${query}%,cpf_cnpj.ilike.%${query}%,email.ilike.%${query}%`)
    .is("deleted_at", null)
    .limit(10);

  if (error) throw error;
  return (data as PersonSearchResult[]) || [];
}

// ── Hooks ──────────────────────────────────────────────────────────────
export function useContractParties(contractId: string | undefined) {
  return useQuery({
    queryKey: ["contract-parties", contractId],
    queryFn: () => fetchContractParties(contractId!),
    enabled: !!contractId,
  });
}

export function useSearchPeople(query: string) {
  return useQuery({
    queryKey: ["search-people", query],
    queryFn: () => searchPeople(query),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });
}

export function useCreateContractParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createContractParty,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["contract-parties", vars.contract_id] });
    },
  });
}

export function useUpdateContractParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateContractParty,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-parties"] });
    },
  });
}

export function useDeleteContractParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteContractParty,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-parties"] });
    },
  });
}
