/**
 * Validador Estrutural XML — fast-xml-parser
 *
 * Validação em 1 camada:
 * - XML bem-formado (fast-xml-parser)
 * - Namespace correto
 * - Versão XSD correta
 * - Elemento raiz correto
 * - Tags obrigatórias presentes
 *
 * NÃO valida contra XSD real (libxmljs não funciona em serverless).
 * Para validação completa, usar o verificador oficial do MEC após assinatura.
 */

import { XMLValidator, XMLParser } from 'fast-xml-parser';

// ============================================================
// TIPOS
// ============================================================

export interface ResultadoValidacao {
  valido: boolean;
  erros: string[];
  avisos: string[];
}

// ============================================================
// VALIDAÇÃO GENÉRICA
// ============================================================

/**
 * Valida se o XML é bem-formado usando fast-xml-parser
 */
function validarXMLBemFormado(xml: string): ResultadoValidacao {
  const erros: string[] = [];
  const avisos: string[] = [];

  // 1. Verifica declaração XML
  if (!xml.startsWith('<?xml')) {
    erros.push('XML não possui declaração <?xml version="1.0" encoding="UTF-8"?>');
  }

  // 2. Verifica encoding UTF-8
  if (!xml.includes('UTF-8')) {
    avisos.push('Recomenda-se usar encoding UTF-8');
  }

  // 3. Valida XML bem-formado via fast-xml-parser
  const result = XMLValidator.validate(xml, {
    allowBooleanAttributes: true,
  });

  if (result !== true) {
    erros.push(`XML malformado na linha ${result.err.line}, coluna ${result.err.col}: ${result.err.msg}`);
  }

  // 4. Verifica namespace MEC (HTTPS obrigatório)
  if (!xml.includes('https://portal.mec.gov.br/diplomadigital/arquivos-em-xsd')) {
    erros.push('Namespace do MEC não encontrado (deve ser HTTPS: https://portal.mec.gov.br/diplomadigital/arquivos-em-xsd)');
  }

  // 5. Verifica versão XSD
  if (!xml.includes('versao="1.05"')) {
    avisos.push('Atributo versao="1.05" não encontrado');
  }

  return { valido: erros.length === 0, erros, avisos };
}

/**
 * Verifica se tags obrigatórias estão presentes
 */
function verificarTagsObrigatorias(xml: string, tags: string[]): string[] {
  const erros: string[] = [];
  for (const tag of tags) {
    const regex = new RegExp(`<${tag}[\\s>]`, 'i');
    if (!regex.test(xml)) {
      erros.push(`Tag obrigatória <${tag}> não encontrada`);
    }
  }
  return erros;
}

/**
 * Extrai conteúdo de uma tag (primeiro match)
 */
function extrairTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

// ============================================================
// VALIDADORES POR TIPO DE XML
// ============================================================

/**
 * Valida o XML DocumentoHistoricoEscolarFinal
 */
export function validarHistoricoEscolar(xml: string): ResultadoValidacao {
  const base = validarXMLBemFormado(xml);
  const erros = [...base.erros];
  const avisos = [...base.avisos];

  // Verifica elemento raiz
  if (!xml.includes('<DocumentoHistoricoEscolarFinal')) {
    erros.push('Elemento raiz deve ser <DocumentoHistoricoEscolarFinal>');
  }

  // Tags obrigatórias do Histórico Escolar
  const tagsObrigatorias = [
    'infHistoricoEscolar',
    'Aluno',
    'ID',
    'Nome',
    'CPF',
    'DataNascimento',
    'DadosCurso',
    'NomeCurso',
    'CodigoCursoEMEC',
    'IesEmissora',
    'CodigoMEC',
    'CNPJ',
    'HistoricoEscolar',
    'CodigoCurriculo',
    'ElementosHistorico',
    'DataEmissaoHistorico',
    'HoraEmissaoHistorico',
    'SituacaoAtualDiscente',
    'ENADE',
    'CargaHorariaCursoIntegralizada',
    'CargaHorariaCurso',
    'IngressoCurso',
    'SegurancaHistorico',
    'CodigoValidacao',
  ];

  erros.push(...verificarTagsObrigatorias(xml, tagsObrigatorias));

  // Verifica se há ao menos 1 disciplina
  if (!xml.includes('<Disciplina>') && !xml.includes('<Disciplina ')) {
    avisos.push('Nenhuma <Disciplina> encontrada no histórico');
  }

  // Verifica CPF tem 11 dígitos
  const cpf = extrairTag(xml, 'CPF');
  if (cpf && cpf.replace(/\D/g, '').length !== 11) {
    erros.push(`CPF deve ter 11 dígitos, encontrado: "${cpf}"`);
  }

  return { valido: erros.length === 0, erros, avisos };
}

/**
 * Valida o XML DocumentacaoAcademicaRegistro
 */
export function validarDocAcademicaRegistro(xml: string): ResultadoValidacao {
  const base = validarXMLBemFormado(xml);
  const erros = [...base.erros];
  const avisos = [...base.avisos];

  // Verifica elemento raiz
  if (!xml.includes('<DocumentacaoAcademicaRegistro')) {
    erros.push('Elemento raiz deve ser <DocumentacaoAcademicaRegistro>');
  }

  // Tags obrigatórias da Documentação Acadêmica
  const tagsObrigatorias = [
    'RegistroReq',
    'DadosDiploma',
    'Diplomado',
    'ID',
    'Nome',
    'CPF',
    'DataConclusao',
    'DadosCurso',
    'NomeCurso',
    'CodigoCursoEMEC',
    'Modalidade',
    'TituloConferido',
    'GrauConferido',
    'IesEmissora',
    'DadosPrivadosDiplomado',
    'Filiacao',
    'HistoricoEscolar',
    'CodigoCurriculo',
    'ElementosHistorico',
    'DocumentacaoComprobatoria',
  ];

  erros.push(...verificarTagsObrigatorias(xml, tagsObrigatorias));

  // Verifica CNPJ tem 14 dígitos
  const cnpj = extrairTag(xml, 'CNPJ');
  if (cnpj && cnpj.replace(/\D/g, '').length !== 14) {
    erros.push(`CNPJ deve ter 14 dígitos, encontrado: "${cnpj}"`);
  }

  // Verifica se RegistroReq tem atributo id
  if (!xml.includes('id="ReqDip')) {
    avisos.push('RegistroReq deve conter atributo id com prefixo "ReqDip"');
  }

  return { valido: erros.length === 0, erros, avisos };
}

/**
 * Valida o XML Diploma (gerado pela registradora — apenas para referência)
 */
export function validarDiplomaDigital(xml: string): ResultadoValidacao {
  const base = validarXMLBemFormado(xml);
  const erros = [...base.erros];
  const avisos = [...base.avisos];

  if (!xml.includes('<Diploma')) {
    erros.push('Elemento raiz deve ser <Diploma>');
  }

  const tagsObrigatorias = [
    'infDiploma',
    'DadosDiploma',
    'Diplomado',
    'DadosCurso',
    'IesEmissora',
  ];

  erros.push(...verificarTagsObrigatorias(xml, tagsObrigatorias));

  return { valido: erros.length === 0, erros, avisos };
}
