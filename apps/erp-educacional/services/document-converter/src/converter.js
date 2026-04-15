'use strict'

const { execFile } = require('child_process')
const { promisify } = require('util')
const path = require('path')
const fs = require('fs')
const logger = require('./logger')

const execFileAsync = promisify(execFile)

// Localização do perfil ICC sRGB
// Preferência: perfil do sistema (icc-profiles-free), fallback para o bundled
const ICC_SRGB_PATHS = [
  '/usr/share/color/icc/sRGB.icm',
  '/usr/share/color/icc/sRGB.icc',
  '/usr/share/ghostscript/icc/sRGB.icc',
  '/app/icc/sRGB.icc'
]

function findIccProfile() {
  for (const p of ICC_SRGB_PATHS) {
    if (fs.existsSync(p)) return p
  }
  return null
}

/**
 * Converte uma imagem (JPG/PNG/TIFF) para PDF intermediário
 * usando ImageMagick, antes de passar pelo Ghostscript.
 */
async function imageToPdf(inputPath, outputPath) {
  logger.info(`Convertendo imagem para PDF intermediário: ${path.basename(inputPath)}`)
  await execFileAsync('convert', [
    inputPath,
    '-compress', 'JPEG',     // compressão JPEG para reduzir tamanho
    '-quality', '95',        // qualidade alta para documentos
    '-density', '300',       // 300 DPI — padrão para documentos legais
    '-units', 'PixelsPerInch',
    outputPath
  ])
}

/**
 * Converte um PDF (ou PDF intermediário) para PDF/A-2B
 * usando Ghostscript com perfil ICC sRGB embutido.
 *
 * PDF/A-2B:
 * - Fontes 100% embutidas
 * - Metadados XMP obrigatórios
 * - Perfil ICC de cores embutido
 * - Sem JavaScript, sem conteúdo criptografado
 * - Sem links externos
 */
async function pdfToPdfA(inputPath, outputPath) {
  const iccProfile = findIccProfile()

  if (!iccProfile) {
    logger.warn('Perfil ICC sRGB não encontrado — conversão sem perfil de cor (pode falhar validação)')
  } else {
    logger.info(`Usando perfil ICC: ${iccProfile}`)
  }

  // Arquivo de definição PDF/A para Ghostscript
  // Cria dinamicamente com o caminho correto do perfil ICC
  const pdfaDefContent = iccProfile
    ? `
%!PS-Adobe-3.0
[ /Title ()
  /DOCINFO pdfmark

[ /_objdef {icc_PDFA} /type /stream /OBJ pdfmark
[ {icc_PDFA}
  <</N 3>>
  /PUT pdfmark
[ {icc_PDFA} (${iccProfile}) /PUT pdfmark

[ {Catalog} <</OutputIntents [ <<
    /Type /OutputIntent
    /S /GTS_PDFA1
    /DestOutputProfile {icc_PDFA}
    /OutputConditionIdentifier (sRGB)
  >> ]
>> /PUT pdfmark
`
    : ''

  const pdfaDefPath = `${outputPath}.def.ps`

  if (pdfaDefContent) {
    fs.writeFileSync(pdfaDefPath, pdfaDefContent)
  }

  try {
    const args = [
      '-dPDFA=2',           // PDF/A-2 (mais moderno e compatível)
      '-dBATCH',
      '-dNOPAUSE',
      '-dNOOUTERSAVE',
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.7',
      '-sColorConversionStrategy=RGB',  // converter tudo para RGB (padrão sRGB)
      '-dEmbedAllFonts=true',
      '-dSubsetFonts=true',
      '-dAutoRotatePages=/None',
      '-dUseCIEColor=true',
      '-dPDFACompatibilityPolicy=1',    // 1 = tentar corrigir problemas automaticamente
      `-sOutputFile=${outputPath}`
    ]

    // Adicionar definição PDF/A se tiver perfil ICC
    if (pdfaDefContent) {
      args.push(pdfaDefPath)
    }

    args.push(inputPath)

    logger.info(`Executando Ghostscript para conversão PDF/A-2B`)
    await execFileAsync('gs', args, { timeout: 60000 }) // timeout 60s

    logger.info(`Ghostscript concluído: ${outputPath}`)
  } finally {
    // Limpar arquivo de definição temporário
    try { fs.unlinkSync(pdfaDefPath) } catch (_) {}
  }
}

/**
 * Pipeline principal de conversão.
 * Detecta o tipo do arquivo e executa a conversão correta.
 *
 * @param {string} inputPath   - Caminho do arquivo de entrada
 * @param {string} outputPath  - Caminho do PDF/A de saída
 * @param {string} mimetype    - MIME type do arquivo original
 */
async function convertToPdfA(inputPath, outputPath, mimetype) {
  const isImage = mimetype.startsWith('image/')
  const isPdf = mimetype === 'application/pdf'

  if (!isImage && !isPdf) {
    throw new Error(`Tipo MIME não suportado: ${mimetype}`)
  }

  if (isImage) {
    // Imagem → PDF intermediário → PDF/A
    const intermediatePath = `${outputPath}.intermediate.pdf`
    try {
      await imageToPdf(inputPath, intermediatePath)
      await pdfToPdfA(intermediatePath, outputPath)
    } finally {
      try { fs.unlinkSync(intermediatePath) } catch (_) {}
    }
  } else {
    // PDF → PDF/A diretamente
    await pdfToPdfA(inputPath, outputPath)
  }
}

module.exports = { convertToPdfA }
