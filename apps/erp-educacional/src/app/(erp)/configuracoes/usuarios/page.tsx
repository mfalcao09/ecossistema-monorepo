'use client'

import { useState, useEffect } from 'react'
import { Users, Plus, Shield, Mail, Pencil, X, Loader2, CheckCircle, AlertCircle, Phone, Info } from 'lucide-react'
import { fetchSeguro } from '@/lib/security/fetch-seguro'

interface Usuario {
  id: string
  full_name: string
  email: string
  role: string
  cargos_academicos: string[] | null
  status: string
  telefone: string | null
  observacoes: string | null
}

// ─── DIMENSÃO 1: Perfil de Acesso ao ERP ──────────────────────────────────────
// Define O QUE a pessoa pode fazer no sistema.
// Independente de qual cargo acadêmico ela ocupa na instituição.
// Ex: o Diretor Geral pode ter perfil ERP "administradores_instituicao" OU
//     ter perfil "diretoria" — dependendo do que a FIC decidir para ele.
const PERFIS_ERP: { value: string; label: string; descricao: string; cor: string }[] = [
  {
    value: 'admin_instituicao',
    label: 'Administradores da Instituição',
    descricao: 'Acesso completo a todas as funções do sistema',
    cor: 'bg-red-100 text-red-700',
  },
  {
    value: 'aux_bibliotecaria',
    label: 'Auxiliar Bibliotecária',
    descricao: 'Acesso ao módulo de biblioteca e acervo',
    cor: 'bg-purple-100 text-purple-700',
  },
  {
    value: 'aux_financeiro',
    label: 'Auxiliar Financeiro',
    descricao: 'Acesso ao módulo financeiro',
    cor: 'bg-yellow-100 text-yellow-700',
  },
  {
    value: 'aux_secretaria',
    label: 'Auxiliar Secretaria',
    descricao: 'Acesso à secretaria acadêmica e registros',
    cor: 'bg-blue-100 text-blue-700',
  },
  {
    value: 'bibliotecaria',
    label: 'Bibliotecária',
    descricao: 'Gestão completa da biblioteca',
    cor: 'bg-violet-100 text-violet-700',
  },
  {
    value: 'cadastramento',
    label: 'Cadastramento',
    descricao: 'Acesso ao módulo de cadastro de dados',
    cor: 'bg-cyan-100 text-cyan-700',
  },
  {
    value: 'comunidade',
    label: 'Comunidade',
    descricao: 'Acesso restrito — perfil externo/comunidade',
    cor: 'bg-gray-100 text-gray-600',
  },
  {
    value: 'coordenacao_curso',
    label: 'Coordenação de Curso',
    descricao: 'Acesso à coordenação acadêmica e diplomas',
    cor: 'bg-indigo-100 text-indigo-700',
  },
  {
    value: 'diretoria',
    label: 'Diretoria',
    descricao: 'Acesso gerencial e relatórios executivos',
    cor: 'bg-orange-100 text-orange-700',
  },
  {
    value: 'estudantes',
    label: 'Estudantes',
    descricao: 'Acesso ao portal do estudante',
    cor: 'bg-emerald-100 text-emerald-700',
  },
]

// Mapas de lookup rápido
const PERFIL_LABELS: Record<string, string> = Object.fromEntries(
  PERFIS_ERP.map(p => [p.value, p.label])
)
const PERFIL_COLORS: Record<string, string> = Object.fromEntries(
  PERFIS_ERP.map(p => [p.value, p.cor])
)

// ─── DIMENSÃO 2: Cargo Acadêmico ──────────────────────────────────────────────
// Define qual função a pessoa exerce NA INSTITUIÇÃO (não no sistema).
// Pode ou não coincidir com o perfil ERP. São dimensões independentes.
// Ex: "Diretor Geral" (cargo acadêmico) pode ter perfil ERP "diretoria" OU
//     "admin_instituicao" — a FIC decide.
const CARGOS_ACADEMICOS: { value: string; label: string }[] = [
  { value: 'diretor_geral', label: 'Diretor Geral' },
  { value: 'diretor_academico', label: 'Diretor Acadêmico' },
  { value: 'secretario_academico', label: 'Secretário Acadêmico' },
  { value: 'coordenador_curso', label: 'Coordenador de Curso' },
  { value: 'professor', label: 'Professor' },
  { value: 'tecnico_administrativo', label: 'Técnico Administrativo' },
  { value: 'representante_legal', label: 'Representante Legal da Mantenedora' },
  { value: 'bibliotecario', label: 'Bibliotecário(a)' },
  { value: 'auxiliar_admin', label: 'Auxiliar Administrativo' },
  { value: 'ti_suporte', label: 'TI / Suporte Técnico' },
]

function getCargosLabel(cargos: string[] | null): string {
  if (!cargos || cargos.length === 0) return ''
  return cargos
    .map(c => CARGOS_ACADEMICOS.find(ca => ca.value === c)?.label ?? c)
    .join(', ')
}

function getPerfilLabel(role: string): string {
  return PERFIL_LABELS[role] ?? role
}

function getPerfilColor(role: string): string {
  return PERFIL_COLORS[role] ?? 'bg-gray-100 text-gray-600'
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

// ─── Seletor múltiplo de cargos acadêmicos ───────────────────────────────────
function CargosSelector({
  value,
  onChange,
}: {
  value: string[]
  onChange: (v: string[]) => void
}) {
  function toggle(cargo: string) {
    if (value.includes(cargo)) {
      onChange(value.filter(c => c !== cargo))
    } else {
      onChange([...value, cargo])
    }
  }

  return (
    <div className="space-y-1.5">
      {CARGOS_ACADEMICOS.map(ca => (
        <label
          key={ca.value}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${
            value.includes(ca.value)
              ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
              : 'border-gray-200 hover:border-gray-300 text-gray-700'
          }`}
        >
          <input
            type="checkbox"
            checked={value.includes(ca.value)}
            onChange={() => toggle(ca.value)}
            className="accent-indigo-600 w-3.5 h-3.5"
          />
          <span className="flex-1">{ca.label}</span>
        </label>
      ))}
    </div>
  )
}

// ─── Dialog de Criar / Editar Usuário ────────────────────────────────────────
function UsuarioDialog({
  usuario,
  onClose,
  onSaved,
}: {
  usuario: Usuario | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdicao = !!usuario
  const [form, setForm] = useState({
    full_name: usuario?.full_name ?? '',
    email: usuario?.email ?? '',
    password: '',
    confirmPassword: '',
    role: usuario?.role ?? 'cadastramento',
    cargos_academicos: usuario?.cargos_academicos ?? [],
    status: usuario?.status ?? 'active',
    telefone: usuario?.telefone ?? '',
    observacoes: usuario?.observacoes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Validação de senha em tempo real ─────────────────────────────────────
  const senhaReqs = {
    tamanho:   form.password.length >= 8,
    maiuscula: /[A-Z]/.test(form.password),
    minuscula: /[a-z]/.test(form.password),
    numero:    /[0-9]/.test(form.password),
    simbolo:   /[^A-Za-z0-9]/.test(form.password),
  }
  const senhaValida = Object.values(senhaReqs).every(Boolean)
  const senhasIguais = form.password === form.confirmPassword

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isEdicao) {
      if (!senhaValida) { setError('A senha não atende todos os requisitos.'); return }
      if (!senhasIguais) { setError('As senhas não coincidem.'); return }
    }
    setSaving(true)
    setError(null)
    try {
      if (isEdicao) {
        const res = await fetchSeguro(`/api/usuarios/${usuario.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            full_name: form.full_name,
            role: form.role,
            cargos_academicos: form.cargos_academicos,
            status: form.status,
            telefone: form.telefone || null,
            observacoes: form.observacoes || null,
          }),
        })
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? d.erro ?? 'Erro ao editar usuário') }
      } else {
        const res = await fetchSeguro('/api/usuarios', {
          method: 'POST',
          body: JSON.stringify({
            ...form,
            cargos_academicos: form.cargos_academicos,
          }),
        })
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? d.erro ?? 'Erro ao cadastrar usuário') }
      }
      onSaved()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isEdicao ? 'Editar Usuário' : 'Cadastrar Usuário'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {isEdicao ? 'Atualize os dados e permissões' : 'Preencha os dados para criar o acesso'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nome Completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.full_name}
              onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
              required
              placeholder="Ex: Maria da Silva"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
            />
          </div>

          {/* Email (só criação) */}
          {!isEdicao && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                E-mail <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                required
                placeholder="usuario@fic.edu.br"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
              />
            </div>
          )}

          {/* Senha (só criação) */}
          {!isEdicao && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Senha Inicial <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  required
                  minLength={8}
                  placeholder="Crie uma senha segura"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
                />

                {/* Indicador de requisitos — aparece quando começa a digitar */}
                {form.password.length > 0 && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
                    {[
                      { ok: senhaReqs.tamanho,   label: 'Mínimo 8 caracteres' },
                      { ok: senhaReqs.maiuscula,  label: 'Uma letra maiúscula (A–Z)' },
                      { ok: senhaReqs.minuscula,  label: 'Uma letra minúscula (a–z)' },
                      { ok: senhaReqs.numero,     label: 'Um número (0–9)' },
                      { ok: senhaReqs.simbolo,    label: 'Um símbolo (!@#$%...)' },
                    ].map(({ ok, label }) => (
                      <div key={label} className={`flex items-center gap-2 text-xs transition-colors ${ok ? 'text-emerald-600' : 'text-gray-400'}`}>
                        <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${ok ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                          {ok ? '✓' : '✗'}
                        </span>
                        {label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Confirmação de senha */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirmar Senha <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
                  required
                  placeholder="Repita a senha acima"
                  className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:ring-2 outline-none transition-colors ${
                    form.confirmPassword.length > 0
                      ? senhasIguais
                        ? 'border-emerald-400 focus:ring-emerald-200'
                        : 'border-red-400 focus:ring-red-200'
                      : 'border-gray-300 focus:ring-indigo-300'
                  }`}
                />
                {form.confirmPassword.length > 0 && (
                  <p className={`text-xs mt-1 flex items-center gap-1 ${senhasIguais ? 'text-emerald-600' : 'text-red-500'}`}>
                    <span>{senhasIguais ? '✓' : '✗'}</span>
                    {senhasIguais ? 'As senhas coincidem.' : 'As senhas não coincidem.'}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1.5">O usuário poderá alterar a senha após o primeiro acesso.</p>
              </div>
            </>
          )}

          {/* Perfil de Acesso ao ERP */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Perfil de Acesso ao ERP <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Define o que a pessoa pode fazer no sistema — independente do cargo acadêmico.
            </p>
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
              {PERFIS_ERP.map(p => (
                <label
                  key={p.value}
                  className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                    form.role === p.value
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={p.value}
                    checked={form.role === p.value}
                    onChange={() => setForm(prev => ({ ...prev, role: p.value }))}
                    className="accent-indigo-600 mt-0.5 w-3.5 h-3.5 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mb-0.5 ${p.cor}`}>
                      {p.label}
                    </span>
                    <p className="text-xs text-gray-400 leading-snug">{p.descricao}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Cargos Acadêmicos — seleção múltipla */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cargos Acadêmicos
              {form.cargos_academicos.length > 0 && (
                <span className="ml-2 text-xs text-indigo-600 font-normal">
                  {form.cargos_academicos.length} selecionado{form.cargos_academicos.length > 1 ? 's' : ''}
                </span>
              )}
            </label>
            <CargosSelector
              value={form.cargos_academicos}
              onChange={v => setForm(p => ({ ...p, cargos_academicos: v }))}
            />
            <p className="text-xs text-gray-400 mt-1.5">Selecione todos os cargos que se aplicam</p>
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefone</label>
            <input
              type="tel"
              value={form.telefone}
              onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))}
              placeholder="(67) 99999-9999"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
            />
          </div>

          {/* Status (só edição) */}
          {isEdicao && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
          )}

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
              rows={2}
              placeholder="Informações adicionais..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 outline-none resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || (!isEdicao && (!senhaValida || !senhasIguais))}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              {saving ? 'Salvando...' : isEdicao ? 'Salvar alterações' : 'Cadastrar usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ConfiguracoesUsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState<{ open: boolean; usuario: Usuario | null }>({ open: false, usuario: null })
  const [saved, setSaved] = useState(false)

  async function fetchUsuarios() {
    setLoading(true)
    const res = await fetch('/api/usuarios')
    const data = await res.json()
    setUsuarios(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { fetchUsuarios() }, [])

  function handleSaved() {
    setDialog({ open: false, usuario: null })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    fetchUsuarios()
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários do Sistema</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie quem tem acesso ao ERP FIC e seus níveis de permissão.
          </p>
        </div>
        <button
          onClick={() => setDialog({ open: true, usuario: null })}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shrink-0"
        >
          <Plus size={16} />
          Cadastrar usuário
        </button>
      </div>

      {saved && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
          <CheckCircle size={15} />
          Usuário salvo com sucesso!
        </div>
      )}

      {/* Aviso: apenas pessoas categorizadas */}
      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
        <Info size={15} className="text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-700">
          <strong>Filtro de acesso:</strong> Apenas pessoas com pelo menos uma categoria ativa
          (Aluno, Professor, Colaborador) no cadastro de pessoas aparecem aqui para configuração de acesso.
          Pessoas sem categoria não podem receber perfis de acesso ao sistema.
        </p>
      </div>

      {/* Info de perfis */}
      <div className="mb-5 p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="flex items-start gap-2.5">
          <Shield size={15} className="text-slate-500 mt-0.5 shrink-0" />
          <div className="w-full">
            <p className="text-xs font-semibold text-slate-700 mb-1">Perfis de Acesso ao ERP</p>
            <p className="text-xs text-slate-500 mb-2.5">
              Controlam o que cada usuário pode fazer no sistema. São independentes do cargo acadêmico da pessoa.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PERFIS_ERP.map(p => (
                <span key={p.value} className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${p.cor}`}>
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">
            {loading ? '...' : `${usuarios.length} usuário${usuarios.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2].map(i => <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-xl" />)}
          </div>
        ) : usuarios.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Users size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum usuário cadastrado.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {usuarios.map((user) => (
              <div key={user.id} className="flex items-center gap-4 p-4 hover:bg-gray-50/50 transition-colors">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {getInitials(user.full_name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{user.full_name}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Mail size={11} /> {user.email}
                    </span>
                    {user.telefone && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Phone size={11} /> {user.telefone}
                      </span>
                    )}
                  </div>
                  {user.cargos_academicos && user.cargos_academicos.length > 0 && (
                    <p className="text-xs text-indigo-600 mt-0.5">
                      {getCargosLabel(user.cargos_academicos)}
                    </p>
                  )}
                </div>

                {/* Perfil ERP badge */}
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getPerfilColor(user.role)}`}>
                  {getPerfilLabel(user.role)}
                </span>

                {/* Status */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className={`w-2 h-2 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  <span className="text-xs text-gray-500">{user.status === 'active' ? 'Ativo' : 'Inativo'}</span>
                </div>

                {/* Editar */}
                <button
                  onClick={() => setDialog({ open: true, usuario: user })}
                  className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="Editar usuário"
                >
                  <Pencil size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center mt-5">
        Novos usuários são criados diretamente pelo administrador. Não há auto-cadastro.
      </p>

      {dialog.open && (
        <UsuarioDialog
          usuario={dialog.usuario}
          onClose={() => setDialog({ open: false, usuario: null })}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
