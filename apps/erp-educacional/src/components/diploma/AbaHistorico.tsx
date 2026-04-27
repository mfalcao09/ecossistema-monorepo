"use client";

/**
 * Aba Histórico — Diploma Digital
 *
 * Timeline unificada de todos os eventos do diploma. Consome a API
 * /api/diplomas/[id]/historico (criada na Sessão 2026-04-26) que junta
 * eventos de várias fontes (criação, extração, snapshot, destravamentos,
 * edições, status, XMLs, publicação) em ordem cronológica decrescente.
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  FileSignature,
  GitCompare,
  Globe,
  Loader2,
  Lock,
  LockOpen,
  Pencil,
  RefreshCw,
  Shield,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import ModalAuditorias from "./ModalAuditorias";

type EventoTipo =
  | "criado"
  | "atualizado"
  | "extracao_iniciada"
  | "extracao_concluida"
  | "auditoria_executada"
  | "snapshot_consolidado"
  | "snapshot_destravado"
  | "snapshot_editado"
  | "status_alterado"
  | "xml_gerado"
  | "xml_assinado"
  | "documento_publicado";

interface EventoTimeline {
  tipo: EventoTipo;
  em: string;
  titulo: string;
  descricao?: string | null;
  usuario_id?: string | null;
  /** Sessão 2026-04-26: nome resolvido server-side pra exibir auditoria */
  usuario_nome?: string | null;
  meta?: Record<string, unknown> | null;
}

interface HistoricoResponse {
  diploma_id: string;
  eventos: EventoTimeline[];
  total: number;
}

const EVENTO_VISUAL: Record<
  EventoTipo,
  { icone: typeof FileText; cor: string; bg: string; border: string }
> = {
  criado: {
    icone: Sparkles,
    cor: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-300",
  },
  atualizado: {
    icone: RefreshCw,
    cor: "text-gray-500",
    bg: "bg-gray-50",
    border: "border-gray-300",
  },
  extracao_iniciada: {
    icone: Sparkles,
    cor: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-300",
  },
  extracao_concluida: {
    icone: CheckCircle2,
    cor: "text-violet-700",
    bg: "bg-violet-50",
    border: "border-violet-300",
  },
  auditoria_executada: {
    icone: Shield,
    cor: "text-cyan-700",
    bg: "bg-cyan-50",
    border: "border-cyan-300",
  },
  snapshot_consolidado: {
    icone: Lock,
    cor: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-300",
  },
  snapshot_destravado: {
    icone: LockOpen,
    cor: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-300",
  },
  snapshot_editado: {
    icone: Pencil,
    cor: "text-indigo-700",
    bg: "bg-indigo-50",
    border: "border-indigo-300",
  },
  status_alterado: {
    icone: TrendingUp,
    cor: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-300",
  },
  xml_gerado: {
    icone: FileText,
    cor: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-300",
  },
  xml_assinado: {
    icone: FileSignature,
    cor: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-300",
  },
  documento_publicado: {
    icone: Globe,
    cor: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-300",
  },
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yy = d.getFullYear().toString().slice(2);
  const hh = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${min}`;
}

export default function AbaHistorico({
  diplomaId,
  refreshKey,
}: {
  diplomaId: string;
  /** Sessão 2026-04-26: muda quando o pipeline executa qualquer ação;
   * propagado pela página pai (tipicamente diploma.updated_at). */
  refreshKey?: string | number | null;
}) {
  const [data, setData] = useState<HistoricoResponse | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  // Sessão 2026-04-26 (Onda 2): modal de comparação acessível direto da timeline.
  const [auditoriaParaComparar, setAuditoriaParaComparar] = useState<
    string | null
  >(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch(`/api/diplomas/${diplomaId}/historico`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `HTTP ${res.status}`,
        );
      }
      const json: HistoricoResponse = await res.json();
      setData(json);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar histórico");
    } finally {
      setCarregando(false);
    }
  }, [diplomaId]);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregar, refreshKey]);

  if (carregando) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 flex items-center justify-center text-gray-400">
        <Loader2 size={18} className="animate-spin mr-2" />
        Carregando histórico…
      </div>
    );
  }

  if (erro) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-3 text-sm text-red-700">
        <AlertCircle size={16} />
        <span className="flex-1">{erro}</span>
        <button
          onClick={carregar}
          className="flex items-center gap-1 px-2 py-1 text-xs border border-red-300 rounded hover:bg-red-100"
        >
          <RefreshCw size={12} /> Tentar novamente
        </button>
      </div>
    );
  }

  const eventos = data?.eventos ?? [];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-800">
            Histórico de eventos
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {eventos.length} evento{eventos.length === 1 ? "" : "s"} registrado
            {eventos.length === 1 ? "" : "s"} · ordem cronológica decrescente
          </p>
        </div>
        <button
          onClick={carregar}
          className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          title="Recarregar"
        >
          <RefreshCw size={11} /> Atualizar
        </button>
      </div>

      <div className="p-5">
        {eventos.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">
            Nenhum evento registrado ainda.
          </div>
        ) : (
          <ol className="relative space-y-4">
            {/* Linha vertical que conecta os eventos */}
            <div
              className="absolute left-[14px] top-2 bottom-2 w-px bg-gray-200"
              aria-hidden="true"
            />

            {eventos.map((ev, idx) => {
              const visual = EVENTO_VISUAL[ev.tipo];
              const Icon = visual.icone;
              return (
                <li
                  key={`${ev.tipo}-${ev.em}-${idx}`}
                  className="relative pl-10"
                >
                  {/* Bola do timeline */}
                  <div
                    className={`absolute left-0 top-0 w-7 h-7 rounded-full ${visual.bg} ${visual.cor} border-2 ${visual.border} flex items-center justify-center`}
                  >
                    <Icon size={13} />
                  </div>

                  <div className="pb-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-gray-800">
                        {ev.titulo}
                      </p>
                      {ev.tipo === "auditoria_executada" &&
                      typeof ev.meta?.auditoria_id === "string" ? (
                        <button
                          onClick={() =>
                            setAuditoriaParaComparar(
                              ev.meta?.auditoria_id as string,
                            )
                          }
                          className="text-[10px] text-cyan-700 hover:bg-cyan-50 font-medium px-1.5 py-0.5 rounded border border-cyan-200 inline-flex items-center gap-1"
                          title="Comparar com a auditoria anterior"
                        >
                          <GitCompare size={10} />
                          Comparar
                        </button>
                      ) : null}
                      <span className="text-[11px] text-gray-400 flex items-center gap-1 ml-auto">
                        <Clock size={10} /> {formatDateTime(ev.em)}
                      </span>
                    </div>
                    {ev.descricao && (
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {ev.descricao}
                      </p>
                    )}
                    {ev.usuario_nome && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        por{" "}
                        <span className="font-medium text-gray-600">
                          {ev.usuario_nome}
                        </span>
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <ModalAuditorias
        diplomaId={diplomaId}
        aberto={auditoriaParaComparar !== null}
        onClose={() => setAuditoriaParaComparar(null)}
        destacarId={auditoriaParaComparar}
      />
    </div>
  );
}
