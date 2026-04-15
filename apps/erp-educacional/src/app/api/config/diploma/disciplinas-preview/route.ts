import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { protegerRota, erroInterno } from '@/lib/security/api-guard'

// GET /api/config/diploma/disciplinas-preview
// Query real discipline data from Supabase for live preview
export const GET = protegerRota(async (request: NextRequest) => {
  try {
    const supabase = await createClient()

    // Query real discipline data, ordered by period and order
    const { data, error } = await supabase
      .from('diploma_disciplinas')
      .select(`
        codigo,
        nome,
        periodo,
        carga_horaria_aula,
        carga_horaria_relogio,
        nota,
        nota_ate_cem,
        conceito,
        conceito_rm,
        conceito_especifico,
        situacao,
        forma_integralizacao,
        etiqueta,
        docente_nome,
        docente_titulacao
      `)
      .order('periodo', { ascending: true })
      .order('ordem', { ascending: true })
      .limit(15)

    if (error) {
      console.error('[API] Erro ao buscar disciplinas:', error.message)
      return erroInterno()
    }

    // If no data found, return empty array (frontend will use sample data as fallback)
    return NextResponse.json({
      disciplinas: data || [],
      total: data?.length || 0,
      origem: 'banco_dados',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[API] Erro ao obter preview de disciplinas:', error)
    return erroInterno()
  }
}, { skipCSRF: true })
