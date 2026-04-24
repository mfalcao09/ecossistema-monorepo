import { verificarAuth } from "@/lib/security/api-guard";
import { validarCSRF } from "@/lib/security/csrf";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// Campos que não aceitam string vazia no banco
const DATE_FIELDS = [
  "data_autorizacao",
  "data_publicacao_autorizacao",
  "data_reconhecimento",
  "data_publicacao_reconhecimento",
  "data_renovacao",
  "data_publicacao_renovacao",
  "data_processo_emec",
  "data_inicio_funcionamento",
];
const INT_FIELDS = [
  "carga_horaria_total",
  "carga_horaria_hora_relogio",
  "carga_horaria_integralizada",
  "carga_horaria_estagio",
  "carga_horaria_atividades_complementares",
  "carga_horaria_tcc",
  "secao_publicacao_autorizacao",
  "pagina_publicacao_autorizacao",
  "secao_publicacao_reconhecimento",
  "pagina_publicacao_reconhecimento",
  "secao_publicacao_renovacao",
  "pagina_publicacao_renovacao",
  "vagas_autorizadas",
  "conceito_curso",
  "ano_cc",
  "cpc_faixa",
  "cpc_ano",
  "enade_conceito",
  "enade_ano",
  "numero_etapas",
  "duracao_hora_aula_minutos",
  "dias_letivos",
  "relevancia",
];
const FLOAT_FIELDS = ["cpc_continuo"];

function sanitizeCurso(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body };
  for (const f of DATE_FIELDS) {
    if (out[f] === "" || out[f] === undefined) out[f] = null;
  }
  for (const f of INT_FIELDS) {
    if (out[f] === "" || out[f] === undefined || out[f] === null) {
      out[f] = null;
    } else if (typeof out[f] === "string") {
      out[f] = parseInt(out[f] as string) || null;
    }
  }
  for (const f of FLOAT_FIELDS) {
    if (out[f] === "" || out[f] === undefined || out[f] === null) {
      out[f] = null;
    } else if (typeof out[f] === "string") {
      out[f] = parseFloat(out[f] as string) || null;
    }
  }
  return out;
}

// GET - Buscar curso por ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("cursos")
      .select("*, instituicoes(nome, cnpj), departamentos(id, nome, codigo)")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json(
        { error: sanitizarErro(error.message, 404) },
        { status: 404 },
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        erro: sanitizarErro(
          err instanceof Error ? err.message : "Erro interno",
          500,
        ),
      },
      { status: 500 },
    );
  }
}

// PATCH/PUT - Atualizar curso
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(request);
  if (auth instanceof NextResponse) return auth;

  const csrfError = validarCSRF(request);
  if (csrfError) return csrfError;

  const { id } = await params;
  const supabase = await createClient();
  const raw = await request.json();
  const body = sanitizeCurso(raw);

  try {
    // Não atualiza o ID nem campos de sistema
    delete body.id;
    delete body.instituicoes;

    const { data, error } = await supabase
      .from("cursos")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*, instituicoes(nome, cnpj), departamentos(id, nome, codigo)")
      .single();

    if (error) {
      return NextResponse.json(
        { error: sanitizarErro(error.message, 500) },
        { status: 500 },
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        erro: sanitizarErro(
          err instanceof Error ? err.message : "Erro interno",
          500,
        ),
      },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return PATCH(request, { params });
}

// DELETE - Soft delete via campo ativo
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  const csrfError = validarCSRF(req);
  if (csrfError) return csrfError;

  const { id } = await params;
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("cursos")
      .update({ ativo: false })
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { error: sanitizarErro(error.message, 500) },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      {
        erro: sanitizarErro(
          err instanceof Error ? err.message : "Erro interno",
          500,
        ),
      },
      { status: 500 },
    );
  }
}
