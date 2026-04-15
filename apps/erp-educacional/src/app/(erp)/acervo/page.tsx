"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  ScanLine,
  FilePlus2,
  Clock,
  TrendingUp,
  Archive,
  ShieldCheck,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { TIPO_DOC_LABELS } from "@/types/documentos-digitais";
import { PRAZOS_MEC } from "@/types/acervo";

// ── Tipos locais ──────────────────────────────────────────
interface AcervoStats {
  total: number;
  publicados: number;
  aguardando_assinatura: number;
  com_erro: number;
  nato_digital: number;
  digitalizado: number;
  por_tipo: Record<string, number>;
  lotes_abertos: number;
}

// ── Card de estatística ───────────────────────────────────
function StatCard({
  label,
  valor,
  icone: Icon,
  cor,
  href,
}: {
  label: string;
  valor: number;
  icone: React.ElementType;
  cor: string;
  href?: string;
}) {
  const content = (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 ${href ? "hover:shadow-md transition-shadow cursor-pointer" : ""}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${cor}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-none">{valor.toLocaleString("pt-BR")}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
      {href && <ArrowRight size={14} className="text-gray-300 ml-auto" />}
    </div>
  );
  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

// ── Componente principal ──────────────────────────────────
export default function AcervoDashboard() {
  const [stats, setStats] = useState<AcervoStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/acervo/stats")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Cabeçalho */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Archive size={20} className="text-teal-600" />
          <h1 className="text-xl font-bold text-gray-900">Acervo Acadêmico Digital</h1>
        </div>
        <p className="text-sm text-gray-500">
          Gestão centralizada de todos os documentos institucionais digitais — Portarias MEC 360/2022 e 613/2022
        </p>
      </div>

      {/* Alerta de conformidade MEC */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-800 text-sm">Prazos legais vencidos — ação urgente necessária</p>
            <p className="text-red-700 text-xs mt-1 mb-3">
              A Portaria MEC 360/2022 estabeleceu prazos para digitalização do acervo físico. Todos estão vencidos.
              A não conformidade pode impactar processos de credenciamento e reconhecimento de cursos no MEC.
            </p>
            <div className="space-y-2">
              {PRAZOS_MEC.map((prazo, i) => (
                <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-red-100">
                  <span className="text-xs text-gray-700">{prazo.descricao}</span>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span className="text-xs text-gray-400">Prazo: {prazo.prazo}</span>
                    <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                      <XCircle size={12} /> Vencido
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Link
            href="/acervo/digitalizar"
            className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors"
          >
            <ScanLine size={13} /> Iniciar digitalização
          </Link>
        </div>
      </div>

      {/* Cards de estatísticas */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="h-11 w-11 bg-gray-100 rounded-xl mb-3" />
              <div className="h-7 w-16 bg-gray-100 rounded mb-1" />
              <div className="h-3 w-24 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Total no acervo"
            valor={stats.total}
            icone={Archive}
            cor="bg-teal-500"
            href="/acervo/documentos"
          />
          <StatCard
            label="Publicados"
            valor={stats.publicados}
            icone={CheckCircle2}
            cor="bg-green-500"
            href="/acervo/documentos?status=publicado"
          />
          <StatCard
            label="Aguard. assinatura"
            valor={stats.aguardando_assinatura}
            icone={Clock}
            cor="bg-yellow-500"
            href="/acervo/documentos?status=aguardando_assinatura"
          />
          <StatCard
            label="Com erro"
            valor={stats.com_erro}
            icone={XCircle}
            cor="bg-red-500"
            href="/acervo/documentos?status=erro"
          />
        </div>
      ) : null}

      {/* Divisão nato-digital vs. digitalizado */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <FilePlus2 size={16} className="text-blue-500" />
              <p className="text-sm font-semibold text-gray-800">Documentos nato-digitais</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.nato_digital.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-gray-400 mt-1">Gerados diretamente pelo ERP</p>
            <Link
              href="/acervo/emitir"
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-blue-600 font-medium hover:underline"
            >
              Emitir novo documento <ArrowRight size={12} />
            </Link>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ScanLine size={16} className="text-teal-500" />
              <p className="text-sm font-semibold text-gray-800">Documentos digitalizados</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.digitalizado.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-gray-400 mt-1">Acervo físico convertido para digital</p>
            <Link
              href="/acervo/digitalizar"
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-teal-600 font-medium hover:underline"
            >
              Novo lote de digitalização <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      )}

      {/* Distribuição por tipo de documento */}
      {stats && Object.keys(stats.por_tipo).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-gray-400" />
            <p className="text-sm font-semibold text-gray-800">Distribuição por tipo</p>
          </div>
          <div className="space-y-2">
            {Object.entries(stats.por_tipo)
              .sort(([, a], [, b]) => b - a)
              .map(([tipo, qtd]) => {
                const pct = stats.total > 0 ? Math.round((qtd / stats.total) * 100) : 0;
                return (
                  <div key={tipo} className="flex items-center gap-3">
                    <div className="w-36 flex-shrink-0">
                      <p className="text-xs text-gray-600 truncate">
                        {TIPO_DOC_LABELS[tipo as keyof typeof TIPO_DOC_LABELS] ?? tipo}
                      </p>
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-teal-500 h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 w-20 justify-end">
                      <span className="text-xs text-gray-500">{qtd.toLocaleString("pt-BR")}</span>
                      <span className="text-xs text-gray-400">({pct}%)</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Ações rápidas */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Ações rápidas</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/acervo/digitalizar"
            className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow group"
          >
            <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-teal-100 transition-colors">
              <ScanLine size={18} className="text-teal-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Digitalizar acervo</p>
              <p className="text-xs text-gray-400">Upload de documentos físicos</p>
            </div>
          </Link>
          <Link
            href="/acervo/emitir"
            className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow group"
          >
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
              <FilePlus2 size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Emitir documento</p>
              <p className="text-xs text-gray-400">Declarações, atestados, históricos</p>
            </div>
          </Link>
          <Link
            href="/acervo/mec"
            className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow group"
          >
            <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-slate-100 transition-colors">
              <ShieldCheck size={18} className="text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Acesso MEC</p>
              <p className="text-xs text-gray-400">Token de fiscalização</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Lotes em andamento */}
      {stats && stats.lotes_abertos > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock size={16} className="text-yellow-600" />
            <p className="text-sm text-yellow-800">
              <span className="font-semibold">{stats.lotes_abertos} lote{stats.lotes_abertos > 1 ? "s" : ""}</span>
              {" "}de digitalização em andamento
            </p>
          </div>
          <Link
            href="/acervo/digitalizar"
            className="text-xs font-semibold text-yellow-700 hover:underline flex items-center gap-1"
          >
            Ver lotes <ArrowRight size={12} />
          </Link>
        </div>
      )}

      {/* Conformidade */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={16} className="text-gray-400" />
          <p className="text-sm font-semibold text-gray-800">Conformidade regulatória</p>
        </div>
        <div className="space-y-2">
          {[
            { item: "Documentos nato-digitais com assinatura ICP-Brasil", ok: true },
            { item: "Metadados obrigatórios (Decreto 10.278/2020 Anexo II)", ok: stats ? stats.digitalizado > 0 : false },
            { item: "Hash SHA-256 em todos os arquivos", ok: true },
            { item: "Log de auditoria habilitado", ok: true },
            { item: "Digitalização retroativa completa", ok: false },
            { item: "Token de acesso MEC configurado", ok: false },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2.5">
              {item.ok ? (
                <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
              ) : (
                <XCircle size={14} className="text-red-400 flex-shrink-0" />
              )}
              <span className={`text-xs ${item.ok ? "text-gray-700" : "text-gray-400"}`}>
                {item.item}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Nota legal */}
      <div className="text-center">
        <p className="text-xs text-gray-400">
          Portaria MEC nº 360/2022 · Portaria MEC nº 613/2022 · Decreto nº 10.278/2020 ·{" "}
          <Link href="/acervo/mec" className="underline hover:text-gray-600">
            Configurar acesso MEC
          </Link>
        </p>
      </div>
    </div>
  );
}
