/**
 * BannerSessaoAtiva — banner fixo no topo do ERP quando existe uma
 * extração do usuário em estado "ativo" (processando, rascunho,
 * aguardando_revisao). Oferece retomada em 1 clique.
 *
 * Montado globalmente no layout (erp), faz fetch em /api/extracao/ativa
 * no mount de cada navegação. Se o usuário já está na Tela 2 daquela
 * sessão, o banner se esconde para não poluir.
 *
 * Sessão 032 — Opção 2 do plano recovery (1-4 juntas).
 */

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Sparkles, X, Loader2 } from "lucide-react"

interface SessaoAtiva {
  id: string
  processo_id: string | null
  status: "processando" | "rascunho" | "aguardando_revisao"
  iniciado_em: string | null
  total_arquivos: number
}

const LABEL_STATUS: Record<string, string> = {
  processando: "IA extraindo dados…",
  rascunho: "Dados extraídos — aguardando revisão",
  aguardando_revisao: "Dados extraídos — aguardando revisão",
}

export default function BannerSessaoAtiva() {
  const pathname = usePathname()
  const [sessao, setSessao] = useState<SessaoAtiva | null>(null)
  const [fechado, setFechado] = useState(false)
  const [carregando, setCarregando] = useState(false)

  // Esconde em rotas não-ERP ou quando já estamos vendo a sessão.
  const ocultarPorRota =
    !pathname?.startsWith("/diploma") ||
    pathname?.startsWith("/diploma/processos/novo/revisao/")

  useEffect(() => {
    if (ocultarPorRota) return
    let cancelado = false
    setCarregando(true)

    fetch("/api/extracao/ativa", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { sessao: null }))
      .then((data: { sessao: SessaoAtiva | null }) => {
        if (cancelado) return
        setSessao(data?.sessao ?? null)
      })
      .catch(() => {
        if (!cancelado) setSessao(null)
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })

    return () => {
      cancelado = true
    }
  }, [pathname, ocultarPorRota])

  if (ocultarPorRota) return null
  if (fechado) return null
  if (carregando) return null
  if (!sessao) return null

  const href = `/diploma/processos/novo/revisao/${sessao.id}`
  const label = LABEL_STATUS[sessao.status] ?? "Extração em andamento"

  return (
    <div
      role="status"
      className="border-b border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-sm">
        {sessao.status === "processando" ? (
          <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 flex-shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          <span className="font-medium">{label}</span>
          <span className="ml-2 text-violet-700 dark:text-violet-300">
            · {sessao.total_arquivos}{" "}
            {sessao.total_arquivos === 1 ? "arquivo" : "arquivos"}
          </span>
        </div>

        <Link
          href={href}
          className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700"
        >
          Retomar
        </Link>

        <button
          type="button"
          onClick={() => setFechado(true)}
          className="rounded p-1 text-violet-700 hover:bg-violet-100 dark:text-violet-300 dark:hover:bg-violet-900/40"
          aria-label="Fechar aviso"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
