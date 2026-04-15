/**
 * Sprint 2 / Recovery — GET /api/extracao/minhas
 *
 * Lista as sessões de extração do usuário atual que ainda estão "em aberto"
 * (não finalizadas): processando, rascunho, aguardando_revisao, erro.
 *
 * Usada pela tela /diploma/processos na seção "Extrações em andamento" para
 * que o usuário possa retomar ou descartar rascunhos mesmo depois de perder
 * a página (queda de internet, fechar navegador, etc.).
 *
 * Segurança:
 *   - Autenticação obrigatória via verificarAuth
 *   - Filtro explícito por usuario_id (defesa em profundidade + RLS)
 *   - NUNCA retorna callback_nonce
 *
 * Sessão 032 — recovery de sessão órfã (Opção 1a do plano 1-4 juntas).
 */

import { NextRequest, NextResponse } from 'next/server'

import { verificarAuth } from '@/lib/security/api-guard'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

const STATUS_EM_ABERTO = [
  'processando',
  'rascunho',
  'aguardando_revisao',
  'erro',
] as const

// Só mostra sessões das últimas 72h — evita poluir UI com histórico antigo.
const JANELA_HORAS = 72

export async function GET(request: NextRequest) {
  const auth = await verificarAuth(request)
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()

  const desde = new Date(Date.now() - JANELA_HORAS * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('extracao_sessoes')
    .select(
      [
        'id',
        'processo_id',
        'status',
        'iniciado_em',
        'finalizado_em',
        'erro_mensagem',
        'arquivos',
        'dados_extraidos',
      ].join(','),
    )
    .eq('usuario_id', auth.userId)
    .in('status', STATUS_EM_ABERTO as unknown as string[])
    .gte('iniciado_em', desde)
    .order('iniciado_em', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[extracao/minhas] Erro ao listar sessões:', error.message)
    return NextResponse.json(
      { erro: 'Falha ao listar extrações em andamento' },
      { status: 500 },
    )
  }

  // Normaliza o payload para o cliente — só o que a UI precisa.
  type SessaoRow = {
    id: string
    processo_id: string | null
    status: string
    iniciado_em: string | null
    finalizado_em: string | null
    erro_mensagem: string | null
    arquivos: unknown
    dados_extraidos: unknown
  }

  const rows = (data ?? []) as unknown as SessaoRow[]

  const sessoes = rows.map((s) => {
    const arquivos = Array.isArray(s.arquivos) ? s.arquivos : []
    const dados = (s.dados_extraidos ?? {}) as Record<string, unknown>

    // Tenta extrair dados do diplomado de caminhos alternativos (estrutura aninhada)
    const dip = (dados?.diplomado ?? dados?.aluno ?? {}) as Record<string, unknown>

    const cpfCandidato =
      (dip?.cpf as string | undefined) ||
      (dados?.cpf as string | undefined) ||
      null

    const nomeCandidato =
      (dip?.nome_completo as string | undefined) ||
      (dip?.nome as string | undefined) ||
      (dados?.nome_completo as string | undefined) ||
      (dados?.nome as string | undefined) ||
      null

    // Formata como "CPF - NOME COMPLETO" (padrão definido na sessão 064)
    const nomeProcesso =
      cpfCandidato && nomeCandidato
        ? `${cpfCandidato} - ${nomeCandidato}`
        : nomeCandidato || null

    return {
      id: s.id,
      processo_id: s.processo_id,
      status: s.status,
      iniciado_em: s.iniciado_em,
      finalizado_em: s.finalizado_em,
      erro_mensagem: s.erro_mensagem,
      total_arquivos: arquivos.length,
      nome_diplomando_provisorio: nomeProcesso,
    }
  })

  return NextResponse.json({ sessoes }, { status: 200 })
}
