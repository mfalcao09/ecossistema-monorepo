'use client'
import { CheckCircle, Circle, Loader2, AlertCircle, FileText } from 'lucide-react'
import type { ItemChecklist } from '@/types/ia'
import { TIPO_DOCUMENTO_LABELS } from '@/types/ia'

interface DocumentChecklistProps {
  items: ItemChecklist[]
  compact?: boolean // compact mode for sidebar
}

export function DocumentChecklist({ items, compact = false }: DocumentChecklistProps) {
  const totalObrigatorios = items.filter((item) => item.obrigatorio).length
  const recebidosObrigatorios = items.filter((item) => item.obrigatorio && item.status === 'recebido').length

  const getStatusIcon = (status: string) => {
    const iconSize = compact ? 'w-4 h-4' : 'w-5 h-5'

    switch (status) {
      case 'pendente':
        return <Circle className={`${iconSize} text-gray-400`} />
      case 'recebido':
        return <CheckCircle className={`${iconSize} text-green-500`} />
      case 'processando':
        return <Loader2 className={`${iconSize} text-blue-500 animate-spin`} />
      case 'erro':
        return <AlertCircle className={`${iconSize} text-red-500`} />
      default:
        return <Circle className={`${iconSize} text-gray-400`} />
    }
  }

  const getLabel = (tipo: string): string => {
    return TIPO_DOCUMENTO_LABELS[tipo as keyof typeof TIPO_DOCUMENTO_LABELS] || tipo
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Documentos</h3>
        <div className="space-y-1">
          {items.map((item) => (
            <div key={item.tipo} className="flex items-center gap-2">
              {getStatusIcon(item.status)}
              <span className="text-xs text-gray-600 flex-1 truncate">{getLabel(item.tipo)}</span>
              {item.obrigatorio && <span className="text-xs font-medium text-red-600 px-1.5 py-0.5 bg-red-50 rounded">Obr.</span>}
            </div>
          ))}
        </div>

        {/* Counter */}
        <div className="pt-2 border-t border-gray-200 text-xs text-gray-600">
          <strong className="text-gray-900">{recebidosObrigatorios}</strong> de <strong>{totalObrigatorios}</strong> obrigatórios
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">Documentos Obrigatórios</h2>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.tipo} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
            {/* Status Icon */}
            <div className="flex-shrink-0">{getStatusIcon(item.status)}</div>

            {/* Label and Badge */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{getLabel(item.tipo)}</span>
                {item.obrigatorio ? (
                  <span className="text-xs font-medium text-red-600 px-2 py-0.5 bg-red-50 rounded">Obrigatório</span>
                ) : (
                  <span className="text-xs font-medium text-gray-500 px-2 py-0.5 bg-gray-100 rounded">Opcional</span>
                )}
              </div>
            </div>

            {/* Status Label */}
            <div className="text-xs text-gray-600 capitalize text-right">{item.status}</div>
          </div>
        ))}
      </div>

      {/* Counter */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm font-medium text-blue-900">
          <strong className="text-lg text-blue-600">{recebidosObrigatorios}</strong> de{' '}
          <strong className="text-lg text-blue-600">{totalObrigatorios}</strong> documentos obrigatórios
        </p>
      </div>
    </div>
  )
}
