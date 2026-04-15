"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  FolderOpen, Trash2, Sparkles, Search,
  CheckCircle2, PenTool, Loader2,
  ArrowRight, Calendar, Users, CloudUpload,
  Eye, AlertTriangle, Play, XCircle,
} from "lucide-react";

// ─── Tipos da seção "Em andamento" ───────────────────────────────────────────

interface SessaoEmAndamento {
  id: string;
  processo_id: string | null;
  status: "processando" | "rascunho" | "aguardando_revisao" | "erro";
  iniciado_em: string | null;
  finalizado_em: string | null;
  erro_mensagem: string | null;
  total_arquivos: number;
  nome_diplomando_provisorio: string | null;
}

// ─── Tipos locais ────────────────────────────────────────────────────────────

interface Curso {
  id: string;
  nome: string;
  grau: string;
}

interface Processo {
  id: string;
  nome: string | null; // sessão 074: nullable — nome só existe após confirmar dados
  sessao_id?: string;  // sessão 074: presente em status em_extracao para navegar à revisão
  tipo: "individual";
  curso: Curso | null;
  turno: string;
  periodo_letivo: string;
  data_colacao: string;
  status: "rascunho" | "em_extracao" | "aguardando_revisao" | "aguardando_assinatura" | "concluido" | "cancelado";
  total_diplomas: number;
  diplomas_confirmados: number;
  created_at: string;
  tem_rascunho?: boolean;
  diploma_id?: string;
}

// ─── Mapeamento de status ────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; cor: string; icone: any }> = {
  rascunho: { label: "Rascunho", cor: "gray", icone: null },
  em_extracao: { label: "IA Processando", cor: "violet", icone: Sparkles },
  aguardando_revisao: { label: "Aguardando Revisão", cor: "blue", icone: Eye },
  aguardando_assinatura: { label: "Aguardando Assinatura", cor: "amber", icone: PenTool },
  concluido: { label: "Concluído", cor: "green", icone: CheckCircle2 },
  cancelado: { label: "Cancelado", cor: "red", icone: null },
};

const COR_BG: Record<string, string> = {
  gray: "bg-gray-100 text-gray-700",
  blue: "bg-blue-100 text-blue-700",
  violet: "bg-violet-100 text-violet-700",
  amber: "bg-amber-100 text-amber-700",
  green: "bg-green-100 text-green-700",
  red: "bg-red-100 text-red-700",
};

// ─── Formatadores ────────────────────────────────────────────────────────────

function formatDate(d: string) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

// ─── Componente Principal ────────────────────────────────────────────────────

export default function ProcessosPage() {
  const router = useRouter();

  // ── Estado da lista ───────────────────────────────────
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("todos");

  // ── Estado de "Extrações em andamento" (recovery) ─────
  const [emAndamento, setEmAndamento] = useState<SessaoEmAndamento[]>([]);
  const [loadingEmAndamento, setLoadingEmAndamento] = useState(true);
  const [descartandoId, setDescartandoId] = useState<string | null>(null);

  // ── Carregar processos ──────────────────────────────────
  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search) query.append("search", search);
      if (statusFiltro !== "todos") query.append("status", statusFiltro);
      const res = await fetch(`/api/processos?${query.toString()}`);
      const data = await res.json();
      setProcessos(Array.isArray(data) ? data : []);
    } catch {
      setProcessos([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFiltro]);

  useEffect(() => { carregar(); }, [carregar]);

  // ── Carregar extrações em andamento (recovery) ────────
  const carregarEmAndamento = useCallback(async () => {
    setLoadingEmAndamento(true);
    try {
      const res = await fetch("/api/extracao/minhas", { cache: "no-store" });
      if (!res.ok) {
        setEmAndamento([]);
        return;
      }
      const data = await res.json();
      setEmAndamento(Array.isArray(data?.sessoes) ? data.sessoes : []);
    } catch {
      setEmAndamento([]);
    } finally {
      setLoadingEmAndamento(false);
    }
  }, []);

  useEffect(() => { carregarEmAndamento(); }, [carregarEmAndamento]);

  // ── Descartar sessão de extração ───────────────────────
  async function descartarSessao(sessaoId: string) {
    if (!confirm("Descartar este rascunho de extração? Esta ação não pode ser desfeita.")) return;
    setDescartandoId(sessaoId);
    try {
      const res = await fetch(`/api/extracao/sessoes/${sessaoId}/descartar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      if (!res.ok) {
        const erro = await res.json().catch(() => ({}));
        throw new Error(erro?.erro || "Falha ao descartar rascunho");
      }
      await carregarEmAndamento();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao descartar");
    } finally {
      setDescartandoId(null);
    }
  }

  function retomarSessao(sessaoId: string) {
    router.push(`/diploma/processos/novo/revisao/${sessaoId}`);
  }

  function formatarHorario(iso: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ── Estatísticas ──────────────────────────────────────────
  const totalProcessos = processos.length;
  const emExtracao = processos.filter((p) => p.status === "em_extracao").length;
  const aguardandoRevisao = processos.filter((p) => p.status === "aguardando_revisao").length;
  const aguardandoAssinatura = processos.filter((p) => p.status === "aguardando_assinatura").length;
  const concluidos = processos.filter((p) => p.status === "concluido").length;
  const cancelados = processos.filter((p) => p.status === "cancelado").length;

  // ── Ir para a Tela 1 do fluxo novo (upload + extração IA) ─
  function irParaNovoProcesso() {
    router.push("/diploma/processos/novo");
  }

  // ── Excluir processo ──────────────────────────────────────
  async function excluir(id: string, nome: string | null) {
    if (!confirm(`Confirma a exclusão do processo "${nome ?? "este processo"}"? Apenas rascunhos podem ser deletados.`)) return;
    try {
      const res = await fetch(`/api/processos/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao excluir");
      }
      carregar();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro ao excluir processo");
    }
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FolderOpen size={28} className="text-violet-600" />
            Processos de Emissão
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie processos de diplomas digitais com assistência de IA
          </p>
        </div>
        <button
          onClick={irParaNovoProcesso}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <Sparkles size={18} /> Novo Processo
        </button>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {/* Total */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-col gap-2">
            <div className="p-2 bg-blue-50 rounded-lg w-fit">
              <FolderOpen size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium leading-tight">Total de Processos</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{totalProcessos}</p>
            </div>
          </div>
        </div>

        {/* IA Processando */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-col gap-2">
            <div className="p-2 bg-violet-50 rounded-lg w-fit">
              <Sparkles size={18} className="text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium leading-tight">IA Processando</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{emExtracao}</p>
            </div>
          </div>
        </div>

        {/* Aguardando Revisão — gargalo operacional */}
        <div className={`rounded-xl border p-4 ${aguardandoRevisao > 0 ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200"}`}>
          <div className="flex flex-col gap-2">
            <div className={`p-2 rounded-lg w-fit ${aguardandoRevisao > 0 ? "bg-blue-100" : "bg-blue-50"}`}>
              <Eye size={18} className="text-blue-600" />
            </div>
            <div>
              <p className={`text-xs font-medium leading-tight ${aguardandoRevisao > 0 ? "text-blue-700" : "text-gray-500"}`}>
                Aguardando Revisão
              </p>
              <p className={`text-2xl font-bold mt-0.5 ${aguardandoRevisao > 0 ? "text-blue-800" : "text-gray-900"}`}>
                {aguardandoRevisao}
              </p>
            </div>
          </div>
        </div>

        {/* Aguardando Assinatura */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-col gap-2">
            <div className="p-2 bg-amber-50 rounded-lg w-fit">
              <PenTool size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium leading-tight">Ag. Assinatura</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{aguardandoAssinatura}</p>
            </div>
          </div>
        </div>

        {/* Concluídos */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-col gap-2">
            <div className="p-2 bg-green-50 rounded-lg w-fit">
              <CheckCircle2 size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium leading-tight">Concluídos</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{concluidos}</p>
            </div>
          </div>
        </div>

        {/* Cancelados */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-col gap-2">
            <div className="p-2 bg-red-50 rounded-lg w-fit">
              <XCircle size={18} className="text-red-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium leading-tight">Cancelados</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{cancelados}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Seção: Extrações em andamento (recovery) */}
      {!loadingEmAndamento && emAndamento.length > 0 && (
        <div className="mb-6 bg-white rounded-xl border border-violet-200 overflow-hidden">
          <div className="px-5 py-3 bg-violet-50 border-b border-violet-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-violet-600" />
              <h2 className="text-sm font-semibold text-violet-900">
                Extrações em andamento ({emAndamento.length})
              </h2>
            </div>
            <p className="text-xs text-violet-700">
              Rascunhos não finalizados — retome de onde parou ou descarte.
            </p>
          </div>
          <ul className="divide-y divide-gray-100">
            {emAndamento.map((s) => {
              const ehErro = s.status === "erro";
              const ehProcessando = s.status === "processando";
              const rotuloStatus = ehErro
                ? "Erro na extração"
                : ehProcessando
                ? "IA processando…"
                : "Aguardando revisão";
              const corStatus = ehErro
                ? "bg-red-100 text-red-700"
                : ehProcessando
                ? "bg-violet-100 text-violet-700"
                : "bg-blue-100 text-blue-700";

              return (
                <li
                  key={s.id}
                  className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${corStatus}`}
                      >
                        {ehErro && <AlertTriangle size={12} />}
                        {ehProcessando && <Loader2 size={12} className="animate-spin" />}
                        {rotuloStatus}
                      </span>
                      <span className="truncate text-sm font-medium text-gray-900">
                        {s.nome_diplomando_provisorio || "Nome não disponível"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {s.total_arquivos}{" "}
                      {s.total_arquivos === 1 ? "arquivo" : "arquivos"} ·{" "}
                      iniciada em {formatarHorario(s.iniciado_em)}
                      {ehErro && s.erro_mensagem && (
                        <span className="ml-2 text-red-600">
                          — {s.erro_mensagem.slice(0, 140)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!ehErro && (
                      <button
                        onClick={() => retomarSessao(s.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                      >
                        <Play size={12} />
                        Retomar
                      </button>
                    )}
                    <button
                      onClick={() => descartarSessao(s.id)}
                      disabled={descartandoId === s.id}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50"
                    >
                      {descartandoId === s.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                      Descartar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="todos">Todos os status</option>
            <option value="rascunho">Rascunho</option>
            <option value="em_extracao">IA Processando</option>
            <option value="aguardando_revisao">Aguardando Revisão</option>
            <option value="aguardando_assinatura">Aguardando Assinatura</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </div>

      {/* Tabela de processos */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-violet-400" />
          </div>
        ) : processos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-6 bg-violet-50 rounded-full mb-4">
              <CloudUpload size={40} className="text-violet-300" />
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">
              {search ? "Nenhum resultado encontrado" : "Nenhum processo criado"}
            </h3>
            <p className="text-sm text-gray-400 mb-4 max-w-sm">
              {search
                ? "Tente outros termos de busca."
                : "Comece criando um novo processo. A IA ajuda a preencher tudo."}
            </p>
            {!search && (
              <button
                onClick={irParaNovoProcesso}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium shadow-sm"
              >
                <Sparkles size={16} />
                Criar primeiro processo
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50 font-semibold text-xs text-gray-600 uppercase tracking-wide">
              <div className="col-span-5">Nome do Processo</div>
              <div className="col-span-3">Curso</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Ações</div>
            </div>

            {processos.map((p) => {
              const statusInfo = STATUS_LABELS[p.status] || STATUS_LABELS.rascunho;
              const IconeStatus = statusInfo.icone;

              return (
                <div
                  key={p.id}
                  className="grid grid-cols-12 gap-4 px-5 py-4 hover:bg-gray-50 transition-colors items-center group cursor-pointer"
                  onClick={() => router.push(
                    // FIX s075: sessao_id presente → sempre abre revisão (independente do status)
                    p.sessao_id
                      ? `/diploma/processos/novo/revisao/${p.sessao_id}`
                      : p.diploma_id
                        ? `/diploma/diplomas/${p.diploma_id}`
                        : `/diploma/processos/${p.id}`
                  )}
                >
                  <div className="col-span-5 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold truncate ${p.nome ? "text-gray-900" : "text-violet-500 italic"}`}>
                        {p.nome ?? (p.status === "em_extracao" ? "Extraindo documentos…" : p.sessao_id ? "Revisão pendente…" : "—")}
                      </p>
                    </div>
                    {p.data_colacao && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <Calendar size={12} /> {formatDate(p.data_colacao)}
                      </p>
                    )}
                  </div>
                  <div className="col-span-3 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{p.curso?.nome || "—"}</p>
                    {p.curso && <p className="text-xs text-gray-400">{p.curso.grau}</p>}
                  </div>
                  <div className="col-span-2">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium ${COR_BG[statusInfo.cor]} ${p.status === "em_extracao" ? "animate-pulse" : ""}`}>
                      {IconeStatus && (
                        <IconeStatus size={14} className={p.status === "em_extracao" ? "animate-spin" : ""} />
                      )}
                      {statusInfo.label}
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(
                        // FIX s075: sessao_id presente → sempre abre revisão
                        p.sessao_id
                          ? `/diploma/processos/novo/revisao/${p.sessao_id}`
                          : p.diploma_id
                            ? `/diploma/diplomas/${p.diploma_id}`
                            : `/diploma/processos/${p.id}`
                      ); }}
                      className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                      title={p.sessao_id ? "Continuar revisão" : p.diploma_id ? "Ir para Pipeline" : "Abrir processo"}
                    >
                      <ArrowRight size={15} />
                    </button>
                    {p.status === "rascunho" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); excluir(p.id, p.nome ?? "este processo"); }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir rascunho"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
