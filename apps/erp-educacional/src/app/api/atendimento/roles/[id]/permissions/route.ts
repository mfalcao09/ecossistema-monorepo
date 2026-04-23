import { NextResponse, type NextRequest } from "next/server";
import {
  PERMISSION_MODULES,
  withPermission,
  type PermissionAction,
  type PermissionModule,
} from "@/lib/atendimento/permissions";

type Params = { params: Promise<{ id: string }> };

const VALID_MODULES = new Set<string>(PERMISSION_MODULES.map((m) => m.slug));
const VALID_ACTIONS: PermissionAction[] = ["view", "create", "edit", "delete", "export"];
const VALID_ACTION_SET = new Set<string>(VALID_ACTIONS);

/**
 * GET   /api/atendimento/roles/[id]/permissions
 *   → { permissions: [{ module, action, granted }, ...] }
 *
 * PATCH /api/atendimento/roles/[id]/permissions
 *   body: { changes: [{ module, action, granted }, ...] }
 *   → grant/revoke em lote via upsert
 *
 *   Observação: em cargos is_system, a alteração é bloqueada 403.
 */

export const GET = withPermission("roles", "view")(async (
  _req: NextRequest,
  ctx,
) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;

  const { data, error } = await ctx.supabase
    .from("role_permissions")
    .select("module, action, granted")
    .eq("role_id", id);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ permissions: data ?? [] });
});

export const PATCH = withPermission("roles", "edit")(async (
  req: NextRequest,
  ctx,
) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as {
    changes?: Array<{ module: string; action: string; granted: boolean }>;
  } | null;

  if (!body?.changes?.length) {
    return NextResponse.json(
      { erro: "Campo 'changes' é obrigatório (array não-vazio)." },
      { status: 400 },
    );
  }

  // Valida shape
  for (const c of body.changes) {
    if (!VALID_MODULES.has(c.module)) {
      return NextResponse.json({ erro: `Módulo inválido: ${c.module}` }, { status: 400 });
    }
    if (!VALID_ACTION_SET.has(c.action)) {
      return NextResponse.json({ erro: `Ação inválida: ${c.action}` }, { status: 400 });
    }
    if (typeof c.granted !== "boolean") {
      return NextResponse.json({ erro: "Campo 'granted' deve ser boolean." }, { status: 400 });
    }
  }

  // Bloqueia edit de matrix em cargo system
  const { data: role } = await ctx.supabase
    .from("agent_roles")
    .select("is_system")
    .eq("id", id)
    .maybeSingle();

  if (!role) return NextResponse.json({ erro: "Cargo não encontrado." }, { status: 404 });
  if (role.is_system) {
    return NextResponse.json(
      { erro: "Permissões de cargos preset não podem ser alteradas. Crie um cargo custom copiando deste." },
      { status: 403 },
    );
  }

  const rows = body.changes.map((c) => ({
    role_id: id,
    module: c.module as PermissionModule,
    action: c.action as PermissionAction,
    granted: c.granted,
  }));

  const { error } = await ctx.supabase
    .from("role_permissions")
    .upsert(rows, { onConflict: "role_id,module,action" });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated: rows.length });
});
