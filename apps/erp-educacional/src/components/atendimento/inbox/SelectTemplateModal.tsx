"use client";

/**
 * SelectTemplateModal — lista templates APPROVED, preenche variáveis, envia.
 * Usado pelo ChatPanel quando a janela WABA fechou.
 */

import { useEffect, useMemo, useState } from "react";
import { X, Send, Search, Loader2 } from "lucide-react";
import TemplatePreview from "@/components/atendimento/templates/TemplatePreview";
import {
  countTemplateVariables,
  type MetaComponent,
} from "@/lib/atendimento/meta-templates";

interface Template {
  id: string;
  name: string;
  language: string;
  category: string;
  components: MetaComponent[];
}

interface Props {
  contactId: string;
  conversationId: string;
  inboxId?: string;
  onClose: () => void;
  onSent: () => void;
}

export default function SelectTemplateModal({
  contactId,
  conversationId,
  inboxId,
  onClose,
  onSent,
}: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [variables, setVariables] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ status: "APPROVED", limit: "200" });
        if (inboxId) params.set("inbox_id", inboxId);
        const res = await fetch(`/api/atendimento/templates?${params}`);
        if (res.ok) {
          const { items } = await res.json();
          setTemplates(items ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [inboxId]);

  const filtered = useMemo(
    () =>
      templates.filter((t) =>
        search ? t.name.toLowerCase().includes(search.toLowerCase()) : true,
      ),
    [templates, search],
  );

  function selectTemplate(tpl: Template) {
    setSelected(tpl);
    const count = countTemplateVariables(tpl.components);
    setVariables(Array(count).fill(""));
    setError(null);
  }

  async function send() {
    if (!selected) return;
    const expectedVars = countTemplateVariables(selected.components);
    if (variables.some((v) => !v.trim()) && expectedVars > 0) {
      setError("Preencha todas as variáveis");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/atendimento/templates/${selected.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contactId,
          conversation_id: conversationId,
          variables,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Erro ${res.status}`);
      }
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <div>
            <h2 className="font-semibold text-gray-900">Enviar template</h2>
            <p className="text-xs text-gray-500">
              Janela de 24h fechada — selecione um template aprovado
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 min-h-0">
          {/* Lista */}
          <div className="border-r border-gray-200 flex flex-col min-h-0">
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar template…"
                  className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <Loader2 size={18} className="animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500">
                  Nenhum template APPROVED.
                  <br />
                  Crie e submeta em <code>/atendimento/templates</code>.
                </div>
              ) : (
                filtered.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => selectTemplate(tpl)}
                    className={`w-full text-left px-3 py-2 border-b border-gray-100 hover:bg-gray-50 ${
                      selected?.id === tpl.id ? "bg-green-50" : ""
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-900">{tpl.name}</div>
                    <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                      <span>{tpl.category}</span>
                      <span>·</span>
                      <span>{tpl.language}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Detalhe + variáveis */}
          <div className="flex flex-col min-h-0">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-xs text-gray-400 p-6">
                Selecione um template ao lado
              </div>
            ) : (
              <>
                <div className="p-3 overflow-y-auto flex-1">
                  <TemplatePreview components={selected.components} variables={variables} />

                  {countTemplateVariables(selected.components) > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="text-[11px] font-semibold text-gray-700">Variáveis</div>
                      {variables.map((v, idx) => (
                        <div key={idx}>
                          <label className="block text-[10px] text-gray-500 font-mono mb-0.5">
                            {`{{${idx + 1}}}`}
                          </label>
                          <input
                            value={v}
                            onChange={(e) => {
                              const next = [...variables];
                              next[idx] = e.target.value;
                              setVariables(next);
                            }}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                            placeholder={`Valor para {{${idx + 1}}}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {error && (
                    <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                      {error}
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 p-3 flex items-center justify-end gap-2 bg-gray-50">
                  <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 rounded-lg">
                    Cancelar
                  </button>
                  <button
                    onClick={send}
                    disabled={sending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <Send size={13} /> Enviar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
