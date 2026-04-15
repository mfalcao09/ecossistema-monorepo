/**
 * ============================================================
 * Cliente para Cadeia de Custódia (lado cliente/frontend)
 * ERP Educacional FIC
 *
 * Utilities para consumir o endpoint /api/diplomas/[id]/custodia
 * no painel administrativo e exibir a cadeia visualmente.
 * ============================================================
 */

import type { RegistroCustodia } from './cadeia-custodia'

export interface CustodiaResponse {
  sucesso: boolean
  diploma_id: string
  cadeia: RegistroCustodia[]
  integridade: {
    integra: boolean
    erros: string[]
  }
  total_registros: number
}

/**
 * Fetch da cadeia de custódia para um diploma
 */
export async function obterCustodiaCliente(
  diplomaId: string,
  token: string
): Promise<CustodiaResponse | null> {
  try {
    const response = await fetch(
      `/api/diplomas/${diplomaId}/custodia`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.error(`Erro ao obter custódia: ${response.status}`)
      return null
    }

    return await response.json() as CustodiaResponse
  } catch (err) {
    console.error('Erro ao fetch custódia:', err)
    return null
  }
}

/** Labels em PT-BR para as etapas */
export const ETAPA_LABELS: Record<string, string> = {
  criacao: 'Criação',
  dados_preenchidos: 'Dados Preenchidos',
  xml_gerado: 'XML Gerado',
  xml_validado: 'XML Validado',
  assinatura_emissora: 'Assinado (Emissora)',
  assinatura_registradora: 'Assinado (Registradora)',
  rvdd_gerado: 'RVDD Gerado',
  publicado: 'Publicado',
  verificado: 'Verificado',
  revogado: 'Revogado',
  retificado: 'Retificado',
}

/** Cores para visualização (Tailwind) */
export const ETAPA_CORES: Record<string, string> = {
  criacao: 'bg-slate-100 text-slate-700',
  dados_preenchidos: 'bg-blue-100 text-blue-700',
  xml_gerado: 'bg-indigo-100 text-indigo-700',
  xml_validado: 'bg-purple-100 text-purple-700',
  assinatura_emissora: 'bg-amber-100 text-amber-700',
  assinatura_registradora: 'bg-orange-100 text-orange-700',
  rvdd_gerado: 'bg-pink-100 text-pink-700',
  publicado: 'bg-green-100 text-green-700',
  verificado: 'bg-teal-100 text-teal-700',
  revogado: 'bg-red-100 text-red-700',
  retificado: 'bg-yellow-100 text-yellow-700',
}

/** Status colors */
export const STATUS_CORES: Record<string, string> = {
  sucesso: 'text-green-600',
  erro: 'text-red-600',
  pendente: 'text-yellow-600',
}

/** Formata timestamp em formato legível */
export function formatarData(isoString: string): string {
  const date = new Date(isoString)
  return new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

/** Calcula tempo decorrido entre dois registros */
export function calcularTempo(timestampAnterior: string, timestampAtual: string): string {
  const anterior = new Date(timestampAnterior).getTime()
  const atual = new Date(timestampAtual).getTime()
  const diffMs = atual - anterior

  if (diffMs < 1000) return 'Instante'
  if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s`
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m`
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h`
  return `${Math.floor(diffMs / 86400000)}d`
}

/** Formata hash para exibição (primeiros 16 chars) */
export function formatarHash(hash: string | null): string {
  if (!hash) return '—'
  return `${hash.substring(0, 16)}...`
}
