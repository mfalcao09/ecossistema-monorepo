/**
 * Tool: gerar_relatorio_inadimplencia
 * Gera relatório de inadimplência da FIC por curso e faixa de atraso.
 * Usa check_inadimplentes internamente.
 */

import { checkInadimplentes } from './check_inadimplentes.js';
import type { ToolDef } from './shared.js';

export interface GerarRelatorioInput {
  dias_min?: number;
  formato?: 'json' | 'markdown';
}

export interface BucketAtraso {
  faixa: string;
  count: number;
  total_valor: number;
}

export interface CursoBucket {
  curso: string;
  count: number;
  total_valor: number;
}

export interface RelatorioOutput {
  data_referencia: string;
  total_inadimplentes: number;
  total_valor: number;
  por_faixa: BucketAtraso[];
  por_curso: CursoBucket[];
  texto?: string;
}

function faixaAtraso(dias: number): string {
  if (dias <= 15) return '01-15 dias';
  if (dias <= 30) return '16-30 dias';
  if (dias <= 60) return '31-60 dias';
  return '60+ dias';
}

function formatBRL(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function buildMarkdown(r: RelatorioOutput): string {
  const linhas = [
    `# Relatório de Inadimplência — FIC`,
    `**Data:** ${r.data_referencia}`,
    `**Total:** ${r.total_inadimplentes} alunos | ${formatBRL(r.total_valor)}`,
    '',
    '## Por faixa de atraso',
    '| Faixa | Alunos | Valor |',
    '|---|---|---|',
    ...r.por_faixa.map(
      (b) => `| ${b.faixa} | ${b.count} | ${formatBRL(b.total_valor)} |`
    ),
    '',
    '## Por curso',
    '| Curso | Alunos | Valor |',
    '|---|---|---|',
    ...r.por_curso.map(
      (c) => `| ${c.curso} | ${c.count} | ${formatBRL(c.total_valor)} |`
    ),
  ];
  return linhas.join('\n');
}

export const gerarRelatorioInadimplencia: ToolDef<GerarRelatorioInput, RelatorioOutput> = {
  name: 'gerar_relatorio_inadimplencia',
  description:
    'Gera relatório de inadimplência da FIC com totais por faixa de atraso e por curso. ' +
    'Formato: json (default) ou markdown para apresentação ao Marcelo.',
  input_schema: {
    type: 'object',
    properties: {
      dias_min: {
        type: 'number',
        description: 'Filtro mínimo de dias em atraso (default: 1)',
        default: 1,
      },
      formato: {
        type: 'string',
        enum: ['json', 'markdown'],
        description: 'Formato de saída (default: json)',
        default: 'json',
      },
    },
  },
  handler: async ({ dias_min = 1, formato = 'json' }) => {
    const { alunos, total_valor, count } = await checkInadimplentes.handler({
      dias_min,
      limit: 1000,
    });

    // Agrupa por faixa de atraso
    const faixaMap = new Map<string, BucketAtraso>();
    for (const a of alunos) {
      const faixa = faixaAtraso(a.dias_atraso);
      const b = faixaMap.get(faixa) ?? { faixa, count: 0, total_valor: 0 };
      b.count++;
      b.total_valor += a.valor_devido;
      faixaMap.set(faixa, b);
    }
    const por_faixa = ['01-15 dias', '16-30 dias', '31-60 dias', '60+ dias']
      .map((f) => faixaMap.get(f))
      .filter((b): b is BucketAtraso => b !== undefined);

    // Agrupa por curso
    const cursoMap = new Map<string, CursoBucket>();
    for (const a of alunos) {
      const c = cursoMap.get(a.curso) ?? { curso: a.curso, count: 0, total_valor: 0 };
      c.count++;
      c.total_valor += a.valor_devido;
      cursoMap.set(a.curso, c);
    }
    const por_curso = [...cursoMap.values()].sort((a, b) => b.total_valor - a.total_valor);

    const relatorio: RelatorioOutput = {
      data_referencia: new Date().toISOString().slice(0, 10),
      total_inadimplentes: count,
      total_valor,
      por_faixa,
      por_curso,
    };

    if (formato === 'markdown') {
      relatorio.texto = buildMarkdown(relatorio);
    }

    return relatorio;
  },
};
