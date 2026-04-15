'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Camera, Eye, EyeOff, Loader2, CheckCircle, AlertCircle,
  User, Lock, X, ZoomIn, ZoomOut, RotateCw
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Perfil {
  id: string
  email: string
  full_name: string
  display_name: string
  avatar_url: string | null
  telefone: string
  cargo_academico: string
  role: string
}

// ─── Componente de Recorte de Avatar ─────────────────────────────────────────
function AvatarCropper({
  src,
  onConfirm,
  onCancel,
}: {
  src: string
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const imgRef = useRef<HTMLImageElement | null>(null)
  const SIZE = 280 // tamanho do canvas de preview

  useEffect(() => {
    const img = new Image()
    img.src = src
    img.onload = () => {
      imgRef.current = img
      drawCanvas(img, zoom, offsetX, offsetY)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  const drawCanvas = useCallback(
    (img: HTMLImageElement, z: number, ox: number, oy: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, SIZE, SIZE)

      // Desenha imagem com zoom e offset
      const scaledW = img.width * z
      const scaledH = img.height * z
      const x = (SIZE - scaledW) / 2 + ox
      const y = (SIZE - scaledH) / 2 + oy
      ctx.drawImage(img, x, y, scaledW, scaledH)

      // Overlay com círculo recortado
      ctx.globalCompositeOperation = 'destination-in'
      ctx.beginPath()
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2)
      ctx.fillStyle = 'black'
      ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
    },
    []
  )

  useEffect(() => {
    if (imgRef.current) drawCanvas(imgRef.current, zoom, offsetX, offsetY)
  }, [zoom, offsetX, offsetY, drawCanvas])

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true)
    setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY })
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return
    setOffsetX(e.clientX - dragStart.x)
    setOffsetY(e.clientY - dragStart.y)
  }
  const handleMouseUp = () => setDragging(false)

  const handleConfirm = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (blob) onConfirm(blob)
    }, 'image/png')
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Ajustar foto de perfil</h3>
          <p className="text-xs text-gray-400 mt-0.5">Arraste para reposicionar • Role para zoom</p>
        </div>

        <div className="flex flex-col items-center p-6 gap-4">
          {/* Canvas de recorte circular */}
          <div
            className="relative cursor-move rounded-full overflow-hidden border-4 border-indigo-200 shadow-lg"
            style={{ width: SIZE, height: SIZE }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <canvas ref={canvasRef} width={SIZE} height={SIZE} />
          </div>

          {/* Controles de zoom */}
          <div className="flex items-center gap-3 w-full">
            <button
              onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            >
              <ZoomOut size={16} />
            </button>
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.05}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="flex-1 accent-indigo-500"
            />
            <button
              onClick={() => setZoom(z => Math.min(3, z + 0.1))}
              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            >
              <ZoomIn size={16} />
            </button>
            <button
              onClick={() => { setZoom(1); setOffsetX(0); setOffsetY(0) }}
              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
              title="Resetar"
            >
              <RotateCw size={16} />
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm text-white transition-colors font-semibold"
          >
            Confirmar foto
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function PerfilPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)

  // Estados do nome
  const [displayName, setDisplayName] = useState('')
  const [salvandoNome, setSalvandoNome] = useState(false)
  const [statusNome, setStatusNome] = useState<'idle' | 'ok' | 'erro'>('idle')

  // Estados da senha
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [showSenhaAtual, setShowSenhaAtual] = useState(false)
  const [showNovaSenha, setShowNovaSenha] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)
  const [salvandoSenha, setSalvandoSenha] = useState(false)
  const [statusSenha, setStatusSenha] = useState<'idle' | 'ok' | 'erro'>('idle')
  const [erroSenha, setErroSenha] = useState('')

  // Estados do avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [uploadandoAvatar, setUploadandoAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Carrega perfil
  useEffect(() => {
    fetch('/api/perfil')
      .then(r => r.json())
      .then(data => {
        setPerfil(data)
        setDisplayName(data.display_name || data.full_name || '')
        setAvatarUrl(data.avatar_url || null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // ── Salvar nome de exibição ──────────────────────────────────────────────────
  const salvarNome = async () => {
    if (!displayName.trim()) return
    setSalvandoNome(true)
    setStatusNome('idle')
    try {
      const r = await fetch('/api/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName.trim() }),
      })
      setStatusNome(r.ok ? 'ok' : 'erro')
    } catch {
      setStatusNome('erro')
    } finally {
      setSalvandoNome(false)
      setTimeout(() => setStatusNome('idle'), 3000)
    }
  }

  // ── Alterar senha ────────────────────────────────────────────────────────────
  const alterarSenha = async () => {
    setErroSenha('')
    setStatusSenha('idle')
    if (novaSenha !== confirmarSenha) {
      setErroSenha('As senhas não coincidem')
      return
    }
    if (novaSenha.length < 8) {
      setErroSenha('A nova senha deve ter pelo menos 8 caracteres')
      return
    }
    setSalvandoSenha(true)
    try {
      const r = await fetch('/api/perfil/senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha_atual: senhaAtual, nova_senha: novaSenha }),
      })
      const data = await r.json()
      if (!r.ok) {
        setErroSenha(data.error || 'Erro ao alterar senha')
        setStatusSenha('erro')
      } else {
        setStatusSenha('ok')
        setSenhaAtual('')
        setNovaSenha('')
        setConfirmarSenha('')
      }
    } catch {
      setErroSenha('Erro de conexão')
      setStatusSenha('erro')
    } finally {
      setSalvandoSenha(false)
      if (statusSenha === 'ok') setTimeout(() => setStatusSenha('idle'), 3000)
    }
  }

  // ── Upload de avatar ─────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setCropSrc(url)
    e.target.value = '' // reset para permitir reselecionar mesmo arquivo
  }

  const handleCropConfirm = async (blob: Blob) => {
    setCropSrc(null)
    setUploadandoAvatar(true)
    try {
      const form = new FormData()
      form.append('file', blob, 'avatar.png')
      const r = await fetch('/api/perfil/avatar', { method: 'POST', body: form })
      const data = await r.json()
      if (r.ok) setAvatarUrl(data.avatar_url + '?t=' + Date.now()) // cache bust
    } catch {
      // silencia — o usuário pode tentar novamente
    } finally {
      setUploadandoAvatar(false)
    }
  }

  function getInitials(name: string) {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={28} className="animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Minha Conta</h1>

      {/* ── Foto de perfil ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <User size={15} className="text-indigo-500" />
          Foto de perfil
        </h2>
        <div className="flex items-center gap-5">
          {/* Avatar */}
          <div className="relative group">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 rounded-full overflow-hidden bg-indigo-100 flex items-center justify-center ring-2 ring-indigo-200 hover:ring-indigo-400 transition-all relative"
              title="Clique para alterar a foto"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-indigo-600">
                  {getInitials(displayName || perfil?.full_name || 'U')}
                </span>
              )}
              {/* Overlay de hover */}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                {uploadandoAvatar
                  ? <Loader2 size={20} className="text-white animate-spin" />
                  : <Camera size={20} className="text-white" />
                }
              </div>
            </button>
          </div>
          <div>
            <p className="text-sm text-gray-600 font-medium">Clique na foto para alterar</p>
            <p className="text-xs text-gray-400 mt-0.5">JPG, PNG ou WebP • Máximo 2MB</p>
            <p className="text-xs text-gray-400">Você poderá recortar e dar zoom na imagem</p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* ── Nome de exibição ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <User size={15} className="text-indigo-500" />
          Nome de exibição
        </h2>

        <div className="mb-1">
          <label className="block text-xs text-gray-500 mb-1.5">
            Como seu nome aparece no sistema
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Seu nome de exibição"
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all"
              onKeyDown={e => e.key === 'Enter' && salvarNome()}
            />
            <button
              onClick={salvarNome}
              disabled={salvandoNome || !displayName.trim()}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-1.5"
            >
              {salvandoNome
                ? <Loader2 size={14} className="animate-spin" />
                : statusNome === 'ok'
                ? <CheckCircle size={14} />
                : 'Salvar'
              }
            </button>
          </div>
        </div>

        {statusNome === 'ok' && (
          <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1.5">
            <CheckCircle size={12} /> Nome atualizado com sucesso
          </p>
        )}
        {statusNome === 'erro' && (
          <p className="text-xs text-red-500 flex items-center gap-1 mt-1.5">
            <AlertCircle size={12} /> Erro ao salvar. Tente novamente.
          </p>
        )}

        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            <span className="font-medium text-gray-500">E-mail:</span>{' '}
            {perfil?.email}
          </p>
        </div>
      </div>

      {/* ── Alterar senha ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Lock size={15} className="text-indigo-500" />
          Alterar senha
        </h2>

        <div className="space-y-3">
          {/* Senha atual */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Senha atual</label>
            <div className="relative">
              <input
                type={showSenhaAtual ? 'text' : 'password'}
                value={senhaAtual}
                onChange={e => setSenhaAtual(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowSenhaAtual(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showSenhaAtual ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Nova senha */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Nova senha</label>
            <div className="relative">
              <input
                type={showNovaSenha ? 'text' : 'password'}
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowNovaSenha(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showNovaSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirmar nova senha */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Confirmar nova senha</label>
            <div className="relative">
              <input
                type={showConfirmar ? 'text' : 'password'}
                value={confirmarSenha}
                onChange={e => setConfirmarSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all"
                onKeyDown={e => e.key === 'Enter' && alterarSenha()}
              />
              <button
                type="button"
                onClick={() => setShowConfirmar(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showConfirmar ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Erro */}
          {erroSenha && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
              <AlertCircle size={14} className="shrink-0" />
              {erroSenha}
            </div>
          )}

          {/* Sucesso */}
          {statusSenha === 'ok' && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs">
              <CheckCircle size={14} className="shrink-0" />
              Senha alterada com sucesso!
            </div>
          )}

          <button
            onClick={alterarSenha}
            disabled={salvandoSenha || !senhaAtual || !novaSenha || !confirmarSenha}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {salvandoSenha ? (
              <><Loader2 size={14} className="animate-spin" /> Alterando...</>
            ) : (
              'Alterar senha'
            )}
          </button>
        </div>
      </div>

      {/* Cropper modal */}
      {cropSrc && (
        <AvatarCropper
          src={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </div>
  )
}
