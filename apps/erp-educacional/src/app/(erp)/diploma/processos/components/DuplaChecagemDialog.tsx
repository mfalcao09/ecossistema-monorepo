"use client";

import { useState } from "react";
import {
  X,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Info,
  BarChart3,
  RefreshCw,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ArquivoSalvo {
  id: string;
  nome_original: string;
  tipo_documento: string | null;
  mime_type: string;
  tamanho_bytes: number;
  url_assinada: string | null;
}

interface Inconsistencia {
  campo: string;
  gravidade: "CRITICA" | "ATENCAO" | "SUGESTAO";
  dado_extraido: string;
  dado_documento: string;
  descricao: string;
}

interface ResultadoChecagem {
  veredicto: "APROVADO" | "REPROVADO";
  pontuacao_confianca: number;
  resumo: string;
  inconsistencias: Inconsistencia[];
  campos_verificados: number;
  campos_corretos: number;
  meta?: {
    processo_id: string;
    documentos_analisados: number;
    modelo_usado: string;
    checado_em: string;
  };
}

interface DuplaChecagemDialogProps {
  processoId: string;
  arquivos: ArquivoSalvo[];
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function GravidadeTag({ gravidade }: { gravidade: string }) {
  const config: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    CRITICA: {
      label: "Crítica",
      cls: "bg-red-100 text-red-700 border border-red-200",
      icon: <ShieldAlert size={12} />,
    },
    ATENCAO: {
      label: "Atenção",
      cls: "bg-amber-100 text-amber-700 border border-amber-200",
      icon: <AlertTriangle size={12} />,
    },
    SUGESTAO: {
      label: "Sugestão",
      cls: "bg-blue-100 text-blue-700 border border-blue-200",
      icon: <Info size={12} />,
    },
  };
  const { label, cls, icon } = config[gravidade] || config.SUGESTAO;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {icon}
      {label}
    </span>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function DuplaChecagemDialog({
  processoId,
  arquivos,
  onClose,
}: DuplaChecagemDialogProps) {
  const [estado, setEstado] = useState<"idle" | "loading" | "resultado" | "erro">("idle");
  const [resultado, setResultado] = useState<ResultadoChecagem | null>(null);
  const [erroMsg, setErroMsg] = useState<string | null>(null);

  const temArquivos = arquivos.length > 0;

  // ─── Iniciar auditoria ──────────────────────────────────────────────────────
  async function iniciarAuditoria() {
    setEstado("loading");
    setErroMsg(null);
    setResultado(null);

    try {
      const res = await fetch(`/api/processos/${processoId}/dupla-checagem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Erro ${res.status}`);
      }

      setResultado(data as ResultadoChecagem);
      setEstado("resultado");
    } catch (e) {
      setErroMsg(e instanceof Error ? e.message : "Erro desconhecido na auditoria");
      setEstado("erro");
    }
  }

  function reiniciar() {
    setEstado("idle");
    setResultado(null);
    setErroMsg(null);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-50 rounded-lg">
              <ShieldCheck size={20} className="text-violet-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-base">Dupla Checagem com IA</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                A IA vai comparar os dados extraídos com os documentos originais
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Lista de documentos */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <FileText size={15} className="text-gray-400" />
              Documentos que serão analisados ({arquivos.length})
            </h3>
            {!temArquivos ? (
              <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg">
                <AlertTriangle size={28} className="mx-auto text-amber-400 mb-2" />
                <p className="text-sm font-medium text-gray-700">Nenhum documento salvo</p>
                <p className="text-xs text-gray-500 mt-1">
                  Faça upload dos documentos na seção de Documentos de Suporte antes de iniciar a dupla checagem.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {arquivos.map((arq) => (
                  <div
                    key={arq.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <div className="p-1.5 bg-white border border-gray-200 rounded-md flex-shrink-0">
                      <FileText size={14} className="text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{arq.nome_original}</p>
                      <p className="text-xs text-gray-500">
                        {arq.tipo_documento || "Tipo detectado automaticamente"} · {formatBytes(arq.tamanho_bytes)}
                      </p>
                    </div>
                    <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                      Salvo
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Estado: carregando */}
          {estado === "loading" && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-violet-100 border-t-violet-600 animate-spin" />
                <ShieldCheck className="absolute inset-0 m-auto text-violet-400" size={24} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">IA Auditando...</p>
                <p className="text-xs text-gray-500 mt-1">
                  Comparando {arquivos.length} documento{arquivos.length !== 1 ? "s" : ""} com os dados extraídos.
                  Isso pode levar até 30 segundos.
                </p>
              </div>
            </div>
          )}

          {/* Estado: erro */}
          {estado === "erro" && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <ShieldAlert size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">Erro na auditoria</p>
                <p className="text-xs text-red-600 mt-1">{erroMsg}</p>
              </div>
            </div>
          )}

          {/* Estado: resultado */}
          {estado === "resultado" && resultado && (
            <div className="space-y-4">
              {/* Veredicto */}
              <div
                className={`p-5 rounded-xl border-2 flex items-center gap-4 ${
                  resultado.veredicto === "APROVADO"
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                {resultado.veredicto === "APROVADO" ? (
                  <ShieldCheck size={40} className="text-green-500 flex-shrink-0" />
                ) : (
                  <ShieldAlert size={40} className="text-red-500 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p
                    className={`text-xl font-bold ${
                      resultado.veredicto === "APROVADO" ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {resultado.veredicto}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">{resultado.resumo}</p>
                </div>
                {/* Score */}
                <div className="flex-shrink-0 text-center">
                  <div
                    className={`text-3xl font-bold ${
                      resultado.pontuacao_confianca >= 80
                        ? "text-green-600"
                        : resultado.pontuacao_confianca >= 60
                        ? "text-amber-600"
                        : "text-red-600"
                    }`}
                  >
                    {resultado.pontuacao_confianca}%
                  </div>
                  <p className="text-xs text-gray-500">confiança</p>
                </div>
              </div>

              {/* Estatísticas rápidas */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <BarChart3 size={16} className="mx-auto text-gray-400 mb-1" />
                  <p className="text-lg font-bold text-gray-900">{resultado.campos_verificados}</p>
                  <p className="text-xs text-gray-500">campos verificados</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
                  <CheckCircle2 size={16} className="mx-auto text-green-500 mb-1" />
                  <p className="text-lg font-bold text-green-700">{resultado.campos_corretos}</p>
                  <p className="text-xs text-green-600">corretos</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg border border-red-100">
                  <AlertTriangle size={16} className="mx-auto text-red-400 mb-1" />
                  <p className="text-lg font-bold text-red-700">{resultado.inconsistencias?.length || 0}</p>
                  <p className="text-xs text-red-600">inconsistências</p>
                </div>
              </div>

              {/* Inconsistências */}
              {resultado.inconsistencias && resultado.inconsistencias.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Inconsistências encontradas
                  </h3>
                  <div className="space-y-2">
                    {resultado.inconsistencias.map((inc, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border ${
                          inc.gravidade === "CRITICA"
                            ? "bg-red-50 border-red-200"
                            : inc.gravidade === "ATENCAO"
                            ? "bg-amber-50 border-amber-200"
                            : "bg-blue-50 border-blue-200"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <GravidadeTag gravidade={inc.gravidade} />
                          <span className="text-xs font-semibold text-gray-800">{inc.campo}</span>
                        </div>
                        <p className="text-xs text-gray-700 mb-2">{inc.descricao}</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-white/70 rounded p-2">
                            <span className="text-gray-400 block mb-0.5">Dado extraído</span>
                            <span className="font-medium text-gray-800">{inc.dado_extraido || "—"}</span>
                          </div>
                          <div className="bg-white/70 rounded p-2">
                            <span className="text-gray-400 block mb-0.5">No documento</span>
                            <span className="font-medium text-gray-800">{inc.dado_documento || "—"}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {resultado.inconsistencias?.length === 0 && (
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
                  <p className="text-sm text-green-700">
                    Nenhuma inconsistência encontrada. Todos os dados conferem com os documentos originais.
                  </p>
                </div>
              )}

              {/* Meta */}
              {resultado.meta && (
                <p className="text-xs text-gray-400 text-right">
                  Analisados: {resultado.meta.documentos_analisados} docs · Modelo: {resultado.meta.modelo_usado} ·{" "}
                  {new Date(resultado.meta.checado_em).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          {estado === "resultado" ? (
            <>
              <button
                onClick={reiniciar}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition"
              >
                <RefreshCw size={14} />
                Refazer checagem
              </button>
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition"
              >
                Fechar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={estado === "loading"}
                className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={iniciarAuditoria}
                disabled={!temArquivos || estado === "loading"}
                className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white rounded-lg text-sm font-medium transition shadow-sm"
              >
                {estado === "loading" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Auditando...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    Iniciar Auditoria
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
