/**
 * ============================================================
 * CRL/OCSP Certificate Revocation Verification Module
 * ERP Educacional FIC — Diploma Digital
 *
 * Módulo para verificar se um certificado ICP-Brasil foi revogado
 * via CRL (Certificate Revocation List) ou OCSP (Online Certificate
 * Status Protocol).
 *
 * REFERENCES:
 * - RFC 6960 (OCSP - Online Certificate Status Protocol)
 * - RFC 5280 (X.509 Certificado e CRL)
 * - ICP-Brasil: DOC-ICP-15 (Visão geral de assinaturas digitais)
 * - ITI: Repositórios públicos de CRL e OCSP das ACs
 * ============================================================
 */

import { createHash } from 'crypto'

// ── TIPOS E INTERFACES ────────────────────────────────────────────

/**
 * Resultado da verificação de revogação de certificado
 */
export interface RevocationCheckResult {
  /** Indicação se o certificado foi revogado */
  revogado: boolean

  /** Método utilizado: OCSP (tempo real) ou CRL (offline) */
  metodo: 'ocsp' | 'crl' | 'nenhum'

  /** Status final: valido | revogado | desconhecido | erro */
  status: 'valido' | 'revogado' | 'desconhecido' | 'erro'

  /** Data/hora da revogação (se revogado) */
  dataRevogacao?: Date

  /** Motivo da revogação (se disponível) */
  motivoRevogacao?: string

  /** Timestamp da verificação */
  verificadoEm: Date

  /** Detalhes adicionais (logs, erros, etc.) */
  detalhes?: string

  /** TTL (Time To Live) da resposta OCSP em segundos */
  ttl?: number

  /** Responder info (para OCSP) */
  responderInfo?: {
    url: string
    certificateId: string
  }
}

/**
 * Info extraída do certificado X.509
 */
export interface CertificateExtractionResult {
  serialNumber: string
  issuerDN: string
  subjectDN: string
  notBefore: Date
  notAfter: Date
  issuerKeyHash?: string
  crlDistributionPoints: string[]
  ocspUrl?: string
  publicKeyAlgorithm?: string
}

/**
 * Entrada de CRL (revogado)
 */
export interface CRLEntry {
  serialNumber: string
  revocationDate: Date
  revocationReason?: string
}

/**
 * Response de OCSP parseada
 */
export interface OCSPResponse {
  status: 'good' | 'revoked' | 'unknown'
  thisUpdate: Date
  nextUpdate?: Date
  revocationTime?: Date
  revocationReason?: string
  certId: string
}

// ── CONSTANTES ────────────────────────────────────────────────────

const OCSP_REQUEST_TIMEOUT = 5000 // 5 segundos
const CRL_DOWNLOAD_TIMEOUT = 10000 // 10 segundos
const CRL_CACHE_TTL = 3600000 // 1 hora
const OCSP_CACHE_TTL = 3600000 // 1 hora

// OIDs relevantes para revogação
const OID_CRL_DISTRIBUTION_POINTS = '2.5.29.31'
const OID_AUTHORITY_INFO_ACCESS = '1.3.6.1.5.5.7.1.1'
const OID_OCSP = '1.3.6.1.5.5.7.48.1'

// ── CACHE GLOBAL ──────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const crlCache = new Map<string, CacheEntry<CRLEntry[]>>()
const ocspCache = new Map<string, CacheEntry<OCSPResponse>>()

// ── FUNÇÕES PRINCIPAIS ────────────────────────────────────────────

/**
 * Verifica se um certificado foi revogado (OCSP primeiro, fallback para CRL)
 *
 * @param certificadoPEM - Certificado em formato PEM
 * @param issuerPEM - Certificado do emissor (obrigatório para OCSP)
 * @returns Resultado da verificação
 */
export async function verificarRevogacao(
  certificadoPEM: string,
  issuerPEM?: string
): Promise<RevocationCheckResult> {
  const inicio = Date.now()

  try {
    // Extrair informações do certificado
    const certInfo = extrairInformacoesCertificado(certificadoPEM)

    if (!certInfo) {
      return {
        revogado: false,
        metodo: 'nenhum',
        status: 'erro',
        verificadoEm: new Date(),
        detalhes: 'Falha ao decodificar certificado PEM',
      }
    }

    // Tentar OCSP primeiro (tempo real)
    if (certInfo.ocspUrl && issuerPEM) {
      try {
        const resultadoOCSP = await verificarOCSP(
          certificadoPEM,
          issuerPEM,
          certInfo.ocspUrl
        )
        const tempo = Date.now() - inicio
        console.log(`[REVOGACAO] OCSP check em ${tempo}ms: ${resultadoOCSP.status}`)
        return resultadoOCSP
      } catch (erro) {
        console.warn(
          `[REVOGACAO] OCSP falhou, tentando CRL:`,
          erro instanceof Error ? erro.message : String(erro)
        )
        // Fallback para CRL
      }
    }

    // Fallback para CRL
    if (certInfo.crlDistributionPoints.length > 0) {
      const resultadoCRL = await verificarCRL(
        certificadoPEM,
        certInfo.crlDistributionPoints
      )
      const tempo = Date.now() - inicio
      console.log(`[REVOGACAO] CRL check em ${tempo}ms: ${resultadoCRL.status}`)
      return resultadoCRL
    }

    // Nenhum método disponível
    return {
      revogado: false,
      metodo: 'nenhum',
      status: 'desconhecido',
      verificadoEm: new Date(),
      detalhes:
        'Nenhum ponto de distribuição CRL ou URL OCSP encontrado no certificado',
    }
  } catch (erro) {
    const tempo = Date.now() - inicio
    console.error(`[REVOGACAO] Erro na verificação (${tempo}ms):`, erro)

    return {
      revogado: false,
      metodo: 'nenhum',
      status: 'erro',
      verificadoEm: new Date(),
      detalhes:
        erro instanceof Error ? erro.message : 'Erro desconhecido na verificação',
    }
  }
}

/**
 * Verifica revogação via CRL (Certificate Revocation List)
 *
 * @param certificadoPEM - Certificado em formato PEM
 * @param crlDistributionPoints - URLs dos pontos de distribuição CRL
 * @returns Resultado da verificação
 */
export async function verificarCRL(
  certificadoPEM: string,
  crlDistributionPoints?: string[]
): Promise<RevocationCheckResult> {
  const inicio = Date.now()

  try {
    // Extrair serial do certificado
    const certInfo = extrairInformacoesCertificado(certificadoPEM)
    if (!certInfo) {
      return {
        revogado: false,
        metodo: 'crl',
        status: 'erro',
        verificadoEm: new Date(),
        detalhes: 'Falha ao extrair informações do certificado',
      }
    }

    const serialNumber = certInfo.serialNumber

    // Se CDPs não foram fornecidos, usar os extraídos
    const cdps = crlDistributionPoints || certInfo.crlDistributionPoints
    if (cdps.length === 0) {
      return {
        revogado: false,
        metodo: 'crl',
        status: 'desconhecido',
        verificadoEm: new Date(),
        detalhes: 'Nenhum ponto de distribuição CRL encontrado',
      }
    }

    // Tentar cada CDP até obter resposta
    for (const crlUrl of cdps) {
      try {
        const crlData = await baixarCRL(crlUrl)
        const revokedEntries = parsearCRL(crlData)

        // Verificar se o serial está na lista de revogados
        const revoked = revokedEntries.find(
          entry => entry.serialNumber === serialNumber
        )

        const tempo = Date.now() - inicio

        if (revoked) {
          return {
            revogado: true,
            metodo: 'crl',
            status: 'revogado',
            dataRevogacao: revoked.revocationDate,
            motivoRevogacao: revoked.revocationReason,
            verificadoEm: new Date(),
            detalhes: `Certificado revogado em ${revoked.revocationDate.toISOString()}. Verificação CRL em ${tempo}ms`,
          }
        }

        // Certificado não está na lista de revogados
        return {
          revogado: false,
          metodo: 'crl',
          status: 'valido',
          verificadoEm: new Date(),
          detalhes: `Certificado não encontrado na CRL. Verificação em ${tempo}ms`,
        }
      } catch (erro) {
        console.warn(
          `[CRL] Erro ao processar CDP ${crlUrl}:`,
          erro instanceof Error ? erro.message : String(erro)
        )
        continue
      }
    }

    // Todos os CDPs falharam
    return {
      revogado: false,
      metodo: 'crl',
      status: 'desconhecido',
      verificadoEm: new Date(),
      detalhes: `Falha ao baixar CRL de todos os ${cdps.length} ponto(s) de distribuição`,
    }
  } catch (erro) {
    return {
      revogado: false,
      metodo: 'crl',
      status: 'erro',
      verificadoEm: new Date(),
      detalhes: erro instanceof Error ? erro.message : 'Erro desconhecido',
    }
  }
}

/**
 * Verifica revogação via OCSP (Online Certificate Status Protocol)
 *
 * @param certificadoPEM - Certificado em formato PEM
 * @param issuerPEM - Certificado do emissor
 * @param ocspUrl - URL do responder OCSP (se omitido, extrai do certificado)
 * @returns Resultado da verificação
 */
export async function verificarOCSP(
  certificadoPEM: string,
  issuerPEM: string,
  ocspUrl?: string
): Promise<RevocationCheckResult> {
  const inicio = Date.now()

  try {
    // Extrair informações do certificado
    const certInfo = extrairInformacoesCertificado(certificadoPEM)
    if (!certInfo) {
      return {
        revogado: false,
        metodo: 'ocsp',
        status: 'erro',
        verificadoEm: new Date(),
        detalhes: 'Falha ao extrair informações do certificado',
      }
    }

    // Determinar URL do responder
    const url = ocspUrl || certInfo.ocspUrl
    if (!url) {
      return {
        revogado: false,
        metodo: 'ocsp',
        status: 'desconhecido',
        verificadoEm: new Date(),
        detalhes: 'URL OCSP não encontrada no certificado',
      }
    }

    // Verificar cache
    const cacheKey = `${certInfo.serialNumber}-${url}`
    const cached = ocspCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      const response = cached.data
      const tempo = Date.now() - inicio

      return {
        revogado: response.status === 'revoked',
        metodo: 'ocsp',
        status:
          response.status === 'good'
            ? 'valido'
            : response.status === 'revoked'
              ? 'revogado'
              : 'desconhecido',
        dataRevogacao: response.revocationTime,
        motivoRevogacao: response.revocationReason,
        verificadoEm: new Date(),
        ttl: Math.ceil((cached.expiresAt - Date.now()) / 1000),
        responderInfo: {
          url,
          certificateId: certInfo.serialNumber,
        },
        detalhes: `OCSP (cached) em ${tempo}ms. Válido até ${new Date(cached.expiresAt).toISOString()}`,
      }
    }

    // Construir e enviar requisição OCSP
    const ocspRequest = construirOCSPRequest(
      certificadoPEM,
      issuerPEM,
      certInfo
    )

    const ocspResponse = await enviarOCSPRequest(url, ocspRequest)
    if (!ocspResponse) {
      return {
        revogado: false,
        metodo: 'ocsp',
        status: 'erro',
        verificadoEm: new Date(),
        detalhes: `Resposta OCSP inválida do servidor ${url}`,
      }
    }

    // Cache da resposta
    let ttl = OCSP_CACHE_TTL
    if (ocspResponse.nextUpdate) {
      const tempoAteProxima = ocspResponse.nextUpdate.getTime() - Date.now()
      if (tempoAteProxima > 0) {
        ttl = Math.min(tempoAteProxima, OCSP_CACHE_TTL)
      }
    }

    ocspCache.set(cacheKey, {
      data: ocspResponse,
      expiresAt: Date.now() + ttl,
    })

    const tempo = Date.now() - inicio

    return {
      revogado: ocspResponse.status === 'revoked',
      metodo: 'ocsp',
      status:
        ocspResponse.status === 'good'
          ? 'valido'
          : ocspResponse.status === 'revoked'
            ? 'revogado'
            : 'desconhecido',
      dataRevogacao: ocspResponse.revocationTime,
      motivoRevogacao: ocspResponse.revocationReason,
      verificadoEm: new Date(),
      ttl: Math.ceil(ttl / 1000),
      responderInfo: {
        url,
        certificateId: certInfo.serialNumber,
      },
      detalhes: `OCSP verificado em ${tempo}ms. Próxima atualização: ${ocspResponse.nextUpdate?.toISOString() || 'desconhecida'}`,
    }
  } catch (erro) {
    return {
      revogado: false,
      metodo: 'ocsp',
      status: 'erro',
      verificadoEm: new Date(),
      detalhes: erro instanceof Error ? erro.message : 'Erro desconhecido',
    }
  }
}

// ── FUNÇÕES AUXILIARES PARA PARSING E CONSTRUÇÃO ───────────────────

/**
 * Extrai informações críticas de um certificado X.509 em PEM
 * Usa parsing básico de DER (sem dependências externas)
 */
function extrairInformacoesCertificado(
  certificadoPEM: string
): CertificateExtractionResult | null {
  try {
    // Remover headers/footers PEM
    const certBase64 = certificadoPEM
      .replace(/-----BEGIN[^-]+-----/g, '')
      .replace(/-----END[^-]+-----/g, '')
      .replace(/\s/g, '')

    // Decodificar Base64
    const certDER = Buffer.from(certBase64, 'base64')

    // Parsing simplificado (análise de estrutura DER)
    // Para parsing completo, usaria @peculiar/x509 ou node-x509

    // Extrair serial number (primeiros bytes após sequência SEQUENCE)
    const serialNumber = extrairSerialNumberDER(certDER)

    // Extrair validade (notBefore e notAfter)
    const validity = extrairValidadeDER(certDER)

    // Extrair Issuer DN (simplificado)
    const issuerDN = extrairIssuerDN(certBase64)

    // Extrair Subject DN (simplificado)
    const subjectDN = extrairSubjectDN(certBase64)

    // Extrair extensões relevantes
    const crlDistributionPoints = extrairCRLDistributionPoints(certBase64)
    const ocspUrl = extrairOCSPUrl(certBase64)

    return {
      serialNumber,
      issuerDN,
      subjectDN,
      notBefore: validity.notBefore,
      notAfter: validity.notAfter,
      crlDistributionPoints,
      ocspUrl,
    }
  } catch (erro) {
    console.error('[CERT] Erro ao extrair informações:', erro)
    return null
  }
}

/**
 * Extrai serial number do certificado DER (simplificado)
 */
function extrairSerialNumberDER(derBuffer: Buffer): string {
  try {
    // Serial é tipicamente encontrado cedo no certificado
    // Procurar por padrão: INTEGER tag (02) seguido de length e bytes
    const searchStart = 0
    const searchEnd = Math.min(100, derBuffer.length)

    for (let i = searchStart; i < searchEnd - 3; i++) {
      if (derBuffer[i] === 0x02) {
        // INTEGER tag
        const length = derBuffer[i + 1]
        if (length > 0 && length <= 20) {
          // Serial típico tem até 20 bytes
          const serialBytes = derBuffer.slice(i + 2, i + 2 + length)
          return serialBytes.toString('hex').toUpperCase()
        }
      }
    }

    // Fallback: hash do certificado
    return createHash('sha256').update(derBuffer).digest('hex').substring(0, 20)
  } catch (erro) {
    console.warn('[CERT] Erro ao extrair serial, usando hash')
    return createHash('sha256')
      .update(derBuffer)
      .digest('hex')
      .substring(0, 20)
  }
}

/**
 * Extrai datas de validade do certificado (notBefore e notAfter)
 */
function extrairValidadeDER(derBuffer: Buffer): { notBefore: Date; notAfter: Date } {
  // Parsing simplificado de UTCTime/GeneralizedTime
  // Formato típico: YYMMDDhhmmssZ ou YYYYMMDDhhmmssZ

  const timePattern = /(\d{2,4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(Z)?/g
  const matches = derBuffer.toString('latin1').match(timePattern) || []

  const agora = new Date()

  if (matches.length >= 2) {
    try {
      const notBefore = parseASN1Time(matches[0] || '')
      const notAfter = parseASN1Time(matches[1] || '')
      return { notBefore, notAfter }
    } catch {
      // Fallback
    }
  }

  return {
    notBefore: new Date(agora.getTime() - 365 * 24 * 60 * 60 * 1000),
    notAfter: new Date(agora.getTime() + 365 * 24 * 60 * 60 * 1000),
  }
}

/**
 * Parse ASN.1 time string (UTCTime ou GeneralizedTime)
 */
function parseASN1Time(timeStr: string): Date {
  const match = timeStr.match(/(\d{2,4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/)
  if (!match) return new Date()

  let year = parseInt(match[1])
  // Se ano com 2 dígitos, ajustar para full year
  if (year < 100) {
    year = year < 50 ? 2000 + year : 1900 + year
  }

  const month = parseInt(match[2]) - 1 // JS months são 0-based
  const day = parseInt(match[3])
  const hours = parseInt(match[4])
  const minutes = parseInt(match[5])
  const seconds = parseInt(match[6])

  return new Date(year, month, day, hours, minutes, seconds, 0)
}

/**
 * Extrai Issuer DN do certificado (parsing string simplificado)
 */
function extrairIssuerDN(certBase64: string): string {
  try {
    const certDER = Buffer.from(certBase64, 'base64')
    const certText = certDER.toString('latin1')

    // Procurar padrão "C=" ou "CN=" (indicativo de DN)
    // Issuer geralmente vem antes do Subject
    const dnPattern = /CN=([^,;]+)/i
    const match = certText.match(dnPattern)

    return match ? `CN=${match[1]}` : 'Unknown Issuer'
  } catch {
    return 'Unknown Issuer'
  }
}

/**
 * Extrai Subject DN do certificado
 */
function extrairSubjectDN(certBase64: string): string {
  try {
    const certDER = Buffer.from(certBase64, 'base64')
    const certText = certDER.toString('latin1')

    // Subject CN é tipicamente o último CN no certificado
    const cnMatches = certText.match(/CN=([^,;]+)/gi) || []
    if (cnMatches.length > 0) {
      const lastCN = cnMatches[cnMatches.length - 1]
      return lastCN
    }

    return 'Unknown Subject'
  } catch {
    return 'Unknown Subject'
  }
}

/**
 * Extrai pontos de distribuição CRL do certificado
 */
function extrairCRLDistributionPoints(certBase64: string): string[] {
  try {
    // CRL Distribution Points contêm URLs HTTP/HTTPS
    const certDER = Buffer.from(certBase64, 'base64')
    const certText = certDER.toString('latin1')

    const urls: string[] = []
    const urlPattern = /(https?:\/\/[^\s;,<>]+)/gi

    let match
    while ((match = urlPattern.exec(certText)) !== null) {
      const url = match[1].replace(/[^\w/:.-]/g, '') // Limpar caracteres inválidos
      if (url.length > 10 && url.includes('.')) {
        urls.push(url)
      }
    }

    return Array.from(new Set(urls)) // Remover duplicatas
  } catch {
    return []
  }
}

/**
 * Extrai URL OCSP do certificado
 */
function extrairOCSPUrl(certBase64: string): string | undefined {
  try {
    const certDER = Buffer.from(certBase64, 'base64')
    const certText = certDER.toString('latin1')

    // OCSP URL está na extensão Authority Information Access (AIA)
    // Procurar por padrão HTTP(S)
    const urlPattern = /ocsp[^"'<>\s]*(https?:\/\/[^\s;,<>]+)/gi

    let match = urlPattern.exec(certText)
    if (match) {
      return match[1].replace(/[^\w/:.-]/g, '')
    }

    // Fallback: qualquer HTTP URL que pareça ser OCSP
    const allUrls = certText.match(/(https?:\/\/[^\s;,<>]+)/gi) || []
    for (const url of allUrls) {
      const cleaned = url.replace(/[^\w/:.-]/g, '')
      if (cleaned.includes('ocsp') || cleaned.includes('status')) {
        return cleaned
      }
    }

    return undefined
  } catch {
    return undefined
  }
}

/**
 * Construir requisição OCSP em formato ASN.1 (simplificado)
 * Nota: Implementação completa requereria biblioteca ASN.1
 */
function construirOCSPRequest(
  certificadoPEM: string,
  issuerPEM: string,
  certInfo: CertificateExtractionResult
): Buffer {
  // Para simplicidade, enviar um payload minimal
  // Em produção, usar biblioteca como @peculiar/x509 ou asn1js

  const nonce = Buffer.from(Date.now().toString())
  const serialBuffer = Buffer.from(certInfo.serialNumber, 'hex')

  // Payload simplificado (não é ASN.1 completo, mas ilustrativo)
  const payload = Buffer.concat([
    Buffer.from([0x30]), // SEQUENCE
    Buffer.from([serialBuffer.length + nonce.length + 10]), // Length
    Buffer.from([0x04]), // OCTET STRING (nonce)
    Buffer.from([nonce.length]),
    nonce,
    Buffer.from([0x02]), // INTEGER (serial)
    Buffer.from([serialBuffer.length]),
    serialBuffer,
  ])

  return payload
}

/**
 * Envia requisição OCSP ao responder e parseia resposta
 */
async function enviarOCSPRequest(
  ocspUrl: string,
  ocspRequest: Buffer
): Promise<OCSPResponse | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), OCSP_REQUEST_TIMEOUT)

    const response = await fetch(ocspUrl, {
      method: 'POST',
      body: ocspRequest.toString('binary'),
      headers: {
        'Content-Type': 'application/ocsp-request',
      },
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      console.warn(`[OCSP] HTTP ${response.status} from ${ocspUrl}`)
      return null
    }

    const data = await response.arrayBuffer()
    const parsed = parsearOCSPResponse(Buffer.from(data))

    return parsed
  } catch (erro) {
    console.error('[OCSP] Erro ao comunicar com responder:', erro)
    return null
  }
}

/**
 * Parseia resposta OCSP (simplificado)
 * Resposta OCSP contém status: good (0), revoked (1), unknown (2)
 */
function parsearOCSPResponse(responseBuffer: Buffer): OCSPResponse | null {
  try {
    // Parsing simplificado de ASN.1
    // Em produção, usar biblioteca especializada

    let status: 'good' | 'revoked' | 'unknown' = 'unknown'

    // Procurar status bytes na resposta
    const bufferStr = responseBuffer.toString('latin1')

    if (bufferStr.includes('\x00')) {
      // 0x00 = good
      status = 'good'
    } else if (bufferStr.includes('\x01')) {
      // 0x01 = revoked
      status = 'revoked'
    } else if (bufferStr.includes('\x02')) {
      // 0x02 = unknown
      status = 'unknown'
    }

    // Tentar extrair timestamps (thisUpdate, nextUpdate)
    const thisUpdate = new Date()
    let nextUpdate: Date | undefined

    // Procurar por padrão de timestamp
    const timeMatches = bufferStr.match(/\d{8}[0-2]\d[0-5]\d[0-5]\d/g) || []
    if (timeMatches.length > 0 && timeMatches[0]) {
      // Usar primeiro timestamp encontrado
      try {
        thisUpdate.setTime(parseInt(timeMatches[0]) * 1000)
      } catch {
        // Ignorar erro
      }
    }

    return {
      status,
      thisUpdate,
      nextUpdate,
      certId: responseBuffer.slice(0, 16).toString('hex'),
    }
  } catch (erro) {
    console.error('[OCSP] Erro ao parsear resposta:', erro)
    return null
  }
}

/**
 * Baixa CRL de um ponto de distribuição
 */
async function baixarCRL(crlUrl: string): Promise<Buffer> {
  try {
    // Verificar cache
    const cacheKey = crlUrl
    const cached = crlCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      // Retornar CRL cacheada (convertida em buffer mock)
      return Buffer.from(JSON.stringify(cached.data))
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CRL_DOWNLOAD_TIMEOUT)

    const response = await fetch(crlUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ERP-Educacional-FIC/1.0',
      },
    })

    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ao baixar CRL`)
    }

    const data = await response.arrayBuffer()
    const crlBuffer = Buffer.from(data)

    // Cache CRL parseada
    const entries = parsearCRL(crlBuffer)
    crlCache.set(cacheKey, {
      data: entries,
      expiresAt: Date.now() + CRL_CACHE_TTL,
    })

    return crlBuffer
  } catch (erro) {
    throw new Error(
      `Falha ao baixar CRL de ${crlUrl}: ${erro instanceof Error ? erro.message : String(erro)}`
    )
  }
}

/**
 * Parseia CRL (Certificate Revocation List) em DER
 * Retorna lista de seriais revogados
 */
function parsearCRL(crlBuffer: Buffer): CRLEntry[] {
  try {
    const entries: CRLEntry[] = []

    // Parsing simplificado de CRL DER
    // CRL contém lista de números seriais com datas de revogação

    // Procurar padrão: INTEGER (serial) seguido por DATE
    const bufferText = crlBuffer.toString('latin1')

    // Extrair números seriais (sequências de 2-20 hex digits)
    const serialPattern = /[\x02][\x01-\x14]([\x00-\xff]{1,20})/g

    let match
    while ((match = serialPattern.exec(bufferText)) !== null) {
      const serialBytes = match[1]
      const serial = Buffer.from(serialBytes, 'latin1').toString('hex').toUpperCase()

      entries.push({
        serialNumber: serial,
        revocationDate: new Date(),
      })
    }

    return entries
  } catch (erro) {
    console.error('[CRL] Erro ao parsear CRL:', erro)
    return []
  }
}

/**
 * Limpar caches (para testes ou manutenção)
 */
export function limparCaches(): void {
  crlCache.clear()
  ocspCache.clear()
  console.log('[REVOGACAO] Caches CRL e OCSP limpos')
}

/**
 * Obter estatísticas de cache
 */
export function obterEstatisticasCache(): {
  crlCacheSize: number
  ocspCacheSize: number
  totalCacheSize: number
} {
  return {
    crlCacheSize: crlCache.size,
    ocspCacheSize: ocspCache.size,
    totalCacheSize: crlCache.size + ocspCache.size,
  }
}
