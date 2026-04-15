// ============================================================
// PII ENCRYPTION — Criptografia de Dados Pessoais
// ERP Educacional FIC — Segurança Nível C
//
// Módulo TypeScript que faz interface com as funções pgcrypto
// do banco de dados para criptografar/descriptografar PII.
//
// Arquitetura V2 (Epic 1.2 — Sessão 056):
// - A chave de criptografia agora vive no SUPABASE VAULT
// - As RPCs (encrypt_pii/decrypt_pii/hash_cpf) leem do Vault
// - O Node.js NÃO precisa mais conhecer a chave
// - Fallback: se o Vault falhar, usa PII_ENCRYPTION_KEY do env
//
// Fluxo V2:
// 1. App chama RPC SEM passar chave (parâmetro DEFAULT NULL)
// 2. RPC tenta ler chave do Vault (get_vault_secret)
// 3. Se Vault falhar, RPC usa parâmetro como fallback
// 4. A chave nunca sai do banco de dados
// ============================================================

import { createClient } from '@/lib/supabase/server'

// ── Configuração V2 (Vault-first, env fallback) ─────────────

/**
 * Retorna a chave do env como fallback OPCIONAL.
 * Em V2, a prioridade é Vault (dentro da RPC).
 * Retorna undefined se não configurada (Vault será usado).
 */
function obterChaveFallback(): string | undefined {
  const chave = process.env.PII_ENCRYPTION_KEY

  if (!chave || chave.length < 32) {
    // Em V2, não ter a chave no env é OK — Vault fornece
    return undefined
  }

  return chave
}

// ── Tipos ────────────────────────────────────────────────────

export interface ResultadoCriptografia {
  sucesso: boolean
  erro?: string
}

export interface DadosCriptografados {
  cpf_hash: string
  cpf_encrypted: string // base64 do bytea
  rg_encrypted?: string
  email_encrypted?: string
}

// ── Funções de criptografia via RPC ──────────────────────────

/**
 * Criptografa um valor PII usando pgcrypto no banco.
 * V2: RPC lê chave do Vault. Env var é fallback opcional.
 */
export async function criptografarPII(valor: string): Promise<string | null> {
  if (!valor) return null

  const supabase = await createClient()
  const chaveFallback = obterChaveFallback()

  // Monta params: se tiver fallback, envia; senão, RPC usa Vault
  const params: Record<string, string> = { plaintext: valor }
  if (chaveFallback) params.encryption_key = chaveFallback

  const { data, error } = await supabase.rpc('encrypt_pii', params)

  if (error) {
    console.error('[PII] Erro ao criptografar:', error.message)
    throw new Error('Falha na criptografia de dados pessoais')
  }

  return data
}

/**
 * Descriptografa um valor PII criptografado.
 * V2: RPC lê chave do Vault. Env var é fallback opcional.
 */
export async function descriptografarPII(valorCriptografado: string): Promise<string | null> {
  if (!valorCriptografado) return null

  const supabase = await createClient()
  const chaveFallback = obterChaveFallback()

  const params: Record<string, string> = { encrypted_data: valorCriptografado }
  if (chaveFallback) params.encryption_key = chaveFallback

  const { data, error } = await supabase.rpc('decrypt_pii', params)

  if (error) {
    console.error('[PII] Erro ao descriptografar:', error.message)
    throw new Error('Falha na descriptografia de dados pessoais')
  }

  return data
}

/**
 * Gera hash SHA-256 salted de um CPF para busca segura.
 * V2: RPC lê salt do Vault. Env var é fallback opcional.
 */
export async function hashCPF(cpf: string): Promise<string> {
  const supabase = await createClient()
  const chaveFallback = obterChaveFallback()

  const params: Record<string, string> = { cpf_raw: cpf }
  if (chaveFallback) params.salt = chaveFallback

  const { data, error } = await supabase.rpc('hash_cpf', params)

  if (error) {
    console.error('[PII] Erro ao gerar hash de CPF:', error.message)
    throw new Error('Falha ao gerar hash de CPF')
  }

  return data
}

// ── Funções de alto nível ────────────────────────────────────

/**
 * Criptografa todos os campos PII de um diplomado de uma vez.
 * Retorna os valores criptografados prontos para salvar no banco.
 *
 * @example
 * ```ts
 * const encrypted = await criptografarDadosDiplomado({
 *   cpf: '12345678901',
 *   email: 'joao@email.com',
 *   rg: '123456789',
 * })
 * // Salvar encrypted.cpf_hash, encrypted.cpf_encrypted, etc.
 * ```
 */
export async function criptografarDadosDiplomado(dados: {
  cpf: string
  email?: string | null
  rg?: string | null
}): Promise<DadosCriptografados> {
  const [cpfHash, cpfEncrypted, emailEncrypted, rgEncrypted] = await Promise.all([
    hashCPF(dados.cpf),
    criptografarPII(dados.cpf),
    dados.email ? criptografarPII(dados.email) : Promise.resolve(null),
    dados.rg ? criptografarPII(dados.rg) : Promise.resolve(null),
  ])

  return {
    cpf_hash: cpfHash,
    cpf_encrypted: cpfEncrypted!,
    email_encrypted: emailEncrypted ?? undefined,
    rg_encrypted: rgEncrypted ?? undefined,
  }
}

/**
 * Busca um diplomado por CPF usando hash seguro.
 * O CPF nunca aparece em texto plano na query SQL.
 */
export async function buscarDiplomadoPorCPFSeguro(cpf: string) {
  const supabase = await createClient()
  const hash = await hashCPF(cpf)

  const { data, error } = await supabase
    .from('diplomados')
    .select('*')
    .eq('cpf_hash', hash)

  if (error) {
    console.error('[PII] Erro ao buscar diplomado por CPF:', error.message)
    throw new Error('Falha na busca por CPF')
  }

  return data
}

/**
 * Popula os campos criptografados para registros existentes.
 * Útil para migração inicial dos dados em texto plano.
 *
 * IMPORTANTE: Executar apenas uma vez, ou quando novos registros
 * forem inseridos sem criptografia.
 */
export async function migrarCriptografiaDiplomados(): Promise<{
  total: number
  migrados: number
  erros: number
}> {
  // Usa service_role para bypass de RLS (rota admin sem sessão Supabase)
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  // V2: chave é opcional — Vault fornece dentro da RPC
  const chave = obterChaveFallback()

  // Buscar diplomados sem hash
  const { data: pendentes, error } = await supabase
    .from('diplomados')
    .select('id, cpf, email, rg_numero')
    .is('cpf_hash', null)
    .limit(100) // Processar em lotes

  if (error || !pendentes) {
    return { total: 0, migrados: 0, erros: 1 }
  }

  let migrados = 0
  let erros = 0

  for (const registro of pendentes) {
    try {
      // Usar RPCs diretamente com o service_role client (não depende de cookies)
      const cpfLimpo = registro.cpf?.replace(/\D/g, '')
      if (!cpfLimpo || cpfLimpo.length !== 11) {
        console.warn(`[PII] CPF inválido para diplomado ${registro.id}, pulando`)
        erros++
        continue
      }

      // V2: Vault-first. Se chave env existir, passa como fallback
      const hashParams: Record<string, string> = { cpf_raw: cpfLimpo }
      if (chave) hashParams.salt = chave
      const encParams = (val: string) => {
        const p: Record<string, string> = { plaintext: val }
        if (chave) p.encryption_key = chave
        return p
      }

      const [hashRes, encCpfRes, encEmailRes, encRgRes] = await Promise.all([
        supabase.rpc('hash_cpf', hashParams),
        supabase.rpc('encrypt_pii', encParams(cpfLimpo)),
        registro.email ? supabase.rpc('encrypt_pii', encParams(registro.email)) : Promise.resolve({ data: null, error: null }),
        registro.rg_numero ? supabase.rpc('encrypt_pii', encParams(registro.rg_numero)) : Promise.resolve({ data: null, error: null }),
      ])

      if (hashRes.error || encCpfRes.error) {
        erros++
        console.error(`[PII] Erro RPC diplomado ${registro.id}:`, hashRes.error?.message || encCpfRes.error?.message)
        continue
      }

      const { error: updateError } = await supabase
        .from('diplomados')
        .update({
          cpf_hash: hashRes.data,
          cpf_encrypted: encCpfRes.data,
          email_encrypted: encEmailRes.data ?? undefined,
          rg_encrypted: encRgRes.data ?? undefined,
        })
        .eq('id', registro.id)

      if (updateError) {
        erros++
        console.error(`[PII] Erro ao migrar diplomado ${registro.id}:`, updateError.message)
      } else {
        migrados++
      }
    } catch (e) {
      erros++
      console.error(`[PII] Exceção ao migrar diplomado ${registro.id}:`, e)
    }
  }

  return { total: pendentes.length, migrados, erros }
}
