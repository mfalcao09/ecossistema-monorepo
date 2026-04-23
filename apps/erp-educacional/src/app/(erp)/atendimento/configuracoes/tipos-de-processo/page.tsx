"use client";

/**
 * /atendimento/configuracoes/tipos-de-processo
 *
 * CRUD de `atendimento_process_types` — taxonomia extensível que alimenta o
 * dropdown do ProtocolModal. Sprint S4.5 · Etapa 2-B.
 *
 * Permissão: settings:edit / settings:delete. Se o usuário não tem, os
 * botões retornam 403 do servidor e mostram mensagem inline — UI não
 * bloqueia proativamente (simples).
 */

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Loader2,
  Edit3,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Check,
  X,
} from "lucide-react";

interface ProcessType {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export default function TiposDeProcessoPage() {
  const [types, setTypes] = useState<ProcessType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form novo
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  // Edição inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editErr, setEditErr] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/atendimento/process-types");
      const data = (await res.json()) as
        | { process_types: ProcessType[] }
        | { erro: string };
      if (!res.ok || "erro" in data) {
        setError("erro" in data ? data.erro : `HTTP ${res.status}`);
        return;
      }
      setTypes(data.process_types);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setCreateErr(null);
    setCreateLoading(true);
    try {
      const res = await fetch("/api/atendimento/process-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: newKey.trim(),
          name: newName.trim(),
          description: newDesc.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        process_type?: ProcessType;
        erro?: string;
      };
      if (!res.ok || !data.process_type) {
        setCreateErr(data.erro ?? `HTTP ${res.status}`);
        return;
      }
      setNewKey("");
      setNewName("");
      setNewDesc("");
      setCreating(false);
      await load();
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : String(err));
    } finally {
      setCreateLoading(false);
    }
  }

  async function toggleActive(pt: ProcessType) {
    await fetch(`/api/atendimento/process-types/${pt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !pt.is_active }),
    });
    await load();
  }

  async function remover(pt: ProcessType) {
    if (
      !confirm(
        `Remover tipo "${pt.name}"? Se já foi usado em protocolos, ficará desativado (soft delete).`,
      )
    ) {
      return;
    }
    await fetch(`/api/atendimento/process-types/${pt.id}`, {
      method: "DELETE",
    });
    await load();
  }

  function iniciarEdicao(pt: ProcessType) {
    setEditingId(pt.id);
    setEditName(pt.name);
    setEditDesc(pt.description ?? "");
    setEditErr(null);
  }

  async function salvarEdicao(pt: ProcessType) {
    setEditLoading(true);
    setEditErr(null);
    try {
      const res = await fetch(`/api/atendimento/process-types/${pt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim() || null,
        }),
      });
      const data = (await res.json()) as { erro?: string };
      if (!res.ok) {
        setEditErr(data.erro ?? `HTTP ${res.status}`);
        return;
      }
      setEditingId(null);
      await load();
    } catch (err) {
      setEditErr(err instanceof Error ? err.message : String(err));
    } finally {
      setEditLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Tipos de processo acadêmico
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Taxonomia usada em protocolos (= processos acadêmicos). Tipos
            referenciados por protocolos existentes não podem ser excluídos — só
            desativados.
          </p>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm font-medium"
        >
          <Plus size={14} /> Novo tipo
        </button>
      </div>

      {creating && (
        <form
          onSubmit={criar}
          className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2"
        >
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                key <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newKey}
                onChange={(e) =>
                  setNewKey(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                  )
                }
                placeholder="ex: reingresso_especial"
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nome exibido <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="ex: Reingresso Especial"
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Descrição (opcional)
            </label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="quando usar esse tipo"
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
          {createErr && <p className="text-xs text-red-600">{createErr}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createLoading}
              className="rounded-md bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-sm font-medium disabled:opacity-50"
            >
              {createLoading ? "Criando…" : "Criar tipo"}
            </button>
          </div>
        </form>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-6 justify-center">
          <Loader2 size={16} className="animate-spin" /> Carregando…
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
              <th className="py-2 pr-3">Ordem</th>
              <th className="py-2 pr-3">key</th>
              <th className="py-2 pr-3">Nome</th>
              <th className="py-2 pr-3">Descrição</th>
              <th className="py-2 pr-3">Ativo</th>
              <th className="py-2 pr-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {types.map((pt) => {
              const editing = editingId === pt.id;
              return (
                <tr
                  key={pt.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-2 pr-3 text-gray-400">{pt.sort_order}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-gray-600">
                    {pt.key}
                  </td>
                  <td className="py-2 pr-3">
                    {editing ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-0.5 text-sm"
                      />
                    ) : (
                      <span
                        className={
                          pt.is_active ? "text-gray-900" : "text-gray-400"
                        }
                      >
                        {pt.name}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-gray-500">
                    {editing ? (
                      <input
                        type="text"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-0.5 text-sm"
                      />
                    ) : (
                      (pt.description ?? "—")
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <button
                      onClick={() => toggleActive(pt)}
                      className={
                        pt.is_active
                          ? "text-green-600 hover:text-green-800"
                          : "text-gray-400 hover:text-gray-600"
                      }
                      title={pt.is_active ? "Desativar" : "Ativar"}
                    >
                      {pt.is_active ? (
                        <ToggleRight size={18} />
                      ) : (
                        <ToggleLeft size={18} />
                      )}
                    </button>
                  </td>
                  <td className="py-2 pr-3 text-right space-x-1">
                    {editing ? (
                      <>
                        <button
                          onClick={() => salvarEdicao(pt)}
                          disabled={editLoading}
                          className="text-green-600 hover:text-green-800"
                          title="Salvar"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-gray-400 hover:text-gray-700"
                          title="Cancelar"
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => iniciarEdicao(pt)}
                          className="text-gray-400 hover:text-blue-700"
                          title="Editar"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => remover(pt)}
                          className="text-gray-400 hover:text-red-700"
                          title="Remover"
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {editErr && (
              <tr>
                <td colSpan={6} className="py-2 text-xs text-red-600">
                  {editErr}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
