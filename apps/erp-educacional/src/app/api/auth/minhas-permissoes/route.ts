// =============================================================================
// GET /api/auth/minhas-permissoes
// Retorna todas as permissões do usuário logado como array de "modulo:acao"
// Consumido pelo PermissoesProvider para popular o contexto na UI
// =============================================================================

import { protegerRota } from '@/lib/security/api-guard'
import { NextResponse } from 'next/server'
import { carregarTodasPermissoes } from '@/lib/supabase/rbac'
import { createClient } from '@/lib/supabase/server'

export const GET = protegerRota(async (request, { userId, tenantId }) => {

  try {
    const permissoesSet = await carregarTodasPermissoes(userId)
    return NextResponse.json({
      permissoes: Array.from(permissoesSet),
    })
  } catch (err) {
    console.error('[minhas-permissoes]', err)
    return NextResponse.json({ permissoes: [] })
  }
}, { skipCSRF: true })
