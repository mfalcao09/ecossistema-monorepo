"use client";

import { useState } from "react";
import {
  PlayCircle,
  X,
  Loader2,
  MessageSquare,
  BookOpen,
  Clock,
  Zap,
} from "lucide-react";

interface PlaygroundChunk {
  id: string;
  title: string;
  score: number;
}

interface PlaygroundPanelProps {
  agentId: string;
  agentName: string;
  onClose: () => void;
}

export function PlaygroundPanel({
  agentId,
  agentName,
  onClose,
}: PlaygroundPanelProps) {
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    output_messages: string[];
    rag_chunks: PlaygroundChunk[];
    tokens_used: number;
    latency_ms: number;
    error: string | null;
  } | null>(null);

  async function handleRun() {
    if (!input.trim() || running) return;
    setRunning(true);
    try {
      const r = await fetch(`/api/atendimento/ds-agentes/${agentId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input_text: input.trim(), dry_run: true }),
      });
      const j = await r.json();
      setResult(j);
    } catch (err) {
      setResult({
        output_messages: [],
        rag_chunks: [],
        tokens_used: 0,
        latency_ms: 0,
        error: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <PlayCircle size={20} className="text-indigo-600" />
            <div>
              <h2 className="font-bold text-gray-900 text-sm">Playground</h2>
              <p className="text-xs text-gray-400">
                {agentName} · dry run (não envia para aluno)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Input */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Mensagem do aluno
            </label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              rows={3}
              placeholder="Ex: Qual é o prazo de matrícula para o 2º semestre?"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.ctrlKey) handleRun();
              }}
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Ctrl+Enter para executar
            </p>
          </div>

          <button
            onClick={handleRun}
            disabled={running || !input.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            {running ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Executando…
              </>
            ) : (
              <>
                <PlayCircle size={16} /> Executar agente
              </>
            )}
          </button>

          {/* Resultado */}
          {result && (
            <div className="space-y-4">
              {/* Métricas */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock size={12} /> {result.latency_ms}ms
                </span>
                <span className="flex items-center gap-1">
                  <Zap size={12} /> {result.tokens_used} tokens
                </span>
                {result.rag_chunks.length > 0 && (
                  <span className="flex items-center gap-1">
                    <BookOpen size={12} /> {result.rag_chunks.length} chunk(s)
                    RAG
                  </span>
                )}
              </div>

              {/* Erro */}
              {result.error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  <strong>Erro:</strong> {result.error}
                </div>
              )}

              {/* Resposta do agente */}
              {result.output_messages.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                    <MessageSquare size={12} /> Resposta do agente (
                    {result.output_messages.length} mensagem
                    {result.output_messages.length > 1 ? "s" : ""})
                  </p>
                  <div className="space-y-2">
                    {result.output_messages.map((msg, i) => (
                      <div key={i} className="flex gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[10px] font-bold text-indigo-600">
                            {i + 1}
                          </span>
                        </div>
                        <div className="flex-1 bg-indigo-50 rounded-xl px-4 py-3 text-sm text-gray-800 whitespace-pre-wrap">
                          {msg}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chunks RAG usados */}
              {result.rag_chunks.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                    <BookOpen size={12} /> Chunks RAG utilizados
                  </p>
                  <div className="space-y-1">
                    {result.rag_chunks.map((c, i) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2"
                      >
                        <span className="text-gray-600">
                          [{i + 1}] {c.title}
                        </span>
                        <span className="font-semibold text-green-700">
                          {(c.score * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.rag_chunks.length === 0 && !result.error && (
                <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                  ⚠️ Nenhum chunk RAG recuperado. O agente respondeu sem base de
                  conhecimento. Considere adicionar documentos à base ou ajustar
                  o limiar de similaridade.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
