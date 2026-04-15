/**
 * API CRUD — ia_skills (por ID)
 * GET    /api/ia/skills/[id]    → busca skill + vínculos
 * PUT    /api/ia/skills/[id]    → atualiza skill
 * DELETE /api/ia/skills/[id]    → soft-delete (ativo = false)
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

function estimarTokens(texto: string): number {
  return Math.ceil(texto.length / 4)
}

// ── GET: buscar skill por ID ────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const admin = getAdminClient()

  const { data, error } = await admin
    .from('ia_skills')
    .select(`
      *,
      ia_agente_skills (
        id, agente_id, prioridade, modo,
        ia_configuracoes ( id, nome_agente, modulo, funcionalidade )
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json(data)
}

// ── PUT: atualizar skill ────────────────────────────────────────────────────
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const admin = getAdminClient()
  const body = await req.json()

  const { nome, slug, descricao, conteudo, tipo, categoria, ativo } = body

  if (slug && !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: 'Slug deve conter apenas letras minúsculas, números e hífens' },
      { status: 400 }
    )
  }

  // Buscar versão atual para incrementar
  const { data: atual } = await admin
    .from('ia_skills')
    .select('versao, conteudo')
    .eq('id', id)
    .single()

  const conteudoMudou = conteudo && conteudo !== atual?.conteudo
  const novaVersao = conteudoMudou ? (atual?.versao ?? 1) + 1 : undefined

  const updates: Record<string, unknown> = {}
  if (nome !== undefined)      updates.nome = nome
  if (slug !== undefined)      updates.slug = slug
  if (descricao !== undefined) updates.descricao = descricao
  if (conteudo !== undefined) {
    updates.conteudo = conteudo
    updates.tamanho_tokens = estimarTokens(conteudo)
  }
  if (tipo !== undefined)      updates.tipo = tipo
  if (categoria !== undefined) updates.categoria = categoria
  if (ativo !== undefined)     updates.ativo = ativo
  if (novaVersao !== undefined) updates.versao = novaVersao

  const { data, error } = await admin
    .from('ia_skills')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Já existe uma skill com este slug' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Re-indexar automaticamente no RAG se o conteúdo mudou
  if (conteudoMudou && data) {
    try {
      const resultado = await indexarSkill(
        id,
        data.nome,
        data.conteudo,
        data.versao
      )
      console.log(`[RAG] Skill "${data.nome}" re-indexada: ${resultado.chunks_gerados} chunks`)
    } catch (err) {
      console.error(`[RAG] Falha ao re-indexar skill ${id}:`, err)
      // Continua — skill foi atualizada, indexação pode ser refeita depois
    }
  }

  return NextResponse.json(data)
}

// ── DELETE: desativar skill (soft-delete) ───────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const admin = getAdminClient()

  const { data, error } = await admin
    .from('ia_skills')
    .update({ ativo: false })
    .eq('id', id)
    .select('id, nome, ativo')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, skill: data })
}
