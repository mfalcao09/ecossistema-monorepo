'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Bot, Plus, Trash2, Save, ChevronDown, ChevronUp,
  Cpu, Thermometer, Key, Info, AlertTriangle, Check,
  Sparkles, RefreshCw, Loader2, Globe, Zap, Eye, EyeOff,
  Server, BookOpen
} from 'lucide-react'
import SkillsManager from '@/components/ia/SkillsManager'

// ----------- Tipos -----------

interface IAConfig {
  id: string
  modulo: string
  funcionalidade?: string | null
  nome_agente: string
  persona: string
  modelo: string
  temperatura: number
  ativo: boolean
  provider_id?: string | null
  created_at?: string
  updated_at?: string
}

interface IAProvider {
  id: string
  nome: string
  slug: string
  base_url: string
  api_key: string
  formato_api: string
  headers_extras: Record<string, string>
  modelos_disponiveis: Array<{ id: string; name: string }>
  modelos_atualizados_em: string | null
  ativo: boolean
  ordem: number
}

const MODULOS = [
  { value: 'global', label: 'Global (todos os módulos)', cor: 'bg-slate-600' },
  { value: 'cadastro', label: 'Cadastro', cor: 'bg-blue-500' },
  { value: 'diploma', label: 'Diploma Digital', cor: 'bg-violet-600' },
  { value: 'alunos', label: 'Alunos', cor: 'bg-emerald-600' },
  { value: 'documentos', label: 'Documentos', cor: 'bg-amber-600' },
  { value: 'relatorios', label: 'Relatórios', cor: 'bg-rose-600' },
  { value: 'migracao', label: 'Migração de Diplomas', cor: 'bg-orange-600' },
]

const FUNCIONALIDADES: Record<string, Array<{ value: string; label: string }>> = {
  cadastro: [
    { value: 'extracao_cursos', label: 'Extração de Dados de Cursos (Agente IA)' },
    { value: 'auditoria_cursos', label: 'Auditoria de Cursos' },
    { value: 'extracao_ies', label: 'Extração de Dados de IES' },
    { value: 'extracao_alunos', label: 'Extração de Dados de Alunos' },
  ],
  diploma: [
    { value: 'geracao_xml', label: 'Geração de XML' },
    { value: 'validacao_dados', label: 'Validação de Dados do Diploma' },
    { value: 'revisao_historico', label: 'Revisão do Histórico Escolar' },
    { value: 'importacao_lote', label: 'Importação em Lote (Migração)' },
    { value: 'processamento_dados', label: 'Processamento de Dados do Diploma (Agente IA)' },
    { value: 'digitalizacao_documentos', label: 'Digitalização e Tratamento de Imagens (Agente IA)' },
  ],
  alunos: [
    { value: 'extracao_alunos', label: 'Extração de Dados de Alunos' },
    { value: 'analise_academica', label: 'Análise Acadêmica' },
  ],
  documentos: [
    { value: 'classificacao_docs', label: 'Classificação de Documentos' },
    { value: 'extracao_docs', label: 'Extração de Dados de Documentos' },
  ],
  relatorios: [
    { value: 'analise_relatorio', label: 'Análise de Relatórios' },
  ],
  migracao: [
    { value: 'importacao_lote', label: 'Importação em Lote (Legado)' },
    { value: 'validacao_legado', label: 'Validação de Dados Legados' },
  ],
}

const PROVIDER_CORES: Record<string, { bg: string; text: string; icon: string }> = {
  openrouter: { bg: 'bg-slate-800', text: 'text-white', icon: '🌐' },
  google: { bg: 'bg-blue-600', text: 'text-white', icon: '🔵' },
  anthropic: { bg: 'bg-orange-600', text: 'text-white', icon: '🟠' },
  openai: { bg: 'bg-emerald-700', text: 'text-white', icon: '🟢' },
}

const DEFAULT_PERSONA = `Você é um assistente especializado do sistema FIC (Faculdades Integradas de Cassilândia).
Sua função é auxiliar a equipe administrativa com informações precisas, linguagem clara e objetiva.
Sempre priorize conformidade com a regulamentação do MEC e boas práticas de gestão educacional.`

// ----------- Componente ProviderCard -----------

function ProviderCard({
  provider,
  onUpdate,
}: {
  provider: IAProvider
  onUpdate: (updated: IAProvider) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [testando, setTestando] = useState(false)
  const [testeResult, setTesteResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [local, setLocal] = useState(provider)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => { setLocal(provider) }, [provider])

  const cores = PROVIDER_CORES[local.slug] ?? { bg: 'bg-gray-600', text: 'text-white', icon: '⚙️' }

  async function testarConexao() {
    setTestando(true)
    setTesteResult(null)
    try {
      const res = await fetch(`/api/ia-providers/${provider.id}/testar`, { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setTesteResult({ ok: true, msg: data.mensagem || `Conectado! ${data.modelos} modelos.` })
        // Recarregar provider com modelos atualizados
        const provRes = await fetch('/api/ia-providers')
        const provs = await provRes.json()
        const updated = provs.find((p: IAProvider) => p.id === provider.id)
        if (updated) onUpdate(updated)
      } else {
        setTesteResult({ ok: false, msg: data.erro || 'Falha na conexão' })
      }
    } catch {
      setTesteResult({ ok: false, msg: 'Erro de rede' })
    } finally {
      setTestando(false)
    }
  }

  async function salvar() {
    setSaving(true)
    try {
      const res = await fetch(`/api/ia-providers/${provider.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: local.nome,
          base_url: local.base_url,
          api_key: local.api_key,
          formato_api: local.formato_api,
          ativo: local.ativo,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        onUpdate(data)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } finally {
      setSaving(false)
    }
  }

  const totalModelos = local.modelos_disponiveis?.length ?? 0

  return (
    <div className={`bg-white rounded-2xl border transition-all ${expanded ? 'border-gray-300 shadow-sm' : 'border-gray-200'}`}>
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cores.bg}`}>
          <span className="text-sm">{cores.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-none mb-0.5 truncate">
            {local.nome}
          </p>
          <p className="text-xs text-gray-400 truncate">
            {local.formato_api} · {totalModelos} modelos
            {local.modelos_atualizados_em && (
              <span className="ml-1">· atualizado {new Date(local.modelos_atualizados_em).toLocaleDateString('pt-BR')}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`inline-block w-2 h-2 rounded-full ${local.ativo ? 'bg-emerald-400' : 'bg-gray-300'}`} />
          <span className="text-xs text-gray-400">{local.ativo ? 'Ativo' : 'Inativo'}</span>
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
          {/* Nome + Formato */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
              <input
                type="text"
                value={local.nome}
                onChange={e => setLocal(l => ({ ...l, nome: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Formato da API</label>
              <select
                value={local.formato_api}
                onChange={e => setLocal(l => ({ ...l, formato_api: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="openai_compatible">OpenAI Compatible</option>
                <option value="google_genai">Google Generative AI</option>
                <option value="anthropic_messages">Anthropic Messages</option>
              </select>
            </div>
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
              <Globe size={11} />
              Base URL
            </label>
            <input
              type="text"
              value={local.base_url}
              onChange={e => setLocal(l => ({ ...l, base_url: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
              <Key size={11} />
              Chave de API
            </label>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={local.api_key}
                onChange={e => setLocal(l => ({ ...l, api_key: e.target.value }))}
                placeholder="Insira a chave da API..."
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <button
                onClick={() => setShowKey(s => !s)}
                className="px-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                title={showKey ? 'Ocultar' : 'Mostrar'}
              >
                {showKey ? <EyeOff size={14} className="text-gray-500" /> : <Eye size={14} className="text-gray-500" />}
              </button>
            </div>
          </div>

          {/* Toggle ativo */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Provider ativo</span>
            <button
              onClick={() => setLocal(l => ({ ...l, ativo: !l.ativo }))}
              className={`relative w-9 h-5 rounded-full transition-colors ${local.ativo ? 'bg-emerald-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${local.ativo ? 'left-4' : 'left-0.5'}`} />
            </button>
          </div>

          {/* Ações */}
          <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
            <div className="flex gap-2">
              <button
                onClick={testarConexao}
                disabled={testando}
                className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors disabled:opacity-40"
              >
                {testando
                  ? <><Loader2 size={11} className="animate-spin" />Testando…</>
                  : <><Zap size={11} />Testar + Atualizar modelos</>
                }
              </button>
            </div>
            <button
              onClick={salvar}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                saved ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {saving ? <><RefreshCw size={14} className="animate-spin" />Salvando…</>
                : saved ? <><Check size={14} />Salvo!</>
                : <><Save size={14} />Salvar</>
              }
            </button>
          </div>

          {testeResult && (
            <div className={`text-xs flex items-center gap-1 p-2 rounded-lg ${testeResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {testeResult.ok ? <Check size={12} /> : <AlertTriangle size={12} />}
              {testeResult.msg}
            </div>
          )}

          {/* Info modelos */}
          {totalModelos > 0 && (
            <div className="text-xs text-gray-400 flex items-center gap-1">
              <Server size={11} />
              {totalModelos} modelos disponíveis
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ----------- Componente AgentCard -----------

function AgentCard({
  agente,
  onUpdate,
  onDelete,
  isNew,
  providers,
}: {
  agente: IAConfig
  onUpdate: (id: string, data: Partial<IAConfig>) => void
  onDelete: (id: string) => void
  isNew?: boolean
  providers: IAProvider[]
}) {
  const [expanded, setExpanded] = useState(isNew ?? false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [local, setLocal] = useState<IAConfig>(agente)

  useEffect(() => { setLocal(agente) }, [agente])

  const moduloCor = MODULOS.find(m => m.value === local.modulo)?.cor ?? 'bg-gray-400'
  const moduloLabel = MODULOS.find(m => m.value === local.modulo)?.label ?? local.modulo
  const funcLabel = local.funcionalidade
    ? (FUNCIONALIDADES[local.modulo]?.find(f => f.value === local.funcionalidade)?.label ?? local.funcionalidade)
    : null
  const funcOpcoes = FUNCIONALIDADES[local.modulo] ?? []

  // Provider + modelos
  const selectedProvider = providers.find(p => p.id === local.provider_id)
  const modelosDoProvider = selectedProvider?.modelos_disponiveis ?? []
  const activeProviders = providers.filter(p => p.ativo)

  async function salvar() {
    setSaving(true)
    try {
      const payload = {
        modulo: local.modulo,
        funcionalidade: local.funcionalidade ?? null,
        nome_agente: local.nome_agente,
        persona: local.persona,
        modelo: local.modelo,
        temperatura: local.temperatura,
        ativo: local.ativo,
        provider_id: local.provider_id ?? null,
      }

      const res = agente.id.startsWith('new_')
        ? await fetch('/api/ia-configuracoes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/ia-configuracoes/${agente.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      if (res.ok) {
        const data = await res.json()
        onUpdate(agente.id, data)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } finally {
      setSaving(false)
    }
  }

  const tempLabel =
    local.temperatura <= 0.2 ? 'Determinístico' :
    local.temperatura <= 0.5 ? 'Preciso' :
    local.temperatura <= 0.8 ? 'Equilibrado' :
    'Criativo'

  const tempCor =
    local.temperatura <= 0.2 ? 'text-blue-600' :
    local.temperatura <= 0.5 ? 'text-emerald-600' :
    local.temperatura <= 0.8 ? 'text-amber-600' :
    'text-rose-600'

  const providerLabel = selectedProvider?.nome ?? 'Nenhum'

  return (
    <div className={`bg-white rounded-2xl border transition-all ${expanded ? 'border-gray-300 shadow-sm' : 'border-gray-200'}`}>
      {/* Cabeçalho */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${moduloCor}`}>
          <Bot size={17} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-none mb-0.5 truncate">
            {local.nome_agente || 'Agente sem nome'}
          </p>
          <p className="text-xs text-gray-400 truncate">
            {moduloLabel}{funcLabel ? <span className="text-violet-500 ml-1">· {funcLabel}</span> : null}
            <span className="text-gray-300 ml-1">· {providerLabel}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); setLocal(l => ({ ...l, ativo: !l.ativo })) }}
            className={`relative w-9 h-5 rounded-full transition-colors ${local.ativo ? 'bg-emerald-500' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${local.ativo ? 'left-4' : 'left-0.5'}`} />
          </button>
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </div>

      {/* Corpo expandido */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
          {/* Nome + Módulo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome do Agente</label>
              <input
                type="text"
                value={local.nome_agente}
                onChange={e => setLocal(l => ({ ...l, nome_agente: e.target.value }))}
                placeholder="Ex: Assistente de Cadastro"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Módulo</label>
              <select
                value={local.modulo}
                onChange={e => setLocal(l => ({ ...l, modulo: e.target.value, funcionalidade: null }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {MODULOS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Funcionalidade */}
          {funcOpcoes.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                <Sparkles size={11} />
                Funcionalidade específica
                <span className="text-gray-400 font-normal ml-1">(opcional)</span>
              </label>
              <select
                value={local.funcionalidade ?? ''}
                onChange={e => setLocal(l => ({ ...l, funcionalidade: e.target.value || null }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
              >
                <option value="">— Agente padrão do módulo —</option>
                {funcOpcoes.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Provider + Modelo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                <Server size={12} />
                Provider
              </label>
              <select
                value={local.provider_id ?? ''}
                onChange={e => {
                  const newProviderId = e.target.value || null
                  const newProvider = providers.find(p => p.id === newProviderId)
                  setLocal(l => ({
                    ...l,
                    provider_id: newProviderId,
                    // Se mudou de provider, limpa modelo para forçar seleção
                    modelo: newProvider?.modelos_disponiveis?.[0]?.id ?? l.modelo,
                  }))
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">— Selecione —</option>
                {activeProviders.map(p => (
                  <option key={p.id} value={p.id}>
                    {PROVIDER_CORES[p.slug]?.icon ?? '⚙️'} {p.nome} ({p.modelos_disponiveis?.length ?? 0} modelos)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                <Cpu size={12} />
                Modelo
              </label>
              {modelosDoProvider.length > 0 ? (
                <select
                  value={local.modelo}
                  onChange={e => setLocal(l => ({ ...l, modelo: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {/* Inclui o valor atual caso não esteja na lista */}
                  {local.modelo && !modelosDoProvider.some(m => m.id === local.modelo) && (
                    <option value={local.modelo}>{local.modelo} (atual)</option>
                  )}
                  {modelosDoProvider.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={local.modelo}
                  onChange={e => setLocal(l => ({ ...l, modelo: e.target.value }))}
                  placeholder="ex: anthropic/claude-sonnet-4.6"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              )}
            </div>
          </div>
          <p className="text-xs text-gray-400 -mt-2">
            Modelo: <code className="bg-gray-100 px-1 rounded text-xs">{local.modelo}</code>
          </p>

          {/* Temperatura */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                <Thermometer size={12} />
                Temperatura
              </label>
              <span className={`text-xs font-semibold ${tempCor}`}>
                {local.temperatura.toFixed(1)} — {tempLabel}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={local.temperatura}
              onChange={e => setLocal(l => ({ ...l, temperatura: parseFloat(e.target.value) }))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>0.0 Determinístico</span>
              <span>1.0 Criativo</span>
            </div>
          </div>

          {/* Persona */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                <Sparkles size={12} />
                Persona (System Prompt)
              </label>
              <button
                onClick={() => setLocal(l => ({ ...l, persona: DEFAULT_PERSONA }))}
                className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
              >
                <RefreshCw size={10} />
                Usar padrão
              </button>
            </div>
            <textarea
              value={local.persona}
              onChange={e => setLocal(l => ({ ...l, persona: e.target.value }))}
              rows={5}
              placeholder="Descreva como o agente deve se comportar..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">
              {local.persona.length} caracteres
            </p>
          </div>

          {/* Ações */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => onDelete(agente.id)}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors"
            >
              <Trash2 size={13} />
              Excluir agente
            </button>
            <button
              onClick={salvar}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                saved ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {saving ? <><RefreshCw size={14} className="animate-spin" />Salvando…</>
                : saved ? <><Check size={14} />Salvo!</>
                : <><Save size={14} />Salvar agente</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ----------- Página principal -----------

export default function ConfiguracoesIA() {
  const [tab, setTab] = useState<'providers' | 'agentes' | 'skills'>('providers')
  const [providers, setProviders] = useState<IAProvider[]>([])
  const [agentes, setAgentes] = useState<IAConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroModulo, setFiltroModulo] = useState('todos')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [provRes, agRes] = await Promise.all([
        fetch('/api/ia-providers'),
        fetch('/api/ia-configuracoes'),
      ])
      const provData = await provRes.json()
      const agData = await agRes.json()
      setProviders(Array.isArray(provData) ? provData : [])
      setAgentes(Array.isArray(agData) ? agData : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function handleProviderUpdate(updated: IAProvider) {
    setProviders(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  function novoAgente() {
    const defaultProvider = providers.find(p => p.ativo)
    const temp: IAConfig = {
      id: `new_${Date.now()}`,
      modulo: 'global',
      nome_agente: '',
      persona: DEFAULT_PERSONA,
      modelo: defaultProvider?.modelos_disponiveis?.[0]?.id ?? 'anthropic/claude-sonnet-4.6',
      temperatura: 0.7,
      ativo: true,
      provider_id: defaultProvider?.id ?? null,
    }
    setFiltroModulo('todos')
    setAgentes(prev => [temp, ...prev])
    setTab('agentes')
  }

  function handleAgentUpdate(id: string, data: Partial<IAConfig>) {
    setAgentes(prev => prev.map(a => a.id === id ? { ...a, ...data } : a))
  }

  async function handleAgentDelete(id: string) {
    if (id.startsWith('new_')) {
      setAgentes(prev => prev.filter(a => a.id !== id))
      return
    }
    if (!confirm('Excluir este agente?')) return
    const res = await fetch(`/api/ia-configuracoes/${id}`, { method: 'DELETE' })
    if (res.ok) setAgentes(prev => prev.filter(a => a.id !== id))
  }

  const agentesFiltrados = filtroModulo === 'todos'
    ? agentes
    : agentes.filter(a => a.modulo === filtroModulo)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Bot size={26} className="text-violet-600" />
          IA e Agentes
        </h1>
        <p className="text-gray-500 mt-1">
          Configure providers de IA, modelos e comportamento dos agentes em cada módulo
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setTab('providers')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === 'providers' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Key size={15} />
          Providers ({providers.length})
        </button>
        <button
          onClick={() => setTab('agentes')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === 'agentes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Bot size={15} />
          Agentes ({agentes.filter(a => !a.id.startsWith('new_')).length})
        </button>
        <button
          onClick={() => setTab('skills')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === 'skills' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <BookOpen size={15} />
          Skills
        </button>
      </div>

      {/* Tab: Providers */}
      {tab === 'providers' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
            <Info size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              Cada provider é uma fonte de modelos de IA. Configure a chave API e clique em &quot;Testar + Atualizar modelos&quot; para descobrir os modelos disponíveis automaticamente.
            </p>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : providers.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Key size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum provider configurado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {providers.map(p => (
                <ProviderCard
                  key={p.id}
                  provider={p}
                  onUpdate={handleProviderUpdate}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Agentes */}
      {tab === 'agentes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">
                {agentes.filter(a => a.ativo && !a.id.startsWith('new_')).length} ativo{agentes.filter(a => a.ativo && !a.id.startsWith('new_')).length !== 1 ? 's' : ''} de {agentes.filter(a => !a.id.startsWith('new_')).length} total
              </p>
            </div>
            <button
              onClick={novoAgente}
              className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-3 py-2 rounded-xl hover:bg-blue-700 transition-colors"
            >
              <Plus size={15} />
              Novo agente
            </button>
          </div>

          {/* Filtro */}
          <div className="flex gap-2 flex-wrap">
            {[{ value: 'todos', label: 'Todos' }, ...MODULOS].map(m => (
              <button
                key={m.value}
                onClick={() => setFiltroModulo(m.value)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  filtroModulo === m.value
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Lista */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : agentesFiltrados.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Bot size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum agente configurado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {agentesFiltrados.map(ag => (
                <AgentCard
                  key={ag.id}
                  agente={ag}
                  onUpdate={handleAgentUpdate}
                  onDelete={handleAgentDelete}
                  isNew={ag.id.startsWith('new_')}
                  providers={providers}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Skills */}
      {tab === 'skills' && <SkillsManager />}

      {/* Info */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5">
          <Sparkles size={14} className="text-violet-600" />
          Como funciona
        </h3>
        <div className="space-y-2 text-xs text-slate-600">
          <p>
            <strong>Providers</strong> — são as fontes de IA (OpenRouter, Google AI, Anthropic, OpenAI). Cada um tem sua própria chave e lista de modelos.
          </p>
          <p>
            <strong>Agentes</strong> — cada agente é associado a um provider e um modelo. Agentes com funcionalidade específica são usados antes de agentes genéricos do módulo.
          </p>
          <p>
            <strong>Skills</strong> — blocos de conhecimento em Markdown injetados no system prompt dos agentes. Skills fixas são sempre incluídas; skills RAG são buscadas por similaridade semântica (Fase 3).
          </p>
          <p>
            <strong>Google AI + PDFs</strong> — O Gemini via Google AI aceita PDFs nativos (sem converter para imagem), o que melhora significativamente a qualidade da extração de dados.
          </p>
        </div>
      </div>
    </div>
  )
}
