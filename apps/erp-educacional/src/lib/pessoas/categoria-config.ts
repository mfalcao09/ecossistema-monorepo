/**
 * Configuração de Categorias de Pessoas
 * ERP Educacional FIC
 *
 * Define cores, ícones, labels e configurações visuais
 * para cada tipo de vínculo (categoria) de pessoa.
 */

import type { TipoVinculo } from '@/types/pessoas'

// ── Configuração visual de cada categoria ──

export interface CategoriaConfig {
  tipo: TipoVinculo
  label: string
  labelPlural: string
  descricao: string
  icone: string          // nome do ícone Lucide
  cor: {
    bg: string           // bg do badge (Tailwind)
    text: string         // texto do badge (Tailwind)
    border: string       // borda (Tailwind)
    bgLight: string      // fundo claro para cards
    hex: string          // cor hex para uso programático
  }
  papelSugerido: string  // papel RBAC sugerido ao vincular acesso
  ordem: number          // ordem de exibição no diálogo
  visivel: boolean       // se aparece no diálogo de seleção
}

export const CATEGORIAS_CONFIG: Record<TipoVinculo, CategoriaConfig> = {
  aluno: {
    tipo: 'aluno',
    label: 'Aluno',
    labelPlural: 'Alunos',
    descricao: 'Matrícula, histórico, notas',
    icone: 'GraduationCap',
    cor: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      border: 'border-blue-200',
      bgLight: 'bg-blue-50',
      hex: '#1d4ed8',
    },
    papelSugerido: 'estudantes',
    ordem: 1,
    visivel: true,
  },
  professor: {
    tipo: 'professor',
    label: 'Professor',
    labelPlural: 'Professores',
    descricao: 'Docência, currículo, disciplinas',
    icone: 'BookOpen',
    cor: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      border: 'border-green-200',
      bgLight: 'bg-green-50',
      hex: '#15803d',
    },
    papelSugerido: 'coordenacao_curso',
    ordem: 2,
    visivel: true,
  },
  colaborador: {
    tipo: 'colaborador',
    label: 'Colaborador',
    labelPlural: 'Colaboradores',
    descricao: 'Administrativo, RH, financeiro',
    icone: 'Briefcase',
    cor: {
      bg: 'bg-orange-100',
      text: 'text-orange-700',
      border: 'border-orange-200',
      bgLight: 'bg-orange-50',
      hex: '#c2410c',
    },
    papelSugerido: 'aux_secretaria',
    ordem: 3,
    visivel: true,
  },
  candidato: {
    tipo: 'candidato',
    label: 'Candidato',
    labelPlural: 'Candidatos',
    descricao: 'Processo seletivo, vestibular',
    icone: 'ClipboardList',
    cor: {
      bg: 'bg-purple-100',
      text: 'text-purple-700',
      border: 'border-purple-200',
      bgLight: 'bg-purple-50',
      hex: '#7e22ce',
    },
    papelSugerido: 'candidato',
    ordem: 4,
    visivel: false, // candidato geralmente é fluxo separado
  },
  ex_aluno: {
    tipo: 'ex_aluno',
    label: 'Ex-Aluno',
    labelPlural: 'Ex-Alunos',
    descricao: 'Egresso, formado',
    icone: 'GraduationCap',
    cor: {
      bg: 'bg-gray-100',
      text: 'text-gray-600',
      border: 'border-gray-200',
      bgLight: 'bg-gray-50',
      hex: '#4b5563',
    },
    papelSugerido: 'egresso',
    ordem: 5,
    visivel: false,
  },
  visitante: {
    tipo: 'visitante',
    label: 'Visitante',
    labelPlural: 'Visitantes',
    descricao: 'Acesso temporário',
    icone: 'UserCircle',
    cor: {
      bg: 'bg-pink-100',
      text: 'text-pink-700',
      border: 'border-pink-200',
      bgLight: 'bg-pink-50',
      hex: '#be185d',
    },
    papelSugerido: 'visitante',
    ordem: 6,
    visivel: false,
  },
  prestador: {
    tipo: 'prestador',
    label: 'Prestador',
    labelPlural: 'Prestadores',
    descricao: 'Serviços terceirizados',
    icone: 'Wrench',
    cor: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-700',
      border: 'border-yellow-200',
      bgLight: 'bg-yellow-50',
      hex: '#a16207',
    },
    papelSugerido: 'prestador',
    ordem: 7,
    visivel: false,
  },
}

// ── Helpers ──

/** Retorna apenas as categorias visíveis no diálogo de seleção */
export function getCategoriasVisiveis(): CategoriaConfig[] {
  return Object.values(CATEGORIAS_CONFIG)
    .filter(c => c.visivel)
    .sort((a, b) => a.ordem - b.ordem)
}

/** Retorna todas as categorias ordenadas */
export function getTodasCategorias(): CategoriaConfig[] {
  return Object.values(CATEGORIAS_CONFIG)
    .sort((a, b) => a.ordem - b.ordem)
}

/** Retorna a config de uma categoria específica */
export function getCategoriaConfig(tipo: TipoVinculo): CategoriaConfig {
  return CATEGORIAS_CONFIG[tipo]
}

/** Converte array de tipos em labels separados por vírgula */
export function formatarCategorias(tipos: TipoVinculo[]): string {
  return tipos.map(t => CATEGORIAS_CONFIG[t].label).join(', ')
}

/** Verifica se uma pessoa tem pelo menos um vínculo ativo (para filtro de acesso) */
export function temVinculoAtivo(vinculos: Array<{ tipo: TipoVinculo; status: string }>): boolean {
  return vinculos.some(v => v.status === 'ativo')
}

/** Extrai tipos de vínculo únicos de um array de vínculos */
export function extrairCategorias(vinculos: Array<{ tipo: TipoVinculo; status: string }>): TipoVinculo[] {
  const tipos = vinculos
    .filter(v => v.status === 'ativo')
    .map(v => v.tipo)
  return [...new Set(tipos)]
}
