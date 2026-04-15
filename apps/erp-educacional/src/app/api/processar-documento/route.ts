import { protegerRota } from '@/lib/security/api-guard'
import { NextRequest, NextResponse } from "next/server";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// ============================================================
// API de Processamento de Documentos
// Recebe TEXTO já extraído (PDF extraído no browser, ou texto colado)
// Analisa padrões de: Portarias, DOU, datas, números
// ============================================================

interface CredenciamentoData {
  tipo_credenciamento: string;
  numero_credenciamento: string;
  data_credenciamento: string;
  veiculo_publicacao: string;
  numero_dou: string;
  data_publicacao_dou: string;
  secao_dou: string;
  pagina_dou: string;
  texto_extraido: string;
  confianca: "alta" | "media" | "baixa";
  campos_encontrados: string[];
}

// ----------------------------------------------------------
// PARSER INTELIGENTE — extrai dados de credenciamento do texto
// ----------------------------------------------------------
function parseCredenciamento(texto: string): CredenciamentoData {
  const campos_encontrados: string[] = [];
  const result: CredenciamentoData = {
    tipo_credenciamento: "",
    numero_credenciamento: "",
    data_credenciamento: "",
    veiculo_publicacao: "",
    numero_dou: "",
    data_publicacao_dou: "",
    secao_dou: "",
    pagina_dou: "",
    texto_extraido: texto.substring(0, 2000),
    confianca: "baixa",
    campos_encontrados: [],
  };

  // Normaliza espaços e quebras
  const txt = texto.replace(/\s+/g, " ").trim();

  // --- TIPO DE ATO (Portaria, Decreto, Resolução, etc.) ---
  const tipoAtoPatterns = [
    /\b(PORTARIA\s+NORMATIVA)\s+(?:N[ºo°]?\s*\.?\s*)(\d[\d.]*)/i,
    /\b(PORTARIA)\s+(?:MEC\s+)?(?:N[ºo°]?\s*\.?\s*)(\d[\d.]*)/i,
    /\b(PORTARIA)\s+(?:N[ºo°]?\s*\.?\s*)(\d[\d.]*)/i,
    /\b(DECRETO)\s+(?:N[ºo°]?\s*\.?\s*)(\d[\d.]*)/i,
    /\b(RESOLUÇÃO)\s+(?:N[ºo°]?\s*\.?\s*)(\d[\d.]*)/i,
    /\b(PARECER)\s+(?:N[ºo°]?\s*\.?\s*)(\d[\d.]*)/i,
  ];

  for (const pattern of tipoAtoPatterns) {
    const match = txt.match(pattern);
    if (match) {
      result.tipo_credenciamento = match[1].trim();
      result.numero_credenciamento = match[2].replace(/\./g, "").trim();
      campos_encontrados.push("tipo_credenciamento", "numero_credenciamento");
      break;
    }
  }

  // --- DATAS (dd de mês de yyyy) ---
  const meses: Record<string, string> = {
    janeiro: "01", fevereiro: "02", "março": "03", marco: "03",
    abril: "04", maio: "05", junho: "06", julho: "07",
    agosto: "08", setembro: "09", outubro: "10",
    novembro: "11", dezembro: "12",
  };

  const datasEncontradas: string[] = [];

  // Padrão por extenso
  let match;
  const regexExtenso = /(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/gi;
  while ((match = regexExtenso.exec(txt)) !== null) {
    const dia = match[1].padStart(2, "0");
    const mesNome = match[2].toLowerCase();
    const ano = match[3];
    const mes = meses[mesNome];
    if (mes) {
      datasEncontradas.push(`${ano}-${mes}-${dia}`);
    }
  }

  // Padrão numérico
  const regexNumerico = /(\d{2})[/.](\d{2})[/.](\d{4})/g;
  while ((match = regexNumerico.exec(txt)) !== null) {
    datasEncontradas.push(`${match[3]}-${match[2]}-${match[1]}`);
  }

  // A primeira data geralmente é a data do ato/credenciamento
  if (datasEncontradas.length > 0) {
    result.data_credenciamento = datasEncontradas[0];
    campos_encontrados.push("data_credenciamento");
  }
  // Se tem mais de uma data, a segunda pode ser a data de publicação
  if (datasEncontradas.length > 1) {
    result.data_publicacao_dou = datasEncontradas[datasEncontradas.length - 1];
    campos_encontrados.push("data_publicacao_dou");
  }

  // --- DOU (Diário Oficial da União) ---
  if (/di[aá]rio\s+oficial/i.test(txt) || /\bDOU\b/.test(txt)) {
    result.veiculo_publicacao = "DOU";
    campos_encontrados.push("veiculo_publicacao");
  } else if (/di[aá]rio\s+oficial\s+do\s+estado/i.test(txt) || /\bDOE\b/.test(txt)) {
    result.veiculo_publicacao = "DOE";
    campos_encontrados.push("veiculo_publicacao");
  }

  // Número do DOU
  const douNumPatterns = [
    /DOU\s+(?:N[ºo°]?\s*\.?\s*)(\d+)/i,
    /Di[aá]rio\s+Oficial[^,]*?,?\s*(?:N[ºo°]?\s*\.?\s*)(\d+)/i,
    /Edi[çc][aã]o\s+(?:N[ºo°]?\s*\.?\s*)(\d+)/i,
    /n[ºo°]\s*\.?\s*(\d+),?\s*(?:de\s+\d)/i,
  ];

  for (const pattern of douNumPatterns) {
    const m = txt.match(pattern);
    if (m) {
      result.numero_dou = m[1].trim();
      campos_encontrados.push("numero_dou");
      break;
    }
  }

  // Seção do DOU
  const secaoPatterns = [
    /Se[çc][aã]o\s+(\d+)/i,
    /S[Ee][ÇC][ÃA]O\s+(\d+)/i,
  ];
  for (const pattern of secaoPatterns) {
    const m = txt.match(pattern);
    if (m) {
      result.secao_dou = m[1].trim();
      campos_encontrados.push("secao_dou");
      break;
    }
  }

  // Página do DOU
  const paginaPatterns = [
    /[Pp][aá]gina\s+(\d+)/i,
    /p[aá]g[.\s]+(\d+)/i,
  ];
  for (const pattern of paginaPatterns) {
    const m = txt.match(pattern);
    if (m) {
      result.pagina_dou = m[1].trim();
      campos_encontrados.push("pagina_dou");
      break;
    }
  }

  // --- Padrões específicos do e-MEC ---
  // "No. Documento: 1038 de 16/12/2022"
  if (!result.numero_credenciamento) {
    const mecDocPattern = /No\.\s*Documento:\s*(\d+)/i;
    const mecMatch = txt.match(mecDocPattern);
    if (mecMatch) {
      result.numero_credenciamento = mecMatch[1];
      if (!campos_encontrados.includes("numero_credenciamento")) {
        campos_encontrados.push("numero_credenciamento");
      }
    }
  }

  // "Tipo de Documento: Portaria"
  if (!result.tipo_credenciamento) {
    const mecTipoPattern = /Tipo\s+de\s+Documento:\s*(\w+)/i;
    const mecMatch = txt.match(mecTipoPattern);
    if (mecMatch) {
      result.tipo_credenciamento = mecMatch[1];
      if (!campos_encontrados.includes("tipo_credenciamento")) {
        campos_encontrados.push("tipo_credenciamento");
      }
    }
  }

  // "Data do Documento: 16/12/2022"
  if (!result.data_credenciamento) {
    const mecDataPattern = /Data\s+do\s+Documento:\s*(\d{2}\/\d{2}\/\d{4})/i;
    const mecMatch = txt.match(mecDataPattern);
    if (mecMatch) {
      const parts = mecMatch[1].split("/");
      result.data_credenciamento = `${parts[2]}-${parts[1]}-${parts[0]}`;
      if (!campos_encontrados.includes("data_credenciamento")) {
        campos_encontrados.push("data_credenciamento");
      }
    }
  }

  // "Data de Publicação: 20/12/2022"
  if (!result.data_publicacao_dou) {
    const mecPubPattern = /Data\s+de\s+Publica[çc][aã]o:\s*(\d{2}\/\d{2}\/\d{4})/i;
    const mecMatch = txt.match(mecPubPattern);
    if (mecMatch) {
      const parts = mecMatch[1].split("/");
      result.data_publicacao_dou = `${parts[2]}-${parts[1]}-${parts[0]}`;
      if (!campos_encontrados.includes("data_publicacao_dou")) {
        campos_encontrados.push("data_publicacao_dou");
      }
    }
  }

  // "Ato Regulatório: Recredenciamento"
  const atoRegPattern = /Ato\s+Regulat[oó]rio:\s*(\w+)/i;
  const atoMatch = txt.match(atoRegPattern);
  if (atoMatch) {
    // Adiciona como info extra (tipo de credenciamento se não tiver)
    if (!result.tipo_credenciamento) {
      result.tipo_credenciamento = atoMatch[1];
      if (!campos_encontrados.includes("tipo_credenciamento")) {
        campos_encontrados.push("tipo_credenciamento");
      }
    }
  }

  // Calcular confiança
  result.campos_encontrados = campos_encontrados;
  if (campos_encontrados.length >= 5) {
    result.confianca = "alta";
  } else if (campos_encontrados.length >= 3) {
    result.confianca = "media";
  } else {
    result.confianca = "baixa";
  }

  return result;
}

// ----------------------------------------------------------
// HANDLER PRINCIPAL
// ----------------------------------------------------------
export const POST = protegerRota(async (request: NextRequest, { userId, tenantId }) => {
  try {
    const formData = await request.formData();
    const textoManual = formData.get("texto") as string | null;

    if (!textoManual || !textoManual.trim()) {
      return NextResponse.json(
        { error: "Nenhum texto para processar", campos_encontrados: [] },
        { status: 400 }
      );
    }

    // Processa o texto e extrai dados de credenciamento
    const resultado = parseCredenciamento(textoManual);

    return NextResponse.json(resultado);
  } catch (err) {
    console.error("Erro ao processar documento:", err);
    return NextResponse.json(
      { erro: sanitizarErro("Erro ao processar o documento", 500) },
      { status: 500 }
    );
  }
})
