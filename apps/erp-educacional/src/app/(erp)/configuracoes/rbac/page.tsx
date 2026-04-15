'use client'

import { useState, useEffect } from 'react'
import {
  Shield,
  Plus,
  Trash2,
  Save,
  Loader2,
  ArrowLeft,
  Check,
  Users,
  Lock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FlaskConical,
} from 'lucide-react'
import {
  Papel,
  PapelComPermissoes,
  ModuloSistema,
  ModuloComFuncionalidades,
  MapaPermissoes,
  AcaoPermissao,
} from '@/types/configuracoes'

// ─── TIPOS ───────────────────────────────────────────────────────────────────

interface PapelFormData {
  nome: string
  descricao: string
  cor: string
}

type ViewState = 'lista' | 'permissoes' | 'novo'

// ─── CORES DISPONÍVEIS ────────────────────────────────────────────────────────

const CORES_DISPONIVEIS = [
  { valor: '#DC2626', label: 'Vermelho', nome: 'red' },
  { valor: '#F97316', label: 'Laranja', nome: 'orange' },
  { valor: '#EAB308', label: 'Amarelo', nome: 'yellow' },
  { valor: '#22C55E', label: 'Verde', nome: 'green' },
  { valor: '#06B6D4', label: 'Ciano', nome: 'cyan' },
  { valor: '#0EA5E9', label: 'Azul', nome: 'blue' },
  { valor: '#6366F1', label: 'Indigo', nome: 'indigo' },
  { valor: '#A855F7', label: 'Roxo', nome: 'purple' },
  { valor: '#EC4899', label: 'Rosa', nome: 'pink' },
  { valor: '#64748B', label: 'Cinza', nome: 'slate' },
]

function getNomeCor(valor: string | null): string {
  return CORES_DISPONIVEIS.find(c => c.valor === valor)?.nome ?? 'indigo'
}

function getBgClass(valor: string | null) {
  const mapa: Record<string, string> = {
    red: 'bg-red-100', orange: 'bg-orange-100', yellow: 'bg-yellow-100',
    green: 'bg-green-100', cyan: 'bg-cyan-100', blue: 'bg-blue-100',
    indigo: 'bg-indigo-100', purple: 'bg-purple-100', pink: 'bg-pink-100', slate: 'bg-slate-100',
  }
  return mapa[getNomeCor(valor)] ?? 'bg-indigo-100'
}

function getBorderClass(valor: string | null) {
  const mapa: Record<string, string> = {
    red: 'border-red-300', orange: 'border-orange-300', yellow: 'border-yellow-300',
    green: 'border-green-300', cyan: 'border-cyan-300', blue: 'border-blue-300',
    indigo: 'border-indigo-300', purple: 'border-purple-300', pink: 'border-pink-300', slate: 'border-slate-300',
  }
  return mapa[getNomeCor(valor)] ?? 'border-indigo-300'
}

function getTextClass(valor: string | null) {
  const mapa: Record<string, string> = {
    red: 'text-red-700', orange: 'text-orange-700', yellow: 'text-yellow-700',
    green: 'text-green-700', cyan: 'text-cyan-700', blue: 'text-blue-700',
    indigo: 'text-indigo-700', purple: 'text-purple-700', pink: 'text-pink-700', slate: 'text-slate-700',
  }
  return mapa[getNomeCor(valor)] ?? 'text-indigo-700'
}

// ─── LABELS DAS AÇÕES ─────────────────────────────────────────────────────────

const ACOES_INFO: { acao: AcaoPermissao; label: string; cor: string }[] = [
  { acao: 'acessar',  label: 'Acessar',  cor: 'text-blue-600' },
  { acao: 'inserir',  label: 'Inserir',  cor: 'text-green-600' },
  { acao: 'alterar',  label: 'Alterar',  cor: 'text-yellow-600' },
  { acao: 'remover',  label: 'Remover',  cor: 'text-red-600' },
  { acao: 'especial', label: 'Especial', cor: 'text-purple-600' },
]

// ─── BADGE BETA ───────────────────────────────────────────────────────────────

function BetaBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full bg-amber-100 text-amber-700 border border-amber-300 ml-1.5 leading-none">
      <FlaskConical size={9} />
      Beta
    </span>
  )
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────

export default function RbacPage() {
  const [view, setView] = useState<ViewState>('lista')
  const [papeis, setPapeis] = useState<Papel[]>([])
  const [papelSelecionado, setPapelSelecionado] = useState<Papel | null>(null)
  const [hierarquia, setHierarquia] = useState<ModuloComFuncionalidades[]>([])
  const [mapaPermissoes, setMapaPermissoes] = useState<MapaPermissoes>({})
  const [modulosExpandidos, setModulosExpandidos] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState<PapelFormData>({
    nome: '',
    descricao: '',
    cor: '#6366F1',
  })

  useEffect(() => {
    if (view === 'lista') fetchPapeis()
  }, [view])

  // ─── DATA FETCHING ────────────────────────────────────────────────────────

  async function fetchPapeis() {
    try {
      setLoading(true)
      setError('')
      const res = await fetch('/api/configuracoes/rbac')
      const body = await res.json()
      if (!res.ok) throw new Error(body?.erro || 'Falha ao carregar papéis')
      const lista = Array.isArray(body) ? body : (body.dados ?? [])
      setPapeis(lista)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar papéis')
    } finally {
      setLoading(false)
    }
  }

  async function fetchPermissoesParaPapel(papelId: string) {
    try {
      setLoading(true)
      setError('')

      // Buscar hierarquia de módulos
      const resModulos = await fetch('/api/configuracoes/modulos')
      const modulosBody = await resModulos.json()
      if (!resModulos.ok) throw new Error(modulosBody?.erro || 'Falha ao carregar módulos')
      const hierarquiaData: ModuloComFuncionalidades[] = Array.isArray(modulosBody)
        ? modulosBody
        : (modulosBody.dados ?? [])
      setHierarquia(hierarquiaData)

      // Expandir todos os módulos por padrão
      setModulosExpandidos(new Set(hierarquiaData.map(m => m.slug)))

      // Buscar mapa de permissões do papel
      const resPerms = await fetch(`/api/configuracoes/rbac/${papelId}/permissoes`)
      const permsBody = await resPerms.json()
      if (!resPerms.ok) throw new Error(permsBody?.erro || 'Falha ao carregar permissões')
      const mapa: MapaPermissoes = permsBody.dados ?? permsBody
      setMapaPermissoes(mapa)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar permissões')
    } finally {
      setLoading(false)
    }
  }

  // ─── AÇÕES ────────────────────────────────────────────────────────────────

  function abrirPermissoes(papel: Papel) {
    setPapelSelecionado(papel)
    fetchPermissoesParaPapel(papel.id).then(() => setView('permissoes'))
  }

  function toggleModuloExpandido(slug: string) {
    setModulosExpandidos(prev => {
      const novo = new Set(prev)
      if (novo.has(slug)) novo.delete(slug)
      else novo.add(slug)
      return novo
    })
  }

  function togglePermissao(funcSlug: string, acao: AcaoPermissao) {
    setMapaPermissoes(prev => {
      const novo = { ...prev }
      if (novo[funcSlug]?.acoes[acao]) {
        novo[funcSlug] = {
          ...novo[funcSlug],
          acoes: {
            ...novo[funcSlug].acoes,
            [acao]: {
              ...novo[funcSlug].acoes[acao]!,
              habilitado: !novo[funcSlug].acoes[acao]!.habilitado,
            },
          },
        }
      }
      return novo
    })
  }

  /** Marcar/desmarcar TODAS as ações de uma funcionalidade */
  function toggleTodasAcoesFuncionalidade(funcSlug: string) {
    setMapaPermissoes(prev => {
      const entry = prev[funcSlug]
      if (!entry) return prev
      const todasHabilitadas = ACOES_INFO.every(a => entry.acoes[a.acao]?.habilitado)
      const novo = { ...prev }
      novo[funcSlug] = {
        ...entry,
        acoes: Object.fromEntries(
          ACOES_INFO.map(a => [
            a.acao,
            entry.acoes[a.acao]
              ? { ...entry.acoes[a.acao]!, habilitado: !todasHabilitadas }
              : entry.acoes[a.acao],
          ]).filter(([, v]) => v !== undefined)
        ) as MapaPermissoes[string]['acoes'],
      }
      return novo
    })
  }

  /** Marcar/desmarcar todas as funcionalidades de um módulo pai */
  function toggleTodasFuncionalidadesModulo(modulo: ModuloComFuncionalidades) {
    const slugsFuncionalidades = modulo.funcionalidades.length > 0
      ? modulo.funcionalidades.map(f => f.slug)
      : [modulo.slug] // pré-migração: o próprio módulo é a unidade

    const todasHabilitadas = slugsFuncionalidades.every(slug =>
      ACOES_INFO.every(a => mapaPermissoes[slug]?.acoes[a.acao]?.habilitado)
    )

    setMapaPermissoes(prev => {
      const novo = { ...prev }
      slugsFuncionalidades.forEach(slug => {
        if (!novo[slug]) return
        novo[slug] = {
          ...novo[slug],
          acoes: Object.fromEntries(
            ACOES_INFO.map(a => [
              a.acao,
              novo[slug].acoes[a.acao]
                ? { ...novo[slug].acoes[a.acao]!, habilitado: !todasHabilitadas }
                : novo[slug].acoes[a.acao],
            ]).filter(([, v]) => v !== undefined)
          ) as MapaPermissoes[string]['acoes'],
        }
      })
      return novo
    })
  }

  async function salvarPermissoes() {
    if (!papelSelecionado) return
    try {
      setLoading(true)
      setError('')
      const permissao_ids: string[] = []
      Object.values(mapaPermissoes).forEach(mod => {
        Object.values(mod.acoes).forEach(acao => {
          if (acao?.habilitado) permissao_ids.push(acao.permissao_id)
        })
      })
      const res = await fetch(`/api/configuracoes/rbac/${papelSelecionado.id}/permissoes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissao_ids }),
      })
      if (!res.ok) throw new Error('Falha ao salvar permissões')
      setSuccess('Permissões salvas com sucesso!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar permissões')
    } finally {
      setLoading(false)
    }
  }

  async function criarPapel() {
    try {
      setLoading(true)
      setError('')
      const res = await fetch('/api/configuracoes/rbac', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: formData.nome, descricao: formData.descricao || null, cor: formData.cor, tipo: 'custom' }),
      })
      if (!res.ok) throw new Error('Falha ao criar papel')
      setFormData({ nome: '', descricao: '', cor: '#6366F1' })
      setSuccess('Papel criado com sucesso!')
      setTimeout(() => { setSuccess(''); setView('lista'); fetchPapeis() }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar papel')
    } finally {
      setLoading(false)
    }
  }

  async function deletarPapel(papelId: string, tipo: string) {
    if (tipo === 'sistema') { setError('Não é possível deletar papéis do sistema'); return }
    if (!confirm('Tem certeza que deseja deletar este papel?')) return
    try {
      setLoading(true)
      setError('')
      const res = await fetch(`/api/configuracoes/rbac/${papelId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Falha ao deletar papel')
      setSuccess('Papel deletado com sucesso!')
      setTimeout(() => { setSuccess(''); fetchPapeis() }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar papel')
    } finally {
      setLoading(false)
    }
  }

  // ─── HELPERS UI ──────────────────────────────────────────────────────────

  function Mensagens() {
    return (
      <>
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <Check size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}
      </>
    )
  }

  // ─── VIEW: LISTA ──────────────────────────────────────────────────────────

  if (view === 'lista') {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Shield size={20} className="text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Papéis e Permissões</h1>
          </div>
          <p className="text-sm text-gray-600">
            Gerencie os papéis do sistema e configure permissões por funcionalidade.
          </p>
        </div>

        <button
          onClick={() => setView('novo')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          <Plus size={16} />
          Novo Papel
        </button>

        <Mensagens />

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="text-gray-400 animate-spin" />
          </div>
        )}

        {!loading && papeis.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Lock size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 text-sm">Nenhum papel criado ainda</p>
          </div>
        )}

        {!loading && papeis.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {papeis.map(papel => {
              const totalUsuarios = (papel as PapelComPermissoes).total_usuarios || 0
              return (
                <div
                  key={papel.id}
                  className={`p-5 rounded-xl border-2 ${getBorderClass(papel.cor)} ${getBgClass(papel.cor)} space-y-4`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className={`font-bold ${getTextClass(papel.cor)}`}>{papel.nome}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${papel.tipo === 'sistema' ? 'bg-gray-200 text-gray-700' : 'bg-blue-200 text-blue-700'}`}>
                        {papel.tipo === 'sistema' ? 'Sistema' : 'Customizado'}
                      </span>
                    </div>
                    {papel.descricao && <p className="text-xs text-gray-600">{papel.descricao}</p>}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Users size={14} />
                    <span>{totalUsuarios} usuário(s)</span>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-current border-opacity-20">
                    <button
                      onClick={() => abrirPermissoes(papel)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded font-medium text-sm transition-colors ${getTextClass(papel.cor)} hover:opacity-80`}
                    >
                      <Lock size={14} />
                      Permissões
                    </button>
                    {papel.tipo !== 'sistema' && (
                      <button
                        onClick={() => deletarPapel(papel.id, papel.tipo)}
                        className="p-2 rounded hover:bg-red-100 text-red-600 transition-colors"
                        title="Deletar papel"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ─── VIEW: NOVO PAPEL ─────────────────────────────────────────────────────

  if (view === 'novo') {
    return (
      <div className="max-w-2xl">
        <button
          onClick={() => setView('lista')}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors"
        >
          <ArrowLeft size={16} />
          Voltar à lista
        </button>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Novo Papel</h2>
            <p className="text-sm text-gray-600 mt-1">Crie um novo papel (role) customizado</p>
          </div>

          <Mensagens />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Nome</label>
            <input
              type="text"
              value={formData.nome}
              onChange={e => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              placeholder="ex: Gestor de Documentos"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Descrição (opcional)</label>
            <textarea
              value={formData.descricao}
              onChange={e => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
              placeholder="ex: Responsável pela geração e assinatura de diplomas"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Cor</label>
            <div className="grid grid-cols-5 gap-3">
              {CORES_DISPONIVEIS.map(cor => (
                <button
                  key={cor.valor}
                  onClick={() => setFormData(prev => ({ ...prev, cor: cor.valor }))}
                  className={`h-12 rounded-lg border-2 transition-all ${formData.cor === cor.valor ? 'border-gray-900 ring-2 ring-offset-2 ring-gray-900' : 'border-gray-200'}`}
                  style={{ backgroundColor: cor.valor }}
                  title={cor.label}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => { setFormData({ nome: '', descricao: '', cor: '#6366F1' }); setView('lista') }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={criarPapel}
              disabled={!formData.nome || loading}
              className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-sm transition-colors flex items-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Criar Papel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── VIEW: PERMISSÕES ─────────────────────────────────────────────────────

  if (view === 'permissoes' && papelSelecionado) {
    // Determinar se temos hierarquia real ou pré-migração
    const temFuncionalidades = hierarquia.some(m => m.funcionalidades.length > 0)

    return (
      <div className="max-w-6xl">
        <button
          onClick={() => { setView('lista'); setPapelSelecionado(null); setMapaPermissoes({}); setHierarquia([]) }}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors"
        >
          <ArrowLeft size={16} />
          Voltar à lista
        </button>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          {/* Cabeçalho */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: papelSelecionado.cor || '#6366F1' }}
                />
                <h2 className="text-xl font-bold text-gray-900">
                  Permissões — {papelSelecionado.nome}
                </h2>
              </div>
              <p className="text-sm text-gray-600">
                Configure o acesso por funcionalidade.
                {temFuncionalidades && (
                  <span className="ml-1 inline-flex items-center gap-1 text-amber-700">
                    <FlaskConical size={12} />
                    Itens <strong>Beta</strong> ficam visíveis apenas para Administradores da Instituição.
                  </span>
                )}
              </p>
            </div>
          </div>

          <Mensagens />

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="text-gray-400 animate-spin" />
            </div>
          )}

          {!loading && (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                {/* Cabeçalho da tabela */}
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 w-64">
                      Funcionalidade
                    </th>
                    {ACOES_INFO.map(({ acao, label, cor }) => (
                      <th
                        key={acao}
                        className={`px-3 py-3 text-center font-semibold whitespace-nowrap ${cor} w-20`}
                      >
                        <span className="text-xs">{label}</span>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 w-20">
                      Tudo
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {hierarquia.map(moduloPai => {
                    const expandido = modulosExpandidos.has(moduloPai.slug)

                    // Linhas a iterar: funcionalidades (pós-migração) ou o próprio módulo (pré-migração)
                    const itens: ModuloSistema[] = temFuncionalidades
                      ? moduloPai.funcionalidades
                      : [moduloPai]

                    // Contar permissões habilitadas neste módulo pai
                    const totalHabilitadas = itens.reduce((acc, item) => {
                      return acc + ACOES_INFO.filter(a => mapaPermissoes[item.slug]?.acoes[a.acao]?.habilitado).length
                    }, 0)
                    const totalPossivel = itens.reduce((acc, item) => {
                      return acc + ACOES_INFO.filter(a => !!mapaPermissoes[item.slug]?.acoes[a.acao]).length
                    }, 0)

                    return (
                      <>
                        {/* Linha de cabeçalho do módulo pai */}
                        <tr
                          key={`pai-${moduloPai.slug}`}
                          className="bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => toggleModuloExpandido(moduloPai.slug)}
                        >
                          <td className="px-4 py-2.5 font-semibold text-gray-800" colSpan={1}>
                            <div className="flex items-center gap-2">
                              {temFuncionalidades && (
                                expandido
                                  ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
                                  : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                              )}
                              <span className="text-sm font-semibold uppercase tracking-wider text-gray-600">
                                {moduloPai.nome}
                              </span>
                              {totalPossivel > 0 && (
                                <span className="ml-auto text-xs text-gray-400 font-normal">
                                  {totalHabilitadas}/{totalPossivel} permissões
                                </span>
                              )}
                            </div>
                          </td>
                          {/* Células vazias para alinhar com as colunas de ação */}
                          {ACOES_INFO.map(({ acao }) => (
                            <td key={acao} className="px-3 py-2.5" />
                          ))}
                          <td className="px-3 py-2.5 text-center">
                            {totalPossivel > 0 && (
                              <button
                                onClick={e => {
                                  e.stopPropagation()
                                  toggleTodasFuncionalidadesModulo(moduloPai)
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                title="Marcar/desmarcar tudo neste módulo"
                              >
                                ±
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* Linhas das funcionalidades (expandidas ou pré-migração) */}
                        {(!temFuncionalidades || expandido) && itens.map(item => {
                          const entry = mapaPermissoes[item.slug]
                          const todasHabilitadas = ACOES_INFO.every(a => entry?.acoes[a.acao]?.habilitado)

                          return (
                            <tr
                              key={item.slug}
                              className="hover:bg-blue-50/30 transition-colors"
                            >
                              <td className="px-4 py-3 text-gray-700">
                                <div className="flex items-center gap-2 pl-4">
                                  {temFuncionalidades && (
                                    <div className="w-px h-4 bg-gray-200 mr-1 flex-shrink-0" />
                                  )}
                                  <span className="font-medium text-sm">{item.nome}</span>
                                  {item.beta && <BetaBadge />}
                                </div>
                              </td>

                              {ACOES_INFO.map(({ acao }) => {
                                const permissao = entry?.acoes[acao]
                                const habilitado = permissao?.habilitado ?? false
                                const existe = !!permissao

                                return (
                                  <td key={acao} className="px-3 py-3 text-center">
                                    {existe ? (
                                      <label className="inline-flex items-center justify-center cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={habilitado}
                                          onChange={() => togglePermissao(item.slug, acao)}
                                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                      </label>
                                    ) : (
                                      <span className="text-gray-200 text-xs">—</span>
                                    )}
                                  </td>
                                )
                              })}

                              {/* Coluna "Tudo" */}
                              <td className="px-3 py-3 text-center">
                                {entry ? (
                                  <button
                                    onClick={() => toggleTodasAcoesFuncionalidade(item.slug)}
                                    title={todasHabilitadas ? 'Remover todas' : 'Conceder todas'}
                                    className={`w-6 h-6 rounded flex items-center justify-center mx-auto transition-colors ${
                                      todasHabilitadas
                                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                    }`}
                                  >
                                    <Check size={12} />
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                          )
                        })}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Legenda */}
          {!loading && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-2">
              <div className="flex items-center gap-1.5">
                <FlaskConical size={12} className="text-amber-600" />
                <span>Funcionalidades <strong className="text-amber-700">Beta</strong> aparecem apenas para Administradores da Instituição</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded border border-gray-300 bg-white flex items-center justify-center">
                  <Check size={9} className="text-gray-300" />
                </div>
                <span>Clique em <strong>Tudo</strong> para marcar/desmarcar todas as ações</span>
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => { setView('lista'); setPapelSelecionado(null); setMapaPermissoes({}); setHierarquia([]) }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={salvarPermissoes}
              disabled={loading}
              className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-sm transition-colors flex items-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              <Save size={16} />
              Salvar Permissões
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
