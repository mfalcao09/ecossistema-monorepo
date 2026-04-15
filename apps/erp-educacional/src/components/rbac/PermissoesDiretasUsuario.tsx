'use client'

// =============================================================================
// PermissoesDiretasUsuario — Gerenciamento de Overrides por Pessoa
// ERP Educacional FIC
//
// Permite ao admin conceder (ALLOW) ou bloquear (DENY) permissões específicas
// para um usuário individual, sobrepondo as permissões do papel atribuído.
//
// Uso:
//   <PermissoesDiretasUsuario userId="uuid-do-usuario" nomeUsuario="João Silva" />
// =============================================================================

import { useEffect, useState, useCallback } from 'react'
import type { UsuarioPermissaoDireta, Permissao } from '@/types/configuracoes'
import { usePode } from '@/components/providers/PermissoesProvider'

// ─── Tipos locais ─────────────────────────────────────────────────────────────

interface Props {
  userId: string
  nomeUsuario: string
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function PermissoesDiretasUsuario({ userId, nomeUsuario }: Props) {
  const podeGerenciar = usePode('pessoas', 'especial')

  const [overrides, setOverrides]     = useState<UsuarioPermissaoDireta[]>([])
  const [permissoes, setPermissoes]   = useState<Permissao[]>([])
  const [carregando, setCarregando]   = useState(true)
  const [salvando, setSalvando]       = useState(false)
  const [erro, setErro]               = useState<string | null>(null)
  const [sucesso, setSucesso]         = useState<string | null>(null)

  // ── Form para novo override ──
  const [novoPermissaoId, setNovoPermissaoId] = useState('')
  const [novoTipo, setNovoTipo]               = useState<'allow' | 'deny'>('allow')
  const [novoMotivo, setNovoMotivo]           = useState('')
  const [novoDataFim, setNovoDataFim]         = useState('')

  // ── Carregar dados ────────────────────────────────────────────────────────

  const carregarOverrides = useCallback(async () => {
    try {
      const res = await fetch(`/api/pessoas/${userId}/permissoes`)
      if (!res.ok) throw new Error('Falha ao carregar')
      const json = await res.json()
      setOverrides(json.dados || [])
    } catch {
      setErro('Não foi possível carregar as permissões diretas.')
    }
  }, [userId])

  const carregarPermissoes = useCallback(async () => {
    try {
      const res = await fetch('/api/configuracoes/permissoes')
      if (res.ok) {
        const json = await res.json()
        setPermissoes(json.dados || [])
      }
    } catch {
      // Silencioso — permissões são carregadas separadamente
    }
  }, [])

  useEffect(() => {
    if (!podeGerenciar) return
    Promise.all([carregarOverrides(), carregarPermissoes()]).finally(() =>
      setCarregando(false)
    )
  }, [podeGerenciar, carregarOverrides, carregarPermissoes])

  // ── Ações ─────────────────────────────────────────────────────────────────

  const limparMensagens = () => {
    setErro(null)
    setSucesso(null)
  }

  async function adicionarOverride(e: React.FormEvent) {
    e.preventDefault()
    limparMensagens()

    if (!novoPermissaoId) {
      setErro('Selecione uma permissão.')
      return
    }

    setSalvando(true)
    try {
      const res = await fetch(`/api/pessoas/${userId}/permissoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissao_id: novoPermissaoId,
          tipo: novoTipo,
          motivo: novoMotivo || undefined,
          data_fim: novoDataFim || undefined,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.erro || 'Erro ao adicionar')

      setSucesso(`Override "${novoTipo}" adicionado com sucesso!`)
      setNovoPermissaoId('')
      setNovoMotivo('')
      setNovoDataFim('')
      setNovoTipo('allow')
      await carregarOverrides()
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar override.')
    } finally {
      setSalvando(false)
    }
  }

  async function revogarOverride(overrideId: string) {
    limparMensagens()
    setSalvando(true)
    try {
      const res = await fetch(
        `/api/pessoas/${userId}/permissoes?override_id=${overrideId}&acao=revogar`,
        { method: 'DELETE' }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.erro || 'Erro ao revogar')

      setSucesso('Override revogado.')
      await carregarOverrides()
    } catch (err: any) {
      setErro(err.message || 'Erro ao revogar.')
    } finally {
      setSalvando(false)
    }
  }

  async function excluirOverride(overrideId: string) {
    if (!confirm('Deseja excluir permanentemente este override?')) return
    limparMensagens()
    setSalvando(true)
    try {
      const res = await fetch(
        `/api/pessoas/${userId}/permissoes?override_id=${overrideId}&acao=excluir`,
        { method: 'DELETE' }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.erro || 'Erro ao excluir')

      setSucesso('Override excluído.')
      await carregarOverrides()
    } catch (err: any) {
      setErro(err.message || 'Erro ao excluir.')
    } finally {
      setSalvando(false)
    }
  }

  // ── Sem permissão ─────────────────────────────────────────────────────────

  if (!podeGerenciar) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        Você não tem permissão para gerenciar permissões diretas de usuários.
      </div>
    )
  }

  // ── Carregando ────────────────────────────────────────────────────────────

  if (carregando) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        Carregando permissões de {nomeUsuario}…
      </div>
    )
  }

  // ── Render principal ──────────────────────────────────────────────────────

  const ativos   = overrides.filter((o) => o.ativo)
  const inativos = overrides.filter((o) => !o.ativo)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900">
          Permissões Individuais — {nomeUsuario}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Overrides substituem as permissões do papel. <strong>DENY</strong> bloqueia mesmo que o papel permita.{' '}
          <strong>ALLOW</strong> concede mesmo que o papel não tenha.
        </p>
      </div>

      {/* Mensagens */}
      {erro && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {sucesso}
        </div>
      )}

      {/* ── Formulário: adicionar override ── */}
      <form onSubmit={adicionarOverride} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h4 className="mb-3 text-sm font-medium text-gray-700">Adicionar Override</h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Permissão */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Permissão *
            </label>
            <select
              value={novoPermissaoId}
              onChange={(e) => setNovoPermissaoId(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              disabled={salvando}
            >
              <option value="">Selecione…</option>
              {permissoes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.modulo?.nome ?? p.modulo_id} → {p.acao}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Tipo *
            </label>
            <select
              value={novoTipo}
              onChange={(e) => setNovoTipo(e.target.value as 'allow' | 'deny')}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              disabled={salvando}
            >
              <option value="allow">✅ ALLOW — Conceder</option>
              <option value="deny">🚫 DENY — Bloquear</option>
            </select>
          </div>

          {/* Válido até */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Válido até (opcional)
            </label>
            <input
              type="date"
              value={novoDataFim}
              onChange={(e) => setNovoDataFim(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              disabled={salvando}
            />
          </div>

          {/* Motivo */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Motivo (opcional)
            </label>
            <input
              type="text"
              value={novoMotivo}
              onChange={(e) => setNovoMotivo(e.target.value)}
              placeholder="Ex: Cobertura férias…"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              disabled={salvando}
            />
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={salvando || !novoPermissaoId}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : 'Adicionar Override'}
          </button>
        </div>
      </form>

      {/* ── Overrides ativos ── */}
      <div>
        <h4 className="mb-2 text-sm font-medium text-gray-700">
          Overrides Ativos ({ativos.length})
        </h4>
        {ativos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 py-6 text-center text-sm text-gray-400">
            Nenhum override ativo. Este usuário usa apenas as permissões do seu papel.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Módulo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Ação</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Válido até</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Motivo</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {ativos.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {o.permissao?.modulo?.nome ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">
                      {o.permissao?.acao ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {o.tipo === 'allow' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          ✅ ALLOW
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          🚫 DENY
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {o.data_fim
                        ? new Date(o.data_fim).toLocaleDateString('pt-BR')
                        : <span className="text-gray-300">Sem expiração</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {o.motivo || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => revogarOverride(o.id)}
                          disabled={salvando}
                          className="text-xs text-amber-600 hover:underline disabled:opacity-50"
                          title="Desativar (mantém histórico)"
                        >
                          Revogar
                        </button>
                        <button
                          onClick={() => excluirOverride(o.id)}
                          disabled={salvando}
                          className="text-xs text-red-500 hover:underline disabled:opacity-50"
                          title="Excluir permanentemente"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Histórico (inativos) ── */}
      {inativos.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
            Ver histórico ({inativos.length} overrides revogados)
          </summary>
          <div className="mt-2 overflow-hidden rounded-lg border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Módulo / Ação</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Tipo</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white opacity-60">
                {inativos.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-2 text-gray-500 line-through">
                      {o.permissao?.modulo?.nome ?? '—'} → {o.permissao?.acao ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-400 capitalize">{o.tipo}</td>
                    <td className="px-4 py-2 text-gray-400">{o.motivo || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}
