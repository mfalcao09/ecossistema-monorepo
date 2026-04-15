import { NextRequest, NextResponse } from 'next/server'

// Vercel Cron handler - runs weekly on Sunday at 3AM UTC
// Checks if encryption keys need rotation
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ erro: 'Configuração ausente' }, { status: 500 })
    }

    // Check key age from metadata table
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: keys } = await supabase
      .from('key_rotation_metadata')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    const now = new Date()
    const maxAgeDays = 90 // rotate every 90 days
    const keysNeedingRotation = (keys || []).filter(key => {
      const age = (now.getTime() - new Date(key.created_at).getTime()) / (1000 * 60 * 60 * 24)
      return age > maxAgeDays
    })

    if (keysNeedingRotation.length === 0) {
      return NextResponse.json({
        sucesso: true,
        mensagem: 'Nenhuma chave precisa de rotação',
        proxima_verificacao: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
    }

    // Log warning - actual rotation requires manual approval for safety
    console.warn(
      `[Key Rotation] ${keysNeedingRotation.length} chave(s) precisam de rotação:`,
      keysNeedingRotation.map(k => ({
        id: k.id,
        age_days: Math.floor((now.getTime() - new Date(k.created_at).getTime()) / (1000 * 60 * 60 * 24)),
      }))
    )

    // Insert alert into security_events
    await supabase.from('security_events').insert({
      event_type: 'key_rotation_needed',
      severity: 'warning',
      details: JSON.stringify({
        keys_needing_rotation: keysNeedingRotation.length,
        key_ids: keysNeedingRotation.map(k => k.id),
      }),
      created_at: now.toISOString(),
    })

    return NextResponse.json({
      sucesso: true,
      alerta: `${keysNeedingRotation.length} chave(s) precisam de rotação`,
      chaves: keysNeedingRotation.map(k => ({ id: k.id, criado_em: k.created_at })),
    })
  } catch (error) {
    console.error('[Key Rotation] Error:', error)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
