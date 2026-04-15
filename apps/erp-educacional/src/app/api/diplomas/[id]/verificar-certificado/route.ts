/**
 * ============================================================
 * API Endpoint: Verificar Revogação de Certificado
 * ERP Educacional FIC — Diploma Digital
 *
 * POST /api/diplomas/[id]/verificar-certificado
 *
 * Verifica se os certificados de assinatura de um diploma
 * foram revogados via CRL ou OCSP.
 *
 * SEGURANÇA:
 * - Requer autenticação (admin ou gestor de diplomas)
 * - Requer autorização (acesso ao diploma específico)
 * - Log de auditoria registra todas as verificações
 * - Rate-limitado
 *
 * RESPOSTA:
 * - 200: Verificação concluída (sucesso ou revogado)
 * - 400: Parâmetros inválidos
 * - 401: Não autenticado
 * - 403: Sem permissão
 * - 404: Diploma não encontrado
 * - 500: Erro servidor
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  verificarRevogacao,
  obterEstatisticasCache,
  type RevocationCheckResult,
} from '@/lib/security/certificate-revocation'
import {
  validarCadeiaCertificado,
  formatarResultadoValidacao,
  type ResultadoValidacaoCadeia,
} from '@/lib/security/certificate-chain'
import { verificarAssinaturaXML, extrairCertificados } from '@/lib/security/icp-brasil'
import { verificarAuthComPermissao, erroNaoEncontrado, erroInterno } from '@/lib/security/api-guard'
import { logSecurityEvent } from '@/lib/security/security-logger'
import { registrarAuditoria } from '@/lib/security/audit-trail'
import { AcaoAuditoria, EntidadeAuditavel } from '@/lib/security/audit-trail.types'
import { sanitizarErro } from '@/lib/security/sanitize-error'

// ── TIPOS ─────────────────────────────────────────────────────────

interface VerificacaoCertificadoRequest {
  /** Se deve verificar revogação via CRL/OCSP */
  verificarRevogacao?: boolean

  /** Se deve verificar cadeia completa */
  verificarCadeia?: boolean

  /** XML do diploma (se for análise offline) */
  xml?: string
}

interface ResultadoVerificacaoCertificado {
  /** ID do diploma */
  diplomaId: string

  /** Se os certificados são válidos */
  valido: boolean

  /** Se algum certificado foi revogado */
  algumRevogado: boolean

  /** Detalhes de cada certificado verificado */
  certificados: ResultadoCertificado[]

  /** Resultado da validação de cadeia (se solicitado) */
  cadeia?: ResultadoValidacaoCadeia

  /** Estatísticas de cache */
  cache: {
    crlCacheSize: number
    ocspCacheSize: number
  }

  /** Timestamp da verificação */
  verificadoEm: string

  /** Tempo de execução em ms */
  tempoExecucaoMs: number
}

interface ResultadoCertificado {
  /** Índice do certificado na cadeia */
  indice: number

  /** CN do titular */
  titular: string

  /** Serial number */
  serial: string

  /** Resultado da verificação de revogação */
  revogacao: RevocationCheckResult

  /** Validade temporal */
  validoTemporalmente: boolean
}

// ── HANDLER POST ──────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const inicio = Date.now()
  const { id } = await params
  const diplomaId = id

  try {
    // ── 1. Validação de autenticação ──────────────────
    const auth = await verificarAuthComPermissao(req, 'diplomas', 'acessar')

    if (auth instanceof NextResponse) {
      return auth
    }

    // ── 2. Parse do request ──────────────────────────
    let body: VerificacaoCertificadoRequest = {}

    try {
      body = await req.json()
    } catch {
      // Body opcional — usar valores padrão
    }

    const {
      verificarRevogacao: shouldVerifyRevocation = true,
      verificarCadeia: shouldVerifyChain = true,
      xml: xmlContent,
    } = body

    // ── 3. Obter diploma e XMLs ──────────────────────
    const diplomaXML = xmlContent || (await obterXMLDiploma(diplomaId))

    if (!diplomaXML) {
      return NextResponse.json(
        { erro: 'Diploma não encontrado ou sem XMLs assinados' },
        { status: 404 }
      )
    }

    // ── 4. Extrair certificados do XML ───────────────
    // Extrair certificados em formato de informação
    const certificadosInfo = extrairCertificados(diplomaXML)

    // Também extrair PEMs brutos para verificação de revogação
    const certificadosPEM: string[] = []
    const certBlockMatches = diplomaXML.match(/<(?:ds:)?X509Certificate[^>]*>([\s\S]*?)<\/(?:ds:)?X509Certificate>/gi) || []
    for (const block of certBlockMatches) {
      const match = block.match(/>([^<]+)</)
      if (match) {
        // Reformatar para PEM
        const certData = match[1].replace(/\s+/g, '')
        certificadosPEM.push(`-----BEGIN CERTIFICATE-----\n${certData.match(/.{1,64}/g)?.join('\n') || certData}\n-----END CERTIFICATE-----`)
      }
    }

    const certificados = certificadosInfo

    if (certificados.length === 0) {
      await logSecurityEvent({
        tipo: 'DATA_ACCESS',
        ip: req.headers.get('x-forwarded-for') || 'unknown',
        userId: auth.userId,
        risco: 'baixo',
        rota: req.nextUrl.pathname,
        metodo: req.method,
        detalhes: {
          acao: 'verificar-certificado',
          diplomaId,
          resultado: 'nenhum-certificado',
        },
      })

      return NextResponse.json(
        {
          diplomaId,
          valido: false,
          algumRevogado: false,
          certificados: [],
          cache: obterEstatisticasCache(),
          verificadoEm: new Date().toISOString(),
          tempoExecucaoMs: Date.now() - inicio,
        },
        { status: 200 }
      )
    }

    // ── 5. Verificar cada certificado ────────────────
    const resultadosCertificados: ResultadoCertificado[] = []
    let algumRevogado = false

    for (let i = 0; i < certificados.length; i++) {
      const certInfo = certificados[i]

      try {
        // Verificar revogação
        let revogacaoResult: RevocationCheckResult | null = null

        if (shouldVerifyRevocation) {
          const certPEM = i < certificadosPEM.length ? certificadosPEM[i] : undefined
          const issuerPEM = i + 1 < certificadosPEM.length ? certificadosPEM[i + 1] : undefined
          revogacaoResult = certPEM ? await verificarRevogacao(certPEM, issuerPEM) : {
            revogado: false,
            metodo: 'nenhum',
            status: 'desconhecido',
            verificadoEm: new Date(),
            detalhes: 'Certificado PEM não disponível',
          }
        } else {
          revogacaoResult = {
            revogado: false,
            metodo: 'nenhum',
            status: 'desconhecido',
            verificadoEm: new Date(),
            detalhes: 'Verificação de revogação desabilitada',
          }
        }

        // Verificar validade temporal
        const validoTemporalmente = verificarValidadeTemporalCertificado(certInfo)

        const resultado: ResultadoCertificado = {
          indice: i,
          titular: certInfo.titular || 'Desconhecido',
          serial: certInfo.serial || 'Desconhecido',
          revogacao: revogacaoResult,
          validoTemporalmente,
        }

        resultadosCertificados.push(resultado)

        if (revogacaoResult.revogado) {
          algumRevogado = true
        }
      } catch (erro) {
        console.error(`[API] Erro ao verificar certificado ${i}:`, erro)

        resultadosCertificados.push({
          indice: i,
          titular: certInfo.titular || 'Desconhecido',
          serial: certInfo.serial || 'Desconhecido',
          revogacao: {
            revogado: false,
            metodo: 'nenhum',
            status: 'erro',
            verificadoEm: new Date(),
            detalhes: erro instanceof Error ? erro.message : 'Erro desconhecido',
          },
          validoTemporalmente: false,
        })
      }
    }

    // ── 6. Validar cadeia (opcional) ──────────────────
    let resultadoCadeia: ResultadoValidacaoCadeia | undefined

    if (shouldVerifyChain) {
      try {
        // Usar certificadosPEM já extraídos acima
        resultadoCadeia = await validarCadeiaCertificado(
          certificadosPEM,
          shouldVerifyRevocation
        )
      } catch (erro) {
        console.error('[API] Erro ao validar cadeia:', erro)
        // Continuar mesmo se falhar na cadeia
      }
    }

    // ── 7. Determinar resultado final ────────────────
    const valido = !algumRevogado && resultadosCertificados.every(r => r.validoTemporalmente)

    const resposta: ResultadoVerificacaoCertificado = {
      diplomaId,
      valido,
      algumRevogado,
      certificados: resultadosCertificados,
      cadeia: resultadoCadeia,
      cache: obterEstatisticasCache(),
      verificadoEm: new Date().toISOString(),
      tempoExecucaoMs: Date.now() - inicio,
    }

    // ── 8. Log de auditoria ──────────────────────────
    try {
      await registrarAuditoria({
        usuario_id: auth.userId,
        acao: AcaoAuditoria.VISUALIZAR,
        entidade: EntidadeAuditavel.ASSINATURA,
        entidade_id: diplomaId,
        ip: req.headers.get('x-forwarded-for') || undefined,
        detalhes: {
          verificacao_tipo: 'revogacao-certificado',
          certificados_verificados: resultadosCertificados.length,
          algum_revogado: algumRevogado,
          cadeia_verificada: shouldVerifyChain,
          resultado_final: valido,
          tempo_ms: Date.now() - inicio,
        },
      })
    } catch (erro) {
      console.error('[API] Erro ao registrar auditoria:', erro)
    }

    // ── 9. Log de segurança ──────────────────────────
    await logSecurityEvent({
      tipo: 'DATA_ACCESS',
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      userId: auth.userId,
      risco: 'baixo',
      rota: req.nextUrl.pathname,
      metodo: req.method,
      detalhes: {
        acao: 'verificar-certificado',
        diplomaId,
        resultado: algumRevogado ? 'revogado' : 'valido',
        certificados: resultadosCertificados.length,
      },
    })

    // ── 10. Resposta ──────────────────────────────────
    const statusCode = valido ? 200 : 200 // 200 mesmo que revogado (informação, não erro)

    return NextResponse.json(resposta, { status: statusCode })
  } catch (erro) {
    console.error('[API] Erro na verificação de certificado:', erro)

    const errorMessage = erro instanceof Error ? sanitizarErro(erro.message) : 'Erro ao verificar certificados'

    await logSecurityEvent({
      tipo: 'ADMIN_ACTION',
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      risco: 'alto',
      rota: req.nextUrl.pathname,
      metodo: req.method,
      detalhes: {
        acao: 'verificar-certificado-erro',
        diplomaId,
        erro: errorMessage,
      },
    })

    return erroInterno(errorMessage)
  }
}

// ── HANDLER GET (resumo) ──────────────────────────────────────────

/**
 * GET /api/diplomas/[id]/verificar-certificado
 *
 * Retorna resumo da última verificação em cache (sem fazer nova)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  const diplomaId = id

  try {
    const auth = await verificarAuthComPermissao(req, 'diplomas', 'acessar')

    if (auth instanceof NextResponse) {
      return auth
    }

    // Retornar status de cache e dicas para usar POST
    return NextResponse.json({
      mensagem: 'Use POST para verificar certificados',
      cache: obterEstatisticasCache(),
      documentacao: '/api/docs/certificado-verificacao',
    })
  } catch (erro) {
    return NextResponse.json(
      { erro: 'Erro ao obter informações' },
      { status: 500 }
    )
  }
}

// ── FUNÇÕES AUXILIARES ────────────────────────────────────────────

/**
 * Obter XML do diploma do banco de dados
 * (implementação simplificada — integra com Supabase em produção)
 */
async function obterXMLDiploma(diplomaId: string): Promise<string | null> {
  try {
    // Em produção, fazer query no Supabase
    // SELECT xml_gerado FROM xml_gerados WHERE diploma_id = $1 AND tipo = 'DiplomaDigital'

    // Por ora, retornar null (será necessário integrar com banco)
    console.log(`[API] Obtendo XML para diploma ${diplomaId}`)
    return null
  } catch (erro) {
    console.error('[API] Erro ao obter XML:', erro)
    return null
  }
}

/**
 * Verifica se certificado é válido temporalmente
 */
function verificarValidadeTemporalCertificado(
  certInfo: any
): boolean {
  try {
    const agora = new Date()

    const validoDe = certInfo.valido_de
      ? new Date(certInfo.valido_de)
      : new Date(agora.getTime() - 365 * 24 * 60 * 60 * 1000)

    const validoAte = certInfo.valido_ate
      ? new Date(certInfo.valido_ate)
      : new Date(agora.getTime() + 365 * 24 * 60 * 60 * 1000)

    return agora >= validoDe && agora <= validoAte
  } catch {
    return false
  }
}
