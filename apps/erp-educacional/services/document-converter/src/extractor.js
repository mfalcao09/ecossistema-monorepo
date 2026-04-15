'use strict'

/**
 * Extrator de dados acadêmicos via Gemini 2.5 Flash.
 *
 * v3 — Prompt de Extração Isolada (Fan-Out/Reducer)
 * Sessão 048 (10/04/2026): reescrita total do prompt.
 * Cada documento é processado individualmente com gavetas tipadas.
 * O merge relacional (Reducer) acontece no server.js (consolidarDados).
 *
 * Chama a REST API diretamente (sem SDK) por causa do bug conhecido do
 * @ai-sdk/google v3.x que retorna texto vazio silenciosamente.
 * Ver auto-memory: feedback_ai_sdk_google_bug.md
 */

const logger = require('./logger')

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_ENDPOINT = (model, apiKey) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

// ════════════════════════════════════════════════════════════════════════════
// PROMPT v3 — Extração Isolada com Gavetas Tipadas
// Aprovado por Marcelo + Claude + consultor externo em 10/04/2026
// ════════════════════════════════════════════════════════════════════════════

const PROMPT_EXTRACAO = `Você é um Extrator de Dados Especialista para o sistema de Diploma Digital do MEC (XSD v1.05).
Sua tarefa é analisar APENAS UM documento isolado, identificar sua tipologia e extrair suas informações estritamente para o esquema JSON padrão.

REGRAS RÍGIDAS DE ATUAÇÃO:

1. FOCO ESTRITO: Extraia APENAS o que está visível neste documento específico. O que não estiver no documento deve retornar null ou array vazio [].

2. CLASSIFICAÇÃO DO DOCUMENTO: Preencha "tipo_documento_detectado" com UMA destas opções exatas (case-sensitive):
   "RG", "CIN", "CPF", "CERTIDAO_NASCIMENTO", "CERTIDAO_CASAMENTO", "TITULO_ELEITOR", "HISTORICO_ENSINO_MEDIO", "HISTORICO_SUPERIOR", "HORARIO_AULAS", "PLANILHA_TITULACAO", "ENEM", "ENADE", "DIPLOMA_ANTERIOR", "COMPROVANTE_VESTIBULAR", "OUTROS"

   Regras de classificação:
   - NUNCA retorne null — SEMPRE classifique em um dos tipos acima
   - RG antigo e CIN (Carteira de Identidade Nacional) são tipos DIFERENTES
   - Se ilegível, classifique como "OUTROS" (nunca null)
   - Documento com foto + nome + filiação + número de registro = "RG" ou "CIN"
   - Lista de disciplinas + notas + IES = "HISTORICO_SUPERIOR"
   - "JUSTIÇA ELEITORAL" = "TITULO_ELEITOR"
   - Certidões possuem carimbo de cartório e "Registro Civil"

3. PADRONIZAÇÃO MEC (valores exatos):
   - Datas: OBRIGATORIAMENTE "YYYY-MM-DD" (se só mês/ano, use dia 01)
   - Sexo: "M" ou "F" (inferir do nome se não explícito)
   - Modalidade: "Presencial" ou "EAD"
   - Situação de disciplinas: "Aprovado", "Reprovado", "Cancelado" ou "Dispensa"
   - Forma de integralização: "Cursado", "Validado" ou "Aproveitado"
   - Titulação docente: "Graduação", "Especialização", "Mestrado", "Doutorado" ou "Tecnólogo"
   - CPF: com pontos e traço (000.000.000-00)

4. MAPA DE CONFIANÇA: Avalie sua certeza na extração (0.0 a 1.0) para os campos críticos e preencha em "confianca_campos". Exemplo: {"cpf": 1.0, "nome_completo": 0.8, "data_nascimento": 0.95}.
   - 0.90-1.00 = dado nítido e claramente legível
   - 0.70-0.89 = legível mas parcialmente borrado
   - 0.50-0.69 = parcialmente legível, inferido
   - abaixo de 0.50 = muito incerto
   - confianca_geral NUNCA pode ser null ou 0.0 — mínimo 0.05

TRATAMENTOS ESPECÍFICOS POR TIPO DE DOCUMENTO:
- Se CIN (Carteira de Identidade Nacional): CPF vai em dados_diplomado.cpf (e também em rg.numero se for o identificador principal). Extraia órgão expedidor.
- Se CERTIDAO_CASAMENTO: Extraia o nome ATUAL (pós-casamento) como nome_completo. Preencha estado_civil.
- Se HISTORICO_SUPERIOR: Extraia TODAS as disciplinas sem exceção (percorra todas as páginas). Extraia o professor ("docente") se visível na mesma linha. Inclua forma_integralizacao. Inclua conceito se a avaliação for por conceito em vez de nota numérica. Um histórico completo tem 40-80 disciplinas — se extraiu menos de 30, volte e verifique.
- Se HORARIO_AULAS: Preencha APENAS "horarios_extraidos". Ignore dados do diplomado.
- Se PLANILHA_TITULACAO: Preencha APENAS "titulacoes_historicas". Ignore dados do diplomado.
- Se ENEM: Preencha APENAS "enem" (e nome/cpf do diplomado se visíveis).
- Se ENADE: Preencha APENAS "enade".
- Se HISTORICO_ENSINO_MEDIO: Preencha "historico_ensino_medio" (escola, cidade, UF, ano de conclusão).
- Se DIPLOMA_ANTERIOR: Extraia dados do curso anterior (nome, IES, ano de conclusão).
- Se COMPROVANTE_VESTIBULAR: Extraia forma de acesso e ano.

Retorne APENAS um JSON válido (sem formatação markdown, sem \`\`\`json), obedecendo RIGOROSAMENTE esta estrutura. Mantenha TODAS as chaves mesmo que os valores sejam null:

{
  "tipo_documento_detectado": null,
  "confianca_geral": 0.85,
  "confianca_campos": {},
  "dados_diplomado": {
    "nome_completo": null,
    "nome_social": null,
    "cpf": null,
    "rg": { "numero": null, "orgao": null, "uf": null },
    "data_nascimento": null,
    "sexo": null,
    "nacionalidade": null,
    "estado_civil": null,
    "naturalidade": { "cidade": null, "uf": null },
    "genitores": [
      { "nome": null, "sexo": null }
    ]
  },
  "historico_superior": {
    "curso": null,
    "modalidade": null,
    "forma_acesso": null,
    "data_ingresso": null,
    "data_conclusao": null,
    "data_colacao": null,
    "carga_horaria_total": null,
    "disciplinas": [
      {
        "codigo": null,
        "nome": null,
        "carga_horaria": null,
        "nota": null,
        "conceito": null,
        "situacao": null,
        "forma_integralizacao": null,
        "periodo": null,
        "ano": null,
        "docente": null
      }
    ]
  },
  "historico_ensino_medio": {
    "escola": null,
    "cidade": null,
    "uf": null,
    "ano_conclusao": null
  },
  "enem": {
    "ano": null,
    "nota": null
  },
  "enade": {
    "condicao": null,
    "edicao": null,
    "tipo": null
  },
  "horarios_extraidos": [
    { "disciplina": null, "professor": null, "semestre": null, "ano": null }
  ],
  "titulacoes_historicas": [
    { "professor": null, "data_graduacao": null, "data_especializacao": null, "data_mestrado": null, "data_doutorado": null }
  ]
}`

/**
 * Chama Gemini 2.5 Flash para extrair dados de um único documento.
 *
 * @param {object} params
 * @param {string} params.apiKey      - Chave de API do Google (passada pelo Next.js no payload)
 * @param {string} params.base64      - Conteúdo do arquivo em Base64 (sem prefixo data:)
 * @param {string} params.mimeType    - MIME type do arquivo (image/jpeg, application/pdf, ...)
 * @param {string} params.nomeArquivo - Nome original (usado só para logs)
 * @returns {Promise<object>} - Objeto JSON parseado conforme contrato do prompt v3
 */
async function extractDocument({ apiKey, base64, mimeType, nomeArquivo }) {
  if (!apiKey) throw new Error('apiKey obrigatório')
  if (!base64) throw new Error('base64 obrigatório')
  if (!mimeType) throw new Error('mimeType obrigatório')

  const url = GEMINI_ENDPOINT(GEMINI_MODEL, apiKey)

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: PROMPT_EXTRACAO },
          { inlineData: { mimeType, data: base64 } }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      topK: 1,
      topP: 0.95,
      maxOutputTokens: 65536,
      responseMimeType: 'application/json'
    }
  }

  logger.info(`[extractor] Chamando Gemini para ${nomeArquivo} (${mimeType})`)

  const GEMINI_TIMEOUT_MS = 90000 // 90s — históricos com 80+ disciplinas levam mais tempo
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    })
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Gemini timeout após ${GEMINI_TIMEOUT_MS}ms`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '<sem corpo>')
    throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 500)}`)
  }

  const json = await res.json()
  const textoResposta =
    json?.candidates?.[0]?.content?.parts?.[0]?.text ||
    ''

  if (!textoResposta) {
    throw new Error('Gemini retornou resposta vazia')
  }

  // Gemini pode ocasionalmente embrulhar em markdown mesmo com responseMimeType JSON
  const limpo = textoResposta.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
  const match = limpo.match(/\{[\s\S]*\}/)
  if (!match) {
    throw new Error(`Gemini não retornou JSON válido: ${limpo.slice(0, 200)}`)
  }

  try {
    return JSON.parse(match[0])
  } catch (e) {
    throw new Error(`Falha ao parsear JSON do Gemini: ${e.message}`)
  }
}

/**
 * Baixa um arquivo a partir de URL assinada (Supabase signed URL) e retorna Buffer.
 * Aplica timeout via AbortController para evitar hangs indefinidos.
 *
 * @param {string} signedUrl
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=30000]
 */
async function downloadFile(signedUrl, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 30000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(signedUrl, { signal: controller.signal })
    if (!res.ok) {
      throw new Error(`Download falhou HTTP ${res.status} para ${signedUrl.slice(0, 80)}...`)
    }
    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Download timeout após ${timeoutMs}ms`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Classifica se um erro do Gemini vale retry.
 * Retriáveis: rede, timeout, HTTP 429 (rate limit), HTTP 5xx (server-side).
 * NÃO retriáveis: HTTP 4xx (exceto 429), JSON inválido, resposta vazia.
 */
function ehErroRetriavel(err) {
  const msg = err?.message || String(err)
  // Timeout / abort / rede
  if (/timeout|AbortError|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed/i.test(msg)) {
    return true
  }
  // HTTP 429 ou 5xx — regex permissivo contra drift de formato da mensagem
  const match = msg.match(/Gemini.*?(\d{3})/)
  if (match) {
    const status = Number(match[1])
    return status === 429 || (status >= 500 && status <= 599)
  }
  return false
}

/**
 * Wrapper com retry + backoff exponencial em cima de extractDocument.
 *
 * Sessão 037 (09/04/2026): criado porque a memória da sessão 034 mencionava
 * "Gemini retry backoff 503" mas o retry nunca existiu de fato no código —
 * só no callback (que sumiu na sessão 033 com o DB write direto).
 *
 * Configurável via env var `EXTRACAO_MAX_TENTATIVAS` (default 5).
 * Backoff: 1s, 2s, 4s, 8s entre tentativas.
 *
 * Não retenta erros não-retriáveis (4xx exceto 429, JSON inválido).
 */
async function extractDocumentComRetry(params) {
  const MAX_TENTATIVAS = Number(process.env.EXTRACAO_MAX_TENTATIVAS) || 5
  const MAX_DELAY_MS = 30_000
  const nome = params?.nomeArquivo ?? 'desconhecido'
  let ultimoErro = null

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      const resultado = await extractDocument(params)
      if (tentativa > 1) {
        logger.info(
          `[extractor] ${nome} sucesso na tentativa ${tentativa}/${MAX_TENTATIVAS}`
        )
      }
      return resultado
    } catch (err) {
      ultimoErro = err
      const retriavel = ehErroRetriavel(err)
      logger.warn(
        `[extractor] ${nome} tentativa ${tentativa}/${MAX_TENTATIVAS} falhou (retriável=${retriavel}): ${err.message}`
      )

      // Erro não-retriável → falha imediata
      if (!retriavel) break
      // Última tentativa → falha
      if (tentativa === MAX_TENTATIVAS) break

      // Backoff exponencial com cap de 30s + jitter anti-thundering-herd
      const base = Math.min(1000 * Math.pow(2, tentativa - 1), MAX_DELAY_MS)
      const jitter = Math.random() * 1000
      await new Promise((r) => setTimeout(r, base + jitter))
    }
  }

  throw ultimoErro
}

module.exports = {
  extractDocument,
  extractDocumentComRetry,
  ehErroRetriavel,
  downloadFile,
  GEMINI_MODEL,
  PROMPT_EXTRACAO
}
