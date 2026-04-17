# ADRs — Architecture Decision Records

> Pasta canônica de **Architecture Decision Records** do Ecossistema Marcelo Silva.
> Formato **MADR** (Markdown Architecture Decision Records). Cada ADR é imutável após "aceito" —
> mudanças ocorrem via novo ADR que _supersede_ o anterior.

## Processo

1. **Propor** — abrir PR com novo arquivo `NNN-titulo-kebab.md` a partir de `template.md`
2. **Debater** — revisão no PR; critérios de decisão explícitos
3. **Decidir** — marcar `Status: aceito` com data e decisores
4. **Executar** — linkar no plano/sprint; tarefas em `## Ação de implementação`
5. **Revisar** — cada ADR tem gatilho de revisão (data ou evento)
6. **Superseder** — se mudar, criar ADR novo; marcar antigo como `superseded-by-ADR-YYY`

Numeração é **sequencial e irreversível**. Nunca reusar número.

## Índice canônico

### Arquitetura e runtime

| # | ADR | Status | Tema |
|---|---|---|---|
| 001 | [Managed Agents como runtime primário](001-managed-agents-runtime.md) | ✅ aceito | Runtime de agentes |
| 002 | [Monorepo com pnpm workspaces](002-monorepo-pnpm-workspaces.md) | ✅ aceito | Estrutura de código |
| 003 | [Supabase ECOSYSTEM + DBs per-projeto](003-supabase-ecosystem-per-projeto.md) | ✅ aceito | Modelagem de dados |
| 004 | [LiteLLM como gateway único](004-litellm-gateway-unico.md) | ✅ aceito | LLM gateway |
| 005 | [Langfuse self-host para observability](005-langfuse-observability-selfhost.md) | ✅ aceito | Observability |
| 006 | [FastMCP v3 como framework MCP](006-fastmcp-framework-mcp.md) | ✅ aceito | MCP framework |
| 007 | [Mem0 v3 + pgvector 3-tier](007-mem0-pgvector-3tier.md) | ✅ aceito | Memory layer |
| 008 | [SC-29 como Edge Function determinística](008-sc29-edge-function-nao-agente.md) | ✅ aceito | Credential Vault |

### Governança e padrões

| # | ADR | Status | Tema |
|---|---|---|---|
| 009 | [22 Artigos Constitucionais como hooks executáveis](009-22-artigos-como-hooks.md) | ✅ aceito | Governança |
| 010 | [C-Suite per negócio + 6 Diretores de Área](010-csuite-per-negocio-diretores-area.md) | ✅ aceito | Organização de agentes |
| 013 | [Phantom 9-layer prompt assembler](013-phantom-9-layer-prompt-assembler.md) | ✅ aceito | Prompt engineering |
| 014 | [Mem0 v3 ADD-only como algoritmo](014-mem0-v3-add-only-algoritmo.md) | ✅ aceito | Memory algorithm |
| 015 | [Cardinal Rule — código é encanamento, SDK é cérebro](015-cardinal-rule-codigo-encanamento-llm-cerebro.md) | ✅ aceito | Princípio de design |

### Stack e produtos

| # | ADR | Status | Tema |
|---|---|---|---|
| 011 | [Jarvis 4-stage — pipecat + LiveKit Agents](011-jarvis-4-stages-pipecat-livekit.md) | ✅ aceito | Voz/Jarvis |
| 012 | [Stack BR canônica](012-stack-br-canonica.md) | ✅ aceito | Stack nacional |

### Processo

| # | ADR | Status | Tema |
|---|---|---|---|
| 016 | [Protocolo de sessões paralelas](016-protocolo-sessoes-paralelas.md) | ✅ aceito | Paralelismo de execução |

## Convenções

- **Arquivo:** `NNN-titulo-kebab-case.md` (NNN = 3 dígitos com zero-padding)
- **Status:** proposto → aceito → (opcional) superseded-by-ADR-YYY | deprecado
- **Decisores:** sempre Marcelo + Claudinho, adicionar outros se envolvidos
- **Relacionado:** citar MASTERPLAN-V9 § + ADRs correlatos (cross-links obrigatórios)
- **Evidência:** todo ADR cita research/código-fonte/benchmarks que justificam
- **Revisão:** data explícita ou gatilho observável (ex: "quando custo > $X/mês")

## Quando criar um ADR novo

Crie um ADR sempre que a decisão:
- Afetar mais de um negócio ou mais de um package
- Tiver trade-offs explícitos que justifiquem ser auditáveis depois
- Introduzir dependência de terceiros (lib, SaaS, padrão arquitetural)
- Mudar padrão canônico (ex: mudar gateway LLM, banco, framework)
- Supersed um ADR existente

Decisões puramente locais (nome de variável, refactor interno de package) **não** precisam ADR.
