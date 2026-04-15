/**
 * cross-reference.ts — Cruzamento de arquivos por tipo para migração em lote
 *
 * Quando os arquivos estão organizados por TIPO (pasta diplomas, pasta históricos,
 * pasta RVDDs) em vez de por aluno, este módulo faz o cruzamento para montar kits.
 *
 * Estratégia em cascata:
 *   1. CSV com mapeamento explícito  → usa o CSV como fonte de verdade
 *   2. CPF detectado no nome do arquivo → agrupa todos os arquivos com o mesmo CPF
 *   3. Nome base normalizado            → agrupa arquivos com o mesmo nome (sem extensão)
 */

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface ArquivoCarregado {
  /** Objeto File nativo do browser */
  file: File
  /** Nome do arquivo (sem caminho) */
  nome: string
  /** Nome da pasta de origem (primeiro segmento do webkitRelativePath) */
  pastaOrigem: string
  /** Extensão em minúsculas, sem ponto */
  extensao: string
  /** CPF de 11 dígitos encontrado no nome do arquivo, ou null */
  cpfDetectado: string | null
  /** Nome base normalizado para comparações (sem extensão, sem acentos) */
  baseNome: string
}

export interface KitAluno {
  /** Identificador principal do aluno (CPF se detectado, senão baseNome) */
  identificador: string
  /** Nome do aluno, se disponível via CSV */
  nomeAluno?: string
  /** Lista de arquivos que compõem este kit */
  arquivos: ArquivoCarregado[]
  /** true se o kit tem pelo menos 2 XMLs e 1 PDF */
  completo: boolean
  /** Razões para incompletude (vazio se completo) */
  problemas: string[]
  /** Contagem simplificada dos arquivos */
  contagem: {
    xmls: number
    pdfs: number
  }
}

export interface ResultadoCrossRef {
  kits: KitAluno[]
  /** Arquivos que não foram associados a nenhum kit */
  arquivosSemKit: ArquivoCarregado[]
  /** Método usado no cruzamento */
  metodo: 'csv' | 'cpf' | 'nome-base'
  totalArquivos: number
  totalCompletos: number
  totalIncompletos: number
  /** Aviso opcional (ex: CPF não encontrado em alguns arquivos) */
  aviso?: string
}

// ── Extração de identificador do nome de arquivo ──────────────────────────────

/**
 * Extrai CPF (11 dígitos) do nome de arquivo.
 * Ex:
 *   "diploma_04562910172.xml"   → "04562910172"
 *   "04562910172_diploma.xml"   → "04562910172"
 *   "04562910172.pdf"           → "04562910172"
 *   "joao_silva.xml"            → null
 */
export function extrairCPFDoNome(nomeArquivo: string): string | null {
  const base = nomeArquivo.replace(/\.\w+$/, '')
  // Prefere sequência delimitada por não-dígitos ou início/fim
  const matchDelim = base.match(/(?:^|[^0-9])(\d{11})(?:[^0-9]|$)/)
  if (matchDelim) return matchDelim[1]
  // Fallback: qualquer sequência de exatamente 11 dígitos
  const matchRaw = base.match(/\b(\d{11})\b/)
  if (matchRaw) return matchRaw[1]
  // Último recurso: 11 dígitos consecutivos sem marcadores de palavra
  const matchAny = base.match(/(\d{11})/)
  return matchAny ? matchAny[1] : null
}

/**
 * Normaliza o nome base do arquivo para comparação cross-pasta.
 * Remove extensão, acentos e caracteres especiais.
 * Ex: "João_Silva.xml" → "joao_silva"
 */
export function normalizarBaseNome(nomeArquivo: string): string {
  return nomeArquivo
    .replace(/\.\w+$/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

/**
 * Cria um ArquivoCarregado a partir de um File nativo do browser.
 */
export function criarArquivoCarregado(file: File): ArquivoCarregado {
  const nome = file.name
  const extensao = nome.split('.').pop()?.toLowerCase() ?? ''
  const cpfDetectado = extrairCPFDoNome(nome)
  const webkitPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? ''
  const pastaOrigem = webkitPath ? webkitPath.split('/')[0] : ''

  return {
    file,
    nome,
    pastaOrigem,
    extensao,
    cpfDetectado,
    baseNome: normalizarBaseNome(nome),
  }
}

// ── Parsing de CSV ────────────────────────────────────────────────────────────

export interface LinhaCSV {
  cpf: string
  nomeAluno?: string
  arquivosDiploma: string[]
  arquivosHistorico: string[]
  arquivosRvdd: string[]
  outrosCampos: Record<string, string>
}

export interface ResultadoParseCSV {
  linhas: LinhaCSV[]
  colunas: string[]
  formato: 'cpf-arquivo' | 'cpf-aluno' | 'desconhecido'
  aviso?: string
}

function detectarSeparador(linha: string): string {
  const ponto    = (linha.match(/;/g) ?? []).length
  const virgula  = (linha.match(/,/g) ?? []).length
  const tab      = (linha.match(/\t/g) ?? []).length
  if (ponto  >= virgula && ponto  >= tab) return ';'
  if (tab    >= virgula) return '\t'
  return ','
}

/**
 * Parseia o conteúdo de um arquivo CSV, tentando identificar colunas
 * relevantes: CPF, nome do aluno, nomes de arquivo.
 */
export function parsearCSV(conteudo: string): ResultadoParseCSV {
  const linhas = conteudo.trim().split(/\r?\n/).filter(l => l.trim())
  if (linhas.length < 2) {
    return { linhas: [], colunas: [], formato: 'desconhecido', aviso: 'CSV vazio ou só com cabeçalho' }
  }

  const sep = detectarSeparador(linhas[0])
  const colunas = linhas[0]
    .split(sep)
    .map(c => c.trim().replace(/^["']|["']$/g, '').toLowerCase())

  // Detecta índices de colunas relevantes (aceita variações de nome)
  const iCPF      = colunas.findIndex(c => /cpf|documento|doc/.test(c))
  const iNome     = colunas.findIndex(c => /^nome$|^aluno$|^nome_aluno$|^diplomado$/.test(c))
  const iDiploma  = colunas.findIndex(c => /diploma|xml_diploma/.test(c))
  const iHistorico = colunas.findIndex(c => /historico|histórico|docacad|hist/.test(c))
  const iRvdd     = colunas.findIndex(c => /rvdd|pdf/.test(c))

  const resultado: LinhaCSV[] = []

  for (let i = 1; i < linhas.length; i++) {
    const celulas = linhas[i]
      .split(sep)
      .map(c => c.trim().replace(/^["']|["']$/g, ''))
    if (celulas.every(c => !c)) continue

    const linha: LinhaCSV = {
      cpf: '',
      arquivosDiploma: [],
      arquivosHistorico: [],
      arquivosRvdd: [],
      outrosCampos: {},
    }

    if (iCPF >= 0)      linha.cpf = (celulas[iCPF] ?? '').replace(/\D/g, '')
    if (iNome >= 0)     linha.nomeAluno = celulas[iNome] ?? undefined
    if (iDiploma >= 0 && celulas[iDiploma])   linha.arquivosDiploma = [celulas[iDiploma]]
    if (iHistorico >= 0 && celulas[iHistorico]) linha.arquivosHistorico = [celulas[iHistorico]]
    if (iRvdd >= 0 && celulas[iRvdd])         linha.arquivosRvdd = [celulas[iRvdd]]

    for (let j = 0; j < colunas.length; j++) {
      if (j !== iCPF && j !== iNome && celulas[j]) {
        linha.outrosCampos[colunas[j]] = celulas[j]
      }
    }

    if (linha.cpf || linha.nomeAluno) resultado.push(linha)
  }

  const temArquivos = iDiploma >= 0 || iHistorico >= 0 || iRvdd >= 0
  const formato = temArquivos ? 'cpf-arquivo' :
                  resultado.length > 0 ? 'cpf-aluno' : 'desconhecido'

  return { linhas: resultado, colunas, formato }
}

// ── Cross-reference ───────────────────────────────────────────────────────────

/** Cross-ref via CSV: usa nomes de arquivo explícitos ou CPF para montar kits */
function crossReferencePorCSV(
  arquivos: ArquivoCarregado[],
  csvData: ResultadoParseCSV,
): ResultadoCrossRef {
  const kits: KitAluno[] = []
  const usados = new Set<string>()

  // Índice rápido: nome → arquivo  (case-insensitive)
  const porNome = new Map<string, ArquivoCarregado>()
  for (const a of arquivos) {
    porNome.set(a.nome.toLowerCase(), a)
  }

  for (const linha of csvData.linhas) {
    const id = linha.cpf || linha.nomeAluno || ''
    if (!id) continue

    const kitArquivos: ArquivoCarregado[] = []

    // Estratégia 1: nomes de arquivo explícitos no CSV
    const todosNomes = [
      ...linha.arquivosDiploma,
      ...linha.arquivosHistorico,
      ...linha.arquivosRvdd,
    ]
    for (const n of todosNomes) {
      const arq = porNome.get(n.toLowerCase())
      if (arq && !usados.has(arq.nome)) {
        kitArquivos.push(arq)
        usados.add(arq.nome)
      }
    }

    // Estratégia 2: se CSV tem CPF mas sem nomes de arquivo, busca por CPF
    if (kitArquivos.length === 0 && linha.cpf) {
      for (const arq of arquivos) {
        if (arq.cpfDetectado === linha.cpf && !usados.has(arq.nome)) {
          kitArquivos.push(arq)
          usados.add(arq.nome)
        }
      }
    }

    if (kitArquivos.length > 0) {
      kits.push(montarKit(id, kitArquivos, linha.nomeAluno))
    }
  }

  const semKit = arquivos.filter(a => !usados.has(a.nome))
  return finalizarCrossRef(kits, semKit, arquivos.length, 'csv')
}

/** Cross-ref por CPF: agrupa todos os arquivos que têm o mesmo CPF no nome */
function crossReferencePorCPF(arquivos: ArquivoCarregado[]): ResultadoCrossRef {
  const grupos = new Map<string, ArquivoCarregado[]>()
  const semCPF: ArquivoCarregado[] = []

  for (const arq of arquivos) {
    if (arq.cpfDetectado) {
      const lista = grupos.get(arq.cpfDetectado) ?? []
      lista.push(arq)
      grupos.set(arq.cpfDetectado, lista)
    } else {
      semCPF.push(arq)
    }
  }

  const kits = Array.from(grupos.entries()).map(([cpf, arqs]) =>
    montarKit(cpf, arqs),
  )

  const aviso = semCPF.length > 0
    ? `${semCPF.length} arquivo(s) sem CPF no nome não foram associados a nenhum aluno`
    : undefined

  return { ...finalizarCrossRef(kits, semCPF, arquivos.length, 'cpf'), aviso }
}

/** Cross-ref por nome base: arquivos com o mesmo nome (sem extensão) = mesmo aluno */
function crossReferencePorBaseNome(arquivos: ArquivoCarregado[]): ResultadoCrossRef {
  const grupos = new Map<string, ArquivoCarregado[]>()

  for (const arq of arquivos) {
    const lista = grupos.get(arq.baseNome) ?? []
    lista.push(arq)
    grupos.set(arq.baseNome, lista)
  }

  const kits = Array.from(grupos.entries()).map(([base, arqs]) =>
    montarKit(base, arqs),
  )

  return finalizarCrossRef(kits, [], arquivos.length, 'nome-base')
}

/**
 * Função principal de cross-reference.
 *
 * Tenta em cascata:
 *   1. CSV (se fornecido e tiver linhas válidas)
 *   2. CPF no nome do arquivo (se ≥ 50% dos arquivos têm CPF)
 *   3. Nome base normalizado (fallback garantido)
 */
export function crossReference(
  arquivos: ArquivoCarregado[],
  csvContent?: string | null,
): ResultadoCrossRef {
  // Filtra CSVs da lista (tratados separadamente)
  const arqReais = arquivos.filter(a => a.extensao !== 'csv')

  if (arqReais.length === 0) {
    return {
      kits: [], arquivosSemKit: [], metodo: 'nome-base',
      totalArquivos: 0, totalCompletos: 0, totalIncompletos: 0,
    }
  }

  // 1. Tentativa via CSV
  if (csvContent) {
    const csv = parsearCSV(csvContent)
    if (csv.linhas.length > 0) {
      const resultado = crossReferencePorCSV(arqReais, csv)
      if (resultado.kits.length > 0) return resultado
    }
  }

  // 2. Tentativa via CPF no nome
  const comCPF = arqReais.filter(a => a.cpfDetectado !== null)
  if (comCPF.length >= arqReais.length * 0.5) {
    return crossReferencePorCPF(arqReais)
  }

  // 3. Fallback: nome base
  return crossReferencePorBaseNome(arqReais)
}

// ── Helpers internos ──────────────────────────────────────────────────────────

function montarKit(
  identificador: string,
  arquivos: ArquivoCarregado[],
  nomeAluno?: string,
): KitAluno {
  const xmls = arquivos.filter(a => a.extensao === 'xml')
  const pdfs = arquivos.filter(a => a.extensao === 'pdf')
  const problemas: string[] = []

  if (xmls.length < 2) {
    problemas.push(
      `Somente ${xmls.length} XML${xmls.length !== 1 ? 's' : ''} (esperados 2: DiplomaDigital + DocumentacaoAcademica)`,
    )
  }
  if (pdfs.length === 0) {
    problemas.push('Sem RVDD (nenhum PDF encontrado)')
  }
  if (arquivos.length > 3) {
    problemas.push(`${arquivos.length} arquivos no kit — esperado máximo de 3`)
  }

  return {
    identificador,
    nomeAluno,
    arquivos,
    completo: problemas.length === 0,
    problemas,
    contagem: { xmls: xmls.length, pdfs: pdfs.length },
  }
}

function finalizarCrossRef(
  kits: KitAluno[],
  arquivosSemKit: ArquivoCarregado[],
  totalArquivos: number,
  metodo: ResultadoCrossRef['metodo'],
): ResultadoCrossRef {
  const totalCompletos   = kits.filter(k => k.completo).length
  const totalIncompletos = kits.length - totalCompletos
  return { kits, arquivosSemKit, metodo, totalArquivos, totalCompletos, totalIncompletos }
}

// ── Montagem de kits a partir do mapeamento da IA ────────────────────────────

/**
 * Formato do JSON emitido pela IA via [ACAO:MAPEAMENTO].
 * A IA analisa o CSV, infere o esquema e devolve este objeto.
 */
export interface MapeamentoIA {
  /** Descrição da regra inferida pela IA */
  regra: string
  /** Kits mapeados pela IA */
  kits: Array<{
    id: string
    nomeAluno?: string
    diploma: string | null
    docacad: string | null
    rvdd: string | null
  }>
  /** Nomes de arquivos sem par identificado */
  semKit?: string[]
}

/**
 * Extrai JSON com chaves balanceadas após o marcador [ACAO:MAPEAMENTO].
 * Regex simples não funciona com JSON aninhado (objetos dentro de arrays).
 */
function extrairJsonMapeamento(texto: string): string | null {
  const markerIdx = texto.indexOf('[ACAO:MAPEAMENTO]')
  if (markerIdx === -1) return null
  const resto = texto.slice(markerIdx + '[ACAO:MAPEAMENTO]'.length).trimStart()
  if (!resto.startsWith('{')) return null

  let depth = 0
  let i = 0
  for (; i < resto.length; i++) {
    if (resto[i] === '{') depth++
    else if (resto[i] === '}') {
      depth--
      if (depth === 0) { i++; break }
    }
  }
  return depth === 0 ? resto.slice(0, i) : null
}

/**
 * Parseia o JSON do marcador [ACAO:MAPEAMENTO] da resposta da IA.
 * Usa balanceamento de chaves em vez de regex para suportar JSON aninhado.
 * Retorna null se o marcador não existir ou o JSON for inválido.
 */
export function parsearMapeamentoIA(textoResposta: string): MapeamentoIA | null {
  const jsonStr = extrairJsonMapeamento(textoResposta)
  if (!jsonStr) return null
  try {
    const parsed = JSON.parse(jsonStr)
    if (!parsed.kits || !Array.isArray(parsed.kits)) return null
    return parsed as MapeamentoIA
  } catch {
    return null
  }
}

/**
 * Monta KitAluno[] a partir do mapeamento devolvido pela IA,
 * cruzando com a lista real de ArquivoCarregado[] carregados pelo usuário.
 *
 * A IA devolve nomes de arquivo — esta função localiza os objetos File reais.
 */
export function montarKitsFromMapeamentoIA(
  mapeamento: MapeamentoIA,
  arquivos: ArquivoCarregado[],
): ResultadoCrossRef {
  // Índice de busca rápida: nome-do-arquivo (lowercase) → ArquivoCarregado
  // Aceita tanto "pasta/nome.ext" quanto "nome.ext"
  const porNome = new Map<string, ArquivoCarregado>()
  for (const a of arquivos) {
    porNome.set(a.nome.toLowerCase(), a)
    if (a.pastaOrigem) {
      porNome.set(`${a.pastaOrigem}/${a.nome}`.toLowerCase(), a)
    }
  }

  const kits: KitAluno[] = []
  const usados = new Set<string>()

  for (const kitIA of mapeamento.kits) {
    const kitArquivos: ArquivoCarregado[] = []

    const resolver = (nomeIA: string | null): ArquivoCarregado | null => {
      if (!nomeIA) return null
      // Tenta match exato (com ou sem pasta)
      const candidato = porNome.get(nomeIA.toLowerCase())
        ?? porNome.get(nomeIA.split('/').pop()!.toLowerCase())
      return candidato ?? null
    }

    const arqDiploma  = resolver(kitIA.diploma)
    const arqDocacad  = resolver(kitIA.docacad)
    const arqRvdd     = resolver(kitIA.rvdd)

    for (const arq of [arqDiploma, arqDocacad, arqRvdd]) {
      if (arq && !usados.has(arq.nome)) {
        kitArquivos.push(arq)
        usados.add(arq.nome)
      }
    }

    if (kitArquivos.length > 0) {
      kits.push(montarKit(kitIA.id, kitArquivos, kitIA.nomeAluno))
    }
  }

  const semKit = arquivos.filter(a => !usados.has(a.nome))
  return finalizarCrossRef(kits, semKit, arquivos.length, 'csv')
}

// ── Serialização para o contexto da IA ───────────────────────────────────────

/**
 * Converte a lista de ArquivoCarregado para uma representação compacta
 * segura para incluir no contexto da IA (sem objetos File).
 */
export function serializarArquivosParaIA(arquivos: ArquivoCarregado[]): Array<{
  nome: string
  pasta: string
  extensao: string
  cpf: string | null
}> {
  return arquivos.map(a => ({
    nome: a.nome,
    pasta: a.pastaOrigem,
    extensao: a.extensao,
    cpf: a.cpfDetectado,
  }))
}

/**
 * Converte os kits do cross-reference para uma representação compacta
 * segura para incluir no contexto da IA.
 */
export function serializarKitsParaIA(kits: KitAluno[]): Array<{
  id: string
  nome?: string
  completo: boolean
  xmls: number
  pdfs: number
  problemas: string[]
}> {
  return kits.map(k => ({
    id: k.identificador,
    nome: k.nomeAluno,
    completo: k.completo,
    xmls: k.contagem.xmls,
    pdfs: k.contagem.pdfs,
    problemas: k.problemas,
  }))
}
