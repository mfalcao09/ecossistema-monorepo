import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verificarAuth, erroInterno } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/diplomas/migracao/individual?tipo=codigo|cpf|nome&valor=...
//   Busca um diploma legado ou já existente pelo código, CPF ou nome
//
// POST /api/diplomas/migracao/individual
//   Body: { diploma_id: string }
//   Gera nova RVDD para o diploma (atualiza link para novo portal)
// ─────────────────────────────────────────────────────────────────────────────

// ── GET: Busca ────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();

  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo") as "codigo" | "cpf" | "nome" | null;
  const valor = searchParams.get("valor")?.trim();

  if (!tipo || !valor) {
    return NextResponse.json({ error: "Parâmetros tipo e valor são obrigatórios." }, { status: 400 });
  }

  let query = supabase
    .from("diplomas")
    .select(`
      id, status, codigo_validacao, is_legado, legado_importado_em,
      diplomados ( nome, cpf ),
      cursos ( nome, grau )
    `)
    .limit(5);

  if (tipo === "codigo") {
    query = query.ilike("codigo_validacao", `%${valor}%`);
  } else if (tipo === "cpf") {
    const cpfLimpo = valor.replace(/\D/g, "");
    query = query.eq("diplomados.cpf", cpfLimpo);
  } else if (tipo === "nome") {
    query = query.ilike("diplomados.nome", `%${valor}%`);
  }

  const { data: diplomas, error } = await query;

  if (error) {
    console.error('[API] Erro ao buscar diploma para migração individual:', error.message);
    return erroInterno();
  }

  if (!diplomas || diplomas.length === 0) {
    return NextResponse.json({
      encontrado: false,
      mensagem: "Nenhum diploma encontrado com os dados informados.",
    });
  }

  const d = diplomas[0];
  const diplomado = Array.isArray(d.diplomados) ? d.diplomados[0] : d.diplomados;
  const curso = Array.isArray(d.cursos) ? d.cursos[0] : d.cursos;

  return NextResponse.json({
    encontrado: true,
    diploma_id: d.id,
    nome: diplomado?.nome ?? "—",
    curso: curso ? `${curso.grau ?? "Graduação"} em ${curso.nome}` : "—",
    codigo_validacao: d.codigo_validacao,
    status_atual: d.status,
    ja_migrado: d.is_legado === true && d.legado_importado_em !== null,
  });
}

// ── POST: Gerar nova RVDD ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();

  let body: { diploma_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const { diploma_id } = body;
  if (!diploma_id) {
    return NextResponse.json({ error: "diploma_id é obrigatório." }, { status: 400 });
  }

  // Verificar que o diploma existe
  const { data: diploma, error: dipErr } = await supabase
    .from("diplomas")
    .select("id, status, codigo_validacao, is_legado")
    .eq("id", diploma_id)
    .single();

  if (dipErr || !diploma) {
    return NextResponse.json({ error: "Diploma não encontrado." }, { status: 404 });
  }

  // Acionar geração da RVDD via endpoint existente
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  // Atualiza status do diploma para permitir geração da RVDD (se necessário)
  const statusesValidos = ["assinado", "aguardando_registro", "registrado", "rvdd_gerado", "publicado"];
  if (!statusesValidos.includes(diploma.status)) {
    // Para diplomas legados, force o status para rvdd_gerado
    if (diploma.is_legado) {
      await supabase
        .from("diplomas")
        .update({ status: "rvdd_gerado" })
        .eq("id", diploma_id);
    } else {
      return NextResponse.json({
        error: `Diploma precisa estar assinado para gerar RVDD. Status atual: "${diploma.status}".`,
      }, { status: 422 });
    }
  }

  // Chamar API de geração de RVDD
  try {
    const rvddRes = await fetch(`${baseUrl}/api/diplomas/${diploma_id}/rvdd`, {
      method: "POST",
      headers: {
        "Cookie": req.headers.get("cookie") ?? "",
      },
    });

    const rvddData = await rvddRes.json();

    if (!rvddRes.ok) {
      return NextResponse.json({
        error: rvddData.error ?? "Erro ao gerar RVDD.",
      }, { status: 500 });
    }

    // Marcar como migrado (se ainda não estava)
    if (!diploma.is_legado) {
      await supabase
        .from("diplomas")
        .update({
          is_legado: true,
          legado_importado_em: new Date().toISOString(),
        })
        .eq("id", diploma_id);
    }

    return NextResponse.json({
      ok: true,
      diploma_id,
      rvdd_url: rvddData.rvdd_url,
      codigo_validacao: diploma.codigo_validacao,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar RVDD.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
