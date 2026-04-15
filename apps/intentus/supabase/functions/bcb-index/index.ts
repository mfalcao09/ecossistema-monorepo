import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// BCB SGS series codes
const INDEX_SERIES: Record<string, { code: number; name: string; description: string }> = {
  igpm:     { code: 189,  name: "IGP-M",    description: "Índice Geral de Preços - Mercado" },
  ipca:     { code: 433,  name: "IPCA",     description: "Índice de Preços ao Consumidor Amplo" },
  inpc:     { code: 188,  name: "INPC",     description: "Índice Nacional de Preços ao Consumidor" },
  incc:     { code: 7447, name: "INCC",     description: "Índice Nacional de Custo da Construção" },
  igpdi:    { code: 190,  name: "IGP-DI",   description: "Índice Geral de Preços - Disp. Interna" },
  cdi:      { code: 12,   name: "CDI",      description: "Certificado de Depósito Interbancário" },
  selic:    { code: 432,  name: "SELIC",    description: "Taxa SELIC (meta)" },
  tr:       { code: 226,  name: "TR",       description: "Taxa Referencial" },
  tjlp:     { code: 256,  name: "TJLP",     description: "Taxa de Juros de Longo Prazo" },
  poupanca: { code: 195,  name: "Poupança", description: "Remuneração da Caderneta de Poupança" },
};

const fmt = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

async function fetchIndex(indexCode: string, months: number) {
  const series = INDEX_SERIES[indexCode];
  if (!series) return null;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const bcbUrl = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${series.code}/dados?formato=json&dataInicial=${fmt(startDate)}&dataFinal=${fmt(endDate)}`;

  const resp = await fetch(bcbUrl);
  if (!resp.ok) {
    console.error(`BCB API error for ${indexCode}: ${resp.status}`);
    return null;
  }

  const rawData = await resp.json();
  const entries = rawData.map((e: any) => ({
    date: e.data,
    value: parseFloat(e.valor),
  }));

  const latest = entries.length > 0 ? entries[entries.length - 1] : null;

  // Calculate accumulated 12-month percentage
  let accumulated = 0;
  if (entries.length > 0) {
    const last12 = entries.slice(-12);
    accumulated = last12.reduce((acc: number, e: any) => {
      return ((1 + acc / 100) * (1 + e.value / 100) - 1) * 100;
    }, 0);
    accumulated = Math.round(accumulated * 100) / 100;
  }

  return {
    index: indexCode,
    name: series.name,
    description: series.description,
    latest_value: latest?.value || 0,
    latest_date: latest?.date || null,
    accumulated_12m: accumulated,
    entries: entries.slice(-12),
  };
}

function parseBcbDate(dateStr: string): string {
  // BCB returns "DD/MM/YYYY", convert to "YYYY-MM-01" for reference_date
  const [day, month, year] = dateStr.split("/");
  return `${year}-${month}-01`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const indexType = url.searchParams.get("index") || "igpm";
    const months = parseInt(url.searchParams.get("months") || "12");
    const persist = url.searchParams.get("persist") !== "false";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all indices or a single one
    const indicesToFetch = indexType === "all" ? Object.keys(INDEX_SERIES) : [indexType];

    // Check if single index is valid
    if (indexType !== "all" && !INDEX_SERIES[indexType]) {
      return new Response(JSON.stringify({ error: "Índice não suportado. Use: " + Object.keys(INDEX_SERIES).join(", ") + " ou 'all'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const code of indicesToFetch) {
      const result = await fetchIndex(code, months);
      if (result) {
        results.push(result);

        // Persist to DB if requested
        if (persist && result.latest_date) {
          const refDate = parseBcbDate(result.latest_date);
          await supabase.from("economic_indices").upsert(
            {
              index_code: code,
              reference_date: refDate,
              monthly_value: result.latest_value,
              accumulated_12m: result.accumulated_12m,
              fetched_at: new Date().toISOString(),
            },
            { onConflict: "index_code,reference_date" }
          );

          // Also persist individual monthly entries for sparkline
          for (const entry of result.entries) {
            const entryDate = parseBcbDate(entry.date);
            await supabase.from("economic_indices").upsert(
              {
                index_code: code,
                reference_date: entryDate,
                monthly_value: entry.value,
                fetched_at: new Date().toISOString(),
              },
              { onConflict: "index_code,reference_date" }
            );
          }
        }
      }
    }

    if (indexType !== "all" && results.length === 1) {
      return new Response(JSON.stringify(results[0]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ indices: results, updated_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("bcb-index error:", error);
    return new Response(JSON.stringify({ error: "Erro ao buscar índice econômico" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
