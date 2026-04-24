import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callOpenRouterText } from "@/lib/ai/openrouter";
import { verificarAuth } from "@/lib/security/api-guard";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// Campos auditados (Portaria MEC 554/2019 + IN SESU 1/2020)
const CAMPOS_OBRIGATORIOS = [
  { campo: "nome", label: "Nome do curso", grupo: "básico", peso: "crítico" },
  { campo: "grau", label: "Grau acadêmico", grupo: "básico", peso: "crítico" },
  {
    campo: "titulo_conferido",
    label: "Título conferido",
    grupo: "básico",
    peso: "crítico",
  },
  {
    campo: "modalidade",
    label: "Modalidade",
    grupo: "básico",
    peso: "crítico",
  },
  {
    campo: "carga_horaria_total",
    label: "Carga horária total",
    grupo: "básico",
    peso: "crítico",
  },
  {
    campo: "numero_reconhecimento",
    label: "Número do reconhecimento",
    grupo: "atos_oficiais",
    peso: "crítico",
  },
  {
    campo: "data_reconhecimento",
    label: "Data do reconhecimento",
    grupo: "atos_oficiais",
    peso: "crítico",
  },
  {
    campo: "veiculo_publicacao_reconhecimento",
    label: "Veículo publicação (reconhecimento)",
    grupo: "atos_oficiais",
    peso: "crítico",
  },
  {
    campo: "data_publicacao_reconhecimento",
    label: "Data publicação DOU (reconhecimento)",
    grupo: "atos_oficiais",
    peso: "crítico",
  },
  {
    campo: "numero_autorizacao",
    label: "Número da autorização",
    grupo: "atos_oficiais",
    peso: "importante",
  },
  {
    campo: "data_autorizacao",
    label: "Data da autorização",
    grupo: "atos_oficiais",
    peso: "importante",
  },
  {
    campo: "data_publicacao_autorizacao",
    label: "Data publicação DOU (autorização)",
    grupo: "atos_oficiais",
    peso: "importante",
  },
  {
    campo: "codigo_emec",
    label: "Código e-MEC",
    grupo: "identificação",
    peso: "crítico",
  },
  {
    campo: "numero_processo_emec",
    label: "Número do processo e-MEC",
    grupo: "identificação",
    peso: "importante",
  },
  {
    campo: "logradouro",
    label: "Logradouro",
    grupo: "endereço",
    peso: "importante",
  },
  {
    campo: "municipio",
    label: "Município",
    grupo: "endereço",
    peso: "crítico",
  },
  { campo: "uf", label: "UF", grupo: "endereço", peso: "crítico" },
  { campo: "cep", label: "CEP", grupo: "endereço", peso: "importante" },
  {
    campo: "coordenador_nome",
    label: "Nome do coordenador",
    grupo: "coordenador",
    peso: "recomendado",
  },
  {
    campo: "coordenador_email",
    label: "E-mail do coordenador",
    grupo: "coordenador",
    peso: "recomendado",
  },
  {
    campo: "carga_horaria_hora_relogio",
    label: "Carga horária (hora-relógio)",
    grupo: "carga_horaria",
    peso: "importante",
  },
  {
    campo: "numero_etapas",
    label: "Número de etapas",
    grupo: "pedagógico",
    peso: "recomendado",
  },
  {
    campo: "dias_letivos",
    label: "Dias letivos",
    grupo: "pedagógico",
    peso: "recomendado",
  },
  {
    campo: "duracao_hora_aula_minutos",
    label: "Duração da hora-aula (min)",
    grupo: "pedagógico",
    peso: "recomendado",
  },
  {
    campo: "vagas_autorizadas",
    label: "Vagas autorizadas",
    grupo: "operacional",
    peso: "importante",
  },
  {
    campo: "situacao_emec",
    label: "Situação e-MEC",
    grupo: "operacional",
    peso: "crítico",
  },
  {
    campo: "data_inicio_funcionamento",
    label: "Data de início do funcionamento",
    grupo: "operacional",
    peso: "importante",
  },
];

interface ItemFaltando {
  campo: string;
  label: string;
  grupo: string;
  peso: string;
}

function auditarCampos(curso: Record<string, unknown>) {
  const faltando: ItemFaltando[] = [];
  let preenchidos = 0;

  for (const item of CAMPOS_OBRIGATORIOS) {
    const valor = curso[item.campo];
    const vazio =
      valor === null || valor === undefined || valor === "" || valor === 0;
    if (vazio) {
      faltando.push({
        campo: item.campo,
        label: item.label,
        grupo: item.grupo,
        peso: item.peso,
      });
    } else {
      preenchidos++;
    }
  }

  const total = CAMPOS_OBRIGATORIOS.length;
  const percentual = Math.round((preenchidos / total) * 100);
  const criticosFaltando = faltando.filter((f) => f.peso === "crítico").length;
  const importantesFaltando = faltando.filter(
    (f) => f.peso === "importante",
  ).length;

  let status: "ok" | "atencao" | "critico";
  if (criticosFaltando === 0 && importantesFaltando === 0) status = "ok";
  else if (criticosFaltando === 0) status = "atencao";
  else status = "critico";

  return { faltando, preenchidos, total, percentual, status, criticosFaltando };
}

export async function POST(request: NextRequest) {
  const auth = await verificarAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { instituicao_id, modo, curso_id } = await request.json();
    const supabase = await createClient();

    let query = supabase.from("cursos").select("*").eq("ativo", true);
    if (instituicao_id) query = query.eq("instituicao_id", instituicao_id);
    if (curso_id) query = query.eq("id", curso_id);

    const { data: cursos, error } = await query;
    if (error) {
      console.error(
        "[API] Erro ao buscar cursos para auditoria:",
        error.message,
      );
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 },
      );
    }
    if (!cursos || cursos.length === 0) {
      return NextResponse.json(
        { error: "Nenhum curso encontrado" },
        { status: 404 },
      );
    }

    // Auditoria de campos
    const auditoriaBasica = cursos.map((curso) => ({
      id: curso.id,
      nome: curso.nome,
      codigo_emec: curso.codigo_emec,
      grau: curso.grau,
      modalidade: curso.modalidade,
      ...auditarCampos(curso as Record<string, unknown>),
    }));

    const totalCursos = auditoriaBasica.length;
    const cursosOk = auditoriaBasica.filter((c) => c.status === "ok").length;
    const cursosAtencao = auditoriaBasica.filter(
      (c) => c.status === "atencao",
    ).length;
    const cursosCriticos = auditoriaBasica.filter(
      (c) => c.status === "critico",
    ).length;
    const mediaCompletude = Math.round(
      auditoriaBasica.reduce((acc, c) => acc + c.percentual, 0) / totalCursos,
    );

    // Modo simples — sem IA
    if (modo === "simples") {
      return NextResponse.json({
        cursos: auditoriaBasica,
        resumo: {
          totalCursos,
          cursosOk,
          cursosAtencao,
          cursosCriticos,
          mediaCompletude,
        },
      });
    }

    // Modo completo — análise IA via OpenRouter
    let analiseIA = "";

    const cursosProblema = auditoriaBasica
      .filter((c) => c.status !== "ok")
      .slice(0, 8);

    if (cursosProblema.length > 0) {
      const cursosResumo = cursosProblema.map((c) => ({
        nome: c.nome,
        codigo_emec: c.codigo_emec,
        grau: c.grau,
        campos_faltando: c.faltando.map((f) => `${f.label} (${f.peso})`),
        completude: `${c.percentual}%`,
        status: c.status,
      }));

      const prompt = `Analise os cursos abaixo e gere recomendações práticas para completar os dados faltantes. Para cada curso, indique a prioridade de ação e onde encontrar cada dado faltante (e-MEC, DOU, PPC, Unimestre, secretaria).

CURSOS COM PROBLEMAS:
${JSON.stringify(cursosResumo, null, 2)}`;

      try {
        analiseIA = await callOpenRouterText(prompt, {
          modulo: "cadastro",
          funcionalidade: "auditoria_cursos",
          maxTokens: 3072,
          temperatura: 0.2,
        });
      } catch (iaErr) {
        const msg = iaErr instanceof Error ? iaErr.message : String(iaErr);
        if (msg.includes("não configurada")) {
          analiseIA = `⚠️ ${msg}`;
        } else {
          analiseIA = "Análise IA não disponível no momento.";
        }
      }
    } else {
      analiseIA =
        "✅ Todos os cursos analisados estão com dados completos para emissão de Diploma Digital.";
    }

    return NextResponse.json({
      cursos: auditoriaBasica,
      resumo: {
        totalCursos,
        cursosOk,
        cursosAtencao,
        cursosCriticos,
        mediaCompletude,
      },
      analise_ia: analiseIA,
    });
  } catch (error) {
    console.error("Erro na auditoria:", error);
    return NextResponse.json(
      {
        error: "Erro interno do servidor",
      },
      { status: 500 },
    );
  }
}
