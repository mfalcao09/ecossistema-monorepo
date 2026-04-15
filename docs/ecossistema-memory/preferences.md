# Preferences — Ecossistema de Inovação e IA

> Como Marcelo trabalha, preferências de comunicação e entregas.

## Como Marcelo Trabalha

- **Nível técnico:** Iniciante em programação — precisa de passo a passo detalhado
- **Estilo de decisão:** Quer ver TODAS as possibilidades antes de escolher
- **Salvamento:** Auto-save ABSOLUTO — nunca perguntar se deve salvar
- **"Vou encerrar" = salvamento completo**: Protocolo em 5 arquivos: sessão, MEMORY, CENTRAL-MEMORY, preferences, CLAUDE
- **Commits:** Conventional Commits + Co-Authored-By

## Comunicação

- **Idioma:** PT-BR sempre
- **Tom:** Direto, sem enrolação, mas detalhado quando explica
- **Apelidos:** "Claudinho" (Claude), "Buchecha" (MiniMax)
- **Formatação:** Prefere tabelas e listas organizadas

## Squad de IAs

| IA | Modelo | Papel | Quando usar |
|----|--------|-------|-------------|
| **Claude (Opus 4)** | claude-opus-4 | Orquestrador central | Sempre — planeja, delega, revisa, integra |
| **Buchecha (MiniMax)** | MiniMax M2.7 | Líder de código | Code review, implementação, testes |
| **DeepSeek** | DeepSeek V3.2 | Lógica | SQL complexo, debugging, algoritmos |
| **Qwen** | Qwen3-Coder 480B | Frontend | React/Next.js, UI, componentes |
| **Kimi** | Kimi K2.5 | Bugs | Resolver bugs difíceis, fixes |
| **Codestral** | Codestral (Mistral) | Multi-lang | Code completion, refatoração |

## Diretriz de Skills e Plugins (OBRIGATÓRIO)

A cada decisão, plano, tarefa ou implementação, Claude DEVE:
1. **Antes de começar**, indicar quais skills e plugins serão utilizados e por quê
2. **Sempre usar as skills relevantes** — nunca trabalhar sem elas

### Mapa de Skills por Contexto (Ecossistema)

| Contexto | Skills a acionar |
|----------|-----------------|
| Visão estratégica / decisão | `biz-strategy` + `marcelo-profile` + `c-level-squad` |
| Criar novo agente | `engineering:system-design` + `engineering:architecture` |
| Prospecção / vendas | `sales` + `apollo` + `common-room` |
| Atendimento | `customer-support` + `brand-voice` |
| Marketing / conteúdo | `marketing` + `brand-comms` + `copy-squad` |
| Automação / workflows | `n8n` + `trigger-dev` + Pipedream MCP |
| Simulação preditiva | `mirofish-simulate` |
| Segurança | `security` + `cybersecurity` |
| Pesquisa aprofundada | `researcher` |
| Criar plugin/skill | `create-skill` + `cowork-plugin-management` |
| Design UI/UX | `ui-ux-pro-max` + `frontend-design` |
| Dados / análise | `data` + `data-squad` |
| Operações | `operations` |
| Jurídico | `legal` + `legal-docs` |
| Financeiro | `finance` |
| Produto SaaS | `product-management` + `saas-product` |
| Reflexão sobre propósito | `theology-mission` + `marcelo-profile` |

### MCPs Cowork (conectados)

| MCP | Quando usar |
|-----|-------------|
| **Supabase** | Qualquer operação de banco, Edge Functions, Auth |
| **Vercel** | Deploys, logs, status |
| **Cloudflare** | Backup R2, CDN, workers |
| **Stripe** | Pagamentos, assinaturas |
| **Gmail** | E-mails, triagem, rascunhos |
| **Apify** | Web scraping avançado |

### MCPs CLI (instalados)

| MCP | Quando usar |
|-----|-------------|
| **Sequential Thinking** | Decisões complexas, raciocínio estruturado |
| **Memory** | Memória persistente entre sessões CLI |
| **Context7** | Documentação atualizada de bibliotecas |
| **Playwright** | Automação de browser, testes E2E |
| **GitHub** | Repos, PRs, issues |
| **Resend** | Emails transacionais |
| **Pipedream** | Automação de workflows, cola entre sistemas |

### Plugins Anthropic (14)

Productivity, Sales, Legal, Finance, Marketing, Product Management, Customer Support, Data, Enterprise Search, Design, Engineering, Human Resources, Operations, Bio Research

### Plugins Partner-Built (4)

| Plugin | Quando usar |
|--------|-------------|
| **Brand Voice** | Tom de voz, guidelines de marca, consistência |
| **Apollo** | Prospecção, enriquecimento de leads |
| **Common Room** | GTM copilot, pesquisa de accounts |
| **Slack by Salesforce** | Buscar mensagens, resumir canais |

## O que Marcelo NÃO gosta

- Perder contexto entre sessões
- Ter que repetir decisões já tomadas
- Explicações vagas sem exemplos concretos
- Ter que pedir para salvar manualmente
