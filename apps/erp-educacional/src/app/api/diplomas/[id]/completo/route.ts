// =============================================================================
// GET /api/diplomas/[id]/completo
//
// Retorna o DiplomaCompleto (JOIN das 9 tabelas) + as VariaveisRVDD prontas
// para uso pelo motor de geração de RVDD (PDF) e pelos XMLs do MEC.
//
// Uso interno — requer autenticação via sessão do ERP.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { buscarDiplomaCompleto } from '@/lib/diplomas/buscar-completo'
import { montarVariaveisRVDD, type ConfigIesParaRVDD } from '@/lib/diplomas/montar-variaveis-rvdd'
import { verificarAuth, erroNaoEncontrado, erroInterno } from '@/lib/security/api-guard'
import { sanitizarErro } from '@/lib/security/sanitize-error'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// =============================================================================
// GET — retorna DiplomaCompleto + VariaveisRVDD
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(request)
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  if (!id || typeof id !== 'string') {
    return NextResponse.json(
      { erro: 'ID do diploma inválido' },
      { status: 400 }
    )
  }

  // ── 1. Busca o diploma completo ──────────────────────────────────────────
  const completo = await buscarDiplomaCompleto(id)

  if (!completo) {
    return erroNaoEncontrado()
  }

  // ── 2. Busca as configurações da IES para o ambiente do diploma ──────────
  const configIes = await buscarConfigIes(completo.diploma.ambiente)

  if (!configIes) {
    console.error('[API] Configuração da IES não encontrada para o ambiente:', completo.diploma.ambiente)
    return erroInterno()
  }

  // ── 3. Monta as variáveis planas para o template RVDD ───────────────────
  let variaveisRVDD = null
  let erroVariaveis: string | null = null

  try {
    variaveisRVDD = montarVariaveisRVDD(completo, configIes)
  } catch (err) {
    // Não bloqueia — retorna o diploma completo mesmo que variáveis falhem
    // (pode acontecer com diplomas incompletos ainda em rascunho)
    erroVariaveis = err instanceof Error ? err.message : 'Erro ao montar variáveis RVDD'
    console.warn('[GET /api/diplomas/[id]/completo] Aviso:', erroVariaveis)
  }

  // ── 4. Retorna tudo ──────────────────────────────────────────────────────
  return NextResponse.json({
    // Dados completos (para geração XML e uso interno)
    diploma: completo.diploma,
    diplomado: completo.diplomado,
    curso: completo.curso,
    disciplinas: completo.disciplinas,
    enade: completo.enade,
    estagios: completo.estagios,
    atividades_complementares: completo.atividades_complementares,
    habilitacoes: completo.habilitacoes,
    xmls_gerados: completo.xmls_gerados,
    assinantes: completo.assinantes,
    fluxo_assinaturas: completo.fluxo_assinaturas,

    // Variáveis planas para template RVDD (PDF)
    variaveis_rvdd: variaveisRVDD,
    erro_variaveis: erroVariaveis,

    // Metadados da resposta
    gerado_em: new Date().toISOString(),
  })
}

// =============================================================================
// HELPER — busca configurações da IES do diploma_config
// =============================================================================

async function buscarConfigIes(ambiente: string): Promise<ConfigIesParaRVDD | null> {
  const admin = getAdminClient()

  const { data, error } = await admin
    .from('diploma_config')
    .select(`
      ies_nome,
      ies_sigla,
      ies_cnpj,
      municipio,
      uf,
      url_portal_diplomatizado
    `)
    .eq('ambiente', ambiente)
    .single()

  if (error || !data) {
    console.error('[buscarConfigIes] Erro ao buscar config da IES:', error)
    return null
  }

  // Garante que temos a URL do portal (fallback para a URL do sistema)
  const urlPortal =
    (data as Record<string, unknown>).url_portal_diplomatizado as string |null ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://diploma.ficcassilandia.com.br'

  return {
    nome:      (data as Record<string, unknown>).ies_nome as string ?? 'Faculdades Integradas de Cassilândia',
    sigla:     (data as Record<string, unknown>).ies_sigla as string | null ?? 'FIC',
    cnpj:      (data as Record<string, unknown>).ies_cnpj as string ?? '',
    municipio: (data as Record<string, unknown>).municipio as string ?? 'Cassilândia',
    uf:        (data as Record<string, unknown>).uf as string ?? 'MS',
    url_portal: urlPortal,
  }
}
