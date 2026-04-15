import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { verificarAuth, erroNaoEncontrado, erroInterno } from '@/lib/security/api-guard'
import { validarCSRF } from '@/lib/security/csrf'
import { sanitizarErro } from '@/lib/security/sanitize-error'
import { logDataModification } from '@/lib/security/security-logger'
import { registrarCustodiaAsync } from '@/lib/security/cadeia-custodia'

// Admin client (bypass RLS)
function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Statuses válidos para publicar
const STATUS_PUBLICAVEIS = [
  'assinado',
  'aguardando_registro',
  'registrado',
  'rvdd_gerado',
]

// POST /api/diplomas/[id]/publicar
// Publica um diploma: muda status → 'publicado' e define data_publicacao.
// Deve ser chamado após assinatura concluída (e idealmente após RVDD gerada).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(request)
  if (auth instanceof NextResponse) return auth

  // CSRF validation for POST requests
  const csrfError = validarCSRF(request)
  if (csrfError) return csrfError

  const { id: diplomaId } = await params
  const admin = getAdmin()

  // ── 1. Buscar diploma para validar estado ────────────────────────────────
  const { data: diploma, error: errBusca } = await admin
    .from('diplomas')
    .select(`
      id,
      status,
      diplomado_id,
      curso_id,
      codigo_validacao,
      url_verificacao,
      diplomados ( nome, cpf ),
      cursos ( nome, grau )
    `)
    .eq('id', diplomaId)
    .single()

  if (errBusca || !diploma) {
    return erroNaoEncontrado()
  }

  if (diploma.status === 'publicado') {
    return NextResponse.json({ error: 'Diploma já está publicado.' }, { status: 400 })
  }

  if (!STATUS_PUBLICAVEIS.includes(diploma.status)) {
    return NextResponse.json(
      {
        error: `Diploma não pode ser publicado no status "${diploma.status}". ` +
               `Status permitidos: ${STATUS_PUBLICAVEIS.join(', ')}.`,
      },
      { status: 400 }
    )
  }

  // ── 2. Gerar código de validação se ausente ──────────────────────────────
  let codigoValidacao = diploma.codigo_validacao as string | null
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://diploma.ficcassilandia.com.br'

  if (!codigoValidacao) {
    // Formato: FIC-{ano}-{8 chars aleatórios em uppercase hex}
    const ano = new Date().getFullYear()
    const rand = Math.random().toString(16).slice(2, 10).toUpperCase()
    codigoValidacao = `FIC-${ano}-${rand}`
  }

  const urlVerificacao = (diploma.url_verificacao as string | null)
    ?? `${baseUrl}/verificar/${codigoValidacao}`

  // ── 3. Atualizar diploma para publicado ──────────────────────────────────
  const agora = new Date().toISOString()

  const { error: errUpdate } = await admin
    .from('diplomas')
    .update({
      status: 'publicado',
      codigo_validacao: codigoValidacao,
      url_verificacao: urlVerificacao,
      data_publicacao: agora,
      updated_at: agora,
    })
    .eq('id', diplomaId)

  if (errUpdate) {
    console.error('[API] Erro ao publicar diploma:', errUpdate.message)
    return erroInterno()
  }

  // Log diploma publishing action (non-blocking)
  void logDataModification(request, auth.userId, 'diplomas', 'update', 1, {
    acao: 'publicacao',
    codigo_validacao: codigoValidacao,
    url_verificacao: urlVerificacao,
  })

  // Registrar na cadeia de custódia (non-blocking)
  void registrarCustodiaAsync({
    diplomaId,
    etapa: 'publicado',
    status: 'sucesso',
    request,
    userId: auth.userId,
    detalhes: {
      codigo_validacao: codigoValidacao,
      url_verificacao: urlVerificacao,
      data_publicacao: agora,
    },
  })

  return NextResponse.json({
    ok: true,
    mensagem: 'Diploma publicado com sucesso.',
    diploma_id: diplomaId,
    codigo_validacao: codigoValidacao,
    url_verificacao: urlVerificacao,
  })
}
