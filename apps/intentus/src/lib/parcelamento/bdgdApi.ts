/**
 * bdgdApi.ts — cliente para Edge Functions BDGD (ANEEL distribuição)
 *
 * Endpoints:
 *   - development-bdgd-proximity   : MT/BT/SUB no buffer 5/10km do projeto
 *                                    (auto Tier 1 → Tier 2 quando carregado)
 *   - development-bdgd-trigger-hd  : dispara GHA pra carregar Tier 2 HD
 */

import { supabase } from "@/integrations/supabase/client";

export type BDGDLayer = "mt" | "bt" | "sub";
export type BDGDTier = "t1" | "t2" | "mixed";
export type BDGDHDStatus = "idle" | "queued" | "loading" | "loaded" | "failed";

export interface BDGDProximityStats {
  mt_count: number;
  bt_count: number;
  sub_count: number;
  mt_length_m: number;
  bt_length_m: number;
}

export interface BDGDProximityResponse {
  ok: true;
  source_tier: BDGDTier;
  hd_loaded: boolean;
  hd_loaded_at: string | null;
  hd_buffer_km: number | null;
  hd_status: BDGDHDStatus;
  buffer_km: number;
  stats: BDGDProximityStats;
  features: {
    mt: GeoJSON.FeatureCollection;
    bt: GeoJSON.FeatureCollection;
    sub: GeoJSON.FeatureCollection;
  };
}

export interface BDGDTriggerHDResponse {
  ok: true;
  status: "queued";
  workflow: string;
  development_id: string;
  buffer_km: string;
  actions_url: string;
  already_in_progress?: boolean;
}

export type Result<T> =
  | { ok: true; data: T; error?: never }
  | { ok: false; data?: never; error: { code: string; message: string } };

export async function fetchBDGDProximity(
  developmentId: string,
  bufferKm = 10,
  layers: BDGDLayer[] = ["mt", "bt", "sub"],
): Promise<Result<BDGDProximityResponse>> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "development-bdgd-proximity",
      {
        body: { development_id: developmentId, buffer_km: bufferKm, layers },
      },
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
    return { ok: true, data: data as BDGDProximityResponse };
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

export async function triggerBDGDHd(
  developmentId: string,
  bufferKm = 5,
): Promise<Result<BDGDTriggerHDResponse>> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "development-bdgd-trigger-hd",
      {
        body: { development_id: developmentId, buffer_km: bufferKm },
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
    return { ok: true, data: data as BDGDTriggerHDResponse };
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
