'use client'

/**
 * ThemeProvider — aplica cor principal e dark mode globalmente
 *
 * Como funciona:
 * 1. Busca system_settings via /api/system-settings (sem auth)
 * 2. Injeta --color-primary no <html> como CSS custom property
 * 3. Adiciona/remove a classe `dark` no <html> conforme o tema salvo
 * 4. Persiste a preferência em localStorage para evitar flash no reload
 *
 * Uso no layout raiz:
 *   <ThemeProvider />   ← coloque logo após <body>
 */

import { useEffect } from 'react'

export default function ThemeProvider() {
  useEffect(() => {
    async function aplicarTema() {
      try {
        // 1. Tenta usar cache local primeiro (evita flash)
        const cached = localStorage.getItem('fic-theme')
        if (cached) {
          const { cor, tema } = JSON.parse(cached)
          injetar(cor, tema)
        }

        // 2. Busca dados frescos do servidor
        const res = await fetch('/api/system-settings')
        if (!res.ok) return
        const data = await res.json()
        if (data?.error) return

        const cor: string = data.cor_principal ?? '#4F46E5'
        const tema: string = data.tema ?? 'claro'

        // 3. Aplica visualmente
        injetar(cor, tema)

        // 4. Salva no cache local
        localStorage.setItem('fic-theme', JSON.stringify({ cor, tema }))
      } catch {
        // Falha silenciosa — tema padrão (claro + indigo) permanece
      }
    }

    function injetar(cor: string, tema: string) {
      const html = document.documentElement

      // CSS custom property da cor principal
      html.style.setProperty('--color-primary', cor)

      // Gera variantes clareadas e escurecidas da cor principal
      // para uso nos estados hover, focus, etc.
      html.style.setProperty('--color-primary-light', hexToRgba(cor, 0.12))
      html.style.setProperty('--color-primary-ring', hexToRgba(cor, 0.35))

      // Dark mode via classe no <html> (padrão Tailwind)
      if (tema === 'escuro') {
        html.classList.add('dark')
      } else {
        html.classList.remove('dark')
      }
    }

    aplicarTema()
  }, [])

  return null
}

// ─── Utilitário: hex → rgba ───────────────────────────────────────────────────
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
