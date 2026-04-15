/**
 * useParcelamentoProjects — Camada de dados do módulo Parcelamento de Solo
 *
 * Este arquivo expõe 7 hooks (4 queries + 3 mutations) para as 5 páginas
 * do módulo: Dashboard, Detalhe, Novo (wizard), Financeiro, Conformidade.
 *
 * Padrão: React Query + Supabase + tenantId (RLS double-check).
 *
 * Criado na sessão 126 para restaurar funcionalidade perdida da Fase 3 —
 * o arquivo original nunca foi commitado ao repositório, apesar da memória
 * dizer que estava pronto. Inferido a partir do uso real nas 5 páginas.
 *
 * Regras CLAUDE.md aplicadas:
 *  - `.maybeSingle()` ao invés de `.single()` (evita crash PGRST116)
 *  - `.eq("tenant_id", tenantId!)` em todas as queries (defesa em profundidade)
 *  - Queries bloqueadas com `enabled: !!tenantId` até o auth carregar
 *  - Invalidate de cache após cada mutation
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type {
  ParcelamentoDevelopment,
  ParcelamentoFinancial,
  ParcelamentoCompliance,
  CreateParcelamentoProjectPayload,
  UpdateParcelamentoGeometryPayload,
  SaveAnalysisResultsPayload,
  UpdateParcelamentoParamsPayload,
  ParcelamentoTipo,
  LegalAnalysisResult,
  LegalAnalysisCached,
} from "@/lib/parcelamento/types";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/**
 * Tipos de `developments` considerados "parcelamento de solo" (horizontais).
 * Excluímos incorporações verticais que usam a mesma tabela.
 */
const PARCELAMENTO_TIPOS: ParcelamentoTipo[] = [
  "loteamento",
  "condominio",
];

/** Tempo de cache default — 5 min, alinhado com outros hooks do projeto */
const DEFAULT_STALE_TIME = 5 * 60_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formata um par [lon, lat] no padrão WKT (lon lat — ordem inversa do
 * GeoJSON que usa [lon, lat] em array mas WKT escreve "lon lat" com espaço).
 * Usa até 8 casas decimais — suficiente pra precisão sub-centimétrica em 4326.
 */
function formatCoord(coord: number[]): string {
  const lon = Number(coord[0]).toFixed(8).replace(/\.?0+$/, "");
  const lat = Number(coord[1]).toFixed(8).replace(/\.?0+$/, "");
  return `${lon} ${lat}`;
}

/**
 * Converte um GeoJSON MultiPolygon em EWKT (Extended Well-Known Text) que o
 * input de `geography(MultiPolygon, 4326)` do PostGIS aceita nativamente.
 *
 * Formato de saída:
 *   SRID=4326;MULTIPOLYGON(((lon lat,lon lat,...),(hole1),...),((poly2)...))
 *
 * Por que não mandar GeoJSON direto? PostgREST serializa o objeto como JSON
 * text e o geography_in do Postgres tenta parsear como EWKT/HEX, falhando
 * com "parse error - invalid geometry". EWKT é o formato canônico de input.
 */
function multiPolygonToEwkt(mp: GeoJSON.MultiPolygon): string {
  const polys = mp.coordinates
    .map((poly) => {
      const rings = poly
        .map((ring) => `(${ring.map(formatCoord).join(",")})`)
        .join(",");
      return `(${rings})`;
    })
    .join(",");
  return `SRID=4326;MULTIPOLYGON(${polys})`;
}

/**
 * Converte um GeoJSON Point em EWKT aceito por `geography(Point, 4326)`.
 *
 * Formato: `SRID=4326;POINT(lon lat)`
 */
function pointToEwkt(p: GeoJSON.Point): string {
  return `SRID=4326;POINT(${formatCoord(p.coordinates)})`;
}

/**
 * Query keys centralizadas — facilita invalidação e evita erros de digitação.
 * Todo queryKey de parcelamento começa com `"parcelamento"`.
 */
export const parcelamentoQueryKeys = {
  all: ["parcelamento"] as const,
  projects: (tenantId: string | null) =>
    ["parcelamento", "projects", tenantId] as const,
  project: (tenantId: string | null, id: string | null) =>
    ["parcelamento", "project", tenantId, id] as const,
  financial: (tenantId: string | null, projectId: string | null) =>
    ["parcelamento", "financial", tenantId, projectId] as const,
  compliance: (tenantId: string | null, projectId: string | null) =>
    ["parcelamento", "compliance", tenantId, projectId] as const,
  deepPremises: (scenarioId: string | null) =>
    ["parcelamento", "deep_premises", scenarioId] as const,
};

// ===========================================================================
// QUERIES (READ)
// ===========================================================================

/**
 * Lista todos os projetos de parcelamento do tenant (não-deletados).
 * Usado em: `ParcelamentoDashboard.tsx`.
 *
 * Ordena por `updated_at DESC` para que projetos recém-editados
 * apareçam no topo do grid de cards.
 * Sessão 147 (Bloco L): filtra `deleted_at IS NULL` para excluir lixeira.
 */
export function useParcelamentoProjects() {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: parcelamentoQueryKeys.projects(tenantId),
    enabled: !!tenantId,
    staleTime: DEFAULT_STALE_TIME,
    queryFn: async (): Promise<ParcelamentoDevelopment[]> => {
      const { data, error } = await supabase
        .from("developments")
        .select("*")
        .eq("tenant_id", tenantId!)
        .in("tipo", PARCELAMENTO_TIPOS)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as ParcelamentoDevelopment[];
    },
  });
}

/**
 * Lista projetos na lixeira (deleted_at IS NOT NULL) do tenant.
 * Usado em: `ParcelamentoLixeira.tsx`.
 * Sessão 147 (Bloco L).
 */
export function useTrashedParcelamentoProjects() {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["parcelamento", "trashed", tenantId],
    enabled: !!tenantId,
    staleTime: DEFAULT_STALE_TIME,
    queryFn: async (): Promise<ParcelamentoDevelopment[]> => {
      const { data, error } = await supabase
        .from("developments")
        .select("*")
        .eq("tenant_id", tenantId!)
        .in("tipo", PARCELAMENTO_TIPOS)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as ParcelamentoDevelopment[];
    },
  });
}

/**
 * Carrega um projeto específico pelo ID.
 * Usado em: `ParcelamentoDetalhe`, `ParcelamentoConformidade`, `ParcelamentoFinanceiro`.
 *
 * Retorna `null` quando `id` é null (ex: rota ainda carregando) ou
 * quando não encontra a linha — nunca dá throw por "0 rows".
 */
export function useParcelamentoProject(id: string | null) {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: parcelamentoQueryKeys.project(tenantId, id),
    enabled: !!tenantId && !!id,
    staleTime: DEFAULT_STALE_TIME,
    queryFn: async (): Promise<ParcelamentoDevelopment | null> => {
      const { data, error } = await supabase
        .from("developments")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("id", id!)
        .maybeSingle();

      if (error) throw error;
      return (data as unknown as ParcelamentoDevelopment) ?? null;
    },
  });
}

/**
 * Carrega o cenário financeiro ATIVO do projeto.
 * Usado em: `ParcelamentoFinanceiro.tsx`.
 *
 * Nota: a Fase 5 suporta múltiplos cenários simultâneos (conservador,
 * realista, otimista). Este hook retorna apenas o "ativo" — o componente
 * das abas de comparação vai precisar de um hook adicional que retorne
 * um array. Por enquanto, só o ativo é suficiente para os KPIs do header.
 */
export function useParcelamentoFinancial(projectId: string | null) {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: parcelamentoQueryKeys.financial(tenantId, projectId),
    enabled: !!tenantId && !!projectId,
    staleTime: DEFAULT_STALE_TIME,
    queryFn: async (): Promise<ParcelamentoFinancial | null> => {
      const { data, error } = await supabase
        .from("development_parcelamento_financial")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("development_id", projectId!)
        .eq("is_active", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return (data as unknown as ParcelamentoFinancial) ?? null;
    },
  });
}

/**
 * Carrega TODOS os registros financeiros (cenários) de um projeto.
 * Usado em: `TabComparacao.tsx` para exibir comparativo lado-a-lado.
 *
 * Retorna todos os cenários ativos (is_active=true) ordenados por scenario_type.
 * Diferente de `useParcelamentoFinancial` que retorna apenas o mais recente.
 */
export function useAllParcelamentoFinancials(projectId: string | null) {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["parcelamento", "all_financials", tenantId, projectId],
    enabled: !!tenantId && !!projectId,
    staleTime: DEFAULT_STALE_TIME,
    queryFn: async (): Promise<ParcelamentoFinancial[]> => {
      const { data, error } = await supabase
        .from("development_parcelamento_financial")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("development_id", projectId!)
        .eq("is_active", true)
        .eq("is_calculated", true)
        .order("scenario_type", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as ParcelamentoFinancial[];
    },
  });
}

/**
 * Carrega todos os itens do checklist de conformidade legal.
 * Usado em: `ParcelamentoConformidade.tsx`.
 *
 * Filtra `is_active=true` para não mostrar itens arquivados de avaliações
 * anteriores. Ordena por `check_key` para garantir ordem estável no render.
 */
export function useParcelamentoCompliance(projectId: string | null) {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: parcelamentoQueryKeys.compliance(tenantId, projectId),
    enabled: !!tenantId && !!projectId,
    staleTime: DEFAULT_STALE_TIME,
    queryFn: async (): Promise<ParcelamentoCompliance[]> => {
      const { data, error } = await supabase
        .from("development_parcelamento_compliance")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("development_id", projectId!)
        .eq("is_active", true)
        .order("check_key", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as ParcelamentoCompliance[];
    },
  });
}

// ===========================================================================
// LEGAL ANALYSIS (Bloco B — Fase 5)
// ===========================================================================

/**
 * Busca a análise legal mais recente de um projeto.
 */
export function useLatestLegalAnalysis(projectId: string | null) {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["parcelamento", "legal_analysis", tenantId, projectId],
    enabled: !!tenantId && !!projectId,
    staleTime: DEFAULT_STALE_TIME,
    queryFn: async (): Promise<LegalAnalysisCached | null> => {
      const { data, error } = await supabase
        .from("parcelamento_legal_analyses")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("development_id", projectId!)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as LegalAnalysisCached | null;
    },
  });
}

/**
 * Executa análise legal via EF parcelamento-legal-analysis.
 * Retorna resultado completo e invalida cache.
 */
export function useRunLegalAnalysis() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      developmentId: string;
      analysisType?: "lei_6766" | "lei_4591" | "completa";
    }): Promise<LegalAnalysisResult> => {
      if (!tenantId) throw new Error("Tenant não identificado");

      const { data, error } = await supabase.functions.invoke(
        "parcelamento-legal-analysis",
        {
          body: {
            action: "analyze",
            tenant_id: tenantId,
            development_id: args.developmentId,
            analysis_type: args.analysisType || "completa",
          },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error.message || "Erro na análise legal");
      return data as LegalAnalysisResult;
    },
    onSuccess: (_data, args) => {
      queryClient.invalidateQueries({
        queryKey: ["parcelamento", "legal_analysis", tenantId, args.developmentId],
      });
      queryClient.invalidateQueries({
        queryKey: parcelamentoQueryKeys.compliance(tenantId, args.developmentId),
      });
    },
  });
}

// ===========================================================================
// MUTATIONS (WRITE)
// ===========================================================================

/**
 * Cria um novo projeto de parcelamento (Step 1 do wizard).
 * Usado em: `ParcelamentoNovo.tsx`.
 *
 * Retorna o projeto recém-criado (com id gerado) para que o wizard
 * possa usar esse id nos Steps 2, 3 e 4.
 */
export function useCreateParcelamentoProject() {
  const { tenantId, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      payload: CreateParcelamentoProjectPayload
    ): Promise<ParcelamentoDevelopment> => {
      if (!tenantId) throw new Error("Tenant não identificado");
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("developments")
        .insert({
          tenant_id: tenantId,
          created_by: user.id, // coluna real do schema (NOT NULL, sem default)
          name: payload.name,
          tipo: payload.tipo,
          state: payload.state,
          city: payload.city,
          analysis_status: "rascunho",
        })
        .select("*")
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Falha ao criar projeto — sem retorno");
      return data as unknown as ParcelamentoDevelopment;
    },
    onSuccess: () => {
      // Invalida lista do dashboard para mostrar o novo projeto
      queryClient.invalidateQueries({
        queryKey: parcelamentoQueryKeys.projects(tenantId),
      });
    },
  });
}

/**
 * Atualiza a geometria + bbox do projeto (Step 2 do wizard, após parse KML/KMZ).
 * Usado em: `ParcelamentoNovo.tsx`.
 *
 * Muda o `analysis_status` para `"em_processamento"` para sinalizar ao
 * usuário que as EFs geoespaciais estão processando elevação, declividade,
 * APPs, reserva legal etc.
 */
export function useUpdateParcelamentoGeometry() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      payload: UpdateParcelamentoGeometryPayload
    ): Promise<void> => {
      if (!tenantId) throw new Error("Tenant não identificado");

      // As colunas `geometry` e `centroid` são `geography(_, 4326)` no schema.
      // PostgREST NÃO converte GeoJSON automaticamente pra geography — quando
      // mandamos um objeto JSON, o Postgres recebe o text e tenta parsear como
      // EWKT/HEX pelo geography_in, falha, retorna "parse error - invalid
      // geometry". A solução é serializar no cliente pra EWKT (string):
      //     "SRID=4326;MULTIPOLYGON(((lon lat, lon lat, ...)))"
      // O input de geography aceita esse formato nativamente.

      const rawGeom =
        payload.geometry.type === "Feature"
          ? payload.geometry.geometry
          : (payload.geometry as unknown as GeoJSON.Polygon | GeoJSON.MultiPolygon);

      const multiPolygon: GeoJSON.MultiPolygon =
        rawGeom.type === "MultiPolygon"
          ? rawGeom
          : {
              type: "MultiPolygon",
              coordinates: [rawGeom.coordinates],
            };

      // Centróide aproximado = centro do bbox (coluna `centroid` é
      // geography(Point, 4326), nullable — vale a pena preencher pra reverse
      // geocoding/mapas).
      const centroidPoint: GeoJSON.Point = {
        type: "Point",
        coordinates: [
          (payload.bbox.west + payload.bbox.east) / 2,
          (payload.bbox.south + payload.bbox.north) / 2,
        ],
      };

      const multiPolygonEwkt = multiPolygonToEwkt(multiPolygon);
      const centroidEwkt = pointToEwkt(centroidPoint);

      // area_ha é coluna separada no schema — preencher por conveniência
      const area_ha = payload.area_m2 != null ? payload.area_m2 / 10_000 : null;

      const { error } = await supabase
        .from("developments")
        .update({
          geometry: multiPolygonEwkt as unknown as object,
          centroid: centroidEwkt as unknown as object,
          bbox: payload.bbox as unknown as object,
          area_m2: payload.area_m2 ?? null,
          area_ha,
          perimeter_m: payload.perimeter_m ?? null,
          source_file_format: payload.file_format ?? null,
          // Mantém "rascunho" até o wizard ser concluído no Step 4.
          analysis_status: "rascunho",
        })
        .eq("tenant_id", tenantId)
        .eq("id", payload.projectId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: parcelamentoQueryKeys.project(tenantId, variables.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: parcelamentoQueryKeys.projects(tenantId),
      });
    },
  });
}

/**
 * Atualiza localização (Step 3) e parâmetros urbanísticos (Step 4) declarados
 * no novo wizard (Sessão 130). Quando `finalize=true`, marca `analysis_status`
 * como `"em_analise"` — isso sinaliza que o projeto saiu do estado "rascunho"
 * e já pode ser listado no dashboard como "Em Análise".
 *
 * Usado em: `NovoProjetoDialog.tsx` (Step 4 — Concluir).
 */
export function useUpdateParcelamentoParams() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      payload: UpdateParcelamentoParamsPayload
    ): Promise<void> => {
      if (!tenantId) throw new Error("Tenant não identificado");

      // Monta objeto de update apenas com os campos passados (undefined é ignorado).
      // Isso permite chamar o hook tanto para Step 3 sozinho quanto Step 3+4 juntos.
      const updateData: Record<string, unknown> = {};
      if (payload.city !== undefined) updateData.city = payload.city;
      if (payload.state !== undefined) updateData.state = payload.state;
      if (payload.description !== undefined)
        updateData.description = payload.description;
      if (payload.tipo_parcelamento !== undefined)
        updateData.tipo_parcelamento = payload.tipo_parcelamento;
      if (payload.padrao_empreendimento !== undefined)
        updateData.padrao_empreendimento = payload.padrao_empreendimento;
      if (payload.pct_area_publica !== undefined)
        updateData.pct_area_publica = payload.pct_area_publica;
      if (payload.pct_area_verde !== undefined)
        updateData.pct_area_verde = payload.pct_area_verde;
      if (payload.pct_sistema_viario !== undefined)
        updateData.pct_sistema_viario = payload.pct_sistema_viario;
      if (payload.pct_app_declarado !== undefined)
        updateData.pct_app_declarado = payload.pct_app_declarado;
      if (payload.lote_minimo_m2 !== undefined)
        updateData.lote_minimo_m2 = payload.lote_minimo_m2;

      // Quando "finalize", promove de "rascunho" para "em_analise"
      if (payload.finalize) {
        updateData.analysis_status = "em_analise";
      }

      const { error } = await supabase
        .from("developments")
        .update(updateData)
        .eq("tenant_id", tenantId)
        .eq("id", payload.projectId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: parcelamentoQueryKeys.project(tenantId, variables.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: parcelamentoQueryKeys.projects(tenantId),
      });
    },
  });
}

// ===========================================================================
// BLOCO L — MUTATIONS (Sessão 147)
// ===========================================================================

/**
 * Mapa de transições de status permitidas (negócio).
 * Somente projetos "concluido" podem ser promovidos a status de decisão.
 */
export const ALLOWED_STATUS_TRANSITIONS: Partial<Record<import("@/lib/parcelamento/types").AnalysisStatus, import("@/lib/parcelamento/types").AnalysisStatus[]>> = {
  concluido: ["viavel", "rejeitado", "monitorando"],
  viavel: ["monitorando", "rejeitado"],
  rejeitado: ["monitorando"],
  monitorando: ["viavel", "rejeitado"],
};

/**
 * Muda o status de negócio de um projeto de parcelamento.
 * Valida a transição antes de persistir.
 * Sessão 147 (Bloco L — US-15).
 */
export function useUpdateProjectStatus() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      projectId: string;
      currentStatus: import("@/lib/parcelamento/types").AnalysisStatus;
      newStatus: import("@/lib/parcelamento/types").AnalysisStatus;
    }): Promise<void> => {
      if (!tenantId) throw new Error("Tenant não identificado");

      const allowed = ALLOWED_STATUS_TRANSITIONS[args.currentStatus] ?? [];
      if (!allowed.includes(args.newStatus)) {
        throw new Error(
          `Transição inválida: ${args.currentStatus} → ${args.newStatus}`
        );
      }

      const { error } = await supabase
        .from("developments")
        .update({ analysis_status: args.newStatus })
        .eq("tenant_id", tenantId)
        .eq("id", args.projectId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: parcelamentoQueryKeys.project(tenantId, variables.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: parcelamentoQueryKeys.projects(tenantId),
      });
    },
  });
}

/**
 * Move um projeto para a lixeira (soft delete: seta deleted_at).
 * Sessão 147 (Bloco L — US-16).
 */
export function useTrashProject() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string): Promise<void> => {
      if (!tenantId) throw new Error("Tenant não identificado");

      const { error } = await supabase
        .from("developments")
        .update({ deleted_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("id", projectId)
        .is("deleted_at", null); // Só deleta se ainda não estiver na lixeira

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: parcelamentoQueryKeys.projects(tenantId),
      });
      queryClient.invalidateQueries({
        queryKey: ["parcelamento", "trashed", tenantId],
      });
    },
  });
}

/**
 * Restaura um projeto da lixeira (seta deleted_at = NULL).
 * Sessão 147 (Bloco L — US-17).
 */
export function useRestoreProject() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string): Promise<void> => {
      if (!tenantId) throw new Error("Tenant não identificado");

      const { error } = await supabase
        .from("developments")
        .update({ deleted_at: null })
        .eq("tenant_id", tenantId)
        .eq("id", projectId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: parcelamentoQueryKeys.projects(tenantId),
      });
      queryClient.invalidateQueries({
        queryKey: ["parcelamento", "trashed", tenantId],
      });
    },
  });
}

/**
 * Salva os resultados finais da análise (Step 4 do wizard).
 * Usado em: `ParcelamentoNovo.tsx`.
 *
 * Muda `analysis_status` para `"concluido"` e grava o JSONB
 * `analysis_results` com o score de viabilidade e sub-resultados.
 */
export function useSaveAnalysisResults() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SaveAnalysisResultsPayload): Promise<void> => {
      if (!tenantId) throw new Error("Tenant não identificado");

      const { error } = await supabase
        .from("developments")
        .update({
          analysis_results: payload.analysis_results as unknown as object,
          vgv_estimado: payload.vgv_estimado ?? null,
          total_units: payload.total_units ?? null,
          analysis_status: "concluido",
        })
        .eq("tenant_id", tenantId)
        .eq("id", payload.projectId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: parcelamentoQueryKeys.project(tenantId, variables.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: parcelamentoQueryKeys.projects(tenantId),
      });
    },
  });
}
