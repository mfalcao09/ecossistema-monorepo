import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolvePersona, callGemini, logInteraction } from "../_shared/resolve-persona.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve tenant_id and user_id from auth
    let tenantId: string | null = null;
    let userId: string | null = null;
    try {
      const authHeader = req.headers.get("authorization") ?? "";
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        userId = user.id;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const admin = createClient(supabaseUrl, serviceKey);
        const { data: profile } = await admin.from("profiles").select("tenant_id").eq("user_id", user.id).single();
        tenantId = profile?.tenant_id ?? null;
      }
    } catch { /* continue without tenant context */ }

    const persona = await resolvePersona("legal_chatbot", tenantId);

    // Convert OpenAI-style messages to Gemini contents
    const contents = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const response = await callGemini({ persona, contents });

    if (!response.ok) {
      const status = response.status;
      const errText = await response.text();
      console.error("Gemini error:", status, errText);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Gemini error: ${status}`);
    }

    const data = await response.json();
    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      data.choices?.[0]?.message?.content ||
      "Desculpe, não consegui processar sua pergunta.";

    // Fire-and-forget: log interaction
    const lastUserMsg = messages.filter((m: any) => m.role === "user").pop();
    let logId: string | null = null;
    if (tenantId && userId) {
      logInteraction({
        tenantId,
        userId,
        functionKey: "legal_chatbot",
        inputSummary: lastUserMsg?.content || "",
        outputSummary: reply,
        responseTimeMs: Date.now() - startTime,
      }).then((id) => { logId = id; }).catch(() => {});
    }

    return new Response(JSON.stringify({ reply, log_id: logId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("legal-chatbot error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno do chatbot" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
