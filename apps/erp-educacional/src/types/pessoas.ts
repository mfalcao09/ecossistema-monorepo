// =============================================================================
// Types — Módulo Pessoas
// ERP Educacional FIC
// =============================================================================

// ===================== ENUMS =====================

export type StatusPessoa = 'ativo' | 'inativo' | 'suspenso' | 'falecido' | 'transferido'

export type TipoVinculo = 'aluno' | 'professor' | 'colaborador' | 'candidato' | 'ex_aluno' | 'visitante' | 'prestador'

export type StatusVinculo = 'ativo' | 'inativo' | 'trancado' | 'desligado' | 'formado' | 'transferido' | 'jubilado'

export type TipoDocumentoPessoal =
  'rg' | 'cpf' | 'cnh' | 'titulo_eleitor' | 'reservista' |
  'certidao_nascimento' | 'certidao_casamento' | 'passaporte' |
  'ctps' | 'pis_pasep' | 'crea' | 'oab' | 'crm' | 'outro'

export type TipoEndereco = 'residencial' | 'comercial' | 'correspondencia' | 'outro'

export type TipoContato = 'telefone_fixo' | 'celular' | 'whatsapp' | 'email' | 'email_institucional' | 'instagram' | 'linkedin' | 'outro'

export type FormaIngresso =
  'vestibular' | 'enem_sisu' | 'prouni' | 'fies' | 'transferencia_externa' |
  'transferencia_interna' | 'reingresso' | 'portador_diploma' |
  'convenio' | 'processo_seletivo' | 'outro'

export type TitulacaoAcademica = 'graduado' | 'especialista' | 'mestre' | 'doutor' | 'pos_doutor' | 'livre_docente' | 'notorio_saber'

export type RegimeTrabalho = 'integral' | 'parcial' | 'horista' | 'temporario' | 'voluntario' | 'clt' | 'pj' | 'estagiario'

export type SexoTipo = 'M' | 'F'

// ===================== INTERFACES PRINCIPAIS =====================

export interface Pessoa {
  id: string
  tenant_id: string
  nome: string
  nome_social: string | null
  cpf: string
  data_nascimento: string // ISO date
  sexo: SexoTipo | null
  estado_civil: string | null
  nacionalidade: string
  naturalidade_municipio: string | null
  naturalidade_uf: string | null
  codigo_municipio_ibge: string | null
  pais_origem: string
  nome_mae: string | null
  nome_pai: string | null
  foto_url: string | null
  status: StatusPessoa
  observacoes: string | null
  diplomado_id: string | null
  user_id: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface PessoaComRelacoes extends Pessoa {
  documentos?: PessoaDocumento[]
  enderecos?: PessoaEndereco[]
  contatos?: PessoaContato[]
  vinculos?: PessoaVinculo[]
  grupos?: GrupoPessoa[]
  dados_academicos?: PessoaDadosAcademicos[]
  dados_profissionais?: PessoaDadosProfissionais[]
}

export interface PessoaDocumento {
  id: string
  pessoa_id: string
  tenant_id: string
  tipo: TipoDocumentoPessoal
  numero: string
  orgao_expedidor: string | null
  uf_expedidor: string | null
  data_expedicao: string | null
  data_validade: string | null
  arquivo_url: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface PessoaEndereco {
  id: string
  pessoa_id: string
  tenant_id: string
  tipo: TipoEndereco
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  pais: string
  codigo_ibge: string | null
  principal: boolean
  created_at: string
  updated_at: string
}

export interface PessoaContato {
  id: string
  pessoa_id: string
  tenant_id: string
  tipo: TipoContato
  valor: string
  principal: boolean
  verificado: boolean
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface PessoaVinculo {
  id: string
  pessoa_id: string
  tenant_id: string
  tipo: TipoVinculo
  status: StatusVinculo
  cargo: string | null
  departamento_id: string | null
  data_inicio: string
  data_fim: string | null
  matricula: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface GrupoPessoa {
  id: string
  tenant_id: string
  nome: string
  descricao: string | null
  cor: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface PessoaDadosAcademicos {
  id: string
  pessoa_id: string
  tenant_id: string
  vinculo_id: string | null
  ra: string | null
  matricula: string | null
  curso_id: string | null
  turma: string | null
  turno: string | null
  forma_ingresso: FormaIngresso | null
  data_ingresso: string | null
  data_conclusao: string | null
  data_colacao: string | null
  semestre_atual: number | null
  situacao: string
  enade_situacao: string | null
  enade_ano: number | null
  enade_nota: number | null
  polo: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface PessoaDadosProfissionais {
  id: string
  pessoa_id: string
  tenant_id: string
  vinculo_id: string | null
  ctps_numero: string | null
  ctps_serie: string | null
  ctps_uf: string | null
  pis_pasep: string | null
  titulacao: TitulacaoAcademica | null
  area_formacao: string | null
  lattes_url: string | null
  regime: RegimeTrabalho | null
  carga_horaria_semanal: number | null
  data_admissao: string | null
  data_demissao: string | null
  salario: number | null
  banco: string | null
  agencia: string | null
  conta: string | null
  conselho_classe: string | null
  registro_conselho: string | null
  uf_conselho: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface PessoaHistorico {
  id: string
  pessoa_id: string
  tenant_id: string
  tabela: string
  registro_id: string
  acao: 'INSERT' | 'UPDATE' | 'DELETE'
  dados_anteriores: Record<string, unknown> | null
  dados_novos: Record<string, unknown> | null
  campos_alterados: string[] | null
  usuario_id: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

// ===================== FORMS (CREATE/UPDATE) =====================

export interface PessoaCreateInput {
  nome: string
  nome_social?: string
  cpf: string
  data_nascimento: string
  sexo?: SexoTipo
  estado_civil?: string
  nacionalidade?: string
  naturalidade_municipio?: string
  naturalidade_uf?: string
  codigo_municipio_ibge?: string
  pais_origem?: string
  nome_mae?: string
  nome_pai?: string
  foto_url?: string
  status?: StatusPessoa
  observacoes?: string
}

export interface PessoaUpdateInput extends Partial<PessoaCreateInput> {
  id: string
}

export interface PessoaFiltros {
  busca?: string           // busca por nome ou CPF
  status?: StatusPessoa
  tipo_vinculo?: TipoVinculo
  grupo_id?: string
  curso_id?: string
  departamento_id?: string
  pagina?: number
  por_pagina?: number
  ordenar_por?: 'nome' | 'cpf' | 'created_at' | 'updated_at'
  ordem?: 'asc' | 'desc'
}

export interface PessoaListResponse {
  dados: PessoaComRelacoes[]
  total: number
  pagina: number
  por_pagina: number
  total_paginas: number
}
