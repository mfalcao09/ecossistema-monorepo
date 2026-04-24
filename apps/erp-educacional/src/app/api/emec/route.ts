import { protegerRota } from "@/lib/security/api-guard";
import { NextRequest, NextResponse } from "next/server";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// GET - Buscar dados de curso no E-MEC via web scraping simples
// O E-MEC não tem API pública oficial, então usamos busca por código
export const GET = protegerRota(
  async (request: NextRequest, { userId, tenantId }) => {
    const { searchParams } = new URL(request.url);
    const codigo = searchParams.get("codigo");
    const nome = searchParams.get("nome");

    if (!codigo && !nome) {
      return NextResponse.json(
        { error: "Informe o código E-MEC ou nome do curso" },
        { status: 400 },
      );
    }

    try {
      // Tentativa 1: Buscar no E-MEC pela API informal
      // O E-MEC tem endpoints consultáveis por código de IES
      if (codigo) {
        const url = `https://emec.mec.gov.br/emec/consulta-cadastro/detalhamento/d96957f455f6405d14c6542552b0f6eb/${codigo}`;

        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; DiplomaDigital/1.0)",
            Accept: "text/html,application/xhtml+xml",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok) {
          const html = await res.text();

          // Extrair dados básicos do HTML retornado
          const dados = extrairDadosEMEC(html);

          if (dados) {
            return NextResponse.json({
              source: "emec",
              ...dados,
            });
          }
        }
      }

      // Fallback: retorna dados sugestivos baseados no nome
      if (nome) {
        const sugestoes = gerarSugestoesCurso(nome);
        return NextResponse.json({
          source: "sugestao_ia",
          message:
            "Dados sugeridos pela IA com base no nome do curso. Confira e ajuste.",
          ...sugestoes,
        });
      }

      return NextResponse.json({
        source: "manual",
        message:
          "Não foi possível buscar automaticamente. Preencha manualmente.",
      });
    } catch (err) {
      console.error("Erro ao buscar E-MEC:", err);
      return NextResponse.json({
        source: "manual",
        message: "Erro na busca. Preencha os dados manualmente.",
      });
    }
  },
  { skipCSRF: true },
);

// Extrair dados do HTML do E-MEC (parsing simplificado)
function extrairDadosEMEC(html: string) {
  try {
    // Regex para campos comuns do E-MEC
    const nomeMatch = html.match(/Nome do Curso[^:]*:\s*<[^>]*>([^<]+)/i);
    const grauMatch = html.match(/Grau[^:]*:\s*<[^>]*>([^<]+)/i);
    const modalidadeMatch = html.match(/Modalidade[^:]*:\s*<[^>]*>([^<]+)/i);
    const chMatch = html.match(/Carga\s*Hor[áa]ria[^:]*:\s*<[^>]*>([^<]+)/i);

    if (nomeMatch) {
      return {
        nome: nomeMatch[1]?.trim(),
        grau: mapearGrau(grauMatch?.[1]?.trim()),
        modalidade: mapearModalidade(modalidadeMatch?.[1]?.trim()),
        carga_horaria_total: parseInt(chMatch?.[1]?.trim() || "0") || null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Mapear grau do E-MEC para enum do banco
function mapearGrau(grau?: string): string {
  if (!grau) return "bacharel";
  const g = grau.toLowerCase();
  if (g.includes("bacharel")) return "bacharel";
  if (g.includes("licenciatura") || g.includes("licenciado"))
    return "licenciado";
  if (g.includes("tecnol")) return "tecnologo";
  if (g.includes("especializa")) return "especialista";
  if (g.includes("mestrado") || g.includes("mestre")) return "mestre";
  if (g.includes("doutorado") || g.includes("doutor")) return "doutor";
  return "bacharel";
}

// Mapear modalidade do E-MEC para enum do banco
function mapearModalidade(mod?: string): string {
  if (!mod) return "presencial";
  const m = mod.toLowerCase();
  if (m.includes("ead") || m.includes("distância")) return "ead";
  if (m.includes("híbrido") || m.includes("hibrido")) return "hibrido";
  return "presencial";
}

// Gerar sugestões inteligentes baseadas no nome do curso
function gerarSugestoesCurso(nome: string) {
  const n = nome.toLowerCase();

  // Mapeamento de cursos comuns para dados típicos
  const cursoMap: Record<string, { grau: string; titulo: string; ch: number }> =
    {
      administra: {
        grau: "bacharel",
        titulo: "Bacharel em Administração",
        ch: 3000,
      },
      direito: { grau: "bacharel", titulo: "Bacharel em Direito", ch: 3700 },
      contab: {
        grau: "bacharel",
        titulo: "Bacharel em Ciências Contábeis",
        ch: 3000,
      },
      "ciências contábeis": {
        grau: "bacharel",
        titulo: "Bacharel em Ciências Contábeis",
        ch: 3000,
      },
      pedagogia: {
        grau: "licenciado",
        titulo: "Licenciado em Pedagogia",
        ch: 3200,
      },
      letras: { grau: "licenciado", titulo: "Licenciado em Letras", ch: 2800 },
      "educação física": {
        grau: "bacharel",
        titulo: "Bacharel em Educação Física",
        ch: 3200,
      },
      enfermagem: {
        grau: "bacharel",
        titulo: "Bacharel em Enfermagem",
        ch: 4000,
      },
      psicologia: {
        grau: "bacharel",
        titulo: "Bacharel em Psicologia",
        ch: 4000,
      },
      engenharia: {
        grau: "bacharel",
        titulo: "Bacharel em Engenharia",
        ch: 3600,
      },
      sistemas: {
        grau: "bacharel",
        titulo: "Bacharel em Sistemas de Informação",
        ch: 3000,
      },
      gestão: { grau: "tecnologo", titulo: "Tecnólogo em Gestão", ch: 1600 },
      agronomia: {
        grau: "bacharel",
        titulo: "Bacharel em Agronomia",
        ch: 3600,
      },
      "serviço social": {
        grau: "bacharel",
        titulo: "Bacharel em Serviço Social",
        ch: 3000,
      },
      matemática: {
        grau: "licenciado",
        titulo: "Licenciado em Matemática",
        ch: 3200,
      },
      história: {
        grau: "licenciado",
        titulo: "Licenciado em História",
        ch: 2800,
      },
      geografia: {
        grau: "licenciado",
        titulo: "Licenciado em Geografia",
        ch: 2800,
      },
      biologia: {
        grau: "licenciado",
        titulo: "Licenciado em Ciências Biológicas",
        ch: 3200,
      },
    };

  for (const [key, val] of Object.entries(cursoMap)) {
    if (n.includes(key)) {
      return {
        grau: val.grau,
        titulo_conferido: val.titulo,
        carga_horaria_total: val.ch,
        modalidade: "presencial",
      };
    }
  }

  // Default: bacharelado presencial
  return {
    grau: "bacharel",
    titulo_conferido: "",
    carga_horaria_total: 3000,
    modalidade: "presencial",
  };
}
