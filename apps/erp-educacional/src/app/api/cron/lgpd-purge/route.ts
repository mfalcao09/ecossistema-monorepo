import { NextRequest, NextResponse } from 'next/server'

// Vercel Cron handler - runs daily at 2AM UTC
// Secured via CRON_SECRET env var
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    // Call Supabase Edge Function lgpd-purge
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      console.error('[LGPD Cron] Missing Supabase config')
      return NextResponse.json({ erro: 'Configuração ausente' }, { status: 500 })
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/lgpd-purge`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tipo: 'scheduled', batch_size: 50 }),
    })

    const data = await response.json()

    console.log('[LGPD Cron] Purge completed:', JSON.stringify(data))

    return NextResponse.json({
      sucesso: true,
      resultado: data,
      executado_em: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[LGPD Cron] Error:', error)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
