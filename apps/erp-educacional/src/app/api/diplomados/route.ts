import { protegerRota } from "@/lib/security/api-guard";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarErro } from "@/lib/security/sanitize-error";
import { diplomadoSchema } from "@/lib/security/zod-schemas";
import { z } from "zod";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// Schema para filiações (opcional)
const filiacaoSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  nome_social: z.string().optional(),
  sexo: z.enum(["M", "F"]).optional(),
});

// GET - Listar diplomados com contagem de diplomas
export const GET = protegerRota(
  async (request, { userId, tenantId }) => {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const cpf = searchParams.get("cpf") || "";

    // Regra de negócio: esta tela exibe apenas diplomados com diploma publicado.
    // Filtra exclusivamente por status = 'publicado' (diploma disponível no portal público).
    let query = supabase
      .from("diplomados")
      .select(
        `
        *,
        filiacoes(*),
        diplomas!inner(id, status)
      `,
      )
      .in("diplomas.status", ["publicado"])
      .order("nome");

    if (search) {
      // CPF removido do search de texto para evitar exposição plaintext
      query = query.or(
        `nome.ilike.%${search}%,ra.ilike.%${search}%,email.ilike.%${search}%`,
      );
    }

    if (cpf) {
      const cpfLimpo = cpf.replace(/\D/g, "");
      try {
        const { hashCPF } = await import("@/lib/security/pii-encryption");
        const cpfHash = await hashCPF(cpfLimpo);
        query = query.eq("cpf_hash", cpfHash);
      } catch {
        // Fallback: RPCs PII não disponíveis ainda
        query = query.ilike("cpf", `%${cpfLimpo}%`);
      }
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: sanitizarErro(error.message, 500) },
        { status: 500 },
      );
    }

    return NextResponse.json(data);
  },
  { skipCSRF: true },
);

// POST - Criar novo diplomado com filiações
export const POST = protegerRota(async (request, { userId, tenantId }) => {
  const supabase = await createClient();
  const body = await request.json();

  const { filiacoes: filiacoesData, ...diplomadoData } = body;

  // Validação com Zod
  const parsed = diplomadoSchema.safeParse(diplomadoData);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Dados inválidos do diplomado",
        detalhes: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  // Normaliza CPF (remove formatação)
  let cleaned = parsed.data;
  if (cleaned.cpf) {
    cleaned = { ...cleaned, cpf: cleaned.cpf.replace(/\D/g, "") };
  }

  const { data: diplomado, error } = await supabase
    .from("diplomados")
    .insert(cleaned)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: sanitizarErro(error.message, 500) },
      { status: 500 },
    );
  }

  // Inserir filiações se fornecidas
  if (
    filiacoesData &&
    Array.isArray(filiacoesData) &&
    filiacoesData.length > 0
  ) {
    const filiacoesParaInserir = filiacoesData
      .map((f: unknown) => filiacaoSchema.safeParse(f))
      .filter((result) => result.success)
      .map((result, idx: number) => ({
        diplomado_id: diplomado.id,
        nome: result.data!.nome,
        nome_social: result.data!.nome_social || null,
        sexo: result.data!.sexo || null,
        ordem: idx + 1,
      }));

    if (filiacoesParaInserir.length > 0) {
      const { error: filiacaoError } = await supabase
        .from("filiacoes")
        .insert(filiacoesParaInserir);

      if (filiacaoError) {
        console.error("Erro ao inserir filiações:", filiacaoError.message);
      }
    }
  }

  return NextResponse.json(diplomado, { status: 201 });
});
