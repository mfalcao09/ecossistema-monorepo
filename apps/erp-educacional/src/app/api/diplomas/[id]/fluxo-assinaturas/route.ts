import { NextRequest, NextResponse } from "next/server";
import { protegerRota } from "@/lib/security/api-guard";
import { createClient } from "@/lib/supabase/server";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

const STATUS_QUE_TRAVAM_EDICAO = new Set([
  "em_assinatura",
  "assinado",
  "aguardando_documentos",
  "aguardando_envio_registradora",
  "aguardando_registro",
  "registrado",
  "publicado",
  "cancelado",
]);

function extractDiplomaId(req: NextRequest): string | null {
  const segments = new URL(req.url).pathname.split("/");
  const idx = segments.indexOf("diplomas");
  return idx >= 0 ? (segments[idx + 1] ?? null) : null;
}

export async function GET(req: NextRequest) {
  const handler = protegerRota(async (request) => {
    const diplomaId = extractDiplomaId(request as NextRequest);
    if (!diplomaId) {
      return NextResponse.json(
        { error: "diploma_id ausente" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("fluxo_assinaturas")
      .select(
        "*, assinantes(id, nome, cpf, email, cargo, outro_cargo, tipo_certificado)",
      )
      .eq("diploma_id", diplomaId)
      .order("ordem", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: sanitizarErro(error.message, 500) },
        { status: 500 },
      );
    }
    return NextResponse.json(data ?? []);
  });
  return handler(req);
}

export async function POST(req: NextRequest) {
  const handler = protegerRota(async (request) => {
    const diplomaId = extractDiplomaId(request as NextRequest);
    if (!diplomaId) {
      return NextResponse.json(
        { error: "diploma_id ausente" },
        { status: 400 },
      );
    }

    const body = await (request as NextRequest).json();
    const { assinante_id, ordem, papel, tipo_certificado } = body ?? {};

    if (!assinante_id || typeof assinante_id !== "string") {
      return NextResponse.json(
        { error: "assinante_id obrigatório" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data: diploma, error: errDip } = await supabase
      .from("diplomas")
      .select("id, status")
      .eq("id", diplomaId)
      .single();

    if (errDip || !diploma) {
      return NextResponse.json(
        {
          error: sanitizarErro(
            errDip?.message || "Diploma não encontrado",
            404,
          ),
        },
        { status: 404 },
      );
    }

    if (STATUS_QUE_TRAVAM_EDICAO.has(diploma.status)) {
      return NextResponse.json(
        { error: `Fluxo bloqueado para edição (status: ${diploma.status})` },
        { status: 409 },
      );
    }

    let ordemFinal = ordem;
    if (ordemFinal == null) {
      const { data: maxRow } = await supabase
        .from("fluxo_assinaturas")
        .select("ordem")
        .eq("diploma_id", diplomaId)
        .order("ordem", { ascending: false })
        .limit(1)
        .maybeSingle();
      ordemFinal = (maxRow?.ordem ?? 0) + 1;
    }

    const { data, error } = await supabase
      .from("fluxo_assinaturas")
      .insert({
        diploma_id: diplomaId,
        assinante_id,
        ordem: ordemFinal,
        papel: papel ?? "emissora",
        tipo_certificado: tipo_certificado ?? null,
        status: "pendente",
      })
      .select(
        "*, assinantes(id, nome, cpf, email, cargo, outro_cargo, tipo_certificado)",
      )
      .single();

    if (error) {
      return NextResponse.json(
        { error: sanitizarErro(error.message, 500) },
        { status: 500 },
      );
    }

    return NextResponse.json(data, { status: 201 });
  });
  return handler(req);
}
