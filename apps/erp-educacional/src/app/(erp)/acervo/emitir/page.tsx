"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileDigit, LayoutTemplate, ChevronRight, CheckCircle2,
  ArrowLeft, AlertTriangle, Loader2, Plus,
} from "lucide-react";
import { TIPO_DOC_LABELS } from "@/types/documentos-digitais";
import type { AcervoTemplate } from "@/types/acervo";

// ── Página de emissão rápida ──────────────────────────────
// Mostra os templates disponíveis organizados por tipo
// e encaminha para o fluxo de emissão em templates/page.tsx
export default function EmitirPage() {
  const [templates, setTemplates] = useState<AcervoTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({});
  const [destinatarioNome, setDestinatarioNome] = useState("");
  const [destinatarioCpf, setDestinatarioCpf] = useState("");
  const [templateSelecionado, setTemplateSelecionado] = useState<AcervoTemplate | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState<{ docId: string; codigo: string } | null>(null);

  useEffect(() => {
    fetch("/api/acervo/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Agrupa templates por tipo de documento
  const porTipo = templates.reduce<Record<string, AcervoTemplate[]>>((acc, t) => {
    if (!acc[t.tipo]) acc[t.tipo] = [];
    acc[t.tipo].push(t);
    return acc;
  }, {});

  const handleSelecionar = (t: AcervoTemplate) => {
    setTemplateSelecionado(t);
    setForm({});
    setErro("");
    setSucesso(null);
  };

  const handleEmitir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateSelecionado) return;
    if (!destinatarioNome) { setErro("Nome do destinatário é obrigatório."); return; }
    setErro("");
    setEnviando(true);
    try {
      const res = await fetch("/api/acervo/emitir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: templateSelecionado.id,
          destinatario_nome: destinatarioNome,
          destinatario_cpf: destinatarioCpf || undefined,
          variaveis_valores: form,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSucesso({ docId: data.documento_id, codigo: data.codigo_verificacao });
      setTemplateSelecionado(null);
      setDestinatarioNome("");
      setDestinatarioCpf("");
      setForm({});
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Cabeçalho */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FileDigit size={20} className="text-teal-600" />
          <h1 className="text-xl font-bold text-gray-900">Emitir Documento</h1>
        </div>
        <p className="text-sm text-gray-500">
          Emita declarações, atestados e outros documentos nato-digitais com assinatura ICP-Brasil
        </p>
      </div>

      {/* Sucesso */}
      {sucesso && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-start gap-4">
          <CheckCircle2 size={24} className="text-green-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-green-800">Documento emitido com sucesso!</p>
            <p className="text-sm text-green-600 mt-1">
              Código de verificação: <span className="font-mono font-semibold">{sucesso.codigo}</span>
            </p>
            <p className="text-xs text-green-500 mt-1">
              O documento está aguardando assinatura ICP-Brasil. Após assinado, será publicado automaticamente.
            </p>
            <div className="mt-3 flex gap-3">
              <Link
                href="/acervo/documentos"
                className="text-sm text-green-700 hover:text-green-900 font-medium underline"
              >
                Ver no acervo →
              </Link>
              <button
                onClick={() => setSucesso(null)}
                className="text-sm text-green-600 hover:text-green-800"
              >
                Emitir outro
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse bg-white border border-gray-100 rounded-xl p-4">
              <div className="h-4 bg-gray-100 rounded w-40 mb-3" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-16 bg-gray-50 rounded-xl" />
                <div className="h-16 bg-gray-50 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <LayoutTemplate size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhum template disponível</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">
            Crie templates de documentos antes de emitir
          </p>
          <Link
            href="/acervo/templates"
            className="inline-flex items-center gap-2 bg-teal-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Plus size={15} /> Criar template
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* Coluna 1 — seleção de template */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-gray-700">1. Selecione o tipo de documento</h2>
            {Object.entries(porTipo).map(([tipo, tmplList]) => (
              <div key={tipo} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {TIPO_DOC_LABELS[tipo as keyof typeof TIPO_DOC_LABELS] ?? tipo}
                  </p>
                </div>
                <div className="divide-y divide-gray-50">
                  {tmplList.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleSelecionar(t)}
                      className={`w-full flex items-center justify-between px-4 py-3 hover:bg-teal-50 transition-colors text-left ${
                        templateSelecionado?.id === t.id ? "bg-teal-50 border-l-2 border-teal-500" : ""
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{t.nome}</p>
                        {t.descricao && <p className="text-xs text-gray-400">{t.descricao}</p>}
                      </div>
                      <ChevronRight size={14} className="text-gray-300 flex-shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Coluna 2 — formulário de emissão */}
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-4">2. Preencha os dados</h2>

            {!templateSelecionado ? (
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-8 text-center">
                <FileDigit size={28} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Selecione um tipo de documento ao lado</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
                  <FileDigit size={16} className="text-teal-600" />
                  <p className="text-sm font-bold text-gray-900">{templateSelecionado.nome}</p>
                </div>

                <form onSubmit={handleEmitir} className="space-y-4">
                  {erro && (
                    <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg flex items-start gap-2">
                      <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                      {erro}
                    </div>
                  )}

                  {/* Destinatário */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Nome do aluno / titular <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                        placeholder="Nome completo"
                        value={destinatarioNome}
                        onChange={(e) => setDestinatarioNome(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">CPF</label>
                      <input
                        type="text"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                        placeholder="000.000.000-00 (opcional)"
                        value={destinatarioCpf}
                        onChange={(e) => setDestinatarioCpf(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Variáveis do template */}
                  {Object.keys(templateSelecionado.variaveis ?? {}).length > 0 && (
                    <div className="space-y-3 border-t border-gray-100 pt-3">
                      {Object.entries(templateSelecionado.variaveis ?? {}).map(([key, def]) => (
                        <div key={key}>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            {def.label}
                            {def.obrigatorio && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          {def.tipo === "textarea" ? (
                            <textarea
                              rows={2}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                              placeholder={def.placeholder ?? ""}
                              value={form[key] ?? ""}
                              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                            />
                          ) : def.tipo === "select" ? (
                            <select
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                              value={form[key] ?? ""}
                              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                            >
                              <option value="">Selecione...</option>
                              {def.opcoes?.map((op) => <option key={op} value={op}>{op}</option>)}
                            </select>
                          ) : (
                            <input
                              type={def.tipo === "date" ? "date" : "text"}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                              placeholder={def.placeholder ?? ""}
                              value={form[key] ?? ""}
                              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={enviando}
                    className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white text-sm font-semibold py-3 rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50"
                  >
                    {enviando ? (
                      <><Loader2 size={15} className="animate-spin" /> Emitindo...</>
                    ) : (
                      <><FileDigit size={15} /> Emitir documento</>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Link para gerenciar templates */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <p className="text-xs text-gray-400">
          Precisa de um novo tipo de documento?
        </p>
        <Link
          href="/acervo/templates"
          className="inline-flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-800 font-medium"
        >
          <LayoutTemplate size={12} /> Gerenciar templates
        </Link>
      </div>
    </div>
  );
}
