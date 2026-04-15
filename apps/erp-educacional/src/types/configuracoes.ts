// =============================================================================
// Types — Módulo Configurações
// ERP Educacional FIC
// =============================================================================

// ===================== ENUMS =====================

export type TipoPapel = 'sistema' | 'custom'

export type AcaoPermissao = 'acessar' | 'inserir' | 'alterar' | 'remover' | 'especial'

export type TipoAnoLetivo = 'anual' | 'semestral' | 'trimestral'

export type StatusPeriodoLetivo = 'planejamento' | 'ativo' | 'encerrado' | 'suspenso'

export type TipoEventoCalendario =
  'feriado_nacional' | 'feriado_municipal' | 'recesso' |
  'periodo_matricula' | 'periodo_rematricula' | 'periodo_provas' |
  'inicio_aulas' | 'fim_aulas' | 'formatura' | 'evento_institucional' |
  'reuniao_pedagogica' | 'conselho_classe' | 'outro'

export type StatusTenant = 'ativo' | 'inativo' | 'trial' | 'suspenso' | 'cancelado'

export type PlanoTenant = 'free' | 'starter' | 'pro' | 'enterprise'

export type TipoParametro = 'texto' | 'numero' | 'booleano' | 'json' | 'data' | 'lista' | 'senha'

// ===================== RBAC =====================

export interface Papel {
  id: string
  tenant_id: string
  nome: string
  descricao: string | null
  tipo: TipoPapel
  cor: string | null
  icone: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface ModuloSistema {
  id: string
  slug: string
  nome: string
  descricao: string | null
  icone: string | null
  ordem: number
  ativo: boolean
  /** null = módulo raiz (ex: "diploma"); UUID = funcionalidade filha (ex: "diploma_processos") */
  parent_id: string | null
  /** true = visível apenas para Administradores da Instituição */
  beta: boolean
  /** Rota Next.js da funcionalidade (ex: /diploma/processos) */
  rota: string | null
  created_at: string
}

/** Módulo raiz com suas funcionalidades (sub-itens de menu) aninhadas */
export interface ModuloComFuncionalidades extends ModuloSistema {
  funcionalidades: ModuloSistema[]
}

export interface Permissao {
  id: string
  modulo_id: string
  acao: AcaoPermissao
  descricao: string | null
  created_at: string
  // Relação
  modulo?: ModuloSistema
}

export interface PapelPermissao {
  id: string
  papel_id: string
  permissao_id: string
  created_at: string
  // Relações
  permissao?: Permissao
}

export interface UsuarioPapel {
  id: string
  user_id: string
  papel_id: string
  tenant_id: string
  atribuido_por: string | null
  data_inicio: string
  data_fim: string | null
  created_at: string
  // Relações
  papel?: Papel
}

export interface PapelComPermissoes extends Papel {
  permissoes: Permissao[]
  total_usuarios: number
}

// Mapa de permissões para UI (módulo → ações)
export interface MapaPermissoes {
  [moduloSlug: string]: {
    modulo: ModuloSistema
    acoes: {
      [acao in AcaoPermissao]?: {
        permissao_id: string
        habilitado: boolean
      }
    }
  }
}

// ===================== TENANT / MULTI-TENANCY =====================

export interface TenantConfig {
  slug: string | null
  logo_url: string | null
  plano: PlanoTenant
  status_tenant: StatusTenant
  config_tenant: Record<string, unknown>
  limites: Record<string, number>
  trial_inicio: string | null
  trial_fim: string | null
  dominio_customizado: string | null
  cores_tema: Record<string, string>
}

// ===================== ANOS LETIVOS =====================

export interface AnoLetivo {
  id: string
  tenant_id: string
  ano: number
  tipo: TipoAnoLetivo
  descricao: string | null
  data_inicio: string
  data_fim: string
  status: StatusPeriodoLetivo
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface AnoLetivoComPeriodos extends AnoLetivo {
  periodos: PeriodoLetivo[]
}

export interface PeriodoLetivo {
  id: string
  ano_letivo_id: string
  tenant_id: string
  numero: number
  nome: string
  data_inicio: string
  data_fim: string
  status: StatusPeriodoLetivo
  created_at: string
  updated_at: string
}

// ===================== CALENDÁRIO ACADÊMICO =====================

export interface CalendarioAcademico {
  id: string
  tenant_id: string
  periodo_letivo_id: string | null
  ano_letivo_id: string | null
  tipo: TipoEventoCalendario
  titulo: string
  descricao: string | null
  data_inicio: string
  data_fim: string
  dia_inteiro: boolean
  hora_inicio: string | null
  hora_fim: string | null
  cor: string
  recorrente: boolean
  visivel_portal: boolean
  created_at: string
  updated_at: string
}

// ===================== PARÂMETROS DO SISTEMA =====================

export interface ParametroSistema {
  id: string
  tenant_id: string
  chave: string
  valor: string | null
  tipo: TipoParametro
  modulo: string
  descricao: string | null
  editavel: boolean
  created_at: string
  updated_at: string
}

export interface ConfigModulo {
  id: string
  tenant_id: string
  modulo_id: string
  configuracoes: Record<string, unknown>
  ativo: boolean
  created_at: string
  updated_at: string
  // Relação
  modulo?: ModuloSistema
}

// ===================== AUDIT =====================

export interface ConfigAlteracao {
  id: string
  tenant_id: string
  tabela: string
  registro_id: string
  acao: string
  valor_anterior: Record<string, unknown> | null
  valor_novo: Record<string, unknown> | null
  usuario_id: string | null
  created_at: string
}

// ===================== PERMISSÕES DIRETAS POR PESSOA =====================

export type TipoOverridePermissao = 'allow' | 'deny'

export interface UsuarioPermissaoDireta {
  id: string
  user_id: string
  permissao_id: string
  tenant_id: string
  tipo: TipoOverridePermissao
  motivo: string | null
  atribuido_por: string | null
  data_inicio: string
  data_fim: string | null
  ativo: boolean
  created_at: string
  updated_at: string
  // Relações opcionais
  permissao?: Permissao
}

export interface UsuarioPermissaoDiretaCreateInput {
  user_id: string
  permissao_id: string
  tipo: TipoOverridePermissao
  motivo?: string
  data_fim?: string
}

// ===================== FORMS =====================

export interface PapelCreateInput {
  nome: string
  descricao?: string
  tipo?: TipoPapel
  cor?: string
  icone?: string
  permissao_ids?: string[]
}

export interface AnoLetivoCreateInput {
  ano: number
  tipo: TipoAnoLetivo
  descricao?: string
  data_inicio: string
  data_fim: string
}

export interface PeriodoLetivoCreateInput {
  ano_letivo_id: string
  numero: number
  nome: string
  data_inicio: string
  data_fim: string
}

export interface EventoCalendarioCreateInput {
  periodo_letivo_id?: string
  ano_letivo_id?: string
  tipo: TipoEventoCalendario
  titulo: string
  descricao?: string
  data_inicio: string
  data_fim: string
  dia_inteiro?: boolean
  hora_inicio?: string
  hora_fim?: string
  cor?: string
  visivel_portal?: boolean
}

export interface ParametroCreateInput {
  chave: string
  valor: string
  tipo: TipoParametro
  modulo: string
  descricao?: string
}
