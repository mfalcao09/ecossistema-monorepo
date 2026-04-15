'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CalendarDays, Plus, ChevronLeft, ChevronRight, Edit, Trash2,
  Save, Loader2, ArrowLeft, Clock, Eye, AlertCircle, Check
} from 'lucide-react'
import type { CalendarioAcademico, TipoEventoCalendario } from '@/types/configuracoes'

const TIPO_EVENTO: Record<TipoEventoCalendario, string> = {
  feriado_nacional: 'Feriado Nacional',
  feriado_municipal: 'Feriado Municipal',
  recesso: 'Recesso',
  periodo_matricula: 'Período de Matrícula',
  periodo_rematricula: 'Rematrícula',
  periodo_provas: 'Período de Provas',
  inicio_aulas: 'Início das Aulas',
  fim_aulas: 'Fim das Aulas',
  formatura: 'Formatura',
  evento_institucional: 'Evento Institucional',
  reuniao_pedagogica: 'Reunião Pedagógica',
  conselho_classe: 'Conselho de Classe',
  outro: 'Outro',
}

const CORES_PREDEFINIDAS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#6366f1', // indigo
]

interface FormEvento {
  titulo: string
  tipo: TipoEventoCalendario
  descricao: string
  data_inicio: string
  data_fim: string
  dia_inteiro: boolean
  hora_inicio: string
  hora_fim: string
  cor: string
  visivel_portal: boolean
}

export default function CalendariosPage() {
  const [eventos, setEventos] = useState<CalendarioAcademico[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  // Navegação de mês
  const hoje = new Date()
  const [mesAtual, setMesAtual] = useState(hoje.getMonth() + 1)
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear())

  // Form novo evento
  const [mostraFormNovoEvento, setMostraFormNovoEvento] = useState(false)
  const [formularioEvento, setFormularioEvento] = useState<FormEvento>({
    titulo: '',
    tipo: 'outro',
    descricao: '',
    data_inicio: '',
    data_fim: '',
    dia_inteiro: true,
    hora_inicio: '09:00',
    hora_fim: '17:00',
    cor: CORES_PREDEFINIDAS[0],
    visivel_portal: true,
  })
  const [carregandoEvento, setCarregandoEvento] = useState(false)

  // Evento selecionado (para detalhes)
  const [eventoSelecionado, setEventoSelecionado] = useState<CalendarioAcademico | null>(
    null
  )

  // Carregar eventos
  const carregarEventos = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const params = new URLSearchParams()
      params.set('ano', anoAtual.toString())
      params.set('mes', mesAtual.toString())

      const res = await fetch(`/api/configuracoes/calendarios?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar eventos')
      const data = await res.json()
      setEventos(data)
    } catch (err) {
      setErro('Falha ao carregar calendário. Tente novamente.')
      console.error(err)
    } finally {
      setCarregando(false)
    }
  }, [anoAtual, mesAtual])

  useEffect(() => {
    carregarEventos()
  }, [carregarEventos])

  // Enviar novo evento
  const handleCriarEvento = async (e: React.FormEvent) => {
    e.preventDefault()
    setCarregandoEvento(true)
    setErro('')

    try {
      const res = await fetch('/api/configuracoes/calendarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: formularioEvento.titulo,
          tipo: formularioEvento.tipo,
          descricao: formularioEvento.descricao || null,
          data_inicio: formularioEvento.data_inicio,
          data_fim: formularioEvento.data_fim,
          dia_inteiro: formularioEvento.dia_inteiro,
          hora_inicio: !formularioEvento.dia_inteiro
            ? formularioEvento.hora_inicio
            : null,
          hora_fim: !formularioEvento.dia_inteiro
            ? formularioEvento.hora_fim
            : null,
          cor: formularioEvento.cor,
          visivel_portal: formularioEvento.visivel_portal,
        }),
      })

      if (!res.ok) throw new Error('Erro ao criar evento')

      setSucesso('Evento criado com sucesso!')
      setFormularioEvento({
        titulo: '',
        tipo: 'outro',
        descricao: '',
        data_inicio: '',
        data_fim: '',
        dia_inteiro: true,
        hora_inicio: '09:00',
        hora_fim: '17:00',
        cor: CORES_PREDEFINIDAS[0],
        visivel_portal: true,
      })
      setMostraFormNovoEvento(false)
      await carregarEventos()
      setTimeout(() => setSucesso(''), 3000)
    } catch (err) {
      setErro('Falha ao criar evento. Tente novamente.')
      console.error(err)
    } finally {
      setCarregandoEvento(false)
    }
  }

  // Deletar evento
  const handleDeletarEvento = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este evento?')) return

    setCarregandoEvento(true)
    setErro('')

    try {
      const res = await fetch(`/api/configuracoes/calendarios/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Erro ao deletar evento')

      setSucesso('Evento removido com sucesso!')
      setEventoSelecionado(null)
      await carregarEventos()
      setTimeout(() => setSucesso(''), 3000)
    } catch (err) {
      setErro('Falha ao remover evento. Tente novamente.')
      console.error(err)
    } finally {
      setCarregandoEvento(false)
    }
  }

  // Navegar meses
  const mesAnterior = () => {
    if (mesAtual === 1) {
      setMesAtual(12)
      setAnoAtual(anoAtual - 1)
    } else {
      setMesAtual(mesAtual - 1)
    }
  }

  const proximoMes = () => {
    if (mesAtual === 12) {
      setMesAtual(1)
      setAnoAtual(anoAtual + 1)
    } else {
      setMesAtual(mesAtual + 1)
    }
  }

  // Utilitários de datas
  const nomeMes = (mes: number) => {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ]
    return meses[mes - 1]
  }

  const diasDoMes = (ano: number, mes: number) => {
    return new Date(ano, mes, 0).getDate()
  }

  const primeiroDia = (ano: number, mes: number) => {
    return new Date(ano, mes - 1, 1).getDay()
  }

  const eventosDoMes = eventos.filter((evento) => {
    const dataInicio = new Date(evento.data_inicio)
    return dataInicio.getMonth() + 1 === mesAtual && dataInicio.getFullYear() === anoAtual
  })

  const eventosPorDia = (dia: number) => {
    return eventosDoMes.filter((evento) => {
      const dataInicio = new Date(evento.data_inicio)
      return dataInicio.getDate() === dia
    })
  }

  // Grid do calendário
  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
  const dias: (number | null)[] = []

  // Preencher dias do mês anterior
  for (let i = 0; i < primeiroDia(anoAtual, mesAtual); i++) {
    dias.push(null)
  }

  // Preencher dias do mês
  for (let i = 1; i <= diasDoMes(anoAtual, mesAtual); i++) {
    dias.push(i)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-blue-600" />
            Calendário Acadêmico
          </h1>
          <p className="text-gray-500 mt-1">
            Gerencie feriados, eventos e datas importantes
          </p>
        </div>
        <button
          onClick={() => setMostraFormNovoEvento(!mostraFormNovoEvento)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          Novo Evento
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

      {/* Form Novo Evento */}
      {mostraFormNovoEvento && (
        <div className="mb-6 p-6 bg-white rounded-xl border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Novo Evento</h2>
          <form onSubmit={handleCriarEvento} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Título */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título
                </label>
                <input
                  type="text"
                  value={formularioEvento.titulo}
                  onChange={(e) =>
                    setFormularioEvento({ ...formularioEvento, titulo: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Feriado de Corpus Christi"
                  required
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo
                </label>
                <select
                  value={formularioEvento.tipo}
                  onChange={(e) =>
                    setFormularioEvento({
                      ...formularioEvento,
                      tipo: e.target.value as TipoEventoCalendario,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(TIPO_EVENTO).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cor
                </label>
                <div className="flex gap-2 flex-wrap">
                  {CORES_PREDEFINIDAS.map((cor) => (
                    <button
                      key={cor}
                      type="button"
                      onClick={() =>
                        setFormularioEvento({ ...formularioEvento, cor })
                      }
                      style={{ backgroundColor: cor }}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${
                        formularioEvento.cor === cor
                          ? 'border-gray-800 scale-110'
                          : 'border-gray-300'
                      }`}
                      title={cor}
                    />
                  ))}
                </div>
              </div>

              {/* Data Início */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Início
                </label>
                <input
                  type="date"
                  value={formularioEvento.data_inicio}
                  onChange={(e) =>
                    setFormularioEvento({
                      ...formularioEvento,
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
                  value={formularioEvento.data_fim}
                  onChange={(e) =>
                    setFormularioEvento({ ...formularioEvento, data_fim: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Dia Inteiro */}
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formularioEvento.dia_inteiro}
                    onChange={(e) =>
                      setFormularioEvento({
                        ...formularioEvento,
                        dia_inteiro: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Dia inteiro
                  </span>
                </label>
              </div>

              {/* Horários (se não for dia inteiro) */}
              {!formularioEvento.dia_inteiro && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hora de Início
                    </label>
                    <input
                      type="time"
                      value={formularioEvento.hora_inicio}
                      onChange={(e) =>
                        setFormularioEvento({
                          ...formularioEvento,
                          hora_inicio: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hora de Término
                    </label>
                    <input
                      type="time"
                      value={formularioEvento.hora_fim}
                      onChange={(e) =>
                        setFormularioEvento({
                          ...formularioEvento,
                          hora_fim: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição (opcional)
              </label>
              <textarea
                value={formularioEvento.descricao}
                onChange={(e) =>
                  setFormularioEvento({ ...formularioEvento, descricao: e.target.value })
                }
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Opções */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formularioEvento.visivel_portal}
                  onChange={(e) =>
                    setFormularioEvento({
                      ...formularioEvento,
                      visivel_portal: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  Visível no Portal
                </span>
              </label>
            </div>

            {/* Botões */}
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setMostraFormNovoEvento(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={carregandoEvento}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
              >
                {carregandoEvento ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Criar Evento
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Conteúdo principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendário */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          {/* Navegador de mês */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              {nomeMes(mesAtual)} {anoAtual}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={mesAnterior}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={proximoMes}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Dias da semana */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {diasSemana.map((dia) => (
              <div
                key={dia}
                className="text-center text-xs font-semibold text-gray-600 py-2"
              >
                {dia}
              </div>
            ))}
          </div>

          {/* Dias do mês */}
          <div className="grid grid-cols-7 gap-2">
            {dias.map((dia, idx) => {
              const eventosDia = dia ? eventosPorDia(dia) : []
              return (
                <div
                  key={idx}
                  className={`aspect-square border rounded-lg p-1 text-xs overflow-hidden flex flex-col ${
                    dia === null
                      ? 'bg-gray-50'
                      : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer'
                  }`}
                  onClick={() => {
                    if (dia && eventosDia.length > 0) {
                      setEventoSelecionado(eventosDia[0])
                    }
                  }}
                >
                  {dia && (
                    <>
                      <span className="font-semibold text-gray-700">{dia}</span>
                      <div className="mt-0.5 space-y-0.5 flex-1 overflow-hidden">
                        {eventosDia.slice(0, 2).map((evento, i) => (
                          <div
                            key={i}
                            className="text-xs px-1 py-0.5 rounded text-white truncate"
                            style={{ backgroundColor: evento.cor }}
                            title={evento.titulo}
                          >
                            {evento.titulo}
                          </div>
                        ))}
                        {eventosDia.length > 2 && (
                          <div className="text-xs text-gray-500">
                            +{eventosDia.length - 2}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Sidebar: Lista de eventos / Detalhes */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {eventoSelecionado ? (
            <>
              {/* Detalhes do evento */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: eventoSelecionado.cor }}
                  />
                  {eventoSelecionado.titulo}
                </h3>

                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Tipo:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {TIPO_EVENTO[eventoSelecionado.tipo]}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-600">Data:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {new Date(
                        eventoSelecionado.data_inicio
                      ).toLocaleDateString('pt-BR')}{' '}
                      {eventoSelecionado.data_inicio !==
                      eventoSelecionado.data_fim ? (
                        <>
                          a{' '}
                          {new Date(
                            eventoSelecionado.data_fim
                          ).toLocaleDateString('pt-BR')}
                        </>
                      ) : null}
                    </span>
                  </div>

                  {!eventoSelecionado.dia_inteiro && (
                    <div>
                      <span className="text-gray-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Horário:
                      </span>
                      <span className="ml-2 font-medium text-gray-900">
                        {eventoSelecionado.hora_inicio} -{' '}
                        {eventoSelecionado.hora_fim}
                      </span>
                    </div>
                  )}

                  {eventoSelecionado.descricao && (
                    <div>
                      <span className="text-gray-600">Descrição:</span>
                      <p className="mt-1 text-gray-700">
                        {eventoSelecionado.descricao}
                      </p>
                    </div>
                  )}

                  {eventoSelecionado.visivel_portal && (
                    <div className="flex items-center gap-2 text-green-700 text-xs font-medium">
                      <Eye className="w-3 h-3" />
                      Visível no Portal
                    </div>
                  )}
                </div>

                {/* Botões */}
                <div className="pt-4 flex gap-2">
                  <button
                    onClick={() =>
                      handleDeletarEvento(eventoSelecionado.id)
                    }
                    disabled={carregandoEvento}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg border border-red-200 font-medium transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remover
                  </button>
                  <button
                    onClick={() => setEventoSelecionado(null)}
                    className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Lista de eventos do mês */}
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Eventos de {nomeMes(mesAtual)}
              </h3>

              {carregando ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                </div>
              ) : eventosDoMes.length === 0 ? (
                <p className="text-sm text-gray-500 py-8 text-center">
                  Nenhum evento neste mês.
                </p>
              ) : (
                <div className="space-y-2">
                  {eventosDoMes
                    .sort(
                      (a, b) =>
                        new Date(a.data_inicio).getTime() -
                        new Date(b.data_inicio).getTime()
                    )
                    .map((evento) => (
                      <button
                        key={evento.id}
                        onClick={() => setEventoSelecionado(evento)}
                        className="w-full text-left p-2 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group"
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className="w-3 h-3 rounded mt-1 flex-shrink-0"
                            style={{ backgroundColor: evento.cor }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">
                              {evento.titulo}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {new Date(
                                evento.data_inicio
                              ).toLocaleDateString('pt-BR')}
                              {evento.data_inicio !== evento.data_fim && (
                                <>
                                  {' '}
                                  a{' '}
                                  {new Date(
                                    evento.data_fim
                                  ).toLocaleDateString('pt-BR')}
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
