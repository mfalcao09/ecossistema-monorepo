"use client";

/**
 * Modal: Histórico de Auditorias com diff visual
 *
 * Sessão 2026-04-26 (Onda 2 — auditoria persistente):
 * Lista todas as auditorias do diploma em ordem cronológica decrescente.
 * Cada item mostra um sumário (totais + diff vs anterior) e expande para
 * lista detalhada de issues resolvidas, persistentes, e novas.
 *
 * Consome GET /api/diplomas/[id]/auditorias (já calcula diff server-side).
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  Shield,
  ShieldAlert,
  X,
  XCircle,
} from "lucide-react";

interface IssueLog {
  grupo_id: string;
  grupo_nome: string;
  campo: string;
  mensagem: string;
  severidade: "critico" | "aviso" | "info";
  acao: string;
}

interface AuditoriaItem {
  id: string;
  auditado_em: string;
  auditado_por: string | null;
  /** Sessão 2026-04-26: nome resolvido server-side */
  auditado_por_nome?: string | null;
  diploma_updated_at: string;
  pode_gerar_xml: boolean;
  totais: { criticos: number; avisos: number; infos: number; total: number };
  issues_count: number;
  diff_vs_anterior: {
    anterior_id: string;
    anterior_em: string;
    resolvidas: number;
    persistentes: number;
    novas: number;
    resolvidas_itens: IssueLog[];
    novas_itens: IssueLog[];
  } | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yy = d.getFullYear().toString().slice(2);
  const hh = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${min}`;
}

export default function ModalAuditorias({
  diplomaId,
  aberto,
  onClose,
  destacarId,
}: {
  diplomaId: string;
  aberto: boolean;
  onClose: () => void;
  /** Auditoria pré-selecionada (vem do botão "Comparar" da timeline) */
  destacarId?: string | null;
}) {
  const [auditorias, setAuditorias] = useState<AuditoriaItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [expandida, setExpandida] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch(`/api/diplomas/${diplomaId}/auditorias`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `HTTP ${res.status}`,
        );
      }
      const json = await res.json();
      setAuditorias((json?.auditorias ?? []) as AuditoriaItem[]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar auditorias");
    } finally {
      setCarregando(false);
    }
  }, [diplomaId]);

  useEffect(() => {
    if (aberto) carregar();
  }, [aberto, carregar]);

  // Pré-expande a auditoria destacada (vinda da timeline)
  useEffect(() => {
    if (aberto && destacarId) setExpandida(destacarId);
  }, [aberto, destacarId]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center">
              <Shield size={15} className="text-cyan-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                Histórico de auditorias
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {auditorias.length} execução
                {auditorias.length === 1 ? "" : "ões"} · ordenadas da mais
                recente
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={carregar}
              disabled={carregando}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-40"
              title="Recarregar"
            >
              <RefreshCw
                size={14}
                className={carregando ? "animate-spin" : ""}
              />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
              title="Fechar"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Conteúdo scrolável */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {carregando && auditorias.length === 0 && (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 size={18} className="animate-spin mr-2" />
              Carregando histórico…
            </div>
          )}

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle size={15} />
              {erro}
            </div>
          )}

          {!carregando && auditorias.length === 0 && !erro && (
            <div className="text-center py-10 text-sm text-gray-400">
              Nenhuma auditoria executada ainda.
            </div>
          )}

          {auditorias.map((a) => (
            <AuditoriaCard
              key={a.id}
              item={a}
              expandida={expandida === a.id}
              onToggle={() =>
                setExpandida((cur) => (cur === a.id ? null : a.id))
              }
            />
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-500 flex items-center gap-2">
          <Clock size={11} />
          Auditorias persistidas em <code>diploma_auditorias</code> ·
          append-only · diff calculado server-side.
        </div>
      </div>
    </div>
  );
}

function AuditoriaCard({
  item,
  expandida,
  onToggle,
}: {
  item: AuditoriaItem;
  expandida: boolean;
  onToggle: () => void;
}) {
  const t = item.totais;
  const diff = item.diff_vs_anterior;

  return (
    <div
      className={`rounded-xl border-2 transition-all ${
        item.pode_gerar_xml
          ? "border-emerald-200 bg-emerald-50/20"
          : "border-red-200 bg-red-50/20"
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              item.pode_gerar_xml ? "bg-emerald-500" : "bg-red-500"
            }`}
          >
            {item.pode_gerar_xml ? (
              <Shield size={14} className="text-white" />
            ) : (
              <ShieldAlert size={14} className="text-white" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800">
              {item.pode_gerar_xml
                ? "Apta a gerar XML"
                : `${t.criticos} crítico${t.criticos === 1 ? "" : "s"} bloqueia${t.criticos === 1 ? "" : "m"} geração`}
            </p>
            <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
              <Clock size={11} /> {formatDate(item.auditado_em)}
              {item.auditado_por_nome && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="text-gray-700 font-medium">
                    {item.auditado_por_nome}
                  </span>
                </>
              )}
              <span className="text-gray-300">·</span>
              {t.criticos > 0 && (
                <span className="text-red-600 font-medium">
                  {t.criticos} crítico{t.criticos === 1 ? "" : "s"}
                </span>
              )}
              {t.avisos > 0 && (
                <span className="text-amber-600 font-medium">
                  {t.criticos > 0 ? " · " : ""}
                  {t.avisos} aviso{t.avisos === 1 ? "" : "s"}
                </span>
              )}
              {t.criticos === 0 && t.avisos === 0 && (
                <span className="text-emerald-600 font-medium">tudo ok</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {diff && (
            <DiffBadges
              resolvidas={diff.resolvidas}
              persistentes={diff.persistentes}
              novas={diff.novas}
            />
          )}
          {!diff && (
            <span className="text-[10px] text-gray-400 font-medium px-2 py-1 bg-gray-100 rounded-full">
              1ª execução
            </span>
          )}
          {expandida ? (
            <ChevronUp size={16} className="text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-400" />
          )}
        </div>
      </button>

      {expandida && (
        <div className="border-t border-gray-200 p-4 bg-white space-y-3">
          {!diff && (
            <p className="text-xs text-gray-500">
              Esta foi a primeira auditoria — não há comparação possível.
            </p>
          )}

          {diff && diff.resolvidas_itens.length > 0 && (
            <ListaIssues
              cor="emerald"
              titulo={`Issues resolvidas desde ${formatDate(diff.anterior_em)}`}
              icone={<CheckCircle2 size={11} />}
              itens={diff.resolvidas_itens}
            />
          )}

          {diff && diff.novas_itens.length > 0 && (
            <ListaIssues
              cor="red"
              titulo="Issues novas (apareceram após a auditoria anterior)"
              icone={<Plus size={11} />}
              itens={diff.novas_itens}
            />
          )}

          {diff && diff.persistentes > 0 && (
            <p className="text-[11px] text-amber-600 flex items-center gap-1">
              <AlertTriangle size={11} />
              {diff.persistentes} issue{diff.persistentes === 1 ? "" : "s"}{" "}
              persiste{diff.persistentes === 1 ? "" : "m"} desde a auditoria
              anterior.
            </p>
          )}

          {diff &&
            diff.resolvidas === 0 &&
            diff.novas === 0 &&
            diff.persistentes === 0 && (
              <p className="text-xs text-gray-500">
                Sem mudanças vs anterior — auditoria idempotente.
              </p>
            )}
        </div>
      )}
    </div>
  );
}

function DiffBadges({
  resolvidas,
  persistentes,
  novas,
}: {
  resolvidas: number;
  persistentes: number;
  novas: number;
}) {
  return (
    <div className="hidden sm:flex items-center gap-1">
      {resolvidas > 0 && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-emerald-700 bg-emerald-100">
          −{resolvidas}
        </span>
      )}
      {persistentes > 0 && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-amber-700 bg-amber-100">
          {persistentes}
        </span>
      )}
      {novas > 0 && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-red-700 bg-red-100">
          +{novas}
        </span>
      )}
      {resolvidas === 0 && persistentes === 0 && novas === 0 && (
        <span className="text-[10px] text-gray-400">sem mudanças</span>
      )}
    </div>
  );
}

function ListaIssues({
  cor,
  titulo,
  icone,
  itens,
}: {
  cor: "emerald" | "red";
  titulo: string;
  icone: React.ReactNode;
  itens: IssueLog[];
}) {
  const colorMap = {
    emerald: {
      head: "text-emerald-700",
      border: "border-emerald-200",
      bg: "bg-emerald-50/40",
    },
    red: {
      head: "text-red-700",
      border: "border-red-200",
      bg: "bg-red-50/40",
    },
  };
  const c = colorMap[cor];
  return (
    <div className={`rounded-lg border ${c.border} ${c.bg} p-3`}>
      <p
        className={`text-xs font-bold ${c.head} flex items-center gap-1.5 mb-2`}
      >
        {icone}
        {titulo}
        <span className="text-gray-400 font-normal">({itens.length})</span>
      </p>
      <ul className="space-y-1.5">
        {itens.map((it, idx) => (
          <li key={`${it.grupo_id}-${it.campo}-${idx}`} className="text-[11px]">
            <span className="text-gray-400">[{it.grupo_nome}]</span>{" "}
            <span className="text-gray-800">{it.mensagem}</span>{" "}
            {it.severidade === "critico" && (
              <span className="text-red-600">· crítico</span>
            )}
            {it.severidade === "aviso" && (
              <span className="text-amber-600">· aviso</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
