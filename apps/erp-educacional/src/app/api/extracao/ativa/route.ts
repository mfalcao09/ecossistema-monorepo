/**
 * Sprint 2 / Recovery — GET /api/extracao/ativa
 *
 * Retorna a sessão de extração MAIS RECENTE do usuário que ainda está em
 * estado "ativo" — ou seja, algo que ele pode/deve retomar. Usada pelo
 * BannerSessaoAtiva no layout (erp) pra oferecer retomada automática em
 * qualquer tela do ERP.
 *
 * Ordem de prioridade:
 *   1. 'processando' (em execução no Railway)
 *   2. 'rascunho' / 'aguardando_revisao' (extração concluída, revisão pendente)
 *
 * NÃO retorna erro/descartado/convertido_em_processo — esses são "fechados"
 * do ponto de vista de recovery.
 *
 * Resposta:
 *   - 200 { sessao: {...} }  quando há sessão ativa
 *   - 200 { sessao: null }   quando não há
 *
 * Sessão 032 — Opção 2 do plano 1-4.
 */

import { NextRequest, NextResponse } from 'next/server'

import { verificarAuth } from '@/lib/security/api-guard'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

const STATUS_ATIVOS = ['processando', 'rascunho', 'aguardando_revisao']

export async function GET(request: NextRequest) {
  const auth = await verificarAuth(request)
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('extracao_sessoes')
    .select('id, processo_id, status, iniciado_em, arquivos')
    .eq('usuario_id', auth.userId)
    .in('status', STATUS_ATIVOS)
    .order('iniciado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[extracao/ativa] Erro:', error.message)
    return NextResponse.json({ sessao: null }, { status: 200 })
  }

  if (!data) {
    return NextResponse.json({ sessao: null }, { status: 200 })
  }

  const arquivos = Array.isArray((data as { arquivos?: unknown }).arquivos)
    ? ((data as { arquivos: unknown[] }).arquivos)
    : []

  return NextResponse.json(
    {
      sessao: {
        id: data.id,
        processo_id: data.processo_id,
        status: data.status,
        iniciado_em: data.iniciado_em,
        total_arquivos: arquivos.length,
      },
    },
    { status: 200 },
  )
}
