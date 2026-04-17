# @ecossistema/constitutional-hooks

> **Status:** V9 Fase 0 · S01 · Espinha dorsal constitucional do ecossistema
>
> 11 hooks executáveis que transformam Artigos Constitucionais verificáveis em **código que intercepta ações do agente e pode bloqueá-las**. Sem depender de prompt — compliance como infraestrutura.

## Mapa Artigo → Hook

| Artigo | Tipo | Arquivo | Função |
|---|---|---|---|
| **II** — HITL Crítico | `PreToolUse` | `art-ii-hitl.ts` | Bloqueia ações irreversíveis ou financeiras > R$ 10k, cria `approval_request` |
| **III** — Idempotência | `PreToolUse` | `art-iii-idempotency.ts` | Injeta `idempotency_key` e rejeita duplicatas em janela de 24h |
| **IV** — Rastreabilidade | `PostToolUse` | `art-iv-audit.ts` | Grava hashes SHA-256 de input/output em `audit_log` |
| **VIII** — Baixa Real | `PostToolUse` | `art-viii-baixa-real.ts` | Detecta sucesso falso (`accepted` sem receipt, mock em prod, timeout mascarado) |
| **IX** — Falha Explícita | `PostToolUse` | `art-ix-falha-explicita.ts` | Transforma HTTP 5xx / `success:false` sem throw em `ToolFailedError` |
| **XII** — Custos | `PreToolUse` | `art-xii-cost-control.ts` | Consulta budget LiteLLM e bloqueia chamada LLM acima do saldo |
| **XIV** — Dual-Write | `PreToolUse` | `art-xiv-dual-write.ts` | Bloqueia `Write`/`Edit` em `/memory/*.md`, `/secrets/`, `/tasks/`, `/sessions/` |
| **XVIII** — Data Contracts | `PreToolUse` | `art-xviii-data-contracts.ts` | Valida input contra JSON Schema registrado (ajv) |
| **XIX** — Segurança | `PreToolUse` | `art-xix-security.ts` | Blocklist regex de `Bash` (`rm -rf /`, `git push --force main`, …) |
| **XX** — Soberania Local | `PreToolUse` | `art-xx-soberania.ts` | **Hint** (não bloqueia): prefere Supabase a API externa |
| **XXII** — Aprendizado | `SessionEnd` | `art-xxii-aprendizado.ts` | Extrai `tools_used`/`files_touched`/`outcome` → chama `memory.add()` (stub até S7) |

## Uso em um agente

```ts
import {
  artIIHITL, artIIIIdempotency, artIVAudit,
  artVIIIBaixaReal, artIXFalhaExplicita,
  artXIICostControl, artXIVDualWrite,
  artXVIIIDataContracts, artXIXSecurity,
  artXXSoberania, artXXIIAprendizado,
} from "@ecossistema/constitutional-hooks";

const cfoFIC = new ManagedAgent({
  name: "cfo-fic",
  model: "claude-sonnet-4-6",
  hooks: {
    preToolUse: [
      artIIHITL,
      artIIIIdempotency,
      artXIICostControl,
      artXIVDualWrite,
      artXIXSecurity,
      artXXSoberania,
      artXVIIIDataContracts,
    ],
    postToolUse: [artIVAudit, artVIIIBaixaReal, artIXFalhaExplicita],
    sessionEnd: [artXXIIAprendizado],
  },
});
```

## Configuração

Variáveis de ambiente consumidas:

| Env | Uso | Obrigatório |
|---|---|---|
| `SUPABASE_URL` | Cliente Supabase ECOSYSTEM | Sim (prod) |
| `SUPABASE_SERVICE_ROLE_KEY` | Cliente Supabase ECOSYSTEM | Sim (prod) |
| `ECO_HITL_THRESHOLD_BRL` | Limite Art. II (default 10000) | Não |
| `LITELLM_PROXY_URL` | Endpoint do LiteLLM proxy | Sim se usar `artXIICostControl` |
| `LITELLM_MASTER_KEY` | Bearer token do LiteLLM | Não |

Em testes use `setSupabaseClient(mock)` e `setLiteLLMClient(mock)` para injetar dublês.

## Hooks configuráveis

Três factories aceitam config:

```ts
// Art. III — trocar lista de tools idempotentes
const myIIIHook = createArtIIIHook({
  idempotentTools: new Set(["minha_tool_idempotente"]),
  windowHours: 48,
});

// Art. XII — ajustar margem e prefixo
const myXII = createArtXIIHook({ safetyMargin: 1.5, llmPrefix: "ia_" });

// Art. XVIII — registrar schemas (recomendado)
const myXVIII = createArtXVIIIHook({
  registry: {
    getSchema: (name) => schemasByName[name] ?? null,
    getVersion: (name) => versionsByName[name] ?? null,
  },
  requireSchema: true, // falha-closed: tool sem schema → bloqueia
});

// Art. XXII — plugar @ecossistema/memory quando S7 entregar
const myXXII = createArtXXIIHook({ memoryAdd: memory.add });
```

## Tabelas Supabase consumidas

- `approval_requests` — Art. II cria entrada `status=pending`
- `audit_log` — Art. IV/VIII/IX gravam (append-only)
- `idempotency_cache` — Art. III grava/consulta
- `ecosystem_memory` | `ecosystem_credentials` | `agent_tasks` | `ecosystem_sessions` — Art. XIV redireciona writes (redirecionamento só aponta a tabela alvo; escrita é feita pelo agente chamador)

> As migrations são criadas por **S04 — migrations** e aplicadas ao Supabase ECOSYSTEM (`gqckbunsfjgerbuiyzvn`).

## Regras de ouro

1. **Hooks são idempotentes** — seguro chamar 2x com mesmo input.
2. **Audit log é write-only** — só `INSERT`, nunca `UPDATE`/`DELETE` (trigger Postgres garante).
3. **Regex só para validação determinística** (tool_name, paths, bash commands). NUNCA para detectar intenção.
4. **Art. XII é fail-closed** — falha ao consultar budget bloqueia a ação (custo > inconveniência).
5. **Art. IV é fail-soft** — falha de audit não bloqueia o agente (D-Governanca monitora console.error).

## Scripts

```bash
pnpm --filter @ecossistema/constitutional-hooks test           # rodar testes
pnpm --filter @ecossistema/constitutional-hooks test:coverage  # com coverage
pnpm --filter @ecossistema/constitutional-hooks build          # gerar dist/
pnpm --filter @ecossistema/constitutional-hooks lint           # type-check
```

## Referências

- `docs/masterplans/MASTERPLAN-V9.md` — Parte V §§ 11-13 (tabela canônica e exemplo Art. II)
- `docs/sessions/fase0/S01-hooks.md` — spec detalhada desta sessão
- `CLAUDE.md` (raiz) — decisões canônicas D1-D6

## Handoff

- **S04 (migrations)** criará as tabelas `approval_requests`, `audit_log`, `idempotency_cache`
- **S07 (memory)** entregará `@ecossistema/memory` → trocar stub no Art. XXII
- **S11 (C-Suite templates)** importa estes hooks
- **S13 (Clients)** importa no orchestrator
- **S16 (Piloto CFO-FIC)** usa em produção — primeiro teste real
