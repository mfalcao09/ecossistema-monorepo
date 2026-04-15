/**
 * Sprint 2 / Recovery — POST /api/extracao/sessoes/[id]/descartar
 *
 * Marca uma sessão de extração como 'descartado'. Usado pela secretária
 * quando ela quer abandonar um rascunho (ou destravar uma sessão órfã)
 * diretamente da UI.
 *
 * Regras:
 *   - Só o dono (usuario_id = auth.uid()) pode descartar
 *   - Só descarta sessões que NÃO foram ainda convertidas em processo
 *     (status ∈ processando, rascunho, aguardando_revisao, erro)
 *   - Idempotente: descartar sessão já descartada retorna 200
 *
 * Sessão 032 — recovery de sessão órfã (Opção 1b do plano 1-4 juntas).
 */

import { NextRequest, NextResponse } from 'next/server'

import { verificarAuth } from '@/lib/security/api-guard'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

const STATUS_DESCARTAVEIS = [
  'processando',
  'rascunho',
  'aguardando_revisao',
  'erro',
]

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(request)
  if (auth instanceof NextResponse) return auth

  const { id: sessaoId } = await params
  if (!sessaoId || typeof sessaoId !== 'string') {
    return NextResponse.json(
      { erro: 'sessaoId inválido' },
      { status: 400 },
    )
  }

  const supabase = await createClient()

  // 1. Confirma que a sessão pertence ao usuário e está em estado descartável.
  const { data: sessao, error: selectErr } = await supabase
    .from('extracao_sessoes')
    .select('id, status, usuario_id')
    .eq('id', sessaoId)
    .maybeSingle()

  if (selectErr) {
    console.error('[extracao/descartar] Erro ao buscar sessão:', selectErr.message)
    return NextResponse.json(
      { erro: 'Falha ao buscar sessão' },
      { status: 500 },
    )
  }

  if (!sessao) {
    return NextResponse.json(
      { erro: 'Sessão não encontrada' },
      { status: 404 },
    )
  }

  if (sessao.usuario_id !== auth.userId) {
    return NextResponse.json(
      { erro: 'Sessão não pertence ao usuário autenticado' },
      { status: 403 },
    )
  }

  // Idempotência: já está descartado, retorna OK.
  if (sessao.status === 'descartado') {
    return NextResponse.json({ ok: true, ja_descartado: true }, { status: 200 })
  }

  if (!STATUS_DESCARTAVEIS.includes(sessao.status as string)) {
    return NextResponse.json(
      {
        erro: `Sessão com status '${sessao.status}' não pode ser descartada (já foi convertida ou concluída).`,
      },
      { status: 409 },
    )
  }

  // 2. UPDATE — usa client autenticado, então RLS policy de UPDATE também protege.
  const { error: updateErr } = await supabase
    .from('extracao_sessoes')
    .update({
      status: 'descartado',
      finalizado_em: new Date().toISOString(),
    })
    .eq('id', sessaoId)
    .eq('usuario_id', auth.userId)

  if (updateErr) {
    console.error('[extracao/descartar] Erro ao descartar:', updateErr.message)
    return NextResponse.json(
      { erro: 'Falha ao descartar sessão' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
