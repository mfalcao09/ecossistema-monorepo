"use client"

/**
 * Sprint 2 / Sessão 043 — Dialog de visualização e confirmação de documento
 *
 * Abre em modal sobre a Tela 2. Mostra o preview do documento (imagem ou
 * PDF) e oferece as ações:
 *
 *   1. "Confirmo que este é o documento correto" (checkbox obrigatório
 *      para viabilizar o botão Confirmar)
 *   2. "Substituir Arquivo" — reclassifica para outro tipo ou sobe novo
 *   3. Fechar sem confirmar (mantém status 'detectado')
 *
 * O preview usa signed URL do Supabase Storage (gerada pela page.tsx).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  X,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react"
import type { ConfirmacaoComprobatorio } from "@/lib/diploma/mapa-comprobatorios"
import {
  TIPOS_XSD_COMPROBATORIO,
  type TipoXsdComprobatorio,
} from "@/lib/diploma/regras-fic"

// ─── Labels amigáveis ──────────────────────────────────────────────────────

const LABEL_TIPO_XSD: Record<TipoXsdComprobatorio, string> = {
  DocumentoIdentidadeDoAluno: "Documento de identidade (RG)",
  ProvaConclusaoEnsinoMedio: "Histórico do Ensino Médio",
  ProvaColacao: "Prova de colação de grau",
  ComprovacaoEstagioCurricular: "Comprovação de estágio curricular",
  CertidaoNascimento: "Certidão de nascimento",
  CertidaoCasamento: "Certidão de casamento",
  TituloEleitor: "Título de eleitor",
  AtoNaturalizacao: "Ato de naturalização",
  Outros: "Outros",
}

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface Props {
  /** A confirmação sendo visualizada (null = dialog fechado) */
  confirmacao: ConfirmacaoComprobatorio | null
  /** URL assinada para o preview do arquivo */
  previewUrl: string | null
  /** MIME type do arquivo para decidir como renderizar */
  mimeType: string | null
  /** Se está carregando a URL do preview */
  carregandoPreview: boolean
  /** Valor inicial do checkbox "Embutir no XML" */
  destinoXmlInicial?: boolean
  /** Valor inicial do checkbox "Enviar ao Acervo" */
  destinoAcervoInicial?: boolean
  /** Callback: operador confirmou o documento (com destinos escolhidos) */
  onConfirmar: (
    confirmacao: ConfirmacaoComprobatorio,
    destinoXml: boolean,
    destinoAcervo: boolean,
  ) => void
  /** Callback: operador quer trocar o tipo XSD */
  onTrocarTipo: (
    confirmacao: ConfirmacaoComprobatorio,
    novoTipo: TipoXsdComprobatorio,
  ) => void
  /** Callback: operador quer substituir o arquivo por um novo */
  onSubstituirArquivo?: (file: File) => Promise<void>
  /** Indica que o upload de substituição está em andamento */
  substituindo?: boolean
  /** Callback: fechar o dialog */
  onFechar: () => void
}

// ─── Componente ─────────────────────────────────────────────────────────────

export function DialogVisualizarDocumento({
  confirmacao,
  previewUrl,
  mimeType,
  carregandoPreview,
  destinoXmlInicial = false,
  destinoAcervoInicial = false,
  onConfirmar,
  onTrocarTipo,
  onSubstituirArquivo,
  substituindo = false,
  onFechar,
}: Props) {
  const [checkConfirmacao, setCheckConfirmacao] = useState(false)
  const [checkDestXml, setCheckDestXml] = useState(destinoXmlInicial)
  const [checkDestAcervo, setCheckDestAcervo] = useState(destinoAcervoInicial)
  const [modoTrocar, setModoTrocar] = useState(false)
  const [novoTipoSelecionado, setNovoTipoSelecionado] =
    useState<TipoXsdComprobatorio | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Preview direto via signed URL ────────────────────────────────────
  // Historicamente usávamos /api/storage-proxy porque o Supabase Storage
  // retornava X-Frame-Options que bloqueavam iframe cross-origin. Hoje
  // o Storage não retorna mais esses headers restritivos (confirmado em
  // 2026-04-24: access-control-allow-origin:*, sem X-Frame-Options, sem
  // CSP) e o proxy trava em arrayBuffer() no Vercel para PDFs >500KB.
  // A CSP frame-src agora inclui https://*.supabase.co explicitamente.
  const [blobErro, setBlobErro] = useState(false)

  // Reset quando abre com nova confirmação
  useEffect(() => {
    setCheckConfirmacao(false)
    setCheckDestXml(destinoXmlInicial)
    setCheckDestAcervo(destinoAcervoInicial)
    setModoTrocar(false)
    setNovoTipoSelecionado(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmacao?.tipo_xsd, confirmacao?.arquivo_index])

  // Quando o arquivo é substituído (previewUrl muda), resetar checkbox de confirmação
  // para forçar o operador a confirmar o novo arquivo
  useEffect(() => {
    if (!substituindo) {
      setCheckConfirmacao(false)
    }
  }, [previewUrl, substituindo])

  // Se já está confirmado, pré-marcar o checkbox
  useEffect(() => {
    if (confirmacao?.status === "confirmado") {
      setCheckConfirmacao(true)
    }
  }, [confirmacao?.status])

  // Fechar com ESC
  useEffect(() => {
    if (!confirmacao) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [confirmacao, onFechar])

  // Click outside para fechar
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onFechar()
      }
    },
    [onFechar],
  )

  if (!confirmacao) return null

  const ehImagem = mimeType?.startsWith("image/")
  const ehPdf = mimeType === "application/pdf"
  const jaConfirmado = confirmacao.status === "confirmado"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {LABEL_TIPO_XSD[confirmacao.tipo_xsd] ?? confirmacao.tipo_xsd}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {confirmacao.nome_arquivo ?? "Arquivo não identificado"}
              {confirmacao.confianca != null && (
                <> · Confiança da IA: {(confirmacao.confianca * 100).toFixed(0)}%</>
              )}
            </p>
          </div>
          <button
            onClick={onFechar}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Preview do documento */}
        <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
          {/* Estado: carregando */}
          {carregandoPreview && (
            <div className="flex h-96 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
              <span className="ml-3 text-sm text-gray-500">
                Carregando preview...
              </span>
            </div>
          )}

          {/* Estado: nenhuma URL disponível */}
          {!carregandoPreview && !previewUrl && (
            <div className="flex h-96 flex-col items-center justify-center gap-3 text-gray-400">
              <AlertTriangle className="h-10 w-10" />
              <p className="text-sm">
                Não foi possível gerar o preview deste arquivo.
              </p>
            </div>
          )}

          {/* Estado: erro ao buscar blob */}
          {!carregandoPreview && previewUrl && blobErro && (
            <div className="flex h-96 flex-col items-center justify-center gap-3 text-gray-400">
              <AlertTriangle className="h-10 w-10" />
              <p className="text-sm">
                Erro ao carregar o arquivo para preview.
              </p>
              <a
                href={previewUrl ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-violet-600 hover:underline"
              >
                Abrir em nova aba
              </a>
            </div>
          )}

          {/* Imagem — signed URL direto (CORS * vindo do Supabase) */}
          {!carregandoPreview && previewUrl && !blobErro && ehImagem && (
            <div className="flex items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={confirmacao.nome_arquivo ?? "Documento"}
                className="max-h-[60vh] max-w-full rounded-md object-contain shadow-md"
                onError={() => setBlobErro(true)}
              />
            </div>
          )}

          {/* PDF — iframe direto no signed URL */}
          {!carregandoPreview && previewUrl && !blobErro && ehPdf && (
            <iframe
              src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=1`}
              title={confirmacao.nome_arquivo ?? "Preview PDF"}
              className="h-[60vh] w-full border-0"
            />
          )}

          {/* Outros formatos */}
          {!carregandoPreview && previewUrl && !blobErro && !ehImagem && !ehPdf && (
            <div className="flex h-96 flex-col items-center justify-center gap-3 text-gray-400">
              <FileText className="h-10 w-10" />
              <p className="text-sm">
                Preview não disponível para este formato ({mimeType}).
              </p>
              <a
                href={previewUrl ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-violet-600 hover:underline"
              >
                Abrir em nova aba
              </a>
            </div>
          )}
        </div>

        {/* Footer: ações */}
        <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          {/* Modo trocar tipo */}
          {modoTrocar ? (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Selecione o tipo correto deste documento:
              </label>
              <select
                value={novoTipoSelecionado ?? ""}
                onChange={(e) =>
                  setNovoTipoSelecionado(
                    (e.target.value as TipoXsdComprobatorio) || null,
                  )
                }
                className="block w-full rounded-md border-gray-300 bg-white py-2 text-sm shadow-sm focus:border-violet-500 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">— selecione o tipo —</option>
                {TIPOS_XSD_COMPROBATORIO.filter((t) => t !== "Outros").map(
                  (tipo) => (
                    <option key={tipo} value={tipo}>
                      {LABEL_TIPO_XSD[tipo]}
                    </option>
                  ),
                )}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (novoTipoSelecionado && confirmacao) {
                      onTrocarTipo(confirmacao, novoTipoSelecionado)
                    }
                  }}
                  disabled={!novoTipoSelecionado}
                  className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reclassificar
                </button>
                <button
                  onClick={() => setModoTrocar(false)}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Checkbox de confirmação do documento */}
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={checkConfirmacao}
                  onChange={(e) => setCheckConfirmacao(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Confirmo que este arquivo é de fato{" "}
                  <strong>{LABEL_TIPO_XSD[confirmacao.tipo_xsd]?.toLowerCase() ?? confirmacao.tipo_xsd}</strong>
                </span>
              </label>

              {/* Destinos do arquivo */}
              <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 px-4 py-3 space-y-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Destinos do arquivo</p>
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checkDestXml}
                    onChange={(e) => setCheckDestXml(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Embutir no XML (comprobatório do diploma)
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checkDestAcervo}
                    onChange={(e) => setCheckDestAcervo(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Enviar ao Acervo Acadêmico Digital
                  </span>
                </label>
              </div>

              {/* Botões */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    if (checkConfirmacao && confirmacao) {
                      onConfirmar(confirmacao, checkDestXml, checkDestAcervo)
                    }
                  }}
                  disabled={!checkConfirmacao || substituindo}
                  className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {jaConfirmado ? "Já confirmado" : "Confirmar documento"}
                </button>

                <button
                  onClick={() => setModoTrocar(true)}
                  disabled={substituindo}
                  className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reclassificar tipo
                </button>

                {onSubstituirArquivo && (
                  <>
                    {/* Input de arquivo oculto */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        // Limpa o input para permitir re-seleção do mesmo arquivo
                        e.target.value = ""
                        await onSubstituirArquivo(file)
                      }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={substituindo || carregandoPreview}
                      className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                    >
                      {substituindo ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {substituindo ? "Enviando..." : "Substituir arquivo"}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
