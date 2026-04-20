# Débitos da Fase 0 para Fase 1

**Gerado em:** 2026-04-18
**Sessão:** S17 — Validação E2E
**Critério:** items detectados durante validação que não bloqueiam o fechamento

---

## Severidade: CRITICAL (bloqueia Fase 1 imediata)

> Nenhum item crítico identificado.

---

## Severidade: HIGH (resolve na primeira semana da Fase 1)

### D-001 — S13 Pendente: Packages cliente standalone não criados

**Sintoma:** `@ecossistema/credentials`, `@ecossistema/litellm-client`, `@ecossistema/observability` não existem como packages autônomos no monorepo. Os clientes existem como módulos internos do orchestrator (`apps/orchestrator/src/orchestrator/clients/`).

**Onde detectado:** Spec 01 — packages-loadable.spec.ts

**Sessão responsável:** S13 (clients)

**Impacto:** Outros apps (ERP, Intentus, Splendori) não podem consumir esses clientes sem copiar código do orchestrator. Viola o princípio de package reutilizável.

**Ação Fase 1:** Criar os 3 packages:
- `packages/credentials/` — cliente TypeScript para SC-29 (wrap do Python client do orchestrator)
- `packages/litellm-client/` — cliente TypeScript para o proxy LiteLLM Railway
- `packages/observability/` — cliente Langfuse TypeScript

---

### D-002 — S16 Pendente: Piloto CFO-FIC não executado

**Sintoma:** `apps/erp-educacional/agents/cfo.ts` não existe. CFO-FIC está instanciado em `apps/fic/agents/cfo/` via c-suite-templates, mas o piloto E2E real (régua de cobrança → WhatsApp) não foi executado.

**Onde detectado:** Spec 08 — cfo-fic-pilot-dry-run.spec.ts

**Sessão responsável:** S16 (piloto-cfo-fic)

**Impacto:** Não há evidência de que o CFO-FIC executa uma tarefa real end-to-end com dados da FIC. A régua de cobrança (dry-run) não foi validada.

**Ação Fase 1:** Executar S16: conectar CFO-FIC ao ERP-FIC real (Supabase ifdnjieklngcfodmtied), executar régua de cobrança dry-run, validar hooks Art. II (boleto > R$10k).

---

### D-003 — S15 Pendente: CI/CD GitHub Actions não configurado

**Sintoma:** `.github/workflows/` não existe na raiz do monorepo. Só existem workflows em `apps/erp-educacional/`.

**Onde detectado:** Inventário estático pré-validação

**Sessão responsável:** S15 (tests)

**Impacto:** Nenhum CI automático roda nos PRs. Deploy para Railway/Supabase é manual. Sem gate de qualidade no pipeline.

**Ação Fase 1:** Criar:
- `.github/workflows/ci.yml` — lint + test em packages P0
- `.github/workflows/deploy-edge-functions.yml` — deploy seletivo ao merge em main
- `.github/workflows/deploy-railway.yml` — trigger deploy Railway

---

## Severidade: MEDIUM (resolve no mês 1 da Fase 1)

### D-004 — S12: @ecossistema/magic-link-vault não encontrado

**Sintoma:** Package `magic-link-vault` foi listado como ✅ concluído na memória (S12), mas não existe como package em `packages/` no monorepo.

**Onde detectado:** Spec 01 — packages-loadable.spec.ts; inventário estático

**Sessão responsável:** S12 (vault)

**Impacto:** Phantom pattern de magic-link para autenticação de agentes não implementado como package reutilizável.

**Ação Fase 1:** Verificar se S12 produziu o package em outra localização ou se é débito real. Criar `packages/magic-link-vault/` se necessário.

---

### D-005 — Orchestrator health stubs (TODO comments em produção)

**Sintoma:** `apps/orchestrator/src/orchestrator/routes/health.py` retorna `"stub"` para litellm, memory, credentials e langfuse. TODOs explícitos comentados no código.

**Onde detectado:** Inspeção estática do health.py

**Sessão responsável:** S10 (orchestrator)

**Impacto:** O `/health` endpoint não verifica conectividade real com serviços dependentes. Incidentes de dependência não são detectados pelo health check.

**Ação Fase 1:** Implementar health checks reais para cada cliente no health endpoint.

---

### D-006 — X-Correlation-ID externo não propagado no orchestrator

**Sintoma:** O orchestrator gera `trace_id` internamente via Langfuse, mas não aceita/propaga o header `X-Correlation-ID` de chamadas externas. A correlação cross-sistema não é possível sem instrumentação externa.

**Onde detectado:** Spec 09 — observability-chain.spec.ts

**Sessão responsável:** S10 (orchestrator)

**Impacto:** Correlação de traces entre sistema caller (Jarvis/Evolution API) e orchestrator não é automática.

**Ação Fase 1:** Adicionar middleware no FastAPI que lê `X-Correlation-ID` do request e passa como `trace_id` para o runtime.

---

### D-007 — memory/tests/e2e.test.ts requer Supabase live

**Sintoma:** O package `@ecossistema/memory` tem `tests/e2e.test.ts` que requer Supabase ECOSYSTEM para rodar. Não foi executado nesta sessão.

**Onde detectado:** Spec 05 — memory-roundtrip.spec.ts

**Sessão responsável:** S07 (memory)

**Impacto:** Roundtrip real (add → embedding → recall) não validado. Pode haver bugs na integração pgvector que não aparecem nos mocks.

**Ação Fase 1:** Executar `pnpm --filter @ecossistema/memory test:e2e` com SUPABASE_URL configurado em ambiente de staging.

---

## Severidade: LOW (backlog Fase 1)

### D-008 — Langfuse integração stub no orchestrator

**Sintoma:** `apps/orchestrator/src/orchestrator/clients/langfuse.py` usa stub com `await asyncio.sleep` simulando latência. Não há integração real com Langfuse Railway ainda.

**Sessão responsável:** S09 (langfuse) / S10 (orchestrator)

**Ação Fase 1:** Conectar orchestrator ao Langfuse Railway real com credenciais via SC-29.

---

### D-009 — Spec 00 (infra health) não testada live

**Sintoma:** Spec 00 não pôde ser executada sem SUPABASE_URL + ORCHESTRATOR_URL configurados.

**Ação Fase 1:** Configurar env vars de staging e executar `pnpm test:infra` no CI.

---

## Resumo de pendências por sessão

| Sessão | Status | Débito |
|---|---|---|
| S01 hooks | ✅ completo | — |
| S02 assembler | ✅ completo | — |
| S03 mcp-template | ✅ completo | — |
| S04 migrations | ✅ completo | — |
| S05 litellm | ✅ scaffold | — |
| S06 docs | ✅ completo | — |
| S07 memory | ✅ unit | D-007 (e2e live) |
| S08 edge-functions | ✅ completo | — |
| S09 langfuse | ✅ scaffold | D-008 (stub) |
| S10 orchestrator | ✅ completo | D-005, D-006 |
| S11 csuite | ✅ completo | — |
| S12 vault | ⚠️ incerto | D-004 |
| S13 clients | ❌ pendente | **D-001** |
| S14 consolidator | ✅ completo | — |
| S15 tests/CI | ❌ pendente | **D-003** |
| S16 piloto CFO | ❌ pendente | **D-002** |
