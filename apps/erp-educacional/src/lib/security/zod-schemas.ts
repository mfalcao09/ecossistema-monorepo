import { z } from 'zod'

// ── Schemas reutilizáveis ────────────────────────────────

/**
 * CPF: 11 dígitos numéricos
 */
export const cpfSchema = z
  .string()
  .regex(/^\d{11}$/, 'CPF deve ter 11 dígitos numéricos')
  .transform((val) => val.trim())

/**
 * CNPJ: 14 dígitos numéricos
 */
export const cnpjSchema = z
  .string()
  .regex(/^\d{14}$/, 'CNPJ deve ter 14 dígitos numéricos')
  .transform((val) => val.trim())

/**
 * CPF ou CNPJ: 11 dígitos (CPF) ou 14 dígitos (CNPJ)
 */
export const cpfOuCnpjSchema = z
  .string()
  .regex(/^\d{11}$|^\d{14}$/, 'Documento deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ)')
  .transform((val) => val.trim())

/**
 * Email validado com RFC standards
 */
export const emailSchema = z
  .string()
  .email('Email inválido')
  .max(255, 'Email não pode exceder 255 caracteres')
  .toLowerCase()
  .transform((val) => val.trim())

/**
 * UUID padrão v4
 */
export const uuidSchema = z
  .string()
  .uuid('ID deve ser um UUID válido')
  .transform((val) => val.trim())

/**
 * Data no formato YYYY-MM-DD
 */
export const dataSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')

/**
 * Código de diploma (FIC-YYYY-XXXXXXXX)
 */
export const codigoDiplomaSchema = z
  .string()
  .regex(/^FIC-\d{4}-[A-Z0-9]{8}$/, 'Código deve estar no formato FIC-YYYY-XXXXXXXX')
  .toUpperCase()

// ── Schemas de entidade ──────────────────────────────────

/**
 * Criar/editar diplomado
 */
export const diplomadoSchema = z.object({
  nome: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(200, 'Nome não pode exceder 200 caracteres')
    .transform((val) => val.trim()),

  cpf: cpfSchema,

  rg: z
    .string()
    .max(20, 'RG não pode exceder 20 caracteres')
    .optional()
    .transform((val) => val?.trim()),

  email: emailSchema.optional().nullable(),

  data_nascimento: dataSchema.optional(),

  nacionalidade: z
    .string()
    .max(100, 'Nacionalidade não pode exceder 100 caracteres')
    .optional()
    .transform((val) => val?.trim()),

  naturalidade: z
    .string()
    .max(200, 'Naturalidade não pode exceder 200 caracteres')
    .optional()
    .transform((val) => val?.trim()),

  sexo: z.enum(['M', 'F']).optional(),
})

/**
 * Criar/editar curso
 */
export const cursoSchema = z.object({
  nome: z
    .string()
    .min(2, 'Nome do curso deve ter pelo menos 2 caracteres')
    .max(300, 'Nome do curso não pode exceder 300 caracteres')
    .transform((val) => val.trim()),

  codigo_emec: z
    .string()
    .max(20, 'Código EMEC não pode exceder 20 caracteres')
    .optional()
    .transform((val) => val?.trim()),

  grau: z
    .string()
    .max(100, 'Grau não pode exceder 100 caracteres')
    .optional()
    .transform((val) => val?.trim()),

  modalidade: z
    .string()
    .max(50, 'Modalidade não pode exceder 50 caracteres')
    .optional()
    .transform((val) => val?.trim()),

  departamento_id: uuidSchema.optional(),
})

/**
 * Criar/editar diploma
 */
export const diplomaSchema = z.object({
  diplomado_id: uuidSchema,

  curso_id: uuidSchema,

  processo_id: uuidSchema.optional(),

  data_colacao: dataSchema.optional(),

  data_expedicao: dataSchema.optional(),

  livro: z
    .string()
    .max(20, 'Livro não pode exceder 20 caracteres')
    .optional()
    .transform((val) => val?.trim()),

  folha: z
    .string()
    .max(20, 'Folha não pode exceder 20 caracteres')
    .optional()
    .transform((val) => val?.trim()),

  numero_registro: z
    .string()
    .max(50, 'Número de registro não pode exceder 50 caracteres')
    .optional()
    .transform((val) => val?.trim()),

  status: z
    .enum([
      'pendente',
      'em_processamento',
      'gerado',
      'assinado',
      'publicado',
      'cancelado',
      'anulado',
    ])
    .optional(),
})

/**
 * Criar/editar usuário
 */
export const usuarioSchema = z.object({
  email: emailSchema,

  nome: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(200, 'Nome não pode exceder 200 caracteres')
    .transform((val) => val.trim()),

  papel: z
    .enum(['admin', 'secretario', 'diretor', 'visualizador'])
    .optional(),

  ativo: z.boolean().optional(),
})

/**
 * Alterar senha
 */
export const alterarSenhaSchema = z
  .object({
    senha_atual: z
      .string()
      .min(1, 'Senha atual é obrigatória'),

    nova_senha: z
      .string()
      .min(8, 'Senha deve ter pelo menos 8 caracteres')
      .regex(/[A-Z]/, 'Senha deve ter pelo menos uma letra maiúscula')
      .regex(/[a-z]/, 'Senha deve ter pelo menos uma letra minúscula')
      .regex(/[0-9]/, 'Senha deve ter pelo menos um número'),

    confirma_senha: z.string(),
  })
  .refine((data) => data.nova_senha === data.confirma_senha, {
    message: 'Senhas não conferem',
    path: ['confirma_senha'],
  })

/**
 * Portal — consulta CPF
 */
export const consultaCpfSchema = z.object({
  cpf: cpfSchema,

  turnstileToken: z
    .string()
    .min(1, 'Token de verificação é obrigatório'),
})

/**
 * Portal — validar código de diploma
 */
export const validarCodigoSchema = z.object({
  codigo: z
    .string()
    .min(5, 'Código deve ter pelo menos 5 caracteres')
    .max(100, 'Código muito longo')
    .regex(/^[a-zA-Z0-9\-]+$/, 'Código contém caracteres inválidos')
    .toUpperCase(),

  turnstileToken: z
    .string()
    .min(1, 'Token de verificação é obrigatório'),
})

/**
 * Gerar/assinar diploma
 */
export const gerarDiplomaSchema = z.object({
  diplomado_id: uuidSchema,

  curso_id: uuidSchema,

  data_colacao: dataSchema,

  data_expedicao: dataSchema.optional(),
})

/**
 * Processar assinatura digital
 */
export const processarAssinaturaSchema = z.object({
  diploma_id: uuidSchema,

  assinante_email: emailSchema,

  assinante_cpf: cpfSchema.optional(),

  tipo_assinatura: z.enum(['emissora', 'registradora']),
})

/**
 * Bulk import de diplomados (CSV)
 */
export const importarDiplomadasSchema = z.object({
  curso_id: uuidSchema,

  arquivo: z
    .string()
    .min(1, 'Arquivo é obrigatório'),

  encoding: z.enum(['utf-8', 'iso-8859-1', 'windows-1252']).optional(),
})

/**
 * Criar/editar assinante
 */
export const assinanteSchema = z.object({
  instituicao_id: uuidSchema,

  nome: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(200, 'Nome não pode exceder 200 caracteres')
    .transform((val) => val.trim()),

  email: emailSchema.optional(),

  cpf: cpfOuCnpjSchema.optional(),

  cargo: z.enum([
    'reitor',
    'reitor_exercicio',
    'responsavel_registro',
    'coordenador_curso',
    'subcoordenador_curso',
    'coordenador_exercicio',
    'chefe_registro',
    'chefe_registro_exercicio',
    'secretario_decano',
    'outro',
  ], { errorMap: () => ({ message: 'Cargo inválido' }) }),

  outro_cargo: z
    .string()
    .max(200, 'Cargo personalizado não pode exceder 200 caracteres')
    .nullable()
    .optional()
    .transform((val) => val?.trim() || null),

  tipo_certificado: z.enum(['eCPF', 'eCNPJ']).optional(),

  ordem_assinatura: z
    .number()
    .int('Ordem de assinatura deve ser um número inteiro')
    .positive('Ordem de assinatura deve ser positiva')
    .optional(),

  ativo: z.boolean().optional(),
})

/**
 * Criar/editar credenciamento
 */
export const credenciamentoSchema = z.object({
  instituicao_id: uuidSchema,

  numero: z
    .string()
    .max(50, 'Número do credenciamento não pode exceder 50 caracteres')
    .optional()
    .transform((val) => val?.trim()),

  data: dataSchema.optional(),

  data_publicacao_dou: dataSchema.optional(),

  data_vencimento: dataSchema.optional(),

  vigente: z.boolean().optional(),

  alerta_renovacao_dias: z
    .number()
    .int('Dias de alerta devem ser inteiros')
    .min(0, 'Dias não podem ser negativos')
    .optional(),

  observacoes: z
    .string()
    .max(1000, 'Observações não podem exceder 1000 caracteres')
    .optional()
    .transform((val) => val?.trim()),
})

/**
 * Criar/editar departamento
 */
export const departamentoSchema = z.object({
  instituicao_id: uuidSchema,

  nome: z
    .string()
    .min(2, 'Nome do departamento deve ter pelo menos 2 caracteres')
    .max(200, 'Nome não pode exceder 200 caracteres')
    .transform((val) => val.trim()),

  codigo: z
    .string()
    .min(1, 'Código é obrigatório')
    .max(20, 'Código não pode exceder 20 caracteres')
    .transform((val) => val.trim()),

  descricao: z
    .string()
    .max(500, 'Descrição não pode exceder 500 caracteres')
    .optional()
    .transform((val) => val?.trim()),

  ativo: z.boolean().optional(),
})

/**
 * Criar/editar documento digital
 */
export const documentoSchema = z.object({
  tipo: z
    .enum([
      'diploma', 'historico_escolar', 'declaracao_matricula',
      'declaracao_conclusao', 'declaracao_frequencia',
      'atestado_escolaridade', 'certificado', 'outro'
    ], { errorMap: () => ({ message: 'Tipo de documento inválido' }) }),

  destinatario_nome: z
    .string()
    .min(1, 'Nome do destinatário é obrigatório')
    .max(200, 'Nome do destinatário não pode exceder 200 caracteres')
    .transform((val) => val.trim()),

  titulo: z
    .string()
    .min(1, 'Título é obrigatório')
    .max(300, 'Título não pode exceder 300 caracteres')
    .transform((val) => val.trim()),

  referencia_id: uuidSchema.optional(),

  referencia_tabela: z
    .string()
    .max(100)
    .optional(),

  diplomado_id: uuidSchema.optional(),

  destinatario_cpf: cpfSchema.optional(),

  descricao: z
    .string()
    .max(1000, 'Descrição não pode exceder 1000 caracteres')
    .optional()
    .transform((val) => val?.trim()),

  numero_documento: z
    .string()
    .max(100)
    .optional()
    .transform((val) => val?.trim()),

  ies_id: uuidSchema.optional(),

  metadata: z.record(z.unknown()).optional(),
})

/**
 * Criar usuário (auth + profile)
 */
export const criarUsuarioSchema = z
  .object({
    email: emailSchema,

    password: z
      .string()
      .min(8, 'Senha deve ter pelo menos 8 caracteres')
      .regex(/[A-Z]/, 'Senha deve ter pelo menos uma letra maiúscula')
      .regex(/[a-z]/, 'Senha deve ter pelo menos uma letra minúscula')
      .regex(/[0-9]/, 'Senha deve ter pelo menos um número')
      .regex(/[^A-Za-z0-9]/, 'Senha deve ter pelo menos um símbolo (!@#$%...)'),

    full_name: z
      .string()
      .min(2, 'Nome deve ter pelo menos 2 caracteres')
      .max(200, 'Nome não pode exceder 200 caracteres')
      .transform((val) => val.trim()),

    role: z
      .enum([
        'admin_instituicao',
        'aux_bibliotecaria',
        'aux_financeiro',
        'aux_secretaria',
        'bibliotecaria',
        'cadastramento',
        'comunidade',
        'coordenacao_curso',
        'diretoria',
        'estudantes',
      ])
      .optional(),

    cargos_academicos: z
      .array(z.string())
      .optional(),

    telefone: z
      .string()
      .max(20, 'Telefone não pode exceder 20 caracteres')
      .optional()
      .transform((val) => val?.trim()),
  })

/**
 * Criar parâmetro do sistema
 */
export const parametroSchema = z.object({
  chave: z
    .string()
    .min(1, 'Chave é obrigatória')
    .max(100, 'Chave não pode exceder 100 caracteres')
    .transform((val) => val.trim()),

  valor: z
    .string()
    .min(1, 'Valor é obrigatório')
    .max(5000, 'Valor não pode exceder 5000 caracteres'),

  tipo: z.enum(['texto', 'numero', 'booleano', 'json', 'data', 'lista', 'senha']),

  modulo: z
    .string()
    .min(1, 'Módulo é obrigatório')
    .max(100, 'Módulo não pode exceder 100 caracteres'),

  descricao: z
    .string()
    .max(500, 'Descrição não pode exceder 500 caracteres')
    .optional()
    .transform((val) => val?.trim()),
})

/**
 * Criar ano letivo
 */
export const anoLetivoSchema = z
  .object({
    ano: z
      .number()
      .int('Ano deve ser um número inteiro')
      .min(1900, 'Ano deve ser maior que 1900')
      .max(2100, 'Ano deve ser menor que 2100'),

    tipo: z.enum(['anual', 'semestral', 'trimestral']),

    descricao: z
      .string()
      .max(500, 'Descrição não pode exceder 500 caracteres')
      .optional()
      .transform((val) => val?.trim()),

    data_inicio: z
      .string()
      .datetime({ message: 'data_inicio deve ser ISO 8601' }),

    data_fim: z
      .string()
      .datetime({ message: 'data_fim deve ser ISO 8601' }),
  })
  .refine((data) => new Date(data.data_inicio) < new Date(data.data_fim), {
    message: 'data_inicio deve ser anterior a data_fim',
    path: ['data_inicio'],
  })

/**
 * Criar/editar configuração de IA
 */
export const iaConfiguracaoSchema = z.object({
  nome_agente: z
    .string()
    .min(1, 'Nome do agente é obrigatório')
    .max(100, 'Nome não pode exceder 100 caracteres')
    .transform((val) => val.trim()),

  modulo: z
    .string()
    .min(1, 'Módulo é obrigatório')
    .max(100, 'Módulo não pode exceder 100 caracteres'),

  funcionalidade: z
    .string()
    .max(100, 'Funcionalidade não pode exceder 100 caracteres')
    .nullable()
    .optional(),

  modelo: z
    .string()
    .max(150, 'Modelo não pode exceder 150 caracteres')
    .optional()
    .transform((val) => val?.trim()),

  persona: z
    .string()
    .max(50000, 'Persona não pode exceder 50000 caracteres')
    .optional(),

  sistema_prompt: z
    .string()
    .max(50000, 'Prompt do sistema não pode exceder 50000 caracteres')
    .optional(),

  temperatura: z
    .number()
    .min(0, 'Temperatura deve ser entre 0 e 1')
    .max(1, 'Temperatura deve ser entre 0 e 1')
    .optional(),

  max_tokens: z
    .number()
    .int('Max tokens deve ser inteiro')
    .positive('Max tokens deve ser positivo')
    .optional(),

  provider_id: z
    .string()
    .uuid('Provider ID deve ser um UUID válido')
    .nullable()
    .optional(),

  ativo: z.boolean().optional(),
})

/**
 * Criar processo de emissão
 */
export const processoSchema = z.object({
  nome: z
    .string()
    .min(2, 'Nome do processo deve ter pelo menos 2 caracteres')
    .max(300, 'Nome não pode exceder 300 caracteres')
    .transform((val) => val.trim()),

  curso_id: uuidSchema,

  turno: z
    .string()
    .max(50, 'Turno não pode exceder 50 caracteres')
    .nullable()
    .optional()
    .transform((val) => val?.trim() || undefined),

  periodo_letivo: z
    .string()
    .max(50, 'Período letivo não pode exceder 50 caracteres')
    .nullable()
    .optional()
    .transform((val) => val?.trim() || undefined),

  data_colacao: dataSchema.nullable().optional(),

  obs: z
    .string()
    .max(1000, 'Observações não podem exceder 1000 caracteres')
    .nullable()
    .optional()
    .transform((val) => val?.trim() || undefined),
})

/**
 * Atualizar system settings
 */
export const systemSettingsSchema = z.object({
  instituicao_nome: z
    .string()
    .min(1, 'Nome da instituição é obrigatório')
    .max(255, 'Nome não pode exceder 255 caracteres')
    .optional(),

  cor_principal: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor principal deve ser um hexadecimal válido (ex: #4F46E5)')
    .optional(),

  tema: z
    .enum(['claro', 'escuro', 'auto'])
    .optional(),

  logo_url: z
    .string()
    .url('URL do logo deve ser válida')
    .optional()
    .nullable(),

  logo_dark_url: z
    .string()
    .url('URL do logo escuro deve ser válida')
    .optional()
    .nullable(),

  banner_login_url: z
    .string()
    .url('URL do banner deve ser válida')
    .optional()
    .nullable(),

  openrouter_api_key: z
    .string()
    .max(500, 'Chave de API não pode exceder 500 caracteres')
    .optional()
    .nullable(),
})
