"use client"

/**
 * Sprint 2 — Card de arquivo processado (somente informação)
 *
 * Exibido na seção "Arquivos enviados" da revisão pós-extração.
 * Mostra nome, tipo MIME, tamanho e badges de destino (XML/Acervo).
 * Os destinos são definidos na dialog de confirmação (DialogVisualizarDocumento).
 */

import { FileText, Image as ImageIcon, File as FileIcon, CheckCircle2 } from "lucide-react"
import type { TipoXsdComprobatorio } from "@/lib/diploma/regras-fic"

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

export interface ArquivoClassificavel {
  id: string
  nome_original: string
  mime_type: string
  tamanho_bytes: number | null
  destino_xml: boolean
  destino_acervo: boolean
  tipo_xsd: TipoXsdComprobatorio | null
}

interface Props {
  arquivo: ArquivoClassificavel
  onChange: (patch: Partial<ArquivoClassificavel>) => void
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "tamanho desconhecido"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function iconePorMime(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon
  if (mime === "application/pdf") return FileText
  return FileIcon
}

export function CardArquivoClassificacao({ arquivo }: Props) {
  const Icone = iconePorMime(arquivo.mime_type)

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-800">
        <Icone className="h-4 w-4 text-gray-500" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
          {arquivo.nome_original}
        </p>
        <p className="text-xs text-gray-400">
          {arquivo.mime_type} · {formatBytes(arquivo.tamanho_bytes)}
          {arquivo.tipo_xsd && (
            <> · <span className="text-violet-600 dark:text-violet-400">{LABEL_TIPO_XSD[arquivo.tipo_xsd]}</span></>
          )}
        </p>
      </div>

      {/* Badges de destino */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {arquivo.destino_xml && (
          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            <CheckCircle2 size={10} /> XML
          </span>
        )}
        {arquivo.destino_acervo && (
          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            <CheckCircle2 size={10} /> Acervo
          </span>
        )}
        {!arquivo.destino_xml && !arquivo.destino_acervo && (
          <span className="text-[10px] text-gray-400 italic">sem destino</span>
        )}
      </div>
    </div>
  )
}
