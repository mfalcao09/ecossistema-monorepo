// ============================================================
// POST /api/admin/migrar-pii
// Rota TEMPORÁRIA para popular cpf_hash e campos criptografados
// em registros existentes da tabela diplomados.
//
// SEGURANÇA: Protegida por ADMIN_SECRET (env var)
// QUANDO REMOVER: Após todos os registros terem cpf_hash populado
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { migrarCriptografiaDiplomados } from '@/lib/security/pii-encryption'

export const maxDuration = 60 // Pode demorar para lotes grandes

export async function POST(request: NextRequest) {
  // ── Verificar autenticação admin ────────────────────────
  const authHeader = request.headers.get('authorization')
  const adminSecret = process.env.ADMIN_SECRET

  if (!adminSecret) {
    return NextResponse.json(
      { error: 'ADMIN_SECRET não configurada no ambiente' },
      { status: 500 }
    )
  }

  if (authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json(
      { error: 'Acesso não autorizado' },
      { status: 401 }
    )
  }

  // ── Executar migração em lote ───────────────────────────
  try {
    const resultado = await migrarCriptografiaDiplomados()

    return NextResponse.json({
      sucesso: true,
      ...resultado,
      mensagem: resultado.total === 0
        ? 'Todos os registros já foram migrados!'
        : `Migrados ${resultado.migrados} de ${resultado.total} registros (${resultado.erros} erros)`,
      instrucao: resultado.total > 0
        ? 'Chame esta rota novamente para processar o próximo lote de 100'
        : 'Migração completa — esta rota pode ser removida',
    })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json(
      { error: `Falha na migração: ${mensagem}` },
      { status: 500 }
    )
  }
}
