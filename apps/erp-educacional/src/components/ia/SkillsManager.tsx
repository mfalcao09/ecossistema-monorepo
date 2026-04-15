'use client'

/**
 * SkillsManager — Gerenciamento de Skills de IA
 * Renderiza na aba "Skills" da página /configuracoes/ia
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  BookOpen, Plus, Pencil, Trash2, Save, X,
  CheckCircle, AlertCircle, Loader2, Link2, Unlink,
  ChevronDown, ChevronUp, Zap, Brain, CheckSquare,
  Palette, Info, RefreshCw, Hash, Upload
} from 'lucide-react'

// ── Tipos ──────────────────────────────────────────────────────────────────

type TipoSkill = 'conhecimento' | 'procedimento' | 'validacao' | 'tom' | 'contexto'
type ModoVinculo = 'fixo' | 'condicional'

interface IASkill {
  id: string
  nome: string
  slug: string
  descricao: string | null
  conteudo: string
  tipo: TipoSkill
  categoria: string | null
  ativo: boolean
  versao: number
  tamanho_tokens: number | null
  created_at: string
  updated_at: string
  ia_agente_skills?: Array<{ agente_id: string; prioridade: number; modo: ModoVinculo }>
}

interface IAAgente {
  id: string
  nome_agente: string
  modulo: string
  funcionalidade: string | null
}

// ── Constantes de aparência ────────────────────────────────────────────────

const TIPO_CONFIG: Record<TipoSkill, { label: string; icon: React.ReactNode; cor: string; bg: string }> = {
  tom:          { label: 'Tom & Identidade', icon: <Palette size={14} />,     cor: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  validacao:    { label: 'Validação',        icon: <CheckSquare size={14} />, cor: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  procedimento: { label: 'Procedimento',     icon: <Zap size={14} />,         cor: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  conhecimento: { label: 'Conhecimento',     icon: <BookOpen size={14} />,    cor: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  contexto:     { label: 'Contexto',         icon: <Brain size={14} />,       cor: 'text-slate-700',  bg: 'bg-slate-50 border-slate-200' },
}

const TIPO_OPTIONS: TipoSkill[] = ['tom', 'validacao', 'procedimento', 'conhecimento', 'contexto']

// ── Componente Badge de Tipo ───────────────────────────────────────────────

function BadgeTipo({ tipo }: { tipo: TipoSkill }) {
  const cfg = TIPO_CONFIG[tipo]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.cor}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

// ── Modal de Edição ────────────────────────────────────────────────────────

interface InitialValues {
  nome?: string
  slug?: string
  descricao?: string
  conteudo?: string
  tipo?: TipoSkill
  categoria?: string
}

interface ModalSkillProps {
  skill: IASkill | null
  agentes: IAAgente[]
  initialValues?: InitialValues
  onClose: () => void
  onSaved: () => void
}

function ModalSkill({ skill, agentes, initialValues, onClose, onSaved }: ModalSkillProps) {
  const editando = !!skill

  const [form, setForm] = useState({
    nome:      skill?.nome      ?? initialValues?.nome      ?? '',
    slug:      skill?.slug      ?? initialValues?.slug      ?? '',
    descricao: skill?.descricao ?? initialValues?.descricao ?? '',
    conteudo:  skill?.conteudo  ?? initialValues?.conteudo  ?? '',
    tipo:      (skill?.tipo     ?? initialValues?.tipo      ?? 'conhecimento') as TipoSkill,
    categoria: skill?.categoria ?? initialValues?.categoria ?? '',
  })

  const [vinculosAtuais, setVinculosAtuais] = useState<
    Array<{ agente_id: string; prioridade: number; modo: ModoVinculo }>
  >(skill?.ia_agente_skills ?? [])

  const [saving, setSaving]     = useState(false)
  const [erro, setErro]         = useState<string | null>(null)
  const [charCount, setCharCount] = useState(skill?.conteudo?.length ?? initialValues?.conteudo?.length ?? 0)

  // Auto-gerar slug a partir do nome (só na criação)
  useEffect(() => {
    if (!editando && form.nome) {
      const slug = form.nome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 60)
      setForm(f => ({ ...f, slug }))
    }
  }, [form.nome, editando])

  function toggleAgente(agente_id: string) {
    setVinculosAtuais(prev => {
      const existe = prev.find(v => v.agente_id === agente_id)
      if (existe) return prev.filter(v => v.agente_id !== agente_id)
      return [...prev, { agente_id, prioridade: prev.length + 1, modo: 'fixo' }]
    })
  }

  function toggleModo(agente_id: string) {
    setVinculosAtuais(prev =>
      prev.map(v =>
        v.agente_id === agente_id
          ? { ...v, modo: v.modo === 'fixo' ? 'condicional' : 'fixo' }
          : v
      )
    )
  }

  async function salvar() {
    setErro(null)
    if (!form.nome.trim() || !form.slug.trim() || !form.conteudo.trim()) {
      setErro('Nome, slug e conteúdo são obrigatórios')
      return
    }
    setSaving(true)
    try {
      // 1. Salvar a skill
      const method = editando ? 'PUT' : 'POST'
      const url    = editando ? `/api/ia/skills/${skill!.id}` : '/api/ia/skills'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome:      form.nome.trim(),
          slug:      form.slug.trim(),
          descricao: form.descricao.trim() || null,
          conteudo:  form.conteudo.trim(),
          tipo:      form.tipo,
          categoria: form.categoria.trim() || null,
        }),
      })

      if (!res.ok) {
        const d = await res.json()
        setErro(d.error ?? 'Erro ao salvar skill')
        return
      }

      const savedSkill = await res.json()
      const skillId = savedSkill.id

      // 2. Sincronizar vínculos (apenas para agentes que mudaram)
      const originais = new Set((skill?.ia_agente_skills ?? []).map(v => v.agente_id))
      const novos     = new Set(vinculosAtuais.map(v => v.agente_id))

      // Adicionar novos vínculos
      for (const vinculo of vinculosAtuais) {
        if (!originais.has(vinculo.agente_id)) {
          await fetch('/api/ia/agente-skills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agente_id:  vinculo.agente_id,
              skill_id:   skillId,
              prioridade: vinculo.prioridade,
              modo:       vinculo.modo,
            }),
          })
        }
      }

      // Remover vínculos deletados
      for (const agente_id of originais) {
        if (!novos.has(agente_id)) {
          await fetch('/api/ia/agente-skills', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agente_id, skill_id: skillId }),
          })
        }
      }

      onSaved()
    } catch {
      setErro('Erro de rede ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const tokensEstimados = Math.ceil(form.conteudo.length / 4)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <BookOpen size={16} className="text-violet-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">
              {editando ? `Editar Skill` : 'Nova Skill'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Nome + Tipo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
              <input
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Tom de Comunicação FIC"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo *</label>
              <select
                value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoSkill }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
              >
                {TIPO_OPTIONS.map(t => (
                  <option key={t} value={t}>{TIPO_CONFIG[t].label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Slug + Categoria */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Slug * <span className="text-gray-400 font-normal">(identificador único)</span>
              </label>
              <div className="relative">
                <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                  placeholder="tom-comunicacao-fic"
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
              <input
                value={form.categoria}
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                placeholder="Ex: legislacao, processos_rh"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Descrição <span className="text-gray-400 font-normal">(quando usar esta skill)</span>
            </label>
            <input
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Descreva brevemente quando esta skill deve ser usada"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {/* Conteúdo (Markdown) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-600">
                Conteúdo (Markdown) *
              </label>
              <span className="text-xs text-gray-400">
                ~{tokensEstimados.toLocaleString()} tokens
                {tokensEstimados > 3000 && (
                  <span className="ml-1 text-amber-600">⚠ skill grande</span>
                )}
              </span>
            </div>
            <textarea
              value={form.conteudo}
              onChange={e => {
                setForm(f => ({ ...f, conteudo: e.target.value }))
                setCharCount(e.target.value.length)
              }}
              rows={12}
              placeholder={`## Título da Seção\n\nConteúdo da skill em markdown...\n\n## Outra Seção\n\nMais conteúdo...`}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">{charCount} caracteres</p>
          </div>

          {/* Vincular Agentes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Vincular a Agentes
              <span className="ml-1 text-gray-400 font-normal">(skills fixas são sempre injetadas no prompt)</span>
            </label>
            <div className="space-y-2">
              {agentes.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Nenhum agente configurado</p>
              ) : (
                agentes.map(agente => {
                  const vinculo = vinculosAtuais.find(v => v.agente_id === agente.id)
                  const selecionado = !!vinculo
                  return (
                    <div
                      key={agente.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                        selecionado ? 'border-violet-200 bg-violet-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <label className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => toggleAgente(agente.id)}>
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                          selecionado ? 'bg-violet-600 border-violet-600' : 'border-gray-300'
                        }`}>
                          {selecionado && <CheckCircle size={10} className="text-white" />}
                        </div>
                        <span className="text-sm font-medium text-gray-700">{agente.nome_agente}</span>
                        <span className="text-xs text-gray-400">{agente.modulo}{agente.funcionalidade ? ` · ${agente.funcionalidade}` : ''}</span>
                      </label>
                      {selecionado && (
                        <button
                          onClick={() => toggleModo(agente.id)}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium border transition-colors ${
                            vinculo?.modo === 'fixo'
                              ? 'bg-violet-100 text-violet-700 border-violet-200'
                              : 'bg-gray-100 text-gray-600 border-gray-200'
                          }`}
                          title="Clique para alternar entre Fixa e Condicional"
                        >
                          {vinculo?.modo === 'fixo' ? '🔒 Fixa' : '🔄 Condicional'}
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Info versão (edição) */}
          {editando && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-200">
              <Info size={14} className="text-gray-400" />
              <span className="text-xs text-gray-500">
                Versão {skill!.versao} · Última atualização: {new Date(skill!.updated_at).toLocaleDateString('pt-BR')}
                {skill!.tamanho_tokens && ` · ~${skill!.tamanho_tokens.toLocaleString()} tokens`}
              </span>
            </div>
          )}

          {/* Erro */}
          {erro && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
              <AlertCircle size={14} className="text-red-500" />
              <span className="text-xs text-red-600">{erro}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Salvando…' : 'Salvar Skill'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Card de Skill ──────────────────────────────────────────────────────────

interface SkillCardProps {
  skill: IASkill
  agentes: IAAgente[]
  onEdit: (skill: IASkill) => void
  onDelete: (skill: IASkill) => void
}

function SkillCard({ skill, agentes, onEdit, onDelete }: SkillCardProps) {
  const [expanded, setExpanded] = useState(false)
  const vinculosCount = skill.ia_agente_skills?.length ?? 0

  const agentesVinculados = (skill.ia_agente_skills ?? [])
    .map(v => {
      const ag = agentes.find(a => a.id === v.agente_id)
      return ag ? { ...ag, modo: v.modo } : null
    })
    .filter(Boolean) as Array<IAAgente & { modo: ModoVinculo }>

  return (
    <div className={`bg-white rounded-2xl border transition-all ${expanded ? 'border-gray-300 shadow-sm' : 'border-gray-200'}`}>
      {/* Header do card */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <BadgeTipo tipo={skill.tipo} />
            {!skill.ativo && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                Inativa
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-900 leading-tight">{skill.nome}</p>
          {skill.descricao && (
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{skill.descricao}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-xs text-gray-400 font-mono">#{skill.slug}</span>
            {skill.tamanho_tokens && (
              <span className="text-xs text-gray-400">~{skill.tamanho_tokens.toLocaleString()} tokens</span>
            )}
            <span className="text-xs text-gray-400">v{skill.versao}</span>
            {vinculosCount > 0 ? (
              <span className="text-xs text-violet-600 font-medium flex items-center gap-0.5">
                <Link2 size={10} />
                {vinculosCount} agente{vinculosCount > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-xs text-gray-400 flex items-center gap-0.5">
                <Unlink size={10} />
                Sem vínculo
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={e => { e.stopPropagation(); onEdit(skill) }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Editar skill"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(skill) }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Desativar skill"
          >
            <Trash2 size={14} />
          </button>
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </div>

      {/* Expandido: detalhes */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
          {/* Agentes vinculados */}
          {agentesVinculados.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Agentes vinculados</p>
              <div className="flex flex-wrap gap-1.5">
                {agentesVinculados.map(ag => (
                  <span key={ag.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-violet-50 border border-violet-200 text-violet-700">
                    {ag.nome_agente}
                    <span className="text-violet-400">· {ag.modo === 'fixo' ? '🔒' : '🔄'}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* Preview do conteúdo */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Conteúdo (prévia)</p>
            <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 overflow-x-auto max-h-32 whitespace-pre-wrap font-mono border border-gray-100">
              {skill.conteudo?.slice(0, 400)}{(skill.conteudo?.length ?? 0) > 400 ? '…' : ''}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Utilitário: Parse de arquivo .md ─────────────────────────────────────

function parseMdFile(content: string, filename: string): InitialValues {
  const lines = content.split('\n')

  // Nome: primeiro header # do arquivo
  let nome = ''
  let headerIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('# ')) {
      nome = lines[i].slice(2).trim()
      headerIdx = i
      break
    }
  }
  // Fallback: usar nome do arquivo
  if (!nome) {
    nome = filename
      .replace(/\.md$/i, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
  }

  // Slug: gerado a partir do nome
  const slug = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)

  // Descrição: primeiro parágrafo após o header (não-header, não vazio)
  let descricao = ''
  const startIdx = headerIdx >= 0 ? headerIdx + 1 : 0
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line && !line.startsWith('#') && !line.startsWith('---')) {
      descricao = line.length > 200 ? line.slice(0, 197) + '…' : line
      break
    }
  }

  return { nome, slug, descricao, conteudo: content, tipo: 'conhecimento' }
}

// ── Componente Principal ───────────────────────────────────────────────────

export default function SkillsManager() {
  const [skills, setSkills]     = useState<IASkill[]>([])
  const [agentes, setAgentes]   = useState<IAAgente[]>([])
  const [loading, setLoading]   = useState(true)
  const [erro, setErro]         = useState<string | null>(null)
  const [modal, setModal]       = useState<{ open: boolean; skill: IASkill | null; initialValues?: InitialValues }>({ open: false, skill: null })
  const [deletando, setDeletando] = useState<string | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<TipoSkill | 'todos'>('todos')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleImportarMd(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Resetar input para permitir selecionar o mesmo arquivo novamente
    e.target.value = ''

    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      if (!content) return
      const parsed = parseMdFile(content, file.name)
      setModal({ open: true, skill: null, initialValues: parsed })
    }
    reader.readAsText(file, 'UTF-8')
  }

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const [resSkills, resAgentes] = await Promise.all([
        fetch('/api/ia/skills'),
        fetch('/api/ia-configuracoes'),
      ])
      if (!resSkills.ok) throw new Error('Erro ao carregar skills')
      if (!resAgentes.ok) throw new Error('Erro ao carregar agentes')

      const [dataSkills, dataAgentes] = await Promise.all([
        resSkills.json(),
        resAgentes.json(),
      ])

      setSkills(dataSkills)
      setAgentes(dataAgentes)
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function handleDelete(skill: IASkill) {
    if (!confirm(`Desativar a skill "${skill.nome}"?\n\nEla ficará inativa mas não será excluída do banco.`)) return
    setDeletando(skill.id)
    try {
      await fetch(`/api/ia/skills/${skill.id}`, { method: 'DELETE' })
      await carregar()
    } finally {
      setDeletando(null)
    }
  }

  // Filtrar + agrupar por tipo
  const skillsFiltradas = filtroTipo === 'todos'
    ? skills
    : skills.filter(s => s.tipo === filtroTipo)

  const skillsAtivas   = skillsFiltradas.filter(s => s.ativo)
  const skillsInativas = skillsFiltradas.filter(s => !s.ativo)

  const totalTokens = skills.filter(s => s.ativo).reduce((sum, s) => sum + (s.tamanho_tokens ?? 0), 0)

  return (
    <div className="space-y-5">
      {/* Header de stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4">
          <p className="text-xs text-violet-600 font-medium mb-0.5">Skills ativas</p>
          <p className="text-2xl font-bold text-violet-800">{skills.filter(s => s.ativo).length}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <p className="text-xs text-blue-600 font-medium mb-0.5">Tokens totais</p>
          <p className="text-2xl font-bold text-blue-800">~{(totalTokens / 1000).toFixed(1)}k</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
          <p className="text-xs text-green-600 font-medium mb-0.5">Agentes configurados</p>
          <p className="text-2xl font-bold text-green-800">{agentes.length}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Filtro por tipo */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFiltroTipo('todos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filtroTipo === 'todos' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Todas
          </button>
          {TIPO_OPTIONS.map(tipo => (
            <button
              key={tipo}
              onClick={() => setFiltroTipo(tipo)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filtroTipo === tipo
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {TIPO_CONFIG[tipo].label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={carregar}
            disabled={loading}
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Recarregar"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          {/* Importar .md */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
            title="Importar arquivo .md como nova skill"
          >
            <Upload size={15} />
            Importar .md
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,text/markdown"
            className="hidden"
            onChange={handleImportarMd}
          />
          <button
            onClick={() => setModal({ open: true, skill: null })}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={15} />
            Nova Skill
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" />
          Carregando skills…
        </div>
      ) : erro ? (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle size={16} className="text-red-500" />
          <span className="text-sm text-red-600">{erro}</span>
        </div>
      ) : skillsAtivas.length === 0 && skillsInativas.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <BookOpen size={32} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">Nenhuma skill encontrada</p>
          <p className="text-xs mt-1">Crie a primeira skill clicando em "Nova Skill"</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Skills ativas */}
          {skillsAtivas.map(skill => (
            <SkillCard
              key={skill.id}
              skill={skill}
              agentes={agentes}
              onEdit={s => setModal({ open: true, skill: s })}
              onDelete={handleDelete}
            />
          ))}

          {/* Skills inativas */}
          {skillsInativas.length > 0 && (
            <details className="group">
              <summary className="text-xs text-gray-400 cursor-pointer select-none hover:text-gray-600 mt-4 mb-2">
                {skillsInativas.length} skill{skillsInativas.length > 1 ? 's' : ''} inativa{skillsInativas.length > 1 ? 's' : ''} (clique para ver)
              </summary>
              <div className="space-y-2 mt-2">
                {skillsInativas.map(skill => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    agentes={agentes}
                    onEdit={s => setModal({ open: true, skill: s })}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <ModalSkill
          skill={modal.skill}
          agentes={agentes}
          initialValues={modal.initialValues}
          onClose={() => setModal({ open: false, skill: null })}
          onSaved={async () => {
            setModal({ open: false, skill: null })
            await carregar()
          }}
        />
      )}
    </div>
  )
}
