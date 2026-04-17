/**
 * seed-dashboards.ts — imprime specs dos 3 dashboards canônicos do Ecossistema.
 *
 * Por ora a API pública do Langfuse v3 não expõe criação programática de
 * dashboards/views (Dez/2025). Este script serve de:
 *   1. Documentação viva dos dashboards esperados
 *   2. Checklist para Marcelo clicar na UI e criar
 *   3. Template para migração futura (quando API liberar)
 *
 * Uso:
 *   pnpm tsx scripts/seed-dashboards.ts
 */

type DashboardSpec = {
  name: string;
  description: string;
  widgets: Array<{
    title: string;
    type: 'line' | 'bar' | 'number' | 'table' | 'pie';
    metric: string;
    groupBy?: string;
    filters?: Record<string, unknown>;
  }>;
};

const DASHBOARDS: DashboardSpec[] = [
  {
    name: 'Ecossistema — Overview',
    description: 'Visão cross-business: volume, custo, erro, top agents.',
    widgets: [
      { title: 'Calls / dia (total)',       type: 'line',   metric: 'traces_count',           groupBy: 'day' },
      { title: 'Custo USD / dia',           type: 'line',   metric: 'total_cost_usd',         groupBy: 'day' },
      { title: 'Top 10 agents (volume)',    type: 'bar',    metric: 'traces_count',           groupBy: 'name' },
      { title: 'Error rate global',         type: 'number', metric: 'error_rate',             filters: { window: '7d' } },
    ],
  },
  {
    name: 'Per Business',
    description: 'Duplicar por business_id ∈ {fic, klesis, intentus, splendori, nexvy}.',
    widgets: [
      { title: 'Custo mensal',              type: 'number', metric: 'total_cost_usd',         filters: { window: '30d' } },
      { title: 'Latência p50/p95/p99',      type: 'line',   metric: 'latency_ms',             groupBy: 'day' },
      { title: 'Top 5 tools',               type: 'bar',    metric: 'tool_calls_count',       groupBy: 'tool_name' },
      { title: 'Violações constitucionais', type: 'table',  metric: 'audit_log.violations',   groupBy: 'article_ref' },
    ],
  },
  {
    name: 'Art. violações (constitucional)',
    description: 'Fonte: audit_log.article_ref no Supabase ECOSYSTEM (via custom metric).',
    widgets: [
      { title: 'Distribuição por artigo',   type: 'pie',    metric: 'audit_log.violations',   groupBy: 'article_ref' },
      { title: 'Top 5 agents por Art. II',  type: 'bar',    metric: 'audit_log.violations',   filters: { article_ref: 'Art.II' }, groupBy: 'agent_id' },
      { title: 'Trend 7d',                  type: 'line',   metric: 'audit_log.violations',   groupBy: 'day' },
    ],
  },
];

function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('DASHBOARDS CANÔNICOS — criar manualmente na UI do Langfuse');
  console.log('═══════════════════════════════════════════════════════════════\n');

  for (const d of DASHBOARDS) {
    console.log(`📊 ${d.name}`);
    console.log(`   ${d.description}`);
    console.log(`   Widgets:`);
    for (const w of d.widgets) {
      const filters = w.filters ? ` filters=${JSON.stringify(w.filters)}` : '';
      const group = w.groupBy ? ` groupBy=${w.groupBy}` : '';
      console.log(`     • [${w.type.padEnd(6)}] ${w.title.padEnd(40)} metric=${w.metric}${group}${filters}`);
    }
    console.log('');
  }

  console.log('───────────────────────────────────────────────────────────────');
  console.log('Roadmap: quando Langfuse expor /api/public/dashboards, este');
  console.log('script passa a fazer POST direto. Por enquanto é checklist.');
  console.log('───────────────────────────────────────────────────────────────');
}

main();
