/**
 * Builder de Dados do Curso — TDadosCurso e TDadosMinimoCurso do XSD v1.05
 *
 * TDadosCurso (completo — para DocAcadêmica):
 *   NomeCurso, CodigoCursoEMEC, Habilitacao*, Modalidade, TituloConferido,
 *   GrauConferido, Enfase*, EnderecoCurso, Autorizacao, Reconhecimento, RenovacaoReconhecimento?
 *
 * TDadosMinimoCurso (mínimo — para Histórico):
 *   NomeCurso, CodigoCursoEMEC, Habilitacao*, Autorizacao, Reconhecimento, RenovacaoReconhecimento?
 */

import type { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import { DadosDiploma } from '../tipos';
import { fmtData, eleOpc } from './base.builder';
import { buildEndereco } from './endereco.builder';
import { buildAtoRegulatorio } from './ato-regulatorio.builder';

/** Títulos do enum TituloConferido do XSD v1.05 */
const TITULOS_ENUM = ['Licenciado', 'Tecnólogo', 'Bacharel', 'Médico'];

/**
 * Adiciona habilitações ao nó parent
 */
function buildHabilitacoes(parent: XMLBuilder, dados: DadosDiploma): void {
  for (const h of dados.curso.habilitacoes || []) {
    const hab = parent.ele('Habilitacao');
    hab.ele('NomeHabilitacao').txt(h.nome || '');
    hab.ele('DataHabilitacao').txt(fmtData(h.data));
  }
}

/**
 * Adiciona atos regulatórios (Autorizacao, Reconhecimento, RenovacaoReconhecimento?)
 */
function buildAtosRegulatorios(parent: XMLBuilder, dados: DadosDiploma): void {
  const c = dados.curso;

  const autorizacao = parent.ele('Autorizacao');
  buildAtoRegulatorio(autorizacao, c.autorizacao);

  const reconhecimento = parent.ele('Reconhecimento');
  buildAtoRegulatorio(reconhecimento, c.reconhecimento);

  if (c.renovacao_reconhecimento) {
    const renovacao = parent.ele('RenovacaoReconhecimento');
    buildAtoRegulatorio(renovacao, c.renovacao_reconhecimento);
  }
}

/**
 * Adiciona bloco <DadosCurso> COMPLETO ao parent (para DocAcadêmica)
 * Inclui: Modalidade, TituloConferido, GrauConferido, Enfase, EnderecoCurso
 */
export function buildDadosCursoCompleto(parent: XMLBuilder, dados: DadosDiploma): void {
  const c = dados.curso;
  const dadosCurso = parent.ele('DadosCurso');

  dadosCurso.ele('NomeCurso').txt(c.nome || '');
  dadosCurso.ele('CodigoCursoEMEC').txt(c.codigo_emec || '');

  buildHabilitacoes(dadosCurso, dados);

  dadosCurso.ele('Modalidade').txt(c.modalidade || 'Presencial');

  // TTituloConferido — choice entre Titulo (enum) ou OutroTitulo
  const tituloConferido = dadosCurso.ele('TituloConferido');
  if (TITULOS_ENUM.includes(c.titulo_conferido)) {
    tituloConferido.ele('Titulo').txt(c.titulo_conferido);
  } else {
    tituloConferido.ele('OutroTitulo').txt(c.titulo_conferido || '');
  }

  dadosCurso.ele('GrauConferido').txt(c.grau_conferido || '');
  eleOpc(dadosCurso, 'Enfase', c.enfase);

  // EnderecoCurso (usa builder de endereço com tag customizada)
  buildEndereco(dadosCurso, c.endereco, 'EnderecoCurso');

  buildAtosRegulatorios(dadosCurso, dados);
}

/**
 * Adiciona bloco <DadosCurso> MÍNIMO ao parent (para Histórico Escolar)
 * NÃO inclui: Modalidade, TituloConferido, GrauConferido, Enfase, EnderecoCurso
 */
export function buildDadosCursoMinimo(parent: XMLBuilder, dados: DadosDiploma): void {
  const c = dados.curso;
  const dadosCurso = parent.ele('DadosCurso');

  dadosCurso.ele('NomeCurso').txt(c.nome || '');
  dadosCurso.ele('CodigoCursoEMEC').txt(c.codigo_emec || '');

  buildHabilitacoes(dadosCurso, dados);
  buildAtosRegulatorios(dadosCurso, dados);
}
