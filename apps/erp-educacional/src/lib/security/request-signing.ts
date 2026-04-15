// ============================================================
// REQUEST SIGNING — Assinatura de operações críticas
// ERP Educacional FIC — Segurança Nível C
//
// Adiciona uma camada extra de verificação para operações
// sensíveis como:
// - Assinar diploma digitalmente
// - Publicar diploma (torna público)
// - Alterar configurações de assinatura
// - Deletar registros
// - Exportar dados em massa
//
// Funciona via HMAC-SHA256: o frontend gera uma assinatura
// baseada nos dados da operação + timestamp, e o backend
// verifica antes de executar.
//
// Isso previne:
// - Replay attacks (timestamp com janela de 5 minutos)
// - Tampering (dados assinados não podem ser modificados)
// - CSRF avançado (mesmo com token roubado, sem a chave HMAC
//   o atacante não consegue gerar assinaturas válidas)
// ============================================================

// ── Tipos ────────────────────────────────────────────────────

export interface OperacaoAssinada {
  /** Tipo da operação (para logging) */
  tipo: string
  /** ID do recurso sendo operado */
  recurso_id: string
  /** Dados da operação (serializados como JSON) */
  payload: string
  /** Timestamp Unix em milissegundos */
  timestamp: number
  /** HMAC-SHA256 da concatenação tipo|recurso_id|payload|timestamp */
  assinatura: string
}

export interface ResultadoVerificacao {
  valido: boolean
  erro?: string
}

// ── Configuração ─────────────────────────────────────────────

// Janela de tempo para aceitar assinaturas (5 minutos)
const JANELA_TEMPO_MS = 5 * 60 * 1000

// Operações que REQUEREM assinatura
const OPERACOES_CRITICAS = new Set([
  'assinar_diploma',
  'publicar_diploma',
  'revogar_diploma',
  'alterar_config_assinatura',
  'deletar_registro',
  'exportar_dados',
  'alterar_permissoes',
  'gerar_xml',
])

// ── Chave secreta ────────────────────────────────────────────

function obterChaveSecreta(): string {
  const chave = process.env.REQUEST_SIGNING_SECRET

  if (!chave) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[SECURITY] REQUEST_SIGNING_SECRET não configurada — usando chave de desenvolvimento')
      return 'dev-request-signing-secret-DO-NOT-USE-IN-PRODUCTION-minimum-32-chars'
    }
    console.error('[SECURITY] REQUEST_SIGNING_SECRET não configurada em produção!')
    throw new Error('REQUEST_SIGNING_SECRET é obrigatória em produção')
  }

  if (chave.length < 32) {
    console.error('[SECURITY] REQUEST_SIGNING_SECRET deve ter pelo menos 32 caracteres')
    throw new Error('REQUEST_SIGNING_SECRET muito curta')
  }

  return chave
}

// ── Funções públicas ─────────────────────────────────────────

/**
 * Gera a assinatura HMAC para uma operação.
 * Usado no FRONTEND para assinar antes de enviar.
 *
 * @param tipo - Tipo da operação
 * @param recursoId - ID do recurso
 * @param payload - Dados serializados
 * @param chave - Chave secreta (passada pelo frontend via env)
 * @returns Objeto com assinatura e timestamp
 */
export async function assinarOperacao(
  tipo: string,
  recursoId: string,
  payload: string,
): Promise<OperacaoAssinada> {
  const chave = obterChaveSecreta()
  const timestamp = Date.now()

  const mensagem = `${tipo}|${recursoId}|${payload}|${timestamp}`
  const assinatura = await calcularHMAC(mensagem, chave)

  return {
    tipo,
    recurso_id: recursoId,
    payload,
    timestamp,
    assinatura,
  }
}

/**
 * Verifica a assinatura de uma operação no BACKEND.
 *
 * @param operacao - Dados da operação assinada (vindos do request)
 * @returns Resultado da verificação
 *
 * @example
 * ```ts
 * const resultado = await verificarAssinaturaOperacao(body.operacao)
 * if (!resultado.valido) {
 *   return NextResponse.json({ erro: resultado.erro }, { status: 403 })
 * }
 * ```
 */
export async function verificarAssinaturaOperacao(
  operacao: OperacaoAssinada
): Promise<ResultadoVerificacao> {
  try {
    const chave = obterChaveSecreta()

    // 1. Verificar se é operação crítica
    if (!OPERACOES_CRITICAS.has(operacao.tipo)) {
      // Operações não-críticas não precisam de assinatura
      return { valido: true }
    }

    // 2. Verificar timestamp (anti-replay)
    const agora = Date.now()
    const diferenca = Math.abs(agora - operacao.timestamp)

    if (diferenca > JANELA_TEMPO_MS) {
      return {
        valido: false,
        erro: `Assinatura expirada. Diferença de tempo: ${Math.round(diferenca / 1000)}s (máximo: ${JANELA_TEMPO_MS / 1000}s).`,
      }
    }

    // 3. Recalcular HMAC
    const mensagem = `${operacao.tipo}|${operacao.recurso_id}|${operacao.payload}|${operacao.timestamp}`
    const assinaturaEsperada = await calcularHMAC(mensagem, chave)

    // 4. Comparar (timing-safe)
    if (!timingSafeCompare(operacao.assinatura, assinaturaEsperada)) {
      return {
        valido: false,
        erro: 'Assinatura inválida. A operação pode ter sido adulterada.',
      }
    }

    return { valido: true }
  } catch (err) {
    return {
      valido: false,
      erro: err instanceof Error ? err.message : 'Erro ao verificar assinatura',
    }
  }
}

/**
 * Verifica se um tipo de operação requer assinatura.
 */
export function requerAssinatura(tipo: string): boolean {
  return OPERACOES_CRITICAS.has(tipo)
}

// ── HMAC-SHA256 usando Web Crypto API ────────────────────────

async function calcularHMAC(mensagem: string, chave: string): Promise<string> {
  const encoder = new TextEncoder()

  // Importar chave
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(chave),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  // Calcular HMAC
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(mensagem)
  )

  // Converter para hex
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ── Comparação timing-safe ───────────────────────────────────

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}
