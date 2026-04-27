/**
 * geoLayersApi.ts — Cliente para a Edge Function `development-geo-layers`
 *
 * ⚠️ IMPORTANTE (sessão 129): o nome real da EF no Supabase é
 * `development-geo-layers` (não `parcelamento-geo-layers`). O cliente antigo
 * apontava para um slug inexistente — por isso as influências nunca apareciam
 * no wizard. Esse arquivo foi reescrito para bater com o contrato real.
 *
 * A EF expõe 3 actions:
 *   - fetch_layers : dispara o fetch WFS de todas as camadas e cacheia em
 *                    `development_parcelamento_geo_layers`. Retorna SUMMARY
 *                    (feature_count por camada, erros parciais), mas NÃO o
 *                    GeoJSON completo.
 *   - get_layers   : lê o cache e retorna o GeoJSON de cada camada.
 *   - invalidate   : marca camadas como is_active=false (invalida cache).
 *
 * Layer keys REAIS suportados pela EF:
 *   - sigef_privado       (INCRA — imóveis certificados)
 *   - hidrografia         (IBGE — rios, lagos)
 *   - ibama_uc            (IBAMA — unidades de conservação)
 *   - rodovias_federais   (DNIT — faixas de domínio)
 *   - linhas_transmissao  (ANEEL — linhas de alta tensão)
 *
 * Fluxo recomendado para o novo dialog de criação:
 *   1. Usuário sobe KMZ → parse inline no frontend
 *   2. Cria projeto no banco (status: pendente)
 *   3. Salva geometria/bbox no projeto (status: em_processamento)
 *   4. Chama `triggerFetchLayers(developmentId)` — aguarda summary
 *   5. Chama `loadLayers(developmentId)` — obtém GeoJSONs do cache
 *   6. Com Turf.js, calcula área da interseção de cada camada vs terreno
 */

import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Chaves REAIS que a EF entende (alinhadas com o código de `development-geo-layers`) */
export type InfluenceLayerKey =
  | "sigef_privado"
  | "hidrografia"
  | "ibama_uc"
  | "rodovias_federais"
  | "linhas_transmissao" // legacy Overpass — fallback
  | "aneel_lt_existentes" // EPE oficial — base existente
  | "aneel_lt_planejadas" // EPE oficial — expansão planejada
  | "aneel_subestacoes"; // EPE oficial — existentes + planejadas

export const ALL_INFLUENCE_LAYERS: InfluenceLayerKey[] = [
  "sigef_privado",
  "hidrografia",
  "ibama_uc",
  "rodovias_federais",
  "aneel_lt_existentes",
  "aneel_lt_planejadas",
  "aneel_subestacoes",
];

/** Metadados humanos de cada camada — usado no UI para cards de influência */
export const INFLUENCE_LAYER_META: Record<
  InfluenceLayerKey,
  { label: string; shortLabel: string; color: string; description: string }
> = {
  sigef_privado: {
    label: "Imóveis certificados (SIGEF/INCRA)",
    shortLabel: "SIGEF",
    color: "#f59e0b",
    description:
      "Áreas já certificadas no INCRA — possível sobreposição fundiária",
  },
  hidrografia: {
    label: "Hidrografia (IBGE)",
    shortLabel: "Rios/Lagos",
    color: "#0ea5e9",
    description:
      "Cursos d'água — sujeitos a APP de 30-500 m (Código Florestal art. 4º)",
  },
  ibama_uc: {
    label: "Unidades de Conservação (IBAMA)",
    shortLabel: "UCs",
    color: "#16a34a",
    description: "Áreas protegidas — podem impedir ou restringir parcelamento",
  },
  rodovias_federais: {
    label: "Rodovias Federais (DNIT)",
    shortLabel: "Rodovias",
    color: "#ef4444",
    description:
      "Faixa de domínio e non aedificandi 15 m (Lei 6.766 art. 4º III)",
  },
  linhas_transmissao: {
    label: "Linhas Transmissão (OSM)",
    shortLabel: "LT-OSM",
    color: "#a855f7",
    description: "Fallback OSM — usar camadas EPE oficiais quando disponíveis",
  },
  aneel_lt_existentes: {
    label: "ANEEL — LT Existentes (EPE)",
    shortLabel: "LT Existente",
    color: "#a855f7",
    description:
      "Linhas de transmissão em operação — kV, concessionária, ano (fonte EPE)",
  },
  aneel_lt_planejadas: {
    label: "ANEEL — LT Planejadas (EPE)",
    shortLabel: "LT Planejada",
    color: "#f97316",
    description: "Expansão prevista do SIN — pode gerar servidão futura",
  },
  aneel_subestacoes: {
    label: "ANEEL — Subestações (EPE)",
    shortLabel: "Subestações",
    color: "#eab308",
    description:
      "Subestações existentes e planejadas — pontos de injeção/transformação",
  },
};

export interface FetchLayersSummaryItem {
  layer_key: string;
  feature_count: number;
  ok: boolean;
  error?: string;
  fetched_at: string;
}

export interface FetchLayersResponse {
  ok: true;
  development_id: string;
  fetched: number;
  total: number;
  layers: FetchLayersSummaryItem[];
}

export interface CachedLayerRow {
  id: string;
  layer_key: string;
  feature_count: number;
  fetched_at: string;
  is_active: boolean;
  geojson: GeoJSON.FeatureCollection | null;
}

export interface ApiError {
  code: string;
  message: string;
}

export type Result<T> =
  | { ok: true; data: T; error?: never }
  | { ok: false; data?: never; error: ApiError };

// ---------------------------------------------------------------------------
// 1) Trigger fetch — dispara busca WFS + cacheia
// ---------------------------------------------------------------------------

/**
 * Dispara a busca de camadas geoespaciais via EF `development-geo-layers`.
 * Retorna SUMMARY (contagem por camada). Não contém os GeoJSONs — use
 * `loadLayers` em seguida.
 *
 * @param developmentId UUID do projeto (já deve ter geometry/bbox salvos)
 * @param layers        Lista de camadas a buscar (default: todas)
 */
export async function triggerFetchLayers(
  developmentId: string,
  layers: InfluenceLayerKey[] = ALL_INFLUENCE_LAYERS,
): Promise<Result<FetchLayersResponse>> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "development-geo-layers",
      {
        body: {
          action: "fetch_layers",
          development_id: developmentId,
          layers,
        },
      },
    );

    if (error) {
      return {
        ok: false,
        error: {
          code: "EF_ERROR",
          message:
            error.message ?? "Erro na Edge Function development-geo-layers",
        },
      };
    }

    if (!data) {
      return {
        ok: false,
        error: { code: "NO_DATA", message: "Resposta vazia da Edge Function" },
      };
    }

    // EF pode retornar { error: "..." } mesmo com status 200
    if (data.error) {
      return {
        ok: false,
        error: {
          code: "EF_BODY_ERROR",
          message:
            typeof data.error === "string"
              ? data.error
              : "Erro no corpo da resposta",
        },
      };
    }

    return {
      ok: true,
      data: data as FetchLayersResponse,
    };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "UNEXPECTED",
        message: err instanceof Error ? err.message : "Erro inesperado",
      },
    };
  }
}

// ---------------------------------------------------------------------------
// 2) Load layers — lê cache e retorna GeoJSONs completos
// ---------------------------------------------------------------------------

/**
 * Carrega camadas cacheadas do cache (tabela `development_parcelamento_geo_layers`).
 * Retorna apenas camadas ativas, mais recentes primeiro.
 */
export async function loadLayers(
  developmentId: string,
): Promise<Result<CachedLayerRow[]>> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "development-geo-layers",
      {
        body: {
          action: "get_layers",
          development_id: developmentId,
        },
      },
    );

    if (error) {
      return {
        ok: false,
        error: {
          code: "EF_ERROR",
          message: error.message ?? "Erro ao carregar camadas",
        },
      };
    }

    if (!data) {
      return { ok: true, data: [] };
    }

    if (data.error) {
      return {
        ok: false,
        error: {
          code: "EF_BODY_ERROR",
          message:
            typeof data.error === "string"
              ? data.error
              : "Erro no corpo da resposta",
        },
      };
    }

    // EF retorna { data: [...] } ou { ok, data } dependendo da versão
    const rows = (data.data ?? data.layers ?? []) as CachedLayerRow[];
    return { ok: true, data: rows };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "UNEXPECTED",
        message: err instanceof Error ? err.message : "Erro inesperado",
      },
    };
  }
}

// ---------------------------------------------------------------------------
// 3) Invalidate — limpa cache
// ---------------------------------------------------------------------------

export async function invalidateLayers(
  developmentId: string,
  layerKey?: InfluenceLayerKey,
): Promise<Result<{ invalidated: string }>> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "development-geo-layers",
      {
        body: {
          action: "invalidate",
          development_id: developmentId,
          ...(layerKey ? { layer_key: layerKey } : {}),
        },
      },
    );

    if (error) {
      return {
        ok: false,
        error: {
          code: "EF_ERROR",
          message: error.message ?? "Erro ao invalidar",
        },
      };
    }

    return {
      ok: true,
      data: { invalidated: data?.invalidated ?? "all" },
    };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "UNEXPECTED",
        message: err instanceof Error ? err.message : "Erro inesperado",
      },
    };
  }
}

// ---------------------------------------------------------------------------
// 4) Helper: fetch + load em sequência (conveniência para o dialog)
// ---------------------------------------------------------------------------

/**
 * Conveniência: dispara fetch_layers, aguarda, e lê get_layers em seguida.
 * Use este helper no fluxo de criação de projeto (novo dialog).
 *
 * Retorna `{ summary, layers }` — summary tem contagem por camada, layers
 * tem os GeoJSONs completos prontos para usar com Turf.js.
 */
export async function fetchAndLoadAllLayers(developmentId: string): Promise<
  Result<{
    summary: FetchLayersResponse;
    layers: CachedLayerRow[];
  }>
> {
  const fetchResult = await triggerFetchLayers(developmentId);
  if (!fetchResult.ok) return fetchResult;

  const loadResult = await loadLayers(developmentId);
  if (!loadResult.ok) return loadResult;

  return {
    ok: true,
    data: {
      summary: fetchResult.data,
      layers: loadResult.data,
    },
  };
}

// ---------------------------------------------------------------------------
// 5) Backward-compat shim — `fetchGeoLayer` (usado por ParcelamentoDetalhe)
// ---------------------------------------------------------------------------

/**
 * Compat shim para o contrato antigo `fetchGeoLayer(devId, key, bbox)` que
 * ainda é usado pelo `ParcelamentoDetalhe.tsx`. Internamente dispara
 * `fetch_layers` + `get_layers` e devolve apenas o GeoJSON da camada pedida
 * no formato antigo `{ geojson }`.
 *
 * ⚠️ O parâmetro `bbox` é ignorado — a EF real deriva a bbox da geometria
 * do próprio development. Mantemos na assinatura só para não quebrar o
 * call-site existente.
 *
 * Novo código deve usar `triggerFetchLayers` + `loadLayers` ou
 * `fetchAndLoadAllLayers` direto.
 */
export async function fetchGeoLayer(
  developmentId: string,
  layerKey: InfluenceLayerKey,
  _bbox?: BBox,
): Promise<
  Result<{ geojson: GeoJSON.FeatureCollection; feature_count: number }>
> {
  // 1) dispara fetch só da camada pedida
  const fetchResult = await triggerFetchLayers(developmentId, [layerKey]);
  if (!fetchResult.ok) return fetchResult;

  // 2) lê cache
  const loadResult = await loadLayers(developmentId);
  if (!loadResult.ok) return loadResult;

  // 3) filtra a camada pedida
  const row = loadResult.data.find(
    (r) => r.layer_key === layerKey && r.is_active,
  );

  const geojson: GeoJSON.FeatureCollection = row?.geojson ?? {
    type: "FeatureCollection",
    features: [],
  };

  return {
    ok: true,
    data: {
      geojson,
      feature_count: row?.feature_count ?? 0,
    },
  };
}
