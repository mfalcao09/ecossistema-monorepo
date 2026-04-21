"use client";

import { useEffect, useState } from "react";
import { Webhook, Plus, ArrowDownLeft, ArrowUpRight, Copy, Trash2, Power } from "lucide-react";

type InboundEndpoint = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tags_auto: string[];
  active: boolean;
  last_call_at: string | null;
  call_count: number;
};

type OutboundUrl = {
  id: string;
  name: string;
  url: string;
  description: string | null;
  events: string[];
  active: boolean;
  last_delivery_at: string | null;
};

export default function WebhooksPage() {
  const [tab, setTab] = useState<"inbound" | "outbound">("inbound");
  const [inbounds, setInbounds] = useState<InboundEndpoint[]>([]);
  const [outbounds, setOutbounds] = useState<OutboundUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [ri, ro] = await Promise.all([
        fetch("/api/atendimento/webhooks/inbound", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/atendimento/webhooks/outbound", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setInbounds(ri.endpoints ?? []);
      setOutbounds(ro.outbounds ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { void reload(); }, []);

  const createInbound = async () => {
    const name = prompt("Nome do endpoint de entrada:");
    if (!name) return;
    const res = await fetch("/api/atendimento/webhooks/inbound", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (res.ok) {
      setFlash(`Endpoint criado. Slug: ${data.endpoint.slug} · Secret: ${data.endpoint.secret}`);
      await reload();
    } else {
      alert(data.erro);
    }
  };

  const createOutbound = async () => {
    const name = prompt("Nome:");
    const url = prompt("URL alvo:");
    const eventsStr = prompt("Eventos (vírgula) — ex: message.received,deal.created");
    if (!name || !url || !eventsStr) return;
    const events = eventsStr.split(",").map((s) => s.trim()).filter(Boolean);
    const res = await fetch("/api/atendimento/webhooks/outbound", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, url, events }),
    });
    const data = await res.json();
    if (res.ok) {
      setFlash(`Saída criada. Secret: ${data.outbound.secret}`);
      await reload();
    } else {
      alert(data.erro);
    }
  };

  const toggleInbound = async (e: InboundEndpoint) => {
    await fetch(`/api/atendimento/webhooks/inbound/${e.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !e.active }),
    });
    await reload();
  };

  const toggleOutbound = async (e: OutboundUrl) => {
    await fetch(`/api/atendimento/webhooks/outbound/${e.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !e.active }),
    });
    await reload();
  };

  const deleteInbound = async (e: InboundEndpoint) => {
    if (!confirm(`Deletar endpoint "${e.name}"?`)) return;
    await fetch(`/api/atendimento/webhooks/inbound/${e.id}`, { method: "DELETE" });
    await reload();
  };

  const deleteOutbound = async (e: OutboundUrl) => {
    if (!confirm(`Deletar saída "${e.name}"?`)) return;
    await fetch(`/api/atendimento/webhooks/outbound/${e.id}`, { method: "DELETE" });
    await reload();
  };

  const copyCurl = (e: InboundEndpoint) => {
    const url = `${window.location.origin}/api/atendimento/webhooks/inbound/${e.slug}/hit`;
    const body = `{"contact":{"name":"Teste","phone_number":"5567999999999"},"message":{"content":"olá"}}`;
    const snippet = `# Gere a assinatura:
SIG=$(printf '%s' '${body}' | openssl dgst -sha256 -hmac '<SECRET>' | cut -d' ' -f2)
curl -X POST '${url}' \\
  -H 'Content-Type: application/json' \\
  -H "x-signature: sha256=$SIG" \\
  -d '${body}'`;
    navigator.clipboard.writeText(snippet);
    setFlash("Snippet cURL copiado — substitua <SECRET> pelo secret do endpoint.");
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
          <p className="text-sm text-gray-500 mt-1">Endpoints de entrada e URLs de saída com retry exponencial</p>
        </div>
      </div>

      {flash && (
        <div className="bg-blue-50 text-blue-700 text-xs rounded px-3 py-2 font-mono break-all">
          {flash} <button onClick={() => setFlash(null)} className="float-right opacity-60">✕</button>
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200">
        {[
          { k: "inbound", label: "Entrada", icon: ArrowDownLeft },
          { k: "outbound", label: "Saída", icon: ArrowUpRight },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k as "inbound" | "outbound")}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 ${
                tab === t.k ? "border-green-500 text-green-700" : "border-transparent text-gray-500"
              }`}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex justify-end">
        {tab === "inbound" ? (
          <button
            onClick={createInbound}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
          >
            <Plus size={14} /> Nova entrada
          </button>
        ) : (
          <button
            onClick={createOutbound}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
          >
            <Plus size={14} /> Nova saída
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-gray-400">Carregando…</p>}

      {tab === "inbound" && !loading && (
        inbounds.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
            <Webhook className="mx-auto text-gray-300" size={32} />
            <p className="text-sm text-gray-500 mt-2">Sem endpoints de entrada.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {inbounds.map((e) => (
              <div key={e.id} className="border border-gray-200 rounded-lg p-3 flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${e.active ? "bg-green-500" : "bg-gray-300"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{e.name}</p>
                  <p className="text-xs text-gray-500 font-mono truncate">/api/atendimento/webhooks/inbound/{e.slug}/hit</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {e.call_count} chamada(s){e.last_call_at ? ` · última: ${new Date(e.last_call_at).toLocaleString("pt-BR")}` : ""}
                  </p>
                </div>
                <button onClick={() => copyCurl(e)} className="text-gray-400 hover:text-blue-600 p-1.5 rounded hover:bg-gray-100" title="Copiar cURL">
                  <Copy size={14} />
                </button>
                <button onClick={() => toggleInbound(e)} className={`p-1.5 rounded hover:bg-gray-100 ${e.active ? "text-green-600" : "text-gray-400"}`}>
                  <Power size={14} />
                </button>
                <button onClick={() => deleteInbound(e)} className="text-gray-400 hover:text-red-500 p-1.5 rounded hover:bg-gray-100">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "outbound" && !loading && (
        outbounds.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
            <Webhook className="mx-auto text-gray-300" size={32} />
            <p className="text-sm text-gray-500 mt-2">Sem URLs de saída.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {outbounds.map((o) => (
              <div key={o.id} className="border border-gray-200 rounded-lg p-3 flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${o.active ? "bg-green-500" : "bg-gray-300"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{o.name}</p>
                  <p className="text-xs text-gray-500 font-mono truncate">{o.url}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Eventos: {o.events.join(", ")}
                    {o.last_delivery_at ? ` · última: ${new Date(o.last_delivery_at).toLocaleString("pt-BR")}` : ""}
                  </p>
                </div>
                <button onClick={() => toggleOutbound(o)} className={`p-1.5 rounded hover:bg-gray-100 ${o.active ? "text-green-600" : "text-gray-400"}`}>
                  <Power size={14} />
                </button>
                <button onClick={() => deleteOutbound(o)} className="text-gray-400 hover:text-red-500 p-1.5 rounded hover:bg-gray-100">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
