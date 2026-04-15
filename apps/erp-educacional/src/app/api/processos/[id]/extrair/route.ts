import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { verificarAuth, erroNaoEncontrado } from "@/lib/security/api-guard";
import { callOpenRouter, callOpenRouterImage } from "@/lib/ai/openrouter";

interface ExtracaoDados {
  dados_extraidos: {
    diplomado?: {
      nome_completo?: string;
      cpf?: string;
      data_nascimento?: string;
      nacionalidade?: string;
      naturalidade_cidade?: string;
      naturalidade_uf?: string;
      nome_mae?: string;
      nome_pai?: string;
    };
    nome?: string;
    nome_social?: string;
    cpf?: string;
    ra?: string;
    data_nascimento?: string;
    sexo?: string;
    nacionalidade?: string;
    naturalidade_municipio?: string;
    naturalidade_uf?: string;
    rg_numero?: string;
    rg_orgao_expedidor?: string;
    rg_uf?: string;
    filiacao_mae?: string;
    filiacao_pai?: string;
    curso?: {
      nome?: string;
      grau?: string;
      modalidade?: string;
      carga_horaria?: number | null;
      data_inicio?: string;
      data_conclusao?: string;
      data_colacao?: string;
    };
    ies?: {
      nome?: string;
      cnpj?: string;
      codigo_mec?: string;
    };
    grau?: string;
    data_colacao?: string;
    data_conclusao?: string;
    data_ingresso?: string;
    forma_acesso?: string;
    periodo_letivo_conclusao?: string;
    situacao_enade?: string;
    disciplinas?: any[];
  };
  confianca_campos: Record<string, number>;
  confianca_geral: number;
  campos_faltando: string[];
  tipo_documento_detectado?: string;
  proxima_pergunta?: string;
  resumo_extraido?: string;
}

interface ExtracacaoResponse {
  sessao_id: string;
  diploma_id?: string;
  diplomado_id?: string;
  diplomado_nome?: string;
  mensagem_ia: string;
  dados_extraidos: ExtracaoDados["dados_extraidos"] | null;
  campos_faltando: string[];
  status: string;
  confianca_geral: number;
}

const PROMPT_EXTRACAO = `Você é um especialista em análise de documentação acadêmica brasileira. Seu objetivo é extrair dados precisos de documentos de diploma, transcrito acadêmico ou histórico escolar para emissão de diploma digital conforme Portaria MEC 70/2025.

INSTRUÇÕES CRÍTICAS:
1. Extraia TODOS os dados visíveis no documento
2. Para dados de identificação pessoal, busque em: CNH, RG, histórico, cabeçalho do documento
3. Para dados do curso, busque em: cabeçalho, rodapé, tabela de disciplinas, assinatura/carimbo
4. Para datas, padronize em formato YYYY-MM-DD
5. Atribua confiança (0.0-1.0) para cada campo baseado em clareza visual
6. Liste em campos_faltando apenas campos OBRIGATÓRIOS que faltam
7. Formule proxima_pergunta de forma natural e conversacional, em português

Retorne APENAS um JSON válido (sem markdown, sem marcadores de código), com esta estrutura exata:

{
  "dados_extraidos": {
    "diplomado": {
      "nome_completo": "",
      "cpf": "",
      "data_nascimento": "",
      "nacionalidade": "",
      "naturalidade_cidade": "",
      "naturalidade_uf": "",
      "nome_mae": "",
      "nome_pai": ""
    },
    "curso": {
      "nome": "",
      "grau": "",
      "modalidade": "",
      "carga_horaria": null,
      "data_inicio": "",
      "data_conclusao": "",
      "data_colacao": ""
    },
    "ies": {
      "nome": "",
      "cnpj": "",
      "codigo_mec": ""
    },
    "nome": "",
    "cpf": "",
    "ra": "",
    "data_colacao": "",
    "grau": "",
    "curso": "",
    "data_conclusao": ""
  },
  "confianca_campos": {
    "nome_completo": 0.95,
    "cpf": 0.90
  },
  "confianca_geral": 0.85,
  "campos_faltando": ["data_nascimento", "nome_mae"],
  "tipo_documento_detectado": "Diploma",
  "proxima_pergunta": "Consegui identificar o nome e CPF. Qual é a data de nascimento do(a) diplomado(a)?",
  "resumo_extraido": "Nome: João Silva | CPF: 123.456.789-00 | Curso: Enfermagem | Data de conclusão: 2023-12-15"
}

CAMPOS OBRIGATÓRIOS (para campo_faltando): nome_completo, cpf, data_colacao, curso, grau
CONFIANÇA: Atribua alta (0.9+) se o texto é claro; média (0.7-0.8) se está parcialmente visível; baixa (<0.7) se está em dúvida.`;

// POST - Extração com IA
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verificarAuth(request)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const supabase = await createClient();
  const processoId = id;

  try {
    const body = await request.json();
    const {
      diploma_id,
      arquivo_base64,
      arquivo_nome,
      arquivo_mime,
      resposta_usuario,
      sessao_id,
    } = body;

    let currentDiplomaId = diploma_id;
    let currentDiplomadoId: string | undefined;
    let diplomadoNome: string | undefined;

    // Se diploma_id não foi fornecido mas há arquivo, vamos criar automaticamente após extração
    const criarAutomaticamente = !diploma_id && arquivo_base64;

    // Se diploma_id foi fornecido, verifica se diploma pertence ao processo
    if (diploma_id) {
      const { data: diploma, error: diplomaError } = await supabase
        .from("diplomas")
        .select("id, processo_id, diplomado_id")
        .eq("id", diploma_id)
        .single();

      if (diplomaError || !diploma || diploma.processo_id !== processoId) {
        return erroNaoEncontrado();
      }

      currentDiplomadoId = diploma.diplomado_id;
    }

    // Busca ou cria sessão de extração
    let extracao: any;

    if (sessao_id) {
      // Busca sessão existente
      const { data: sess } = await supabase
        .from("extracao_sessoes")
        .select("*")
        .eq("id", sessao_id)
        .single();

      extracao = sess;
      if (extracao) {
        currentDiplomaId = extracao.diploma_id;
      }
    } else if (currentDiplomaId) {
      // Cria nova sessão com diploma_id existente
      const { data: novaSessao } = await supabase
        .from("extracao_sessoes")
        .insert({
          diploma_id: currentDiplomaId,
          processo_id: processoId,
          status: "em_progresso",
          historico_chat: [],
        })
        .select()
        .single();

      extracao = novaSessao;
    } else {
      // Modo de extração automática: cria sessão temporária
      // A sessão será vinculada ao diploma após sua criação
      const { data: novaSessao } = await supabase
        .from("extracao_sessoes")
        .insert({
          diploma_id: null,
          processo_id: processoId,
          status: "em_progresso",
          historico_chat: [],
        })
        .select()
        .single();

      extracao = novaSessao;
    }

    if (!extracao) {
      return NextResponse.json(
        { error: "Erro ao criar/buscar sessão de extração" },
        { status: 500 }
      );
    }

    let dadosExtraidos: ExtracaoDados | null = null;
    let mensagemIA = "";
    let proximaPergunta = "";

    // Caso 1: Upload de arquivo novo
    if (arquivo_base64 && arquivo_nome && arquivo_mime) {
      try {
        // Chamada à IA com imagem/documento
        const resposta = await callOpenRouterImage(
          arquivo_base64,
          arquivo_mime,
          PROMPT_EXTRACAO,
          { modelo: "anthropic/claude-opus-4" }
        );

        // Parse da resposta JSON
        const jsonMatch = resposta.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          dadosExtraidos = JSON.parse(jsonMatch[0]) as ExtracaoDados;
          proximaPergunta = dadosExtraidos?.proxima_pergunta || "";
        }
      } catch (iaError) {
        console.error("Erro ao chamar OpenRouter:", iaError);
        return NextResponse.json(
          {
            error: "Erro ao processar documento com IA",
            details: iaError instanceof Error ? iaError.message : "Desconhecido",
          },
          { status: 500 }
        );
      }
    }
    // Caso 2: Resposta do usuário continuando conversa
    else if (resposta_usuario && extracao.historico_chat) {
      try {
        // Construir contexto da conversa
        const historicoChat = extracao.historico_chat || [];
        const historicoFormatado = historicoChat
          .map((msg: any) => `${msg.role === "user" ? "Usuário" : "Assistente"}: ${msg.content}`)
          .join("\n");

        const promptContinuacao = `Você é um assistente de extração de dados acadêmicos. Continuando a conversa anterior:

${historicoFormatado}

Usuário responde: "${resposta_usuario}"

Com base nesta resposta, atualize os dados extraídos anteriormente e retorne o JSON completo com os novos dados incorporados. Se não há documento inicial e apenas conversação, tente extrair o máximo possível do histórico.

Retorne o JSON com a mesma estrutura de antes.`;

        const resposta = await callOpenRouter(
          [{ role: "user", content: promptContinuacao }],
          { modelo: "anthropic/claude-opus-4" }
        );

        const jsonMatch = resposta.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          dadosExtraidos = JSON.parse(jsonMatch[0]) as ExtracaoDados;
          proximaPergunta = dadosExtraidos?.proxima_pergunta || "";
        }
      } catch (iaError) {
        console.error("Erro ao continuar conversa:", iaError);
        return NextResponse.json(
          {
            error: "Erro ao processar resposta",
            details: iaError instanceof Error ? iaError.message : "Desconhecido",
          },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Arquivo ou resposta_usuario é obrigatório" },
        { status: 400 }
      );
    }

    // Atualiza sessão de extração
    if (dadosExtraidos) {
      const novoHistorico = [...(extracao.historico_chat || [])];

      if (arquivo_base64) {
        novoHistorico.push({
          role: "user",
          content: `[Arquivo enviado: ${arquivo_nome}]`,
        });
      } else if (resposta_usuario) {
        novoHistorico.push({
          role: "user",
          content: resposta_usuario,
        });
      }

      if (proximaPergunta) {
        novoHistorico.push({
          role: "assistant",
          content: proximaPergunta,
        });
        mensagemIA = proximaPergunta;
      }

      const statusExtracao =
        dadosExtraidos.campos_faltando.length === 0
          ? "confirmacao_pendente"
          : "em_progresso";

      // Se estamos em modo de criação automática e temos dados suficientes, cria diplomado e diploma
      if (criarAutomaticamente && dadosExtraidos && !currentDiplomaId) {
        try {
          // Extrai dados para criar diplomado
          const nomeCompleto =
            dadosExtraidos.dados_extraidos?.diplomado?.nome_completo ||
            dadosExtraidos.dados_extraidos?.nome ||
            "Nome não identificado";

          const cpf =
            dadosExtraidos.dados_extraidos?.diplomado?.cpf ||
            dadosExtraidos.dados_extraidos?.cpf ||
            null;

          const dataNascimento =
            dadosExtraidos.dados_extraidos?.diplomado?.data_nascimento ||
            dadosExtraidos.dados_extraidos?.data_nascimento ||
            null;

          const nacionalidade =
            dadosExtraidos.dados_extraidos?.diplomado?.nacionalidade ||
            "Brasileiro(a)";

          const naturalidadeCidade =
            dadosExtraidos.dados_extraidos?.diplomado?.naturalidade_cidade ||
            dadosExtraidos.dados_extraidos?.naturalidade_municipio ||
            null;

          const naturalidadeUf =
            dadosExtraidos.dados_extraidos?.diplomado?.naturalidade_uf ||
            dadosExtraidos.dados_extraidos?.naturalidade_uf ||
            null;

          const nomeMae =
            dadosExtraidos.dados_extraidos?.diplomado?.nome_mae ||
            dadosExtraidos.dados_extraidos?.filiacao_mae ||
            null;

          const nomePai =
            dadosExtraidos.dados_extraidos?.diplomado?.nome_pai ||
            dadosExtraidos.dados_extraidos?.filiacao_pai ||
            null;

          // 1. Criar diplomado
          const { data: novoDiplomado, error: diplomadoError } = await supabase
            .from("diplomados")
            .insert({
              nome: nomeCompleto,
              cpf: cpf,
              data_nascimento: dataNascimento,
              nacionalidade: nacionalidade,
              naturalidade_cidade: naturalidadeCidade,
              naturalidade_uf: naturalidadeUf,
              nome_mae: nomeMae,
              nome_pai: nomePai,
            })
            .select()
            .single();

          if (diplomadoError || !novoDiplomado) {
            console.error("Erro ao criar diplomado:", diplomadoError);
            return NextResponse.json(
              {
                error: "Erro ao criar diplomado",
                details: diplomadoError?.message || "Desconhecido",
              },
              { status: 500 }
            );
          }

          currentDiplomadoId = novoDiplomado.id;
          diplomadoNome = nomeCompleto;

          // 2. Criar diploma
          const dataConclusao =
            (dadosExtraidos.dados_extraidos?.curso as any)?.data_conclusao ||
            dadosExtraidos.dados_extraidos?.data_conclusao ||
            null;

          const { data: novoDiploma, error: diplomaError } = await supabase
            .from("diplomas")
            .insert({
              diplomado_id: novoDiplomado.id,
              processo_id: processoId,
              status: statusExtracao === "confirmacao_pendente" ? "pronto_para_xml" : "em_extracao",
              data_conclusao: dataConclusao,
            })
            .select()
            .single();

          if (diplomaError || !novoDiploma) {
            console.error("Erro ao criar diploma:", diplomaError);
            return NextResponse.json(
              {
                error: "Erro ao criar diploma",
                details: diplomaError?.message || "Desconhecido",
              },
              { status: 500 }
            );
          }

          currentDiplomaId = novoDiploma.id;

          // 3. Atualizar sessão de extração com diploma_id
          await supabase
            .from("extracao_sessoes")
            .update({
              diploma_id: novoDiploma.id,
            })
            .eq("id", extracao.id);

          // 4. Incrementar total_diplomas do processo
          const { data: proc, error: procError } = await supabase
            .from("processos_emissao")
            .select("total_diplomas")
            .eq("id", processoId)
            .single();

          if (proc && !procError) {
            const novoTotal = (proc.total_diplomas || 0) + 1;
            await supabase
              .from("processos_emissao")
              .update({ total_diplomas: novoTotal })
              .eq("id", processoId);
          }
        } catch (autoCreateError) {
          console.error("Erro na criação automática:", autoCreateError);
          return NextResponse.json(
            {
              error: "Erro ao criar diplomado automaticamente",
              details: autoCreateError instanceof Error ? autoCreateError.message : "Desconhecido",
            },
            { status: 500 }
          );
        }
      }

      // Atualiza sessão de extração com dados extraídos
      const { error: updateError } = await supabase
        .from("extracao_sessoes")
        .update({
          dados_extraidos: dadosExtraidos.dados_extraidos,
          dados_confirmados: null,
          campos_faltando: dadosExtraidos.campos_faltando,
          confianca_geral: dadosExtraidos.confianca_geral,
          confianca_campos: dadosExtraidos.confianca_campos,
          historico_chat: novoHistorico,
          status: statusExtracao,
          updated_at: new Date().toISOString(),
        })
        .eq("id", extracao.id);

      if (updateError) {
        console.error("Erro ao atualizar sessão:", updateError);
        return NextResponse.json(
          { error: "Erro ao salvar dados extraídos" },
          { status: 500 }
        );
      }

      // Atualiza status do diploma (se foi criado)
      if (currentDiplomaId) {
        await supabase
          .from("diplomas")
          .update({
            status: statusExtracao === "confirmacao_pendente" ? "pronto_para_xml" : "em_extracao",
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentDiplomaId);
      }
    }

    const response: ExtracacaoResponse = {
      sessao_id: extracao.id,
      diploma_id: currentDiplomaId,
      diplomado_id: currentDiplomadoId,
      diplomado_nome: diplomadoNome,
      mensagem_ia: mensagemIA,
      dados_extraidos: dadosExtraidos?.dados_extraidos || null,
      campos_faltando: dadosExtraidos?.campos_faltando || [],
      status: dadosExtraidos?.campos_faltando.length === 0 ? "confirmacao_pendente" : "em_progresso",
      confianca_geral: dadosExtraidos?.confianca_geral || 0,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Erro no endpoint de extração:", error);
    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Desconhecido",
      },
      { status: 500 }
    );
  }
}
