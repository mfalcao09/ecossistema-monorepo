# PENDÊNCIAS — Plano vs Execução
> Gerado automaticamente pela automação `plan-audit`
> Masterplan: diploma-digital-v4 + MASTERPLAN-FIC-MULTIAGENTES-v2 (paralelo)
> Última auditoria: 2026-04-15 09:30

## Backlog (planejado, sem progresso ou parcial)

| Sprint | Epic | Item | Planejado desde | Sessões | Bloqueador |
|--------|------|------|-----------------|---------|------------|
| S2 | E2.2 | Teste e2e completo com Token A3 USB real | 11/04/2026 | 0 | ⛔ Credenciais BRy homologação + Token A3 físico |
| S2 | E2.2 | BRy credenciais homologação (sandbox real) | 11/04/2026 | 0 | ⛔ Aguardando BRy |
| S2 | E2.3 | Lógica comparação XML enviado vs retornado | 11/04/2026 | 0 | — |
| S2 | E2.3 | Auto-accept para case/acentuação | 11/04/2026 | 0 | — |
| S2 | E2.3 | Flag humano para nomes/datas/códigos | 11/04/2026 | 0 | — |
| S2 | E2.3 | Painel de reconciliação | 11/04/2026 | 0 | — |
| S2 | E2.4 | Pass de compressão PDF/A (72dpi+downsampling) | 11/04/2026 | 0 | — |
| S2 | E2.4 | Verificação pós-compressão (válido PDF/A?) | 11/04/2026 | 0 | — |
| S2 | E2.4 | Threshold >15MB comprime, <15MB mantém | 11/04/2026 | 0 | — |
| S8 | — | Fluxo UFMS manual + teste ZIP Kauana + vars BRy Vercel + XML registrado | 15/04/2026 | 0 | — |
| S3v4 | — | RVDD + Portal Diplomado (3 epics) | — | 0 | Aguarda E2.2 desbloqueio |
| S4v4 | — | Compliance MEC (3 epics) | — | 0 | Aguarda S3v4 |
| S5v4 | — | Backup + Expedição (3 epics) | — | 0 | Aguarda S4v4 |
| CFO | S-04 | Importar alunos 2026/1 + descontos + testar crons + webhook Inter | 15/04/2026 | 0 | ⛔ Credenciais Inter sandbox |
| Atendimento | S4 | Teste WhatsApp real + atribuição agentes + transferência fila | 13/04/2026 | 0 | — |

> Nota: S6=Acervo Digital ✅ (s094) e S7=Pacote Registradora ✅ (s095) foram concluídos neste período. Removidos do backlog.
> S3v4/S4v4/S5v4 = sprints do masterplan diploma-digital-v4 original (RVDD/Compliance/Backup), distintos dos novos S6-S8 do pipeline.

## Desvios (feito fora do plano Diploma v4)

| Sessão | Data | O que fez | Classificação |
|--------|------|-----------|---------------|
| 083 | 12/04/2026 | Módulo Financeiro (CFO S-01) inaugurado — 4 tabelas + Python runtime + boletos esqueleto | expansão ERP planejada |
| 084 | 13/04/2026 | CFO S-02 emit-boletos.py completo (OAuth2+mTLS Inter, Bolepix, PDF, Resend) | expansão ERP planejada |
| 085 | 12/04/2026 | Atendimento S1 — 9 tabelas Supabase + UI TopBar + vercel.json | expansão ERP planejada |
| 086-088 | 12-13/04/2026 | Análise Nexvy 38 prints + roadmap 10 sprints Atendimento | planejamento/exploração |
| 089-089b | 13/04/2026 | Webhook WABA Meta validado E2E (schema atendimento_* corrigido) | expansão ERP planejada |
| 090 | 13/04/2026 | Atendimento S3 — Tela de Conversas 3 painéis completa | expansão ERP planejada |
| 091 | 13/04/2026 | Hotfixes cadastro usuários (CSRF+Roles+Senha) + título do site | manutenção/hotfix |
| 092 | 14/04/2026 | CFO S-03 Régua de Cobrança Completa (3 tabelas + 6 endpoints Python) | expansão ERP planejada |

> Obs: Sessões 083-092 fazem parte do MASTERPLAN-FIC-MULTIAGENTES-v2 (paralelo). Não são hotfixes aleatórios, mas representam desvio do masterplan primário diploma-digital-v4.

## Métricas

| Métrica | Valor |
|---------|-------|
| Sessões no período (s091-s095) | 5 sessões |
| Sessões no plano Diploma v4 | 3 sessões (s093 diagnóstico S2, s094 S6, s095 S7) |
| Sessões desvio/expansão | 2 sessões (s091 manutenção, s092 CFO S-03) |
| % fora do plano Diploma | ~40% (melhora vs 89% na auditoria anterior) |
| Sprints concluídos no período | 2 (S6 Acervo + S7 Pacote Registradora) ✅ |
| E2.2 bloqueado há | 4 dias (desde 11/04/2026) |
| E2.3/E2.4 bloqueados há | 4 dias (desde 11/04/2026) — sem bloqueador técnico |
| Velocidade Diploma | 2 novos sprints (S6+S7) entregues em 2 sessões |
| CFO módulos entregues | S-01 ✅ S-02 ✅ S-03 ✅ (régua completa) |

## Alertas

- 🔴 **CRÍTICO:** E2.2 (BRy OAuth2 + Teste e2e real) bloqueado por credenciais de homologação desde 11/04/2026 (4 dias). Prazo MEC 01/07/2025 **já expirado** — desbloqueio urgente.
- 🔴 **CRÍTICO:** Inter sandbox credentials bloqueiam CFO S-04 (emissão real de boleto).
- 🟡 **ATENÇÃO:** E2.3 e E2.4 (Reconciler + Compressão PDF/A) sem sessão agendada há 4 dias. Sem bloqueador técnico — podem ser feitos enquanto BRy está bloqueado.
- 🟡 **ATENÇÃO:** Sprint 8 (Envio UFMS) é próxima sessão 096. Não tem bloqueador — pode iniciar imediatamente.
- 🟡 **ATENÇÃO:** Atendimento S4 (WhatsApp real + agentes) sem sessão agendada.
- 🟠 **RISCO:** S3v4/S4v4/S5v4 (RVDD, Compliance MEC, Backup) — 9+ epics sem início. Risco de prazo MEC.
- 🟢 **MELHORA:** % desvio caiu de 89% para 40% (s091-s095). Retorno ao foco no Diploma.
- 🟢 **OK:** S6 ✅ + S7 ✅ entregues. Pipeline diploma tem caminho claro até S8→S9.
