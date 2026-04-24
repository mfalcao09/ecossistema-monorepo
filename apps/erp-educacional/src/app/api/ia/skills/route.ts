/**
 * API CRUD — ia_skills
 * GET    /api/ia/skills         → lista todas as skills
 * POST   /api/ia/skills         → cria nova skill + indexa automaticamente no RAG
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { protegerRota } from "@/lib/security/api-guard";
import { indexarSkill } from "@/lib/ai/rag";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** Estima tokens de forma simples (1 token ≈ 4 chars em PT-BR) */
function estimarTokens(texto: string): number {
  return Math.ceil(texto.length / 4);
}

// ── GET: listar skills ──────────────────────────────────────────────────────
export const GET = protegerRota(
  async (_req: NextRequest) => {
    const admin = getAdminClient();

    const { data, error } = await admin
      .from("ia_skills")
      .select(
        `
      id, nome, slug, descricao, tipo, categoria,
      ativo, versao, tamanho_tokens, created_at, updated_at,
      ia_agente_skills ( agente_id, prioridade, modo )
    `,
      )
      .order("tipo", { ascending: true })
      .order("nome", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enriquecer com contagem de chunks indexados
    const ids = (data ?? []).map((s: { id: string }) => s.id);
    let chunksMap: Record<string, number> = {};

    if (ids.length > 0) {
      const { data: chunksData } = await admin
        .from("ia_skill_chunks")
        .select("skill_id")
        .in("skill_id", ids);

      if (chunksData) {
        for (const row of chunksData as Array<{ skill_id: string }>) {
          chunksMap[row.skill_id] = (chunksMap[row.skill_id] ?? 0) + 1;
        }
      }
    }

    const resultado = (data ?? []).map((skill: Record<string, unknown>) => ({
      ...skill,
      chunks_indexados: chunksMap[skill.id as string] ?? 0,
    }));

    return NextResponse.json(resultado);
  },
  { skipCSRF: true },
);

// ── POST: criar skill + indexar automaticamente ─────────────────────────────
export const POST = protegerRota(
  async (req: NextRequest, { userId }) => {
    const admin = getAdminClient();
    const body = await req.json();

    const { nome, slug, descricao, conteudo, tipo, categoria } = body;

    if (!nome || !slug || !conteudo) {
      return NextResponse.json(
        { error: "Campos obrigatórios: nome, slug, conteudo" },
        { status: 400 },
      );
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        {
          error: "Slug deve conter apenas letras minúsculas, números e hífens",
        },
        { status: 400 },
      );
    }

    const tamanho_tokens = estimarTokens(conteudo);

    const { data, error } = await admin
      .from("ia_skills")
      .insert({
        nome,
        slug,
        descricao: descricao || null,
        conteudo,
        tipo: tipo || "conhecimento",
        categoria: categoria || null,
        tamanho_tokens,
        criado_por: userId,
        versao: 1,
        ativo: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: `Já existe uma skill com o slug "${slug}"` },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Indexar automaticamente no RAG (best-effort: não falha o save se embedding falhar)
    let indexacao: { chunks_gerados: number; tokens_usados: number } | null =
      null;
    try {
      indexacao = await indexarSkill(data.id, nome, conteudo, 1);
      console.log(
        `[RAG] Skill "${nome}" indexada: ${indexacao.chunks_gerados} chunks`,
      );
    } catch (err) {
      console.error(`[RAG] Falha ao indexar skill "${nome}":`, err);
      // Continua — skill foi salva, indexação pode ser refeita depois
    }

    return NextResponse.json(
      { ...data, chunks_indexados: indexacao?.chunks_gerados ?? 0 },
      { status: 201 },
    );
  },
  { skipCSRF: true },
);
