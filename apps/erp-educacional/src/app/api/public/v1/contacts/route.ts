/**
 * GET  /api/public/v1/contacts       — lista (scope: contacts:read)
 * POST /api/public/v1/contacts       — cria (scope: contacts:write)
 */

import { NextResponse, type NextRequest } from "next/server";
import { withPublicApiKey } from "@/lib/atendimento/public-api-auth";
import { hasScope } from "@/lib/atendimento/api-key";

export const GET = withPublicApiKey("contacts:read", async (req: NextRequest, ctx) => {
  const params = req.nextUrl.searchParams;
  const limit = Math.min(Number(params.get("limit") ?? 50), 200);
  const offset = Math.max(Number(params.get("offset") ?? 0), 0);
  const phone = params.get("phone_number");

  let q = ctx.supabase
    .from("atendimento_contacts")
    .select("id, name, phone_number, email, additional_attributes, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (phone) q = q.eq("phone_number", phone);

  const { data, count, error } = await q;
  if (error) return NextResponse.json({ error: "query_failed", detail: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [], total: count ?? 0, limit, offset });
});

export const POST = withPublicApiKey("contacts:write", async (req: NextRequest, ctx) => {
  if (!hasScope(ctx.key, "contacts:write")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    phone_number?: string;
    email?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    additional_attributes?: Record<string, any>;
  } | null;

  if (!body?.name || (!body.phone_number && !body.email)) {
    return NextResponse.json(
      { error: "bad_request", detail: "Fields 'name' and ('phone_number' or 'email') required" },
      { status: 400 },
    );
  }

  const { data, error } = await ctx.supabase
    .from("atendimento_contacts")
    .insert({
      name: body.name,
      phone_number: body.phone_number ?? null,
      email: body.email ?? null,
      additional_attributes: {
        source: "public_api",
        ...(body.additional_attributes ?? {}),
      },
    })
    .select("id, name, phone_number, email, created_at")
    .single();

  if (error) return NextResponse.json({ error: "insert_failed", detail: error.message }, { status: 500 });
  return NextResponse.json({ contact: data }, { status: 201 });
});
