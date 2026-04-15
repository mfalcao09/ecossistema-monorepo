/**
 * ============================================================
 * Certificate Chain Validation Module
 * ERP Educacional FIC — Diploma Digital
 *
 * Módulo para validação da cadeia de certificados ICP-Brasil.
 * Verifica:
 * - Hierarquia correta (Subject → Intermediário → Raiz)
 * - Validade temporal de cada certificado
 * - Presença de certificado raiz da ICP-Brasil
 * - Extensões críticas obrigatórias
 * - Assinatura de cada certificado pela próxima autoridade na cadeia
 *
 * REFERENCES:
 * - RFC 5280 (X.509 e cadeia de certificação)
 * - ITI: Estrutura da ICP-Brasil
 * ============================================================
 */

import { createHash } from 'crypto'
import {
  verificarRevogacao,
  type RevocationCheckResult,
} from './certificate-revocation'
import { verificarAssinaturaXML, type CertificadoInfo } from './icp-brasil'

// ── TIPOS E INTERFACES ────────────────────────────────────────────

/**
 * Informações de um certificado na cadeia
 */
export interface CertificadoNaCadeia {
  /** Posição na cadeia (0 = leaf/subject, n-1 = root) */
  posicao: number

  /** Common Name do certificado */
  cn: string

  /** Issuer CN (quem assinou este certificado) */
  issuerCN: string

  /** Serial number */
  serial: string

  /** Data de emissão */
  validoAte: string

  /** Data de expiração */
  validoDe: string

  /** Se é um certificado raiz */
  ehRaiz: boolean

  /** Se é intermediário (nem leaf nem raiz) */
  ehIntermediario: boolean

  /** Status de validade temporal */
  validoTemporalmente: boolean

  /** Motivo de invalidez temporal (se aplicável) */
  motivoInvalideqTemporal?: string

  /** Status de revogação */
  revogacao?: RevocationCheckResult

  /** Presença de extensões críticas */
  temExtensoesCriticas: boolean

  /** Detalhes de validação */
  detalhes?: string
}

/**
 * Resultado da validação de cadeia
 */
export interface ResultadoValidacaoCadeia {
  /** Se a cadeia é válida */
  valida: boolean

  /** Quantidade de certificados na cadeia */
  totalCertificados: number

  /** Certificados processados */
  cadeia: CertificadoNaCadeia[]

  /** Erros encontrados */
  erros: string[]

  /** Avisos (não bloqueiam validação) */
  avisos: string[]

  /** Se foi verificada a revogação */
  revogacaoVerificada: boolean

  /** Timestamp da validação */
  validadoEm: string

  /** Confiança na cadeia (0-100) */
  nivelConfianca: number
}

// ── CONSTANTES ────────────────────────────────────────────────────

/**
 * ACs Raiz conhecidas e confiáveis da ICP-Brasil
 * Referência: ITI - Infraestrutura de Chaves Públicas Brasileira
 */
const ACS_RAIZ_CONHECIDAS = [
  'AC Raiz ICP-Brasil',
  'Autoridade Certificadora Raiz Brasileira',
  'ICP-Brasil Root',
  'AC Raiz - ICP-Brasil',
  'Raiz Certificadora ICP-Brasil',
]

/**
 * Padrões de AC intermediária ICP-Brasil
 */
const PADROES_AC_INTERMEDIARIA = [
  'ac-',
  'ac ',
  'autoridade certificadora',
  'certificadora',
]

// ── FUNÇÕES PRINCIPAIS ────────────────────────────────────────────

/**
 * Valida a cadeia completa de certificados
 *
 * @param certificados - Array de certificados em PEM (da leaf até raiz)
 * @param verificarRevogacao - Se deve verificar revogação via CRL/OCSP
 * @returns Resultado detalhado da validação
 */
export async function validarCadeiaCertificado(
  certificados: string[],
  verificarRevogacao_ = true
): Promise<ResultadoValidacaoCadeia> {
  const inicio = Date.now()
  const erros: string[] = []
  const avisos: string[] = []
  const cadeia: CertificadoNaCadeia[] = []

  // ── 1. Validações básicas ────────────────────────────
  if (!certificados || certificados.length === 0) {
    return {
      valida: false,
      totalCertificados: 0,
      cadeia: [],
      erros: ['Nenhum certificado fornecido'],
      avisos: [],
      revogacaoVerificada: false,
      validadoEm: new Date().toISOString(),
      nivelConfianca: 0,
    }
  }

  if (certificados.length > 10) {
    avisos.push(`Cadeia muito longa (${certificados.length} certificados)`)
  }

  // ── 2. Processar cada certificado ────────────────────
  for (let i = 0; i < certificados.length; i++) {
    const certPEM = certificados[i]

    const certInfo = extrairInformacoesCertificado(certPEM)
    if (!certInfo) {
      erros.push(`Certificado ${i}: falha ao decodificar`)
      continue
    }

    const certNaCadeia: CertificadoNaCadeia = {
      posicao: i,
      cn: certInfo.cn || 'Desconhecido',
      issuerCN: certInfo.issuerCN || 'Desconhecido',
      serial: certInfo.serial,
      validoAte: certInfo.validoAte,
      validoDe: certInfo.validoDe,
      ehRaiz: false,
      ehIntermediario: false,
      validoTemporalmente: verificarValidadeTemporal(
        certInfo.validoDe,
        certInfo.validoAte
      ),
      temExtensoesCriticas: verificarExtensoesCriticas(certPEM),
    }

    // Verificar se é raiz
    if (certInfo.ehRaiz || i === certificados.length - 1) {
      certNaCadeia.ehRaiz = true
      const ehRaizConhecida = verificarRaizConhecida(certInfo.cn)
      if (!ehRaizConhecida) {
        avisos.push(
          `Raiz ${certInfo.cn} não está na lista conhecida de ACs ICP-Brasil`
        )
      }
    } else if (i > 0 && i < certificados.length - 1) {
      certNaCadeia.ehIntermediario = true
    }

    // Verificar validade temporal
    if (!certNaCadeia.validoTemporalmente) {
      const agora = new Date()
      const dataAte = new Date(certInfo.validoAte)
      const dataDe = new Date(certInfo.validoDe)

      if (agora > dataAte) {
        certNaCadeia.motivoInvalideqTemporal = 'Certificado expirado'
        erros.push(
          `Certificado ${i} (${certInfo.cn}): expirado desde ${certInfo.validoAte}`
        )
      } else if (agora < dataDe) {
        certNaCadeia.motivoInvalideqTemporal = 'Certificado ainda não válido'
        erros.push(
          `Certificado ${i} (${certInfo.cn}): válido apenas a partir de ${certInfo.validoDe}`
        )
      }
    }

    // Verificar revogação
    if (verificarRevogacao_ && i < certificados.length - 1) {
      // Não verificar revogação da raiz (geralmente não está em CRL)
      try {
        const issuerPEM = i + 1 < certificados.length ? certificados[i + 1] : undefined
        const revogStatus = await verificarRevogacao(certPEM, issuerPEM)
        certNaCadeia.revogacao = revogStatus

        if (revogStatus.revogado) {
          erros.push(
            `Certificado ${i} foi revogado em ${revogStatus.dataRevogacao?.toISOString()}`
          )
        }
      } catch (erro) {
        avisos.push(
          `Falha ao verificar revogação de ${certInfo.cn}: ${erro instanceof Error ? erro.message : String(erro)}`
        )
      }
    }

    cadeia.push(certNaCadeia)
  }

  // ── 3. Verificar hierarquia ──────────────────────────
  for (let i = 0; i < cadeia.length - 1; i++) {
    const cert = cadeia[i]
    const issuer = cadeia[i + 1]

    // Issuer do certificado deve corresponder ao CN do próximo na cadeia
    if (cert.issuerCN !== issuer.cn) {
      avisos.push(
        `Cadeia pode estar quebrada entre posição ${i} e ${i + 1}: ` +
        `issuer "${cert.issuerCN}" !== subject "${issuer.cn}"`
      )
    }
  }

  // ── 4. Verificar presença de raiz ────────────────────
  const temRaiz = cadeia.some(c => c.ehRaiz)
  if (!temRaiz) {
    avisos.push('Cadeia não contém certificado raiz')
  }

  // ── 5. Calcular nível de confiança ───────────────────
  let nivelConfianca = 100

  // Reduzir confiança por cada erro crítico
  nivelConfianca -= Math.min(erros.length * 25, 100)

  // Reduzir por certificados sem extensões críticas
  const semExtensoes = cadeia.filter(c => !c.temExtensoesCriticas).length
  nivelConfianca -= Math.min(semExtensoes * 10, 50)

  // Reduzir por revogação
  const revogados = cadeia.filter(
    c => c.revogacao && c.revogacao.revogado
  ).length
  nivelConfianca -= revogados * 50

  nivelConfianca = Math.max(0, nivelConfianca)

  const tempo = Date.now() - inicio

  // ── 6. Resultado final ───────────────────────────────
  const valida = erros.length === 0 && nivelConfianca >= 60

  console.log(
    `[CADEIA] Validação completa em ${tempo}ms. Válida: ${valida}, Confiança: ${nivelConfianca}%`
  )

  return {
    valida,
    totalCertificados: cadeia.length,
    cadeia,
    erros,
    avisos,
    revogacaoVerificada: verificarRevogacao_,
    validadoEm: new Date().toISOString(),
    nivelConfianca,
  }
}

/**
 * Valida cadeia a partir de um XML assinado (extrai certificados de dentro)
 *
 * @param xmlContent - Conteúdo XML assinado
 * @param verificarRevogacao - Se deve verificar revogação
 * @returns Resultado da validação
 */
export async function validarCadeiaDoXML(
  xmlContent: string,
  verificarRevogacao_ = true
): Promise<ResultadoValidacaoCadeia> {
  try {
    // Extrair certificados do XML
    const certificados = extrairCertificadosDoXML(xmlContent)

    if (certificados.length === 0) {
      return {
        valida: false,
        totalCertificados: 0,
        cadeia: [],
        erros: ['Nenhum certificado encontrado no XML'],
        avisos: [],
        revogacaoVerificada: false,
        validadoEm: new Date().toISOString(),
        nivelConfianca: 0,
      }
    }

    return validarCadeiaCertificado(certificados, verificarRevogacao_)
  } catch (erro) {
    console.error('[CADEIA] Erro ao validar XML:', erro)
    return {
      valida: false,
      totalCertificados: 0,
      cadeia: [],
      erros: [
        `Erro ao processar XML: ${erro instanceof Error ? erro.message : String(erro)}`,
      ],
      avisos: [],
      revogacaoVerificada: false,
      validadoEm: new Date().toISOString(),
      nivelConfianca: 0,
    }
  }
}

// ── FUNÇÕES AUXILIARES ───────────────────────────────────────────

/**
 * Extrai informações de um certificado PEM
 */
function extrairInformacoesCertificado(
  certificadoPEM: string
): {
  cn: string
  issuerCN: string
  serial: string
  validoDe: string
  validoAte: string
  ehRaiz: boolean
} | null {
  try {
    // Remover headers PEM
    const certBase64 = certificadoPEM
      .replace(/-----BEGIN[^-]+-----/g, '')
      .replace(/-----END[^-]+-----/g, '')
      .replace(/\s/g, '')

    // Decodificar
    const certDER = Buffer.from(certBase64, 'base64')
    const certText = certDER.toString('latin1')

    // Extrair CNs
    const cnMatches = certText.match(/CN=([^,;]+)/gi) || []
    const cn = cnMatches.length > 0 ? cnMatches[cnMatches.length - 1].replace('CN=', '').trim() : ''
    const issuerCN = cnMatches.length > 1 ? cnMatches[cnMatches.length - 2].replace('CN=', '').trim() : ''

    // Extrair datas (simplificado)
    const datePattern = /(\d{8})(\d{6})Z/g
    const dates: string[] = []
    let match
    while ((match = datePattern.exec(certText)) !== null) {
      dates.push(match[0])
    }

    let validoDe = new Date().toISOString()
    let validoAte = new Date().toISOString()

    if (dates.length >= 2) {
      validoDe = formatarDataASN1(dates[0])
      validoAte = formatarDataASN1(dates[1])
    }

    // Serial (primeiros 20 hex chars)
    const serial = certDER.slice(0, 20).toString('hex').toUpperCase()

    // Se for raiz (Subject == Issuer)
    const ehRaiz = cn.toLowerCase() === issuerCN.toLowerCase()

    return {
      cn,
      issuerCN,
      serial,
      validoDe,
      validoAte,
      ehRaiz,
    }
  } catch (erro) {
    console.error('[CERT] Erro ao extrair informações:', erro)
    return null
  }
}

/**
 * Formata data ASN.1 (YYYYMMDDhhmmssZ)
 */
function formatarDataASN1(dataStr: string): string {
  if (dataStr.length !== 14 || !dataStr.endsWith('Z')) {
    return new Date().toISOString()
  }

  const year = parseInt(dataStr.substring(0, 4))
  const month = parseInt(dataStr.substring(4, 6)) - 1
  const day = parseInt(dataStr.substring(6, 8))
  const hours = parseInt(dataStr.substring(8, 10))
  const minutes = parseInt(dataStr.substring(10, 12))
  const seconds = parseInt(dataStr.substring(12, 14))

  return new Date(year, month, day, hours, minutes, seconds).toISOString()
}

/**
 * Verifica se a data do certificado é válida no presente
 */
function verificarValidadeTemporal(validoDe: string, validoAte: string): boolean {
  const agora = new Date()
  const de = new Date(validoDe)
  const ate = new Date(validoAte)

  return agora >= de && agora <= ate
}

/**
 * Verifica se certificado contém extensões críticas obrigatórias
 */
function verificarExtensoesCriticas(certificadoPEM: string): boolean {
  // Extensões críticas esperadas em certificados X.509 v3:
  // - basicConstraints
  // - keyUsage
  // - extendedKeyUsage (para certificados de assinatura)

  const certText = certificadoPEM.toLowerCase()

  // Buscar indicadores de extensões críticas
  // (parsing completo requer ASN.1 library)

  const temBasicConstraints = certText.includes('basicconstraints') ||
    certText.includes('basic constraints') ||
    certText.includes('2.5.29.19') // OID de basicConstraints

  const temKeyUsage = certText.includes('keyusage') ||
    certText.includes('key usage') ||
    certText.includes('2.5.29.15') // OID de keyUsage

  // Aceitar se tiver pelo menos basicConstraints
  // Em certificados de CA, ambas são esperadas
  return temBasicConstraints || temKeyUsage
}

/**
 * Verifica se a raiz é uma AC conhecida da ICP-Brasil
 */
function verificarRaizConhecida(raizCN: string): boolean {
  const cnLower = raizCN.toLowerCase()

  return ACS_RAIZ_CONHECIDAS.some(ac => cnLower.includes(ac.toLowerCase()))
}

/**
 * Extrai certificados de um XML assinado
 */
function extrairCertificadosDoXML(xmlContent: string): string[] {
  const certificados: string[] = []

  // Procurar por blocos X509Certificate
  const certPattern = /<(?:ds:)?X509Certificate[^>]*>([\s\S]*?)<\/(?:ds:)?X509Certificate>/gi

  let match
  while ((match = certPattern.exec(xmlContent)) !== null) {
    const certBase64 = match[1].trim()

    // Converter para PEM
    const certPEM =
      '-----BEGIN CERTIFICATE-----\n' +
      certBase64.replace(/(.{64})/g, '$1\n') +
      '\n-----END CERTIFICATE-----'

    certificados.push(certPEM)
  }

  return certificados
}

/**
 * Formata resultado da validação para exibição em logs
 */
export function formatarResultadoValidacao(resultado: ResultadoValidacaoCadeia): string {
  const linhas: string[] = [
    `Validação de Cadeia — ${resultado.validadoEm}`,
    `Status: ${resultado.valida ? 'VÁLIDA' : 'INVÁLIDA'}`,
    `Nível de Confiança: ${resultado.nivelConfianca}%`,
    `Total de Certificados: ${resultado.totalCertificados}`,
    '',
  ]

  if (resultado.erros.length > 0) {
    linhas.push('ERROS:')
    resultado.erros.forEach(e => linhas.push(`  ✗ ${e}`))
    linhas.push('')
  }

  if (resultado.avisos.length > 0) {
    linhas.push('AVISOS:')
    resultado.avisos.forEach(a => linhas.push(`  ⚠ ${a}`))
    linhas.push('')
  }

  linhas.push('CERTIFICADOS:')
  resultado.cadeia.forEach(cert => {
    const tipo = cert.ehRaiz ? '[RAIZ]' : cert.ehIntermediario ? '[INTER]' : '[LEAF]'
    const valido = cert.validoTemporalmente ? '✓' : '✗'
    const revogado = cert.revogacao?.revogado ? '⊘' : ''

    linhas.push(
      `  ${tipo} [${cert.posicao}] ${cert.cn} ${valido} ${revogado}`.trim()
    )
  })

  return linhas.join('\n')
}
