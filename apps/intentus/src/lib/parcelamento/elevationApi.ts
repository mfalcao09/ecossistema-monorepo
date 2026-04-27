/**
 * elevationApi.ts — cliente para Edge Function `development-elevation`
 *
 * Dispara fetch de Copernicus DEM 30m e popula elevation_grid no projeto.
 */

import { supabase } from "@/integrations/supabase/client";

export interface ElevationResponse {
  ok: true;
  development_id: string;
  elevation: {
    source: string;
    resolution: string;
    min: number;
    max: number;
    avg: number;
    slopeAvgPct: number;
    sampleCount: number;
    fetchedAt: string;
  };
}

export type Result<T> =
  | { ok: true; data: T; error?: never }
  | { ok: false; data?: never; error: { code: string; message: string } };

export async function triggerElevation(
  developmentId: string,
): Promise<Result<ElevationResponse>> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "development-elevation",
      { body: { action: "fetch_elevation", development_id: developmentId } },
    );
    if (error) {
      return {
        ok: false,
        error: { code: "EF_ERROR", message: error.message ?? "EF error" },
      };
    }
    if (data?.error) {
      return {
        ok: false,
        error: { code: "EF_BODY_ERROR", message: String(data.error) },
      };
    }
    return { ok: true, data: data as ElevationResponse };
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
