import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * Helper para validar body de requisição com Zod
 *
 * Valida o corpo JSON da requisição contra um schema Zod e retorna
 * dados tipados ou um NextResponse 400 com mensagens de erro.
 *
 * @param request - NextRequest
 * @param schema - Schema Zod para validação
 * @returns Objeto com `dados` tipado (sucesso) ou `erro` (NextResponse 400)
 *
 * @example
 * // Em um route handler POST
 * const result = await validarBody(request, diplomadoSchema)
 * if (result.erro) return result.erro
 * const dados = result.dados  // tipo é inferido como typeof diplomadoSchema._output
 *
 * // Exemplo com tratamento:
 * const { dados, erro } = await validarBody(request, usuarioSchema)
 * if (erro) return erro
 * // dados agora é seguro para usar
 */
export async function validarBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>,
): Promise<{ dados: T; erro?: never } | { dados?: never; erro: NextResponse }> {
  try {
    // Parse body JSON
    let body: unknown
    try {
      body = await request.json()
    } catch (e) {
      return {
        erro: NextResponse.json(
          {
            erro: 'Corpo da requisição inválido',
            detalhes: 'JSON malformado',
          },
          { status: 400 },
        ),
      }
    }

    // Validate com Zod
    const resultado = schema.safeParse(body)

    if (!resultado.success) {
      // Formata erros de validação
      const erros = resultado.error.flatten()

      const mensagensErro: Record<string, string[]> = {}

      // Erros de campo
      if (erros.fieldErrors) {
        Object.entries(erros.fieldErrors).forEach(([campo, msgs]) => {
          mensagensErro[campo] = (msgs as string[] | undefined) || ['Erro de validação']
        })
      }

      // Erros genéricos
      if (erros.formErrors && erros.formErrors.length > 0) {
        mensagensErro._form = erros.formErrors
      }

      return {
        erro: NextResponse.json(
          {
            erro: 'Validação falhou',
            campos: mensagensErro,
          },
          { status: 400 },
        ),
      }
    }

    return { dados: resultado.data }
  } catch (erro) {
    console.error('Erro ao validar body:', erro)
    return {
      erro: NextResponse.json(
        {
          erro: 'Erro interno ao processar requisição',
        },
        { status: 500 },
      ),
    }
  }
}

/**
 * Helper para validar parâmetros de query
 *
 * @param queryParams - Objeto com parâmetros de query
 * @param schema - Schema Zod para validação
 * @returns Objeto com `dados` tipado ou `erro` (NextResponse 400)
 *
 * @example
 * const result = await validarQuery(request.nextUrl.searchParams, z.object({
 *   cpf: cpfSchema,
 *   turnstileToken: z.string(),
 * }))
 * if (result.erro) return result.erro
 * const { cpf, turnstileToken } = result.dados
 */
export async function validarQuery<T>(
  queryParams: URLSearchParams,
  schema: z.ZodSchema<T>,
): Promise<{ dados: T; erro?: never } | { dados?: never; erro: NextResponse }> {
  try {
    // Converte URLSearchParams para objeto
    const queryObj = Object.fromEntries(queryParams.entries())

    // Validate com Zod
    const resultado = schema.safeParse(queryObj)

    if (!resultado.success) {
      const erros = resultado.error.flatten()
      const mensagensErro: Record<string, string[]> = {}

      if (erros.fieldErrors) {
        Object.entries(erros.fieldErrors).forEach(([campo, msgs]) => {
          mensagensErro[campo] = (msgs as string[] | undefined) || ['Erro de validação']
        })
      }

      return {
        erro: NextResponse.json(
          {
            erro: 'Parâmetros de query inválidos',
            campos: mensagensErro,
          },
          { status: 400 },
        ),
      }
    }

    return { dados: resultado.data }
  } catch (erro) {
    console.error('Erro ao validar query:', erro)
    return {
      erro: NextResponse.json(
        {
          erro: 'Erro interno ao processar query',
        },
        { status: 500 },
      ),
    }
  }
}

/**
 * Helper para validar parâmetros de rota (params)
 *
 * @param params - Objeto com parâmetros de rota
 * @param schema - Schema Zod para validação
 * @returns Objeto com `dados` tipado ou `erro` (NextResponse 400)
 *
 * @example
 * export async function GET(request, { params }) {
 *   const result = await validarParams(params, z.object({ id: uuidSchema }))
 *   if (result.erro) return result.erro
 *   const { id } = result.dados
 * }
 */
export async function validarParams<T>(
  params: Record<string, string | string[]>,
  schema: z.ZodSchema<T>,
): Promise<{ dados: T; erro?: never } | { dados?: never; erro: NextResponse }> {
  try {
    // Normaliza array params para string (pega primeiro valor)
    const paramsObj = Object.entries(params).reduce(
      (acc, [key, value]) => {
        acc[key] = Array.isArray(value) ? value[0] : value
        return acc
      },
      {} as Record<string, string>,
    )

    // Validate com Zod
    const resultado = schema.safeParse(paramsObj)

    if (!resultado.success) {
      const erros = resultado.error.flatten()
      const mensagensErro: Record<string, string[]> = {}

      if (erros.fieldErrors) {
        Object.entries(erros.fieldErrors).forEach(([campo, msgs]) => {
          mensagensErro[campo] = (msgs as string[] | undefined) || ['Erro de validação']
        })
      }

      return {
        erro: NextResponse.json(
          {
            erro: 'Parâmetros de rota inválidos',
            campos: mensagensErro,
          },
          { status: 400 },
        ),
      }
    }

    return { dados: resultado.data }
  } catch (erro) {
    console.error('Erro ao validar params:', erro)
    return {
      erro: NextResponse.json(
        {
          erro: 'Erro interno ao processar parâmetros',
        },
        { status: 500 },
      ),
    }
  }
}
