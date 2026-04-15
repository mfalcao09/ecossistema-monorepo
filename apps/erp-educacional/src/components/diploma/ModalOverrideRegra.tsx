"use client";

/**
 * Modal de Override de Regra de Negócio
 *
 * Bug #H — Princípio do override humano (decisão Marcelo 2026-04-07):
 * "A confirmação humana pode sobrescrever qualquer regra de negócio."
 *
 * Quando a API /gerar-xml retorna 422 com `tipo: "regra_negocio"` e uma
 * lista de `violacoes`, este modal abre permitindo ao operador:
 *  1. Ler a mensagem de cada violação
 *  2. Ver os valores originais que dispararam a regra
 *  3. Escrever uma justificativa textual obrigatória (mínimo 10 chars)
 *  4. Confirmar — re-chama a API com o body acrescido de `overrides`
 *
 * Após a confirmação, o backend grava em `validacao_overrides` (audit trail
 * completo) e prossegue com a geração do XML.
 */

import { useState } from "react";
import { AlertTriangle, XCircle, Loader2, ShieldAlert } from "lucide-react";

export interface ViolacaoRegraResposta {
  codigo: string;
  mensagem: string;
  severidade: "erro" | "aviso";
  valores_originais: Record<string, unknown>;
}

export interface OverridePayload {
  codigo: string;
  justificativa: string;
  valores_originais: Record<string, unknown>;
}

interface Props {
  aberto: boolean;
  violacoes: ViolacaoRegraResposta[];
  onCancelar: () => void;
  onConfirmar: (overrides: OverridePayload[]) => Promise<void>;
}

export function ModalOverrideRegra({
  aberto,
  violacoes,
  onCancelar,
  onConfirmar,
}: Props) {
  // Uma justificativa por violação (chave = código da regra)
  const [justificativas, setJustificativas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string>("");

  if (!aberto) return null;

  const todasJustificadas = violacoes.every(
    (v) => (justificativas[v.codigo] ?? "").trim().length >= 10
  );

  const handleConfirmar = async () => {
    setErroEnvio("");
    if (!todasJustificadas) {
      setErroEnvio("Cada violação exige justificativa de no mínimo 10 caracteres.");
      return;
    }
    setEnviando(true);
    try {
      const payload: OverridePayload[] = violacoes.map((v) => ({
        codigo: v.codigo,
        justificativa: (justificativas[v.codigo] ?? "").trim(),
        valores_originais: v.valores_originais,
      }));
      await onConfirmar(payload);
    } catch (err) {
      setErroEnvio(err instanceof Error ? err.message : "Erro ao confirmar override.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-override-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-start gap-3 bg-amber-50">
          <ShieldAlert className="text-amber-600 flex-shrink-0 mt-0.5" size={22} />
          <div className="flex-1">
            <h2 id="modal-override-title" className="text-base font-bold text-gray-900">
              Confirmação humana necessária
            </h2>
            <p className="text-xs text-gray-600 mt-1">
              Encontramos {violacoes.length === 1 ? "uma divergência" : `${violacoes.length} divergências`} nos dados.
              Você pode <strong>cancelar e corrigir</strong>, ou <strong>justificar e prosseguir</strong>.
              Sua justificativa fica registrada para auditoria.
            </p>
          </div>
          <button
            onClick={onCancelar}
            disabled={enviando}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-50"
            aria-label="Fechar"
          >
            <XCircle size={20} />
          </button>
        </div>

        {/* Lista de violações */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {violacoes.map((v) => (
            <div
              key={v.codigo}
              className="border border-amber-200 bg-amber-50/50 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-mono text-amber-700 font-semibold">{v.codigo}</p>
                  <p className="text-sm text-gray-800 mt-1">{v.mensagem}</p>
                </div>
              </div>

              {/* Valores originais (snapshot p/ contexto) */}
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5">
                  Valores observados
                </p>
                <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap break-words">
                  {JSON.stringify(v.valores_originais, null, 2)}
                </pre>
              </div>

              {/* Campo de justificativa */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Justificativa <span className="text-red-600">*</span>
                  <span className="text-gray-400 font-normal ml-1">(mínimo 10 caracteres)</span>
                </label>
                <textarea
                  value={justificativas[v.codigo] ?? ""}
                  onChange={(e) =>
                    setJustificativas((prev) => ({ ...prev, [v.codigo]: e.target.value }))
                  }
                  disabled={enviando}
                  rows={3}
                  placeholder="Ex: Aluno transferido em 2018, grade antiga aceita conforme parecer NDE 042/2019."
                  className="w-full text-xs border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-gray-100"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  {(justificativas[v.codigo] ?? "").trim().length} caracteres
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 space-y-3">
          {erroEnvio && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
              {erroEnvio}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] text-gray-500">
              A confirmação será gravada com seu usuário e timestamp para auditoria.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onCancelar}
                disabled={enviando}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar e corrigir
              </button>
              <button
                onClick={handleConfirmar}
                disabled={enviando || !todasJustificadas}
                className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {enviando && <Loader2 size={12} className="animate-spin" />}
                {enviando ? "Registrando..." : "Confirmar e prosseguir"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
