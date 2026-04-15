// =============================================================================
// Configuração — IA (Vercel AI SDK + OpenRouter)
// ERP Educacional FIC
// =============================================================================

import { createOpenAI } from '@ai-sdk/openai'
import { getIAConfig } from './openrouter'

// Modelo principal para extração de documentos (multimodal + tools)
// FALLBACK: OpenRouter format
export const MODELO_EXTRATOR = 'anthropic/claude-sonnet-4-6'

// Modelo leve para chat simples (perguntas, confirmações)
// FALLBACK: OpenRouter format
export const MODELO_CHAT = 'anthropic/claude-sonnet-4-6'

// Limites
export const MAX_TOKENS_RESPOSTA = 4096
export const MAX_IMAGENS_POR_CHAMADA = 10
export const MAX_TAMANHO_ARQUIVO_MB = 20

/**
 * Cria um provider OpenRouter via @ai-sdk/openai
 * Busca apiKey e modelo das configurações do sistema (Supabase)
 *
 * @param modulo - Módulo para buscar configuração (ex: "cadastro")
 * @param funcionalidade - Funcionalidade específica (ex: "extracao_cursos")
 * @returns { provider, modelo, temperatura }
 */
export async function criarProviderOpenRouter(modulo?: string, funcionalidade?: string) {
  const config = await getIAConfig(modulo, undefined, funcionalidade)

  if (!config.apiKey) {
    throw new Error(
      'API OpenRouter não configurada. Acesse Configurações → IA para adicionar sua chave.'
    )
  }

  const provider = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: config.apiKey,
    headers: {
      'HTTP-Referer': 'https://diploma-digital.vercel.app',
      'X-Title': 'FIC ERP Educacional',
    },
  })

  return {
    provider,
    modelo: config.modelo,
    temperatura: config.temperatura,
  }
}

// Tipos de arquivo aceitos
export const TIPOS_ACEITOS = {
  imagens: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  pdfs: ['application/pdf'],
  todos: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'],
}

// Extensões aceitas para upload
export const EXTENSOES_ACEITAS = '.jpg,.jpeg,.png,.webp,.gif,.pdf'
