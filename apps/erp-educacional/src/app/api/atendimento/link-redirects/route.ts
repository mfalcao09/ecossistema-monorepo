import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";
import {
  validateSlug,
  validateNumbers,
  type DistributionMode,
} from "@/lib/atendimento/link-redirects";

interface CreateBody {
  slug: string;
  name: string;
  greeting?: string;
  numbers: unknown;
  distribution?: DistributionMode;
  schedule_config?: Record<string, unknown>;
  active?: boolean;
}

/**
 * GET  /api/atendimento/link-redirects
 * POST /api/atendimento/link-redirects
 */

export const GET = withPermission("link_redirects", "view")(async (_req: NextRequest, ctx) => {
  const { data, error } = await ctx.supabase
    .from("link_redirects")
    .select("id, slug, name, greeting, numbers, distribution, schedule_config, cursor_idx, total_clicks, active, created_by, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ links: data ?? [] });
});

export const POST = withPermission("link_redirects", "create")(async (req: NextRequest, ctx) => {
  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body) return NextResponse.json({ erro: "Body inválido." }, { status: 400 });
  if (!body.slug || !body.name) {
    return NextResponse.json({ erro: "slug e name obrigatórios." }, { status: 400 });
  }

  const slugErr = validateSlug(body.slug);
  if (slugErr) return NextResponse.json({ erro: slugErr }, { status: 400 });

  const numbersValidation = validateNumbers(body.numbers);
  if (!numbersValidation.ok) {
    return NextResponse.json({ erro: numbersValidation.erro }, { status: 400 });
  }

  const distribution: DistributionMode = body.distribution ?? "sequential";
  if (!["sequential", "random", "ordered", "by_hour"].includes(distribution)) {
    return NextResponse.json({ erro: "distribution inválido." }, { status: 400 });
  }

  const { data: agent } = await ctx.supabase
    .from("atendimento_agents")
    .select("id")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  const { data, error } = await ctx.supabase
    .from("link_redirects")
    .insert({
      slug: body.slug.trim(),
      name: body.name.trim(),
      greeting: body.greeting?.trim() || null,
      numbers: numbersValidation.value,
      distribution,
      schedule_config: body.schedule_config ?? {},
      active: body.active ?? true,
      created_by: agent?.id ?? null,
    })
    .select("id, slug, name, greeting, numbers, distribution, schedule_config, cursor_idx, total_clicks, active, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { erro: error.code === "23505" ? "Já existe link com esse slug." : error.message },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }

  return NextResponse.json({ link: data }, { status: 201 });
});
