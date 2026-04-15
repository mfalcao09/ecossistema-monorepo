/**
 * Builder do Diplomado — TDadosDiplomado do XSD v1.05
 * Sequence: ID, GPessoa(Nome, NomeSocial?, Sexo), Nacionalidade,
 *           Naturalidade(GMunicipio | NomeMunicipioEstrangeiro),
 *           CPF, (RG | OutroDocumentoIdentificacao)?, DataNascimento
 *
 * Usado em: HistoricoEscolar (como <Aluno>), DocAcadêmica (como <Diplomado>)
 */

import type { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import { DadosDiploma } from '../tipos';
import { limparNum, fmtData, eleOpc } from './base.builder';

/**
 * Adiciona bloco <Diplomado> ou <Aluno> ao parent
 * @param parent - Nó XML pai
 * @param dados - DadosDiploma completo
 * @param tagName - 'Diplomado' (padrão) ou 'Aluno' (histórico)
 */
export function buildDiplomado(
  parent: XMLBuilder,
  dados: DadosDiploma,
  tagName: string = 'Diplomado'
): void {
  const d = dados.diplomado;
  const diplomado = parent.ele(tagName);

  // ID (RA do aluno)
  // Bug #5 — fix 2026-04-07 (Onda 1):
  // XSD v1.05 TId define minLength=1 — RA vazio ou null gera <ID></ID>
  // que viola o schema e quebra a assinatura. Travar emissão aqui é
  // a barreira final; o ideal é o frontend nem permitir, mas o motor
  // não pode confiar no caller.
  const ra = (d.ra ?? '').toString().trim();
  if (!ra) {
    throw new Error(
      `[motor-xml] Diplomado sem RA — campo obrigatório (XSD TId.minLength=1). ` +
      `CPF do diplomado: ${d.cpf || '<sem cpf>'}. Cadastre o RA antes de gerar o XML.`
    );
  }
  diplomado.ele('ID').txt(ra);

  // GPessoa: Nome, NomeSocial?, Sexo
  diplomado.ele('Nome').txt(d.nome || '');
  eleOpc(diplomado, 'NomeSocial', d.nome_social);
  diplomado.ele('Sexo').txt(d.sexo || 'M');

  // Nacionalidade
  diplomado.ele('Nacionalidade').txt(d.nacionalidade || '');

  // Naturalidade — GMunicipio (brasileiro) ou NomeMunicipioEstrangeiro
  const naturalidade = diplomado.ele('Naturalidade');
  if (d.naturalidade_municipio_estrangeiro) {
    naturalidade.ele('NomeMunicipioEstrangeiro').txt(d.naturalidade_municipio_estrangeiro);
  } else {
    naturalidade.ele('CodigoMunicipio').txt(limparNum(d.codigo_municipio_ibge));
    naturalidade.ele('NomeMunicipio').txt(d.naturalidade_municipio || '');
    naturalidade.ele('UF').txt(d.naturalidade_uf || '');
  }

  // CPF
  diplomado.ele('CPF').txt(limparNum(d.cpf));

  // RG (opcional — choice com OutroDocumentoIdentificacao)
  if (d.rg_numero) {
    const rg = diplomado.ele('RG');
    rg.ele('Numero').txt(d.rg_numero);
    eleOpc(rg, 'OrgaoExpedidor', d.rg_orgao_expedidor);
    rg.ele('UF').txt(d.rg_uf || '');
  }

  // DataNascimento
  diplomado.ele('DataNascimento').txt(fmtData(d.data_nascimento));
}
