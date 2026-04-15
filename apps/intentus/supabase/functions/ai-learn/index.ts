import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolvePersona, callGemini } from "../_shared/resolve-persona.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Optional: filter by tenant_id from body
    const body = await req.json().catch(() => ({}));
    const targetTenantId = body.tenant_id || null;

    // Determine which tenants to process
    let tenantIds: string[] = [];
    if (targetTenantId) {
      tenantIds = [targetTenantId];
    } else {
      const { data: tenants } = await admin.from("tenants").select("id").eq("active", true).limit(100);
      tenantIds = tenants?.map((t: any) => t.id) || [];
    }

    let totalSnippets = 0;
    let totalDecayed = 0;

    for (const tenantId of tenantIds) {
      // ===== 1. Extract patterns from highly-rated logs =====
      const { data: goodLogs } = await admin
        .from("ai_interaction_logs")
        .select("id, function_key, input_summary, output_summary")
        .eq("tenant_id", tenantId)
        .gte("rating", 4)
        .order("created_at", { ascending: false })
        .limit(20);

      if (goodLogs && goodLogs.length >= 3) {
        // Use AI to extract patterns
        const persona = await resolvePersona("legal_chatbot", tenantId);
        const logsText = goodLogs.map((l: any) =>
          `Pergunta: ${l.input_summary}\nResposta bem avaliada: ${l.output_summary}`
        ).join("\n---\n");

        const patternPrompt = `Analise as seguintes interações bem avaliadas e extraia até 5 regras ou padrões que devem ser mantidos para este tenant. Cada regra deve ser uma frase curta e direta. Responda em JSON: { "patterns": [{ "title": "...", "content": "..." }] }`;

        try {
          const response = await callGemini({
            persona: { ...persona, systemPrompt: "Você é um analisador de padrões de IA. Extraia regras concisas." },
            contents: [{ role: "user", parts: [{ text: `${patternPrompt}\n\n${logsText}` }] }],
          });

          if (response.ok) {
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            try {
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                for (const p of (parsed.patterns || []).slice(0, 5)) {
                  // Check if similar snippet already exists
                  const { data: existing } = await admin
                    .from("ai_knowledge_base")
                    .select("id")
                    .eq("tenant_id", tenantId)
                    .eq("category", "precedente")
                    .eq("title", p.title)
                    .limit(1);

                  if (!existing || existing.length === 0) {
                    await admin.from("ai_knowledge_base").insert({
                      tenant_id: tenantId,
                      function_key: goodLogs[0].function_key,
                      category: "precedente",
                      title: p.title,
                      content: p.content,
                      source_type: "feedback",
                      relevance_score: 0.7,
                    });
                    totalSnippets++;
                  }
                }
              }
            } catch { /* JSON parse error, skip */ }
          }
        } catch (e) {
          console.error(`Pattern extraction error for tenant ${tenantId}:`, e);
        }
      }

      // ===== 2. Extract corrections from low-rated logs =====
      const { data: badLogs } = await admin
        .from("ai_interaction_logs")
        .select("id, function_key, input_summary, output_summary, feedback_text")
        .eq("tenant_id", tenantId)
        .lte("rating", 2)
        .order("created_at", { ascending: false })
        .limit(10);

      if (badLogs && badLogs.length >= 2) {
        for (const log of badLogs.slice(0, 3)) {
          const correctionTitle = `Correção: ${(log.input_summary || "").slice(0, 60)}`;
          const { data: existing } = await admin
            .from("ai_knowledge_base")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("category", "correcao")
            .eq("title", correctionTitle)
            .limit(1);

          if (!existing || existing.length === 0) {
            await admin.from("ai_knowledge_base").insert({
              tenant_id: tenantId,
              function_key: log.function_key,
              category: "correcao",
              title: correctionTitle,
              content: `Quando perguntado "${(log.input_summary || "").slice(0, 200)}", a resposta "${(log.output_summary || "").slice(0, 200)}" foi avaliada negativamente.${log.feedback_text ? ` Feedback: ${log.feedback_text}` : ""} Ajuste a abordagem.`,
              source_type: "feedback",
              relevance_score: 0.8,
            });
            totalSnippets++;
          }
        }
      }

      // ===== 3. Sync contract clauses to KB =====
      const { data: clauses } = await admin
        .from("contract_clauses")
        .select("id, title, content, category")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .limit(50);

      if (clauses) {
        for (const clause of clauses) {
          const { data: existing } = await admin
            .from("ai_knowledge_base")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("source_type", "clausula")
            .eq("source_id", clause.id)
            .limit(1);

          if (!existing || existing.length === 0) {
            await admin.from("ai_knowledge_base").insert({
              tenant_id: tenantId,
              function_key: null,
              category: "clausula_padrao",
              title: `Cláusula: ${clause.title}`,
              content: (clause.content || "").slice(0, 500),
              source_type: "clausula",
              source_id: clause.id,
              relevance_score: 0.6,
            });
            totalSnippets++;
          }
        }
      }

      // ===== 4. Decay unused old snippets =====
      const { data: oldSnippets } = await admin
        .from("ai_knowledge_base")
        .select("id, relevance_score, usage_count")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .lt("updated_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .eq("usage_count", 0)
        .limit(50);

      if (oldSnippets) {
        for (const s of oldSnippets) {
          const newScore = Math.max(0.1, (s.relevance_score || 0.5) * 0.8);
          await admin
            .from("ai_knowledge_base")
            .update({ relevance_score: newScore })
            .eq("id", s.id);
          totalDecayed++;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      tenants_processed: tenantIds.length,
      snippets_created: totalSnippets,
      snippets_decayed: totalDecayed,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-learn error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
