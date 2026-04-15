'use client'

import { Plus, Trash2, Bold } from 'lucide-react'
import type { HistoricoFormatacaoRegra } from '@/types/diploma-config'

interface ConditionalFormattingProps {
  regras: HistoricoFormatacaoRegra[]
  onChange: (regras: HistoricoFormatacaoRegra[]) => void
}

const CAMPOS_DISPONIVEIS = [
  { value: 'nota', label: 'Nota (0-10)' },
  { value: 'nota_ate_cem', label: 'Nota (0-100)' },
  { value: 'situacao', label: 'Situação Final' },
  { value: 'forma_integralizacao', label: 'Forma Integr.' },
  { value: 'conceito', label: 'Conceito' },
  { value: 'conceito_especifico', label: 'Conc. Específico' },
]

const OPERADORES = [
  { value: '=', label: '=' },
  { value: '!=', label: '≠' },
  { value: '<', label: '<' },
  { value: '>', label: '>' },
  { value: '<=', label: '≤' },
  { value: '>=', label: '≥' },
  { value: 'contem', label: '∋' },
]

// Totalmente controlado: sem estado interno para os dados
export default function ConditionalFormatting({ regras, onChange }: ConditionalFormattingProps) {
  const handleAdd = () => {
    onChange([...regras, {
      id: `regra_${Date.now()}`,
      campo: 'nota',
      operador: '<',
      valor: '5',
      cor_texto: '#DC2626',
      cor_fundo: '#FEF2F2',
      negrito: false,
      ativo: true,
    }])
  }

  const handleDelete = (id: string) => onChange(regras.filter(r => r.id !== id))

  const handleUpdate = (id: string, updates: Partial<HistoricoFormatacaoRegra>) => {
    onChange(regras.map(r => r.id === id ? { ...r, ...updates } : r))
  }

  return (
    <div className="space-y-3">
      {regras.length === 0 && (
        <p className="text-sm text-gray-400 italic">Nenhuma regra de formatação configurada.</p>
      )}

      {regras.map(regra => (
        <div
          key={regra.id}
          className={`rounded-lg border p-4 transition-all ${
            regra.ativo ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
          }`}
        >
          {/* Condition row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Toggle */}
            <input
              type="checkbox"
              checked={regra.ativo}
              onChange={e => handleUpdate(regra.id, { ativo: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
            />

            {/* Condition builder - inline */}
            <span className="text-xs text-gray-500">Se</span>
            <select
              value={regra.campo}
              onChange={e => handleUpdate(regra.id, { campo: e.target.value })}
              className="px-2 py-1.5 rounded-md border border-gray-200 text-xs focus:ring-1 focus:ring-violet-500 focus:border-violet-400"
            >
              {CAMPOS_DISPONIVEIS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>

            <select
              value={regra.operador}
              onChange={e => handleUpdate(regra.id, { operador: e.target.value as HistoricoFormatacaoRegra['operador'] })}
              className="px-2 py-1.5 rounded-md border border-gray-200 text-xs w-14 text-center focus:ring-1 focus:ring-violet-500"
            >
              {OPERADORES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <input
              type="text"
              value={regra.valor}
              onChange={e => handleUpdate(regra.id, { valor: e.target.value })}
              placeholder="valor"
              className="px-2 py-1.5 rounded-md border border-gray-200 text-xs w-24 focus:ring-1 focus:ring-violet-500"
            />

            <span className="text-xs text-gray-400 mx-1">→</span>

            {/* Formatting */}
            <input
              type="color"
              value={regra.cor_texto}
              onChange={e => handleUpdate(regra.id, { cor_texto: e.target.value })}
              className="w-7 h-7 rounded border border-gray-200 cursor-pointer"
              title="Cor do texto"
            />
            <input
              type="color"
              value={regra.cor_fundo}
              onChange={e => handleUpdate(regra.id, { cor_fundo: e.target.value })}
              className="w-7 h-7 rounded border border-gray-200 cursor-pointer"
              title="Cor de fundo"
            />

            <button
              onClick={() => handleUpdate(regra.id, { negrito: !regra.negrito })}
              className={`w-7 h-7 rounded border flex items-center justify-center text-xs transition-colors ${
                regra.negrito
                  ? 'border-violet-400 bg-violet-50 text-violet-700'
                  : 'border-gray-200 text-gray-400 hover:border-gray-300'
              }`}
              title="Negrito"
            >
              <Bold size={12} />
            </button>

            {/* Preview chip */}
            <span
              className="text-xs px-2 py-1 rounded ml-1"
              style={{
                color: regra.cor_texto,
                backgroundColor: regra.cor_fundo,
                fontWeight: regra.negrito ? 'bold' : 'normal',
              }}
            >
              3.50
            </span>

            {/* Delete */}
            <button
              onClick={() => handleDelete(regra.id)}
              className="ml-auto p-1 text-gray-300 hover:text-red-500 rounded transition-colors"
              title="Remover"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}

      {/* Add button */}
      <button
        onClick={handleAdd}
        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-500 hover:text-violet-600 border border-dashed border-gray-300 hover:border-violet-300 rounded-lg transition-colors w-full justify-center"
      >
        <Plus size={14} />
        Adicionar regra
      </button>
    </div>
  )
}
