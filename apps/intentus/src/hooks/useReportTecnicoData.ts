/**
 * useReportTecnicoData — Hook que busca TODOS os dados para o relatório técnico PDF
 * Sessão 146 — Bloco K
 *
 * Chama as Edge Functions em paralelo e consolida os resultados
 * em um objeto compatível com ReportTecnicoPDFProps.
 *
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ParcelamentoDevelopment, ParcelamentoFinancial, LegalAnalysisCached } from "@/lib/parcelamento/types";
import type { ItbiResult, OutorgaResult, LeiVerdeResult, CnpjSpeResult } from "@/lib/parcelamento/brazil-regulations-types";
import type { SinapiResult, SecoviResult, AbraincResult } from "@/lib/parcelamento/market-benchmarks-types";
import type { CensusIncomeItem, CensusDemographicsItem, CensusHousingItem } from "@/lib/parcelamento/ibge-census-types";
import type { CheckIbamaResult, CheckICMBioResult } from "@/lib/parcelamento/environmental-embargoes-types";
import type { MapBiomasYearResult, TimeSeriesTrend } from "@/lib/parcelamento/mapbiomas-types";
import type { MatriculaRecord } from "@/lib/parcelamento/cri-matricula-types";
import type { ZoneamentoPDFData, MemorialPDFData, FiiCraPDFData } from "@/pages/parcelamento/pdf-tecnico/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportTecnicoDataResult {
  financial: ParcelamentoFinancial | null;
  legalAnalysis: LegalAnalysisCached | null;
  itbi: ItbiResult | null;
  outorga: OutorgaResult | null;
  leiVerde: LeiVerdeResult | null;
  cnpjSpe: CnpjSpeResult | null;
  sinapi: SinapiResult | null;
  secovi: SecoviResult | null;
  abrainc: AbraincResult | null;
  censusIncome: CensusIncomeItem[] | null;
  censusDemographics: CensusDemographicsItem[] | null;
  censusHousing: CensusHousingItem[] | null;
  ibamaResult: CheckIbamaResult | null;
  icmbioResult: CheckICMBioResult | null;
  mapBiomasLatest: MapBiomasYearResult | null;
  mapBiomasTrend: TimeSeriesTrend | null;
  zoneamento: ZoneamentoPDFData | null;
  memorial: MemorialPDFData | null;
  matriculas: MatriculaRecord[] | null;
  fiiCra: FiiCraPDFData | null;
}

// ---------------------------------------------------------------------------
// EF Helpers — cada uma retorna null em caso de erro (graceful degradation)
// ---------------------------------------------------------------------------

async function callEF<T>(fnName: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    const { data, error } = await supabase.functions.invoke(fnName, { body });
    if (error || data?.error) return null;
    return data as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useReportTecnicoData() {
  const [data, setData] = useState<ReportTecnicoDataResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (project: ParcelamentoDevelopment, tenantId: string) => {
    setIsLoading(true);
    setProgress(0);
    setError(null);

    const city = project.city ?? "";
    const state = project.state ?? "";
    const devId = project.id;
    let completed = 0;
    const total = 13; // number of parallel fetch groups

    const tick = () => {
      completed++;
      setProgress(Math.round((completed / total) * 100));
    };

    try {
      // 1) Financial (DB query, not EF)
      const financialPromise = supabase
        .from("development_parcelamento_financial")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("development_id", devId)
        .eq("is_active", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data: d }) => {
          tick();
          return (d as unknown as ParcelamentoFinancial) ?? null;
        });

      // 2) Legal Analysis (DB query)
      const legalPromise = supabase
        .from("parcelamento_legal_analyses")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("development_id", devId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data: d }) => {
          tick();
          return (d as unknown as LegalAnalysisCached) ?? null;
        });

      // 3) Brazil Regulations — 4 actions
      const regulationsPromise = Promise.all([
        callEF<ItbiResult>("brazil-regulations", {
          action: "calc_itbi",
          municipio: city,
          uf: state,
          valor_terreno: project.area_m2 ? project.area_m2 * 200 : 0,
          vgv_total: project.vgv_estimado ?? 0,
          development_id: devId,
        }),
        callEF<OutorgaResult>("brazil-regulations", {
          action: "calc_outorga",
          municipio: city,
          uf: state,
          area_terreno_m2: project.area_m2 ?? 0,
          development_id: devId,
        }),
        callEF<LeiVerdeResult>("brazil-regulations", {
          action: "check_lei_verde",
          municipio: city,
          uf: state,
          area_terreno_m2: project.area_m2 ?? 0,
          development_id: devId,
        }),
        callEF<CnpjSpeResult>("brazil-regulations", {
          action: "validate_cnpj_spe",
          cnpj: project.cnpj_spe ?? "",
          development_id: devId,
        }),
      ]).then(([itbi, outorga, leiVerde, cnpjSpe]) => {
        tick();
        return { itbi, outorga, leiVerde, cnpjSpe };
      });

      // 4) Market Benchmarks
      const benchmarksPromise = Promise.all([
        callEF<SinapiResult>("market-benchmarks", { action: "fetch_sinapi", uf: state }),
        callEF<SecoviResult>("market-benchmarks", { action: "fetch_secovi", cidade: city, uf: state }),
        callEF<AbraincResult>("market-benchmarks", { action: "fetch_abrainc" }),
      ]).then(([sinapi, secovi, abrainc]) => {
        tick();
        return { sinapi, secovi, abrainc };
      });

      // 5) Census
      const censusPromise = Promise.all([
        callEF<{ items: CensusIncomeItem[] }>("ibge-census", { action: "fetch_census_income", municipio: city, uf: state }),
        callEF<{ items: CensusDemographicsItem[] }>("ibge-census", { action: "fetch_census_demographics", municipio: city, uf: state }),
        callEF<{ items: CensusHousingItem[] }>("ibge-census", { action: "fetch_census_housing", municipio: city, uf: state }),
      ]).then(([inc, dem, hou]) => {
        tick();
        return {
          censusIncome: inc?.items ?? null,
          censusDemographics: dem?.items ?? null,
          censusHousing: hou?.items ?? null,
        };
      });

      // 6) Environmental Embargoes
      const embargoesPromise = Promise.all([
        callEF<CheckIbamaResult>("environmental-embargoes", {
          action: "check_ibama_embargoes",
          latitude: project.centroid_lat ?? 0,
          longitude: project.centroid_lng ?? 0,
          raio_km: 10,
        }),
        callEF<CheckICMBioResult>("environmental-embargoes", {
          action: "check_icmbio_embargoes",
          latitude: project.centroid_lat ?? 0,
          longitude: project.centroid_lng ?? 0,
          raio_km: 10,
        }),
      ]).then(([ibama, icmbio]) => {
        tick();
        return { ibamaResult: ibama, icmbioResult: icmbio };
      });

      // 7) MapBiomas
      const mapBiomasPromise = callEF<{
        land_use?: MapBiomasYearResult;
        time_series?: TimeSeriesTrend;
      }>("development-mapbiomas", {
        action: "get_cached",
        development_id: devId,
      }).then((result) => {
        tick();
        return {
          mapBiomasLatest: result?.land_use ?? null,
          mapBiomasTrend: result?.time_series ?? null,
        };
      });

      // 8) Zoneamento (DB query)
      const zoneamentoPromise = supabase
        .from("parcelamento_zoneamento")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("development_id", devId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data: z }) => {
          tick();
          if (!z) return null;
          const rec = z as Record<string, unknown>;
          return {
            municipio: (rec.municipio as string) ?? city,
            zona: rec.zona as string,
            classificacao: rec.classificacao as string,
            uso_permitido: rec.uso_permitido as string,
            lei_municipal: rec.lei_municipal as string,
            coeficiente_aproveitamento: rec.coeficiente_aproveitamento as ZoneamentoPDFData["coeficiente_aproveitamento"],
            gabarito: rec.gabarito as ZoneamentoPDFData["gabarito"],
            recuos: rec.recuos as ZoneamentoPDFData["recuos"],
            taxa_ocupacao_max: rec.taxa_ocupacao_max as number | undefined,
            taxa_permeabilidade_min: rec.taxa_permeabilidade_min as number | undefined,
            observacoes: rec.observacoes as string | undefined,
          } as ZoneamentoPDFData;
        });

      // 9) Memorial (DB query)
      const memorialPromise = supabase
        .from("parcelamento_memoriais")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("development_id", devId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data: m }) => {
          tick();
          if (!m) return null;
          const rec = m as Record<string, unknown>;
          return {
            proprietario: rec.proprietario as string,
            matricula: rec.matricula as string,
            area_total_m2: rec.area_total_m2 as number,
            perimetro_m: rec.perimetro_m as number,
            vertices: rec.vertices as MemorialPDFData["vertices"],
            memorial_text: rec.memorial_text as string,
          } as MemorialPDFData;
        });

      // 10) CRI Matriculas (DB query)
      const matriculasPromise = supabase
        .from("parcelamento_matriculas")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("development_id", devId)
        .order("created_at", { ascending: false })
        .then(({ data: mats }) => {
          tick();
          return (mats as unknown as MatriculaRecord[]) ?? null;
        });

      // 11) FII/CRA Simulations (DB query)
      const fiiCraPromise = supabase
        .from("parcelamento_fii_simulations")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("development_id", devId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data: sim }) => {
          tick();
          if (!sim) return null;
          const rec = sim as Record<string, unknown>;
          return {
            fii: rec.fii_result as FiiCraPDFData["fii"],
            criCra: rec.cri_cra_result as FiiCraPDFData["criCra"],
            comparativo: rec.comparativo as string,
          } as FiiCraPDFData;
        });

      // Execute all in parallel
      const [
        financial,
        legalAnalysis,
        regulations,
        benchmarks,
        census,
        embargoes,
        mapBiomas,
        zoneamento,
        memorial,
        matriculas,
        fiiCra,
      ] = await Promise.all([
        financialPromise,
        legalPromise,
        regulationsPromise,
        benchmarksPromise,
        censusPromise,
        embargoesPromise,
        mapBiomasPromise,
        zoneamentoPromise,
        memorialPromise,
        matriculasPromise,
        fiiCraPromise,
      ]);

      setProgress(100);

      const result: ReportTecnicoDataResult = {
        financial,
        legalAnalysis,
        ...regulations,
        ...benchmarks,
        ...census,
        ...embargoes,
        ...mapBiomas,
        zoneamento,
        memorial,
        matriculas,
        fiiCra,
      };

      setData(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar dados do relatório");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setProgress(0);
    setError(null);
  }, []);

  return { data, isLoading, progress, error, fetchAll, reset };
}
