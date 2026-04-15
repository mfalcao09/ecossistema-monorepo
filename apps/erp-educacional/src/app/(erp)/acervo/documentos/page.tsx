"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  FileText, Search, Filter, CheckCircle2, XCircle, Clock,
  AlertTriangle, ScanLine, FileDigit, ChevronRight, RefreshCw,
  Download, ExternalLink, Hash, Calendar,
} from "lucide-react";
import { TIPO_DOC_LABELS } from "@/types/documentos-digitais";
import { ORIGEM_LABELS } from "@/types/acervo";

// ── Tipos locais ──────────────────────────────────────────
interface DocumentoListItem {
  id: string;
  tipo: string;
  titulo: string;
  destinatario_nome: string;
  destinatario_cpf: string | null;
  status: string;
  origem: string;
  arquivo_url: string | null;
  arquivo_hash_sha256: string | null;
  codigo_verificacao: string | null;
  url_verificacao: string | null;
  publicado_em: string | null;
  created_at: string;
}

// ── Cores e labels ────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_assinatura: "Aguard. Assinatura",
  assinando: "Assinando",
  assinado: "Assinado",
  publicado: "Publicado",
  revogado: "Revogado",
  erro: "Erro",
};

const STATUS_COR: Record<string, string> = {
  rascunho: "bg-gray-100 text-gray-600",
  aguardando_assinatura: "bg-yellow-50 text-yellow-700",
  assinando: "bg-orange-50 text-orange-700",
  assinado: "bg-blue-50 text-blue-700",
  publicado: "bg-green-50 text-green-700",
  revogado: "bg-red-100 text-red-700",
  erro: "bg-red-50 text-red-600",
};

const ORIGEM_ICONE: Record<string, React.ReactNode> = {
  nato_digital: <FileDigit size={12} className="text-blue-500" />,
  digitalizado: <ScanLine size={12} className="text-teal-500" />,
};

// ── Componente de linha ───────────────────────────────────
function LinhaDocumento({ doc }: { doc: DocumentoListItem }) {
  return (
    <tr className="hover:bg-gray-50 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex-shrink-0">
            {doc.status === "publicado" ? (
              <CheckCircle2 size={15} className="text-green-500" />
            ) : doc.status === "erro" || doc.status === "revogado" ? (
              <XCircle size={15} className="text-red-400" />
            ) : (
              <Clock size={15} className="text-gray-300" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate max-w-xs">{doc.titulo}</p>
            <p className="text-xs text-gray-400 truncate">{doc.destinatario_nome}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-xs text-gray-600">
          {TIPO_DOC_LABELS[doc.tipo as keyof typeof TIPO_DOC_LABELS] ?? doc.tipo}
        </span>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <div className="flex items-center gap-1.5">
          {ORIGEM_ICONE[doc.origem] ?? null}
          <span className="text-xs text-gray-600">
            {ORIGEM_LABELS[doc.origem as keyof typeof ORIGEM_LABELS] ?? doc.origem}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COR[doc.status] ?? "bg-gray-100 text-gray-600"}`}>
          {STATUS_LABELS[doc.status] ?? doc.status}
        </span>
      </td>
      <td className="px-4 py-3 hidden xl:table-cell">
        <p className="text-xs text-gray-400">
          {new Date(doc.created_at).toLocaleDateString("pt-BR")}
        </p>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {doc.arquivo_url && (
            <a
              href={doc.arquivo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
              title="Ver PDF"
            >
              <Download size={14} />
            </a>
          )}
          {doc.url_verificacao && (
            <a
              href={doc.url_verificacao}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Verificar autenticidade"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Página principal ──────────────────────────────────────
export default function DocumentosPage() {
  const [docs, setDocs] = useState<DocumentoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [pagina, setPagina] = useState(0);
  const limite = 50;

  const carregarDocs = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtroStatus) params.set("status", filtroStatus);
    if (filtroTipo) params.set("tipo", filtroTipo);
    params.set("limit", String(limite));
    params.set("offset", String(pagina * limite));

    fetch(`/api/documentos?${params}`)
      .then((r) => r.json())
      .then((d) => setDocs(Array.isArray(d) ? d : []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [filtroStatus, filtroTipo, pagina]);

  useEffect(() => { carregarDocs(); }, [carregarDocs]);

  // Filtro local por busca e origem (não vai para a API para não complicar)
  const docsFiltrados = docs.filter((d) => {
    if (filtroOrigem && d.origem !== filtroOrigem) return false;
    if (busca) {
      const q = busca.toLowerCase();
      return (
        d.titulo.toLowerCase().includes(q) ||
        d.destinatario_nome.toLowerCase().includes(q) ||
        (d.codigo_verificacao ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText size={20} className="text-teal-600" />
            <h1 className="text-xl font-bold text-gray-900">Documentos do Acervo</h1>
          </div>
          <p className="text-sm text-gray-500">
            Todos os documentos digitais emitidos pela FIC — nato-digitais e digitalizados
          </p>
        </div>
        <button
          onClick={carregarDocs}
          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Recarregar"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Busca */}
          <div className="flex-1 min-w-52 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, título ou código..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          {/* Filtro por tipo */}
          <select
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400 text-gray-600"
            value={filtroTipo}
            onChange={(e) => { setFiltroTipo(e.target.value); setPagina(0); }}
          >
            <option value="">Todos os tipos</option>
            {Object.entries(TIPO_DOC_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>

          {/* Filtro por status */}
          <select
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400 text-gray-600"
            value={filtroStatus}
            onChange={(e) => { setFiltroStatus(e.target.value); setPagina(0); }}
          >
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>

          {/* Filtro por origem */}
          <select
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400 text-gray-600"
            value={filtroOrigem}
            onChange={(e) => setFiltroOrigem(e.target.value)}
          >
            <option value="">Todas as origens</option>
            <option value="nato_digital">Nato-digital</option>
            <option value="digitalizado">Digitalizado</option>
          </select>
        </div>

        {/* Resumo dos filtros ativos */}
        {(filtroStatus || filtroTipo || filtroOrigem || busca) && (
          <div className="mt-2 flex items-center gap-2">
            <Filter size={12} className="text-gray-400" />
            <span className="text-xs text-gray-500">Filtros ativos:</span>
            {busca && (
              <span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">
                "{busca}"
              </span>
            )}
            {filtroTipo && (
              <span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">
                {TIPO_DOC_LABELS[filtroTipo as keyof typeof TIPO_DOC_LABELS]}
              </span>
            )}
            {filtroStatus && (
              <span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">
                {STATUS_LABELS[filtroStatus]}
              </span>
            )}
            {filtroOrigem && (
              <span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">
                {ORIGEM_LABELS[filtroOrigem as keyof typeof ORIGEM_LABELS]}
              </span>
            )}
            <button
              onClick={() => { setBusca(""); setFiltroStatus(""); setFiltroOrigem(""); setFiltroTipo(""); setPagina(0); }}
              className="text-xs text-red-500 hover:text-red-700 ml-1"
            >
              Limpar
            </button>
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse flex gap-4">
                <div className="h-4 bg-gray-100 rounded w-6" />
                <div className="h-4 bg-gray-100 rounded flex-1" />
                <div className="h-4 bg-gray-100 rounded w-24" />
                <div className="h-4 bg-gray-100 rounded w-20" />
              </div>
            ))}
          </div>
        ) : docsFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              {busca || filtroStatus || filtroOrigem || filtroTipo
                ? "Nenhum documento encontrado com esses filtros"
                : "Nenhum documento no acervo ainda"}
            </p>
            {!busca && !filtroStatus && !filtroOrigem && !filtroTipo && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <Link
                  href="/acervo/digitalizar"
                  className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-800 font-medium"
                >
                  <ScanLine size={14} /> Digitalizar documentos físicos
                </Link>
                <span className="text-gray-300">·</span>
                <Link
                  href="/acervo/emitir"
                  className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-800 font-medium"
                >
                  <FileDigit size={14} /> Emitir documento nato-digital
                </Link>
              </div>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Documento
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">
                  Origem
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden xl:table-cell">
                  Data
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {docsFiltrados.map((doc) => (
                <LinhaDocumento key={doc.id} doc={doc} />
              ))}
            </tbody>
          </table>
        )}

        {/* Paginação */}
        {!loading && docs.length === limite && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Exibindo {docsFiltrados.length} de {limite}+ documentos
            </p>
            <div className="flex gap-2">
              {pagina > 0 && (
                <button
                  onClick={() => setPagina((p) => p - 1)}
                  className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ← Anterior
                </button>
              )}
              <button
                onClick={() => setPagina((p) => p + 1)}
                className="text-xs px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                Próxima →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1.5">
          <FileDigit size={12} className="text-blue-500" />
          <span>Nato-digital — gerado diretamente no sistema</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ScanLine size={12} className="text-teal-500" />
          <span>Digitalizado — documento físico convertido</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Hash size={12} />
          <span>Todos os arquivos possuem hash SHA-256</span>
        </div>
      </div>
    </div>
  );
}
