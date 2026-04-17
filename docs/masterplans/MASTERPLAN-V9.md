# MASTERPLAN ECOSSISTEMA — V9
## Evidence-Based Edition · Herança V8.2 + Stack Validada

**Versão:** 9.0
**Data:** 2026-04-16
**Autor:** Marcelo Silva (CEO) · Claudinho (VP Executivo)
**Natureza:** Documento canônico. Evolução direta da V8.2. Base para toda execução.

---

## Preâmbulo

A V9 é **filha legítima da V8.2**. Não é reboot. Não é revolução. É o próximo capítulo coerente, escrito com base em evidência: 99 repositórios clonados e analisados com código-fonte real, ~400KB de pesquisa curada, 1.249 repos catalogados via API GitHub.

**O que a V9 faz:**
1. **Preserva** tudo que é canônico do V8.2 (22 Artigos, 13 Meta-Padrões, 29 Super-Crates, 17 Ondas, 7 Camadas, Dual-Write, ECOSYSTEM compartilhado + DBs per-projeto, Fase B, 5 Negócios)
2. **Evolui** a organização de agentes (C-Suite por negócio + 6 Diretores de Área no ecossistema)
3. **Reorganiza** as 29 Super-Crates por tecnologia real (Edge Function / Railway / LLM / RLS / Dados)
4. **Concretiza** os 22 Artigos como hooks executáveis no Claude Agent SDK
5. **Adiciona** 10 padrões arquiteturais validados em código de produção
6. **Consolida** a stack técnica com ferramentas verificadas

**O que a V9 descarta:**
- Apenas narrativas ficcionais dos V6-V8 que **não têm código** (6 Meta-Padrões V7 do tipo "Nexus/Mesh/Autonomous Orchestration" que agrupavam tools independentes sem integração real). Os repos individuais continuam úteis; descartamos só a ficção de que formavam sistemas integrados.

---

## Parte I — Herança Canônica do V8.2

### § 1. 22 Artigos Constitucionais (MANTIDOS + hooks)

Todos os 22 Artigos permanecem como princípios canônicos. A novidade: **cada Artigo verificável ganha implementação em hook executável** (detalhado na Parte V). Os subjetivos (ex: Art. I) continuam como diretrizes no prompt assembler.

| # | Artigo | Natureza V9 |
|---|---|---|
| I | Primazia do Propósito | Diretriz de prompt (subjetivo) |
| II | Human-in-the-loop Crítico | **Hook PreToolUse** |
| III | Idempotência Universal | **Hook PreToolUse** |
| IV | Rastreabilidade Total | **Hook PostToolUse** |
| V | Memória Persistente | Infra (Supabase + Mem0) |
| VI | Autonomia Gradual | Diretriz + Permission modes |
| VII | Hierarquia Respeitada | Diretriz + RACI Registry |
| VIII | Confirmação por Baixa Real | **Hook PostToolUse** |
| IX | Falha Explícita | **Hook PostToolUse** |
| X | Princípio da Menor Surpresa | Diretriz (design APIs simples) |
| XI | Reversibilidade | Infra (Rollback Engine) |
| XII | Custos sob Controle | **Hook PreToolUse + LiteLLM budgets** |
| XIII | Skill-First | Diretriz + Skill Registry |
| XIV | Dual-Write Supabase-first | **Hook PreToolUse** |
| XV | Multi-Tenant Data Isolation | **Postgres RLS** |
| XVI | Observabilidade por Default | Infra (Langfuse) |
| XVII | Testes antes do Deploy | CI/CD gates |
| XVIII | Data Contracts versionados | **Hook PreToolUse + Schema Registry** |
| XIX | Segurança em Camadas | **Hook PreToolUse** |
| XX | Soberania Local supera Dependência | **Hook PreToolUse** |
| XXI | Escolha de Modelo é Estratégia | LiteLLM router + model selection |
| XXII | Aprendizado é Infraestrutura | **Hook SessionEnd + reflection subprocess** |

### § 2. 13 Meta-Padrões (TODOS MANTIDOS)

Nenhum descarte. Todos são padrões arquiteturais clássicos, implementáveis:

| MP | Nome | Implementação V9 |
|---|---|---|
| MP-01 | Orquestrador Central + Especialistas | Claudinho + C-Suite per negócio |
| MP-02 | Memória em Camadas | 3-tier pgvector (episodic/semantic/procedural) |
| MP-03 | Skill Registry First | packages/skills-registry |
| MP-04 | Dual-Write | Supabase primário + arquivos secundários |
| MP-05 | Human-in-the-loop por Classe de Risco | Hook + `status_idled` webhook (Cookbook pattern) |
| MP-06 | Idempotência por Chave Natural | Hook + table locks |
| MP-07 | Multi-Provider Resilience | LiteLLM router + fallbacks |
| MP-08 | Audit Log Imutável | Append-only table + trigger |
| MP-09 | Retry com Backoff Exponencial | Wrapper Edge Function |
| MP-10 | Validação em Camadas | JSON Schema + RLS + hook |
| MP-11 | Rollback Declarativo | Compensation actions + git revert |
| MP-12 | Custo Observável | LiteLLM + Langfuse + pg_cron |
| MP-13 | Contratos de Dados Versionados | Schema Registry |

### § 3. 29 Super-Crates (MANTIDAS + reclassificadas)

As 29 SCs continuam como capacidades do ecossistema. A reorganização por tecnologia está na Parte IV.

### § 4. 17 Ondas (MANTIDAS + priorizadas)

Sequência preservada. Onda 0 continua pré-infraestrutura (SC-29 Credential Vault primeiro).

### § 5. 7 Camadas L1-L7 (MANTIDAS como mapa conceitual)

Permanecem no modelo mental. A V9 adiciona **4 camadas técnicas de execução** (Parte III) sem invalidar as 7 conceituais.

### § 6. Decisões D1-D6 do V4 (TODAS MANTIDAS)

- **D1** — Managed Agents + Railway híbrido
- **D2** — ECOSYSTEM compartilhado + DBs per-projeto
- **D3** — Jarvis em 4 estágios
- **D4** — pg_cron + Trigger.dev para scheduled tasks
- **D5** — Monorepo pnpm workspaces
- **D6** — Piloto ERP-Educacional

### § 7. Fase B (MANTIDA como canônica)

Supabase é fonte primária de verdade. Auto-embedding via pg_net + Edge Function (produção desde s093). `ecosystem_memory` com BGE embeddings. Não reverter.

### § 8. 5 Negócios (MANTIDOS)

FIC · Klésis · Intentus · Splendori · Nexvy.

---

## Parte II — Descartes (apenas ficção, repos continuam úteis)

### § 9. O que foi descartado e por quê

Análise com agente de pesquisa que leu código-fonte dos 8 repos Kahler + dependências. Veredicto: a **narrativa de integração não existe**. Cada tool é independente. Os repos individuais **continuam úteis como referência** — só descartamos a ficção de que formavam um sistema integrado.

| Descartado | Razão |
|---|---|
| "MP-01 Token Efficiency Nexus" (como narrativa V7) | CARL + BASE + ccusage são 3 tools de 2 autores diferentes sem integração |
| "MP-02 Semantic Graph Mesh" | GraphRAG-SDK é FalkorDB, zero relação com LightRAG/bloop/OpenSpace |
| "MP-03 Autonomous Agent Orchestration" (Kahler) | PAUL **explicitamente rejeita** autonomia — "~70% quality" no README |
| "MP-05 Multi-Modal Retrieval" (Kahler) | GraphRAG-SDK só processa texto |
| Alegação de "mesh/nexus/integração" entre Kahler repos | Cada um é independente; só compartilham convenção de markdown |

**Importante:** os 13 Meta-Padrões arquiteturais do V8.2 **permanecem intactos**. O que descartamos é apenas a camada narrativa posterior (V7) que cooptava tools de terceiros em "super-padrões" ficcionais.

---

## Parte III — Reorganização Técnica: 4 Camadas de Execução

As 7 Camadas conceituais do V8.2 ficam como mapa mental. A V9 adiciona 4 camadas **operacionais** para execução:

```
┌───────────────────────────────────────────────────────────────┐
│  L1 — AGENTES (Anthropic Managed Agents)                      │
│      Claudinho + C-Suite per negócio + 6 Diretores de Área    │
│      Raciocínio em linguagem natural, decisões complexas      │
└───────────────────────────────────────────────────────────────┘
                              │
┌───────────────────────────────────────────────────────────────┐
│  L2 — SERVIÇOS (Railway)                                      │
│      LiteLLM gateway · Langfuse · RAG-engine · Orchestrator   │
│      FastAPI · Workers BullMQ · Memory consolidator           │
│      Long-running, stateful, queue-backed                     │
└───────────────────────────────────────────────────────────────┘
                              │
┌───────────────────────────────────────────────────────────────┐
│  L3 — EDGE FUNCTIONS (Supabase)                               │
│      SC-29 Credential Gateway · Webhooks · PII Mask · Audit   │
│      Lógica determinística, <1s, auto-scale                   │
└───────────────────────────────────────────────────────────────┘
                              │
┌───────────────────────────────────────────────────────────────┐
│  L4 — DADOS (Postgres + pgvector + ClickHouse)                │
│      ECOSYSTEM compartilhado · DBs per-projeto · RLS          │
│      Triggers · Views materializadas · pg_cron                │
└───────────────────────────────────────────────────────────────┘
```

**Regra operacional:** toda nova capacidade do ecossistema pergunta primeiro "em qual L?":
- Precisa raciocinar em linguagem natural? → L1
- Precisa de long-running, queue, WebSocket? → L2
- É lógica determinística <1s? → L3
- É modelagem de dados, agregação, acesso? → L4

---

## Parte IV — Reclassificação das 29 Super-Crates

Análise SC-a-SC contra critérios: determinismo, estado longo, raciocínio natural.

| SC | Nome | Camada V9 | Tech real |
|---|---|---|---|
| SC-01 | Agent Foundation | **L1** | Managed Agents |
| SC-02 | Orquestrator Core | **L1** | Claudinho (Opus 4.6) |
| SC-03 | Dual-Write Pipeline | **L3** | Edge Function |
| SC-04 | Skill Registry | **L3 + L4** | EF CRUD + Supabase table |
| SC-05 | Skill Router | **L1** | Haiku (barato, matching semântico) |
| SC-06 | Memory Consolidator v1 | **L2** | Railway worker |
| SC-07 | Human Approval Queue | **L3** | EF + webhook (cookbook `status_idled`) |
| SC-08 | Cost Observer | **L3 + L4** | EF + pg_cron + Langfuse |
| SC-09 | Multi-Tenant Isolation | **L4** | Postgres RLS (não precisa EF!) |
| SC-10 | Webhook Hardening | **L3** | Edge Function (HMAC + rate limit) |
| SC-11 | Audit Log Foundation | **L4** | Append-only table + trigger |
| SC-12 | Memory Consolidator v2 | **L2 + L1** | Railway worker + LLM summarization |
| SC-13 | Agent Sandbox | **L2** | E2B ou container Docker |
| SC-14 | Agent Runner (SDK) | **L1** | Claude Agent SDK (Python) |
| SC-15 | Schema Contract Registry | **L3** | Edge Function validation |
| SC-16 | Retry + Backoff Engine | **L3** | EF wrapper |
| SC-17 | Multi-Provider LLM Gateway | **L2** | LiteLLM no Railway |
| SC-18 | Observability Stack | **L2** | Langfuse no Railway |
| SC-19 | PII Mask Pipeline | **L3** | Edge Function (regex + denylist) |
| SC-20 | Rate Limiter | **L3** | EF + Redis token bucket |
| SC-21 | Rollback Engine | **L3** | Edge Function |
| SC-22 | Minors Data Fortress | **L4 + L1** | RLS + hooks no SDK (Klésis) |
| SC-23 | Agent Performance Monitor | **L4** | pg_cron + views + Langfuse |
| SC-24 | RACI Registry | **L3 + L4** | EF + Supabase |
| SC-25 | Cross-Business Router | **L1** | Sonnet (decide qual negócio atende) |
| SC-26 | Agent Learning Loop | **L2 + L1** | Railway worker + LLM (reflection) |
| SC-27 | Incident Commander | **L1** | Sonnet (diagnóstico) |
| SC-28 | Regulatory Deadline Watcher | **L3 + L4** | EF + pg_cron (MEC/SEFAZ) |
| SC-29 | Credential Vault | **L3** | Edge Function (reformulada) |

### § 10. Distribuição

| Camada | # SCs | % |
|---|---|---|
| L1 Agentes (LLM) | 6 | 21% |
| L2 Serviços Railway | 7 | 24% |
| L3 Edge Functions | 13 | 45% |
| L4 Dados nativos | 3 | 10% |

**Insight crítico:** **~55% das SCs não precisam de LLM nem de Railway**. São lógica determinística ou modelagem de dados. Reduz drasticamente custo e complexidade operacional comparado ao V8.2 onde tudo parecia precisar de "agente".

---

## Parte V — 22 Artigos Constitucionais como Hooks Executáveis

No V8.2, os Artigos eram **texto em markdown**. O agente *deveria* segui-los — mas nada forçava.

Na V9, os Artigos verificáveis viram **código que intercepta ações do agente e pode bloquear**. Implementação via `PreToolUse` / `PostToolUse` / `SessionEnd` hooks do Claude Agent SDK.

### § 11. Tabela canônica Artigo → Hook

| Artigo | Tipo de hook | Ação do hook |
|---|---|---|
| **II — HITL Crítico** | `PreToolUse` | Bloqueia ações com impacto financeiro > R$ 10k OU irreversíveis sem aprovação. Usa `session.status_idled` (cookbook pattern) |
| **III — Idempotência** | `PreToolUse` | Injeta `idempotency_key` automático, rejeita duplicatas em janela de 24h |
| **IV — Rastreabilidade** | `PostToolUse` | Grava em `audit_log` (append-only): tool_name, input_hash, output_hash, timestamp, agent_id, business_id |
| **VIII — Baixa Real** | `PostToolUse` | Valida que tool retornou sucesso real (não "202 accepted" vazio) |
| **IX — Falha Explícita** | `PostToolUse` | Transforma exceções silenciosas em erros visíveis; força `raise` |
| **XII — Custos** | `PreToolUse` | Checa budget via LiteLLM antes de chamada cara; bloqueia se excedido |
| **XIV — Dual-Write** | `PreToolUse` | Intercepta Write/Edit em `*.md` para secrets/memory/tasks; redireciona para Supabase |
| **XIX — Segurança** | `PreToolUse` | Regex blocklist em Bash: `rm -rf /`, `dd of=/dev/`, `git push --force`, `kill -9 1`, etc |
| **XX — Soberania Local** | `PreToolUse` | Prioriza Supabase local antes de API externa quando possível |
| **XVIII — Data Contracts** | `PreToolUse` | Valida payload contra JSON Schema antes de tool call |
| **XXII — Aprendizado** | `SessionEnd` | Extrai padrões, lições, files_touched, outcomes; injeta em Mem0 |

### § 12. Exemplo concreto (Art. II — HITL Crítico)

```python
# packages/hooks/art-ii-hitl.ts
import { PreToolUseHook } from '@anthropic-ai/claude-agent-sdk';

const ACOES_CRITICAS_FINANCEIRAS = [
    'emitir_boleto_massa',
    'rotacionar_credencial_prod',
    'assinar_contrato',
    'pix_transferencia',
    'deletar_dados_aluno',
    'atualizar_status_matricula_massa',
];

const LIMITE_FINANCEIRO_BRL = 10_000;

export const artIIHITL: PreToolUseHook = async (ctx) => {
    const { tool_name, tool_input, agent_id, business_id } = ctx;

    if (!ACOES_CRITICAS_FINANCEIRAS.includes(tool_name)) {
        return { decision: "allow" };
    }

    const valor = Number(tool_input?.valor ?? 0);

    // Irreversíveis sempre pedem aprovação
    const IRREVERSIVEIS = ['deletar_dados_aluno', 'assinar_contrato'];
    if (IRREVERSIVEIS.includes(tool_name)) {
        await createApprovalRequest(ctx);
        return {
            decision: "block",
            reason: "Art. II: Ação irreversível. Aprovação humana requisitada via status_idled."
        };
    }

    // Acima do limite também
    if (valor > LIMITE_FINANCEIRO_BRL) {
        await createApprovalRequest(ctx);
        return {
            decision: "block",
            reason: `Art. II: Valor R$${valor} > limite R$${LIMITE_FINANCEIRO_BRL}. Aprovação humana.`
        };
    }

    return { decision: "allow" };
};
```

O hook é **testável, auditável, reversível**. Mudar o limite não exige retreinar/reescrever prompt. Ficar atrás de um teste unitário garante comportamento.

### § 13. Pacote canônico: `@ecossistema/constitutional-hooks`

Todos os hooks vivem em um pacote monorepo. Cada agente (Claudinho, C-Suite, Diretores) importa os hooks apropriados ao registrar no SDK. Pacote é auditado, testado, versionado.

```typescript
// apps/fic/agents/cfo.ts
import {
    artIIHITL, artIIIIdempotency, artIVAudit,
    artVIIIBaixaReal, artXIICostControl, artXIVDualWrite,
    artXIXSecurity, artXXSoberania, artXVIIIDataContracts,
    artXXIIAprendizado,
} from '@ecossistema/constitutional-hooks';

const cfoFIC = new ManagedAgent({
    name: 'cfo-fic',
    model: 'claude-sonnet-4-6',
    hooks: {
        preToolUse: [artIIHITL, artIIIIdempotency, artXIICostControl, artXIVDualWrite, artXIXSecurity, artXXSoberania, artXVIIIDataContracts],
        postToolUse: [artIVAudit, artVIIIBaixaReal, artIXFalhaExplicita],
        sessionEnd: [artXXIIAprendizado],
    },
});
```

**Resultado:** compliance constitucional **no código**, não só no prompt. Violações impossíveis, não improváveis.

---

## Parte VI — Organização de Agentes

### § 14. Estrutura em 3 camadas de governança

```
┌──────────────────────────────────────────────────────────────────┐
│  ECOSSISTEMA (meta-layer)                                        │
│  Claudinho (VP Executivo, Opus 4.6) ← interface Jarvis Marcelo   │
│                                                                  │
│  6 Diretores de Área (supervisão cross-business, Sonnet 4.6):    │
│    • D-Estrategia    : alinhamento ao propósito BAM              │
│    • D-Sinergia      : oportunidades cross-business              │
│    • D-Infra         : saúde Managed Agents + Railway + DBs      │
│    • D-Memoria       : qualidade da memória, drift, decay        │
│    • D-Governanca    : compliance 22 artigos + LGPD + audit      │
│    • D-Relacionamento: experiência Marcelo (Jarvis 4 estágios)   │
└──────────────────────────────────────────────────────────────────┘
                                  │
                                  │ audita · coordena · sintetiza
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│  NEGÓCIOS (5 business units) — cada um com C-Suite próprio       │
│                                                                  │
│  FIC (5-7) · Klésis (5-6) · Intentus (8) · Splendori (7) · Nexvy (6-7) │
│  Total: ~30-35 agentes C-Suite distribuídos                      │
└──────────────────────────────────────────────────────────────────┘
                                  │
                                  │ executa
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│  OPERACIONAL — skills, tools, EFs, workers, RLS                  │
└──────────────────────────────────────────────────────────────────┘
```

### § 15. Matriz C-Suite por negócio

| Diretor | FIC | Klésis | Intentus | Splendori | Nexvy |
|---|---|---|---|---|---|
| **CEO-IA** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **CFO-IA** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **CAO-IA** (Acadêmico) | ✅ | ✅ | — | — | — |
| **CMO-IA** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **CSO-IA** (Sales) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **CLO-IA** (Legal) | 🟡 opc | 🟡 opc | ✅ | ✅ | 🟡 opc |
| **COO-IA** (Operations) | 🟡 opc | — | ✅ | ✅ | — |
| **CTO-IA** (Tech) | — | — | ✅ | — | ✅ |
| **CPO-IA** (Product) | — | — | ✅ | — | ✅ |
| **CHRO-IA** (futuro) | 🟡 fut | 🟡 fut | — | — | — |

**Totais por negócio:** FIC 5-7 · Klésis 5-6 · Intentus 8 · Splendori 7 · Nexvy 6-7.

**Racional das ausências:**
- **CAO apenas em FIC/Klésis** — é função educacional
- **CTO/CPO apenas em Intentus/Nexvy** — são produtos SaaS que produzem tecnologia
- **CLO opcional em FIC/Klésis** — contratos padronizados; obrigatório em Intentus/Splendori (contratos complexos)
- **CHRO futuro** — só quando grupo crescer para justificar

### § 16. C-Suite como template reutilizável

```
packages/c-suite-templates/
├── CEO-IA/
│   ├── base-prompt.md
│   ├── variants/
│   │   ├── educacao.md         # FIC, Klésis
│   │   ├── imobiliario.md      # Intentus, Splendori
│   │   └── saas.md             # Nexvy
│   ├── skills.yaml
│   ├── hooks.ts                # hooks constitucionais aplicáveis
│   └── tests/
├── CFO-IA/
├── CAO-IA/
├── CMO-IA/
├── CSO-IA/
├── CLO-IA/
├── COO-IA/
├── CTO-IA/
├── CPO-IA/
└── CHRO-IA/
```

Cada negócio instancia:

```yaml
# apps/fic/agents/cfo.yaml
extends: "@ecossistema/c-suite-templates/CFO-IA/variants/educacao"
business_name: "FIC"
business_id: "fic"
supabase_project: "ifdnjieklngcfodmtied"
custom_context: |
  Instituição de ensino superior, 44 anos em Cassilândia-MS.
  Mensalidades via Banco Inter. Inadimplência histórica ~8%.
  KPIs: taxa inadimplência, NPS financeiro, % bolsas/gratuidades.
model: "claude-sonnet-4-6"
hooks_extra: []
```

**Economia:** ao melhorar o template CFO-IA, **todos os 5 CFOs herdam**. Cada negócio mantém apenas ~50 linhas de contexto específico.

### § 17. Os 6 Diretores de Área — responsabilidades detalhadas

#### D-Estrategia
- **Missão:** avaliar se decisões do ecossistema estão alinhadas ao tripé BAM (viabilidade financeira + impacto social + coerência com propósito)
- **Inputs:** ações estratégicas dos CEO-IAs de cada negócio, KPIs cross-business
- **Outputs:** veto (com justificativa) ou endosso; relatório semanal de alinhamento ao propósito
- **Tech:** Sonnet 4.6, AEGIS 7-layer epistemic framework, hooks Art. I aplicados

#### D-Sinergia
- **Missão:** identificar e ativar oportunidades cross-business (ex: Intentus vende SaaS para FIC; Splendori capta leads do Intentus)
- **Inputs:** operações de todos os negócios via Memória compartilhada
- **Outputs:** propostas de sinergia com estimativa de valor; handoffs entre negócios
- **Tech:** Sonnet 4.6, Cross-Business Router (SC-25), Mem0 cross-business namespace

#### D-Infra
- **Missão:** saúde técnica de Managed Agents, Railway, Supabase, LiteLLM, FastMCP servers
- **Inputs:** métricas de latência, erro, custo, uptime de cada camada
- **Outputs:** alertas, upgrade/downgrade recommendations, incident response coordination
- **Tech:** Sonnet 4.6 + Incident Commander (SC-27), Langfuse + pg_cron views

#### D-Memoria
- **Missão:** qualidade da memória do ecossistema (episodic/semantic/procedural) — detectar drift, decay, inconsistências, contradições
- **Inputs:** `ecosystem_memory`, estatísticas de recall, access_count, outcome
- **Outputs:** consolidação, reranking, sinalização de drift crítico
- **Tech:** Sonnet 4.6 + Memory Consolidator v2 (SC-12) + BASE PSMM patterns

#### D-Governanca
- **Missão:** compliance com 22 Artigos Constitucionais, LGPD, audit log, rotação de credenciais
- **Inputs:** audit_log, violações de hooks, credential_access_log
- **Outputs:** relatório diário de compliance, pausar agentes em violação crítica, disparar auditorias
- **Tech:** Sonnet 4.6 + AEGIS traceability + hooks monitoring

#### D-Relacionamento
- **Missão:** qualidade da experiência do Marcelo com Jarvis (Stages 1→4)
- **Inputs:** interações via CLI/WhatsApp/voz, feedback explícito, padrões de uso
- **Outputs:** ajustes de persona, sugestões de upgrade de estágio, personalização
- **Tech:** Sonnet 4.6 + Phantom 9-layer assembler (persona/user-profile) + Mem0 pessoal

### § 18. Como Marcelo NÃO audita 1 a 1

Cada Diretor de Área tem:
1. **Dashboard próprio** (Langfuse + Supabase views) com saúde cross-business na sua dimensão
2. **Hooks que disparam ações automáticas** quando detectam problema em algum C-Suite de negócio
3. **Briefing diário para Marcelo via Jarvis** (resumo executivo)

**Exemplo:** D-Governanca audita CFO-FIC automaticamente.

```typescript
// Railway worker diário
async function auditDailyDiretorGovernanca() {
    for (const business of BUSINESSES) {
        for (const agent of business.cSuite) {
            // 1. Todas ações das últimas 24h
            const actions = await queryManagedAgentSessions({ agent_id: agent.id, since: "24h" });

            // 2. Violações constitucionais (hooks que bloquearam)
            const violations = await queryAuditLog({ agent_id: agent.id, decision: "block", since: "24h" });

            // 3. Anomalias (KPIs fora do esperado)
            const anomalies = detectAnomalies(actions, business.expectedKPIs);

            // 4. Consolidar
            if (violations.length > 0 || anomalies.length > 0) {
                await dispatchAlert({
                    severity: computeSeverity(violations, anomalies),
                    business: business.name,
                    agent: agent.name,
                    details: { violations, anomalies },
                });
            }
        }
    }

    // 5. Briefing consolidado pro Marcelo (1 mensagem, não 30)
    const briefing = synthesizeEcosystemHealth();
    await sendToJarvis({ channel: "morning_brief", content: briefing });
}
```

**Resultado:** Marcelo recebe **um único briefing executivo pela manhã**. Só é acionado individualmente em exceções (severidade alta). Pode perguntar cross-business a qualquer momento (*"Claudinho, como está a saúde financeira do grupo?"*) — Claudinho consulta D-Estrategia que consolida CFOs de todos os negócios.

---

## Parte VII — SC-29 Credential Vault Reformulado

### § 19. Conceito preservado, implementação corrigida

O conceito original do SC-29 (dupla verificação + proxy seguro + audit log) **está correto e permanece**. A mudança é apenas **a forma de implementação**: Edge Function determinística, não agente LLM.

**Por quê não agente LLM:**
- Verificação de credencial é determinística (ACL, não raciocínio)
- LLM custa ~500ms + tokens por chamada
- LLM pode alucinar e liberar credencial por razão errada
- Hardcoded rules em Edge Function são auditáveis via código aberto

### § 20. Arquitetura V9 — Credential Gateway

```
┌───────────────────────────────────────────────────────────────┐
│  SC-29 Credential Gateway (Edge Function, Supabase)           │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────┐                 │
│  │  Agente (FIC/CFO, Intentus/COO, etc)     │                 │
│  │  precisa chamar API externa (Inter, BRy) │                 │
│  └─────────────┬────────────────────────────┘                 │
│                │                                              │
│                ▼                                              │
│  ┌──────────────────────────────────────────┐                 │
│  │  Edge Function /credential-gateway       │                 │
│  │                                          │                 │
│  │  1. Autentica requisitante (JWT/scope)   │                 │
│  │  2. Verifica ACL:                        │                 │
│  │     pode esse agente pedir essa key?     │                 │
│  │  3. Rate limit por agente                │                 │
│  │  4. Recupera secret do Supabase Vault    │                 │
│  │  5. Registra em credential_access_log    │                 │
│  │  6. MODO DE OPERAÇÃO:                    │                 │
│  │     A) Retorna secret (dev/staging)      │                 │
│  │     B) Proxy: agente pede "chame X",     │                 │
│  │        EF faz a chamada, retorna só      │                 │
│  │        resultado. Agente NUNCA vê key.   │                 │
│  └─────────────┬────────────────────────────┘                 │
│                │                                              │
│                ▼                                              │
│  ┌──────────────────────────────────────────┐                 │
│  │  Supabase Vault (encrypted at rest)      │                 │
│  │  ecosystem_credentials (registry)        │                 │
│  │  credential_access_log (append-only)     │                 │
│  └──────────────────────────────────────────┘                 │
└───────────────────────────────────────────────────────────────┘
```

### § 21. Modos de operação

| Modo | Comportamento | Uso |
|---|---|---|
| **A — Entrega direta** | EF retorna secret ao agente | Dev/staging, agentes super-confiáveis |
| **B — Proxy de chamada** 🏆 | Agente pede "chame API X com credencial Y" — EF faz a chamada, retorna só resultado | **Produção (default)** |

**Modo B é a concretização da proposta original de Marcelo:** *"proteger o secret de quem requisita, fornecendo direto à fonte confiável"*. Agente nunca vê a key em trânsito. Nem em logs. Nem em memória.

### § 22. Schema Supabase

```sql
-- Registry: metadata sem valores
create table ecosystem_credentials (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    project     text not null,         -- 'ecosystem' | 'fic' | 'klesis' | 'intentus' | 'splendori' | 'nexvy'
    environment text not null default 'prod',
    provider    text not null,         -- 'inter' | 'bry' | 'anthropic' | 'openrouter' | 'gemini' | 'stripe'
    description text,
    vault_key   text not null,         -- referência ao Supabase Vault (valor real lá)
    acl         jsonb not null,        -- quais agentes podem acessar (ex: ['cfo-fic', 'cfo-klesis'])
    rate_limit  jsonb,                 -- tokens/min por agente
    expires_at  timestamptz,
    is_active   boolean default true,
    created_at  timestamptz default now(),
    updated_at  timestamptz default now(),
    unique(name, project, environment)
);

-- Audit log imutável (MP-08 + Art. IV)
create table credential_access_log (
    id              bigserial primary key,
    credential_name text not null,
    project         text not null,
    accessor        text not null,      -- agent_id
    action          text not null,      -- 'read' | 'proxy' | 'rotate' | 'revoke' | 'denied'
    success         boolean not null,
    reason          text,
    metadata        jsonb,
    accessed_at     timestamptz default now()
);

-- RLS: apenas service_role
alter table ecosystem_credentials enable row level security;
alter table credential_access_log enable row level security;

-- Trigger append-only (MP-08)
create or replace function prevent_credential_log_mutation()
returns trigger as $$ begin
    raise exception 'credential_access_log is append-only (MP-08)';
end; $$ language plpgsql;

create trigger credential_log_no_update before update on credential_access_log
    for each row execute function prevent_credential_log_mutation();
create trigger credential_log_no_delete before delete on credential_access_log
    for each row execute function prevent_credential_log_mutation();
```

### § 23. Regras de ouro (mantidas do V8.2)

1. **Nenhum valor de credencial aparece em logs, `.md`, código-fonte ou memory**
2. **Todo acesso gera entrada em `credential_access_log`** (Art. IV + MP-08)
3. **Rotação de credencial de produção exige aprovação CEO** (Art. II via `status_idled` webhook)
4. **Credenciais por projeto/negócio** — FIC não acessa credenciais da Intentus (ACL)
5. **Edge Function é self-sufficient** — usa `SUPABASE_SERVICE_ROLE_KEY` (injetado pelo Supabase) para bootstrap

---

## Parte VIII — Os 10 Padrões Roubados (espinha dorsal arquitetural V9)

Cada padrão abaixo é **validado em código** de um ou mais repos analisados. Adotados como canônicos na V9.

### § 24. Padrão 1 — Phantom 9-Layer Prompt Assembler

**Origem:** `phantom/src/agent/prompt-assembler.ts`

**O que é:** cada agente tem seu system prompt construído em 9 camadas ordenadas:

1. **Identidade** — quem é (ex: "Você é o CFO-IA da FIC")
2. **Environment** — onde roda, quais tools disponíveis, URLs públicas
3. **Security** — o que nunca deve fazer
4. **Role template** — YAML-defined specialization (ex: `variants/educacao.md`)
5. **Onboarding** — first-run only (primeiro contato com Marcelo)
6. **Evolved config** — constitution + persona + user-profile + domain-knowledge + strategies (arquivos MD versionados)
7. **Memory instructions** — como usar memory (sem injetar conteúdo = evita feedback loop)
8. **Instructions** — como trabalha
9. **Memory context** — recall dinâmico por query (de Mem0 + pgvector)

**Aplicação V9:** cada C-Suite e Diretor de Área usa este assembler. `packages/prompt-assembler` exporta função `assemble(agentConfig, queryContext)`.

### § 25. Padrão 2 — Cardinal Rule

**Origem:** `phantom/CLAUDE.md`

**A regra:** *"TypeScript/Python é encanamento. O Agente SDK é o cérebro."*

**O que proíbe:**
- `detectXxx()`, `parseIntentXxx()`, `classifyFrameworkXxx()` — heurísticas em código
- Regex para interpretar intenção do usuário
- Switch/case para decisões que dependem de contexto

**O que permite:**
- Código para orquestração (rotas, HTTP, SQLite, filas)
- Código para deterministic gates (hooks constitucionais)
- HEURISTIC FALLBACK explícito quando LLM está indisponível (flag `-fallback`)

**Aplicação V9:** vira **primeira linha** do `CLAUDE.md` raiz do monorepo. Lint rule bloqueia funções com nomes `detectXxx|parseIntentXxx|classifyXxx` fora de `/fallback/`.

### § 26. Padrão 3 — AES-256-GCM Vault + Magic Link

**Origem:** `phantom/src/secrets/crypto.ts`

**Fluxo:**
1. Agente precisa de credencial nova de um usuário/sistema externo
2. Ferramenta `phantom_collect_secrets` gera **URL com magic link**
3. Usuário abre URL, preenche formulário, secret é **cifrado no browser** (AES-256-GCM, 12-byte IV, 16-byte auth tag) antes de enviar
4. Servidor armazena cifrado no Supabase
5. Agente recupera via SC-29 Credential Gateway (Modo B — proxy)

**Regra ouro:** **credenciais NUNCA fluem via chat** (Slack, WhatsApp, voz, Jarvis CLI).

**Aplicação V9:** componente `packages/magic-link-vault` + Edge Function `/collect-secret` + Next.js page `/vault/collect/[token]`.

### § 27. Padrão 4 — Mem0 v3 ADD-Only + Filters Estritos

**Origem:** `mem0/mem0/memory/main.py`

**Algoritmo v3 (abril 2026):**
- **Single-pass extraction, ADD-only** — uma chamada LLM, nunca UPDATE/DELETE
- Memórias acumulam; contradições viram versioning (não overwrite)
- Agent-generated facts são first-class (mesma peso que user-stated)
- Entity linking: entidades extraídas, embedded, linkadas para retrieval boosting
- Multi-signal retrieval: semantic + BM25 + entity, fundidos por reciprocal rank

**Filters estritos:** `user_id`, `agent_id`, `run_id` são **obrigatórios** via `filters={}`. `_reject_top_level_entity_params()` lança `ValueError` se passados como kwargs. Arquiteturalmente forbidden "esquecer" o `user_id` e vazar cross-tenant.

**Aplicação V9:** memory layer principal. `packages/memory` wrapa mem0 + adiciona hooks constitucionais:

```typescript
await memory.add(messages, {
    filters: {
        user_id: "marcelo",
        agent_id: "cfo-fic",
        run_id: session.id,
    },
    metadata: { business: "fic" },
});
```

### § 28. Padrão 5 — Prompt Versioning + status_idled Webhook

**Origem:** `claude-cookbooks/managed_agents/CMA_prompt_versioning_and_rollback.ipynb` + `CMA_gate_human_in_the_loop.ipynb`

**Prompt versioning:**
- `agents.update(prompt=novo_prompt)` cria nova versão automaticamente
- `sessions.create(version=N)` pina sessão a versão específica
- Rollback = pinar sessões futuras a versão `N-1`

**status_idled webhook:**
- Agente pausa com `requires_action` ou `idle`
- Webhook dispara externamente (email, WhatsApp do Marcelo)
- Marcelo aprova/rejeita
- Sessão retoma do ponto exato (sem long-polling, sem WebSocket preso)

**Aplicação V9:** versioning automático de prompts evoluídos (persona/user-profile/strategies). HITL em todas as ações críticas (Art. II).

### § 29. Padrão 6 — Evaluator-Optimizer + Orchestrator-Workers

**Origem:** `claude-cookbooks/patterns/agents/`

**Evaluator-Optimizer:**
- Opus gera conteúdo (ex: CMO-IA escreve post de blog)
- Sonnet avalia contra critérios (qualidade, tom, SEO)
- Loop N iterações ou até passar quality gate
- Para skills criativas (marketing, copywriting)

**Orchestrator-Workers:**
- Lead (Opus) decompõe problema em sub-tarefas paralelas
- Workers (Haiku, baratos) executam em paralelo
- Lead sintetiza resultados
- Para skills de pesquisa, sales enablement, análise de mercado

**Aplicação V9:**
- CMO-IA-FIC usa Evaluator-Optimizer para conteúdo
- D-Estrategia usa Orchestrator-Workers para análise cross-business

### § 30. Padrão 7 — FastMCP v3 como framework canônico

**Origem:** `fastmcp/src/fastmcp/`

**Capacidades:**
- `@mcp.tool` / `@mcp.resource` / `@mcp.prompt` com schema auto-gerado de type hints
- `AuthProvider` pluggable (Supabase JWT, owner token, scope-based)
- Middleware stack (logging, rate-limit, errors, tracing)
- OpenAPI provider — auto-gera MCP tools de qualquer spec OpenAPI
- `FastMCPProxy` — wrap MCP servers de terceiros com auth + logging
- `ToolTransform` + `apply_session_transforms` — visibility gates per-session (RBAC)

**Aplicação V9:** todos os MCP servers do ecossistema em FastMCP:

```
packages/mcp-servers/
├── supabase-mcp/         # CRUD em qualquer projeto Supabase
├── github-mcp/           # ops no monorepo
├── whatsapp-mcp/         # via Evolution API
├── credential-mcp/       # wraps SC-29
├── memory-mcp/           # wraps Mem0
├── audit-mcp/            # query audit_log
└── businesses/
    ├── fic-mcp/          # tools específicas FIC
    ├── klesis-mcp/
    ├── intentus-mcp/
    ├── splendori-mcp/
    └── nexvy-mcp/
```

Cada MCP server herda `AuthProvider` comum, middleware comum, OTel tracing.

### § 31. Padrão 8 — Memory Blocks + ToolRulesSolver + Sleeptime

**Origem:** `letta/letta/agent.py` + services/

**Memory Blocks:**
- Blocos **in-context, always-present**: `human`, `persona`, `system`
- Agente pode LER e EDITAR via tools (`block_update`)
- RBAC per-block (`READ_ONLY_BLOCK_EDIT_ERROR`)

**ToolRulesSolver:**
- `TerminalToolRule`: após tool X, turn acaba
- "Após X, deve chamar Y" declarativo (não prompt-engineered)
- Mais confiável que instruir no prompt

**Sleeptime agent:**
- Wake-up periódico (idle times) para consolidação
- Processa recent episodes → long-term memory
- Complementa phantom's session-end reflection (contínuo vs por-sessão)

**Aplicação V9:**
- Cada C-Suite tem blocos `persona`, `business_context`, `user_profile` in-context
- Sleeptime worker no Railway roda em madrugadas para consolidação
- ToolRulesSolver em skills críticas (ex: após `emitir_boleto`, deve chamar `registrar_cobrança`)

### § 32. Padrão 9 — pgvector 3-Tier + BM25 + Entity Boost

**Origem:** `phantom/src/memory/{episodic,semantic,procedural}.ts` + `mem0/mem0/utils/scoring.py`

**Arquitetura:**

| Tier | Tabela | Conteúdo | Vectors |
|---|---|---|---|
| **Episodic** | `memory_episodic` | Tasks, conversations, outcomes | `summary` (768) + `detail` (768) + BM25 sparse |
| **Semantic** | `memory_semantic` | Atomic facts (subject/predicate/object) | Single vector + BM25 + contradiction detection |
| **Procedural** | `memory_procedural` | Workflows com success/failure | Single vector |

**Retrieval:**
- Dense (cosine similarity pgvector)
- Sparse (BM25 via `ts_rank_cd`)
- Entity boost (weight extra para entidades mencionadas na query)
- **Reciprocal Rank Fusion** combina os 3 sinais

**Aplicação V9:** migrations em `infra/supabase/migrations/` criam as 3 tabelas com namespaces por `business_id`. `packages/memory` exporta `recall(query, filters)` que retorna top-K fundidos.

**Degraded mode:** se pgvector/embeddings falham, retorna `[]` silenciosamente. Memory nunca derruba o agente.

### § 33. Padrão 10 — LiteLLM Router + Fallbacks + Cooldown

**Origem:** `litellm/litellm/router.py`

**Capacidades:**
- 100+ providers em interface OpenAI-compatible
- Routing strategies: `simple-shuffle`, `least-busy`, `usage-based`, `latency-based`, `cost-based`
- Fallback chains: `default_fallbacks`, `context_window_fallbacks`, `content_policy_fallbacks`
- **Cooldown**: deployment em cooldown após N falhas, retry agendado
- Budgets per-key (virtual keys por negócio)
- Redis caching entre chamadas idênticas
- Observability: emite traces para Langfuse nativamente

**Aplicação V9:**
- **1 LiteLLM proxy no Railway**, compartilhado por todo o ecossistema
- Virtual keys: `fic-key`, `klesis-key`, `intentus-key`, `splendori-key`, `nexvy-key`, `ecosystem-key`
- Budgets per-business (limite mensal USD)
- Fallback canônico: `claude-sonnet-4-6 → claude-haiku-3-7 → gpt-4o-mini → maritalk-sabia-4`
- Todos os agentes chamam **`litellm.proxy.ecosystem.com`**, nunca provedor direto

**Resultado:** cost control + resilience + observability **centralizados**. Adicionar provedor novo = 1 config, não N mudanças de código.

---

## Parte IX — Stack Técnica Canônica V9

### § 34. Ferramentas validadas (com evidência de código)

| Camada | Ferramenta | Fonte | Licença |
|---|---|---|---|
| **Runtime agentes** | Anthropic Managed Agents | Oficial | Comercial |
| **SDK** | `@anthropic-ai/claude-agent-sdk` (Python + TS) | anthropic-ai/claude-agent-sdk | MIT |
| **Orquestração Jarvis** | langgraph + PostgresSaver (encrypted) | langchain-ai/langgraph | MIT |
| **Orquestração vertical** | crewAI ou openai-agents (Session Protocol) | crewAIInc/crewAI + openai/openai-agents-python | MIT |
| **MCP framework** | FastMCP v3 | PrefectHQ/fastmcp | Apache-2.0 |
| **Memory** | Mem0 v3 (wrapper) + pgvector 3-tier | mem0ai/mem0 | Apache-2.0 |
| **LLM Gateway** | LiteLLM (proxy Railway) | BerriAI/litellm | MIT |
| **Observability** | Langfuse (self-host Railway) | langfuse/langfuse | MIT |
| **Voice Stage 2 (WhatsApp)** | pipecat + Evolution API | pipecat-ai/pipecat + EvolutionAPI | Apache-2.0 |
| **Voice Stage 3 (WebRTC)** | livekit/agents | livekit/agents | Apache-2.0 |
| **STT PT-BR** | Groq Whisper (cloud) OR faster-whisper (self-host) | SYSTRAN/faster-whisper | MIT |
| **TTS PT-BR** | ElevenLabs (quality) OR Piper (local) | elevenlabs + rhasspy/piper | MIT |
| **Wake word** | openWakeWord | dscripka/openWakeWord | Apache-2.0 |
| **VAD** | Silero VAD | snakers4/silero-vad | MIT |
| **Voice assistant runtime** | phantom patterns (inspiração) | ghostwright/phantom | Apache-2.0 |
| **Scheduled tasks** | pg_cron (data jobs) + Trigger.dev (agent orchestration) | Nativo + triggerdotdev | MIT |
| **Omnichannel base** | Chatwoot (fork para Nexvy) | chatwoot/chatwoot | MIT |
| **WhatsApp gateway** | Evolution API (Baileys + Meta Cloud) | EvolutionAPI/evolution-api | Apache-2.0 |
| **CLM Base** | Documenso (self-host sem modificar) | documenso/documenso | **AGPLv3** ⚠️ |
| **ICP-Brasil PAdES** | pyHanko (Python sidecar) | MatthiasValvekens/pyHanko | MIT |
| **Educação BR (Klésis)** | i-Educar (fork) | portabilis/i-educar | GPL-v2 |
| **CRM moderno** | Twenty (pattern study) | twentyhq/twenty | **AGPLv3** ⚠️ |
| **NFe/NFS-e PT** | PyNFe (Python) | TadaSoftware/PyNFe | MIT |
| **LLM PT-BR** | MariTalk (Sabiá-4) via OpenAI-compatible | maritaca-ai/maritalk-api | Comercial |

### § 35. Decisões críticas sobre licenças

**AGPLv3 (Documenso, Twenty):** self-host **sem modificar** o código. Para customizações, construir microserviços companheiros que consomem suas APIs. Nunca fork modificado em produto comercial fechado.

**GPL-v2 (i-Educar):** SaaS para clientes próprios é OK. Distribuição para terceiros exige publicar código.

**Apache-2.0 (Evolution API, pipecat, LiveKit, FastMCP, OpenWakeWord):** **mais permissivas**. Fork + modificação + comercialização livres.

**MIT (a maioria):** mesma permissividade, sem obrigação de notice explícito.

### § 36. Stack BR por negócio (validada com análise de código)

| Negócio | Stack recomendada |
|---|---|
| **FIC** | Chatwoot + Evolution API · Documenso + pyHanko (diplomas ICP-Brasil MEC 554/2021) · PyNFe (NFS-e mensalidades) · módulo Censup/e-MEC **construído novo** inspirado em i-Educar · Twenty (funil vestibular) · MariTalk (atendimento aluno) |
| **Klésis** | **Fork i-Educar** (Educacenso INEP) · Chatwoot + Evolution API (pais/responsáveis) · Documenso + pyHanko (matrícula assinada) · PyNFe (NFS-e) · MariTalk |
| **Intentus** | **Twenty pattern study** (não fork) · **Documenso + pyHanko = diferencial jurídico** (locação com ICP-Brasil) · Chatwoot + Evolution API · PyNFe (NFS-e locação) |
| **Splendori** | Twenty (lead→reserva→contrato) · Documenso + pyHanko (compra/venda ICP-Brasil) · Chatwoot + Evolution API · sped-nfe ou PyNFe |
| **Nexvy** | **Fork Chatwoot white-label** · **Evolution API multi-tenant** · go-whatsapp-web-multidevice (alternativa MCP-native) · Documenso add-on · Twenty integração · MariTalk engine PT-BR |

### § 37. "Stack BR canônica" (comum a todos)

Chatwoot + Evolution API + Documenso + pyHanko + PyNFe + MariTalk é o **core nacional**. Evolution API já tem integração Chatwoot nativa (`src/api/integrations/chatbot/chatwoot/`) — zero glue code.

---

## Parte X — Jarvis em 4 Estágios (reafirmado)

D3 do V4 permanece. Com evidência de código, a stack por estágio:

| Estágio | Funcionalidade | Stack V9 |
|---|---|---|
| **E1 — CLI** (agora) | Marcelo usa Claude Code | Claude Code + Managed Agents + skills + hooks constitucionais |
| **E2 — WhatsApp** (~sem 4) | Text-first bot | **Evolution API (Cloud API) + pipecat + Supabase + C-Suite routing** |
| **E3 — Voz App** (~sem 8) | macOS/iOS com push-to-talk | pipecat + Groq Whisper + ElevenLabs + openWakeWord + Silero VAD + app Electron ou Swift |
| **E4 — Always-on** (~sem 16+) | Escuta ambiente, voz proativa | livekit/agents + Omi-like arquitetura + wake-word + sensors + proactive triggers |

**Filosofia mantida:** cada estágio precisa ser excelente antes do próximo.

---

## Parte XI — Modelo de Dados Consolidado

### § 38. Três supabases canônicos + futuros

| Supabase | ID | Papel |
|---|---|---|
| **ECOSYSTEM** | `gqckbunsfjgerbuiyzvn` | Plataforma compartilhada — `ecosystem_memory`, `agent_tasks`, `ecosystem_credentials`, `credential_access_log`, `audit_log`, `skills_registry`, `billing_engine`, `raci_registry`, `cost_observer` |
| **ERP-FIC** | `ifdnjieklngcfodmtied` | Domínio educacional FIC — `alunos`, `matriculas`, `diplomas`, `cadeia_custodia`, `mensalidades`, `cursos` |
| **Intentus** | `bvryaopfjiyxjgsuhjsb` | Domínio imobiliário — `empreendimentos`, `unidades`, `contratos_clm`, `leads`, 133 EFs |
| **Klésis** | a criar | K-12 (LGPD reforçado — SC-22 Minors Fortress) |
| **Splendori** | a criar | Incorporação Piracicaba |
| **Nexvy** | a criar | Multi-tenant platform |

### § 39. Regra de ouro (preservada do V4)

> *"Se serve mais de um negócio → vai para ECOSYSTEM. Se é domínio do negócio → vai para o DB dele."*

Exemplo — emissão de boleto:
- **Motor** (`@ecossistema/billing`, Inter + idempotência + HMAC) → ECOSYSTEM
- **Registro** (aluno_id, mês_ref, valor, status) → ERP-FIC

### § 40. Memory layer cross-database

```sql
-- ECOSYSTEM.memory_episodic (namespace cross-business)
create table memory_episodic (
    id            uuid primary key default gen_random_uuid(),
    business_id   text not null,         -- 'ecosystem' | 'fic' | 'klesis' | ...
    agent_id      text not null,
    user_id       text,
    run_id        uuid,
    type          text not null,         -- 'task' | 'conversation' | 'decision'
    outcome       text,                  -- 'success' | 'failure' | 'partial'
    summary       text not null,
    detail        text,
    summary_vec   vector(768),
    detail_vec    vector(768),
    tsv           tsvector generated always as (to_tsvector('portuguese', coalesce(summary,'') || ' ' || coalesce(detail,''))) stored,
    entities      jsonb default '[]'::jsonb,
    importance    real default 0.5,
    access_count  int default 0,
    created_at    timestamptz default now(),
    last_accessed timestamptz
);

create index on memory_episodic using ivfflat (summary_vec vector_cosine_ops);
create index on memory_episodic using ivfflat (detail_vec vector_cosine_ops);
create index on memory_episodic using gin (tsv);
create index on memory_episodic (business_id, agent_id, user_id);

-- RLS: business_id controla acesso cross-business
alter table memory_episodic enable row level security;
create policy memory_business_isolation on memory_episodic
    using (business_id = current_setting('app.current_business', true)
           OR current_setting('app.is_ecosystem_admin', true) = 'true');
```

Análogas para `memory_semantic` e `memory_procedural`.

---

## Parte XII — Estrutura do Monorepo

```
ecossistema-monorepo/
├── apps/
│   ├── orchestrator/           # FastAPI Railway (exposes Managed Agents via HTTP)
│   ├── jarvis-app/             # E3/E4 app (futuro)
│   ├── erp-educacional/        # Next.js 15 (FIC + Klésis shared patterns)
│   ├── intentus/               # Vite/React (imobiliário)
│   ├── splendori/              # (futuro)
│   └── nexvy/                  # (futuro — fork Chatwoot white-label)
│
├── packages/
│   ├── @ecossistema/agentes/
│   │   └── c-suite-templates/  # Templates CEO/CFO/CAO/CMO/CSO/CLO/COO/CTO/CPO/CHRO
│   ├── @ecossistema/constitutional-hooks/   # 22 Artigos como hooks
│   ├── @ecossistema/prompt-assembler/       # Phantom 9-layer pattern
│   ├── @ecossistema/memory/                 # Mem0 wrapper + pgvector 3-tier
│   ├── @ecossistema/credentials/            # SC-29 client (wraps EF)
│   ├── @ecossistema/mcp-servers/            # FastMCP servers do ecossistema
│   │   ├── supabase-mcp/
│   │   ├── whatsapp-mcp/
│   │   ├── credential-mcp/
│   │   ├── memory-mcp/
│   │   ├── audit-mcp/
│   │   └── businesses/{fic,klesis,intentus,splendori,nexvy}-mcp/
│   ├── @ecossistema/skills-registry/        # Skill discovery + matching
│   ├── @ecossistema/billing/                # Motor boletos + idempotência
│   ├── @ecossistema/rag/                    # Cliente RAG-engine Railway
│   ├── @ecossistema/magic-link-vault/       # Phantom vault pattern
│   ├── @ecossistema/observability/          # Langfuse client + OTel
│   ├── @ecossistema/litellm-client/         # Wrapper LiteLLM com defaults V9
│   └── @ecossistema/tools/                  # Tool wrappers genéricos
│
├── infra/
│   ├── supabase/
│   │   ├── migrations/         # ECOSYSTEM schema
│   │   └── functions/          # 13 Edge Functions (SCs L3)
│   ├── railway/                # IaC Railway (orchestrator, LiteLLM, Langfuse, RAG, workers)
│   └── triggerdev/             # Scheduled jobs agent-related
│
├── docs/
│   ├── masterplans/            # V8.2, V9, históricos
│   ├── adr/                    # Architecture Decision Records
│   ├── runbooks/               # Operational procedures
│   ├── research/               # 99 repos analisados
│   └── sessions/               # Logs de sessões + briefings
│
├── CLAUDE.md                   # Cardinal Rule na primeira linha
├── MEMORY.md                   # Índice canônico de memória
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Parte XIII — Roadmap de Implementação

### § 41. Fases (herdadas do V4 + refinadas)

**Fase 0 — Fundação (semanas 1-4)** 🟢 EM ANDAMENTO (herdada)
- [x] Monorepo estruturado
- [x] Supabase ECOSYSTEM + ERP-FIC + Intentus em produção (Vercel migrado)
- [x] Fase B: Supabase como memória primária + auto-embedding
- [x] SC-29 Credential Vault base (s094)
- [x] Dashboard + Bash validation (s098)
- [ ] **`@ecossistema/memory`** (Mem0 wrapper + pgvector 3-tier)
- [ ] **`@ecossistema/constitutional-hooks`** (11 hooks prioritários)
- [ ] **`@ecossistema/prompt-assembler`** (Phantom 9-layer)
- [ ] **SC-29 v2** (Edge Function Credential Gateway com Modo B proxy)
- [ ] **LiteLLM proxy** no Railway + Langfuse self-host
- [ ] **FastMCP template** para MCP servers do ecossistema

**Fase 1 — C-Suite per negócio (semanas 5-8)**
- [ ] Templates C-Suite em `packages/c-suite-templates/` (10 diretores)
- [ ] CFO-FIC como piloto (boletos Inter + inadimplência + régua)
- [ ] CEO-FIC + CAO-FIC + CMO-FIC
- [ ] CSO-Intentus (template SaaS)
- [ ] Jarvis Stage 2 (WhatsApp via Evolution API + pipecat)
- [ ] 6 Diretores de Área no ecossistema (prompts base + dashboards)

**Fase 2 — Autonomia coordenada (semanas 9-12)**
- [ ] C-Suite completo nos 5 negócios (~30-35 agentes)
- [ ] Diretores de Área com hooks de auditoria automáticos
- [ ] Briefing diário para Marcelo via Jarvis
- [ ] Jarvis Stage 3 (voz + app Electron/Swift)
- [ ] Evaluator-Optimizer + Orchestrator-Workers em skills-chave
- [ ] Sleeptime consolidation worker (pattern Letta)

**Fase 3 — Jarvis always-on (semanas 13-24)**
- [ ] Stage 4: wake-word + always-on
- [ ] Ambient agent pattern (inspiração Omi)
- [ ] Proactive triggers (padrões detectados → agente age sem prompt explícito)
- [ ] Cross-business synergy engine (D-Sinergia operacional)

### § 42. Ordem canônica de implementação das SCs (Ondas V8.2 refinadas)

| Onda | SCs | Justificativa |
|---|---|---|
| **0** | SC-29 (Credential Gateway v2) | Bloqueia tudo que precisa de credential externa |
| **1** | SC-01, SC-02, SC-10, SC-14 | Foundation: Managed Agents + Webhook Hardening + SDK |
| **2** | SC-03, SC-04, SC-11 | Dual-Write + Skill Registry + Audit Log |
| **3** | SC-05, SC-06, SC-15, SC-16, SC-19 | Skill Router + Memory v1 + Schema + Retry + PII |
| **4** | SC-07, SC-08, SC-09, SC-20 | HITL + Cost + Multi-Tenant RLS + Rate Limit |
| **5** | SC-13, SC-18, SC-24 | Sandbox + Observability (Langfuse) + RACI |
| **6** | SC-12, SC-21 | Memory v2 (consolidator) + Rollback |
| **7** | SC-17, SC-23 | LiteLLM Gateway + Agent Performance |
| **8** | SC-22 | Minors Fortress (Klésis) |
| **9** | SC-25, SC-27 | Cross-Business Router + Incident Commander |
| **10** | SC-26, SC-28 | Agent Learning Loop + Regulatory Watcher |

---

## Parte XIV — Regras de Execução

### § 43. Princípios operacionais

1. **Cardinal Rule primeiro** — TypeScript/Python é encanamento, Agent SDK é o cérebro
2. **Dual-Write Supabase-first** — nada de crítico em arquivos locais
3. **Hooks constitucionais obrigatórios** em todos os agentes
4. **Templates C-Suite reutilizados** entre negócios (herança por variant)
5. **Credenciais via SC-29 Modo B** em produção (agente nunca vê secret)
6. **Memory via Mem0 wrapper** com filters estritos (`user_id`, `agent_id`, `run_id`)
7. **Observability em tudo** (Langfuse self-host)
8. **Cost control via LiteLLM** budgets per-business
9. **6 Diretores de Área auditam** — Marcelo não olha 1 a 1
10. **Briefing diário consolidado** para Marcelo via Jarvis

### § 44. Paralelismo de sessões Claude Code

Mantido do V4 (válido):
- 1 worktree por sessão (`git worktree add`)
- Escopo por package, nunca sobreposto
- Lock via Task Registry (`agent_tasks`)
- Deploy sempre serial (PRs + CI green)
- Sync diário (commit + push + PR)
- Supabase migrations: **uma sessão por dia** em ECOSYSTEM ou DBs de produção

### § 45. Compactation Protocol

Mantido do V8.2. Implementação via Fase 0 `@ecossistema/memory`:
- Toda decisão nova = registrar em Mem0 com `filters.tag = "decision"`
- Git commit antes de compactação
- Nova sessão Claude Code: primeira ação = ler `MEMORY.md` + recall Mem0 últimas 3 sessões

---

## Parte XV — Governança

### § 46. D-Governanca como guardião executável

O Diretor de Governança (área Ecossistema) supervisiona:
- Violações de hooks constitucionais (em tempo real)
- Compliance LGPD cross-business
- Rotação de credenciais (alertas expiração)
- Audit log — análises padrão vs anomalia
- Pause automático de agente em violação crítica

### § 47. Marcelo como CEO do ecossistema

**O que Marcelo decide:**
- Propósito e direção estratégica (Tripé BAM: financeiro + social + propósito)
- Ações com impacto > R$ 10k (Art. II HITL)
- Rotação de credenciais de produção (Art. II)
- Mudanças nos 22 Artigos Constitucionais
- Contratação/desligamento de Diretores de Área
- Mudanças na matriz C-Suite dos negócios

**O que Marcelo não precisa fazer:**
- Auditar agentes 1 a 1 (Diretores de Área fazem)
- Operação do dia-a-dia (C-Suite de cada negócio executa)
- Decisões financeiras < R$ 10k (automatizadas com hooks)
- Rotina de compliance (hooks + D-Governanca)

### § 48. Tripé decisório em código

Toda proposta cross-business que chega a Marcelo via Jarvis passa por D-Estrategia, que aplica o Tripé:

```typescript
interface BAMDecision {
    proposta: string;
    viabilidade_financeira: {
        investimento: number;
        retorno_estimado: number;
        payback_meses: number;
        risco: 'baixo' | 'medio' | 'alto';
    };
    impacto_social: {
        beneficiarios: string[];
        natureza: string;
        mensuravel: boolean;
    };
    coerencia_proposito: {
        artigos_aplicaveis: string[];
        alinhamento: number;  // 0-1
        conflitos: string[];
    };
}

async function avaliaTripeBAM(decisao: BAMDecision): Promise<BAMVerdict> {
    // D-Estrategia usa AEGIS 7-layer epistemic framework
    // Retorna: APPROVED | APPROVED_WITH_CONDITIONS | REJECTED
    // Com justificativa estruturada (evidência → interpretação → julgamento)
}
```

---

## Parte XVI — Diferenças Concretas V8.2 → V9

| Aspecto | V8.2 | V9 |
|---|---|---|
| **22 Artigos** | Texto markdown | Hooks executáveis + diretrizes prompt |
| **29 Super-Crates** | Categorizadas por camada conceitual (L1-L7) | Reclassificadas por tecnologia real (L1/L2/L3/L4 execução) |
| **C-Suite** | 8 diretores no nível ecossistema | C-Suite per negócio + 6 Diretores de Área |
| **SC-29** | "Agente autônomo de credenciais" | Edge Function determinística (Modo B proxy) |
| **Meta-Padrões V7** | Nexus/Mesh/Autonomous Orch (narrativa) | Descartados (só 13 MPs arquiteturais permanecem) |
| **Stack técnica** | Mencionada em alto nível | Validada em código (99 repos analisados) |
| **Memory** | `ecosystem_memory` genérico | 3-tier (episodic/semantic/procedural) + Mem0 v3 wrapper |
| **Governança** | Conceitual | D-Governanca operacional + hooks executam |
| **Briefing Marcelo** | Marcelo audita | 6 Diretores auditam, briefing consolidado |

---

## Parte XVII — Documentos Relacionados

| Documento | Localização | Relação com V9 |
|---|---|---|
| V8.2 | `docs/masterplans/MASTERPLAN-ECOSSISTEMA-v8.2.md` | **Base canônica** — V9 herda |
| V7 Omega | `docs/masterplans/PLANO-ECOSSISTEMA-V7-SYNERGETIC-INTELLIGENCE.html` | **Histórico** — 6 Meta-Padrões descartados |
| Plano V4 | `docs/masterplans/PLANO-EXECUCAO-V4.md` | **Ativa** — 6 decisões canônicas + 4 fases |
| MASTERPLAN FIC v2.1 | `docs/masterplans/MASTERPLAN-FIC-MULTIAGENTES-v2.1.md` | Precisa upgrade para v3 (V9-compatible) |
| Análises research | `docs/research/*.md` | **Evidências** que fundamentam V9 |
| Consolidado findings | `docs/research/CONSOLIDADO-FINDINGS-2026-04-15.md` | **Sumário executivo** da pesquisa |

---

## Parte XVIII — Contagem Consolidada V9

| Componente | V8.2 | V9 | Δ |
|---|---|---|---|
| Artigos Constitucionais | 22 | 22 | = |
| Artigos como hooks | 0 | 11 verificáveis + 11 diretrizes | +11 hooks |
| Meta-Padrões arquiteturais | 13 | 13 | = |
| Meta-Padrões narrativos V7 | 6 | 0 | **-6 descartados** |
| Super-Crates | 29 | 29 (reclassificadas) | = |
| Camadas conceituais L1-L7 | 7 | 7 (preservadas) | = |
| Camadas técnicas de execução | 0 | 4 (L1/L2/L3/L4) | +4 |
| Ondas de implementação | 17 | 17 (refinadas 0-10) | = |
| Decisões canônicas V4 | 6 | 6 | = |
| Negócios atendidos | 5 | 5 | = |
| Agentes C-Suite | ~8 + sub-agentes | ~30-35 per negócio | +reorganizado |
| Diretores de Área (ecossistema) | 0 | 6 | +6 |
| Padrões roubados (código validado) | 0 | 10 | +10 |
| Repos analisados a fundo | ~5 | 99 | **+94** |

---

## Parte XIX — Frase-mantra V9

> **"Evidência sobre narrativa. Preservar o que funciona. Evoluir com cuidado. Descartar apenas a ficção."**

A V8.2 construiu a base sólida. A V9 a coloca em produção com evidência real de código. Nada do que Marcelo e Claudinho decidiram antes foi desperdiçado. A V9 é o próximo capítulo — mais ancorado, mais executável, mais honesto.

---

## Próximos Passos Imediatos

1. **Marcelo aprova V9** (ou solicita ajustes)
2. **Commit V9 canônica** no monorepo
3. **Arquivar V7 narrativa** em `docs/masterplans/historico/` (preservar)
4. **Abrir sessões paralelas** para Fase 0 restante:
   - Sessão A: `@ecossistema/memory` (Mem0 + pgvector 3-tier)
   - Sessão B: `@ecossistema/constitutional-hooks` (11 hooks prioritários)
   - Sessão C: `@ecossistema/prompt-assembler` (Phantom 9-layer)
   - Sessão D: SC-29 v2 + LiteLLM proxy Railway + Langfuse self-host
5. **Atualizar MASTERPLAN-FIC v2.1 → v3** com herança V9
6. **Rotacionar secrets** identificados na migração (pendência Fase 0)

---

**Aprovação canônica:**

- [ ] Marcelo Silva (CEO) — _data, assinatura_
- [ ] Claudinho (VP Executivo) — _data, versão prompt_

---

*Documento vivo. Toda decisão nova que afete arquitetura do ecossistema entra em novo §. Versões menores (V9.1, V9.2) para adições. V10 só se houver mudança estrutural radical.*
