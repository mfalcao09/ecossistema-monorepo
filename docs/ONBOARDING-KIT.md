# ONBOARDING-KIT — Novo Projeto do Marcelo

> **Instrução:** Suba este arquivo na sessão inicial de qualquer novo projeto.
> Ele dá ao Claude todo o contexto necessário para começar a trabalhar imediatamente.
> Após o onboarding, crie a estrutura `memory/` do projeto e atualize a CENTRAL-MEMORY.md.
>
> **Localização permanente:** `/Users/marcelosilva/Projects/GitHub/ONBOARDING-KIT.md`
> **Arquivos companheiros (mesma pasta):**
> - `CENTRAL-MEMORY.md` — memória master cross-project
> - `PROTOCOLO-MEMORIA.md` — como atualizar memória (projeto + central)
> - `GIT-WORKFLOW-AUTONOMO.md` — **padrão obrigatório** de commit & push autônomo (leitura obrigatória no onboarding)
> - `INVENTARIO-FERRAMENTAS.md` — **fonte única da verdade** de todas as skills, plugins, MCPs e IAs disponíveis (~250+ ferramentas, organizadas por área)
> - `Ecossistema/` — projeto do Ecossistema de Inovação e IA (visão, inventário, arquitetura)

---

## Quem é Marcelo

**Nome:** Marcelo Silva
**Email:** mrcelooo@gmail.com
**Formação:** Direito (advocacia empresarial/imobiliária) + Publicidade + Teologia
**Cosmovisão:** Cristã reformada — Missão Integral, Business as Mission (BAM)
**Cidade-base:** Cassilândia/MS (FIC) e Piracicaba/SP (Splendori)

### Valores Inegociáveis
- Propósito não é marketing — é convicção real
- Lucro e propósito se complementam, não competem
- Transparência, integridade e boa-fé em tudo
- Excelência profissional como forma de vocação

### Estilo de Trabalho
- **Iniciante em programação** — precisa de passo a passo detalhado
- **Quer ver TODAS as possibilidades** antes de decidir qualquer coisa
- **Auto-save obrigatório** — NUNCA pedir para salvar (salvar sempre automaticamente)
- **Idioma:** PT-BR sempre
- **Tom:** Direto, sem enrolação, mas detalhado quando explica
- **Apelidos:** "Claudinho" (Claude), "Buchecha" (MiniMax M2.7)
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`) + Co-Authored-By

---

## Projetos Principais do Marcelo

### Pasta raiz de TODOS os projetos
**`/Users/marcelosilva/Projects/GitHub/`**

### Setor Educacional

| Projeto | Pasta | Descrição | Status |
|---------|-------|-----------|--------|
| **Colégio Klésis** | — | Ensino básico, "Educação com Propósito" | Operacional |
| **FIC** (Faculdades Integradas de Cassilândia) | — | Ensino superior, 44 anos, revitalização | Operacional |
| **ERP-Educacional** | `ERP-Educacional/` | ERP completo para a FIC. Módulo 1: Diploma Digital | Em desenvolvimento |

### Setor Imobiliário

| Projeto | Pasta | Descrição | Status |
|---------|-------|-----------|--------|
| **Splendori — House and Garden** | `AF DESENVOLVIMENTO IMOBILIÁRIO/` | Condomínio alto padrão, Piracicaba | Em desenvolvimento |

### Setor Tecnologia

| Projeto | Pasta | Descrição | Status |
|---------|-------|-----------|--------|
| **Intentus Real Estate** | `intentus-plataform/` | SaaS imobiliário — CLM, CRM, Pricing AI, Relationship IA | Em desenvolvimento |
| **Nexvy** | — | SaaS comunicador multi-canal | Planejamento |

---

## Contas e Infraestrutura

### Supabase
| Projeto | Project ID | Região | Tabelas | Edge Functions |
|---------|-----------|--------|---------|----------------|
| **Intentus** | `bvryaopfjiyxjgsuhjsb` | sa-east-1 | 222 | 88 |
| **ERP-Educacional** | `ifdnjieklngcfodmtied` | sa-east-1 | 65 | 40+ |

### Vercel
| Projeto | URL Produção | URL Preview |
|---------|-------------|-------------|
| **Intentus** | `app.intentusrealestate.com.br` | `intentus-plataform.vercel.app` |
| **ERP-Educacional** | (a configurar) | (a configurar) |

### GitHub
| Projeto | Repositório |
|---------|------------|
| **Intentus** | `github.com/mfalcao09/intentus-plataform` |
| **ERP-Educacional** | `github.com/mfalcao09/diploma-digital` |

**Autenticação centralizada (desde 08/04/2026):** todos os repos `mfalcao09/*` são autenticados via fine-grained PAT único (`cowork-claude-automation`) salvo em `/sessions/sleepy-nifty-cerf/.github-token` (chmod 600), lido pelo `credential.helper store` global do git. Novos repos NÃO precisam de configuração de auth — funcionam imediatamente após `git clone`. Ver `GIT-WORKFLOW-AUTONOMO.md §2.5` para detalhes e procedimento de rotação.

### Cloudflare
- **R2 Storage**: Backup de longo prazo (10 anos para diplomas)
- Conta ativa com buckets configuráveis

### Outros Serviços
| Serviço | Uso | Projeto |
|---------|-----|---------|
| **Stripe** | Pagamentos e assinaturas | Intentus |
| **Resend** | Envio de e-mails transacionais | Intentus |
| **OpenRouter** | LLM (Gemini 2.0 Flash) | Intentus |
| **Apify** | Web scraping | Intentus (Pricing AI) |

### Claude Code CLI
| Campo | Valor |
|-------|-------|
| **Versão** | 2.1.92 |
| **Comando** | `claude` (global via npm) |
| **Config** | `/Users/marcelosilva/.claude.json` |

### MCPs Locais Claude Desktop (instalados 08/04/2026)
Config: `/Users/marcelosilva/Library/Application Support/Claude/claude_desktop_config.json`

| MCP | Pacote | Escopo |
|-----|--------|--------|
| **Desktop Commander** 🟢 | `@wonderwhy-er/desktop-commander` (via `npx`) | Shell, git, filesystem **no Mac real** (26 tools). Resolve limitações FUSE/bindfs do sandbox Cowork. Usado como caminho **primário** do git workflow (v4). |
| **Apple MCP** | `@dhravya/apple-mcp` (via `bunx` em path absoluto `/Users/marcelosilva/.bun/bin/bunx`) | Apps nativos macOS: Contacts, Notes, Messages, Mail, Reminders, WebSearch, Calendar, Maps. **NÃO executa shell/git.** |

**Regra:** para terminal/git, sempre **Desktop Commander**. Para apps nativos (criar lembrete, evento, nota, email), **Apple MCP**. Nunca confundir os dois.

---

## Ecossistema de Inovação e IA

> **Documento completo:** `Ecossistema/ECOSSISTEMA-INOVACAO-IA.md`
> **CLAUDE.md do projeto:** `Ecossistema/CLAUDE.md`

### Visão
Sistema integrado de **agentes autônomos de IA** que atende, qualifica, prospecta, vende, desenvolve, monitora e escala TODOS os negócios de Marcelo. IA como infraestrutura, não como ferramenta.

### Arquitetura (3 Camadas de Agentes)

| Camada | Função | Agentes |
|--------|--------|---------|
| **1 — Negócio** | Cliente/mercado | Vendas, Atendimento, Marketing, Qualificação, Jurídico, Financeiro |
| **2 — Desenvolvimento** | Produto/código | Dev (Squad 5 IAs), QA, Deploy, Produto |
| **3 — Infraestrutura** | Operação/escala | DB, Monitoramento, Backup, Automação, Memória, Contexto |

**Orquestrador central:** Claude Opus 4

### Inventário de Ferramentas (68+)

| Categoria | Qtd | O que são |
|-----------|-----|-----------|
| Plugins Anthropic | 14 | Productivity, Sales, Legal, Finance, Marketing, PM, CS, Data, Search, Design, Engineering, HR, Operations, Bio Research |
| Plugins Partner-Built | 4 | Brand Voice, Apollo, Common Room, Slack by Salesforce |
| Plugin Gestão | 1 | Cowork Plugin Management |
| MCPs Cowork | 6 | Supabase, Vercel, Cloudflare, Stripe, Gmail, Apify |
| MCPs CLI | 7 | Sequential Thinking, Memory, Context7, Playwright, GitHub, Resend, Pipedream |
| Squad IAs | 5 | MiniMax, DeepSeek, Qwen, Kimi, Codestral |
| Skills avançadas | 22+ | TimeXQuads, UI/UX Pro Max, MiroFish, etc. |
| Scheduled Tasks | 8 | Automações agendadas cross-project |

### Fluxos de Agentes Desenhados

1. **Prospecção → Venda:** Apollo → Common Room → Sales → Brand Voice → Gmail/Resend → Stripe → CS
2. **Atendimento → Qualificação:** Gmail → CS → Enterprise Search → Sequential Thinking → Brand Voice → Memory
3. **Desenvolvimento:** PM → GitHub → Squad IAs → Playwright → Vercel → Sentry
4. **Marketing:** Marketing → Brand Voice → Copy Squad → Traffic Masters → PostHog → Data
5. **Decisão Estratégica:** Enterprise Search → Data → Sequential Thinking → Advisory Board → MiroFish → Marcelo

### MCPs Pendentes (Fase 2)

| MCP | Prioridade | Para que serve |
|-----|-----------|----------------|
| Sentry | P1 | Monitoramento de erros em produção |
| Figma | P2 | Design assets e componentes |
| Notion | P2 | Documentação e wiki |
| PostHog | P2 | Analytics de produto |
| Zapier | P3 | Automações no-code |

### Roadmap do Ecossistema

| Fase | Status |
|------|--------|
| 1 — Fundação (68+ ferramentas) | COMPLETA |
| 2 — Conexões pendentes | PRÓXIMA |
| 3 — Agentes autônomos | PLANEJADA |
| 4 — Escala multi-tenant | FUTURA |

---

## Squad de IAs (Time de Desenvolvimento)

Claude é o arquiteto-chefe. As demais IAs são consultadas via plugins:

| IA | Apelido | Modelo | Papel | Quando usar |
|----|---------|--------|-------|-------------|
| **Claude** | Claudinho | Opus 4 | Arquiteto-chefe | Orquestra, planeja, revisa, integra |
| **MiniMax** | Buchecha | M2.7 | Líder de código | Code review (obrigatório), implementação, testes |
| **DeepSeek** | — | V3.2 | Lógica | SQL complexo, debugging, algoritmos |
| **Qwen** | — | Qwen3-Coder 480B | Frontend | React, Next.js, UI/UX |
| **Kimi** | — | K2.5 | Bugs | Resolver bugs difíceis, codebases grandes |
| **Codestral** | — | Codestral (Mistral) | Multi-lang | Code completion, refatoração idiomática |

---

## Skills Disponíveis (~75 skills)

### Skills Pessoais do Marcelo
| Skill | O que faz |
|-------|-----------|
| `marcelo-profile` | Perfil completo — base de tudo |
| `biz-strategy` | Estratégia cross-business (SWOT, OKRs, Canvas) |
| `saas-product` | Produto SaaS (roadmap, backlog, métricas) |
| `edu-management` | Gestão educacional (MEC, matrículas, regulatório) |
| `real-estate` | Incorporação imobiliária (VGV, viabilidade) |
| `brand-comms` | Branding e comunicação |
| `legal-docs` | Documentos jurídicos e contratos |
| `theology-mission` | Teologia, Missão Integral, BAM |

### Skills de Documentos
| Skill | O que faz |
|-------|-----------|
| `docx` | Criar/editar Word |
| `xlsx` | Criar/editar Excel |
| `pptx` | Criar/editar PowerPoint |
| `pdf` | Criar/manipular PDF |

### Skills do Squad de IAs
Cada IA tem: `ask`, `pair-programming`, `review`, `debug`, `test`
- `minimax-ai-assistant:*` — Buchecha (6 tools MCP diretos)
- `deepseek-ai-assistant:*` — DeepSeek
- `qwen-ai-assistant:*` — Qwen (+ `explain`, `alternative`)
- `kimi-ai-assistant:*` — Kimi
- `codestral-ai-assistant:*` — Codestral (+ `explain`, `alternative`)

### Skills TimeXQuads (Squads Especializados)
| Skill | O que faz |
|-------|-----------|
| `advisory-board` | Conselho consultivo virtual |
| `brand-squad` | Squad de marca |
| `c-level-squad` | Squad executivo C-Level |
| `copy-squad` | Copywriting persuasivo |
| `cybersecurity` | Segurança cibernética |
| `data-squad` | Análise de dados e BI |
| `design-squad` | Design visual |
| `hormozi-squad` | Growth e monetização (estilo Hormozi) |
| `movement` | Construção de movimento/comunidade |
| `storytelling` | Narrativas e engajamento |
| `traffic-masters` | Tráfego pago e orgânico |
| `code-mastery` | Otimização do Claude Code |
| `cost-reducer` | Redução de custos operacionais |
| `create-skill` | Criar novas skills |
| `customer-support` | Suporte ao cliente |
| `frontend-design` | Design frontend/UI |
| `n8n` | Automações n8n |
| `researcher` | Pesquisa aprofundada |
| `know-me` | Memória persistente do usuário |
| `scalability` | Escalabilidade de sistemas |
| `security` | Segurança de aplicações |
| `self-healing` | Auto-melhoria do Claude |
| `trigger-dev` | Jobs com Trigger.dev |

### Skills UI/UX Pro Max
| Skill | O que faz |
|-------|-----------|
| `ui-ux-pro-max` | Design completo (50+ estilos, 161 paletas) |
| `design` | Identidade visual, logos, CIP, mockups |
| `design-system` | Tokens de design, componentes |
| `ui-styling` | Interfaces shadcn/ui + Tailwind |
| `slides` | Apresentações HTML com Chart.js |
| `brand` | Voz e identidade de marca |
| `banner-design` | Banners (22 estilos) |

### Skills MiroFish (Simulações)
| Skill | O que faz |
|-------|-----------|
| `mirofish-simulate` | Simulações multi-agente preditivas |
| `mirofish-chat` | Conversar com agentes simulados |
| `mirofish-report` | Relatórios de previsão |

### Skills de Automação (criadas por Marcelo)
| Skill | Tipo | O que faz |
|-------|------|-----------|
| `sprint-review` | Skill Chain | Revisão automática de sprint com dados reais |
| `relatorio-executivo` | Skill Chain | Relatório consolidado cross-business |
| `launch-feature` | Skill Chain | Pipeline de lançamento (changelog + posts) |
| `campanha-matricula` | Skill Chain | Campanha completa de matrícula FIC/Klésis |
| `full-feature-pipeline` | Agent Team | Pipeline 7 fases com 5 IAs |
| `audit-completo` | Agent Team | Auditoria com 3 IAs em paralelo |
| `docs-generator` | Agent Team | Documentação automática |
| `migration-planner` | Agent Team | Planejamento de migrações de banco |
| `squad-parallel` | Agent Team | Execução paralela de tarefas |
| `second-brain` | Memory | Sistema de memória do projeto |

---

## Git Workflow Autônomo (OBRIGATÓRIO — v4.2)

> **Documento-fonte:** `GIT-WORKFLOW-AUTONOMO.md` (mesma pasta) — leitura obrigatória. Este resumo é só o essencial.

### Princípio
**Claude executa edição → validação → commit → push → monitoramento de deploy → correção de erros → redeploy SOZINHO.** Marcelo NÃO digita comandos de git. A tarefa só termina quando o deploy Vercel chega em `READY`.

### Arquitetura dual-path (desde v4 — 08/04/2026)
A partir de 08/04/2026 existem **dois caminhos** para rodar git, e Claude deve escolher o primário sempre que disponível:

| Caminho | Onde roda | Quando usar |
|---|---|---|
| 🟢 **PRIMÁRIO — Desktop Commander MCP** (`@wonderwhy-er/desktop-commander`) | Direto no macOS do Marcelo via `mcp__desktop-commander__start_process` | **Sempre que disponível.** Bypassa FUSE/bindfs do sandbox, usa credenciais nativas do git (Keychain do macOS), elimina o workaround `/tmp clone`. |
| 🟡 **FALLBACK — Sandbox Bash + bindfs `/mnt/GitHub`** | Dentro do sandbox Cowork, sobre bindfs | Só se Desktop Commander não estiver instalado/disponível. Usa PAT fine-grained em `/mnt/GitHub/.github-token` + `credential.helper` global. |

**Apple MCP (`@dhravya/apple-mcp`) NÃO executa shell/git** — só controla apps nativos (Notas, Calendário, Mail, Mensagens, Lembretes, Contatos, Maps, WebSearch). Para terminal/git, use Desktop Commander.

### Autenticação GitHub (v4.1 — 08/04/2026)
- **Caminho primário:** Keychain nativo do macOS já carregado com PAT fine-grained. `credential.helper=osxkeychain` vem do Xcode CLT (system-level). Binário em `/Library/Developer/CommandLineTools/usr/libexec/git-core/git-credential-osxkeychain`. **Validado:** `git ls-remote origin main` retorna SHA sem prompt.
- **Caminho fallback:** `/Users/marcelosilva/Projects/GitHub/.github-token` — ⚠️ **formato URL** (`https://mfalcao09:PAT@github.com`), não PAT puro. Para regravar no Keychain, extrair o PAT com `sed -E 's|https://[^:]+:([^@]+)@.*|\1|'` antes.
- **Protocolo de regravação** (se PAT expirar): ver `GIT-WORKFLOW-AUTONOMO.md` §2.5.1.1.

### 🚨 Definition of Done (v4.2 — 08/04/2026)
**Commit + push NÃO é "pronto".** A tarefa só está encerrada quando o deploy Vercel retornar `READY` **e** a validação pós-verde passar.

Ciclo autônomo:
1. Desktop Commander → `git commit` + `git push`
2. MCP Vercel → `list_deployments` → achar deploy pelo SHA
3. MCP Vercel → `get_deployment(uid)` em polling: `QUEUED` → `BUILDING` → `READY` ✅ ou `ERROR` ❌
4. Se `ERROR`: `get_deployment_build_logs(uid)` → diagnosticar → corrigir → `tsc` + `build` local → commit + push → **voltar ao passo 2**
5. Após `READY`: Sentry `search_issues` (15min), Supabase `get_advisors` (se migration), Vercel `get_runtime_logs` (se runtime)
6. **Só então** comunicar entrega final

**Stop conditions (escalar para Marcelo):** 3× mesmo erro, causa fora do alcance (secrets, infra), interrupção explícita de Marcelo.

### Regras inegociáveis (18 — atualizadas em v4.2)
1. **Author git:** `mfalcao09` / `contato@marcelofalcao.imb.br` (senão Vercel falha)
2. **Conventional Commits** + `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>` via HEREDOC
3. **Build completo** (`next build` / `npm run build`) antes do push, não só `tsc`
4. **`git add <arquivo>`** por nome — nunca `-A` / `.`
5. **NUNCA** `--force`, `--amend`, `--no-verify` sem confirmação explícita
6. **NUNCA** embutir PAT na URL do remote
7. **NUNCA** usar PAT classic — sempre fine-grained
8. **Preferir Desktop Commander** sempre que disponível (v4)
9. **Nunca usar Apple MCP para shell/git** — só apps nativos (v4)
10. **Definition of Done = deploy Vercel `READY`** (v4.2)
11. **Ciclo corretivo autônomo** após `ERROR` — sem pedir intervenção, exceto stop conditions (v4.2)

Lista completa (1-18) em `GIT-WORKFLOW-AUTONOMO.md` §4.

### Ferramentas do Cowork usadas
`Read`, `Edit`, `Write`, `Grep`, `Glob`, `TodoWrite`, **Desktop Commander MCP** (primário para shell/git), **Bash** (fallback/sandbox), **MCP Vercel** (monitoramento de deploy), **MCP Supabase** (advisors/migrations), **MCP Sentry** (regressões), Skill `minimax-ai-assistant:review-minimax` (Buchecha — obrigatório para code review).

### Adaptação por projeto
Cada projeto pode ter um `memory/workflows/commit-push-autonomo.md` local com ajustes específicos. O `GIT-WORKFLOW-AUTONOMO.md` é a **baseline** cross-project. ERP-Educacional tem sessões paralelas frequentes que exigem protocolo extra (§5).

---

## Diretriz de Skills e Plugins (OBRIGATÓRIO)

**A cada decisão, plano ou tarefa, Claude DEVE:**
1. Indicar quais skills e plugins vai utilizar ANTES de começar
2. Sempre usar as skills relevantes — nunca trabalhar "no vazio"
3. Formato: "Para esta tarefa, vou utilizar: **[skill X]** (motivo), **[skill Y]** (motivo)"

---

## Plugins MCP Conectados

| Plugin | Ferramentas Principais | Quando usar |
|--------|----------------------|-------------|
| **Supabase** | `execute_sql`, `list_tables`, `deploy_edge_function`, `list_edge_functions`, `apply_migration` | Banco de dados, deploys |
| **Vercel** | `list_deployments`, `get_deployment_build_logs`, `deploy_to_vercel` | Frontend deploys, logs |
| **Gmail** | `gmail_search_messages`, `gmail_create_draft`, `gmail_read_message` | E-mails, triagem |
| **Cloudflare** | `r2_buckets_list`, `workers_list`, `d1_database_query` | Backup, CDN, workers |
| **MiniMax (Buchecha)** | `minimax_ask`, `minimax_code_review`, `minimax_debug`, `minimax_generate_tests` | Code review, debugging |
| **Scheduled Tasks** | `create_scheduled_task`, `list_scheduled_tasks`, `update_scheduled_task` | Automações agendadas |
| **Chrome** | `navigate`, `get_page_text`, `computer`, `form_input` | Pesquisa web, navegação |
| **Apify** | `call-actor`, `search-actors`, `get-actor-output` | Web scraping avançado |
| **PDF Viewer** | `display_pdf`, `save_pdf`, `read_pdf_bytes` | Visualizar e manipular PDFs |

---

## Checklist de Onboarding (para Claude executar)

Ao receber este arquivo em um novo projeto:

1. [ ] Ler este arquivo completamente
2. [ ] Solicitar acesso à pasta `/Users/marcelosilva/Projects/GitHub` (se ainda não tiver)
3. [ ] Ler `CENTRAL-MEMORY.md`, `PROTOCOLO-MEMORIA.md` **e `GIT-WORKFLOW-AUTONOMO.md`** da pasta GitHub/
4. [ ] Criar pasta `memory/` no projeto com a estrutura padrão:
   - `memory/MEMORY.md` (índice de roteamento)
   - `memory/debugging.md` (bugs e soluções)
   - `memory/patterns.md` (padrões de código)
   - `memory/architecture.md` (decisões técnicas)
   - `memory/preferences.md` (preferências — copiar do kit)
   - `memory/workflows/` (pasta de runbooks operacionais)
   - `memory/workflows/commit-push-autonomo.md` (adaptação local do GIT-WORKFLOW-AUTONOMO.md)
   - `memory/sessions/` (pasta de sessões)
   - `memory/sessions/SINTESE.md` (síntese consolidada)
5. [ ] Criar `CLAUDE.md` do projeto (baseado neste kit + especificidades do projeto) — **deve referenciar explicitamente o GIT-WORKFLOW-AUTONOMO.md**
6. [ ] Verificar autenticação GitHub: `cd <projeto> && git fetch origin` deve funcionar SEM pedir senha (o `credential.helper` global do Cowork já cobre — se falhar, ver `GIT-WORKFLOW-AUTONOMO.md §2.5` "Setup inicial em uma sandbox nova")
7. [ ] Confirmar git config local: `user.email "contato@marcelofalcao.imb.br"` e `user.name "mfalcao09"` (herdado do global, mas conferir)
8. [ ] Garantir que `.git/config` do projeto NÃO tem token embutido na URL do remote (deve ser `https://github.com/mfalcao09/<repo>.git` puro)
9. [ ] Registrar o novo projeto na **CENTRAL-MEMORY.md** (`/Users/marcelosilva/Projects/GitHub/CENTRAL-MEMORY.md`)
10. [ ] Perguntar a Marcelo: objetivo do projeto, stack desejada, prazo, contexto
11. [ ] Iniciar sessão 001
