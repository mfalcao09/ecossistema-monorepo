/**
 * ============================================================
 * CENTRALIZED SECURITY LOGGING SYSTEM
 * ERP Educacional FIC
 *
 * Sistema centralizado para captura de eventos de segurança.
 * Estruturado, não-bloqueante, com múltiplos sinks de armazenamento.
 * ============================================================
 */

import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

/**
 * Tipos de eventos de segurança
 */
export type SecurityEventType =
  | 'AUTH_SUCCESS'
  | 'AUTH_FAILURE'
  | 'AUTH_LOGOUT'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMIT_HIT'
  | 'CAPTCHA_FAILURE'
  | 'SUSPICIOUS_INPUT'
  | 'DATA_ACCESS'
  | 'DATA_MODIFICATION'
  | 'ADMIN_ACTION'
  | 'LGPD_REQUEST'

/**
 * Níveis de risco para um evento
 */
export type RiscoSeguranca = 'baixo' | 'medio' | 'alto' | 'critico'

/**
 * Interface para evento de segurança
 * @interface SecurityEvent
 */
export interface SecurityEvent {
  /** Tipo de evento de segurança */
  tipo: SecurityEventType

  /** Timestamp ISO 8601 (preenchido automaticamente se omitido) */
  timestamp?: string

  /** UUID do usuário afetado (opcional) */
  userId?: string

  /** Endereço IP do cliente */
  ip: string

  /** User-Agent do navegador/cliente (opcional) */
  userAgent?: string

  /** Rota/endpoint da requisição */
  rota: string

  /** Método HTTP (GET, POST, etc.) */
  metodo: string

  /** Status HTTP da resposta (opcional) */
  statusCode?: number

  /** Detalhes adicionais em formato livre */
  detalhes?: Record<string, unknown>

  /** Nível de risco do evento */
  risco: RiscoSeguranca
}

/**
 * Configuração de webhook para notificações críticas
 */
interface WebhookConfig {
  url: string
  secret?: string
  eventos?: SecurityEventType[] // Se vazio, notifica tudo
}

/**
 * Evento em queue para batch processing
 */
interface EventoEmQueue extends SecurityEvent {
  tentativas: number
}

/**
 * Instância global do gerenciador de logging
 */
let instanciaGlobal: SecurityLogger | null = null

/**
 * Gerenciador centralizado de logging de segurança
 * Implementa batch processing, múltiplos sinks e non-blocking behavior
 */
class SecurityLogger {
  private supabase: ReturnType<typeof createClient> | null = null
  private queue: EventoEmQueue[] = []
  private flushTimer: NodeJS.Timeout | null = null
  private webhookConfig: WebhookConfig | null = null

  private readonly BATCH_SIZE = 10
  private readonly FLUSH_INTERVAL_MS = 5000
  private readonly MAX_QUEUE_SIZE = 100
  private readonly MAX_RETRIES = 3

  constructor() {
    this.inicializarSupabase()
    this.configurarFlush()
  }

  /**
   * Inicializa cliente Supabase do servidor
   */
  private inicializarSupabase(): void {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
      console.warn('[SECURITY-LOGGER] Variáveis de ambiente Supabase não configuradas')
      return
    }

    this.supabase = createClient(url, key)
  }

  /**
   * Configura webhook para notificações críticas
   * @param config Configuração do webhook
   */
  public configurarWebhook(config: WebhookConfig): void {
    this.webhookConfig = config
    console.log('[SECURITY-LOGGER] Webhook configurado:', config.url)
  }

  /**
   * Configura timer para flush automático de eventos
   */
  private configurarFlush(): void {
    this.flushTimer = setInterval(() => {
      void this.flush()
    }, this.FLUSH_INTERVAL_MS)

    // Clear timer on process exit
    if (typeof process !== 'undefined') {
      process.on('exit', () => {
        if (this.flushTimer) {
          clearInterval(this.flushTimer)
        }
      })
    }
  }

  /**
   * Extrai IP da requisição (CF > X-Real-IP > X-Forwarded-For)
   */
  private extrairIP(request: NextRequest): string {
    const ip =
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown'

    return ip
  }

  /**
   * Extrai User-Agent da requisição
   */
  private extrairUserAgent(request: NextRequest): string | undefined {
    return request.headers.get('user-agent') || undefined
  }

  /**
   * Registra um evento de segurança
   * Non-blocking: adiciona à queue e retorna imediatamente
   *
   * @param evento Evento de segurança a registrar
   */
  public logSecurityEvent(evento: SecurityEvent): void {
    // Preencher timestamp se não fornecido
    const eventoComTimestamp: SecurityEvent = {
      ...evento,
      timestamp: evento.timestamp || new Date().toISOString(),
    }

    // Loggar no console em JSON estruturado (para Vercel logs)
    this.logConsole(eventoComTimestamp)

    // Adicionar à queue para processamento async
    if (this.queue.length < this.MAX_QUEUE_SIZE) {
      this.queue.push({
        ...eventoComTimestamp,
        tentativas: 0,
      })

      // Flush se atingiu batch size
      if (this.queue.length >= this.BATCH_SIZE) {
        void this.flush()
      }
    } else {
      console.error('[SECURITY-LOGGER] Queue de eventos cheia. Evento descartado.')
    }

    // Notificar webhook se crítico
    if (evento.risco === 'critico') {
      void this.notificarWebhook(eventoComTimestamp)
    }
  }

  /**
   * Flushes queued events to Supabase
   * Called periodically or when batch size reached
   */
  private async flush(): Promise<void> {
    if (this.queue.length === 0 || !this.supabase) {
      return
    }

    const eventosParaEnviar = [...this.queue]
    this.queue = []

    try {
      const registros = eventosParaEnviar.map((e) => ({
        tipo: e.tipo,
        timestamp: e.timestamp || new Date().toISOString(),
        usuario_id: e.userId || null,
        ip: e.ip,
        user_agent: e.userAgent || null,
        rota: e.rota,
        metodo: e.metodo,
        status_code: e.statusCode || null,
        detalhes: e.detalhes || null,
        risco: e.risco,
      }))

      const { error } = await this.supabase.from('security_events' as any).insert(registros as any)

      if (error) {
        console.error('[SECURITY-LOGGER] Erro ao enviar eventos para Supabase:', error.message)
        // Re-enqueue events with retry logic
        this.requeueComRetry(eventosParaEnviar)
      } else {
        console.log(`[SECURITY-LOGGER] ${registros.length} eventos registrados com sucesso`)
      }
    } catch (err) {
      console.error('[SECURITY-LOGGER] Erro inesperado ao flush:', err)
      this.requeueComRetry(eventosParaEnviar)
    }
  }

  /**
   * Re-enqueue events with retry logic
   */
  private requeueComRetry(eventos: EventoEmQueue[]): void {
    for (const evento of eventos) {
      if (evento.tentativas < this.MAX_RETRIES) {
        evento.tentativas++
        this.queue.unshift(evento) // Re-add to front of queue
      } else {
        console.error(`[SECURITY-LOGGER] Evento descartado após ${this.MAX_RETRIES} tentativas:`, evento.tipo)
      }
    }
  }

  /**
   * Log to console in structured JSON format (for Vercel logs)
   */
  private logConsole(evento: SecurityEvent): void {
    const logObject = {
      '[SECURITY]': true,
      tipo: evento.tipo,
      timestamp: evento.timestamp,
      userId: evento.userId || 'anônimo',
      ip: evento.ip,
      rota: evento.rota,
      metodo: evento.metodo,
      statusCode: evento.statusCode,
      risco: evento.risco,
      ...(evento.detalhes && { detalhes: evento.detalhes }),
    }

    // Use console.error for critical events
    if (evento.risco === 'critico') {
      console.error(JSON.stringify(logObject))
    } else if (evento.risco === 'alto') {
      console.warn(JSON.stringify(logObject))
    } else {
      console.log(JSON.stringify(logObject))
    }
  }

  /**
   * Notifica webhook para eventos críticos
   */
  private async notificarWebhook(evento: SecurityEvent): Promise<void> {
    if (!this.webhookConfig) return

    // Check if should notify this event type
    if (
      this.webhookConfig.eventos &&
      this.webhookConfig.eventos.length > 0 &&
      !this.webhookConfig.eventos.includes(evento.tipo)
    ) {
      return
    }

    try {
      const payload = {
        tipo: evento.tipo,
        timestamp: evento.timestamp,
        userId: evento.userId,
        ip: evento.ip,
        rota: evento.rota,
        risco: evento.risco,
        detalhes: evento.detalhes,
      }

      const response = await fetch(this.webhookConfig.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.webhookConfig.secret && { 'X-Webhook-Secret': this.webhookConfig.secret }),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        console.error(`[SECURITY-LOGGER] Webhook falhou com status ${response.status}`)
      }
    } catch (err) {
      console.error('[SECURITY-LOGGER] Erro ao notificar webhook:', err)
    }
  }

  /**
   * Força flush imediato (útil no shutdown)
   */
  public async flushImediato(): Promise<void> {
    await this.flush()
  }
}

/**
 * Obtém ou cria instância singleton
 */
function obterInstancia(): SecurityLogger {
  if (!instanciaGlobal) {
    instanciaGlobal = new SecurityLogger()
  }
  return instanciaGlobal
}

/**
 * Log de tentativa de autenticação
 * @param request Requisição HTTP
 * @param sucesso Se a autenticação foi bem-sucedida
 * @param userId ID do usuário (se disponível)
 * @param detalhesAdicionais Detalhes extras (e.g., motivo da falha)
 */
export function logAuthAttempt(
  request: NextRequest,
  sucesso: boolean,
  userId?: string,
  detalhesAdicionais?: Record<string, unknown>
): void {
  const logger = obterInstancia()
  const ip = logger['extrairIP'](request)

  logger.logSecurityEvent({
    tipo: sucesso ? 'AUTH_SUCCESS' : 'AUTH_FAILURE',
    userId,
    ip,
    userAgent: logger['extrairUserAgent'](request),
    rota: request.nextUrl.pathname,
    metodo: request.method,
    statusCode: sucesso ? 200 : 401,
    risco: sucesso ? 'baixo' : 'medio',
    detalhes: {
      ...detalhesAdicionais,
    },
  })
}

/**
 * Log de logout
 * @param request Requisição HTTP
 * @param userId ID do usuário que fez logout
 */
export function logLogout(request: NextRequest, userId: string): void {
  const logger = obterInstancia()
  const ip = logger['extrairIP'](request)

  logger.logSecurityEvent({
    tipo: 'AUTH_LOGOUT',
    userId,
    ip,
    userAgent: logger['extrairUserAgent'](request),
    rota: request.nextUrl.pathname,
    metodo: request.method,
    statusCode: 200,
    risco: 'baixo',
  })
}

/**
 * Log de tentativa de acesso negado (RBAC)
 * @param request Requisição HTTP
 * @param userId ID do usuário
 * @param recursoSolicitado Recurso que tentou acessar
 * @param roleRequerida Role necessária
 */
export function logPermissionDenied(
  request: NextRequest,
  userId: string,
  recursoSolicitado: string,
  roleRequerida: string
): void {
  const logger = obterInstancia()
  const ip = logger['extrairIP'](request)

  logger.logSecurityEvent({
    tipo: 'PERMISSION_DENIED',
    userId,
    ip,
    userAgent: logger['extrairUserAgent'](request),
    rota: request.nextUrl.pathname,
    metodo: request.method,
    statusCode: 403,
    risco: 'medio',
    detalhes: {
      recursoSolicitado,
      roleRequerida,
    },
  })
}

/**
 * Log de rate limit hit
 * @param request Requisição HTTP
 * @param endpoint Endpoint que foi limitado
 * @param userId ID do usuário (opcional)
 */
export function logRateLimitHit(
  request: NextRequest,
  endpoint: string,
  userId?: string
): void {
  const logger = obterInstancia()
  const ip = logger['extrairIP'](request)

  logger.logSecurityEvent({
    tipo: 'RATE_LIMIT_HIT',
    userId,
    ip,
    userAgent: logger['extrairUserAgent'](request),
    rota: request.nextUrl.pathname,
    metodo: request.method,
    statusCode: 429,
    risco: 'medio',
    detalhes: {
      endpoint,
    },
  })
}

/**
 * Log de falha de CAPTCHA/Turnstile
 * @param request Requisição HTTP
 * @param userId ID do usuário (opcional)
 * @param motivo Motivo da falha
 */
export function logCaptchaFailure(
  request: NextRequest,
  motivo: string,
  userId?: string
): void {
  const logger = obterInstancia()
  const ip = logger['extrairIP'](request)

  logger.logSecurityEvent({
    tipo: 'CAPTCHA_FAILURE',
    userId,
    ip,
    userAgent: logger['extrairUserAgent'](request),
    rota: request.nextUrl.pathname,
    metodo: request.method,
    statusCode: 400,
    risco: 'medio',
    detalhes: {
      motivo,
    },
  })
}

/**
 * Log de entrada suspeita detectada
 * @param request Requisição HTTP
 * @param userId ID do usuário (opcional)
 * @param tipoAtaque Tipo de ataque detectado (SQL injection, XSS, etc.)
 * @param dadosSuspeitos Dados que geraram a suspeita
 */
export function logSuspiciousInput(
  request: NextRequest,
  tipoAtaque: string,
  dadosSuspeitos: Record<string, unknown>,
  userId?: string
): void {
  const logger = obterInstancia()
  const ip = logger['extrairIP'](request)

  logger.logSecurityEvent({
    tipo: 'SUSPICIOUS_INPUT',
    userId,
    ip,
    userAgent: logger['extrairUserAgent'](request),
    rota: request.nextUrl.pathname,
    metodo: request.method,
    statusCode: 400,
    risco: 'alto',
    detalhes: {
      tipoAtaque,
      campos: Object.keys(dadosSuspeitos),
    },
  })
}

/**
 * Log de acesso a dados sensíveis
 * @param request Requisição HTTP
 * @param userId ID do usuário
 * @param tabela Tabela/recurso acessado
 * @param acao Tipo de ação (leitura, exportação, etc.)
 * @param registrosAfetados Quantidade ou IDs de registros
 */
export function logDataAccess(
  request: NextRequest,
  userId: string,
  tabela: string,
  acao: string,
  registrosAfetados?: string[] | number
): void {
  const logger = obterInstancia()
  const ip = logger['extrairIP'](request)

  logger.logSecurityEvent({
    tipo: 'DATA_ACCESS',
    userId,
    ip,
    userAgent: logger['extrairUserAgent'](request),
    rota: request.nextUrl.pathname,
    metodo: request.method,
    statusCode: 200,
    risco: 'baixo',
    detalhes: {
      tabela,
      acao,
      registrosAfetados,
    },
  })
}

/**
 * Log de modificação de dados críticos
 * @param request Requisição HTTP
 * @param userId ID do usuário
 * @param tabela Tabela modificada
 * @param operacao Tipo de operação (insert, update, delete)
 * @param registrosAfetados Quantidade de registros
 * @param dadosModificados Detalhes das mudanças (opcional)
 */
export function logDataModification(
  request: NextRequest,
  userId: string,
  tabela: string,
  operacao: 'insert' | 'update' | 'delete',
  registrosAfetados: number,
  dadosModificados?: Record<string, unknown>
): void {
  const logger = obterInstancia()
  const ip = logger['extrairIP'](request)

  logger.logSecurityEvent({
    tipo: 'DATA_MODIFICATION',
    userId,
    ip,
    userAgent: logger['extrairUserAgent'](request),
    rota: request.nextUrl.pathname,
    metodo: request.method,
    statusCode: 200,
    risco: 'alto',
    detalhes: {
      tabela,
      operacao,
      registrosAfetados,
      ...(dadosModificados && { modificacoes: dadosModificados }),
    },
  })
}

/**
 * Log de ação administrativa
 * @param request Requisição HTTP
 * @param userId ID do admin
 * @param acao Descrição da ação
 * @param detalhes Detalhes adicionais
 */
export function logAdminAction(
  request: NextRequest,
  userId: string,
  acao: string,
  detalhes?: Record<string, unknown>
): void {
  const logger = obterInstancia()
  const ip = logger['extrairIP'](request)

  logger.logSecurityEvent({
    tipo: 'ADMIN_ACTION',
    userId,
    ip,
    userAgent: logger['extrairUserAgent'](request),
    rota: request.nextUrl.pathname,
    metodo: request.method,
    statusCode: 200,
    risco: 'alto',
    detalhes: {
      acao,
      ...detalhes,
    },
  })
}

/**
 * Log de requisição LGPD (direito do titular)
 * @param request Requisição HTTP
 * @param tipoRequisicao Tipo de requisição (acesso, exclusão, portabilidade, etc.)
 * @param usuarioAlvo ID do usuário alvo da requisição
 * @param status Status da requisição (pendente, processando, concluída, etc.)
 */
export function logLGPDRequest(
  request: NextRequest,
  tipoRequisicao: string,
  usuarioAlvo: string,
  status: string
): void {
  const logger = obterInstancia()
  const ip = logger['extrairIP'](request)

  logger.logSecurityEvent({
    tipo: 'LGPD_REQUEST',
    userId: usuarioAlvo,
    ip,
    userAgent: logger['extrairUserAgent'](request),
    rota: request.nextUrl.pathname,
    metodo: request.method,
    statusCode: 200,
    risco: 'medio',
    detalhes: {
      tipoRequisicao,
      status,
    },
  })
}

/**
 * Configura webhook para notificações de eventos críticos
 * @param url URL do webhook (Slack, Discord, etc.)
 * @param secret Secret opcional para assinatura
 * @param eventos Tipos de eventos a notificar (opcional - todos se não fornecido)
 */
export function configurarWebhookSeguranca(
  url: string,
  secret?: string,
  eventos?: SecurityEventType[]
): void {
  const logger = obterInstancia()
  logger.configurarWebhook({
    url,
    secret,
    eventos,
  })
}

/**
 * Força flush imediato de eventos (útil no graceful shutdown)
 */
export async function flushSecurityEvents(): Promise<void> {
  const logger = obterInstancia()
  await logger.flushImediato()
}

/**
 * Log genérico de evento de segurança
 * Útil para tipos de eventos customizados
 */
export function logSecurityEvent(evento: SecurityEvent): void {
  const logger = obterInstancia()
  logger.logSecurityEvent(evento)
}
