/**
 * Mapeamento entre tipos de documento detectados pela IA (Gemini) e os
 * tipos XSD v1.05 usados nos comprobatórios do diploma digital.
 *
 * A IA retorna nomes livres como "RG", "Certidão Nascimento", etc.
 * Precisamos converter para os enums XSD para avaliar o gate FIC.
 *
 * Sessão 043 (10/04/2026): criado para o fluxo de confirmação de comprobatórios.
 */

import type { TipoXsdComprobatorio } from './regras-fic'

// ─── Tipos ─────────────────────────────────────────────────────────────────

export type StatusConfirmacao = 'pendente' | 'detectado' | 'confirmado'

/**
 * Representa o estado de confirmação de um comprobatório individual.
 * Cada entrada mapeia um tipo XSD para o arquivo detectado e seu status.
 */
export interface ConfirmacaoComprobatorio {
  tipo_xsd: TipoXsdComprobatorio
  status: StatusConfirmacao
  /** Nome do arquivo que a IA associou a este tipo */
  nome_arquivo?: string
  /** Índice do arquivo em sessao.arquivos[] */
  arquivo_index?: number
  /** Confiança da IA na detecção (0-1) */
  confianca?: number
}

/**
 * Dados brutos que vêm do campo `comprobatorios_detectados` em dados_extraidos.
 * Gerado pela função agregarDados() no Railway (server.js).
 */
export interface ComprobatorioDetectadoRaw {
  tipo: string
  nome_arquivo: string
  confianca: number | null
}

// ─── Mapeamento Gemini → XSD ───────────────────────────────────────────────

/**
 * Mapa de normalização: texto livre do Gemini → tipo XSD v1.05.
 * As chaves são LOWERCASE para matching case-insensitive.
 */
const MAPA_GEMINI_XSD: Record<string, TipoXsdComprobatorio> = {
  // ── RG / Documento de identidade ──────────────────────────────────
  // Prompt padronizado retorna "RG" ou "CNH" — ambos mapeiam para DocumentoIdentidadeDoAluno
  'rg': 'DocumentoIdentidadeDoAluno',
  'cnh': 'DocumentoIdentidadeDoAluno',
  'cin': 'DocumentoIdentidadeDoAluno',
  'rg do aluno': 'DocumentoIdentidadeDoAluno',
  'documento identidade': 'DocumentoIdentidadeDoAluno',
  'documento de identidade': 'DocumentoIdentidadeDoAluno',
  'carteira identidade': 'DocumentoIdentidadeDoAluno',
  'carteira de identidade': 'DocumentoIdentidadeDoAluno',
  'carteira nacional de habilitação': 'DocumentoIdentidadeDoAluno',
  'carteira nacional de habilitacao': 'DocumentoIdentidadeDoAluno',

  // ── Histórico do Ensino Médio ─────────────────────────────────────
  // Prompt retorna "Historico Ensino Medio"
  'historico ensino medio': 'ProvaConclusaoEnsinoMedio',
  'histórico ensino médio': 'ProvaConclusaoEnsinoMedio',
  'historico em': 'ProvaConclusaoEnsinoMedio',
  'histórico em': 'ProvaConclusaoEnsinoMedio',
  'certificado ensino medio': 'ProvaConclusaoEnsinoMedio',
  'certificado ensino médio': 'ProvaConclusaoEnsinoMedio',
  'prova conclusao ensino medio': 'ProvaConclusaoEnsinoMedio',
  'diploma ensino medio': 'ProvaConclusaoEnsinoMedio',
  'diploma ensino médio': 'ProvaConclusaoEnsinoMedio',

  // ── Certidão de nascimento ────────────────────────────────────────
  // Prompt retorna "Certidao Nascimento"
  'certidao nascimento': 'CertidaoNascimento',
  'certidão nascimento': 'CertidaoNascimento',
  'certidão de nascimento': 'CertidaoNascimento',
  'certidao de nascimento': 'CertidaoNascimento',

  // ── Certidão de casamento ─────────────────────────────────────────
  // Prompt retorna "Certidao Casamento"
  'certidao casamento': 'CertidaoCasamento',
  'certidão casamento': 'CertidaoCasamento',
  'certidão de casamento': 'CertidaoCasamento',
  'certidao de casamento': 'CertidaoCasamento',

  // ── Título de eleitor ─────────────────────────────────────────────
  // Prompt retorna "Titulo Eleitor"
  'titulo eleitor': 'TituloEleitor',
  'título eleitor': 'TituloEleitor',
  'titulo de eleitor': 'TituloEleitor',
  'título de eleitor': 'TituloEleitor',
  'e titulo': 'TituloEleitor',
  'e-titulo': 'TituloEleitor',
  'e-título': 'TituloEleitor',

  // ── Prova de colação ──────────────────────────────────────────────
  // Prompt retorna "Prova Colacao"
  'prova colacao': 'ProvaColacao',
  'prova colação': 'ProvaColacao',
  'prova de colação': 'ProvaColacao',
  'prova de colacao': 'ProvaColacao',
  'ata colacao': 'ProvaColacao',
  'ata colação': 'ProvaColacao',
  'ata de colação': 'ProvaColacao',
  'ata de colacao': 'ProvaColacao',

  // ── Estágio ───────────────────────────────────────────────────────
  // Prompt retorna "Estagio"
  'estagio': 'ComprovacaoEstagioCurricular',
  'estágio': 'ComprovacaoEstagioCurricular',
  'comprovacao estagio': 'ComprovacaoEstagioCurricular',
  'comprovação estágio': 'ComprovacaoEstagioCurricular',
  'comprovacao estagio curricular': 'ComprovacaoEstagioCurricular',
  'comprovação estágio curricular': 'ComprovacaoEstagioCurricular',

  // ── Naturalização ─────────────────────────────────────────────────
  'naturalizacao': 'AtoNaturalizacao',
  'naturalização': 'AtoNaturalizacao',
  'ato naturalizacao': 'AtoNaturalizacao',
  'ato naturalização': 'AtoNaturalizacao',
  'ato de naturalização': 'AtoNaturalizacao',
  'ato de naturalizacao': 'AtoNaturalizacao',

  // ── Tipos que NÃO são comprobatórios do XSD mas contêm dados úteis ─
  // Mapeiam para 'Outros' — dados extraídos ainda alimentam o formulário
  'historico superior': 'Outros',
  'histórico superior': 'Outros',
  'historico universitario': 'Outros',
  'histórico universitário': 'Outros',
  'grade curricular': 'Outros',
  'diploma': 'Outros',
  'comprovante matricula': 'Outros',
  'comprovante matrícula': 'Outros',
  'comprovante de matrícula': 'Outros',
  'comprovante de matricula': 'Outros',
  'horario escolar': 'Outros',
  'horário escolar': 'Outros',
  'foto': 'Outros',
}

/**
 * Converte o tipo de documento detectado pela IA (texto livre) para o
 * tipo XSD v1.05 correspondente.
 *
 * @returns O tipo XSD correspondente, ou null se não reconhecido.
 */
export function mapearTipoGeminiParaXsd(
  tipoGemini: string,
): TipoXsdComprobatorio | null {
  if (!tipoGemini) return null

  const normalizado = tipoGemini
    .toLowerCase()
    .trim()
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')

  // Busca exata
  if (normalizado in MAPA_GEMINI_XSD) {
    return MAPA_GEMINI_XSD[normalizado]
  }

  // Busca por substring (para variações como "documento RG do aluno")
  for (const [chave, valor] of Object.entries(MAPA_GEMINI_XSD)) {
    if (normalizado.includes(chave) || chave.includes(normalizado)) {
      return valor
    }
  }

  return null
}

/**
 * Constrói o estado inicial de confirmações a partir dos dados brutos
 * da extração. Mapeia cada comprobatório detectado para o tipo XSD e
 * resolve o índice do arquivo em `sessao.arquivos`.
 *
 * @param detectados - Array de comprobatorios_detectados do dados_extraidos
 * @param arquivos - Array sessao.arquivos (para resolver o índice)
 * @returns Map de tipo XSD → ConfirmacaoComprobatorio
 */
export function construirConfirmacoes(
  detectados: ComprobatorioDetectadoRaw[],
  arquivos: Array<{ nome_original: string }>,
): Map<TipoXsdComprobatorio, ConfirmacaoComprobatorio> {
  const mapa = new Map<TipoXsdComprobatorio, ConfirmacaoComprobatorio>()

  for (const d of detectados) {
    const tipoXsd = mapearTipoGeminiParaXsd(d.tipo)
    if (!tipoXsd || tipoXsd === 'Outros') continue

    // Se já tem esse tipo mapeado com confiança maior, pula
    const existente = mapa.get(tipoXsd)
    if (existente && (existente.confianca ?? 0) >= (d.confianca ?? 0)) {
      continue
    }

    // Encontrar o índice do arquivo pelo nome
    const idx = arquivos.findIndex(
      (a) =>
        a.nome_original === d.nome_arquivo ||
        a.nome_original?.toLowerCase() === d.nome_arquivo?.toLowerCase(),
    )

    mapa.set(tipoXsd, {
      tipo_xsd: tipoXsd,
      status: 'detectado',
      nome_arquivo: d.nome_arquivo,
      arquivo_index: idx >= 0 ? idx : undefined,
      confianca: d.confianca ?? undefined,
    })
  }

  return mapa
}
