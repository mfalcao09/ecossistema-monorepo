/**
 * Sprint 2 / Etapa 2 — Tela 1: Upload drag-and-drop dos documentos do diplomado
 *
 * Fluxo:
 *   1. Secretária arrasta/seleciona arquivos (PDF + imagens)
 *   2. Cada arquivo é validado localmente (tipo + tamanho)
 *   3. Ao clicar "Extrair dados com IA":
 *      a) Upload paralelo direto pro Supabase Storage (bucket processo-arquivos)
 *      b) POST /api/extracao/iniciar com a lista de paths
 *      c) Redireciona pra /revisao/[sessaoId]
 *
 * Decisões (sessão 030):
 *   - react-dropzone (headless, acessível, padrão de mercado)
 *   - Upload client-side direto (não passa pelo serverless Vercel)
 *   - Validação fail-fast: se 1 arquivo for inválido, nenhum sobe
 */

"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useDropzone, type FileRejection } from "react-dropzone"
import {
  ArrowLeft,
  CloudUpload,
  FileText,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Trash2,
  AlertCircle,
  ArrowRightCircle,
} from "lucide-react"

// ─── Constantes de recovery ─────────────────────────────────────────────────

const STORAGE_KEY_ULTIMA_SESSAO = "diploma:ultima-sessao"
// TTL no client: não sugere recovery de sessão mais velha que isso.
const RECOVERY_TTL_MS = 6 * 60 * 60 * 1000 // 6h

interface SessaoRecovery {
  sessaoId: string
  criadaEm: number
}

import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  uploadArquivosParaProcesso,
  validarArquivoLocal,
  type UploadProgressEvento,
} from "@/lib/extracao/upload"

// ─── Tipos locais ────────────────────────────────────────────────────────────

type StatusEtapa = "ocioso" | "validando" | "subindo" | "iniciando_extracao" | "erro"

interface ArquivoLocal {
  file: File
  id: string
  progresso: UploadProgressEvento["status"]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function iconePorTipo(mimeType: string) {
  if (mimeType.startsWith("image/")) return ImageIcon
  return FileText
}

function novoIdLocal() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ─── Componente principal ───────────────────────────────────────────────────

export default function NovoProcessoPage() {
  const router = useRouter()

  const [arquivos, setArquivos] = useState<ArquivoLocal[]>([])
  const [status, setStatus] = useState<StatusEtapa>("ocioso")
  const [erroMensagem, setErroMensagem] = useState<string | null>(null)
  const [sessaoRecovery, setSessaoRecovery] = useState<string | null>(null)

  // ── Recovery: ao montar, checa se há sessão ativa no servidor (banner
  //    principal) OU no localStorage (fallback apenas se servidor falhar).
  useEffect(() => {
    let cancelado = false

    // 1. Pergunta ao servidor — fonte da verdade
    fetch("/api/extracao/ativa", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { sessao: null }))
      .then((data: { sessao: { id: string } | null }) => {
        if (cancelado) return
        if (data?.sessao?.id) {
          setSessaoRecovery(data.sessao.id)
          return
        }
        // Servidor confirmou: não há sessão ativa.
        // Limpa o localStorage para evitar exibir banner de sessão já descartada.
        try {
          localStorage.removeItem(STORAGE_KEY_ULTIMA_SESSAO)
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        // Servidor inacessível — usa localStorage como fallback de último recurso
        if (cancelado) return
        try {
          const raw = localStorage.getItem(STORAGE_KEY_ULTIMA_SESSAO)
          if (!raw) return
          const parsed = JSON.parse(raw) as SessaoRecovery
          if (
            parsed?.sessaoId &&
            parsed.criadaEm &&
            Date.now() - parsed.criadaEm < RECOVERY_TTL_MS
          ) {
            setSessaoRecovery(parsed.sessaoId)
          } else {
            localStorage.removeItem(STORAGE_KEY_ULTIMA_SESSAO)
          }
        } catch {
          /* ignore */
        }
      })

    return () => {
      cancelado = true
    }
  }, [])

  // ── Drop handler ─────────────────────────────────────────────────────────
  const onDrop = useCallback(
    (aceitos: File[], rejeitados: FileRejection[]) => {
      setErroMensagem(null)

      // Mensagens de rejeição do react-dropzone (já valida tipo + tamanho)
      if (rejeitados.length > 0) {
        const motivos = rejeitados.map((r) => {
          const codigo = r.errors[0]?.code
          if (codigo === "file-too-large") {
            return `${r.file.name}: maior que 25 MB`
          }
          if (codigo === "file-invalid-type") {
            return `${r.file.name}: tipo não aceito`
          }
          return `${r.file.name}: ${r.errors[0]?.message || "erro"}`
        })
        setErroMensagem(motivos.join(" • "))
      }

      // Validação dupla (defesa em profundidade — react-dropzone pode evoluir)
      const validados: ArquivoLocal[] = []
      for (const file of aceitos) {
        const erro = validarArquivoLocal(file)
        if (erro) {
          setErroMensagem((prev) => (prev ? `${prev} • ${file.name}: ${erro}` : `${file.name}: ${erro}`))
          continue
        }
        validados.push({ file, id: novoIdLocal(), progresso: "pendente" })
      }

      setArquivos((prev) => [...prev, ...validados])
    },
    [],
  )

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ALLOWED_MIME_TYPES.reduce<Record<string, string[]>>((acc, mime) => {
      acc[mime] = []
      return acc
    }, {}),
    maxSize: MAX_FILE_SIZE_BYTES,
    multiple: true,
    noClick: true, // o "Selecionar arquivos" tem botão dedicado, evita click duplo
  })

  // ── Remover arquivo da lista ─────────────────────────────────────────────
  const removerArquivo = (id: string) => {
    setArquivos((prev) => prev.filter((a) => a.id !== id))
  }

  // ── Limpar tudo ──────────────────────────────────────────────────────────
  const limparTudo = () => {
    setArquivos([])
    setErroMensagem(null)
  }

  // ── Ignorar recovery banner (usuário quer começar do zero) ───────────────
  const ignorarRecovery = () => {
    setSessaoRecovery(null)
    try {
      localStorage.removeItem(STORAGE_KEY_ULTIMA_SESSAO)
    } catch {
      /* ignore */
    }
  }

  // ── Disparar upload + extração ───────────────────────────────────────────
  const handleExtrair = async () => {
    if (arquivos.length === 0) return
    setErroMensagem(null)

    try {
      setStatus("subindo")

      const files = arquivos.map((a) => a.file)
      const uploadados = await uploadArquivosParaProcesso(files, (evt) => {
        // Atualiza o status individual do arquivo na UI
        setArquivos((prev) =>
          prev.map((a, idx) =>
            idx === evt.arquivoIndex ? { ...a, progresso: evt.status } : a,
          ),
        )
      })

      setStatus("iniciando_extracao")

      const res = await fetch("/api/extracao/iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arquivos: uploadados }),
        cache: "no-store",
      })

      if (!res.ok) {
        const corpo = await res.json().catch(() => ({} as Record<string, unknown>))

        // 409 "extração em andamento" — oferece retomada direta em vez de erro cru
        if (res.status === 409 && typeof (corpo as { sessao_existente?: string }).sessao_existente === 'string') {
          const idExistente = (corpo as { sessao_existente: string }).sessao_existente
          setSessaoRecovery(idExistente)
          try {
            localStorage.setItem(
              STORAGE_KEY_ULTIMA_SESSAO,
              JSON.stringify({ sessaoId: idExistente, criadaEm: Date.now() } satisfies SessaoRecovery),
            )
          } catch { /* ignore */ }
          setErroMensagem(
            (corpo as { erro?: string }).erro ||
              "Já existe uma extração em andamento. Continue de onde parou ou descarte o rascunho.",
          )
          setStatus("erro")
          return
        }

        throw new Error(
          (corpo as { erro?: string; detalhe?: string }).erro ||
            (corpo as { detalhe?: string }).detalhe ||
            `Falha ao iniciar extração (HTTP ${res.status})`,
        )
      }

      const dados = await res.json()
      if (!dados?.sessao_id) {
        throw new Error("Resposta da API sem sessao_id")
      }

      // Grava recovery local antes de redirecionar — se o navegador cair
      // entre aqui e a Tela 2, a próxima visita à Tela 1 oferece retomada.
      try {
        localStorage.setItem(
          STORAGE_KEY_ULTIMA_SESSAO,
          JSON.stringify({ sessaoId: dados.sessao_id, criadaEm: Date.now() } satisfies SessaoRecovery),
        )
      } catch {
        /* ignore quota errors */
      }

      // Sucesso → redireciona pra Tela 2
      router.push(`/diploma/processos/novo/revisao/${dados.sessao_id}`)
    } catch (err) {
      console.error("[novo-processo]", err)
      setErroMensagem(err instanceof Error ? err.message : "Erro inesperado")
      setStatus("erro")
    }
  }

  const desabilitado = arquivos.length === 0 || status === "subindo" || status === "iniciando_extracao"
  const processando = status === "subindo" || status === "iniciando_extracao"

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.push("/diploma/processos")}
          className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          aria-label="Voltar para lista de processos"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Novo processo de diplomação
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Envie os documentos do diplomado e nossa IA vai extrair os dados automaticamente.
          </p>
        </div>
      </div>

      {/* Banner de recovery — existe sessão anterior ativa */}
      {sessaoRecovery && (
        <div
          role="status"
          className="mb-6 flex items-start gap-3 rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm dark:border-violet-900 dark:bg-violet-950/30"
        >
          <ArrowRightCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-violet-600 dark:text-violet-400" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-violet-900 dark:text-violet-200">
              Você tem uma extração em andamento
            </p>
            <p className="mt-0.5 text-violet-700 dark:text-violet-300">
              Continue de onde parou para não perder o trabalho já feito, ou descarte para começar um processo novo.
            </p>
          </div>
          <div className="flex flex-shrink-0 gap-2">
            <button
              type="button"
              onClick={() =>
                router.push(`/diploma/processos/novo/revisao/${sessaoRecovery}`)
              }
              className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"
            >
              Continuar extração
            </button>
            <button
              type="button"
              onClick={ignorarRecovery}
              className="rounded-md border border-violet-300 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-transparent dark:text-violet-300 dark:hover:bg-violet-900/40"
            >
              Ignorar
            </button>
          </div>
        </div>
      )}

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`relative rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
          isDragActive
            ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
            : "border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50"
        } ${processando ? "pointer-events-none opacity-60" : ""}`}
      >
        <input {...getInputProps()} aria-label="Arquivos do diplomado" />

        <CloudUpload
          className={`mx-auto mb-4 h-12 w-12 ${
            isDragActive ? "text-violet-600" : "text-gray-400"
          }`}
        />

        <p className="mb-2 text-base font-medium text-gray-900 dark:text-gray-100">
          {isDragActive
            ? "Solte os arquivos aqui"
            : "Arraste os documentos do diplomado para esta área"}
        </p>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          PDF ou imagem (PNG, JPG, WebP, HEIC) — até 25 MB por arquivo
        </p>

        <button
          type="button"
          onClick={open}
          disabled={processando}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Selecionar arquivos
        </button>

        <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
          Documentos típicos: RG, CPF, Certidão de nascimento/casamento, Histórico do Ensino Médio, Título de eleitor
        </p>
      </div>

      {/* Erro */}
      {erroMensagem && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{erroMensagem}</span>
        </div>
      )}

      {/* Lista de arquivos */}
      {arquivos.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {arquivos.length} {arquivos.length === 1 ? "arquivo" : "arquivos"}
            </h2>
            {!processando && (
              <button
                onClick={limparTudo}
                className="text-xs text-gray-500 hover:text-red-600 dark:text-gray-400"
              >
                Remover todos
              </button>
            )}
          </div>

          <ul className="space-y-2">
            {arquivos.map((arq) => {
              const Icone = iconePorTipo(arq.file.type)
              return (
                <li
                  key={arq.id}
                  className="flex items-center gap-3 rounded-md border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  <Icone className="h-5 w-5 flex-shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {arq.file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatarTamanho(arq.file.size)}
                      {arq.progresso === "enviando" && " • Enviando..."}
                      {arq.progresso === "concluido" && " • ✓ Enviado"}
                      {arq.progresso === "erro" && " • ✗ Erro"}
                    </p>
                  </div>

                  {arq.progresso === "enviando" && (
                    <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                  )}

                  {!processando && (
                    <button
                      onClick={() => removerArquivo(arq.id)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                      aria-label={`Remover ${arq.file.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Footer com botão de extração */}
      <div className="mt-8 flex items-center justify-end gap-3">
        <button
          onClick={() => router.push("/diploma/processos")}
          disabled={processando}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          Cancelar
        </button>
        <button
          onClick={handleExtrair}
          disabled={desabilitado}
          className="flex items-center gap-2 rounded-md bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {processando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {status === "subindo" ? "Enviando arquivos..." : "Iniciando extração..."}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Extrair dados com IA
            </>
          )}
        </button>
      </div>
    </div>
  )
}
