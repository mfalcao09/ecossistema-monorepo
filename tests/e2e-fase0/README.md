# E2E Tests — Fase 0

Bateria de testes end-to-end da Fase 0 do Ecossistema de Inovação e IA.

## Como rodar

### Testes locais (sem infra Railway/Supabase)

```bash
cd tests/e2e-fase0
pnpm install
pnpm test:local
```

Specs: 01, 03, 04 (estático), 06 (estático), 07, 09 (estático), 10 (estático)

### Testes com infra live

```bash
export SUPABASE_URL=https://gqckbunsfjgerbuiyzvn.supabase.co
export SUPABASE_ANON_KEY=<sua-chave>
export ORCHESTRATOR_URL=https://orchestrator.railway.app
export LITELLM_URL=https://litellm.railway.app
export LANGFUSE_URL=https://langfuse.railway.app
export CONSOLIDATOR_URL=https://consolidator.railway.app
export LANGFUSE_PUBLIC_KEY=<chave>
export LANGFUSE_SECRET_KEY=<chave>

pnpm test:infra
```

## Specs

| # | Arquivo | Modo | Descrição |
|---|---|---|---|
| 00 | infrastructure-health.spec.ts | live | Todos os serviços up |
| 01 | packages-loadable.spec.ts | local | @ecossistema/* importáveis |
| 02 | migrations-applied.spec.ts | live | Schema V9 + RLS no Supabase |
| 03 | hooks-enforcement.spec.ts | local | 11 hooks constitucionais |
| 04 | sc29-mode-b.spec.ts | misto | Credentials nunca expostas |
| 05 | memory-roundtrip.spec.ts | misto | add → recall → hit |
| 06 | orchestrator-agents.spec.ts | misto | Claudinho + CFO-FIC respondem |
| 07 | csuite-template-instantiation.spec.ts | local | create-csuite-agent funcional |
| 08 | cfo-fic-pilot-dry-run.spec.ts | live | Régua de cobrança dry-run |
| 09 | observability-chain.spec.ts | misto | trace_id propaga |
| 10 | jornada-marcelo-completa.spec.ts | misto | Fluxo completo Marcelo→CFO-FIC |

## Resultados (2026-04-18)

- **Local:** 54/54 passing ✅
- **Live:** pendente (sem env vars Railway na sessão S17)
- **Total packages:** 235/235 testes passando

Ver relatórios completos em `reports/`.
