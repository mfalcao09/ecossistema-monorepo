"use client";

import { useEffect, useState } from "react";
import { X, MessageSquare, Users, UsersRound } from "lucide-react";
import type { ChatAgent } from "./types";

interface TeamOption {
  id: string;
  name: string;
  color_hex: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (chatId: string) => void;
  myAgentId: string | null;
}

type Mode = "dm" | "group" | "team";

export default function NewChatModal({ open, onClose, onCreated, myAgentId }: Props) {
  const [mode, setMode] = useState<Mode>("dm");
  const [agents, setAgents] = useState<ChatAgent[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [q, setQ] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode("dm");
    setQ("");
    setSelectedAgents(new Set());
    setSelectedTeam("");
    setTitle("");
    setError(null);

    (async () => {
      try {
        const [agRes, tRes] = await Promise.all([
          fetch("/api/atendimento/team-chats/agents"),
          fetch("/api/atendimento/teams"),
        ]);
        if (agRes.ok) {
          const body = (await agRes.json()) as { agents?: ChatAgent[] };
          setAgents(body.agents ?? []);
        }
        if (tRes.ok) {
          const body = (await tRes.json()) as { teams?: TeamOption[] };
          setTeams(body.teams ?? []);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [open]);

  if (!open) return null;

  const filteredAgents = agents
    .filter((a) => a.id !== myAgentId)
    .filter((a) => {
      if (!q.trim()) return true;
      const needle = q.trim().toLowerCase();
      return a.name.toLowerCase().includes(needle) || a.email.toLowerCase().includes(needle);
    });

  const toggleAgent = (id: string) => {
    const next = new Set(selectedAgents);
    if (next.has(id)) next.delete(id);
    else {
      if (mode === "dm") next.clear();
      next.add(id);
    }
    setSelectedAgents(next);
  };

  const handleSubmit = async () => {
    setError(null);
    if (mode === "dm" && selectedAgents.size !== 1) {
      setError("Selecione 1 pessoa para iniciar DM.");
      return;
    }
    if (mode === "group") {
      if (selectedAgents.size < 1) {
        setError("Adicione ao menos 1 participante.");
        return;
      }
      if (title.trim().length < 2) {
        setError("Defina um título para o grupo.");
        return;
      }
    }
    if (mode === "team" && !selectedTeam) {
      setError("Selecione uma equipe.");
      return;
    }

    setSubmitting(true);
    try {
      const payload =
        mode === "team"
          ? { kind: "team", team_id: selectedTeam }
          : mode === "group"
          ? { kind: "group", title: title.trim(), member_agent_ids: Array.from(selectedAgents) }
          : { kind: "dm", member_agent_ids: Array.from(selectedAgents) };

      const res = await fetch("/api/atendimento/team-chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.erro ?? "Erro ao criar chat.");
        return;
      }
      onCreated(body.chat.id);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[85vh] flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">Nova conversa</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X size={16} />
          </button>
        </header>

        <div className="p-4 space-y-3 flex-1 overflow-y-auto">
          <div className="flex gap-2">
            {[
              { m: "dm" as const, Icon: MessageSquare, label: "DM" },
              { m: "group" as const, Icon: UsersRound, label: "Grupo" },
              { m: "team" as const, Icon: Users, label: "Time" },
            ].map(({ m, Icon, label }) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg border transition-colors ${
                  mode === m ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Icon size={16} />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>

          {mode === "team" ? (
            <div>
              <label className="text-xs font-semibold text-gray-700">Equipe</label>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-300"
              >
                <option value="">Selecione...</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                O chat inclui todos os membros da equipe automaticamente.
              </p>
            </div>
          ) : (
            <>
              {mode === "group" && (
                <div>
                  <label className="text-xs font-semibold text-gray-700">Título do grupo</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Comercial · Kauana"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-300"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-700">
                  {mode === "dm" ? "Conversar com" : "Adicionar participantes"}
                </label>
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por nome ou e-mail..."
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-300"
                />
                <div className="mt-2 max-h-64 overflow-y-auto border border-gray-100 rounded-lg">
                  {filteredAgents.length === 0 ? (
                    <p className="p-3 text-xs text-gray-400 text-center">Nenhum atendente.</p>
                  ) : (
                    filteredAgents.map((a) => {
                      const sel = selectedAgents.has(a.id);
                      return (
                        <button
                          key={a.id}
                          onClick={() => toggleAgent(a.id)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left border-b border-gray-50 last:border-0 ${
                            sel ? "bg-indigo-50" : "hover:bg-gray-50"
                          }`}
                        >
                          <input type={mode === "dm" ? "radio" : "checkbox"} checked={sel} readOnly />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{a.name}</p>
                            <p className="text-xs text-gray-500 truncate">{a.email}</p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}

          {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        </div>

        <footer className="p-3 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-1.5 text-sm bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 rounded-lg"
          >
            {submitting ? "Criando..." : "Criar"}
          </button>
        </footer>
      </div>
    </div>
  );
}
