# @ecossistema/c-suite-templates

Templates reutilizáveis de agentes C-Suite e Diretores de Área para o Ecossistema de IA do Marcelo Silva.

Implementa o padrão do **MASTERPLAN-V9 §16** — cada negócio instancia base + variant, mantendo ~50 linhas de contexto específico. Melhorar o template CFO-IA uma vez = todos os 5 CFOs herdam.

---

## Estrutura

```
templates/
  c-suite/
    CFO-IA/          ← completo (S11)
    CEO-IA/          ← completo (S11)
    CAO-IA/          ← Fase 1
    CMO-IA/          ← Fase 1
    ... (outros 6)
  directors/
    D-Governanca/    ← completo (S11)
    D-Estrategia/    ← Fase 1
    ... (outros 4)
  claudinho/         ← completo (S11) — VP Opus 4.6
src/
  types.ts           ← tipos canônicos
  instantiator.ts    ← cria instância a partir do template
  generator.ts       ← wrapper CLI-friendly
  index.ts           ← exports
bin/
  create-csuite-agent.js  ← CLI
tests/
  instantiator.test.ts    ← testes de instanciação
```

---

## Criar um novo agente

```bash
# CFO para a FIC
pnpm create-csuite-agent --business fic --role cfo

# CEO para o Intentus
pnpm create-csuite-agent --business intentus --role ceo

# Diretor de Governança (cross-business)
pnpm create-csuite-agent --business ecosystem --role d-governanca

# Com variant explícito
pnpm create-csuite-agent --business nexvy --role ceo --variant saas

# Listar templates disponíveis
pnpm create-csuite-agent --list
```

**O que é criado em `apps/{business}/agents/{role}/`:**
- `variant.md` — contexto setorial específico
- `evolved-config/` — persona, user-profile, domain-knowledge, strategies/
- `agent.config.yaml` — config gerado com referências ao template base

---

## Auto-detecção de variant

| Business | Variant detectada |
|---------|------------------|
| fic, klesis | educacao |
| intentus, splendori | imobiliario |
| nexvy | saas |

---

## Adicionar um novo role (template)

1. Criar `templates/c-suite/{ROLE}-IA/` com:
   - `base-prompt.md` — missão, mentalidade, boundaries, artigos (Chief tier 0)
   - `variants/educacao.md`, `imobiliario.md`, `saas.md`
   - `skills.yaml` — whitelist/blacklist, HITL triggers, budget
   - `hooks.ts` — artigos constitucionais aplicáveis
   - `evolved-config-seed/` — persona, user-profile, domain-knowledge, strategies/

2. (Opcional, ADR-017) Adicionar subdirs de squad pattern:
   - `masters/*.md` — subpersonas tier 1 invocadas pelo chief
   - `tasks/*.md` — ações atômicas reutilizáveis
   - `workflows/*.yaml` — pipelines multi-agente declarativos
   - `checklists/*.md` — quality gates (ex: `bam-alignment.md`)

3. Adicionar ao `roleToTemplateKey()` em `src/instantiator.ts` se necessário

4. Criar teste em `tests/instantiator.test.ts`

## Squad pattern (ADR-017)

Cada template C-level pode expor uma hierarquia **Chief (tier 0) → Masters (tier 1) → Specialists (tier 2)**:

- **Chief** = `base-prompt.md` + `evolved-config-seed/` (já existia)
- **Masters** = `masters/*.md` — cada master é uma subpersona com escopo delimitado (ex: `fpa.md`, `tax.md` no CFO)
- **Specialists** = executores no `@ecossistema/task-registry` (Inter, PyNFe, BRy) — não duplicam aqui

Tasks, workflows e checklists são **opcionais** por template — roles sem demanda (ex: D-Governanca hoje) podem omitir.

Piloto: CFO-IA (S16 — CFO-FIC).

---

## Adicionar uma variante setorial

1. Criar `templates/c-suite/{ROLE}-IA/variants/{nova-variant}.md`
2. Adicionar mapeamento em `BUSINESS_VARIANT_MAP` em `src/types.ts`

---

## Evolved Config

O diretório `evolved-config/` começa como cópia do `evolved-config-seed/` do template.
O agente **evolui estes arquivos** conforme usa o sistema:
- `persona.md` — refina tom e estilo baseado em feedback
- `domain-knowledge.md` — acumula conhecimento do negócio específico
- `strategies/*.md` — padrões descobertos em operação

Nunca sobrescreva o `evolved-config/` ao atualizar o template base.

---

## Instâncias existentes

| Agente | Localização | Status |
|--------|------------|--------|
| CFO-FIC | `apps/fic/agents/cfo/` | ✅ Instanciado (S11) |
| CEO-FIC | — | Fase 1 |
| D-Governanca | — | Fase 1 |
| Claudinho | — | Fase 1 |

---

## Dependências

- `@ecossistema/constitutional-hooks` — hooks constitucionais importados pelos templates
- `commander` — CLI
- `fs-extra` — file system operations
- `js-yaml` — serialização do agent.config.yaml

---

## Testes

```bash
pnpm test
```

Testa instanciação CFO-FIC, CEO-FIC, D-Governanca e auto-detect de variants.
