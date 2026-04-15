"use client"

/**
 * Sprint 2 / Sessão 043 — Gate FIC com 3 estados visuais (Tela 2)
 *
 * Mostra as 4 regras obrigatórias da FIC com estados:
 *   🟡 Detectado — IA identificou o documento, aguarda confirmação humana
 *   🟢 Confirmado — Operador visualizou e confirmou o documento
 *   ⚪ Pendente — Nenhum arquivo identificado para este tipo
 *
 * O operador clica em cada comprobatório detectado para abrir o dialog
 * de visualização e confirmar. Só com 4/4 confirmados o botão "Criar
 * Processo" é liberado sem override.
 */

import { CheckCircle2, Circle, Eye, AlertCircle, Upload } from "lucide-react"
import {
  COMPROBATORIOS_OBRIGATORIOS_FIC,
  type TipoXsdComprobatorio,
  type RegraComprobatorio,
} from "@/lib/diploma/regras-fic"
import type {
  ConfirmacaoComprobatorio,
  StatusConfirmacao,
} from "@/lib/diploma/mapa-comprobatorios"

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface Props {
  /** Mapa de tipo XSD → estado de confirmação (vem do page.tsx) */
  confirmacoes: Map<TipoXsdComprobatorio, ConfirmacaoComprobatorio>
  /** Callback quando o operador quer visualizar/confirmar um comprobatório detectado */
  onVisualizarDocumento: (confirmacao: ConfirmacaoComprobatorio) => void
  /** Callback quando o operador quer subir manualmente um arquivo para um tipo pendente */
  onSubstituirArquivo?: (tipo: TipoXsdComprobatorio) => void
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Avalia o status de uma regra FIC dado o mapa de confirmações. */
function statusDaRegra(
  regra: RegraComprobatorio,
  confirmacoes: Map<TipoXsdComprobatorio, ConfirmacaoComprobatorio>,
): {
  status: StatusConfirmacao
  confirmacao: ConfirmacaoComprobatorio | null
} {
  const tipos =
    regra.kind === "simples" ? [regra.tipo] : regra.tipos

  // Prioridade: confirmado > detectado > pendente
  let melhorStatus: StatusConfirmacao = "pendente"
  let melhorConfirmacao: ConfirmacaoComprobatorio | null = null

  for (const tipo of tipos) {
    const c = confirmacoes.get(tipo)
    if (!c) continue

    if (c.status === "confirmado") {
      return { status: "confirmado", confirmacao: c }
    }
    if (c.status === "detectado") {
      melhorStatus = "detectado"
      melhorConfirmacao = c
    }
  }

  return { status: melhorStatus, confirmacao: melhorConfirmacao }
}

// ─── Componente ─────────────────────────────────────────────────────────────

export function GateFicComprobatorios({
  confirmacoes,
  onVisualizarDocumento,
  onSubstituirArquivo,
}: Props) {
  const total = COMPROBATORIOS_OBRIGATORIOS_FIC.length

  // Contagem de cada status
  let confirmados = 0
  let detectados = 0
  for (const regra of COMPROBATORIOS_OBRIGATORIOS_FIC) {
    const { status } = statusDaRegra(regra, confirmacoes)
    if (status === "confirmado") confirmados++
    else if (status === "detectado") detectados++
  }

  const tudoConfirmado = confirmados === total

  // Cor do container
  const containerClass = tudoConfirmado
    ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20"
    : detectados > 0 || confirmados > 0
      ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20"
      : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50"

  // Texto do badge
  const badgeText = tudoConfirmado
    ? `${total}/${total} confirmados`
    : confirmados > 0 || detectados > 0
      ? `${confirmados}/${total} confirmados · ${detectados} aguardando`
      : `0/${total} — nenhum detectado`

  const badgeClass = tudoConfirmado
    ? "text-green-700 dark:text-green-300"
    : confirmados > 0 || detectados > 0
      ? "text-amber-700 dark:text-amber-300"
      : "text-gray-500 dark:text-gray-400"

  return (
    <div className={`rounded-lg border p-4 ${containerClass}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Comprobatórios obrigatórios
        </h3>
        <span className={`text-xs font-medium ${badgeClass}`}>
          {badgeText}
        </span>
      </div>

      <ul className="mt-3 space-y-2">
        {COMPROBATORIOS_OBRIGATORIOS_FIC.map((regra) => {
          const { status, confirmacao } = statusDaRegra(regra, confirmacoes)

          return (
            <RegraItem
              key={regra.nome_amigavel}
              regra={regra}
              status={status}
              confirmacao={confirmacao}
              onVisualizar={onVisualizarDocumento}
              onSubstituir={onSubstituirArquivo}
            />
          )
        })}
      </ul>

      {!tudoConfirmado && detectados > 0 && (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
          Clique em &quot;Visualizar&quot; para confirmar cada documento detectado
          pela IA antes de criar o processo.
        </p>
      )}

      {!tudoConfirmado && detectados === 0 && confirmados === 0 && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Nenhum comprobatório foi identificado nos arquivos enviados.
          Você pode prosseguir assim mesmo — será pedida uma justificativa.
        </p>
      )}

      {tudoConfirmado && (
        <p className="mt-3 text-xs text-green-700 dark:text-green-400">
          Todos os comprobatórios obrigatórios foram confirmados.
          Você pode criar o processo.
        </p>
      )}
    </div>
  )
}

// ─── Subcomponente: linha individual de regra ───────────────────────────────

function RegraItem({
  regra,
  status,
  confirmacao,
  onVisualizar,
  onSubstituir,
}: {
  regra: RegraComprobatorio
  status: StatusConfirmacao
  confirmacao: ConfirmacaoComprobatorio | null
  onVisualizar: (c: ConfirmacaoComprobatorio) => void
  onSubstituir?: (tipo: TipoXsdComprobatorio) => void
}) {
  return (
    <li className="rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-gray-200 dark:hover:border-gray-700">
      <div className="flex items-start gap-2 text-sm">
        {/* Ícone de status */}
        {status === "confirmado" && (
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
        )}
        {status === "detectado" && (
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
        )}
        {status === "pendente" && (
          <Circle className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
        )}

        <div className="min-w-0 flex-1">
          {/* Nome da regra */}
          <span
            className={
              status === "confirmado"
                ? "text-gray-700 dark:text-gray-300"
                : status === "detectado"
                  ? "font-medium text-amber-800 dark:text-amber-200"
                  : "text-gray-500 dark:text-gray-400"
            }
          >
            {regra.nome_amigavel}
          </span>

          {/* Info adicional por status */}
          {status === "detectado" && confirmacao?.nome_arquivo && (
            <p className="mt-0.5 truncate text-xs text-amber-600 dark:text-amber-400">
              Detectado: {confirmacao.nome_arquivo}
              {confirmacao.confianca != null && (
                <> · {(confirmacao.confianca * 100).toFixed(0)}% confiança</>
              )}
            </p>
          )}

          {status === "confirmado" && confirmacao?.nome_arquivo && (
            <p className="mt-0.5 truncate text-xs text-green-600 dark:text-green-400">
              {confirmacao.nome_arquivo}
            </p>
          )}
        </div>

        {/* Ações */}
        <div className="flex flex-shrink-0 items-center gap-1">
          {status === "detectado" && confirmacao && (
            <button
              onClick={() => onVisualizar(confirmacao)}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/30"
              title="Visualizar documento e confirmar"
            >
              <Eye className="h-3.5 w-3.5" />
              Visualizar
            </button>
          )}

          {status === "confirmado" && confirmacao && (
            <button
              onClick={() => onVisualizar(confirmacao)}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 dark:text-green-300 dark:hover:bg-green-900/30"
              title="Ver documento confirmado"
            >
              <Eye className="h-3.5 w-3.5" />
              Ver
            </button>
          )}

          {status === "pendente" && onSubstituir && (
            <button
              onClick={() => {
                const tipo =
                  regra.kind === "simples" ? regra.tipo : regra.tipos[0]
                onSubstituir(tipo)
              }}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              title="Enviar arquivo para este comprobatório"
            >
              <Upload className="h-3.5 w-3.5" />
              Enviar
            </button>
          )}
        </div>
      </div>
    </li>
  )
}
