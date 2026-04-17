# ADR-013: Phantom 9-layer prompt assembler como padrão canônico

- **Status:** aceito
- **Data:** 2026-04-16
- **Decisores:** Marcelo Silva (CEO), Claudinho (VP)
- **Relacionado:** MASTERPLAN-V9 § Parte VIII §24, ADR-001, ADR-010, ADR-014

## Contexto e problema

Cada agente (~30-35) precisa system prompt que combine:

- Identidade consistente (quem é)
- Contexto de ambiente (onde roda, tools disponíveis)
- Restrições de segurança (o que nunca fazer)
- Role template (variant educacao/imobiliario/saas)
- Onboarding first-run (primeiro contato com Marcelo)
- Config evoluída versionada (constitution + persona + user-profile + domain-knowledge + strategies)
- Memory instructions (como usar memory — sem injetar conteúdo = evita feedback loop)
- Instruções de trabalho
- Memory context recalled dinamicamente por query

Se cada agente monta prompt ad-hoc: duplicação, inconsistência, difícil de evoluir. Se um só prompt gigante: rigidez, impossível de personalizar por business.

## Opções consideradas

- **Opção 1:** Prompt monolítico por agente (status quo)
- **Opção 2:** Prompt assembler em camadas — padrão validado em phantom
- **Opção 3:** LLM gera prompt dinamicamente (meta-prompt)

## Critérios de decisão

- Reutilização entre agentes similares (C-Suite per business)
- Versionamento de componentes (persona muda sem mudar identity)
- Testabilidade
- Compatibilidade com Managed Agents versioning (ADR-001)

## Decisão

**Escolhemos Opção 2** — adotar o padrão **Phantom 9-Layer** (Padrão 1 V9 §24):

1. **Identidade** — quem é (ex: "Você é o CFO-IA da FIC")
2. **Environment** — onde roda, tools, URLs
3. **Security** — nunca fazer
4. **Role template** — YAML-defined (variants/educacao.md, etc)
5. **Onboarding** — first-run only
6. **Evolved config** — constitution + persona + user-profile + domain-knowledge + strategies
7. **Memory instructions** — COMO usar memory (sem injetar conteúdo)
8. **Instructions** — como trabalha
9. **Memory context** — recall dinâmico por query (Mem0 + pgvector)

Implementação canônica: `packages/prompt-assembler/` exporta `assemble(agentConfig, queryContext)`.

## Consequências

### Positivas
- Reuso real: CFO-FIC e CFO-Intentus compartilham camadas 1+4+6, diferem em 2+5
- Memory instructions separado de memory context → sem feedback loop de "agente lê memória → acha que é fato novo"
- Testes por camada (memória mock pode ser `[]`, identidade constante)
- Integra Managed Agents versioning: `agents.update(prompt=assemble(...))` em cada mudança de camada
- Onboarding first-run diminui overhead por sessão (carrega só 1x)

### Negativas
- Assembler em si é código que precisa manter (mitigado por phantom já ter versão validada)
- Template + variant fica espalhado em múltiplos arquivos MD

### Neutras / riscos
- **Risco:** ordem das camadas importa — se algum agente reordenar, comportamento muda. **Mitigação:** função `assemble()` pura, ordem fixada em código + teste snapshot.
- **Risco:** memory context injetado em layer 9 ficar longo demais. **Mitigação:** top-K dinâmico (K=5 default, configurável).

## Evidência / pesquisa

- `phantom/src/agent/prompt-assembler.ts` — código-fonte validado em produção
- MASTERPLAN-V9 § Parte VIII §24
- Decisão canônica em V9 — Padrão 1 de 10

## Ação de implementação

- `packages/prompt-assembler/` (sessão S11 — parte do C-Suite templates)
- Templates C-Suite usam assembler em `new ManagedAgent({ prompt: assemble(cfg) })`
- Snapshot tests: prompts de CFO-FIC e CFO-Intentus estáveis entre releases

## Revisão

Revisar quando houver > 10 agentes em produção usando o assembler e houver dados de qualidade via Langfuse (evals).
