import { NextRequest, NextResponse } from 'next/server'
import { verificarDocumento } from '@/lib/documentos/engine'
import { validarCodigoVerificacao } from '@/lib/portal/validacoes'
import { registrarConsulta } from '@/lib/portal/logging'
import { verificarRateLimit, adicionarHeadersRateLimit } from '@/lib/portal/rate-limit'
import type { VerificacaoPublica } from '@/types/documentos-digitais'

// GET /api/portal/validar-codigo?codigo=0000.0000.00000000
// Endpoint público — não requer autenticação
// Valida código de verificação e retorna dados públicos do documento
export async function GET(request: NextRequest) {
  const inicio = Date.now()

  try {
    // ── Rate Limiting ──────────────────────────────────────
    const rateLimit = await verificarRateLimit(request, 'validar_codigo')
    if (!rateLimit.allowed) {
      await registrarConsulta(request, {
        tipo: 'validar_codigo',
        resultado: 'bloqueado_rate_limit',
        rate_limited: true,
      }, inicio)

      const headers = new Headers({
        'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)),
      })
      adicionarHeadersRateLimit(headers, rateLimit)

      return NextResponse.json(
        {
          valido: false,
          erro: 'Muitas tentativas. Aguarde um momento e tente novamente.',
        } as VerificacaoPublica,
        { status: 429, headers }
      )
    }

    // ── Extrair parâmetro ──────────────────────────────────
    const codigo = request.nextUrl.searchParams.get('codigo')

    if (!codigo) {
      await registrarConsulta(request, {
        tipo: 'validar_codigo',
        resultado: 'erro_validacao',
        erro_detalhe: 'Código ausente',
      }, inicio)

      return NextResponse.json(
        {
          valido: false,
          erro: 'Parâmetro "codigo" é obrigatório.',
        } as VerificacaoPublica,
        { status: 400 }
      )
    }

    // ── Validar formato ────────────────────────────────────
    if (!validarCodigoVerificacao(codigo)) {
      await registrarConsulta(request, {
        tipo: 'validar_codigo',
        resultado: 'erro_validacao',
        codigo_verificacao: codigo,
        erro_detalhe: 'Formato inválido',
      }, inicio)

      return NextResponse.json(
        {
          valido: false,
          erro: 'Código de verificação em formato inválido. Use: 0000.0000.00000000',
        } as VerificacaoPublica,
        { status: 400 }
      )
    }

    // ── Buscar documento ───────────────────────────────────
    // Preservar código original (pode ser alfanumérico no formato legado)
    const codigoLimpo = codigo.trim()
    const resultado = await verificarDocumento(codigoLimpo)

    // ── Registrar log ──────────────────────────────────────
    await registrarConsulta(request, {
      tipo: 'validar_codigo',
      resultado: resultado.valido ? 'encontrado' : 'nao_encontrado',
      codigo_verificacao: codigo,
      documento_id: resultado.valido ? (resultado as any).documento?.id : null,
      total_resultados: resultado.valido ? 1 : 0,
    }, inicio)

    // ── Retornar resultado ─────────────────────────────────
    const headers = new Headers({
      'Cache-Control': resultado.valido
        ? 'public, max-age=300, stale-while-revalidate=60'
        : 'no-cache',
    })
    adicionarHeadersRateLimit(headers, rateLimit)

    return NextResponse.json(resultado, {
      status: resultado.valido ? 200 : 404,
      headers,
    })
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : 'Erro interno do servidor'
    console.error('[API] Erro em /api/portal/validar-codigo:', mensagem)

    await registrarConsulta(request, {
      tipo: 'validar_codigo',
      resultado: 'erro_interno',
      erro_detalhe: mensagem,
    }, inicio).catch(() => {})

    return NextResponse.json(
      {
        valido: false,
        erro: 'Erro ao processar solicitação. Tente novamente mais tarde.',
      } as VerificacaoPublica,
      { status: 500 }
    )
  }
}
