# Runbooks operacionais

> Procedimentos testáveis passo-a-passo para operações rotineiras do ecossistema.
> Todo runbook deve ser **executável por Marcelo** (dev iniciante) seguindo os passos literalmente.

## Quando usar cada runbook

| # | Runbook | Usar quando |
|---|---|---|
| 01 | [Rotação de credenciais (SC-29)](01-rotacao-credenciais-sc29.md) | Credencial expirou, vazou, ou está no ciclo de rotação periódica |
| 02 | [Adicionar novo negócio ao ecossistema](02-adicionar-novo-negocio-ecossistema.md) | Onboard de novo business unit (ex: Splendori, Nexvy, etc) |
| 03 | [Deploy de nova Edge Function](03-deploy-nova-edge-function.md) | Criar/deployar EF nova no Supabase (ECOSYSTEM ou per-projeto) |
| 04 | [Aplicar migration em ECOSYSTEM](04-aplicar-migration-ecosystem.md) | Schema change em Supabase de produção — slot canônico |
| 05 | [Resposta a incidente (D-Infra + SC-27)](05-resposta-incidente-dinfra-sc27.md) | Agente/EF/serviço com erro P0-P3 em produção |
| 06 | [Rollback de prompt version (Managed Agents)](06-rollback-prompt-version-managed-agents.md) | Nova versão de prompt degradou qualidade do agente |

## Runbooks legados / pendentes

- [`MIGRACAO-VERCEL.md`](MIGRACAO-VERCEL.md) — migração inicial Vercel (já concluída parcialmente)

## Convenções

- **Nome do arquivo:** `NN-tema-kebab.md` (2 dígitos)
- **Toda ação com efeito irreversível** (rotate, delete, deploy prod) tem checkbox de confirmação com Marcelo (Art. II)
- **Smoke test explícito** após cada mudança em produção (Art. VIII)
- **Postmortem obrigatório** para incidentes P0/P1 (runbook 05)
- **Idempotência** — rodar o runbook duas vezes não deve piorar o estado

## Como propor novo runbook

1. Copiar um existente como template
2. Adicionar em `README.md` (este arquivo) com descrição
3. PR + review Marcelo
4. Testar o runbook uma vez em ambiente controlado antes de marcar como canônico
