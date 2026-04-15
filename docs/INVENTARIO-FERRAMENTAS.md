# INVENTÁRIO DE FERRAMENTAS — Ecossistema de IA do Marcelo

> **O que é:** Fonte única da verdade de todas as skills, plugins, MCPs e IAs disponíveis no ecossistema.
> **Localização:** `/Users/marcelosilva/Projects/GitHub/INVENTARIO-FERRAMENTAS.md`
> **Última atualização:** 2026-04-12
> **Responsável por manter:** Claude (automático a cada ferramenta adicionada)

---

## 🔄 PROTOCOLO DE ATUALIZAÇÃO (OBRIGATÓRIO)

> Toda vez que uma nova skill, plugin, MCP ou IA for criada ou instalada:
> 1. Adicione na tabela da área correspondente abaixo
> 2. Atualize os contadores do cabeçalho
> 3. Atualize "Última atualização"
> 4. Commit: `docs: update inventario — adiciona [nome da ferramenta]`

---

## 📦 RESUMO GERAL

| Categoria | Qtd | Status |
|-----------|-----|--------|
| Skills CLI (LeadGenMan) | 35 | ✅ Ativo |
| Skills Cowork — Plugins Anthropic | 104 | ✅ Ativo |
| Skills Cowork — Plugins Partner | 27 | ✅ Ativo |
| Skills Cowork — TimexQuads | 23 | ✅ Ativo |
| Skills Cowork — UI/UX Pro Max | 7 | ✅ Ativo |
| Skills Cowork — MiroFish | 3 | ✅ Ativo |
| Skills Cowork — Produtividade/Sistema | 16 | ✅ Ativo |
| Skills Customizadas (Marcelo) | 12 | ✅ Ativo |
| IAs do Squad | 5 + Claude | ✅ Ativo |
| MCPs Cowork (conectados) | 6 | ✅ Ativo |
| MCPs CLI (instalados) | 9 | ✅ Ativo |
| MCPs Pendentes | 3 | ⏳ Pendente |
| **TOTAL FERRAMENTAS** | **~250+** | |

---

## 📢 MARKETING

### Skills CLI — LeadGenMan (instaladas em `~/.claude/skills/`)
> Acionamento: `claude /nome-da-skill "contexto"`

#### SEO & Descoberta
| Skill | Comando | Descrição |
|-------|---------|-----------|
| seo-audit | `/seo-audit` | Auditoria técnica completa de SEO — Core Web Vitals, meta tags, keyword gaps |
| ai-seo | `/ai-seo` | SEO otimizado para AI search (Google SGE, Perplexity, Bing AI) |
| programmatic-seo | `/programmatic-seo` | Geração de páginas SEO em escala programática |
| site-architecture | `/site-architecture` | Estrutura de site otimizada para SEO e UX |
| schema-markup | `/schema-markup` | Dados estruturados Schema.org para rich snippets |
| competitor-alternatives | `/competitor-alternatives` | Páginas de alternativas a concorrentes para capturar tráfego |

#### Conteúdo & Copy
| Skill | Comando | Descrição |
|-------|---------|-----------|
| copywriting | `/copywriting` | Copy de alta conversão para landing pages — 3 variações A/B |
| copy-editing | `/copy-editing` | Revisão e polimento de textos para máxima clareza |
| cold-email | `/cold-email` | Sequências de cold email personalizadas e persuasivas |
| email-sequence | `/email-sequence` | Fluxos de email automatizados (onboarding, nurture, reativação) |
| social-content | `/social-content` | Conteúdo otimizado para cada plataforma social |
| content-strategy | `/content-strategy` | Clusters de conteúdo e calendário editorial |
| community-marketing | `/community-marketing` | Estratégia de crescimento via comunidades |

#### CRO — Otimização de Conversão
| Skill | Comando | Descrição |
|-------|---------|-----------|
| page-cro | `/page-cro` | Auditoria completa de conversão em páginas |
| signup-flow-cro | `/signup-flow-cro` | Otimização do fluxo de cadastro/registro |
| onboarding-cro | `/onboarding-cro` | Melhoria do processo de onboarding de usuários |
| form-cro | `/form-cro` | Otimização de formulários para reduzir abandono |
| popup-cro | `/popup-cro` | Otimização de popups e overlays |
| paywall-upgrade-cro | `/paywall-upgrade-cro` | Conversão de plano gratuito para pago |

#### Tráfego Pago
| Skill | Comando | Descrição |
|-------|---------|-----------|
| paid-ads | `/paid-ads` | Estratégia e gestão de anúncios pagos (Google, Meta, LinkedIn) |
| ad-creative | `/ad-creative` | Criação de criativos e copy para anúncios |

#### Growth & Retenção
| Skill | Comando | Descrição |
|-------|---------|-----------|
| free-tool-strategy | `/free-tool-strategy` | Estratégia de ferramenta gratuita como isca de lead |
| referral-program | `/referral-program` | Design e implementação de programa de indicação |
| lead-magnets | `/lead-magnets` | Criação de iscas digitais de alto valor percebido |
| churn-prevention | `/churn-prevention` | Estratégias para reduzir cancelamento e aumentar retenção |
| launch-strategy | `/launch-strategy` | Estratégia completa de lançamento de produto/feature |

#### Estratégia de Marketing
| Skill | Comando | Descrição |
|-------|---------|-----------|
| marketing-ideas | `/marketing-ideas` | Geração de ideias criativas de marketing |
| marketing-psychology | `/marketing-psychology` | Psicologia do consumidor aplicada ao marketing |
| pricing-strategy | `/pricing-strategy` | Estratégia de precificação e posicionamento de preço |
| product-marketing-context | `/product-marketing-context` | Contexto de produto para campanhas de marketing |

#### Medição & Testes
| Skill | Comando | Descrição |
|-------|---------|-----------|
| analytics-tracking | `/analytics-tracking` | Setup e auditoria de rastreamento de eventos |
| ab-test-setup | `/ab-test-setup` | Configuração e estruturação de testes A/B |

#### Vendas (LeadGenMan)
| Skill | Comando | Descrição |
|-------|---------|-----------|
| revops | `/revops` | Operações de receita — funil completo de vendas |
| sales-enablement | `/sales-enablement` | Materiais e processos de capacitação de vendas |
| customer-research | `/customer-research` | Pesquisa aprofundada sobre clientes e personas |

---

### Skills Cowork — Plugin Marketing (Anthropic)
> Acionamento: via Skill tool com `marketing:nome`

| Skill | ID | Descrição |
|-------|----|-----------|
| Auditoria de SEO | `marketing:seo-audit` | Análise SEO completa de sites |
| Campanha | `marketing:campaign-plan` | Plano completo de campanha com calendário |
| Criação de Conteúdo | `marketing:content-creation` | Geração de conteúdo multi-canal |
| Rascunho de Conteúdo | `marketing:draft-content` | Drafts rápidos por canal e audiência |
| Sequência de Email | `marketing:email-sequence` | Fluxos de email com A/B e lógica de ramificação |
| Análise de Competidores | `marketing:competitive-brief` | Posicionamento vs concorrentes |
| Revisão de Marca | `marketing:brand-review` | Checagem de aderência à voz de marca |
| Relatório de Performance | `marketing:performance-report` | KPIs, tendências e recomendações |

---

### Skills Cowork — Brand Voice (Partner)
> Acionamento: via Skill tool com `brand-voice:nome`

| Skill | ID | Descrição |
|-------|----|-----------|
| Aplicar Voz de Marca | `brand-voice:brand-voice-enforcement` | Aplica diretrizes de marca ao conteúdo |
| Gerar Diretrizes | `brand-voice:guideline-generation` | Cria guia de voz e tom a partir de materiais |
| Descobrir Materiais | `brand-voice:discover-brand` | Busca materiais de marca em plataformas conectadas |

---

### Skills Cowork — TimexQuads (Marketing)
> Acionamento: via Skill tool com `timexquads-nome:nome`

| Skill | ID | Descrição |
|-------|----|-----------|
| Copy Squad | `timexquads-copy-squad:copy-squad` | Copywriting de alta conversão — especialista |
| Traffic Masters | `timexquads-traffic-masters:traffic-masters` | Tráfego pago e orgânico — especialista |
| Brand Squad | `timexquads-brand-squad:brand-squad` | Identidade e consistência de marca |
| Hormozi Squad | `timexquads-hormozi-squad:hormozi-squad` | Monetização e escala (método Alex Hormozi) |
| Storytelling | `timexquads-storytelling:storytelling` | Narrativas persuasivas para vendas e marca |
| Movement | `timexquads-movement:movement` | Estratégia de movimento e posicionamento de marca |

---

### Skills Customizadas — Instagram & Vendas (Marcelo)
> Acionamento: via Skill tool pelo nome | Arquivos: `Ecossistema/skills-instagram/`

| Skill | ID | Descrição |
|-------|----|-----------|
| Lead Miner | `lead-miner` | Coleta, organização e qualificação de leads — formulários, score, separação quente/frio |
| Sales Strategist | `sales-strategist` | Estrutura oferta, posicionamento, argumentos, quebra de objeções e plano de ação comercial |
| Trend Hunter | `trend-hunter` | Encontra temas com alto potencial de atenção para posts, Reels e carrosseis no Instagram |
| True Copywriter | `true-copywriter` | Escrita persuasiva — headlines, copy que converte, CTAs, eliminação de texto robótico |

---

### Skills Cowork — MiroFish (Simulação Preditiva)
> Acionamento: via Skill tool com `mirao-mirofish-ia:nome`

| Skill | ID | Descrição |
|-------|----|-----------|
| Simular | `mirao-mirofish-ia:mirofish-simulate` | Simulação multi-agente de reação do mercado/público |
| Chat com Agentes | `mirao-mirofish-ia:mirofish-chat` | Entrevistar agentes simulados |
| Relatório | `mirao-mirofish-ia:mirofish-report` | Relatório preditivo da simulação |

---

## 💼 COMERCIAL & VENDAS

### Skills Cowork — Plugin Sales (Anthropic)
> Acionamento: via Skill tool com `sales:nome`

| Skill | ID | Descrição |
|-------|----|-----------|
| Previsão de Vendas | `sales:forecast` | Forecast com cenários best/likely/worst |
| Inteligência Competitiva | `sales:competitive-intelligence` | Battlecard interativo de concorrentes |
| Resumo de Call | `sales:call-summary` | Extrair ações e redigir follow-up pós-reunião |
| Pesquisa de Conta | `sales:account-research` | Intel completo de empresa/contato |
| Briefing Diário | `sales:daily-briefing` | Preparação do dia com prioridades de pipeline |
| Prep de Call | `sales:call-prep` | Contexto e agenda para reunião com prospect |
| Criar Material | `sales:create-an-asset` | Landing pages, decks e one-pagers personalizados |
| Revisão de Pipeline | `sales:pipeline-review` | Saúde do pipeline — riscos, focos e plano semanal |
| Redigir Outreach | `sales:draft-outreach` | Email/mensagem personalizada de prospecção |

---

### Skills Cowork — Apollo (Partner)
> Acionamento: via Skill tool com `apollo:nome`

| Skill | ID | Descrição |
|-------|----|-----------|
| Enriquecer Lead | `apollo:enrich-lead` | Enriquecimento completo de contato (email, cargo, empresa) |
| Prospectar | `apollo:prospect` | Pipeline ICP → leads com emails e telefones |
| Carregar Sequência | `apollo:sequence-load` | Bulk-add de leads em sequência de outreach |

---

### Skills Cowork — Common Room (Partner)
> Acionamento: via Skill tool com `common-room:nome`

| Skill | ID | Descrição |
|-------|----|-----------|
| Pesquisa de Conta | `common-room:account-research` | Dados e sinais de empresa via Common Room |
| Prep de Call | `common-room:call-prep` | Briefing para reunião com sinais de produto |
| Redigir Outreach | `common-room:compose-outreach` | Mensagem personalizada com sinais do Common Room |
| Pesquisa de Contato | `common-room:contact-research` | Perfil detalhado de pessoa específica |
| Prospectar | `common-room:prospect` | Listas de contas/contatos por critérios ICP |
| Briefing Semanal | `common-room:weekly-prep-brief` | Prep de todos os calls da semana |
| Plano de Conta | `common-room:generate-account-plan` | Plano estratégico para conta enterprise |
| Resumo Semanal | `common-room:weekly-brief` | Visão geral da semana via calendário + Common Room |

---

### Skills Cowork — Slack (Partner)
> Acionamento: via Skill tool com `slack-by-salesforce:nome`

| Skill | ID | Descrição |
|-------|----|-----------|
| Busca no Slack | `slack-by-salesforce:slack-search` | Busca avançada de mensagens e arquivos |
| Mensagem no Slack | `slack-by-salesforce:slack-messaging` | Composição de mensagens formatadas em mrkdwn |
| Digest de Canal | `slack-by-salesforce:channel-digest` | Resumo de atividade recente em canais |
| Anúncio | `slack-by-salesforce:draft-announcement` | Rascunho de anúncio formatado |
| Encontrar Discussões | `slack-by-salesforce:find-discussions` | Discussões sobre tópico específico |
| Standup | `slack-by-salesforce:standup` | Update de standup baseado em atividade recente |
| Resumir Canal | `slack-by-salesforce:summarize-channel` | Resumo de canal por período |

---

## ⚖️ JURÍDICO

### Skills Cowork — Plugin Legal (Anthropic)
> Acionamento: via Skill tool com `legal:nome`

| Skill | ID | Descrição |
|-------|----|-----------|
| Briefing | `legal:brief` | Resumo diário jurídico — email, calendário, contratos |
| Verificação de Fornecedor | `legal:vendor-check` | Status de acordos e expiração de contratos |
| Revisão de Contrato | `legal:review-contract` | Análise contra playbook — redlines e impacto |
| Resposta Jurídica | `legal:legal-response` | Resposta a consultas jurídicas com templates |
| Checagem de Compliance | `legal:compliance-check` | Regulações aplicáveis e aprovações necessárias |
| Solicitação de Assinatura | `legal:signature-request` | Checklist pré-assinatura e envio para execução |
| Triagem de NDA | `legal:triage-nda` | Classificação rápida GREEN/YELLOW/RED de NDAs |
| Briefing de Reunião | `legal:meeting-briefing` | Preparação para reuniões com implicação jurídica |
| Avaliação de Risco | `legal:legal-risk-assessment` | Classificação de riscos por severidade×probabilidade |

---

### Skills Customizadas — Jurídico
| Skill | ID | Descrição |
|-------|----|-----------|
| Documentos Jurídicos | `legal-docs` | Minutas, contratos, atos societários, notificações — advocacia empresarial/imobiliária |

---

## 🏗️ ENGENHARIA & DESENVOLVIMENTO

### Skills Cowork — Plugin Engineering (Anthropic)
> Acionamento: via Skill tool com `engineering:nome`

| Skill | ID | Descrição |
|-------|----|-----------|
| Debug | `engineering:debug` | Sessão estruturada de debugging — reproduzir, isolar, corrigir |
| Design de Sistema | `engineering:system-design` | Arquitetura de sistemas e APIs |
| Checklist de Deploy | `engineering:deploy-checklist` | Verificação pré-deploy com rollback plan |
| Estratégia de Testes | `engineering:testing-strategy` | Plano e estratégia de cobertura de testes |
| Arquitetura (ADR) | `engineering:architecture` | Architecture Decision Record — escolhas com trade-offs |
| Standup | `engineering:standup` | Update de standup de commits e PRs recentes |
| Dívida Técnica | `engineering:tech-debt` | Identificação e priorização de tech debt |
| Code Review | `engineering:code-review` | Review de segurança, performance e correção |
| Resposta a Incidente | `engineering:incident-response` | Triagem, comunicação e postmortem |
| Documentação | `engineering:documentation` | README, runbooks, docs técnicas |

---

### Squad de IAs — Desenvolvimento
> Acionamento: via Skill tool com `ia-nome:nome`

| IA | Modelo | Skills Disponíveis | Papel |
|----|--------|--------------------|-------|
| **MiniMax (Buchecha)** | M2.7 | pair-programming, review, debug, test | Líder de código — review obrigatório |
| **DeepSeek** | V3.2 | pair-programming, review, debug, test | Lógica complexa, SQL, algoritmos |
| **Qwen** | Qwen3-Coder 480B | pair-programming, review, debug, test, alternative, explain | Frontend — React, Next.js, UI |
| **Kimi** | K2.5 | pair-programming, review, debug, test | Bugs difíceis em codebases grandes |
| **Codestral** | Mistral | pair-programming, review, debug, test, alternative, explain | Multi-linguagem, refatoração |

---

### Skills Cowork — TimexQuads (Engenharia)
| Skill | ID | Descrição |
|-------|----|-----------|
| Code Mastery | `timexquads-code-mastery:code-mastery` | Configuração avançada do Claude Code |
| Escalabilidade | `timexquads-scalability:scalability` | Estratégias de escalabilidade de sistemas |
| Segurança | `timexquads-security:security` | Auditoria de segurança de aplicações |
| Cybersecurity | `timexquads-cybersecurity:cybersecurity` | Segurança ofensiva e defensiva |
| Self-Healing | `timexquads-self-healing:self-healing` | Auto-melhoria e aprendizado com erros |
| N8N | `timexquads-n8n:n8n` | Criação de workflows com n8n |
| Trigger.dev | `timexquads-trigger-dev:trigger-dev` | Background jobs e scheduled tasks |
| Frontend Design | `timexquads-frontend-design:frontend-design` | Design visual de interfaces |

---

### MCPs — Engenharia (CLI)
| MCP | Instalação | Função |
|-----|-----------|--------|
| GitHub | `claude mcp add github` | Gestão de repos, PRs, issues, code review |
| Playwright | `claude mcp add playwright` | Automação de browser, testes E2E |
| Context7 | `claude mcp add context7` | Documentação atualizada de libs (Next.js, React, Supabase) |
| Sequential Thinking | `claude mcp add sequential-thinking` | Raciocínio estruturado passo-a-passo |

---

## 📊 DADOS & BUSINESS INTELLIGENCE

### Skills Cowork — Plugin Data (Anthropic)
> Acionamento: via Skill tool com `data:nome`

| Skill | ID | Descrição |
|-------|----|-----------|
| Analisar | `data:analyze` | Responder perguntas de dados — do lookup à análise completa |
| Estatística | `data:statistical-analysis` | Estatística descritiva, tendências, outliers, hipóteses |
| Visualização | `data:create-viz` | Gráficos com Python (matplotlib, seaborn, plotly) |
| Explorar Dados | `data:explore-data` | Profiling de dataset — shape, qualidade, padrões |
| Visualização Avançada | `data:data-visualization` | Charts com design e acessibilidade |
| Dashboard | `data:build-dashboard` | Dashboard HTML interativo com filtros e KPIs |
| SQL | `data:sql-queries` | SQL otimizado para Snowflake, BigQuery, PostgreSQL |
| Contexto de Dados | `data:data-context-extractor` | Gera skill de contexto de dados específico da empresa |
| Validar Análise | `data:validate-data` | QA de análise antes de apresentar — metodologia e bias |
| Escrever Query | `data:write-query` | Query SQL em linguagem natural, dialect-specific |

---

### Skills Cowork — TimexQuads (Dados)
| Skill | ID | Descrição |
|-------|----|-----------|
| Data Squad | `timexquads-data-squad:data-squad` | Análise de dados avançada — especialista |
| Researcher | `timexquads-researcher:researcher` | Pesquisa aprofundada com múltiplas fontes |

---

### MCPs — Dados
| MCP | Origem | Função |
|-----|--------|--------|
| Supabase | Cowork | Banco de dados, Edge Functions, Auth |
| Apify | Cowork | Web scraping e coleta de dados estruturados |

---

## 🎨 DESIGN & UX

### Skills Cowork — Plugin Design (Anthropic)
> Acionamento: via Skill tool com `design:nome`

| Skill | ID | Descrição |
|-------|----|-----------|
| Design System | `design:design-system` | Auditoria, documentação e extensão de design systems |
| Acessibilidade | `design:accessibility-review` | Auditoria WCAG 2.1 AA |
| Critique de Design | `design:design-critique` | Feedback em usabilidade, hierarquia e consistência |
| Handoff | `design:design-handoff` | Spec para devs — tokens, props, breakpoints, animações |
| UX Copy | `design:ux-copy` | Microcopy, erros, CTAs, empty states |
| Síntese de Pesquisa | `design:research-synthesis` | Síntese de entrevistas e surveys em insights acionáveis |
| Pesquisa de Usuário | `design:user-research` | Plano, guia de entrevista e síntese de user research |

---

### Skills Cowork — UI/UX Pro Max
> Acionamento: via Skill tool com `ui-ux-pro-max:nome`

| Skill | ID | Descrição |
|-------|----|-----------|
| UI/UX Pro Max | `ui-ux-pro-max:ui-ux-pro-max` | Design de UI/UX — 50+ estilos, 161 paletas, 57 font pairings |
| Design System | `ui-ux-pro-max:design-system` | Tokens, componentes, specs em 3 camadas |
| Slides | `ui-ux-pro-max:slides` | Apresentações HTML com Chart.js e tokens |
| Brand | `ui-ux-pro-max:brand` | Voz de marca, identidade visual, estilo |
| UI Styling | `ui-ux-pro-max:ui-styling` | shadcn/ui + Tailwind — components acessíveis |
| Banner | `ui-ux-pro-max:banner-design` | Banners para social, ads, web e print — 22 estilos |
| Design Geral | `ui-ux-pro-max:design` | Design completo — logo, CIP, mockups, ícones, social |

---

### Skills Cowork — TimexQuads (Design)
| Skill | ID | Descrição |
|-------|----|-----------|
| Design Squad | `timexquads-design-squad:design-squad` | Design de interfaces e experiências |

---

## 🏢 OPERAÇÕES / FINANCEIRO / RH

### Skills Cowork — Plugin Operations (Anthropic)
> Acionamento: via Skill tool com `operations:nome`

| Skill | ID | Descrição |
|-------|----|-----------|
| Documentar Processo | `operations:process-doc` | Fluxograma, RACI e SOP de processos |
| Relatório de Status | `operations:status-report` | KPIs, riscos e ações — executivo e técnico |
| Change Request | `operations:change-request` | Impacto, rollback e comunicação de mudanças |
| Capacity Plan | `operations:capacity-plan` | Planejamento de capacidade e headcount |
| Avaliação de Fornecedor | `operations:vendor-review` | TCO, riscos e recomendação de vendor |
| Avaliação de Risco | `operations:risk-assessment` | Registro e priorização de riscos operacionais |
| Compliance | `operations:compliance-tracking` | Rastreamento de requisitos e auditoria |
| Runbook | `operations:runbook` | Procedimento operacional passo-a-passo |
| Otimização de Processo | `operations:process-optimization` | Análise e melhoria de processos ineficientes |

---

### Skills Cowork — Plugin Finance (Anthropic)
> Acionamento: via Skill tool com `finance:nome`

| Skill | ID | Descrição |
|-------|----|-----------|
| Análise de Variância | `finance:variance-analysis` | Decomposição de variâncias com narrativa |
| SOX Testing | `finance:sox-testing` | Amostras, workpapers e controles SOX 404 |
| Journal Entry | `finance:journal-entry` | Lançamentos contábeis com débitos/créditos |
| Suporte a Auditoria | `finance:audit-support` | Metodologia de teste e documentação de controles |
| Demonstrações | `finance:financial-statements` | DRE, Balanço, Fluxo de Caixa com variância |
| Fechamento | `finance:close-management` | Gestão do processo de fechamento mensal |
| Prep de Journal | `finance:journal-entry-prep` | Accruals, amortizações, depreciação |
| Reconciliação | `finance:reconciliation` | Reconciliação GL vs subledger/banco |

---

### Skills Cowork — Plugin Human Resources (Anthropic)
> Acionamento: via Skill tool com `human-resources:nome`

| Skill | ID | Descrição |
|-------|----|-----------|
| Onboarding | `human-resources:onboarding` | Checklist e plano de primeiro mês de novo contratado |
| Política | `human-resources:policy-lookup` | Busca e explicação de políticas em linguagem simples |
| Prep de Entrevista | `human-resources:interview-prep` | Plano estruturado e scorecard por competência |
| Proposta | `human-resources:draft-offer` | Carta de oferta com pacote total de comp |
| Org Planning | `human-resources:org-planning` | Design organizacional e headcount planning |
| Avaliação de Performance | `human-resources:performance-review` | Auto-avaliação, review e prep de calibração |
| Relatório de Pessoas | `human-resources:people-report` | Headcount, attrition, diversidade e saúde org |
| Análise de Comp | `human-resources:comp-analysis` | Benchmarking, bands e equity modeling |
| Pipeline de Recrutamento | `human-resources:recruiting-pipeline` | Rastreamento de candidatos por estágio |

---

### MCPs — Operações / Financeiro
| MCP | Origem | Função |
|-----|--------|--------|
| Stripe | Cowork | Pagamentos, assinaturas e faturamento |
| Vercel | Cowork | Deploy, logs e monitoramento de frontend |
| Cloudflare | Cowork | CDN, R2 (backup 10 anos), Workers |

---

## 🤝 ATENDIMENTO AO CLIENTE

### Skills Cowork — Plugin Customer Support (Anthropic)
> Acionamento: via Skill tool com `customer-support:nome`

| Skill | ID | Descrição |
|-------|----|-----------|
| Redigir Resposta | `customer-support:draft-response` | Resposta ao cliente — pergunta, escalação, bad news |
| Triagem de Ticket | `customer-support:ticket-triage` | P1-P4 prioridade, categoria e roteamento |
| Pesquisa de Cliente | `customer-support:customer-research` | Multi-source research com atribuição de fonte |
| Artigo KB | `customer-support:kb-article` | Artigo de knowledge base a partir de ticket resolvido |
| Escalação | `customer-support:customer-escalation` | Pacote de escalação para eng/produto/liderança |

---

### Skills Cowork — TimexQuads (Atendimento)
| Skill | ID | Descrição |
|-------|----|-----------|
| Customer Support | `timexquads-customer-support:customer-support` | Respostas de suporte otimizadas |

---

### MCPs — Atendimento
| MCP | Origem | Função |
|-----|--------|--------|
| Gmail | Cowork | E-mails, triagem automática, rascunhos |
| Resend | CLI | E-mails transacionais (confirmação, notificação, onboarding) |

---

## 🎓 EDUCAÇÃO & IMOBILIÁRIO & PROPÓSITO

### Skills Customizadas do Marcelo
> Acionamento: via Skill tool pelo nome

| Skill | ID | Uso Principal |
|-------|----|---------------|
| Gestão Educacional | `edu-management` | FIC, Klésis — pedagógico, regulatório MEC/CEE, captação |
| Imobiliário | `real-estate` | Viabilidade, VGV, quadros de área, incorporação, Splendori |
| Teologia & Missão | `theology-mission` | Business as Mission, ética empresarial cristã, devocionais |
| Perfil do Marcelo | `marcelo-profile` | Contexto cross-business — sempre consultar antes de qualquer decisão |
| Estratégia de Negócios | `biz-strategy` | SWOT, Canvas, OKRs, decisões cross-business |
| Comunicação & Marca | `brand-comms` | Posts, emails institucionais, campanha, copywriting de marca |
| Produto SaaS | `saas-product` | Intentus e Nexvy — roadmap, features, métricas SaaS |
| Documentos Jurídicos | `legal-docs` | Contratos, atos societários, notificações — advocacia |
| Lead Miner | `lead-miner` | Qualificação e organização de leads para vendas no Instagram |
| Sales Strategist | `sales-strategist` | Estratégia comercial — oferta, argumentos, objeções, funil de vendas |
| Trend Hunter | `trend-hunter` | Temas com potencial de engajamento para conteúdo no Instagram |
| True Copywriter | `true-copywriter` | Copy persuasivo para Instagram — headlines, legendas, CTAs que convertem |

---

## 🧠 ORQUESTRAÇÃO & INTELIGÊNCIA CENTRAL

### Produto Management
> Acionamento: via Skill tool com `product-management:nome`

| Skill | ID | Descrição |
|-------|----|-----------|
| Métricas | `product-management:metrics-review` | Análise de métricas com insights acionáveis |
| Síntese de Pesquisa | `product-management:synthesize-research` | User research → temas e recomendações de roadmap |
| Escrever Spec | `product-management:write-spec` | Feature spec / PRD a partir de ideia ou problema |
| Competidores | `product-management:competitive-brief` | Análise de concorrentes para estratégia de produto |
| Sprint Planning | `product-management:sprint-planning` | Escopo, capacidade e metas do sprint |
| Brainstorm | `product-management:product-brainstorming` | Exploração de problema e geração de soluções |
| Update de Stakeholder | `product-management:stakeholder-update` | Comunicado de status por audiência |
| Roadmap | `product-management:roadmap-update` | Atualização e repriorização de roadmap |

---

### Enterprise Search
> Acionamento: via Skill tool com `enterprise-search:nome`

| Skill | ID | Descrição |
|-------|----|-----------|
| Buscar | `enterprise-search:search` | Busca cross-plataforma em uma query |
| Estratégia de Busca | `enterprise-search:search-strategy` | Decomposição de queries por fonte |
| Fontes | `enterprise-search:source-management` | Gestão de MCPs de busca conectados |
| Digest | `enterprise-search:digest` | Resumo diário/semanal de atividade cross-plataforma |
| Síntese | `enterprise-search:knowledge-synthesis` | Combina resultados de múltiplas fontes com citações |

---

### Advisory & Estratégia
| Skill | ID | Descrição |
|-------|----|-----------|
| Advisory Board | `timexquads-advisory-board:advisory-board` | Conselho consultivo virtual para decisões estratégicas |
| C-Level Squad | `timexquads-c-level-squad:c-level-squad` | Pensamento executivo para decisões cross-business |
| Cost Reducer | `timexquads-cost-reducer:cost-reducer` | Análise e redução de custos operacionais |
| Researcher | `timexquads-researcher:researcher` | Pesquisa aprofundada com múltiplas fontes e síntese |

---

## 🧰 PRODUTIVIDADE & SISTEMA

### Skills Cowork — Productivity
| Skill | ID | Descrição |
|-------|----|-----------|
| Memória | `productivity:memory-management` | Sistema de memória em duas camadas (CLAUDE.md + memory/) |
| Iniciar | `productivity:start` | Dashboard e setup inicial do sistema |
| Atualizar | `productivity:update` | Sync de tasks e refresh de memória |
| Tarefas | `productivity:task-management` | Gestão de tarefas via TASKS.md compartilhado |

---

### Documentos
| Skill | ID | Descrição |
|-------|----|-----------|
| PDF | `pdf` | Criar, extrair, mesclar, dividir PDFs e formulários |
| Word | `docx` | Criar e editar documentos Word com formatação profissional |
| Excel | `xlsx` | Planilhas com fórmulas, gráficos e análise de dados |
| PowerPoint | `pptx` | Apresentações profissionais com templates |

---

### Gestão do Ecossistema
| Skill | ID | Descrição |
|-------|----|-----------|
| Criar Skill | `skill-creator` | Criar, modificar e avaliar skills |
| Criar Plugin | `cowork-plugin-management:create-cowork-plugin` | Criar novo plugin Cowork do zero |
| Customizar Plugin | `cowork-plugin-management:cowork-plugin-customizer` | Ajustar plugin para fluxos específicos |
| Agendar Tarefa | `schedule` | Criar e gerenciar tarefas agendadas |
| Setup Cowork | `setup-cowork` | Configuração guiada do Cowork |
| Know Me | `timexquads-know-me:know-me` | Memória persistente de preferências |

---

## 🔧 MCPs — INFRAESTRUTURA COMPLETA

### MCPs Cowork (conectados via interface)
| MCP | Status | Função Principal |
|-----|--------|-----------------|
| **Supabase** | ✅ Ativo | Banco de dados, Edge Functions, Auth — Intentus e ERP |
| **Vercel** | ✅ Ativo | Deploy, preview, logs de frontend |
| **Cloudflare** | ✅ Ativo | CDN, R2 (backup 10 anos), Workers |
| **Stripe** | ✅ Ativo | Pagamentos, assinaturas, faturamento |
| **Gmail** | ✅ Ativo | E-mails, triagem automática, rascunhos |
| **Apify** | ✅ Ativo | Web scraping avançado, coleta de dados |

### MCPs CLI (instalados via Claude Code) — 9 ativos
| MCP | Instalação | Função Principal | Data |
|-----|-----------|-----------------|------|
| **Sequential Thinking** | CLI | Raciocínio estruturado para decisões complexas | 05/04/2026 |
| **Memory** | CLI | Memória persistente entre sessões | 05/04/2026 |
| **Context7** | CLI | Docs atualizadas de libs (Next.js, React, Supabase) | 05/04/2026 |
| **Playwright** | CLI | Testes E2E, automação de browser | 05/04/2026 |
| **GitHub** | CLI | Repos, PRs, issues, code review | 05/04/2026 |
| **Resend** | CLI | E-mails transacionais programáticos | 05/04/2026 |
| **Pipedream** | CLI (SSE) | Automação de workflows — cola entre sistemas | 05/04/2026 |
| **Figma Context MCP** | CLI (`figma-developer-mcp v0.10.1`) | Design assets, componentes, especificações visuais do Figma | 12/04/2026 |
| **Notion MCP** | CLI (`@notionhq/notion-mcp-server`) | Leitura/escrita em páginas, databases e bases de conhecimento Notion | 12/04/2026 |

> **Nota técnica:** `figma-developer-mcp` requer o flag `--stdio` na instalação, caso contrário entra em modo HTTP e não conecta.

### MCPs Pendentes (conectar no Cowork)
| MCP | Prioridade | Ação | Função Planejada |
|-----|-----------|------|-----------------|
| **Sentry** | P1 | Conectar no Cowork | Monitoramento de erros em tempo real |
| **PostHog** | P2 | Conectar no Cowork | Analytics de produto |
| **Zapier** | P3 | Conectar no Cowork | Automações no-code com sistemas legados |

---

## 📚 REFERÊNCIAS

- **Documento-mãe do Ecossistema:** `Ecossistema/ECOSSISTEMA-INOVACAO-IA.md`
- **Protocolo de memória:** `PROTOCOLO-MEMORIA.md`
- **Memória central:** `CENTRAL-MEMORY.md`
- **Onboarding Kit:** `ONBOARDING-KIT.md`
- **Skills LeadGenMan (CLI):** `~/.claude/skills/` (35 arquivos)
- **Skills Cowork:** Instaladas via interface Cowork
