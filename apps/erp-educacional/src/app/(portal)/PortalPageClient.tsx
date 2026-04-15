"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Image from "next/image"
import {
  Search,
  FileCode,
  Shield,
  Loader2,
  CheckCircle2,
  FileCheck,
  XCircle,
  X,
  Calendar,
  Building2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
  Download,
} from "lucide-react"
import DiplomaCardPublico from "@/components/portal/DiplomaCardPublico"
import TurnstileWidget, { type TurnstileHandle } from "@/components/portal/TurnstileWidget"
import ValidadorXML from "@/components/portal/ValidadorXML"
import type { TipoDocDigital } from "@/types/documentos-digitais"
import type { VerificacaoPublica } from "@/types/documentos-digitais"
import { TIPO_DOC_LABELS } from "@/types/documentos-digitais"

// ── Formato simplificado retornado pela API /api/portal/consultar-cpf ──
interface DiplomaConsulta {
  id: string
  tipo: TipoDocDigital
  titulo: string
  numero_documento: string | null
  assinado_em: string | null
  publicado_em: string | null
  ies_nome: string | null
  codigo_verificacao: string
  url_verificacao: string | null
}

// ── Helpers de data ────────────────────────────────────────────────────
function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—"
  // Fix timezone: datas que contêm YYYY-MM-DD (com ou sem timestamp/timezone)
  // podem ser interpretadas como UTC meia-noite, causando recuo de 1 dia em UTC-3.
  // Extraímos apenas a parte da data e usamos T12:00:00 para evitar isso.
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})/)
  const safe = match ? `${match[1]}T12:00:00` : iso
  return new Date(safe).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ── Seção colapsável ───────────────────────────────────────────────────
function SecaoColapsavel({
  titulo,
  children,
  defaultAberta = true,
}: {
  titulo: string
  children: React.ReactNode
  defaultAberta?: boolean
}) {
  const [aberta, setAberta] = useState(defaultAberta)
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setAberta(!aberta)}
        className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <h3 className="text-sm font-bold text-[#1e2a4a] uppercase tracking-wide">{titulo}</h3>
        {aberta ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {aberta && <div className="px-5 py-4">{children}</div>}
    </div>
  )
}

// ── Campo de dado ──────────────────────────────────────────────────────
function CampoDado({ label, valor }: { label: string; valor: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-slate-800 font-medium truncate">{valor || "—"}</p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════
export default function PortalPageClient() {
  // ── Estado do Turnstile (CAPTCHA) ──────────────────────
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileHandle>(null)

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token)
  }, [])

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null)
  }, [])

  /** Reseta o widget Turnstile para gerar novo token (chamado após uso do token) */
  const resetTurnstile = useCallback(() => {
    setTurnstileToken(null)
    turnstileRef.current?.reset()
  }, [])

  // ── Estado do formulário de código ─────────────────────
  const [codigo, setCodigo] = useState("")

  // ── Pré-preenche código via ?codigo= na URL (ex: links de legados) ──
  const searchParams = useSearchParams()
  useEffect(() => {
    const c = searchParams.get("codigo")
    if (c) setCodigo(c)
  }, [searchParams])

  // ── Estado do formulário de CPF ────────────────────────
  const [cpf, setCpf] = useState("")
  const [dataNascimento, setDataNascimento] = useState("")
  const [loadingCpf, setLoadingCpf] = useState(false)
  const [resultadosCpf, setResultadosCpf] = useState<DiplomaConsulta[]>([])
  const [cpfMascarado, setCpfMascarado] = useState<string | null>(null)
  const [erroCpf, setErroCpf] = useState<string | null>(null)
  const [dialogCpfAberto, setDialogCpfAberto] = useState(false)

  // ── Tab ativa ──────────────────────────────────────────
  const [abaAtiva, setAbaAtiva] = useState<"codigo" | "cpf">("codigo")

  // ── Estado do DIALOG de verificação por código ─────────
  const [dialogAberto, setDialogAberto] = useState(false)
  const [loadingCodigo, setLoadingCodigo] = useState(false)
  const [resultadoCodigo, setResultadoCodigo] = useState<VerificacaoPublica | null>(null)
  const [codigoConsultado, setCodigoConsultado] = useState("")
  const [rvddModalUrl, setRvddModalUrl] = useState<string | null>(null)

  // ── Download forçado (cross-origin não permite atributo download) ──
  const forcarDownload = useCallback(async (url: string, nomeArquivo: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = nomeArquivo
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch {
      // Fallback: abre em nova aba se fetch falhar
      window.open(url, "_blank")
    }
  }, [])

  // ── Máscaras ───────────────────────────────────────────

  const formatarCpf = (value: string) => {
    const apenasNumeros = value.replace(/\D/g, "")
    if (apenasNumeros.length <= 3) return apenasNumeros
    if (apenasNumeros.length <= 6) {
      return `${apenasNumeros.slice(0, 3)}.${apenasNumeros.slice(3)}`
    }
    if (apenasNumeros.length <= 9) {
      return `${apenasNumeros.slice(0, 3)}.${apenasNumeros.slice(3, 6)}.${apenasNumeros.slice(6)}`
    }
    return `${apenasNumeros.slice(0, 3)}.${apenasNumeros.slice(3, 6)}.${apenasNumeros.slice(6, 9)}-${apenasNumeros.slice(9, 11)}`
  }

  // ── Normaliza código para enviar à API ─────────────────
  const normalizarCodigo = (raw: string): string | null => {
    const trimmed = raw.trim()

    // Formato legado: NNNN.NNN.xxxxxxxxxxxx (ex: 1606.694.b52ba3cac8b9)
    if (/^\d{4}\.\d{3}\.[a-f0-9]{12}$/.test(trimmed)) {
      return trimmed
    }

    // Formato novo: com ou sem pontos → limpar para 16 chars hex
    const limpo = trimmed.replace(/[.\-\s]/g, "")
    if (/^[a-f0-9]{16}$/i.test(limpo)) {
      return limpo
    }

    // Tentar apenas dígitos
    const soDigitos = trimmed.replace(/\D/g, "")
    if (soDigitos.length === 16 && /^\d{16}$/.test(soDigitos)) {
      return soDigitos
    }

    return null // inválido
  }

  // ── Handlers ───────────────────────────────────────────

  const handleSubmitCodigo = async (e: React.FormEvent) => {
    e.preventDefault()
    const codigoNormalizado = normalizarCodigo(codigo)

    if (!codigoNormalizado) {
      setCodigoConsultado(codigo.trim())
      setResultadoCodigo({ valido: false, erro: "Código inválido. Use o formato impresso no diploma." })
      setDialogAberto(true)
      return
    }

    setCodigoConsultado(codigoNormalizado)
    setLoadingCodigo(true)
    setResultadoCodigo(null)
    setDialogAberto(true)

    try {
      const res = await fetch(`/api/documentos/verificar/${encodeURIComponent(codigoNormalizado)}`)
      const data: VerificacaoPublica = await res.json()
      setResultadoCodigo(data)
    } catch {
      setResultadoCodigo({ valido: false, erro: "Erro ao consultar o servidor. Tente novamente." })
    } finally {
      setLoadingCodigo(false)
    }
  }

  const fecharDialog = () => {
    setDialogAberto(false)
    setResultadoCodigo(null)
    setLoadingCodigo(false)
  }

  /** Abre o dialog de verificação por código (chamado pelo DiplomaCardPublico) */
  const abrirDetalhes = useCallback(async (codigoVerificacao: string) => {
    setCodigoConsultado(codigoVerificacao)
    setLoadingCodigo(true)
    setResultadoCodigo(null)
    setDialogAberto(true)

    try {
      const res = await fetch(`/api/documentos/verificar/${encodeURIComponent(codigoVerificacao)}`)
      const data: VerificacaoPublica = await res.json()
      setResultadoCodigo(data)
    } catch {
      setResultadoCodigo({ valido: false, erro: "Erro ao consultar o servidor. Tente novamente." })
    } finally {
      setLoadingCodigo(false)
    }
  }, [])

  const handleSubmitCpf = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoadingCpf(true)
    setErroCpf(null)
    setResultadosCpf([])

    const cpfLimpo = cpf.replace(/\D/g, "")

    if (cpfLimpo.length !== 11) {
      setErroCpf("CPF inválido. Use o formato: 000.000.000-00")
      setLoadingCpf(false)
      return
    }

    if (!dataNascimento) {
      setErroCpf("Selecione uma data de nascimento")
      setLoadingCpf(false)
      return
    }

    try {
      const response = await fetch("/api/portal/consultar-cpf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpf: cpfLimpo,
          data_nascimento: dataNascimento,
          turnstile_token: turnstileToken,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setErroCpf(data.erro || "Erro ao consultar diplomas")
        return
      }

      setCpfMascarado(data.cpf_mascarado || null)
      if (data.encontrados && data.diplomas && data.diplomas.length > 0) {
        setResultadosCpf(data.diplomas)
        setDialogCpfAberto(true)
      } else {
        setErroCpf("Nenhum diploma encontrado com estes dados")
        setDialogCpfAberto(true)
      }
    } catch (err) {
      setErroCpf("Erro ao conectar ao servidor. Tente novamente.")
      console.error(err)
    } finally {
      setLoadingCpf(false)
      // Token Turnstile é de uso único — renovar para próxima consulta
      resetTurnstile()
    }
  }

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════
  return (
    <div className="bg-white">
      {/* ══════════════════════════════════════════════════════
          HERO SECTION — Identidade FIC
      ══════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden">
        {/* Background com gradiente FIC */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1e2a4a] via-[#1e3a5f] to-[#1e2a4a]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjAzIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-50" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 lg:pt-32 pb-12 sm:pb-14 lg:pb-16">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight animate-fade-in-up">
              Verifique a autenticidade<br />
              do seu <span className="text-[#dc2626]">Diploma Digital</span>
            </h1>

            <p className="text-base sm:text-lg text-white/70 max-w-xl mx-auto animate-fade-in-up" style={{ animationDelay: "150ms", opacity: 0 }}>
              Portal público de verificação de diplomas digitais<br />
              das Faculdades Integradas de Cassilândia - FIC.
            </p>
          </div>
        </div>

        {/* Wave divider */}
        <div className="relative">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full" preserveAspectRatio="none">
            <path d="M0 80V40C240 70 480 10 720 40C960 70 1200 10 1440 40V80H0Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          CONSULTA SECTION — Cards lado a lado
      ══════════════════════════════════════════════════════ */}
      <section className="py-8 sm:py-10 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Grid: Consulta (esquerda) | Separador | Validar XML (direita) */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden animate-fade-in-up" style={{ animationDelay: "200ms", opacity: 0 }}>
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr]">
              {/* ── LADO ESQUERDO: Consultar diploma ──────────────── */}
              <div className="p-6">
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-[#1e2a4a] mb-1">Consultar diploma</h2>
                  <p className="text-sm text-slate-500">Informe os dados para validação</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setAbaAtiva("codigo")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      abaAtiva === "codigo"
                        ? "bg-[#1e2a4a] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Código de Validação
                  </button>
                  <button
                    onClick={() => setAbaAtiva("cpf")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      abaAtiva === "cpf"
                        ? "bg-[#1e2a4a] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    CPF
                  </button>
                </div>

                {/* Formulário por código */}
                {abaAtiva === "codigo" && (
                  <form onSubmit={handleSubmitCodigo} className="space-y-4">
                    <div>
                      <input
                        type="text"
                        placeholder="Ex: 0000.0000.00000000 ou código do diploma"
                        value={codigo}
                        onChange={(e) => setCodigo(e.target.value)}
                        maxLength={24}
                        className="w-full px-4 py-3.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2a4a] focus:border-transparent transition-all placeholder:text-slate-400"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loadingCodigo}
                      className="w-full bg-[#dc2626] hover:bg-[#b91c1c] disabled:bg-slate-400 text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      {loadingCodigo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      {loadingCodigo ? "Verificando..." : "Pesquisar"}
                    </button>
                  </form>
                )}

                {/* Formulário por CPF */}
                {abaAtiva === "cpf" && (
                  <form onSubmit={handleSubmitCpf} className="space-y-4">
                    <div>
                      <input
                        type="text"
                        placeholder="CPF (000.000.000-00)"
                        value={cpf}
                        onChange={(e) => setCpf(formatarCpf(e.target.value))}
                        maxLength={14}
                        className="w-full px-4 py-3.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2a4a] focus:border-transparent transition-all placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <input
                        type="date"
                        value={dataNascimento}
                        onChange={(e) => setDataNascimento(e.target.value)}
                        className="w-full px-4 py-3.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2a4a] focus:border-transparent transition-all text-slate-600"
                      />
                      <p className="text-xs text-slate-400 mt-1.5 ml-1">Data de nascimento</p>
                    </div>
                    <button
                      type="submit"
                      disabled={loadingCpf}
                      className="w-full bg-[#dc2626] hover:bg-[#b91c1c] disabled:bg-slate-400 text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      {loadingCpf && <Loader2 className="w-4 h-4 animate-spin" />}
                      {loadingCpf ? "Consultando..." : "Pesquisar"}
                    </button>
                  </form>
                )}

                {/* CAPTCHA */}
                <div className="mt-4 flex justify-center">
                  <TurnstileWidget
                    ref={turnstileRef}
                    onVerify={handleTurnstileVerify}
                    onExpire={handleTurnstileExpire}
                    theme="light"
                    size="normal"
                  />
                </div>

              </div>

              {/* ── SEPARADOR VERTICAL ────────────────────────────── */}
              <div className="hidden lg:block relative">
                <div className="absolute left-0 top-6 bottom-6 w-px bg-slate-200" />

                {/* ── LADO DIREITO: Validar XML ──────────────────── */}
                <div className="p-6 pl-7">
                  <div className="mb-4">
                    <h2 className="text-xl font-bold text-[#1e2a4a] mb-1">Validar Arquivo XML</h2>
                    <p className="text-sm text-slate-500">Verifique a conformidade com o padrão MEC</p>
                  </div>

                  <ValidadorXML turnstileToken={turnstileToken} onTokenUsed={resetTurnstile} />
                </div>
              </div>

              {/* ── MOBILE: Separador horizontal + Validar XML ────── */}
              <div className="lg:hidden border-t border-slate-200 p-6">
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-[#1e2a4a] mb-1">Validar Arquivo XML</h2>
                  <p className="text-sm text-slate-500">Verifique a conformidade com o padrão MEC</p>
                </div>

                <ValidadorXML turnstileToken={turnstileToken} onTokenUsed={resetTurnstile} />
              </div>
            </div>

            {/* Legal — rodapé do box */}
            <div className="border-t border-slate-200 px-6 py-4">
              <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                Para fins do disposto no Art. 23 da Portaria MEC n.º 1095, de 25 de Outubro de 2018,<br />
                esta Instituição disponibiliza esta ferramenta para verificação de autenticidade de diplomas digitais.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          FEATURES — 3 cards informativos
      ══════════════════════════════════════════════════════ */}
      <section className="py-12 sm:py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-[#1e2a4a] mb-8 text-center">
            Verifique com segurança e praticidade
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-[#1e2a4a]/10 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-[#1e2a4a]" />
              </div>
              <h3 className="text-base font-bold text-[#1e2a4a] mb-2">Assinatura Digital ICP-Brasil</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Diplomas assinados com certificado digital ICP-Brasil, conforme padrão estabelecido pelo Ministério da Educação.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-[#1e2a4a]/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-[#1e2a4a]" />
              </div>
              <h3 className="text-base font-bold text-[#1e2a4a] mb-2">Validade Nacional</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                O diploma digital tem a mesma validade jurídica do diploma físico, em todo o território nacional.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-[#1e2a4a]/10 flex items-center justify-center mb-4">
                <FileCheck className="w-6 h-6 text-[#1e2a4a]" />
              </div>
              <h3 className="text-base font-bold text-[#1e2a4a] mb-2">Conformidade MEC</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Em conformidade com as normas de regulação do Ministério da Educação, em relação às regras de expedição.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          DIALOG — Resultado da busca por CPF
      ══════════════════════════════════════════════════════ */}
      {dialogCpfAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => { setDialogCpfAberto(false); setResultadosCpf([]); setErroCpf(null) }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div className="flex items-center gap-3">
                <Image src="/logo-fic2.png" alt="FIC" width={120} height={42} className="h-9 w-auto" />
                <div className="w-px h-8 bg-slate-200" />
                <div>
                  <span className="text-base font-bold text-[#1e2a4a] block">Consulta por CPF</span>
                  <span className="text-xs text-slate-400">Faculdades Integradas de Cassilândia — FIC</span>
                </div>
              </div>
              <button
                onClick={() => { setDialogCpfAberto(false); setResultadosCpf([]); setErroCpf(null) }}
                className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-6">
              {/* Diplomas encontrados */}
              {resultadosCpf.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="font-semibold text-emerald-800">
                        {resultadosCpf.length} diploma{resultadosCpf.length > 1 ? "s" : ""} encontrado{resultadosCpf.length > 1 ? "s" : ""}
                      </p>
                      {cpfMascarado && (
                        <p className="text-xs text-slate-500">CPF: {cpfMascarado}</p>
                      )}
                    </div>
                  </div>
                  {resultadosCpf.map((diploma) => (
                    <DiplomaCardPublico key={diploma.id} diploma={diploma} onVerDetalhes={abrirDetalhes} />
                  ))}
                </div>
              )}

              {/* Não encontrado */}
              {erroCpf && resultadosCpf.length === 0 && (
                <div className="py-10 text-center">
                  <XCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-slate-800 mb-2">Nenhum diploma encontrado</h2>
                  <p className="text-slate-500 text-sm max-w-sm mx-auto">{erroCpf}</p>
                  {cpfMascarado && (
                    <div className="mt-5 bg-slate-50 rounded-lg px-4 py-3 inline-block">
                      <p className="text-xs text-slate-400">CPF consultado</p>
                      <p className="text-sm text-slate-600 font-mono">{cpfMascarado}</p>
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-5">
                    Em caso de dúvidas, entre em contato com a secretaria da instituição.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end rounded-b-2xl">
              <button
                onClick={() => { setDialogCpfAberto(false); setResultadosCpf([]); setErroCpf(null) }}
                className="px-5 py-2.5 bg-[#1e2a4a] hover:bg-[#2a3a5c] text-white rounded-xl text-sm font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          DIALOG — Resultado da verificação por código
      ══════════════════════════════════════════════════════ */}
      {dialogAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={fecharDialog}
          />

          {/* Dialog — GRANDE (max-w-5xl = 1024px) */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-y-auto">
            {/* Header do dialog */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div className="flex items-center gap-3">
                <Image
                  src="/logo-fic2.png"
                  alt="FIC"
                  width={120}
                  height={42}
                  className="h-9 w-auto"
                />
                <div className="w-px h-8 bg-slate-200" />
                <div>
                  <span className="text-base font-bold text-[#1e2a4a] block">Verificação de Diploma Digital</span>
                  <span className="text-xs text-slate-400">Faculdades Integradas de Cassilândia — FIC</span>
                </div>
              </div>
              <button
                onClick={fecharDialog}
                className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Conteúdo do dialog */}
            <div className="p-6">
              {/* Loading */}
              {loadingCodigo && (
                <div className="py-16 text-center">
                  <Loader2 className="w-12 h-12 text-[#1e2a4a] animate-spin mx-auto mb-4" />
                  <p className="text-slate-600 font-medium text-lg">Verificando autenticidade do documento...</p>
                  <p className="text-slate-400 text-sm mt-2">Código: <span className="font-mono">{codigoConsultado}</span></p>
                </div>
              )}

              {/* ── DOCUMENTO VÁLIDO ────────────────────── */}
              {!loadingCodigo && resultadoCodigo?.valido && resultadoCodigo.documento && (() => {
                const doc = resultadoCodigo.documento!
                return (
                  <div className="space-y-5">
                    {/* Banner de status */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-7 h-7 text-emerald-600 flex-shrink-0" />
                        <div>
                          <p className="text-base font-bold text-emerald-800">Documento Verificado — Autenticidade Confirmada</p>
                          <p className="text-sm text-emerald-600">
                            {doc.titulo} — {doc.destinatario_nome}
                          </p>
                        </div>
                      </div>
                      <span className="hidden sm:inline-flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Ativo
                      </span>
                    </div>

                    {/* ── Seção 1: Dados do Diploma ────────── */}
                    <SecaoColapsavel titulo="Dados do Diploma">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                        <div className="col-span-2">
                          <CampoDado label="Nome Completo" valor={doc.destinatario_nome} />
                        </div>
                        <CampoDado label="CPF" valor={doc.destinatario_cpf_mascarado} />
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1">Status</p>
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            ATIVO
                          </span>
                        </div>
                        <CampoDado label="Título Conferido" valor={doc.titulo_conferido} />
                        <CampoDado label="Código de Validação" valor={doc.codigo_validacao} />
                        <CampoDado label="Nº Registro" valor={doc.numero_registro} />
                        <CampoDado label="Verificado em" valor={formatarDataHora(new Date().toISOString())} />
                      </div>
                    </SecaoColapsavel>

                    {/* ── Seção 2: Dados do Curso ─────────── */}
                    <SecaoColapsavel titulo="Dados do Curso">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                        <div className="col-span-2">
                          <CampoDado label="Curso" valor={doc.titulo} />
                        </div>
                        <CampoDado label="Grau" valor={doc.grau ? doc.grau.charAt(0).toUpperCase() + doc.grau.slice(1) : null} />
                        <CampoDado label="Modalidade" valor={doc.modalidade ? doc.modalidade.charAt(0).toUpperCase() + doc.modalidade.slice(1) : null} />
                        <CampoDado label="Carga Horária" valor={doc.carga_horaria_total ? `${doc.carga_horaria_total}h` : null} />
                        <CampoDado label="Código e-MEC (Curso)" valor={doc.codigo_emec_curso} />
                        <div className="col-span-2">
                          <CampoDado label="Reconhecimento" valor={doc.reconhecimento} />
                        </div>
                        <div className="col-span-2 sm:col-span-3 lg:col-span-4 pt-3 mt-1 border-t border-slate-100">
                          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-3">Instituições</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {doc.ies_emissora_nome ? (
                              <div className="bg-slate-50 rounded-lg px-4 py-3">
                                <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">IES Emissora</p>
                                <p className="text-sm text-slate-800 font-medium">{doc.ies_emissora_nome}</p>
                                {doc.ies_emissora_codigo_mec && (
                                  <p className="text-xs text-slate-500 mt-0.5">Código MEC: {doc.ies_emissora_codigo_mec}</p>
                                )}
                              </div>
                            ) : (
                              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                                <p className="text-[11px] text-amber-600 uppercase tracking-wide mb-1">IES Emissora</p>
                                <p className="text-sm text-amber-700 font-medium">Não consta no XML</p>
                              </div>
                            )}
                            {doc.ies_registradora_nome ? (
                              <div className="bg-slate-50 rounded-lg px-4 py-3">
                                <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">IES Registradora</p>
                                <p className="text-sm text-slate-800 font-medium">{doc.ies_registradora_nome}</p>
                                {doc.ies_registradora_codigo_mec && (
                                  <p className="text-xs text-slate-500 mt-0.5">Código MEC: {doc.ies_registradora_codigo_mec}</p>
                                )}
                              </div>
                            ) : (
                              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg px-4 py-3">
                                <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">IES Registradora</p>
                                <p className="text-sm text-slate-400 italic">Não consta no XML deste diploma</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </SecaoColapsavel>

                    {/* ── Seção 3: Datas, Ingresso e Registro ── */}
                    <SecaoColapsavel titulo="Dados de Ingresso e Registro">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                        <CampoDado label="Forma de Acesso" valor={doc.forma_acesso} />
                        <CampoDado label="Data de Ingresso" valor={formatarData(doc.data_ingresso)} />
                        <CampoDado label="Data de Conclusão" valor={formatarData(doc.data_conclusao)} />
                        <CampoDado label="Data de Colação" valor={formatarData(doc.data_colacao_grau)} />
                        <CampoDado label="Nº Registro" valor={doc.numero_registro} />
                        <CampoDado label="Data de Expedição" valor={formatarData(doc.data_expedicao)} />
                        <CampoDado label="Data de Registro" valor={formatarData(doc.data_registro)} />
                        <CampoDado label="Data de Publicação" valor={formatarData(doc.data_publicacao)} />
                      </div>
                    </SecaoColapsavel>

                    {/* ── Seção 4: Assinaturas Digitais ────── */}
                    <SecaoColapsavel titulo="Assinaturas Digitais" defaultAberta={false}>
                      {doc.assinatura_detalhes?.signatarios && doc.assinatura_detalhes.signatarios.length > 0 ? (
                        <div className="space-y-2">
                          {doc.assinatura_detalhes.signatarios.map((sig, i) => (
                            <div
                              key={i}
                              className="bg-slate-50 rounded-lg px-4 py-3 flex items-center justify-between"
                            >
                              <div>
                                <p className="text-slate-800 text-sm font-medium">{sig.nome}</p>
                                {sig.cargo && (
                                  <p className="text-slate-600 text-xs font-medium">{sig.cargo}</p>
                                )}
                                <p className="text-slate-500 text-xs">
                                  {sig.tipo_certificado} · Assinatura válida
                                </p>
                              </div>
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <Shield className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-sm text-slate-500">
                            Diploma legado — assinaturas registradas no documento original.
                          </p>
                        </div>
                      )}
                    </SecaoColapsavel>

                    {/* ── Botões de Ação (igual Diplomax) ──── */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-5 py-3 bg-slate-50">
                        <h3 className="text-sm font-bold text-[#1e2a4a] uppercase tracking-wide">Documentos e Ações</h3>
                      </div>
                      <div className="p-5">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                          {/* 1. Visualizar Diploma (RVDD) — AZUL (destaque principal) */}
                          {doc.rvdd_url ? (
                            <button
                              type="button"
                              onClick={() => setRvddModalUrl(doc.rvdd_url)}
                              className="flex flex-col items-center gap-2 px-4 py-3 bg-[#1e2a4a] text-white rounded-xl hover:bg-[#2a3a5c] transition-colors text-center"
                            >
                              <Eye className="w-5 h-5" />
                              <span className="text-xs font-medium">Visualizar Diploma (RVDD)</span>
                            </button>
                          ) : (
                            <div className="flex flex-col items-center gap-2 px-4 py-3 bg-slate-100 text-slate-400 rounded-xl text-center cursor-not-allowed">
                              <Eye className="w-5 h-5" />
                              <span className="text-xs font-medium">Visualizar Diploma (RVDD)</span>
                            </div>
                          )}
                          {/* 2. Baixar Diploma em PDF (RVDD) — BRANCO/OUTLINE (download) */}
                          {doc.rvdd_url ? (
                            <button
                              type="button"
                              onClick={() => {
                                const nome = doc.rvdd_url!.split("/").pop() || "diploma_rvdd.pdf"
                                forcarDownload(doc.rvdd_url!, nome)
                              }}
                              className="flex flex-col items-center gap-2 px-4 py-3 border border-[#1e2a4a] text-[#1e2a4a] rounded-xl hover:bg-[#1e2a4a]/5 transition-colors text-center"
                            >
                              <Download className="w-5 h-5" />
                              <span className="text-xs font-medium">Baixar Diploma em PDF (RVDD)</span>
                            </button>
                          ) : (
                            <div className="flex flex-col items-center gap-2 px-4 py-3 bg-slate-100 text-slate-400 rounded-xl text-center cursor-not-allowed">
                              <Download className="w-5 h-5" />
                              <span className="text-xs font-medium">Baixar Diploma em PDF (RVDD)</span>
                            </div>
                          )}
                          {/* 3. Baixar XML do Diploma — BRANCO/OUTLINE (download) */}
                          {doc.xml_url ? (
                            <button
                              type="button"
                              onClick={() => {
                                const nome = doc.xml_url!.split("/").pop() || "diploma.xml"
                                forcarDownload(doc.xml_url!, nome)
                              }}
                              className="flex flex-col items-center gap-2 px-4 py-3 border border-[#1e2a4a] text-[#1e2a4a] rounded-xl hover:bg-[#1e2a4a]/5 transition-colors text-center"
                            >
                              <FileCode className="w-5 h-5" />
                              <span className="text-xs font-medium">Baixar XML do Diploma</span>
                            </button>
                          ) : (
                            <div className="flex flex-col items-center gap-2 px-4 py-3 bg-slate-100 text-slate-400 rounded-xl text-center cursor-not-allowed">
                              <FileCode className="w-5 h-5" />
                              <span className="text-xs font-medium">Baixar XML do Diploma</span>
                            </div>
                          )}
                          {/* 4. Baixar XML do Histórico Escolar — BRANCO/OUTLINE (download) */}
                          {doc.xml_historico_url ? (
                            <button
                              type="button"
                              onClick={() => {
                                const nome = doc.xml_historico_url!.split("/").pop() || "historico_escolar.xml"
                                forcarDownload(doc.xml_historico_url!, nome)
                              }}
                              className="flex flex-col items-center gap-2 px-4 py-3 border border-[#1e2a4a] text-[#1e2a4a] rounded-xl hover:bg-[#1e2a4a]/5 transition-colors text-center"
                            >
                              <FileCode className="w-5 h-5" />
                              <span className="text-xs font-medium">Baixar XML do Histórico Escolar</span>
                            </button>
                          ) : (
                            <div className="flex flex-col items-center gap-2 px-4 py-3 bg-slate-100 text-slate-400 rounded-xl text-center cursor-not-allowed">
                              <FileCode className="w-5 h-5" />
                              <span className="text-xs font-medium">Baixar XML do Histórico Escolar</span>
                            </div>
                          )}
                          {/* 5. Validador MEC — VERDE (terceira cor, ação externa) */}
                          <a
                            href="https://verificadordiplomadigital.mec.gov.br/diploma"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-center"
                          >
                            <Shield className="w-5 h-5" />
                            <span className="text-xs font-medium">Validador MEC</span>
                          </a>
                        </div>
                        {(!doc.rvdd_url || !doc.xml_url) && (
                          <p className="text-xs text-slate-400 mt-3 text-center">
                            Alguns documentos ainda não foram disponibilizados para download.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Rodapé informativo */}
                    <div className="bg-slate-50 rounded-xl px-5 py-4">
                      <p className="text-xs text-slate-500 mb-1">Código de verificação</p>
                      <p className="font-mono text-sm text-slate-700 break-all">{doc.codigo_validacao}</p>
                      <p className="text-xs text-slate-400 mt-2">
                        Use este código ou escaneie o QR Code impresso no diploma para verificar a qualquer momento.
                      </p>
                    </div>
                  </div>
                )
              })()}

              {/* ── DOCUMENTO NÃO ENCONTRADO / INVÁLIDO ── */}
              {!loadingCodigo && resultadoCodigo && !resultadoCodigo.valido && (
                <div className="py-10 text-center">
                  <div className="flex justify-center mb-4">
                    {resultadoCodigo.erro?.includes("publicado") ? (
                      <AlertTriangle className="w-14 h-14 text-amber-400" />
                    ) : (
                      <XCircle className="w-14 h-14 text-red-400" />
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">
                    Documento não verificado
                  </h2>
                  <p className="text-slate-600 text-sm max-w-md mx-auto">
                    {resultadoCodigo.erro ?? "Este código não corresponde a nenhum documento válido em nosso sistema."}
                  </p>
                  <div className="mt-6 bg-slate-50 rounded-lg px-5 py-4 inline-block">
                    <p className="text-xs text-slate-400">Código consultado</p>
                    <p className="font-mono text-sm text-slate-600">{codigoConsultado}</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-6">
                    Em caso de dúvidas, entre em contato com a secretaria da instituição.
                  </p>
                </div>
              )}
            </div>

            {/* Footer do dialog */}
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between rounded-b-2xl">
              <p className="text-xs text-slate-400 hidden sm:block">
                Faculdades Integradas de Cassilândia — Código MEC 1606
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { fecharDialog(); setCodigo(""); }}
                  className="px-5 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-medium transition-colors"
                >
                  Nova Consulta
                </button>
                <button
                  onClick={fecharDialog}
                  className="px-5 py-2.5 bg-[#1e2a4a] hover:bg-[#2a3a5c] text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal para Visualizar RVDD (PDF) ──── */}
      {rvddModalUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setRvddModalUrl(null)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
              <h3 className="text-sm font-bold text-[#1e2a4a] uppercase tracking-wide">
                Visualização do Diploma (RVDD)
              </h3>
              <button
                type="button"
                onClick={() => setRvddModalUrl(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            {/* PDF embed via proxy — evita bloqueio de X-Frame-Options do Supabase Storage */}
            <div className="flex-1 bg-slate-100">
              <iframe
                src={`/api/portal/rvdd-proxy?url=${encodeURIComponent(rvddModalUrl)}#toolbar=0&navpanes=0&scrollbar=1`}
                className="w-full h-full border-0"
                title="Diploma Digital - RVDD"
              />
            </div>
            {/* Footer do modal — apenas botão Fechar */}
            <div className="flex items-center justify-end px-6 py-3 border-t border-slate-200 bg-white rounded-b-2xl">
              <button
                type="button"
                onClick={() => setRvddModalUrl(null)}
                className="px-5 py-2.5 bg-[#1e2a4a] hover:bg-[#2a3a5c] text-white rounded-xl text-sm font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
