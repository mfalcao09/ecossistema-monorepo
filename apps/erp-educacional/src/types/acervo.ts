// ============================================================
// TIPOS — Módulo Acervo Acadêmico Digital
// FIC ERP — Portarias MEC 360/2022, 613/2022
// Decreto 10.278/2020
// ============================================================

import type { TipoDocDigital, StatusDocDigital } from './documentos-digitais'

// ── Status do lote de digitalização ──────────────────────
export type StatusLoteAcervo =
  | 'rascunho'
  | 'em_andamento'
  | 'aguardando_assinatura'
  | 'assinando'
  | 'concluido'
  | 'com_erros'

// ── Origem do documento ───────────────────────────────────
export type OrigemDocumento = 'nato_digital' | 'digitalizado'

// ── Lote de digitalização ─────────────────────────────────
export interface AcervoLote {
  id: string
  nome: string
  descricao: string | null
  tipo: TipoDocDigital
  periodo_referencia: string | null
  total_docs: number
  processados: number
  com_erro: number
  status: StatusLoteAcervo
  status_detalhes: string | null
  local_digitalizacao_padrao: string | null
  responsavel_padrao_nome: string | null
  responsavel_padrao_cargo: string | null
  criado_por_user_id: string | null
  ies_id: string | null
  created_at: string
  updated_at: string
}

export interface CriarLoteInput {
  nome: string
  descricao?: string
  tipo: TipoDocDigital
  periodo_referencia?: string
  local_digitalizacao_padrao?: string
  responsavel_padrao_nome?: string
  responsavel_padrao_cargo?: string
  ies_id?: string
}

// ── Metadados de digitalização (Decreto 10.278/2020 Anexo II) ──
export interface AcervoDigitalizacaoMeta {
  id: string
  documento_id: string
  lote_id: string | null
  data_digitalizacao: string
  local_digitalizacao: string
  responsavel_nome: string
  responsavel_cpf: string | null
  responsavel_cargo: string | null
  data_documento_original: string | null
  numero_documento_original: string | null
  observacoes_originais: string | null
  equipamento: string | null
  resolucao_dpi: number | null
  formato_original: string | null
  software_utilizado: string | null
  created_at: string
}

export interface CriarMetaDigitalizacaoInput {
  documento_id: string
  lote_id?: string
  local_digitalizacao: string
  responsavel_nome: string
  responsavel_cpf?: string
  responsavel_cargo?: string
  data_documento_original?: string
  numero_documento_original?: string
  observacoes_originais?: string
  equipamento?: string
  resolucao_dpi?: number
  formato_original?: string
  software_utilizado?: string
}

// ── Template para documento nato-digital ──────────────────
export interface AcervoTemplate {
  id: string
  nome: string
  slug: string
  tipo: TipoDocDigital
  descricao: string | null
  conteudo_html: string
  variaveis: TemplateVariaveis
  orientacao_pdf: 'portrait' | 'landscape'
  formato_papel: string
  ativo: boolean
  versao: number
  criado_por_user_id: string | null
  created_at: string
  updated_at: string
}

// Schema das variáveis de um template
export type TemplateVariaveis = Record<string, {
  label: string
  tipo: 'text' | 'date' | 'select' | 'textarea'
  obrigatorio: boolean
  opcoes?: string[]      // apenas para tipo 'select'
  placeholder?: string
}>

export interface CriarTemplateInput {
  nome: string
  slug: string
  tipo: TipoDocDigital
  descricao?: string
  conteudo_html: string
  variaveis: TemplateVariaveis
  orientacao_pdf?: 'portrait' | 'landscape'
  formato_papel?: string
}

// Dados para emitir documento a partir de template
export interface EmitirDocumentoInput {
  template_id: string
  diplomado_id?: string
  destinatario_nome: string
  destinatario_cpf?: string
  ies_id?: string
  numero_documento?: string
  variaveis_valores: Record<string, string>  // { finalidade: 'fins de emprego', ... }
}

// ── Token de acesso MEC ───────────────────────────────────
export interface AcervoMecToken {
  id: string
  token: string
  descricao: string
  ativo: boolean
  ultimo_uso_em: string | null
  criado_por_user_id: string | null
  expira_em: string | null
  created_at: string
}

export interface AcervoMecLog {
  id: string
  token_id: string | null
  ip_origem: string | null
  user_agent: string | null
  filtros: Record<string, unknown> | null
  total_retornado: number | null
  created_at: string
}

// ── Documento com dados de acervo (join) ──────────────────
export interface DocumentoAcervo {
  id: string
  tipo: TipoDocDigital
  origem: OrigemDocumento
  titulo: string
  destinatario_nome: string
  destinatario_cpf: string | null
  status: StatusDocDigital
  codigo_verificacao: string
  url_verificacao: string | null
  arquivo_url: string | null
  arquivo_hash_sha256: string | null
  assinado_em: string | null
  publicado_em: string | null
  created_at: string
  // Join opcional
  meta?: AcervoDigitalizacaoMeta
  lote?: Pick<AcervoLote, 'id' | 'nome' | 'periodo_referencia'>
}

// ── Labels e helpers para UI ──────────────────────────────
export const STATUS_LOTE_LABELS: Record<StatusLoteAcervo, string> = {
  rascunho: 'Rascunho',
  em_andamento: 'Em andamento',
  aguardando_assinatura: 'Aguardando assinatura',
  assinando: 'Assinando',
  concluido: 'Concluído',
  com_erros: 'Com erros',
}

export const STATUS_LOTE_COR: Record<StatusLoteAcervo, string> = {
  rascunho: 'gray',
  em_andamento: 'blue',
  aguardando_assinatura: 'yellow',
  assinando: 'orange',
  concluido: 'green',
  com_erros: 'red',
}

export const ORIGEM_LABELS: Record<OrigemDocumento, string> = {
  nato_digital: 'Nato-digital',
  digitalizado: 'Digitalizado',
}

// Prazos legais da Portaria MEC 360/2022 (já todos vencidos)
export const PRAZOS_MEC = [
  {
    descricao: 'Alunos atualmente matriculados',
    prazo: '18/05/2023',
    vencido: true,
  },
  {
    descricao: 'Formados entre 01/01/2016 e 18/05/2022',
    prazo: '18/05/2024',
    vencido: true,
  },
  {
    descricao: 'Formados entre 01/01/2001 e 31/12/2015',
    prazo: '18/05/2025',
    vencido: true,
  },
]
