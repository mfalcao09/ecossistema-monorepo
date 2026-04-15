# Ecossistema de Inovação e IA — Marcelo Silva

## Regras de Sessão (OBRIGATÓRIO)

1. **Auto-save absoluto**: TODA interação, decisão, código, discussão e resultado deve ser salvo automaticamente em `memory/` E no Supabase ECOSYSTEM. Marcelo NUNCA deve precisar pedir para salvar.
2. **"Vou encerrar" = salvamento completo**: Quando Marcelo disser "vou encerrar" (ou "vou fechar", "vou sair", "encerra"), executar IMEDIATAMENTE o protocolo completo: salvar sessão em `memory/sessions/`, atualizar `memory/MEMORY.md`, atualizar `/Users/marcelosilva/Projects/GitHub/CENTRAL-MEMORY.md`, **INSERT no Supabase ECOSYSTEM**. Só se despedir DEPOIS de salvar tudo.
3. **Commit a cada modificação**: Conventional commits (`feat:`, `fix:`, `docs:`, etc.) + Co-Authored-By.

## Sistema de Memória — FASE B (Supabase Primário · ativo desde 14/04/2026)

**Fonte da verdade:** Supabase ECOSYSTEM (`gqckbunsfjgerbuiyzvn`) — primário e ativo.
**Arquivos locais:** Backup de emergência + leitura humana. Mantidos em sync pelas automações.

### Início de sessão (obrigatório)
Chamar `bootstrap_session()` via Supabase MCP ANTES de qualquer trabalho:

```sql
select bootstrap_session(
  '[descrever a tarefa desta sessão em 1 frase]',
  'ecosystem',
  15
);
```

A função retorna as memórias mais relevantes para aquela tarefa específica.
**Não é necessário ler `MEMORY.md` ou `ECOSSISTEMA-INOVACAO-IA.md` manualmente** — só quando precisar de visão geral completa.

### Fallback (Supabase indisponível)
1. Este arquivo (CLAUDE.md)
2. `memory/MEMORY.md`
3. `ECOSSISTEMA-INOVACAO-IA.md`
4. Arquivo temático relevante

### Compactação Automática de Sessão (FASE 3.3)

**Trigger:** Quando contexto > 80% do limite, executar IMEDIATAMENTE:

1. **PARAR** o que está fazendo
2. **SALVAR Camada 1** (nunca perder):
   - `git add + commit` de código pendente
   - `create_task()` ou `update_task_status()` no Supabase
   - INSERT em `ecosystem_memory` tipo `decision` (decisões tomadas)
   - INSERT em `ecosystem_memory` tipo `feedback` (erros + soluções)
3. **AVALIAR** espaço: se < 90%, manter Camada 2 (sprint, últimas 5 memórias, TRACKER)
4. **CRIAR resumo compactado:** task atual + decisões + pendências + arquivos modificados
5. **CHAMAR Edge Function** `compact-session` para salvar resumo no Supabase
6. **CONTINUAR** trabalho com resumo compactado como contexto

**Camada 3 — SEMPRE descartar:** raciocínio intermediário, iterações descartadas, ACKs, outputs longos já processados.

**Protocolo completo:** `COMPACTION-PROTOCOL.md`

### Final de sessão — Supabase PRIMEIRO
Persistir SEMPRE nos dois destinos, **Supabase antes dos arquivos locais:**
1. **INSERT em `ecosystem_memory`** no Supabase ECOSYSTEM (`project='ecosystem'`) — PRIORITÁRIO
2. Arquivo .md em `memory/` (tipo correspondente) — backup/cache

## Supabase ECOSYSTEM — Memória Online
**Projeto:** `gqckbunsfjgerbuiyzvn` (us-east-2)
**MCP:** `mcp__05dc4b38-c201-4b12-8638-a3497e112721__execute_sql`

**Como inserir memória nova:**
```sql
insert into ecosystem_memory (type, title, content, project, tags, success_score) values
('feedback' | 'decision' | 'context' | 'project' | 'reference' | 'user',
 'Título da memória',
 'Conteúdo detalhado...',
 'ecosystem',
 ARRAY['tag1', 'tag2'],
 0.85
);
```

**Tipos de memória:**
- `user` — perfil e preferências do Marcelo
- `feedback` — regras, anti-padrões, lições aprendidas
- `decision` — decisões estratégicas/arquiteturais
- `context` — estado atual, inventário, visão
- `project` — status de masterplans, fases, entregas
- `reference` — caminhos, URLs, IDs, endpoints

## Projeto

| Campo | Valor |
|-------|-------|
| **Nome** | Ecossistema de Inovação e IA |
| **Dono** | Marcelo Silva (mrcelooo@gmail.com) |
| **Pasta** | `/Users/marcelosilva/Projects/GitHub/Ecossistema/` |
| **Criado em** | 05/04/2026 |
| **Tipo** | Cross-project — serve todos os negócios de Marcelo |

## Visão

Construir um **ecossistema integrado de agentes autônomos de IA** que atende, qualifica, prospecta, vende, desenvolve, monitora e escala TODOS os negócios de Marcelo — de forma coordenada, com memória persistente e orquestração central.

**IA como infraestrutura, não como ferramenta.**

## Arquitetura (3 Camadas)

| Camada | Função | Agentes |
|--------|--------|---------|
| **1 — Negócio** | Cliente/mercado | Vendas, Atendimento, Marketing, Qualificação |
| **2 — Desenvolvimento** | Produto/código | Dev, QA, Deploy, Code Review |
| **3 — Infraestrutura** | Operação/escala | DB, Monitoramento, Backup, Automação |

**Orquestrador central:** Claude Opus 4 (Claudinho)

## Inventário Rápido (68+ ferramentas)

| Categoria | Qtd | Status |
|-----------|-----|--------|
| Claude Code CLI | v2.1.92 | Instalado |
| Plugins Anthropic | 14 | Instalados |
| Plugins Partner-Built | 4 | Instalados |
| Plugin de Gestão | 1 | Instalado |
| MCPs Cowork | 6 | Conectados |
| MCPs CLI | 7 | Instalados |
| Squad de IAs | 5 | Ativos |
| Skills avançadas | 22+ | Disponíveis |
| Scheduled Tasks | 8 | Ativas |

→ Inventário completo: `ECOSSISTEMA-INOVACAO-IA.md`

## Negócios Atendidos

| Negócio | Projeto vinculado |
|---------|-------------------|
| **Intentus Real Estate** | `/Users/marcelosilva/Projects/GitHub/intentus-plataform/` |
| **ERP-Educacional / FIC** | `/Users/marcelosilva/Projects/GitHub/ERP-Educacional/` |
| **Colégio Klésis** | (sem repo — usa skills de edu-management + brand-comms) |
| **Splendori** | `/Users/marcelosilva/Projects/GitHub/AF DESENVOLVIMENTO IMOBILIÁRIO/` |
| **Nexvy** | (a criar) |

## Termos Rápidos

| Termo | Significado |
|-------|-----------|
| **Claudinho** | Claude Opus 4 — Orquestrador central |
| **Buchecha** | MiniMax M2.7 — Líder de código |
| **MCP** | Model Context Protocol — ponte entre Claude e serviços externos |
| **Plugin** | Bundle de skills + MCPs + commands (instalável via Cowork) |
| **Skill** | Arquivo markdown com instruções especializadas |
| **Agente** | IA autônoma com escopo, ferramentas e regras definidos |
| **Orquestrador** | Agente central que coordena e delega para outros agentes |

## Ferramentas por Camada

### Camada 1 — Agentes de Negócio
- **Vendas:** Sales, Apollo, Common Room, Stripe
- **Atendimento:** Customer Support, Gmail, Slack, Resend
- **Marketing:** Marketing, Brand Voice, Copy Squad, Traffic Masters
- **Qualificação:** Apollo (enrich), Common Room (research), Data (análise)
- **Jurídico:** Legal, Legal-docs skill
- **Financeiro:** Finance, Stripe

### Camada 2 — Agentes de Desenvolvimento
- **Dev:** Engineering, MiniMax, DeepSeek, Qwen, Kimi, Codestral, GitHub MCP
- **QA:** Playwright, Kimi, Engineering (testing-strategy)
- **Deploy:** Vercel, Supabase, Engineering (deploy-checklist)
- **Produto:** Product Management, Saas-product skill

### Camada 3 — Agentes de Infraestrutura
- **DB:** Supabase MCP, Data plugin
- **Monitoramento:** Sentry (pendente), PostHog (pendente)
- **Backup:** Cloudflare R2
- **Automação:** Pipedream, Zapier (pendente), N8N skill, Trigger.dev skill
- **Memória:** Memory MCP, Sequential Thinking, Enterprise Search
- **Contexto:** Context7, Notion (pendente)
- **Design:** Figma (pendente), Design plugin, UI/UX Pro Max

## Pendências de Estruturação

| Item | Prioridade | Ação |
|------|-----------|------|
| **Sentry** | P1 | Clicar Connect no Cowork |
| **Figma** | P2 | Clicar Connect no Cowork |
| **Notion** | P2 | Clicar Connect no Cowork |
| **PostHog** | P2 | Clicar Connect no Cowork |
| **Zapier** | P3 | Clicar Connect no Cowork |
| **Agente de Prospecção** | P1 | Primeiro agente autônomo a criar |
| **Agente de Atendimento** | P2 | Segundo agente autônomo |
| **Dashboard do Ecossistema** | P3 | Monitoramento de todos os agentes |

## Roadmap

| Fase | Status | Entregas |
|------|--------|----------|
| **1 — Fundação** | COMPLETA | 68+ ferramentas instaladas, memória, documentação |
| **2 — Conexões** | PRÓXIMA | Sentry, Figma, Notion, PostHog, Zapier |
| **3 — Agentes** | PLANEJADA | Orquestrador + agentes autônomos |
| **4 — Escala** | FUTURA | Multi-tenant, dashboard, auto-healing |

## Diretriz de Skills e Plugins (OBRIGATÓRIO)

A cada decisão, plano ou tarefa, Claude DEVE:
1. Indicar quais skills e plugins vai utilizar ANTES de começar
2. Sempre usar as skills relevantes — nunca trabalhar sem elas
3. Formato: "Para esta tarefa, vou utilizar: **[skill X]** (motivo), **[skill Y]** (motivo)"

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

## Permission Model dos Agentes (FASE 2.1 — OBRIGATÓRIO)

> **Regra de enforcement:** Qualquer ação fora do nível declarado exige confirmação explícita de Marcelo antes de prosseguir.
> **Fonte da verdade:** `agent_permissions` no Supabase ECOSYSTEM. Este CLAUDE.md é cache legível.
> **RPC de verificação:** `SELECT check_permission('agente', 'ação')` — retorna `{allowed: true/false, reason: ...}`

| Agente | Nível | Pode Fazer | Não Pode Fazer | Requer Aprovação CEO |
|--------|-------|------------|----------------|---------------------|
| **Claudinho** (Orquestrador) | `DangerFullAccess` | Tudo: deploy, merges, credenciais, criar agentes, delegar | — | Deletar database, revogar credencial prod |
| **Buchecha** (MiniMax M2.7) | `WorkspaceWrite` | Ler/escrever código, branches, code review, mass generation, testes, aprovar merges | Deploy produção direto, dados de alunos, rotacionar credenciais | Merge em main, alterar schema produção |
| **DeepSeek** (V3.2) | `WorkspaceWrite` | SQL, lógica complexa, debugging, migrations, triggers | Dados de alunos sem aprovação, deploy produção, DROP TABLE produção | ALTER TABLE produção, DELETE em massa |
| **Qwen** (Qwen3-Coder 480B) | `WorkspaceWrite` | Frontend React/Next.js, componentes UI, pages, layouts, CSS/Tailwind | Edge Functions produção, banco produção, deploy produção | Alterar middleware, modificar auth |
| **Kimi** (K2.5) | `WorkspaceRead` | Ler código, propor fixes, diagnosticar bugs, revisar testes | Commits autônomos, deploy, banco produção, criar branches | Aplicar fix em código |
| **Codestral** (Mistral) | `WorkspaceRead` | Ler código, refatorar, code completion, sugestões idiomáticas | Banco produção, deploy, commits autônomos, Edge Functions | Aplicar refactor em código |

### Níveis de Permissão (hierarquia)

```
DangerFullAccess  → Tudo (só Claudinho)
WorkspaceWrite    → Ler + escrever código, branches (Buchecha, DeepSeek, Qwen)
WorkspaceRead     → Ler + propor mudanças, sem commit direto (Kimi, Codestral)
ReadOnly          → Apenas leitura (futuro: agentes de auditoria)
Sandbox           → Ambiente isolado, sem acesso a prod (futuro: agentes experimentais)
```

### Ações SEMPRE bloqueadas (independente do nível)

- `rm -rf /` ou qualquer path de sistema
- `DROP TABLE` sem WHERE em banco de produção
- `git push --force` em main/master sem confirmação
- Expor credenciais em logs, arquivos .md ou código-fonte

## Princípios

1. IA como infraestrutura, não como ferramenta
2. Orquestração central com autonomia gradual
3. Memória persistente — nada se perde
4. Especialização por domínio
5. Cross-business — serve todos os negócios
6. Segurança em camadas
7. Propósito integrado — cosmovisão cristã (Theology Mission)

## Referências

- Documento-mãe: `ECOSSISTEMA-INOVACAO-IA.md`
- Pesquisa de ferramentas: `PESQUISA-SKILLS-MCP-2026-04-05.md`
- Classificação: `CLASSIFICACAO-FERRAMENTAS-2026-04-05.md`
- Script CLI: `instalar-mcps-cli.sh`
- Índice de memória: `memory/MEMORY.md`
- Memória central: `/Users/marcelosilva/Projects/GitHub/CENTRAL-MEMORY.md`
- Protocolo de memória: `/Users/marcelosilva/Projects/GitHub/PROTOCOLO-MEMORIA.md`
- Onboarding Kit: `/Users/marcelosilva/Projects/GitHub/ONBOARDING-KIT.md`

## Preferências do Marcelo
- Iniciante em programação — passo a passo detalhado
- Quer ver todas as possibilidades antes de decidir
- Salvar sessões automaticamente (sem precisar pedir)
- Time de 5 IAs especializadas trabalhando em squad
