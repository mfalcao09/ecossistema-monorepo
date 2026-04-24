import { NextRequest, NextResponse } from "next/server";
import { verificarAuth } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// ─── Mapeamento de colunas do e-MEC → campos internos ─────────────────────────
// O CSV do e-MEC usa separador ";" e encoding ISO-8859-1 (ou Windows-1252)
// Algumas colunas têm prefixo ="..." para evitar que o Excel interprete como fórmula

function limpar(v: string): string {
  if (!v) return "";
  // Remove prefixo =" e sufixo " usado pelo e-MEC para campos de código
  return v.replace(/^="?/, "").replace(/"?$/, "").trim();
}

function parseDateBR(v: string): string {
  // Converte dd/mm/yyyy → yyyy-mm-dd
  if (!v) return "";
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function mapGrau(v: string): string {
  const map: Record<string, string> = {
    bacharelado: "bacharel",
    licenciatura: "licenciado",
    tecnológico: "tecnologo",
    tecnologico: "tecnologo",
    especialização: "especialista",
    especializacao: "especialista",
    mestrado: "mestre",
    doutorado: "doutor",
  };
  return map[v.toLowerCase().trim()] ?? "bacharel";
}

function mapModalidade(v: string): string {
  const lower = v.toLowerCase();
  if (
    lower.includes("distância") ||
    lower.includes("distancia") ||
    lower.includes("ead")
  )
    return "ead";
  if (lower.includes("híbrido") || lower.includes("hibrido")) return "hibrido";
  return "presencial";
}

function parseCursoFromRow(cols: string[]): Record<string, unknown> | null {
  // Cabeçalho esperado (índices fixos conforme export e-MEC):
  // 0  CÓDIGO DA IES
  // 1  NOME DA IES
  // 2  SITUACAO DA IES
  // 3  CÓDIGO DO CURSO
  // 4  CÓDIGO DA DENOMINAÇÃO
  // 5  MARCAÇÃO DA DENOMINAÇÃO
  // 6  NOME DO CURSO
  // 7  DATA DE CADASTRO DO CURSO
  // 8  GRAU
  // 9  CÓDIGO CINE RÓTULO
  // 10 CINE RÓTULO
  // 11 CÓDIGO CINE ÁREA DETALHADA
  // 12 CINE ÁREA DETALHADA
  // 13 CÓDIGO CINE ÁREA ESPECÍFICA
  // 14 CINE ÁREA ESPECÍFICA
  // 15 CÓDIGO CINE ÁREA GERAL
  // 16 CINE ÁREA GERAL
  // 17 MODALIDADE
  // 18 SITUACAO DO CURSO
  // 19 QT VAGAS AUTORIZADAS
  // 20 CARGA HORÁRIA
  // 21 CARGA HORÁRIA DISTÂNCIA
  // 22 CARGA HORÁRIA ESTÁGIO
  // 23 CARGA HORÁRIA ATIV. COMPLEMENTARES
  // 24 CARGA HORÁRIA TCC
  // 25 CARGA HORÁRIA LIBRAS
  // 26 TIPO DE PERIODICIDADE
  // 27-36 vagas por turno (ignorar)
  // 37 CÓDIGO DO ENDEREÇO
  // 38 ENDERECO
  // 39 NUMERO ENDERECO
  // 40 COMPLEMENTO
  // 41 BAIRRO
  // 42 MUNICIPIO
  // 43 UF
  // 44 TIPO DOC. AUTORIZAÇÃO
  // 45 DOCUMENTO DE AUTORIZAÇÃO
  // 46 DT CONSIDERADA AUTORIZAÇÃO
  // 47 DT. PUBLICAÇÃO AUTORIZAÇÃO
  // 48 DT. CADASTRO AUTORIZAÇÃO
  // 49 TIPO DOC. RECONHECIMENTO
  // 50 DOCUMENTO DE RECONHECIMENTO
  // 51 DT CONSIDERADA RECONHECIMENTO
  // 52 DT. PUBLICAÇÃO RECONHECIMENTO
  // 53 DT. CADASTRO RECONHECIMENTO
  // 54 TIPO DOC. RENOVAÇÃO
  // 55 DOC. ULTIMA RENOVAÇÃO
  // 56 DT CONSIDERADA RENOVAÇÃO
  // 57 DT. PUBLICAÇÃO RENOVAÇÃO
  // 58 DT. CADASTRO RENOVAÇÃO
  // 59 INICIO FUNCIONAMENTO
  // 60 PROCESSOS EM TRAMITAÇÃO
  // 61 VALOR CC
  // 62 ANO CC
  // 63 CPC FAIXA
  // 64 CPC CONTINUO
  // 65 CPC ANO
  // 66 VALOR ENADE
  // 67 ENADE ANO
  // 68 CPF COORDENADOR CURSO
  // 69 NOME COORDENADOR CURSO
  // 70 EMAIL COORDENADOR CURSO
  // 71 TELEFONE COORDENADOR CURSO

  if (cols.length < 20) return null;

  const nome = limpar(cols[6]);
  if (!nome) return null;

  const situacao = limpar(cols[18]).toLowerCase();

  return {
    // Identificação
    codigo_emec: limpar(cols[3]),
    nome,
    grau: mapGrau(limpar(cols[8])),
    modalidade: mapModalidade(limpar(cols[17])),
    situacao_emec: limpar(cols[18]),

    // CINE (classificação internacional)
    cine_rotulo: limpar(cols[10]),
    cine_area_detalhada: limpar(cols[12]),
    cine_area_especifica: limpar(cols[14]),
    cine_area_geral: limpar(cols[16]),

    // Cargas horárias
    carga_horaria_total: parseInt(limpar(cols[20])) || null,
    carga_horaria_estagio: parseInt(limpar(cols[22])) || null,
    carga_horaria_atividades_complementares: parseInt(limpar(cols[23])) || null,
    carga_horaria_tcc: parseInt(limpar(cols[24])) || null,
    vagas_autorizadas: parseInt(limpar(cols[19])) || null,
    periodicidade: limpar(cols[26]),

    // Endereço
    logradouro: limpar(cols[38]),
    numero: limpar(cols[39]),
    complemento: limpar(cols[40]),
    bairro: limpar(cols[41]),
    municipio: limpar(cols[42]),
    uf: limpar(cols[43]),

    // Autorização
    tipo_autorizacao: limpar(cols[44]),
    numero_autorizacao: limpar(cols[45]),
    data_autorizacao: parseDateBR(limpar(cols[46])),

    // Reconhecimento
    tipo_reconhecimento: limpar(cols[49]),
    numero_reconhecimento: limpar(cols[50]),
    data_reconhecimento: parseDateBR(limpar(cols[51])),

    // Renovação (mais recente)
    tipo_renovacao: limpar(cols[54]),
    numero_renovacao: limpar(cols[55]),
    data_renovacao: parseDateBR(limpar(cols[56])),
    data_publicacao_renovacao: parseDateBR(limpar(cols[57])),

    // Início de funcionamento
    data_inicio_funcionamento: parseDateBR(limpar(cols[59])),

    // Avaliações
    conceito_curso: limpar(cols[61]) ? parseFloat(limpar(cols[61])) : null,
    ano_cc: parseInt(limpar(cols[62])) || null,
    cpc_faixa: parseInt(limpar(cols[63])) || null,
    cpc_continuo: limpar(cols[64]) ? parseFloat(limpar(cols[64])) : null,
    cpc_ano: parseInt(limpar(cols[65])) || null,
    enade_conceito: parseInt(limpar(cols[66])) || null,
    enade_ano: parseInt(limpar(cols[67])) || null,

    // Coordenador
    coordenador_nome: limpar(cols[69]),
    coordenador_email: limpar(cols[70]),
    coordenador_telefone: limpar(cols[71]),

    // Flags de controle
    _ativo: !situacao.includes("extinto"),
  };
}

function splitCSVLine(line: string): string[] {
  // Separa por ";" respeitando campos entre aspas
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ";" && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// POST /api/cursos/importar — recebe CSV do e-MEC, retorna prévia dos cursos parseados
export async function POST(request: NextRequest) {
  const auth = await verificarAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file)
      return NextResponse.json(
        { error: "Arquivo não enviado" },
        { status: 400 },
      );

    // Lê como ArrayBuffer e decodifica em Windows-1252 / Latin-1
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder("windows-1252");
    const text = decoder.decode(buffer);

    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2)
      return NextResponse.json(
        { error: "CSV vazio ou sem dados" },
        { status: 400 },
      );

    // Linha 0 = cabeçalho, linha 1+ = dados
    const cursos: Record<string, unknown>[] = [];
    const erros: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = splitCSVLine(lines[i]);
      const curso = parseCursoFromRow(cols);
      if (curso) {
        cursos.push(curso);
      } else if (lines[i].trim()) {
        erros.push(`Linha ${i + 1}: não foi possível parsear`);
      }
    }

    return NextResponse.json({ cursos, total: cursos.length, erros });
  } catch (err) {
    return NextResponse.json(
      { error: sanitizarErro(String(err), 500) },
      { status: 500 },
    );
  }
}
