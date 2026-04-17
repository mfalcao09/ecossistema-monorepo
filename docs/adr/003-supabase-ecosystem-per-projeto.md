# ADR-003: Supabase ECOSYSTEM compartilhado + DBs per-projeto

- **Status:** aceito
- **Data:** 2026-04-15
- **Decisores:** Marcelo Silva (CEO), Claudinho (VP)
- **Relacionado:** MASTERPLAN-V9 § Parte XI §39, PLANO-EXECUCAO-V4 D2, MASTERPLAN-ECOSSISTEMA-v8.2 Fase B, ADR-007, ADR-008

## Contexto e problema

O ecossistema tem dois tipos de dado:

1. **Cross-business / plataforma** — memória dos agentes, auditoria, credenciais, billing engine, task registry, skills registry, RACI, cost observer. Serve a mais de um negócio.
2. **Domínio do negócio** — alunos/mensalidades (FIC), matrículas/Educacenso (Klésis), empreendimentos/contratos (Intentus), etc.

Se tudo mora num DB único: acoplamento alto, blast radius grande em incidentes, RLS complexo.
Se cada negócio tem seu DB sem nada compartilhado: duplicação de memória, auditoria fragmentada, sem visão cross-business.

Já existem 3 Supabases em produção:
- ECOSYSTEM `gqckbunsfjgerbuiyzvn`
- ERP-FIC `ifdnjieklngcfodmtied` (107 tabelas, 7.797 audit logs)
- Intentus `bvryaopfjiyxjgsuhjsb` (133 EFs)

## Opções consideradas

- **Opção 1:** DB único para tudo (ecossistema + 5 negócios)
- **Opção 2:** DB per-negócio sem nada compartilhado
- **Opção 3:** ECOSYSTEM compartilhado + DB per-projeto (split por regra clara)

## Critérios de decisão

- Blast radius de incidentes
- Isolamento por negócio (LGPD, contratos)
- Reutilização de dados da plataforma (memória, audit, credenciais)
- Complexidade de RLS

## Decisão

**Escolhemos Opção 3.**

**Regra de ouro (§39 V9):** "Se serve mais de um negócio → ECOSYSTEM. Se é domínio → DB do negócio."

ECOSYSTEM hospeda: `ecosystem_memory`, `memory_episodic`, `memory_semantic`, `memory_procedural`, `agent_tasks`, `audit_log`, `approval_requests`, `idempotency_cache`, `ecosystem_credentials`, `credential_access_log`, `skills_registry`, `raci_registry`, `cost_observer`, `billing_engine`.

Per-projeto hospeda: tabelas de domínio (`alunos`, `empreendimentos`, `unidades`, `contratos_clm`, etc).

## Consequências

### Positivas
- Blast radius limitado — um incidente em FIC não derruba Intentus
- Memória e auditoria **cross-business** (D-Sinergia consegue perguntar "como FIC e Klésis se comportaram?")
- LGPD: dados sensíveis de alunos ficam dentro do DB do negócio, com RLS local
- Idempotência e task locks compartilhados (agente qualquer pode pegar task de qualquer negócio)

### Negativas
- Joins cross-database são impossíveis sem `postgres_fdw` ou Edge Function "federadora"
- Dois pools de conexão em cada app (ECOSYSTEM + domínio)
- Migrações coordenadas (slot único por dia por DB — ADR-016)

### Neutras / riscos
- **Risco:** query cross-business lenta via EF federadora. **Mitigação:** materialized views em ECOSYSTEM alimentadas por webhook dos DBs domínio.
- **Risco:** configuração errada de RLS vaza dados entre negócios. **Mitigação:** hook Art. XV + testes multi-tenant em `packages/rls-test-suite/` (futuro).

## Evidência / pesquisa

- 3 Supabases já em produção (listados em MEMORY.md)
- MASTERPLAN-V9 § Parte XI Tabela §38 + §39 regra de ouro
- MASTERPLAN-ECOSSISTEMA-v8.2 Fase B (preservada canonicamente)
- V4 D2 decisão pré-existente

## Ação de implementação

- Migrations ECOSYSTEM em sessão S04 (`audit_log`, `approval_requests`, `idempotency_cache`)
- `@ecossistema/memory` apontando para ECOSYSTEM (S07)
- Cliente Supabase per-projeto em `@ecossistema/clients` (S13)
- Criar Supabase Klésis, Splendori, Nexvy conforme negócios forem onboardados (runbook 02)

## Revisão

Revisar se surgirem > 3 casos de join cross-DB não resolvíveis por webhook/view materializada.
