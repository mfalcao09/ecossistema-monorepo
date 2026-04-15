import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";
import type { KanbanColumn } from "@/components/deals/KanbanBoard";

// ── Types ──────────────────────────────────────────────
export interface PipelineColumn {
  id: string;
  pipeline_template_id: string;
  title: string;
  color: string | null;
  icon: string | null;
  statuses: string[];
  sort_order: number;
  wip_limit: number | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineTemplate {
  id: string;
  tenant_id: string;
  name: string;
  deal_type: string;
  is_default: boolean;
  sort_order: number;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  pipeline_columns?: PipelineColumn[];
}

export interface CreatePipelineParams {
  name: string;
  deal_type: string;
  description?: string;
  is_default?: boolean;
  columns: { title: string; statuses: string[]; color?: string; icon?: string; wip_limit?: number }[];
}

export interface UpdatePipelineParams {
  id: string;
  name?: string;
  description?: string;
  is_default?: boolean;
  sort_order?: number;
}

export interface UpdateColumnsParams {
  pipeline_template_id: string;
  columns: { id?: string; title: string; statuses: string[]; color?: string; icon?: string; sort_order: number; wip_limit?: number }[];
}

// ── Queries ──────────────────────────────────────────────

/**
 * Fetch all pipeline templates for the current tenant, with columns
 */
export function usePipelineTemplates() {
  return useQuery({
    queryKey: ["pipeline-templates"],
    queryFn: async () => {
      const tenant_id = await getAuthTenantId();
      const { data, error } = await supabase
        .from("pipeline_templates" as any)
        .select("*, pipeline_columns(*)")
        .eq("tenant_id", tenant_id)
        .order("sort_order", { ascending: true });
      if (error) throw error;

      // Sort columns within each template
      return ((data || []) as unknown as PipelineTemplate[]).map((t) => ({
        ...t,
        pipeline_columns: (t.pipeline_columns || []).sort(
          (a, b) => a.sort_order - b.sort_order
        ),
      }));
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}

/**
 * Fetch pipeline templates filtered by deal_type
 */
export function usePipelinesByDealType(dealType: string | null) {
  return useQuery({
    queryKey: ["pipeline-templates", "by-type", dealType],
    queryFn: async () => {
      const tenant_id = await getAuthTenantId();
      let query = supabase
        .from("pipeline_templates" as any)
        .select("*, pipeline_columns(*)")
        .eq("tenant_id", tenant_id)
        .order("sort_order", { ascending: true });

      if (dealType) {
        query = query.eq("deal_type", dealType);
      }

      const { data, error } = await query;
      if (error) throw error;

      return ((data || []) as unknown as PipelineTemplate[]).map((t) => ({
        ...t,
        pipeline_columns: (t.pipeline_columns || []).sort(
          (a, b) => a.sort_order - b.sort_order
        ),
      }));
    },
    staleTime: 5 * 60 * 1000,
    enabled: dealType !== undefined,
  });
}

/**
 * Get default pipeline for a deal_type
 */
export function useDefaultPipeline(dealType: string | null) {
  return useQuery({
    queryKey: ["pipeline-templates", "default", dealType],
    queryFn: async () => {
      if (!dealType) return null;
      const tenant_id = await getAuthTenantId();
      const { data, error } = await supabase
        .from("pipeline_templates" as any)
        .select("*, pipeline_columns(*)")
        .eq("tenant_id", tenant_id)
        .eq("deal_type", dealType)
        .eq("is_default", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const template = data as unknown as PipelineTemplate;
      return {
        ...template,
        pipeline_columns: (template.pipeline_columns || []).sort(
          (a, b) => a.sort_order - b.sort_order
        ),
      };
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!dealType,
  });
}

// ── Mutations ──────────────────────────────────────────────

export function useCreatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: CreatePipelineParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();

      // If marking as default, unset other defaults for same deal_type
      if (params.is_default) {
        await supabase
          .from("pipeline_templates" as any)
          .update({ is_default: false } as any)
          .eq("tenant_id", tenant_id)
          .eq("deal_type", params.deal_type)
          .eq("is_default", true);
      }

      const { data, error } = await supabase
        .from("pipeline_templates" as any)
        .insert({
          tenant_id,
          name: params.name,
          deal_type: params.deal_type,
          description: params.description || null,
          is_default: params.is_default || false,
          created_by: user.id,
        } as any)
        .select()
        .single();
      if (error) throw error;

      const templateId = (data as any).id;

      // Insert columns
      if (params.columns.length > 0) {
        const colInserts = params.columns.map((col, idx) => ({
          pipeline_template_id: templateId,
          title: col.title,
          statuses: col.statuses,
          color: col.color || null,
          icon: col.icon || null,
          sort_order: idx + 1,
          wip_limit: col.wip_limit || null,
        }));
        const { error: colErr } = await supabase
          .from("pipeline_columns" as any)
          .insert(colInserts as any);
        if (colErr) throw colErr;
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline-templates"] });
      toast.success("Funil criado com sucesso!");
    },
    onError: (err: Error) => toast.error(`Erro ao criar funil: ${err.message}`),
  });
}

export function useUpdatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: UpdatePipelineParams) => {
      const tenant_id = await getAuthTenantId();

      // If marking as default, get current template to know deal_type
      if (params.is_default) {
        const { data: current } = await supabase
          .from("pipeline_templates" as any)
          .select("deal_type")
          .eq("id", params.id)
          .single();
        if (current) {
          await supabase
            .from("pipeline_templates" as any)
            .update({ is_default: false } as any)
            .eq("tenant_id", tenant_id)
            .eq("deal_type", (current as any).deal_type)
            .eq("is_default", true);
        }
      }

      const updatePayload: any = {};
      if (params.name !== undefined) updatePayload.name = params.name;
      if (params.description !== undefined) updatePayload.description = params.description;
      if (params.is_default !== undefined) updatePayload.is_default = params.is_default;
      if (params.sort_order !== undefined) updatePayload.sort_order = params.sort_order;
      updatePayload.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from("pipeline_templates" as any)
        .update(updatePayload)
        .eq("id", params.id)
        .eq("tenant_id", tenant_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline-templates"] });
      toast.success("Funil atualizado!");
    },
    onError: (err: Error) => toast.error(`Erro ao atualizar funil: ${err.message}`),
  });
}

export function useUpdatePipelineColumns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: UpdateColumnsParams) => {
      // Delete existing columns and re-insert (simpler than diffing)
      const { error: delErr } = await supabase
        .from("pipeline_columns" as any)
        .delete()
        .eq("pipeline_template_id", params.pipeline_template_id);
      if (delErr) throw delErr;

      const colInserts = params.columns.map((col, idx) => ({
        pipeline_template_id: params.pipeline_template_id,
        title: col.title,
        statuses: col.statuses,
        color: col.color || null,
        icon: col.icon || null,
        sort_order: col.sort_order ?? idx + 1,
        wip_limit: col.wip_limit || null,
      }));

      const { error: insErr } = await supabase
        .from("pipeline_columns" as any)
        .insert(colInserts as any);
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline-templates"] });
      toast.success("Colunas do funil atualizadas!");
    },
    onError: (err: Error) => toast.error(`Erro ao atualizar colunas: ${err.message}`),
  });
}

export function useDeletePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pipelineId: string) => {
      const tenant_id = await getAuthTenantId();
      // Check if it's the last pipeline
      const { data: all } = await supabase
        .from("pipeline_templates" as any)
        .select("id")
        .eq("tenant_id", tenant_id);
      if ((all || []).length <= 1) {
        throw new Error("Não é possível excluir o último funil. Crie outro antes de excluir.");
      }
      // CASCADE deletes columns automatically
      const { error } = await supabase
        .from("pipeline_templates" as any)
        .delete()
        .eq("id", pipelineId)
        .eq("tenant_id", tenant_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline-templates"] });
      toast.success("Funil excluído!");
    },
    onError: (err: Error) => toast.error(`Erro ao excluir funil: ${err.message}`),
  });
}

// ── Helpers ──────────────────────────────────────────────

/**
 * Convert PipelineColumn[] to KanbanColumn[] for the KanbanBoard component
 */
export function toKanbanColumns(pipelineCols: PipelineColumn[]): KanbanColumn[] {
  return pipelineCols.map((col) => ({
    id: col.id,
    title: col.title,
    statuses: col.statuses,
  }));
}

/**
 * Hardcoded fallback columns (same as the old DealsList.tsx)
 * Used when no pipeline templates exist in the database yet
 */
export const FALLBACK_COLUMNS: KanbanColumn[] = [
  { id: "rascunho", title: "Rascunho", statuses: ["rascunho"] },
  { id: "enviado", title: "Enviado ao Jurídico", statuses: ["enviado_juridico"] },
  { id: "em_analise", title: "Em Análise", statuses: ["analise_documental", "aguardando_documentos", "parecer_em_elaboracao"] },
  { id: "elaboracao", title: "Elaboração / Validação", statuses: ["minuta_em_elaboracao", "em_validacao", "ajustes_pendentes", "aprovado_comercial"] },
  { id: "aprovado", title: "Aprovado", statuses: ["contrato_finalizado", "em_assinatura", "concluido"] },
  { id: "reprovado", title: "Reprovado", statuses: ["parecer_negativo", "cancelado"] },
];
