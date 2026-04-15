# MASTERPLAN ECOSSISTEMA — V8.2
## Omega Multi-Provider Resilience Edition + Credential Sovereignty

**Versão:** 8.2  
**Nome:** Omega Multi-Provider Resilience Edition + Credential Sovereignty  
**Baseado em:** V8.1 Omega Multi-Provider Resilience Edition (declarado canônico em 14/04/2026 — Sessão 012)  
**Data de evolução:** 14/04/2026 (Sessão 093)  
**Responsável:** Marcelo Silva (CEO) · Claudinho (VP Executivo)  
**Status:** 📋 Planejamento — SC-29 para implementação imediata (P0)

---

## 📋 CHANGELOG V8.1 → V8.2

| Componente | V8.1 | V8.2 | Motivo |
|-----------|------|------|--------|
| Super-Crates | 28 SC | **29 SC** | Adição de SC-29 |
| Novo SC | — | **SC-29 Credential Vault Agent** | Gestão soberana de credenciais de API |
| Artigos Constitucionais | 22 | 22 (sem mudança) | SC-29 aplica Artigos VIII + XIX + XXII |
| Meta-Padrões | 13 | 13 (sem mudança) | SC-29 aplica MP-04 + MP-08 + MP-12 |
| Ondas | 17 | 17 (sem mudança) | SC-29 entra em **Onda 0** (pré-infraestrutura) |
| Camadas | 7 (L1–L7) | 7 (sem mudança) | SC-29 opera na **Camada L3 (Infraestrutura Transversal)** |

### Por que V8.2 foi criado

Na Sessão 093, ao implementar o auto-embedding (FASE 0.4), emergiu um problema estrutural: cada Edge Function e agente precisa de credenciais de API (Gemini, Inter, BRy, OpenRouter, etc.) e a gestão era feita via arquivos `.md` e comentários dispersos. Marcelo rejeitou esse modelo como "modo antigo de pensar" e exigiu uma solução sistêmica.

> *"Delegar regras de credenciais a arquivos .md não contribui para um ecossistema. Precisamos de um agente inteligente de credenciais."*  
> — Marcelo Silva, CEO, 14/04/2026

SC-29 nasce dessa decisão. É o primeiro Super-Crate de Onda 0 — infraestrutura que existe ANTES de todo o resto.

---

## 🏛️ HERANÇA DO V8.1 (REFERÊNCIA COMPLETA)

> *Esta seção preserva o estado completo do V8.1 para fins de comparação e rastreabilidade.*

### 22 Artigos Constitucionais (sem alteração)

| Artigo | Nome | Relevância para SC-29 |
|--------|------|----------------------|
| I | Primazia do Propósito | SC-29 serve à missão, não à conveniência |
| II | Human-in-the-loop Crítico | Rotação de credenciais exige aprovação CEO |
| III | Idempotência Universal | Registro de credencial é idempotente |
| IV | Rastreabilidade Total | Cada acesso a credencial é logado |
| V | Memória Persistente | Credenciais vivas no Supabase Vault |
| VI | Autonomia Gradual | SC-29 começa read-only, escala para auto-rotação |
| VII | Hierarquia Respeitada | SC-29 serve todos os agentes via chamada padronizada |
| **VIII** | **Confirmação por Baixa Real** | **SC-29 valida credencial antes de entregar** |
| IX | Falha Explícita | Credencial ausente → erro imediato, não silencioso |
| X | Princípio da Menor Surpresa | API pública simples: `get_credential(name)` |
| XI | Reversibilidade | Credential pode ser revogada sem reimplantar agentes |
| XII | Custos sob Controle | SC-29 audita custo de cada provider por credencial |
| XIII | Skill-First | SC-29 usa `engineering:architecture` para design |
| XIV | Dual-Write (Supabase-first) | Supabase Vault é primário; `.md` NUNCA armazena credencial |
| XV | Multi-Tenant Data Isolation | Credenciais FIC ≠ Credenciais Intentus ≠ Credenciais Klésis |
| XVI | Observabilidade por Default | Alertas de expiração de credencial via Sentry |
| XVII | Testes antes do Deploy | Mock credentials para ambientes de teste |
| XVIII | Data Contracts versionados | Schema de `ecosystem_credentials` versionado |
| **XIX** | **Segurança em Camadas** | **Vault + RLS + rate-limit + audit log** |
| XX | Soberania Local supera Dependência | Credenciais locais têm precedência sobre cloud |
| XXI | Escolha de Modelo é Estratégia | SC-29 usa Haiku para tarefas rotineiras de lookup |
| **XXII** | **Aprendizado é Infraestrutura** | **SC-29 aprende padrões de uso e detecta anomalias** |

### 13 Meta-Padrões (sem alteração)

| MP | Nome | Como SC-29 aplica |
|----|------|-------------------|
| MP-01 | Orquestrador Central + Especialistas | SC-29 é agente especialista acionado pelo Orquestrador |
| MP-02 | Memória em Camadas | Credenciais: Vault (L1) → Registry table (L2) → Logs (L3) |
| MP-03 | Skill Registry First | SC-29 consulta `engineering:architecture` antes de custom |
| **MP-04** | **Dual-Write** | **Vault SEMPRE é primário; NUNCA .md para secrets** |
| MP-05 | Human-in-the-loop por Classe de Risco | Rotação de prod = CEO approval |
| MP-06 | Idempotência por Chave Natural | Credencial = (name, project, environment) |
| MP-07 | Multi-Provider Resilience | SC-29 usa Vault do projeto atual; fallback env var |
| **MP-08** | **Audit Log Imutável** | **`credential_access_log` append-only** |
| MP-09 | Retry com Backoff Exponencial | Lookup falha → 3 tentativas com backoff |
| MP-10 | Validação em Camadas | RLS no vault + verificação de escopo do solicitante |
| MP-11 | Rollback Declarativo | Revogação = compensation action padrão |
| **MP-12** | **Custo Observável** | **SC-29 rastreia qual agente usa qual credencial** |
| MP-13 | Contratos de Dados Versionados | Schema `ecosystem_credentials` em migrations versionadas |

### 28 Super-Crates do V8.1 (referência)

| SC | Nome | Camada | Onda |
|----|------|--------|------|
| SC-01 | Agent Foundation | L2 Dev | Onda 1 |
| SC-02 | Orquestrator Core | L1 Orq | Onda 1 |
| SC-03 | Dual-Write Pipeline | L3 Infra | Onda 2 |
| SC-04 | Skill Registry | L1 Orq | Onda 2 |
| SC-05 | Skill Router | L1 Orq | Onda 3 |
| SC-06 | Memory Consolidator (v1) | L3 Infra | Onda 3 |
| SC-07 | Human Approval Queue | L1 Orq | Onda 4 |
| SC-08 | Cost Observer | L3 Infra | Onda 4 |
| SC-09 | Multi-Tenant Isolation | L3 Infra | Onda 4 |
| SC-10 | Webhook Hardening | L2 Dev | Onda 1 |
| SC-11 | Audit Log Foundation | L3 Infra | Onda 2 |
| SC-12 | Memory Consolidator (v2) | L3 Infra | Onda 6 |
| SC-13 | Agent Sandbox | L2 Dev | Onda 5 |
| SC-14 | Agent Runner (Claude Agent SDK) | L2 Dev | Onda 1 |
| SC-15 | Schema Contract Registry | L2 Dev | Onda 3 |
| SC-16 | Retry + Backoff Engine | L3 Infra | Onda 3 |
| SC-17 | Multi-Provider LLM Gateway | L3 Infra | Onda 7 |
| SC-18 | Observability Stack | L3 Infra | Onda 5 |
| SC-19 | PII Mask Pipeline | L3 Infra | Onda 3 |
| SC-20 | Rate Limiter | L3 Infra | Onda 4 |
| SC-21 | Rollback Engine | L2 Dev | Onda 6 |
| SC-22 | Minors Data Fortress | L3 Infra | Onda 8 |
| SC-23 | Agent Performance Monitor | L3 Infra | Onda 7 |
| SC-24 | RACI Registry | L1 Orq | Onda 5 |
| SC-25 | Cross-Business Router | L1 Orq | Onda 9 |
| SC-26 | Agent Learning Loop | L2 Dev | Onda 10 |
| SC-27 | Incident Commander | L3 Infra | Onda 9 |
| SC-28 | Regulatory Deadline Watcher | L1 Orq | Onda 10 |

---

## 🆕 SC-29 — CREDENTIAL VAULT AGENT *(NOVO em V8.2)*

### Visão

> *"Credencial é infraestrutura, não configuração. Um ecossistema de IA que guarda chaves de API em arquivos .md não é um ecossistema — é um protótipo."*

SC-29 é o agente autônomo que centraliza, protege, distribui e audita TODAS as credenciais de API usadas pelo ecossistema. Nenhum agente, Edge Function ou job acessa diretamente variáveis de ambiente para credenciais de terceiros — tudo passa pelo SC-29.

### Posicionamento

| Atributo | Valor |
|---------|-------|
| **Onda** | **Onda 0** (pré-infraestrutura — existe antes de todos os outros SC) |
| **Camada** | **L3 — Infraestrutura Transversal** |
| **Proprietário C-Suite** | **CTO-IA** (Diretor de Tecnologia IA — Dev, Infra, Segurança) |
| **Prioridade** | **P0** — bloqueia implementação de qualquer SC que precise de credencial externa |
| **Repositório de implementação** | `Ecossistema/` (serviço transversal, não vinculado a um projeto específico) |

### Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                    SC-29 CREDENTIAL VAULT AGENT                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │  Supabase Vault  │    │ ecosystem_creds   │                   │
│  │  (encrypted)     │◄──►│ (registry table)  │                   │
│  └──────────────────┘    └──────────────────┘                   │
│           │                        │                            │
│           ▼                        ▼                            │
│  ┌──────────────────────────────────────────┐                   │
│  │        credential-agent (Edge Function)   │                   │
│  │   • get_credential(name, project, env)    │                   │
│  │   • rotate_credential(name)               │                   │
│  │   • validate_credential(name)             │                   │
│  │   • list_credentials(project)             │                   │
│  └──────────────────────────────────────────┘                   │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────────────────────────────┐                   │
│  │        credential_access_log             │                   │
│  │        (append-only audit trail)         │                   │
│  └──────────────────────────────────────────┘                   │
│                                                                  │
│  Credenciais gerenciadas:                                        │
│  • GEMINI_API_KEY_ECOSYSTEM    • INTER_CLIENT_ID (FIC)          │
│  • GEMINI_API_KEY_ERP          • BRY_API_KEY (ERP)              │
│  • OPENROUTER_API_KEY          • RESEND_API_KEY                  │
│  • ANTHROPIC_API_KEY           • STRIPE_SECRET_KEY (Intentus)   │
└─────────────────────────────────────────────────────────────────┘
```

### Schema de Banco de Dados

```sql
-- Registro central de credenciais (sem valores — valores ficam no Vault)
create table ecosystem_credentials (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                    -- ex: 'GEMINI_API_KEY_ECOSYSTEM'
  project     text not null,                    -- 'ecosystem' | 'erp' | 'intentus' | 'fic' | 'klessis'
  environment text not null default 'prod',     -- 'prod' | 'staging' | 'dev'
  provider    text not null,                    -- 'google' | 'anthropic' | 'openrouter' | 'inter' | 'bry'
  description text,
  vault_key   text not null,                    -- nome da secret no Supabase Vault
  expires_at  timestamptz,                      -- null = sem expiração
  is_active   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(name, project, environment)
);

-- Audit log imutável (append-only via RLS)
create table credential_access_log (
  id           bigserial primary key,
  credential_name text not null,
  project      text not null,
  accessor     text not null,                   -- qual agente/função acessou
  action       text not null,                   -- 'read' | 'rotate' | 'validate' | 'revoke'
  success      boolean not null,
  error_msg    text,
  accessed_at  timestamptz default now()
);

-- RLS: apenas service_role pode inserir/ler credenciais
alter table ecosystem_credentials enable row level security;
alter table credential_access_log enable row level security;
```

### Edge Function `credential-agent`

```typescript
// Interface pública do SC-29
// Chamada por qualquer agente: POST /functions/v1/credential-agent
// Body: { action: 'get' | 'validate' | 'list', name?: string, project: string }
// Auth: x-internal-secret (rotacionado pelo próprio SC-29)

export async function handleGetCredential(name: string, project: string, env = 'prod') {
  // 1. Verificar se credencial existe e está ativa no registry
  // 2. Logar acesso em credential_access_log  
  // 3. Recuperar valor do Supabase Vault (vault.decrypted_secrets)
  // 4. Retornar valor (nunca logar o valor)
}
```

### Protocolo de Uso para Agentes

```
❌ ANTES (V8.1 — modo arquivo):
   const key = Deno.env.get("GEMINI_API_KEY_ECOSYSTEM");

✅ DEPOIS (V8.2 — SC-29):
   const key = await getCredential("GEMINI_API_KEY_ECOSYSTEM", "ecosystem");
   // SC-29 valida, loga, e retorna. Rotação transparente para o agente.
```

### Regras de Ouro do SC-29

1. **Nenhum valor de credencial aparece em logs, arquivos .md ou código-fonte**
2. **Todo acesso a credencial gera entrada em `credential_access_log`**
3. **Rotação de credencial de produção exige aprovação CEO (Human-in-the-loop — Artigo II)**
4. **Credenciais por projeto/negócio** — FIC não acessa credenciais da Intentus
5. **SC-29 é auto-suficiente**: usa `SUPABASE_SERVICE_ROLE_KEY` (injetado automaticamente pelo Supabase) para seu próprio bootstrap

### Plano de Implementação

| Passo | Descrição | Esforço |
|-------|-----------|---------|
| **0.1** | Schema `ecosystem_credentials` + `credential_access_log` + RLS | 1h |
| **0.2** | Edge Function `credential-agent` (get + validate + list) | 2h |
| **0.3** | Migrar credenciais atuais para o Vault (8 credenciais conhecidas) | 1h |
| **0.4** | Atualizar Edge Function `embed-on-insert` para usar SC-29 | 30min |
| **0.5** | Dashboard de auditoria de credenciais (Supabase Studio view) | 30min |
| **0.6** | Alerta de expiração via Sentry/scheduled task | 30min |

**Estimativa total:** ~5h 30min (1 sessão dedicada)

### Impacto nos MASTERPLANs Herdeiros

| MASTERPLAN | Ação necessária |
|-----------|----------------|
| MASTERPLAN-FIC-MULTIAGENTES-v2.1 | Atualizar para v2.2 declarando herança do V8.2 e uso do SC-29 para credenciais Inter, BRy, WhatsApp Business |
| MASTERPLAN-INTENTUS (futuro) | Nasce já com SC-29 — credenciais Stripe, Urbit, PostHog via SC-29 |
| MASTERPLAN-KLÉSIS (futuro) | Idem — credenciais via SC-29 |

---

## 📊 CONTAGEM ATUALIZADA — V8.2

| Componente | V8.1 | V8.2 | Δ |
|-----------|------|------|---|
| Artigos Constitucionais | 22 | 22 | — |
| Meta-Padrões | 13 | 13 | — |
| **Super-Crates** | **28** | **29** | **+1 (SC-29)** |
| Camadas | 7 | 7 | — |
| Ondas | 17 | 17 | — |
| Negócios atendidos | 5 | 5 | — |
| **Total ferramentas ativas** | 70+ | 70+ | — |

---

## 🗺️ PLANO DE IMPLEMENTAÇÃO ECOSSISTEMA — FASES ATUALIZADAS

### FASE 0 — Infraestrutura Base (revisada em V8.2)

| Item | Descrição | Status |
|------|-----------|--------|
| **0.0** | **SC-29 Credential Vault Agent** ← **NOVO P0** | ⏳ Próxima sessão |
| 0.1 | Git como fonte de verdade (sync automático) | 📋 Planejado |
| 0.2 | bootstrap_session() — Supabase Primário | ✅ Concluído (s093) |
| 0.3 | Trigger auto-embedding (pg_net + Edge Function) | ✅ Concluído (s093) |
| 0.4 | Auto-embedding validado e2e (gemini-embedding-001) | ✅ Concluído (s093) |
| 0.5 | Painel de Status do Ecossistema | 📋 Planejado |

> **SC-29 é P0 porque:** todo agente subsequente precisa de credenciais. Implementar SC-29 primeiro elimina a necessidade de "remendos" de credencial em cada sessão.

---

## 🔗 DOCUMENTOS RELACIONADOS

| Documento | Localização | Relação |
|-----------|-------------|---------|
| V8.1 Omega Infinite Synergy | `PLANO-ECOSSISTEMA-V8-OMEGA-INFINITE-SYNERGY.html` | Plano-base que V8.2 evolui |
| MASTERPLAN FIC v2.1 | `masterplans/MASTERPLAN-FIC-MULTIAGENTES-v2.1.md` | Plano-aplicação FIC — herda V8.1, migrar para V8.2 |
| ECOSSISTEMA-INOVACAO-IA.md | `ECOSSISTEMA-INOVACAO-IA.md` | Documento-mãe — inventário e visão |
| PLANO-IMPLEMENTACAO-ECOSSISTEMA-V1 | `PLANO-IMPLEMENTACAO-ECOSSISTEMA-V1.md` | Roadmap tático — SC-29 entra como FASE 0.0 |
| Supabase ECOSYSTEM | `gqckbunsfjgerbuiyzvn` (us-east-2) | Banco primário de memória do ecossistema |

---

## 📌 PRÓXIMOS PASSOS IMEDIATOS

1. **Sessão dedicada SC-29** — implementar `ecosystem_credentials` + `credential-agent` Edge Function (~5h30min)
2. **Atualizar MASTERPLAN FIC v2.1 → v2.2** — declarar herança V8.2 e SC-29 para credenciais Inter/BRy
3. **FASE 0.1** — Git como fonte de verdade
4. **FASE 0.5** — Painel de Status do Ecossistema
5. **FASE 1** — Task Registry + Agente de Prospecção

---

> *"A diferença entre um protótipo e um ecossistema é que o ecossistema gerencia sua própria infraestrutura. SC-29 é o momento em que paramos de tratar credenciais como configuração e começamos a tratá-las como arquitetura."*  
> — Claudinho (VP Executivo), interpretando a visão de Marcelo Silva, 14/04/2026
