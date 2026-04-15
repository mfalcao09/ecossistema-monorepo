/**
 * Builder de Dados Privados do Diplomado — para DocumentacaoAcademicaRegistro
 *
 * Contém: Filiação (TFiliacao — Genitor[])
 * Usado apenas na DocumentacaoAcademica, NÃO no HistoricoEscolar
 */

import type { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import { DadosDiploma, Genitor } from '../tipos';
import { eleOpc } from './base.builder';

/**
 * Adiciona bloco <Filiacao> ao parent
 * XSD exige ao menos 1 Genitor
 */
export function buildFiliacao(parent: XMLBuilder, dados: DadosDiploma): void {
  const filiacao = parent.ele('Filiacao');
  const genitores = dados.diplomado.filiacao || [];

  if (genitores.length === 0) {
    // Placeholder — XSD obriga ao menos 1
    const genitor = filiacao.ele('Genitor');
    genitor.ele('Nome').txt('-');
    genitor.ele('Sexo').txt('F');
    return;
  }

  for (const g of genitores) {
    const genitor = filiacao.ele('Genitor');
    genitor.ele('Nome').txt(g.nome || '');
    eleOpc(genitor, 'NomeSocial', g.nome_social);
    genitor.ele('Sexo').txt(g.sexo || 'F');
  }
}
