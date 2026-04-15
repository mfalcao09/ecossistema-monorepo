// =============================================================================
// Types — Sistema IA Native
// ERP Educacional FIC
// =============================================================================

// ── Status de processamento ──
export type StatusProcessamento = 'aguardando' | 'processando' | 'concluido' | 'erro'

export type NivelConfianca = 'alta' | 'media' | 'baixa'

// ── Campos que a IA pode preencher ──
export type CampoPessoa =
  | 'nome' | 'nome_social' | 'cpf' | 'data_nascimento' | 'sexo'
  | 'estado_civil' | 'nacionalidade' | 'naturalidade_municipio' | 'naturalidade_uf'
  | 'nome_mae' | 'nome_pai' | 'observacoes'

export type CampoEndereco =
  | 'cep' | 'logradouro' | 'numero' | 'complemento' | 'bairro'
  | 'cidade' | 'uf' | 'pais'

// ── Resultado de preenchimento pela IA ──
export interface PreenchimentoIA {
  campo: string
  valor: string
  confianca: NivelConfianca
  fonte: string  // qual documento originou
}

// ── Documento na fila de processamento ──
export interface DocumentoUpload {
  id: string
  arquivo: File
  nome: string
  tipo: 'imagem' | 'pdf'
  tamanho: number
  base64?: string     // base64 data URL para imagens
  preview?: string    // URL de preview para imagens
  status: StatusProcessamento
  tipoDetectado?: string  // rg, cpf, comprovante, historico, etc.
  dadosExtraidos?: PreenchimentoIA[]
  erro?: string
  dataUpload?: Date
}

// ── Checklist de documentos ──
export interface ItemChecklist {
  id: string
  tipo: string            // slug do tipo (rg, cpf, etc.)
  tipo_documento: string  // alias para compatibilidade DB
  descricao: string
  obrigatorio: boolean
  status: 'pendente' | 'recebido' | 'processando' | 'erro'
  documento_id?: string   // referencia ao DocumentoUpload
  ordem: number
}

// ── Mensagem do chat ──
export interface MensagemChat {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  tipo?: 'texto' | 'upload' | 'preenchimento' | 'pergunta' | 'checklist' | 'erro'
  dados?: {
    campos_preenchidos?: PreenchimentoIA[]
    pergunta_opcoes?: string[]
    campo_relacionado?: string
    documentos_processados?: string[]
    documentos_faltantes?: string[]
  }
}

// ── Estado global do assistente ──
export interface EstadoAssistente {
  ativo: boolean
  processando: boolean
  documentos: DocumentoUpload[]
  checklist: ItemChecklist[]
  mensagens: MensagemChat[]
  camposPreenchidos: Map<string, PreenchimentoIA>
  progresso: number  // 0-100
  tipoVinculo?: string  // aluno, professor, etc.
}

// ── Tool calls do Claude ──
export interface ToolPreencherCampo {
  campo: string
  valor: string
  confianca: NivelConfianca
  fonte: string
}

export interface ToolSolicitarDocumento {
  tipo: string
  motivo: string
}

export interface ToolPerguntarUsuario {
  pergunta: string
  opcoes?: string[]
  campo_relacionado?: string
}

export interface ToolAdicionarDocumento {
  tipo: string
  numero: string
  orgao_expedidor?: string
  uf_expedidor?: string
  data_expedicao?: string
}

export interface ToolAdicionarEndereco {
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  pais?: string
}

export interface ToolAdicionarContato {
  tipo: 'email' | 'celular' | 'telefone_fixo' | 'whatsapp'
  valor: string
}

// ── Labels para tipos de documento ──
export const TIPO_DOCUMENTO_LABELS: Record<string, string> = {
  rg: 'RG (Identidade)',
  cpf: 'CPF',
  cnh: 'CNH',
  certidao_nascimento: 'Certidão de Nascimento',
  certidao_casamento: 'Certidão de Casamento',
  comprovante_residencia: 'Comprovante de Residência',
  historico_escolar: 'Histórico Escolar',
  diploma: 'Diploma',
  foto_3x4: 'Foto 3x4',
  titulo_eleitor: 'Título de Eleitor',
  reservista: 'Certificado de Reservista',
  ctps: 'CTPS',
  curriculo_lattes: 'Currículo Lattes',
  pis_pasep: 'PIS/PASEP',
  passaporte: 'Passaporte',
  outro: 'Outro Documento',
}
