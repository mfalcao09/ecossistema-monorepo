'use client'

import { useState } from 'react'
import { HistoricoSecoesConfig, CAMPOS_DISCIPLINA_DISPONIVEIS } from '@/types/diploma-config'
import { Calendar, Layers, GitBranch, List, Settings, Plus, Trash2, X } from 'lucide-react'

interface SectionBuilderProps {
  config: HistoricoSecoesConfig
  onChange: (config: HistoricoSecoesConfig) => void
}

const GROUPING_OPTIONS: Array<{
  value: HistoricoSecoesConfig['agrupar_por']
  label: string
  icon: any
  desc: string
}> = [
  { value: 'periodo', label: 'Por Período', icon: Calendar, desc: 'Agrupa por semestre/período' },
  { value: 'etiqueta', label: 'Por Eixo Temático', icon: Layers, desc: 'Agrupa por tags/observações' },
  { value: 'forma_integralizacao', label: 'Forma de Integr.', icon: GitBranch, desc: 'Cursado, Aproveitamento, etc.' },
  { value: 'nenhum', label: 'Sem Agrupamento', icon: List, desc: 'Lista única corrida' },
  { value: 'personalizado', label: 'Personalizado', icon: Settings, desc: 'Seções com filtros customizados' },
]

const SEPARATOR_OPTIONS = [
  { value: 'linha' as const, label: 'Linha' },
  { value: 'destaque' as const, label: 'Destaque' },
  { value: 'espaco' as const, label: 'Espaço' },
  { value: 'nenhum' as const, label: 'Nenhum' },
]

export default function SectionBuilder({ config, onChange }: SectionBuilderProps) {
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customForm, setCustomForm] = useState({ nome: '', filtro_campo: '', filtro_valor: '' })

  const handleGroupingChange = (v: HistoricoSecoesConfig['agrupar_por']) => {
    onChange({
      ...config,
      agrupar_por: v,
      secoes_personalizadas: v === 'personalizado' ? config.secoes_personalizadas : [],
    })
    if (v !== 'personalizado') setShowCustomForm(false)
  }

  const handleAddCustom = () => {
    if (!customForm.nome.trim() || !customForm.filtro_campo || !customForm.filtro_valor.trim()) return
    onChange({
      ...config,
      secoes_personalizadas: [...(config.secoes_personalizadas || []), { ...customForm }],
    })
    setCustomForm({ nome: '', filtro_campo: '', filtro_valor: '' })
    setShowCustomForm(false)
  }

  return (
    <div className="space-y-6">
      {/* Grouping options — grid de cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {GROUPING_OPTIONS.map(opt => {
          const isActive = config.agrupar_por === opt.value
          const Icon = opt.icon
          return (
            <button
              key={opt.value}
              onClick={() => handleGroupingChange(opt.value)}
              className={`relative p-3 rounded-xl border-2 text-left transition-all focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1 ${
                isActive
                  ? 'border-violet-500 bg-violet-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-violet-300'
              }`}
            >
              <Icon size={18} className={`mb-2 ${isActive ? 'text-violet-600' : 'text-gray-400'}`} />
              <p className={`text-xs font-semibold ${isActive ? 'text-violet-900' : 'text-gray-700'}`}>{opt.label}</p>
              <p className={`text-[10px] mt-0.5 ${isActive ? 'text-violet-600' : 'text-gray-400'}`}>{opt.desc}</p>
            </button>
          )
        })}
      </div>

      {/* Options when grouping is active */}
      {config.agrupar_por !== 'nenhum' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Header format */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Formato do cabeçalho</label>
            <input
              type="text"
              value={config.formato_cabecalho_grupo || ''}
              onChange={e => onChange({ ...config, formato_cabecalho_grupo: e.target.value })}
              placeholder="{numero}º Período"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-violet-500 focus:border-violet-400"
            />
            <p className="text-[10px] text-gray-400 mt-1">Use {'{numero}'} ou {'{etiqueta}'} como variáveis</p>
          </div>

          {/* Separator + subtotal */}
          <div className="space-y-3">
            {/* Subtotal toggle */}
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600">Subtotal C.H. por seção</label>
              <button
                onClick={() => onChange({ ...config, exibir_subtotal_ch: !config.exibir_subtotal_ch })}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  config.exibir_subtotal_ch ? 'bg-violet-500' : 'bg-gray-300'
                }`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
                  config.exibir_subtotal_ch ? 'left-5' : 'left-0.5'
                }`} />
              </button>
            </div>

            {/* Separator */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Separador visual</label>
              <div className="flex gap-1.5">
                {SEPARATOR_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => onChange({ ...config, separador_visual: opt.value })}
                    className={`flex-1 px-2 py-1.5 text-xs rounded-lg transition-colors ${
                      config.separador_visual === opt.value
                        ? 'bg-violet-500 text-white font-medium'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom sections */}
      {config.agrupar_por === 'personalizado' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-blue-800">Seções Personalizadas</p>

          {config.secoes_personalizadas?.map((sec, i) => (
            <div key={i} className="flex items-center gap-2 bg-white rounded-lg p-2.5 border border-blue-100">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{sec.nome}</p>
                <p className="text-[10px] text-gray-500">
                  <span className="font-mono">{sec.filtro_campo}</span> = &quot;{sec.filtro_valor}&quot;
                </p>
              </div>
              <button
                onClick={() => onChange({ ...config, secoes_personalizadas: config.secoes_personalizadas.filter((_, idx) => idx !== i) })}
                className="p-1 text-gray-400 hover:text-red-500 rounded"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {showCustomForm ? (
            <div className="bg-white rounded-lg p-3 border border-blue-200 space-y-2">
              <input
                type="text"
                value={customForm.nome}
                onChange={e => setCustomForm({ ...customForm, nome: e.target.value })}
                placeholder="Nome da seção"
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <select
                  value={customForm.filtro_campo}
                  onChange={e => setCustomForm({ ...customForm, filtro_campo: e.target.value })}
                  className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Campo...</option>
                  {CAMPOS_DISCIPLINA_DISPONIVEIS.map(c => <option key={c.campo} value={c.campo}>{c.label}</option>)}
                </select>
                <input
                  type="text"
                  value={customForm.filtro_valor}
                  onChange={e => setCustomForm({ ...customForm, filtro_valor: e.target.value })}
                  placeholder="Valor"
                  className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddCustom} className="flex-1 bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-blue-600 disabled:bg-gray-300" disabled={!customForm.nome || !customForm.filtro_campo || !customForm.filtro_valor}>
                  <Plus size={12} className="inline mr-1" />Adicionar
                </button>
                <button onClick={() => { setShowCustomForm(false); setCustomForm({ nome: '', filtro_campo: '', filtro_valor: '' }) }} className="flex-1 bg-gray-100 text-gray-600 px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-200">
                  <X size={12} className="inline mr-1" />Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowCustomForm(true)} className="flex items-center justify-center gap-1.5 w-full px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200 transition-colors">
              <Plus size={14} />
              Adicionar Seção
            </button>
          )}
        </div>
      )}
    </div>
  )
}
