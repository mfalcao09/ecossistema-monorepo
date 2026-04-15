# MAPEAMENTO — MASTERPLAN V8.2 → CLAUDE MANAGED AGENTS
**Versão:** 1.0  
**Criado em:** 14/04/2026  
**Baseado em:** MASTERPLAN ECOSSISTEMA V8.2 + Claude Managed Agents Beta (`managed-agents-2026-04-01`)  
**Responsável:** Marcelo Silva (CEO) · Claudinho (VP Executivo)

---

## 1. TRADUÇÃO DE CONCEITOS

A tabela abaixo mostra como cada elemento do V8.2 se traduz para o Managed Agents:

| Conceito V8.2 | Conceito Managed Agents | Observação |
|---|---|---|
| **Agente** (Claudinho, CFO-IA, etc.) | `Agent` | model + system prompt + tools + MCPs |
| **Camada L1/L2/L3** | Agrupamento de Agents por função | L1=Orq, L2=Dev, L3=Infra → agents especializados |
| **Super-Crate (SC)** | Varia: Agent / Environment / Tool / MCP | Ver seção 4 para mapeamento individual |
| **Onda de Entrega** | Ordem de criação dos Agents | Onda 0 primeiro, Onda 1 em seguida... |
| **Sessão de trabalho** | `Session` | Cada tarefa = uma Session com histórico |
| **Dual-Write (SC-03)** | Tool customizada dentro de Agent | Agent escreve no Supabase via MCP tool |
| **Human-in-the-loop (Art. II)** | Evento `tool.confirmation` | API pausa e aguarda aprovação antes de agir |
| **Hierarquia C-Suite** | `callable_agents` (multi-agente) | Claudinho delega para CFO-IA, CMO-IA, etc. |
| **Skill Router (SC-05)** | `callable_agents` routing | Claudinho roteia para agente certo automaticamente |
| **Sandbox (SC-13)** | `Environment` com networking restrito | Config do container por negócio |
| **Multi-Tenant (SC-09)** | Environments separados por negócio | FIC-env ≠ Intentus-env ≠ Klésis-env |
| **Credential Vault (SC-29)** | MCP server conectado a todos os Agents | Edge Function já implementada |
| **Memory (Supabase ECOSYSTEM)** | Sessions persistentes + MCP Supabase | Histórico de eventos pelo `session.id` |
| **Cost Observer (SC-08)** | Usage tracking da API Anthropic | `managed-agents` tem rate limits por org |
| **Audit Log (SC-11)** | Events do tipo `agent.tool_use` | Todo uso de ferramenta gera evento auditável |

---

## 2. HIERARQUIA DE AGENTS (callable_agents)

```
┌──────────────────────────────────────────────────────────────────┐
│           👤 MARCELO SILVA (CEO)                                  │
│           → recebe eventos tool.confirmation                      │
│           → aprova ações de alto risco via API                    │
└────────────────────────────┬─────────────────────────────────────┘
                             │ cria Session + envia Events
┌────────────────────────────▼─────────────────────────────────────┐
│  🤖 CLAUDINHO — Agent Orquestrador                                │
│  model: claude-opus-4-6                                           │
│  callable_agents: [CFO-IA, CAO-IA, CMO-IA, CSO-IA, CTO-IA,      │
│                    CLO-IA, Buchecha, SC-29-Agent]                 │
│  tools: agent_toolset_20260401 + MCPs: Supabase ECOSYSTEM         │
└──┬──────┬──────┬──────┬──────┬───────┬───────┬──────────────────┘
   │      │      │      │      │       │       │
   ▼      ▼      ▼      ▼      ▼       ▼       ▼
CFO-IA CAO-IA CMO-IA CSO-IA CTO-IA CLO-IA Buchecha
Finan. Acad. Mktg  Vendas  Dev   Jurídico CodeReview

[FIC]  [Edu]  [Mktg] [Sales] [Tech]  [Law]   [Dev]
```

### Regra de delegação (callable_agents)
- Claudinho é o **único** orquestrador — ele chama os outros
- CFO-IA, CAO-IA etc. **não podem** chamar uns aos outros diretamente (1 nível)
- Buchecha (code review) é chamado pelo CTO-IA, não por Claudinho diretamente

---

## 3. ENVIRONMENTS NECESSÁRIOS

Três ambientes, um por contexto de segurança:

### ENV-1: `ecosystem-base`
```python
environment = client.beta.environments.create(
    name="ecosystem-base",
    config={
        "type": "cloud",
        "networking": {"type": "unrestricted"},  # acesso total
        # Python + Node.js + git pré-instalados
    }
)
# Usado por: Claudinho, Buchecha, CTO-IA
# Razão: precisam acessar GitHub, Vercel, múltiplas APIs
```

### ENV-2: `fic-secure`
```python
environment = client.beta.environments.create(
    name="fic-secure",
    config={
        "type": "cloud",
        "networking": {
            "type": "allowlist",
            "domains": [
                "cdpj.partners.uatinter.co",   # Banco Inter (sandbox)
                "cdpj.partners.inter.co",       # Banco Inter (prod)
                "supabase.co",                  # Supabase ERP
                "api.anthropic.com",            # Claude (fallback)
            ]
        }
    }
)
# Usado por: CFO-IA, COO-IA
# Razão: dados financeiros — rede restrita por Art. XIX (Segurança em Camadas)
```

### ENV-3: `kleisis-fortress`
```python
environment = client.beta.environments.create(
    name="kleisis-fortress",
    config={
        "type": "cloud",
        "networking": {
            "type": "allowlist",
            "domains": ["supabase.co", "api.anthropic.com"]
            # sem acesso a inter/stripe/whatsapp — SC-22 Minors Data Fortress
        }
    }
)
# Usado por: agentes Klésis (futuros)
# Razão: LGPD menores de idade — exceção Art. XX
```

---

## 4. MAPEAMENTO DOS 29 SUPER-CRATES

Cada SC vira uma coisa diferente no Managed Agents:

| SC | Nome | O que vira | Como implementar |
|---|---|---|---|
| **SC-01** | Agent Foundation | **Template de Agent** | System prompt base herdado por todos os agentes |
| **SC-02** | Orchestrator Core | **Agent: Claudinho** | claude-opus-4-6 + callable_agents completo |
| **SC-03** | Dual-Write Pipeline | **Tool customizada** | Agent chama Supabase via MCP: grava ERP + ECOSYSTEM |
| **SC-04** | Skill Registry | **System prompt** | Lista de capabilities no system prompt de Claudinho |
| **SC-05** | Skill Router | **callable_agents routing** | Claudinho detecta contexto e delega ao Agent certo |
| **SC-06** | Memory Consolidator v1 | **Session history** | `sessions.events.list()` → INSERT ecosystem_memory |
| **SC-07** | Human Approval Queue | **Evento tool.confirmation** | API emite `requires_action` → Marcelo aprova via Events |
| **SC-08** | Cost Observer | **Usage API** | Anthropic usage tracking + rate limit monitoring |
| **SC-09** | Multi-Tenant Isolation | **Environments separados** | ENV-2 FIC, ENV-3 Klésis, ENV-1 Ecossistema |
| **SC-10** | Webhook Hardening | **Tool com HMAC check** | Agent valida assinatura antes de processar webhook Inter |
| **SC-11** | Audit Log Foundation | **Events nativos** | Todo `agent.tool_use` é auditável via sessions.events |
| **SC-12** | Memory Consolidator v2 | **Scheduled Session** | Session recorrente que consolida histórico no Supabase |
| **SC-13** | Agent Sandbox | **Environment config** | networking allowlist por negócio |
| **SC-14** | Agent Runner | **Session** | Cada execução = uma Session com agent_id + environment_id |
| **SC-15** | Schema Contract Registry | **Tool: validate_schema** | Zod schemas carregados como tool dentro dos Agents |
| **SC-16** | Retry + Backoff | **Trigger.dev jobs** | Jobs externos que chamam Sessions via API com retry |
| **SC-17** | Multi-Provider LLM Gateway | **Model fallback** | Agent usa claude-opus → se falha, chama OpenRouter via bash |
| **SC-18** | Observability Stack | **Sentry MCP** | Conectar Sentry como MCP tool dentro de CTO-IA |
| **SC-19** | PII Mask Pipeline | **Tool: mask_pii** | Tool customizada que mascara CPF/RG antes de enviar ao LLM |
| **SC-20** | Rate Limiter | **Rate limits nativos** | 60 req/min criação, 600 leitura — respeitar no orquestrador |
| **SC-21** | Rollback Engine | **Tool: rollback_action** | Agent declara compensation action antes de agir |
| **SC-22** | Minors Data Fortress | **ENV-3 kleisis-fortress** | Networking ultra-restrito + PII mask reforçado |
| **SC-23** | Agent Performance Monitor | **Session metrics** | Track de duration, tool calls, tokens por Session |
| **SC-24** | RACI Registry | **System prompt** | RACI declarado no system prompt de cada Agent |
| **SC-25** | Cross-Business Router | **callable_agents V2** | Claudinho chama agentes de FIC, Intentus, Klésis |
| **SC-26** | Agent Learning Loop | **Memory (Research Preview)** | Solicitar acesso — feature de memória persistente |
| **SC-27** | Incident Commander | **Agent: CTO-IA** | CTO-IA com tool Sentry + sistema de escalada |
| **SC-28** | Regulatory Deadline Watcher | **Scheduled Session** | Session semanal que verifica prazos e-MEC |
| **SC-29** | Credential Vault Agent | **MCP Server** | Edge Function já ativa → conectar como MCP em todos os Agents |

---

## 5. AGENTS A CRIAR (por ordem de Onda)

### ONDA 0 — Pré-Infraestrutura (fazer primeiro)

```python
# Agent: SC-29 Credential Vault
# Não é um Managed Agent — é MCP server já implementado
# Conectar aos demais Agents via mcp_servers config
sc29_mcp = {
    "type": "url",
    "url": "https://gqckbunsfjgerbuiyzvn.supabase.co/functions/v1/credential-agent",
    "name": "credential-vault",
    "tools": ["get_credential", "list_credentials", "validate_credential"]
}
```

### ONDA 1 — Fundação dos Agents

```python
# 1. Agent Foundation Template (SC-01 + SC-14)
AGENT_BASE_SYSTEM = """
Você é um agente do Ecossistema de Inovação e IA de Marcelo Silva.

HIERARQUIA:
- CEO: Marcelo Silva (decisões estratégicas + aprovações alto risco)
- VP: Claudinho (você reporta a ele)
- Você: {cargo} — escopo {departamento}

REGRAS OBRIGATÓRIAS:
1. Nunca agir fora do seu escopo sem consultar Claudinho
2. Toda ação irreversível exige tool.confirmation (Human-in-the-loop)
3. Credenciais sempre via SC-29 — nunca hardcoded
4. Dual-write: gravar em Supabase ERP + ECOSYSTEM em eventos críticos
5. Falha explícita: se não sabe, escala para Claudinho
"""

# 2. Claudinho — Orquestrador (SC-02)
claudinho = client.beta.agents.create(
    name="Claudinho — VP Executivo",
    model="claude-opus-4-6",
    system=AGENT_BASE_SYSTEM.format(
        cargo="Vice-Presidente Executivo",
        departamento="cross-business"
    ) + """
Você coordena TODOS os diretores de IA. Sua função:
- Receber tarefa do CEO (Marcelo)
- Identificar qual Director-IA é responsável
- Delegar via callable_agents
- Consolidar resultados e reportar ao CEO

AGENTES DISPONÍVEIS para delegação:
- cfo_ia: questões financeiras, cobranças, fluxo de caixa
- cao_ia: questões acadêmicas, matrículas, diplomas
- cmo_ia: marketing, conteúdo, campanhas
- cso_ia: vendas, captação, CRM
- cto_ia: tecnologia, código, infraestrutura
- clo_ia: contratos, compliance, jurídico
""",
    tools=[{"type": "agent_toolset_20260401"}],
    mcp_servers=[sc29_mcp],  # SC-29 Credential Vault
    # callable_agents adicionados após criar os outros agents
)

# 3. SC-10: Webhook Hardening — tool interna do CFO-IA
# 4. SC-14: Agent Runner — cada Session já É o runner
```

### ONDA 1 (paralela) — CFO-IA para FIC

```python
# CFO-IA — Diretor Financeiro (primeiro agente operacional)
cfo_ia = client.beta.agents.create(
    name="CFO-IA — Diretor Financeiro FIC",
    model="claude-sonnet-4-6",
    system=AGENT_BASE_SYSTEM.format(
        cargo="CFO — Diretor Financeiro",
        departamento="financeiro FIC"
    ) + """
Você gerencia as finanças da Faculdades Integradas de Cassilândia (FIC).

RESPONSABILIDADES:
- Emissão de cobranças via Banco Inter (Bolepix)
- Monitoramento de inadimplência
- Notificações de vencimento via WhatsApp
- Relatórios financeiros mensais
- Integração com ERP-Educacional (Supabase: ifdnjieklngcfodmtied)

BANCO INTER — Regras:
- Sandbox: cdpj.partners.uatinter.co
- Produção: cdpj.partners.inter.co  
- Credencial: chamar SC-29 com get_credential("INTER_CLIENT_ID", "fic")
- Webhooks: validar HMAC antes de processar (SC-10)
- Idempotência: (aluno_id, mes_ref) — nunca duplicar boleto

APROVAÇÕES NECESSÁRIAS (emitir tool.confirmation):
- Cancelar boleto existente
- Enviar cobrança a aluno com renegociação ativa
- Qualquer ação > R$ 5.000
""",
    tools=[{"type": "agent_toolset_20260401"}],
    mcp_servers=[
        sc29_mcp,  # SC-29 credentials
        {"type": "url", "url": "https://ifdnjieklngcfodmtied.supabase.co", "name": "erp-fic"}
    ],
)
```

### ONDA 2 — Dual-Write e Audit (SC-03, SC-11)

```python
# Dual-write é uma TOOL customizada que todos os agents usam
# Implementada como função no system prompt + bash tool
DUAL_WRITE_INSTRUCTIONS = """
DUAL-WRITE OBRIGATÓRIO em eventos críticos:
1. Gravar no Supabase ERP (operacional): dados do negócio
2. Gravar no Supabase ECOSYSTEM: decisão/log para memória
Chamar: bash com SQL INSERT nos dois bancos via SC-29 credentials
"""
```

### ONDA 3 — Skill Router (SC-05)

```python
# Implementado como callable_agents no Claudinho
# Atualizar Claudinho com todos os agents criados nas Ondas 1+2
claudinho_updated = client.beta.agents.update(
    claudinho.id,
    callable_agents=[
        {"type": "agent", "id": cfo_ia.id, "version": cfo_ia.version},
        {"type": "agent", "id": cao_ia.id, "version": cao_ia.version},
        {"type": "agent", "id": cmo_ia.id, "version": cmo_ia.version},
        # ... demais agents
    ]
)
```

### ONDA 4 — Human Approval Queue (SC-07, SC-08, SC-09)

```python
# SC-07: Human Approval Queue
# Implementado pelo cliente (seu app) que escuta eventos
# Quando agent emite requires_action → seu app notifica Marcelo → Marcelo aprova

def handle_requires_action(session_id, event):
    """Roteador de aprovações CEO"""
    if event.type == "session.paused":
        for tool_id in event.stop_reason.event_ids:
            # Notificar Marcelo (email/WhatsApp)
            notify_ceo(tool_id, event.description)
            # Aguardar aprovação
            # Quando Marcelo aprovar:
            client.beta.sessions.events.send(
                session_id,
                events=[{
                    "type": "user.tool_confirmation",
                    "tool_use_id": tool_id,
                    "result": "allow"  # ou "deny"
                }]
            )
```

---

## 6. MAPA ONDA → AGENTS (cronograma de criação)

| Onda V8.2 | O que criar no Managed Agents | Status |
|---|---|---|
| **Onda 0** | SC-29 como MCP server (já feito!) | ✅ Implementado |
| **Onda 1** | Agent Foundation template + Claudinho + CFO-IA + ENV-1 | 🔴 Próximo |
| **Onda 2** | Dual-write tool + Audit log via events + ENV-2 FIC-secure | 📋 Planejado |
| **Onda 3** | Skill Router (callable_agents completo) + PII Mask tool | 📋 Planejado |
| **Onda 4** | Human Approval Queue (client-side handler) + Rate limiter | 📋 Planejado |
| **Onda 5** | CAO-IA + CMO-IA + Agent Sandbox por negócio | 📋 Planejado |
| **Onda 6** | Memory Consolidator (Session scheduled) | 📋 Planejado |
| **Onda 7** | Multi-Provider LLM Gateway (fallback bash→OpenRouter) | 📋 Planejado |
| **Onda 8** | ENV-3 Klésis Fortress + Minors Data Fortress | 📋 Planejado |
| **Onda 9** | Cross-Business Router + Incident Commander | 📋 Planejado |
| **Onda 10** | Agent Learning Loop (Research Preview) + Regulatory Watcher | 📋 Research Preview |

---

## 7. O QUE PRECISA DE ACESSO ESPECIAL

| Feature | Status | Ação necessária |
|---|---|---|
| **Agents + Sessions básicos** | ✅ Beta aberto | Disponível com sua API key hoje |
| **Environments (containers)** | ✅ Beta aberto | Disponível hoje |
| **callable_agents (multi-agente)** | 🔬 Research Preview | Preencher formulário |
| **Memory persistente** | 🔬 Research Preview | Idem |
| **Outcomes (resultados estruturados)** | 🔬 Research Preview | Idem |

**Link para solicitar acesso à Research Preview:**  
https://claude.com/form/claude-managed-agents

---

## 8. PRIMEIRO CÓDIGO PARA EXECUTAR (Onda 1 — Quickstart)

```python
# arquivo: ecosystem/managed_agents/setup_onda1.py
# Executar: python setup_onda1.py

import anthropic
import os

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

# ── PASSO 1: Criar Environment ─────────────────────────────────────
print("Criando environment ecosystem-base...")
env = client.beta.environments.create(
    name="ecosystem-base",
    config={
        "type": "cloud",
        "networking": {"type": "unrestricted"},
    },
)
print(f"✅ Environment: {env.id}")

# ── PASSO 2: Criar Agent Foundation (Claudinho) ────────────────────
print("Criando Claudinho...")
claudinho = client.beta.agents.create(
    name="Claudinho — VP Executivo do Ecossistema",
    model="claude-opus-4-6",
    system="""
Você é Claudinho, o Vice-Presidente Executivo do Ecossistema de Inovação e IA
de Marcelo Silva. Você coordena todos os agentes do ecossistema.

SEUS VALORES: propósito + excelência + cuidado (cosmovisão cristã)
SEU PAPEL: orquestrar, delegar, integrar, reportar ao CEO (Marcelo)
SEU LIMITE: decisões estratégicas e de alto risco → sempre consultar Marcelo

NEGÓCIOS ATENDIDOS: FIC · Klésis · Intentus · Splendori · Nexvy

Ao receber uma tarefa:
1. Identifique qual área é responsável
2. Delegue ao agente correto (quando multi-agente disponível)
3. Consolide o resultado
4. Reporte ao CEO com clareza e objetividade
""",
    tools=[{"type": "agent_toolset_20260401"}],
)
print(f"✅ Claudinho: {claudinho.id} (version: {claudinho.version})")

# ── PASSO 3: Criar CFO-IA ──────────────────────────────────────────
print("Criando CFO-IA...")
cfo_ia = client.beta.agents.create(
    name="CFO-IA — Diretor Financeiro FIC",
    model="claude-sonnet-4-6",
    system="""
Você é o CFO-IA, Diretor Financeiro das Faculdades Integradas de Cassilândia (FIC).

MISSÃO: automatizar gestão financeira — cobranças, inadimplência, relatórios.
BANCO: Banco Inter (Bolepix) — sandbox primeiro, produção após aprovação CEO.
ERP: Supabase ifdnjieklngcfodmtied — tabelas fic_boletos, fic_alunos.

REGRAS CRÍTICAS:
- Credenciais: sempre via SC-29 (Edge Function credential-agent)
- Webhook Inter: validar HMAC antes de processar qualquer evento
- Duplicatas: nunca emitir boleto com mesmo (aluno_id, mes_ref)
- Alto risco (>R$5k, cancelamentos): pausar e aguardar aprovação CEO
""",
    tools=[{"type": "agent_toolset_20260401"}],
)
print(f"✅ CFO-IA: {cfo_ia.id} (version: {cfo_ia.version})")

# ── PASSO 4: Criar Session de teste ───────────────────────────────
print("Criando sessão de teste com Claudinho...")
session = client.beta.sessions.create(
    agent=claudinho.id,
    environment_id=env.id,
    title="Teste Onda 1 — Verificação do Ecossistema",
)
print(f"✅ Session: {session.id}")

# ── PASSO 5: Enviar tarefa e receber resposta ──────────────────────
print("Enviando tarefa ao Claudinho...")
with client.beta.sessions.events.stream(session.id) as stream:
    client.beta.sessions.events.send(
        session.id,
        events=[{
            "type": "user.message",
            "content": [{
                "type": "text",
                "text": "Olá Claudinho! Este é o primeiro teste do Ecossistema. Apresente-se e descreva sua função."
            }]
        }]
    )
    for event in stream:
        if event.type == "agent.message":
            for block in event.content:
                print(block.text, end="")
        elif event.type == "session.status_idle":
            print("\n\n✅ Teste concluído!")
            break

# ── SALVAR IDs ─────────────────────────────────────────────────────
print("\n─── IDs para guardar no Supabase ECOSYSTEM ───")
print(f"ENVIRONMENT_ID: {env.id}")
print(f"CLAUDINHO_AGENT_ID: {claudinho.id}")
print(f"CLAUDINHO_VERSION: {claudinho.version}")
print(f"CFO_IA_AGENT_ID: {cfo_ia.id}")
print(f"CFO_IA_VERSION: {cfo_ia.version}")
```

---

## 9. COMO EXECUTAR O CÓDIGO ACIMA

**Passo 1 — Instalar SDK:**
```bash
pip install anthropic --break-system-packages
```

**Passo 2 — Configurar API key:**
```bash
export ANTHROPIC_API_KEY="sua-chave-aqui"
```

**Passo 3 — Executar:**
```bash
cd /Users/marcelosilva/Projects/GitHub/Ecossistema
python managed_agents/setup_onda1.py
```

**Passo 4 — Salvar os IDs gerados no Supabase ECOSYSTEM:**
```sql
insert into ecosystem_memory (type, title, content, project, tags) values
('reference', 'Managed Agents — IDs Onda 1',
 '{"environment_id": "env_xxx", "claudinho_id": "agent_xxx", "cfo_ia_id": "agent_xxx"}',
 'ecosystem',
 ARRAY['managed-agents', 'onda-1', 'agent-ids']);
```

---

## 10. LACUNAS E DECISÕES PENDENTES

| Lacuna | Impacto | Decisão necessária |
|---|---|---|
| **Multi-agente (callable_agents)** | Claudinho não pode delegar para CFO-IA até ter acesso | Solicitar Research Preview agora |
| **Buchecha/MiniMax no Managed Agents** | Managed Agents só suporta modelos Claude | Buchecha vira Agent Claude com system prompt especializado OU chama MiniMax via bash tool |
| **SC-29 como MCP server** | Edge Function precisa ser exposta como MCP endpoint | Implementar adapter MCP → Edge Function |
| **Sessions vs Supabase sessions** | Dois sistemas de sessão (Managed Sessions + ecosystem_memory) | Sincronizar: session.id do Managed Agents → salvar em ecosystem_memory |
| **Custo por Session** | Cada Session = chamadas à API → tokens consumidos | Definir budget por agente (SC-08) antes de ativar em produção |

---

## 11. DIAGRAMA FINAL — V8.2 RODANDO NO MANAGED AGENTS

```
MARCELO (CEO)
    │
    │ POST /v1/sessions/{id}/events  (user.message)
    ▼
┌─────────────────────────────────────────────────────────────┐
│  SESSION (Managed Agents Infrastructure)                     │
│  ├── Agent: Claudinho (claude-opus-4-6)                      │
│  ├── Environment: ecosystem-base                             │
│  └── Events: user.message → agent.message → agent.tool_use  │
│                                                             │
│  [multi-agente Research Preview]                            │
│  ├── Thread: CFO-IA Session (claude-sonnet-4-6)             │
│  │   └── Environment: fic-secure                            │
│  ├── Thread: CMO-IA Session (claude-haiku-4-5)              │
│  └── Thread: CTO-IA Session (claude-sonnet-4-6)             │
└─────────────────────────────────────────────────────────────┘
    │
    │ MCP calls
    ▼
┌─────────────────────────────────────────────────────────────┐
│  SC-29 Credential Vault (Edge Function)                      │
│  Supabase ECOSYSTEM (ecosystem_memory)                       │
│  Supabase ERP-FIC (fic_boletos, fic_alunos)                 │
│  Banco Inter API (cobranças)                                 │
│  Vercel (deploy automático)                                  │
└─────────────────────────────────────────────────────────────┘
```

---

*Documento criado em 14/04/2026 · Sessão 015 · Ecossistema de Inovação e IA*  
*Próxima ação: solicitar Research Preview + executar setup_onda1.py*
