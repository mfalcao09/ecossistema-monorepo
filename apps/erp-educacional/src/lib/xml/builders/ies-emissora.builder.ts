/**
 * Builder da IES Emissora — TDadosIesEmissora do XSD v1.05
 * Sequence: Nome, CodigoMEC, CNPJ, Endereco, Credenciamento,
 *           Recredenciamento?, RenovacaoDeRecredenciamento?, Mantenedora?
 */

import type { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import { DadosDiploma } from '../tipos';
import { limparNum } from './base.builder';
import { buildEndereco } from './endereco.builder';
import { buildAtoRegulatorio } from './ato-regulatorio.builder';

/**
 * Adiciona bloco <IesEmissora> ao parent
 */
export function buildIesEmissora(parent: XMLBuilder, dados: DadosDiploma): void {
  const ies = dados.ies;
  const iesEmissora = parent.ele('IesEmissora');

  iesEmissora.ele('Nome').txt(ies.nome || '');
  iesEmissora.ele('CodigoMEC').txt(ies.codigo_mec || '');
  iesEmissora.ele('CNPJ').txt(limparNum(ies.cnpj));

  buildEndereco(iesEmissora, ies.endereco);

  // Credenciamento (obrigatório)
  const cred = iesEmissora.ele('Credenciamento');
  buildAtoRegulatorio(cred, ies.credenciamento);

  // Recredenciamento (opcional)
  if (ies.recredenciamento) {
    const recred = iesEmissora.ele('Recredenciamento');
    buildAtoRegulatorio(recred, ies.recredenciamento);
  }

  // RenovacaoDeRecredenciamento (opcional)
  if (ies.renovacao_recredenciamento) {
    const renovacao = iesEmissora.ele('RenovacaoDeRecredenciamento');
    buildAtoRegulatorio(renovacao, ies.renovacao_recredenciamento);
  }

  // Mantenedora (opcional)
  if (ies.mantenedora) {
    const mant = iesEmissora.ele('Mantenedora');
    mant.ele('RazaoSocial').txt(ies.mantenedora.razao_social || '');
    mant.ele('CNPJ').txt(limparNum(ies.mantenedora.cnpj));
    buildEndereco(mant, ies.mantenedora.endereco);
  }
}
