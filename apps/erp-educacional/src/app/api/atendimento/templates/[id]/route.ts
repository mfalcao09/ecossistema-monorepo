/**
 * GET    /api/atendimento/templates/[id]  — detalhe
 * PATCH  /api/atendimento/templates/[id]  — editar local (só DRAFT)
 * DELETE /api/atendimento/templates/[id]  — soft: DRAFT deletado direto,
 *   Meta-synced marcado como DISABLED (não some no Meta).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

const patchSchema = z.object({
  name: z.string().min(1).max(512).optional(),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).optional(),
  language: z.string().optional(),
  components: z.array(z.record(z.any())).optional(),
});

async function requireUser() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("atendimento_whatsapp_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ template: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const admin = createAdminClient();
  // Só permite editar templates DRAFT (após submit ao Meta vira read-only)
  const { data: current } = await admin
    .from("atendimento_whatsapp_templates")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!current)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (current.status !== "DRAFT") {
    return NextResponse.json(
      {
        error: "immutable",
        message: "Templates já submetidos são imutáveis — duplique e edite",
      },
      { status: 409 },
    );
  }

  const updates = {
    ...parsed.data,
    ...(parsed.data.components
      ? {
          has_buttons: parsed.data.components.some(
            (c: { type?: string }) => c.type === "BUTTONS",
          ),
        }
      : {}),
  };

  const { data, error } = await admin
    .from("atendimento_whatsapp_templates")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const admin = createAdminClient();
  const { data: current } = await admin
    .from("atendimento_whatsapp_templates")
    .select("status, meta_template_id")
    .eq("id", id)
    .maybeSingle();
  if (!current)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (current.status === "DRAFT" && !current.meta_template_id) {
    const { error } = await admin
      .from("atendimento_whatsapp_templates")
      .delete()
      .eq("id", id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ deleted: true });
  }

  // Sync'd com Meta: marca como DISABLED localmente (Meta tem endpoint DELETE próprio)
  const { error } = await admin
    .from("atendimento_whatsapp_templates")
    .update({ status: "DISABLED" })
    .eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ disabled: true });
}
