/**
 * Builder de Endereço — TEndereco do XSD v1.05
 * Sequence: Logradouro, Numero?, Complemento?, Bairro,
 *           GMunicipio(CodigoMunicipio + NomeMunicipio + UF), CEP
 *
 * Reutilizado em: IesEmissora, EnderecoCurso, Mantenedora
 */

import type { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import { EnderecoXSD } from '../tipos';
import { limparNum, eleOpc } from './base.builder';

/**
 * Adiciona bloco <Endereco> (ou tag customizada) ao parent
 * @param parent - Nó XML pai
 * @param end - Dados do endereço
 * @param tagName - Nome da tag (default: 'Endereco', pode ser 'EnderecoCurso')
 */
export function buildEndereco(
  parent: XMLBuilder,
  end: EnderecoXSD,
  tagName: string = 'Endereco'
): void {
  const endereco = parent.ele(tagName);
  endereco.ele('Logradouro').txt(end.logradouro || '');
  eleOpc(endereco, 'Numero', end.numero);
  eleOpc(endereco, 'Complemento', end.complemento);
  endereco.ele('Bairro').txt(end.bairro || '');
  endereco.ele('CodigoMunicipio').txt(limparNum(end.codigo_municipio));
  endereco.ele('NomeMunicipio').txt(end.nome_municipio || '');
  endereco.ele('UF').txt(end.uf || '');
  endereco.ele('CEP').txt(limparNum(end.cep));
}
