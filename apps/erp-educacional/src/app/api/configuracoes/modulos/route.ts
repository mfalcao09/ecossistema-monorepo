// =============================================================================
// GET /api/configuracoes/modulos  — Hierarquia de módulos e funcionalidades
// ERP Educacional FIC
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { verificarAuthComPermissao, erroInterno } from '@/lib/security/api-guard'
import { listarModulosComFuncionalidades } from '@/lib/supabase/rbac'

export async function GET(request: NextRequest) {
  const auth = await verificarAuthComPermissao(request, 'configuracoes', 'acessar')
  if (auth instanceof NextResponse) return auth

  try {
    const hierarquia = await listarModulosComFuncionalidades()
    return NextResponse.json({
      sucesso: true,
      dados: hierarquia,
      total: hierarquia.length,
    })
  } catch (erro) {
    console.error('[GET /api/configuracoes/modulos]', erro)
    return erroInterno()
  }
}
