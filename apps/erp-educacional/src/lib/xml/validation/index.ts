/**
 * Barrel exports da validação XML
 */

export {
  validarHistoricoEscolar,
  validarDocAcademicaRegistro,
  validarDiplomaDigital,
} from './xsd-validator';
export type { ResultadoValidacao } from './xsd-validator';

export { validarRegrasNegocio } from './business-rules';
export type { ResultadoRegrasNegocio } from './business-rules';
