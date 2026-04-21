import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  loadPermissionsForUser,
  PERMISSION_MODULES,
  type PermissionAction,
  type PermissionModule,
} from "@/lib/atendimento/permissions";

/**
 * GET /api/atendimento/me/permissions
 *
 * Retorna o mapa completo de permissões do usuário autenticado no formato
 * `{ "module::action": boolean }`. Consumido por `useCan` no client.
 *
 * Resposta 200:
 *   {
 *     agentId: string | null,
 *     roleId:  string | null,
 *     permissions: Record<"module::action", boolean>
 *   }
 *
 * Resposta 401 se não autenticado.
 */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  const { data: agent } = await supabase
    .from("atendimento_agents")
    .select("id, role_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const permsMap = await loadPermissionsForUser(supabase, user.id);

  // Garante que todas as (module, action) canônicas aparecem no mapa
  // (false por padrão). Assim o frontend não precisa saber a taxonomia.
  const permissions: Record<string, boolean> = {};
  for (const mod of PERMISSION_MODULES) {
    for (const act of mod.actions) {
      const key = `${mod.slug}::${act}`;
      permissions[key] = permsMap.get(key) === true;
    }
  }

  return NextResponse.json({
    agentId: agent?.id ?? null,
    roleId: agent?.role_id ?? null,
    permissions,
  });
}
