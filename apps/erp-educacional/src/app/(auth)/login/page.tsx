'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'

// ─── Tipos ─────────────────────────────────────────────────────────────────────
interface SystemSettings {
  logo_url: string | null
  logo_dark_url: string | null
  banner_login_url: string | null
  instituicao_nome: string | null
  cor_principal: string | null
}

// ─── Hook: carrega configurações do sistema (sem autenticação) ──────────────────
function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings | null>(null)

  useEffect(() => {
    fetch('/api/public/system-settings')
      .then((r) => r.json())
      .then((d) => setSettings(d))
      .catch(() => {})
  }, [])

  return settings
}

// ─── Background com blur radial ────────────────────────────────────────────────
// A imagem fica nítida no centro (onde estão os campos) e vai desfocando
// progressivamente em direção às bordas — efeito radial tipo "bokeh".
function LoginBackground({ bannerUrl }: { bannerUrl: string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = 0.75
  }, [])

  const isVideo = bannerUrl ? /\.(mp4|webm|ogg)$/i.test(bannerUrl) : false

  return (
    <>
      {/* ── Camada 1: mídia de fundo (imagem ou vídeo) – SEM blur ── */}
      <div className="fixed inset-0 -z-20 overflow-hidden">
        {/* Gradiente de fallback */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-800" />

        {/* Vídeo */}
        {bannerUrl && isVideo && (
          <video ref={videoRef} autoPlay loop muted playsInline
            className="absolute inset-0 w-full h-full object-cover">
            <source src={bannerUrl} type="video/mp4" />
            <source src={bannerUrl} type="video/webm" />
          </video>
        )}

        {/* Imagem */}
        {bannerUrl && !isVideo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerUrl} alt="" aria-hidden
            className="absolute inset-0 w-full h-full object-cover" />
        )}
      </div>

      {/* ── Camada 2: blur radial desfocado — das bordas para o centro ──
          Técnica: backdrop-filter blur numa camada com máscara radial.
          A máscara vai de opaca (bordas = blur total) para transparente (centro = sem blur).
          O centro terá 30% de desfoque residual via overlay suave.                     */}

      {/* Blur LEVE apenas no centro — opaco no centro, some nas bordas.
          Cria um leve halo de desfoque ao redor dos campos sem cobrir a imagem. */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          WebkitMaskImage: 'radial-gradient(ellipse 38% 42% at 50% 50%, black 0%, black 40%, transparent 75%)',
          maskImage: 'radial-gradient(ellipse 38% 42% at 50% 50%, black 0%, black 40%, transparent 75%)',
        }}
      />

      {/* Overlay escuro mínimo apenas no centro para legibilidade dos campos */}
      <div
        className="fixed inset-0 -z-10 bg-black/25"
        style={{
          WebkitMaskImage: 'radial-gradient(ellipse 38% 42% at 50% 50%, black 0%, black 35%, transparent 70%)',
          maskImage: 'radial-gradient(ellipse 38% 42% at 50% 50%, black 0%, black 35%, transparent 70%)',
        }}
      />
    </>
  )
}

// ─── Logo do sistema ─────────────────────────────────────────────────────────
function Logo({ logoUrl }: { logoUrl: string | null }) {
  const [imgOk, setImgOk] = useState(true)

  useEffect(() => {
    if (logoUrl) setImgOk(true)
  }, [logoUrl])

  if (logoUrl && imgOk) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt="Logomarca FIC"
        className="h-20 max-w-[220px] object-contain drop-shadow-lg mx-auto"
        onError={() => setImgOk(false)}
      />
    )
  }

  return (
    <div className="w-20 h-20 bg-white/15 rounded-2xl flex items-center justify-center ring-2 ring-white/25 mx-auto">
      <span className="text-white font-bold text-xl tracking-tight">FIC</span>
    </div>
  )
}

// ─── Formulário de login — sem card, campos flutuantes sobre blur radial ──────
function LoginForm({ settings }: { settings: SystemSettings | null }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/home'
  const sessionExpired = searchParams.get('expired') === '1'

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push(next)
    })
  }, [next, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })

    if (error) {
      setErro('E-mail ou senha inválidos. Verifique seus dados e tente novamente.')
      setLoading(false)
      return
    }

    router.push(next)
    router.refresh()
  }

  const corPrincipal = settings?.cor_principal || '#01154c'

  return (
    // Container central — sem card, sem bordas, apenas os elementos flutuando
    <div className="w-full max-w-[320px] flex flex-col items-center gap-8">

      {/* ── Logo apenas ── */}
      <Logo logoUrl={settings?.logo_dark_url || settings?.logo_url || null} />

      {/* ── Campos e botão ── */}
      <div className="w-full flex flex-col gap-3">

        {/* Sessão expirada */}
        {sessionExpired && (
          <div className="flex items-start gap-2 p-3 bg-amber-500/20 border border-amber-400/30 rounded-xl text-amber-100 text-xs backdrop-blur-sm">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            <span>Sua sessão expirou. Faça login novamente.</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          {/* Campo Login */}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Login"
            required
            autoComplete="email"
            autoFocus
            className="w-full px-5 py-3.5 bg-white/90 rounded-2xl text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:bg-white transition-all shadow-lg"
            style={{ focusRingColor: corPrincipal } as React.CSSProperties}
          />

          {/* Campo Senha */}
          <div className="relative">
            <input
              type={showSenha ? 'text' : 'password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Senha"
              required
              autoComplete="current-password"
              className="w-full px-5 py-3.5 pr-12 bg-white/90 rounded-2xl text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:bg-white transition-all shadow-lg"
            />
            <button
              type="button"
              onClick={() => setShowSenha(!showSenha)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              tabIndex={-1}
            >
              {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Erro */}
          {erro && (
            <div className="flex items-start gap-2 p-3 bg-red-500/20 border border-red-400/30 rounded-xl text-red-100 text-xs backdrop-blur-sm">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          {/* Botão Entrar */}
          <button
            type="submit"
            disabled={loading || !email || !senha}
            style={{ backgroundColor: loading || !email || !senha ? undefined : corPrincipal }}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-indigo-700 hover:opacity-90 active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-2xl transition-all text-sm shadow-xl mt-1"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Wrapper Suspense ──────────────────────────────────────────────────────────
function LoginFormSuspense({ settings }: { settings: SystemSettings | null }) {
  return (
    <Suspense fallback={
      <div className="w-full max-w-[320px] flex flex-col items-center gap-8">
        <div className="w-20 h-20 bg-white/10 rounded-2xl animate-pulse" />
        <div className="w-full flex flex-col gap-3">
          <div className="h-12 bg-white/80 animate-pulse rounded-2xl" />
          <div className="h-12 bg-white/80 animate-pulse rounded-2xl" />
          <div className="h-12 bg-indigo-700/60 animate-pulse rounded-2xl mt-1" />
        </div>
      </div>
    }>
      <LoginForm settings={settings} />
    </Suspense>
  )
}

// ─── Página principal ──────────────────────────────────────────────────────────
export default function LoginPage() {
  const settings = useSystemSettings()

  return (
    <>
      <LoginBackground bannerUrl={settings?.banner_login_url || null} />
      <div className="min-h-screen flex items-center justify-center p-4">
        <LoginFormSuspense settings={settings} />
      </div>
    </>
  )
}
