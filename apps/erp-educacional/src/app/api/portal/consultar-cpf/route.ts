import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { validarCPF, limparCPF, mascararCPF, validarDataNascimento } from '@/lib/portal/validacoes'
import { registrarConsulta } from '@/lib/portal/logging'
import { verificarRateLimit, adicionarHeadersRateLimit } from '@/lib/portal/rate-limit'
import { validarTurnstile, extrairIPCliente } from '@/lib/portal/turnstile'
import type { TipoDocDigital } from '@/types/documentos-digitais'

// Interface para resposta simplificada de diplomas
interface DiplomaSimplificado {
  id: string
  tipo: TipoDocDigital
  titulo: string
  numero_documento: string | null
  assinado_em: string | null
  publicado_em: string | null
  ies_nome: string | null
  codigo_verificacao: string
  url_verificacao: string | null
}

interface ConsultaCPFResponse {
  encontrados: boolean
  total: number
  nota: string
  diplomas: DiplomaSimplificado[]
  cpf_mascarado?: string
  erro?: string
}

// Cliente admin (bypass RLS — endpoint público sem usuário autenticado)
// cache: 'no-store' evita que Next.js Data Cache sirva dados obsoletos
function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        fetch: (url: RequestInfo | URL, init?: RequestInit) =>
          fetch(url, { ...init, cache: 'no-store' }),
      },
    }
  )
}

// Normaliza data_nascimento para YYYY-MM-DD (aceita DD/MM/YYYY ou YYYY-MM-DD)
function normalizarData(data: string): string {
  if (data.includes('/')) {
    const partes = data.split('/')
    if (partes.length === 3) {
      const [d, m, y] = partes
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
  }
  return data
}

// POST /api/portal/consultar-cpf
// Endpoint público — não requer autenticação
// Body: { cpf: string, data_nascimento: string, turnstile_token?: string }
// Retorna lista de diplomas publicados do titular do CPF
export async function POST(request: NextRequest) {
  const inicio = Date.now()

  try {
    // ── Rate Limiting ──────────────────────────────────────
    const rateLimit = await verificarRateLimit(request, 'consultar_cpf')
    if (!rateLimit.allowed) {
      await registrarConsulta(request, {
        tipo: 'consultar_cpf',
        resultado: 'bloqueado_rate_limit',
        rate_limited: true,
      }, inicio)

      const headers = new Headers({
        'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)),
      })
      adicionarHeadersRateLimit(headers, rateLimit)

      return NextResponse.json(
        {
          encontrados: false,
          total: 0,
          nota: 'Diplomas registrados a partir de 2019',
          diplomas: [],
          erro: 'Muitas tentativas. Aguarde um momento e tente novamente.',
        } as ConsultaCPFResponse,
        { status: 429, headers }
      )
    }

    // ── Validar Content-Type ───────────────────────────────
    const contentType = request.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      await registrarConsulta(request, {
        tipo: 'consultar_cpf',
        resultado: 'erro_validacao',
        erro_detalhe: 'Content-Type inválido',
      }, inicio)

      return NextResponse.json(
        {
          encontrados: false,
          total: 0,
          nota: 'Diplomas registrados a partir de 2019',
          diplomas: [],
          erro: 'Content-Type deve ser application/json',
        } as ConsultaCPFResponse,
        { status: 400 }
      )
    }

    // ── Parsear body ───────────────────────────────────────
    let body: { cpf?: string; data_nascimento?: string; turnstile_token?: string }
    try {
      body = await request.json()
    } catch {
      await registrarConsulta(request, {
        tipo: 'consultar_cpf',
        resultado: 'erro_validacao',
        erro_detalhe: 'JSON inválido',
      }, inicio)

      return NextResponse.json(
        {
          encontrados: false,
          total: 0,
          nota: 'Diplomas registrados a partir de 2019',
          diplomas: [],
          erro: 'JSON inválido no corpo da requisição',
        } as ConsultaCPFResponse,
        { status: 400 }
      )
    }

    const { cpf, data_nascimento, turnstile_token } = body

    // ── Validar Turnstile (CAPTCHA) ────────────────────────
    const clientIp = extrairIPCliente(request)
    const captchaValido = await validarTurnstile(turnstile_token, clientIp)
    if (!captchaValido) {
      await registrarConsulta(request, {
        tipo: 'consultar_cpf',
        resultado: 'bloqueado_captcha',
        turnstile_validado: false,
      }, inicio)

      return NextResponse.json(
        {
          encontrados: false,
          total: 0,
          nota: 'Diplomas registrados a partir de 2019',
          diplomas: [],
          erro: 'Verificação de segurança falhou. Recarregue a página e tente novamente.',
        } as ConsultaCPFResponse,
        { status: 403 }
      )
    }

    // ── Validar campos obrigatórios ────────────────────────
    if (!cpf) {
      await registrarConsulta(request, {
        tipo: 'consultar_cpf',
        resultado: 'erro_validacao',
        turnstile_validado: true,
        erro_detalhe: 'CPF ausente',
      }, inicio)

      return NextResponse.json(
        {
          encontrados: false,
          total: 0,
          nota: 'Diplomas registrados a partir de 2019',
          diplomas: [],
          erro: 'Campo "cpf" é obrigatório',
        } as ConsultaCPFResponse,
        { status: 400 }
      )
    }

    if (!data_nascimento) {
      await registrarConsulta(request, {
        tipo: 'consultar_cpf',
        resultado: 'erro_validacao',
        turnstile_validado: true,
        erro_detalhe: 'Data de nascimento ausente',
      }, inicio)

      return NextResponse.json(
        {
          encontrados: false,
          total: 0,
          nota: 'Diplomas registrados a partir de 2019',
          diplomas: [],
          erro: 'Campo "data_nascimento" é obrigatório',
        } as ConsultaCPFResponse,
        { status: 400 }
      )
    }

    // ── Validar formato do CPF ─────────────────────────────
    if (!validarCPF(cpf)) {
      await registrarConsulta(request, {
        tipo: 'consultar_cpf',
        resultado: 'erro_validacao',
        turnstile_validado: true,
        erro_detalhe: 'CPF inválido',
      }, inicio)

      return NextResponse.json(
        {
          encontrados: false,
          total: 0,
          nota: 'Diplomas registrados a partir de 2019',
          cpf_mascarado: mascararCPF(cpf),
          diplomas: [],
          erro: 'CPF em formato inválido',
        } as ConsultaCPFResponse,
        { status: 400 }
      )
    }

    // ── Validar data de nascimento ─────────────────────────
    if (!validarDataNascimento(data_nascimento)) {
      await registrarConsulta(request, {
        tipo: 'consultar_cpf',
        resultado: 'erro_validacao',
        cpf: limparCPF(cpf),
        turnstile_validado: true,
        erro_detalhe: 'Data de nascimento inválida',
      }, inicio)

      return NextResponse.json(
        {
          encontrados: false,
          total: 0,
          nota: 'Diplomas registrados a partir de 2019',
          cpf_mascarado: mascararCPF(cpf),
          diplomas: [],
          erro: 'Data de nascimento em formato inválido ou inválida (use YYYY-MM-DD ou DD/MM/YYYY)',
        } as ConsultaCPFResponse,
        { status: 400 }
      )
    }

    // ── Limpar e normalizar dados de entrada ───────────────
    const cpfLimpo = limparCPF(cpf)
    const dataNascimentoISO = normalizarData(data_nascimento)
    const admin = getAdminClient()

    // ── Step 1: Localizar diplomado por CPF + data_nascimento ──
    // Dois fatores de verificação: o diplomado precisa ter AMBOS corretos
    // Tenta busca por cpf_hash (seguro), com fallback para plaintext
    let diplomados: { id: string; nome: string }[] | null = null
    let errDiplomados: { message: string } | null = null
    try {
      const { hashCPF } = await import('@/lib/security/pii-encryption')
      const cpfHash = await hashCPF(cpfLimpo)
      const result = await admin
        .from('diplomados')
        .select('id, nome')
        .eq('cpf_hash', cpfHash)
        .eq('data_nascimento', dataNascimentoISO)
      diplomados = result.data
      errDiplomados = result.error
    } catch {
      // Fallback: RPCs PII não disponíveis ainda
      const result = await admin
        .from('diplomados')
        .select('id, nome')
        .eq('cpf', cpfLimpo)
        .eq('data_nascimento', dataNascimentoISO)
      diplomados = result.data
      errDiplomados = result.error
    }

    if (errDiplomados) {
      console.error('[API] Erro ao buscar diplomado:', errDiplomados.message)
      throw errDiplomados
    }

    // Nenhum diplomado encontrado com esses dados — retorna vazio
    // (não revela se CPF existe sem data_nascimento correta — segurança)
    if (!diplomados || diplomados.length === 0) {
      await registrarConsulta(request, {
        tipo: 'consultar_cpf',
        resultado: 'nao_encontrado',
        cpf: cpfLimpo,
        total_resultados: 0,
        turnstile_validado: true,
      }, inicio)

      const headers = new Headers({
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      })
      adicionarHeadersRateLimit(headers, rateLimit)

      return NextResponse.json(
        {
          encontrados: false,
          total: 0,
          nota: 'Diplomas registrados a partir de 2019',
          diplomas: [],
          cpf_mascarado: mascararCPF(cpf),
        } as ConsultaCPFResponse,
        { headers }
      )
    }

    const diplomadoIds = diplomados.map((d: { id: string }) => d.id)

    // ── Step 2: Buscar diplomas publicados desses diplomados ───
    const { data: rawDiplomas, error: errDiplomas } = await admin
      .from('diplomas')
      .select(`
        id,
        titulo_conferido,
        codigo_validacao,
        url_verificacao,
        numero_registro,
        data_expedicao,
        data_publicacao,
        ambiente,
        curso:cursos(nome, grau)
      `)
      .in('diplomado_id', diplomadoIds)
      .eq('status', 'publicado')
      .order('data_publicacao', { ascending: false })

    if (errDiplomas) {
      console.error('[API] Erro ao buscar diplomas:', errDiplomas.message)
      throw errDiplomas
    }

    // ── Step 3: Buscar nome da IES para cada ambiente encontrado ──
    const ambientes = Array.from(new Set((rawDiplomas ?? []).map((d: any) => d.ambiente as string)))
    const iesNomePorAmbiente: Record<string, string> = {}

    for (const amb of ambientes) {
      const { data: cfg } = await admin
        .from('diploma_config')
        .select('ies_nome')
        .eq('ambiente', amb)
        .single()
      if (cfg) {
        iesNomePorAmbiente[amb] = (cfg as any).ies_nome ?? 'Faculdades Integradas de Cassilândia'
      }
    }

    // ── Processar resultados ───────────────────────────────
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://diploma.ficcassilandia.com.br'

    const diplomas: DiplomaSimplificado[] = (rawDiplomas ?? []).map((d: any) => {
      const codigoVal = (d.codigo_validacao as string | null) ?? `FIC-${(d.id as string).slice(0, 8).toUpperCase()}`
      const urlVerif = (d.url_verificacao as string | null) ?? `${baseUrl}/verificar/${codigoVal}`
      const cursoNome = (d.curso?.nome as string | null) ?? (d.titulo_conferido as string | null) ?? 'Diploma'
      const iesNome = iesNomePorAmbiente[d.ambiente as string] ?? 'Faculdades Integradas de Cassilândia'

      return {
        id: d.id as string,
        tipo: 'diploma' as TipoDocDigital,
        titulo: cursoNome,
        numero_documento: (d.numero_registro as string | null) ?? null,
        assinado_em: (d.data_expedicao as string | null) ?? null,
        publicado_em: (d.data_publicacao as string | null) ?? null,
        ies_nome: iesNome,
        codigo_verificacao: codigoVal,
        url_verificacao: urlVerif,
      }
    })

    // ── Registrar log ──────────────────────────────────────
    await registrarConsulta(request, {
      tipo: 'consultar_cpf',
      resultado: diplomas.length > 0 ? 'encontrado' : 'nao_encontrado',
      cpf: cpfLimpo,
      total_resultados: diplomas.length,
      turnstile_validado: true,
    }, inicio)

    // ── Montar e retornar resposta ─────────────────────────
    const resposta: ConsultaCPFResponse = {
      encontrados: diplomas.length > 0,
      total: diplomas.length,
      nota: 'Diplomas registrados a partir de 2019',
      diplomas,
      cpf_mascarado: mascararCPF(cpf),
    }

    const headers = new Headers({
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    })
    adicionarHeadersRateLimit(headers, rateLimit)

    return NextResponse.json(resposta, { headers })
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : 'Erro interno'
    console.error('[API] Erro em /api/portal/consultar-cpf:', mensagem)

    await registrarConsulta(request, {
      tipo: 'consultar_cpf',
      resultado: 'erro_interno',
      erro_detalhe: mensagem,
    }, inicio).catch(() => {}) // Nunca falhar por causa do log

    return NextResponse.json(
      {
        encontrados: false,
        total: 0,
        nota: 'Diplomas registrados a partir de 2019',
        diplomas: [],
        erro: 'Erro ao processar solicitação. Tente novamente mais tarde.',
      } as ConsultaCPFResponse,
      { status: 500 }
    )
  }
}
