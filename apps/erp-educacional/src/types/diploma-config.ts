// ============================================================
// TIPOS — Configurações do Diploma Digital
// ============================================================

// ============================================================
// TIPOS — Configuração Visual Inovadora do Histórico
// ============================================================

// ── Dados do Aluno (cabeçalho do histórico) ──

export interface HistoricoCampoAlunoConfig {
  campo: string
  label: string
  visivel: boolean
  ordem: number
}

// Campos disponíveis para o cabeçalho "Dados do Aluno" no histórico
export const CAMPOS_ALUNO_DISPONIVEIS: Array<{ campo: string; label: string; descricao: string }> = [
  { campo: 'nome', label: 'Nome do Aluno', descricao: 'Nome completo (civil)' },
  { campo: 'nome_social', label: 'Nome Social', descricao: 'Nome social, se houver' },
  { campo: 'cpf', label: 'CPF', descricao: 'Cadastro de Pessoa Física' },
  { campo: 'data_nascimento', label: 'Data de Nascimento', descricao: 'Data de nascimento do aluno' },
  { campo: 'sexo', label: 'Sexo', descricao: 'Sexo do aluno (M/F)' },
  { campo: 'nacionalidade', label: 'Nacionalidade', descricao: 'País de nacionalidade' },
  { campo: 'naturalidade', label: 'Naturalidade', descricao: 'Município e UF de nascimento' },
  { campo: 'rg', label: 'RG', descricao: 'Número do RG + órgão expedidor + UF' },
  { campo: 'ra', label: 'RA / Matrícula', descricao: 'Registro acadêmico do aluno' },
  { campo: 'curso', label: 'Curso', descricao: 'Nome do curso de graduação' },
  { campo: 'grau', label: 'Grau Acadêmico', descricao: 'Bacharelado, Licenciatura, Tecnólogo' },
  { campo: 'modalidade', label: 'Modalidade', descricao: 'Presencial, EAD, Semipresencial' },
  { campo: 'turno', label: 'Turno', descricao: 'Matutino, Vespertino, Noturno, Integral' },
  { campo: 'data_ingresso', label: 'Data de Ingresso', descricao: 'Data de ingresso no curso' },
  { campo: 'forma_ingresso', label: 'Forma de Ingresso', descricao: 'Vestibular, ENEM, Transferência, etc.' },
  { campo: 'data_conclusao', label: 'Data de Conclusão', descricao: 'Data de conclusão do curso' },
  { campo: 'data_colacao', label: 'Data de Colação', descricao: 'Data da colação de grau' },
]

// Campos obrigatórios do aluno — XSD TDadosDiplomado (minOccurs=1) + Portaria MEC 1.095/2018
export const CAMPOS_ALUNO_OBRIGATORIOS_MEC = [
  'nome',              // TNome — XSD minOccurs=1
  'cpf',               // TCpf — XSD minOccurs=1
  'data_nascimento',   // TData — XSD minOccurs=1
  'sexo',              // TSexo — XSD minOccurs=1
  'nacionalidade',     // TNacionalidade — XSD minOccurs=1
  'naturalidade',      // TNaturalidade — XSD minOccurs=1
  'rg',                // TRg (ou OutroDocIdentificacao) — XSD minOccurs=1
  'ra',                // TId — XSD minOccurs=1
  'curso',             // Nome do curso — Art. 17, II
]

// Campos onde basta ter UM do grupo (RG ou outro doc de identificação)
export const CAMPOS_ALUNO_OBRIGATORIOS_GRUPOS: Array<{ campos: string[]; label: string; reference: string }> = [
  { campos: ['rg'], label: 'Documento de identificação', reference: 'XSD RG/OutroDocIdentificacao (choice)' },
]

// Default dos campos do aluno
export const DEFAULT_CAMPOS_ALUNO: HistoricoCampoAlunoConfig[] = [
  { campo: 'nome', label: 'Nome do Aluno', visivel: true, ordem: 1 },
  { campo: 'cpf', label: 'CPF', visivel: true, ordem: 2 },
  { campo: 'curso', label: 'Curso', visivel: true, ordem: 3 },
  { campo: 'grau', label: 'Grau Acadêmico', visivel: true, ordem: 4 },
  { campo: 'ra', label: 'RA / Matrícula', visivel: true, ordem: 5 },
  { campo: 'data_nascimento', label: 'Data de Nascimento', visivel: true, ordem: 6 },
  { campo: 'sexo', label: 'Sexo', visivel: true, ordem: 7 },
  { campo: 'nacionalidade', label: 'Nacionalidade', visivel: true, ordem: 8 },
  { campo: 'naturalidade', label: 'Naturalidade', visivel: true, ordem: 9 },
  { campo: 'rg', label: 'RG', visivel: true, ordem: 10 },
  { campo: 'nome_social', label: 'Nome Social', visivel: false, ordem: 11 },
  { campo: 'modalidade', label: 'Modalidade', visivel: false, ordem: 12 },
  { campo: 'turno', label: 'Turno', visivel: false, ordem: 13 },
  { campo: 'data_ingresso', label: 'Data de Ingresso', visivel: false, ordem: 14 },
  { campo: 'forma_ingresso', label: 'Forma de Ingresso', visivel: false, ordem: 15 },
  { campo: 'data_conclusao', label: 'Data de Conclusão', visivel: false, ordem: 16 },
  { campo: 'data_colacao', label: 'Data de Colação', visivel: false, ordem: 17 },
]

// ── Colunas da tabela de disciplinas ──

export interface HistoricoColunaConfig {
  campo: string
  label: string
  visivel: boolean
  ordem: number
  largura: number
}

export interface HistoricoFormatacaoRegra {
  id: string
  campo: string
  operador: '=' | '!=' | '<' | '>' | '<=' | '>=' | 'contem'
  valor: string
  cor_texto: string
  cor_fundo: string
  negrito: boolean
  ativo: boolean
}

export interface HistoricoSecoesConfig {
  agrupar_por: 'periodo' | 'etiqueta' | 'forma_integralizacao' | 'nenhum' | 'personalizado'
  formato_cabecalho_grupo: string
  exibir_subtotal_ch: boolean
  separador_visual: 'linha' | 'destaque' | 'espaco' | 'nenhum'
  secoes_personalizadas: Array<{ nome: string; filtro_campo: string; filtro_valor: string }>
}

export interface HistoricoTemplate {
  id: string
  slug: string
  nome: string
  descricao: string | null
  area_conhecimento: string | null
  icone: string
  colunas_config: HistoricoColunaConfig[]
  secoes_config: HistoricoSecoesConfig | null
  formato_nota: string
  cor_cabecalho: string
  cor_linha_alternada?: string
  is_default: boolean
}

// Campos disponíveis para colunas do histórico (mapeamento banco → visual)
export const CAMPOS_DISCIPLINA_DISPONIVEIS: Array<{ campo: string; label: string; descricao: string }> = [
  { campo: 'codigo', label: 'Código', descricao: 'Código da disciplina' },
  { campo: 'nome', label: 'Disciplina', descricao: 'Nome da disciplina (obrigatório)' },
  { campo: 'carga_horaria_aula', label: 'C.H. (Aula)', descricao: 'Carga horária em horas-aula' },
  { campo: 'carga_horaria_relogio', label: 'C.H. (Relógio)', descricao: 'Carga horária em horas-relógio' },
  { campo: 'nota', label: 'Nota (0-10)', descricao: 'Nota de 0 a 10' },
  { campo: 'nota_ate_cem', label: 'Nota (0-100)', descricao: 'Nota de 0 a 100' },
  { campo: 'conceito', label: 'Conceito', descricao: 'Conceito (A, B, C...)' },
  { campo: 'conceito_rm', label: 'Conceito RM', descricao: 'Conceito no sistema RM' },
  { campo: 'conceito_especifico', label: 'Conc. Específico', descricao: 'Ex: Cumpriu, Não Cumpriu' },
  { campo: 'periodo', label: 'Período Letivo', descricao: 'Número do período/semestre' },
  { campo: 'situacao', label: 'Situação Final', descricao: 'Aprovado, Reprovado, etc.' },
  { campo: 'forma_integralizacao', label: 'Forma Integr.', descricao: 'Cursado, Aproveitamento, etc.' },
  { campo: 'etiqueta', label: 'Observação', descricao: 'Etiqueta/observação da disciplina' },
  { campo: 'docente_nome', label: 'Docente', descricao: 'Nome do professor' },
  { campo: 'docente_titulacao', label: 'Titulação', descricao: 'Me., Dr., Esp., etc.' },
]

// Campos obrigatórios no histórico escolar — Portaria MEC 1.095/2018, Art. 17, XI + XSD v1.05
// "relação das disciplinas cursadas, contendo período, carga horária, notas ou conceitos, nomes dos docentes e titulação"
export const CAMPOS_OBRIGATORIOS_MEC = [
  'nome',                   // NomeDisciplina — Art. 17, XI + XSD minOccurs=1
  'carga_horaria_aula',     // CargaHoraria — Art. 17, XI + XSD minOccurs=1 (aula OU relógio)
  'carga_horaria_relogio',  // CargaHoraria — alternativa à C.H. em aula
  'periodo',                // PeriodoLetivo — Art. 17, XI + XSD minOccurs=1
  'situacao',               // Aprovado/Reprovado/Pendente — XSD minOccurs=1
  'docente_nome',           // Docentes.Nome — Art. 17, XI + XSD minOccurs=1
  'docente_titulacao',      // Docentes.Titulacao — Art. 17, XI + XSD minOccurs=1
]

// Campos onde basta ter UM do grupo visível (ex: nota OU conceito, C.H. aula OU relógio)
export const CAMPOS_OBRIGATORIOS_MEC_GRUPOS: Array<{ campos: string[]; label: string; reference: string }> = [
  { campos: ['carga_horaria_aula', 'carga_horaria_relogio'], label: 'Carga horária', reference: 'Art. 17, XI' },
  { campos: ['nota', 'nota_ate_cem', 'conceito', 'conceito_rm', 'conceito_especifico'], label: 'Notas ou conceitos', reference: 'Art. 17, XI' },
]

// ============================================================
// TIPOS — Configurações do Diploma Digital
// ============================================================

export type ProvedorAssinatura =
  | 'bry'
  | 'certisign'
  | 'soluti'
  | 'serpro'
  | 'govbr'
  | 'manual'
  | 'nenhum'

export type AmbienteSistema = 'homologacao' | 'producao'

export type BryCredencialTipo = 'pin' | 'otp' | 'token'
export type RegistradoraTipoVinculo = 'convenio' | 'credenciamento_mec' | 'contrato' | 'outro'

export interface DiplomaConfig {
  id: string
  ambiente: AmbienteSistema

  // Aba 1 — Instituição
  ies_emissora_id: string | null
  ies_registradora_id: string | null        // legado — substituído pelos campos inline abaixo
  registradora_nome: string | null
  registradora_cnpj: string | null
  registradora_codigo_mec: string | null
  registradora_tipo_vinculo: RegistradoraTipoVinculo | null

  // Ordem de assinatura padrão (agora gerenciada na página Assinantes)
  ordem_assinatura_padrao: string[]

  // Aba 2 — Visual da RVDD
  rvdd_template_id: string | null
  rvdd_template_novo_id: string | null
  rvdd_cor_primaria: string | null
  rvdd_cor_secundaria: string | null
  rvdd_fonte: string | null
  rvdd_logo_url: string | null
  rvdd_arquivo_referencia_url: string | null   // URL do arquivo de referência visual (PDF/DOCX/imagem)

  // Aba 3 — Assinatura Digital (BRy KMS)
  assinatura_provedor: ProvedorAssinatura
  assinatura_endpoint: string | null
  assinatura_api_key_enc: string | null     // Bearer JWT do BRy Cloud
  bry_compartimento_uuid: string | null     // UUID do compartimento HSM
  bry_credencial_tipo: BryCredencialTipo | null
  bry_credencial_enc: string | null         // PIN/OTP/TOKEN do compartimento (enc)
  tsa_url: string | null
  tsa_usuario: string | null
  tsa_senha_enc: string | null
  repositorio_url: string | null

  // Aba 2b — Visual do Histórico Escolar
  historico_arquivo_timbrado_url: string | null
  historico_cor_cabecalho: string | null
  historico_cor_linha_alternada: string | null
  historico_fonte: string | null
  historico_tamanho_fonte: number
  historico_tamanho_fonte_cabecalho: number
  historico_tamanho_fonte_corpo: number
  historico_layout: string | null
  historico_formato_nota: string | null
  historico_exibir_docente: boolean
  historico_exibir_ch: boolean
  historico_exibir_forma_integ: boolean
  historico_exibir_titulacao: boolean
  historico_texto_rodape: string | null
  historico_margem_topo: number
  historico_margem_inferior: number
  historico_margem_esquerda: number
  historico_margem_direita: number

  // Aba 2b — Visual Inovador (JSONB)
  historico_campos_aluno_config: HistoricoCampoAlunoConfig[] | null
  historico_colunas_config: HistoricoColunaConfig[] | null
  historico_formatacao_condicional: HistoricoFormatacaoRegra[] | null
  historico_secoes_config: HistoricoSecoesConfig | null
  historico_template_slug: string | null
  historico_tipo_ch: 'aula' | 'relogio'
  historico_exibir_nota_cem: boolean

  // Aba 4 — Regras e Fluxo
  prazo_emissao_dias: number
  notificar_diplomado_email: boolean
  versao_xsd: string

  ativo: boolean
  created_at: string
  updated_at: string
}

// Versão para formulário (sem campos de sistema)
export type DiplomaConfigForm = Omit<DiplomaConfig, 'id' | 'created_at' | 'updated_at'>

// Para exibição do provedor
export const PROVEDOR_LABELS: Record<ProvedorAssinatura, string> = {
  bry: 'BRy Technology',
  certisign: 'Certisign',
  soluti: 'Soluti',
  serpro: 'SERPRO',
  govbr: 'API GOV.BR',
  manual: 'Manual (A3 direto)',
  nenhum: 'Não configurado',
}

export const FONTES_DIPLOMA = [
  'Times New Roman',
  'Georgia',
  'Palatino Linotype',
  'Garamond',
  'Book Antiqua',
  'Arial',
  'Calibri',
]

export const VERSOES_XSD = ['1.05', '1.06', '1.04']
