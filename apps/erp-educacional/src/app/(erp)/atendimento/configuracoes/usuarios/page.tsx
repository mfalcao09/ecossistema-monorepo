"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail, Plus, ShieldOff, UserPlus, X as XIcon, Copy, Check } from "lucide-react";

type TeamRef = { id: string; name: string; color_hex: string | null };
type Role = { id: string; name: string; is_system: boolean };
type User = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  avatar_url: string | null;
  availability_status: "online" | "busy" | "offline";
  role_id: string | null;
  role: { id: string; name: string; is_system: boolean } | null;
  teams: TeamRef[];
};
type Invite = {
  id: string;
  email: string;
  role_id: string;
  team_id: string | null;
  expires_at: string;
  created_at: string;
};

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

const STATUS_COLOR: Record<User["availability_status"], string> = {
  online: "bg-emerald-500",
  busy: "bg-amber-500",
  offline: "bg-gray-300",
};

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [teams, setTeams] = useState<TeamRef[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [u, r, t, i] = await Promise.all([
        jsonFetch<{ users: User[] }>("/api/atendimento/users"),
        jsonFetch<{ roles: Role[] }>("/api/atendimento/roles"),
        jsonFetch<{ teams: TeamRef[] }>("/api/atendimento/teams"),
        jsonFetch<{ invites: Invite[] }>("/api/atendimento/invites"),
      ]);
      setUsers(u.users);
      setRoles(r.roles);
      setTeams(t.teams);
      setInvites(i.invites);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const changeRole = async (userId: string, roleId: string) => {
    try {
      await jsonFetch(`/api/atendimento/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role_id: roleId || null }),
      });
      await loadAll();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const disableUser = async (userId: string, name: string) => {
    if (!confirm(`Desativar ${name}? O histórico é mantido, mas o login é desvinculado.`)) return;
    try {
      await jsonFetch(`/api/atendimento/users/${userId}`, { method: "DELETE" });
      await loadAll();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    if (!confirm("Revogar este convite?")) return;
    try {
      await jsonFetch(`/api/atendimento/invites/${inviteId}`, { method: "DELETE" });
      await loadAll();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Usuários</h2>
          <p className="text-sm text-gray-500">
            Agents do módulo Atendimento. Status online/offline atualizado em tempo real.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          <UserPlus size={16} /> Convidar usuário
        </button>
      </div>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Carregando...</div>
      ) : (
        <>
          {invites.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Convites pendentes</h3>
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Email</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Cargo</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Equipe</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Expira em</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invites.map((inv) => {
                      const role = roles.find((r) => r.id === inv.role_id);
                      const team = inv.team_id ? teams.find((t) => t.id === inv.team_id) : null;
                      const expiresAt = new Date(inv.expires_at);
                      return (
                        <tr key={inv.id}>
                          <td className="px-4 py-2 text-gray-900">{inv.email}</td>
                          <td className="px-4 py-2 text-gray-700">{role?.name ?? "—"}</td>
                          <td className="px-4 py-2 text-gray-700">{team?.name ?? "—"}</td>
                          <td className="px-4 py-2 text-gray-500">
                            {expiresAt.toLocaleDateString("pt-BR")}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => revokeInvite(inv.id)}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Revogar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Usuários ativos ({users.length})</h3>
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Usuário</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Cargo</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Equipes</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          {u.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.avatar_url} alt="" className="h-7 w-7 rounded-full" />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-600">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-gray-900">{u.name}</div>
                            <div className="text-xs text-gray-500">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={u.role_id ?? ""}
                          onChange={(e) => changeRole(u.id, e.target.value)}
                          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm"
                        >
                          <option value="">— sem cargo —</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {u.teams.length === 0 ? (
                            <span className="text-xs text-gray-400">—</span>
                          ) : (
                            u.teams.map((t) => (
                              <span
                                key={t.id}
                                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                                style={t.color_hex ? { backgroundColor: `${t.color_hex}20`, color: t.color_hex } : undefined}
                              >
                                {t.name}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-700">
                          <span className={`h-2 w-2 rounded-full ${STATUS_COLOR[u.availability_status]}`} />
                          {u.availability_status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {u.user_id && (
                          <button
                            type="button"
                            onClick={() => disableUser(u.id, u.name)}
                            className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                            title="Desativar usuário (soft disable)"
                          >
                            <ShieldOff size={12} /> desativar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {showInvite && (
        <InviteModal
          roles={roles}
          teams={teams}
          onClose={() => setShowInvite(false)}
          onCreated={() => {
            setShowInvite(false);
            void loadAll();
          }}
        />
      )}
    </div>
  );
}

function InviteModal({
  roles,
  teams,
  onClose,
  onCreated,
}: {
  roles: Role[];
  teams: TeamRef[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [acceptUrl, setAcceptUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const defaultRoleId = useMemo(() => {
    const atendente = roles.find((r) => r.is_system && r.name === "Atendente");
    return atendente?.id ?? roles[0]?.id ?? "";
  }, [roles]);

  useEffect(() => {
    if (!roleId && defaultRoleId) setRoleId(defaultRoleId);
  }, [defaultRoleId, roleId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const body = await jsonFetch<{ accept_url: string }>("/api/atendimento/invites", {
        method: "POST",
        body: JSON.stringify({
          email,
          role_id: roleId,
          team_id: teamId || null,
        }),
      });
      setAcceptUrl(body.accept_url);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!acceptUrl) return;
    await navigator.clipboard.writeText(acceptUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Convidar usuário</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
            <XIcon size={18} />
          </button>
        </div>

        {!acceptUrl ? (
          <form onSubmit={submit} className="mt-4 space-y-4">
            {err && (
              <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{err}</div>
            )}

            <label className="block">
              <span className="text-sm font-medium text-gray-700">Email *</span>
              <div className="mt-1 flex rounded-md border border-gray-300 focus-within:border-gray-900">
                <span className="flex items-center pl-3 text-gray-400">
                  <Mail size={14} />
                </span>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 rounded-md px-2 py-2 text-sm focus:outline-none"
                  placeholder="fabiano@ficcassilandia.com.br"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">Cargo *</span>
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Equipe <span className="text-gray-400">(opcional)</span>
              </span>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">— sem equipe —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !email || !roleId}
                className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? "Gerando..." : "Gerar convite"}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-700">
              Convite gerado. Copie o link e envie por email/WhatsApp para <strong>{email}</strong>:
            </p>
            <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-2">
              <code className="flex-1 truncate text-xs text-gray-700">{acceptUrl}</code>
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
              >
                {copied ? (
                  <>
                    <Check size={12} /> copiado
                  </>
                ) : (
                  <>
                    <Copy size={12} /> copiar
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Expira em 7 dias. Você pode revogar manualmente na lista de convites pendentes.
            </p>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onCreated}
                className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
              >
                Ok, fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
