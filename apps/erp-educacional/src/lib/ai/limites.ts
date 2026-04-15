/**
 * Controle de limites de uso de IA por tenant
 * Lê configuração de parametros_sistema e controla chamadas mensais
 */

import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

interface LimiteIA {
  permitido: boolean
  usadoMes: number
  limiteMes: number
  mensagem?: string
}

/**
 * Verifica se o tenant ainda pode fazer chamadas IA este mês
 * Lê o limite de parametros_sistema (chave: max_ia_calls_per_month)
 * Conta chamadas no mês atual na tabela ia_usage_log
 */
export async function verificarLimiteIA(tenantId?: string): Promise<LimiteIA> {
  // Se não tem tenant, permite (modo dev)
  if (!tenantId) {
    return { permitido: true, usadoMes: 0, limiteMes: 999999 }
  }

  const admin = getAdminClient()

  // Busca limite configurado para o tenant
  const { data: paramData } = await admin
    .from('parametros_sistema')
    .select('valor')
    .eq('chave', 'max_ia_calls_per_month')
    .eq('tenant_id', tenantId)
    .single()

  const limiteMes = paramData?.valor ? parseInt(paramData.valor, 10) : 5000 // default: 5000 chamadas/mês

  // Conta uso no mês atual
  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)

  const { count } = await admin
    .from('ia_usage_log')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', inicioMes.toISOString())

  const usadoMes = count ?? 0

  if (usadoMes >= limiteMes) {
    return {
      permitido: false,
      usadoMes,
      limiteMes,
      mensagem: `Limite mensal de ${limiteMes} chamadas IA atingido. Contate o administrador.`,
    }
  }

  return { permitido: true, usadoMes, limiteMes }
}

/**
 * Registra uma chamada IA no log de uso
 */
export async function registrarUsoIA(params: {
  tenantId?: string
  modulo: string
  funcionalidade?: string
  modelo: string
  tokensUsados?: number
  userId?: string
}): Promise<void> {
  if (!params.tenantId) return // modo dev

  try {
    const admin = getAdminClient()
    await admin.from('ia_usage_log').insert({
      tenant_id: params.tenantId,
      modulo: params.modulo,
      funcionalidade: params.funcionalidade,
      modelo: params.modelo,
      tokens_usados: params.tokensUsados ?? 0,
      user_id: params.userId,
    })
  } catch (err) {
    console.warn('Falha ao registrar uso IA:', err)
    // Não bloqueia a operação principal
  }
}
