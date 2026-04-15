'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Settings,
  Plus,
  Save,
  Loader2,
  Edit,
  Trash2,
  ArrowLeft,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Search,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import {
  ParametroSistema,
  TipoParametro,
  ParametroCreateInput,
} from '@/types/configuracoes'

export default function ParametrosPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [parametros, setParametros] = useState<ParametroSistema[]>([])
  const [filteredParams, setFilteredParams] = useState<ParametroSistema[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedModulo, setSelectedModulo] = useState<string | null>(null)
  const [modulos, setModulos] = useState<string[]>([])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')

  const [showNewForm, setShowNewForm] = useState(false)
  const [newFormData, setNewFormData] = useState<ParametroCreateInput>({
    chave: '',
    valor: '',
    tipo: 'texto',
    modulo: '',
    descricao: '',
  })

  const [expandedModulos, setExpandedModulos] = useState<Set<string>>(new Set())
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set())

  // Fetch parametros
  useEffect(() => {
    const fetchParametros = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/configuracoes/parametros')
        if (!res.ok) throw new Error('Falha ao carregar parâmetros')

        const data: ParametroSistema[] = await res.json()
        setParametros(data)

        // Extract unique modules
        const mods = Array.from(new Set(data.map((p) => p.modulo))).sort()
        setModulos(mods)

        // Expand first module by default
        if (mods.length > 0) {
          setExpandedModulos(new Set([mods[0]]))
          setSelectedModulo(mods[0])
        }

        // Apply filters
        applyFilters(data, '', mods[0] || null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar parâmetros')
      } finally {
        setLoading(false)
      }
    }

    fetchParametros()
  }, [])

  const applyFilters = (
    data: ParametroSistema[],
    search: string,
    modulo: string | null
  ) => {
    let filtered = data

    if (modulo) {
      filtered = filtered.filter((p) => p.modulo === modulo)
    }

    if (search) {
      const lower = search.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.chave.toLowerCase().includes(lower) ||
          p.descricao?.toLowerCase().includes(lower) ||
          p.valor?.toLowerCase().includes(lower)
      )
    }

    setFilteredParams(filtered)
  }

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    applyFilters(parametros, value, selectedModulo)
  }

  const handleModuloFilter = (modulo: string) => {
    setSelectedModulo(modulo === selectedModulo ? null : modulo)
    applyFilters(parametros, searchTerm, modulo === selectedModulo ? null : modulo)
  }

  const handleEditStart = (param: ParametroSistema) => {
    setEditingId(param.id)
    setEditingValue(param.valor || '')
  }

  const handleEditSave = async (param: ParametroSistema) => {
    if (!param.editavel) return

    try {
      setSaving(true)
      setError(null)

      const res = await fetch(`/api/configuracoes/parametros/${param.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor: editingValue }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || 'Falha ao salvar parâmetro')
      }

      const updated = await res.json()
      setParametros(parametros.map((p) => (p.id === param.id ? updated : p)))
      setFilteredParams(
        filteredParams.map((p) => (p.id === param.id ? updated : p))
      )
      setEditingId(null)
      setSuccess('Parâmetro salvo com sucesso!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este parâmetro?')) return

    try {
      setDeleting(id)
      setError(null)

      const res = await fetch(`/api/configuracoes/parametros/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Falha ao deletar parâmetro')

      setParametros(parametros.filter((p) => p.id !== id))
      setFilteredParams(filteredParams.filter((p) => p.id !== id))
      setSuccess('Parâmetro deletado com sucesso!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar')
    } finally {
      setDeleting(null)
    }
  }

  const handleCreateParam = async () => {
    if (!newFormData.chave || !newFormData.valor || !newFormData.modulo) {
      setError('Preencha todos os campos obrigatórios')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const res = await fetch('/api/configuracoes/parametros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFormData),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || 'Falha ao criar parâmetro')
      }

      const created = await res.json()
      setParametros([...parametros, created])
      setFilteredParams([...filteredParams, created])

      // Reset form
      setNewFormData({
        chave: '',
        valor: '',
        tipo: 'texto',
        modulo: '',
        descricao: '',
      })
      setShowNewForm(false)

      // Expand the module if not already expanded
      const newModulos = Array.from(new Set([...modulos, created.modulo])).sort()
      setModulos(newModulos)
      setExpandedModulos(new Set([...Array.from(expandedModulos), created.modulo]))

      setSuccess('Parâmetro criado com sucesso!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar parâmetro')
    } finally {
      setSaving(false)
    }
  }

  const toggleModuloExpanded = (modulo: string) => {
    const newExpanded = new Set(expandedModulos)
    if (newExpanded.has(modulo)) {
      newExpanded.delete(modulo)
    } else {
      newExpanded.add(modulo)
    }
    setExpandedModulos(newExpanded)
  }

  const togglePasswordVisibility = (id: string) => {
    const newVisible = new Set(visiblePasswords)
    if (newVisible.has(id)) {
      newVisible.delete(id)
    } else {
      newVisible.add(id)
    }
    setVisiblePasswords(newVisible)
  }

  const getTipoBadge = (tipo: TipoParametro) => {
    const badges: Record<TipoParametro, { label: string; cor: string }> = {
      texto: { label: 'Texto', cor: 'bg-blue-100 text-blue-700' },
      numero: { label: 'Número', cor: 'bg-purple-100 text-purple-700' },
      booleano: { label: 'Booleano', cor: 'bg-green-100 text-green-700' },
      json: { label: 'JSON', cor: 'bg-orange-100 text-orange-700' },
      data: { label: 'Data', cor: 'bg-pink-100 text-pink-700' },
      lista: { label: 'Lista', cor: 'bg-indigo-100 text-indigo-700' },
      senha: { label: 'Senha', cor: 'bg-red-100 text-red-700' },
    }
    return badges[tipo]
  }

  const renderValueInput = (param: ParametroSistema) => {
    const isEditing = editingId === param.id

    if (param.tipo === 'booleano') {
      if (isEditing) {
        return (
          <select
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          >
            <option value="true">Verdadeiro</option>
            <option value="false">Falso</option>
          </select>
        )
      }
      const bool = param.valor === 'true' || param.valor === '1'
      return (
        <span
          className={`text-sm font-medium px-2 py-1 rounded ${
            bool ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
          }`}
        >
          {bool ? 'Verdadeiro' : 'Falso'}
        </span>
      )
    }

    if (param.tipo === 'senha') {
      if (isEditing) {
        return (
          <input
            type="password"
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none flex-1"
          />
        )
      }
      const isVisible = visiblePasswords.has(param.id)
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-gray-600">
            {isVisible
              ? param.valor || '—'
              : '*'.repeat(Math.min(param.valor?.length || 0, 16))}
          </span>
          <button
            onClick={() => togglePasswordVisibility(param.id)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            {isVisible ? (
              <EyeOff className="w-4 h-4 text-gray-600" />
            ) : (
              <Eye className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>
      )
    }

    if (isEditing) {
      return (
        <input
          type={param.tipo === 'numero' ? 'number' : 'text'}
          value={editingValue}
          onChange={(e) => setEditingValue(e.target.value)}
          className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none flex-1"
        />
      )
    }

    return (
      <code className="text-sm text-gray-900 bg-gray-50 px-2 py-1 rounded font-mono">
        {param.valor || '—'}
      </code>
    )
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10 flex items-center justify-center min-h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Carregando parâmetros...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-900">Parâmetros do Sistema</h1>
          </div>
          <p className="text-gray-500">
            Configure os parâmetros e variáveis globais do sistema
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Novo Parâmetro
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-900">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
          <div className="w-5 h-5 bg-green-600 rounded-full flex-shrink-0 mt-0.5" />
          <p className="text-green-900">{success}</p>
        </div>
      )}

      {/* New Parameter Form */}
      {showNewForm && (
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Novo Parâmetro</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chave *
              </label>
              <input
                type="text"
                value={newFormData.chave}
                onChange={(e) =>
                  setNewFormData({ ...newFormData, chave: e.target.value })
                }
                placeholder="CHAVE_PARAMETRO"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo *
              </label>
              <select
                value={newFormData.tipo}
                onChange={(e) =>
                  setNewFormData({
                    ...newFormData,
                    tipo: e.target.value as TipoParametro,
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              >
                <option value="texto">Texto</option>
                <option value="numero">Número</option>
                <option value="booleano">Booleano</option>
                <option value="json">JSON</option>
                <option value="data">Data</option>
                <option value="lista">Lista</option>
                <option value="senha">Senha</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Módulo *
              </label>
              <input
                type="text"
                value={newFormData.modulo}
                onChange={(e) =>
                  setNewFormData({ ...newFormData, modulo: e.target.value })
                }
                placeholder="diploma"
                list="modulos-list"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
              <datalist id="modulos-list">
                {modulos.map((mod) => (
                  <option key={mod} value={mod} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valor *
              </label>
              <input
                type={newFormData.tipo === 'numero' ? 'number' : 'text'}
                value={newFormData.valor}
                onChange={(e) =>
                  setNewFormData({ ...newFormData, valor: e.target.value })
                }
                placeholder="valor"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrição
              </label>
              <textarea
                value={newFormData.descricao || ''}
                onChange={(e) =>
                  setNewFormData({ ...newFormData, descricao: e.target.value })
                }
                placeholder="Descrição do parâmetro..."
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => setShowNewForm(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateParam}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Criar Parâmetro
            </button>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="mb-6 flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar por chave, descrição ou valor..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
        </div>

        {modulos.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {modulos.map((modulo) => (
              <button
                key={modulo}
                onClick={() => handleModuloFilter(modulo)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedModulo === modulo
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {modulo || 'Sem módulo'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Parameters by Module */}
      <div className="space-y-4">
        {modulos.map((modulo) => {
          const moduloParams = filteredParams.filter((p) => p.modulo === modulo)

          if (moduloParams.length === 0) return null

          return (
            <div key={modulo} className="bg-white rounded-lg border border-gray-200">
              {/* Module Header */}
              <button
                onClick={() => toggleModuloExpanded(modulo)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-200"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-900">{modulo}</span>
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {moduloParams.length}
                  </span>
                </div>
                {expandedModulos.has(modulo) ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {/* Module Parameters */}
              {expandedModulos.has(modulo) && (
                <div className="divide-y divide-gray-200">
                  {moduloParams.map((param) => (
                    <div
                      key={param.id}
                      className="px-6 py-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Chave */}
                          <div className="flex items-center gap-2 mb-1">
                            <code className="text-sm font-bold text-gray-900 bg-gray-100 px-2.5 py-1 rounded font-mono">
                              {param.chave}
                            </code>
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded ${getTipoBadge(param.tipo).cor}`}
                            >
                              {getTipoBadge(param.tipo).label}
                            </span>
                            {!param.editavel && (
                              <Lock className="w-4 h-4 text-gray-400" />
                            )}
                          </div>

                          {/* Descrição */}
                          {param.descricao && (
                            <p className="text-sm text-gray-600 mb-3">{param.descricao}</p>
                          )}

                          {/* Value */}
                          <div className="flex items-center gap-2 mt-3">
                            <span className="text-xs text-gray-500 font-medium">Valor:</span>
                            {editingId === param.id && param.editavel ? (
                              <div className="flex items-center gap-2 flex-1">
                                {renderValueInput(param)}
                                <button
                                  onClick={() => handleEditSave(param)}
                                  disabled={saving}
                                  className="p-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded transition-colors disabled:opacity-50"
                                  title="Salvar"
                                >
                                  <Save className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="p-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors"
                                  title="Cancelar"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 flex-1">
                                {renderValueInput(param)}
                                {param.editavel && (
                                  <button
                                    onClick={() => handleEditStart(param)}
                                    className="p-1.5 hover:bg-gray-200 rounded transition-colors ml-auto"
                                    title="Editar"
                                  >
                                    <Edit className="w-4 h-4 text-gray-600" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Delete Button */}
                        {param.editavel && (
                          <button
                            onClick={() => handleDelete(param.id)}
                            disabled={deleting === param.id}
                            className="mt-1 p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            title="Deletar"
                          >
                            {deleting === param.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {filteredParams.length === 0 && (
          <div className="text-center py-12">
            <Settings className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">Nenhum parâmetro encontrado</p>
            <p className="text-gray-500 text-sm">
              {searchTerm ? 'Tente ajustar sua busca' : 'Crie um novo parâmetro para começar'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
