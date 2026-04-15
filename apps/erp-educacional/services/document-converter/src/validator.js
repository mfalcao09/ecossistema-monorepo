'use strict'

const { execFile } = require('child_process')
const { promisify } = require('util')
const logger = require('./logger')

const execFileAsync = promisify(execFile)

const VERAPDF_PATH = process.env.VERAPDF_PATH || '/opt/verapdf/verapdf-greenfield-1.26.2/verapdf'

/**
 * Valida um arquivo PDF/A usando veraPDF.
 *
 * @param {string} pdfPath - Caminho do arquivo PDF a validar
 * @returns {Promise<{
 *   isCompliant: boolean,
 *   profile: string,
 *   warnings: string[],
 *   errors: string[]
 * }>}
 */
async function validatePdfA(pdfPath) {
  try {
    // Verificar se veraPDF está disponível
    if (!require('fs').existsSync(VERAPDF_PATH)) {
      logger.warn(`veraPDF não encontrado em ${VERAPDF_PATH} — pulando validação`)
      return {
        isCompliant: null, // null = não validado (diferente de false = inválido)
        profile: 'UNKNOWN',
        warnings: ['veraPDF não disponível — validação pulada'],
        errors: []
      }
    }

    logger.info(`Validando PDF/A com veraPDF: ${pdfPath}`)

    const { stdout } = await execFileAsync(VERAPDF_PATH, [
      '--flavour', 'ua2b',    // PDF/A-2B (nível B = básico, mais compatível com documentos legados)
      '--format', 'json',     // saída JSON para parse fácil
      '--maxfailuresdisplayed', '10',
      pdfPath
    ], {
      timeout: 30000 // 30s
    })

    const result = JSON.parse(stdout)

    // Extrair resultados do JSON do veraPDF
    const report = result?.report
    const jobResult = report?.jobs?.[0]?.validationResult

    if (!jobResult) {
      return {
        isCompliant: false,
        profile: 'PDF_A_2B',
        warnings: [],
        errors: ['veraPDF retornou resultado vazio ou inesperado']
      }
    }

    const isCompliant = jobResult.compliant === true
    const failures = jobResult.details?.failedRules || []
    const warnings = jobResult.details?.warnings || []

    // Mapear falhas para mensagens legíveis
    const errors = failures.slice(0, 10).map(f =>
      `${f.ruleId || 'REGRA'}: ${f.description || f.object || 'Violação detectada'}`
    )

    logger.info(`Validação veraPDF: ${isCompliant ? 'CONFORME ✅' : 'NÃO CONFORME ⚠️'} — ${failures.length} falhas`)

    return {
      isCompliant,
      profile: 'PDF_A_2B',
      warnings: warnings.slice(0, 5).map(w => w.message || String(w)),
      errors
    }
  } catch (error) {
    // Se veraPDF falhar (erro de execução), não bloqueia o fluxo
    logger.warn(`Erro ao executar veraPDF: ${error.message}`)
    return {
      isCompliant: null,
      profile: 'PDF_A_2B',
      warnings: [`Validação veraPDF falhou: ${error.message}`],
      errors: []
    }
  }
}

module.exports = { validatePdfA }
