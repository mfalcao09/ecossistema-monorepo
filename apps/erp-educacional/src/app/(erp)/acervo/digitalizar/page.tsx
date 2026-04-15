"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ScanLine, Plus, ChevronRight, Clock,
  CheckCircle2, XCircle, AlertTriangle, Layers,
} from "lucide-react";
import type { AcervoLote, StatusLoteAcervo } from "@/types/acervo";
import { STATUS_LOTE_LABELS, STATUS_LOTE_COR } from "@/types/acervo";
import { TIPO_DOC_LABELS } from "@/types/documentos-digitais";

// ── Badge de status ───────────────────────────────────────
const COR_BADGE: Record<string, string> = {
  gray: "bg-gray-100 text-gray-600",
  blue: "bg-blue-50 text-blue-600",
  yellow: "bg-yellow-50 text-yellow-700",
  orange: "bg-orange-50 text-orange-700",
  green: "bg-green-50 text-green-700",
  red: "bg-red-50 text-red-600",
};

function BadgeStatus({ status }: { status: StatusLoteAcervo }) {
  const cor = STATUS_LOTE_COR[status] ?? "gray";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${COR_BADGE[cor] ?? COR_BADGE.gray}`}>
      {STATUS_LOTE_LABELS[status]}
    </span>
  );
}

// ── Modal de novo lote ────────────────────────────────────
function ModalNovoLote({
  onClose,
  onCriado,
}: {
  onClose: () => void;
  onCriado: (lote: AcervoLote) => void;
}) {
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    tipo: "historico_escolar",
    periodo_referencia: "",
    local_digitalizacao_padrao: "Secretaria FIC — Cassilândia/MS",
    responsavel_padrao_nome: "",
    responsavel_padrao_cargo: "Assistente de Secretaria",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.tipo) {
      setErro("Nome e tipo são obrigatórios.");
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch("/api/acervo/lotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onCriado(data);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Novo lote de digitalização</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {erro && (
            <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{erro}</div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Nome do lote <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="Ex: Históricos 2018-2019"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Tipo de documento <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
              >
                {Object.entries(TIPO_DOC_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Período de referência</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                placeholder="Ex: 2001-2015"
                value={form.periodo_referencia}
                onChange={(e) => setForm((f) => ({ ...f, periodo_referencia: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Descrição</label>
            <textarea
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
              placeholder="Observações sobre este lote..."
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
            />
          </div>

          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Metadados padrão (Decreto 10.278/2020)
            </p>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Local de digitalização</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  value={form.local_digitalizacao_padrao}
                  onChange={(e) => setForm((f) => ({ ...f, local_digitalizacao_padrao: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Responsável</label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    placeholder="Nome completo"
                    value={form.responsavel_padrao_nome}
                    onChange={(e) => setForm((f) => ({ ...f, responsavel_padrao_nome: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cargo</label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    value={form.responsavel_padrao_cargo}
                    onChange={(e) => setForm((f) => ({ ...f, responsavel_padrao_cargo: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="px-5 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {salvando ? "Criando..." : "Criar lote"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────
export default function DigitalizarPage() {
  const [lotes, setLotes] = useState<AcervoLote[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);

  const carregarLotes = () => {
    fetch("/api/acervo/lotes")
      .then((r) => r.json())
      .then((d) => setLotes(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregarLotes(); }, []);

  const handleLoteCriado = (lote: AcervoLote) => {
    setModalAberto(false);
    setLotes((prev) => [lote, ...prev]);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ScanLine size={20} className="text-teal-600" />
            <h1 className="text-xl font-bold text-gray-900">Digitalização de Acervo</h1>
          </div>
          <p className="text-sm text-gray-500">
            Converta documentos físicos para o acervo digital com assinatura ICP-Brasil
          </p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-2 bg-teal-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus size={16} /> Novo lote
        </button>
      </div>

      {/* Aviso MEC */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          <span className="font-semibold">Obrigação legal:</span> Organize os documentos por lotes conforme os períodos exigidos pela Portaria MEC 360/2022.
          Cada arquivo recebe automaticamente hash SHA-256 e metadados obrigatórios do Decreto 10.278/2020.
        </p>
      </div>

      {/* Lista de lotes */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-48 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-32" />
            </div>
          ))}
        </div>
      ) : lotes.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <Layers size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhum lote criado ainda</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">
            Crie um lote para começar a digitalizar o acervo físico
          </p>
          <button
            onClick={() => setModalAberto(true)}
            className="inline-flex items-center gap-2 bg-teal-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Plus size={15} /> Criar primeiro lote
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {lotes.map((lote) => (
            <Link
              key={lote.id}
              href={`/acervo/digitalizar/${lote.id}`}
              className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-4 py-4 hover:shadow-md transition-shadow group"
            >
              {/* Ícone de status */}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                lote.status === "concluido" ? "bg-green-50" :
                lote.status === "com_erros" ? "bg-red-50" :
                "bg-teal-50"
              }`}>
                {lote.status === "concluido" ? (
                  <CheckCircle2 size={18} className="text-green-500" />
                ) : lote.status === "com_erros" ? (
                  <XCircle size={18} className="text-red-400" />
                ) : (
                  <Clock size={18} className="text-teal-500" />
                )}
              </div>

              {/* Dados do lote */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-gray-900 truncate">{lote.nome}</p>
                  <BadgeStatus status={lote.status} />
                </div>
                <p className="text-xs text-gray-400">
                  {TIPO_DOC_LABELS[lote.tipo as keyof typeof TIPO_DOC_LABELS]}
                  {lote.periodo_referencia && ` · ${lote.periodo_referencia}`}
                  {" · "}{lote.total_docs} documento{lote.total_docs !== 1 ? "s" : ""}
                  {lote.com_erro > 0 && (
                    <span className="text-red-500 ml-1">· {lote.com_erro} com erro</span>
                  )}
                </p>
              </div>

              {/* Progresso */}
              {lote.total_docs > 0 && (
                <div className="hidden sm:flex flex-col items-end gap-1 flex-shrink-0 w-28">
                  <p className="text-xs text-gray-500">
                    {lote.processados}/{lote.total_docs} processados
                  </p>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-teal-500 h-1.5 rounded-full"
                      style={{ width: `${Math.round((lote.processados / lote.total_docs) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" />
            </Link>
          ))}
        </div>
      )}

      {modalAberto && (
        <ModalNovoLote
          onClose={() => setModalAberto(false)}
          onCriado={handleLoteCriado}
        />
      )}
    </div>
  );
}
