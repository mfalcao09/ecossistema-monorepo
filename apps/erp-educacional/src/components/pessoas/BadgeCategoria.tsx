'use client'

/**
 * BadgeCategoria — Badge reutilizável para exibir categoria de pessoa
 * ERP Educacional FIC
 *
 * Exibe uma badge colorida com ícone e label da categoria.
 * Usado na lista de pessoas, no header do cadastro e na edição.
 */

import { GraduationCap, BookOpen, Briefcase, ClipboardList, UserCircle, Wrench } from 'lucide-react'
import type { TipoVinculo } from '@/types/pessoas'
import { CATEGORIAS_CONFIG, type CategoriaConfig } from '@/lib/pessoas/categoria-config'

// Mapa de ícones Lucide por nome
const ICONE_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  GraduationCap,
  BookOpen,
  Briefcase,
  ClipboardList,
  UserCircle,
  Wrench,
}

interface BadgeCategoriaProps {
  tipo: TipoVinculo
  /** Tamanho: sm (lista), md (header), lg (diálogo) */
  tamanho?: 'sm' | 'md' | 'lg'
  /** Se true, exibe botão X para remover */
  removivel?: boolean
  /** Callback ao clicar em remover */
  onRemover?: (tipo: TipoVinculo) => void
  /** Classes adicionais */
  className?: string
}

export function BadgeCategoria({
  tipo,
  tamanho = 'sm',
  removivel = false,
  onRemover,
  className = '',
}: BadgeCategoriaProps) {
  const config = CATEGORIAS_CONFIG[tipo]
  if (!config) return null

  const Icone = ICONE_MAP[config.icone] || UserCircle

  const tamanhoClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-sm gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2',
  }

  const iconeClasses = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.cor.bg} ${config.cor.text} ${tamanhoClasses[tamanho]} ${className}`}
    >
      <Icone className={iconeClasses[tamanho]} />
      {config.label}
      {removivel && onRemover && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemover(tipo)
          }}
          className={`ml-0.5 rounded-full hover:bg-black/10 transition-colors ${
            tamanho === 'sm' ? 'p-0.5' : 'p-1'
          }`}
          title={`Remover ${config.label}`}
        >
          <svg className={iconeClasses[tamanho]} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  )
}

/** Exibe múltiplas badges lado a lado */
export function BadgesCategorias({
  tipos,
  tamanho = 'sm',
  removivel = false,
  onRemover,
  className = '',
}: {
  tipos: TipoVinculo[]
  tamanho?: 'sm' | 'md' | 'lg'
  removivel?: boolean
  onRemover?: (tipo: TipoVinculo) => void
  className?: string
}) {
  if (!tipos.length) return null

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {tipos.map(tipo => (
        <BadgeCategoria
          key={tipo}
          tipo={tipo}
          tamanho={tamanho}
          removivel={removivel}
          onRemover={onRemover}
        />
      ))}
    </div>
  )
}
