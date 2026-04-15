import { NextRequest, NextResponse } from 'next/server'

/**
 * Vercel Cron Job - Daily Encrypted Database Backup
 * Schedule: Daily at 3AM UTC (configured in vercel.json)
 *
 * Triggers the Supabase Edge Function to create an encrypted backup
 * of critical database tables and store it in cloud storage.
 *
 * Requires:
 * - CRON_SECRET: Authorization token for cron jobs
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for database access
 * - BACKUP_ENCRYPTION_KEY: Encryption key for backup data
 */
export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized invocation
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[Backup Cron] Unauthorized access attempt')
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      console.error('[Backup Cron] Missing Supabase configuration')
      return NextResponse.json({ erro: 'Configuração ausente' }, { status: 500 })
    }

    // Determine backup type based on day of week
    const now = new Date()
    const dayOfWeek = now.getUTCDay()
    const dayOfMonth = now.getUTCDate()

    let tipoBackup: 'diario' | 'semanal' | 'mensal' = 'diario'

    // Weekly backup on Sunday
    if (dayOfWeek === 0) {
      tipoBackup = 'semanal'
    }

    // Monthly backup on first day of month
    if (dayOfMonth === 1) {
      tipoBackup = 'mensal'
    }

    console.log(`[Backup Cron] Starting ${tipoBackup} backup at ${now.toISOString()}`)

    // Call Supabase Edge Function
    const response = await fetch(`${supabaseUrl}/functions/v1/backup-criptografado`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tipo: tipoBackup,
        armazenamento: 'supabase_storage',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Backup Cron] Edge function error: ${response.status}`, errorText)
      return NextResponse.json(
        { erro: 'Falha ao executar backup' },
        { status: response.status }
      )
    }

    const data = await response.json()

    console.log('[Backup Cron] Backup completed successfully:', {
      tipo: data.tipo,
      tamanho_bytes: data.tamanho_bytes,
      tamanho_criptografado_bytes: data.tamanho_criptografado_bytes,
      caminho_arquivo: data.caminho_arquivo,
    })

    return NextResponse.json({
      sucesso: true,
      resultado: {
        id: data.id,
        tipo: data.tipo,
        tabelas_incluidas: data.tabelas_incluidas.length,
        tamanho_bytes: data.tamanho_bytes,
        tamanho_criptografado_bytes: data.tamanho_criptografado_bytes,
        algoritmo_criptografia: data.algoritmo_criptografia,
        versao_chave: data.versao_chave,
        armazenamento: data.armazenamento,
        caminho_arquivo: data.caminho_arquivo,
        hash_sha256: data.hash_sha256,
      },
      executado_em: now.toISOString(),
    })
  } catch (error) {
    console.error('[Backup Cron] Unexpected error:', error)

    return NextResponse.json(
      {
        sucesso: false,
        erro: 'Erro interno do servidor',
        mensagem: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST endpoint to trigger backup manually (for testing)
 * Requires same authorization as GET
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json() as { tipo?: string }
    const tipoBackup = body.tipo || 'manual'

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ erro: 'Configuração ausente' }, { status: 500 })
    }

    console.log(`[Backup Manual] Triggering ${tipoBackup} backup`)

    const response = await fetch(`${supabaseUrl}/functions/v1/backup-criptografado`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tipo: tipoBackup,
        armazenamento: 'supabase_storage',
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json({
      sucesso: true,
      resultado: data,
      executado_em: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Backup Manual] Error:', error)

    return NextResponse.json(
      {
        sucesso: false,
        erro: 'Erro ao executar backup',
        mensagem: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
