"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Workflow, Calendar, Mic, Target, Check, Settings2, Plus } from "lucide-react";

type App = {
  id: string;
  app_key: string;
  config: Record<string, unknown>;
  enabled: boolean;
  installed_at: string | null;
};

const APP_META: Record<string, { name: string; description: string; icon: React.ElementType; color: string; configLink?: string }> = {
  n8n: {
    name: "n8n",
    description: "Disparar fluxos n8n a partir de automações (ex: ID 2967 AF EDUCACIONAL)",
    icon: Workflow,
    color: "bg-pink-500",
    configLink: "/atendimento/integracoes/n8n",
  },
  google_calendar: {
    name: "Google Calendar",
    description: "Sincronizar agendamentos com Google Calendar (S5)",
    icon: Calendar,
    color: "bg-blue-500",
  },
  ia_transcription: {
    name: "Transcrição de áudio com IA",
    description: "Gemini/Whisper para transcrever áudios recebidos (S9)",
    icon: Mic,
    color: "bg-purple-500",
  },
  meta_ads: {
    name: "Meta ADS Tracking",
    description: "Tracking de conversões Meta ADS (futuro)",
    icon: Target,
    color: "bg-indigo-500",
  },
};

export default function IntegracoesPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/atendimento/app-installations", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setApps(data.apps ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { void reload(); }, []);

  const toggle = async (a: App) => {
    await fetch("/api/atendimento/app-installations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_key: a.app_key, enabled: !a.enabled }),
    });
    await reload();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Apps</h1>
        <p className="text-sm text-gray-500 mt-1">Catálogo de integrações do módulo Atendimento</p>
      </div>

      {loading ? <p className="text-sm text-gray-400">Carregando…</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {apps.map((a) => {
            const meta = APP_META[a.app_key] ?? {
              name: a.app_key, description: "", icon: Settings2, color: "bg-gray-500",
            };
            const Icon = meta.icon;
            return (
              <div key={a.id} className="border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg ${meta.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{meta.name}</p>
                    <p className="text-xs text-gray-500">{meta.description}</p>
                  </div>
                  {a.enabled && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                      <Check size={10} /> Ativo
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggle(a)}
                    className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded ${
                      a.enabled ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-green-600 text-white hover:bg-green-700"
                    }`}
                  >
                    {a.enabled ? "Desativar" : "Ativar"}
                  </button>
                  {meta.configLink && (
                    <Link
                      href={meta.configLink}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50"
                    >
                      <Settings2 size={12} /> Configurar
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">Quer propor uma nova integração? Fale no chat interno (S8b).</p>
      </div>
    </div>
  );
}
