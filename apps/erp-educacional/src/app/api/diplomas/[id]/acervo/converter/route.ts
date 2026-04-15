import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { protegerRota } from '@/lib/security/api-guard'
import { sanitizarErro } from '@/lib/security/sanitize-error'
import {
  obterPdfABase64,
  PdfAConversionError,
} from '@/lib/pdfa/converter-service'

// ═══════════════════════════════════════════════════════════════════
// POST /api/diplomas/[id]/acervo/converter
//
// Dispara conversão PDF/A para todos os diploma_documentos_comprobatorios
// pendentes (pdfa_storage_path IS NULL) do diploma.
//
// Sprint 6 — item 6.2: "eager on demand" — o operador clica no botão
// "Converter documentos" na UI e este endpoint processa tudo.
//
// Retorna: { total, convertidos, ja_convertidos, erros: [{ id, erro }] }
// ═══════════════════════════════════════════════════════════════════

export const POST = protegerRota(
  async (request) => {
    // ── Extrair diplomaId da URL ──────────────────────────────────────
    const url = new URL(request.url)
    const segments = url.pathname.split('/')
    const diplomaIdx = segments.indexOf('diplomas')
    const diplomaId = diplomaIdx >= 0 ? segments[diplomaIdx + 1] : null

    if (!diplomaId) {
      return NextResponse.json({ error: 'ID do diploma não fornecido' }, { status: 400 })
    }

    // ── Verificar que diploma existe ──────────────────────────────────
    const supabase = await createClient()

    const { data: diploma, error: errDiploma } = await supabase
      .from('diplomas')
      .select('id, processo_id, status')
      .eq('id', diplomaId)
      .single()

    if (errDiploma || !diploma) {
      return NextResponse.json(
        { error: sanitizarErro(errDiploma?.message || 'Diploma não encontrado', 404) },
        { status: 404 }
      )
    }

    if (!diploma.processo_id) {
      return NextResponse.json(
        { error: 'Diploma sem processo vinculado — comprobatórios ainda não foram criados.' },
        { status: 422 }
      )
    }

    // ── Listar comprobatórios pendentes de conversão ──────────────────
    // Admin client necessário: bucket `documentos-pdfa` só permite escrita via service_role.
    const admin = createAdminClient()

    const { data: pendentes, error: errLista } = await admin
      .from('diploma_documentos_comprobatorios')
      .select('id, tipo_xsd, pdfa_storage_path')
      .eq('processo_id', diploma.processo_id)
      .is('deleted_at', null)
      .order('selecionado_em', { ascending: true })

    if (errLista) {
      return NextResponse.json(
        { error: sanitizarErro(errLista.message, 500) },
        { status: 500 }
      )
    }

    if (!pendentes || pendentes.length === 0) {
      return NextResponse.json({
        total: 0,
        convertidos: 0,
        ja_convertidos: 0,
        erros: [],
        mensagem: 'Nenhum comprobatório encontrado para este diploma.',
      })
    }

    // ── Converter sequencialmente (Ghostscript é CPU-bound) ───────────
    let convertidos = 0
    let ja_convertidos = 0
    const erros: { id: string; tipo_xsd: string; erro: string }[] = []

    for (const ddc of pendentes) {
      // Se já convertido, conta mas não reconverte
      if (ddc.pdfa_storage_path) {
        ja_convertidos++
        continue
      }

      try {
        await obterPdfABase64(ddc.id as string, admin)
        convertidos++
      } catch (err) {
        const msg =
          err instanceof PdfAConversionError
            ? err.message
            : err instanceof Error
            ? err.message
            : 'Erro desconhecido na conversão'

        console.error(
          `[acervo/converter] Erro ao converter ddc ${ddc.id} (${ddc.tipo_xsd}): ${msg}`
        )

        erros.push({
          id: ddc.id as string,
          tipo_xsd: ddc.tipo_xsd as string,
          erro: msg,
        })
      }
    }

    const total = pendentes.length

    return NextResponse.json({
      total,
      convertidos,
      ja_convertidos,
      erros,
      mensagem:
        erros.length === 0
          ? `${convertidos} documento(s) convertido(s) com sucesso.`
          : `${convertidos} convertido(s), ${erros.length} com erro.`,
    })
  },
  { skipCSRF: true }
)
