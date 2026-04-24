import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callOpenRouterText } from "@/lib/ai/openrouter";
import { verificarAuth, erroInterno } from "@/lib/security/api-guard";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// Campos com suas prioridades para merge inteligente
// Quanto maior o peso, mais importante é o campo na decisão
const CAMPOS_MERGE = [
  // Básico / Identidade
  { campo: "nome", label: "Nome do curso", grupo: "básico", peso: 10 },
  { campo: "grau", label: "Grau acadêmico", grupo: "básico", peso: 10 },
  {
    campo: "titulo_conferido",
    label: "Título conferido",
    grupo: "básico",
    peso: 9,
  },
  { campo: "modalidade", label: "Modalidade", grupo: "básico", peso: 9 },
  { campo: "codigo_emec", label: "Código e-MEC", grupo: "básico", peso: 10 },
  { campo: "situacao_emec", label: "Situação e-MEC", grupo: "básico", peso: 8 },
  // Atos oficiais
  {
    campo: "numero_reconhecimento",
    label: "Nº do reconhecimento",
    grupo: "atos_oficiais",
    peso: 10,
  },
  {
    campo: "data_reconhecimento",
    label: "Data do reconhecimento",
    grupo: "atos_oficiais",
    peso: 9,
  },
  {
    campo: "veiculo_publicacao_reconhecimento",
    label: "Veículo publicação (reconhecimento)",
    grupo: "atos_oficiais",
    peso: 7,
  },
  {
    campo: "data_publicacao_reconhecimento",
    label: "Data publicação DOU (reconhecimento)",
    grupo: "atos_oficiais",
    peso: 9,
  },
  {
    campo: "secao_publicacao_reconhecimento",
    label: "Seção DOU (reconhecimento)",
    grupo: "atos_oficiais",
    peso: 6,
  },
  {
    campo: "pagina_publicacao_reconhecimento",
    label: "Página DOU (reconhecimento)",
    grupo: "atos_oficiais",
    peso: 5,
  },
  {
    campo: "numero_dou_reconhecimento",
    label: "Nº DOU (reconhecimento)",
    grupo: "atos_oficiais",
    peso: 6,
  },
  {
    campo: "tipo_reconhecimento",
    label: "Tipo de reconhecimento",
    grupo: "atos_oficiais",
    peso: 6,
  },
  {
    campo: "numero_autorizacao",
    label: "Nº da autorização",
    grupo: "atos_oficiais",
    peso: 8,
  },
  {
    campo: "data_autorizacao",
    label: "Data da autorização",
    grupo: "atos_oficiais",
    peso: 7,
  },
  {
    campo: "veiculo_publicacao_autorizacao",
    label: "Veículo publicação (autorização)",
    grupo: "atos_oficiais",
    peso: 6,
  },
  {
    campo: "data_publicacao_autorizacao",
    label: "Data publicação DOU (autorização)",
    grupo: "atos_oficiais",
    peso: 7,
  },
  {
    campo: "secao_publicacao_autorizacao",
    label: "Seção DOU (autorização)",
    grupo: "atos_oficiais",
    peso: 5,
  },
  {
    campo: "pagina_publicacao_autorizacao",
    label: "Página DOU (autorização)",
    grupo: "atos_oficiais",
    peso: 4,
  },
  {
    campo: "numero_dou_autorizacao",
    label: "Nº DOU (autorização)",
    grupo: "atos_oficiais",
    peso: 5,
  },
  {
    campo: "tipo_autorizacao",
    label: "Tipo de autorização",
    grupo: "atos_oficiais",
    peso: 5,
  },
  {
    campo: "numero_renovacao",
    label: "Nº da renovação",
    grupo: "atos_oficiais",
    peso: 7,
  },
  {
    campo: "data_renovacao",
    label: "Data da renovação",
    grupo: "atos_oficiais",
    peso: 6,
  },
  {
    campo: "data_publicacao_renovacao",
    label: "Data publicação DOU (renovação)",
    grupo: "atos_oficiais",
    peso: 6,
  },
  {
    campo: "veiculo_publicacao_renovacao",
    label: "Veículo publicação (renovação)",
    grupo: "atos_oficiais",
    peso: 5,
  },
  {
    campo: "tipo_renovacao",
    label: "Tipo de renovação",
    grupo: "atos_oficiais",
    peso: 5,
  },
  // E-MEC
  {
    campo: "numero_processo_emec",
    label: "Nº processo e-MEC",
    grupo: "emec",
    peso: 8,
  },
  {
    campo: "tipo_processo_emec",
    label: "Tipo processo e-MEC",
    grupo: "emec",
    peso: 5,
  },
  {
    campo: "data_processo_emec",
    label: "Data processo e-MEC",
    grupo: "emec",
    peso: 5,
  },
  // Carga horária
  {
    campo: "carga_horaria_total",
    label: "Carga horária total",
    grupo: "carga_horaria",
    peso: 9,
  },
  {
    campo: "carga_horaria_hora_relogio",
    label: "Carga horária (hora-relógio)",
    grupo: "carga_horaria",
    peso: 7,
  },
  {
    campo: "carga_horaria_integralizada",
    label: "Carga horária integralizada",
    grupo: "carga_horaria",
    peso: 6,
  },
  {
    campo: "carga_horaria_estagio",
    label: "Carga horária estágio",
    grupo: "carga_horaria",
    peso: 6,
  },
  {
    campo: "carga_horaria_atividades_complementares",
    label: "Carga horária ativ. complementares",
    grupo: "carga_horaria",
    peso: 6,
  },
  {
    campo: "carga_horaria_tcc",
    label: "Carga horária TCC",
    grupo: "carga_horaria",
    peso: 6,
  },
  // Endereço
  { campo: "logradouro", label: "Logradouro", grupo: "endereco", peso: 6 },
  { campo: "numero", label: "Número", grupo: "endereco", peso: 5 },
  { campo: "bairro", label: "Bairro", grupo: "endereco", peso: 5 },
  { campo: "municipio", label: "Município", grupo: "endereco", peso: 8 },
  { campo: "uf", label: "UF", grupo: "endereco", peso: 8 },
  { campo: "cep", label: "CEP", grupo: "endereco", peso: 6 },
  {
    campo: "codigo_municipio",
    label: "Código do município",
    grupo: "endereco",
    peso: 5,
  },
  // Coordenador
  {
    campo: "coordenador_nome",
    label: "Nome do coordenador",
    grupo: "coordenador",
    peso: 7,
  },
  {
    campo: "coordenador_email",
    label: "E-mail do coordenador",
    grupo: "coordenador",
    peso: 6,
  },
  {
    campo: "coordenador_telefone",
    label: "Telefone do coordenador",
    grupo: "coordenador",
    peso: 5,
  },
  // Operacional
  {
    campo: "vagas_autorizadas",
    label: "Vagas autorizadas",
    grupo: "operacional",
    peso: 7,
  },
  {
    campo: "periodicidade",
    label: "Periodicidade",
    grupo: "operacional",
    peso: 6,
  },
  {
    campo: "data_inicio_funcionamento",
    label: "Data início funcionamento",
    grupo: "operacional",
    peso: 7,
  },
  {
    campo: "unidade_certificadora",
    label: "Unidade certificadora",
    grupo: "operacional",
    peso: 7,
  },
  // Classificação
  {
    campo: "cine_area_geral",
    label: "CINE área geral",
    grupo: "classificacao",
    peso: 6,
  },
  {
    campo: "cine_rotulo",
    label: "CINE rótulo",
    grupo: "classificacao",
    peso: 6,
  },
  {
    campo: "codigo_grau_mec",
    label: "Código grau MEC",
    grupo: "classificacao",
    peso: 6,
  },
  {
    campo: "codigo_habilitacao_mec",
    label: "Código habilitação MEC",
    grupo: "classificacao",
    peso: 5,
  },
  {
    campo: "descricao_habilitacao",
    label: "Descrição da habilitação",
    grupo: "classificacao",
    peso: 5,
  },
  // Indicadores
  {
    campo: "conceito_curso",
    label: "Conceito do curso (CC)",
    grupo: "indicadores",
    peso: 7,
  },
  { campo: "ano_cc", label: "Ano CC", grupo: "indicadores", peso: 5 },
  { campo: "cpc_faixa", label: "CPC faixa", grupo: "indicadores", peso: 6 },
  {
    campo: "cpc_continuo",
    label: "CPC contínuo",
    grupo: "indicadores",
    peso: 5,
  },
  { campo: "cpc_ano", label: "Ano CPC", grupo: "indicadores", peso: 5 },
  {
    campo: "enade_conceito",
    label: "ENADE conceito",
    grupo: "indicadores",
    peso: 6,
  },
  { campo: "enade_ano", label: "Ano ENADE", grupo: "indicadores", peso: 5 },
  // Pedagógico
  {
    campo: "numero_etapas",
    label: "Nº de etapas",
    grupo: "pedagogico",
    peso: 5,
  },
  {
    campo: "duracao_hora_aula_minutos",
    label: "Duração hora-aula (min)",
    grupo: "pedagogico",
    peso: 4,
  },
  {
    campo: "dias_letivos",
    label: "Dias letivos",
    grupo: "pedagogico",
    peso: 4,
  },
  {
    campo: "objetivo_curso",
    label: "Objetivo do curso",
    grupo: "pedagogico",
    peso: 5,
  },
  {
    campo: "periodo_divisao_turmas",
    label: "Período divisão turmas",
    grupo: "pedagogico",
    peso: 4,
  },
  { campo: "enfase", label: "Ênfase", grupo: "pedagogico", peso: 4 },
];

type ValorCampo = string | number | boolean | null | undefined;

function isVazio(valor: ValorCampo): boolean {
  return valor === null || valor === undefined || valor === "" || valor === 0;
}

interface SugestaoMerge {
  campo: string;
  label: string;
  grupo: string;
  valores: Array<{ cursoId: string; cursoNome: string; valor: ValorCampo }>;
  valor_sugerido: ValorCampo;
  fonte_sugerida: string;
  conflito: boolean;
}

function calcularMerge(cursos: Record<string, ValorCampo>[]): {
  merged: Record<string, ValorCampo>;
  sugestoes: SugestaoMerge[];
  campos_com_conflito: number;
  campos_preenchidos: number;
} {
  const merged: Record<string, ValorCampo> = {};
  const sugestoes: SugestaoMerge[] = [];
  let campos_com_conflito = 0;
  let campos_preenchidos = 0;

  for (const def of CAMPOS_MERGE) {
    const { campo, label, grupo } = def;

    // Coleta valores de cada curso para este campo
    const valores = cursos.map((c, idx) => ({
      cursoId: String(c.id || idx),
      cursoNome: String(c.nome || `Curso ${idx + 1}`),
      valor: c[campo] as ValorCampo,
    }));

    // Filtra não-vazios
    const naoVazios = valores.filter((v) => !isVazio(v.valor));

    if (naoVazios.length === 0) {
      // Nenhum curso tem este campo
      merged[campo] = null;
      continue;
    }

    campos_preenchidos++;

    // Verifica conflito: se há mais de um valor distinto (ignorando null/undefined/"")
    const valoresSet = new Set(naoVazios.map((v) => String(v.valor).trim()));
    const valoresDistintos = Array.from(valoresSet);
    const temConflito = valoresDistintos.length > 1;

    if (temConflito) {
      campos_com_conflito++;
    }

    // Valor sugerido: o primeiro não-vazio (todos os cursos têm mesmo peso aqui; ordem = importância)
    // Preferência: curso com mais campos preenchidos → tomado na camada acima
    const sugerido = naoVazios[0];
    merged[campo] = sugerido.valor;

    sugestoes.push({
      campo,
      label,
      grupo,
      valores,
      valor_sugerido: sugerido.valor,
      fonte_sugerida: sugerido.cursoNome,
      conflito: temConflito,
    });
  }

  // Campos fixos que sempre devem vir do curso "principal" (primeiro com mais preenchimentos)
  // instituicao_id e departamento_id
  const fixos = ["instituicao_id", "departamento_id"];
  for (const campo of fixos) {
    const naoVazios = cursos.filter((c) => !isVazio(c[campo] as ValorCampo));
    merged[campo] = naoVazios.length > 0 ? naoVazios[0][campo] : null;
  }

  return { merged, sugestoes, campos_com_conflito, campos_preenchidos };
}

// GET: Preview do merge (não salva)
export async function POST(request: NextRequest) {
  const auth = await verificarAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { ids, modo, dados_finais, ids_deletar } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length < 2) {
      return NextResponse.json(
        { error: "Selecione pelo menos 2 cursos para mesclar." },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Busca os cursos
    const { data: cursos, error } = await supabase
      .from("cursos")
      .select("*")
      .in("id", ids);

    if (error) {
      console.error("[API] Erro ao buscar cursos para merge:", error.message);
      return erroInterno();
    }
    if (!cursos || cursos.length < 2) {
      return NextResponse.json(
        { error: "Não foi possível encontrar os cursos selecionados." },
        { status: 404 },
      );
    }

    // Ordena os cursos pela quantidade de campos preenchidos (mais completo primeiro)
    const cursosOrdenados = [...cursos].sort((a, b) => {
      const preenchidosA = CAMPOS_MERGE.filter(
        (def) => !isVazio(a[def.campo] as ValorCampo),
      ).length;
      const preenchidosB = CAMPOS_MERGE.filter(
        (def) => !isVazio(b[def.campo] as ValorCampo),
      ).length;
      return preenchidosB - preenchidosA;
    });

    // Modo "preview": retorna sugestões sem salvar
    if (modo === "preview") {
      const { merged, sugestoes, campos_com_conflito, campos_preenchidos } =
        calcularMerge(cursosOrdenados);

      // Análise IA opcional para campos com conflito
      let analiseIA = "";
      const conflitos = sugestoes.filter((s) => s.conflito);

      if (conflitos.length > 0) {
        const resumoConflitos = conflitos.map((c) => ({
          campo: c.label,
          valores: c.valores
            .filter((v) => !isVazio(v.valor))
            .map((v) => `${v.cursoNome}: "${v.valor}"`),
        }));

        const prompt = `Você está ajudando a mesclar registros duplicados de cursos acadêmicos de uma instituição de ensino superior (IES).

Abaixo estão os campos com CONFLITO entre os registros — ou seja, campos onde os cursos têm valores diferentes.
Para cada campo, sugira qual valor é o mais correto e explique brevemente o motivo.

Priorize: dados mais específicos, mais recentes, e que sigam o padrão do MEC/e-MEC.

CONFLITOS:
${JSON.stringify(resumoConflitos, null, 2)}`;

        try {
          analiseIA = await callOpenRouterText(prompt, {
            modulo: "cadastro",
            funcionalidade: "merge_cursos",
            maxTokens: 2048,
            temperatura: 0.1,
          });
        } catch {
          analiseIA = "";
        }
      }

      return NextResponse.json({
        cursos: cursosOrdenados.map((c) => ({
          id: c.id,
          nome: c.nome,
          codigo_emec: c.codigo_emec,
          grau: c.grau,
          modalidade: c.modalidade,
          campos_preenchidos: CAMPOS_MERGE.filter(
            (def) => !isVazio(c[def.campo] as ValorCampo),
          ).length,
          total_campos: CAMPOS_MERGE.length,
        })),
        merged,
        sugestoes,
        campos_com_conflito,
        campos_preenchidos,
        analise_ia: analiseIA,
      });
    }

    // Modo "salvar": recebe dados_finais e aplica
    if (modo === "salvar") {
      if (!dados_finais || typeof dados_finais !== "object") {
        return NextResponse.json(
          { error: "dados_finais é obrigatório no modo salvar." },
          { status: 400 },
        );
      }

      // Determina qual curso vai ser o "sobrevivente" (primeiro da lista, mais completo)
      const cursoBase = cursosOrdenados[0];

      // Atualiza o curso base com os dados finais
      const { error: updateError } = await supabase
        .from("cursos")
        .update({ ...dados_finais, updated_at: new Date().toISOString() })
        .eq("id", cursoBase.id);

      if (updateError)
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 },
        );

      // Deleta os outros cursos (se ids_deletar foi informado)
      const idsParaDeletar = ids_deletar
        ? ids.filter(
            (id: string) => ids_deletar.includes(id) && id !== cursoBase.id,
          )
        : ids.filter((id: string) => id !== cursoBase.id);

      if (idsParaDeletar.length > 0) {
        const { error: deleteError } = await supabase
          .from("cursos")
          .delete()
          .in("id", idsParaDeletar);

        if (deleteError)
          return NextResponse.json(
            { error: deleteError.message },
            { status: 500 },
          );
      }

      return NextResponse.json({
        sucesso: true,
        curso_id: cursoBase.id,
        curso_nome: dados_finais.nome || cursoBase.nome,
        deletados: idsParaDeletar.length,
      });
    }

    return NextResponse.json(
      { error: "Modo inválido. Use 'preview' ou 'salvar'." },
      { status: 400 },
    );
  } catch (error) {
    console.error("Erro no merge:", error);
    return erroInterno();
  }
}
