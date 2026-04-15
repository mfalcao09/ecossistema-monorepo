/**
 * Motor de geração de XMLs do Diploma Digital — v2 (xmlbuilder2)
 * Conforme Portaria MEC 70/2025 e XSD v1.05
 *
 * NAMESPACE: https://portal.mec.gov.br/diplomadigital/arquivos-em-xsd
 *
 * IMPORTANTE — Papéis Emissora vs Registradora:
 * A FIC (emissora) gera APENAS 2 XMLs:
 *   1. DocumentoHistoricoEscolarFinal — histórico completo com disciplinas
 *   2. DocumentacaoAcademicaRegistro — dados privados + rito de emissão
 *
 * O XML do Diploma é montado pela REGISTRADORA (UFMS) após registro.
 *
 * ARQUITETURA v2:
 * - Builders modulares em src/lib/xml/builders/ (xmlbuilder2)
 * - Generators em src/lib/xml/generators/
 * - Validação em src/lib/xml/validation/ (fast-xml-parser)
 * - Este arquivo é a FACADE pública (backward compatible)
 */

import { DadosDiploma } from './tipos';
import { gerarHistoricoEscolarXML } from './generators/historico-escolar.generator';
import {
  gerarDocAcademicaXML,
  type DocumentosComprobatoriosNonEmpty,
} from './generators/doc-academica.generator';

// ============================================================
// INTERFACE DE SAÍDA (backward compatible)
// ============================================================

export interface XMLsGerados {
  /** @deprecated Montado pela registradora — presente apenas para legado */
  diploma_digital: string | null;
  historico_escolar: string;
  doc_academica_registro: string;
}

// ============================================================
// EXPORTS PÚBLICOS
// ============================================================

/**
 * Gera os XMLs de responsabilidade da EMISSORA (FIC):
 *   1. DocumentoHistoricoEscolarFinal — histórico escolar completo
 *   2. DocumentacaoAcademicaRegistro — dados privados + documentação comprobatória
 *
 * O XML do Diploma NÃO é gerado pela emissora — é montado pela registradora
 * após o registro. O campo diploma_digital retorna null para novos diplomas.
 *
 * **Backwards-compat overload**: chamadas existentes (sem o segundo argumento)
 * preservam o comportamento legado e geram `<DocumentacaoComprobatoria>` com o
 * placeholder hardcoded. Quando `comprobatorios` é fornecido (tupla não-vazia),
 * o XML doc-academica embute os PDF/A em base64 conforme XSD v1.05.
 *
 * @param dados - DadosDiploma montado pelo montador.ts
 * @param comprobatorios - (opcional) Tupla não-vazia de PDFs/A prontos para serialização
 * @returns XMLsGerados com os 2 XMLs como string UTF-8
 */
export function gerarXMLs(dados: DadosDiploma): XMLsGerados;
export function gerarXMLs(
  dados: DadosDiploma,
  comprobatorios: DocumentosComprobatoriosNonEmpty,
): XMLsGerados;
export function gerarXMLs(
  dados: DadosDiploma,
  comprobatorios?: DocumentosComprobatoriosNonEmpty,
): XMLsGerados {
  return {
    diploma_digital: null, // Montado pela registradora (UFMS)
    historico_escolar: gerarHistoricoEscolarXML(dados),
    doc_academica_registro: comprobatorios
      ? gerarDocAcademicaXML(dados, comprobatorios)
      : gerarDocAcademicaXML(dados),
  };
}

/**
 * Gera apenas o XML do Histórico Escolar
 */
export function gerarHistoricoEscolar(dados: DadosDiploma): string {
  return gerarHistoricoEscolarXML(dados);
}

/**
 * Gera apenas o XML da Documentação Acadêmica
 */
export function gerarDocAcademica(dados: DadosDiploma): string {
  return gerarDocAcademicaXML(dados);
}
