/**
 * POST /api/ia/admin/reindex-all
 *
 * Re-indexa todas as skills ativas que não possuem chunks no RAG,
 * ou força re-indexação de TODAS (com ?force=true).
 *
 * Uso: chamar uma vez após seed de novas skills.
 * Protegido — requer autenticação.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verificarAuth } from '@/lib/security/api-guard'
import { indexarSkill } from '@/lib/ai/rag'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const auth = await verificarAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const force = searchParams.get('force') === 'true'

  const admin = getAdminClient()

  // 1. Buscar todas as skills ativas
  const { data: skills, error } = await admin
    .from('ia_skills')
    .select('id, nome, conteudo, versao')
    .eq('ativo', true)
    .order('created_at', { ascending: true })

  if (error || !skills) {
    return NextResponse.json({ error: error?.message || 'Erro ao buscar skills' }, { status: 500 })
  }

  // 2. Se não for force, filtrar apenas as que não têm chunks
  let skillsParaIndexar = skills

  if (!force) {
    const { data: chunksExistentes } = await admin
      .from('ia_skill_chunks')
      .select('skill_id')

    const idsComChunks = new Set(
      (chunksExistentes || []).map((c: { skill_id: string }) => c.skill_id)
    )

    skillsParaIndexar = skills.filter((s: { id: string }) => !idsComChunks.has(s.id))
  }

  if (skillsParaIndexar.length === 0) {
    return NextResponse.json({
      ok: true,
      mensagem: 'Nenhuma skill precisava de re-indexação.',
      indexadas: 0,
      detalhes: [],
    })
  }

  // 3. Indexar cada skill
  const resultados: Array<{
    id: string
    nome: string
    chunks_gerados: number
    tokens_usados: number
    status: 'ok' | 'erro'
    erro?: string
  }> = []

  let totalChunks = 0
  let totalTokens = 0

  for (const skill of skillsParaIndexar as Array<{ id: string; nome: string; conteudo: string; versao: number }>) {
    try {
      const resultado = await indexarSkill(skill.id, skill.nome, skill.conteudo, skill.versao)

      resultados.push({
        id: skill.id,
        nome: skill.nome,
        chunks_gerados: resultado.chunks_gerados,
        tokens_usados: resultado.tokens_usados,
        status: 'ok',
      })

      totalChunks += resultado.chunks_gerados
      totalTokens += resultado.tokens_usados

      console.log(`[reindex] ✅ "${skill.nome}" → ${resultado.chunks_gerados} chunks`)
    } catch (err) {
      const mensagemErro = err instanceof Error ? err.message : String(err)
      console.error(`[reindex] ❌ "${skill.nome}":`, mensagemErro)

      resultados.push({
        id: skill.id,
        nome: skill.nome,
        chunks_gerados: 0,
        tokens_usados: 0,
        status: 'erro',
        erro: mensagemErro,
      })
    }
  }

  const sucessos = resultados.filter((r) => r.status === 'ok').length
  const falhas = resultados.filter((r) => r.status === 'erro').length

  return NextResponse.json({
    ok: falhas === 0,
    mensagem: `${sucessos} skill(s) indexada(s)${falhas > 0 ? `, ${falhas} com erro` : ''}.`,
    indexadas: sucessos,
    falhas,
    total_chunks: totalChunks,
    total_tokens: totalTokens,
    detalhes: resultados,
  })
}
