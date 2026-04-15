/**
 * Barrel exports dos builders XML
 */

// Base
export {
  XSD_NAMESPACE,
  XSI_NAMESPACE,
  XSD_VERSAO,
  limparNum,
  fmtData,
  gerarIdXML,
  eleOpc,
  criarDocumentoXML,
  serializarXML,
} from './base.builder';
export type { XMLBuilder } from './base.builder';

// Builders reutilizáveis
export { buildEndereco } from './endereco.builder';
export { buildAtoRegulatorio } from './ato-regulatorio.builder';

// Builders de seção
export { buildDiplomado } from './diplomado.builder';
export { buildDadosCursoCompleto, buildDadosCursoMinimo } from './curso.builder';
export { buildIesEmissora } from './ies-emissora.builder';
export { buildAssinantesIes } from './assinantes.builder';
export { buildHistoricoEscolar } from './historico.builder';
export { buildFiliacao } from './dados-privados.builder';
