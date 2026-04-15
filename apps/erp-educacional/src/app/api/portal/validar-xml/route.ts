import { NextRequest, NextResponse } from 'next/server'
import { validarXML, type ResultadoValidacaoXML } from '@/lib/portal/validar-xml'
import { registrarConsulta } from '@/lib/portal/logging'
import { verificarRateLimit, adicionarHeadersRateLimit } from '@/lib/portal/rate-limit'
import { validarTurnstile, extrairIPCliente } from '@/lib/portal/turnstile'

// Limite de tamanho do XML: 10 MB
const MAX_XML_SIZE = 10 * 1024 * 1024

// POST /api/portal/validar-xml
// Endpoint público — não requer autenticação
// Body: FormData com campo "arquivo" (XML) e "turnstile_token"
export async function POST(request: NextRequest) {
  const inicio = Date.now()

  try {
    // ── Rate Limiting ──────────────────────────────────────
    const rateLimit = await verificarRateLimit(request, 'validar_xml')
    if (!rateLimit.allowed) {
      await registrarConsulta(request, {
        tipo: 'validar_xml',
        resultado: 'bloqueado_rate_limit',
        rate_limited: true,
      }, inicio)

      const headers = new Headers({
        'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)),
      })
      adicionarHeadersRateLimit(headers, rateLimit)

      return NextResponse.json(
        { erro: 'Muitas tentativas. Aguarde um momento e tente novamente.' },
        { status: 429, headers }
      )
    }

    // ── Parsear FormData ───────────────────────────────────
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      await registrarConsulta(request, {
        tipo: 'validar_xml',
        resultado: 'erro_validacao',
        erro_detalhe: 'FormData inválido',
      }, inicio)

      return NextResponse.json(
        { erro: 'Envie o arquivo XML via FormData com o campo "arquivo".' },
        { status: 400 }
      )
    }

    // ── Validar Turnstile ──────────────────────────────────
    const turnstileToken = formData.get('turnstile_token') as string | null
    const clientIp = extrairIPCliente(request)
    const captchaValido = await validarTurnstile(turnstileToken, clientIp)

    if (!captchaValido) {
      await registrarConsulta(request, {
        tipo: 'validar_xml',
        resultado: 'bloqueado_captcha',
        turnstile_validado: false,
      }, inicio)

      return NextResponse.json(
        { erro: 'Verificação de segurança falhou. Recarregue a página e tente novamente.' },
        { status: 403 }
      )
    }

    // ── Extrair arquivo ────────────────────────────────────
    const arquivo = formData.get('arquivo')

    if (!arquivo || !(arquivo instanceof File)) {
      await registrarConsulta(request, {
        tipo: 'validar_xml',
        resultado: 'erro_validacao',
        turnstile_validado: true,
        erro_detalhe: 'Arquivo não enviado',
      }, inicio)

      return NextResponse.json(
        { erro: 'Campo "arquivo" é obrigatório. Envie um arquivo XML.' },
        { status: 400 }
      )
    }

    // ── Validar tipo e tamanho ─────────────────────────────
    const nomeArquivo = arquivo.name.toLowerCase()
    if (!nomeArquivo.endsWith('.xml')) {
      await registrarConsulta(request, {
        tipo: 'validar_xml',
        resultado: 'erro_validacao',
        turnstile_validado: true,
        erro_detalhe: `Extensão inválida: ${nomeArquivo}`,
      }, inicio)

      return NextResponse.json(
        { erro: 'Apenas arquivos .xml são aceitos.' },
        { status: 400 }
      )
    }

    if (arquivo.size > MAX_XML_SIZE) {
      await registrarConsulta(request, {
        tipo: 'validar_xml',
        resultado: 'erro_validacao',
        turnstile_validado: true,
        erro_detalhe: `Arquivo muito grande: ${(arquivo.size / 1024 / 1024).toFixed(1)}MB`,
      }, inicio)

      return NextResponse.json(
        { erro: `Arquivo muito grande (${(arquivo.size / 1024 / 1024).toFixed(1)}MB). Limite: 10MB.` },
        { status: 400 }
      )
    }

    if (arquivo.size === 0) {
      await registrarConsulta(request, {
        tipo: 'validar_xml',
        resultado: 'erro_validacao',
        turnstile_validado: true,
        erro_detalhe: 'Arquivo vazio',
      }, inicio)

      return NextResponse.json(
        { erro: 'Arquivo XML está vazio.' },
        { status: 400 }
      )
    }

    // ── Ler conteúdo do XML ────────────────────────────────
    const xmlContent = await arquivo.text()

    // Verificação básica de que é XML
    const trimmed = xmlContent.trim()
    if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<')) {
      await registrarConsulta(request, {
        tipo: 'validar_xml',
        resultado: 'erro_validacao',
        turnstile_validado: true,
        erro_detalhe: 'Conteúdo não é XML',
      }, inicio)

      return NextResponse.json(
        { erro: 'O arquivo não parece ser um XML válido.' },
        { status: 400 }
      )
    }

    // ── Executar validação ──────────────────────────────────
    const resultado: ResultadoValidacaoXML = validarXML(xmlContent)

    // ── Registrar log ──────────────────────────────────────
    await registrarConsulta(request, {
      tipo: 'validar_xml',
      resultado: resultado.valido ? 'encontrado' : 'nao_encontrado',
      turnstile_validado: true,
      total_resultados: resultado.valido ? 1 : 0,
      erro_detalhe: resultado.valido ? null : `${resultado.total_erros} erros`,
    }, inicio)

    // ── Retornar resultado ─────────────────────────────────
    const headers = new Headers({
      'Cache-Control': 'no-cache, no-store',
    })
    adicionarHeadersRateLimit(headers, rateLimit)

    return NextResponse.json(resultado, { headers })
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : 'Erro interno'
    console.error('[API] Erro em /api/portal/validar-xml:', mensagem)

    await registrarConsulta(request, {
      tipo: 'validar_xml',
      resultado: 'erro_interno',
      erro_detalhe: mensagem,
    }, inicio).catch(() => {})

    return NextResponse.json(
      { erro: 'Erro ao processar o XML. Tente novamente mais tarde.' },
      { status: 500 }
    )
  }
}
