/**
 * contoursApi.ts — cliente Edge Function `development-contours`
 *
 * Gera curvas de nível via ArcGIS Esri Profile GPServer + marching squares.
 */

import { supabase } from "@/integrations/supabase/client";

export interface ContoursStats {
  elev_min: number;
  elev_max: number;
  elev_range: number;
  sample_count: number;
  feature_count: number;
  interval_m: number;
  dem_resolution: string;
}

export interface ContoursResponse {
  ok: true;
  development_id: string;
  stats: ContoursStats;
  geojson: GeoJSON.FeatureCollection;
}

export type Result<T> =
  | { ok: true; data: T; error?: never }
  | { ok: false; data?: never; error: { code: string; message: string } };

export async function generateContours(
  developmentId: string,
  intervalM = 5,
  demResolution: "10m" | "30m" | "90m" = "30m",
): Promise<Result<ContoursResponse>> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "development-contours",
      {
        body: {
          development_id: developmentId,
          interval_m: intervalM,
          dem_resolution: demResolution,
        },
      },
    );
    if (error) {
      return {
        ok: false,
        error: { code: "EF_ERROR", message: error.message ?? "EF error" },
      };
    }
    if (data?.error) {
      const code = (data.code as string) ?? "EF_BODY_ERROR";
      return { ok: false, error: { code, message: String(data.error) } };
    }
    return { ok: true, data: data as ContoursResponse };
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

/** Lê curvas cacheadas (sem regerar) */
export async function loadCachedContours(developmentId: string): Promise<
  Result<{
    geojson: GeoJSON.FeatureCollection;
    stats: ContoursStats;
    generated_at: string;
  } | null>
> {
  try {
    const { data, error } = await supabase
      .from("development_contours")
      .select(
        "geojson, interval_m, dem_resolution, elev_min, elev_max, feature_count, generated_at",
      )
      .eq("development_id", developmentId)
      .maybeSingle();

    if (error) {
      return {
        ok: false,
        error: { code: "DB_ERROR", message: error.message },
      };
    }
    if (!data) return { ok: true, data: null };

    return {
      ok: true,
      data: {
        geojson: data.geojson as GeoJSON.FeatureCollection,
        stats: {
          elev_min: data.elev_min,
          elev_max: data.elev_max,
          elev_range: data.elev_max - data.elev_min,
          sample_count: 0,
          feature_count: data.feature_count,
          interval_m: data.interval_m,
          dem_resolution: data.dem_resolution,
        },
        generated_at: data.generated_at,
      },
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
