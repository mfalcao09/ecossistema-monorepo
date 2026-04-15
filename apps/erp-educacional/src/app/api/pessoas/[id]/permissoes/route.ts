// =============================================================================
// GET    /api/pessoas/[id]/permissoes  — Lista overrides de permissão do usuário
// POST   /api/pessoas/[id]/permissoes  — Cria override de permissão (allow/deny)
// DELETE /api/pessoas/[id]/permissoes  — Remove override (via ?override_id=xxx)
// ERP Educacional FIC
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { verificarAuthComPermissao, erroBadRequest, erroInterno } from '@/lib/security/api-guard'
import { validarCSRF } from '@/lib/security/csrf'
import {
  listarPermissoesDiretas,
  criarPermissaoDireta,
  revogarPermissaoDireta,
  excluirPermissaoDireta,
} from '@/lib/supabase/permissoes-diretas'
import { logAdminAction } from '@/lib/security/security-logger'
import type { UsuarioPermissaoDiretaCreateInput } from '@/types/configuracoes'

// ─── GET /api/pessoas/[id]/permissoes ────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Precisa de permissão especial para ver overrides de outros usuários
  const auth = await verificarAuthComPermissao(request, 'pessoas', 'especial')
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    const permissoes = await listarPermissoesDiretas(id)
    return NextResponse.json({ sucesso: true, dados: permissoes, total: permissoes.length })
  } catch (erro) {
    console.error('[GET /api/pessoas/[id]/permissoes]', erro)
    return erroInterno()
  }
}

// ─── POST /api/pessoas/[id]/permissoes ───────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuthComPermissao(request, 'pessoas', 'especial')
  if (auth instanceof NextResponse) return auth

  // CSRF validation for POST requests
  const csrfError = validarCSRF(request)
  if (csrfError) return csrfError

  try {
    const { id: targetUserId } = await params
    const body = await request.json() as Omit<UsuarioPermissaoDiretaCreateInput, 'user_id'>

    if (!body.permissao_id) {
      return erroBadRequest('O campo "permissao_id" é obrigatório.')
    }
    if (!body.tipo || !['allow', 'deny'].includes(body.tipo)) {
      return erroBadRequest('O campo "tipo" deve ser "allow" ou "deny".')
    }

    const override = await criarPermissaoDireta(
      { ...body, user_id: targetUserId },
      auth.userId        // quem está fazendo a atribuição
    )

    // Log admin action - permission override (non-blocking)
    void logAdminAction(request, auth.userId, 'criar_override_permissao', {
      target_user_id: targetUserId,
      permissao_id: body.permissao_id,
      tipo: body.tipo,
      motivo: body.motivo || null,
    })

    return NextResponse.json(
      { sucesso: true, dados: override, mensagem: `Override "${body.tipo}" criado com sucesso.` },
      { status: 201 }
    )
  } catch (erro: any) {
    console.error('[POST /api/pessoas/[id]/permissoes]', erro)
    // Erro de duplicidade (409) — mensagem genérica
    if (erro.message?.includes('Já existe')) {
      return NextResponse.json({ sucesso: false, erro: 'Registro duplicado.' }, { status: 409 })
    }
    return erroInterno()
  }
}

// ─── DELETE /api/pessoas/[id]/permissoes?override_id=xxx ─────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuthComPermissao(request, 'pessoas', 'especial')
  if (auth instanceof NextResponse) return auth

  // CSRF validation for DELETE requests
  const csrfError = validarCSRF(request)
  if (csrfError) return csrfError

  try {
    await params // resolve params mesmo sem usar id aqui

    const { searchParams } = request.nextUrl
    const overrideId = searchParams.get('override_id')
    const acao = searchParams.get('acao') || 'excluir' // 'revogar' | 'excluir'

    if (!overrideId) {
      return erroBadRequest('Parâmetro "override_id" é obrigatório.')
    }

    if (acao === 'revogar') {
      await revogarPermissaoDireta(overrideId)
      // Log admin action - permission revocation (non-blocking)
      void logAdminAction(request, auth.userId, 'revogar_override_permissao', {
        override_id: overrideId,
      })
      return NextResponse.json({ sucesso: true, mensagem: 'Override revogado (desativado).' })
    } else {
      await excluirPermissaoDireta(overrideId)
      // Log admin action - permission deletion (non-blocking)
      void logAdminAction(request, auth.userId, 'deletar_override_permissao', {
        override_id: overrideId,
      })
      return NextResponse.json({ sucesso: true, mensagem: 'Override excluído definitivamente.' })
    }
  } catch (erro) {
    console.error('[DELETE /api/pessoas/[id]/permissoes]', erro)
    return erroInterno()
  }
}
