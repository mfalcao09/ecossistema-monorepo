// =============================================================================
// Types — Módulo Diplomas
// ERP Educacional FIC — Diploma Digital (Portaria MEC 554/2019 + 70/2025)
// =============================================================================

// ===================== ENUMS =====================

/**
 * Pipeline completo de emissão de um diploma digital.
 * Cada status representa um estado no fluxo de geração.
 */
export type StatusDiploma =
  // ── Fase 1-2: Importação, Extração e Revisão ──
  | 'rascunho'                      // Processo criado, aguardando dados ou extração IA
  | 'validando_dados'               // Dados sendo validados automaticamente
  | 'preenchido'                    // Todos os dados preenchidos, pronto para gerar XML
  // ── Fase 3: Geração e Assinatura XML ──
  | 'gerando_xml'                   // Motor XML em execução
  | 'xml_gerado'                    // 2 XMLs da emissora gerados e validados contra XSD v1.05
  | 'validando_xsd'                 // Validação XSD em andamento
  | 'aguardando_assinatura_emissora' // Pronto para assinatura da emissora
  | 'em_assinatura'                 // Enviado para a API de assinatura (BRy KMS)
  | 'aplicando_carimbo_tempo'       // Carimbo de tempo sendo aplicado
  | 'assinado'                      // XMLs assinados com ICP-Brasil A3
  // ── Fase 4: Documentos Complementares (Histórico PDF, Termos) ──
  | 'aguardando_documentos'         // Aguardando geração dos documentos complementares
  | 'gerando_documentos'            // Gerando PDFs (histórico, termos)
  | 'documentos_assinados'          // Todos os PDFs complementares assinados via BRy CMS
  // ── Fase 5: Digitalização e Acervo Acadêmico ──
  | 'aguardando_digitalizacao'      // Aguardando seleção/tratamento de docs para acervo
  | 'acervo_completo'               // Docs digitalizados, convertidos PDF/A e assinados
  // ── Fase 6: Envio à Registradora ──
  | 'aguardando_envio_registradora' // Pacote pronto, aguardando envio
  | 'pronto_para_registro'          // Alias legacy — pronto para enviar
  | 'enviado_registradora'          // Pacote enviado à registradora
  | 'rejeitado_registradora'        // Registradora rejeitou o pacote
  | 'aguardando_registro'           // Na fila da registradora para registro
  | 'registrado'                    // Registrado no livro (livro/folha/nº preenchidos)
  // ── Fase Final: RVDD e Publicação ──
  | 'gerando_rvdd'                  // Gerando PDF da RVDD (Representação Visual)
  | 'rvdd_gerado'                   // RVDD (PDF) gerado com sucesso
  | 'publicado'                     // Disponível no portal público para o diplomado
  // ── Erro ──
  | 'erro'                          // Falha em alguma etapa

export type TurnoAluno =
  | 'matutino'
  | 'vespertino'
  | 'noturno'
  | 'integral'
  | 'ead'
  | 'outro'

export type AmbienteEmissao = 'homologacao' | 'producao'

// ===================== INTERFACE PRINCIPAL =====================

/**
 * Representa um diploma na tabela `diplomas`.
 * Contém todos os dados específicos de UM diploma de UM aluno.
 *
 * ATENÇÃO: Os dados complementares vêm de outras tabelas via JOIN:
 * - Dados pessoais do diplomado → tabela `diplomados`
 * - Dados do curso               → tabela `cursos`
 * - Disciplinas (histórico)      → tabela `diploma_disciplinas`
 * - ENADE                        → tabela `diploma_enade`
 * - Estágios                     → tabela `diploma_estagios`
 * - Atividades complementares    → tabela `diploma_atividades_complementares`
 * - Habilitações                 → tabela `diploma_habilitacoes`
 * - XMLs gerados (3 arquivos)    → tabela `xml_gerados`
 * - Signatários + assinaturas    → tabelas `assinantes` + `fluxo_assinaturas`
 * - Config da IES                → tabela `diploma_config`
 */
export interface Diploma {
  id: string

  // ── Relacionamentos ──────────────────────────────────────────────
  curso_id: string
  diplomado_id: string
  processo_id: string | null       // Processo de emissão em lote (processos_emissao)

  // ── Status no pipeline ───────────────────────────────────────────
  status: StatusDiploma

  // ── Dados acadêmicos deste diploma ───────────────────────────────
  /**
   * Título exato conferido a este diplomado.
   * Exemplo: "Bacharel em Ciências Contábeis" ou "Licenciado em Letras — Habilitação Português/Espanhol"
   * Se null, herda de cursos.titulo_conferido no momento da geração.
   */
  titulo_conferido: string | null

  turno: TurnoAluno | string | null
  modalidade: string | null        // Herda do curso; registrado aqui se for diferente

  data_ingresso: string | null     // ISO date
  data_vestibular: string | null   // ISO date
  forma_acesso: string | null      // Ex: 'ENEM/SISU', 'Vestibular', 'Transferência'
  periodo_letivo: string | null    // Ex: '2024/2', '2025/1'
  situacao_aluno: string           // Default: 'Formado'
  data_conclusao: string | null    // ISO date — conclusão das disciplinas
  carga_horaria_integralizada: number | null  // CH real integralizada por este aluno

  // ── Colação de grau ──────────────────────────────────────────────
  data_colacao_grau: string | null   // ISO date — data da cerimônia
  municipio_colacao: string | null   // Ex: 'Cassilândia'
  uf_colacao: string | null          // Ex: 'MS'

  // ── Expedição ────────────────────────────────────────────────────
  data_expedicao: string | null      // ISO date — data de expedição do diploma
  segunda_via: boolean               // true se for 2ª via

  // ── Registro em livro ────────────────────────────────────────────
  livro_registro_id: string | null
  numero_registro: string | null     // Número do diploma no livro
  pagina_registro: number | null     // Folha/página
  processo_registro: string | null   // Número do processo de registro
  data_registro: string | null       // ISO date — data do registro

  // ── Dados histórico ──────────────────────────────────────────────
  codigo_curriculo: string | null    // Código do currículo (PPC) que o aluno seguiu
  data_emissao_historico: string | null  // ISO date — data do histórico escolar

  // ── Verificação e publicação ─────────────────────────────────────
  codigo_validacao: string | null    // Código alfanumérico único (ex: 'FIC-2025-ABC123')
  url_verificacao: string | null     // https://diploma.ficcassilandia.com.br/verificar/{codigo}
  qrcode_url: string | null          // URL da imagem do QR Code gerado

  // ── Arquivos gerados ─────────────────────────────────────────────
  xml_url: string | null             // URL do XML principal assinado (legado/genérico)
  pdf_url: string | null             // URL do RVDD (PDF visual do diploma)
  data_publicacao: string | null     // Timestamp de disponibilização no portal público

  // ── Metadados de conformidade MEC ────────────────────────────────
  versao_xsd: string                 // Default: '1.05'
  informacoes_adicionais: string | null

  // ── Operação e auditoria ─────────────────────────────────────────
  ambiente: AmbienteEmissao          // Default: 'homologacao'
  emitido_por_user_id: string | null // UUID do usuário que acionou a emissão
  observacoes_diploma: string | null

  // ── IES Emissora e Registradora (extraídos do XML) ──────────────
  emissora_nome: string | null
  emissora_codigo_mec: string | null
  emissora_cnpj: string | null
  registradora_nome: string | null
  registradora_codigo_mec: string | null
  registradora_cnpj: string | null

  // ── Dados legado (importação de diplomas anteriores) ─────────────
  is_legado: boolean
  legado_id_externo: string | null
  legado_versao_xsd: string | null
  legado_importado_em: string | null
  legado_xml_documentos_path: string | null
  legado_xml_dados_path: string | null
  legado_rvdd_original_path: string | null
  legado_fonte: string | null

  // ── Timestamps ───────────────────────────────────────────────────
  created_at: string
  updated_at: string
}

// ===================== TIPOS RELACIONADOS =====================

/** Dados pessoais do diplomado (tabela diplomados) */
export interface DiplomadoResumo {
  id: string
  nome: string
  nome_social: string | null
  cpf: string
  ra: string | null
  data_nascimento: string | null
  sexo: 'M' | 'F' | null
  nacionalidade: string | null
  naturalidade_municipio: string | null
  naturalidade_uf: string | null
  codigo_municipio_ibge: string | null
  rg_numero: string | null
  rg_orgao_expedidor: string | null
  rg_uf: string | null
  email: string | null
  telefone: string | null
}

/** Dados do curso relevantes para o diploma */
export interface CursoResumo {
  id: string
  nome: string
  codigo_emec: string | null
  grau: string                       // Enum: bacharelado, licenciatura, tecnologico, etc.
  titulo_conferido: string | null    // Título padrão do curso
  modalidade: string | null          // presencial, ead, hibrido
  carga_horaria_total: number | null
  carga_horaria_hora_relogio: number | null
  numero_reconhecimento: string | null
  tipo_reconhecimento: string | null
  data_reconhecimento: string | null
  municipio: string | null
  uf: string | null
  enfase: string | null
}

/** Uma disciplina cursada (histórico escolar) */
export interface DiplomaDisciplina {
  id: string
  diploma_id: string
  codigo: string | null
  nome: string
  periodo: string | null
  situacao: string                    // aprovado, reprovado, dispensado, cursando
  carga_horaria_aula: number | null
  carga_horaria_relogio: number | null
  nota: number | null
  nota_ate_cem: number | null
  conceito: string | null
  forma_integralizacao: string | null
  docente_nome: string | null
  docente_titulacao: string | null
  docente_cpf: string | null
  ordem: number | null
}

/** Dados do ENADE para este diplomado */
export interface DiplomaEnade {
  id: string
  diploma_id: string
  situacao: string | null
  condicao: string | null
  condicao_nao_habilitado: string | null
  situacao_substituta: string | null
  ano_edicao: number | null
}

/** Estágio supervisionado */
export interface DiplomaEstagio {
  id: string
  diploma_id: string
  [key: string]: unknown
}

/** Atividade complementar */
export interface DiplomaAtividadeComplementar {
  id: string
  diploma_id: string
  [key: string]: unknown
}

/** Habilitação específica */
export interface DiplomaHabilitacao {
  id: string
  diploma_id: string
  nome: string
  data_habilitacao: string | null
}

/** XML gerado (um por tipo: DiplomaDigital, HistoricoEscolar, DocumentacaoAcademica) */
export interface XmlGerado {
  id: string
  diploma_id: string
  processo_id: string | null
  tipo: 'DiplomaDigital' | 'HistoricoEscolarDigital' | 'DocumentacaoAcademicaRegistro'
  versao_xsd: string
  conteudo_xml: string | null
  hash_sha256: string | null
  validado_xsd: boolean
  erros_validacao: unknown | null
  status: string
  arquivo_url: string | null
  assinado_em: string | null
  assinantes_xml: unknown | null
  created_at: string
  updated_at: string
}

/** Signatário configurado na IES */
export interface Assinante {
  id: string
  instituicao_id: string
  cpf: string
  nome: string
  cargo: string                     // Enum: reitor, diretor, secretario, etc.
  outro_cargo: string | null
  ativo: boolean
  tipo_certificado: string | null   // 'e-CPF' A3, 'e-CNPJ'
  ordem_assinatura: number | null
}

/** Status de uma assinatura no fluxo */
export interface FluxoAssinatura {
  id: string
  diploma_id: string
  assinante_id: string
  ordem: number
  status: string                    // pendente, assinado, rejeitado, cancelado
  papel: 'emissora' | 'registradora' | null  // papel da IES nesta assinatura
  data_assinatura: string | null
  tipo_certificado: string | null
  hash_assinatura: string | null
}

// ===================== TIPO COMPLETO (para geração de RVDD/XML) =====================

/**
 * DiplomaCompleto — todos os dados necessários para gerar a RVDD (PDF) e os 3 XMLs.
 *
 * Resultado de um JOIN entre as 9+ tabelas envolvidas na emissão.
 * Esta é a estrutura que o motor de geração recebe como input.
 */
export interface DiplomaCompleto {
  diploma: Diploma
  diplomado: DiplomadoResumo
  curso: CursoResumo
  disciplinas: DiplomaDisciplina[]
  enade: DiplomaEnade | null
  estagios: DiplomaEstagio[]
  atividades_complementares: DiplomaAtividadeComplementar[]
  habilitacoes: DiplomaHabilitacao[]
  xmls_gerados: XmlGerado[]
  assinantes: Assinante[]
  fluxo_assinaturas: FluxoAssinatura[]
}

// ===================== VARIÁVEIS PARA O TEMPLATE RVDD =====================

/**
 * Variáveis planas injetadas no template HTML/PDF da RVDD.
 * Extraídas do DiplomaCompleto pelo motor de geração.
 *
 * Convenção: snake_case, sem prefixo de tabela.
 * O motor de geração popula este objeto e o injeta no template Handlebars/Mustache.
 */
export interface VariaveisRVDD {
  // ── Diplomado ────────────────────────────────────────────────────
  nome: string                        // Nome completo
  nome_social: string | null          // Nome social (se houver)
  cpf: string                         // CPF formatado: 000.000.000-00
  data_nascimento: string             // Ex: '01 de janeiro de 1990'
  naturalidade: string                // Ex: 'Cassilândia/MS'
  nacionalidade: string               // Ex: 'Brasileiro(a)'
  rg: string | null                   // Ex: 'RG 1.234.567 SSP/MS'

  // ── Curso ────────────────────────────────────────────────────────
  curso_nome: string                  // Ex: 'Ciências Contábeis'
  titulo_conferido: string            // Ex: 'Bacharel em Ciências Contábeis'
  grau: string                        // Ex: 'Bacharelado'
  modalidade: string                  // Ex: 'Presencial'
  turno: string | null                // Ex: 'Noturno'
  carga_horaria: number               // CH integralizada
  codigo_emec: string | null          // Ex: '12345'
  ato_reconhecimento: string | null   // Ex: 'Portaria MEC nº 123 de 15/03/2022'

  // ── Datas ────────────────────────────────────────────────────────
  data_ingresso: string | null        // Ex: '02 de fevereiro de 2021'
  data_conclusao: string | null       // Ex: '30 de novembro de 2024'
  data_colacao: string                // Ex: '15 de março de 2025'
  municipio_colacao: string | null    // Ex: 'Cassilândia'
  uf_colacao: string | null           // Ex: 'MS'
  data_expedicao: string              // Ex: '20 de março de 2025'

  // ── Registro ─────────────────────────────────────────────────────
  numero_registro: string | null      // Ex: '2025/001'
  livro: string | null                // Ex: 'Livro nº 5'
  pagina: string | null               // Ex: 'Folha 12'
  data_registro: string | null        // Ex: '20 de março de 2025'

  // ── Verificação ──────────────────────────────────────────────────
  codigo_validacao: string            // Ex: 'FIC-2025-ABC123'
  url_verificacao: string             // Ex: 'https://diploma.ficcassilandia.com.br/verificar/FIC-2025-ABC123'
  qrcode_url: string | null           // URL da imagem PNG do QR Code

  // ── IES ──────────────────────────────────────────────────────────
  ies_nome: string                    // Ex: 'Faculdades Integradas de Cassilândia'
  ies_sigla: string | null            // Ex: 'FIC'
  ies_cnpj: string                    // Ex: '00.000.000/0001-00'
  ies_municipio: string               // Ex: 'Cassilândia'
  ies_uf: string                      // Ex: 'MS'

  // ── Signatários ──────────────────────────────────────────────────
  signatarios: Array<{
    nome: string
    cargo: string
    cpf: string | null
  }>

  // ── Metadados do diploma ─────────────────────────────────────────
  segunda_via: boolean
  ano_emissao: number                 // Ex: 2025
  versao_xsd: string                  // Ex: '1.06'
  ambiente: AmbienteEmissao
}

// ===================== FORMS =====================

export interface DiplomaCreateInput {
  curso_id: string
  diplomado_id: string
  processo_id?: string
  titulo_conferido?: string
  turno?: TurnoAluno | string
  modalidade?: string
  data_ingresso?: string
  data_vestibular?: string
  forma_acesso?: string
  periodo_letivo?: string
  data_conclusao?: string
  carga_horaria_integralizada?: number
  data_colacao_grau?: string
  municipio_colacao?: string
  uf_colacao?: string
  data_expedicao?: string
  segunda_via?: boolean
  codigo_curriculo?: string
  informacoes_adicionais?: string
  ambiente?: AmbienteEmissao
  observacoes_diploma?: string
}

export interface DiplomaUpdateInput extends Partial<DiplomaCreateInput> {
  id: string
}

export interface DiplomaFiltros {
  busca?: string              // Nome do diplomado ou código de validação
  status?: StatusDiploma
  curso_id?: string
  processo_id?: string
  ambiente?: AmbienteEmissao
  segunda_via?: boolean
  is_legado?: boolean
  data_colacao_de?: string
  data_colacao_ate?: string
  pagina?: number
  por_pagina?: number
  ordenar_por?: 'created_at' | 'data_colacao_grau' | 'data_expedicao' | 'status'
  ordem?: 'asc' | 'desc'
}

export interface DiplomaListResponse {
  dados: DiplomaComResumo[]
  total: number
  pagina: number
  por_pagina: number
  total_paginas: number
}

/** Diploma com dados básicos do diplomado e curso (para listagens) */
export interface DiplomaComResumo extends Diploma {
  diplomado?: Pick<DiplomadoResumo, 'id' | 'nome' | 'cpf' | 'ra'>
  curso?: Pick<CursoResumo, 'id' | 'nome' | 'grau' | 'titulo_conferido'>
}

// ===================== LABELS PARA UI =====================

export const STATUS_DIPLOMA_LABELS: Record<StatusDiploma, string> = {
  // Etapa 0 — Extração e Dados
  rascunho:           'Em preparação',
  validando_dados:    'Validando dados',
  preenchido:         'Dados confirmados',
  gerando_xml:        'Gerando XML',
  // Etapa 1 — XML e Assinatura
  xml_gerado:                     'XML gerado',
  validando_xsd:                  'Validando XML',
  aguardando_assinatura_emissora: 'Aguarda assinatura',
  em_assinatura:                  'Em assinatura',
  aplicando_carimbo_tempo:        'Em assinatura',
  assinado:                       'XMLs assinados',
  // Etapa 2 — Documentação e Acervo
  aguardando_documentos:    'Aguarda documentos',
  gerando_documentos:       'Preparando documentos',
  documentos_assinados:     'Docs assinados',
  aguardando_digitalizacao: 'Aguarda digitalização',
  acervo_completo:          'Acervo completo',
  // Etapa 3 — Registro
  aguardando_envio_registradora: 'Pronto para envio',
  pronto_para_registro:          'Pronto para registro',
  enviado_registradora:          'Enviado à UFMS',
  rejeitado_registradora:        'Rejeitado pela UFMS',
  aguardando_registro:           'Aguarda registro',
  registrado:                    'Registrado',
  // Etapa 4 — RVDD
  gerando_rvdd: 'Gerando RVDD',
  rvdd_gerado:  'RVDD gerado',
  // Etapa 5 — Publicado
  publicado: 'Publicado',
  // Erro
  erro: 'Erro',
}

export const STATUS_DIPLOMA_COR: Record<StatusDiploma, string> = {
  rascunho: 'gray',
  validando_dados: 'gray',
  preenchido: 'blue',
  gerando_xml: 'blue',
  xml_gerado: 'indigo',
  validando_xsd: 'indigo',
  aguardando_assinatura_emissora: 'yellow',
  em_assinatura: 'yellow',
  aplicando_carimbo_tempo: 'yellow',
  assinado: 'teal',
  aguardando_documentos: 'amber',
  gerando_documentos: 'amber',
  documentos_assinados: 'emerald',
  aguardando_digitalizacao: 'sky',
  acervo_completo: 'cyan',
  aguardando_envio_registradora: 'orange',
  pronto_para_registro: 'orange',
  enviado_registradora: 'lime',
  rejeitado_registradora: 'red',
  aguardando_registro: 'orange',
  registrado: 'cyan',
  gerando_rvdd: 'purple',
  rvdd_gerado: 'violet',
  publicado: 'green',
  erro: 'red',
}

/** Ordem principal do pipeline (fluxo feliz, sem status intermediários/legacy) */
export const STATUS_DIPLOMA_ORDEM: StatusDiploma[] = [
  'rascunho',
  'preenchido',
  'xml_gerado',
  'em_assinatura',
  'assinado',
  'aguardando_documentos',
  'gerando_documentos',
  'documentos_assinados',
  'aguardando_digitalizacao',
  'acervo_completo',
  'aguardando_envio_registradora',
  'enviado_registradora',
  'aguardando_registro',
  'registrado',
  'gerando_rvdd',
  'rvdd_gerado',
  'publicado',
]

export const TURNO_LABELS: Record<TurnoAluno, string> = {
  matutino: 'Matutino',
  vespertino: 'Vespertino',
  noturno: 'Noturno',
  integral: 'Integral',
  ead: 'EaD',
  outro: 'Outro',
}
