"use client";

/**
 * DS Bot — lista de bots (S11).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Bot,
  Play,
  Pause,
  Trash2,
  Copy,
  Upload,
  Search,
} from "lucide-react";

interface BotRow {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_value: string | null;
  channels: string[];
  enabled: boolean;
  version: number;
  updated_at: string;
}

interface TemplateInfo {
  slug: string;
  name: string;
  description: string;
}

export default function DsBotListPage() {
  const router = useRouter();
  const [bots, setBots] = useState<BotRow[]>([]);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch(
      `/api/atendimento/ds-bots?q=${encodeURIComponent(search)}`,
    );
    if (res.ok) {
      const j = await res.json();
      setBots(j.items ?? []);
      setTemplates(j.templates ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  const togglePublish = async (b: BotRow) => {
    await fetch(`/api/atendimento/ds-bots/${b.id}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: !b.enabled }),
    });
    load();
  };

  const remove = async (b: BotRow) => {
    if (!confirm(`Remover bot "${b.name}"?`)) return;
    await fetch(`/api/atendimento/ds-bots/${b.id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="text-violet-600" /> DS Bot
          </h1>
          <p className="text-sm text-gray-500">
            Fluxos determinísticos antes do humano — visual flow builder.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/atendimento/ds-bot/novo"
            className="inline-flex items-center gap-2 bg-violet-600 text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-violet-700"
          >
            <Plus size={16} /> Novo bot
          </Link>
        </div>
      </header>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            placeholder="Buscar bot..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") load();
            }}
            className="pl-9 pr-3 py-2 border rounded-lg text-sm w-full"
          />
        </div>
        <button
          onClick={load}
          className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"
        >
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 py-12 text-center">
          Carregando...
        </div>
      ) : bots.length === 0 ? (
        <EmptyState
          onCreate={() => router.push("/atendimento/ds-bot/novo")}
          templates={templates}
        />
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="text-left px-4 py-2">Nome</th>
                <th className="text-left px-4 py-2">Gatilho</th>
                <th className="text-left px-4 py-2">Canais</th>
                <th className="text-left px-4 py-2">Versão</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {bots.map((b) => (
                <tr key={b.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/atendimento/ds-bot/${b.id}/editor`}
                      className="font-medium text-gray-900 hover:text-violet-700"
                    >
                      {b.name}
                    </Link>
                    {b.description && (
                      <div className="text-xs text-gray-500">
                        {b.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                      {b.trigger_type}
                    </code>
                    {b.trigger_value && (
                      <span className="ml-2 text-xs text-gray-500">
                        {b.trigger_value}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {b.channels?.join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    v{b.version}
                  </td>
                  <td className="px-4 py-3">
                    {b.enabled ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
                        <Play size={10} /> ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-500 border border-gray-200 rounded-full px-2 py-0.5">
                        <Pause size={10} /> pausado
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => togglePublish(b)}
                        className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                        title={b.enabled ? "Pausar" : "Publicar"}
                      >
                        {b.enabled ? "Pausar" : "Publicar"}
                      </button>
                      <Link
                        href={`/atendimento/ds-bot/${b.id}/editor`}
                        className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                      >
                        Editar
                      </Link>
                      <Link
                        href={`/atendimento/ds-bot/${b.id}/playground`}
                        className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                      >
                        Playground
                      </Link>
                      <button
                        onClick={() => remove(b)}
                        className="text-xs px-2 py-1 border rounded hover:bg-red-50 text-red-600"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  onCreate,
  templates,
}: {
  onCreate: () => void;
  templates: TemplateInfo[];
}) {
  return (
    <div className="bg-white border border-dashed rounded-lg p-12 text-center">
      <Bot className="mx-auto text-violet-400 mb-3" size={48} />
      <h2 className="text-lg font-semibold text-gray-900">
        Nenhum bot criado ainda
      </h2>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Comece do zero, de um template FIC, ou importe um JSON.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
        <button
          onClick={onCreate}
          className="border rounded-lg p-4 hover:bg-gray-50 text-left"
        >
          <Plus className="mb-2 text-violet-600" size={20} />
          <div className="font-medium text-sm">Do zero</div>
          <div className="text-xs text-gray-500">
            Canvas vazio, total controle.
          </div>
        </button>
        <button
          onClick={onCreate}
          className="border rounded-lg p-4 hover:bg-gray-50 text-left"
        >
          <Copy className="mb-2 text-violet-600" size={20} />
          <div className="font-medium text-sm">De template</div>
          <div className="text-xs text-gray-500">
            {templates.length} templates FIC prontos.
          </div>
        </button>
        <button
          onClick={onCreate}
          className="border rounded-lg p-4 hover:bg-gray-50 text-left"
        >
          <Upload className="mb-2 text-violet-600" size={20} />
          <div className="font-medium text-sm">Importar .json</div>
          <div className="text-xs text-gray-500">
            Clone de outro bot exportado.
          </div>
        </button>
      </div>
    </div>
  );
}
