import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Conversão PDF/A de múltiplos documentos pode demorar vários minutos.
// Sem maxDuration, o Vercel mata a função no timeout padrão (10-60s).
export const maxDuration = 60;
import { montarDadosDiploma } from "@/lib/xml/montador";
import { gerarXMLs } from "@/lib/xml/gerador";
import type { DocumentosComprobatoriosNonEmpty } from "@/lib/xml";
import {
  validarHistoricoEscolar,
  validarDocAcademicaRegistro,
} from "@/lib/xml/validador";
import {
  erroNaoEncontrado,
  erroInterno,
  verificarAuth,
} from "@/lib/security/api-guard";
import {
  verificarRateLimitERP,
  adicionarHeadersRateLimit,
  adicionarHeadersRetryAfter,
} from "@/lib/security/rate-limit";
import { registrarCustodiaAsync } from "@/lib/security/cadeia-custodia";
import {
  REGRAS_NEGOCIO,
  ValidacaoNegocioError,
  type CodigoRegra,
} from "@/lib/xml/validation/regras-negocio";
import {
  obterTodosPdfABase64DoProcesso,
  PdfAConversionError,
  type DocumentoComprobatorioParaXml,
} from "@/lib/pdfa/converter-service";
import crypto from "crypto";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";

/**
 * Payload de override humano enviado pelo frontend após o operador
 * confirmar uma violação de regra de negócio no modal.
 *
 * Bug #H — princípio do override (decisão Marcelo 2026-04-07):
 * "A confirmação humana pode sobrescrever qualquer regra de negócio."
 */
interface OverrideRegra {
  /** Código da regra a ser sobrescrita (vindo da resposta 422 anterior) */
  codigo: CodigoRegra;
  /** Justificativa textual obrigatória (mínimo 10 chars — validado pelo CHECK do banco) */
  justificativa: string;
  /** Snapshot dos valores originais (vindo da resposta 422 anterior) */
  valores_originais: Record<string, unknown>;
}

// Calcula hash SHA-256 de uma string
function sha256(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

// POST — Gera os 3 XMLs reais (DiplomaDigital, HistoricoEscolar, DocAcademicaRegistro)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAuth(request);
  if (auth instanceof NextResponse) return auth;

  // Rate limit: 10 per minute for XML generation
  const rateLimit = await verificarRateLimitERP(request, "export", auth.userId);
  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      { erro: "Muitas requisições. Tente novamente em instantes." },
      { status: 429 },
    );
    adicionarHeadersRetryAfter(response.headers, rateLimit);
    return response;
  }

  const supabase = await createClient();
  const { id: processoId } = await params;

  try {
    const body = await request.json();
    const { diploma_id } = body;
    // Bug #H — overrides humanos opcionais para regras de negócio.
    // Quando presente, cada item indica que o operador confirmou no modal
    // a sobrescrita daquela regra com justificativa textual.
    const overrides: OverrideRegra[] = Array.isArray(body.overrides)
      ? body.overrides
      : [];

    if (!diploma_id) {
      return NextResponse.json(
        { error: "diploma_id é obrigatório" },
        { status: 400 },
      );
    }

    // Validação básica dos overrides recebidos. Justificativa < 10 chars
    // será rejeitada também pelo CHECK do banco, mas validamos cedo.
    for (const ov of overrides) {
      if (
        !ov?.codigo ||
        typeof ov.justificativa !== "string" ||
        ov.justificativa.trim().length < 10
      ) {
        return NextResponse.json(
          {
            error: "Override inválido",
            detalhes:
              "Cada override exige `codigo` e `justificativa` (mínimo 10 caracteres).",
          },
          { status: 400 },
        );
      }
    }

    // ── 1. Valida que o diploma pertence ao processo ───────────────────────
    const { data: diploma, error: diplomaError } = await supabase
      .from("diplomas")
      .select("id, processo_id, codigo_validacao")
      .eq("id", diploma_id)
      .single();

    if (diplomaError || !diploma || diploma.processo_id !== processoId) {
      return erroNaoEncontrado();
    }

    // ── 2. Sessão de extração é OPCIONAL ───────────────────────────────────
    // Diplomas podem ser criados por dois caminhos:
    //   (a) Fluxo transacional via POST /api/processos (NÃO cria extracao_sessoes)
    //   (b) Fluxo legado via /extrair (cria extracao_sessoes)
    // A validação real dos dados acontece no montador.ts (linha 87 abaixo),
    // que verifica diplomado, curso, instituição, disciplinas etc. direto
    // das tabelas finais. O gate de extracao_sessoes era código morto que
    // bloqueava o caminho (a). Agora apenas buscamos a sessão se existir,
    // para atualizar o status no passo 9.
    const { data: extracao } = await supabase
      .from("extracao_sessoes")
      .select("id, status")
      .eq("diploma_id", diploma_id)
      .maybeSingle();

    // ── 3. Código de validação do HISTÓRICO é gerado e persistido dentro ──
    // do montarDadosDiploma() usando o algoritmo SHA256 do Anexo III IN 05.
    // O código do DIPLOMA é gerado pela REGISTRADORA (UFMS), não por nós.

    // ── 4. Monta o objeto DadosDiploma buscando do banco ──────────────────
    // Se houver overrides aprovados, passamos os códigos pro montador pular.
    const regrasIgnoradas: CodigoRegra[] = overrides.map((o) => o.codigo);

    let dadosDiploma;
    try {
      dadosDiploma = await montarDadosDiploma(supabase, diploma_id, {
        pular_regras_negocio: regrasIgnoradas,
      });
    } catch (err) {
      // Bug #H — violação de regra de negócio: devolve 422 estruturado
      // com a lista de violações para o frontend abrir o modal de override.
      if (err instanceof ValidacaoNegocioError) {
        return NextResponse.json(
          {
            error: "Validação de regra de negócio",
            tipo: "regra_negocio",
            violacoes: err.violacoes.map((v) => ({
              codigo: v.codigo,
              mensagem: v.mensagem,
              severidade: v.severidade,
              valores_originais: v.valores_originais,
            })),
            mensagem_usuario:
              "Encontramos divergências nos dados. Você pode revisar e corrigir, " +
              "ou confirmar que está ciente e prosseguir com justificativa.",
          },
          { status: 422 },
        );
      }

      return NextResponse.json(
        {
          error: "Dados incompletos para geração do XML",
          detalhes:
            err instanceof Error
              ? err.message
              : "Verifique se todos os dados obrigatórios estão preenchidos.",
        },
        { status: 422 },
      );
    }

    // ── 4b. Persiste os overrides aprovados em validacao_overrides ────────
    // Audit trail completo: regra, valores originais, justificativa, usuário.
    if (overrides.length > 0) {
      const overridesParaInserir = overrides.map((ov) => ({
        entidade_tipo: "diploma",
        entidade_id: diploma_id,
        regra_codigo: ov.codigo,
        valores_originais: ov.valores_originais ?? {},
        justificativa: ov.justificativa.trim(),
        usuario_id: auth.userId,
      }));

      const { error: overrideError } = await supabase
        .from("validacao_overrides")
        .insert(overridesParaInserir);

      if (overrideError) {
        console.error("Erro ao registrar overrides:", overrideError);
        return NextResponse.json(
          {
            error: "Não foi possível registrar a justificativa do override",
            detalhes: overrideError.message,
          },
          { status: 500 },
        );
      }
    }

    // ── 5. Carrega documentos comprobatórios (Bug #F) ─────────────────────
    // `obterTodosPdfABase64DoProcesso` precisa de um client service_role porque
    // grava no bucket privado `documentos-pdfa` e lê `diploma_documentos_comprobatorios`.
    // O client `supabase` do server helper não tem write no Storage restrito.
    const supabaseAdmin = (() => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !serviceKey) {
        throw new Error(
          "SUPABASE_SERVICE_ROLE_KEY não configurada — necessária para PDF/A de comprobatórios",
        );
      }
      return createAdminClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    })();

    let comprobatorios: DocumentoComprobatorioParaXml[];
    try {
      comprobatorios = await obterTodosPdfABase64DoProcesso(
        processoId,
        supabaseAdmin,
      );
    } catch (err) {
      // Falha dura na conversão PDF/A — propaga como 502 (dependência externa)
      if (err instanceof PdfAConversionError) {
        console.error("[gerar-xml] Falha ao obter PDF/A comprobatórios:", err);
        return NextResponse.json(
          {
            error: "Falha ao converter documentos comprobatórios para PDF/A",
            detalhes: err.message,
          },
          { status: 502 },
        );
      }
      throw err;
    }

    // ── 5b. Regra de negócio: DOCUMENTACAO_COMPROBATORIA_VAZIA ────────────
    // Se não há comprobatórios E não há override aprovado para esta regra,
    // bloqueia com 422 — operador precisa selecionar ao menos um documento
    // ou justificar explicitamente a ausência (caminho raro/excepcional).
    const overrideComprobatoriosVazio = overrides.some(
      (o) => o.codigo === REGRAS_NEGOCIO.DOCUMENTACAO_COMPROBATORIA_VAZIA,
    );

    if (comprobatorios.length === 0 && !overrideComprobatoriosVazio) {
      return NextResponse.json(
        {
          error: "Validação de regra de negócio",
          tipo: "regra_negocio",
          violacoes: [
            {
              codigo: REGRAS_NEGOCIO.DOCUMENTACAO_COMPROBATORIA_VAZIA,
              mensagem:
                "Nenhum documento comprobatório foi selecionado para este processo. " +
                "O XML DocAcademicaRegistro exige ao menos um <Documento> (XSD v1.05).",
              severidade: "erro" as const,
              valores_originais: {
                processo_id: processoId,
                comprobatorios_ativos: 0,
              },
            },
          ],
          mensagem_usuario:
            "Você precisa selecionar ao menos um documento comprobatório (ex: RG, " +
            "CNH, certidão) antes de gerar o XML. Em casos excepcionais é possível " +
            "prosseguir com justificativa registrada.",
        },
        { status: 422 },
      );
    }

    // ── 6. Gera os 2 XMLs da Emissora ─────────────────────────────────────
    // NOTA: O DiplomaDigital é montado pela REGISTRADORA (UFMS) após registro.
    // A emissora gera apenas HistóricoEscolar e DocumentacaoAcademica.
    //
    // Bug #F: quando há comprobatórios reais, passa a tupla NonEmpty pro
    // overload novo que serializa <Documento tipo=... observacoes=...>{base64}</Documento>.
    // Quando não há (caminho override), chama a assinatura legada que produz
    // placeholder — mas veja o fix #7 adiante: nesse caminho o doc_academica
    // NÃO é persistido, apenas o histórico.
    const comprobatoriosNonEmpty: DocumentosComprobatoriosNonEmpty | null =
      comprobatorios.length > 0
        ? (comprobatorios as unknown as DocumentosComprobatoriosNonEmpty)
        : null;

    const xmls = comprobatoriosNonEmpty
      ? gerarXMLs(dadosDiploma, comprobatoriosNonEmpty)
      : gerarXMLs(dadosDiploma);

    // ── 7. Valida os XMLs gerados ────────────────────────────────────────
    const validacoes = {
      historico_escolar: validarHistoricoEscolar(xmls.historico_escolar),
      doc_academica_registro: validarDocAcademicaRegistro(
        xmls.doc_academica_registro,
      ),
    };

    const todosValidos = Object.values(validacoes).every((v) => v.valido);

    // ── 8. Salva XMLs na tabela xml_gerados ─────────────────────────────
    //
    // Fix #7 — Não salva doc_academica vazio:
    //   No caminho override (comprobatorios.length === 0 + override ativo),
    //   o XML doc_academica contém apenas placeholder legado (sem base64 real).
    //   Persistir esse placeholder no banco poluiria xml_gerados e induziria
    //   a registradora a rejeitar na hora da assinatura. Por isso, nesse
    //   caminho só salvamos o histórico e marcamos doc_academica como
    //   "pendente" no metadata da resposta.
    const xmlsParaSalvar: Array<{
      diploma_id: string;
      processo_id: string;
      tipo: string;
      versao_xsd: string;
      conteudo_xml: string;
      hash_sha256: string;
      validado_xsd: boolean;
      erros_validacao: string[];
      status: string;
    }> = [
      {
        diploma_id,
        processo_id: processoId,
        tipo: "historico_escolar",
        versao_xsd: "1.05",
        conteudo_xml: xmls.historico_escolar,
        hash_sha256: sha256(xmls.historico_escolar),
        validado_xsd: validacoes.historico_escolar.valido,
        erros_validacao: validacoes.historico_escolar.erros,
        status: validacoes.historico_escolar.valido ? "validado" : "rascunho",
      },
    ];

    if (comprobatoriosNonEmpty) {
      // Caminho real: doc_academica com <Documento> de verdade
      xmlsParaSalvar.push({
        diploma_id,
        processo_id: processoId,
        tipo: "doc_academica_registro",
        versao_xsd: "1.05",
        conteudo_xml: xmls.doc_academica_registro,
        hash_sha256: sha256(xmls.doc_academica_registro),
        validado_xsd: validacoes.doc_academica_registro.valido,
        erros_validacao: validacoes.doc_academica_registro.erros,
        status: validacoes.doc_academica_registro.valido
          ? "validado"
          : "rascunho",
      });
    }
    // else: caminho override com 0 docs → doc_academica NÃO é persistido (fix #7)

    // Remove registros anteriores do mesmo diploma (re-geração)
    await supabase.from("xml_gerados").delete().eq("diploma_id", diploma_id);

    const { data: xmlsGerados, error: insertError } = await supabase
      .from("xml_gerados")
      .insert(xmlsParaSalvar)
      .select("id, tipo, status, validado_xsd, hash_sha256");

    if (insertError) {
      console.error("Erro ao salvar XMLs:", insertError);
      return erroInterno();
    }

    // ── 8. Atualiza status do diploma ────────────────────────────────────
    const novoStatus = todosValidos ? "xml_gerado" : "xml_com_erros";
    await supabase
      .from("diplomas")
      .update({ status: novoStatus, updated_at: new Date().toISOString() })
      .eq("id", diploma_id);

    // ── 9. Atualiza status da sessão de extração (se existir) ────────────
    if (extracao?.id) {
      await supabase
        .from("extracao_sessoes")
        .update({ status: "confirmado", updated_at: new Date().toISOString() })
        .eq("id", extracao.id);
    }

    // ── Fix #1: Cadeia de custódia grava override + counts PDF/A ──────────
    // Além dos hashes dos XMLs, registra:
    //   - override_ativo: se houve override em qualquer regra
    //   - overrides_regras: lista dos códigos das regras sobrescritas
    //   - pdfa_count: total de PDF/A embutidos no doc_academica
    //   - pdfa_cached/fresh: quantos vieram do cache vs. conversão nova
    // Útil para relatório de exceções e auditoria regulatória.
    const pdfaCounts = {
      total: comprobatorios.length,
      cached: comprobatorios.filter((c) => c.pdfa.cached).length,
      fresh: comprobatorios.filter((c) => !c.pdfa.cached).length,
    };

    void registrarCustodiaAsync({
      diplomaId: diploma_id,
      etapa: "xml_gerado",
      status: todosValidos ? "sucesso" : "erro",
      request,
      userId: auth.userId,
      detalhes: {
        xmls_count: xmlsGerados?.length || 0,
        validacoes,
        hashes: (xmlsGerados || []).map((x) => ({
          tipo: x.tipo,
          hash: x.hash_sha256,
        })),
        // Fix #1 — auditoria de override + PDF/A
        override_ativo: overrides.length > 0,
        overrides_regras: overrides.map((o) => o.codigo),
        comprobatorios_vazios_com_override:
          overrideComprobatoriosVazio && comprobatorios.length === 0,
        pdfa: pdfaCounts,
      },
    });

    const docAcademicaPersistido = comprobatoriosNonEmpty !== null;

    const response = NextResponse.json(
      {
        sucesso: true,
        todos_validos: todosValidos,
        xml_ids: (xmlsGerados || []).map((x) => x.id),
        xmls: (xmlsGerados || []).map((x) => ({
          id: x.id,
          tipo: x.tipo,
          status: x.status,
          validado_xsd: x.validado_xsd,
          hash_sha256: x.hash_sha256,
        })),
        validacoes: {
          historico_escolar: {
            valido: validacoes.historico_escolar.valido,
            erros: validacoes.historico_escolar.erros,
          },
          doc_academica_registro: docAcademicaPersistido
            ? {
                valido: validacoes.doc_academica_registro.valido,
                erros: validacoes.doc_academica_registro.erros,
              }
            : {
                valido: false,
                erros: [
                  "Não persistido — caminho override sem comprobatórios (fix #7)",
                ],
                pendente: true,
              },
        },
        comprobatorios: {
          total: comprobatorios.length,
          pdfa_cached: pdfaCounts.cached,
          pdfa_fresh: pdfaCounts.fresh,
          doc_academica_persistido: docAcademicaPersistido,
        },
        mensagem: !docAcademicaPersistido
          ? "Histórico gerado. DocAcademicaRegistro NÃO persistido — caminho override sem comprobatórios. Selecione documentos para gerar o doc_academica completo."
          : todosValidos
            ? "2 XMLs gerados e validados com sucesso conforme XSD v1.05 do MEC."
            : "XMLs gerados com avisos de validação. Verifique os erros antes de assinar.",
      },
      { status: 201 },
    );
    adicionarHeadersRateLimit(response.headers, rateLimit);
    return response;
  } catch (error) {
    console.error("Erro no endpoint gerar-xml:", error);
    const response = NextResponse.json(
      {
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Desconhecido",
      },
      { status: 500 },
    );
    adicionarHeadersRateLimit(response.headers, rateLimit);
    return response;
  }
}
