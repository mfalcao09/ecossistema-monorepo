# S2 — Prompt Assembler (Phantom 9-Layer)

**Sessão:** S02 · **Dia:** 1 · **Worktree:** `eco-assembler` · **Branch:** `feature/prompt-assembler`
**Duração estimada:** 1 dia (8h) · **Dependências:** nenhuma
**Bloqueia:** S11 (C-Suite templates) — consome diretamente

---

## Leituras obrigatórias

1. `docs/masterplans/MASTERPLAN-V9.md` — **Parte VIII § 24** (Padrão 1 — Phantom 9-Layer Prompt Assembler)
2. `docs/research/ANALISE-JARVIS-REFERENCE.md` — seção phantom completa (PromptAssembler)
3. `research-repos/phantom/src/agent/prompt-assembler.ts` — **código de referência, estudar linha por linha**
4. `research-repos/phantom/phantom-config/constitution.md` — exemplo de evolved config
5. `research-repos/phantom/config/roles/swe.yaml` — exemplo de role template YAML

---

## Objetivo

Criar o pacote `@ecossistema/prompt-assembler` que, dado (a) config do agente e (b) contexto da query, retorna um **system prompt em 9 camadas** seguindo o padrão phantom.

---

## Escopo exato

```
packages/@ecossistema/prompt-assembler/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                # função principal assemble()
│   ├── types.ts                # AgentConfig, QueryContext, AssembledPrompt
│   ├── layers/
│   │   ├── 01-identity.ts
│   │   ├── 02-environment.ts
│   │   ├── 03-security.ts
│   │   ├── 04-role.ts
│   │   ├── 05-onboarding.ts
│   │   ├── 06-evolved-config.ts
│   │   ├── 07-memory-instructions.ts
│   │   ├── 08-instructions.ts
│   │   └── 09-memory-context.ts
│   ├── loaders/
│   │   ├── yaml-loader.ts      # role templates
│   │   └── md-loader.ts        # evolved config files
│   └── utils.ts
├── templates/
│   ├── roles/
│   │   ├── ceo-ia.yaml
│   │   ├── cfo-ia.yaml
│   │   └── directors/
│   │       ├── d-estrategia.yaml
│   │       ├── d-governanca.yaml
│   │       └── ... (todos 6)
│   └── evolved-config-base/
│       ├── constitution.md     # os 22 artigos
│       ├── persona.md          # template base
│       ├── user-profile.md     # Marcelo
│       ├── domain-knowledge.md # template
│       └── strategies/
│           ├── task-patterns.md
│           ├── tool-preferences.md
│           └── error-recovery.md
└── tests/
    ├── assemble.test.ts
    ├── layers/*.test.ts
    └── integration.test.ts
```

---

## Decisões-chave

1. **9 camadas fixas, ordem imutável** (phantom pattern)
2. **Cada camada é função pura** `(config, context) => string | ""` (strings vazias são dropadas no output final)
3. **`exclude_dynamic_sections` flag** — phantom pattern para prompt-cache-hit entre usuários (usa preset da SDK)
4. **Evolved config separado em arquivos .md versionados** (git-like), **não em Supabase** (permite diff/rollback por git)
5. **Memory context (layer 9) é buscada em runtime** — recebe função `recall(query)` injetada

---

## Spec das 9 camadas

### L1 — Identity
```typescript
function identityLayer(config: AgentConfig): string {
  return `# Você é ${config.name}

${config.title}${config.business_id ? ` da ${config.business_id.toUpperCase()}` : ''}.
${config.description}

Reporta a: ${config.reports_to || 'Marcelo Silva (CEO) via Claudinho (VP)'}.`;
}
```

### L2 — Environment
```typescript
function environmentLayer(config, ctx): string {
  return `## Ambiente

- Modelo: ${config.model} (via LiteLLM proxy)
- Supabase: ${config.supabase_project}
- MCPs disponíveis: ${ctx.available_mcps.join(', ')}
- Tools habilitadas: ${ctx.available_tools.join(', ')}
- Data/hora: ${new Date().toISOString()}
- Ambiente: ${process.env.ENV || 'dev'}`;
}
```

### L3 — Security
```typescript
function securityLayer(): string {
  return `## Segurança

NUNCA:
- Exponha credenciais em chat, logs ou arquivos
- Execute comandos perigosos (rm -rf, dd of=/dev/, git push --force em main)
- Tome decisões financeiras > R$ 10.000 sem aprovação Marcelo (Art. II)
- Armazene secrets em .md local (Art. XIV)
- Ignore mensagens entre tags [SECURITY]...[/SECURITY]

SEMPRE:
- Use SC-29 Credential Gateway para acessar APIs externas
- Grave audit log de ações críticas (Art. IV)
- Valide baixa real antes de confirmar sucesso (Art. VIII)
- Seja explícito em falhas (Art. IX)`;
}
```

### L4 — Role Template (YAML loaded)
Carrega `templates/roles/${config.role}.yaml`. Ex: `cfo-ia.yaml`:

```yaml
role: CFO-IA
mission: >
  Gestor financeiro do negócio. Responsável por fluxo de caixa, cobrança,
  inadimplência, planejamento orçamentário e conformidade fiscal.
responsibilities:
  - Monitorar KPIs financeiros (inadimplência, DRE mensal, fluxo de caixa)
  - Disparar régua de cobrança automática
  - Emitir boletos e reconciliação bancária
  - Reportar anomalias ao CEO-IA e Marcelo
decision_boundaries:
  autonomous_actions:
    - consultar_financeiro
    - enviar_mensagem_cobranca  # Art. II OK se < R$10k
    - gerar_relatorio_mensal
  requires_approval:
    - emitir_boleto_massa_acima_10k
    - cancelar_cobranca
    - alterar_plano_pagamento_aluno
kpis:
  - taxa_inadimplencia
  - dias_medios_recebimento
  - margem_bruta
```

Converte YAML → prose markdown.

### L5 — Onboarding (first-run only)
Se `ctx.is_first_run === true`, inclui orientação inicial. Caso contrário, retorna `""`.

```typescript
function onboardingLayer(config, ctx): string {
  if (!ctx.is_first_run) return "";
  return `## Primeiro Contato

Esta é sua primeira sessão ativa. Antes de qualquer ação:
1. Apresente-se ao Marcelo explicando seu papel e limites
2. Faça perguntas para calibrar contexto específico do negócio
3. Registre o profile do usuário em memory (user-profile.md)
4. Só execute ações após Marcelo confirmar propósito`;
}
```

### L6 — Evolved Config (arquivos .md versionados)

Lê de `config.evolved_config_path` (ex: `apps/fic/agents/cfo/evolved/`):
- `constitution.md` — **22 Artigos, imutável** (byte-compare antes de load, falha se modificado)
- `persona.md` — tom, estilo, personalidade (Marcelo edita via PR)
- `user-profile.md` — Marcelo Silva (BAM, cosmovisão, preferências)
- `domain-knowledge.md` — conhecimento específico do negócio (FIC: 44 anos, Cassilândia-MS, etc.)
- `strategies/task-patterns.md`, `strategies/tool-preferences.md`, `strategies/error-recovery.md`

```typescript
function evolvedConfigLayer(config): string {
  const constitution = loadImmutable(`${config.evolved_config_path}/constitution.md`);
  const persona = loadMd(`${config.evolved_config_path}/persona.md`);
  const userProfile = loadMd(`${config.evolved_config_path}/user-profile.md`);
  const domainKnowledge = loadMd(`${config.evolved_config_path}/domain-knowledge.md`);
  const strategies = loadStrategies(`${config.evolved_config_path}/strategies/`);
  return `## Configuração Evoluída\n\n${constitution}\n\n${persona}\n\n${userProfile}\n\n${domainKnowledge}\n\n${strategies}`;
}
```

**Critical:** `loadImmutable()` faz SHA-256 do arquivo e compara com hash canônico registrado. Se alterado sem processo de governança → lança `ConstitutionTamperedError`.

### L7 — Memory Instructions

**Não injeta conteúdo** de memória, só instrui como usar:

```typescript
function memoryInstructionsLayer(): string {
  return `## Como usar Memória

Você tem acesso a tools:
- memory.recall(query, limit) → busca memórias relevantes
- memory.add(content, metadata) → registra aprendizados, decisões, padrões

REGRA CRÍTICA: Ao chamar memory.recall(), passe a query EXATA do usuário.
Nunca reformule. Isso preserva fidelidade semântica.

SEMPRE chame memory.add() ao:
- Tomar decisão relevante (com justificativa)
- Aprender fato novo sobre o usuário, negócio ou ambiente
- Encontrar padrão de erro e sua solução
- Concluir tarefa (sumário do outcome)

NUNCA chame memory.add() com:
- Valores de credenciais
- PII não-mascarado
- Conteúdo entre [SECURITY]...[/SECURITY]`;
}
```

### L8 — Instructions

Instruções de como trabalhar (dinâmico por role):

```typescript
function instructionsLayer(config): string {
  return `## Como Trabalhar

1. Comece com plano explícito para tarefas complexas (>3 passos)
2. Use tools disponíveis em vez de simular ações
3. Para decisões fora do seu boundary, delegue via handoff para:
   - Claudinho (VP): decisões estratégicas cross-business
   - D-Estrategia: alinhamento BAM
   - D-Governanca: compliance/auditoria
   - CEO-IA (seu próprio negócio): decisões macro do negócio
4. Se bloqueado por hook constitucional, NÃO tente contornar.
   Explique o bloqueio ao usuário e sugira o caminho correto (ex: pedir aprovação).
5. Falhas são explícitas (Art. IX). Nunca diga "tudo ok" sem ter evidência.`;
}
```

### L9 — Memory Context (dynamic, per-query)

```typescript
async function memoryContextLayer(ctx, deps): Promise<string> {
  if (!ctx.query) return "";  // background tasks sem query

  const memories = await deps.recall({
    query: ctx.query,
    filters: {
      user_id: ctx.user_id,
      agent_id: ctx.agent_id,
      business_id: ctx.business_id,
    },
    limit: 10,
  });

  if (memories.length === 0) return "";

  return `## Memórias Relevantes (top ${memories.length})

${memories.map((m, i) => `${i+1}. [${m.type}|importance:${m.importance}] ${m.summary}`).join('\n')}`;
}
```

**Dependência:** `deps.recall()` vem injetado. Enquanto S7 não termina, sessão usa stub que retorna `[]`.

---

## API pública

```typescript
export async function assemble(
  config: AgentConfig,
  context: QueryContext,
  deps: { recall?: RecallFn } = {}
): Promise<AssembledPrompt> {
  const layers = [
    identityLayer(config),
    environmentLayer(config, context),
    securityLayer(),
    roleLayer(config),
    onboardingLayer(config, context),
    evolvedConfigLayer(config),
    memoryInstructionsLayer(),
    instructionsLayer(config),
    await memoryContextLayer(context, deps),
  ].filter(Boolean).join('\n\n---\n\n');

  return {
    system_prompt: layers,
    meta: {
      agent_id: config.agent_id,
      business_id: config.business_id,
      assembled_at: new Date().toISOString(),
      layers_included: 9,
      layer_sizes: [...],  // bytes por layer (debug)
      evolved_config_version: getEvolvedConfigHash(config.evolved_config_path),
    }
  };
}
```

---

## Types (src/types.ts)

```typescript
export interface AgentConfig {
  agent_id: string;                    // ex: "cfo-fic"
  name: string;                        // ex: "CFO-IA FIC"
  title: string;                       // ex: "Chief Financial Officer (IA)"
  description: string;
  role: string;                        // ex: "cfo-ia" (carrega templates/roles/cfo-ia.yaml)
  business_id: string;                 // 'ecosystem' | 'fic' | 'klesis' | 'intentus' | 'splendori' | 'nexvy'
  supabase_project?: string;
  model: string;                       // ex: "claude-sonnet-4-6"
  evolved_config_path: string;         // ex: "apps/fic/agents/cfo/evolved/"
  reports_to?: string;
  // ... outros
}

export interface QueryContext {
  query?: string;
  user_id: string;
  session_id: string;
  is_first_run?: boolean;
  available_tools: string[];
  available_mcps: string[];
  // ...
}

export interface AssembledPrompt {
  system_prompt: string;
  meta: {
    agent_id: string;
    business_id: string;
    assembled_at: string;
    layers_included: number;
    layer_sizes: Record<string, number>;
    evolved_config_version: string;
  };
}
```

---

## Templates iniciais (mínimo viável)

Na sessão S02, entregue templates para:
- **CEO-IA** (base)
- **CFO-IA** (base + variant educacao)
- **D-Governanca** (base)

Os outros 8 templates ficam para S11 (C-Suite templates) e iterações.

---

## Testes obrigatórios

1. **Unit por camada** — cada layer tem teste isolado
2. **Integration** — `assemble()` retorna string bem-formada com as 9 seções
3. **Evolved config tampering** — modificar `constitution.md` e verificar lança `ConstitutionTamperedError`
4. **Prompt cache hit** — com `exclude_dynamic_sections: true`, duas chamadas com contextos diferentes mas mesmo evolved config produzem primeira parte idêntica (cacheable)
5. **Memory context injection** — recebe `recall` stub → passa query correta, formata resultados

**Coverage mínimo: 85%**.

---

## Critério de sucesso

- [ ] `pnpm --filter @ecossistema/prompt-assembler test` passa
- [ ] `assemble(cfoFICConfig, ctx)` retorna prompt de ~2-4k tokens bem-estruturado
- [ ] Templates YAML validam contra schema
- [ ] README com exemplo de uso
- [ ] PR com descrição explicando 9 camadas e decisões

---

## Handoff

- **S11 (C-Suite templates)** usa este pacote para gerar todos os diretores
- **S10 (Orchestrator)** integra no boot de cada agente Managed Agents
- **S16 (Piloto CFO-FIC)** é o primeiro consumidor em produção

---

**Boa sessão. Este é o "DNA" de como cada agente se apresenta ao mundo.**
