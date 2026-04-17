# @ecossistema/prompt-assembler

Phantom 9-Layer system-prompt assembler para os agentes C-Suite e Diretores do Ecossistema Marcelo Silva. Implementa o **Padrão 1** do Masterplan V9 (§ 24).

> Originado de `phantom/src/agent/prompt-assembler.ts`. DNA de como cada agente se apresenta ao mundo.

## Princípio

Cada system prompt é construído em **9 camadas ordenadas e imutáveis**:

| # | Layer | Natureza | Cacheable? |
|---|---|---|---|
| 1 | Identity | estática por agente | ✅ |
| 2 | Environment | quase-estática (timestamp é dinâmico) | ⚠️ |
| 3 | Security | constante global | ✅ |
| 4 | Role | YAML template + variant | ✅ |
| 5 | Onboarding | só no primeiro contato | ✅ (vazia depois) |
| 6 | Evolved Config | MD files versionados no git | ✅ |
| 7 | Memory Instructions | constante global | ✅ |
| 8 | Instructions | por role | ✅ |
| 9 | Memory Context | recall dinâmico | ❌ |

As camadas 1–8 são **cache-friendly**; camada 9 é sempre dinâmica. Ativando `exclude_dynamic_sections: true`, a camada 9 é omitida para maximizar cache-hit — o conteúdo dinâmico deve então ser re-injetado na primeira mensagem de `user`.

## Uso

```typescript
import { assemble } from '@ecossistema/prompt-assembler';

const result = await assemble(
  {
    agent_id: 'cfo-fic',
    name: 'CFO-IA FIC',
    title: 'Chief Financial Officer (IA)',
    description: 'Gestor financeiro da FIC.',
    role: 'cfo-ia',
    role_variant: 'educacao',
    business_id: 'fic',
    model: 'claude-sonnet-4-6',
    supabase_project: 'ifdnjieklngcfodmtied',
    evolved_config_path: 'apps/fic/agents/cfo/evolved/',
  },
  {
    query: 'Quanto está a inadimplência este mês?',
    user_id: 'marcelo',
    session_id: 'sess-abc-123',
    available_tools: ['memory.recall', 'memory.add', 'supabase.query'],
    available_mcps: ['supabase-mcp', 'memory-mcp'],
  },
  {
    recall: memory.recall, // from @ecossistema/memory (S7)
  },
);

console.log(result.system_prompt);
console.log(result.meta);
// {
//   agent_id: 'cfo-fic',
//   business_id: 'fic',
//   assembled_at: '2026-04-17T...',
//   layers_included: 8,
//   layer_sizes: { identity: 241, environment: 198, ... },
//   evolved_config_version: 'a1b2c3...',  // SHA-256 agregado
//   exclude_dynamic_sections: false,
// }
```

## Evolved Config

Cada agente tem uma pasta de evolved config com:

```
apps/<business>/agents/<agent>/evolved/
├── constitution.md      ← IMUTÁVEL — SHA-256 validado em runtime
├── persona.md           ← tom e estilo (Marcelo edita via PR)
├── user-profile.md      ← Marcelo Silva (BAM, preferências)
├── domain-knowledge.md  ← fatos do negócio
└── strategies/
    ├── task-patterns.md
    ├── tool-preferences.md
    └── error-recovery.md
```

A constitution.md é **byte-validada** contra um hash canônico. Se o arquivo foi alterado fora do processo de governança (PR assinado por Marcelo + atualização do hash), o assembler lança `ConstitutionTamperedError` e o agente não sobe.

Os templates iniciais em `templates/evolved-config-base/` servem como baseline — instância do agente copia e customiza.

## Role Templates (YAML)

`templates/roles/<role>.yaml`, com suporte a variantes:

```yaml
role: CFO-IA
mission: >
  Gestor financeiro do negócio...
responsibilities:
  - Monitorar KPIs
decision_boundaries:
  autonomous_actions: [...]
  requires_approval: [...]
kpis: [...]
variants:
  educacao:
    responsibilities:
      - Emitir boletos de mensalidade...
    kpis:
      - inadimplencia_mensalidades
```

Selecione variant via `config.role_variant`.

Templates já inclusos nesta versão:
- `ceo-ia.yaml`
- `cfo-ia.yaml` (base + variante `educacao`)
- `directors/d-governanca.yaml`

Outros vêm em S11 (C-Suite templates).

## Degraded mode

- `recall` ausente → camada 9 vazia.
- `recall` lança → camada 9 vazia (§ 32 — memory nunca derruba agente).
- `exclude_dynamic_sections: true` → camada 9 vazia.

## Cardinal Rule

Este pacote é **encanamento** (Art. XVII). Não faz NLP, não classifica intenção, não decide nada. Só concatena strings na ordem certa com os hashes certos.

## Testes

```bash
pnpm --filter @ecossistema/prompt-assembler test
pnpm --filter @ecossistema/prompt-assembler test:coverage
```

## Handoff

- **S11** — consome para gerar todos os diretores
- **S10** — integra no boot de cada agente Managed Agents
- **S16** — primeiro consumidor em produção (CFO-FIC piloto)
