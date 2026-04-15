'use client'

import { CheckCircle2 } from 'lucide-react'
import { HistoricoTemplate, HistoricoColunaConfig } from '@/types/diploma-config'

interface TemplateSelectorProps {
  templates: HistoricoTemplate[]
  selectedSlug: string | null
  onSelect: (template: HistoricoTemplate) => void
}

export default function TemplateSelector({ templates, selectedSlug, onSelect }: TemplateSelectorProps) {
  if (templates.length === 0) {
    return null // Fallback é renderizado pelo componente pai
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map(template => {
        const isSelected = template.slug === selectedSlug
        const activeCols = template.colunas_config
          ? template.colunas_config.filter((c: HistoricoColunaConfig) => c.visivel).length
          : 0
        const colNames = template.colunas_config
          ? template.colunas_config
              .filter((c: HistoricoColunaConfig) => c.visivel)
              .slice(0, 4)
              .map(c => c.label)
          : []

        return (
          <button
            key={template.slug}
            onClick={() => onSelect(template)}
            className={`relative text-left p-5 rounded-xl border-2 transition-all group focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 ${
              isSelected
                ? 'border-violet-500 bg-violet-50/80 shadow-lg shadow-violet-100'
                : 'border-gray-200 bg-white hover:border-violet-300 hover:shadow-md'
            }`}
          >
            {/* Check indicator */}
            {isSelected && (
              <div className="absolute top-3 right-3">
                <CheckCircle2 size={20} className="text-violet-600" />
              </div>
            )}

            {/* Icon */}
            <span className="text-3xl block mb-3">{template.icone}</span>

            {/* Name */}
            <h4 className={`text-sm font-bold mb-1 ${
              isSelected ? 'text-violet-900' : 'text-gray-900'
            }`}>
              {template.nome}
            </h4>

            {/* Description */}
            {template.descricao && (
              <p className="text-xs text-gray-500 mb-3 line-clamp-2">{template.descricao}</p>
            )}

            {/* Area badge */}
            {template.area_conhecimento && (
              <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mb-3 ${
                isSelected
                  ? 'bg-violet-200 text-violet-800'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {template.area_conhecimento}
              </span>
            )}

            {/* Column chips */}
            {colNames.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-auto pt-3 border-t border-gray-100">
                {colNames.map((name, i) => (
                  <span
                    key={i}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      isSelected
                        ? 'bg-violet-100 text-violet-700'
                        : 'bg-gray-50 text-gray-500'
                    }`}
                  >
                    {name}
                  </span>
                ))}
                {activeCols > 4 && (
                  <span className="text-[10px] text-gray-400">+{activeCols - 4}</span>
                )}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
