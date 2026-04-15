// =============================================================================
// GET  /api/configuracoes/rbac  — Lista todos os papéis
// POST /api/configuracoes/rbac  — Cria novo papel
// ERP Educacional FIC
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { verificarAuthComPermissao, erroBadRequest, erroInterno } from '@/lib/security/api-guard'
import { validarCSRF } from '@/lib/security/csrf'
import { listarPapeis, criarPapel } from '@/lib/supabase/rbac'
import { logAdminAction } from '@/lib/security/security-logger'
import type { PapelCreateInput } from '@/types/configuracoes'

// ─── GET /api/configuracoes/rbac ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await verificarAuthComPermissao(request, 'configuracoes', 'acessar')
  if (auth instanceof NextResponse) return auth

  try {
    const papeis = await listarPapeis()
    return NextResponse.json({
      sucesso: true,
      dados: papeis,
      total: papeis.length,
    })
  } catch (erro) {
    console.error('[GET /api/configuracoes/rbac]', erro)
    return erroInterno()
  }
}

// ─── POST /api/configuracoes/rbac ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = await verificarAuthComPermissao(request, 'configuracoes', 'inserir')
  if (auth instanceof NextResponse) return auth

  // CSRF validation for POST requests
  const csrfError = validarCSRF(request)
  if (csrfError) return csrfError

  try {
    const body: PapelCreateInput = await request.json()

    if (!body.nome || body.nome.trim().length === 0) {
      return erroBadRequest('O nome do papel é obrigatório.')
    }

    const papel = await criarPapel(body)

    // Log admin action - role creation (non-blocking)
    void logAdminAction(request, auth.userId, 'criar_papel_rbac', {
      papel_id: papel.id,
      papel_nome: papel.nome,
      descricao: papel.descricao || null,
    })

    return NextResponse.json(
      { sucesso: true, dados: papel, mensagem: 'Papel criado com sucesso.' },
      { status: 201 }
    )
  } catch (erro) {
    console.error('[POST /api/configuracoes/rbac]', erro)
    return erroInterno()
  }
}
