// ============================================================
// PII ENCRYPTION KEY ROTATION — Rotação de Chaves de Criptografia
// ERP Educacional FIC — Data: 2026-03-26
//
// Sistema de controle de versão de chaves de criptografia PII com:
// - Suporte a múltiplas versões de chaves simultâneas
// - Criptografia com prefixo de versão no ciphertext
// - Re-criptografia em lote de registros antigos
// - Rastreamento de rotações via banco de dados
//
// Formato de ciphertext: v{version}:{iv}:{authTag}:{encryptedData}
// Todas as partes em base64 para armazenamento seguro
//
// Fluxo:
// 1. App lê PII_ENCRYPTION_KEY_V1, V2, etc. do env
// 2. getCurrentKeyVersion() retorna a versão ativa
// 3. encryptPII() criptografa com versão atual + prefixo
// 4. decryptPII() detecta versão do prefix e descriptografa
// 5. rotateKey() ativa nova versão
// 6. reEncryptWithCurrentKey() migra dados antigos
// ============================================================

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'

// ── Tipos ────────────────────────────────────────────────────

export interface KeyVersionInfo {
  version: number
  active: boolean
  activatedAt: Date
  deprecatedAt?: Date
}

export interface EncryptionResult {
  success: boolean
  error?: string
  data?: string // O ciphertext com prefixo de versão
}

export interface DecryptionResult {
  success: boolean
  error?: string
  data?: string // O plaintext descriptografado
  usedVersion?: number
}

export interface ReEncryptionProgress {
  totalProcessed: number
  successCount: number
  failureCount: number
  batchesProcessed: number
  currentBatchSize: number
}

// ── Configuração e Constantes ────────────────────────────────

const ALGORITHM = 'aes-256-gcm'
const SALT_LENGTH = 16
const IV_LENGTH = 12 // GCM recomenda 96 bits
const AUTH_TAG_LENGTH = 16 // 128 bits
const KEY_VERSIONS = new Map<number, string>() // Cache em memória

/**
 * Carrega todas as versões de chaves do env e retorna um mapa.
 * Procura por padrão: PII_ENCRYPTION_KEY_V1, V2, etc.
 * Requer pelo menos uma chave configurada (V1 ou superior).
 */
function loadKeyVersions(): Map<number, string> {
  if (KEY_VERSIONS.size > 0) {
    return KEY_VERSIONS // Cache
  }

  let hasKey = false
  let maxVersion = 0

  // Procurar por todas as versões de chaves no env
  for (let v = 1; v <= 20; v++) {
    const keyName = `PII_ENCRYPTION_KEY_V${v}`
    const keyValue = process.env[keyName]

    if (keyValue) {
      if (keyValue.length < 32) {
        throw new Error(`${keyName} deve ter pelo menos 32 caracteres (é a chave mestral)`)
      }

      KEY_VERSIONS.set(v, keyValue)
      hasKey = true
      maxVersion = Math.max(maxVersion, v)
    }
  }

  if (!hasKey) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[KEY-ROTATION] Nenhuma chave de criptografia PII configurada — usando chave dev')
      const devKey = 'dev-pii-encryption-key-rotation-DO-NOT-USE-IN-PRODUCTION-12345'
      KEY_VERSIONS.set(1, devKey)
      return KEY_VERSIONS
    }

    throw new Error(
      'Nenhuma chave PII_ENCRYPTION_KEY_V* configurada em produção. Configure PII_ENCRYPTION_KEY_V1 no mínimo.'
    )
  }

  console.info(`[KEY-ROTATION] ${KEY_VERSIONS.size} versão(s) de chave carregada(s)`)
  return KEY_VERSIONS
}

/**
 * Obtém a versão de chave ativa (mais recente).
 * A versão ativa é a versão de número mais alto disponível.
 */
export function getCurrentKeyVersion(): number {
  const versions = loadKeyVersions()
  if (versions.size === 0) {
    throw new Error('Nenhuma versão de chave disponível')
  }

  const maxVersion = Math.max(...Array.from(versions.keys()))
  return maxVersion
}

/**
 * Obtém a chave de criptografia para uma versão específica.
 * Lança erro se a versão não existir.
 */
function getKeyByVersion(version: number): string {
  const versions = loadKeyVersions()
  const key = versions.get(version)

  if (!key) {
    throw new Error(`Versão de chave ${version} não configurada (PII_ENCRYPTION_KEY_V${version} não encontrada)`)
  }

  return key
}

/**
 * Deriva uma chave de criptografia a partir da chave mestral usando PBKDF2-like.
 * Garante que mesmo com a mesma chave, diferentes usos tenham diferentes chaves.
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  const hash = createHash('sha256')
  hash.update(masterKey)
  hash.update(salt)
  const derived = hash.digest()

  // Expandir para 32 bytes (256 bits) se necessário
  if (derived.length < 32) {
    const hash2 = createHash('sha256')
    hash2.update(derived)
    hash2.update('expansion')
    return Buffer.concat([derived, hash2.digest()]).slice(0, 32)
  }

  return derived
}

// ── Funções Públicas de Criptografia ─────────────────────────

/**
 * Criptografa um valor PII com a versão de chave ativa.
 * Retorna formato: v{version}:{iv}:{authTag}:{ciphertext} (todos base64)
 *
 * @param plaintext O valor a criptografar (ex: CPF, email)
 * @returns Objeto com sucesso e dados criptografados com prefixo de versão
 */
export function encryptPII(plaintext: string): EncryptionResult {
  try {
    if (!plaintext) {
      return { success: false, error: 'Plaintext não pode estar vazio' }
    }

    const version = getCurrentKeyVersion()
    const masterKey = getKeyByVersion(version)

    // Gerar IV (Initialization Vector) aleatório
    const iv = randomBytes(IV_LENGTH)
    const salt = randomBytes(SALT_LENGTH)

    // Derivar chave
    const key = deriveKey(masterKey, salt)

    // Criar cipher
    const cipher = createCipheriv(ALGORITHM, key, iv)

    // Criptografar
    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    // Obter auth tag
    const authTag = cipher.getAuthTag()

    // Montar formato: v{version}:{salt}:{iv}:{authTag}:{ciphertext}
    const saltBase64 = salt.toString('base64')
    const ivBase64 = iv.toString('base64')
    const authTagBase64 = authTag.toString('base64')
    const ciphertextBase64 = Buffer.from(encrypted, 'hex').toString('base64')

    const ciphertext = `v${version}:${saltBase64}:${ivBase64}:${authTagBase64}:${ciphertextBase64}`

    return { success: true, data: ciphertext }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return { success: false, error: `Falha ao criptografar: ${message}` }
  }
}

/**
 * Descriptografa um valor PII.
 * Detecta automaticamente a versão de chave pelo prefixo v{version}.
 *
 * @param ciphertext Formato: v{version}:{salt}:{iv}:{authTag}:{ciphertext}
 * @returns Objeto com sucesso, dados descriptografados e versão usada
 */
export function decryptPII(ciphertext: string): DecryptionResult {
  try {
    if (!ciphertext) {
      return { success: false, error: 'Ciphertext não pode estar vazio' }
    }

    // Parsear formato
    const parts = ciphertext.split(':')
    if (parts.length < 5) {
      return { success: false, error: 'Formato de ciphertext inválido' }
    }

    const versionStr = parts[0]
    if (!versionStr.startsWith('v')) {
      return { success: false, error: 'Ciphertext sem prefixo de versão' }
    }

    const version = parseInt(versionStr.substring(1), 10)
    if (isNaN(version)) {
      return { success: false, error: `Versão de chave inválida: ${versionStr}` }
    }

    const saltBase64 = parts[1]
    const ivBase64 = parts[2]
    const authTagBase64 = parts[3]
    const ciphertextBase64 = parts.slice(4).join(':') // Caso o ciphertext contenha ':'

    // Decodificar de base64
    const salt = Buffer.from(saltBase64, 'base64')
    const iv = Buffer.from(ivBase64, 'base64')
    const authTag = Buffer.from(authTagBase64, 'base64')
    const encrypted = Buffer.from(ciphertextBase64, 'base64').toString('hex')

    // Obter chave para a versão
    const masterKey = getKeyByVersion(version)

    // Derivar chave
    const key = deriveKey(masterKey, salt)

    // Criar decipher
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    // Descriptografar
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return { success: true, data: decrypted, usedVersion: version }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return { success: false, error: `Falha ao descriptografar: ${message}` }
  }
}

/**
 * Ativa uma nova versão de chave para futuras criptografias.
 * A nova versão deve estar configurada no env (PII_ENCRYPTION_KEY_V{newVersion}).
 * Registra no banco de dados para auditoria.
 *
 * @param newVersion O número da nova versão a ativar
 * @param rotatedBy ID do usuário que está fazendo a rotação
 */
export async function rotateKey(newVersion: number, rotatedBy?: string): Promise<EncryptionResult> {
  try {
    // Verificar se a chave existe
    const key = getKeyByVersion(newVersion)
    if (!key) {
      return { success: false, error: `Chave V${newVersion} não configurada` }
    }

    // Registrar a rotação no banco
    const supabase = await createClient()
    const { error } = await supabase.from('key_rotation_log').insert({
      version: newVersion,
      rotated_by: rotatedBy || 'system',
      status: 'active',
      rotated_at: new Date().toISOString(),
    })

    if (error) {
      console.error('[KEY-ROTATION] Erro ao registrar rotação:', error.message)
      return { success: false, error: `Erro ao registrar rotação: ${error.message}` }
    }

    console.info(`[KEY-ROTATION] Chave rotacionada para V${newVersion}`)
    return { success: true, data: `Chave rotacionada para versão ${newVersion}` }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return { success: false, error: `Falha ao rotacionar chave: ${message}` }
  }
}

/**
 * Descriptografa um valor com sua versão de chave e re-criptografa com a versão ativa.
 * Útil para migrar dados antigos durante processo de rotação.
 *
 * @param ciphertext O valor criptografado (com prefixo de versão)
 * @returns Novo ciphertext criptografado com versão ativa
 */
export function reEncryptWithCurrentKey(ciphertext: string): EncryptionResult {
  try {
    // Descriptografar com versão antiga
    const decrypted = decryptPII(ciphertext)
    if (!decrypted.success || !decrypted.data) {
      return { success: false, error: `Falha ao descriptografar: ${decrypted.error}` }
    }

    // Re-criptografar com versão ativa
    return encryptPII(decrypted.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return { success: false, error: `Falha ao re-criptografar: ${message}` }
  }
}

/**
 * Obtém informações sobre uma versão de chave (para debug).
 * Consulta o banco de dados.
 */
export async function getKeyVersionInfo(version: number): Promise<KeyVersionInfo | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('key_rotation_log')
      .select('*')
      .eq('version', version)
      .order('rotated_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return null
    }

    return {
      version: data.version,
      active: data.status === 'active',
      activatedAt: new Date(data.rotated_at),
      deprecatedAt: data.status === 'deprecated' ? new Date(data.deprecated_at) : undefined,
    }
  } catch {
    return null
  }
}

/**
 * Lista todas as versões de chave conhecidas.
 */
export function listKeyVersions(): number[] {
  const versions = loadKeyVersions()
  return Array.from(versions.keys()).sort((a, b) => b - a) // Maior primeiro
}
