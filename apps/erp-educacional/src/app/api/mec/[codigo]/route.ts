import { verificarAuth } from "@/lib/security/api-guard";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// ============================================================
// API de Código MEC — Busca dados vinculados IES + Mantenedora
// Retorna AMBOS os registros (IES e sua Mantenedora) de uma vez
// ============================================================

interface InstituicaoMEC {
  codigo_mec: string;
  nome: string;
  sigla?: string;
  categoria?: string;
  organizacao?: string;
  situacao?: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
}

interface MantenedoraMEC {
  codigo_mec: string;
  nome: string;
  cnpj: string;
  natureza_juridica?: string;
  representante_legal?: string;
}

interface MECVinculoResult {
  ies: InstituicaoMEC;
  mantenedora: MantenedoraMEC;
  fonte: string;
  fromCache: boolean;
}

// ----------------------------------------------------------
// 1. CACHE LOCAL (Supabase)
// ----------------------------------------------------------
async function buscarNoCache(codigo: string): Promise<MECVinculoResult | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mec_cache")
      .select("*")
      .eq("codigo_mec", codigo)
      .single();

    if (error || !data || !data.dados_completos) return null;

    // Cache válido por 90 dias
    const dataConsulta = new Date(data.data_consulta);
    const diasDesdeConsulta =
      (Date.now() - dataConsulta.getTime()) / (1000 * 60 * 60 * 24);
    if (diasDesdeConsulta > 90) return null;

    const cached = data.dados_completos as MECVinculoResult;
    if (!cached.ies || !cached.mantenedora) return null;

    return { ...cached, fonte: `cache (${data.fonte})`, fromCache: true };
  } catch {
    return null;
  }
}

async function salvarNoCache(
  codigo: string,
  result: MECVinculoResult,
): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from("mec_cache").upsert(
      {
        codigo_mec: codigo,
        nome_ies: result.ies.nome,
        categoria: result.ies.categoria || null,
        organizacao: result.ies.organizacao || null,
        situacao: result.ies.situacao || null,
        logradouro: result.ies.logradouro || null,
        numero: result.ies.numero || null,
        complemento: result.ies.complemento || null,
        bairro: result.ies.bairro || null,
        municipio: result.ies.municipio || null,
        uf: result.ies.uf || null,
        cep: result.ies.cep?.replace(/\D/g, "") || null,
        mantenedora_nome: result.mantenedora.nome || null,
        mantenedora_cnpj: result.mantenedora.cnpj?.replace(/\D/g, "") || null,
        fonte: result.fonte,
        dados_completos: result,
        data_consulta: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "codigo_mec" },
    );
  } catch {
    console.error("Erro ao salvar cache MEC:", codigo);
  }
}

// ----------------------------------------------------------
// 2. e-MEC (scraping da página de detalhamento)
// ----------------------------------------------------------
async function buscarEMEC(codigo: string): Promise<MECVinculoResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const codigoBase64 = Buffer.from(codigo).toString("base64");
    const url = `https://emec.mec.gov.br/emec/consulta-cadastro/detalhamento/d96957f455f6405d14c6542552b0f6eb/${codigoBase64}`;

    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const html = await response.text();

    // Extrair dados da IES
    const nomeIES = extractBetween(html, "Nome da IES", "</td>") || "";
    if (!nomeIES) return null;

    // Limpar sigla do nome: "(1606) FACULDADES INTEGRADAS DE CASSILÂNDIA - FIC"
    const nomeClean = nomeIES.replace(/^\(\d+\)\s*/, "");
    const siglaParts = nomeClean.split(" - ");
    const sigla =
      siglaParts.length > 1 ? siglaParts[siglaParts.length - 1].trim() : "";
    const nomeSemSigla =
      siglaParts.length > 1
        ? siglaParts.slice(0, -1).join(" - ").trim()
        : nomeClean.trim();

    // Extrair dados da Mantenedora
    const nomeMantenedora = extractBetween(html, "Mantenedora:", "</td>") || "";
    const nomeMantenedoraClean = nomeMantenedora
      .replace(/^\(\d+\)\s*/, "")
      .trim();
    const codigoMantenedoraMatch = nomeMantenedora.match(/^\((\d+)\)/);
    const codigoMantenedora = codigoMantenedoraMatch
      ? codigoMantenedoraMatch[1]
      : "";

    const cnpjMantenedora = extractBetween(html, "CNPJ:", "</td>") || "";

    const result: MECVinculoResult = {
      ies: {
        codigo_mec: codigo,
        nome: nomeSemSigla,
        sigla,
        situacao: extractBetween(html, "Situação:", "</td>") || "",
        categoria:
          extractBetween(html, "Categoria Administrativa:", "</td>") || "",
        organizacao:
          extractBetween(html, "Organização Acadêmica:", "</td>") || "",
        logradouro: extractBetween(html, "Endereço:", "</td>") || "",
        numero: extractAfterLabel(html, "Nº:") || "",
        complemento: extractBetween(html, "Complemento:", "</td>") || "",
        bairro: extractBetween(html, "Bairro:", "</td>") || "",
        municipio: extractBetween(html, "Município:", "</td>") || "",
        uf: extractAfterLabel(html, "UF:") || "",
        cep: (extractAfterLabel(html, "CEP:") || "").replace(/\D/g, ""),
      },
      mantenedora: {
        codigo_mec: codigoMantenedora,
        nome: nomeMantenedoraClean,
        cnpj: cnpjMantenedora.replace(/\D/g, ""),
        natureza_juridica:
          extractBetween(html, "Natureza Jurídica:", "</td>") || "",
        representante_legal:
          extractBetween(html, "Representante Legal:", "</td>") || "",
      },
      fonte: "emec",
      fromCache: false,
    };

    salvarNoCache(codigo, result);
    return result;
  } catch {
    return null;
  }
}

// Helpers de extração HTML
function extractBetween(html: string, label: string, endTag: string): string {
  const labelIdx = html.indexOf(label);
  if (labelIdx === -1) return "";

  // Pula o label e procura a próxima tag com conteúdo
  const afterLabel = html.substring(labelIdx + label.length);
  // Procura conteúdo entre tags
  const match = afterLabel.match(/<[^>]*>([^<]+)/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return "";
}

function extractAfterLabel(html: string, label: string): string {
  const idx = html.indexOf(label);
  if (idx === -1) return "";
  const after = html.substring(idx + label.length, idx + label.length + 200);
  const match = after.match(/\s*([^<\n]+)/);
  if (match && match[1]) return match[1].trim();
  return "";
}

// ----------------------------------------------------------
// 3. BASE DE DADOS CONHECIDA (IES + Mantenedoras vinculadas)
// ----------------------------------------------------------
const VINCULOS_CONHECIDOS: Record<string, MECVinculoResult> = {
  // FIC — Faculdades Integradas de Cassilândia
  "1606": {
    ies: {
      codigo_mec: "1606",
      nome: "FACULDADES INTEGRADAS DE CASSILÂNDIA",
      sigla: "FIC",
      categoria: "Privada",
      organizacao: "Faculdade",
      situacao: "Ativa",
      logradouro: "Av. Presidente Dutra",
      numero: "1500",
      complemento: "CENTRO",
      bairro: "CENTRO",
      municipio: "Cassilândia",
      uf: "MS",
      cep: "79540000",
    },
    mantenedora: {
      codigo_mec: "1054",
      nome: "SOCIEDADE EDUCACIONAL VALE DO APORE LTDA",
      cnpj: "02175672000163",
      natureza_juridica: "Sociedade Empresária Limitada",
      representante_legal: "MARCELO LUCIANO PEREIRA DA SILVA BATISTA FALCAO",
    },
    fonte: "dados_conhecidos",
    fromCache: false,
  },
};

// ----------------------------------------------------------
// HANDLER PRINCIPAL
// ----------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const auth = await verificarAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { codigo } = await params;
  const codigoClean = codigo.replace(/\D/g, "");

  if (!codigoClean) {
    return NextResponse.json({ error: "Código MEC inválido" }, { status: 400 });
  }

  // 1. Cache local
  const cached = await buscarNoCache(codigoClean);
  if (cached) {
    return NextResponse.json(cached);
  }

  // 2. Dados conhecidos (hardcoded)
  const conhecido = VINCULOS_CONHECIDOS[codigoClean];
  if (conhecido) {
    salvarNoCache(codigoClean, conhecido);
    return NextResponse.json(conhecido);
  }

  // 3. e-MEC (scraping)
  const emec = await buscarEMEC(codigoClean);
  if (emec && emec.ies.nome) {
    return NextResponse.json(emec);
  }

  // 4. Nenhuma fonte
  return NextResponse.json(
    { error: "IES não encontrada para o código MEC informado" },
    { status: 404 },
  );
}
