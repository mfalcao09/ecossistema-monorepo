import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * Resolução em batch de IDs de usuários para nomes legíveis (Sessão 2026-04-26).
 *
 * Endpoints de auditoria (/historico, /snapshot, /auditorias, etc.) gravam
 * `usuario_id` (UUID). Para a UI exibir "consolidado por João" em vez de
 * "consolidado por f762469d…", este helper busca nomes em `user_profiles`
 * uma vez por request com SELECT IN (eficiente).
 *
 * Uso:
 *   const mapa = await resolverNomesUsuarios([id1, id2, id3]);
 *   const nome = mapa.get(id1)?.nome ?? "Sistema";
 *
 * Fallback:
 *   - Se ID não existe em user_profiles → não entra no Map (caller usa default)
 *   - Se display_name vazio → usa full_name
 *   - Se ambos vazios → usa primeiros 8 chars do UUID com prefixo
 */

export interface UsuarioResolvido {
  id: string;
  nome: string;
  role: string | null;
}

export async function resolverNomesUsuarios(
  ids: Array<string | null | undefined>,
): Promise<Map<string, UsuarioResolvido>> {
  const idsValidos = Array.from(
    new Set(
      ids.filter((x): x is string => typeof x === "string" && x.length > 0),
    ),
  );
  if (idsValidos.length === 0) return new Map();

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await admin
    .from("user_profiles")
    .select("id, full_name, display_name, role")
    .in("id", idsValidos);

  if (error) {
    // Falha de lookup não deve quebrar o endpoint principal — UI mostra ID.
    console.warn("[resolverNomesUsuarios] erro:", error.message);
    return new Map();
  }

  const map = new Map<string, UsuarioResolvido>();
  for (const u of (data ?? []) as Array<{
    id: string;
    full_name: string | null;
    display_name: string | null;
    role: string | null;
  }>) {
    const nome =
      (u.display_name?.trim() || u.full_name?.trim()) ??
      `Usuário ${u.id.slice(0, 8)}…`;
    map.set(u.id, {
      id: u.id,
      nome,
      role: u.role,
    });
  }
  return map;
}

/** Helper: nome ou fallback "Sistema" se id é null */
export function nomeOuSistema(
  mapa: Map<string, UsuarioResolvido>,
  id: string | null | undefined,
): string {
  if (!id) return "Sistema";
  return mapa.get(id)?.nome ?? `Usuário ${id.slice(0, 8)}…`;
}
