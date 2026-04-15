'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Calendar, Plus, ChevronDown, ChevronUp, Edit, Trash2,
  Save, Loader2, ArrowLeft, Check, Power, AlertCircle
} from 'lucide-react'
import type {
  AnoLetivoComPeriodos, PeriodoLetivo, TipoAnoLetivo,
  StatusPeriodoLetivo
} from '@/types/configuracoes'

const STATUS_PERIODO: Record<StatusPeriodoLetivo, { label: string; cor: string }> = {
  planejamento: { label: 'Planejamento', cor: 'bg-gray-100 text-gray-700' },
  ativo: { label: 'Ativo', cor: 'bg-green-100 text-green-700' },
  encerrado: { label: 'Encerrado', cor: 'bg-blue-100 text-blue-700' },
  suspenso: { label: 'Suspenso', cor: 'bg-yellow-100 text-yellow-700' },
}

const TIPO_ANO: Record<TipoAnoLetivo, string> = {
  anual: 'Anual',
  semestral: 'Semestral',
  trimestral: 'Trimestral',
}

interface FormAnoLetivo {
  ano: string
  tipo: TipoAnoLetivo
  descricao: string
  data_inicio: string
  data_fim: string
}

interface FormPeriodo {
  numero: string
  nome: string
  data_inicio: string
  data_fim: string
}

export default function AnosLetivosPage() {
  const [anosLetivos, setAnosLetivos] = useState<AnoLetivoComPeriodos[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  // Form novo ano letivo
  const [mostraFormNovoAno, setMostraFormNovoAno] = useState(false)
  const [formularioAno, setFormularioAno] = useState<FormAnoLetivo>({
    ano: new Date().getFullYear().toString(),
    tipo: 'anual',
    descricao: '',
    data_inicio: '',
    data_fim: '',
  })
  const [carregandoAno, setCarregandoAno] = useState(false)

  // Expandidos
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  // Form novo período
  const [anoParaPeriodo, setAnoParaPeriodo] = useState<string | null>(null)
  const [formularioPeriodo, setFormularioPeriodo] = useState<FormPeriodo>({
    numero: '',
    nome: '',
    data_inicio: '',
    data_fim: '',
  })
  const [carregandoPeriodo, setCarregandoPeriodo] = useState(false)

  // Carregar anos letivos
  const carregarAnosLetivos = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const res = await fetch('/api/configuracoes/anos-letivos')
      if (!res.ok) throw new Error('Erro ao carregar anos letivos')
      const data = await res.json()
      setAnosLetivos(data)
    } catch (err) {
      setErro('Falha ao carregar anos letivos. Tente novamente.')
      console.error(err)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregarAnosLetivos()
  }, [carregarAnosLetivos])

  // Enviar novo ano letivo
  const handleCriarAnoLetivo = async (e: React.FormEvent) => {
    e.preventDefault()
    setCarregandoAno(true)
    setErro('')

    try {
      const res = await fetch('/api/configuracoes/anos-letivos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ano: parseInt(formularioAno.ano, 10),
          tipo: formularioAno.tipo,
          descricao: formularioAno.descricao || null,
          data_inicio: formularioAno.data_inicio,
          data_fim: formularioAno.data_fim,
        }),
      })

      if (!res.ok) throw new Error('Erro ao criar ano letivo')

      setSucesso('Ano letivo criado com sucesso!')
      setFormularioAno({
        ano: new Date().getFullYear().toString(),
        tipo: 'anual',
        descricao: '',
        data_inicio: '',
        data_fim: '',
      })
      setMostraFormNovoAno(false)
      await carregarAnosLetivos()
      setTimeout(() => setSucesso(''), 3000)
    } catch (err) {
      setErro('Falha ao criar ano letivo. Tente novamente.')
      console.error(err)
    } finally {
      setCarregandoAno(false)
    }
  }

  // Ativar ano letivo
  const handleAtivarAnoLetivo = async (id: string) => {
    setCarregandoAno(true)
    setErro('')

    try {
      const res = await fetch(`/api/configuracoes/anos-letivos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: true }),
      })

      if (!res.ok) throw new Error('Erro ao ativar ano letivo')

      setSucesso('Ano letivo ativado com sucesso!')
      await carregarAnosLetivos()
      setTimeout(() => setSucesso(''), 3000)
    } catch (err) {
      setErro('Falha ao ativar ano letivo. Tente novamente.')
      console.error(err)
    } finally {
      setCarregandoAno(false)
    }
  }

  // Enviar novo período
  const handleCriarPeriodo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!anoParaPeriodo) return

    setCarregandoPeriodo(true)
    setErro('')

    try {
      const res = await fetch(
        `/api/configuracoes/anos-letivos/${anoParaPeriodo}/periodos`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            numero: parseInt(formularioPeriodo.numero, 10),
            nome: formularioPeriodo.nome,
            data_inicio: formularioPeriodo.data_inicio,
            data_fim: formularioPeriodo.data_fim,
          }),
        }
      )

      if (!res.ok) throw new Error('Erro ao criar período')

      setSucesso('Período criado com sucesso!')
      setFormularioPeriodo({
        numero: '',
        nome: '',
        data_inicio: '',
        data_fim: '',
      })
      setAnoParaPeriodo(null)
      await carregarAnosLetivos()
      setTimeout(() => setSucesso(''), 3000)
    } catch (err) {
      setErro('Falha ao criar período. Tente novamente.')
      console.error(err)
    } finally {
      setCarregandoPeriodo(false)
    }
  }

  // Alternar expandido
  const toggleExpandido = (id: string) => {
    const novoExpandidos = new Set(expandidos)
    if (novoExpandidos.has(id)) {
      novoExpandidos.delete(id)
    } else {
      novoExpandidos.add(id)
    }
    setExpandidos(novoExpandidos)
  }

  const isExpandido = (id: string) => expandidos.has(id)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-blue-600" />
            Anos Letivos
          </h1>
          <p className="text-gray-500 mt-1">
            Gerencie os anos letivos e seus períodos acadêmicos
          </p>
        </div>
        <button
          onClick={() => setMostraFormNovoAno(!mostraFormNovoAno)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          Novo Ano Letivo
        </button>
      </div>

      {/* Mensagens */}
      {erro && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-700">{erro}</p>
        </div>
      )}
      {sucesso && (
        <div className="mb-4 p-4 rounded-lg bg-green-50 border border-green-200 flex items-start gap-3">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-green-700">{sucesso}</p>
        </div>
      )}

      {/* Form Novo Ano Letivo */}
      {mostraFormNovoAno && (
        <div className="mb-6 p-6 bg-white rounded-xl border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Novo Ano Letivo
          </h2>
          <form onSubmit={handleCriarAnoLetivo} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Ano */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ano
                </label>
                <input
                  type="number"
                  min="2000"
                  max="2100"
                  value={formularioAno.ano}
                  onChange={(e) =>
                    setFormularioAno({ ...formularioAno, ano: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo
                </label>
                <select
                  value={formularioAno.tipo}
                  onChange={(e) =>
                    setFormularioAno({
                      ...formularioAno,
                      tipo: e.target.value as TipoAnoLetivo,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="anual">Anual</option>
                  <option value="semestral">Semestral</option>
                  <option value="trimestral">Trimestral</option>
                </select>
              </div>

              {/* Data Início */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Início
                </label>
                <input
                  type="date"
                  value={formularioAno.data_inicio}
                  onChange={(e) =>
                    setFormularioAno({
                      ...formularioAno,
                      data_inicio: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Data Fim */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Término
                </label>
                <input
                  type="date"
                  value={formularioAno.data_fim}
                  onChange={(e) =>
                    setFormularioAno({ ...formularioAno, data_fim: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição (opcional)
              </label>
              <textarea
                value={formularioAno.descricao}
                onChange={(e) =>
                  setFormularioAno({ ...formularioAno, descricao: e.target.value })
                }
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Botões */}
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setMostraFormNovoAno(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={carregandoAno}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
              >
                {carregandoAno ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Criar Ano Letivo
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de Anos Letivos */}
      <div className="space-y-4">
        {carregando ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : anosLetivos.length === 0 ? (
          <div className="p-6 bg-white rounded-xl border border-gray-200 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">Nenhum ano letivo cadastrado.</p>
            <p className="text-sm text-gray-500 mt-1">
              Clique em "Novo Ano Letivo" para começar.
            </p>
          </div>
        ) : (
          anosLetivos.map((ano) => (
            <div
              key={ano.id}
              className="p-6 bg-white rounded-xl border border-gray-200 transition-shadow hover:shadow-md"
            >
              {/* Header do Card */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-4xl font-bold text-blue-600">
                      {ano.ano}
                    </h3>
                    <div className="flex flex-col gap-1">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium w-fit ${TIPO_ANO[ano.tipo] === 'Anual' ? 'bg-blue-100 text-blue-700' : TIPO_ANO[ano.tipo] === 'Semestral' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {TIPO_ANO[ano.tipo]}
                      </span>
                      <div className="flex items-center gap-1">
                        {ano.ativo ? (
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-green-600" />
                            <span className="text-xs text-green-700 font-medium">
                              Ativo
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">Inativo</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">
                      {new Date(ano.data_inicio).toLocaleDateString('pt-BR')}
                    </span>
                    {' — '}
                    <span className="font-medium">
                      {new Date(ano.data_fim).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!ano.ativo && (
                    <button
                      onClick={() => handleAtivarAnoLetivo(ano.id)}
                      disabled={carregandoAno}
                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Ativar"
                    >
                      <Power className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => toggleExpandido(ano.id)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title={isExpandido(ano.id) ? 'Recolher' : 'Expandir'}
                  >
                    {isExpandido(ano.id) ? (
                      <ChevronUp className="w-4 h-4 text-gray-600" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                </div>
              </div>

              {/* Status */}
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    STATUS_PERIODO[ano.status].cor
                  }`}
                >
                  {STATUS_PERIODO[ano.status].label}
                </span>
              </div>

              {/* Expandido: Períodos */}
              {isExpandido(ano.id) && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                  <h4 className="font-semibold text-gray-900">Períodos</h4>

                  {ano.periodos && ano.periodos.length > 0 ? (
                    <div className="space-y-2">
                      {ano.periodos.map((periodo) => (
                        <div
                          key={periodo.id}
                          className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {periodo.numero}º - {periodo.nome}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {new Date(periodo.data_inicio).toLocaleDateString(
                                'pt-BR'
                              )}{' '}
                              a{' '}
                              {new Date(periodo.data_fim).toLocaleDateString(
                                'pt-BR'
                              )}
                            </div>
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-medium ${
                              STATUS_PERIODO[periodo.status].cor
                            }`}
                          >
                            {STATUS_PERIODO[periodo.status].label}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Nenhum período cadastrado.
                    </p>
                  )}

                  {/* Form Novo Período */}
                  {anoParaPeriodo === ano.id && (
                    <form
                      onSubmit={handleCriarPeriodo}
                      className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Número
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={formularioPeriodo.numero}
                            onChange={(e) =>
                              setFormularioPeriodo({
                                ...formularioPeriodo,
                                numero: e.target.value,
                              })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="1"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Nome
                          </label>
                          <input
                            type="text"
                            value={formularioPeriodo.nome}
                            onChange={(e) =>
                              setFormularioPeriodo({
                                ...formularioPeriodo,
                                nome: e.target.value,
                              })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="1º Semestre"
                            required
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Início
                          </label>
                          <input
                            type="date"
                            value={formularioPeriodo.data_inicio}
                            onChange={(e) =>
                              setFormularioPeriodo({
                                ...formularioPeriodo,
                                data_inicio: e.target.value,
                              })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Término
                          </label>
                          <input
                            type="date"
                            value={formularioPeriodo.data_fim}
                            onChange={(e) =>
                              setFormularioPeriodo({
                                ...formularioPeriodo,
                                data_fim: e.target.value,
                              })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => setAnoParaPeriodo(null)}
                          className="px-3 py-1 text-xs text-gray-700 border border-gray-300 rounded hover:bg-gray-100 font-medium transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={carregandoPeriodo}
                          className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
                        >
                          {carregandoPeriodo ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          Salvar
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Botão Novo Período */}
                  {anoParaPeriodo !== ano.id && (
                    <button
                      onClick={() => setAnoParaPeriodo(ano.id)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Adicionar Período
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
