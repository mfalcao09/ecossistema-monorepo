# ADR-010: C-Suite per negócio + 6 Diretores de Área no ecossistema

- **Status:** aceito
- **Data:** 2026-04-16
- **Decisores:** Marcelo Silva (CEO), Claudinho (VP)
- **Relacionado:** MASTERPLAN-V9 § Parte VI §14 §15 §16 §17 §18, MASTERPLAN-ECOSSISTEMA-v8.2 8 diretores, ADR-001

## Contexto e problema

A V8.2 definia **8 diretores C-Suite globais** no nível ecossistema (CEO, CFO, CAO, CMO, CSO, CLO, COO, CTO). Dois problemas:

1. **Não escala** — um CFO para 5 negócios com realidades muito diferentes (FIC educação, Intentus SaaS, Splendori imobiliário) vira bottleneck cognitivo
2. **Não isola** — um incidente em um negócio contamina contexto de todos

Marcelo precisa atender 5 negócios + ter visão cross-business **sem auditar 30+ agentes um a um**.

## Opções consideradas

- **Opção A:** 8 diretores globais (V8.2, status quo)
- **Opção B:** C-Suite per negócio **sem** governança cross
- **Opção C:** C-Suite per negócio **+** 6 Diretores de Área no ecossistema

## Critérios de decisão

- Escalabilidade para 5 negócios + novos futuros
- Isolamento de contexto por negócio
- Visão cross-business para Marcelo
- Overhead para Marcelo operar

## Decisão

**Escolhemos Opção C** — C-Suite per negócio + 6 Diretores de Área.

**Camada 1 — ECOSSISTEMA:**
- **Claudinho** (VP, Opus 4.6) — orquestrador
- **6 Diretores de Área** (Sonnet 4.6):
  - D-Estrategia · alinhamento BAM
  - D-Sinergia · oportunidades cross-business
  - D-Infra · saúde Managed Agents + Railway + DBs
  - D-Memoria · qualidade memória, drift, decay
  - D-Governanca · compliance 22 Artigos + LGPD + audit
  - D-Relacionamento · experiência Marcelo (Jarvis 4 estágios)

**Camada 2 — NEGÓCIOS (C-Suite per business):**

| Diretor | FIC | Klésis | Intentus | Splendori | Nexvy |
|---|---|---|---|---|---|
| CEO-IA | ✅ | ✅ | ✅ | ✅ | ✅ |
| CFO-IA | ✅ | ✅ | ✅ | ✅ | ✅ |
| CAO-IA | ✅ | ✅ | — | — | — |
| CMO-IA | ✅ | ✅ | ✅ | ✅ | ✅ |
| CSO-IA | ✅ | ✅ | ✅ | ✅ | ✅ |
| CLO-IA | 🟡 | 🟡 | ✅ | ✅ | 🟡 |
| COO-IA | 🟡 | — | ✅ | ✅ | — |
| CTO-IA | — | — | ✅ | — | ✅ |
| CPO-IA | — | — | ✅ | — | ✅ |

**Total:** ~30-35 agentes distribuídos + templates reutilizáveis em `packages/c-suite-templates/`.

## Consequências

### Positivas
- Cada CFO conhece profundamente um negócio (ex: CFO-FIC sabe de Banco Inter + MEC + inadimplência específica)
- D-Governanca audita cross-business automaticamente — Marcelo recebe **um briefing executivo** consolidado
- Templates em `variants/educacao`, `variants/imobiliario`, `variants/saas` reduzem duplicação
- Escalar a novo negócio = instanciar C-Suite + configurar templates (runbook 02)

### Negativas
- Mais agentes = mais tokens/custo
- Mais configuração inicial (mitigado por templates)
- Marcelo precisa entender a camada "Diretores de Área"

### Neutras / riscos
- **Risco:** Diretores perdem sincronia com C-Suite local. **Mitigação:** briefing diário Railway worker (§18) lê `audit_log` de todos os C-Suite + consolida.
- **Risco:** duplicação de persona entre CFO-FIC e CFO-Intentus. **Mitigação:** ambos herdam do template `CFO-IA/base-prompt.md`; cada um ~50 linhas de contexto específico.

## Evidência / pesquisa

- MASTERPLAN-V9 § Parte VI §14-§18 completo
- Mudança de V8.2 (8 globais) para V9 (C-Suite per negócio + 6 Diretores)
- Template validado em `packages/c-suite-templates/` (sessão S11 implementará)

## Ação de implementação

- Templates C-Suite em `packages/c-suite-templates/` (sessão S11)
- 6 Diretores de Área em `packages/diretores-area/` (sessão S11)
- Railway worker `auditDailyDiretorGovernanca` (sessão S14)
- Piloto CFO-FIC como validação (sessão S16)

## Revisão

Revisar quando 3º negócio onboardar (esperado Q3 2026) — validar se overhead de templates ainda compensa.
