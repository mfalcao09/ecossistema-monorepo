'use client'

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'

// ============================================================
// TURNSTILE WIDGET — Componente Cloudflare Turnstile
// Renderiza o widget CAPTCHA invisível/managed do Cloudflare
// ============================================================

export interface TurnstileHandle {
  /** Reseta o widget para gerar um novo token */
  reset: () => void
}

interface TurnstileWidgetProps {
  /** Callback chamado quando o CAPTCHA é resolvido com sucesso */
  onVerify: (token: string) => void
  /** Callback chamado quando o token expira */
  onExpire?: () => void
  /** Callback chamado em caso de erro */
  onError?: (error: string) => void
  /** Tema do widget: light, dark, ou auto */
  theme?: 'light' | 'dark' | 'auto'
  /** Tamanho: normal ou compact */
  size?: 'normal' | 'compact'
  /** Classe CSS adicional */
  className?: string
}

// Site key do Turnstile (pública — seguro no frontend)
// Em dev, usar chave de teste do Cloudflare que sempre passa
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA' // Chave de teste (sempre passa)

// Declarar tipo global para o Turnstile
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: Record<string, unknown>
      ) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
    onTurnstileLoad?: () => void
  }
}

const TurnstileWidget = forwardRef<TurnstileHandle, TurnstileWidgetProps>(function TurnstileWidget({
  onVerify,
  onExpire,
  onError,
  theme = 'light',
  size = 'normal',
  className = '',
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const scriptLoadedRef = useRef(false)

  // Expor método reset via ref
  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current)
      }
    },
  }))

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile) return

    // Remover widget anterior se existir
    if (widgetIdRef.current) {
      try {
        window.turnstile.remove(widgetIdRef.current)
      } catch {
        // Widget pode já ter sido removido
      }
    }

    // Renderizar novo widget
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      callback: (token: string) => onVerify(token),
      'expired-callback': () => onExpire?.(),
      'error-callback': (error: string) => onError?.(error),
      theme,
      size,
      language: 'pt-br',
    })
  }, [onVerify, onExpire, onError, theme, size])

  useEffect(() => {
    // Se o script já foi carregado
    if (window.turnstile) {
      renderWidget()
      return
    }

    // Se o script ainda não foi adicionado ao DOM
    if (!scriptLoadedRef.current) {
      scriptLoadedRef.current = true

      // Callback chamado quando o script carrega
      window.onTurnstileLoad = () => {
        renderWidget()
      }

      // Adicionar script do Turnstile
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    // Cleanup
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {
          // Widget pode já ter sido removido
        }
        widgetIdRef.current = null
      }
    }
  }, [renderWidget])

  return (
    <div
      ref={containerRef}
      className={`turnstile-container ${className}`}
      data-testid="turnstile-widget"
    />
  )
})

export default TurnstileWidget
