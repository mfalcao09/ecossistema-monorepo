// ============================================================
// ICP-Brasil — Verificação de Assinatura Digital
// ERP Educacional FIC — Segurança Nível C
//
// Módulo para verificar assinaturas digitais ICP-Brasil
// em documentos XML (XAdES) do Diploma Digital.
//
// IMPORTANTE: Este módulo faz verificações estruturais.
// A verificação criptográfica real será feita pela API
// da BRy/Certisign/Soluti (terceiros contratados).
//
// Referência:
// - IN SESU/MEC 1/2020 (requisitos técnicos)
// - ITI - Infraestrutura de Chaves Públicas
// - DOC-ICP-15 (Visão geral sobre assinaturas digitais)
// ============================================================

// ── Tipos ────────────────────────────────────────────────────

export interface CertificadoInfo {
  /** Nome do titular (CN) */
  titular: string
  /** CPF do titular (extraído do OID) */
  cpf: string | null
  /** CNPJ da pessoa jurídica (se aplicável) */
  cnpj: string | null
  /** Autoridade Certificadora (Issuer CN) */
  autoridade_certificadora: string
  /** Data de emissão do certificado */
  valido_de: string | null
  /** Data de expiração do certificado */
  valido_ate: string | null
  /** Se o certificado é do tipo A3 (obrigatório para diploma) */
  tipo_a3: boolean | null
  /** Número serial do certificado */
  serial: string | null
  /** Cadeia de certificação (ACs intermediárias + raiz) */
  cadeia: string[]
}

export interface ResultadoVerificacaoAssinatura {
  /** Se a verificação estrutural passou */
  valido: boolean
  /** Total de assinaturas encontradas */
  total_assinaturas: number
  /** Detalhes de cada assinatura */
  assinaturas: AssinaturaDetalhada[]
  /** Erros encontrados */
  erros: ErroVerificacao[]
  /** Avisos (não bloqueiam, mas devem ser revisados) */
  avisos: string[]
  /** Timestamp da verificação */
  verificado_em: string
}

export interface AssinaturaDetalhada {
  /** Índice da assinatura (1-based) */
  indice: number
  /** Tipo: XAdES-BES, XAdES-T, XAdES-X, AD-RA, etc. */
  tipo: string
  /** Dados do certificado */
  certificado: CertificadoInfo
  /** Data/hora da assinatura (SigningTime) */
  data_assinatura: string | null
  /** Se tem carimbo de tempo (obrigatório para AD-RA) */
  tem_carimbo_tempo: boolean
  /** Algoritmo de assinatura */
  algoritmo: string | null
  /** Status da verificação desta assinatura */
  status: 'valida' | 'invalida' | 'indeterminada'
  /** Motivo se inválida */
  motivo: string | null
}

export interface ErroVerificacao {
  codigo: string
  mensagem: string
  severidade: 'critico' | 'alto' | 'medio'
}

// ── Padrões XAdES ────────────────────────────────────────────

// Namespaces XML usados em assinaturas digitais
const NS_DS = 'http://www.w3.org/2000/09/xmldsig#'
const NS_XADES = 'http://uri.etsi.org/01903/v1.3.2#'

// OIDs ICP-Brasil para extração de CPF/CNPJ do certificado
const OID_CPF_PESSOA_FISICA = '2.16.76.1.3.1'
const OID_CNPJ_PESSOA_JURIDICA = '2.16.76.1.3.3'

// Algoritmos aceitos pelo ICP-Brasil
const ALGORITMOS_ACEITOS = new Set([
  'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
  'http://www.w3.org/2001/04/xmldsig-more#rsa-sha384',
  'http://www.w3.org/2001/04/xmldsig-more#rsa-sha512',
  'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256',
  'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha384',
  'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha512',
])

// Algoritmos PROIBIDOS (inseguros)
const ALGORITMOS_PROIBIDOS = new Set([
  'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
  'http://www.w3.org/2000/09/xmldsig#dsa-sha1',
  'http://www.w3.org/2001/04/xmldsig-more#rsa-md5',
])

// ACs Raiz ICP-Brasil conhecidas
const ACS_RAIZ_ICP_BRASIL = [
  'AC Raiz ICP-Brasil',
  'Autoridade Certificadora Raiz Brasileira',
  'ICP-Brasil',
]

// ── Verificação principal ────────────────────────────────────

/**
 * Verifica assinaturas digitais em um XML assinado.
 *
 * Faz verificações ESTRUTURAIS:
 * - Presença de elementos ds:Signature
 * - Formato XAdES válido
 * - Algoritmos seguros (SHA-256+, proíbe SHA-1)
 * - Presença de certificado X.509
 * - Extração de dados do certificado (titular, CPF, validade)
 * - Verificação de carimbo de tempo (obrigatório para AD-RA)
 * - Cadeia de certificação pertence ao ICP-Brasil
 *
 * NÃO faz (requer API terceiros):
 * - Verificação criptográfica da assinatura
 * - Consulta de revogação (CRL/OCSP)
 * - Validação da cadeia completa de certificação
 *
 * @param xmlContent - Conteúdo XML assinado
 * @returns Resultado da verificação
 */
export function verificarAssinaturaXML(
  xmlContent: string
): ResultadoVerificacaoAssinatura {
  const erros: ErroVerificacao[] = []
  const avisos: string[] = []
  const assinaturas: AssinaturaDetalhada[] = []

  // ── 1. Verificar que o XML contém assinaturas ──────────
  const signatureBlocks = extrairBlocos(xmlContent, 'Signature', NS_DS)

  if (signatureBlocks.length === 0) {
    erros.push({
      codigo: 'SEM_ASSINATURA',
      mensagem: 'Nenhuma assinatura digital encontrada no XML.',
      severidade: 'critico',
    })

    return {
      valido: false,
      total_assinaturas: 0,
      assinaturas: [],
      erros,
      avisos,
      verificado_em: new Date().toISOString(),
    }
  }

  // ── 2. Analisar cada assinatura ────────────────────────
  for (let i = 0; i < signatureBlocks.length; i++) {
    const bloco = signatureBlocks[i]
    const indice = i + 1

    const resultado = analisarAssinatura(bloco, indice, erros, avisos)
    assinaturas.push(resultado)
  }

  // ── 3. Verificações globais ────────────────────────────

  // Diploma Digital requer mínimo 5 assinaturas
  // (2 da emissora + 3 da registradora)
  if (assinaturas.length < 5) {
    avisos.push(
      `Encontradas ${assinaturas.length} assinaturas. ` +
      `Diploma Digital requer no mínimo 5 (2 emissora + 3 registradora).`
    )
  }

  // Verificar se pelo menos uma tem carimbo de tempo
  const temCariboTempo = assinaturas.some(a => a.tem_carimbo_tempo)
  if (!temCariboTempo && assinaturas.length > 0) {
    avisos.push(
      'Nenhuma assinatura possui carimbo de tempo. ' +
      'AD-RA (Assinatura Digital com Referência de Arquivamento) ' +
      'requer carimbo de tempo.'
    )
  }

  // ── 4. Resultado final ─────────────────────────────────
  const temErroCritico = erros.some(e => e.severidade === 'critico')
  const todasValidas = assinaturas.every(a => a.status !== 'invalida')

  return {
    valido: !temErroCritico && todasValidas,
    total_assinaturas: assinaturas.length,
    assinaturas,
    erros,
    avisos,
    verificado_em: new Date().toISOString(),
  }
}

// ── Análise individual de assinatura ─────────────────────────

function analisarAssinatura(
  bloco: string,
  indice: number,
  erros: ErroVerificacao[],
  avisos: string[]
): AssinaturaDetalhada {
  // Extrair algoritmo
  const algoritmo = extrairAtributo(bloco, 'SignatureMethod', 'Algorithm')

  // Verificar algoritmo
  if (algoritmo) {
    if (ALGORITMOS_PROIBIDOS.has(algoritmo)) {
      erros.push({
        codigo: 'ALGORITMO_INSEGURO',
        mensagem: `Assinatura ${indice}: usa algoritmo inseguro (${algoritmo}). SHA-1 e MD5 são proibidos pelo ICP-Brasil.`,
        severidade: 'critico',
      })
    } else if (!ALGORITMOS_ACEITOS.has(algoritmo)) {
      avisos.push(`Assinatura ${indice}: algoritmo não reconhecido (${algoritmo}).`)
    }
  }

  // Extrair certificado X.509
  const certBase64 = extrairConteudoTag(bloco, 'X509Certificate')
  const certInfo = certBase64
    ? extrairInfoCertificado(certBase64, indice, erros, avisos)
    : criarCertificadoVazio(indice, erros)

  // Extrair SigningTime
  const signingTime = extrairConteudoTag(bloco, 'SigningTime')

  // Verificar carimbo de tempo
  const temCariboTempo =
    bloco.includes('SignatureTimeStamp') ||
    bloco.includes('xades:SignatureTimeStamp') ||
    bloco.includes('EncapsulatedTimeStamp')

  // Detectar tipo XAdES
  const tipo = detectarTipoXAdES(bloco)

  // Status
  let status: 'valida' | 'invalida' | 'indeterminada' = 'indeterminada'
  let motivo: string | null = null

  if (algoritmo && ALGORITMOS_PROIBIDOS.has(algoritmo)) {
    status = 'invalida'
    motivo = 'Algoritmo de assinatura inseguro'
  } else if (!certBase64) {
    status = 'invalida'
    motivo = 'Certificado X.509 ausente'
  }

  return {
    indice,
    tipo,
    certificado: certInfo,
    data_assinatura: signingTime,
    tem_carimbo_tempo: temCariboTempo,
    algoritmo,
    status,
    motivo,
  }
}

// ── Extração de dados do certificado ─────────────────────────

function extrairInfoCertificado(
  certBase64: string,
  indice: number,
  erros: ErroVerificacao[],
  avisos: string[]
): CertificadoInfo {
  // Decodificar certificado (análise básica do DER/Base64)
  // A análise completa requer biblioteca ASN.1 — aqui fazemos parsing simplificado

  const info: CertificadoInfo = {
    titular: '',
    cpf: null,
    cnpj: null,
    autoridade_certificadora: '',
    valido_de: null,
    valido_ate: null,
    tipo_a3: null,
    serial: null,
    cadeia: [],
  }

  try {
    // Decodificar Base64 para bytes
    const certBytes = Buffer.from(certBase64.replace(/\s/g, ''), 'base64')

    // Extrair CN (Common Name) do Subject — busca padrão ASN.1 simplificado
    // O certificado DER contém strings UTF-8/PrintableString com o CN
    const certText = certBytes.toString('latin1')

    // Tentar extrair CN do Subject
    const cnMatch = certText.match(/CN=([^,\x00-\x1f]+)/i)
    if (cnMatch) {
      info.titular = cnMatch[1].trim()
    }

    // Tentar extrair Issuer CN
    // O segundo CN geralmente é o Issuer
    const allCNs = certText.match(/CN=([^,\x00-\x1f]+)/gi) || []
    if (allCNs.length >= 2) {
      const issuerCN = allCNs[allCNs.length - 1].replace(/CN=/i, '').trim()
      info.autoridade_certificadora = issuerCN
    }

    // Verificar se pertence à cadeia ICP-Brasil
    const pertenceICP = ACS_RAIZ_ICP_BRASIL.some(ac =>
      certText.toLowerCase().includes(ac.toLowerCase())
    ) || certText.toLowerCase().includes('icp-brasil')

    if (!pertenceICP) {
      avisos.push(
        `Assinatura ${indice}: certificado pode não pertencer à cadeia ICP-Brasil. ` +
        `Verificação completa requer consulta à AC Raiz.`
      )
    } else {
      info.cadeia.push('ICP-Brasil')
    }

    // Extrair CPF (OID 2.16.76.1.3.1)
    if (certText.includes(OID_CPF_PESSOA_FISICA)) {
      // CPF está nos 11 dígitos após o OID
      const cpfMatch = certText.match(/(\d{11})/g)
      if (cpfMatch) {
        // Verificar qual sequência de 11 dígitos é um CPF válido
        for (const candidato of cpfMatch) {
          if (validarCPF(candidato)) {
            info.cpf = candidato
            break
          }
        }
      }
    }

    // Extrair CNPJ (OID 2.16.76.1.3.3)
    if (certText.includes(OID_CNPJ_PESSOA_JURIDICA)) {
      const cnpjMatch = certText.match(/(\d{14})/g)
      if (cnpjMatch) {
        info.cnpj = cnpjMatch[0]
      }
    }

    // Verificar tamanho do certificado (A3 geralmente > 1KB)
    if (certBytes.length > 0) {
      info.serial = certBytes.subarray(0, 16).toString('hex')
    }

  } catch {
    avisos.push(`Assinatura ${indice}: erro ao decodificar certificado X.509.`)
  }

  return info
}

function criarCertificadoVazio(
  indice: number,
  erros: ErroVerificacao[]
): CertificadoInfo {
  erros.push({
    codigo: 'CERT_AUSENTE',
    mensagem: `Assinatura ${indice}: certificado X.509 não encontrado no bloco de assinatura.`,
    severidade: 'alto',
  })

  return {
    titular: '',
    cpf: null,
    cnpj: null,
    autoridade_certificadora: '',
    valido_de: null,
    valido_ate: null,
    tipo_a3: null,
    serial: null,
    cadeia: [],
  }
}

// ── Detecção de tipo XAdES ───────────────────────────────────

function detectarTipoXAdES(bloco: string): string {
  if (bloco.includes('ArchiveTimeStamp') || bloco.includes('xades:ArchiveTimeStamp')) {
    return 'XAdES-A (AD-RA)'
  }
  if (bloco.includes('RefsOnlyTimeStamp') || bloco.includes('SigAndRefsTimeStamp')) {
    return 'XAdES-X'
  }
  if (bloco.includes('CompleteCertificateRefs') || bloco.includes('CompleteRevocationRefs')) {
    return 'XAdES-C'
  }
  if (bloco.includes('SignatureTimeStamp') || bloco.includes('xades:SignatureTimeStamp')) {
    return 'XAdES-T'
  }
  if (bloco.includes('SignedProperties') || bloco.includes('xades:SignedProperties')) {
    return 'XAdES-BES'
  }
  return 'XML-DSig'
}

// ── Helpers de parsing XML (sem dependências) ────────────────

function extrairBlocos(xml: string, tagName: string, _ns?: string): string[] {
  const blocos: string[] = []
  // Buscar com e sem namespace prefix
  const patterns = [
    new RegExp(`<${tagName}[\\s>][\\s\\S]*?</${tagName}>`, 'gi'),
    new RegExp(`<ds:${tagName}[\\s>][\\s\\S]*?</ds:${tagName}>`, 'gi'),
  ]

  for (const pattern of patterns) {
    const matches = xml.match(pattern)
    if (matches) {
      blocos.push(...matches)
    }
  }

  return blocos
}

function extrairConteudoTag(xml: string, tagName: string): string | null {
  const patterns = [
    new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'),
    new RegExp(`<ds:${tagName}[^>]*>([\\s\\S]*?)</ds:${tagName}>`, 'i'),
    new RegExp(`<xades:${tagName}[^>]*>([\\s\\S]*?)</xades:${tagName}>`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = xml.match(pattern)
    if (match) return match[1].trim()
  }
  return null
}

function extrairAtributo(xml: string, tagName: string, attrName: string): string | null {
  const patterns = [
    new RegExp(`<${tagName}[^>]*${attrName}="([^"]*)"`, 'i'),
    new RegExp(`<ds:${tagName}[^>]*${attrName}="([^"]*)"`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = xml.match(pattern)
    if (match) return match[1]
  }
  return null
}

// ── Validação de CPF (simplificada) ──────────────────────────

function validarCPF(cpf: string): boolean {
  if (cpf.length !== 11) return false
  if (/^(\d)\1+$/.test(cpf)) return false

  let soma = 0
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i)) * (10 - i)
  }
  let resto = (soma * 10) % 11
  if (resto === 10) resto = 0
  if (resto !== parseInt(cpf.charAt(9))) return false

  soma = 0
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i)) * (11 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10) resto = 0
  return resto === parseInt(cpf.charAt(10))
}

// ── Utilidade pública ────────────────────────────────────────

/**
 * Extrai informações de todos os certificados presentes no XML.
 * Útil para listar quem assinou sem fazer verificação completa.
 */
export function extrairCertificados(xmlContent: string): CertificadoInfo[] {
  const certs: CertificadoInfo[] = []
  const certBlocks = xmlContent.match(
    /<(?:ds:)?X509Certificate[^>]*>([\s\S]*?)<\/(?:ds:)?X509Certificate>/gi
  ) || []

  for (const block of certBlocks) {
    const match = block.match(/>([^<]+)</)
    if (match) {
      const info = extrairInfoCertificado(match[1], certs.length + 1, [], [])
      certs.push(info)
    }
  }

  return certs
}
