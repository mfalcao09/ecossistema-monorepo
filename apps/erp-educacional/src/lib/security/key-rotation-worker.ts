// ============================================================
// KEY ROTATION WORKER — Re-criptografia em Lote
// ERP Educacional FIC — Data: 2026-03-26
//
// Utilitário para varrer tabelas e re-criptografar dados PII
// antigos com a versão de chave ativa.
//
// Fluxo:
// 1. Identificar registros criptografados com versão antiga
// 2. Processar em lotes para não sobrecarregar
// 3. Re-criptografar cada campo com encryptPII()
// 4. Atualizar banco com novos ciphertexts
// 5. Registrar progresso em logs
//
// Uso:
// ```ts
// await reEncryptTable('pessoas', 'cpf_criptografado', 100)
// await reEncryptTable('diplomados', 'email_criptografado', 50)
// ```
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { reEncryptWithCurrentKey, getCurrentKeyVersion, decryptPII } from './key-rotation'

// ── Tipos ────────────────────────────────────────────────────

export interface ReEncryptionOptions {
  batchSize?: number
  dryRun?: boolean
  logProgress?: boolean
  stopOnError?: boolean
}

export interface ReEncryptionResult {
  table: string
  column: string
  totalRecords: number
  processedRecords: number
  reEncryptedRecords: number
  failedRecords: number
  skippedRecords: number
  duration: number // ms
  error?: string
}

interface ColumnConfig {
  name: string
  isForeignKey?: boolean
}

// ── Worker Privado ──────────────────────────────────────────

/**
 * Verifica se um ciphertext foi criptografado com versão anterior
 * à versão ativa. Retorna true se precisa ser re-criptografado.
 */
function needsReEncryption(ciphertext: string, activeVersion: number): boolean {
  if (!ciphertext || !ciphertext.startsWith('v')) {
    return true // Dados não versionados precisam de criptografia
  }

  const versionPart = ciphertext.split(':')[0]
  const version = parseInt(versionPart.substring(1), 10)

  return version < activeVersion
}

/**
 * Obtém o número total de registros em uma tabela.
 */
async function getRecordCount(table: string): Promise<number> {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })

  if (error) {
    throw new Error(`Erro ao contar registros em ${table}: ${error.message}`)
  }

  return count || 0
}

/**
 * Busca um lote de registros de uma tabela.
 */
async function fetchBatch(
  table: string,
  column: string,
  offset: number,
  limit: number
): Promise<Array<{ id: string; [key: string]: unknown }>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from(table)
    .select('id, ' + column)
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) {
    throw new Error(`Erro ao buscar lote de ${table}: ${error.message}`)
  }

  return (data as unknown as Array<{ id: string; [key: string]: unknown }>) || []
}

/**
 * Atualiza um registro com novo valor criptografado.
 */
async function updateRecord(table: string, id: string, column: string, newValue: string): Promise<boolean> {
  const supabase = await createClient()

  const updatePayload: { [key: string]: string } = {}
  updatePayload[column] = newValue

  const { error } = await supabase
    .from(table)
    .update(updatePayload)
    .eq('id', id)

  return !error
}

/**
 * Registra o progresso de re-criptografia no console/logs.
 */
function logProgress(
  table: string,
  column: string,
  processed: number,
  total: number,
  reEncrypted: number,
  failed: number,
  batchNum: number
): void {
  const percent = ((processed / total) * 100).toFixed(1)
  const msg = `[KEY-ROTATION-WORKER] ${table}.${column} — Lote ${batchNum}: ${processed}/${total} (${percent}%) | Re-criptografados: ${reEncrypted} | Erros: ${failed}`
  console.info(msg)
}

// ── Funções Públicas ─────────────────────────────────────────

/**
 * Re-criptografa todos os registros de uma coluna em uma tabela
 * com a versão de chave ativa.
 *
 * @param table Nome da tabela (ex: 'pessoas', 'diplomados')
 * @param column Nome da coluna com dados criptografados (ex: 'cpf_criptografado')
 * @param options Configurações opcionais (batchSize, dryRun, etc.)
 * @returns Resultado com estatísticas de re-criptografia
 *
 * @example
 * ```ts
 * const result = await reEncryptTable('pessoas', 'cpf_criptografado', {
 *   batchSize: 100,
 *   dryRun: false,
 *   logProgress: true,
 * })
 *
 * console.log(`Re-criptografados: ${result.reEncryptedRecords}`)
 * console.log(`Falhados: ${result.failedRecords}`)
 * ```
 */
export async function reEncryptTable(
  table: string,
  column: string,
  options: ReEncryptionOptions = {}
): Promise<ReEncryptionResult> {
  const startTime = Date.now()
  const {
    batchSize = 100,
    dryRun = false,
    logProgress: shouldLog = true,
    stopOnError = false,
  } = options

  let totalRecords = 0
  let processedRecords = 0
  let reEncryptedRecords = 0
  let failedRecords = 0
  let skippedRecords = 0

  try {
    // Obter versão ativa
    const activeVersion = getCurrentKeyVersion()

    // Contar total de registros
    totalRecords = await getRecordCount(table)

    if (totalRecords === 0) {
      return {
        table,
        column,
        totalRecords: 0,
        processedRecords: 0,
        reEncryptedRecords: 0,
        failedRecords: 0,
        skippedRecords: 0,
        duration: Date.now() - startTime,
      }
    }

    console.info(
      `[KEY-ROTATION-WORKER] Iniciando re-criptografia de ${table}.${column} (${totalRecords} registros, versão ativa: v${activeVersion})`
    )

    // Processar em lotes
    let batchNum = 0
    for (let offset = 0; offset < totalRecords; offset += batchSize) {
      batchNum++

      // Buscar lote
      const batch = await fetchBatch(table, column, offset, batchSize)

      for (const record of batch) {
        const id = String(record.id)
        const currentValue = String(record[column] || '')

        processedRecords++

        // Pular se vazio ou null
        if (!currentValue) {
          skippedRecords++
          continue
        }

        // Verificar se precisa de re-criptografia
        if (!needsReEncryption(currentValue, activeVersion)) {
          skippedRecords++
          continue
        }

        try {
          // Re-criptografar
          const reEncrypted = reEncryptWithCurrentKey(currentValue)

          if (!reEncrypted.success || !reEncrypted.data) {
            throw new Error(reEncrypted.error || 'Falha na re-criptografia')
          }

          // Atualizar no banco (se não for dry-run)
          if (!dryRun) {
            const updated = await updateRecord(table, id, column, reEncrypted.data)
            if (!updated) {
              throw new Error('Falha ao atualizar registro no banco')
            }
          }

          reEncryptedRecords++
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Erro desconhecido'
          console.error(`[KEY-ROTATION-WORKER] Erro ao processar ${table} ID ${id}: ${msg}`)
          failedRecords++

          if (stopOnError) {
            throw error
          }
        }
      }

      // Log de progresso
      if (shouldLog) {
        logProgress(table, column, processedRecords, totalRecords, reEncryptedRecords, failedRecords, batchNum)
      }
    }

    console.info(
      `[KEY-ROTATION-WORKER] Conclusão de ${table}.${column}: ${reEncryptedRecords} re-criptografados, ${failedRecords} erros, ${skippedRecords} pulados`
    )

    return {
      table,
      column,
      totalRecords,
      processedRecords,
      reEncryptedRecords,
      failedRecords,
      skippedRecords,
      duration: Date.now() - startTime,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error(`[KEY-ROTATION-WORKER] Falha crítica em ${table}.${column}: ${message}`)

    return {
      table,
      column,
      totalRecords,
      processedRecords,
      reEncryptedRecords,
      failedRecords,
      skippedRecords,
      duration: Date.now() - startTime,
      error: message,
    }
  }
}

/**
 * Re-criptografa múltiplas colunas em múltiplas tabelas.
 * Útil para rotação completa do sistema.
 *
 * @param jobs Array com especificação de tabelas/colunas
 * @param options Configurações globais
 * @returns Array com resultado de cada job
 *
 * @example
 * ```ts
 * const results = await reEncryptBatch([
 *   { table: 'pessoas', column: 'cpf_criptografado' },
 *   { table: 'pessoas', column: 'email_criptografado' },
 *   { table: 'diplomados', column: 'cpf_criptografado' },
 * ], { batchSize: 50 })
 *
 * const totalReEncrypted = results.reduce((sum, r) => sum + r.reEncryptedRecords, 0)
 * console.log(`Total re-criptografados: ${totalReEncrypted}`)
 * ```
 */
export async function reEncryptBatch(
  jobs: Array<{ table: string; column: string }>,
  options: ReEncryptionOptions = {}
): Promise<ReEncryptionResult[]> {
  const results: ReEncryptionResult[] = []

  console.info(
    `[KEY-ROTATION-WORKER] Iniciando batch de ${jobs.length} job(s) de re-criptografia`
  )

  for (const job of jobs) {
    const result = await reEncryptTable(job.table, job.column, options)
    results.push(result)

    // Delay pequeno entre jobs para não sobrecarregar
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  console.info(
    `[KEY-ROTATION-WORKER] Conclusão de batch. Total: ${results.length} job(s), ${results.reduce((s, r) => s + r.reEncryptedRecords, 0)} registros re-criptografados`
  )

  return results
}

/**
 * Simula uma re-criptografia sem fazer mudanças no banco.
 * Útil para validar que o processo funcionará antes de executar para verdade.
 *
 * @param table Nome da tabela
 * @param column Nome da coluna
 * @param sampleSize Número de registros para testar (padrão: 10)
 * @returns Resultado da simulação
 */
export async function validateReEncryption(
  table: string,
  column: string,
  sampleSize: number = 10
): Promise<ReEncryptionResult> {
  console.info(`[KEY-ROTATION-WORKER] Validando re-criptografia de ${table}.${column} (amostra: ${sampleSize})`)

  return reEncryptTable(table, column, {
    batchSize: sampleSize,
    dryRun: true,
    logProgress: true,
    stopOnError: true,
  })
}

/**
 * Gera um relatório de quais registros precisam de re-criptografia.
 * Verifica versão de cada ciphertext sem fazer alterações.
 *
 * @param table Nome da tabela
 * @param column Nome da coluna
 * @returns Relatório com distribuição de versões
 */
export async function analyzeEncryptionVersions(
  table: string,
  column: string
): Promise<{
  table: string
  column: string
  total: number
  byVersion: { [version: number]: number }
  noVersion: number
  empty: number
}> {
  console.info(`[KEY-ROTATION-WORKER] Analisando versões de criptografia em ${table}.${column}`)

  const activeVersion = getCurrentKeyVersion()
  const byVersion: { [version: number]: number } = {}
  let noVersion = 0
  let empty = 0

  const total = await getRecordCount(table)
  const batchSize = 100

  for (let offset = 0; offset < total; offset += batchSize) {
    const batch = await fetchBatch(table, column, offset, batchSize)

    for (const record of batch) {
      const value = String(record[column] || '')

      if (!value) {
        empty++
        continue
      }

      if (!value.startsWith('v')) {
        noVersion++
        continue
      }

      const versionPart = value.split(':')[0]
      const version = parseInt(versionPart.substring(1), 10)

      byVersion[version] = (byVersion[version] || 0) + 1
    }
  }

  console.info(`[KEY-ROTATION-WORKER] Análise concluída:`)
  console.info(`  Total: ${total}`)
  console.info(`  Vazios: ${empty}`)
  console.info(`  Sem versão: ${noVersion}`)
  for (const [version, count] of Object.entries(byVersion)) {
    const needsUpdate = parseInt(version) < activeVersion ? ' (PRECISA ATUALIZAR)' : ''
    console.info(`  V${version}: ${count}${needsUpdate}`)
  }

  return {
    table,
    column,
    total,
    byVersion: Object.fromEntries(Object.entries(byVersion).map(([k, v]) => [parseInt(k), v])),
    noVersion,
    empty,
  }
}
