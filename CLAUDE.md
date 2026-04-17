# CLAUDE.md — Instruções para Agentes IA

> Lido AUTOMATICAMENTE por Claude Code ao abrir este repo. Fonte única de verdade para comportamento de agente.

## Contexto

Este é o monorepo do Ecossistema de Inovação e IA do Marcelo Silva (V4, 2026-04-15). Unifica 3 repos anteriores (Ecossistema, ERP-Educacional, intentus-plataform) em uma estrutura com packages reutilizáveis.

## Leituras obrigatórias ao iniciar sessão

1. `MEMORY.md` neste repo (index de decisões canônicas)
2. `docs/masterplans/PLANO-EXECUCAO-V4.md` (plano 12 semanas)
3. `docs/adr/016-protocolo-sessoes-paralelas.md` (se for trabalhar em paralelo com outras sessões)
4. O briefing específico da sua sessão em `docs/sessions/BRIEFING-SESSAO-*.md` (se fornecido pelo Marcelo)

## Identidade do CEO (essencial)

**Marcelo Silva** — Advogado, Publicitário, Teólogo Evangélico. Empreendedor em 5 negócios: Klésis (ensino básico), FIC (ensino superior), Splendori (imobiliário), Intentus (SaaS imobiliário), Nexvy (SaaS comunicação).

**Cosmovisão:** Business as Mission (BAM) — negócios como veículo de missão. Tripé decisório: Viabilidade Financeira + Impacto Social + Coerência com Propósito.

**Programação:** nível iniciante. Precisa passo a passo em execução, mas entende arquitetura rápido.

## Decisões arquiteturais canônicas (V4)

- **D1.** Agentes rodam em Anthropic Managed Agents + serviços complementares em Railway
- **D2.** Supabase ECOSYSTEM (`gqckbunsfjgerbuiyzvn`) para dados compartilhados; DB per-projeto para domínio
- **D3.** Interface com agentes evolui: CLI → WhatsApp → Voz → Jarvis always-on
- **D4.** Scheduled tasks: pg_cron inicialmente; Trigger.dev conforme necessário
- **D5.** Monorepo pnpm workspaces (este repo)
- **D6.** Piloto de autonomia: ERP-Educacional (usando padrões do Intentus como template)

## Protocolo de memória

Enquanto a Fase 0 não termina, memória persiste via:
- `MEMORY.md` neste repo (índice humano-legível)
- `ecosystem_memory` no Supabase ECOSYSTEM (fonte primária futura)
- Salvar decisões importantes IMEDIATAMENTE, não só no "vou encerrar"

Se o usuário disser **"salva contexto"** ou **"vou encerrar"**: parar trabalho, consolidar o que fez em `MEMORY.md`, commit, push.

## Regras operacionais

1. **Skill-first** — antes de escrever código, checar se existe skill/package que resolve
2. **Human-in-the-loop** — ações irreversíveis (deploy prod, DROP TABLE, revogar credencial) → parar e pedir aprovação
3. **Idempotência** — operações críticas (boleto, webhook) nunca duplicam
4. **Dual-write** — decisões importantes vão para Supabase ECOSYSTEM antes de .md
5. **Testes antes de deploy** — smoke test mínimo antes de ativar qualquer agente em produção
6. **Conventional commits** — `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`
7. **Co-authored commits** — `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
8. **Registro de pendências** — antes de encerrar qualquer sessão, registrar em `docs/sessions/PENDENCIAS.md` toda pendência identificada (config manual, ACL a popular, seed faltando, deploy pendente, débito técnico, teste não executado). Nunca encerrar uma sessão deixando pendência só na conversa — ela some. Se uma sessão anterior deixou pendência que você pode fechar, feche e mova a linha para "Resolvidas" no mesmo PR

## Ações bloqueadas (qualquer contexto)

- `rm -rf /` ou path de sistema
- `DROP TABLE` sem WHERE em produção
- `git push --force` em `main` sem confirmação explícita
- Expor credenciais em logs, .md, ou código-fonte

## Estrutura do repo

```
packages/   → @ecossistema/agentes, memory, credentials, billing, task-registry, rag, tools
apps/       → erp-educacional, intentus, orchestrator (FastAPI Railway), jarvis-app
infra/      → supabase/migrations, railway/, triggerdev/
docs/       → adr/, masterplans/, analises/, sessions/
```

## Comunicação com Marcelo

- **Idioma:** Português brasileiro
- **Tom:** profissional, direto, confiante, acessível — nunca arrogante
- **Sempre indicar** antes de executar: quais skills/agentes vai usar, qual package/app vai mexer
- **Falha explícita** — se não sabe: escala. Nunca inventar. Nunca silenciar erro

## Squad disponível

- **Claudinho** (Opus 4.6) — VP, orquestrador
- **C-Suite** (Sonnet 4.6) — CFO, CAO, CTO, CMO, CSO, CLO, COO
- **Buchecha** (MiniMax M2.7) — líder de código
- **DeepSeek** — SQL, debugging, migrations
- **Qwen** — frontend React/Next
- **Kimi** — diagnóstico de bugs
- **Codestral** — refatoração, idiomática
