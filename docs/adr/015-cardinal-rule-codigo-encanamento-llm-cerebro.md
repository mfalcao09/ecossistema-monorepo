# ADR-015: Cardinal Rule — "código é encanamento, Agent SDK é cérebro"

- **Status:** aceito
- **Data:** 2026-04-16
- **Decisores:** Marcelo Silva (CEO), Claudinho (VP)
- **Relacionado:** MASTERPLAN-V9 § Parte VIII §25, `CLAUDE.md` raiz, ADR-009

## Contexto e problema

Ao construir sistemas multi-agente, há tentação recorrente de "ajudar" o LLM com heurísticas em código:

- `detectFramework()` com regex para decidir rota
- `parseIntent()` baseado em palavra-chave
- `classifyFrameworkXxx()` com switch gigante
- If/else para decisões que dependem de contexto real

Cada uma dessas funções:
- Vira débito técnico eterno (casos extremos crescem sem parar)
- Duplica responsabilidade do LLM (agente já decide; código decide "melhor"; conflito)
- Quebra silenciosamente quando linguagem natural foge do padrão
- Aumenta acoplamento (mudar uma regex quebra 3 fluxos)

Phantom codificou esse princípio como **Cardinal Rule** na primeira linha do `CLAUDE.md`. Nós adotamos como canônico V9.

## Opções consideradas

- **Opção 1:** Sem regra — cada desenvolvedor decide
- **Opção 2:** Cardinal Rule + lint bloqueia funções `detectXxx|parseIntentXxx|classifyXxx` fora de `/fallback/`
- **Opção 3:** Ban total de heurísticas (inclusive fallback) — impraticável (pg_cron tem que funcionar sem LLM)

## Critérios de decisão

- Consistência de decisão arquitetural ao longo do tempo
- Facilidade de onboarding (regra simples de verbalizar)
- Necessidade de fallback quando LLM está indisponível

## Decisão

**Escolhemos Opção 2.**

**Regra canônica:** *"TypeScript/Python é encanamento. O Agent SDK é o cérebro."*

**O que é PROIBIDO fora de `/fallback/`:**
- `detectXxx()`, `parseIntentXxx()`, `classifyFrameworkXxx()` — heurísticas em código
- Regex para interpretar intenção do usuário
- Switch/case para decisões que dependem de contexto

**O que é PERMITIDO:**
- Código para orquestração (rotas HTTP, SQLite, filas)
- Código para **deterministic gates** (hooks constitucionais — ADR-009)
- **HEURISTIC FALLBACK explícito** quando LLM está indisponível (flag `-fallback` e isolado em `/fallback/`)

**Aplicação:** primeira linha do `CLAUDE.md` raiz. Lint rule ESLint/Ruff bloqueia funções com esses prefixos em paths não-`/fallback/`.

## Consequências

### Positivas
- Atalho mental: "quem está decidindo aqui? LLM ou código?" — decisões subjetivas ficam com LLM
- Menos código para manter (heurísticas são débito)
- Fallbacks existem mas ficam explícitos (visíveis em code review)
- Consistência entre agentes (mesma filosofia em todo monorepo)

### Negativas
- Curva de aprendizado para devs vindo de sistemas determinísticos
- Fallback bem desenhado é trabalhoso (mas é exceção, não regra)
- Pode parecer "deixar LLM decidir tudo" — precisa educar time

### Neutras / riscos
- **Risco:** alguns casos genuínos de regex (ex: validar CPF) serem rejeitados. **Mitigação:** validação de formato **não** é decisão de intenção; regra é específica a `detect/parseIntent/classify`.
- **Risco:** lint rule falso-positivo. **Mitigação:** allowlist via `// cardinal-rule: allow` comentário em revisão humana.

## Evidência / pesquisa

- `phantom/CLAUDE.md` — primeira linha
- Prática observada em `claude-cookbooks` oficiais
- Confirmação em S01 (constitutional-hooks): hooks são gates determinísticos (permitido), NÃO heurísticas de intenção (proibido)

## Ação de implementação

- Primeira linha do `CLAUDE.md` raiz cita Cardinal Rule explicitamente (a fazer)
- Lint rule ESLint: `no-restricted-syntax` para `detect*|parseIntent*|classify*` fora `/fallback/` (a fazer — ferramenta lint separada)
- Ruff `custom-lint` para Python análogo (a fazer)
- Code review: reviewers checam contra Cardinal Rule

## Revisão

Revisar quando houver primeiro caso documentado de "heurística que deveria ter sido agente" ou vice-versa.
