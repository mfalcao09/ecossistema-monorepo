'use client'

/**
 * SeletorCategorias — Edição inline de categorias de uma pessoa
 * ERP Educacional FIC
 *
 * Usado na página de detalhe para adicionar/remover categorias.
 * Mostra as badges atuais + botão para adicionar mais.
 */

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { TipoVinculo } from '@/types/pessoas'
import { getTodasCategorias, CATEGORIAS_CONFIG } from '@/lib/pessoas/categoria-config'
import { BadgeCategoria } from './BadgeCategoria'

interface SeletorCategoriasProps {
  /** Categorias atuais da pessoa */
  selecionadas: TipoVinculo[]
  /** Callback ao mudar categorias */
  onChange: (categorias: TipoVinculo[]) => void
  /** Se está em modo somente leitura */
  disabled?: boolean
}

export function SeletorCategorias({
  selecionadas,
  onChange,
  disabled = false,
}: SeletorCategoriasProps) {
  const [menuAberto, setMenuAberto] = useState(false)
  const todasCategorias = getTodasCategorias()

  const categoriasDisponiveis = todasCategorias.filter(
    cat => !selecionadas.includes(cat.tipo)
  )

  const handleAdicionar = (tipo: TipoVinculo) => {
    onChange([...selecionadas, tipo])
    setMenuAberto(false)
  }

  const handleRemover = (tipo: TipoVinculo) => {
    if (selecionadas.length <= 1) return // mínimo 1
    onChange(selecionadas.filter(t => t !== tipo))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {selecionadas.map(tipo => (
        <BadgeCategoria
          key={tipo}
          tipo={tipo}
          tamanho="md"
          removivel={!disabled && selecionadas.length > 1}
          onRemover={handleRemover}
        />
      ))}

      {!disabled && categoriasDisponiveis.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuAberto(!menuAberto)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Adicionar
          </button>

          {menuAberto && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuAberto(false)}
              />
              <div className="absolute left-0 top-full mt-1 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[180px]">
                {categoriasDisponiveis.map(cat => (
                  <button
                    key={cat.tipo}
                    type="button"
                    onClick={() => handleAdicionar(cat.tipo)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <span className={`w-2 h-2 rounded-full ${cat.cor.bg}`} />
                    {cat.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
