"use client"

/**
 * Sprint 2 / Etapa 3c — Modal de override para criação de processo
 *
 * Aparece quando o POST /converter retorna 422 com violações bloqueantes.
 * O operador vê a lista de violações e, se quiser prosseguir, escreve uma
 * justificativa (mín 10 chars) que vira registro em `validacao_overrides`.
 *
 * Princípio universal (sessão 022): toda regra automática pode ser
 * sobrescrita por decisão humana com justificativa.
 */

import { useState } from "react"
import { AlertTriangle, X, Loader2 } from "lucide-react"
import type { ViolacaoGate } from "@/lib/diploma/gate-criacao-processo"

interface Props {
  violacoes: ViolacaoGate[]
  bloqueantes: ViolacaoGate[]
  onCancelar: () => void
  onConfirmar: (justificativa: string) => Promise<void>
}

export function ModalOverrideCriacao({
  violacoes,
  bloqueantes,
  onCancelar,
  onConfirmar,
}: Props) {
  const [justificativa, setJustificativa] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const justificativaValida = justificativa.trim().length >= 10

  const handleConfirmar = async () => {
    if (!justificativaValida || enviando) return
    setEnviando(true)
    setErro(null)
    try {
      await onConfirmar(justificativa.trim())
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao criar processo")
      setEnviando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !enviando) onCancelar()
      }}
    >
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 p-5 dark:border-gray-700">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Criar processo com pendências
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Algumas regras não foram atendidas. Você pode prosseguir
                registrando uma justificativa.
              </p>
            </div>
          </div>
          <button
            onClick={onCancelar}
            disabled={enviando}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50 dark:hover:text-gray-200"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto p-5">
          <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Pendências detectadas ({bloqueantes.length} bloqueante
            {bloqueantes.length === 1 ? "" : "s"}):
          </h3>
          <ul className="mb-5 space-y-1.5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/20">
            {violacoes.map((v, i) => (
              <li
                key={i}
                className={`flex items-start gap-2 ${
                  v.severidade === "bloqueante"
                    ? "text-amber-900 dark:text-amber-200"
                    : "text-gray-600 dark:text-gray-400"
                }`}
              >
                <span className="mt-0.5">
                  {v.severidade === "bloqueante" ? "🛑" : "⚠️"}
                </span>
                <span>{v.mensagem}</span>
              </li>
            ))}
          </ul>

          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
            Justificativa <span className="text-red-500">*</span>
          </label>
          <p className="mb-2 text-xs text-gray-500">
            Explique o motivo de prosseguir mesmo com as pendências. Esse texto
            fica registrado em auditoria (mínimo 10 caracteres).
          </p>
          <textarea
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            disabled={enviando}
            rows={4}
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:ring-violet-500 disabled:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            placeholder="Ex: Aluno apresentou documento original em secretaria, cópia digital será adicionada depois."
          />
          <p className="mt-1 text-xs text-gray-400">
            {justificativa.trim().length}/10 caracteres mínimos
          </p>

          {erro && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
              {erro}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 p-5 dark:border-gray-700">
          <button
            onClick={onCancelar}
            disabled={enviando}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Voltar e corrigir
          </button>
          <button
            onClick={handleConfirmar}
            disabled={!justificativaValida || enviando}
            className="flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            {enviando ? "Criando..." : "Criar processo mesmo assim"}
          </button>
        </div>
      </div>
    </div>
  )
}
