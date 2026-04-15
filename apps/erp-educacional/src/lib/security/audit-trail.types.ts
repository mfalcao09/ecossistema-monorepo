/**
 * ============================================================
 * TIPOS PARA AUDITORIA — Definições TypeScript
 * ERP Educacional FIC
 * ============================================================
 */

/**
 * Tipos de ações auditáveis no sistema
 * @enum {string}
 */
export enum AcaoAuditoria {
  /** Criação de novo registro */
  CRIAR = 'criar',

  /** Modificação de registro existente */
  EDITAR = 'editar',

  /** Deleção de registro */
  EXCLUIR = 'excluir',

  /** Consulta/leitura (para auditorias sensíveis) */
  VISUALIZAR = 'visualizar',

  /** Exportação de dados (PDF, ZIP, etc.) */
  EXPORTAR = 'exportar',

  /** Assinatura digital */
  ASSINAR = 'assinar',

  /** Publicação em repositório público */
  PUBLICAR = 'publicar',

  /** Autenticação de usuário */
  LOGIN = 'login',

  /** Logout de usuário */
  LOGOUT = 'logout',

  /** Mudança de senha */
  ALTERAR_SENHA = 'alterar_senha',

  /** Mudança de permissões/roles */
  ALTERAR_PERMISSAO = 'alterar_permissao',
}

/**
 * Tipos de entidades auditáveis
 * @enum {string}
 */
export enum EntidadeAuditavel {
  /** Diploma digital (RVDD + XMLs) */
  DIPLOMA = 'diploma',

  /** Aluno/formando */
  DIPLOMADO = 'diplomado',

  /** Curso/programa acadêmico */
  CURSO = 'curso',

  /** Usuário do sistema */
  USUARIO = 'usuario',

  /** Departamento acadêmico */
  DEPARTAMENTO = 'departamento',

  /** Instituição de Ensino Superior */
  IES = 'ies',

  /** Dados de assinatura digital */
  ASSINATURA = 'assinatura',

  /** Arquivos XML (DocumentacaoAcademica, Histórico, DiplomaDigital) */
  XML = 'xml',

  /** Relatórios e exports */
  RELATORIO = 'relatorio',
}

/**
 * Entrada de auditoria com metadados completos
 * @interface AuditEntry
 */
export interface AuditEntry {
  /** UUID do usuário que realizou a ação */
  usuario_id: string

  /** Tipo de ação executada */
  acao: AcaoAuditoria | string

  /** Tipo de entidade afetada */
  entidade: EntidadeAuditavel | string

  /** ID da entidade específica afetada (opcional) */
  entidade_id?: string

  /** Contexto adicional em JSON:
   * - Campos alterados (para edições)
   * - Valores anteriores e novos
   * - Motivo da ação
   * - Detalhes de assinatura
   * - IDs de relacionamentos
   */
  detalhes?: Record<string, unknown>

  /** Endereço IP do cliente que realizou a ação */
  ip?: string

  /** User-Agent do navegador/cliente */
  user_agent?: string
}

/**
 * Resposta da consulta de auditoria
 * @interface AuditTrailRecord
 */
export interface AuditTrailRecord extends AuditEntry {
  /** UUID único da entrada */
  id: string

  /** Timestamp em UTC da ação */
  criado_em: string
}

/**
 * Filtros para consulta de auditoria
 * @interface AuditTrailFilters
 */
export interface AuditTrailFilters {
  /** Filtrar por usuário */
  usuario_id?: string

  /** Filtrar por tipo de ação */
  acao?: AcaoAuditoria | AcaoAuditoria[]

  /** Filtrar por tipo de entidade */
  entidade?: EntidadeAuditavel | EntidadeAuditavel[]

  /** Filtrar por ID de entidade */
  entidade_id?: string

  /** Data inicial (ISO 8601) */
  desde?: string

  /** Data final (ISO 8601) */
  ate?: string

  /** Limite de resultados (padrão: 100) */
  limite?: number

  /** Offset para paginação */
  offset?: number
}

/**
 * Resposta paginada de auditoria
 * @interface AuditTrailResponse
 */
export interface AuditTrailResponse {
  /** Array de entradas de auditoria */
  dados: AuditTrailRecord[]

  /** Total de registros (sem limite) */
  total: number

  /** Página atual */
  pagina: number

  /** Total de páginas */
  paginas: number

  /** Timestamp da consulta */
  consultado_em: string
}

/**
 * Contexto de auditoria para detalhes de edição
 * @interface AuditEdicaoDetalhes
 */
export interface AuditEdicaoDetalhes {
  /** Array de campos que foram alterados */
  campos_alterados: string[]

  /** Valores anteriores dos campos (opcionalmente mascarados) */
  valores_anteriores?: Record<string, unknown>

  /** Valores novos dos campos (opcionalmente mascarados) */
  valores_novos?: Record<string, unknown>

  /** Motivo/justificativa da alteração (opcional) */
  motivo?: string

  /** ID do registro que aprovou a mudança (se aplicável) */
  aprovado_por?: string
}

/**
 * Contexto de auditoria para assinatura
 * @interface AuditAssinaturaDetalhes
 */
export interface AuditAssinaturaDetalhes {
  /** Tipo de assinatura: XAdES, CAdES, PAdES */
  tipo_assinatura: 'XAdES' | 'CAdES' | 'PAdES'

  /** Role do signatário: reitor, responsavel, registrador */
  signatario_role: string

  /** Email do signatário */
  signatario_email?: string

  /** Timestamp da assinatura (ISO 8601) */
  timestamp: string

  /** Serviço de assinatura utilizado */
  servico_assinatura?: string

  /** Hash do documento assinado */
  documento_hash?: string

  /** Status resultante: sucesso, falha, pendente */
  status_resultado: 'sucesso' | 'falha' | 'pendente'

  /** Erro/mensagem (se falha) */
  mensagem_erro?: string
}

/**
 * Contexto de auditoria para exportação
 * @interface AuditExportacaoDetalhes
 */
export interface AuditExportacaoDetalhes {
  /** Formato de exportação: PDF, ZIP, CSV, JSON */
  tipo: 'PDF' | 'ZIP' | 'CSV' | 'JSON'

  /** Quantidade de registros exportados */
  registros: number

  /** Filtros aplicados na exportação */
  filtros?: Record<string, unknown>

  /** Tamanho do arquivo em bytes */
  tamanho_bytes?: number

  /** Motivo/justificativa da exportação */
  motivo?: string
}
