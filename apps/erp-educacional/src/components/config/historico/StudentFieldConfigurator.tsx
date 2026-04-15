'use client'

import { useState } from 'react'
import {
  Lock,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Eye,
  EyeOff,
  RotateCcw,
  Pencil,
  Shield,
} from 'lucide-react'
import {
  HistoricoCampoAlunoConfig,
  CAMPOS_ALUNO_DISPONIVEIS,
  CAMPOS_ALUNO_OBRIGATORIOS_MEC,
  DEFAULT_CAMPOS_ALUNO,
} from '@/types/diploma-config'

interface StudentFieldConfiguratorProps {
  campos?: HistoricoCampoAlunoConfig[]
  onChange: (campos: HistoricoCampoAlunoConfig[]) => void
}

export default function StudentFieldConfigurator({
  campos = DEFAULT_CAMPOS_ALUNO,
  onChange,
}: StudentFieldConfiguratorProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')

  const sortedCampos = [...campos].sort((a, b) => a.ordem - b.ordem)
  const visibleCount = campos.filter(c => c.visivel).length

  const getFieldInfo = (campo: string) => CAMPOS_ALUNO_DISPONIVEIS.find(f => f.campo === campo)
  const isObrigatorio = (campo: string) => CAMPOS_ALUNO_OBRIGATORIOS_MEC.includes(campo)
  const isNomeField = (campo: string) => campo === 'nome' // nome é sempre obrigatório e locked

  const handleToggleVisibility = (campo: string) => {
    if (isNomeField(campo)) return
    onChange(campos.map(c => c.campo === campo ? { ...c, visivel: !c.visivel } : c))
  }

  const handleSaveLabel = (campo: string) => {
    onChange(campos.map(c => c.campo === campo ? { ...c, label: editLabel } : c))
    setEditingId(null)
  }

  const handleMove = (campo: string, direction: 'up' | 'down') => {
    const idx = sortedCampos.findIndex(c => c.campo === campo)
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= sortedCampos.length) return

    const currentOrdem = sortedCampos[idx].ordem
    const targetOrdem = sortedCampos[targetIdx].ordem
    onChange(campos.map(c => {
      if (c.campo === campo) return { ...c, ordem: targetOrdem }
      if (c.campo === sortedCampos[targetIdx].campo) return { ...c, ordem: currentOrdem }
      return c
    }))
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          <span className="font-semibold text-gray-700">{visibleCount}</span> campos visíveis
          {' · '}
          Conteúdo preenchido na emissão
        </p>
        <button
          onClick={() => onChange(DEFAULT_CAMPOS_ALUNO)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <RotateCcw size={12} />
          Restaurar padrão
        </button>
      </div>

      {/* Field list */}
      <div className="space-y-1.5">
        {sortedCampos.map((campo, idx) => {
          const fieldInfo = getFieldInfo(campo.campo)
          const isMec = isObrigatorio(campo.campo)
          const isNome = isNomeField(campo.campo)
          const isEditing = editingId === campo.campo

          return (
            <div
              key={campo.campo}
              className={`rounded-lg border transition-all ${
                campo.visivel
                  ? 'border-gray-200 bg-white'
                  : 'border-gray-100 bg-gray-50/50'
              }`}
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                {/* Drag handle */}
                <GripVertical size={14} className="text-gray-300 flex-shrink-0 cursor-grab" />

                {/* Toggle */}
                {isNome ? (
                  <div className="flex items-center justify-center w-7 h-7 rounded-md bg-gray-100 flex-shrink-0" title="Obrigatório">
                    <Lock size={12} className="text-gray-500" />
                  </div>
                ) : (
                  <button
                    onClick={() => handleToggleVisibility(campo.campo)}
                    className={`flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0 transition-colors ${
                      campo.visivel
                        ? 'bg-violet-100 text-violet-600 hover:bg-violet-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                    title={campo.visivel ? 'Ocultar' : 'Mostrar'}
                  >
                    {campo.visivel ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                )}

                {/* Label (editable) */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      onBlur={() => handleSaveLabel(campo.campo)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveLabel(campo.campo)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      autoFocus
                      className="w-full px-2 py-1 text-sm rounded border border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  ) : (
                    <button
                      onClick={() => { setEditingId(campo.campo); setEditLabel(campo.label) }}
                      className={`flex items-center gap-1.5 text-sm truncate ${
                        campo.visivel ? 'text-gray-900 font-medium' : 'text-gray-400'
                      }`}
                    >
                      <span className="truncate">{campo.label}</span>
                      <Pencil size={10} className="text-gray-300 flex-shrink-0" />
                    </button>
                  )}
                </div>

                {/* Description */}
                {fieldInfo && (
                  <span className="hidden sm:block text-[11px] text-gray-400 flex-shrink-0 max-w-[200px] truncate">
                    {fieldInfo.descricao}
                  </span>
                )}

                {/* MEC badge */}
                {isMec && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-blue-600 flex-shrink-0">
                    <Shield size={9} />MEC
                  </span>
                )}

                {/* Move buttons */}
                <div className="flex gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => handleMove(campo.campo, 'up')}
                    disabled={idx === 0}
                    className="p-1 rounded text-gray-300 hover:text-gray-500 disabled:opacity-30"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => handleMove(campo.campo, 'down')}
                    disabled={idx === sortedCampos.length - 1}
                    className="p-1 rounded text-gray-300 hover:text-gray-500 disabled:opacity-30"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
