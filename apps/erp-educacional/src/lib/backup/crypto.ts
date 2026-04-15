import crypto from 'crypto'

/**
 * Result type for encrypted backup
 */
export interface EncryptedBackupResult {
  encrypted: Buffer
  iv: string
  tag: string
  keyVersion: string
}

/**
 * Parameters for decryption
 */
export interface DecryptParams {
  encrypted: Buffer
  iv: string
  tag: string
  key: string
}

/**
 * Encrypt backup data using AES-256-GCM
 * @param data - Raw backup data
 * @param key - Encryption key (must be 32 bytes for AES-256)
 * @param keyVersion - Version identifier for key rotation
 * @returns Encrypted data with IV and auth tag
 */
export async function criptografarBackup(
  data: Buffer,
  key: string,
  keyVersion: string = 'v1'
): Promise<EncryptedBackupResult> {
  try {
    // Validate key length
    if (key.length < 32) {
      throw new Error('Encryption key must be at least 32 characters')
    }

    // Generate random IV (Initialization Vector)
    const iv = crypto.randomBytes(16)

    // Create cipher with AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key.slice(0, 32)), iv)

    // Encrypt data
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()])

    // Get authentication tag
    const tag = cipher.getAuthTag()

    return {
      encrypted,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      keyVersion,
    }
  } catch (error) {
    throw new Error(`Backup encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Decrypt backup data using AES-256-GCM
 * @param params - Decryption parameters
 * @returns Decrypted data
 */
export async function descriptografarBackup(params: DecryptParams): Promise<Buffer> {
  try {
    const { encrypted, iv, tag, key } = params

    // Validate key length
    if (key.length < 32) {
      throw new Error('Encryption key must be at least 32 characters')
    }

    // Convert base64 strings to buffers
    const ivBuffer = Buffer.from(iv, 'base64')
    const tagBuffer = Buffer.from(tag, 'base64')

    // Create decipher with AES-256-GCM
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key.slice(0, 32)), ivBuffer)

    // Set authentication tag for verification
    decipher.setAuthTag(tagBuffer)

    // Decrypt data
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])

    return decrypted
  } catch (error) {
    throw new Error(`Backup decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Calculate SHA256 hash of data for integrity verification
 * @param data - Data to hash
 * @returns Hex-encoded SHA256 hash
 */
export async function calcularHashBackup(data: Buffer): Promise<string> {
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Verify backup integrity using SHA256 hash
 * @param data - Backup data
 * @param expectedHash - Expected SHA256 hash in hex format
 * @returns True if hash matches, false otherwise
 */
export async function verificarIntegridadeBackup(data: Buffer, expectedHash: string): Promise<boolean> {
  try {
    const calculatedHash = await calcularHashBackup(data)
    return calculatedHash === expectedHash
  } catch (error) {
    console.error('Integrity check failed:', error)
    return false
  }
}

/**
 * Generate a random encryption key for backup
 * @returns Base64-encoded random key suitable for AES-256
 */
export function gerarChaveBackup(): string {
  return crypto.randomBytes(32).toString('base64')
}

/**
 * Validate encryption key format and length
 * @param key - Key to validate
 * @returns True if valid, false otherwise
 */
export function validarChaveBackup(key: string): boolean {
  if (!key || typeof key !== 'string') {
    return false
  }
  // Must be at least 32 characters or decodable as base64 with at least 32 bytes
  if (key.length >= 32) {
    return true
  }
  try {
    const decoded = Buffer.from(key, 'base64')
    return decoded.length >= 32
  } catch {
    return false
  }
}
