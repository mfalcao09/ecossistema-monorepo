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
  HistoricoColunaConfig,
  CAMPOS_DISCIPLINA_DISPONIVEIS,
  CAMPOS_OBRIGATORIOS_MEC,
  CAMPOS_OBRIGATORIOS_MEC_GRUPOS,
} from '@/types/diploma-config'

interface ColumnConfiguratorProps {
  colunas?: HistoricoColunaConfig[]
  onChange: (colunas: HistoricoColunaConfig[]) => void
}

const DEFAULT_COLUMNS: HistoricoColunaConfig[] = [
  { campo: 'codigo', label: 'Código', visivel: true, ordem: 1, largura: 8 },
  { campo: 'nome', label: 'Disciplina', visivel: true, ordem: 2, largura: 30 },
  { campo: 'carga_horaria_aula', label: 'C.H.', visivel: true, ordem: 3, largura: 8 },
  { campo: 'nota', label: 'Média', visivel: true, ordem: 4, largura: 8 },
  { campo: 'periodo', label: 'P/Letivo', visivel: true, ordem: 5, largura: 8 },
  { campo: 'situacao', label: 'Sit. Fin.', visivel: true, ordem: 6, largura: 10 },
]

export default function ColumnConfigurator({
  colunas = DEFAULT_COLUMNS,
  onChange,
}: ColumnConfiguratorProps) {
  // Apenas estado de UI — dados vêm sempre do pai (totalmente controlado)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [expandedCol, setExpandedCol] = useState<string | null>(null)

  const sortedColumns = [...colunas].sort((a, b) => a.ordem - b.ordem)
  const visibleCount = colunas.filter(c => c.visivel).length
  const totalWidth = colunas.filter(c => c.visivel).reduce((sum, col) => sum + col.largura, 0)

  const getFieldInfo = (campo: string) => CAMPOS_DISCIPLINA_DISPONIVEIS.find(f => f.campo === campo)
  const isObrigatorio = (campo: string) =>
    CAMPOS_OBRIGATORIOS_MEC.includes(campo) ||
    CAMPOS_OBRIGATORIOS_MEC_GRUPOS.some(g => g.campos.includes(campo))
  const isNomeField = (campo: string) => campo === 'nome'

  const handleToggleVisibility = (campo: string) => {
    if (isNomeField(campo)) return
    onChange(colunas.map(col => col.campo === campo ? { ...col, visivel: !col.visivel } : col))
  }

  const handleSaveLabel = (campo: string) => {
    onChange(colunas.map(col => col.campo === campo ? { ...col, label: editLabel } : col))
    setEditingId(null)
  }

  const handleWidthChange = (campo: string, newWidth: number) => {
    onChange(colunas.map(col => col.campo === campo ? { ...col, largura: newWidth } : col))
  }

  const handleMove = (campo: string, direction: 'up' | 'down') => {
    const idx = sortedColumns.findIndex(col => col.campo === campo)
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= sortedColumns.length) return

    const currentOrdem = sortedColumns[idx].ordem
    const targetOrdem = sortedColumns[targetIdx].ordem
    onChange(colunas.map(col => {
      if (col.campo === campo) return { ...col, ordem: targetOrdem }
      if (col.campo === sortedColumns[targetIdx].campo) return { ...col, ordem: currentOrdem }
      return col
    }))
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          <span className="font-semibold text-gray-700">{visibleCount}</span> colunas visíveis
          {' · '}
          Largura total: <span className={`font-semibold ${Math.abs(totalWidth - 100) > 5 ? 'text-amber-600' : 'text-emerald-600'}`}>{totalWidth}%</span>
        </p>
        <button
          onClick={() => onChange(DEFAULT_COLUMNS)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <RotateCcw size={12} />
          Restaurar padrão
        </button>
      </div>

      {/* Column list */}
      <div className="space-y-1.5">
        {sortedColumns.map((col, idx) => {
          const fieldInfo = getFieldInfo(col.campo)
          const isMec = isObrigatorio(col.campo)
          const isNome = isNomeField(col.campo)
          const isEditing = editingId === col.campo
          const isExpanded = expandedCol === col.campo

          return (
            <div
              key={col.campo}
              className={`rounded-lg border transition-all ${
                col.visivel
                  ? 'border-gray-200 bg-white'
                  : 'border-gray-100 bg-gray-50/50'
              }`}
            >
              {/* Main row — compact */}
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
                    onClick={() => handleToggleVisibility(col.campo)}
                    className={`flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0 transition-colors ${
                      col.visivel
                        ? 'bg-violet-100 text-violet-600 hover:bg-violet-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                    title={col.visivel ? 'Ocultar' : 'Mostrar'}
                  >
                    {col.visivel ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                )}

                {/* Label (editable) */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      onBlur={() => handleSaveLabel(col.campo)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveLabel(col.campo)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      autoFocus
                      className="w-full px-2 py-1 text-sm rounded border border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  ) : (
                    <button
                      onClick={() => { setEditingId(col.campo); setEditLabel(col.label) }}
                      className={`flex items-center gap-1.5 text-sm truncate ${
                        col.visivel ? 'text-gray-900 font-medium' : 'text-gray-400'
                      }`}
                    >
                      <span className="truncate">{col.label}</span>
                      <Pencil size={10} className="text-gray-300 flex-shrink-0" />
                    </button>
                  )}
                </div>

                {/* MEC badge */}
                {isMec && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-blue-600 flex-shrink-0">
                    <Shield size={9} />MEC
                  </span>
                )}

                {/* Width display + expand toggle */}
                <button
                  onClick={() => setExpandedCol(isExpanded ? null : col.campo)}
                  className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-50 flex-shrink-0"
                >
                  {col.largura}%
                </button>

                {/* Move buttons */}
                <div className="flex gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => handleMove(col.campo, 'up')}
                    disabled={idx === 0}
                    className="p-1 rounded text-gray-300 hover:text-gray-500 disabled:opacity-30"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => handleMove(col.campo, 'down')}
                    disabled={idx === sortedColumns.length - 1}
                    className="p-1 rounded text-gray-300 hover:text-gray-500 disabled:opacity-30"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>

              {/* Expanded: width slider + field info */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-gray-100 ml-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs text-gray-500 w-14">Largura</span>
                    <input
                      type="range"
                      min="5"
                      max="40"
                      value={col.largura}
                      onChange={e => handleWidthChange(col.campo, parseInt(e.target.value, 10))}
                      className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-violet-500"
                    />
                    <span className="text-xs font-semibold text-violet-600 w-10 text-right">{col.largura}%</span>
                  </div>
                  {fieldInfo && (
                    <p className="text-[11px] text-gray-400 mt-1">
                      <span className="font-mono text-gray-500">{col.campo}</span> — {fieldInfo.descricao}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
