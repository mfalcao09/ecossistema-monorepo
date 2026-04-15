// ============================================================
// POST /api/admin/migrate-secrets-to-vault
// Rota TEMPORARIA para migrar secrets de env vars para Supabase Vault.
//
// O QUE FAZ:
// 1. Le PII_ENCRYPTION_KEY do process.env (so existe no runtime Vercel)
// 2. Insere no Supabase Vault via RPC insert_vault_secret()
// 3. Verifica se a chave no Vault descriptografa dados existentes
//
// SEGURANCA: Protegida por ADMIN_SECRET (env var)
// QUANDO REMOVER: Imediatamente apos execucao bem-sucedida
//
// Epic 1.2 — Sprint 1 Seguranca (Sessao 056)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  // ── 1. Verificar autenticacao admin ──────────────────────
  const authHeader = request.headers.get('authorization')
  const adminSecret = process.env.ADMIN_SECRET

  if (!adminSecret) {
    return NextResponse.json(
      { error: 'ADMIN_SECRET nao configurada no ambiente' },
      { status: 500 }
    )
  }

  if (authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json(
      { error: 'Acesso nao autorizado' },
      { status: 401 }
    )
  }

  // ── 2. Ler secrets do env ────────────────────────────────
  const piiKey = process.env.PII_ENCRYPTION_KEY
  if (!piiKey || piiKey.length < 32) {
    return NextResponse.json(
      { error: 'PII_ENCRYPTION_KEY ausente ou muito curta no env' },
      { status: 500 }
    )
  }

  // ── 3. Conectar ao Supabase como service_role ────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'SUPABASE_URL ou SERVICE_ROLE_KEY ausentes' },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const results: Record<string, string> = {}

  // ── 4. Inserir PII_ENCRYPTION_KEY no Vault via RPC ───────
  try {
    const { data, error } = await supabase.rpc('insert_vault_secret', {
      p_secret_value: piiKey,
      p_secret_name: 'pii_encryption_key',
      p_description: 'PII encryption key migrada do env var Vercel — Epic 1.2 Sprint 1'
    })

    if (error) {
      results.pii_encryption_key = `ERRO_RPC: ${error.message}`
    } else {
      results.pii_encryption_key = String(data)
    }
  } catch (e) {
    results.pii_encryption_key = `EXCECAO: ${(e as Error).message}`
  }

  // ── 5. Verificacao: descriptografar um registro existente ─
  try {
    const { data: testData } = await supabase
      .from('diplomados')
      .select('cpf_encrypted')
      .not('cpf_encrypted', 'is', null)
      .limit(1)
      .single()

    if (testData?.cpf_encrypted) {
      // Tentar descriptografar SEM passar chave (Vault deve fornecer)
      const { data: decrypted, error: decryptError } = await supabase
        .rpc('decrypt_pii', {
          encrypted_data: testData.cpf_encrypted
        })

      if (decryptError) {
        // Tentar com a chave do env como fallback
        const { data: dec2, error: err2 } = await supabase
          .rpc('decrypt_pii', {
            encrypted_data: testData.cpf_encrypted,
            encryption_key: piiKey
          })

        if (err2) {
          results.verificacao_vault = `FALHOU: ${decryptError.message}`
          results.verificacao_fallback = `FALHOU: ${err2.message}`
        } else {
          results.verificacao_vault = `FALHOU: ${decryptError.message}`
          results.verificacao_fallback = `OK (${String(dec2 || '').length} chars) — chave env funciona`
        }
      } else {
        results.verificacao_vault = `OK — Vault funciona! (${String(decrypted || '').length} chars descriptografados)`
      }
    } else {
      results.verificacao = 'SEM_DADOS_CRIPTOGRAFADOS_PARA_TESTAR'
    }
  } catch (e) {
    results.verificacao = `EXCECAO: ${(e as Error).message}`
  }

  // ── 6. Retornar resultados (NUNCA retornar a chave!) ─────
  return NextResponse.json({
    status: 'concluido',
    keyLength: piiKey.length,
    results,
    nota: 'REMOVER ESTA ROTA E A RPC insert_vault_secret APOS USO'
  })
}
