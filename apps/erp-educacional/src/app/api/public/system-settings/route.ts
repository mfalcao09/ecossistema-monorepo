import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// ── Rota PÚBLICA — não exige autenticação ──────────────────────────────────
// Retorna apenas dados visuais (logo, banner, cor, nome).
// Campos sensíveis (API keys, etc.) NUNCA são expostos aqui.

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Campos seguros para exposição pública (sem chaves, sem dados internos)
const CAMPOS_PUBLICOS = [
  'instituicao_nome',
  'cor_principal',
  'logo_url',
  'logo_dark_url',
  'banner_login_url',
  'tema',
] as const

export async function GET() {
  try {
    const admin = getAdminClient()

    const { data, error } = await admin
      .from('system_settings')
      .select(CAMPOS_PUBLICOS.join(','))
      .eq('id', 1)
      .single()

    if (error) {
      // Se não existe, retorna defaults
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          instituicao_nome: 'FIC - Faculdades Integradas de Cassilândia',
          cor_principal: '#4F46E5',
          logo_url: null,
          logo_dark_url: null,
          banner_login_url: null,
          tema: 'claro',
        })
      }
      return NextResponse.json({ erro: 'Erro ao carregar configurações' }, { status: 500 })
    }

    return NextResponse.json(data, {
      headers: {
        // Cache por 5 minutos — evita consultas repetidas ao banco
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch {
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
