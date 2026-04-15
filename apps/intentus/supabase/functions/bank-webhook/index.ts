import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-hub-signature-256, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_BODY_SIZE = 1024 * 1024; // 1MB

function safeErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  console.error("bank-webhook internal error:", msg);
  if (/duplicate key/i.test(msg)) return "Registro já existe";
  if (/not found/i.test(msg)) return "Recurso não encontrado";
  if (/violates.*constraint/i.test(msg)) return "Dados inválidos";
  return "Erro ao processar solicitação";
}

async function verifyWebhookSignature(
  signatureHeader: string | null, body: string, provider: string, supabase: any
): Promise<boolean> {
  if (!signatureHeader) return true; // backward compat: no signature = accept

  const { data: cred } = await supabase
    .from("bank_api_credentials")
    .select("extra_config")
    .eq("provider", provider)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  const secret = cred?.extra_config?.webhook_secret;
  if (!secret) {
    console.warn(`No webhook_secret configured for provider: ${provider}`);
    return true; // accept but warn
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, "0")).join("");

  const provided = signatureHeader.replace("sha256=", "");
  return expected === provided;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Rate limiting: reject oversized bodies
    const contentLength = parseInt(req.headers.get("content-length") || "0");
    if (contentLength > MAX_BODY_SIZE) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const provider = url.searchParams.get("provider") as "inter" | "itau" | "sicoob";
    if (!provider || !["inter", "itau", "sicoob"].includes(provider)) {
      return new Response(JSON.stringify({ error: "Provider inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bodyText = await req.text();
    if (bodyText.length > MAX_BODY_SIZE) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify webhook signature
    const signatureHeader = req.headers.get("x-webhook-signature")
      || req.headers.get("x-hub-signature-256");
    const isValid = await verifyWebhookSignature(signatureHeader, bodyText, provider, supabase);
    if (!isValid) {
      console.error("Invalid webhook signature for provider:", provider);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(bodyText);

    // Log raw event
    const { data: event } = await supabase.from("bank_webhook_events").insert({
      provider,
      event_type: detectEventType(provider, payload),
      payload,
    }).select().single();

    // Process based on provider
    let result: any = null;

    switch (provider) {
      case "inter":
        result = await processInterWebhook(supabase, payload);
        break;
      case "itau":
        result = await processItauWebhook(supabase, payload);
        break;
      case "sicoob":
        result = await processSicoobWebhook(supabase, payload);
        break;
    }

    // Mark event as processed
    if (event) {
      await supabase.from("bank_webhook_events").update({
        processed: true,
        processed_at: new Date().toISOString(),
        boleto_id: result?.boleto_id || null,
        pix_charge_id: result?.pix_charge_id || null,
      }).eq("id", event.id);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: safeErrorMessage(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function detectEventType(provider: string, payload: any): string {
  if (payload.pix) return "pix_payment";
  if (payload.cobranca || payload.boleto) return "boleto_payment";
  if (payload.endToEndId) return "pix_payment";
  if (Array.isArray(payload) && payload.length > 0 && payload[0].codigoSolicitacao) return "inter_cobranca_v3";
  return "unknown";
}

// ============= INTER WEBHOOK (V3 FORMAT) =============
async function processInterWebhook(supabase: any, payload: any) {
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const codigoSolicitacao = item.codigoSolicitacao;
      const situacao = item.situacao;

      const { data: boleto } = await supabase.from("boletos")
        .select("id, installment_id")
        .eq("provider_id", codigoSolicitacao)
        .single();

      if (!boleto) continue;

      if (situacao === "PAGO" || situacao === "RECEBIDO") {
        const valorRecebido = item.valorTotalRecebimento || item.valorNominal || 0;
        await supabase.from("boletos").update({
          status: "pago",
          paid_amount: valorRecebido,
          paid_at: new Date().toISOString(),
        }).eq("id", boleto.id);

        if (boleto.installment_id) {
          await markInstallmentPaid(supabase, boleto.installment_id, valorRecebido);
        }
        return { boleto_id: boleto.id };
      }

      if (situacao === "EMITIDO") {
        await supabase.from("boletos").update({
          status: "registrado",
        }).eq("id", boleto.id);
        return { boleto_id: boleto.id };
      }

      if (situacao === "CANCELADO" || situacao === "EXPIRADO") {
        await supabase.from("boletos").update({
          status: "cancelado",
        }).eq("id", boleto.id);
        return { boleto_id: boleto.id };
      }
    }
  }

  // Fallback: legacy Inter format
  if (payload.cobranca) {
    const cobranca = payload.cobranca;
    const { data: boleto } = await supabase.from("boletos")
      .select("id, installment_id")
      .eq("provider_id", cobranca.codigoSolicitacao)
      .single();

    if (boleto) {
      await supabase.from("boletos").update({
        status: "pago",
        paid_amount: cobranca.valorTotalRecebimento || cobranca.valorNominal,
        paid_at: new Date().toISOString(),
      }).eq("id", boleto.id);

      if (boleto.installment_id) {
        await markInstallmentPaid(supabase, boleto.installment_id, cobranca.valorTotalRecebimento);
      }
      return { boleto_id: boleto.id };
    }
  }

  // Inter PIX callback
  if (payload.pix && Array.isArray(payload.pix)) {
    for (const pix of payload.pix) {
      const { data: charge } = await supabase.from("pix_charges")
        .select("id, installment_id")
        .eq("txid", pix.txid)
        .single();

      if (charge) {
        await supabase.from("pix_charges").update({
          status: "concluida",
          paid_amount: parseFloat(pix.valor),
          paid_at: pix.horario || new Date().toISOString(),
        }).eq("id", charge.id);

        if (charge.installment_id) {
          await markInstallmentPaid(supabase, charge.installment_id, parseFloat(pix.valor));
        }
        return { pix_charge_id: charge.id };
      }

      const { data: platformCharge } = await supabase.from("platform_pix_charges")
        .select("id, tenant_invoice_id")
        .eq("txid", pix.txid)
        .single();

      if (platformCharge) {
        const paidAmount = parseFloat(pix.valor);
        const paidAt = pix.horario || new Date().toISOString();

        await supabase.from("platform_pix_charges").update({
          status: "concluida",
          paid_amount: paidAmount,
          paid_at: paidAt,
        }).eq("id", platformCharge.id);

        if (platformCharge.tenant_invoice_id) {
          await markPlatformInvoicePaid(supabase, platformCharge.tenant_invoice_id, paidAmount, paidAt);
        }
        return { pix_charge_id: platformCharge.id };
      }
    }
  }

  return null;
}

// ============= ITAU WEBHOOK =============
async function processItauWebhook(supabase: any, payload: any) {
  if (payload.data?.id_boleto) {
    const { data: boleto } = await supabase.from("boletos")
      .select("id, installment_id")
      .eq("provider_id", payload.data.id_boleto)
      .single();

    if (boleto) {
      await supabase.from("boletos").update({
        status: "pago",
        paid_amount: parseFloat(payload.data.valor_pago || "0"),
        paid_at: new Date().toISOString(),
      }).eq("id", boleto.id);

      if (boleto.installment_id) {
        await markInstallmentPaid(supabase, boleto.installment_id, parseFloat(payload.data.valor_pago || "0"));
      }
      return { boleto_id: boleto.id };
    }
  }

  if (payload.pix) {
    for (const pix of payload.pix) {
      const { data: charge } = await supabase.from("pix_charges")
        .select("id, installment_id")
        .eq("txid", pix.txid)
        .single();

      if (charge) {
        await supabase.from("pix_charges").update({
          status: "concluida",
          paid_amount: parseFloat(pix.valor),
          paid_at: pix.horario || new Date().toISOString(),
        }).eq("id", charge.id);

        if (charge.installment_id) {
          await markInstallmentPaid(supabase, charge.installment_id, parseFloat(pix.valor));
        }
        return { pix_charge_id: charge.id };
      }
    }
  }

  return null;
}

// ============= SICOOB WEBHOOK =============
async function processSicoobWebhook(supabase: any, payload: any) {
  if (payload.nossoNumero) {
    const { data: boleto } = await supabase.from("boletos")
      .select("id, installment_id")
      .eq("nosso_numero", payload.nossoNumero.toString())
      .single();

    if (boleto) {
      await supabase.from("boletos").update({
        status: "pago",
        paid_amount: payload.valorPago || payload.valor,
        paid_at: new Date().toISOString(),
      }).eq("id", boleto.id);

      if (boleto.installment_id) {
        await markInstallmentPaid(supabase, boleto.installment_id, payload.valorPago);
      }
      return { boleto_id: boleto.id };
    }
  }

  if (payload.pix && Array.isArray(payload.pix)) {
    for (const pix of payload.pix) {
      const { data: charge } = await supabase.from("pix_charges")
        .select("id, installment_id")
        .eq("txid", pix.txid)
        .single();

      if (charge) {
        await supabase.from("pix_charges").update({
          status: "concluida",
          paid_amount: parseFloat(pix.valor),
          paid_at: pix.horario || new Date().toISOString(),
        }).eq("id", charge.id);

        if (charge.installment_id) {
          await markInstallmentPaid(supabase, charge.installment_id, parseFloat(pix.valor));
        }
        return { pix_charge_id: charge.id };
      }
    }
  }

  return null;
}

// ============= SHARED: MARK INSTALLMENT AS PAID =============
async function markInstallmentPaid(supabase: any, installmentId: string, paidAmount: number) {
  await supabase.from("contract_installments").update({
    status: "pago",
    paid_amount: paidAmount,
    payment_date: new Date().toISOString().split("T")[0],
    payment_method: "boleto_bancario",
  }).eq("id", installmentId);
}

// ============= SHARED: MARK PLATFORM INVOICE PAID + REACTIVATE =============
async function markPlatformInvoicePaid(supabase: any, invoiceId: string, paidAmount: number, paidAt: string) {
  const { data: invoice } = await supabase
    .from("tenant_invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();
  if (!invoice || invoice.status === "quitada") return;

  await supabase.from("tenant_invoices").update({
    status: "quitada",
    paid_amount: paidAmount,
    paid_at: paidAt,
    payment_method: "pix",
  }).eq("id", invoiceId);

  const tenantId = invoice.tenant_id;
  if (!tenantId) return;

  const { data: sub } = await supabase
    .from("tenant_subscriptions")
    .select("id, status, blocked_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sub && (sub.status === "expirado" || sub.status === "bloqueado" || sub.blocked_at)) {
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 30);
    await supabase.from("tenant_subscriptions").update({
      status: "ativo",
      expires_at: newExpiry.toISOString(),
      blocked_at: null,
      blocked_reason: null,
    } as any).eq("id", sub.id);
  }

  const { data: admins } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .in("role", ["admin", "gerente"]);

  if (admins) {
    for (const admin of admins) {
      await supabase.from("notifications").insert({
        user_id: admin.user_id,
        title: "Pagamento PIX Confirmado",
        message: "Fatura #" + invoice.invoice_number + " paga via PIX. Assinatura reativada.",
        category: "sistema",
        reference_type: "invoice",
        reference_id: invoiceId,
        tenant_id: tenantId,
      });
    }
  }
}
