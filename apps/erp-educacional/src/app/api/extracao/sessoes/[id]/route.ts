/**
 * Sprint 2 / Etapa 2 — GET /api/extracao/sessoes/[id]
 *
 * Endpoint de polling consumido pela Tela 2 (`/diploma/processos/novo/revisao/[sessaoId]`).
 * Retorna o estado atual da sessão de extração para a UI atualizar o loading
 * e, quando `status='rascunho'`, renderizar o formulário pré-preenchido.
 *
 * Segurança:
 *   - Autenticação via `verificarAuth` (mesmo padrão das rotas dinâmicas do projeto)
 *   - Bloqueio de acesso a sessão de outro usuário (RLS lógico)
 *   - NUNCA expõe o `callback_nonce` ou `callback_nonce_used_at` (anti-replay)
 *
 * Cache:
 *   - `force-dynamic` + `cache: 'no-store'` no fetch do client (estado vivo)
 *
 * Observação:
 *   - O cliente Supabase é via `createClient()` (com sessão do usuário),
 *     então a query JÁ é filtrada por `usuario_id = auth.uid()` na policy
 *     de SELECT (definida no Sprint 1 / hardening sessão 028).
 *   - Mesmo assim, fazemos `.eq('usuario_id', userId)` explícito como
 *     defesa em profundidade caso a policy mude.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { verificarAuth } from '@/lib/security/api-guard'
import { createClient } from '@/lib/supabase/server'
import { TIPOS_XSD_COMPROBATORIO } from '@/lib/diploma/regras-fic'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// ── Sessão 038 (09/04/2026) — paralelização total de queries ──────────────
//
// Causa raiz dos 504 persistentes: 6 queries SEQUENCIAIS (getUser + getTenant
// + SELECT_LITE + SELECT_HEAVY + SELECT processo_arquivos) com cold start da
// função serverless excedem 30s consistentemente para a sessão Kauana 16 docs.
// O payload é MINÚSCULO (4.7KB dados_extraidos, 814B arquivos), então o
// problema nunca foi tamanho — era latência acumulada de round trips ao DB.
//
// Fix: BYPASS do verificarAuth genérico (que faz getUser + getTenantId
// sequencialmente = 3 queries) e fazer tudo em PARALELO:
//
//   Passo 1: getUser() (obrigatório — precisa do userId)
//   Passo 2: Promise.all([sessão COMPLETA, processo_arquivos])
//
// De 6 sequential queries → 2 passos (1 auth + 1 parallel batch).
// Tempo estimado: ~1-2s em vez de 3-6s. Sobra folga pro maxDuration=30.
//
// SEGURANÇA: RLS + .eq('usuario_id', userId) explícito garantem isolamento.
// Bypass do getTenantId é seguro porque esta rota NÃO usa tenantId pra nada.

// Todos os campos exceto callback_nonce e callback_nonce_used_at (anti-replay)
const SELECT_ALL = [
  'id',
  'processo_id',
  'status',
  'confianca_geral',
  'erro_mensagem',
  'erro_parcial',
  'iniciado_em',
  'finalizado_em',
  'processing_ms',
  'version',
  'created_at',
  'updated_at',
  'arquivos',
  'dados_extraidos',
  'dados_confirmados',
  'campos_faltando',
  'confianca_campos',
].join(', ')

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    // 1. Validação básica do ID (UUID) — rápida, sem I/O
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ erro: 'ID inválido' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: userData, error: authError } = await supabase.auth.getUser()

    if (authError || !userData.user) {
      return NextResponse.json(
        { erro: 'Não autorizado: sessão inválida ou expirada' },
        { status: 401 },
      )
    }

    const userId = userData.user.id

    // 3. Busca sessão COMPLETA + processo_arquivos em PARALELO
    const [sessaoResult, arquivosResult] = await Promise.all([
      supabase
        .from('extracao_sessoes')
        .select(SELECT_ALL)
        .eq('id', id)
        .eq('usuario_id', userId)
        .maybeSingle<Record<string, unknown>>(),
      supabase
        .from('processo_arquivos')
        .select(
          'id, nome_original, mime_type, tamanho_bytes, storage_path, destino_xml, destino_acervo, tipo_xsd, created_at',
        )
        .eq('sessao_id', id)
        .order('created_at', { ascending: true }),
    ])

    if (sessaoResult.error) {
      console.error('[GET sessoes] DB error:', sessaoResult.error.message)
      return NextResponse.json(
        { erro: 'Falha ao buscar sessão de extração' },
        { status: 500 },
      )
    }

    const sessao = sessaoResult.data
    if (!sessao) {
      return NextResponse.json(
        { erro: 'Sessão não encontrada' },
        { status: 404 },
      )
    }

    if (arquivosResult.error) {
      console.error('[GET sessoes] arquivos err:', arquivosResult.error.message)
    }

    // 4. Se processando/pendente, devolve SÓ campos leves (compat com frontend)
    const status = sessao.status as string

    if (status === 'processando' || status === 'pendente') {
      return NextResponse.json(
        {
          id: sessao.id,
          processo_id: sessao.processo_id,
          status: sessao.status,
          confianca_geral: sessao.confianca_geral,
          erro_mensagem: sessao.erro_mensagem,
          erro_parcial: sessao.erro_parcial,
          iniciado_em: sessao.iniciado_em,
          finalizado_em: sessao.finalizado_em,
          processing_ms: sessao.processing_ms,
          version: sessao.version,
          created_at: sessao.created_at,
          updated_at: sessao.updated_at,
          // ── Fix sessão 049: usar arquivos reais (JSONB leve: nome, path, mime)
          // para que a Tela 2 exiba "Processando N arquivos" corretamente.
          // O campo pesado é dados_extraidos (vários MB), não arquivos (~1KB).
          arquivos: sessao.arquivos ?? [],
          dados_extraidos: null,
          dados_confirmados: null,
          campos_faltando: [],
          confianca_campos: null,
          processo_arquivos: [],
          _lite: true,
        },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } },
      )
    }

    // 5. Status final — devolve tudo
    return NextResponse.json(
      {
        ...sessao,
        processo_arquivos: arquivosResult.data ?? [],
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
  } catch (err) {
    console.error('[GET sessoes] CATCH:', err instanceof Error ? `${err.name}: ${err.message}` : String(err))
    return NextResponse.json(
      { erro: 'Erro interno no servidor', detalhes: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PUT — auto-save de classificações e dados confirmados (Sprint 2 / Etapa 3a)
// ═══════════════════════════════════════════════════════════════════════════
//
// Consumido pelo debounce da Tela 2 a cada ~2s de inatividade. Atualiza:
//   (a) extracao_sessoes.dados_confirmados (jsonb do formulário revisado)
//   (b) processo_arquivos[] com destino_xml / destino_acervo / tipo_xsd
//
// Invariantes:
//   - Só aceita sessão em status "rascunho" ou "aguardando_revisao"
//     (sessões já convertidas ou em processamento ficam imutáveis).
//   - destino_processo é readonly=true no banco (trigger/constraint),
//     então NÃO o mandamos no UPDATE.
//   - Cada arquivo referenciado precisa pertencer à mesma sessão — defesa
//     contra ataque de modificar arquivo de outra sessão via ID forjado.
//   - CSRF-skip: chamada direta da UI autenticada.

const classificacaoArquivoSchema = z.object({
  id: z.string().uuid(),
  destino_xml: z.boolean(),
  destino_acervo: z.boolean(),
  tipo_xsd: z.enum(TIPOS_XSD_COMPROBATORIO).nullable().optional(),
})

const putBodySchema = z
  .object({
    dados_confirmados: z.record(z.string(), z.unknown()).nullable().optional(),
    arquivos: z.array(classificacaoArquivoSchema).optional(),
  })
  .refine(
    (data) =>
      data.dados_confirmados !== undefined || data.arquivos !== undefined,
    {
      message: 'Envie ao menos dados_confirmados ou arquivos',
    },
  )

// Sessão 074: convertido_em_processo também editável para revisão pós-auditoria XSD
const STATUS_EDITAVEIS = new Set(['rascunho', 'aguardando_revisao', 'concluido', 'convertido_em_processo'])

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Auth
  const auth = await verificarAuth(request)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  // 2. ID
  const { id: sessaoId } = await params
  if (
    !sessaoId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      sessaoId,
    )
  ) {
    return NextResponse.json({ erro: 'ID inválido' }, { status: 400 })
  }

  // 3. Body
  const bodyRaw = await request.json().catch(() => null)
  if (!bodyRaw) {
    return NextResponse.json({ erro: 'Body vazio ou inválido' }, { status: 400 })
  }
  const parsed = putBodySchema.safeParse(bodyRaw)
  if (!parsed.success) {
    return NextResponse.json(
      { erro: 'Body inválido', detalhes: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { dados_confirmados, arquivos } = parsed.data

  const supabase = await createClient()

  // 4. Valida que a sessão existe + pertence ao usuário + está em status editável
  const { data: sessao, error: errSessao } = await supabase
    .from('extracao_sessoes')
    .select('id, status, usuario_id, processo_id')
    .eq('id', sessaoId)
    .eq('usuario_id', userId)
    .maybeSingle<{ id: string; status: string; usuario_id: string; processo_id: string | null }>()

  if (errSessao) {
    console.error('[PUT /api/extracao/sessoes/[id]] erro:', errSessao.message)
    return NextResponse.json({ erro: 'Falha ao buscar sessão' }, { status: 500 })
  }
  if (!sessao) {
    return NextResponse.json({ erro: 'Sessão não encontrada' }, { status: 404 })
  }
  if (!STATUS_EDITAVEIS.has(sessao.status)) {
    return NextResponse.json(
      {
        erro: 'STATUS_NAO_EDITAVEL',
        mensagem: `Sessão em status "${sessao.status}" não pode ser editada`,
      },
      { status: 409 },
    )
  }

  // 4b. Se há processo vinculado, verifica se algum diploma está em status bloqueado
  // Diplomas assinados, registrados ou publicados não podem mais ter o formulário editado.
  const STATUS_DIPLOMA_BLOQUEADO = new Set([
    'assinado', 'registrado', 'rvdd_gerado', 'publicado',
  ])
  if (sessao.processo_id) {
    const { data: diplomasVinculados } = await supabase
      .from('diplomas')
      .select('id, status')
      .eq('processo_id', sessao.processo_id)
      .limit(50)

    const diplomaBloqueado = (diplomasVinculados ?? []).some(
      (d: { id: string; status: string }) => STATUS_DIPLOMA_BLOQUEADO.has(d.status)
    )
    if (diplomaBloqueado) {
      return NextResponse.json(
        {
          erro: 'DIPLOMA_PUBLICADO',
          mensagem: 'O processo possui diploma(s) publicado(s) ou assinado(s). A revisão está bloqueada.',
        },
        { status: 403 },
      )
    }
  }

  // 5. Atualiza dados_confirmados (se veio)
  if (dados_confirmados !== undefined) {
    const { error: errUp } = await supabase
      .from('extracao_sessoes')
      .update({
        dados_confirmados,
        status: sessao.status === 'concluido' ? 'rascunho' : sessao.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessaoId)
      .eq('usuario_id', userId)

    if (errUp) {
      console.error('[PUT sessoes] update dados_confirmados falhou:', errUp)
      return NextResponse.json(
        { erro: 'Falha ao salvar dados confirmados', detalhes: errUp.message },
        { status: 500 },
      )
    }
  }

  // 6. Atualiza classificações dos arquivos (se veio)
  if (arquivos && arquivos.length > 0) {
    // Defesa: confirmar que TODOS os arquivos pertencem à sessão antes
    // de atualizar. Impede que um operador autenticado modifique arquivo
    // de outra sessão passando IDs forjados.
    const ids = arquivos.map((a) => a.id)
    const { data: existentes, error: errList } = await supabase
      .from('processo_arquivos')
      .select('id, sessao_id')
      .in('id', ids)
      .returns<Array<{ id: string; sessao_id: string | null }>>()

    if (errList) {
      return NextResponse.json(
        { erro: 'Falha ao validar arquivos', detalhes: errList.message },
        { status: 500 },
      )
    }

    const existentesMap = new Map(
      (existentes ?? []).map((r) => [r.id, r.sessao_id]),
    )
    for (const a of arquivos) {
      const sessaoDoArquivo = existentesMap.get(a.id)
      if (!sessaoDoArquivo || sessaoDoArquivo !== sessaoId) {
        return NextResponse.json(
          {
            erro: 'ARQUIVO_NAO_PERTENCE_A_SESSAO',
            mensagem: `Arquivo ${a.id} não pertence a esta sessão`,
          },
          { status: 403 },
        )
      }
    }

    // Update individual (Supabase não tem bulk-update com valores distintos
    // por linha sem PL/pgSQL). Lista é pequena (~1-10 arquivos por sessão).
    for (const a of arquivos) {
      const { error: errUpArq } = await supabase
        .from('processo_arquivos')
        .update({
          destino_xml: a.destino_xml,
          destino_acervo: a.destino_acervo,
          tipo_xsd: a.tipo_xsd ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', a.id)
        .eq('sessao_id', sessaoId) // double-check em nível de WHERE

      if (errUpArq) {
        console.error('[PUT sessoes] update arquivo falhou:', errUpArq)
        return NextResponse.json(
          {
            erro: 'Falha ao salvar classificação de arquivo',
            arquivo_id: a.id,
            detalhes: errUpArq.message,
          },
          { status: 500 },
        )
      }
    }
  }

  return NextResponse.json(
    { ok: true, updated_at: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
