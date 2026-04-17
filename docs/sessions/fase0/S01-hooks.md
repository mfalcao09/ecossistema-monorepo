# S1 — Constitutional Hooks

**Sessão:** S01 · **Dia:** 1 · **Worktree:** `eco-hooks` · **Branch:** `feature/constitutional-hooks`
**Slot:** Slot 1 Dia 1 · **Duração estimada:** 1 dia (8h)
**Dependências:** nenhuma
**Bloqueia:** S11 (C-Suite templates), S13 (Clients), S16 (Piloto CFO-FIC) — todos consomem os hooks

---

## Leituras obrigatórias antes de começar

1. `CLAUDE.md` (raiz) — Cardinal Rule e operação do monorepo
2. `MEMORY.md` (raiz) — decisões canônicas
3. `docs/masterplans/MASTERPLAN-V9.md` — **Parte V completa** (§§ 11-13) com tabela Artigo → Hook e exemplo do Art. II
4. `docs/research/ANALISE-GRUPO1-V6-CORE-COMPLETA.md` — seção sobre `claude-mem` (hooks lifecycle)
5. `research-repos/phantom/src/agent/hooks.ts` — referência de implementação production-grade
6. SDK reference: `research-repos/claude-agent-sdk-python/src/claude_agent_sdk/types.py` (tipos Hook)

---

## Objetivo

Criar o pacote `@ecossistema/constitutional-hooks` com **11 hooks executáveis** que transformam Artigos Constitucionais verificáveis em código que roda no Claude Agent SDK interceptando `PreToolUse` / `PostToolUse` / `SessionEnd`.

---

## Escopo exato

```
packages/constitutional-hooks/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                      # exporta todos
│   ├── types.ts                      # tipos compartilhados (HookContext, HookDecision)
│   ├── utils.ts                      # helpers (createApprovalRequest, writeAuditLog, etc.)
│   ├── art-ii-hitl.ts                # Human-in-the-loop Crítico (PreToolUse)
│   ├── art-iii-idempotency.ts        # Idempotência Universal (PreToolUse)
│   ├── art-iv-audit.ts               # Rastreabilidade Total (PostToolUse)
│   ├── art-viii-baixa-real.ts        # Confirmação por Baixa Real (PostToolUse)
│   ├── art-ix-falha-explicita.ts     # Falha Explícita (PostToolUse)
│   ├── art-xii-cost-control.ts       # Custos sob Controle (PreToolUse)
│   ├── art-xiv-dual-write.ts         # Dual-Write Supabase-first (PreToolUse)
│   ├── art-xviii-data-contracts.ts   # Data Contracts Versionados (PreToolUse)
│   ├── art-xix-security.ts           # Segurança em Camadas (PreToolUse)
│   ├── art-xx-soberania.ts           # Soberania Local (PreToolUse)
│   └── art-xxii-aprendizado.ts       # Aprendizado é Infraestrutura (SessionEnd)
└── tests/
    ├── art-ii-hitl.test.ts
    ├── art-iii-idempotency.test.ts
    ├── ... (um por hook)
    └── integration.test.ts           # todos juntos em um agente simulado
```

---

## Decisões-chave já tomadas (não debater)

1. **Linguagem:** TypeScript (os agentes TS chamam direto; agentes Python consomem via proxy HTTP)
2. **SDK target:** `@anthropic-ai/claude-agent-sdk` (versão mais recente)
3. **Hook signature:** sigam o formato do phantom:
   ```typescript
   type PreToolUseHook = (ctx: HookContext) => Promise<{ decision: "allow" | "block"; reason?: string }>;
   type PostToolUseHook = (ctx: HookContext & { result: any }) => Promise<void>;
   type SessionEndHook = (ctx: SessionContext) => Promise<void>;
   ```
4. **Bloqueios sempre retornam `reason` descritivo** começando com "Art. N: ..." (rastreável)
5. **Audit log assíncrono** — não atrasa a ação (exceto Art. II que exige aprovação síncrona)

---

## Spec detalhado dos 11 hooks

### Art. II — HITL Crítico (`PreToolUse`)

**Bloqueia ações:**
- Irreversíveis: `deletar_dados_aluno`, `assinar_contrato`, `cancelar_matricula`, `rotacionar_credencial_prod`
- Financeiras > R$ 10.000: `emitir_boleto_massa`, `pix_transferencia`, `pagamento_fornecedor`
- Configuráveis via `ECO_HITL_THRESHOLD_BRL` env (default 10000)

**Cria request de aprovação:**
```typescript
await createApprovalRequest({
    agent_id: ctx.agent_id,
    business_id: ctx.business_id,
    tool_name,
    tool_input,
    reason_for_approval,
    status: "pending",
});
// Depois dispara webhook → notificação WhatsApp → Marcelo aprova/rejeita
```

Retorna `{ decision: "block", reason: "Art. II: ... Aprovação humana requisitada via status_idled." }`.

### Art. III — Idempotência (`PreToolUse`)

Antes de tool call, se tool tem flag `idempotent: true` (ou está em lista de idempotentes), injeta `idempotency_key = sha256(agent_id + tool_name + normalize(tool_input) + YYYY-MM-DD)`.

Checa `idempotency_cache` no Supabase:
- Se key já existe nas últimas 24h → bloqueia com `reason: "Art. III: Duplicata em janela de 24h"`
- Se não existe → grava e permite

### Art. IV — Rastreabilidade (`PostToolUse`)

Grava **sempre** em `audit_log` (ECOSYSTEM):
```sql
insert into audit_log (agent_id, business_id, tool_name, tool_input_hash, result_hash, success, timestamp, trace_id)
```

Input/output só como **hashes SHA-256** (LGPD-safe). Payload real só em Langfuse (retenção curta).

### Art. VIII — Baixa Real (`PostToolUse`)

Valida que o tool retornou **sucesso real**, não:
- `{ status: "accepted" }` sem confirmação
- Stub/mock (detecta via flag `is_mock` em ambientes não-prod)
- Timeout mascarado como sucesso

Se suspeito: marca `audit_log.success = false` + reason, e emite evento `art_viii_violation` no Langfuse.

### Art. IX — Falha Explícita (`PostToolUse`)

Se o tool lançou exceção **silenciosa** (ex: retornou `{ error: null }` mas HTTP foi 500):
- Transforma em exceção visível (`throw new ToolFailedError(...)`)
- Grava em audit com severity=HIGH

### Art. XII — Custos (`PreToolUse`)

Apenas para tool calls que chamam LLMs via LiteLLM (`tool_name` começa com `llm_`):
- Consulta budget do `business_id` no LiteLLM proxy
- Se remaining < custo estimado da chamada → bloqueia
- Estima via `model × tokens_esperados × preço/1k`

### Art. XIV — Dual-Write (`PreToolUse`)

Intercepta `Write` e `Edit` quando o `path` contém:
- `/memory/*.md`, `/secrets/*`, `/credentials/*`, `/tasks/*`, `/sessions/*`

Redireciona para chamada equivalente no Supabase (tabelas `ecosystem_memory`, `ecosystem_credentials`, `agent_tasks`, `ecosystem_sessions`) e bloqueia o arquivo.

`reason: "Art. XIV: Write em arquivo crítico redirecionado para Supabase (dual-write)"`.

### Art. XVIII — Data Contracts (`PreToolUse`)

Tools com `input_schema` declarado (JSON Schema) têm input validado antes de executar.

Se inválido → bloqueia com `reason: "Art. XVIII: Input não conforma schema vN da tool X: <erro>"`

Usa `ajv` como validador.

### Art. XIX — Segurança (`PreToolUse`)

Para tool `Bash`:
```typescript
const BLOCKLIST = [
    /rm\s+-rf\s+\//,
    /mkfs/,
    /dd\s+of=\/dev\//,
    /git\s+push\s+--force\s+(origin\s+)?(main|master)/,
    /docker\s+(compose\s+)?down\b.*--volumes/,
    /systemctl\s+stop\s+(supabase|railway|postgres)/,
    /kill\s+-9\s+1\b/,
    />\s*\/dev\/sda/,
    /curl.*\|\s*(sh|bash)/,  // curl | bash pattern
];
```
Qualquer match → `{ decision: "block", reason: "Art. XIX: Comando perigoso detectado: <match>" }`

**Nota:** isso é **defesa em profundidade**, não fronteira de segurança. A fronteira real é VM/container isolation.

### Art. XX — Soberania Local (`PreToolUse`)

Quando tool pede dado que existe no Supabase E em API externa, prefere Supabase:
- `buscar_aluno_cpf` → query `pessoas` no ERP-FIC antes de chamar Receita Federal
- `cotacao_imovel` → query `empreendimentos` no Intentus antes de API externa

Implementado como **hint** (não bloqueia): grava sinal em telemetry; agente reavalia próxima chamada.

### Art. XXII — Aprendizado (`SessionEnd`)

Ao fim de cada sessão:
1. Extrai: `tools_used`, `files_touched`, `outcome` (success/failure/partial)
2. Gera resumo via LLM (Haiku, barato): "O que aprendi nessa sessão?"
3. Chama `memory.add()` (vai usar `@ecossistema/memory` — **DEPENDÊNCIA FUTURA** → inicialmente, stub que loga em console + TODO comment)
4. Atualiza `importance` de memórias referenciadas (incrementa `access_count`)

**Importante:** como `@ecossistema/memory` só chega no S7, faça o hook funcional com stub + comentário `// TODO(S7): trocar console.log por memory.add()`.

---

## Utilities compartilhadas (`src/utils.ts`)

```typescript
export async function createApprovalRequest(req: ApprovalRequest): Promise<string>;
export async function writeAuditLog(entry: AuditEntry): Promise<void>;
export function hashPayload(obj: any): string;
export async function checkBudget(business_id: string, estimated_cost_usd: number): Promise<boolean>;
export function isIrreversible(tool_name: string): boolean;
export function isFinancial(tool_name: string): boolean;
export function parseAmountFromInput(input: any): number | null;
```

Conectam ao Supabase via `@supabase/supabase-js` (env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

---

## Testes obrigatórios

### Por hook (`tests/art-*.test.ts`)

Cada hook precisa cobrir:
- **Happy path** — input OK → allow
- **Bloqueio esperado** — input que deve ser bloqueado → block com reason correto
- **Edge case** — input malformado, valor ausente, tool_name desconhecido
- **Idempotência do próprio hook** — chamar 2x com mesmo input não duplica audit log

### Integração (`tests/integration.test.ts`)

Simula agente rodando com todos 11 hooks ativos. Cenários:
1. Chamada OK passa por todos sem bloqueio
2. Ação crítica + valor alto = bloqueada (Art. II)
3. Tentativa de Write em `/memory/foo.md` = redirecionada (Art. XIV)
4. `rm -rf /` em Bash = bloqueado (Art. XIX)
5. Tool sem schema + schema inválido = bloqueado (Art. XVIII)

**Cobertura mínima: 85%** (rode `pnpm test -- --coverage`).

---

## Critério de sucesso

- [ ] `pnpm --filter @ecossistema/constitutional-hooks test` passa 100%
- [ ] `pnpm --filter @ecossistema/constitutional-hooks build` gera `dist/` válido
- [ ] `pnpm --filter @ecossistema/constitutional-hooks lint` zero erros
- [ ] README com exemplo de uso em agente (importar, registrar no SDK)
- [ ] Commit semântico: `feat(hooks): 11 constitutional hooks implementados`
- [ ] PR aberto com review-ready (descrição cita Artigos cobertos)

---

## Protocolo da sessão

1. `git worktree add ../eco-hooks feature/constitutional-hooks` (se ainda não existe)
2. `cd ../eco-hooks`
3. Ler leituras obrigatórias (acima)
4. Lock task: `UPDATE agent_tasks SET status='locked', assigned_to='s01' WHERE task_id='S01-hooks'`
5. `mkdir -p packages/constitutional-hooks/{src,tests}`
6. Criar `package.json` com deps: `@anthropic-ai/claude-agent-sdk`, `@supabase/supabase-js`, `ajv`, `vitest`
7. Implementar hook a hook, test a test (TDD recomendado)
8. Ao fim do dia: commit + push + PR + update task status

---

## Observações importantes

- **NÃO use regex para detectar intenção do usuário** (viola Cardinal Rule). Use apenas em validações determinísticas (tool_name, paths, Bash commands). Intent detection NUNCA.
- **NÃO criem sua própria regex de Bash blocklist diferente da do phantom** sem justificar. O phantom já pensou nos edge cases.
- **Audit log é write-only** — só insert, nunca update/delete. Trigger Postgres garante.
- **Hooks são IDEMPOTENTES** — podem ser chamados 2x com mesmo input sem efeito colateral.

---

## Handoff para próximas sessões

- **S11 (C-Suite templates)** importa `hooks.ts` exemplo
- **S13 (Clients)** importa no orchestrator
- **S16 (Piloto CFO-FIC)** usa os hooks em produção (primeiro teste real)

---

**Boa sessão. Esse pacote é a espinha dorsal constitucional da V9.**
