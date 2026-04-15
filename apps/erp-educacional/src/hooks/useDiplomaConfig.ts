'use client'

import { useState, useEffect, useCallback } from 'react'
import type { DiplomaConfig, AmbienteSistema } from '@/types/diploma-config'

interface UseDiplomaConfigReturn {
  config: DiplomaConfig | null
  loading: boolean
  saving: boolean
  error: string | null
  ambiente: AmbienteSistema
  setAmbiente: (a: AmbienteSistema) => void
  saveConfig: (updates: Partial<DiplomaConfig>) => Promise<boolean>
  refresh: () => void
}

export function useDiplomaConfig(): UseDiplomaConfigReturn {
  const [config, setConfig] = useState<DiplomaConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ambiente, setAmbiente] = useState<AmbienteSistema>('homologacao')

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/config/diploma?ambiente=${ambiente}`)
      if (!res.ok) throw new Error('Erro ao carregar configurações')
      const data = await res.json()
      setConfig(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [ambiente])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const saveConfig = useCallback(
    async (updates: Partial<DiplomaConfig>): Promise<boolean> => {
      setSaving(true)
      setError(null)
      try {
        const res = await fetch('/api/config/diploma', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ambiente, ...updates }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error ?? 'Erro ao salvar')
        }
        const updated = await res.json()
        setConfig(updated)
        return true
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Erro ao salvar configurações')
        return false
      } finally {
        setSaving(false)
      }
    },
    [ambiente]
  )

  return {
    config,
    loading,
    saving,
    error,
    ambiente,
    setAmbiente,
    saveConfig,
    refresh: fetchConfig,
  }
}
