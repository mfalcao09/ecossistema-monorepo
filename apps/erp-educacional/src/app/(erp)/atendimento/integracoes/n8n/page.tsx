"use client";

import { useEffect, useState } from "react";
import { Workflow, Plus, Trash2, Power } from "lucide-react";

type N8nIntegration = {
  id: string;
  name: string;
  n8n_flow_id: string;
  webhook_url: string;
  description: string | null;
  active: boolean;
  last_triggered_at: string | null;
  trigger_count: number;
};

export default function N8nConfigPage() {
  const [items, setItems] = useState<N8nIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "N8N – AF EDUCACIONAL (FIC)",
    n8n_flow_id: "2967",
    webhook_url: "",
    webhook_token: "",
    description: "Fluxo ativo da FIC — plugado do Nexvy",
  });

  const reload = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/atendimento/n8n-integrations", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setItems(data.integrations ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { void reload(); }, []);

  const create = async () => {
    const res = await fetch("/api/atendimento/n8n-integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      setCreating(false);
      setForm({ ...form, webhook_url: "", webhook_token: "" });
      await reload();
    } else {
      alert(data.erro);
    }
  };

  const toggle = async (i: N8nIntegration) => {
    await fetch(`/api/atendimento/n8n-integrations/${i.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !i.active }),
    });
    await reload();
  };

  const remove = async (i: N8nIntegration) => {
    if (!confirm(`Deletar "${i.name}"?`)) return;
    await fetch(`/api/atendimento/n8n-integrations/${i.id}`, { method: "DELETE" });
    await reload();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">n8n — Integrações</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cadastre os fluxos n8n — depois use a ação <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">trigger_n8n</code> nas automações.
          </p>
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
            <Plus size={14} /> Nova
          </button>
        )}
      </div>

      {creating && (
        <div className="border border-green-200 bg-green-50/30 rounded-lg p-4 space-y-3">
          <input
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            placeholder="Nome (ex: N8N – AF EDUCACIONAL)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="px-3 py-2 border border-gray-300 rounded text-sm font-mono"
              placeholder="n8n_flow_id (ex: 2967)"
              value={form.n8n_flow_id}
              onChange={(e) => setForm({ ...form, n8n_flow_id: e.target.value })}
            />
            <input
              className="px-3 py-2 border border-gray-300 rounded text-sm"
              placeholder="webhook_token (opcional)"
              value={form.webhook_token}
              onChange={(e) => setForm({ ...form, webhook_token: e.target.value })}
            />
          </div>
          <input
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono"
            placeholder="https://seu-n8n.xxx/webhook/2967"
            value={form.webhook_url}
            onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
          />
          <input
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            placeholder="Descrição"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreating(false)} className="text-sm text-gray-500">Cancelar</button>
            <button
              onClick={create}
              disabled={!form.name || !form.webhook_url || !form.n8n_flow_id}
              className="px-3 py-1.5 bg-green-600 text-white rounded text-sm disabled:opacity-50"
            >
              Criar
            </button>
          </div>
        </div>
      )}

      {loading ? <p className="text-sm text-gray-400">Carregando…</p> : items.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
          <Workflow className="mx-auto text-gray-300" size={32} />
          <p className="text-sm text-gray-500 mt-2">Nenhum flow n8n cadastrado.</p>
          <p className="text-xs text-gray-400 mt-1">O n8n ID 2967 da FIC está aguardando URL + token do Marcelo.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((i) => (
            <div key={i.id} className="border border-gray-200 rounded-lg p-3 flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${i.active ? "bg-green-500" : "bg-gray-300"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{i.name} <span className="font-mono text-xs text-gray-400">#{i.n8n_flow_id}</span></p>
                <p className="text-xs text-gray-500 font-mono truncate">{i.webhook_url}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {i.trigger_count} trigger(s){i.last_triggered_at ? ` · último: ${new Date(i.last_triggered_at).toLocaleString("pt-BR")}` : ""}
                </p>
              </div>
              <button onClick={() => toggle(i)} className={`p-1.5 rounded hover:bg-gray-100 ${i.active ? "text-green-600" : "text-gray-400"}`}>
                <Power size={14} />
              </button>
              <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 p-1.5 rounded hover:bg-gray-100">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
