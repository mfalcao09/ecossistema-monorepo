/**
 * Barrel export para o módulo XML — v2 (xmlbuilder2 + fast-xml-parser)
 * Motor de geração de XMLs do Diploma Digital FIC
 */

// Tipos
export type {
  DadosDiploma,
  Disciplina,
  AtividadeComplementar,
  Estagio,
  Assinante,
  EnderecoXSD,
  AtoRegulatorio,
  Habilitacao,
  Genitor,
  EnadeInfo,
  CargaHorariaComEtiqueta,
  CargaHorariaRelogioComEtiqueta,
  DocenteInfo,
  TFormaAcesso,
} from './tipos';

// Gerador (facade — backward compatible)
export { gerarXMLs, gerarHistoricoEscolar, gerarDocAcademica } from './gerador';
export type { XMLsGerados } from './gerador';

// Generators (acesso direto — v2)
export { gerarHistoricoEscolarXML } from './generators/historico-escolar.generator';
export { gerarDocAcademicaXML } from './generators/doc-academica.generator';
export type { DocumentosComprobatoriosNonEmpty } from './generators/doc-academica.generator';

// Montador
export { montarDadosDiploma, gerarCodigoValidacao, gerarCodigoValidacaoHistorico } from './montador';

// Validação estrutural (v2 — fast-xml-parser)
export {
  validarDiplomaDigital,
  validarHistoricoEscolar,
  validarDocAcademicaRegistro,
} from './validador';
export type { ResultadoValidacao } from './validador';

// Regras de negócio MEC (v2)
export { validarRegrasNegocio } from './validation/business-rules';
export type { ResultadoRegrasNegocio } from './validation/business-rules';
