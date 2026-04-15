/**
 * Cache de extração de documentos — evita reprocessar documentos idênticos
 * Usa hash SHA-256 do conteúdo base64 como chave
 */

// Cache em memória no servidor (persiste enquanto o processo Next.js estiver ativo)
const extractionCache = new Map<string, { resultado: any; timestamp: number }>()
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutos

/**
 * Gera hash SHA-256 de uma string (funciona em Node.js)
 */
export async function gerarHashDocumento(conteudo: string): Promise<string> {
  const { createHash } = await import('crypto')
  return createHash('sha256').update(conteudo).digest('hex').substring(0, 16)
}

/**
 * Busca resultado cacheado de uma extração
 */
export function buscarCache(hash: string): any | null {
  const entry = extractionCache.get(hash)
  if (!entry) return null

  // Verifica se expirou
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    extractionCache.delete(hash)
    return null
  }

  return entry.resultado
}

/**
 * Salva resultado de extração no cache
 */
export function salvarCache(hash: string, resultado: any): void {
  // Limita tamanho do cache (máximo 100 documentos)
  if (extractionCache.size >= 100) {
    // Remove o mais antigo
    const oldestKey = extractionCache.keys().next().value
    if (oldestKey) extractionCache.delete(oldestKey)
  }

  extractionCache.set(hash, { resultado, timestamp: Date.now() })
}

/**
 * Limpa todo o cache
 */
export function limparCache(): void {
  extractionCache.clear()
}

/**
 * Retorna estatísticas do cache
 */
export function estatisticasCache() {
  return {
    tamanho: extractionCache.size,
    limite: 100,
    ttlMinutos: CACHE_TTL_MS / 60000,
  }
}
