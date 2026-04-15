'use client'

import { useState, useEffect } from 'react'
import { PenTool, GripVertical, CheckCircle2, AlertCircle, Plus } from 'lucide-react'
import type { DiplomaConfig } from '@/types/diploma-config'

interface Assinante {
  id: string
  nome: string
  cargo: string
  outro_cargo: string | null
  cpf: string
  ativo: boolean
  instituicao_id: string
}

const CARGO_LABELS: Record<string, string> = {
  reitor: 'Reitor(a)',
  reitor_exercicio: 'Reitor(a) em Exercício',
  responsavel_registro: 'Responsável pelo Registro',
  coordenador_curso: 'Coordenador(a) de Curso',
  subcoordenador_curso: 'Subcoordenador(a) de Curso',
  coordenador_exercicio: 'Coordenador(a) em Exercício',
  chefe_registro: 'Chefe do Registro',
  chefe_registro_exercicio: 'Chefe do Registro em Exercício',
  secretario_decano: 'Secretário(a)/Decano',
}

interface AbaAssinadoresProps {
  config: DiplomaConfig
  saving: boolean
  onSave: (updates: Partial<DiplomaConfig>) => Promise<boolean>
}

export default function AbaAssinadores({ config, saving, onSave }: AbaAssinadoresProps) {
  const [assinantes, setAssinantes] = useState<Assinante[]>([])
  const [loading, setLoading] = useState(true)
  const [ordemIds, setOrdemIds] = useState<string[]>(config.ordem_assinatura_padrao ?? [])
  const [saved, setSaved] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/assinantes')
      .then((r) => r.json())
      .then((data) => setAssinantes(data?.filter((a: Assinante) => a.ativo) ?? []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setOrdemIds(config.ordem_assinatura_padrao ?? [])
  }, [config])

  const toggleAssinante = (id: string) => {
    setOrdemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleDragStart = (idx: number) => setDragIdx(idx)
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    const novo = [...ordemIds]
    const [item] = novo.splice(dragIdx, 1)
    novo.splice(idx, 0, item)
    setOrdemIds(novo)
    setDragIdx(idx)
  }

  const handleSave = async () => {
    const ok = await onSave({ ordem_assinatura_padrao: ordemIds })
    if (ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  const assinantesOrdenados = ordemIds
    .map((id) => assinantes.find((a) => a.id === id))
    .filter(Boolean) as Assinante[]

  const assinantesSemOrdem = assinantes.filter((a) => !ordemIds.includes(a.id))

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center gap-2 mb-1">
          <PenTool size={18} className="text-primary-500" />
          <h3 className="font-semibold text-gray-800">Ordem de Assinatura Padrão</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4 ml-7">
          Selecione os assinantes e arraste para definir a ordem. Esta ordem será aplicada por padrão em todos os diplomas.
        </p>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : assinantes.length === 0 ? (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
            <AlertCircle size={16} />
            Nenhum assinante ativo cadastrado.{' '}
            <a href="/diploma/assinantes" className="underline font-medium">
              Cadastrar assinantes
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Assinantes na ordem */}
            {ordemIds.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Na ordem de assinatura
                </p>
                <div className="space-y-2">
                  {assinantesOrdenados.map((a, idx) => (
                    <div
                      key={a.id}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={() => setDragIdx(null)}
                      className="flex items-center gap-3 p-3 bg-primary-50 border-2 border-primary-200 rounded-xl cursor-grab active:cursor-grabbing"
                    >
                      <GripVertical size={16} className="text-gray-400 shrink-0" />
                      <span className="w-6 h-6 rounded-full bg-primary-500 text-white text-xs flex items-center justify-center font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{a.nome}</p>
                        <p className="text-xs text-gray-500">
                          {CARGO_LABELS[a.cargo] ?? a.outro_cargo ?? a.cargo}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleAssinante(a.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Assinantes disponíveis (não na ordem) */}
            {assinantesSemOrdem.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Disponíveis para adicionar
                </p>
                <div className="space-y-2">
                  {assinantesSemOrdem.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl bg-white"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-700 text-sm truncate">{a.nome}</p>
                        <p className="text-xs text-gray-400">
                          {CARGO_LABELS[a.cargo] ?? a.outro_cargo ?? a.cargo}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleAssinante(a.id)}
                        className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium px-2 py-1 rounded hover:bg-primary-50 transition-colors"
                      >
                        <Plus size={14} />
                        Adicionar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Salvando...' : 'Salvar Ordem de Assinatura'}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
            <CheckCircle2 size={16} />
            Salvo com sucesso!
          </span>
        )}
      </div>
    </div>
  )
}
