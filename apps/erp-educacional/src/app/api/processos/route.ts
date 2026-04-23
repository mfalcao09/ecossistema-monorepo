import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { protegerRota } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";
import { processoSchema } from "@/lib/security/zod-schemas";
import { montarSnapshotExtracao } from "@/lib/diploma/snapshot";

interface ProcessoResponse {
  id: string;
  diploma_id?: string;
  sessao_id?: string; // sessão 074: para navegar direto à revisão em status em_extracao
  nome: string | null;
  curso: {
    nome: string;
    grau: string;
  };
  turno: string;
  periodo_letivo: string;
  data_colacao: string;
  status: string;
  total_diplomas: number;
  created_at: string;
}

// GET - Listar processos com dados agregados
export const GET = protegerRota(
  async (request, { userId, tenantId }) => {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const search = searchParams.get("search") || "";

    let query = supabase
      .from("processos_emissao")
      .select(
        `
      id,
      nome,
      sessao_id,
      turno,
      periodo_letivo,
      data_colacao,
      status,
      total_diplomas,
      created_at,
      cursos(nome, grau),
      diplomas!diplomas_processo_id_fkey(id)
    `,
      )
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(`nome.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: sanitizarErro(error.message, 500) },
        { status: 500 },
      );
    }

    // Formato da resposta
    const formatted: ProcessoResponse[] = (data || []).map((p: any) => ({
      id: p.id,
      nome: p.nome,
      sessao_id: p.sessao_id ?? undefined, // sessão 074: navegar direto à revisão em status em_extracao
      curso: p.cursos || { nome: "", grau: "" },
      turno: p.turno,
      periodo_letivo: p.periodo_letivo,
      data_colacao: p.data_colacao,
      status: p.status,
      total_diplomas: p.total_diplomas,
      created_at: p.created_at,
      // diploma_id do primeiro diploma vinculado (para redirecionar direto à pipeline)
      diploma_id: (p.diplomas as any[])?.[0]?.id ?? undefined,
    }));

    return NextResponse.json(formatted);
  },
  { skipCSRF: true },
);

// ═══════════════════════════════════════════════════════════════════
// Helpers de rollback — desfaz registros criados em caso de erro
// ═══════════════════════════════════════════════════════════════════
async function rollback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: {
    processo_id?: string;
    diploma_id?: string;
    diplomado_id?: string;
    diplomado_era_novo?: boolean;
  },
) {
  const erros: string[] = [];

  // Ordem inversa: filhos antes dos pais
  // Filiações são filhas de diplomado, não de diploma
  if (ids.diplomado_id && ids.diplomado_era_novo) {
    const { error: errFil } = await supabase
      .from("filiacoes")
      .delete()
      .eq("diplomado_id", ids.diplomado_id);
    if (errFil) erros.push(`rollback filiacoes: ${errFil.message}`);
  }

  if (ids.diploma_id) {
    const tabelas = [
      "diploma_disciplinas",
      "diploma_atividades_complementares",
      "diploma_estagios",
      "diploma_habilitacoes",
      "diploma_enade",
    ] as const;
    for (const tabela of tabelas) {
      const { error } = await supabase
        .from(tabela)
        .delete()
        .eq("diploma_id", ids.diploma_id);
      if (error) erros.push(`rollback ${tabela}: ${error.message}`);
    }
    const { error } = await supabase
      .from("diplomas")
      .delete()
      .eq("id", ids.diploma_id);
    if (error) erros.push(`rollback diplomas: ${error.message}`);
  }

  // Só deleta diplomado se foi criado nesta operação (não se já existia)
  if (ids.diplomado_id && ids.diplomado_era_novo) {
    const { error } = await supabase
      .from("diplomados")
      .delete()
      .eq("id", ids.diplomado_id);
    if (error) erros.push(`rollback diplomados: ${error.message}`);
  }

  if (ids.processo_id) {
    const { error } = await supabase
      .from("processos_emissao")
      .delete()
      .eq("id", ids.processo_id);
    if (error) erros.push(`rollback processos_emissao: ${error.message}`);
  }

  if (erros.length > 0) {
    console.error("[API] Erros durante rollback:", erros);
  }
}

// POST - Criar novo processo COM dados completos do diplomado
// Modelo TRANSACIONAL: se qualquer etapa falhar, desfaz tudo que já foi criado
export const POST = protegerRota(
  async (request, { userId, tenantId }) => {
    const supabase = await createClient();
    const body = await request.json();

    // Validação básica com Zod (campos do processo)
    const parsed = processoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados inválidos",
          detalhes: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { nome, curso_id, turno, periodo_letivo, data_colacao, obs } =
      parsed.data;

    // Dados extras que o frontend envia (não validados pelo Zod do processo)
    const dados_diplomado = body.dados_diplomado || null;
    const dados_academicos = body.dados_academicos || null;
    const disciplinas = body.disciplinas || [];
    const atividades_complementares = body.atividades_complementares || [];
    const estagios = body.estagios || [];
    const habilitacoes = body.habilitacoes || [];
    const assinantes_info = body.assinantes || null;

    // IDs criados — usados para rollback se algo falhar
    const criados: {
      processo_id?: string;
      diploma_id?: string;
      diplomado_id?: string;
      diplomado_era_novo?: boolean;
    } = {};

    try {
      // ═══════════════════════════════════════════════════════════
      // 1) Criar o processo
      // ═══════════════════════════════════════════════════════════
      const { data: processo, error: errProcesso } = await supabase
        .from("processos_emissao")
        .insert({
          nome,
          curso_id,
          turno: turno || null,
          periodo_letivo: periodo_letivo || null,
          data_colacao: data_colacao || null,
          obs: obs || null,
          status: "rascunho",
          total_diplomas: 0,
        })
        .select(
          `
          id,
          nome,
          turno,
          periodo_letivo,
          data_colacao,
          status,
          total_diplomas,
          created_at,
          cursos(nome, grau)
        `,
        )
        .single();

      if (errProcesso || !processo) {
        return NextResponse.json(
          {
            error: sanitizarErro(
              errProcesso?.message || "Erro ao criar processo",
              500,
            ),
          },
          { status: 500 },
        );
      }
      criados.processo_id = processo.id;

      // ═══════════════════════════════════════════════════════════
      // 2) Criar/atualizar o diplomado (upsert por CPF)
      // ═══════════════════════════════════════════════════════════
      if (!dados_diplomado?.cpf || !dados_diplomado?.nome_aluno) {
        // Sem dados do diplomado = rollback do processo
        await rollback(supabase, criados);
        return NextResponse.json(
          { error: "Dados do diplomado são obrigatórios (CPF e nome)" },
          { status: 400 },
        );
      }

      const cpfLimpo = dados_diplomado.cpf.replace(/[^0-9]/g, "");

      // Mapear sexo do frontend para o enum do banco (M/F)
      let sexoDB: string | null = null;
      if (dados_diplomado.sexo) {
        const s = dados_diplomado.sexo.toLowerCase();
        if (s === "masculino" || s === "m") sexoDB = "M";
        else if (s === "feminino" || s === "f") sexoDB = "F";
      }

      // Tentar encontrar diplomado existente pelo CPF (hash seguro com fallback)
      let existente: { id: string } | null = null;
      let errBusca: { message: string } | null = null;
      try {
        const { hashCPF } = await import("@/lib/security/pii-encryption");
        const cpfHash = await hashCPF(cpfLimpo);
        const result = await supabase
          .from("diplomados")
          .select("id")
          .eq("cpf_hash", cpfHash)
          .maybeSingle();
        existente = result.data;
        errBusca = result.error;
      } catch {
        // Fallback: RPCs PII não disponíveis ainda
        const result = await supabase
          .from("diplomados")
          .select("id")
          .eq("cpf", cpfLimpo)
          .maybeSingle();
        existente = result.data;
        errBusca = result.error;
      }

      if (errBusca) {
        console.error("[API] Erro ao buscar diplomado:", errBusca.message);
        await rollback(supabase, criados);
        return NextResponse.json(
          { error: `Erro ao buscar diplomado por CPF: ${errBusca.message}` },
          { status: 500 },
        );
      }

      const dadosDiplomado = {
        nome: dados_diplomado.nome_aluno,
        nome_social: dados_diplomado.nome_social || null,
        data_nascimento: dados_diplomado.data_nascimento || null,
        sexo: sexoDB,
        nacionalidade: dados_diplomado.nacionalidade || null,
        naturalidade_municipio: dados_diplomado.naturalidade_municipio || null,
        naturalidade_uf: dados_diplomado.naturalidade_uf || null,
        rg_numero: dados_diplomado.rg_numero || null,
        rg_orgao_expedidor: dados_diplomado.rg_orgao_expedidor || null,
        rg_uf: dados_diplomado.rg_uf || null,
        email: dados_diplomado.email || null,
        telefone: dados_diplomado.telefone || null,
        codigo_municipio_ibge:
          dados_diplomado.naturalidade_codigo_municipio || null,
      };

      if (existente) {
        // Atualizar dados do diplomado existente
        criados.diplomado_id = existente.id;
        criados.diplomado_era_novo = false;

        const { error: errUpdate } = await supabase
          .from("diplomados")
          .update(dadosDiplomado)
          .eq("id", existente.id);

        if (errUpdate) {
          console.error(
            "[API] Erro ao atualizar diplomado:",
            errUpdate.message,
          );
          await rollback(supabase, criados);
          return NextResponse.json(
            { error: `Erro ao atualizar diplomado: ${errUpdate.message}` },
            { status: 500 },
          );
        }
      } else {
        // Criar novo diplomado
        const { data: novo, error: errDiplomado } = await supabase
          .from("diplomados")
          .insert({
            ...dadosDiplomado,
            cpf: cpfLimpo,
            data_nascimento:
              dados_diplomado.data_nascimento ||
              new Date().toISOString().split("T")[0],
          })
          .select("id")
          .single();

        if (errDiplomado || !novo) {
          console.error(
            "[API] Erro ao criar diplomado:",
            errDiplomado?.message,
          );
          await rollback(supabase, criados);
          return NextResponse.json(
            {
              error: `Erro ao criar diplomado: ${errDiplomado?.message || "Dados retornaram vazio"}`,
            },
            { status: 500 },
          );
        }

        criados.diplomado_id = novo.id;
        criados.diplomado_era_novo = true;
      }

      // ═══════════════════════════════════════════════════════════
      // 3) Criar o diploma vinculando processo + diplomado
      //    Inclui o SNAPSHOT IMUTÁVEL da extração (F0.6).
      //    O snapshot é a fonte única para gerar XMLs e PDFs oficiais.
      // ═══════════════════════════════════════════════════════════

      // Busca dados do curso (usado para compor o snapshot)
      const { data: cursoRow } = await supabase
        .from("cursos")
        .select(
          "id, nome, grau, titulo_conferido, modalidade, carga_horaria_total, " +
            "tipo_reconhecimento, numero_reconhecimento, data_reconhecimento, dou_reconhecimento, " +
            "tipo_renovacao, numero_renovacao, data_renovacao",
        )
        .eq("id", curso_id)
        .maybeSingle();

      // Monta snapshot canônico — em try/catch para não bloquear criação do
      // diploma caso algum campo inesperado quebre. Se falhar, diploma é
      // criado sem snapshot e log avisa (poderá ser reconstruído depois).
      let dadosSnapshot: ReturnType<typeof montarSnapshotExtracao> | null =
        null;
      try {
        dadosSnapshot = montarSnapshotExtracao({
          processo_id: processo.id,
          extracao_sessao_id: body.extracao_sessao_id ?? null,
          diplomado: { ...dados_diplomado, cpf: cpfLimpo },
          curso: cursoRow ?? null,
          dados_academicos: {
            ...(dados_academicos ?? {}),
            turno: turno ?? dados_academicos?.turno ?? null,
            periodo_letivo:
              periodo_letivo ?? dados_academicos?.periodo_letivo ?? null,
            data_colacao_grau:
              data_colacao ?? dados_academicos?.data_colacao_grau ?? null,
          },
          disciplinas,
          atividades_complementares,
          estagios,
          assinantes: Array.isArray(assinantes_info) ? assinantes_info : [],
        });
      } catch (snapErr) {
        console.error(
          "[API/processos] Falha ao montar snapshot — diploma será criado sem snapshot:",
          snapErr,
        );
        dadosSnapshot = null;
      }

      const { data: diploma, error: errDiploma } = await supabase
        .from("diplomas")
        .insert({
          processo_id: processo.id,
          diplomado_id: criados.diplomado_id,
          curso_id,
          status: "rascunho",
          estado_preenchimento: "rascunho",
          is_legado: false,
          ambiente: "homologacao",
          turno: turno || null,
          data_colacao_grau: data_colacao || null,
          forma_acesso: dados_academicos?.forma_acesso || null,
          data_ingresso: dados_academicos?.data_ingresso || null,
          data_conclusao: dados_academicos?.data_conclusao || null,
          situacao_aluno: dados_academicos?.situacao_discente || null,
          codigo_curriculo: dados_academicos?.codigo_curriculo || null,
          carga_horaria_integralizada:
            dados_academicos?.carga_horaria_integralizada
              ? parseInt(dados_academicos.carga_horaria_integralizada) || null
              : null,
          // Snapshot imutável (F0.6) — rascunho, editável até ser travado
          dados_snapshot_extracao: dadosSnapshot,
          dados_snapshot_versao: dadosSnapshot ? 1 : null,
          dados_snapshot_gerado_em: dadosSnapshot
            ? new Date().toISOString()
            : null,
          dados_snapshot_travado: false,
        })
        .select("id")
        .single();

      if (errDiploma || !diploma) {
        console.error("[API] Erro ao criar diploma:", errDiploma?.message);
        await rollback(supabase, criados);
        return NextResponse.json(
          {
            error: `Erro ao criar diploma: ${errDiploma?.message || "Dados retornaram vazio"}`,
          },
          { status: 500 },
        );
      }
      criados.diploma_id = diploma.id;

      // ═══════════════════════════════════════════════════════════
      // 4) Inserir disciplinas
      // ═══════════════════════════════════════════════════════════
      if (Array.isArray(disciplinas) && disciplinas.length > 0) {
        const situacoesValidas = [
          "aprovado",
          "reprovado",
          "trancado",
          "cursando",
          "aproveitado",
          "dispensado",
        ];

        const rows = disciplinas.map((d: any, idx: number) => {
          let situacaoEnum: string = "aprovado"; // fallback seguro (NOT NULL no banco)
          if (d.situacao) {
            const sit = d.situacao.toLowerCase().trim();
            if (situacoesValidas.includes(sit)) {
              situacaoEnum = sit;
            } else if (sit.includes("aprov")) {
              situacaoEnum = "aprovado";
            } else if (sit.includes("reprov")) {
              situacaoEnum = "reprovado";
            } else if (sit.includes("tranc")) {
              situacaoEnum = "trancado";
            } else if (sit.includes("curs")) {
              situacaoEnum = "cursando";
            } else if (sit.includes("disp")) {
              situacaoEnum = "dispensado";
            }
          }

          return {
            diploma_id: criados.diploma_id,
            codigo: d.codigo || `DISC-${String(idx + 1).padStart(3, "0")}`,
            nome: d.nome || "Sem nome",
            periodo: d.periodo || null,
            situacao: situacaoEnum,
            carga_horaria_aula: d.carga_horaria
              ? parseInt(d.carga_horaria) || null
              : null,
            carga_horaria_relogio: d.ch_hora_relogio
              ? parseInt(d.ch_hora_relogio) || null
              : null,
            nota: d.nota ? parseFloat(d.nota) || null : null,
            nota_ate_cem: d.nota_ate_100
              ? parseFloat(d.nota_ate_100) || null
              : null,
            conceito: d.conceito || null,
            conceito_rm: d.conceito_rm || null,
            conceito_especifico: d.conceito_especifico || null,
            forma_integralizacao: d.forma_integralizada || null,
            etiqueta: d.etiqueta || null,
            docente_nome: d.nome_docente || null,
            docente_titulacao: d.titulacao_docente || null,
            ordem: idx + 1,
          };
        });

        const { error: errDisc } = await supabase
          .from("diploma_disciplinas")
          .insert(rows);

        if (errDisc) {
          console.error("[API] Erro ao inserir disciplinas:", errDisc.message);
          await rollback(supabase, criados);
          return NextResponse.json(
            { error: `Erro ao salvar disciplinas: ${errDisc.message}` },
            { status: 500 },
          );
        }
      }

      // ═══════════════════════════════════════════════════════════
      // 5) Inserir atividades complementares
      // ═══════════════════════════════════════════════════════════
      if (
        Array.isArray(atividades_complementares) &&
        atividades_complementares.length > 0
      ) {
        const rows = atividades_complementares.map((a: any) => ({
          diploma_id: criados.diploma_id,
          descricao: a.descricao || a.nome || "Sem descrição",
          carga_horaria_relogio: a.carga_horaria
            ? parseInt(a.carga_horaria) || null
            : null,
          tipo: a.tipo || null,
          data_inicio: a.data_inicio || null,
          data_fim: a.data_fim || null,
        }));

        const { error: errAtiv } = await supabase
          .from("diploma_atividades_complementares")
          .insert(rows);

        if (errAtiv) {
          console.error(
            "[API] Erro ao inserir atividades complementares:",
            errAtiv.message,
          );
          await rollback(supabase, criados);
          return NextResponse.json(
            {
              error: `Erro ao salvar atividades complementares: ${errAtiv.message}`,
            },
            { status: 500 },
          );
        }
      }

      // ═══════════════════════════════════════════════════════════
      // 6) Inserir estágios
      // ═══════════════════════════════════════════════════════════
      if (Array.isArray(estagios) && estagios.length > 0) {
        const rows = estagios.map((e: any) => ({
          diploma_id: criados.diploma_id,
          descricao: e.descricao || e.nome || "Sem descrição",
          carga_horaria_relogio: e.carga_horaria
            ? parseInt(e.carga_horaria) || null
            : null,
          concedente_razao_social: e.empresa || e.concedente || null,
          data_inicio: e.data_inicio || null,
          data_fim: e.data_fim || null,
        }));

        const { error: errEst } = await supabase
          .from("diploma_estagios")
          .insert(rows);

        if (errEst) {
          console.error("[API] Erro ao inserir estágios:", errEst.message);
          await rollback(supabase, criados);
          return NextResponse.json(
            { error: `Erro ao salvar estágios: ${errEst.message}` },
            { status: 500 },
          );
        }
      }

      // ═══════════════════════════════════════════════════════════
      // 7) Inserir habilitações
      // ═══════════════════════════════════════════════════════════
      if (Array.isArray(habilitacoes) && habilitacoes.length > 0) {
        const rows = habilitacoes.map((h: any) => ({
          diploma_id: criados.diploma_id,
          nome: h.nome || "Sem nome",
          data_habilitacao: h.data_conclusao || h.data_habilitacao || null,
        }));

        const { error: errHab } = await supabase
          .from("diploma_habilitacoes")
          .insert(rows);

        if (errHab) {
          console.error("[API] Erro ao inserir habilitações:", errHab.message);
          await rollback(supabase, criados);
          return NextResponse.json(
            { error: `Erro ao salvar habilitações: ${errHab.message}` },
            { status: 500 },
          );
        }
      }

      // ═══════════════════════════════════════════════════════════
      // 8) Inserir filiações (genitores do diplomado)
      // ═══════════════════════════════════════════════════════════
      const genitores = dados_diplomado?.genitores || [];
      if (Array.isArray(genitores) && genitores.length > 0) {
        // Primeiro, remover filiações anteriores deste diplomado (para upsert limpo)
        if (!criados.diplomado_era_novo) {
          await supabase
            .from("filiacoes")
            .delete()
            .eq("diplomado_id", criados.diplomado_id!);
        }

        const rows = genitores.map((g: any, idx: number) => {
          // Mapear sexo do frontend (Masculino/Feminino) para enum do banco (M/F)
          let sexoFiliacao: string | null = null;
          if (g.sexo) {
            const s = g.sexo.toLowerCase();
            if (s === "masculino" || s === "m") sexoFiliacao = "M";
            else if (s === "feminino" || s === "f") sexoFiliacao = "F";
          }

          return {
            diplomado_id: criados.diplomado_id,
            nome: g.nome || "Não informado",
            nome_social: g.nome_social || null,
            sexo: sexoFiliacao,
            ordem: idx + 1,
          };
        });

        const { error: errFil } = await supabase.from("filiacoes").insert(rows);

        if (errFil) {
          console.error("[API] Erro ao inserir filiações:", errFil.message);
          await rollback(supabase, criados);
          return NextResponse.json(
            { error: `Erro ao salvar filiações: ${errFil.message}` },
            { status: 500 },
          );
        }
      }

      // ═══════════════════════════════════════════════════════════
      // 8.5) Inserir dados ENADE
      // ═══════════════════════════════════════════════════════════
      const enade_situacao = dados_academicos?.enade_situacao || null;
      if (enade_situacao) {
        const { error: errEnade } = await supabase
          .from("diploma_enade")
          .insert({
            diploma_id: criados.diploma_id,
            situacao: enade_situacao,
            condicao: dados_academicos?.enade_condicao || null,
            ano_edicao: dados_academicos?.enade_edicao
              ? parseInt(dados_academicos.enade_edicao) || null
              : null,
          });

        if (errEnade) {
          console.error("[API] Erro ao inserir ENADE:", errEnade.message);
          await rollback(supabase, criados);
          return NextResponse.json(
            { error: `Erro ao salvar dados ENADE: ${errEnade.message}` },
            { status: 500 },
          );
        }
      }

      // ═══════════════════════════════════════════════════════════
      // 9) Atualizar total_diplomas do processo
      // ═══════════════════════════════════════════════════════════
      const { error: errTotal } = await supabase
        .from("processos_emissao")
        .update({ total_diplomas: 1 })
        .eq("id", processo.id);

      if (errTotal) {
        console.error(
          "[API] Erro ao atualizar total_diplomas:",
          errTotal.message,
        );
        // Não faz rollback — o processo e diploma já existem, só o contador ficou errado
        // Isso é recuperável e não compromete a integridade dos dados
      }

      // ═══════════════════════════════════════════════════════════
      // Tudo deu certo! Resposta final
      // ═══════════════════════════════════════════════════════════
      const formatted: ProcessoResponse = {
        id: processo.id,
        diploma_id: criados.diploma_id,
        nome: processo.nome,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        curso: (processo.cursos as any) || { nome: "", grau: "" },
        turno: processo.turno,
        periodo_letivo: processo.periodo_letivo,
        data_colacao: processo.data_colacao,
        status: processo.status,
        total_diplomas: 1,
        created_at: processo.created_at,
      };

      return NextResponse.json(formatted, { status: 201 });
    } catch (e) {
      // Erro inesperado (exceção JS, timeout, etc.) — rollback de tudo
      console.error("[API] Erro inesperado ao criar processo completo:", e);
      await rollback(supabase, criados);
      return NextResponse.json(
        { error: "Erro interno ao criar processo. Nenhum dado foi salvo." },
        { status: 500 },
      );
    }
  },
  { skipCSRF: true },
);
