'use strict'

const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')
const logger = require('./logger')
const { convertToPdfA } = require('./converter')
const { validatePdfA } = require('./validator')
const { extractDocumentComRetry, downloadFile } = require('./extractor')
const {
  escreverResultadoSessao,
  escreverErroSessao,
  setAuditContext
} = require('./supabase-writer')
const { rateLimiter } = require('./rate-limiter')

const app = express()
const PORT = process.env.PORT || 3100

// Chave de API interna para autenticação entre serviços
const API_KEY = process.env.CONVERTER_API_KEY

// Timeouts de rede (Sprint 2 — evita hangs em signed_url lentos)
const DOWNLOAD_TIMEOUT_MS = 30000 // 30s por download de arquivo

// Sessão 037 (fix 400 "callback_url obrigatório"): a Etapa 033 introduziu
// o refatoramento "DB Write Direto" (supabase-writer.js) no Next.js, mas
// o server.js nunca foi atualizado — continuava exigindo callback_url no
// payload e fazendo PUT no Next.js. Como o Next.js parou de enviar
// callback_url, TODA requisição caía no 400. Agora o Railway grava o
// resultado diretamente em extracao_sessoes via service_role, eliminando
// o canal HTTP de volta ao Next.js.

// Concorrência do processamento de extração — Sessão 031 (fix timeout Tela 2)
// 4 arquivos em paralelo: 4× mais rápido (400s → ~100s p/ 16 arquivos),
// Gemini 2.5 Flash aceita 1.000+ req/min, pico de memória ~28MB (Railway = 512MB)
const EXTRACAO_CONCORRENCIA = Number(process.env.EXTRACAO_CONCORRENCIA) || 4

/**
 * Executa tarefas em paralelo com limite de concorrência.
 * Preserva ordem dos resultados (mesma ordem do array de entrada).
 * Não aborta no primeiro erro — deixa a função da tarefa decidir.
 */
async function executarComLimite(itens, limite, tarefa) {
  const resultados = new Array(itens.length)
  let proximoIndice = 0

  async function worker() {
    while (true) {
      const i = proximoIndice++
      if (i >= itens.length) return
      resultados[i] = await tarefa(itens[i], i)
    }
  }

  const workers = Array.from({ length: Math.min(limite, itens.length) }, () => worker())
  await Promise.all(workers)
  return resultados
}

// Allowlist anti-SSRF para signed_url (Supabase Storage) — defesa em profundidade
function isSignedUrlAllowed(url) {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    // Supabase Storage: *.supabase.co/storage/v1/object/sign/...
    // Em dev local, permitir 127.0.0.1 só quando EXTRACAO_ALLOW_LOCAL_URLS=1
    if (u.hostname.endsWith('.supabase.co') && u.pathname.startsWith('/storage/v1/object/')) {
      return true
    }
    if (process.env.EXTRACAO_ALLOW_LOCAL_URLS === '1' && ['localhost', '127.0.0.1'].includes(u.hostname)) {
      return true
    }
    return false
  } catch {
    return false
  }
}

// Sessão 037: CALLBACK_ALLOWED_HOSTS + isCallbackUrlAllowed removidos
// junto com o canal HTTP callback. Railway agora grava direto no DB via
// service_role (ver supabase-writer.js), então não há mais URL para validar.

// Diretórios temporários
const TMP_INPUT = '/tmp/converter/input'
const TMP_OUTPUT = '/tmp/converter/output'

// Garantir que os diretórios existem
fs.mkdirSync(TMP_INPUT, { recursive: true })
fs.mkdirSync(TMP_OUTPUT, { recursive: true })

// Configuração do multer — aceita arquivo em memória ou disco
const storage = multer.diskStorage({
  destination: TMP_INPUT,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin'
    cb(null, `${uuidv4()}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB máximo
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/tiff'
    ]
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Tipo de arquivo não suportado: ${file.mimetype}`))
    }
  }
})

// ============================================
// MIDDLEWARE: Rate Limiting (Epic 1.3 — Sprint 1)
// ============================================
app.use(rateLimiter)

// ============================================
// MIDDLEWARE: Audit Context (Epic 1.3 — Sprint 1)
// Captura IP, requestId e injeta no contexto de auditoria
// para que o supabase-writer grave nos logs de audit trail.
// ============================================
app.use((req, _res, next) => {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown'
  const requestId = req.headers['x-request-id'] || require('uuid').v4()
  req.requestId = requestId

  setAuditContext({
    uid: req.headers['x-user-id'] || '',
    role: 'railway-service',
    ip: clientIp,
    requestId
  })

  next()
})

// ============================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ============================================
function requireApiKey(req, res, next) {
  if (!API_KEY) {
    // Em desenvolvimento sem CONVERTER_API_KEY configurada, permite acesso local
    if (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1') {
      return next()
    }
  }
  const key = req.headers['x-api-key']
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: 'API key inválida ou ausente' })
  }
  next()
}

// ============================================
// ROTA: Health Check
// GET /health
// ============================================
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'document-converter',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  })
})

// ============================================
// ROTA: Converter documento para PDF/A
// POST /convert
//
// Body (multipart/form-data):
//   file: arquivo (PDF, JPG, PNG, TIFF)
//
// Response:
//   {
//     success: true,
//     pdfaBase64: "...",       // conteúdo PDF/A em Base64
//     validation: {
//       isCompliant: true,
//       profile: "PDF_A_2B",
//       warnings: []
//     },
//     metadata: {
//       originalName: "rg.jpg",
//       originalSize: 245123,
//       pdfaSize: 189432,
//       processingMs: 1240
//     }
//   }
// ============================================
app.post('/convert', requireApiKey, upload.single('file'), async (req, res) => {
  const startTime = Date.now()

  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' })
  }

  const inputPath = req.file.path
  const outputPath = path.join(TMP_OUTPUT, `${uuidv4()}.pdf`)

  logger.info(`Iniciando conversão: ${req.file.originalname} (${req.file.size} bytes)`)

  try {
    // 1. Converter para PDF/A via Ghostscript
    await convertToPdfA(inputPath, outputPath, req.file.mimetype)

    // 2. Validar conformidade PDF/A com veraPDF
    const validation = await validatePdfA(outputPath)

    if (!validation.isCompliant) {
      logger.warn(`PDF/A gerado não passou na validação: ${JSON.stringify(validation.errors)}`)
      // Não bloqueia — retorna o arquivo com aviso (a secretaria pode decidir)
    }

    // 3. Ler o arquivo PDF/A gerado e converter para Base64
    const pdfaBuffer = fs.readFileSync(outputPath)
    const pdfaBase64 = pdfaBuffer.toString('base64')
    const processingMs = Date.now() - startTime

    logger.info(`Conversão concluída em ${processingMs}ms — PDF/A: ${pdfaBuffer.length} bytes — Válido: ${validation.isCompliant}`)

    res.json({
      success: true,
      pdfaBase64,
      validation: {
        isCompliant: validation.isCompliant,
        profile: validation.profile,
        warnings: validation.warnings || [],
        errors: validation.errors || []
      },
      metadata: {
        originalName: req.file.originalname,
        originalSize: req.file.size,
        pdfaSize: pdfaBuffer.length,
        processingMs
      }
    })
  } catch (error) {
    logger.error(`Erro na conversão: ${error.message}`, { stack: error.stack })
    res.status(500).json({
      error: 'Falha na conversão do documento',
      detail: error.message
    })
  } finally {
    // Limpar arquivos temporários
    try { fs.unlinkSync(inputPath) } catch (_) {}
    try { fs.unlinkSync(outputPath) } catch (_) {}
  }
})

// ============================================
// ROTA: Converter a partir de Base64
// POST /convert-base64
//
// Body (application/json):
//   {
//     base64: "...",
//     filename: "rg.pdf",
//     mimetype: "application/pdf"
//   }
// ============================================
app.use(express.json({ limit: '25mb' }))

app.post('/convert-base64', requireApiKey, async (req, res) => {
  const startTime = Date.now()
  const { base64, filename, mimetype } = req.body

  if (!base64 || !filename || !mimetype) {
    return res.status(400).json({ error: 'Campos obrigatórios: base64, filename, mimetype' })
  }

  const ext = path.extname(filename) || '.pdf'
  const inputPath = path.join(TMP_INPUT, `${uuidv4()}${ext}`)
  const outputPath = path.join(TMP_OUTPUT, `${uuidv4()}.pdf`)

  logger.info(`Iniciando conversão (base64): ${filename}`)

  try {
    // Decodificar Base64 e salvar em arquivo temporário
    const buffer = Buffer.from(base64, 'base64')
    fs.writeFileSync(inputPath, buffer)

    // Converter para PDF/A
    await convertToPdfA(inputPath, outputPath, mimetype)

    // Validar
    const validation = await validatePdfA(outputPath)

    // Ler e codificar resultado
    const pdfaBuffer = fs.readFileSync(outputPath)
    const pdfaBase64 = pdfaBuffer.toString('base64')
    const processingMs = Date.now() - startTime

    logger.info(`Conversão (base64) concluída em ${processingMs}ms`)

    res.json({
      success: true,
      pdfaBase64,
      validation: {
        isCompliant: validation.isCompliant,
        profile: validation.profile,
        warnings: validation.warnings || [],
        errors: validation.errors || []
      },
      metadata: {
        originalName: filename,
        originalSize: buffer.length,
        pdfaSize: pdfaBuffer.length,
        processingMs
      }
    })
  } catch (error) {
    logger.error(`Erro na conversão (base64): ${error.message}`)
    res.status(500).json({
      error: 'Falha na conversão do documento',
      detail: error.message
    })
  } finally {
    try { fs.unlinkSync(inputPath) } catch (_) {}
    try { fs.unlinkSync(outputPath) } catch (_) {}
  }
})

// ============================================
// ROTA: Extração de dados via Gemini 2.5 Flash
// POST /extrair-documentos
//
// Fire-and-forget: responde 202 imediatamente e processa em background.
// Ao final, grava DIRETO em extracao_sessoes via service_role (sessão 037).
// Não há mais callback HTTP — eliminado no refatoramento "DB Write Direto".
//
// Body (application/json):
//   {
//     sessao_id: "uuid",
//     arquivos: [
//       {
//         storage_path: "processos/xxx/rg.jpg",
//         nome_original: "rg.jpg",
//         mime_type: "image/jpeg",
//         tamanho_bytes: 245123,
//         signed_url: "https://..."  // URL assinada do Supabase Storage
//       }
//     ],
//     gemini_api_key: "..."          // passada pelo Next.js (evita rotação de env var)
//   }
//
// Response imediata:
//   202 { accepted: true, sessao_id, total_arquivos }
//
// Persistência: Railway grava resultado em extracao_sessoes via service_role
// (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY no env do Railway). Frontend
// detecta via Realtime/polling em vez de HTTP callback.
// ============================================
app.post('/extrair-documentos', requireApiKey, async (req, res) => {
  const {
    sessao_id: sessaoId,
    arquivos,
    gemini_api_key: geminiApiKey
  } = req.body || {}

  // Validação de payload
  if (!sessaoId || typeof sessaoId !== 'string') {
    return res.status(400).json({ error: 'sessao_id obrigatório' })
  }
  if (!Array.isArray(arquivos) || arquivos.length === 0) {
    return res.status(400).json({ error: 'arquivos deve ser array não vazio' })
  }
  if (!geminiApiKey || typeof geminiApiKey !== 'string') {
    return res.status(400).json({ error: 'gemini_api_key obrigatório' })
  }

  // Valida estrutura mínima de cada arquivo + allowlist anti-SSRF da signed_url
  for (const [i, arq] of arquivos.entries()) {
    if (!arq?.signed_url || !arq?.mime_type || !arq?.nome_original) {
      return res.status(400).json({
        error: `arquivos[${i}] deve ter signed_url, mime_type e nome_original`
      })
    }
    if (!isSignedUrlAllowed(arq.signed_url)) {
      logger.warn(
        `[extrair] signed_url rejeitado (SSRF guard) arquivos[${i}]: ${String(arq.signed_url).slice(0, 120)}`
      )
      return res.status(400).json({
        error: `arquivos[${i}] signed_url deve ser HTTPS apontando para *.supabase.co/storage/v1/object/...`
      })
    }
  }

  // Responde 202 imediatamente — processamento roda em background
  res.status(202).json({
    accepted: true,
    sessao_id: sessaoId,
    total_arquivos: arquivos.length
  })

  // ==== Processamento em background (não bloqueia response) ====
  processarExtracao({ sessaoId, arquivos, geminiApiKey }).catch(async (err) => {
    logger.error(`[extrair] Background falhou para sessão ${sessaoId}: ${err.message}`, {
      stack: err.stack
    })
    // Último recurso: marca a sessão como erro no DB. Se até isto falhar,
    // o frontend ainda verá via polling/Realtime a ausência de update e
    // pode entrar no caminho de recovery/descartar.
    try {
      await escreverErroSessao(sessaoId, `Worker crash: ${err.message}`)
    } catch (writerErr) {
      logger.error(
        `[extrair] escreverErroSessao falhou para ${sessaoId}: ${writerErr.message}`
      )
    }
  })
})

/**
 * Loop de extração: para cada arquivo, baixa → chama Gemini → agrega.
 * Ao final, grava resultado DIRETO em extracao_sessoes via supabase-writer.
 */
async function processarExtracao({ sessaoId, arquivos, geminiApiKey }) {
  const startTime = Date.now()
  logger.info(
    `[extrair] Iniciando sessão ${sessaoId} com ${arquivos.length} arquivo(s) — concorrência ${EXTRACAO_CONCORRENCIA}`
  )

  let algumErro = null

  // Processamento paralelo com limite de concorrência (sessão 031).
  // executarComLimite preserva a ordem do array de entrada, então
  // resultadosPorArquivo[i] corresponde a arquivos[i].
  const resultadosPorArquivo = await executarComLimite(
    arquivos,
    EXTRACAO_CONCORRENCIA,
    async (arq) => {
      const t0 = Date.now()
      try {
        // 1. Download do arquivo via signed URL (com timeout)
        const buffer = await downloadFile(arq.signed_url, { timeoutMs: DOWNLOAD_TIMEOUT_MS })
        const base64 = buffer.toString('base64')

        // 2. Chamada ao Gemini (com retry + backoff em 5xx/429/timeout — sessão 037)
        const resultado = await extractDocumentComRetry({
          apiKey: geminiApiKey,
          base64,
          mimeType: arq.mime_type,
          nomeArquivo: arq.nome_original
        })

        logger.info(
          `[extrair] ${arq.nome_original} extraído em ${Date.now() - t0}ms — tipo: ${resultado?.tipo_documento_detectado}`
        )

        // Prompt v3: o Gemini retorna gavetas na raiz (dados_diplomado, historico_superior, etc.)
        // Mapeamos para o formato interno do worker preservando compatibilidade.
        return {
          storage_path: arq.storage_path,
          nome_original: arq.nome_original,
          mime_type: arq.mime_type,
          tipo_documento_detectado: resultado?.tipo_documento_detectado ?? 'OUTROS',
          confianca_campos: resultado?.confianca_campos ?? {},
          confianca_geral: typeof resultado?.confianca_geral === 'number'
            ? resultado.confianca_geral
            : 0.05,
          // Gavetas do prompt v3 — passadas inteiras para o consolidador
          dados_diplomado: resultado?.dados_diplomado ?? null,
          historico_superior: resultado?.historico_superior ?? null,
          historico_ensino_medio: resultado?.historico_ensino_medio ?? null,
          enem: resultado?.enem ?? null,
          enade: resultado?.enade ?? null,
          horarios_extraidos: resultado?.horarios_extraidos ?? [],
          titulacoes_historicas: resultado?.titulacoes_historicas ?? [],
          processing_ms: Date.now() - t0
        }
      } catch (err) {
        logger.error(`[extrair] Falha em ${arq.nome_original}: ${err.message}`)
        // Não aborta o batch — marca o arquivo como falho e segue
        if (!algumErro) algumErro = err.message
        return {
          storage_path: arq.storage_path,
          nome_original: arq.nome_original,
          erro: err.message,
          processing_ms: Date.now() - t0
        }
      }
    }
  )

  // Consolidação v3: Reducer relacional com gavetas tipadas
  const dadosAgregados = consolidarDados(resultadosPorArquivo)

  const totalMs = Date.now() - startTime
  logger.info(`[extrair] Sessão ${sessaoId} concluída em ${totalMs}ms`)

  // Classifica resultado
  const totalArquivos = resultadosPorArquivo.length
  const comFalha = resultadosPorArquivo.filter((r) => r.erro).length
  const todosFalharam = comFalha === totalArquivos
  const parcial = comFalha > 0 && !todosFalharam

  // Sessão 037 — DB Write Direto (Etapa 2, completando o refatoramento
  // iniciado na sessão 033). O resultado da extração vai direto para
  // extracao_sessoes via service_role. Canal HTTP callback eliminado.
  //
  // Contrato do writer:
  //   - escreverResultadoSessao → status='rascunho' + version=2 (merge normal/parcial)
  //   - escreverErroSessao      → status='erro' (todos os arquivos falharam)
  //
  // Schema do dados_extraidos preserva o formato do antigo callback para
  // evitar breaking change no frontend:
  //   { diplomado, curso, ies, por_arquivo, arquivos_processados,
  //     processing_ms, total_arquivos, arquivos_com_falha, erro_parcial? }
  const dadosParaGravar = {
    ...dadosAgregados,
    arquivos_processados: resultadosPorArquivo,
    processing_ms: totalMs,
    total_arquivos: totalArquivos,
    arquivos_com_falha: comFalha
  }

  if (todosFalharam) {
    const msg = `Todos os ${totalArquivos} arquivos falharam. Primeiro erro: ${algumErro}`
    const { ok, linhasAfetadas, erro } = await escreverErroSessao(sessaoId, msg, {
      processingMs: totalMs
    })
    if (!ok) {
      logger.error(
        `[extrair] escreverErroSessao FALHOU para ${sessaoId}: ${erro || 'erro desconhecido'}`
      )
    } else if (linhasAfetadas === 0) {
      logger.warn(
        `[extrair] Sessão ${sessaoId} não estava em 'processando' ao gravar erro (race ou reprocesso)`
      )
    }
    return
  }

  const erroParcial = parcial
    ? `${comFalha}/${totalArquivos} arquivos falharam. Primeiro erro: ${algumErro}`
    : null

  const { ok, linhasAfetadas, erro } = await escreverResultadoSessao(
    sessaoId,
    dadosParaGravar,
    { processingMs: totalMs, erroParcial }
  )

  if (!ok) {
    logger.error(
      `[extrair] escreverResultadoSessao FALHOU para ${sessaoId}: ${erro || 'erro desconhecido'}`
    )
    // Tenta gravar como erro fatal pra não deixar a sessão pendurada
    await escreverErroSessao(
      sessaoId,
      `Falha ao gravar resultado no DB: ${erro || 'erro desconhecido'}`,
      { processingMs: totalMs }
    ).catch(() => {})
  } else if (linhasAfetadas === 0) {
    logger.warn(
      `[extrair] Sessão ${sessaoId}: UPDATE afetou 0 linhas — status já mudou (reprocesso/descarte). Comportamento idempotente.`
    )
  }
}

// ════════════════════════════════════════════════════════════════════════════
// CONSOLIDADOR v3 — Reducer Relacional com Gavetas Tipadas
// Sessão 048 (10/04/2026): substitui agregarDados().
//
// Estratégia:
//   1. Merge de dados_diplomado: campo a campo, primeiro-não-nulo-ganha
//   2. Merge de historico_superior: curso/meta primeiro-não-nulo; disciplinas dedup+enrich
//   3. JOIN relacional: disciplina × horário (fuzzy match nome+ano+semestre) → docente
//   4. JOIN relacional: docente × planilha_titulacao (fuzzy match nome+data) → titulação na época
//   5. Gavetas específicas: enem, enade, historico_ensino_medio → primeiro-não-nulo
//   6. Comprobatórios: lista de tipos detectados
// ════════════════════════════════════════════════════════════════════════════

/**
 * Normaliza string para comparação fuzzy:
 * - Remove acentos, converte para uppercase
 * - Remove prefixos acadêmicos (Prof., Dr., Me., Esp., etc.)
 * - Remove espaços duplos
 */
function normalizarNome(str) {
  if (!str || typeof str !== 'string') return ''
  return str
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toUpperCase()
    .replace(/\b(PROF\.?|DR\.?|DRA\.?|ME\.?|MA\.?|ESP\.?|MSC\.?|PHD\.?)\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Similaridade básica entre strings (Jaccard sobre tokens).
 * Retorna 0.0 a 1.0. Threshold recomendado: >= 0.6
 */
function similaridade(a, b) {
  const ta = new Set(normalizarNome(a).split(' ').filter(Boolean))
  const tb = new Set(normalizarNome(b).split(' ').filter(Boolean))
  if (ta.size === 0 && tb.size === 0) return 1.0
  if (ta.size === 0 || tb.size === 0) return 0.0
  let inter = 0
  for (const t of ta) { if (tb.has(t)) inter++ }
  return inter / (ta.size + tb.size - inter) // Jaccard
}

const SIMILARIDADE_THRESHOLD = 0.6

/**
 * Merge campo a campo: primeiro valor não-nulo/não-vazio ganha.
 * Trata subobjetos (ex: rg, naturalidade) recursivamente.
 */
function mergeCampoACampo(target, source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return
  for (const [campo, valor] of Object.entries(source)) {
    if (valor === null || valor === undefined || valor === '') continue
    // Subobjeto (rg, naturalidade) — merge recursivo
    if (typeof valor === 'object' && !Array.isArray(valor)) {
      if (!target[campo] || typeof target[campo] !== 'object') {
        target[campo] = {}
      }
      mergeCampoACampo(target[campo], valor)
      continue
    }
    // Array (genitores) — tratado separado
    if (Array.isArray(valor)) continue
    // Escalar: primeiro não-nulo ganha
    if (target[campo] === null || target[campo] === undefined || target[campo] === '') {
      target[campo] = valor
    }
  }
}

/**
 * Consolida dados extraídos de múltiplos arquivos em um único objeto.
 * Implementa o Reducer relacional aprovado na sessão 048.
 */
function consolidarDados(resultados) {
  const merged = {
    diplomado: {},
    curso: {},
    ies: {},
    enade: {},
    enem: {},
    historico_ensino_medio: {},
    disciplinas: [],
    comprobatorios_detectados: [],
    por_arquivo: []
  }

  // Maps para dedup
  const discMap = new Map()     // disciplinas por nome normalizado
  const genMap = new Map()      // genitores por nome normalizado
  const todosHorarios = []      // horários acumulados de todos os documentos
  const todasTitulacoes = []    // titulações acumuladas

  for (const r of resultados) {
    if (r.erro) continue

    // ── 1. Dados do diplomado ──
    if (r.dados_diplomado && typeof r.dados_diplomado === 'object') {
      // Genitores: tratamento especial (array dentro do objeto)
      if (Array.isArray(r.dados_diplomado.genitores)) {
        for (const gen of r.dados_diplomado.genitores) {
          if (!gen?.nome) continue
          const k = normalizarNome(gen.nome)
          if (k && !genMap.has(k)) genMap.set(k, gen)
        }
      }

      // RG: achatar subobjeto { numero, orgao, uf } → rg, rg_orgao, rg_uf
      // O prompt v3 retorna rg como objeto, mas o FormularioRevisao espera flat
      const rgObj = r.dados_diplomado.rg
      if (rgObj && typeof rgObj === 'object' && !Array.isArray(rgObj)) {
        const flat = { ...r.dados_diplomado }
        flat.rg = rgObj.numero || null
        flat.rg_orgao = rgObj.orgao || null
        flat.rg_uf = rgObj.uf || null
        mergeCampoACampo(merged.diplomado, flat)
      } else {
        // Fallback: se rg vier como string (compatibilidade com docs antigos)
        mergeCampoACampo(merged.diplomado, r.dados_diplomado)
      }

      // Naturalidade: achatar subobjeto { cidade, uf } → naturalidade_cidade, naturalidade_uf
      const nat = r.dados_diplomado.naturalidade
      if (nat && typeof nat === 'object' && !Array.isArray(nat)) {
        if (nat.cidade && !merged.diplomado.naturalidade_cidade) {
          merged.diplomado.naturalidade_cidade = nat.cidade
        }
        if (nat.uf && !merged.diplomado.naturalidade_uf) {
          merged.diplomado.naturalidade_uf = nat.uf
        }
        // Também gerar o formato "Cidade - UF" que o FormularioRevisao espera
        if (nat.cidade && nat.uf && !merged.diplomado.naturalidade) {
          merged.diplomado.naturalidade = `${nat.cidade} - ${nat.uf}`
        }
      }
    }

    // ── 2. Histórico superior ──
    if (r.historico_superior && typeof r.historico_superior === 'object') {
      // Campos escalares do curso (nome, modalidade, etc.)
      const { disciplinas: discs, ...metaCurso } = r.historico_superior

      // Mapear nomes do prompt v3 → nomes do FormularioRevisao
      if (metaCurso.data_ingresso && !metaCurso.data_inicio) {
        metaCurso.data_inicio = metaCurso.data_ingresso
      }
      if (metaCurso.carga_horaria_total && !metaCurso.carga_horaria) {
        metaCurso.carga_horaria = metaCurso.carga_horaria_total
      }

      mergeCampoACampo(merged.curso, metaCurso)

      // Disciplinas: acumula + dedup por nome
      if (Array.isArray(discs)) {
        for (const disc of discs) {
          if (!disc?.nome) continue
          const k = normalizarNome(disc.nome)
          if (!discMap.has(k)) {
            discMap.set(k, { ...disc })
          } else {
            // Enriquecer: campo não-nulo preenche lacuna
            const existing = discMap.get(k)
            for (const [campo, valor] of Object.entries(disc)) {
              if (valor !== null && valor !== undefined && valor !== '' &&
                  (existing[campo] === null || existing[campo] === undefined || existing[campo] === '')) {
                existing[campo] = valor
              }
            }
          }
        }
      }
    }

    // ── 3. Gavetas específicas: enem, enade, historico_ensino_medio ──
    if (r.enem && typeof r.enem === 'object') {
      mergeCampoACampo(merged.enem, r.enem)
    }
    if (r.enade && typeof r.enade === 'object') {
      mergeCampoACampo(merged.enade, r.enade)
    }
    if (r.historico_ensino_medio && typeof r.historico_ensino_medio === 'object') {
      mergeCampoACampo(merged.historico_ensino_medio, r.historico_ensino_medio)
    }

    // ── 4. Acumular horários e titulações para JOIN relacional ──
    if (Array.isArray(r.horarios_extraidos)) {
      for (const h of r.horarios_extraidos) {
        if (h?.disciplina && h?.professor) todosHorarios.push(h)
      }
    }
    if (Array.isArray(r.titulacoes_historicas)) {
      for (const t of r.titulacoes_historicas) {
        if (t?.professor) todasTitulacoes.push(t)
      }
    }

    // ── 5. Registrar comprobatório detectado ──
    if (r.tipo_documento_detectado) {
      merged.comprobatorios_detectados.push({
        tipo: r.tipo_documento_detectado,
        nome_arquivo: r.nome_original,
        confianca: typeof r.confianca_geral === 'number' ? r.confianca_geral : null
      })
    }

    merged.por_arquivo.push({
      nome_original: r.nome_original,
      tipo_documento_detectado: r.tipo_documento_detectado,
      confianca_geral: r.confianca_geral
    })
  }

  // ── 6. JOIN Relacional: disciplina × horário → docente ──
  if (todosHorarios.length > 0 && discMap.size > 0) {
    for (const [key, disc] of discMap) {
      // Já tem docente do histórico? Pula o JOIN (histórico tem prioridade menor
      // que horário, mas se horário encontrar match, sobrescreve)
      const horario = todosHorarios.find(h => {
        const simDisc = similaridade(h.disciplina, disc.nome)
        if (simDisc < SIMILARIDADE_THRESHOLD) return false
        // Se temos ano/semestre, usar como filtro adicional
        if (h.ano && disc.ano && String(h.ano) !== String(disc.ano)) return false
        if (h.semestre && disc.periodo && String(h.semestre) !== String(disc.periodo)) return false
        return true
      })

      if (horario?.professor) {
        disc.docente = horario.professor

        // ── 7. JOIN Relacional: docente × titulação → titulação na época ──
        if (todasTitulacoes.length > 0) {
          const linhaTempo = todasTitulacoes.find(t =>
            similaridade(t.professor, horario.professor) >= SIMILARIDADE_THRESHOLD
          )

          if (linhaTempo) {
            // Determinar a titulação que o professor tinha na época da disciplina
            const anoDisc = Number(disc.ano) || 9999
            const titulacaoNaEpoca = determinarTitulacao(linhaTempo, anoDisc)
            if (titulacaoNaEpoca) {
              disc.titulacao_docente = titulacaoNaEpoca
            }
          }
        }
      }
    }
  }

  // ── 8. Converter maps para arrays e finalizar ──
  if (genMap.size > 0) {
    merged.diplomado.genitores = Array.from(genMap.values())
  }
  if (discMap.size > 0) {
    merged.disciplinas = Array.from(discMap.values())
  }

  return merged
}

/**
 * Determina a titulação que um docente tinha em um dado ano.
 * Segue a regra: a última titulação obtida ANTES do ano da disciplina.
 *
 * @param {object} linhaTempo - { professor, data_graduacao, data_especializacao, data_mestrado, data_doutorado }
 * @param {number} anoDisc - Ano da disciplina (para comparar com datas de titulação)
 * @returns {string|null} - "Doutorado", "Mestrado", "Especialização", "Graduação" ou null
 */
function determinarTitulacao(linhaTempo, anoDisc) {
  // Extrai ano de cada data (formato YYYY-MM-DD ou só YYYY)
  const anoOf = (d) => {
    if (!d) return null
    const n = Number(String(d).slice(0, 4))
    return isNaN(n) ? null : n
  }

  const titulacoes = [
    { nivel: 'Doutorado', ano: anoOf(linhaTempo.data_doutorado) },
    { nivel: 'Mestrado', ano: anoOf(linhaTempo.data_mestrado) },
    { nivel: 'Especialização', ano: anoOf(linhaTempo.data_especializacao) },
    { nivel: 'Graduação', ano: anoOf(linhaTempo.data_graduacao) }
  ]

  // Encontra a titulação mais alta que o professor já tinha naquele ano
  for (const t of titulacoes) {
    if (t.ano !== null && t.ano <= anoDisc) {
      return t.nivel
    }
  }

  // Se nenhuma data bate, retorna a mais alta que encontrar (sem validação temporal)
  for (const t of titulacoes) {
    if (t.ano !== null) return t.nivel
  }

  return null
}

// Sessão 037: função enviarCallback removida. Persistência agora via
// supabase-writer (escreverResultadoSessao / escreverErroSessao) chamado
// direto em processarExtracao. Eliminou o canal HTTP Railway → Next.js
// que era fonte de bugs recorrentes (307 middleware, 504 split lite/heavy,
// timeouts, nonce race, e finalmente "callback_url obrigatório" por
// dessincronia de contratos).

// ============================================
// TRATAMENTO DE ERROS
// ============================================
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Arquivo muito grande (máximo 20MB)' })
  }
  logger.error(`Erro não tratado: ${err.message}`)
  res.status(500).json({ error: err.message || 'Erro interno' })
})

// ============================================
// INICIALIZAÇÃO
// ============================================
app.listen(PORT, () => {
  logger.info(`DocumentConverter rodando na porta ${PORT}`)
  logger.info(`CONVERTER_API_KEY: ${API_KEY ? 'configurada ✅' : 'NÃO configurada ⚠️ (modo dev)'}`)
  const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  logger.info(
    `SUPABASE DB Write: ${hasSupabase ? 'configurado ✅' : 'NÃO configurado ⚠️ (/extrair-documentos não vai gravar resultado)'}`
  )
})

module.exports = app
