/**
 * Sprint 2 / Etapa 1.2 — POST /api/extracao/iniciar
 *
 * Proxy fino Next.js → Railway (`diploma-digital-production.up.railway.app`).
 *
 * Fluxo:
 *  1. Autentica usuário via `protegerRota` (CSRF desativado; é chamada direta da UI).
 *  2. Valida payload com Zod (lista de arquivos já uploadados no Supabase Storage).
 *  3. Gera `callback_nonce` (256 bits, 1 uso) e persiste a sessão em
 *     `extracao_sessoes` com status='processando'. O índice parcial único
 *     (processo_id | usuario_id) garante lock lógico: só 1 extração ativa.
 *  4. Gera signed URLs (TTL 10 min) para cada arquivo — Railway baixa direto
 *     do Supabase sem precisar de service_role_key.
 *  5. Carrega config do agente de diploma (modelo + api_key do provider Google).
 *  6. Fire-and-forget para Railway (`.catch()` só loga; callback eventualmente
 *     registra erro na sessão se o POST falhar).
 *  7. Retorna 202 com sessao_id + nonce_hash (os dois primeiros chars só pra
 *     conferência de log — NÃO expor o nonce completo).
 *
 * Decisões Marcelo (sessão atual):
 *  - 1C: nonce 1-uso no callback (replay-safe)
 *  - 2B: signed URL TTL = 600s (10 min)
 *  - 3B: lock por processo_id (+ usuario_id quando processo ainda não existe)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { protegerRota } from '@/lib/security/api-guard'
import { gerarCallbackNonce } from '@/lib/extracao/callback-auth'

// Vercel function config — handler retorna rápido (fire-and-forget),
// mas subimos pra 60s por segurança no setup das signed URLs.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// ─── Admin client (service role) ────────────────────────────────────────────

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// ─── Schema de entrada ──────────────────────────────────────────────────────

const arquivoSchema = z.object({
  storage_path: z.string().min(1),
  bucket: z.string().min(1).default('processo-arquivos'),
  nome_original: z.string().min(1),
  mime_type: z.string().min(1),
  tamanho_bytes: z.number().int().nonnegative().nullable().optional(),
})

const iniciarSchema = z.object({
  arquivos: z.array(arquivoSchema).min(1, 'Envie pelo menos 1 arquivo'),
  processo_id: z.string().uuid().nullable().optional(),
})

type ArquivoInput = z.infer<typeof arquivoSchema>

// ─── Helpers ────────────────────────────────────────────────────────────────

const SIGNED_URL_TTL = 600 // 10 minutos (decisão 2B)

async function gerarSignedUrls(
  admin: ReturnType<typeof getAdminClient>,
  arquivos: ArquivoInput[],
): Promise<
  Array<{
    signed_url: string
    mime_type: string
    nome_original: string
  }>
> {
  const resultado: Array<{
    signed_url: string
    mime_type: string
    nome_original: string
  }> = []

  for (const arq of arquivos) {
    const { data, error } = await admin.storage
      .from(arq.bucket)
      .createSignedUrl(arq.storage_path, SIGNED_URL_TTL)

    if (error || !data?.signedUrl) {
      throw new Error(
        `Falha ao gerar signed URL para ${arq.nome_original}: ${error?.message || 'signedUrl vazio'}`,
      )
    }

    resultado.push({
      signed_url: data.signedUrl,
      mime_type: arq.mime_type,
      nome_original: arq.nome_original,
    })
  }

  return resultado
}

/**
 * Busca a API key do provider Google usado pelo agente de extração de diploma.
 * Mesma lógica da rota legada /api/ia/processar-docs, centralizada aqui.
 */
async function obterGeminiConfig(
  admin: ReturnType<typeof getAdminClient>,
): Promise<{ api_key: string; modelo: string }> {
  const { data: agente, error: agErr } = await admin
    .from('ia_configuracoes')
    .select('modelo, provider_id')
    .eq('ativo', true)
    .eq('modulo', 'diploma')
    .eq('funcionalidade', 'processamento_dados')
    .limit(1)
    .single()

  if (agErr || !agente) {
    throw new Error(
      'Agente de extração de diploma não encontrado ou inativo em ia_configuracoes.',
    )
  }

  const { data: provider, error: provErr } = await admin
    .from('ia_providers')
    .select('api_key, slug')
    .eq('id', agente.provider_id)
    .eq('ativo', true)
    .limit(1)
    .single()

  if (provErr || !provider?.api_key) {
    throw new Error(
      `Provider ${agente.provider_id} não encontrado ou sem api_key configurada.`,
    )
  }

  return {
    api_key: provider.api_key as string,
    modelo: (agente.modelo as string) || 'gemini-2.5-flash',
  }
}

/**
 * Marca uma sessão como erro quando a chamada ao Railway falha depois
 * do INSERT já ter acontecido. Extraído pra evitar duplicação entre
 * o catch do fetch e o ramo de !res.ok.
 */
async function marcarSessaoComoErro(
  admin: ReturnType<typeof getAdminClient>,
  sessaoId: string,
  mensagem: string,
): Promise<void> {
  // Só marca como erro se a sessão ainda estiver em 'processando'.
  // Se o callback do Railway já tiver chegado e gravado resultado (rascunho),
  // NÃO queremos sobrescrever — o callback é a fonte da verdade.
  const { data, error } = await admin
    .from('extracao_sessoes')
    .update({
      status: 'erro',
      erro_mensagem: mensagem.slice(0, 2000),
      finalizado_em: new Date().toISOString(),
    })
    .eq('id', sessaoId)
    .eq('status', 'processando')
    .select('id')

  if (error) {
    console.error(
      `[extracao/iniciar] Falha ao marcar sessão ${sessaoId} como erro:`,
      error.message,
    )
    return
  }

  if (!data || data.length === 0) {
    // Race benigna: callback do Railway chegou antes deste update.
    // Log só para observabilidade — não é bug.
    console.warn(
      `[extracao/iniciar] Sessão ${sessaoId} já saiu de 'processando' antes do marcar-como-erro (provavelmente callback do Railway chegou primeiro). Mantendo estado atual.`,
    )
  }
}

// ─── Handler ────────────────────────────────────────────────────────────────

export const POST = protegerRota(
  async (request: NextRequest, { userId }) => {
    // 1. Parse + valida payload
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { erro: 'JSON inválido' },
        { status: 400 },
      )
    }

    const parsed = iniciarSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          erro: 'Payload inválido',
          detalhes: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      )
    }

    const { arquivos, processo_id } = parsed.data
    const admin = getAdminClient()

    // 2. Pré-requisitos de ambiente (falha rápida antes de alocar linha no DB)
    const converterUrl = process.env.DOCUMENT_CONVERTER_URL
    const converterApiKey = process.env.CONVERTER_API_KEY
    if (!converterUrl || !converterApiKey) {
      return NextResponse.json(
        {
          erro:
            'DOCUMENT_CONVERTER_URL / CONVERTER_API_KEY não configuradas no ambiente',
        },
        { status: 500 },
      )
    }

    // 3. Carrega chave Gemini do agente configurado
    let geminiConfig: { api_key: string; modelo: string }
    try {
      geminiConfig = await obterGeminiConfig(admin)
    } catch (err) {
      return NextResponse.json(
        { erro: err instanceof Error ? err.message : 'Erro ao obter config IA' },
        { status: 500 },
      )
    }

    // 4. Expira sessões órfãs antes de tentar criar a nova.
    //    Sessões 'processando' há mais de SESSAO_TTL_MIN minutos são
    //    consideradas órfãs (Railway crashou, timeout, navegador fechado
    //    antes do callback, etc.) e marcadas como 'erro' automaticamente.
    //    Isso destrava o UNIQUE INDEX parcial e permite novo upload do usuário.
    //    Ver sessão 032 / memória orphan-session-fix.
    const SESSAO_TTL_MIN = 15
    try {
      await admin
        .from('extracao_sessoes')
        .update({
          status: 'erro',
          erro_mensagem: `Sessão expirada automaticamente (TTL ${SESSAO_TTL_MIN}min). Provável timeout, queda de rede ou navegador fechado antes do callback.`,
          finalizado_em: new Date().toISOString(),
        })
        .eq('usuario_id', userId)
        .eq('status', 'processando')
        .lt('iniciado_em', new Date(Date.now() - SESSAO_TTL_MIN * 60_000).toISOString())
    } catch (err) {
      // Não bloqueia — se falhar, o INSERT abaixo ainda pode passar.
      console.warn('[extracao/iniciar] Falha ao expirar sessões órfãs:', err)
    }

    // 5. Gera nonce e cria sessão (UNIQUE INDEX parcial atua como lock)
    const nonce = gerarCallbackNonce()

    const { data: sessao, error: sessErr } = await admin
      .from('extracao_sessoes')
      .insert({
        usuario_id: userId,
        processo_id: processo_id ?? null,
        status: 'processando',
        arquivos,
        dados_extraidos: {},
        version: 1,
        callback_nonce: nonce,
        iniciado_em: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (sessErr || !sessao) {
      // 23505 = unique_violation → lock ativo (já tem extração processando)
      if ((sessErr as { code?: string } | null)?.code === '23505') {
        // Busca a sessão ativa para devolver o ID ao cliente — assim a Tela 1
        // pode oferecer "Continuar extração anterior" em vez de só dar erro.
        const { data: sessaoExistente } = await admin
          .from('extracao_sessoes')
          .select('id, status, iniciado_em')
          .eq('usuario_id', userId)
          .in('status', ['processando', 'rascunho', 'aguardando_revisao'])
          .order('iniciado_em', { ascending: false })
          .limit(1)
          .maybeSingle()

        return NextResponse.json(
          {
            erro:
              'Já existe uma extração em andamento. Você pode continuar de onde parou ou descartar o rascunho.',
            codigo: 'EXTRACAO_EM_ANDAMENTO',
            sessao_existente: sessaoExistente?.id ?? null,
            status_existente: sessaoExistente?.status ?? null,
          },
          { status: 409 },
        )
      }
      return NextResponse.json(
        { erro: sessErr?.message || 'Falha ao criar sessão de extração' },
        { status: 500 },
      )
    }

    // 5b. Sessão 074: "Processo nasce no Upload"
    //     Cria processos_emissao com status='em_extracao' e nome=null.
    //     O nome (CPF - NOME) e demais dados são preenchidos na etapa de
    //     revisão, quando o operador clica em "Confirmar dados".
    //     Isso garante que o processo aparece imediatamente na lista e
    //     que o fluxo de auditoria tem um processo_id desde o início.
    let processoIdEfetivo: string | null = processo_id ?? null
    try {
      const { data: processoNovo, error: errProcesso } = await admin
        .from('processos_emissao')
        .insert({
          status: 'em_extracao',
          sessao_id: sessao.id,
          created_by: userId,
        })
        .select('id')
        .single()

      if (errProcesso) {
        console.error(
          '[extracao/iniciar] Falha ao criar processos_emissao (não bloqueante):',
          errProcesso.message,
        )
      } else if (processoNovo) {
        processoIdEfetivo = processoNovo.id
        // Atualiza extracao_sessoes.processo_id para apontar ao processo recém-criado
        const { error: errLinkProcesso } = await admin
          .from('extracao_sessoes')
          .update({ processo_id: processoNovo.id })
          .eq('id', sessao.id)
        if (errLinkProcesso) {
          console.error(
            '[extracao/iniciar] Falha ao vincular processo_id na sessão:',
            errLinkProcesso.message,
          )
        }
      }
    } catch (err) {
      console.error(
        '[extracao/iniciar] Exceção ao criar processos_emissao:',
        err instanceof Error ? err.message : err,
      )
    }

    // 5c. Cria linhas em processo_arquivos para cada arquivo da sessão.
    //     Sem isso, o gate de comprobatórios (que lê processo_arquivos.tipo_xsd
    //     do banco) vê 0 linhas → reporta TODOS os comprobatórios como faltantes,
    //     mesmo que a sidebar mostre "4/4 confirmados" (que roda in-memory).
    //     Fix definitivo — sessão 062 (bug "gate desincronizado").
    try {
      const rowsPA = arquivos.map((arq: ArquivoInput) => ({
        sessao_id: sessao.id,
        processo_id: processoIdEfetivo,
        nome_original: arq.nome_original,
        storage_path: arq.storage_path,
        mime_type: arq.mime_type,
        tamanho_bytes: arq.tamanho_bytes ?? 0,
        uploaded_by: userId,
      }))

      const { error: errPA } = await admin
        .from('processo_arquivos')
        .insert(rowsPA)

      if (errPA) {
        console.error(
          '[extracao/iniciar] Falha ao criar processo_arquivos (não bloqueante):',
          errPA.message,
        )
        // Não bloqueia: a extração pode prosseguir; o gate vai falhar
        // com override disponível. Log pra investigação.
      }
    } catch (err) {
      console.error(
        '[extracao/iniciar] Exceção ao criar processo_arquivos:',
        err instanceof Error ? err.message : err,
      )
    }

    // 6. Gera signed URLs (se falhar, marca sessão como erro antes de retornar)
    let arquivosComUrl: Awaited<ReturnType<typeof gerarSignedUrls>>
    try {
      arquivosComUrl = await gerarSignedUrls(admin, arquivos)
    } catch (err) {
      await admin
        .from('extracao_sessoes')
        .update({
          status: 'erro',
          erro_mensagem:
            err instanceof Error
              ? err.message
              : 'Erro desconhecido ao gerar signed URLs',
          finalizado_em: new Date().toISOString(),
        })
        .eq('id', sessao.id)

      return NextResponse.json(
        {
          erro: 'Falha ao gerar signed URLs para os arquivos',
          detalhe: err instanceof Error ? err.message : String(err),
          sessao_id: sessao.id,
        },
        { status: 500 },
      )
    }

    // 6. POST sincrono para Railway (AWAIT, não fire-and-forget)
    //    Razão: em Vercel serverless, `fetch()` sem await é cancelado quando
    //    o handler retorna (o Node.js encerra conexões HTTP ativas). Então
    //    temos que esperar o POST completar.
    //
    //    Isso é barato: o Railway retorna 202 em ~100-500ms (ele próprio usa
    //    fire-and-forget internamente via setImmediate no handler). O
    //    processamento longo (60-180s) acontece no background do Railway,
    //    que depois grava o resultado DIRETAMENTE em extracao_sessoes via
    //    service_role (refatoramento "DB Write Direto" — sessão 033, 09/04).
    //    Não há mais callback HTTP — o canal foi eliminado por gerar bugs
    //    consecutivos (307 middleware, timeout, nonce race).
    //
    //    AbortSignal.timeout(15s) previne que uma travada no Railway estoure
    //    o maxDuration desta rota.
    const railwayPayload = {
      sessao_id: sessao.id,
      arquivos: arquivosComUrl,
      gemini_api_key: geminiConfig.api_key,
      modelo: geminiConfig.modelo,
    }

    try {
      const res = await fetch(
        `${converterUrl.replace(/\/+$/, '')}/extrair-documentos`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': converterApiKey,
          },
          body: JSON.stringify(railwayPayload),
          cache: 'no-store',
          signal: AbortSignal.timeout(15_000), // 15s p/ o POST do 202
        },
      )

      if (!res.ok) {
        const texto = await res.text().catch(() => '')
        console.error(
          `[extracao/iniciar] Railway retornou ${res.status}: ${texto}`,
        )
        await marcarSessaoComoErro(
          admin,
          sessao.id,
          `Railway ${res.status}: ${texto.slice(0, 500)}`,
        )
        return NextResponse.json(
          {
            erro: `Microserviço de extração rejeitou a requisição (HTTP ${res.status})`,
            sessao_id: sessao.id,
          },
          { status: 502 },
        )
      }
    } catch (err) {
      console.error(
        '[extracao/iniciar] Falha ao chamar Railway:',
        err instanceof Error ? err.message : err,
      )
      await marcarSessaoComoErro(
        admin,
        sessao.id,
        `Falha ao contatar Railway: ${err instanceof Error ? err.message : String(err)}`,
      )
      return NextResponse.json(
        {
          erro:
            'Não foi possível contatar o microserviço de extração. Tente novamente em alguns segundos.',
          sessao_id: sessao.id,
        },
        { status: 502 },
      )
    }

    // 8. Railway aceitou (202). A extração roda em background e vai chamar
    //    nosso PUT /callback quando terminar. Frontend faz polling.
    return NextResponse.json(
      {
        sessao_id: sessao.id,
        processo_id: processoIdEfetivo, // sessão 074: processo criado no upload
        status: 'processando',
        version: 1,
        total_arquivos: arquivos.length,
      },
      { status: 202 },
    )
  },
  { skipCSRF: true },
)
