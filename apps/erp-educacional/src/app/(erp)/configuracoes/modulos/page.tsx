'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  FlaskConical,
  CheckCircle2,
  XCircle,
  Loader2,
  Layers,
  RefreshCw,
  Info,
} from 'lucide-react'
import type { ModuloComFuncionalidades, ModuloSistema } from '@/types/configuracoes'

type StatusSalvamento = 'idle' | 'saving' | 'saved' | 'error'
type StatusMap = Record<string, StatusSalvamento>

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({
  ativo,
  cor,
  onChange,
  disabled,
}: {
  ativo: boolean
  cor: 'amber' | 'green'
  onChange: () => void
  disabled?: boolean
}) {
  const bg = ativo
    ? cor === 'amber'
      ? 'bg-amber-500'
      : 'bg-green-500'
    : 'bg-gray-200'

  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${bg} ${
        cor === 'amber' ? 'focus:ring-amber-400' : 'focus:ring-green-400'
      }`}
      aria-checked={ativo}
      role="switch"
    >
      <span
        className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
          ativo ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

// ─── Linha de Funcionalidade ──────────────────────────────────────────────────

function FuncionalidadeRow({
  funcionalidade: f,
  status,
  onUpdate,
}: {
  funcionalidade: ModuloSistema
  status: StatusSalvamento
  onUpdate: (id: string, campo: 'beta' | 'ativo', valor: boolean) => void
}) {
  const isBusy = status === 'saving'

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-800">{f.nome}</span>
          {f.beta && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-300">
              <FlaskConical className="w-2.5 h-2.5" />
              Beta
            </span>
          )}
          {!f.ativo && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-gray-100 text-gray-500 border border-gray-300">
              Desativado
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {f.rota && (
            <span className="text-[11px] text-gray-400 font-mono">{f.rota}</span>
          )}
          {f.descricao && (
            <span className="text-[11px] text-gray-400 hidden sm:inline">· {f.descricao}</span>
          )}
        </div>
      </div>

      {/* Indicador de status */}
      <div className="w-5 flex justify-center flex-shrink-0">
        {status === 'saving' && (
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
        )}
        {status === 'saved' && (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        )}
        {status === 'error' && (
          <span title="Erro ao salvar">
            <XCircle className="w-4 h-4 text-red-500" />
          </span>
        )}
      </div>

      {/* Toggle Beta */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-xs text-gray-500 hidden sm:inline">Beta</span>
        <Toggle
          ativo={f.beta}
          cor="amber"
          onChange={() => onUpdate(f.id, 'beta', !f.beta)}
          disabled={isBusy}
        />
      </div>

      {/* Toggle Ativo */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-xs text-gray-500 hidden sm:inline">Ativo</span>
        <Toggle
          ativo={f.ativo}
          cor="green"
          onChange={() => onUpdate(f.id, 'ativo', !f.ativo)}
          disabled={isBusy}
        />
      </div>
    </div>
  )
}

// ─── Card de Módulo Pai ───────────────────────────────────────────────────────

function ModuloCard({
  modulo,
  statusMap,
  onUpdate,
}: {
  modulo: ModuloComFuncionalidades
  statusMap: StatusMap
  onUpdate: (id: string, campo: 'beta' | 'ativo', valor: boolean) => void
}) {
  const [expandido, setExpandido] = useState(true)
  const totalBeta = modulo.funcionalidades.filter(f => f.beta).length
  const totalAtivo = modulo.funcionalidades.filter(f => f.ativo).length
  const total = modulo.funcionalidades.length

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Cabeçalho */}
      <button
        type="button"
        onClick={() => setExpandido(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors text-left"
      >
        <Layers className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className="font-semibold text-gray-700 text-sm flex-1">{modulo.nome}</span>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {totalBeta > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-600">
              <FlaskConical className="w-3 h-3" />
              {totalBeta} beta
            </span>
          )}
          <span>{totalAtivo}/{total} ativos</span>
          <span className="text-gray-300">{expandido ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Funcionalidades */}
      {expandido && (
        <>
          {total === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400 italic">
              Nenhuma funcionalidade cadastrada
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {modulo.funcionalidades.map(f => (
                <FuncionalidadeRow
                  key={f.id}
                  funcionalidade={f}
                  status={statusMap[f.id] || 'idle'}
                  onUpdate={onUpdate}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ModulosPage() {
  const [hierarquia, setHierarquia] = useState<ModuloComFuncionalidades[]>([])
  const [carregando, setCarregando] = useState(true)
  const [statusMap, setStatusMap] = useState<StatusMap>({})

  const fetchModulos = useCallback(async () => {
    setCarregando(true)
    try {
      const res = await fetch('/api/configuracoes/modulos')
      const json = await res.json()
      if (json.sucesso) setHierarquia(json.dados)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    fetchModulos()
  }, [fetchModulos])

  const updateFuncionalidade = useCallback(
    async (id: string, campo: 'beta' | 'ativo', valor: boolean) => {
      // Atualização otimista: muda na tela imediatamente
      setHierarquia(prev =>
        prev.map(modulo => ({
          ...modulo,
          funcionalidades: modulo.funcionalidades.map(f =>
            f.id === id ? { ...f, [campo]: valor } : f
          ),
        }))
      )
      setStatusMap(prev => ({ ...prev, [id]: 'saving' }))

      try {
        const res = await fetch(`/api/configuracoes/modulos/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [campo]: valor }),
        })
        const json = await res.json()

        if (json.sucesso) {
          setStatusMap(prev => ({ ...prev, [id]: 'saved' }))
          setTimeout(
            () => setStatusMap(prev => ({ ...prev, [id]: 'idle' })),
            2000
          )
        } else {
          throw new Error(json.erro)
        }
      } catch {
        // Revert em caso de erro
        setHierarquia(prev =>
          prev.map(modulo => ({
            ...modulo,
            funcionalidades: modulo.funcionalidades.map(f =>
              f.id === id ? { ...f, [campo]: !valor } : f
            ),
          }))
        )
        setStatusMap(prev => ({ ...prev, [id]: 'error' }))
        setTimeout(
          () => setStatusMap(prev => ({ ...prev, [id]: 'idle' })),
          3000
        )
      }
    },
    []
  )

  const totalBeta = hierarquia.reduce(
    (acc, m) => acc + m.funcionalidades.filter(f => f.beta).length,
    0
  )

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Módulos e Funcionalidades
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure quais funcionalidades estão em <strong>Beta</strong> ou{' '}
            <strong>Ativas</strong> no sistema.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchModulos}
          disabled={carregando}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
          Recarregar
        </button>
      </div>

      {/* Banner informativo */}
      <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
        <div>
          <p>
            <strong>Funcionalidades Beta</strong> são visíveis apenas para{' '}
            <strong>Administradores da Instituição</strong>. Os outros perfis não
            verão os itens marcados como Beta na navegação.
          </p>
          {totalBeta > 0 && (
            <p className="mt-1 text-amber-700">
              Atualmente <strong>{totalBeta}</strong>{' '}
              {totalBeta === 1 ? 'funcionalidade está' : 'funcionalidades estão'} em
              modo Beta.
            </p>
          )}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-9 h-5 rounded-full bg-amber-500" />
          <span>Beta ativado — só Admins veem</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-9 h-5 rounded-full bg-green-500" />
          <span>Funcionalidade ativa no sistema</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-9 h-5 rounded-full bg-gray-200" />
          <span>Desativado</span>
        </div>
      </div>

      {/* Lista de módulos */}
      {carregando ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
        </div>
      ) : hierarquia.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhum módulo encontrado.</p>
          <p className="text-sm mt-1">Execute a migração de funcionalidades.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {hierarquia.map(modulo => (
            <ModuloCard
              key={modulo.id}
              modulo={modulo}
              statusMap={statusMap}
              onUpdate={updateFuncionalidade}
            />
          ))}
        </div>
      )}
    </div>
  )
}
