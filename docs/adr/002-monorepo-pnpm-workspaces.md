# ADR-002: Monorepo com pnpm workspaces

- **Status:** aceito
- **Data:** 2026-04-15
- **Decisores:** Marcelo Silva (CEO), Claudinho (VP)
- **Relacionado:** MASTERPLAN-V9 § Parte XII, PLANO-EXECUCAO-V4 D5, ADR-015

## Contexto e problema

O ecossistema unifica 3 repos anteriores (Ecossistema, ERP-Educacional, intentus-plataform) e vai crescer com 5 negócios + múltiplos packages compartilhados (`agentes`, `memory`, `credentials`, `billing`, `mcp-servers`, etc.). Opções de organização:

- Multi-repo: 1 repo por package/app. Boa isolação, péssimo DX (version drift, PRs cross-repo).
- Monorepo simples (npm/yarn workspaces): funciona, mas resolução lenta e symlinks frágeis em projetos com 20+ packages.
- pnpm workspaces: hardlinks, symlinks estritos, `overrides`, cache global. Rápido em CI.
- Nx/Turborepo puros: adicionam complexidade de configuração; Nx é opinativo demais para Marcelo iniciante.

Marcelo é dev iniciante. Precisa de setup simples com comando único para instalar tudo. Velocidade de CI importa (~5-10 PRs/dia no pico da Fase 0).

## Opções consideradas

- **Opção 1:** Multi-repo clássico
- **Opção 2:** npm workspaces
- **Opção 3:** pnpm workspaces (+ `turbo` para build cache)
- **Opção 4:** Nx workspace puro

## Critérios de decisão

- Curva de aprendizado para iniciante
- Velocidade de install e de build em CI
- Cross-package refactor (renomear export usado em 5 apps)
- Isolation quando necessário (dependências não vazando)

## Decisão

**Escolhemos Opção 3** — pnpm workspaces (workspace protocol `workspace:*`) + `turbo` apenas para cache de build/test remoto.

Motivo: simplicidade operacional + velocidade real de instalação. Hardlinks do pnpm economizam GB de disco. `turbo` adiciona cache sem impor paradigma.

## Consequências

### Positivas
- `pnpm -r <cmd>` roda cross-package trivialmente
- Cache local + Turbo = CI ~3× mais rápido que yarn classic
- `pnpm-workspace.yaml` mapeia `packages/*` e `apps/*` — FLAT (confirmado S01)
- `pnpm publish` respeita versão do workspace automaticamente

### Negativas
- Symlinks estritos quebram alguns bundlers legados (raro em stack Vite/Next 15)
- Corepack necessário para fixar versão pnpm — instalar global exige sudo (confirmado S01)

### Neutras / riscos
- **Risco:** Marcelo pode rodar `npm install` por engano. **Mitigação:** `packageManager` field em `package.json` + hook (Art. XIX) bloqueia npm.
- **Convenção canônica:** pacotes em `packages/<nome>/` (FLAT), `name` no package.json é `@ecossistema/<nome>` (confirmado S01).

## Evidência / pesquisa

- `pnpm-workspace.yaml` já configurado com `packages/*` e `apps/*`
- Sessão S01 (constitutional-hooks) validou estrutura flat + workspace protocol
- `docs/sessions/logs/LOG-2026-04-17-s3-mcp-template.md` validou workspace para packages Python também
- PLANO-EXECUCAO-V4 D5 decisão pré-existente

## Ação de implementação

- `pnpm-workspace.yaml` na raiz (feito)
- `turbo.json` com pipelines `build`, `test`, `lint` (feito)
- CI GitHub Actions com cache pnpm store + Turbo remote cache

## Revisão

Revisar se # packages > 30 ou tempo install > 2min em CI.
