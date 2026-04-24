import { verificarAuth } from "@/lib/security/api-guard";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// ============================================================
// API de CNPJ — Multi-API com Fallback + Cache no Supabase
// Ordem: Cache Local → BrasilAPI → ReceitaWS → CNPJ.ws
// ============================================================

interface CNPJResult {
  nome: string;
  nome_fantasia?: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  fonte: string;
}

// ----------------------------------------------------------
// 1. CACHE LOCAL (Supabase)
// ----------------------------------------------------------
async function buscarNoCache(cnpj: string): Promise<CNPJResult | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("cnpj_cache")
      .select("*")
      .eq("cnpj", cnpj)
      .single();

    if (error || !data) return null;

    // Cache válido por 30 dias
    const dataConsulta = new Date(data.data_consulta);
    const diasDesdeConsulta =
      (Date.now() - dataConsulta.getTime()) / (1000 * 60 * 60 * 24);
    if (diasDesdeConsulta > 30) return null;

    return {
      nome: data.razao_social || "",
      nome_fantasia: data.nome_fantasia || "",
      logradouro: data.logradouro || "",
      numero: data.numero || "",
      complemento: data.complemento || "",
      bairro: data.bairro || "",
      municipio: data.municipio || "",
      uf: data.uf || "",
      cep: data.cep || "",
      fonte: `cache (${data.fonte})`,
    };
  } catch {
    return null;
  }
}

async function salvarNoCache(
  cnpj: string,
  result: CNPJResult,
  dadosCompletos: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from("cnpj_cache").upsert(
      {
        cnpj,
        razao_social: result.nome,
        nome_fantasia: result.nome_fantasia || null,
        logradouro: result.logradouro || null,
        numero: result.numero || null,
        complemento: result.complemento || null,
        bairro: result.bairro || null,
        municipio: result.municipio || null,
        uf: result.uf || null,
        cep: result.cep?.replace(/\D/g, "") || null,
        fonte: result.fonte,
        dados_completos: dadosCompletos,
        data_consulta: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cnpj" },
    );
  } catch {
    // Falha no cache não deve bloquear a resposta
    console.error("Erro ao salvar cache CNPJ:", cnpj);
  }
}

// ----------------------------------------------------------
// 2. BRASIL API (gratuita, sem limite definido)
// ----------------------------------------------------------
async function buscarBrasilAPI(cnpj: string): Promise<CNPJResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(
      `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
      { signal: controller.signal, cache: "no-store" },
    );
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();
    const result: CNPJResult = {
      nome: data.razao_social || data.nome_fantasia || "",
      nome_fantasia: data.nome_fantasia || "",
      logradouro: data.logradouro || "",
      numero: data.numero || "",
      complemento: data.complemento || "",
      bairro: data.bairro || "",
      municipio: data.municipio || "",
      uf: data.uf || "",
      cep: data.cep ? String(data.cep).replace(/\D/g, "") : "",
      fonte: "brasilapi",
    };

    // Salva no cache em background
    salvarNoCache(cnpj, result, data);

    return result;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------
// 3. RECEITAWS (gratuita, 3 consultas/minuto)
// ----------------------------------------------------------
async function buscarReceitaWS(cnpj: string): Promise<CNPJResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();

    // ReceitaWS retorna status "ERROR" em caso de falha
    if (data.status === "ERROR") return null;

    const result: CNPJResult = {
      nome: data.nome || data.fantasia || "",
      nome_fantasia: data.fantasia || "",
      logradouro: data.logradouro || "",
      numero: data.numero || "",
      complemento: data.complemento || "",
      bairro: data.bairro || "",
      municipio: data.municipio || "",
      uf: data.uf || "",
      cep: data.cep ? String(data.cep).replace(/\D/g, "") : "",
      fonte: "receitaws",
    };

    salvarNoCache(cnpj, result, data);

    return result;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------
// 4. CNPJ.WS (gratuita, 3 consultas/minuto)
// ----------------------------------------------------------
async function buscarCNPJws(cnpj: string): Promise<CNPJResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();

    const estabelecimento = data.estabelecimento || {};
    const result: CNPJResult = {
      nome: data.razao_social || estabelecimento.nome_fantasia || "",
      nome_fantasia: estabelecimento.nome_fantasia || "",
      logradouro: estabelecimento.logradouro || "",
      numero: estabelecimento.numero || "",
      complemento: estabelecimento.complemento || "",
      bairro: estabelecimento.bairro || "",
      municipio: estabelecimento.cidade?.nome || "",
      uf: estabelecimento.estado?.sigla || "",
      cep: estabelecimento.cep
        ? String(estabelecimento.cep).replace(/\D/g, "")
        : "",
      fonte: "cnpjws",
    };

    salvarNoCache(cnpj, result, data);

    return result;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------
// HANDLER PRINCIPAL — Tenta em cascata
// ----------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cnpj: string }> },
) {
  const auth = await verificarAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { cnpj } = await params;
  const cnpjClean = cnpj.replace(/\D/g, "");

  if (cnpjClean.length !== 14) {
    return NextResponse.json(
      { error: "CNPJ deve ter 14 dígitos" },
      { status: 400 },
    );
  }

  // 1. Tenta o cache local primeiro
  const cached = await buscarNoCache(cnpjClean);
  if (cached) {
    return NextResponse.json({ ...cached, fromCache: true });
  }

  // 2. Tenta APIs em sequência (fallback)
  const providers = [
    { name: "BrasilAPI", fn: buscarBrasilAPI },
    { name: "ReceitaWS", fn: buscarReceitaWS },
    { name: "CNPJ.ws", fn: buscarCNPJws },
  ];

  for (const provider of providers) {
    const result = await provider.fn(cnpjClean);
    if (result && result.nome) {
      return NextResponse.json({ ...result, fromCache: false });
    }
  }

  // 3. Nenhuma API retornou dados
  return NextResponse.json(
    {
      error: "CNPJ não encontrado em nenhuma fonte de dados",
      tentativas: providers.map((p) => p.name).join(", "),
    },
    { status: 404 },
  );
}
