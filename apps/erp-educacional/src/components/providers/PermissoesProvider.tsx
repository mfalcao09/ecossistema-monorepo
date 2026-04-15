'use client'

// =============================================================================
// PermissoesProvider — Contexto de Permissões do Usuário
// ERP Educacional FIC
//
// Carrega TODAS as permissões do usuário UMA ÚNICA VEZ ao montar o layout.
// Qualquer componente pode chamar usePode('diplomas', 'assinar') sem nova
// requisição de rede — a verificação é feita localmente no cliente.
//
// Uso:
//   const { podeExecutar, carregando } = usePermissoes()
//   if (podeExecutar('pessoas', 'inserir')) { ... }
// =============================================================================

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { AcaoPermissao } from '@/types/configuracoes'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface PermissoesContextType {
  /** Verifica se o usuário tem permissão para modulo:acao */
  podeExecutar: (moduloSlug: string, acao: AcaoPermissao) => boolean
  /** true enquanto as permissões ainda estão carregando */
  carregando: boolean
  /** Força recarga das permissões (ex: após o admin alterar seu próprio papel) */
  recarregar: () => void
}

// ─── Contexto ─────────────────────────────────────────────────────────────────

const PermissoesContext = createContext<PermissoesContextType>({
  podeExecutar: () => false,
  carregando: true,
  recarregar: () => {},
})

// ─── Provider ─────────────────────────────────────────────────────────────────

export function PermissoesProvider({ children }: { children: ReactNode }) {
  // Set de strings no formato "modulo:acao" — ex: "pessoas:inserir", "diplomas:especial"
  const [permissoes, setPermissoes] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(true)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      try {
        setCarregando(true)
        const res = await fetch('/api/auth/minhas-permissoes', { cache: 'no-store' })
        if (!res.ok) {
          // Usuário não autenticado ou sem permissões — deixa o Set vazio
          setPermissoes(new Set())
          return
        }
        const data: { permissoes: string[] } = await res.json()
        if (!cancelado) {
          setPermissoes(new Set(data.permissoes))
        }
      } catch {
        if (!cancelado) setPermissoes(new Set())
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }

    carregar()
    return () => { cancelado = true }
  }, [versao])

  const podeExecutar = useCallback(
    (moduloSlug: string, acao: AcaoPermissao): boolean => {
      return permissoes.has(`${moduloSlug}:${acao}`)
    },
    [permissoes]
  )

  const recarregar = useCallback(() => {
    setVersao((v) => v + 1)
  }, [])

  return (
    <PermissoesContext.Provider value={{ podeExecutar, carregando, recarregar }}>
      {children}
    </PermissoesContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePermissoes() {
  return useContext(PermissoesContext)
}

/**
 * Hook de conveniência: retorna diretamente true/false para um par modulo+acao.
 * Útil para esconder/mostrar um único botão.
 *
 * @example
 *   const podeCriarPessoa = usePode('pessoas', 'inserir')
 *   {podeCriarPessoa && <button>Nova Pessoa</button>}
 */
export function usePode(moduloSlug: string, acao: AcaoPermissao): boolean {
  const { podeExecutar } = usePermissoes()
  return podeExecutar(moduloSlug, acao)
}
