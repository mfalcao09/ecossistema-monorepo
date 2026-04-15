import { NextRequest, NextResponse } from 'next/server'
import type { ZodSchema } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { verificarPermissao } from '@/lib/supabase/rbac'
import { logAuthAttempt, logPermissionDenied } from '@/lib/security/security-logger'
import { validarCSRF } from '@/lib/security/csrf'
import type { AcaoPermissao } from '@/types/configuracoes'

// ── Tipos ───────────────────────────────────────────────────────────────────

/**
 * Contexto passado para handlers protegidos
 */
export interface AuthContext {
  userId: string
  tenantId: string
  email: string
  token?: string
  dadosValidados?: unknown
}

/**
 * Opções para protegerRota
 */
export interface ProtegerRotaOptions {
  skipCSRF?: boolean
  schema?: ZodSchema
}

/**
 * Opções para protegerRotaComPermissao (estende ProtegerRotaOptions)
 */
export interface ProtegerRotaComPermissaoOptions extends ProtegerRotaOptions {
  modulo: string
  acao: AcaoPermissao
}

// ── Constantes ──────────────────────────────────────────────────────────────

/**
 * Métodos HTTP que requerem validação CSRF
 */
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// ── Helper: buscar tenant do usuário logado ─────────────────────────────────

async function getTenantIdParaUsuario(userId: string): Promise<string | null> {
  const supabase = await createClient()

  // Busca pela tabela usuario_papeis para descobrir o tenant
  const { data } = await supabase
    .from('usuario_papeis')
    .select('tenant_id')
    .eq('user_id', userId)
    .limit(1)
    .single()

  if (data?.tenant_id) return data.tenant_id

  // Fallback: usa o primeiro tenant disponível (para admin sem papel ainda)
  const { data: inst } = await supabase
    .from('instituicoes')
    .select('id')
    .limit(1)
    .single()

  return inst?.id ?? null
}

// ── Autenticação (sem permissão) ────────────────────────────────────────────

/**
 * Verifica autenticação e retorna contexto ou NextResponse com erro.
 *
 * Aceita dois modos de autenticação:
 *   1. Cookie-based (padrão Next.js/Supabase) — o mais comum no ERP
 *   2. Bearer token no header Authorization — para chamadas API externas
 *
 * O createClient() do Supabase SSR já lê os cookies automaticamente,
 * então supabase.auth.getUser() funciona sem header Authorization.
 */
export async function verificarAuth(request: NextRequest): Promise<AuthContext | NextResponse> {
  const supabase = await createClient()

  // Obter token do header Authorization (se houver)
  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : undefined

  try {
    // getUser() funciona com cookies (padrão Next.js) OU com Bearer token
    const { data, error } = await supabase.auth.getUser()

    if (error || !data.user) {
      // Log auth failure (non-blocking)
      void logAuthAttempt(request, false, 'unknown', {
        motivo: 'Sessão inválida ou expirada',
        error: error?.message,
      })
      return NextResponse.json(
        { erro: 'Não autorizado: sessão inválida ou expirada' },
        { status: 401 }
      )
    }

    // Obter tenant_id real da tabela usuario_papeis
    const tenantId = await getTenantIdParaUsuario(data.user.id)

    if (!tenantId) {
      // Log permission denial due to missing tenant
      void logPermissionDenied(request, data.user.id, 'geral', 'acessar')
      return NextResponse.json(
        { erro: 'Acesso negado: nenhuma instituição associada' },
        { status: 403 }
      )
    }

    return {
      userId: data.user.id,
      tenantId,
      email: data.user.email ?? '',
      token: bearerToken,
    }
  } catch (err) {
    // Log unexpected error (non-blocking)
    void logAuthAttempt(request, false, 'unknown', {
      motivo: 'Erro ao verificar autenticação',
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json(
      { erro: 'Erro ao verificar autenticação' },
      { status: 500 }
    )
  }
}

// ── Autenticação + Autorização (com permissão RBAC) ─────────────────────────

/**
 * Verifica autenticação + permissão RBAC
 *
 * Substitui o antigo requireAuth(moduloSlug, acao) com:
 * - Busca de tenant real via usuario_papeis
 * - Mensagens de erro genéricas (sem vazamento de módulo/ação)
 *
 * @param request - NextRequest
 * @param moduloSlug - Slug do módulo (ex: 'pessoas', 'configuracoes')
 * @param acao - Ação requerida (ex: 'acessar', 'inserir', 'alterar', 'remover')
 * @returns AuthContext ou NextResponse (erro)
 *
 * @example
 * ```ts
 * const auth = await verificarAuthComPermissao(request, 'pessoas', 'inserir')
 * if (auth instanceof NextResponse) return auth
 * // auth.userId, auth.tenantId, auth.email disponíveis
 * ```
 */
export async function verificarAuthComPermissao(
  request: NextRequest,
  moduloSlug: string,
  acao: AcaoPermissao
): Promise<AuthContext | NextResponse> {
  // 1. Verificar autenticação
  const auth = await verificarAuth(request)
  if (auth instanceof NextResponse) return auth

  // 2. Verificar permissão RBAC
  const temPermissao = await verificarPermissao(auth.userId, moduloSlug, acao)

  if (!temPermissao) {
    // Log permission denial (non-blocking)
    void logPermissionDenied(request, auth.userId, moduloSlug, acao)
    return NextResponse.json(
      { erro: 'Acesso negado: permissão insuficiente' },
      { status: 403 }
    )
  }

  return auth
}

// ── Wrapper para rotas protegidas ───────────────────────────────────────────

/**
 * Wrapper para rotas protegidas SEM parâmetros dinâmicos
 * Usa verificarAuth para obter contexto
 *
 * Funcionalidades:
 * - Autenticação obrigatória
 * - Validação CSRF automática para mutations (POST/PUT/PATCH/DELETE)
 * - Validação de schema Zod (se fornecido)
 *
 * @param handler - Handler da rota
 * @param options - Opções (skipCSRF, schema)
 *
 * @example
 * ```ts
 * export const POST = protegerRota(async (request, auth) => {
 *   // auth.userId, auth.tenantId, auth.email disponíveis
 *   // Se schema foi fornecido, auth.dadosValidados contém os dados validados
 *   return NextResponse.json({ sucesso: true })
 * }, {
 *   schema: z.object({ nome: z.string() })
 * })
 * ```
 */
export function protegerRota(
  handler: (request: NextRequest, context: AuthContext) => Promise<NextResponse | Response>,
  options?: ProtegerRotaOptions
) {
  return async (request: NextRequest) => {
    // 1. Verificar autenticação
    const auth = await verificarAuth(request)
    if (auth instanceof NextResponse) {
      return auth
    }

    // 2. Validar CSRF para mutations (a menos que skipCSRF esteja true)
    if (!options?.skipCSRF && MUTATION_METHODS.has(request.method)) {
      const csrfError = validarCSRF(request)
      if (csrfError) {
        return csrfError
      }
    }

    // 3. Validar schema Zod (se fornecido e for mutation, exceto DELETE)
    if (
      options?.schema &&
      MUTATION_METHODS.has(request.method) &&
      request.method !== 'DELETE'
    ) {
      try {
        const body = await request.json()
        const result = options.schema.safeParse(body)

        if (!result.success) {
          return NextResponse.json(
            {
              erro: 'Dados inválidos',
              detalhes: result.error.flatten().fieldErrors,
            },
            { status: 400 }
          )
        }

        // Passar dados validados no contexto
        auth.dadosValidados = result.data
      } catch {
        return erroBadRequest('Corpo da requisição inválido')
      }
    }

    // 4. Executar o handler com o contexto de autenticação
    try {
      return await handler(request, auth)
    } catch (err) {
      console.error('Erro em protegerRota:', err)
      return erroInterno()
    }
  }
}

/**
 * Wrapper para rotas protegidas COM verificação de permissão RBAC
 *
 * Funcionalidades:
 * - Autenticação + verificação de permissão RBAC
 * - Validação CSRF automática para mutations
 * - Validação de schema Zod (se fornecido)
 *
 * @param handler - Handler da rota
 * @param options - Opções (modulo, acao, skipCSRF, schema)
 *
 * @example
 * ```ts
 * export const POST = protegerRotaComPermissao(
 *   async (request, auth) => {
 *     // auth.userId, auth.tenantId, auth.email disponíveis
 *     // Usuário tem permissão confirmada para modulo/acao
 *     return NextResponse.json({ sucesso: true })
 *   },
 *   {
 *     modulo: 'pessoas',
 *     acao: 'inserir',
 *     schema: z.object({ nome: z.string(), email: z.string().email() })
 *   }
 * )
 * ```
 */
export function protegerRotaComPermissao(
  handler: (request: NextRequest, context: AuthContext) => Promise<NextResponse | Response>,
  options: ProtegerRotaComPermissaoOptions
) {
  return async (request: NextRequest) => {
    // 1. Verificar autenticação + permissão RBAC
    const auth = await verificarAuthComPermissao(request, options.modulo, options.acao)
    if (auth instanceof NextResponse) {
      return auth
    }

    // 2. Validar CSRF para mutations (a menos que skipCSRF esteja true)
    if (!options?.skipCSRF && MUTATION_METHODS.has(request.method)) {
      const csrfError = validarCSRF(request)
      if (csrfError) {
        return csrfError
      }
    }

    // 3. Validar schema Zod (se fornecido e for mutation, exceto DELETE)
    if (
      options?.schema &&
      MUTATION_METHODS.has(request.method) &&
      request.method !== 'DELETE'
    ) {
      try {
        const body = await request.json()
        const result = options.schema.safeParse(body)

        if (!result.success) {
          return NextResponse.json(
            {
              erro: 'Dados inválidos',
              detalhes: result.error.flatten().fieldErrors,
            },
            { status: 400 }
          )
        }

        // Passar dados validados no contexto
        auth.dadosValidados = result.data
      } catch {
        return erroBadRequest('Corpo da requisição inválido')
      }
    }

    // 4. Executar o handler com o contexto de autenticação e autorização
    try {
      return await handler(request, auth)
    } catch (err) {
      console.error('Erro em protegerRotaComPermissao:', err)
      return erroInterno()
    }
  }
}

// ── Utilitários: respostas de erro padronizadas ─────────────────────────────

/**
 * Resposta 400 Bad Request padronizada
 */
export function erroBadRequest(mensagem: string) {
  return NextResponse.json({ erro: mensagem }, { status: 400 })
}

/**
 * Resposta 404 Not Found padronizada
 * SEGURANÇA: Usa mensagem genérica por padrão (sem revelar tipo de entidade)
 */
export function erroNaoEncontrado(mensagem = 'Recurso não encontrado.') {
  return NextResponse.json({ erro: mensagem }, { status: 404 })
}

/**
 * Resposta 500 Internal Server Error padronizada
 * SEGURANÇA: Nunca expõe detalhes internos ao cliente
 */
export function erroInterno(mensagem = 'Erro interno do servidor.') {
  return NextResponse.json({ erro: mensagem }, { status: 500 })
}
