"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap, Search, Filter, Loader2,
  FileText, FileSignature, FileCheck2, Globe, AlertCircle,
  Clock, CheckCircle2, XCircle, Sparkles, FolderOpen,
  ChevronRight, RefreshCw, BarChart3, Building2,
} from "lucide-react";
import { ETAPAS_PIPELINE, DIPLOMA_STATUS_ETAPA } from "@/constants/pipeline-unificado";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Diploma {
  id: string;
  diplomado_id: string;
  diplomado_nome: string;
  diplomado_cpf: string;
  curso_id: string;
  curso_nome: string;
  curso_grau: string;
  processo_id: string | null;
  processo_nome: string | null;
  is_legado: boolean;
  status: string;
  data_conclusao: string | null;
  created_at: string;
  xmls: { tipo: string; status: string }[];
  confianca_ia: number | null;
}

interface Stats {
  total: number;
  // Etapa 0 — Extração e Dados
  rascunho: number;
  em_extracao: number;
  aguardando_revisao: number;
  // Etapa 1 — XML e Assinatura
  aguardando_assinatura: number;
  xml_com_erros: number;
  assinado: number;
  // Etapa 2 — Documentação e Acervo
  aguardando_documentos: number;
  acervo_completo: number;
  // Etapa 3 — Registro
  aguardando_registro: number;
  registrado: number;
  // Etapa 4 — RVDD
  gerando_rvdd: number;
  rvdd_gerado: number;
  // Etapa 5 — Publicado
  publicado: number;
}

// ─── Pipeline MEC — 6 etapas (importadas de pipeline-unificado) ───────────────
// Labels, IDs e mapeamento de status vêm de @/constants/pipeline-unificado.
// Aqui apenas associamos os ícones Lucide a cada etapa.

const ICONES_ETAPA: Record<string, React.ElementType> = {
  extracao:  Sparkles,
  xml:       FileSignature,
  docs:      FileText,
  registro:  Building2,
  rvdd:      FileCheck2,
  publicado: Globe,
};

// Alias para compatibilidade com o restante deste arquivo
const PIPELINE_ETAPAS = ETAPAS_PIPELINE.map((e) => ({
  ...e,
  icone: ICONES_ETAPA[e.id] ?? Sparkles,
}));

// Alias para compatibilidade (STATUS_ETAPA → DIPLOMA_STATUS_ETAPA)
const STATUS_ETAPA = DIPLOMA_STATUS_ETAPA;

// Labels e cores dos status — cobre TODOS os valores possíveis de diplomas.status
// Fallback genérico (linha 385) não deve exibir "Rascunho" para status desconhecidos.
const STATUS_CONFIG: Record<string, { label: string; cor: string; icone: React.ElementType }> = {
  // ── Etapa 0 — Extração e Dados ──────────────────────────────────────────────
  rascunho:           { label: "Em preparação",      cor: "gray",   icone: Clock         },
  em_extracao:        { label: "IA extraindo dados", cor: "violet", icone: Sparkles      },
  validando_dados:    { label: "Validando dados",    cor: "violet", icone: Sparkles      },
  preenchido:         { label: "Dados confirmados",  cor: "violet", icone: CheckCircle2  },
  aguardando_revisao: { label: "Aguardando revisão", cor: "amber",  icone: AlertCircle   },

  // ── Etapa 1 — XML e Assinatura ───────────────────────────────────────────────
  gerando_xml:                    { label: "Gerando XML",        cor: "blue",  icone: FileSignature },
  xml_gerado:                     { label: "XML gerado",         cor: "blue",  icone: FileSignature },
  validando_xsd:                  { label: "Validando XML",      cor: "blue",  icone: FileSignature },
  aguardando_assinatura_emissora: { label: "Aguarda assinatura", cor: "blue",  icone: FileSignature },
  aguardando_assinatura:          { label: "Aguarda assinatura", cor: "blue",  icone: FileSignature },
  em_assinatura:                  { label: "Em assinatura",      cor: "blue",  icone: FileSignature },
  aplicando_carimbo_tempo:        { label: "Em assinatura",      cor: "blue",  icone: FileSignature },
  assinado:                       { label: "XMLs assinados",     cor: "green", icone: CheckCircle2  },
  xml_com_erros:                  { label: "Erro no XML",        cor: "red",   icone: XCircle       },

  // ── Etapa 2 — Documentação e Acervo ─────────────────────────────────────────
  aguardando_documentos:    { label: "Aguarda documentos",    cor: "amber", icone: FileText },
  gerando_documentos:       { label: "Preparando documentos", cor: "amber", icone: FileText },
  documentos_assinados:     { label: "Docs assinados",        cor: "amber", icone: FileText },
  aguardando_digitalizacao: { label: "Aguarda digitalização", cor: "amber", icone: FileText },
  acervo_completo:          { label: "Acervo completo",       cor: "amber", icone: FileText },

  // ── Etapa 3 — Registro ───────────────────────────────────────────────────────
  aguardando_envio_registradora: { label: "Pronto para envio",    cor: "indigo", icone: Building2    },
  pronto_para_registro:          { label: "Pronto para registro", cor: "indigo", icone: Building2    },
  enviado_registradora:          { label: "Enviado à UFMS",       cor: "indigo", icone: Building2    },
  rejeitado_registradora:        { label: "Rejeitado pela UFMS",  cor: "red",    icone: XCircle      },
  aguardando_registro:           { label: "Aguarda registro",     cor: "indigo", icone: Building2    },
  registrado:                    { label: "Registrado",           cor: "indigo", icone: CheckCircle2 },

  // ── Etapa 4 — RVDD ───────────────────────────────────────────────────────────
  gerando_rvdd: { label: "Gerando RVDD", cor: "green",   icone: FileCheck2 },
  rvdd_gerado:  { label: "RVDD gerado",  cor: "green",   icone: FileCheck2 },

  // ── Etapa 5 — Publicado ───────────────────────────────────────────────────────
  publicado: { label: "Publicado", cor: "emerald", icone: Globe },

  // ── Erro ─────────────────────────────────────────────────────────────────────
  erro: { label: "Erro", cor: "red", icone: XCircle },
};

const COR_BADGE: Record<string, string> = {
  gray:    "bg-gray-100 text-gray-600",
  violet:  "bg-violet-100 text-violet-700",
  amber:   "bg-amber-100 text-amber-700",
  blue:    "bg-blue-100 text-blue-700",
  indigo:  "bg-indigo-100 text-indigo-700",
  red:     "bg-red-100 text-red-700",
  green:   "bg-green-100 text-green-700",
  emerald: "bg-emerald-100 text-emerald-700",
};

const COR_DOT: Record<string, string> = {
  gray:    "bg-gray-400",
  violet:  "bg-violet-500",
  amber:   "bg-amber-500",
  blue:    "bg-blue-500",
  indigo:  "bg-indigo-500",
  red:     "bg-red-500",
  green:   "bg-green-500",
  emerald: "bg-emerald-500",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
}

function formatCPF(cpf: string) {
  if (!cpf) return "—";
  const n = cpf.replace(/\D/g, "");
  return n.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

// ─── Mini barra de progresso do pipeline ─────────────────────────────────────

function PipelineBar({ status }: { status: string }) {
  const etapaAtual = STATUS_ETAPA[status] ?? 0;
  const concluido = status === "publicado";

  return (
    <div className="flex items-center gap-0.5">
      {PIPELINE_ETAPAS.map((etapa, idx) => {
        const feito = concluido || idx < etapaAtual;
        const atual = idx === etapaAtual && !concluido;
        return (
          <div
            key={etapa.id}
            title={etapa.label}
            className={`h-1.5 flex-1 rounded-full transition-all ${
              feito    ? "bg-green-500" :
              atual    ? "bg-blue-400 animate-pulse" :
                         "bg-gray-200"
            }`}
          />
        );
      })}
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [diplomas, setDiplomas] = useState<Diploma[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0, rascunho: 0, em_extracao: 0,
    aguardando_revisao: 0, aguardando_assinatura: 0,
    xml_com_erros: 0, assinado: 0,
    aguardando_documentos: 0, acervo_completo: 0,
    aguardando_registro: 0,
    registrado: 0, gerando_rvdd: 0, rvdd_gerado: 0, publicado: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [refreshing, setRefreshing] = useState(false);

  const carregar = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (search)                    params.set("search", search);
      if (statusFilter !== "todos")  params.set("status", statusFilter);

      const res = await fetch(`/api/diplomas?${params}`);
      const data = await res.json();

      const lista: Diploma[] = Array.isArray(data) ? data : (data.diplomas ?? []);
      setDiplomas(lista);

      // Computa stats
      const s: Stats = {
        total: lista.length,
        rascunho: 0, em_extracao: 0, aguardando_revisao: 0,
        aguardando_assinatura: 0, xml_com_erros: 0, assinado: 0,
        aguardando_documentos: 0, acervo_completo: 0,
        aguardando_registro: 0, registrado: 0,
        gerando_rvdd: 0, rvdd_gerado: 0, publicado: 0,
      };
      lista.forEach((d) => {
        const k = d.status as keyof Stats;
        if (k in s) (s[k] as number)++;
      });
      setStats(s);
    } catch {
      setDiplomas([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { carregar(); }, [carregar]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap size={28} className="text-primary-500" />
            Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Pipeline de emissão — Portaria MEC nº 70/2025 · XSD v1.05
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => carregar(true)}
            disabled={refreshing}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Atualizar"
          >
            <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => router.push("/diploma/processos")}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Sparkles size={16} />
            Novo processo de emissão
          </button>
        </div>
      </div>

      {/* Pipeline MEC — 6 etapas visuais */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={16} className="text-gray-400" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Pipeline de emissão — Fluxo obrigatório MEC
          </span>
        </div>
        <div className="grid grid-cols-6 gap-3">
          {PIPELINE_ETAPAS.map((etapa, idx) => {
            const Icone = etapa.icone;
            const isLast = idx === PIPELINE_ETAPAS.length - 1;

            // Conta diplomas em cada etapa
            const count = diplomas.filter(d => STATUS_ETAPA[d.status] === idx).length;
            const concluidos = diplomas.filter(d => d.status === "publicado").length;
            const realCount = isLast ? concluidos : count;

            return (
              <div key={etapa.id} className="relative">
                {!isLast && (
                  <div className="absolute top-5 left-full w-full h-px bg-gray-200 z-0 -translate-x-1.5" />
                )}
                <div className="relative z-10 flex flex-col items-center text-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                    realCount > 0
                      ? "bg-primary-50 border-primary-300 text-primary-700"
                      : "bg-gray-50 border-gray-200 text-gray-400"
                  }`}>
                    {realCount > 0
                      ? <span className="text-base font-bold">{realCount}</span>
                      : <Icone size={18} />
                    }
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-700 leading-tight">{etapa.label}</p>
                    <p className="text-[10px] text-gray-400">Etapa {idx + 1}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total de diplomas",     valor: stats.total,                 cor: "blue"   },
          { label: "Aguardam assinatura",   valor: stats.aguardando_assinatura, cor: "amber"  },
          { label: "Aguardam registro",     valor: stats.aguardando_registro,   cor: "indigo" },
          { label: "Publicados (completos)",valor: stats.publicado,             cor: "emerald"},
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className={`text-3xl font-bold text-${card.cor}-600`}>{card.valor}</p>
          </div>
        ))}
      </div>

      {/* Alertas urgentes */}
      {stats.xml_com_erros > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <XCircle size={20} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">
            <strong>{stats.xml_com_erros} diploma{stats.xml_com_erros > 1 ? "s" : ""}</strong> com erro na geração de XML — verifique os dados e regenere.
          </p>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, CPF ou curso..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="todos">Todos os status</option>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de diplomas */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

        {/* Cabeçalho */}
        <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <div className="col-span-3">Diplomado</div>
          <div className="col-span-3">Curso</div>
          <div className="col-span-2">Processo</div>
          <div className="col-span-2">Status / Pipeline</div>
          <div className="col-span-1">Conclusão</div>
          <div className="col-span-1"></div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-primary-400" />
          </div>
        ) : diplomas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="p-4 bg-gray-50 rounded-full mb-4">
              <GraduationCap size={32} className="text-gray-300" />
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">
              {search || statusFilter !== "todos"
                ? "Nenhum diploma encontrado"
                : "Nenhum diploma ainda"}
            </h3>
            <p className="text-sm text-gray-400 mb-5 max-w-sm">
              {search || statusFilter !== "todos"
                ? "Tente ajustar os filtros de busca."
                : "Os diplomas são criados automaticamente quando você inicia um processo de emissão com IA."}
            </p>
            {!search && statusFilter === "todos" && (
              <button
                onClick={() => router.push("/diploma/processos")}
                className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium"
              >
                <Sparkles size={16} />
                Iniciar emissão com IA
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {diplomas.map((d) => {
              const cfg = STATUS_CONFIG[d.status] ?? { label: d.status, cor: "gray", icone: Clock };
              const Icone = cfg.icone;

              return (
                <div
                  key={d.id}
                  className="grid grid-cols-12 gap-4 px-5 py-4 hover:bg-gray-50 transition-colors items-center group cursor-pointer"
                  onClick={() => router.push(`/diploma/diplomas/${d.id}`)}
                >
                  {/* Diplomado */}
                  <div className="col-span-3 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{d.diplomado_nome}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatCPF(d.diplomado_cpf)}</p>
                  </div>

                  {/* Curso */}
                  <div className="col-span-3 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{d.curso_nome || "—"}</p>
                    <p className="text-xs text-gray-400 capitalize">{d.curso_grau || ""}</p>
                  </div>

                  {/* Processo */}
                  <div className="col-span-2 min-w-0">
                    {d.processo_nome ? (
                      <div className="flex items-center gap-1">
                        <FolderOpen size={13} className="text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-gray-600 truncate">{d.processo_nome}</span>
                      </div>
                    ) : d.is_legado ? (
                      <div className="flex items-center gap-1">
                        <FolderOpen size={13} className="text-amber-400 flex-shrink-0" />
                        <span className="text-xs text-amber-600 font-medium">Via Importação</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">Sem processo</span>
                    )}
                  </div>

                  {/* Status + Pipeline */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${COR_DOT[cfg.cor]}`} />
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${COR_BADGE[cfg.cor]}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <PipelineBar status={d.status} />
                  </div>

                  {/* Data conclusão */}
                  <div className="col-span-1">
                    <p className="text-xs text-gray-500">{formatDate(d.data_conclusao)}</p>
                  </div>

                  {/* Ação */}
                  <div className="col-span-1 flex justify-end">
                    <ChevronRight
                      size={16}
                      className="text-gray-300 group-hover:text-primary-400 transition-colors"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legenda do pipeline */}
      <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <p className="text-xs font-semibold text-blue-700 mb-2">
          Fluxo obrigatório MEC — Portaria nº 70/2025 · XSD v1.05
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {PIPELINE_ETAPAS.map((e, i) => (
            <span key={e.id} className="text-xs text-blue-600" title={e.descricao}>
              <strong>{i + 1}.</strong> {e.label}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-blue-500 mt-2">
          Assinatura requer certificados ICP-Brasil tipo A3 (e-CPF + e-CNPJ). Mínimo: 2 e-CPF A3 + 1 e-CNPJ A3. IES Registradora configurável em Configurações.
        </p>
      </div>

    </div>
  );
}
