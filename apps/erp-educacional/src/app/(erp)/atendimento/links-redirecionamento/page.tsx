"use client";

/**
 * Links de Redirecionamento — CRUD + stats drawer.
 *
 * Gate: ATENDIMENTO_LINKS_REDIRECT_ENABLED (client public env).
 */

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  BarChart2,
  Pencil,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Power,
} from "lucide-react";
import LinkFormModal from "@/components/atendimento/link-redirects/LinkFormModal";
import LinkStatsDrawer from "@/components/atendimento/link-redirects/LinkStatsDrawer";
import type { LinkRedirect } from "@/components/atendimento/link-redirects/types";

const LINKS_ENABLED = process.env.NEXT_PUBLIC_ATENDIMENTO_LINKS_REDIRECT_ENABLED === "true";

const DISTRIBUTION_LABEL: Record<string, string> = {
  sequential: "Sequencial",
  random: "Aleatório",
  ordered: "Ordem fixa",
  by_hour: "Por horário",
};

export default function LinksRedirecionamentoPage() {
  const [links, setLinks] = useState<LinkRedirect[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LinkRedirect | null>(null);
  const [statsLink, setStatsLink] = useState<LinkRedirect | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/atendimento/link-redirects");
      if (!res.ok) {
        setLinks([]);
        return;
      }
      const body = (await res.json()) as { links?: LinkRedirect[] };
      setLinks(body.links ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este link? Os clicks antigos também serão removidos.")) return;
    const res = await fetch(`/api/atendimento/link-redirects/${id}`, { method: "DELETE" });
    if (res.ok) {
      void load();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.erro ?? "Erro ao excluir.");
    }
  };

  const handleToggleActive = async (link: LinkRedirect) => {
    const res = await fetch(`/api/atendimento/link-redirects/${link.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !link.active }),
    });
    if (res.ok) void load();
  };

  const copyUrl = async (slug: string, id: string) => {
    const url = `${window.location.origin}/api/l/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* noop */
    }
  };

  if (!LINKS_ENABLED) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-lg font-bold text-gray-900">Links de Redirecionamento (S8b)</h1>
          <p className="text-sm text-gray-500">
            Funcionalidade desabilitada. Defina <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_ATENDIMENTO_LINKS_REDIRECT_ENABLED=true</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Links de Redirecionamento</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Redirecione leads para múltiplos WhatsApps com distribuição inteligente.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm font-medium"
        >
          <Plus size={14} />
          Novo link
        </button>
      </header>

      {loading ? (
        <p className="text-sm text-gray-400">Carregando...</p>
      ) : links.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
          <ExternalLink size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">Nenhum link criado ainda.</p>
          <button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="mt-3 text-sm text-indigo-600 hover:text-indigo-800"
          >
            Criar primeiro link
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Nome</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Slug</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Distribuição</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Números</th>
                <th className="px-4 py-2.5 text-right font-semibold text-gray-700">Clicks</th>
                <th className="px-4 py-2.5 text-center font-semibold text-gray-700">Ativo</th>
                <th className="px-4 py-2.5 text-right font-semibold text-gray-700">Ações</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-900 font-medium">{link.name}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <code className="text-xs text-gray-600 font-mono">/l/{link.slug}</code>
                      <button
                        onClick={() => copyUrl(link.slug, link.id)}
                        className="text-gray-400 hover:text-gray-700"
                        title="Copiar URL"
                      >
                        {copiedId === link.id ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                      {DISTRIBUTION_LABEL[link.distribution] ?? link.distribution}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {link.numbers.filter((n) => n.active !== false).length}/{link.numbers.length}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-900 font-semibold tabular-nums">
                    {link.total_clicks}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={() => handleToggleActive(link)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        link.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                      title={link.active ? "Desativar" : "Ativar"}
                    >
                      <Power size={9} />
                      {link.active ? "ON" : "OFF"}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => setStatsLink(link)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                        title="Relatório"
                      >
                        <BarChart2 size={13} />
                      </button>
                      <button
                        onClick={() => {
                          setEditing(link);
                          setFormOpen(true);
                        }}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                        title="Editar"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(link.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-600"
                        title="Excluir"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LinkFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        editing={editing}
      />
      <LinkStatsDrawer
        open={statsLink !== null}
        link={statsLink}
        onClose={() => setStatsLink(null)}
      />
    </div>
  );
}
