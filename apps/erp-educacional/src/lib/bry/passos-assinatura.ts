// ─────────────────────────────────────────────────────────────────────────────
// Geração DINÂMICA dos passos de assinatura para cada tipo de XML
//
// Os passos são montados a partir da tabela `assinantes` (configuração do
// usuário), respeitando as regras da Portaria MEC 554/2019 e IN SESU 1/2020:
//
// - e-CPFs assinam primeiro (ordem definida pelo usuário)
// - e-CNPJ assina por último (DadosDiploma + Envelope AD-RA)
// - Cada e-CPF gera um passo separado de assinatura
//
// Quando não há assinantes no banco, usa fallback estático (1 e-CPF + 1 e-CNPJ).
// ─────────────────────────────────────────────────────────────────────────────

import type { PassoAssinatura, TipoDocumentoBry } from "./types";

const MEC_NS = "https://portal.mec.gov.br/diplomadigital/arquivos-em-xsd";

/**
 * Assinante vindo do banco (campos relevantes para montagem de passos).
 */
export interface AssinanteBanco {
  id: string;
  nome: string;
  cpf?: string | null;
  cargo: string;
  tipo_certificado: "eCPF" | "eCNPJ";
  ordem_assinatura: number;
  ativo: boolean;
}

// ─── Fallbacks estáticos (quando não há assinantes no banco) ────────────────

const FALLBACK_DOC_ACADEMICA: PassoAssinatura[] = [
  {
    passo: 1,
    descricao: "Representante da Emissora (e-CPF) — DadosDiploma",
    tipoAssinante: "Representantes",
    perfil: "ADRT",
    specificNodeName: "DadosDiploma",
    specificNodeNamespace: MEC_NS,
    includeXPathEnveloped: false,
  },
  {
    passo: 2,
    descricao: "IES Emissora (e-CNPJ) — DadosDiploma",
    tipoAssinante: "IESEmissoraDadosDiploma",
    perfil: "ADRT",
    specificNodeName: "DadosDiploma",
    specificNodeNamespace: MEC_NS,
    includeXPathEnveloped: false,
  },
  {
    passo: 3,
    descricao: "IES Emissora (e-CNPJ) — Envelope AD-RA",
    tipoAssinante: "IESEmissoraRegistro",
    perfil: "ADRA",
    specificNodeName: null,
    specificNodeNamespace: null,
    includeXPathEnveloped: false,
  },
];

const FALLBACK_DIPLOMADO: PassoAssinatura[] = [
  {
    passo: 1,
    descricao: "Representante da Registradora (e-CPF) — DadosRegistro",
    tipoAssinante: "Representantes",
    perfil: "ADRT",
    specificNodeName: "DadosRegistro",
    specificNodeNamespace: MEC_NS,
    includeXPathEnveloped: false,
  },
  {
    passo: 2,
    descricao: "IES Registradora (e-CNPJ) — Envelope AD-RA",
    tipoAssinante: "IESRegistradora",
    perfil: "ADRA",
    specificNodeName: null,
    specificNodeNamespace: null,
    includeXPathEnveloped: false,
  },
];

const FALLBACK_HISTORICO: PassoAssinatura[] = [
  {
    passo: 1,
    descricao: "Representante da Secretaria (e-CPF) — Documento inteiro",
    tipoAssinante: "Representantes",
    perfil: "ADRT",
    specificNodeName: null,
    specificNodeNamespace: null,
    includeXPathEnveloped: false,
  },
  {
    passo: 2,
    descricao: "IES Emissora (e-CNPJ) — Envelope AD-RA",
    tipoAssinante: "IESEmissoraDadosDiploma",
    perfil: "ADRA",
    specificNodeName: null,
    specificNodeNamespace: null,
    includeXPathEnveloped: false,
  },
];

const FALLBACK_CURRICULO: PassoAssinatura[] = [
  {
    passo: 1,
    descricao: "Coordenador do Curso (e-CPF) — Documento inteiro",
    tipoAssinante: "Representantes",
    perfil: "ADRT",
    specificNodeName: null,
    specificNodeNamespace: null,
    includeXPathEnveloped: false,
  },
  {
    passo: 2,
    descricao: "IES Emissora (e-CNPJ) — Envelope AD-RA",
    tipoAssinante: "IESEmissoraDadosDiploma",
    perfil: "ADRA",
    specificNodeName: null,
    specificNodeNamespace: null,
    includeXPathEnveloped: false,
  },
];

// ─── Mapa de cargos para labels legíveis ────────────────────────────────────

const CARGO_LABELS: Record<string, string> = {
  reitor: "Reitor",
  reitor_exercicio: "Reitor em Exercício",
  responsavel_registro: "Responsável pelo Registro",
  coordenador_curso: "Coordenador de Curso",
  subcoordenador_curso: "Subcoordenador de Curso",
  coordenador_exercicio: "Coordenador em Exercício",
  chefe_registro: "Chefe de Registro",
  chefe_registro_exercicio: "Chefe de Registro em Exercício",
  secretario_decano: "Secretário Decano",
  outro: "Representante",
  // Cargos adicionais usados na UI
  diretor_presidente: "Diretor Presidente",
  diretora_academica: "Diretora Acadêmica",
};

function labelCargo(cargo: string): string {
  return CARGO_LABELS[cargo] ?? cargo.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Geração dinâmica ───────────────────────────────────────────────────────

/**
 * Gera passos de assinatura para XMLDocumentacaoAcademica a partir dos assinantes.
 *
 * Regra MEC:
 * 1. Cada e-CPF assina nodo DadosDiploma (ADRT) — na ordem configurada
 * 2. e-CNPJ assina nodo DadosDiploma (ADRT) — includeXPathEnveloped=false
 * 3. e-CNPJ assina envelope inteiro (ADRA) — includeXPathEnveloped=false
 */
function gerarPassosDocAcademica(assinantes: AssinanteBanco[]): PassoAssinatura[] {
  const ecpfs = assinantes.filter((a) => a.tipo_certificado === "eCPF");
  const ecnpj = assinantes.find((a) => a.tipo_certificado === "eCNPJ");

  if (ecpfs.length === 0 || !ecnpj) return FALLBACK_DOC_ACADEMICA;

  const passos: PassoAssinatura[] = [];
  let passo = 1;

  // Cada e-CPF assina DadosDiploma
  for (const cpf of ecpfs) {
    passos.push({
      passo: passo++,
      descricao: `${cpf.nome} (e-CPF) — DadosDiploma`,
      tipoAssinante: "Representantes",
      perfil: "ADRT",
      specificNodeName: "DadosDiploma",
      specificNodeNamespace: MEC_NS,
      includeXPathEnveloped: passo > 2, // false no 1º, true a partir do 2º
      cpfAssinante: cpf.cpf ?? null,
      tipoCertificado: "eCPF",
    });
  }

  // e-CNPJ assina DadosDiploma
  passos.push({
    passo: passo++,
    descricao: `${ecnpj.nome} (e-CNPJ) — DadosDiploma`,
    tipoAssinante: "IESEmissoraDadosDiploma",
    perfil: "ADRT",
    specificNodeName: "DadosDiploma",
    specificNodeNamespace: MEC_NS,
    includeXPathEnveloped: false,
    cpfAssinante: ecnpj.cpf ?? null,
    tipoCertificado: "eCNPJ",
  });

  // e-CNPJ assina envelope AD-RA
  passos.push({
    passo: passo++,
    descricao: `${ecnpj.nome} (e-CNPJ) — Envelope AD-RA`,
    tipoAssinante: "IESEmissoraRegistro",
    perfil: "ADRA",
    specificNodeName: null,
    specificNodeNamespace: null,
    includeXPathEnveloped: false,
    cpfAssinante: ecnpj.cpf ?? null,
    tipoCertificado: "eCNPJ",
  });

  return passos;
}

/**
 * Gera passos para XMLHistoricoEscolar a partir dos assinantes.
 *
 * Regra MEC:
 * 1. Cada e-CPF assina documento inteiro (ADRT)
 * 2. e-CNPJ assina envelope inteiro (ADRA)
 */
function gerarPassosHistorico(assinantes: AssinanteBanco[]): PassoAssinatura[] {
  const ecpfs = assinantes.filter((a) => a.tipo_certificado === "eCPF");
  const ecnpj = assinantes.find((a) => a.tipo_certificado === "eCNPJ");

  if (ecpfs.length === 0 || !ecnpj) return FALLBACK_HISTORICO;

  const passos: PassoAssinatura[] = [];
  let passo = 1;

  for (const cpf of ecpfs) {
    passos.push({
      passo: passo++,
      descricao: `${cpf.nome} (e-CPF) — Documento inteiro`,
      tipoAssinante: "Representantes",
      perfil: "ADRT",
      specificNodeName: null,
      specificNodeNamespace: null,
      includeXPathEnveloped: passo > 2,
      cpfAssinante: cpf.cpf ?? null,
      tipoCertificado: "eCPF",
    });
  }

  passos.push({
    passo: passo++,
    descricao: `${ecnpj.nome} (e-CNPJ) — Envelope AD-RA`,
    tipoAssinante: "IESEmissoraDadosDiploma",
    perfil: "ADRA",
    specificNodeName: null,
    specificNodeNamespace: null,
    includeXPathEnveloped: false,
    cpfAssinante: ecnpj.cpf ?? null,
    tipoCertificado: "eCNPJ",
  });

  return passos;
}

/**
 * Gera passos para XMLCurriculoEscolar (mesma lógica do Histórico).
 */
function gerarPassosCurriculo(assinantes: AssinanteBanco[]): PassoAssinatura[] {
  const ecpfs = assinantes.filter((a) => a.tipo_certificado === "eCPF");
  const ecnpj = assinantes.find((a) => a.tipo_certificado === "eCNPJ");

  if (ecpfs.length === 0 || !ecnpj) return FALLBACK_CURRICULO;

  const passos: PassoAssinatura[] = [];
  let passo = 1;

  for (const cpf of ecpfs) {
    passos.push({
      passo: passo++,
      descricao: `${cpf.nome} (e-CPF) — Documento inteiro`,
      tipoAssinante: "Representantes",
      perfil: "ADRT",
      specificNodeName: null,
      specificNodeNamespace: null,
      includeXPathEnveloped: passo > 2,
      cpfAssinante: cpf.cpf ?? null,
      tipoCertificado: "eCPF",
    });
  }

  passos.push({
    passo: passo++,
    descricao: `${ecnpj.nome} (e-CNPJ) — Envelope AD-RA`,
    tipoAssinante: "IESEmissoraDadosDiploma",
    perfil: "ADRA",
    specificNodeName: null,
    specificNodeNamespace: null,
    includeXPathEnveloped: false,
    cpfAssinante: ecnpj.cpf ?? null,
    tipoCertificado: "eCNPJ",
  });

  return passos;
}

// ─── API pública ────────────────────────────────────────────────────────────

/**
 * Retorna os passos estáticos (fallback quando assinantes não estão disponíveis).
 * @deprecated Preferir getPassosAssinaturaDinamicos() que lê do banco.
 */
export function getPassosAssinatura(
  tipoDocumento: TipoDocumentoBry
): PassoAssinatura[] {
  switch (tipoDocumento) {
    case "XMLDocumentacaoAcademica":
      return FALLBACK_DOC_ACADEMICA;
    case "XMLDiplomado":
      return FALLBACK_DIPLOMADO;
    case "XMLHistoricoEscolar":
      return FALLBACK_HISTORICO;
    case "XMLCurriculoEscolar":
      return FALLBACK_CURRICULO;
    default:
      throw new Error(`Tipo de documento BRy desconhecido: ${tipoDocumento}`);
  }
}

/**
 * Gera os passos de assinatura dinamicamente a partir dos assinantes configurados.
 *
 * @param tipoDocumento Tipo de documento BRy
 * @param assinantes Lista de assinantes ativos da tabela, ordenados por ordem_assinatura
 * @returns Passos de assinatura com nomes reais dos assinantes
 */
export function getPassosAssinaturaDinamicos(
  tipoDocumento: TipoDocumentoBry,
  assinantes: AssinanteBanco[]
): PassoAssinatura[] {
  // Filtrar apenas ativos e ordenar por ordem_assinatura
  const ativos = assinantes
    .filter((a) => a.ativo)
    .sort((a, b) => a.ordem_assinatura - b.ordem_assinatura);

  if (ativos.length === 0) {
    return getPassosAssinatura(tipoDocumento); // fallback estático
  }

  switch (tipoDocumento) {
    case "XMLDocumentacaoAcademica":
      return gerarPassosDocAcademica(ativos);
    case "XMLDiplomado":
      return FALLBACK_DIPLOMADO; // assinado pela registradora, não muda
    case "XMLHistoricoEscolar":
      return gerarPassosHistorico(ativos);
    case "XMLCurriculoEscolar":
      return gerarPassosCurriculo(ativos);
    default:
      throw new Error(`Tipo de documento BRy desconhecido: ${tipoDocumento}`);
  }
}
