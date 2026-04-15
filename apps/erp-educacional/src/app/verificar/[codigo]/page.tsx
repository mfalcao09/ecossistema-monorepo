"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  CheckCircle2,
  XCircle,
  Shield,
  FileText,
  User,
  Calendar,
  Building2,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Eye,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  GraduationCap,
} from "lucide-react"
import type { VerificacaoPublica } from "@/types/documentos-digitais"
import { TIPO_DOC_LABELS } from "@/types/documentos-digitais"
import QRCodeVerificacao from "@/components/portal/QRCodeVerificacao"

// Formata data ISO para exibição legível
// Fix timezone: extraímos YYYY-MM-DD e usamos T12:00:00 para evitar recuo de 1 dia em UTC-3
function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—"
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
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})/)
  const safe = match ? `${match[1]}T12:00:00` : iso
  return new Date(safe).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

// Componente de seção colapsável
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
        {aberta ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {aberta && <div className="px-5 py-4">{children}</div>}
    </div>
  )
}

// Componente de campo de dado
function CampoDado({ label, valor }: { label: string; valor: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-slate-800 font-medium truncate">{valor || "—"}</p>
    </div>
  )
}

export default function VerificarDocumentoPage() {
  const params = useParams()
  const router = useRouter()
  const codigo = params.codigo as string

  const [loading, setLoading] = useState(true)
  const [resultado, setResultado] = useState<VerificacaoPublica | null>(null)

  useEffect(() => {
    if (!codigo) return
    fetch(`/api/documentos/verificar/${codigo}`)
      .then((r) => r.json())
      .then((data: VerificacaoPublica) => setResultado(data))
      .catch(() =>
        setResultado({ valido: false, erro: "Erro ao consultar o servidor." })
      )
      .finally(() => setLoading(false))
  }, [codigo])

  // Formata código para exibição
  // Legado: já vem formatado (1606.694.b52ba3cac8b9) → manter como está
  // Novo: 16 dígitos → formatar como 0000.0000.00000000
  const codigoFormatado = codigo
    ? /[a-f.]/i.test(codigo)
      ? codigo // Já contém pontos ou letras hex → formato legado, preservar
      : codigo.length === 16
        ? `${codigo.slice(0, 4)}.${codigo.slice(4, 8)}.${codigo.slice(8)}`
        : codigo
    : codigo

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ── Header ────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 shadow-sm px-4 sm:px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-[#1e2a4a] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Realizar nova consulta</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#1e2a4a] flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-[#1e2a4a] hidden sm:inline">FIC — Portal de Diplomas</span>
          </div>
        </div>
      </header>

      {/* ── Conteúdo principal ─────────────────────────── */}
      <main className="flex-1 px-4 sm:px-6 py-8">
        <div className="max-w-4xl mx-auto">

          {/* Carregando */}
          {loading && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
              <Loader2 className="w-10 h-10 text-[#1e2a4a] animate-spin mx-auto mb-4" />
              <p className="text-slate-600 font-medium">Verificando autenticidade do documento...</p>
              <p className="text-slate-400 text-sm mt-1">Código: {codigoFormatado}</p>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              DOCUMENTO VÁLIDO — Layout estilo Diplomax
          ══════════════════════════════════════════════ */}
          {!loading && resultado?.valido && resultado.documento && (
            <div className="space-y-4">
              {/* Seletor/Badge de status */}
              <div className="bg-white rounded-xl border border-slate-200 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full uppercase">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Ativo
                  </span>
                  <span className="text-sm font-semibold text-slate-800">
                    {TIPO_DOC_LABELS[resultado.documento.tipo].toUpperCase()} — {resultado.documento.destinatario_nome}
                  </span>
                </div>
                <GraduationCap className="w-5 h-5 text-slate-400" />
              </div>

              {/* ── Seção 1: Dados do Diploma ─────────── */}
              <SecaoColapsavel titulo="Dados do Diploma">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <CampoDado label="Status" valor={undefined} />
                  <CampoDado label="Nome" valor={resultado.documento.destinatario_nome} />
                  <CampoDado label="CPF" valor={resultado.documento.destinatario_cpf_mascarado} />
                  <CampoDado label="Código de Validação" valor={codigoFormatado} />
                  <CampoDado label="Validado em" valor={formatarDataHora(new Date().toISOString())} />
                  <CampoDado label="Nº Documento" valor={resultado.documento.numero_documento} />
                </div>
                {/* Status badge inline no primeiro campo */}
                <div className="mt-[-52px] sm:mt-[-52px]">
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      ATIVO
                    </span>
                  </div>
                </div>
              </SecaoColapsavel>

              {/* ── Seção 2: Dados do Curso e IES ──────── */}
              <SecaoColapsavel titulo="Dados do Curso e IES">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div className="sm:col-span-2">
                    <CampoDado label="Curso" valor={resultado.documento.titulo} />
                  </div>
                  <CampoDado label="Grau" valor={resultado.documento.grau} />
                  <CampoDado label="Modalidade" valor={resultado.documento.modalidade} />
                  <CampoDado label="Carga Horária" valor={resultado.documento.carga_horaria_total ? `${resultado.documento.carga_horaria_total}h` : null} />
                  <CampoDado label="Código e-MEC (Curso)" valor={resultado.documento.codigo_emec_curso} />
                  {resultado.documento.reconhecimento && (
                    <CampoDado label="Reconhecimento" valor={resultado.documento.reconhecimento} />
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                    <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">IES Emissora</p>
                    <p className="text-sm text-slate-800 font-medium">{resultado.documento.ies_emissora_nome || "Faculdades Integradas de Cassilândia"}</p>
                    {resultado.documento.ies_emissora_codigo_mec && (
                      <p className="text-xs text-slate-500 mt-0.5">Código MEC: {resultado.documento.ies_emissora_codigo_mec}</p>
                    )}
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                    <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">IES Registradora</p>
                    <p className="text-sm text-slate-800 font-medium">{resultado.documento.ies_registradora_nome || "—"}</p>
                    {resultado.documento.ies_registradora_codigo_mec && (
                      <p className="text-xs text-slate-500 mt-0.5">Código MEC: {resultado.documento.ies_registradora_codigo_mec}</p>
                    )}
                  </div>
                </div>
              </SecaoColapsavel>

              {/* ── Seção 3: Dados de Ingresso e Registro ── */}
              <SecaoColapsavel titulo="Dados de Ingresso e Registro">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                  <CampoDado label="Forma de Acesso" valor={resultado.documento.forma_acesso} />
                  <CampoDado label="Data de Ingresso" valor={formatarData(resultado.documento.data_ingresso)} />
                  <CampoDado label="Data de Conclusão" valor={formatarData(resultado.documento.data_conclusao)} />
                  <CampoDado label="Data de Colação" valor={formatarData(resultado.documento.data_colacao_grau)} />
                  <CampoDado label="Nº Registro" valor={resultado.documento.numero_registro} />
                  <CampoDado label="Data de Expedição" valor={formatarData(resultado.documento.data_expedicao)} />
                  <CampoDado label="Data de Registro" valor={formatarData(resultado.documento.data_registro)} />
                  <CampoDado label="Data de Publicação" valor={formatarData(resultado.documento.data_publicacao)} />
                </div>

                {/* Signatários */}
                {resultado.documento.assinatura_detalhes?.signatarios &&
                  resultado.documento.assinatura_detalhes.signatarios.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-3">
                        Assinaturas Digitais
                      </p>
                      <div className="space-y-2">
                        {resultado.documento.assinatura_detalhes.signatarios.map((sig, i) => (
                          <div
                            key={i}
                            className="bg-slate-50 rounded-lg px-4 py-3 flex items-center justify-between"
                          >
                            <div>
                              <p className="text-slate-800 text-sm font-medium">{sig.nome}</p>
                              <p className="text-slate-500 text-xs">
                                {sig.tipo_certificado} · Assinatura válida
                              </p>
                            </div>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </SecaoColapsavel>

              {/* ── QR Code + Verificação ─────────────── */}
              <div className="bg-slate-50 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-xs text-slate-500 mb-1">Código de verificação</p>
                  <p className="font-mono text-sm text-slate-700 break-all">{codigoFormatado}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    Use este código ou escaneie o QR Code para verificar este documento a qualquer momento.
                  </p>
                </div>
                <QRCodeVerificacao codigo={codigo} tamanho={90} />
              </div>

              {/* ══════════════════════════════════════════
                  BOTÕES DE AÇÃO — RVDD, XML, Downloads, MEC
              ══════════════════════════════════════════ */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {/* Visualizar RVDD */}
                <a
                  href={`/rvdd/${codigo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
                >
                  <Eye className="w-4 h-4 text-slate-500" />
                  RVDD
                </a>

                {/* Visualizar XML */}
                <a
                  href={`/api/diplomas/${codigo}/xml`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
                >
                  <Eye className="w-4 h-4 text-slate-500" />
                  XML
                </a>

                {/* Baixar RVDD */}
                <a
                  href={`/api/diplomas/${codigo}/rvdd?download=true`}
                  download
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  Baixar RVDD
                </a>

                {/* Baixar XML */}
                <a
                  href={`/api/diplomas/${codigo}/xml?download=true`}
                  download
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  Baixar XML
                </a>

                {/* Validador MEC */}
                <a
                  href="https://verificadordiplomadigital.mec.gov.br/diploma"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1e2a4a] text-white rounded-xl text-sm font-medium hover:bg-[#2a3a5a] transition-colors shadow-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  Validador MEC
                </a>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              DOCUMENTO INVÁLIDO / NÃO ENCONTRADO
          ══════════════════════════════════════════════ */}
          {!loading && resultado && !resultado.valido && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center">
              <div className="flex justify-center mb-4">
                {resultado.erro?.includes("publicado") ? (
                  <AlertTriangle className="w-12 h-12 text-amber-400" />
                ) : (
                  <XCircle className="w-12 h-12 text-red-400" />
                )}
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">
                Documento não verificado
              </h2>
              <p className="text-slate-600 text-sm max-w-sm mx-auto">
                {resultado.erro ?? "Este código não corresponde a nenhum documento válido em nosso sistema."}
              </p>
              <div className="mt-6 bg-slate-50 rounded-lg px-4 py-3 inline-block">
                <p className="text-xs text-slate-400">Código consultado</p>
                <p className="font-mono text-sm text-slate-600">{codigoFormatado}</p>
              </div>
              <div className="mt-6">
                <button
                  onClick={() => router.push("/")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#dc2626] text-white rounded-xl text-sm font-medium hover:bg-[#b91c1c] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Nova consulta
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-6">
                Em caso de dúvidas, entre em contato com a secretaria da instituição.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* ── Rodapé ────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-center">
        <p className="text-xs text-slate-400">
          FIC — Faculdades Integradas de Cassilândia · Sistema de Verificação de Documentos Digitais
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          Portaria MEC 70/2025 · ICP-Brasil
        </p>
      </footer>
    </div>
  )
}
