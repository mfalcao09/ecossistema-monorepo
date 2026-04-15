/**
 * Gerador do XML DocumentacaoAcademicaRegistro
 *
 * Root: <DocumentacaoAcademicaRegistro>
 *   → RegistroReq(versao, id, ambiente)
 *     → DadosDiploma(id)
 *       → Diplomado, DataConclusao, DadosCurso(completo), IesEmissora
 *     → DadosPrivadosDiplomado
 *       → Filiacao, HistoricoEscolar(completo)
 *     → DocumentacaoComprobatoria
 *
 * Este XML é gerado pela FIC (emissora) e enviado à registradora.
 * Conforme XSD v1.05 — Portaria MEC 70/2025.
 */

import { DadosDiploma } from '../tipos';
import {
  criarDocumentoXML,
  serializarXML,
  XSD_VERSAO,
  gerarIdXML,
  fmtData,
  formatarAmbienteXSD,
} from '../builders/base.builder';
import { buildDiplomado } from '../builders/diplomado.builder';
import { buildDadosCursoCompleto } from '../builders/curso.builder';
import { buildIesEmissora } from '../builders/ies-emissora.builder';
import { buildAssinantesIes } from '../builders/assinantes.builder';
import { buildHistoricoEscolar } from '../builders/historico.builder';
import { buildFiliacao } from '../builders/dados-privados.builder';
import type { DocumentoComprobatorioParaXml } from '../../pdfa/converter-service';

/**
 * Tupla não-vazia de comprobatórios prontos para serialização XML.
 *
 * O tipo `[T, ...T[]]` força em compile-time que pelo menos 1 elemento
 * seja fornecido, evitando que um array vazio gere `<DocumentacaoComprobatoria/>`
 * — cardinalidade XSD v1.05 exige `minOccurs="1"`.
 *
 * Use `validarComprobatoriosNonEmpty(arr)` (a ser implementado no consumer)
 * para converter `DocumentoComprobatorioParaXml[]` em `DocumentosComprobatoriosNonEmpty`.
 */
export type DocumentosComprobatoriosNonEmpty = readonly [
  DocumentoComprobatorioParaXml,
  ...DocumentoComprobatorioParaXml[],
];

/**
 * Gera o XML DocumentacaoAcademicaRegistro completo.
 *
 * **Backwards-compat overload**: chamadas existentes sem o segundo argumento
 * preservam o comportamento legado (placeholder hardcoded de 1 documento
 * `DocumentoIdentidadeDoAluno` sem base64). Quando `comprobatorios` é
 * fornecido, serializa cada item como `<Documento tipo="..." observacoes="...">{base64}</Documento>`.
 *
 * @param dados - DadosDiploma montado do banco
 * @param comprobatorios - (opcional) Tupla não-vazia de PDFs/A em base64 prontos
 * @returns XML como string UTF-8
 */
export function gerarDocAcademicaXML(dados: DadosDiploma): string;
export function gerarDocAcademicaXML(
  dados: DadosDiploma,
  comprobatorios: DocumentosComprobatoriosNonEmpty,
): string;
export function gerarDocAcademicaXML(
  dados: DadosDiploma,
  comprobatorios?: DocumentosComprobatoriosNonEmpty,
): string {
  // IDs derivados do UUID do diploma
  const idReq = gerarIdXML('ReqDip', 44, dados.diploma.id);
  const idDip = gerarIdXML('Dip', 44, dados.diploma.id);

  // Cria documento raiz
  const doc = criarDocumentoXML('DocumentacaoAcademicaRegistro');

  // RegistroReq com atributos
  // Bug #1 — fix 2026-04-07 (Onda 1): ambiente dinâmico
  const req = doc.ele('RegistroReq');
  req.att('versao', XSD_VERSAO);
  req.att('id', idReq);
  req.att('ambiente', formatarAmbienteXSD(dados.diploma.ambiente));

  // DadosDiploma — contém Diplomado, DataConclusao, DadosCurso(completo), IesEmissora
  const dadosDiploma = req.ele('DadosDiploma');
  dadosDiploma.att('id', idDip);

  buildDiplomado(dadosDiploma, dados);
  dadosDiploma.ele('DataConclusao').txt(fmtData(dados.diploma.data_conclusao));
  buildDadosCursoCompleto(dadosDiploma, dados);
  buildIesEmissora(dadosDiploma, dados);

  // Assinantes — TInfoAssinantes (XSD v1.05, opcional dentro de TDadosDiploma).
  // Deve aparecer DEPOIS de IesEmissora e ANTES das ds:Signature (que serão
  // adicionadas pela API de assinatura BRy). Cardinalidade <Assinante>: 1+.
  buildAssinantesIes(dadosDiploma, dados);

  // DadosPrivadosDiplomado — Filiação + HistóricoEscolar completo
  const dadosPrivados = req.ele('DadosPrivadosDiplomado');
  buildFiliacao(dadosPrivados, dados);
  buildHistoricoEscolar(dadosPrivados, dados);

  // DocumentacaoComprobatoria — minOccurs=1 (XSD v1.05)
  // Cada <Documento> é FLAT: atributos `tipo` (enum 9 valores) e `observacoes`
  // (opcional), conteúdo textual = base64 do PDF/A. Subelementos
  // numero/orgao/uf/data NÃO existem no XML — ficam só como metadata interna
  // (ver memory/project_xsd_documento_comprobatorio_flat.md).
  const docComp = req.ele('DocumentacaoComprobatoria');

  if (comprobatorios && comprobatorios.length > 0) {
    for (const item of comprobatorios) {
      const documento = docComp.ele('Documento');
      documento.att('tipo', item.tipo_xsd);
      if (item.observacao && item.observacao.trim().length > 0) {
        documento.att('observacoes', item.observacao);
      }
      documento.txt(item.pdfa.base64);
    }
  } else {
    // Backwards-compat: placeholder legado (1 documento sem base64).
    // Mantido apenas para não quebrar consumidores antigos do gerador
    // antes do commit 3 do Bug #F (route gerar-xml passar comprobatorios).
    const documento = docComp.ele('Documento');
    documento.att('tipo', 'DocumentoIdentidadeDoAluno');
  }

  return serializarXML(doc);
}
