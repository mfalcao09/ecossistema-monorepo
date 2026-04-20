"use client";

/**
 * Templates WABA — grid de cards com preview + editor 3-step.
 * Rota: /atendimento/templates
 */

import { useEffect, useState } from "react";
import { Plus, RefreshCw, Search, Trash2, Send, Copy, AlertCircle } from "lucide-react";
import TemplatePreview from "@/components/atendimento/templates/TemplatePreview";
import TemplateEditor from "@/components/atendimento/templates/TemplateEditor";
import type { MetaComponent } from "@/lib/atendimento/meta-templates";

interface TemplateRow {
  id: string;
  inbox_id: string;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "DISABLED" | "PAUSED";
  components: MetaComponent[];
  meta_template_id: string | null;
  rejected_reason: string | null;
  last_synced_at: string | null;
  updated_at: string;
}

interface Inbox { id: string; name: string }

type Filter = "ALL" | TemplateRow["category"];
type StatusFilter = "ALL" | TemplateRow["status"];

const CATEGORY_COLOR: Record<TemplateRow["category"], string> = {
  MARKETING: "bg-purple-100 text-purple-700 border-purple-200",
  UTILITY: "bg-blue-100 text-blue-700 border-blue-200",
  AUTHENTICATION: "bg-orange-100 text-orange-700 border-orange-200",
};

const STATUS_COLOR: Record<TemplateRow["status"], string> = {
  DRAFT: "bg-gray-100 text-gray-700 border-gray-200",
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  APPROVED: "bg-green-100 text-green-700 border-green-200",
  REJECTED: "bg-red-100 text-red-700 border-red-200",
  DISABLED: "bg-gray-100 text-gray-500 border-gray-200",
  PAUSED: "bg-yellow-100 text-yellow-700 border-yellow-200",
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [category, setCategory] = useState<Filter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [lastSyncInfo, setLastSyncInfo] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== "ALL") params.set("category", category);
      if (status !== "ALL") params.set("status", status);
      if (search) params.set("q", search);
      const res = await fetch(`/api/atendimento/templates?${params}`);
      if (res.ok) {
        const { items } = await res.json();
        setTemplates(items);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadInboxes() {
    try {
      const res = await fetch("/api/atendimento/inboxes?channel=whatsapp");
      if (res.ok) {
        const { items } = await res.json();
        setInboxes(items ?? []);
      }
    } catch {
      // fallback: endpoint pode não existir ainda
    }
  }

  useEffect(() => {
    void load();
    void loadInboxes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, status]);

  async function handleSync() {
    setSyncing(true);
    setLastSyncInfo(null);
    try {
      const res = await fetch("/api/atendimento/templates/sync", { method: "POST" });
      const j = await res.json();
      setLastSyncInfo(
        j.ok
          ? `✓ ${j.totals?.upserted ?? 0} templates sincronizados`
          : `⚠ Erros: ${j.totals?.errors ?? "?"}`,
      );
      await load();
    } catch {
      setLastSyncInfo("Falha ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover este template?")) return;
    await fetch(`/api/atendimento/templates/${id}`, { method: "DELETE" });
    await load();
  }

  async function handleDuplicate(tpl: TemplateRow) {
    const res = await fetch("/api/atendimento/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inbox_id: tpl.inbox_id,
        name: `${tpl.name}_copy_${Math.floor(Date.now() / 1000).toString(36)}`,
        category: tpl.category,
        language: tpl.language,
        components: tpl.components,
      }),
    });
    if (res.ok) await load();
  }

  const filtered = templates.filter((t) =>
    search ? t.name.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-5 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Templates WABA</h1>
            <p className="text-xs text-gray-500">
              Mensagens HSM aprovadas pela Meta para disparo ativo fora da janela de 24h
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
              Sincronizar Meta
            </button>
            <button
              onClick={() => setShowEditor(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus size={13} />
              Criar template
            </button>
          </div>
        </div>

        {lastSyncInfo && (
          <div className="mb-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded px-2 py-1">
            {lastSyncInfo}
          </div>
        )}

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5">
            {(["ALL", "UTILITY", "MARKETING", "AUTHENTICATION"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-2.5 py-1 text-[11px] rounded-md ${
                  category === c
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {c === "ALL"
                  ? "Todos"
                  : c === "UTILITY"
                    ? "Utilitário"
                    : c === "MARKETING"
                      ? "Marketing"
                      : "Auth"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5">
            {(["ALL", "APPROVED", "PENDING", "REJECTED", "DRAFT"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-2.5 py-1 text-[11px] rounded-md ${
                  status === s
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {s === "ALL" ? "Todos" : s}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome"
              className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="text-center text-gray-400 text-sm py-8">Carregando…</div>
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={() => setShowEditor(true)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                tpl={tpl}
                onDelete={() => handleDelete(tpl.id)}
                onDuplicate={() => handleDuplicate(tpl)}
              />
            ))}
          </div>
        )}
      </div>

      {showEditor && (
        <TemplateEditor
          inboxes={inboxes}
          onClose={() => setShowEditor(false)}
          onSaved={() => {
            setShowEditor(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function TemplateCard({
  tpl,
  onDelete,
  onDuplicate,
}: {
  tpl: TemplateRow;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {/* Preview */}
      <TemplatePreview components={tpl.components} compact />

      {/* Meta */}
      <div className="p-3 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-gray-900 truncate">{tpl.name}</div>
            <div className="text-[10px] text-gray-400 font-mono">{tpl.language}</div>
          </div>
          <span
            className={`px-1.5 py-0.5 text-[9px] font-bold border rounded-full uppercase ${STATUS_COLOR[tpl.status]}`}
          >
            {tpl.status}
          </span>
        </div>

        <span
          className={`self-start px-2 py-0.5 text-[10px] font-medium border rounded-full ${CATEGORY_COLOR[tpl.category]}`}
        >
          {tpl.category}
        </span>

        {tpl.status === "REJECTED" && tpl.rejected_reason && (
          <div className="text-[10px] text-red-700 bg-red-50 border border-red-200 rounded p-1.5 flex items-start gap-1">
            <AlertCircle size={11} className="flex-shrink-0 mt-[1px]" />
            <span className="flex-1">{tpl.rejected_reason}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 mt-auto pt-2 border-t border-gray-100">
          <button
            onClick={onDuplicate}
            className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-100 rounded"
            title="Duplicar"
          >
            <Copy size={11} /> Duplicar
          </button>
          {tpl.status === "APPROVED" && (
            <span className="ml-auto flex items-center gap-0.5 text-[11px] text-green-600">
              <Send size={11} /> Pronto
            </span>
          )}
          <button
            onClick={onDelete}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
            title="Remover"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-center py-12">
      <div className="w-12 h-12 bg-gray-100 rounded-full mx-auto mb-3 flex items-center justify-center">
        <Send size={18} className="text-gray-400" />
      </div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">Nenhum template ainda</h3>
      <p className="text-xs text-gray-500 mb-4">
        Sincronize com a Meta ou crie um template novo para começar
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
      >
        <Plus size={13} /> Criar template
      </button>
    </div>
  );
}
