"use client";

/**
 * ProtocolModal — abre protocolo (= processo acadêmico) dentro de uma conversa.
 *
 * Sprint S4.5 · Etapa 2-B:
 *  - Dropdown `process_type_id` obrigatório (carrega de /api/atendimento/process-types)
 *  - Último item do dropdown é "➕ Novo tipo…" — abre mini-form inline (requer
 *    permissão settings:edit; se não tiver, servidor retorna 403 e o form mostra erro)
 *  - Se `process_type.key === 'outros'`, campo `description` vira obrigatório
 *  - Auto-vincula `aluno_id` no servidor se o contato da conversa já tem aluno
 *
 * Número sequencial continua pelo DB (protocols.protocol_number BIGSERIAL).
 */

import { useEffect, useMemo, useState } from "react";
import { X, FileText, Plus } from "lucide-react";

import type { Protocol, ProcessTypeBrief } from "@/lib/atendimento/types";
import TicketNumberPill from "@/components/atendimento/shared/TicketNumberPill";

interface ProtocolModalProps {
  open: boolean;
  conversationId: string | null;
  onClose: () => void;
  onCreated?: (protocol: Protocol) => void;
}

const NEW_TYPE_SENTINEL = "__new__";

export default function ProtocolModal({
  open,
  conversationId,
  onClose,
  onCreated,
}: ProtocolModalProps) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [processTypeId, setProcessTypeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [types, setTypes] = useState<ProcessTypeBrief[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);

  // Inline "novo tipo"
  const [newTypeOpen, setNewTypeOpen] = useState(false);
  const [newTypeKey, setNewTypeKey] = useState("");
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeLoading, setNewTypeLoading] = useState(false);
  const [newTypeError, setNewTypeError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTypesLoading(true);
    fetch("/api/atendimento/process-types?active=1")
      .then((r) => r.json())
      .then((j: { process_types?: ProcessTypeBrief[] }) => {
        setTypes(j.process_types ?? []);
      })
      .catch(console.error)
      .finally(() => setTypesLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open || !conversationId) return;
    fetch(`/api/atendimento/conversas/${conversationId}/protocols`)
      .then((r) => r.json())
      .then((j: { protocols?: Protocol[] }) => setProtocols(j.protocols ?? []))
      .catch(console.error);
  }, [open, conversationId]);

  const selectedType = useMemo(
    () => types.find((t) => t.id === processTypeId) ?? null,
    [types, processTypeId],
  );
  const descriptionRequired = selectedType?.key === "outros";

  async function createNewType(e: React.FormEvent) {
    e.preventDefault();
    if (!newTypeKey.trim() || !newTypeName.trim()) return;
    setNewTypeLoading(true);
    setNewTypeError(null);
    try {
      const res = await fetch("/api/atendimento/process-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: newTypeKey.trim(),
          name: newTypeName.trim(),
        }),
      });
      const json = (await res.json()) as {
        process_type?: ProcessTypeBrief;
        erro?: string;
      };
      if (!res.ok || !json.process_type) {
        setNewTypeError(json.erro ?? `HTTP ${res.status}`);
        return;
      }
      const pt = json.process_type;
      setTypes((prev) =>
        [...prev, pt].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setProcessTypeId(pt.id);
      setNewTypeOpen(false);
      setNewTypeKey("");
      setNewTypeName("");
    } catch (err) {
      setNewTypeError(err instanceof Error ? err.message : String(err));
    } finally {
      setNewTypeLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !conversationId) return;
    if (!processTypeId) {
      setError("Selecione o tipo de processo.");
      return;
    }
    if (descriptionRequired && !description.trim()) {
      setError("Para o tipo 'Outros', a descrição é obrigatória.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/atendimento/conversas/${conversationId}/protocols`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: subject.trim(),
            description: description.trim() || undefined,
            process_type_id: processTypeId,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro ?? "Falha");
      setSubject("");
      setDescription("");
      setProcessTypeId("");
      setProtocols((prev) => [json.protocol, ...prev]);
      onCreated?.(json.protocol);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function resolver(id: string) {
    await fetch(
      `/api/atendimento/conversas/${conversationId}/protocols?protocol_id=${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      },
    );
    setProtocols((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: "resolved", resolved_at: new Date().toISOString() }
          : p,
      ),
    );
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 animate-fade-in"
        onClick={onClose}
      />

      <div
        className="fixed left-1/2 top-1/2 z-50 w-[560px] max-w-[95vw] max-h-[90vh] overflow-auto -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-white shadow-2xl"
        role="dialog"
        aria-label="Protocolos da conversa"
      >
        <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">
              Protocolos / Processos
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-3 p-4">
          <form onSubmit={submit} className="space-y-2">
            {/* Tipo de processo */}
            <label className="block text-xs font-medium text-gray-700">
              Tipo de processo <span className="text-red-500">*</span>
            </label>
            <select
              value={processTypeId}
              onChange={(e) => {
                const v = e.target.value;
                if (v === NEW_TYPE_SENTINEL) {
                  setNewTypeOpen(true);
                  return;
                }
                setProcessTypeId(v);
              }}
              disabled={typesLoading}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              required
            >
              <option value="">
                {typesLoading ? "Carregando…" : "Selecione…"}
              </option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              <option value={NEW_TYPE_SENTINEL}>➕ Novo tipo…</option>
            </select>

            {/* Inline novo tipo */}
            {newTypeOpen && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-blue-900">
                    Criar novo tipo de processo
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setNewTypeOpen(false);
                      setNewTypeError(null);
                    }}
                    className="text-blue-700 hover:text-blue-900"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input
                  type="text"
                  value={newTypeKey}
                  onChange={(e) =>
                    setNewTypeKey(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                    )
                  }
                  placeholder="key (ex: reingresso_especial)"
                  className="w-full rounded-md border border-blue-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder="Nome exibido (ex: Reingresso Especial)"
                  className="w-full rounded-md border border-blue-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                />
                {newTypeError && (
                  <p className="text-xs text-red-600">{newTypeError}</p>
                )}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={createNewType}
                    disabled={newTypeLoading}
                    className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Plus className="h-3 w-3" />
                    {newTypeLoading ? "Criando…" : "Criar"}
                  </button>
                </div>
              </div>
            )}

            {/* Assunto */}
            <label className="block text-xs font-medium text-gray-700">
              Assunto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Solicitação de 2ª via de boleto"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              required
            />

            {/* Descrição (obrigatória se tipo = 'outros') */}
            <label className="block text-xs font-medium text-gray-700">
              Descrição{" "}
              {descriptionRequired && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                descriptionRequired
                  ? "Obrigatória para tipo 'Outros' — explique o processo"
                  : "Opcional"
              }
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
              required={descriptionRequired}
            />

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Criando…" : "Abrir protocolo"}
              </button>
            </div>
          </form>

          <hr className="border-gray-200" />

          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Protocolos desta conversa ({protocols.length})
            </h3>

            <ul className="space-y-2">
              {protocols.length === 0 && (
                <li className="text-xs text-gray-400">
                  Nenhum protocolo aberto ainda.
                </li>
              )}
              {protocols.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <TicketNumberPill
                        number={p.protocol_number}
                        label="Protocolo"
                        variant={
                          p.status === "open"
                            ? "default"
                            : p.status === "resolved"
                              ? "success"
                              : "muted"
                        }
                      />
                      {p.process_type && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {p.process_type.name}
                        </span>
                      )}
                      <span className="truncate text-sm font-medium text-gray-900">
                        {p.subject}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      {new Date(p.created_at).toLocaleString("pt-BR")}
                      {p.resolved_at &&
                        ` · resolvido ${new Date(p.resolved_at).toLocaleString("pt-BR")}`}
                    </p>
                  </div>

                  {p.status === "open" && (
                    <button
                      type="button"
                      onClick={() => resolver(p.id)}
                      className="shrink-0 rounded-md border border-gray-300 px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Resolver
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
