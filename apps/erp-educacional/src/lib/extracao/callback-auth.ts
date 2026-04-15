/**
 * Sprint 2 / Etapa 1.2 — Autenticação do callback Railway → Next.js
 *
 * Estratégia aprovada por Marcelo (opção 1C): shared secret + nonce de 1 uso.
 *
 *  1. Ao iniciar a extração, geramos um `callback_nonce` aleatório (256 bits)
 *     e o persistimos em `extracao_sessoes.callback_nonce`.
 *  2. Embutimos o nonce na query string do `callback_url` enviado ao Railway:
 *         https://HOST/api/extracao/sessoes/{sessao_id}/callback?nonce={nonce}
 *     (o Railway trata a URL como opaque string — não precisa saber do nonce).
 *  3. Railway faz PUT nessa URL passando o header
 *         x-extracao-callback-secret: <EXTRACAO_CALLBACK_SECRET>
 *     que é o shared secret distribuído em Vercel + Railway (.env.local).
 *  4. O handler do callback:
 *     (a) valida o header com constant-time compare;
 *     (b) lê `nonce` da query;
 *     (c) faz um UPDATE atômico condicionado a `callback_nonce = $nonce AND
 *         callback_nonce_used_at IS NULL` e marca `callback_nonce_used_at = now()`.
 *
 * Replay protection = UPDATE retorna 0 linhas na segunda tentativa → 401.
 *
 * Motivação:
 *  - Shared secret sozinho dá acesso a qualquer sessão pra quem souber o valor.
 *  - HMAC por sessão protege contra reuso entre sessões, mas não contra replay
 *    da mesma sessão.
 *  - Nonce de 1 uso protege as duas coisas: só aceita 1 callback por sessão.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto'

/** Tamanho do nonce em bytes (256 bits = 64 hex chars). */
const NONCE_BYTES = 32

/**
 * Gera um nonce criptográfico hex-encoded (64 caracteres).
 * Usado na criação da sessão. Persistido em `extracao_sessoes.callback_nonce`.
 */
export function gerarCallbackNonce(): string {
  return randomBytes(NONCE_BYTES).toString('hex')
}

/**
 * Compara dois segredos em tempo constante pra evitar timing attacks.
 * Retorna false se qualquer um dos dois for vazio OU se os comprimentos
 * diferirem (o próprio timingSafeEqual lança quando os buffers têm tamanhos
 * diferentes, então precisamos tratar antes).
 */
export function comparaSecretoConstante(
  recebido: string | null | undefined,
  esperado: string | null | undefined,
): boolean {
  if (!recebido || !esperado) return false
  const a = Buffer.from(recebido, 'utf8')
  const b = Buffer.from(esperado, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Lê o shared secret do env. Lança erro descritivo se ausente,
 * pra falha rápida no boot da rota em vez de aceitar callbacks inválidos.
 */
export function obterCallbackSecret(): string {
  const secret = process.env.EXTRACAO_CALLBACK_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'EXTRACAO_CALLBACK_SECRET não configurada ou muito curta (mínimo 32 caracteres). ' +
        'Provisionar em .env.local, Vercel e Railway com o mesmo valor.',
    )
  }
  return secret
}

/**
 * Monta a URL de callback embutindo o nonce na query string.
 * Separar pra facilitar teste e garantir consistência com o handler PUT.
 *
 * @example
 *   montarCallbackUrl({
 *     baseUrl: 'https://gestao.ficcassilandia.com.br',
 *     sessaoId: 'abc-123',
 *     nonce: 'deadbeef...'
 *   })
 *   // → https://gestao.ficcassilandia.com.br/api/extracao/sessoes/abc-123/callback?nonce=deadbeef...
 */
export function montarCallbackUrl(params: {
  baseUrl: string
  sessaoId: string
  nonce: string
}): string {
  const base = params.baseUrl.replace(/\/+$/, '')
  const url = new URL(`${base}/api/extracao/sessoes/${params.sessaoId}/callback`)
  url.searchParams.set('nonce', params.nonce)
  return url.toString()
}

/**
 * Resolve a base URL pro callback a partir de env vars.
 * Ordem de prioridade: APP_URL explícita > VERCEL_URL > fallback de dev.
 * O Railway precisa conseguir resolver o host, então em dev local
 * isso só funciona com túnel (ngrok/cloudflared) ou EXTRACAO_ALLOW_LOCAL_URLS=1.
 */
export function obterBaseUrlPublica(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
  if (explicit) return explicit
  const vercel = process.env.VERCEL_URL
  if (vercel) return `https://${vercel}`
  return 'http://localhost:3000'
}
