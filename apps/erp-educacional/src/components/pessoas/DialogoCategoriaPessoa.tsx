'use client'

/**
 * DialogoCategoriaPessoa — Modal de seleção de categorias ao criar nova pessoa
 * ERP Educacional FIC
 *
 * Exibe checkboxes para selecionar uma ou mais categorias (Aluno, Professor, Colaborador).
 * Mínimo 1 categoria obrigatória. Ao confirmar, redireciona para /pessoas/novo?categorias=X,Y
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, ArrowRight, GraduationCap, BookOpen, Briefcase, ClipboardList, UserCircle, Wrench } from 'lucide-react'
import type { TipoVinculo } from '@/types/pessoas'
import { getCategoriasVisiveis, type CategoriaConfig } from '@/lib/pessoas/categoria-config'

// Mapa de ícones
const ICONE_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  GraduationCap,
  BookOpen,
  Briefcase,
  ClipboardList,
  UserCircle,
  Wrench,
}

interface DialogoCategoriaPessoaProps {
  aberto: boolean
  onFechar: () => void
}

export function DialogoCategoriaPessoa({ aberto, onFechar }: DialogoCategoriaPessoaProps) {
  const router = useRouter()
  const [selecionadas, setSelecionadas] = useState<TipoVinculo[]>([])
  const categoriasVisiveis = getCategoriasVisiveis()

  if (!aberto) return null

  const toggleCategoria = (tipo: TipoVinculo) => {
    setSelecionadas(prev =>
      prev.includes(tipo)
        ? prev.filter(t => t !== tipo)
        : [...prev, tipo]
    )
  }

  const handleContinuar = () => {
    if (selecionadas.length === 0) return
    const params = selecionadas.join(',')
    router.push(`/pessoas/novo?categorias=${params}`)
    onFechar()
    setSelecionadas([])
  }

  const handleFechar = () => {
    onFechar()
    setSelecionadas([])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleFechar}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Selecione as Categorias
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Escolha uma ou mais categorias para esta pessoa. Isso define quais
              documentos e acessos serão configurados.
            </p>
          </div>
          <button
            onClick={handleFechar}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Categorias */}
        <div className="px-6 py-4 space-y-3">
          {categoriasVisiveis.map((cat) => {
            const Icone = ICONE_MAP[cat.icone] || UserCircle
            const selecionada = selecionadas.includes(cat.tipo)

            return (
              <button
                key={cat.tipo}
                type="button"
                onClick={() => toggleCategoria(cat.tipo)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-150 text-left ${
                  selecionada
                    ? `${cat.cor.border} ${cat.cor.bgLight} ring-1 ring-offset-1`
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                style={selecionada ? { '--tw-ring-color': cat.cor.hex } as React.CSSProperties : undefined}
              >
                {/* Checkbox custom */}
                <div
                  className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    selecionada
                      ? 'bg-current border-current'
                      : 'border-gray-300'
                  }`}
                  style={selecionada ? { color: cat.cor.hex } : undefined}
                >
                  {selecionada && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </div>

                {/* Ícone */}
                <div
                  className={`flex-shrink-0 p-2 rounded-lg ${cat.cor.bgLight}`}
                >
                  <Icone className={`w-5 h-5 ${cat.cor.text}`} />
                </div>

                {/* Texto */}
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold ${selecionada ? cat.cor.text : 'text-gray-900'}`}>
                    {cat.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {cat.descricao}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {selecionadas.length === 0
              ? 'Selecione ao menos 1 categoria'
              : `${selecionadas.length} categoria${selecionadas.length > 1 ? 's' : ''} selecionada${selecionadas.length > 1 ? 's' : ''}`
            }
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFechar}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleContinuar}
              disabled={selecionadas.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continuar
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
