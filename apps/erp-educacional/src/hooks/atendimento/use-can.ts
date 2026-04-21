"use client";

/**
 * useCan — Hook client-side para checagem de permissão granular do Atendimento.
 *
 * Usa fetch lazy na API `/api/atendimento/me/permissions` + cache global
 * por sessão do usuário. Expira em 5 min (refresh se mudar cargo).
 *
 * Uso:
 *   const canEditCrm = useCan("pipelines", "edit");
 *   if (!canEditCrm) return null;
 *   // ou: <Button disabled={!canEditCrm}>...</Button>
 */

import { useCallback, useEffect, useState } from "react";
import type {
  PermissionAction,
  PermissionModule,
} from "@/lib/atendimento/permissions";

type PermissionMap = Record<string, boolean>;

const CACHE_TTL_MS = 5 * 60 * 1000;
let globalCache: { map: PermissionMap | null; fetchedAt: number; inFlight: Promise<PermissionMap> | null } = {
  map: null,
  fetchedAt: 0,
  inFlight: null,
};

async function fetchPermissions(): Promise<PermissionMap> {
  const res = await fetch("/api/atendimento/me/permissions", {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    // Fail-closed — sem permissões se erro
    return {};
  }
  const body = (await res.json()) as { permissions?: PermissionMap };
  return body.permissions ?? {};
}

function getOrFetch(): Promise<PermissionMap> {
  const now = Date.now();
  if (globalCache.map && now - globalCache.fetchedAt < CACHE_TTL_MS) {
    return Promise.resolve(globalCache.map);
  }
  if (globalCache.inFlight) return globalCache.inFlight;

  const promise = fetchPermissions().then((map) => {
    globalCache = { map, fetchedAt: Date.now(), inFlight: null };
    return map;
  });
  globalCache.inFlight = promise;
  return promise;
}

export function invalidatePermissionsCache(): void {
  globalCache = { map: null, fetchedAt: 0, inFlight: null };
}

/**
 * Retorna boolean | null:
 *   - null  = ainda carregando
 *   - false = negado
 *   - true  = permitido
 *
 * Uso simples: `const canEdit = useCan("pipelines", "edit") ?? false;`
 */
export function useCan(
  module: PermissionModule,
  action: PermissionAction,
): boolean | null {
  const [perms, setPerms] = useState<PermissionMap | null>(globalCache.map);

  useEffect(() => {
    let cancelled = false;
    getOrFetch().then((map) => {
      if (!cancelled) setPerms(map);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (perms === null) return null;
  const key = `${module}::${action}`;
  return perms[key] === true;
}

/** Variante sync quando o caller já carregou o mapa completo. */
export function useAllPermissions(): { permissions: PermissionMap | null; refresh: () => void } {
  const [perms, setPerms] = useState<PermissionMap | null>(globalCache.map);

  const refresh = useCallback(() => {
    invalidatePermissionsCache();
    getOrFetch().then(setPerms);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getOrFetch().then((map) => {
      if (!cancelled) setPerms(map);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { permissions: perms, refresh };
}
