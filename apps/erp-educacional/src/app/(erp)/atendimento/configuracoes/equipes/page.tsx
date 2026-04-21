"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, UsersRound, X as XIcon } from "lucide-react";

type Agent = { id: string; name: string; email: string };
type Member = { agent_id: string; joined_at: string; atendimento_agents: Agent | null };
type Team = {
  id: string;
  name: string;
  description: string | null;
  color_hex: string | null;
};
type TeamDetail = { team: Team; members: Member[] };

async function jsonFetch<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.erro ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

const COLOR_OPTIONS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#64748B"];

export default function EquipesPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [t, a] = await Promise.all([
        jsonFetch<{ teams: Team[] }>("/api/atendimento/teams"),
        jsonFetch<{ users: Agent[] }>("/api/atendimento/users"),
      ]);
      setTeams(t.teams);
      setAgents(a.users);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Equipes</h2>
          <p className="text-sm text-gray-500">
            Organize agents por time. Uso futuro: filtros Kanban por equipe, relatórios segmentados.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Plus size={16} /> Nova equipe
        </button>
      </div>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Carregando...</div>
      ) : teams.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <UsersRound size={32} className="mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-500">Nenhuma equipe criada ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => (
            <TeamCard key={t.id} team={t} onClick={() => setEditing(t)} />
          ))}
        </div>
      )}

      {showCreate && (
        <TeamModal
          agents={agents}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            void loadAll();
          }}
        />
      )}

      {editing && (
        <TeamModal
          team={editing}
          agents={agents}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void loadAll();
          }}
        />
      )}
    </div>
  );
}

function TeamCard({ team, onClick }: { team: Team; onClick: () => void }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    jsonFetch<TeamDetail>(`/api/atendimento/teams/${team.id}`)
      .then((body) => {
        if (!cancelled) setCount(body.members.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [team.id]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 text-left hover:border-gray-300 hover:shadow-sm transition"
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ backgroundColor: team.color_hex ?? "#94A3B8" }}
        />
        <span className="font-semibold text-gray-900">{team.name}</span>
      </div>
      <p className="text-sm text-gray-500">{team.description ?? "Sem descrição"}</p>
      <div className="text-xs text-gray-400">
        {count === null ? "..." : `${count} membro(s)`}
      </div>
    </button>
  );
}

function TeamModal({
  team,
  agents,
  onClose,
  onSaved,
}: {
  team?: Team;
  agents: Agent[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!team;
  const [name, setName] = useState(team?.name ?? "");
  const [description, setDescription] = useState(team?.description ?? "");
  const [colorHex, setColorHex] = useState(team?.color_hex ?? COLOR_OPTIONS[0]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Carrega membros se edit
  useEffect(() => {
    if (!isEdit || !team) return;
    jsonFetch<TeamDetail>(`/api/atendimento/teams/${team.id}`)
      .then((body) => {
        setSelectedAgentIds(new Set(body.members.map((m) => m.agent_id)));
      })
      .catch((e) => setErr((e as Error).message));
  }, [isEdit, team]);

  const toggleAgent = (id: string) => {
    setSelectedAgentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      let teamId = team?.id;
      if (isEdit && team) {
        await jsonFetch(`/api/atendimento/teams/${team.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name, description, color_hex: colorHex }),
        });
      } else {
        const body = await jsonFetch<{ team: Team }>("/api/atendimento/teams", {
          method: "POST",
          body: JSON.stringify({ name, description, color_hex: colorHex }),
        });
        teamId = body.team.id;
      }

      if (!teamId) throw new Error("Erro ao criar equipe.");

      // Diff de membros: carrega estado atual e aplica add/remove
      if (isEdit) {
        const current = await jsonFetch<TeamDetail>(`/api/atendimento/teams/${teamId}`);
        const currentIds = new Set(current.members.map((m) => m.agent_id));
        const toAdd = [...selectedAgentIds].filter((id) => !currentIds.has(id));
        const toRemove = [...currentIds].filter((id) => !selectedAgentIds.has(id));

        if (toAdd.length) {
          await jsonFetch(`/api/atendimento/teams/${teamId}/members`, {
            method: "POST",
            body: JSON.stringify({ agent_ids: toAdd }),
          });
        }
        for (const id of toRemove) {
          await jsonFetch(`/api/atendimento/teams/${teamId}/members?agent_id=${id}`, {
            method: "DELETE",
          });
        }
      } else if (selectedAgentIds.size > 0) {
        await jsonFetch(`/api/atendimento/teams/${teamId}/members`, {
          method: "POST",
          body: JSON.stringify({ agent_ids: [...selectedAgentIds] }),
        });
      }

      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!team) return;
    if (!confirm(`Excluir a equipe "${team.name}"?`)) return;
    setSaving(true);
    setErr(null);
    try {
      await jsonFetch(`/api/atendimento/teams/${team.id}`, { method: "DELETE" });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form onSubmit={save} className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEdit ? "Editar equipe" : "Nova equipe"}
          </h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
            <XIcon size={18} />
          </button>
        </div>

        {err && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            {err}
          </div>
        )}

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Nome *</span>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Ex: Secretaria"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Descrição</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <div>
            <span className="text-sm font-medium text-gray-700">Cor</span>
            <div className="mt-1 flex items-center gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColorHex(c)}
                  className={`h-6 w-6 rounded-full border-2 ${colorHex === c ? "border-gray-900" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          <div>
            <span className="text-sm font-medium text-gray-700">
              Membros ({selectedAgentIds.size}/{agents.length})
            </span>
            <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200">
              {agents.length === 0 ? (
                <div className="p-3 text-sm text-gray-400">Nenhum agent cadastrado.</div>
              ) : (
                agents.map((a) => {
                  const on = selectedAgentIds.has(a.id);
                  return (
                    <label
                      key={a.id}
                      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleAgent(a.id)}
                        className="rounded border-gray-300"
                      />
                      <div className="flex-1">
                        <div className="text-sm text-gray-900">{a.name}</div>
                        <div className="text-xs text-gray-500">{a.email}</div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          {isEdit && (
            <button
              type="button"
              onClick={remove}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 size={14} /> Excluir
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || name.trim().length < 2}
              className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
