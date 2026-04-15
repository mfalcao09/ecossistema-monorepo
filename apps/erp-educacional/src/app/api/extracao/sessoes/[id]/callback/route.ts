/**
 * PUT /api/extracao/sessoes/[id]/callback — DESATIVADO (410 Gone)
 *
 * Contexto: sessão 033 (09/04/2026) — refatoramento "DB Write Direto".
 *
 * O canal HTTP callback Railway → Next.js foi eliminado. O Railway agora
 * escreve o resultado da extração DIRETAMENTE na tabela `extracao_sessoes`
 * via service_role (ver services/document-converter/src/supabase-writer.js).
 *
 * Motivação: este endpoint sofreu 3 bugs diferentes em sessões consecutivas:
 *   - Sessão 031/032: middleware 307-redirecionando por domain routing
 *   - Sessão 032: timeout 7min na Tela 2
 *   - Histórico: race condition no nonce
 *
 * Cada bug deixava sessões órfãs silenciosas. Escrita direta no banco é
 * a única fonte da verdade e UPDATE atômico idempotente via
 * `WHERE id=$1 AND status='processando'` protege contra reprocessos.
 *
 * Retornamos 410 Gone explicitamente (em vez de 404) para facilitar
 * diagnóstico se algum Railway antigo ainda tentar chamar durante um
 * rolling deploy.
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function PUT() {
  return NextResponse.json(
    {
      erro: 'Endpoint desativado',
      detalhe:
        'O callback HTTP Railway→Next.js foi eliminado em 09/04/2026 (sessão 033). ' +
        'O Railway agora escreve o resultado direto em extracao_sessoes via service_role. ' +
        'Ver services/document-converter/src/supabase-writer.js.',
    },
    { status: 410 },
  )
}
