import { NextRequest, NextResponse } from 'next/server'
import { verificarDocumento } from '@/lib/documentos/engine'

// Forçar execução dinâmica — NUNCA cachear internamente no Next.js
// Os dados do diploma podem ser atualizados a qualquer momento
export const dynamic = 'force-dynamic'

// GET /api/documentos/verificar/[codigo]
// Endpoint público — não requer autenticação
// Usado pelo portal /verificar e por integrações externas
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params
  const resultado = await verificarDocumento(codigo)

  if (!resultado.valido) {
    return NextResponse.json(resultado, { status: 404 })
  }

  return NextResponse.json(resultado, {
    headers: {
      // Cache curto para documentos publicados (5 minutos)
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
    },
  })
}
