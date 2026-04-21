import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";
import {
  validateSlug,
  validateNumbers,
  type DistributionMode,
} from "@/lib/atendimento/link-redirects";

type Params = { params: Promise<{ id: string }> };

/**
 * GET    /api/atendimento/link-redirects/[id]  — detalhe
 * PATCH  /api/atendimento/link-redirects/[id]  — editar
 * DELETE /api/atendimento/link-redirects/[id]  — deletar
 */

export const GET = withPermission("link_redirects", "view")(async (_req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;

  const { data, error } = await ctx.supabase
    .from("link_redirects")
    .select("id, slug, name, greeting, numbers, distribution, schedule_config, cursor_idx, total_clicks, active, created_by, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ erro: "Link não encontrado." }, { status: 404 });

  return NextResponse.json({ link: data });
});

export const PATCH = withPermission("link_redirects", "edit")(async (req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as Partial<{
    slug: string;
    name: string;
    greeting: string;
    numbers: unknown;
    distribution: DistributionMode;
    schedule_config: Record<string, unknown>;
    active: boolean;
  }> | null;
  if (!body) return NextResponse.json({ erro: "Body inválido." }, { status: 400 });

  const patch: Record<string, unknown> = {};

  if (typeof body.slug === "string") {
    const err = validateSlug(body.slug);
    if (err) return NextResponse.json({ erro: err }, { status: 400 });
    patch.slug = body.slug.trim();
  }
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.greeting === "string") patch.greeting = body.greeting.trim() || null;

  if (body.numbers !== undefined) {
    const v = validateNumbers(body.numbers);
    if (!v.ok) return NextResponse.json({ erro: v.erro }, { status: 400 });
    patch.numbers = v.value;
  }

  if (typeof body.distribution === "string") {
    if (!["sequential", "random", "ordered", "by_hour"].includes(body.distribution)) {
      return NextResponse.json({ erro: "distribution inválido." }, { status: 400 });
    }
    patch.distribution = body.distribution;
  }

  if (body.schedule_config !== undefined) patch.schedule_config = body.schedule_config;
  if (typeof body.active === "boolean") patch.active = body.active;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ erro: "Nada a atualizar." }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from("link_redirects")
    .update(patch)
    .eq("id", id)
    .select("id, slug, name, greeting, numbers, distribution, schedule_config, cursor_idx, total_clicks, active, updated_at")
    .single();

  if (error) {
    return NextResponse.json(
      { erro: error.code === "23505" ? "Slug em uso." : error.message },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }
  return NextResponse.json({ link: data });
});

export const DELETE = withPermission("link_redirects", "delete")(async (_req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;

  const { error } = await ctx.supabase.from("link_redirects").delete().eq("id", id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
