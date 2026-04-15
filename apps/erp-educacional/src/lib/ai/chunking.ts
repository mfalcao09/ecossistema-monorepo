/**
 * chunking.ts — Divisão inteligente de skills markdown em chunks para RAG
 *
 * Estratégia:
 * - Divide por seções H2 (## ) para respeitar estrutura semântica
 * - Se seção > 500 tokens, subdivide por parágrafos com sobreposição
 * - Prefixo "[NomeSkill] TítuloSeção" em cada chunk para contexto no retrieval
 * - Extrai palavras-chave para hybrid search (BM25-like)
 */

export interface Chunk {
  conteudo: string
  posicao: number
  titulo_secao: string
  palavras_chave: string[]
}

const MAX_TOKENS = 500
const SOBREPOSICAO_FRASES = 2

/**
 * Estima tokens de forma simples (1 token ≈ 4 chars em PT-BR)
 */
export function estimarTokens(texto: string): number {
  return Math.ceil(texto.length / 4)
}

/**
 * Extrai palavras-chave relevantes para hybrid search.
 * Remove stopwords PT-BR e retorna top 10 por frequência.
 */
export function extrairPalavrasChave(texto: string): string[] {
  const stopwords = new Set([
    'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
    'com', 'por', 'para', 'que', 'se', 'ou', 'um', 'uma', 'os', 'as',
    'ao', 'aos', 'às', 'pelo', 'pela', 'e', 'é', 'a', 'o', 'não',
    'ser', 'ter', 'como', 'mais', 'entre', 'sobre', 'sua', 'seu',
    'seus', 'suas', 'este', 'esta', 'esse', 'essa', 'isto', 'isso',
    'aquele', 'aquela', 'mas', 'também', 'já', 'ainda', 'quando',
    'onde', 'qual', 'quais', 'todo', 'toda', 'todos', 'todas',
    'pode', 'deve', 'será', 'foi', 'são', 'está', 'estão',
  ])

  const palavras = texto
    .toLowerCase()
    .replace(/[^\wáàãâéêíóôõúçÁÀÃÂÉÊÍÓÔÕÚÇ\s]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length > 3 && !stopwords.has(p))

  const freq = new Map<string, number>()
  palavras.forEach((p) => freq.set(p, (freq.get(p) ?? 0) + 1))

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([palavra]) => palavra)
}

/**
 * Divide uma skill markdown em chunks otimizados para RAG.
 * Respeita seções H2 e subdivide quando necessário.
 */
export function dividirSkillEmChunks(
  markdown: string,
  nomeSkill: string,
  maxTokens: number = MAX_TOKENS
): Chunk[] {
  const chunks: Chunk[] = []
  let posicao = 1

  if (!markdown?.trim()) return chunks

  // Dividir por seções H2 — preserva "## " no início de cada item
  const partes = markdown.split(/(?=^## )/gm).filter(Boolean)

  for (const parte of partes) {
    const linhas = parte.split('\n')
    const cabecalho = linhas[0].trim()

    // Extrair título: remover "## " ou "#" do começo
    const tituloSecao = cabecalho.replace(/^#+\s*/, '') || nomeSkill
    const conteudoSecao = linhas.slice(1).join('\n').trim()

    if (!conteudoSecao || conteudoSecao.length < 20) continue

    const tokensSecao = estimarTokens(conteudoSecao)

    if (tokensSecao <= maxTokens) {
      // Seção cabe inteira num chunk
      chunks.push({
        conteudo: `[${nomeSkill}] ${tituloSecao}\n\n${conteudoSecao}`,
        posicao: posicao++,
        titulo_secao: tituloSecao,
        palavras_chave: extrairPalavrasChave(conteudoSecao),
      })
    } else {
      // Seção grande: dividir por parágrafos com sobreposição
      const paragrafos = conteudoSecao.split(/\n\n+/).filter((p) => p.trim())
      let buffer = ''
      let ultimasFrases = ''

      for (const paragrafo of paragrafos) {
        const candidato = buffer
          ? `${buffer}\n\n${paragrafo}`
          : `${ultimasFrases}${ultimasFrases ? '\n\n' : ''}${paragrafo}`

        if (estimarTokens(candidato) > maxTokens && buffer.length > 0) {
          // Flush buffer
          chunks.push({
            conteudo: `[${nomeSkill}] ${tituloSecao}\n\n${buffer}`,
            posicao: posicao++,
            titulo_secao: tituloSecao,
            palavras_chave: extrairPalavrasChave(buffer),
          })

          // Sobreposição: manter últimas N frases para contexto
          const frases = buffer.split(/(?<=[.!?])\s+/)
          ultimasFrases = frases.slice(-SOBREPOSICAO_FRASES).join(' ')
          buffer = ultimasFrases ? `${ultimasFrases}\n\n${paragrafo}` : paragrafo
        } else {
          buffer = candidato
        }
      }

      // Último chunk da seção
      if (buffer.trim().length > 20) {
        chunks.push({
          conteudo: `[${nomeSkill}] ${tituloSecao}\n\n${buffer}`,
          posicao: posicao++,
          titulo_secao: tituloSecao,
          palavras_chave: extrairPalavrasChave(buffer),
        })
      }
    }
  }

  // Fallback: se não encontrou H2, trata tudo como um único bloco
  if (chunks.length === 0 && markdown.trim().length > 0) {
    const conteudo = markdown.trim()
    const tokensTotal = estimarTokens(conteudo)

    if (tokensTotal <= maxTokens) {
      chunks.push({
        conteudo: `[${nomeSkill}]\n\n${conteudo}`,
        posicao: 1,
        titulo_secao: nomeSkill,
        palavras_chave: extrairPalavrasChave(conteudo),
      })
    } else {
      // Dividir por parágrafos sem cabeçalho H2
      return dividirSkillEmChunks(
        `## ${nomeSkill}\n\n${conteudo}`,
        nomeSkill,
        maxTokens
      )
    }
  }

  return chunks
}
