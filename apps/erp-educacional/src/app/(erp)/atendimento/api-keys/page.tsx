"use client";

import { useEffect, useState } from "react";
import { Key, Plus, Trash2, RotateCw, Copy } from "lucide-react";

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  active: boolean;
  revoked_at: string | null;
  last_used_at: string | null;
  rotated_at: string | null;
  created_at: string;
};

const SCOPE_OPTIONS = [
  "messages:send",
  "messages:read",
  "contacts:read",
  "contacts:write",
  "deals:read",
  "deals:write",
  "dashboard:read",
  "*",
];

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newScopes, setNewScopes] = useState<string[]>(["messages:send"]);
  const [plaintextModal, setPlaintextModal] = useState<{ plaintext: string; name: string } | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/atendimento/api-keys", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setKeys(data.keys ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { void reload(); }, []);

  const create = async () => {
    if (!newName.trim()) return;
    const res = await fetch("/api/atendimento/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), scopes: newScopes }),
    });
    const data = await res.json();
    if (res.ok) {
      setPlaintextModal({ plaintext: data.plaintext, name: data.key.name });
      setCreating(false);
      setNewName("");
      await reload();
    } else {
      alert(data.erro);
    }
  };

  const revoke = async (k: ApiKey) => {
    if (!confirm(`Revogar chave "${k.name}"?`)) return;
    await fetch(`/api/atendimento/api-keys/${k.id}`, { method: "DELETE" });
    await reload();
  };

  const rotate = async (k: ApiKey) => {
    if (!confirm(`Rotacionar "${k.name}"? A chave anterior DEIXA de funcionar.`)) return;
    const res = await fetch(`/api/atendimento/api-keys/${k.id}/rotate`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setPlaintextModal({ plaintext: data.plaintext, name: data.key.name });
      await reload();
    } else {
      alert(data.erro);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
          <p className="text-sm text-gray-500 mt-1">Chaves para /api/public/v1/** (guardadas como SHA-256 hash)</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
        >
          <Plus size={14} /> Nova chave
        </button>
      </div>

      {creating && (
        <div className="border border-green-200 bg-green-50/30 rounded-lg p-4 space-y-3">
          <input
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            placeholder="Nome da chave (ex: integração n8n FIC)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1">Scopes:</p>
            <div className="flex flex-wrap gap-1.5">
              {SCOPE_OPTIONS.map((s) => (
                <label key={s} className="flex items-center gap-1 text-xs bg-white px-2 py-1 rounded border border-gray-200">
                  <input
                    type="checkbox"
                    checked={newScopes.includes(s)}
                    onChange={(e) => {
                      setNewScopes(e.target.checked ? [...newScopes, s] : newScopes.filter((x) => x !== s));
                    }}
                  />
                  <span className="font-mono">{s}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreating(false)} className="text-sm text-gray-500">Cancelar</button>
            <button
              onClick={create}
              disabled={!newName.trim() || newScopes.length === 0}
              className="px-3 py-1.5 bg-green-600 text-white rounded text-sm disabled:opacity-50"
            >
              Gerar chave
            </button>
          </div>
        </div>
      )}

      {plaintextModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full space-y-3">
            <h3 className="text-lg font-bold">Grave esta chave agora</h3>
            <p className="text-sm text-gray-600">
              Ela NÃO será exibida novamente. Se perder, é só rotacionar.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded p-3 font-mono text-xs break-all">
              {plaintextModal.plaintext}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { navigator.clipboard.writeText(plaintextModal.plaintext); }}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                <Copy size={14} /> Copiar
              </button>
              <button
                onClick={() => setPlaintextModal(null)}
                className="px-3 py-1.5 bg-green-600 text-white rounded text-sm"
              >
                Anotei
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? <p className="text-sm text-gray-400">Carregando…</p> : keys.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
          <Key className="mx-auto text-gray-300" size={32} />
          <p className="text-sm text-gray-500 mt-2">Sem chaves ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.id} className={`border rounded-lg p-3 flex items-center gap-3 ${
              k.active ? "border-gray-200" : "border-gray-200 bg-gray-50 opacity-60"
            }`}>
              <div className={`w-2 h-2 rounded-full ${k.active && !k.revoked_at ? "bg-green-500" : "bg-gray-300"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{k.name}</p>
                <p className="text-xs text-gray-500 font-mono">{k.key_prefix}••••••••</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {k.scopes.join(", ")}
                  {k.last_used_at ? ` · último uso: ${new Date(k.last_used_at).toLocaleString("pt-BR")}` : " · nunca usada"}
                </p>
              </div>
              {k.active && !k.revoked_at && (
                <>
                  <button onClick={() => rotate(k)} title="Rotacionar" className="text-gray-400 hover:text-amber-600 p-1.5 rounded hover:bg-gray-100">
                    <RotateCw size={14} />
                  </button>
                  <button onClick={() => revoke(k)} title="Revogar" className="text-gray-400 hover:text-red-500 p-1.5 rounded hover:bg-gray-100">
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
