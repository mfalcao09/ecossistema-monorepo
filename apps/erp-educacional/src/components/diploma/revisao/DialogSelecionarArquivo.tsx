"use client"

/**
 * Sprint 2 / Sessão 044 — Dialog de seleção manual de arquivo para comprobatório
 *
 * Quando a IA não detecta um comprobatório (badge cinza/pendente), o operador
 * clica em "Enviar" e este dialog abre mostrando todos os arquivos da sessão
 * para ele escolher qual atribuir ao tipo XSD pendente.
 *
 * Fluxo:
 *   1. Operador clica "Enviar" no comprobatório pendente
 *   2. Dialog abre listando todos os arquivos enviados na sessão
 *   3. Arquivos já vinculados a outros tipos aparecem com tag informativa
 *   4. Operador seleciona o arquivo correto → estado vira "detectado" (amarelo)
 *   5. Dialog de visualização abre automaticamente para confirmar (verde)
 */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  X,
  FileText,
  Image as ImageIcon,
  File,
  CheckCircle2,
  ArrowRight,
} from "lucide-react"
import type { TipoXsdComprobatorio } from "@/lib/diploma/regras-fic"
import type { ConfirmacaoComprobatorio } from "@/lib/diploma/mapa-comprobatorios"

// ─── Labels amigáveis (mesmo que DialogVisualizarDocumento) ───────────────

const LABEL_TIPO_XSD: Record<string, string> = {
  DocumentoIdentidadeDoAluno: "RG do aluno",
  ProvaConclusaoEnsinoMedio: "Histórico do Ensino Médio",
  ProvaColacao: "Prova de colação de grau",
  ComprovacaoEstagioCurricular: "Comprovação de estágio",
  CertidaoNascimento: "Certidão de nascimento",
  CertidaoCasamento: "Certidão de casamento",
  TituloEleitor: "Título de eleitor",
  AtoNaturalizacao: "Ato de naturalização",
  Outros: "Outros",
}

// ─── Tipos ──────────────────────────────────────────────────────────────────

/** Informação de um arquivo da sessão para exibição no picker */
export interface ArquivoSessao {
  /** Índice no array sessao.arquivos */
  index: number
  /** Nome original do arquivo */
  nome_original: string
  /** MIME type */
  mime_type: string
  /** Tipo detectado pela IA (se houver) */
  tipo_detectado?: string | null
  /** Se já está vinculado a algum comprobatório */
  tipo_vinculado?: TipoXsdComprobatorio | null
}

interface Props {
  /** Tipo XSD sendo preenchido (null = dialog fechado) */
  tipoAlvo: TipoXsdComprobatorio | null
  /** Lista de todos os arquivos da sessão */
  arquivos: ArquivoSessao[]
  /** Mapa de confirmações para mostrar quais já estão vinculados */
  confirmacoes: Map<TipoXsdComprobatorio, ConfirmacaoComprobatorio>
  /** Callback: operador selecionou um arquivo para o tipo */
  onSelecionar: (tipo: TipoXsdComprobatorio, arquivo: ArquivoSessao) => void
  /** Callback: fechar o dialog */
  onFechar: () => void
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function iconeParaMime(mime: string) {
  if (mime.startsWith("image/")) return <ImageIcon className="h-5 w-5 text-blue-500" />
  if (mime === "application/pdf") return <FileText className="h-5 w-5 text-red-500" />
  return <File className="h-5 w-5 text-gray-400" />
}

/** Verifica se um arquivo já está vinculado a algum comprobatório confirmado/detectado */
function arquivoJaVinculado(
  arquivo: ArquivoSessao,
  confirmacoes: Map<TipoXsdComprobatorio, ConfirmacaoComprobatorio>,
): TipoXsdComprobatorio | null {
  for (const [tipo, conf] of confirmacoes.entries()) {
    if (
      conf.arquivo_index === arquivo.index ||
      conf.nome_arquivo === arquivo.nome_original
    ) {
      return tipo
    }
  }
  return null
}

// ─── Componente ─────────────────────────────────────────────────────────────

export function DialogSelecionarArquivo({
  tipoAlvo,
  arquivos,
  confirmacoes,
  onSelecionar,
  onFechar,
}: Props) {
  const [selecionado, setSelecionado] = useState<number | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Reset quando abre com novo tipo
  useEffect(() => {
    setSelecionado(null)
  }, [tipoAlvo])

  // ESC para fechar
  useEffect(() => {
    if (!tipoAlvo) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [tipoAlvo, onFechar])

  // Click outside
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onFechar()
      }
    },
    [onFechar],
  )

  if (!tipoAlvo) return null

  const nomeAmigavel = LABEL_TIPO_XSD[tipoAlvo] ?? tipoAlvo

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Selecionar arquivo
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Escolha o arquivo correspondente a:{" "}
              <strong className="text-violet-600">{nomeAmigavel}</strong>
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

        {/* Lista de arquivos */}
        <div className="flex-1 overflow-auto p-4">
          {arquivos.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              Nenhum arquivo encontrado na sessão.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {arquivos.map((arq) => {
                const vinculadoA = arquivoJaVinculado(arq, confirmacoes)
                const ehSelecionado = selecionado === arq.index

                return (
                  <li key={arq.index}>
                    <button
                      onClick={() => setSelecionado(arq.index)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                        ehSelecionado
                          ? "border-violet-400 bg-violet-50 dark:border-violet-600 dark:bg-violet-950/30"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
                      }`}
                    >
                      {/* Ícone por tipo MIME */}
                      {iconeParaMime(arq.mime_type)}

                      {/* Info do arquivo */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-gray-800 dark:text-gray-200">
                          {arq.nome_original}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2">
                          {arq.tipo_detectado && arq.tipo_detectado !== "outro" && (
                            <span className="text-xs text-gray-500">
                              IA: {arq.tipo_detectado}
                            </span>
                          )}
                          {vinculadoA && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              <CheckCircle2 className="h-3 w-3" />
                              Já em: {LABEL_TIPO_XSD[vinculadoA] ?? vinculadoA}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Indicador de seleção */}
                      {ehSelecionado && (
                        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-white">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {selecionado != null
                ? `Arquivo selecionado: ${arquivos.find((a) => a.index === selecionado)?.nome_original ?? ""}`
                : "Clique em um arquivo para selecioná-lo"}
            </p>
            <div className="flex gap-2">
              <button
                onClick={onFechar}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (selecionado != null && tipoAlvo) {
                    const arq = arquivos.find((a) => a.index === selecionado)
                    if (arq) onSelecionar(tipoAlvo, arq)
                  }
                }}
                disabled={selecionado == null}
                className="flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Vincular arquivo
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
