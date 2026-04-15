/**
 * Gerador do XML DocumentoHistoricoEscolarFinal
 *
 * Root: <DocumentoHistoricoEscolarFinal>
 *   → infHistoricoEscolar(versao, ambiente)
 *     → Aluno, DadosCurso(mínimo), IesEmissora, HistoricoEscolar, SegurancaHistorico
 *
 * Este XML é gerado pela FIC (emissora).
 * Conforme XSD v1.05 — Portaria MEC 70/2025.
 */

import { DadosDiploma } from '../tipos';
import {
  criarDocumentoXML,
  serializarXML,
  XSD_VERSAO,
  formatarAmbienteXSD,
} from '../builders/base.builder';
import { buildDiplomado } from '../builders/diplomado.builder';
import { buildDadosCursoMinimo } from '../builders/curso.builder';
import { buildIesEmissora } from '../builders/ies-emissora.builder';
import { buildHistoricoEscolar } from '../builders/historico.builder';

/**
 * Gera o XML DocumentoHistoricoEscolarFinal completo
 * @param dados - DadosDiploma montado do banco
 * @returns XML como string UTF-8
 */
export function gerarHistoricoEscolarXML(dados: DadosDiploma): string {
  // Cria documento raiz
  const doc = criarDocumentoXML('DocumentoHistoricoEscolarFinal');

  // infHistoricoEscolar com atributos
  // Bug #1 — fix 2026-04-07 (Onda 1): ambiente dinâmico
  const inf = doc.ele('infHistoricoEscolar');
  inf.att('versao', XSD_VERSAO);
  inf.att('ambiente', formatarAmbienteXSD(dados.diploma.ambiente));

  // Aluno (mesmo que Diplomado, mas com tag <Aluno>)
  buildDiplomado(inf, dados, 'Aluno');

  // DadosCurso (versão mínima para histórico)
  buildDadosCursoMinimo(inf, dados);

  // IesEmissora
  buildIesEmissora(inf, dados);

  // HistoricoEscolar (disciplinas, ENADE, carga horária, etc.)
  buildHistoricoEscolar(inf, dados);

  // SegurancaHistorico
  const seguranca = inf.ele('SegurancaHistorico');
  seguranca.ele('CodigoValidacao').txt(dados.historico.codigo_validacao_historico || '');

  return serializarXML(doc);
}
