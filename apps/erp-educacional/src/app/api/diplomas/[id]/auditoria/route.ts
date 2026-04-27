import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  verificarAuth,
  erroNaoEncontrado,
  erroInterno,
} from "@/lib/security/api-guard";
import { buscarDiplomaCompleto } from "@/lib/diplomas/buscar-completo";
import { executarAuditoria } from "@/lib/auditoria";
import type {
  InputAuditoria,
  DadosDiplomadoAuditoria,
  DadosCursoAuditoria,
  DadosIesAuditoria,
  DadosHistoricoAuditoria,
  DadosDisciplinaAuditoria,
  DadosComprobatorioAuditoria,
} from "@/lib/auditoria/tipos";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * GET /api/diplomas/[id]/auditoria
 *
 * Executa a auditoria de requisitos XSD v1.05 para um diploma.
 * Retorna RespostaAuditoria com grupos, issues, totais e `pode_gerar_xml`.
 *
 * Cache: o frontend deve usar o `auditado_em` + diploma.updated_at para
 * invalidação local (sessionStorage). A rota não faz cache server-side.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const admin = getAdmin();

  // ── 1. Buscar diploma completo (diplomado, curso, disciplinas, enade) ──────
  const completo = await buscarDiplomaCompleto(id);
  if (!completo) {
    return erroNaoEncontrado();
  }

  const { diploma, diplomado, curso, disciplinas, enade } = completo;

  // ── 2. Parallel: campos extras não incluídos em buscarDiplomaCompleto ──────
  // Sessão 2026-04-25: removida query a `diplomados.nome_pai/nome_mae`
  // (colunas legadas inexistentes — disparavam ERROR 42703 no Postgres).
  // Filiação agora vem 100% da tabela canônica `filiacoes`.
  const [
    filiacoesData,
    cursoExtras,
    iesData,
    credenciamentosData,
    comprobatoriosData,
  ] = await Promise.all([
    // filiacoes — fonte canônica dos genitores (gerada pela RPC converter)
    admin
      .from("filiacoes")
      .select("nome, sexo, ordem")
      .eq("diplomado_id", diplomado.id)
      .order("ordem", { ascending: true })
      .then(
        (r) =>
          (r.data ?? []) as Array<{
            nome: string;
            sexo: string | null;
            ordem: number;
          }>,
      ),

    // tipo_autorizacao, numero_autorizacao, data_autorizacao do curso
    admin
      .from("cursos")
      .select("tipo_autorizacao, numero_autorizacao, data_autorizacao")
      .eq("id", curso.id)
      .single()
      .then(
        (r) =>
          r.data as {
            tipo_autorizacao: string | null;
            numero_autorizacao: string | null;
            data_autorizacao: string | null;
          } | null,
      ),

    // IES emissora — instituicoes ativa (mesma fonte do XML generator)
    admin
      .from("instituicoes")
      .select(
        "id, nome, cnpj, codigo_mec, logradouro, numero, bairro, municipio, codigo_municipio, uf, cep",
      )
      .eq("ativo", true)
      .limit(1)
      .single()
      .then((r) => r.data as Record<string, unknown> | null),

    // Credenciamento da IES (tipo='credenciamento', mais antigo)
    admin
      .from("credenciamentos")
      .select("tipo, tipo_ato, numero, data")
      .order("data", { ascending: true })
      .then((r) => (r.data ?? []) as Array<Record<string, string | null>>),

    // Comprobatórios vinculados ao processo do diploma
    diploma.processo_id
      ? admin
          .from("diploma_documentos_comprobatorios")
          .select("id, tipo_xsd, arquivo_origem_id, deleted_at")
          .eq("processo_id", diploma.processo_id)
          .is("deleted_at", null)
          .then(
            (r) =>
              (r.data ?? []) as Array<{
                id: string;
                tipo_xsd: string | null;
                arquivo_origem_id: string | null;
                deleted_at: string | null;
              }>,
          )
      : Promise.resolve(
          [] as Array<{
            id: string;
            tipo_xsd: string | null;
            arquivo_origem_id: string | null;
            deleted_at: string | null;
          }>,
        ),
  ]);

  // ── 3. Montar DadosDiplomadoAuditoria ─────────────────────────────────────
  const dadosDiplomado: DadosDiplomadoAuditoria = {
    id: diplomado.id,
    nome: diplomado.nome ?? null,
    cpf: diplomado.cpf ?? null,
    ra: (diplomado as any).ra ?? null,
    sexo: (diplomado as any).sexo ?? null,
    nacionalidade: (diplomado as any).nacionalidade ?? null,
    naturalidade_municipio: (diplomado as any).naturalidade_municipio ?? null,
    naturalidade_uf: (diplomado as any).naturalidade_uf ?? null,
    codigo_municipio_ibge: (diplomado as any).codigo_municipio_ibge ?? null,
    rg_numero: (diplomado as any).rg_numero ?? null,
    rg_orgao_expedidor: (diplomado as any).rg_orgao_expedidor ?? null,
    rg_uf: (diplomado as any).rg_uf ?? null,
    data_nascimento: (diplomado as any).data_nascimento ?? null,
    // FIX 2026-04-25: filiacoes é a única fonte (legado nome_pai/nome_mae removido)
    nome_pai: filiacoesData.find((f) => f.sexo === "M")?.nome ?? null,
    nome_mae: filiacoesData.find((f) => f.sexo === "F")?.nome ?? null,
  };

  // ── 4. Montar DadosCursoAuditoria ─────────────────────────────────────────
  const dadosCurso: DadosCursoAuditoria = {
    id: curso.id,
    nome: curso.nome ?? null,
    codigo_emec: curso.codigo_emec ?? null,
    grau: curso.grau ?? null,
    carga_horaria_total: curso.carga_horaria_total ?? null,
    tipo_autorizacao: cursoExtras?.tipo_autorizacao ?? null,
    numero_autorizacao: cursoExtras?.numero_autorizacao ?? null,
    data_autorizacao: cursoExtras?.data_autorizacao ?? null,
    tipo_reconhecimento: (curso as any).tipo_reconhecimento ?? null,
    numero_reconhecimento: (curso as any).numero_reconhecimento ?? null,
    data_reconhecimento: (curso as any).data_reconhecimento ?? null,
  };

  // ── 5. Montar DadosIesAuditoria ───────────────────────────────────────────
  const credRow = credenciamentosData.find((r) => r.tipo === "credenciamento");
  const dadosIes: DadosIesAuditoria = {
    nome: (iesData?.nome as string) ?? null,
    codigo_mec: (iesData?.codigo_mec as string) ?? null,
    cnpj: (iesData?.cnpj as string) ?? null,
    endereco_logradouro: (iesData?.logradouro as string) ?? null,
    endereco_numero: (iesData?.numero as string) ?? null,
    endereco_bairro: (iesData?.bairro as string) ?? null,
    endereco_cep: (iesData?.cep as string) ?? null,
    endereco_municipio: (iesData?.municipio as string) ?? null,
    endereco_uf: (iesData?.uf as string) ?? null,
    endereco_codigo_ibge: (iesData?.codigo_municipio as string) ?? null,
    tipo_credenciamento: credRow?.tipo_ato ?? null,
    numero_credenciamento: credRow?.numero ?? null,
    data_credenciamento: credRow?.data ?? null,
  };

  // ── 6. Montar DadosHistoricoAuditoria ─────────────────────────────────────
  const dadosDisciplinas: DadosDisciplinaAuditoria[] = disciplinas.map(
    (disc) => ({
      id: (disc as any).id,
      codigo: (disc as any).codigo ?? null,
      nome: (disc as any).nome ?? "",
      periodo: (disc as any).periodo ?? null,
      situacao: (disc as any).situacao ?? "",
      carga_horaria_aula: (disc as any).carga_horaria_aula ?? null,
      carga_horaria_relogio: (disc as any).carga_horaria_relogio ?? null,
      docente_nome: (disc as any).docente_nome ?? null,
      docente_titulacao: (disc as any).docente_titulacao ?? null,
    }),
  );

  // FIX s075: se carga_horaria_integralizada for null no diploma, calcular da soma das disciplinas
  const chFromDisciplinas =
    disciplinas.length > 0
      ? disciplinas.reduce(
          (sum, d) => sum + ((d as any).carga_horaria_aula ?? 0),
          0,
        )
      : null;

  const dadosHistorico: DadosHistoricoAuditoria = {
    diploma_id: diploma.id,
    codigo_curriculo: diploma.codigo_curriculo ?? null,
    data_ingresso: diploma.data_ingresso ?? null,
    forma_acesso: diploma.forma_acesso ?? null,
    data_conclusao: diploma.data_conclusao ?? null,
    data_colacao_grau: diploma.data_colacao_grau ?? null,
    data_expedicao: diploma.data_expedicao ?? null,
    carga_horaria_integralizada:
      diploma.carga_horaria_integralizada ??
      (chFromDisciplinas && chFromDisciplinas > 0 ? chFromDisciplinas : null),
    enade_presente: enade != null,
    disciplinas: dadosDisciplinas,
  };

  // ── 7. Montar DadosComprobatorioAuditoria[] ───────────────────────────────
  const dadosComprobatorios: DadosComprobatorioAuditoria[] =
    comprobatoriosData.map((c) => ({
      id: c.id,
      tipo_xsd: c.tipo_xsd ?? null,
      arquivo_storage_path: null, // não relevante para auditoria
      tem_arquivo: c.arquivo_origem_id != null,
    }));

  // ── 8. Executar auditoria ─────────────────────────────────────────────────
  const input: InputAuditoria = {
    diplomado: dadosDiplomado,
    curso: dadosCurso,
    ies: dadosIes,
    historico: dadosHistorico,
    comprobatorios: dadosComprobatorios,
  };

  const resultado = executarAuditoria(input);

  // ── 9. Persistir auditoria (Sessão 2026-04-26) ────────────────────────────
  // Antes, cache só vivia em sessionStorage (volátil, sem governança).
  // Agora cada execução é registrada em diploma_auditorias (append-only).
  // Idempotência: se já existe auditoria pra esse mesmo diploma_updated_at,
  // não duplicamos — retorna a auditoria existente.
  // ?forcar=1 força re-execução e novo INSERT.
  const url = new URL(req.url);
  const forcar = url.searchParams.get("forcar") === "1";
  const diplomaUpdatedAt =
    (diploma as { updated_at?: string }).updated_at ?? null;

  // Aplana issues pra facilitar diff
  const issuesPlanificadas = resultado.grupos.flatMap((g) =>
    g.issues.map((i) => ({
      grupo_id: g.id,
      grupo_nome: g.nome,
      campo: i.campo,
      mensagem: i.mensagem,
      severidade: i.severidade,
      acao: i.acao,
    })),
  );

  let auditoriaSalvaId: string | null = null;
  let auditadoEmReal: string = resultado.auditado_em;

  if (diplomaUpdatedAt) {
    // Checa se já existe auditoria pro mesmo diploma_updated_at
    const { data: existente } = await admin
      .from("diploma_auditorias")
      .select("id, auditado_em")
      .eq("diploma_id", id)
      .eq("diploma_updated_at", diplomaUpdatedAt)
      .order("auditado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    const ja = existente as { id: string; auditado_em: string } | null;
    if (ja && !forcar) {
      auditoriaSalvaId = ja.id;
      auditadoEmReal = ja.auditado_em;
    } else {
      const { data: novaRow, error: errAud } = await admin
        .from("diploma_auditorias")
        .insert({
          diploma_id: id,
          auditado_por: auth.userId,
          diploma_updated_at: diplomaUpdatedAt,
          pode_gerar_xml: resultado.pode_gerar_xml,
          totais: resultado.totais,
          grupos: resultado.grupos,
          issues: issuesPlanificadas,
        })
        .select("id, auditado_em")
        .single();

      if (errAud) {
        console.error(
          "[auditoria] Falha ao persistir auditoria (resultado retornado mesmo assim):",
          errAud.message,
        );
      } else if (novaRow) {
        const r = novaRow as { id: string; auditado_em: string };
        auditoriaSalvaId = r.id;
        auditadoEmReal = r.auditado_em;
      }
    }
  }

  return NextResponse.json({
    ...resultado,
    auditado_em: auditadoEmReal,
    auditoria_id: auditoriaSalvaId,
  });
}
