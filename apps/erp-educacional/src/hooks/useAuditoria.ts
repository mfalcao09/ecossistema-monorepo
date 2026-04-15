'use client'

import { useState, useCallback, useRef } from 'react'
import type { RespostaAuditoria } from '@/lib/auditoria/tipos'

interface UseAuditoriaOptions {
  diplomaId: string
  /** ISO timestamp do updated_at do diploma — usado como cache key */
  diplomaUpdatedAt: string
}

interface UseAuditoriaReturn {
  auditoria: RespostaAuditoria | null
  carregando: boolean
  erro: string | null
  /** Executa (ou re-executa) a auditoria, respeitando o cache em sessionStorage */
  auditar: (forcar?: boolean) => Promise<void>
  /** Limpa cache e resultado atual */
  limpar: () => void
}

/**
 * Hook que busca a auditoria de requisitos XSD v1.05 para um diploma.
 *
 * Cache: sessionStorage com chave `auditoria:{diplomaId}:{diplomaUpdatedAt}`.
 * A chave muda automaticamente quando o diploma é editado (updated_at muda),
 * forçando nova auditoria sem precisar invalidar manualmente.
 *
 * Como usar:
 *   const { auditoria, carregando, auditar } = useAuditoria({ diplomaId, diplomaUpdatedAt })
 *   useEffect(() => { auditar() }, [diplomaId])
 */
export function useAuditoria({
  diplomaId,
  diplomaUpdatedAt,
}: UseAuditoriaOptions): UseAuditoriaReturn {
  const [auditoria, setAuditoria] = useState<RespostaAuditoria | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Evita duas chamadas simultâneas (ex: StrictMode React)
  const fetchingRef = useRef(false)

  const cacheKey = `auditoria:${diplomaId}:${diplomaUpdatedAt}`

  const auditar = useCallback(
    async (forcar = false) => {
      if (fetchingRef.current) return
      fetchingRef.current = true

      try {
        // ── Cache hit ──────────────────────────────────────────────────────
        if (!forcar) {
          try {
            const cached = sessionStorage.getItem(cacheKey)
            if (cached) {
              setAuditoria(JSON.parse(cached) as RespostaAuditoria)
              return
            }
          } catch {
            // sessionStorage indisponível (SSR, iframe sandboxado) — ignora
          }
        }

        // ── Fetch ──────────────────────────────────────────────────────────
        setCarregando(true)
        setErro(null)

        const res = await fetch(`/api/diplomas/${diplomaId}/auditoria`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error ?? `Erro ${res.status} ao auditar diploma`)
        }

        const data: RespostaAuditoria = await res.json()
        setAuditoria(data)

        // ── Salvar no cache ────────────────────────────────────────────────
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(data))
        } catch {
          // quota excedida ou indisponível — continua sem cache
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Erro desconhecido na auditoria'
        setErro(msg)
      } finally {
        setCarregando(false)
        fetchingRef.current = false
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [diplomaId, cacheKey]
  )

  const limpar = useCallback(() => {
    setAuditoria(null)
    setErro(null)
    try {
      sessionStorage.removeItem(cacheKey)
    } catch {
      // ignora
    }
  }, [cacheKey])

  return { auditoria, carregando, erro, auditar, limpar }
}
