# PENDÊNCIAS — Plano vs Execução
> Gerado automaticamente pela automação `plan-audit`
> Masterplan: diploma-digital-v4 + MASTERPLAN-FIC-MULTIAGENTES-v2 (paralelo)
> Última auditoria: 2026-04-26 09:30
> Auditoria anterior: 2026-04-15 09:30

## Backlog (planejado, sem progresso ou parcial)

| Sprint | Epic | Item | Planejado desde | Sessões | Bloqueador |
|--------|------|------|-----------------|---------|------------|
| S2 | E2.2 | Teste e2e completo com Token A3 USB real | 11/04/2026 | 0 | ⛔ Credenciais BRy homologação + Token A3 físico |
| S2 | E2.2 | BRy credenciais homologação (sandbox real) | 11/04/2026 | 0 | ⛔ Aguardando BRy |
| S2 | E2.3 | Lógica comparação XML enviado vs retornado | 11/04/2026 | 0 | — (sem bloqueio técnico) |
| S2 | E2.3 | Auto-accept cosmético + flag humano semântico | 11/04/2026 | 0 | — |
| S2 | E2.3 | Painel de reconciliação | 11/04/2026 | 0 | — |
| S2 | E2.4 | Compressão PDF/A (72dpi+downsampling, threshold 15MB) | 11/04/2026 | 0 | — |
| S8 | — | Fluxo UFMS manual + teste ZIP Kauana + vars BRy Vercel + XML registrado | 15/04/2026 | 0 | — |
| Diploma | F0.7-F0.8 | Continuação Snapshot (caso falte algo após F0.6 ENCERRADA) | 22/04/2026 | F0.6/F1+F2+F3 ✅ | Smoke piloto Kauana pendente |
| Diploma | Smoke | Smoke end-to-end piloto Kauana + merge PR #19 | 22/04/2026 | 0 | — |
| S3v4 | — | RVDD + Portal Diplomado (3 epics) | 10/04/2026 | 0 | Aguarda E2.2 desbloqueio |
| S4v4 | — | Compliance MEC (3 epics) | 10/04/2026 | 0 | Aguarda S3v4 |
| S5v4 | — | Backup + Expedição (3 epics) | 10/04/2026 | 0 | Aguarda S4v4 |
| S6v4 | — | Observabilidade + Testes (3 epics) | 10/04/2026 | 0 | Aguarda S5v4 |
| CFO | S-04 | Importar alunos 2026/1 + descontos + crons + webhook Inter | 15/04/2026 | 0 | ⛔ Credenciais Inter sandbox |
| Atendimento | S4 | Teste WhatsApp real + atribuição agentes + transferência fila | 13/04/2026 | 0 | — |

> Nota: S6=Acervo (s094) ✅ e S7=Pacote Registradora (s095) ✅ concluídos — removidos do backlog.
> S3v4–S6v4 = sprints originais do diploma-digital-v4, distintos dos S6/S7/S8 do pipeline pós-pivot.

## Desvios (feito fora do plano Diploma v4)

| Sessão | Data | O que fez | Classificação |
|--------|------|-----------|---------------|
| F0.4 | 17/04/2026 | Módulo Secretaria + PDFs timbrado/margens + PR #19 (não estava no plano S2) | refinamento/expansão E2.1 |
| F0.5 | 22/04/2026 | PDF texto selecionável Puppeteer + plano arquitetural Snapshot Imutável | refatoração arquitetural |
| F0.6/F1 | 22/04/2026 | Snapshot Imutável Fase 1 (migrations + builder + UI Aba Snapshot) | refatoração arquitetural |
| F0.6/F2 | 22/04/2026 | Snapshot Fase 2 — XMLs lendo snapshot (montador.ts patches) | refatoração arquitetural |
| F0.6/F3 | 22/04/2026 | Snapshot Fase 3 — PDFs via Puppeteer + 2 templates React + 2 rotas /print/* | refatoração arquitetural |

> Obs: F0.4–F0.6 (~14h) entregam arquitetura Snapshot Imutável completa em produção. NÃO previstas no diploma-digital-v4 original, mas decisão arquitetural aprovada por Marcelo na s F0.5. Justificativa: garantir imutabilidade dos artefatos oficiais (XAdES + HUB Signer) lendo do mesmo `dados_snapshot_extracao` JSONB com auditoria em `diploma_snapshot_edicoes`.

## Métricas

| Métrica | Valor |
|---------|-------|
| Sessões no período (16/04–26/04) | 5 sessões (F0.4, F0.5, F0.6/F1, F0.6/F2, F0.6/F3) |
| Sessões no plano original Diploma v4 | 0 sessões diretas |
| Sessões refatoração arquitetural Snapshot | 5 sessões (todas no período) |
| Sessões hotfix/bugfix puro | 0 |
| % fora do plano original | ~100% (todas refatoração) — porém alinhadas via aprovação F0.5 |
| Sprints concluídos no período | 0 (mas Snapshot Imutável completo em produção) |
| E2.2 bloqueado há | 15 dias (desde 11/04/2026) |
| E2.3/E2.4 bloqueados há | 15 dias (sem bloqueio técnico) |
| S8 (UFMS) sem início há | 11 dias |
| Velocidade Diploma | ~14h arquitetura Snapshot entregue em 1 dia (22/04) |
| Sessões totais projeto | 95 + 5 fases F0.x = ~100 |

## Alertas

- 🔴 **CRÍTICO:** E2.2 (BRy OAuth2 + Teste Token A3) bloqueado há 15 dias. Prazo MEC 01/07/2025 **vencido**. Desbloqueio urgente.
- 🔴 **CRÍTICO:** Inter sandbox bloqueia CFO S-04. Sem progresso há 11 dias.
- 🟡 **ATENÇÃO:** E2.3/E2.4 sem bloqueador técnico parados há 15 dias — janela ideal enquanto BRy não destrava.
- 🟡 **ATENÇÃO:** Sprint 8 (UFMS) ainda não iniciado, sem bloqueador.
- 🟡 **ATENÇÃO:** Smoke end-to-end piloto Kauana pendente após F0.6 ENCERRADA — risco de regressão arquitetural não detectada.
- 🟡 **ATENÇÃO:** PR #19 (Secretaria/F0.4) ainda aberta — bloqueia merge das fases F0.5–F0.6.
- 🟠 **RISCO:** S3v4–S6v4 (RVDD, Compliance MEC, Backup, Observabilidade) — 12+ epics sem início. Risco para prazo MEC já vencido.
- 🟢 **POSITIVO:** Arquitetura Snapshot Imutável (5 sessões em 22/04) entrega imutabilidade auditável dos artefatos oficiais. Decisão estratégica robusta.
- 🟢 **POSITIVO:** Nenhum hotfix puro no período — qualidade do que foi entregue manteve produção estável.
