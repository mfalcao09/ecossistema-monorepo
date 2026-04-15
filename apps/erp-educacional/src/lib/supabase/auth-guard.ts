// =============================================================================
// Auth Guard — Guardião de Rotas de API
// ERP Educacional FIC
//
// Uso em qualquer route.ts:
//   const auth = await requireAuth('pessoas', 'inserir')
//   if (auth instanceof NextResponse) return auth   // 401 ou 403
//   const { userId, tenantId } = auth
// =============================================================================

import { NextResponse } from 'next/server'
import { createClient } from './server'
import { verificarPermissao } from './rbac'
import type { AcaoPermissao } from '@/types/configuracoes'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AuthContext {
  userId: string
  tenantId: string
  email: string
}

// ─── Helper interno: buscar tenant do usuário logado ─────────────────────────

async function getTenantIdParaUsuario(userId: string): Promise<string | null> {
  const supabase = await createClient()

  // Busca pela tabela usuario_papeis para descobrir o tenant
  const { data } = await supabase
    .from('usuario_papeis')
    .select('tenant_id')
    .eq('user_id', userId)
    .limit(1)
    .single()

  if (data?.tenant_id) return data.tenant_id

  // Fallback: usa o primeiro tenant disponível (para admin sem papel ainda)
  const { data: inst } = await supabase
    .from('instituicoes')
    .select('id')
    .limit(1)
    .single()

  return inst?.id ?? null
}

// ─── Apenas autenticação (sem checar permissão) ───────────────────────────────

export async function requireSession(): Promise<AuthContext | NextResponse> {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      { erro: 'Não autenticado. Faça login para continuar.' },
      { status: 401 }
    )
  }

  const tenantId = await getTenantIdParaUsuario(user.id)

  if (!tenantId) {
    return NextResponse.json(
      { erro: 'Nenhuma instituição associada a este usuário.' },
      { status: 403 }
    )
  }

  return {
    userId: user.id,
    tenantId,
    email: user.email ?? '',
  }
}

// ─── Autenticação + verificação de permissão ─────────────────────────────────

export async function requireAuth(
  moduloSlug: string,
  acao: AcaoPermissao
): Promise<AuthContext | NextResponse> {
  // 1. Verificar sessão
  const session = await requireSession()
  if (session instanceof NextResponse) return session

  // 2. Verificar permissão (papel + overrides por pessoa)
  const temPermissao = await verificarPermissao(session.userId, moduloSlug, acao)

  if (!temPermissao) {
    return NextResponse.json(
      {
        erro: `Acesso negado. Você não tem permissão para "${acao}" no módulo "${moduloSlug}".`,
        modulo: moduloSlug,
        acao,
      },
      { status: 403 }
    )
  }

  return session
}

// ─── Utilitário: resposta de erro padronizada ─────────────────────────────────

export function erroBadRequest(mensagem: string) {
  return NextResponse.json({ erro: mensagem }, { status: 400 })
}

export function erroNaoEncontrado(mensagem = 'Registro não encontrado.') {
  return NextResponse.json({ erro: mensagem }, { status: 404 })
}

export function erroInterno(mensagem = 'Erro interno do servidor.') {
  return NextResponse.json({ erro: mensagem }, { status: 500 })
}
