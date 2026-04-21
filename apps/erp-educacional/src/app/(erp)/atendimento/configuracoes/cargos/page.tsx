"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Lock, Plus, Shield, Trash2, Copy, X as XIcon } from "lucide-react";
import {
  PermissionMatrix,
  type PermissionEntry,
} from "@/components/atendimento/permissions/PermissionMatrix";
import {
  PERMISSION_MODULES,
  type PermissionAction,
  type PermissionModule,
} from "@/lib/atendimento/permissions-constants";

type Role = {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

type PermissionRow = {
  module: PermissionModule;
  action: PermissionAction;
  granted: boolean;
};

type PermissionMap = Record<string, boolean>;

function permsToMap(rows: PermissionRow[]): PermissionMap {
  const map: PermissionMap = {};
  for (const mod of PERMISSION_MODULES) {
    for (const act of mod.actions) {
      map[`${mod.slug}::${act}`] = false;
    }
  }
  for (const r of rows) map[`${r.module}::${r.action}`] = !!r.granted;
  return map;
}

async function jsonFetch<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T> {
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

export default function CargosPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const body = await jsonFetch<{ roles: Role[] }>("/api/atendimento/roles");
      setRoles(body.roles);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedId) ?? null,
    [roles, selectedId],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Cargos</h2>
          <p className="text-sm text-gray-500">
            3 presets do sistema + cargos customizados. Paridade Nexvy (15
            módulos × 5 ações).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Plus size={16} /> Novo cargo
        </button>
      </div>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Carregando cargos...</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 text-left hover:border-gray-300 hover:shadow-sm transition"
            >
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-gray-400" />
                <span className="font-semibold text-gray-900">{r.name}</span>
                {r.is_system && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    <Lock size={10} /> preset
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {r.description ?? "Sem descrição"}
              </p>
            </button>
          ))}
        </div>
      )}

      {selectedRole && (
        <RoleDrawer
          role={selectedRole}
          roles={roles}
          onClose={() => setSelectedId(null)}
          onSaved={() => void loadRoles()}
        />
      )}

      {showCreate && (
        <CreateRoleModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            setSelectedId(id);
            void loadRoles();
          }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// RoleDrawer — editor de cargo + matrix
// ──────────────────────────────────────────────────────────────
function RoleDrawer({
  role,
  roles,
  onClose,
  onSaved,
}: {
  role: Role;
  roles: Role[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? "");
  const [perms, setPerms] = useState<PermissionMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setName(role.name);
    setDescription(role.description ?? "");
  }, [role]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    jsonFetch<{ permissions: PermissionRow[] }>(
      `/api/atendimento/roles/${role.id}/permissions`,
    )
      .then((body) => {
        if (!cancelled) setPerms(permsToMap(body.permissions));
      })
      .catch((e) => {
        if (!cancelled) setErr((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [role.id]);

  const onCellChange = useCallback((entry: PermissionEntry) => {
    setPerms((prev) => ({
      ...prev,
      [`${entry.module}::${entry.action}`]: entry.granted,
    }));
  }, []);

  const onToggleModule = useCallback(
    (module: PermissionModule, granted: boolean) => {
      const mod = PERMISSION_MODULES.find((m) => m.slug === module);
      if (!mod) return;
      setPerms((prev) => {
        const next = { ...prev };
        for (const act of mod.actions) next[`${module}::${act}`] = granted;
        return next;
      });
    },
    [],
  );

  const onCopyFrom = useCallback(async (sourceId: string) => {
    try {
      const body = await jsonFetch<{ permissions: PermissionRow[] }>(
        `/api/atendimento/roles/${sourceId}/permissions`,
      );
      setPerms(permsToMap(body.permissions));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      // Atualiza nome/desc se cargo custom
      if (!role.is_system) {
        await jsonFetch(`/api/atendimento/roles/${role.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name, description }),
        });

        // Monta diff simples: todos os toggles como changes
        const changes: PermissionRow[] = [];
        for (const mod of PERMISSION_MODULES) {
          for (const act of mod.actions) {
            changes.push({
              module: mod.slug,
              action: act,
              granted: perms[`${mod.slug}::${act}`] === true,
            });
          }
        }

        await jsonFetch(`/api/atendimento/roles/${role.id}/permissions`, {
          method: "PATCH",
          body: JSON.stringify({ changes }),
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!confirm(`Excluir o cargo "${role.name}"? Essa ação é irreversível.`))
      return;
    setSaving(true);
    setErr(null);
    try {
      await jsonFetch(`/api/atendimento/roles/${role.id}`, {
        method: "DELETE",
      });
      onSaved();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <aside className="flex w-full max-w-4xl flex-col bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {role.name}
              </h3>
              {role.is_system && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  <Lock size={10} /> preset — permissões não editáveis
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">{role.id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <XIcon size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {err && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {err}
            </div>
          )}

          {!role.is_system && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-gray-700">Nome do cargo</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-gray-700">Descrição</span>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                  placeholder="Ex: atendente do time de Secretaria"
                />
              </label>
            </div>
          )}

          {!role.is_system && (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-gray-50 p-3">
              <Copy size={14} className="text-gray-400" />
              <span className="text-xs text-gray-600">
                Copiar permissões de outro cargo:
              </span>
              {roles
                .filter((r) => r.id !== role.id)
                .map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onCopyFrom(r.id)}
                    className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-700 hover:border-gray-300"
                  >
                    {r.name}
                  </button>
                ))}
            </div>
          )}

          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-900">
              Permissões
            </h4>
            {loading ? (
              <div className="text-sm text-gray-500">Carregando matrix...</div>
            ) : (
              <PermissionMatrix
                value={perms}
                onChange={onCellChange}
                onToggleModule={onToggleModule}
                readOnly={role.is_system}
              />
            )}
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-3">
          {!role.is_system && (
            <button
              type="button"
              onClick={onDelete}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 size={14} /> Excluir cargo
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
            {!role.is_system && (
              <button
                type="button"
                onClick={save}
                disabled={saving || loading}
                className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            )}
          </div>
        </footer>
      </aside>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// CreateRoleModal — criar novo cargo custom
// ──────────────────────────────────────────────────────────────
function CreateRoleModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const body = await jsonFetch<{ role: Role }>("/api/atendimento/roles", {
        method: "POST",
        body: JSON.stringify({ name, description }),
      });
      onCreated(body.role.id);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
      >
        <h3 className="text-lg font-semibold text-gray-900">Novo cargo</h3>
        <p className="mt-1 text-sm text-gray-500">
          Crie um cargo custom. Você poderá configurar as permissões logo após
          salvar.
        </p>

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
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
              placeholder="Ex: Atendente Secretaria"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Descrição</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            />
          </label>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
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
            {saving ? "Criando..." : "Criar cargo"}
          </button>
        </div>
      </form>
    </div>
  );
}
