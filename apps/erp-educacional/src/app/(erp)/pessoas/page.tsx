'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Plus, Search, Filter, Download, Upload,
  ChevronLeft, ChevronRight, Eye, Edit, Trash2,
  GraduationCap, BookOpen, Briefcase, UserCheck
} from 'lucide-react'
import type { PessoaComRelacoes, PessoaFiltros, PessoaListResponse, StatusPessoa, TipoVinculo } from '@/types/pessoas'
import { DialogoCategoriaPessoa } from '@/components/pessoas/DialogoCategoriaPessoa'
import { BadgesCategorias } from '@/components/pessoas/BadgeCategoria'
import { extrairCategorias } from '@/lib/pessoas/categoria-config'

const STATUS_LABELS: Record<StatusPessoa, { label: string; cor: string }> = {
  ativo: { label: 'Ativo', cor: 'bg-green-100 text-green-800' },
  inativo: { label: 'Inativo', cor: 'bg-gray-100 text-gray-800' },
  suspenso: { label: 'Suspenso', cor: 'bg-yellow-100 text-yellow-800' },
  falecido: { label: 'Falecido', cor: 'bg-red-100 text-red-800' },
  transferido: { label: 'Transferido', cor: 'bg-blue-100 text-blue-800' },
}

const VINCULO_ICONS: Record<TipoVinculo, { icon: typeof Users; cor: string }> = {
  aluno: { icon: GraduationCap, cor: 'text-blue-600' },
  professor: { icon: BookOpen, cor: 'text-purple-600' },
  colaborador: { icon: Briefcase, cor: 'text-emerald-600' },
  candidato: { icon: UserCheck, cor: 'text-orange-600' },
  ex_aluno: { icon: GraduationCap, cor: 'text-gray-400' },
  visitante: { icon: Users, cor: 'text-gray-400' },
  prestador: { icon: Briefcase, cor: 'text-gray-400' },
}

export default function PessoasPage() {
  const router = useRouter()
  const [dados, setDados] = useState<PessoaListResponse | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [filtros, setFiltros] = useState<PessoaFiltros>({
    pagina: 1,
    por_pagina: 20,
    ordenar_por: 'nome',
    ordem: 'asc',
  })
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusPessoa | ''>('')
  const [filtroVinculo, setFiltroVinculo] = useState<TipoVinculo | ''>('')
  const [stats, setStats] = useState({ total: 0, alunos_ativos: 0, professores_ativos: 0, colaboradores_ativos: 0 })
  const [dialogoAberto, setDialogoAberto] = useState(false)

  const carregarPessoas = useCallback(async () => {
    setCarregando(true)
    try {
      const params = new URLSearchParams()
      if (busca) params.set('busca', busca)
      if (filtroStatus) params.set('status', filtroStatus)
      if (filtroVinculo) params.set('tipo_vinculo', filtroVinculo)
      params.set('pagina', String(filtros.pagina || 1))
      params.set('por_pagina', String(filtros.por_pagina || 20))
      params.set('ordenar_por', filtros.ordenar_por || 'nome')
      params.set('ordem', filtros.ordem || 'asc')

      const res = await fetch(`/api/pessoas?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar')
      const data = await res.json()
      setDados(data)
    } catch (err) {
      console.error('Erro ao carregar pessoas:', err)
    } finally {
      setCarregando(false)
    }
  }, [busca, filtroStatus, filtroVinculo, filtros])

  useEffect(() => {
    carregarPessoas()
  }, [carregarPessoas])

  const formatarCPF = (cpf: string) => {
    const limpo = cpf.replace(/\D/g, '')
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-blue-600" />
            Pessoas
          </h1>
          <p className="text-gray-500 mt-1">
            Cadastro unificado — alunos, professores, colaboradores e candidatos
          </p>
        </div>
        <button
          onClick={() => setDialogoAberto(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          Nova Pessoa
        </button>
      </div>

      {/* Diálogo de seleção de categoria */}
      <DialogoCategoriaPessoa
        aberto={dialogoAberto}
        onFechar={() => setDialogoAberto(false)}
      />

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{dados?.total || 0}</p>
              <p className="text-sm text-gray-500">Total de pessoas</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <GraduationCap className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.alunos_ativos}</p>
              <p className="text-sm text-gray-500">Alunos ativos</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <BookOpen className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.professores_ativos}</p>
              <p className="text-sm text-gray-500">Professores ativos</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Briefcase className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.colaboradores_ativos}</p>
              <p className="text-sm text-gray-500">Colaboradores ativos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de busca e filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou CPF..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && carregarPessoas()}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            />
          </div>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as StatusPessoa | '')}
            className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
            <option value="suspenso">Suspenso</option>
            <option value="transferido">Transferido</option>
          </select>
          <select
            value={filtroVinculo}
            onChange={(e) => setFiltroVinculo(e.target.value as TipoVinculo | '')}
            className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Todos os tipos</option>
            <option value="aluno">Alunos</option>
            <option value="professor">Professores</option>
            <option value="colaborador">Colaboradores</option>
            <option value="candidato">Candidatos</option>
          </select>
          <button
            onClick={carregarPessoas}
            className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabela de pessoas */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {carregando ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-500">Carregando pessoas...</p>
          </div>
        ) : !dados?.dados.length ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">Nenhuma pessoa cadastrada</h3>
            <p className="text-gray-500 mt-1 mb-4">Comece cadastrando a primeira pessoa do sistema.</p>
            <button
              onClick={() => setDialogoAberto(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Cadastrar pessoa
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">CPF</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Vínculo</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Contato</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dados.dados.map((pessoa) => {
                    const vinculoPrincipal = pessoa.vinculos?.[0]
                    const contatoPrincipal = pessoa.contatos?.find(c => c.principal) || pessoa.contatos?.[0]
                    const statusInfo = STATUS_LABELS[pessoa.status]

                    return (
                      <tr
                        key={pessoa.id}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => router.push(`/pessoas/${pessoa.id}`)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-medium text-sm">
                              {pessoa.nome.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{pessoa.nome}</p>
                              {pessoa.nome_social && (
                                <p className="text-xs text-gray-500">Nome social: {pessoa.nome_social}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                          {formatarCPF(pessoa.cpf)}
                        </td>
                        <td className="px-4 py-3">
                          {pessoa.vinculos && pessoa.vinculos.length > 0 ? (
                            <BadgesCategorias
                              tipos={extrairCategorias(pessoa.vinculos)}
                              tamanho="sm"
                            />
                          ) : (
                            <span className="text-xs text-gray-400 italic">Sem categoria</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {contatoPrincipal?.valor || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.cor}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); router.push(`/pessoas/${pessoa.id}`) }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
                              title="Visualizar"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); router.push(`/pessoas/${pessoa.id}?editar=true`) }}
                              className="p-1.5 text-gray-400 hover:text-emerald-600 rounded transition-colors"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {dados.total_paginas > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  Mostrando {((dados.pagina - 1) * dados.por_pagina) + 1} a{' '}
                  {Math.min(dados.pagina * dados.por_pagina, dados.total)} de {dados.total} pessoas
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setFiltros(f => ({ ...f, pagina: (f.pagina || 1) - 1 }))}
                    disabled={dados.pagina <= 1}
                    className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 text-sm font-medium text-gray-700">
                    {dados.pagina} / {dados.total_paginas}
                  </span>
                  <button
                    onClick={() => setFiltros(f => ({ ...f, pagina: (f.pagina || 1) + 1 }))}
                    disabled={dados.pagina >= dados.total_paginas}
                    className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
