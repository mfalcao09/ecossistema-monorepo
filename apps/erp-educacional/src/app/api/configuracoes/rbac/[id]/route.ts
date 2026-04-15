// =============================================================================
// GET    /api/configuracoes/rbac/[id]  — Detalhes do papel
// PUT    /api/configuracoes/rbac/[id]  — Atualiza papel
// DELETE /api/configuracoes/rbac/[id]  — Exclui papel
// ERP Educacional FIC
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { verificarAuthComPermissao, erroNaoEncontrado, erroInterno } from '@/lib/security/api-guard'
import { validarCSRF } from '@/lib/security/csrf'
import { buscarPapel, atualizarPapel, excluirPapel } from '@/lib/supabase/rbac'
import { logAdminAction } from '@/lib/security/security-logger'
import type { PapelCreateInput } from '@/types/configuracoes'

// ─── GET /api/configuracoes/rbac/[id] ────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuthComPermissao(request, 'configuracoes', 'acessar')
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    const papel = await buscarPapel(id)

    if (!papel) return erroNaoEncontrado()

    return NextResponse.json({ sucesso: true, dados: papel })
  } catch (erro) {
    console.error('[GET /api/configuracoes/rbac/[id]]', erro)
    return erroInterno()
  }
}

// ─── PUT /api/configuracoes/rbac/[id] ────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuthComPermissao(request, 'configuracoes', 'alterar')
  if (auth instanceof NextResponse) return auth

  // CSRF validation for PUT requests
  const csrfError = validarCSRF(request)
  if (csrfError) return csrfError

  try {
    const { id } = await params
    const body: Partial<PapelCreateInput> = await request.json()

    const papelExiste = await buscarPapel(id)
    if (!papelExiste) return erroNaoEncontrado()

    const papel = await atualizarPapel(id, body)

    // Log admin action - role update (non-blocking)
    void logAdminAction(request, auth.userId, 'atualizar_papel_rbac', {
      papel_id: papel.id,
      papel_nome: papel.nome,
      campos_atualizados: Object.keys(body),
    })

    return NextResponse.json({
      sucesso: true,
      dados: papel,
      mensagem: 'Papel atualizado com sucesso.',
    })
  } catch (erro) {
    console.error('[PUT /api/configuracoes/rbac/[id]]', erro)
    return erroInterno()
  }
}

// ─── DELETE /api/configuracoes/rbac/[id] ─────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuthComPermissao(request, 'configuracoes', 'remover')
  if (auth instanceof NextResponse) return auth

  // CSRF validation for DELETE requests
  const csrfError = validarCSRF(request)
  if (csrfError) return csrfError

  try {
    const { id } = await params

    const papel = await buscarPapel(id)
    if (!papel) return erroNaoEncontrado()

    await excluirPapel(id)

    // Log admin action - role deletion (non-blocking)
    void logAdminAction(request, auth.userId, 'deletar_papel_rbac', {
      papel_id: papel.id,
      papel_nome: papel.nome,
    })

    return NextResponse.json({
      sucesso: true,
      mensagem: 'Papel excluído com sucesso.',
    })
  } catch (erro) {
    console.error('[DELETE /api/configuracoes/rbac/[id]]', erro)
    return erroInterno()
  }
}
