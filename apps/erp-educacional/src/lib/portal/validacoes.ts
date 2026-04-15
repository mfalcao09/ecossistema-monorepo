// ============================================================
// VALIDAÇÕES — Portal de Consulta Pública
// Funções de validação para CPF, código de verificação e datas
// ============================================================

/**
 * Remove caracteres não-dígitos do CPF
 * @param cpf CPF com ou sem formatação
 * @returns CPF contendo apenas dígitos
 */
export function limparCPF(cpf: string): string {
  return cpf.replace(/\D/g, '')
}

/**
 * Valida CPF usando o algoritmo de dígitos verificadores (mod 11)
 * Também verifica se é um CPF válido (não todos os dígitos iguais)
 * @param cpf CPF com ou sem formatação
 * @returns true se CPF é válido
 */
export function validarCPF(cpf: string): boolean {
  const cpfLimpo = limparCPF(cpf)

  // Validar comprimento
  if (cpfLimpo.length !== 11) {
    return false
  }

  // Rejeitar CPFs com todos os dígitos iguais
  if (/^(\d)\1{10}$/.test(cpfLimpo)) {
    return false
  }

  // Calcular primeiro dígito verificador
  let soma = 0
  let resto
  for (let i = 1; i <= 9; i++) {
    soma += parseInt(cpfLimpo.substring(i - 1, i)) * (11 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(cpfLimpo.substring(9, 10))) {
    return false
  }

  // Calcular segundo dígito verificador
  soma = 0
  for (let i = 1; i <= 10; i++) {
    soma += parseInt(cpfLimpo.substring(i - 1, i)) * (12 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(cpfLimpo.substring(10, 11))) {
    return false
  }

  return true
}

/**
 * Mascara CPF para exibição pública (mostra apenas primeiros 3 e últimos 2 dígitos)
 * Formato: 123.***.***-45
 * @param cpf CPF com ou sem formatação
 * @returns CPF mascarado ou *** se inválido
 */
export function mascararCPF(cpf: string): string {
  const cpfLimpo = limparCPF(cpf)

  if (cpfLimpo.length !== 11) {
    return '***.***.***-**'
  }

  return `${cpfLimpo.slice(0, 3)}.***.***.${cpfLimpo.slice(-2)}`
}

/**
 * Valida formato do código de verificação
 * Aceita dois formatos:
 *   - Novo: 0000.0000.00000000 (16 dígitos, com ou sem pontos)
 *   - Legado: 0000.000.xxxxxxxxxxxx (ex: 1606.694.b52ba3cac8b9 — alfanumérico com pontos)
 * @param codigo Código de verificação
 * @returns true se o formato é válido
 */
export function validarCodigoVerificacao(codigo: string): boolean {
  if (!codigo || codigo.trim().length === 0) return false

  // Formato legado: NNNN.NNN.xxxxxxxxxxxx (alfanumérico com pontos, ex: 1606.694.b52ba3cac8b9)
  if (/^\d{4}\.\d{3}\.[a-f0-9]{12}$/.test(codigo)) {
    return true
  }

  // Formato FIC novo: FIC-YYYY-XXXXXXXX (ex: FIC-2026-3A8F1C90)
  // Gerado por publicar/route.ts: `FIC-${ano}-${rand8hexUpper}`
  if (/^FIC-\d{4}-[a-f0-9]{8}$/i.test(codigo)) {
    return true
  }

  // Formato hex genérico: 16 chars hex (com ou sem pontos/hífens)
  const codigoLimpo = codigo.replace(/[.\-\s]/g, '')
  if (/^[a-f0-9]{16}$/i.test(codigoLimpo)) {
    return true
  }

  // Formato numérico: exatamente 16 dígitos
  const soDigitos = codigo.replace(/\D/g, '')
  if (soDigitos.length === 16 && /^\d{16}$/.test(soDigitos)) {
    return true
  }

  return false
}

/**
 * Valida data de nascimento
 * Verifica se é uma data válida e não está no futuro
 * @param data Data em formato YYYY-MM-DD ou DD/MM/YYYY
 * @returns true se data é válida e não está no futuro
 */
export function validarDataNascimento(data: string): boolean {
  let dataParsed: Date

  // Tentar parsear formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    dataParsed = new Date(data)
  }
  // Tentar parsear formato DD/MM/YYYY
  else if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
    const [dia, mes, ano] = data.split('/')
    dataParsed = new Date(`${ano}-${mes}-${dia}`)
  }
  // Formato inválido
  else {
    return false
  }

  // Verificar se data é válida
  if (isNaN(dataParsed.getTime())) {
    return false
  }

  // Verificar se não está no futuro
  const agora = new Date()
  if (dataParsed > agora) {
    return false
  }

  // Verificar se não é uma data muito antiga (> 150 anos)
  const idadeMaxima = new Date()
  idadeMaxima.setFullYear(idadeMaxima.getFullYear() - 150)
  if (dataParsed < idadeMaxima) {
    return false
  }

  return true
}

/**
 * Formata CPF para o padrão brasileiro (000.000.000-00)
 * @param cpf CPF contendo apenas dígitos
 * @returns CPF formatado ou cpf original se inválido
 */
export function formatarCPF(cpf: string): string {
  const cpfLimpo = limparCPF(cpf)

  if (cpfLimpo.length !== 11) {
    return cpf
  }

  return `${cpfLimpo.slice(0, 3)}.${cpfLimpo.slice(3, 6)}.${cpfLimpo.slice(6, 9)}-${cpfLimpo.slice(9)}`
}

/**
 * Formata data para o padrão brasileiro (DD/MM/YYYY)
 * @param data Data em formato YYYY-MM-DD ou Date
 * @returns Data formatada em DD/MM/YYYY
 */
export function formatarData(data: string | Date): string {
  let dataParsed: Date

  if (typeof data === 'string') {
    // Fix timezone: extraímos YYYY-MM-DD e usamos T12:00:00 para evitar recuo de 1 dia em UTC-3
    const match = data.match(/^(\d{4}-\d{2}-\d{2})/)
    if (match) {
      dataParsed = new Date(`${match[1]}T12:00:00`)
    } else {
      return data // Retornar como está se não conseguir parsear
    }
  } else {
    dataParsed = data
  }

  const dia = String(dataParsed.getDate()).padStart(2, '0')
  const mes = String(dataParsed.getMonth() + 1).padStart(2, '0')
  const ano = dataParsed.getFullYear()

  return `${dia}/${mes}/${ano}`
}
