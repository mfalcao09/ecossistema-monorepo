// =============================================================================
// /api/diplomas/[id]/rvdd — Geração e consulta da RVDD
//
// GET  → verifica se RVDD foi gerado (checa status e url_verificacao no diploma)
// POST → dispara a geração da RVDD: valida dados, atualiza status, retorna URL
//
// A RVDD usa a abordagem "print page":
//   - A página /rvdd/[id] renderiza o diploma visualmente (Next.js SSR)
//   - O browser converte para PDF via window.print() (CSS @media print)
//   - Opcionalmente, um microserviço Puppeteer pode fazer o print server-side
//
// Portaria MEC 554/2019, Portaria MEC 70/2025, IN SESU/MEC 01/2020
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { buscarDiplomaCompleto } from '@/lib/diplomas/buscar-completo'
import { montarVariaveisRVDD, type ConfigIesParaRVDD } from '@/lib/diplomas/montar-variaveis-rvdd'
import { verificarAuth, erroNaoEncontrado, erroInterno } from '@/lib/security/api-guard'
import { sanitizarErro } from '@/lib/security/sanitize-error'
import { registrarCustodiaAsync } from '@/lib/security/cadeia-custodia'

// =============================================================================
// HELPERS
// =============================================================================

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function buscarConfigIes(ambiente: string): Promise<ConfigIesParaRVDD | null> {
  const admin = getAdminClient()
  const { data, error } = await admin
    .from('diploma_config')
    .select('ies_nome, ies_sigla, ies_cnpj, municipio, uf, url_portal_diplomatizado')
    .eq('ambiente', ambiente)
    .single()

  if (error || !data) return null

  const d = data as Record<string, unknown>
  const urlPortal =
    (d.url_portal_diplomatizado as string | null) ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://diploma.ficcassilandia.com.br'

  return {
    nome:      (d.ies_nome as string)      ?? 'Faculdades Integradas de Cassilândia',
    sigla:     (d.ies_sigla as string | null) ?? 'FIC',
    cnpj:      (d.ies_cnpj as string)      ?? '',
    municipio: (d.municipio as string)     ?? 'Cassilândia',
    uf:        (d.uf as string)            ?? 'MS',
    url_portal: urlPortal,
  }
}

function buildBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

// =============================================================================
// GET — Verifica se RVDD foi gerado para este diploma
// =============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const admin = getAdminClient()

  const { data: diploma, error } = await admin
    .from('diplomas')
    .select('id, status, url_verificacao, qrcode_url, codigo_validacao, ambiente')
    .eq('id', id)
    .single()

  if (error || !diploma) {
    return NextResponse.json({ existe: false, diploma: null })
  }

  const statusesComRvdd = ['rvdd_gerado', 'publicado']
  const rvddGerado = statusesComRvdd.includes(diploma.status)

  const baseUrl = buildBaseUrl()
  const rvddPageUrl = `${baseUrl}/rvdd/${id}`
  const codigoVerificacao =
    diploma.codigo_validacao ?? `FIC-${id.slice(0, 8).toUpperCase()}`
  const urlVerificacao =
    diploma.url_verificacao ??
    `${baseUrl}/verificar/${codigoVerificacao}`

  return NextResponse.json({
    existe: rvddGerado,
    status_diploma: diploma.status,
    rvdd_url: rvddGerado ? rvddPageUrl : null,
    url_verificacao: rvddGerado ? urlVerificacao : null,
    codigo_verificacao: rvddGerado ? codigoVerificacao : null,
    qrcode_url: diploma.qrcode_url ?? null,
  })
}

// =============================================================================
// POST — Gera (ou regenera) a RVDD para o diploma
// =============================================================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(req)
  if (auth instanceof NextResponse) return auth

  const { id: diplomaId } = await params
  const admin = getAdminClient()

  try {

    // ── 2. Buscar diploma completo (valida existência + traz todos os dados) ───
    const completo = await buscarDiplomaCompleto(diplomaId)
    if (!completo) {
      return erroNaoEncontrado()
    }

    // ── 3. Validar status ─────────────────────────────────────────────────────
    //    RVDD pode ser gerado após o diploma estar assinado
    const statusesPermitidos = [
      'assinado',
      'aguardando_registro',
      'registrado',
      'gerando_rvdd',
      'rvdd_gerado',   // permite regeneração
    ]
    if (!statusesPermitidos.includes(completo.diploma.status)) {
      return NextResponse.json(
        {
          error: `Diploma precisa estar assinado para gerar o RVDD. Status atual: "${completo.diploma.status}".`,
          status_atual: completo.diploma.status,
          statuses_permitidos: statusesPermitidos,
        },
        { status: 422 }
      )
    }

    // ── 4. Buscar configuração da IES ─────────────────────────────────────────
    const configIes = await buscarConfigIes(completo.diploma.ambiente)
    if (!configIes) {
      console.error('[API] Configuração da IES não encontrada para ambiente:', completo.diploma.ambiente)
      return erroInterno()
    }

    // ── 5. Validar variáveis RVDD (não-bloqueante — avisa mas não para) ───────
    let variaveisOk = false
    let erroVariaveis: string | null = null
    try {
      montarVariaveisRVDD(completo, configIes)
      variaveisOk = true
    } catch (err) {
      erroVariaveis = err instanceof Error ? err.message : 'Erro ao montar variáveis'
      console.warn('[POST /rvdd] Aviso — variáveis incompletas:', erroVariaveis)
      // Prossegue mesmo assim: a página /rvdd/[id] mostrará os dados disponíveis
    }

    // ── 6. Construir URLs ─────────────────────────────────────────────────────
    const baseUrl = buildBaseUrl()
    const codigoVerificacao =
      completo.diploma.codigo_validacao ??
      `FIC-${diplomaId.slice(0, 8).toUpperCase()}`

    const urlVerificacao =
      completo.diploma.url_verificacao ??
      `${baseUrl}/verificar/${codigoVerificacao}`

    const rvddPageUrl = `${baseUrl}/rvdd/${diplomaId}`

    // ── 7. Atualizar status do diploma para gerando_rvdd ─────────────────────
    await admin
      .from('diplomas')
      .update({
        status: 'gerando_rvdd',
        url_verificacao: urlVerificacao,
        updated_at: new Date().toISOString(),
      })
      .eq('id', diplomaId)

    // ── 8. (Opcional) Salvar HTML estático no Storage como backup ─────────────
    //    Isso é opcional — a URL canônica é sempre /rvdd/[id]
    let htmlStoragePath: string | null = null
    try {
      const { gerarHtmlRvdd } = await import('@/lib/diplomas/gerar-html-rvdd')
      const variaveis = montarVariaveisRVDD(completo, configIes)
      const xmlHashes = (completo.xmls_gerados ?? [])
        .filter(x => x.status === 'assinado' && x.hash_sha256)
        .map(x => ({ tipo: x.tipo, hash: x.hash_sha256 as string }))

      const htmlRvdd = gerarHtmlRvdd(variaveis, xmlHashes)
      const htmlBytes = Buffer.from(htmlRvdd, 'utf-8')
      const storagePath = `rvdd/${diplomaId}/rvdd_${codigoVerificacao}.html`

      const { error: uploadErr } = await admin.storage
        .from('documentos-digitais')
        .upload(storagePath, htmlBytes, {
          contentType: 'text/html; charset=utf-8',
          upsert: true,
        })

      if (!uploadErr) {
        htmlStoragePath = storagePath
      }
    } catch {
      // Backup HTML falhou — não é bloqueante, a página /rvdd/[id] é a canônica
    }

    // ── 9. Atualizar status para rvdd_gerado ──────────────────────────────────
    const agora = new Date().toISOString()
    await admin
      .from('diplomas')
      .update({
        status: 'rvdd_gerado',
        updated_at: agora,
      })
      .eq('id', diplomaId)

    // Registrar na cadeia de custódia (non-blocking)
    const auth = await verificarAuth(req)
    if (!(auth instanceof NextResponse)) {
      void registrarCustodiaAsync({
        diplomaId,
        etapa: 'rvdd_gerado',
        status: 'sucesso',
        request: req,
        userId: auth.userId,
        detalhes: {
          rvdd_url: rvddPageUrl,
          codigo_verificacao: codigoVerificacao,
          html_storage_path: htmlStoragePath,
          variaveis_ok: variaveisOk,
        },
      })
    }

    // ── 10. Resposta ──────────────────────────────────────────────────────────
    return NextResponse.json({
      ok: true,
      modo: 'print_page',
      rvdd_url: rvddPageUrl,
      codigo_verificacao: codigoVerificacao,
      url_verificacao: urlVerificacao,
      html_storage_path: htmlStoragePath,
      novo_status: 'rvdd_gerado',
      variaveis_ok: variaveisOk,
      aviso_variaveis: erroVariaveis,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[POST /api/diplomas/[id]/rvdd]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
