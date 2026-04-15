// ============================================================
// SECURITY — Módulo central de segurança
// ERP Educacional FIC
//
// Re-exporta todos os utilitários de segurança
// ============================================================

// ── Validação customizada ────────────────────────────────────
export {
  validarCpf,
  validarCnpj,
  validarData,
  sanitizarString,
  sanitizarEmail,
  validarForcaSenha,
} from './validation'

// ── CSRF Protection ─────────────────────────────────────────
export { validarCSRF, definirCookieCSRF, CSRF_HEADER_NAME, CSRF_COOKIE_NAME } from './csrf'

// ── Sanitização de erros ────────────────────────────────────
export { sanitizarErro } from './sanitize-error'

// ── Cliente HTTP com CSRF automático (uso no frontend) ──────
export { fetchSeguro } from './fetch-seguro'

// ── API Guard — proteção centralizada de rotas ──────────────
export { protegerRota, verificarAuth } from './api-guard'
export type { AuthContext } from './api-guard'

// ── ICP-Brasil — verificação de assinatura digital ──────────
export { verificarAssinaturaXML, extrairCertificados } from './icp-brasil'
export type { ResultadoVerificacaoAssinatura, CertificadoInfo } from './icp-brasil'

// ── LGPD — política de retenção de dados ────────────────────
export { purgarDadosSensiveis, anonimizarRegistro } from './lgpd'

// ── Request Signing — assinatura de operações críticas ──────
export { assinarOperacao, verificarAssinaturaOperacao } from './request-signing'

// ── PII Encryption — criptografia de dados pessoais ─────────
export {
  criptografarPII,
  descriptografarPII,
  hashCPF,
  criptografarDadosDiplomado,
  buscarDiplomadoPorCPFSeguro,
} from './pii-encryption'

// ── Rate Limiting — ERP API (autenticado) ───────────────────
export {
  verificarRateLimitERP,
  adicionarHeadersRateLimit,
  adicionarHeadersRetryAfter,
  RATE_LIMITS_ERP,
} from './rate-limit'
export type { TipoEndpointERP } from './rate-limit'

// ── Rate Limit Middleware — decorators para rotas ────────────
export { comRateLimit, comRateLimitDirecto } from './rate-limit-middleware'

// ── Audit Trail — rastreamento de ações (compliance MEC) ────
export { registrarAuditoria, registrarAuditoriaAPI } from './audit-trail'
export type { AcaoAuditoria, EntidadeAuditavel } from './audit-trail'

// ── Zod Schemas — validação de input ────────────────────────
export {
  cpfSchema,
  cnpjSchema,
  emailSchema,
  uuidSchema,
  dataSchema,
  codigoDiplomaSchema,
  diplomadoSchema,
  cursoSchema,
  diplomaSchema,
  usuarioSchema,
  alterarSenhaSchema,
  consultaCpfSchema,
  validarCodigoSchema,
  gerarDiplomaSchema,
  processarAssinaturaSchema,
  importarDiplomadasSchema,
} from './zod-schemas'

// ── Helpers de validação Zod ────────────────────────────────
export { validarBody, validarQuery, validarParams } from './validate-request'

// ── Security Logger — Logging centralizado de eventos ────────
export {
  logSecurityEvent,
  logAuthAttempt,
  logLogout,
  logPermissionDenied,
  logRateLimitHit,
  logCaptchaFailure,
  logSuspiciousInput,
  logDataAccess,
  logDataModification,
  logAdminAction,
  logLGPDRequest,
  configurarWebhookSeguranca,
  flushSecurityEvents,
} from './security-logger'
export type { SecurityEvent, SecurityEventType, RiscoSeguranca } from './security-logger'

// ── Security Logger Middleware — Proteção automática ────────
export {
  protegerSeguranca,
  validarEntradaSegura,
  logarRateLimitDetectado,
  criarHandlerSeguro,
} from './security-logger-middleware'
