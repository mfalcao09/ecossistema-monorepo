/**
 * Utilitários compartilhados para o Histórico Escolar Digital
 * Usados tanto no LivePreview (config) quanto no HistoricoPreviewDialog (processo)
 */

// ══════════════════════════════════════════════════════════════
// 1) Abreviação de órgão emissor
//    "INSTITUTO DE IDENTIFICAÇÃO GONÇALO PEREIRA / MS" → "IIGP/MS"
//    Regra: se o nome tiver mais de 30 chars, abrevia pegando as iniciais
//    das palavras significativas (ignora preposições) + mantém UF após "/"
// ══════════════════════════════════════════════════════════════

const PREPOSICOES = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'em', 'no', 'na', 'nos', 'nas', 'o', 'a', 'os', 'as', 'para', 'por', 'com'])

export function abreviarOrgaoEmissor(nome: string | null | undefined, maxChars = 30): string {
  if (!nome) return ''
  const trimmed = nome.trim()
  if (trimmed.length <= maxChars) return trimmed

  // Separar parte antes e depois da barra (UF)
  const barraIdx = trimmed.lastIndexOf('/')
  let parteNome = barraIdx >= 0 ? trimmed.substring(0, barraIdx).trim() : trimmed
  const parteUF = barraIdx >= 0 ? trimmed.substring(barraIdx + 1).trim() : ''

  // Pegar iniciais das palavras significativas
  const palavras = parteNome.split(/\s+/)
  const iniciais = palavras
    .filter(p => !PREPOSICOES.has(p.toLowerCase()))
    .map(p => p.charAt(0).toUpperCase())
    .join('')

  return parteUF ? `${iniciais}/${parteUF}` : iniciais
}

// ══════════════════════════════════════════════════════════════
// 2) Formatação de data YYYY-MM-DD → DD/MM/YYYY
// ══════════════════════════════════════════════════════════════

export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  // Já está no formato DD/MM/YYYY?
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr
  // Formato ISO YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return `${match[3]}/${match[2]}/${match[1]}`
  return dateStr
}

// ══════════════════════════════════════════════════════════════
// 3) Cálculo de período letivo com ano/semestre
//    Se ingresso = 2017-02-01, período 1 = 2017/1, período 2 = 2017/2, etc.
//    O semestre do ingresso é determinado pelo mês:
//      Janeiro–Junho = semestre 1
//      Julho–Dezembro = semestre 2
// ══════════════════════════════════════════════════════════════

export interface PeriodoInfo {
  numero: number   // 1, 2, 3...
  ano: number      // 2017, 2018...
  semestre: number  // 1 ou 2
  label: string    // "2017/1"
}

/**
 * Calcula o ano e semestre de um período a partir da data de ingresso.
 * @param periodoNum Número do período (1-based string, ex: "1", "2", "3")
 * @param dataIngresso Data de ingresso no formato YYYY-MM-DD ou DD/MM/YYYY
 */
export function calcularPeriodo(periodoNum: string | number | null, dataIngresso: string | null): PeriodoInfo | null {
  if (!periodoNum || !dataIngresso) return null

  const num = typeof periodoNum === 'string' ? parseInt(periodoNum, 10) : periodoNum
  if (isNaN(num) || num < 1) return null

  // Extrair ano e mês do ingresso
  let anoIngresso: number
  let mesIngresso: number

  if (/^\d{4}-\d{2}-\d{2}/.test(dataIngresso)) {
    // YYYY-MM-DD
    anoIngresso = parseInt(dataIngresso.substring(0, 4))
    mesIngresso = parseInt(dataIngresso.substring(5, 7))
  } else if (/^\d{2}\/\d{2}\/\d{4}/.test(dataIngresso)) {
    // DD/MM/YYYY
    anoIngresso = parseInt(dataIngresso.substring(6, 10))
    mesIngresso = parseInt(dataIngresso.substring(3, 5))
  } else {
    return null
  }

  // Semestre do ingresso: jan-jun = 1, jul-dez = 2
  const semestreIngresso = mesIngresso <= 6 ? 1 : 2

  // Offset relativo (0-based): período 1 = offset 0
  const offset = num - 1

  // Calcular semestre absoluto desde o ingresso
  const semestreAbsoluto = (semestreIngresso - 1) + offset // 0-based
  const ano = anoIngresso + Math.floor(semestreAbsoluto / 2)
  const semestre = (semestreAbsoluto % 2) + 1 // 1 ou 2

  return {
    numero: num,
    ano,
    semestre,
    label: `${ano}/${semestre}`,
  }
}

/**
 * Formata o label do grupo de período usando o template configurado.
 * Templates suportados:
 *   {numero}  → número do período (1, 2, 3...)
 *   {AAAA}    → ano calculado (2017, 2018...)
 *   {semestre} → semestre calculado (1 ou 2)
 */
export function formatGroupLabel(
  template: string,
  periodoKey: string,
  agrupar_por: string,
  dataIngresso?: string | null,
): string {
  if (agrupar_por === 'etiqueta') return periodoKey
  if (agrupar_por === 'nenhum') return ''

  // agrupar_por === 'periodo'
  const info = calcularPeriodo(periodoKey, dataIngresso || null)

  if (info) {
    return template
      .replace('{numero}', String(info.numero))
      .replace('{AAAA}', String(info.ano))
      .replace('{semestre}', String(info.semestre))
  }

  // Fallback: substituir apenas {numero}
  return template.replace('{numero}', periodoKey).replace('{AAAA}', '').replace('{semestre}', '')
}

/**
 * Formata o valor de período na célula da tabela.
 * Se há data de ingresso, exibe "{AAAA}/{semestre}" em vez do número cru.
 */
export function formatPeriodoCelula(periodoNum: string | null, dataIngresso?: string | null): string {
  if (!periodoNum) return '-'
  if (!dataIngresso) return periodoNum

  const info = calcularPeriodo(periodoNum, dataIngresso)
  if (info) return info.label
  return periodoNum
}

// ══════════════════════════════════════════════════════════════
// 4) Texto de reconhecimento/renovação formatado
//    Monta string como: "Portaria nº 123, de 01/01/2020, publicada no D.O.U. em 02/01/2020"
// ══════════════════════════════════════════════════════════════

export interface AtoRegulatorioData {
  tipo?: string | null
  numero?: string | null
  data?: string | null
  data_publicacao?: string | null
  veiculo_publicacao?: string | null
  secao_publicacao?: string | number | null
  pagina_publicacao?: string | number | null
  numero_dou?: string | null
}

export function formatAtoRegulatorio(ato: AtoRegulatorioData | null | undefined): string {
  if (!ato) return ''

  const parts: string[] = []

  // Tipo + Número
  if (ato.tipo || ato.numero) {
    const tipoStr = ato.tipo || 'Ato'
    parts.push(ato.numero ? `${tipoStr} nº ${ato.numero}` : tipoStr)
  }

  // Data do ato
  if (ato.data) {
    parts.push(`de ${formatDateBR(ato.data)}`)
  }

  // Publicação DOU
  if (ato.data_publicacao) {
    let pub = `publicado(a) no ${ato.veiculo_publicacao || 'D.O.U.'} em ${formatDateBR(ato.data_publicacao)}`
    if (ato.secao_publicacao) pub += `, Seção ${ato.secao_publicacao}`
    if (ato.pagina_publicacao) pub += `, p. ${ato.pagina_publicacao}`
    parts.push(pub)
  }

  return parts.join(', ')
}
