/**
 * Validação customizada — funções utilitárias para validação de dados
 * Complementa os schemas Zod com lógica específica do domínio
 */

import { z, type ZodSchema } from 'zod'
import { alterarSenhaSchema } from './zod-schemas'

/**
 * Valida um body contra um schema Zod.
 * Retorna { ok: true, data: T } em caso de sucesso
 * ou { ok: false, erros: string[] } em caso de falha.
 */
export function validar<T>(
  body: unknown,
  schema: ZodSchema<T>
): { ok: true; data: T } | { ok: false; erros: string[] } {
  const result = schema.safeParse(body)
  if (result.success) {
    return { ok: true, data: result.data }
  }
  return {
    ok: false,
    erros: result.error.errors.map((e) =>
      e.path.length ? `${e.path.join('.')}: ${e.message}` : e.message
    ),
  }
}

/**
 * Schemas centralizados para uso com `validar()`
 */
export const schemas = {
  /** Alteração de senha do usuário logado */
  alterarSenha: alterarSenhaSchema,

  /** Criação de nova instituição */
  criarInstituicao: z
    .object({
      nome: z.string().min(1, 'Nome é obrigatório').max(255),
      tipo: z.string().min(1, 'Tipo é obrigatório'),
    })
    .catchall(z.unknown()),
}

/**
 * Valida CPF com algoritmo de checksum (válida formato e dígitos verificadores)
 * NOTA: use cpfSchema do zod-schemas para validação básica
 * Use esta função apenas se precisar validação aprofundada
 */
export function validarCpf(cpf: string): boolean {
  const limpo = cpf.replace(/\D/g, '')

  if (limpo.length !== 11) return false
  if (/^(\d)\1{10}$/.test(limpo)) return false

  let soma = 0
  let resto = 0

  // Primeiro dígito verificador
  for (let i = 1; i <= 9; i++) {
    soma += parseInt(limpo.substring(i - 1, i)) * (11 - i)
  }

  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(limpo.substring(9, 10))) return false

  // Segundo dígito verificador
  soma = 0
  for (let i = 1; i <= 10; i++) {
    soma += parseInt(limpo.substring(i - 1, i)) * (12 - i)
  }

  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(limpo.substring(10, 11))) return false

  return true
}

/**
 * Valida CNPJ com algoritmo de checksum
 */
export function validarCnpj(cnpj: string): boolean {
  const limpo = cnpj.replace(/\D/g, '')

  if (limpo.length !== 14) return false
  if (/^(\d)\1{13}$/.test(limpo)) return false

  let soma = 0
  let resto = 0

  // Primeiro dígito verificador
  const multiplicadores1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  for (let i = 0; i < 12; i++) {
    soma += parseInt(limpo[i]) * multiplicadores1[i]
  }

  resto = soma % 11
  if (resto < 2) resto = 0
  else resto = 11 - resto

  if (resto !== parseInt(limpo[12])) return false

  // Segundo dígito verificador
  soma = 0
  const multiplicadores2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  for (let i = 0; i < 13; i++) {
    soma += parseInt(limpo[i]) * multiplicadores2[i]
  }

  resto = soma % 11
  if (resto < 2) resto = 0
  else resto = 11 - resto

  if (resto !== parseInt(limpo[13])) return false

  return true
}

/**
 * Valida se uma data está em formato correto e é uma data válida
 * Aceita YYYY-MM-DD
 */
export function validarData(data: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/
  if (!regex.test(data)) return false

  const [ano, mes, dia] = data.split('-').map(Number)

  // Verifica limites
  if (mes < 1 || mes > 12) return false
  if (dia < 1) return false

  // Dias por mês
  const diasPorMes = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

  // Bissexto
  if ((ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0) {
    diasPorMes[1] = 29
  }

  if (dia > diasPorMes[mes - 1]) return false

  return true
}

/**
 * Sanitiza entrada de string — remove espaços extras, controla length
 */
export function sanitizarString(texto: string, maxLength: number = 255): string {
  return texto.trim().substring(0, maxLength)
}

/**
 * Sanitiza email para lowercase e remove espaços
 */
export function sanitizarEmail(email: string): string {
  return email.toLowerCase().trim()
}

/**
 * Valida força de senha (critérios básicos)
 * Deve ser usado com alterarSenhaSchema para validação completa
 */
export function validarForcaSenha(senha: string): {
  valida: boolean
  pontuacao: number
  feedback: string[]
} {
  const feedback: string[] = []
  let pontuacao = 0

  if (senha.length < 8) {
    feedback.push('Mínimo 8 caracteres')
  } else {
    pontuacao += 1
  }

  if (!/[A-Z]/.test(senha)) {
    feedback.push('Mínimo 1 letra maiúscula')
  } else {
    pontuacao += 1
  }

  if (!/[a-z]/.test(senha)) {
    feedback.push('Mínimo 1 letra minúscula')
  } else {
    pontuacao += 1
  }

  if (!/[0-9]/.test(senha)) {
    feedback.push('Mínimo 1 número')
  } else {
    pontuacao += 1
  }

  if (!/[!@#$%^&*]/.test(senha)) {
    feedback.push('Considere adicionar caracteres especiais (!@#$%^&*)')
  } else {
    pontuacao += 1
  }

  return {
    valida: pontuacao >= 4,
    pontuacao,
    feedback,
  }
}
