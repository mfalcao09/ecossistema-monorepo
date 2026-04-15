/**
 * ============================================================
 * GET /api/diplomas/[id]/custodia
 *
 * Retorna a cadeia de custódia completa de um diploma
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server'
import { verificarAuth, erroNaoEncontrado, erroInterno } from '@/lib/security/api-guard'
import { obterCadeiaCustodia, verificarIntegridadeCadeia } from '@/lib/security/cadeia-custodia'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── Autenticação ───────────────────────────────────────────────────────
  const auth = await verificarAuth(request)
  if (auth instanceof NextResponse) return auth

  // ── Autorização (verificar permissão 'diplomas' 'acessar') ────────────
  // TODO: Implementar verificação de permissão quando o sistema estiver pronto
  // const temPermissao = auth.permissions?.some(p => p.modulo === 'diplomas' && p.acao === 'acessar')
  // if (!temPermissao) return erroNaoAutorizado()

  const { id: diplomaId } = await params

  try {
    // ── Obter cadeia completa ──────────────────────────────────────────
    const cadeia = await obterCadeiaCustodia(diplomaId)

    if (!cadeia || cadeia.length === 0) {
      return erroNaoEncontrado('Nenhum registro de custódia encontrado para este diploma')
    }

    // ── Verificar integridade ──────────────────────────────────────────
    const { integra, erros } = await verificarIntegridadeCadeia(diplomaId)

    // ── Retornar resposta ──────────────────────────────────────────────
    return NextResponse.json({
      sucesso: true,
      diploma_id: diplomaId,
      cadeia,
      integridade: {
        integra,
        erros,
      },
      total_registros: cadeia.length,
    })
  } catch (err) {
    console.error('[API] Erro ao obter cadeia de custódia:', err)
    return erroInterno()
  }
}
