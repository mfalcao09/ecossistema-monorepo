# ADR-009: 22 Artigos Constitucionais como hooks executáveis

- **Status:** aceito
- **Data:** 2026-04-16
- **Decisores:** Marcelo Silva (CEO), Claudinho (VP)
- **Relacionado:** MASTERPLAN-V9 § Parte V §11 §12 §13, MASTERPLAN-ECOSSISTEMA-v8.2 22 Artigos, `packages/constitutional-hooks/`, S01

## Contexto e problema

No V8.2, os 22 Artigos Constitucionais eram **texto em markdown** citado nos prompts dos agentes. O agente **deveria** seguir, mas:

- Nada no runtime forçava
- Violações eram detectadas depois (audit manual)
- Art. II (HITL), Art. III (idempotência), Art. XIX (segurança) exigem gates **antes** da ação — prompt não garante

Precisamos transformar os verificáveis em **código que intercepta** ações do agente via hooks do Claude Agent SDK (`PreToolUse` / `PostToolUse` / `SessionEnd`). Os subjetivos (ex: Art. I Primazia do Propósito) continuam como diretrizes de prompt.

## Opções consideradas

- **Opção 1:** Apenas diretrizes de prompt (status quo V8.2)
- **Opção 2:** Tudo como hook (inclusive subjetivos)
- **Opção 3:** Mix — verificáveis como hooks, subjetivos como diretrizes

## Critérios de decisão

- Confiabilidade do enforcement (prompt pode ser "esquecido" pelo LLM)
- Custo de implementação
- Testabilidade (hook = função pura testável)
- Flexibilidade (subjetivos mudam mais com contexto)

## Decisão

**Escolhemos Opção 3 (mix)** — 11 Artigos verificáveis como hooks + 11 como diretrizes.

**Tabela canônica Artigo → Hook (§11 V9):**

| Artigo | Tipo |
|---|---|
| II HITL Crítico | `PreToolUse` — bloqueia ações irreversíveis ou > R$ 10k sem aprovação |
| III Idempotência | `PreToolUse` — injeta idempotency_key, rejeita duplicata 24h |
| IV Rastreabilidade | `PostToolUse` — grava audit_log append-only |
| VIII Baixa Real | `PostToolUse` — valida sucesso real (não "202 vazio") |
| IX Falha Explícita | `PostToolUse` — transforma silenciosas em `raise` |
| XII Custos | `PreToolUse` — checa budget LiteLLM, bloqueia se excedido |
| XIV Dual-Write | `PreToolUse` — intercepta `Write/Edit` de secrets/memory/tasks; redireciona para Supabase |
| XIX Segurança | `PreToolUse` — blocklist Bash: `rm -rf /`, `dd of=/dev/`, `git push --force`, `kill -9 1` |
| XX Soberania Local | `PreToolUse` — prioriza Supabase local antes API externa |
| XVIII Data Contracts | `PreToolUse` — valida payload vs JSON Schema |
| XXII Aprendizado | `SessionEnd` — extrai padrões/lições → Mem0 |

Pacote canônico: `@ecossistema/constitutional-hooks` (entregue S01 — 11 hooks, 70 testes, 93% coverage).

## Consequências

### Positivas
- Enforcement **no runtime**, não no prompt
- Violações = erro visível, não esquecimento silencioso
- Hooks são funções puras testáveis (70 testes existem em S01)
- Mudar um limite = PR + teste, não retrainar prompt
- Auditável: todo bloqueio tem motivo em `audit_log`

### Negativas
- Hook com bug bloqueia agente produtivo (mitigado por fail-soft no Art. IV)
- Adiciona latência em cada tool call (~5-20ms por hook)
- Necessário educar novos agentes a registrar os hooks certos

### Neutras / riscos
- **Risco:** hook fail-closed desnecessário bloqueia legítimo. **Mitigação:** decisões canônicas S01 — Art. XII fail-closed (custo > inconveniência), Art. IV fail-soft (audit não bloqueia agente).
- **Risco:** blocklist regex furada. **Mitigação:** S01 endureceu regex Art. XIX: `/\bdd\b[^;|&\n]*\bof=\/dev\//` (não a forma literal original).

## Evidência / pesquisa

- `phantom/src/agent/hooks.ts` — padrão de implementação validado
- `packages/constitutional-hooks/` — entregue S01 (PR #3) com 11 hooks + 70 testes
- Claude Agent SDK docs: `PreToolUse` / `PostToolUse` / `SessionEnd` APIs
- `docs/sessions/fase0/S01-hooks.md` + log da execução S01

## Ação de implementação

- S01 entregue (✅ 2026-04-17) — 11 hooks canônicos
- Templates C-Suite importam hooks apropriados ao instanciar (sessão S11)
- Piloto CFO-FIC como primeiro teste real em produção (sessão S16)
- Art. XXII stub atual (`console.log TODO(S7)`) trocar por `memory.add()` quando S07 entregar

## Revisão

Revisar em 2026-10-16 ou quando houver 3 violações canônicas não pegas pelos hooks.
