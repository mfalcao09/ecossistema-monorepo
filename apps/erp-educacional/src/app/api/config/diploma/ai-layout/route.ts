import { NextRequest, NextResponse } from "next/server";
import { protegerRota, erroInterno } from "@/lib/security/api-guard";
import type {
  HistoricoColunaConfig,
  HistoricoFormatacaoRegra,
  HistoricoSecoesConfig,
} from "@/types/diploma-config";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// Template configurations for different course types
const TEMPLATES = {
  saude: {
    colunas: [
      {
        campo: "codigo",
        label: "Código",
        visivel: true,
        ordem: 1,
        largura: 80,
      },
      {
        campo: "nome",
        label: "Disciplina",
        visivel: true,
        ordem: 2,
        largura: 250,
      },
      {
        campo: "periodo",
        label: "Período",
        visivel: true,
        ordem: 3,
        largura: 70,
      },
      {
        campo: "carga_horaria_aula",
        label: "C.H. Aula",
        visivel: true,
        ordem: 4,
        largura: 80,
      },
      {
        campo: "carga_horaria_relogio",
        label: "C.H. Relógio",
        visivel: true,
        ordem: 5,
        largura: 80,
      },
      { campo: "nota", label: "Nota", visivel: true, ordem: 6, largura: 60 },
      {
        campo: "conceito_especifico",
        label: "Conceito",
        visivel: true,
        ordem: 7,
        largura: 80,
      },
      {
        campo: "situacao",
        label: "Situação",
        visivel: true,
        ordem: 8,
        largura: 100,
      },
    ] as HistoricoColunaConfig[],
    secoes: {
      agrupar_por: "etiqueta" as const,
      formato_cabecalho_grupo: "UNIDADE DE APRENDIZAGEM: {valor}",
      exibir_subtotal_ch: true,
      separador_visual: "destaque" as const,
      secoes_personalizadas: [],
    } as HistoricoSecoesConfig,
    formatacao: [] as HistoricoFormatacaoRegra[],
    corCabecalho: "#0F766E",
    formatoNota: "conceito",
  },
  exatas: {
    colunas: [
      {
        campo: "codigo",
        label: "Código",
        visivel: true,
        ordem: 1,
        largura: 80,
      },
      {
        campo: "nome",
        label: "Disciplina",
        visivel: true,
        ordem: 2,
        largura: 250,
      },
      {
        campo: "periodo",
        label: "Período",
        visivel: true,
        ordem: 3,
        largura: 70,
      },
      {
        campo: "carga_horaria_aula",
        label: "Aula",
        visivel: true,
        ordem: 4,
        largura: 60,
      },
      {
        campo: "carga_horaria_relogio",
        label: "Prática",
        visivel: true,
        ordem: 5,
        largura: 60,
      },
      { campo: "nota", label: "Nota", visivel: true, ordem: 6, largura: 60 },
      {
        campo: "situacao",
        label: "Situação",
        visivel: true,
        ordem: 7,
        largura: 100,
      },
      {
        campo: "forma_integralizacao",
        label: "Forma Integr.",
        visivel: true,
        ordem: 8,
        largura: 120,
      },
    ] as HistoricoColunaConfig[],
    secoes: {
      agrupar_por: "periodo" as const,
      formato_cabecalho_grupo: "{numero}º Semestre",
      exibir_subtotal_ch: true,
      separador_visual: "linha" as const,
      secoes_personalizadas: [],
    } as HistoricoSecoesConfig,
    formatacao: [] as HistoricoFormatacaoRegra[],
    corCabecalho: "#1E40AF",
    formatoNota: "numerica",
  },
  licenciatura: {
    colunas: [
      {
        campo: "codigo",
        label: "Código",
        visivel: true,
        ordem: 1,
        largura: 80,
      },
      {
        campo: "nome",
        label: "Componente Curricular",
        visivel: true,
        ordem: 2,
        largura: 300,
      },
      { campo: "periodo", label: "Per.", visivel: true, ordem: 3, largura: 50 },
      {
        campo: "carga_horaria_aula",
        label: "Horas",
        visivel: true,
        ordem: 4,
        largura: 70,
      },
      {
        campo: "nota",
        label: "Conceito",
        visivel: true,
        ordem: 5,
        largura: 70,
      },
      {
        campo: "situacao",
        label: "Situação",
        visivel: true,
        ordem: 6,
        largura: 100,
      },
      {
        campo: "docente_nome",
        label: "Docente",
        visivel: true,
        ordem: 7,
        largura: 200,
      },
    ] as HistoricoColunaConfig[],
    secoes: {
      agrupar_por: "periodo" as const,
      formato_cabecalho_grupo: "{numero}º Período",
      exibir_subtotal_ch: true,
      separador_visual: "destaque" as const,
      secoes_personalizadas: [],
    } as HistoricoSecoesConfig,
    formatacao: [] as HistoricoFormatacaoRegra[],
    corCabecalho: "#2F5233",
    formatoNota: "mista",
  },
  tecnologo: {
    colunas: [
      {
        campo: "codigo",
        label: "Código",
        visivel: true,
        ordem: 1,
        largura: 70,
      },
      { campo: "nome", label: "Módulo", visivel: true, ordem: 2, largura: 280 },
      {
        campo: "carga_horaria_aula",
        label: "Horas",
        visivel: true,
        ordem: 3,
        largura: 70,
      },
      { campo: "nota", label: "Nota", visivel: true, ordem: 4, largura: 60 },
      {
        campo: "situacao",
        label: "Situação",
        visivel: true,
        ordem: 5,
        largura: 100,
      },
    ] as HistoricoColunaConfig[],
    secoes: {
      agrupar_por: "nenhum" as const,
      formato_cabecalho_grupo: "Módulos",
      exibir_subtotal_ch: true,
      separador_visual: "espaco" as const,
      secoes_personalizadas: [],
    } as HistoricoSecoesConfig,
    formatacao: [] as HistoricoFormatacaoRegra[],
    corCabecalho: "#E67E22",
    formatoNota: "numerica",
  },
  humanas: {
    colunas: [
      {
        campo: "codigo",
        label: "Código",
        visivel: true,
        ordem: 1,
        largura: 80,
      },
      {
        campo: "nome",
        label: "Disciplina",
        visivel: true,
        ordem: 2,
        largura: 280,
      },
      { campo: "periodo", label: "Sem.", visivel: true, ordem: 3, largura: 50 },
      {
        campo: "carga_horaria_aula",
        label: "C.H.",
        visivel: true,
        ordem: 4,
        largura: 60,
      },
      { campo: "nota", label: "Nota", visivel: true, ordem: 5, largura: 60 },
      {
        campo: "situacao",
        label: "Situação",
        visivel: true,
        ordem: 6,
        largura: 100,
      },
    ] as HistoricoColunaConfig[],
    secoes: {
      agrupar_por: "periodo" as const,
      formato_cabecalho_grupo: "{numero}º Período",
      exibir_subtotal_ch: true,
      separador_visual: "linha" as const,
      secoes_personalizadas: [],
    } as HistoricoSecoesConfig,
    formatacao: [] as HistoricoFormatacaoRegra[],
    corCabecalho: "#1A3A6B",
    formatoNota: "numerica",
  },
};

// POST /api/config/diploma/ai-layout
// Body: { prompt: string }
// Smart rule-based layout generator (TODO: replace with real LLM when API key configured)
export const POST = protegerRota(
  async (request: NextRequest) => {
    try {
      const body = await request.json();
      const { prompt } = body;

      if (!prompt || typeof prompt !== "string") {
        return NextResponse.json(
          { error: 'Campo "prompt" é obrigatório e deve ser uma string' },
          { status: 400 },
        );
      }

      // TODO: Replace with real LLM call (Anthropic/OpenAI) when API key is configured
      // For now, implement smart rule-based parsing

      const promptLower = prompt.toLowerCase();
      let selectedTemplate = TEMPLATES.humanas; // default
      const rulesApplied: string[] = [];
      let docente_visivel = true;
      let notaBaixaFormatting = false;

      // Template selection rules
      if (
        promptLower.includes("medicina") ||
        promptLower.includes("saúde") ||
        promptLower.includes("enfermagem") ||
        promptLower.includes("conceito")
      ) {
        selectedTemplate = TEMPLATES.saude;
        rulesApplied.push("Template Saúde aplicado");
      } else if (
        promptLower.includes("engenharia") ||
        promptLower.includes("exatas") ||
        promptLower.includes("computação") ||
        promptLower.includes("sistemas") ||
        promptLower.includes("software")
      ) {
        selectedTemplate = TEMPLATES.exatas;
        rulesApplied.push("Template Exatas aplicado");
      } else if (
        promptLower.includes("licenciatura") ||
        promptLower.includes("pedagogia") ||
        promptLower.includes("professor") ||
        promptLower.includes("docência")
      ) {
        selectedTemplate = TEMPLATES.licenciatura;
        rulesApplied.push("Template Licenciatura aplicado");
      } else if (
        promptLower.includes("tecnólogo") ||
        promptLower.includes("compacto") ||
        promptLower.includes("técnico")
      ) {
        selectedTemplate = TEMPLATES.tecnologo;
        rulesApplied.push("Template Tecnólogo aplicado");
      } else if (
        promptLower.includes("ufms") ||
        promptLower.includes("modelo")
      ) {
        selectedTemplate = TEMPLATES.humanas;
        rulesApplied.push("Template Humanas (UFMS) aplicado");
      }

      // Visibility rules
      if (
        promptLower.includes("sem docente") ||
        promptLower.includes("sem professor") ||
        promptLower.includes("sem nome do docente")
      ) {
        docente_visivel = false;
        rulesApplied.push("Campo docente ocultado");
      }

      // Conditional formatting rules
      if (
        promptLower.includes("vermelho") &&
        (promptLower.includes("nota") || promptLower.includes("baixa"))
      ) {
        notaBaixaFormatting = true;
        rulesApplied.push("Formatação condicional para notas baixas ativada");
      }

      // Update docente visibility in colunas
      const colunasAtualizada = selectedTemplate.colunas.map((col) => ({
        ...col,
        visivel: col.campo === "docente_nome" ? docente_visivel : col.visivel,
      }));

      // Build formatting rules
      let formatacaoRegras: HistoricoFormatacaoRegra[] = [
        ...selectedTemplate.formatacao,
      ];
      if (notaBaixaFormatting) {
        formatacaoRegras.push({
          id: "nota_baixa",
          campo: "nota",
          operador: "<",
          valor: "5",
          cor_texto: "#DC2626",
          cor_fundo: "#FEF2F2",
          negrito: true,
          ativo: true,
        });
      }

      const response = {
        colunas: colunasAtualizada,
        secoes: selectedTemplate.secoes,
        formatacao: formatacaoRegras,
        corCabecalho: selectedTemplate.corCabecalho,
        formatoNota: selectedTemplate.formatoNota,
        descricao: `Layout personalizado gerado. Regras aplicadas: ${rulesApplied.join("; ")}.`,
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error("[API] Erro ao gerar layout via IA:", error);
      return erroInterno();
    }
  },
  { skipCSRF: true },
);
