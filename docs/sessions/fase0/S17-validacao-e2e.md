# S17 — Validação E2E

**Sessão:** S17 · **Dia:** 4 · **Worktree:** `eco-validacao-e2e` · **Branch:** `feature/validacao-e2e`
**Duração estimada:** 1 dia (6-8h)
**Dependências:** TODAS as sessões anteriores (S01-S16)
**Bloqueia:** S18 (Briefing Marcelo)

---

## Leituras obrigatórias

1. `docs/masterplans/MASTERPLAN-V9.md` — **integral** (vai validar que tudo está de pé)
2. Todos os briefings S01-S16 em `docs/sessions/fase0/`
3. Critérios de fechamento da Fase 0 em `docs/sessions/fase0/PLANO-FASE0-PARALELO.md` (§ final)

---

## Objetivo

Confirmar que **toda a Fase 0 está funcional em produção** via bateria de testes end-to-end realistas. Produzir relatório de saúde por camada + lista de débitos/pendências que serão resolvidas na Fase 1.

Esta sessão **não constrói coisa nova** — só integra, testa, mede, documenta.

---

## Escopo exato

```
tests/e2e-fase0/
├── README.md
├── 00-infrastructure-health.spec.ts     # Supabase + Railway + LiteLLM + Langfuse up
├── 01-packages-loadable.spec.ts         # cada @ecossistema/* importa sem erro
├── 02-migrations-applied.spec.ts         # 4 migrations D1 aplicadas + RLS ok
├── 03-hooks-enforcement.spec.ts         # 11 hooks bloqueiam quando deveriam
├── 04-sc29-mode-b.spec.ts                # credenciais nunca expostas
├── 05-memory-roundtrip.spec.ts          # add/recall/contradict
├── 06-orchestrator-agents.spec.ts       # 3 agentes respondem (Claudinho + CFO-FIC + D-Governanca)
├── 07-csuite-template-instantiation.spec.ts  # create-csuite-agent funcional
├── 08-cfo-fic-pilot-dry-run.spec.ts     # régua dry-run passa
├── 09-observability-chain.spec.ts       # correlation_id propaga tudo
├── 10-jornada-marcelo-completa.spec.ts  # simulação real
└── reports/
    ├── fase0-health-check.md
    └── fase0-debitos-para-fase1.md

docs/sessions/fase0/
├── VALIDACAO-E2E-RESULTADOS.md          # relatório consolidado
└── FASE0-FECHAMENTO.md                  # checklist § PLANO-FASE0 respondido
```

---

## Cenários E2E

### 00 — Infrastructure Health Check

```typescript
test('todas as infraestruturas respondendo', async () => {
  const health = await Promise.all([
    fetch(SUPABASE_URL + '/rest/v1/').then(r => ({supabase: r.ok})),
    fetch(LITELLM_URL + '/health').then(r => ({litellm: r.ok})),
    fetch(LANGFUSE_URL + '/api/public/health').then(r => ({langfuse: r.ok})),
    fetch(ORCHESTRATOR_URL + '/health').then(r => ({orchestrator: r.ok})),
    fetch(CONSOLIDATOR_URL + '/health').then(r => ({consolidator: r.ok})),
  ]);
  expect(health.every(h => Object.values(h)[0] === true)).toBe(true);
});
```

### 01 — Packages Loadable

```typescript
test('todos os @ecossistema/* importáveis', async () => {
  const packages = [
    '@ecossistema/constitutional-hooks',
    '@ecossistema/prompt-assembler',
    '@ecossistema/memory',
    '@ecossistema/credentials',
    '@ecossistema/litellm-client',
    '@ecossistema/observability',
    '@ecossistema/c-suite-templates',
    '@ecossistema/magic-link-vault',
  ];
  for (const pkg of packages) {
    const mod = await import(pkg);
    expect(mod).toBeDefined();
  }
});
```

### 02 — Migrations Applied

```typescript
test('schema V9 aplicado', async () => {
  const tables = await supabase.rpc('list_tables_in_schema', {schema: 'public'});
  const required = [
    'memory_episodic','memory_semantic','memory_procedural',
    'ecosystem_credentials','credential_access_log','audit_log','skills_registry',
  ];
  for (const t of required) expect(tables).toContain(t);
  
  // RLS ativo
  const rls = await supabase.rpc('check_rls_enabled', {tables: required});
  expect(rls.every(r => r.enabled)).toBe(true);
});
```

### 03 — Hooks Enforcement (11 hooks)

```typescript
describe('Hooks constitucionais', () => {
  test.each([
    ['Art. II HITL', 'emit_boleto_massa', {valor: 15000}, 'block'],
    ['Art. III Idempotency', 'emit_boleto_aluno', duplicateInput, 'block'],
    ['Art. XIV Dual-Write', 'Write', {path: '/memory/test.md'}, 'block'],
    ['Art. XIX Security', 'Bash', {command: 'rm -rf /'}, 'block'],
    ['Art. XVIII Data Contracts', 'emit_boleto_aluno', invalidSchema, 'block'],
  ])('%s', async (name, tool, input, expected) => {
    const result = await runTool(tool, input);
    expect(result.decision).toBe(expected);
  });
});
```

### 04 — SC-29 Mode B — Secret Nunca Exposto

```typescript
test('SC-29 Modo B: agent nunca vê credential', async () => {
  const response = await orchestrator.run('cfo-fic', {
    query: 'Consulte saldo da conta Inter',
  });
  
  // Busca TODOS os textos emitidos pelo agent
  const allText = response.events.map(e => JSON.stringify(e)).join('\n');
  
  // Regex de credentials conhecidas
  expect(allText).not.toMatch(/sk-ant-[a-zA-Z0-9_-]{30,}/);
  expect(allText).not.toMatch(/INTER_CLIENT_SECRET=/);
  expect(allText).not.toMatch(/Bearer\s+eyJ/);
  
  // Mas deve ter resultado (saldo)
  expect(response.result).toHaveProperty('saldo');
});
```

### 05 — Memory Roundtrip

```typescript
test('memory add → recall → hit', async () => {
  await memory.add({
    content: 'FIC tem taxa de inadimplência histórica de 8%',
    filters: { user_id: 'test', agent_id: 'cfo-fic', business_id: 'fic' },
    type: 'semantic',
  });
  
  await sleep(6000);  // wait auto-embedding
  
  const hits = await memory.recall({
    query: 'Qual a inadimplência da FIC?',
    filters: { user_id: 'test', agent_id: 'cfo-fic', business_id: 'fic' },
    limit: 5,
  });
  
  expect(hits.length).toBeGreaterThan(0);
  expect(hits[0].content).toMatch(/8%/);
});

test('semantic contradiction → supersede', async () => {
  await memory.add({ content: 'Marcelo prefere Sonnet', filters: {...}, type:'semantic' });
  await memory.add({ content: 'Marcelo prefere Opus',   filters: {...}, type:'semantic' });
  
  const latest = await memory.semantic.getLatest({subject: 'Marcelo', predicate: 'prefere'});
  expect(latest.supersedes_id).toBeTruthy();
});
```

### 06 — Orchestrator Agents Responding

```typescript
test('Claudinho responde', async () => {
  const stream = await orchestrator.stream('claudinho', { query: 'ping' });
  const events = await collectSSE(stream);
  expect(events).toContainEqual(expect.objectContaining({ type: 'assistant_message' }));
});

test('CFO-FIC responde', async () => {
  const response = await orchestrator.run('cfo-fic', { query: 'Quantos alunos temos?' });
  expect(response.status).toBe('success');
});

test('D-Governanca responde', async () => {
  const response = await orchestrator.run('d-governanca', { query: 'Status de compliance hoje?' });
  expect(response.status).toBe('success');
  expect(response.events.some(e => e.type === 'tool_use' && e.tool === 'query_audit_log')).toBe(true);
});
```

### 07 — C-Suite Template Instantiation

```typescript
test('create-csuite-agent gera agente válido', async () => {
  await execa('pnpm', ['create-csuite-agent', '--business', 'klesis', '--role', 'ceo']);
  
  const configPath = 'apps/klesis/agents/ceo/agent.config.yaml';
  expect(fs.existsSync(configPath)).toBe(true);
  
  const cfg = yaml.load(fs.readFileSync(configPath, 'utf-8'));
  expect(cfg.agent_id).toBe('ceo-klesis');
  expect(cfg.business_id).toBe('klesis');
  expect(cfg.variant).toBe('educacao');
});
```

### 08 — CFO-FIC Pilot Dry-Run

```typescript
test('CFO-FIC dry-run régua de cobrança', async () => {
  await seedInadimplentes(5);
  
  const response = await orchestrator.run('cfo-fic', {
    query: 'Dispare régua de cobrança dry-run para inadimplentes 15+ dias',
  });
  
  expect(response.status).toBe('success');
  expect(response.tools_used).toContain('check_inadimplentes');
  expect(response.tools_used).toContain('disparar_regua_cobranca');
  expect(response.result).toMatchObject({ dry_run: true, would_notify: 5 });
  
  // Nada de real enviado
  const whatsappSent = await countWhatsAppSent({ today: true });
  expect(whatsappSent).toBe(0);
});
```

### 09 — Observability Chain

```typescript
test('correlation_id propaga por toda a stack', async () => {
  const corrId = `test-${Date.now()}`;
  
  const response = await orchestrator.run('cfo-fic', 
    { query: 'ping' },
    { headers: { 'X-Correlation-ID': corrId } },
  );
  
  // Langfuse trace
  const trace = await langfuse.getTracesByMetadata({ correlation_id: corrId });
  expect(trace).toBeTruthy();
  
  // Audit log
  const audit = await supabase.from('audit_log').select().eq('trace_id', corrId);
  expect(audit.data.length).toBeGreaterThan(0);
  
  // credential_access_log (se houve tool call com credencial)
  const creds = await supabase.from('credential_access_log').select().contains('metadata', {correlation_id: corrId});
  // não garante > 0 pois "ping" pode não ter usado credential, mas se usou, deve ter
});
```

### 10 — Jornada Marcelo Completa

```typescript
test('fluxo completo: Marcelo pergunta → Claudinho roteia → CFO-FIC executa → volta resposta', async () => {
  // Marcelo pergunta via orchestrator (simula Jarvis CLI)
  const response = await orchestrator.run('claudinho', {
    query: 'Claudinho, como está a inadimplência da FIC?',
    user_id: 'marcelo',
  });
  
  // Claudinho delegou para CFO-FIC
  expect(response.events).toContainEqual(expect.objectContaining({
    type: 'handoff',
    target: 'cfo-fic',
  }));
  
  // CFO-FIC consultou dados
  expect(response.events.some(e => e.tool === 'check_inadimplentes')).toBe(true);
  
  // Resposta volta para Marcelo com número
  expect(response.final_message).toMatch(/inadim|aluno|R\$/);
  
  // Tempo total aceitável
  expect(response.duration_ms).toBeLessThan(30000);
  
  // Custo registrado
  const trace = await langfuse.getTrace(response.trace_id);
  expect(trace.cost_usd).toBeGreaterThan(0);
  expect(trace.cost_usd).toBeLessThan(1.0);  // sanity
});
```

---

## Relatório — `VALIDACAO-E2E-RESULTADOS.md`

Após os testes, gerar relatório estruturado:

```markdown
# Validação E2E da Fase 0 — Resultados

**Data:** 2026-04-{dia}
**Duração execução:** {min}
**Cenários rodados:** 10 spec files, ~N testes individuais
**Resultado geral:** ✅ GREEN / ⚠️ YELLOW / ❌ RED

## Saúde por camada

### L1 — Agentes (Managed Agents)
- ✅ Claudinho responde
- ✅ CFO-FIC responde
- ✅ D-Governanca responde
- 🟡 Outros 27 C-Suite não instanciados ainda (Fase 1)

### L2 — Serviços Railway
- ✅ Orchestrator FastAPI
- ✅ LiteLLM proxy (6 virtual keys)
- ✅ Langfuse (Postgres + ClickHouse)
- ✅ Memory consolidator worker

### L3 — Edge Functions
- ✅ SC-29 v2 Credential Gateway
- ✅ webhook-hardening
- ✅ pii-mask
- ✅ skills-registry-crud
- ✅ dual-write-pipeline

### L4 — Dados
- ✅ 4 migrations D1 aplicadas
- ✅ RLS ativo em todas tabelas críticas
- ✅ 3-tier memory funcional
- ✅ Auto-embedding trigger

## Conformidade Constitucional

| Art. | Hook | Teste | Status |
|---|---|---|---|
| II | HITL | block > R$10k | ✅ |
| III | Idempotency | dedup 24h | ✅ |
| IV | Audit | write audit_log | ✅ |
| VIII | Baixa Real | valida sucesso real | ✅ |
| IX | Falha Explícita | exceção em silent fail | ✅ |
| XII | Cost Control | bloqueia budget exceeded | ✅ |
| XIV | Dual-Write | intercepta Write crítico | ✅ |
| XVIII | Data Contracts | valida JSON Schema | ✅ |
| XIX | Security | bloqueia comando perigoso | ✅ |
| XX | Soberania | prefere Supabase local | ✅ |
| XXII | Aprendizado | grava memory em SessionEnd | ✅ |

## Métricas

- Tempo médio de resposta CFO-FIC: {N} ms
- Custo médio por query: R$ {N}
- Correlation ID cobertura: 100% das chamadas
- Coverage testes: {N}% cross-packages
- Uptime Railway: {N}%
- Latência Langfuse ingestion: {N}s

## Débitos identificados (vai pra Fase 1)

{listar cada item encontrado}

---
```

### Relatório — `FASE0-FECHAMENTO.md`

Checklist do critério canônico § PLANO-FASE0-PARALELO.md (seção final), marcando cada item ✅/⚠️/❌ com evidência.

---

## Se algum teste falhar

Não tentar consertar nesta sessão. Em vez disso:
1. Registrar em `reports/fase0-debitos-para-fase1.md` com:
   - Sintoma exato
   - Onde detectado
   - Sessão responsável (ex: S07 — memory)
   - Severity (critical/high/medium/low)
2. Seguir com os demais testes
3. Apenas items **critical** bloqueiam fechamento da Fase 0

---

## Critério de sucesso

- [ ] 10 spec files E2E executados
- [ ] ≥ 90% dos testes verdes (crítical: 100%)
- [ ] Relatório `VALIDACAO-E2E-RESULTADOS.md` gerado
- [ ] Relatório `FASE0-FECHAMENTO.md` com checklist respondido
- [ ] Lista de débitos para Fase 1 (se houver)
- [ ] Commit: `test(e2e): validação completa Fase 0 — {N passing / N total}`

---

## Handoff

- **S18 (Briefing Marcelo)** consome esses relatórios para apresentação
- **Fase 1** inicia com débitos como primeiros items do backlog
- D-Governanca (quando instanciado) herda estes testes como baseline

---

**Boa sessão. Ao final deste dia, a Fase 0 fecha. Capricho em honestidade: se algo não passou, registre.**
