import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolvePersona, callGemini } from "../_shared/resolve-persona.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: only cron (anon key) or service role key
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (token !== anonKey && token !== serviceKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: existing } = await supabase
      .from("ir_brackets")
      .select("reference_year")
      .order("reference_year", { ascending: false })
      .limit(1);

    const currentMaxYear = existing?.[0]?.reference_year || 2025;
    const currentYear = new Date().getFullYear();

    if (currentMaxYear >= currentYear) {
      return new Response(
        JSON.stringify({ message: `Brackets already up to date for ${currentYear}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const persona = await resolvePersona("ir_brackets");

    const prompt = `Retorne SOMENTE um JSON array com as faixas de IRRF (Imposto de Renda Retido na Fonte) vigentes para o ano ${currentYear} no Brasil, para rendimentos mensais de pessoa física. Formato exato:
[{"min":0,"max":2259.20,"rate":0,"deduction":0},{"min":2259.21,"max":2826.65,"rate":7.5,"deduction":169.44}...]
Use 999999999 como max da última faixa. Retorne APENAS o JSON, sem markdown, sem explicação.`;

    const response = await callGemini({
      persona,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    if (!response.ok) {
      throw new Error(`Gemini request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Could not parse AI response as JSON array");

    const brackets = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(brackets) || brackets.length < 3) {
      throw new Error("Invalid brackets data from AI");
    }

    for (const b of brackets) {
      if (typeof b.min !== "number" || typeof b.max !== "number" || typeof b.rate !== "number" || typeof b.deduction !== "number") {
        throw new Error("Invalid bracket structure");
      }
    }

    const rows = brackets.map((b: any, i: number) => ({
      reference_year: currentYear,
      min_value: b.min,
      max_value: b.max,
      rate: b.rate,
      deduction: b.deduction,
      sort_order: i + 1,
    }));

    const { error } = await supabase.from("ir_brackets").insert(rows);
    if (error) throw error;

    console.log(`Successfully inserted ${rows.length} IRRF brackets for ${currentYear}`);

    return new Response(
      JSON.stringify({ message: `Updated IRRF brackets for ${currentYear}`, brackets: rows }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error updating IR brackets:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
