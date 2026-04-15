// ============================================================
// TIPOS — Engine de Documentos Digitais
// FIC ERP — Assinatura ICP-Brasil A3 para todos os documentos
// ============================================================

export type TipoDocDigital =
  | 'diploma'
  | 'historico_escolar'
  | 'declaracao_matricula'
  | 'declaracao_conclusao'
  | 'declaracao_frequencia'
  | 'atestado_escolaridade'
  | 'certificado'
  | 'outro'

export type StatusDocDigital =
  | 'pendente'
  | 'gerando'
  | 'aguardando_assinatura'
  | 'assinando'
  | 'assinado'
  | 'publicado'
  | 'revogado'
  | 'erro'

// Detalhes de assinatura retornados pela API BRy (armazenados em JSONB)
export interface AssinaturaDetalhes {
  protocolo?: string
  signatarios?: Array<{
    nome: string
    cargo?: string
    cpf_cnpj: string
    tipo_certificado: string  // 'e-CPF', 'e-CNPJ', 'ICP-Brasil A3', etc.
    assinado_em: string
  }>
  carimbo_tempo?: {
    emitido_em: string
    tsa_url: string
    serial: string
  }
  bry_job_id?: string
  hash_xml?: string
}

// Registro principal do documento
export interface DocumentoDigital {
  id: string

  // Tipo e referência de origem
  tipo: TipoDocDigital
  referencia_id: string | null
  referencia_tabela: string | null

  // Destinatário
  diplomado_id: string | null
  destinatario_nome: string
  destinatario_cpf: string | null

  // Dados do documento
  titulo: string
  descricao: string | null
  numero_documento: string | null

  // Arquivo
  arquivo_url: string | null
  arquivo_hash_sha256: string | null
  arquivo_tamanho_bytes: number | null

  // Assinatura
  assinado_em: string | null
  assinatura_provedor: string | null
  assinatura_detalhes: AssinaturaDetalhes | null
  carimbo_tempo_url: string | null

  // Verificação pública
  codigo_verificacao: string
  url_verificacao: string | null
  qrcode_url: string | null

  // Status
  status: StatusDocDigital
  status_detalhes: string | null
  publicado_em: string | null

  // Metadados
  emitido_por_user_id: string | null
  ies_id: string | null
  metadata: Record<string, unknown> | null

  created_at: string
  updated_at: string
}

// Entrada para criar um novo documento
export interface CriarDocumentoInput {
  tipo: TipoDocDigital
  referencia_id?: string
  referencia_tabela?: string
  diplomado_id?: string
  destinatario_nome: string
  destinatario_cpf?: string
  titulo: string
  descricao?: string
  numero_documento?: string
  ies_id?: string
  metadata?: Record<string, unknown>
}

// Entrada para registrar PDF gerado
export interface RegistrarArquivoInput {
  documento_id: string
  arquivo_url: string
  arquivo_hash_sha256: string
  arquivo_tamanho_bytes: number
}

// Entrada para registrar assinatura concluída
export interface RegistrarAssinaturaInput {
  documento_id: string
  assinatura_provedor: string
  assinatura_detalhes: AssinaturaDetalhes
  arquivo_url_assinado?: string
  arquivo_hash_assinado?: string
  carimbo_tempo_url?: string
}

// Evento de log
export interface DocumentoLog {
  id: string
  documento_id: string
  evento: string
  status_antes: StatusDocDigital | null
  status_depois: StatusDocDigital | null
  detalhes: Record<string, unknown> | null
  usuario_id: string | null
  created_at: string
}

// ---- Labels para UI ----

export const TIPO_DOC_LABELS: Record<TipoDocDigital, string> = {
  diploma: 'Diploma de Graduação',
  historico_escolar: 'Histórico Escolar',
  declaracao_matricula: 'Declaração de Matrícula',
  declaracao_conclusao: 'Declaração de Conclusão',
  declaracao_frequencia: 'Declaração de Frequência',
  atestado_escolaridade: 'Atestado de Escolaridade',
  certificado: 'Certificado',
  outro: 'Outro Documento',
}

export const STATUS_DOC_LABELS: Record<StatusDocDigital, string> = {
  pendente: 'Pendente',
  gerando: 'Gerando PDF',
  aguardando_assinatura: 'Aguardando Assinatura',
  assinando: 'Assinando',
  assinado: 'Assinado',
  publicado: 'Publicado',
  revogado: 'Revogado',
  erro: 'Erro',
}

export const STATUS_DOC_COR: Record<StatusDocDigital, string> = {
  pendente: 'gray',
  gerando: 'blue',
  aguardando_assinatura: 'yellow',
  assinando: 'orange',
  assinado: 'teal',
  publicado: 'green',
  revogado: 'red',
  erro: 'red',
}

// Resultado da verificação pública — dados completos para exibição no portal
export interface VerificacaoPublica {
  valido: boolean
  documento?: {
    // ── Dados do Diploma ──────────────────────────────
    tipo: TipoDocDigital
    status: StatusDocDigital
    destinatario_nome: string
    destinatario_cpf_mascarado: string | null
    codigo_validacao: string
    numero_registro: string | null
    titulo_conferido: string | null

    // ── Dados do Curso ────────────────────────────────
    titulo: string                        // nome do curso
    grau: string | null
    modalidade: string | null
    carga_horaria_total: number | null
    codigo_emec_curso: string | null
    reconhecimento: string | null         // ex: "Portaria 52 de 13/01/2010"

    // ── IES ───────────────────────────────────────────
    ies_emissora_nome: string | null
    ies_emissora_codigo_mec: string | null
    ies_registradora_nome: string | null
    ies_registradora_codigo_mec: string | null

    // ── Datas e Registro ──────────────────────────────
    data_ingresso: string | null
    data_conclusao: string | null
    data_colacao_grau: string | null
    data_expedicao: string | null
    data_registro: string | null
    data_publicacao: string | null
    forma_acesso: string | null

    // ── Assinatura ────────────────────────────────────
    assinado_em: string | null            // alias para data_expedicao
    publicado_em: string | null
    assinatura_detalhes: AssinaturaDetalhes | null

    // ── URLs de arquivos ──────────────────────────────
    rvdd_url: string | null               // PDF visual
    xml_url: string | null                // XML do diploma
    xml_historico_url: string | null       // XML do histórico escolar
    qrcode_url: string | null

    // ── Compatibilidade (campos legados da interface anterior)
    ies_nome: string | null
    numero_documento: string | null
  }
  erro?: string
}
