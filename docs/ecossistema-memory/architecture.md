# Architecture — Ecossistema de Inovação e IA

> Decisões de arquitetura, padrões e regras técnicas do ecossistema.

## Arquitetura de Agentes (3 Camadas)

### Camada 1 — Agentes de Negócio
Voltados ao cliente e mercado. Prospectam, qualificam, atendem, vendem e retêm.

| Agente | Ferramentas | Status |
|--------|------------|--------|
| Vendas | Sales, Apollo, Common Room, Stripe | Ferramentas prontas — agente a criar |
| Atendimento | Customer Support, Gmail, Slack, Resend, Brand Voice | Ferramentas prontas — agente a criar |
| Marketing | Marketing, Brand Voice, Copy Squad, Traffic Masters | Ferramentas prontas — agente a criar |
| Qualificação | Apollo (enrich), Common Room (research), Data | Ferramentas prontas — agente a criar |
| Jurídico | Legal, Legal-docs skill | Ferramentas prontas |
| Financeiro | Finance, Stripe | Ferramentas prontas |

### Camada 2 — Agentes de Desenvolvimento
Voltados ao produto. Desenvolvem, testam, revisam e deployam.

| Agente | Ferramentas | Status |
|--------|------------|--------|
| Dev | Engineering, MiniMax, DeepSeek, Qwen, Kimi, Codestral, GitHub | Ativo — Squad de IAs |
| QA | Playwright, Kimi, Engineering (testing-strategy) | Ferramentas prontas |
| Deploy | Vercel, Supabase, Engineering (deploy-checklist) | Ferramentas prontas |
| Produto | Product Management, Saas-product skill | Ferramentas prontas |

### Camada 3 — Agentes de Infraestrutura
Voltados à operação. Monitoram, escalam, fazem backup, automatizam.

| Agente | Ferramentas | Status |
|--------|------------|--------|
| Banco de Dados | Supabase MCP, Data plugin | Ativo |
| Monitoramento | Sentry (pendente), PostHog (pendente) | Pendente |
| Backup | Cloudflare R2 | Ativo |
| Automação | Pipedream, Zapier (pendente), N8N, Trigger.dev | Parcial |
| Memória | Memory MCP, Sequential Thinking, Enterprise Search | Ativo |
| Contexto | Context7, Notion (pendente) | Parcial |

## Fluxos Desenhados

### Prospecção → Venda
Apollo (prospecção) → Common Room (research) → Sales (call prep) → Brand Voice (tom) → Gmail/Resend (envio) → Stripe (pagamento) → Customer Support (pós-venda)

### Atendimento → Qualificação
Gmail (entrada) → Customer Support (triagem) → Enterprise Search (contexto) → Sequential Thinking (decisão) → Brand Voice (resposta) → Gmail/Slack (envio) → Memory (histórico)

### Desenvolvimento
Product Management (spec) → GitHub (issue) → Squad IAs (implementação) → Playwright (testes) → Vercel (deploy) → Sentry (monitoramento)

### Marketing
Marketing (estratégia) → Brand Voice (guidelines) → Copy Squad (redação) → Traffic Masters (distribuição) → PostHog (métricas) → Data (análise)

### Decisão Estratégica
Enterprise Search (dados) → Data (análise) → Sequential Thinking (raciocínio) → Advisory Board (conselho) → MiroFish (simulação) → Marcelo (decisão)

## Regras Técnicas

- **Sandbox obrigatório** para Stripe MCP (operações financeiras reais)
- **Sandbox recomendado** para Resend, Pipedream, Zapier (ações irreversíveis)
- **Playwright** consome ~114k tokens/chamada — usar com moderação
- **Máximo 3-5 MCPs ativos** por sessão para controlar tokens
- **Memory MCP** para persistência entre sessões CLI
- **CENTRAL-MEMORY.md** para persistência cross-project

## Decisões de Arquitetura

| Data | Decisão | Justificativa |
|------|---------|---------------|
| 05/04/2026 | 3 camadas de agentes | Separação clara: negócio, dev, infra |
| 05/04/2026 | Claude Opus 4 como orquestrador | Mais capaz para planejamento e delegação |
| 05/04/2026 | Ferramentas oficiais prioritárias | 66% dos MCPs escaneados têm falhas de segurança |
| 05/04/2026 | Pipedream como cola de automação | Conecta todos os sistemas sem código |
| 05/04/2026 | Memória em 3 níveis | Arquivo local + Memory MCP + CENTRAL-MEMORY cross-project |
