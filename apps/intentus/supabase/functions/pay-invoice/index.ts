import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("Não autenticado");

    const { invoice_id } = await req.json();
    if (!invoice_id) throw new Error("invoice_id obrigatório");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: invoice, error: invError } = await adminClient
      .from("tenant_invoices")
      .select("*")
      .eq("id", invoice_id)
      .single();
    if (invError || !invoice) throw new Error("Fatura não encontrada");
    if (invoice.status === "quitada") throw new Error("Fatura já está quitada");
    if (invoice.status === "cancelada") throw new Error("Fatura está cancelada");

    const net = Number(invoice.amount) - Number(invoice.discount || 0);
    const amountCents = Math.round(net * 100);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      // Create customer if not exists
      const newCustomer = await stripe.customers.create({
        email: user.email,
        name: user.user_metadata?.name || user.email,
      });
      customerId = newCustomer.id;
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "brl",
      customer: customerId,
      metadata: {
        invoice_id: invoice.id,
        tenant_id: invoice.tenant_id,
        invoice_number: invoice.invoice_number,
      },
    });

    // Mark invoice with PaymentIntent info
    await adminClient.from("tenant_invoices").update({
      payment_method: "cartao",
      notes: `Stripe PI: ${paymentIntent.id}` + (invoice.notes ? `\n${invoice.notes}` : ""),
    }).eq("id", invoice_id);

    return new Response(JSON.stringify({ clientSecret: paymentIntent.client_secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("pay-invoice error:", msg);
    const safeMsg = /fatura|quitada|cancelada|autenticado/i.test(msg) ? msg : "Erro ao processar pagamento";
    return new Response(JSON.stringify({ error: safeMsg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
