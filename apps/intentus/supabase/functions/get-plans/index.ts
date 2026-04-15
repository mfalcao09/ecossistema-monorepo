import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("plans")
      .select("id, name, price_monthly, max_users, max_properties, modules, features, stripe_price_id")
      .eq("active", true)
      .gt("price_monthly", 0)
      .order("price_monthly");

    if (error) throw error;

    // Transform modules into human-readable feature list for the shop
    const plans = (data || []).map((plan) => {
      const moduleLabels: Record<string, string> = {
        dashboard: "Dashboard com métricas e indicadores",
        imoveis: "Gestão de Imóveis (cadastro, captação, fotos, documentos)",
        pessoas: "Gestão de Pessoas (proprietários, inquilinos, compradores, fiadores)",
        contratos: "Contratos digitais (locação, venda, renovação, rescisão)",
        garantias: "Garantias Contratuais (seguro fiança, caução, fiador)",
        comercial_basico: "Comercial Básico (dashboard, negócios, pipeline)",
        comercial_intermediario: "Comercial Intermediário (básico + visitas, disponibilidade, avaliações de mercado)",
        comercial_completo: "Comercial Completo (intermediário + metas, exclusividades, automações, relatórios)",
        financeiro_basico: "Financeiro Básico (receitas, despesas, fluxo de caixa, inadimplência, faturas)",
        financeiro_intermediario: "Financeiro Intermediário (básico + contas bancárias via API, centros de custo, conciliação)",
        financeiro_completo: "Financeiro Completo (intermediário + comissões, repasses, DRE, IR, DIMOB, relatórios)",
        relacionamento_basico: "Relacionamento Básico (gestão, atendimento, contratos, rescisões, renovações)",
        relacionamento_intermediario: "Relacionamento Intermediário (básico + reajustes, garantias, seguros & sinistros)",
        relacionamento_completo: "Relacionamento Completo (intermediário + satisfação, comunicação, automações, manutenção)",
        juridico_intermediario: "Jurídico Intermediário (análises, due diligence, notificações, seguros obrigatórios, ocupação)",
        juridico_completo: "Jurídico Completo (intermediário + modelos, procurações, processos, compliance, assinaturas)",
        empreendimentos: "Lançamentos Imobiliários (espelho de vendas, propostas, contratos de unidades)",
        api: "API & Integrações (API REST pública, webhooks para sites externos)",
      };

      const modules = Array.isArray(plan.modules) ? [...new Set(plan.modules as string[])] : [];
      
      // Hide lower-tier modules when a higher tier is present
      let displayModules = modules;
      // Comercial
      if (modules.includes("comercial_completo")) {
        displayModules = displayModules.filter((m: string) => m !== "comercial_basico" && m !== "comercial_intermediario");
      } else if (modules.includes("comercial_intermediario")) {
        displayModules = displayModules.filter((m: string) => m !== "comercial_basico");
      }
      // Financeiro
      if (modules.includes("financeiro_completo")) {
        displayModules = displayModules.filter((m: string) => m !== "financeiro_basico" && m !== "financeiro_intermediario");
      } else if (modules.includes("financeiro_intermediario")) {
        displayModules = displayModules.filter((m: string) => m !== "financeiro_basico");
      }
      // Relacionamento
      if (modules.includes("relacionamento_completo")) {
        displayModules = displayModules.filter((m: string) => m !== "relacionamento_basico" && m !== "relacionamento_intermediario");
      } else if (modules.includes("relacionamento_intermediario")) {
        displayModules = displayModules.filter((m: string) => m !== "relacionamento_basico");
      }
      // Juridico
      if (modules.includes("juridico_completo")) {
        displayModules = displayModules.filter((m: string) => m !== "juridico_intermediario");
      }
      
      const moduleFeatures = displayModules
        .map((m: string) => moduleLabels[m] || m);

      // Build display features
      const displayFeatures: string[] = [];
      if (plan.max_properties) {
        displayFeatures.push(`Até ${plan.max_properties} imóveis`);
      } else {
        displayFeatures.push("Imóveis ilimitados");
      }
      if (plan.max_users) {
        displayFeatures.push(`${plan.max_users} usuários`);
      } else {
        displayFeatures.push("Usuários ilimitados");
      }
      displayFeatures.push(...moduleFeatures);

      return {
        id: plan.id,
        name: plan.name,
        price: plan.price_monthly.toLocaleString("pt-BR"),
        priceId: plan.stripe_price_id || "",
        desc: plan.name === "Básico"
          ? "Para imobiliárias de pequeno porte"
          : plan.name === "Profissional"
            ? "Para imobiliárias em crescimento"
            : "Para grandes operações imobiliárias",
        features: displayFeatures,
        popular: plan.name === "Profissional",
      };
    });

    return new Response(JSON.stringify(plans), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
