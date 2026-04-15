// =============================================================================
// GET    /api/pessoas/[id]  — Busca pessoa por ID (com relações)
// PUT    /api/pessoas/[id]  — Atualiza pessoa
// DELETE /api/pessoas/[id]  — Exclui pessoa
// ERP Educacional FIC
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { verificarAuthComPermissao, erroNaoEncontrado, erroInterno } from '@/lib/security/api-guard'
import { validarCSRF } from '@/lib/security/csrf'
import { buscarPessoa, atualizarPessoa, excluirPessoa } from '@/lib/supabase/pessoas'
import { logDataAccess, logDataModification } from '@/lib/security/security-logger'

// ─── GET /api/pessoas/[id] ────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuthComPermissao(request, 'pessoas', 'acessar')
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    const pessoa = await buscarPessoa(id)

    if (!pessoa) {
      return erroNaoEncontrado()
    }

    // Log data access (PII) (non-blocking)
    void logDataAccess(request, auth.userId, 'pessoas', 'read', [id])

    return NextResponse.json(pessoa)
  } catch (error) {
    console.error('[GET /api/pessoas/[id]]', error)
    return erroInterno()
  }
}

// ─── PUT /api/pessoas/[id] ────────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuthComPermissao(request, 'pessoas', 'alterar')
  if (auth instanceof NextResponse) return auth

  const csrfError = validarCSRF(request)
  if (csrfError) return csrfError

  try {
    const { id } = await params
    const body = await request.json()

    const existente = await buscarPessoa(id)
    if (!existente) {
      return erroNaoEncontrado()
    }

    const pessoa = await atualizarPessoa({ ...body, id })

    // Log data modification (non-blocking)
    void logDataModification(request, auth.userId, 'pessoas', 'update', 1, { campos: Object.keys(body) })

    return NextResponse.json(pessoa)
  } catch (error) {
    console.error('[PUT /api/pessoas/[id]]', error)
    return erroInterno()
  }
}

// ─── DELETE /api/pessoas/[id] ─────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuthComPermissao(request, 'pessoas', 'remover')
  if (auth instanceof NextResponse) return auth

  const csrfError = validarCSRF(request)
  if (csrfError) return csrfError

  try {
    const { id } = await params

    const existente = await buscarPessoa(id)
    if (!existente) {
      return erroNaoEncontrado()
    }

    await excluirPessoa(id)

    // Log data deletion (non-blocking)
    void logDataModification(request, auth.userId, 'pessoas', 'delete', 1)

    return NextResponse.json({ sucesso: true, mensagem: 'Pessoa excluída com sucesso.' })
  } catch (error) {
    console.error('[DELETE /api/pessoas/[id]]', error)
    return erroInterno()
  }
}
