# Consolidado Widgets — Benchmark Nexvy × outros SaaS

**Data:** 2026-04-23
**Fonte:** análise dos 120 vídeos em `docs/research/nexvy-outrossaas/` (Chatwoot, Digisac, Whaticket, Zaapy, PressTicket)
**Destino:** PR B do ADR-020 — expansão do `atendimento_widget_catalog`

## Bruto extraído por plataforma

| Plataforma      | Vídeos  | Widgets candidatos | Destaque                                                        |
| --------------- | ------- | ------------------ | --------------------------------------------------------------- |
| Chatwoot        | 6       | 7                  | CSAT trend + reply-time heatmap + automation audit              |
| Digisac         | 57      | 7                  | real-time abas ("Agora") + TMA/PTA + NPS                        |
| Whaticket       | 10      | 10                 | queue status + transfer chain + quick replies usage             |
| Zaapy           | 29      | 15                 | **vídeo dedicado** ao dashboard (9i9-NBZHuaw) + sentimento + IA |
| PressTicket     | 18      | 12                 | mini-CRM inline + campanhas + Eleven Labs voz                   |
| **Total bruto** | **120** | **51**             | —                                                               |

## Deduplicação + priorização (51 → 15)

Critérios de corte:

1. **Já temos no PR A** (17 widgets no catálogo) → descartado.
2. **Feature de conversa/ticket, não de dashboard** → descartado.
3. **Dados já disponíveis no backend** → **P1**.
4. **Precisa RPC/coluna nova, mas roadmap claro** → **P2**.
5. **Precisa módulo inteiro novo (ex: NPS, campanhas)** → **P3 / fora do PR B**.

### P1 — dados já disponíveis (10 widgets, PR B imediato)

| #   | slug                         | categoria  | fonte                                                                                                      | backend                                                 |
| --- | ---------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | `agent_workload_live`        | `quality`  | Chatwoot `sx-pDFsLQ5M@51`, Zaapy `9i9-NBZHuaw@01:52`, Whaticket `AcenJ0NS6_M`, Digisac `Qt7QG5uPoRo@04:43` | `atendimento_agents` + `atendimento_conversations` live |
| 2   | `live_queue_status`          | `status`   | Whaticket `p8f1d9kA0Ig` + Digisac `zC2vEv1DYQM@21:04`                                                      | `atendimento_queues` + conv.pending                     |
| 3   | `messages_throughput`        | `chart`    | Zaapy `9i9-NBZHuaw@00:41-00:44` + Digisac `Qt7QG5uPoRo@10:33`                                              | `metrics_snapshots.messages_in/out` já                  |
| 4   | `channel_performance`        | `chart`    | Chatwoot `5XmbQfAHsBY@4-37` + Zaapy `9i9-NBZHuaw@01:39`                                                    | `metrics_snapshots.volume_by_inbox` já                  |
| 5   | `kanban_pipeline_mini`       | `crm`      | Whaticket `0J0VLpe90s8` + Zaapy `RoV0eXJwkVs` + PressTicket `M3m-46Kbleg`                                  | `pipelines` + `deals`                                   |
| 6   | `scheduled_messages_pending` | `activity` | Whaticket `QNG9A3gXNrg` + Zaapy `DoYw8muE66Y@08:14`                                                        | S5 `scheduled_messages` já                              |
| 7   | `conversation_funnel`        | `chart`    | Chatwoot `LWhHxVI1Gvw@23-26` + PressTicket `4BgG0emPBVE`                                                   | RPC `get_conversation_funnel` do S7 já existe           |
| 8   | `transfer_chain_trace`       | `activity` | Whaticket `X5oXDpgV3wE` + Digisac `fbveo8QJJgM`                                                            | `conversation_events` (já usado pela S3)                |
| 9   | `quick_replies_usage`        | `activity` | Whaticket `dFaX1QRG_g4` + `1lD0HQ_Tokg`                                                                    | templates + mensagens com template_id                   |
| 10  | `automation_execution_audit` | `custom`   | Chatwoot `LWhHxVI1Gvw@3-26` + Digisac `zC2vEv1DYQM@26:12`                                                  | `automation_rule_runs` (S8a)                            |

### P2 — dados parcialmente disponíveis (3 widgets)

| #   | slug                        | categoria  | fonte                                                                     | gap backend                                                      |
| --- | --------------------------- | ---------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 11  | `reply_time_heatmap`        | `chart`    | Chatwoot `sx-pDFsLQ5M@46`                                                 | RPC nova — matriz hora×dia de `first_response_sec`               |
| 12  | `classification_tags_cloud` | `chart`    | Chatwoot `sx-pDFsLQ5M@26-48` + Zaapy                                      | S8b já tem tags em conversas — só agregar                        |
| 13  | `ai_assistant_status`       | `agent_ia` | Zaapy `Hs1lNBbXX2k` + PressTicket `q7UqPS2ZLfM` (GPT-4 Mini, temperatura) | S10 `ds_agentes` tem config; expor modelo/temperatura no payload |

### P3 — fora do PR B (precisam módulo / dados novos)

| slug                        | por que ficar fora                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `csat_sentiment_trend`      | Precisa módulo de pesquisa pós-atendimento (CSAT/NPS). Virou epic próprio.                                         |
| `campaigns_status`          | PressTicket `vTeNur7wFzk` — não temos módulo de campanhas outbound ainda.                                          |
| `eleven_labs_voice`         | PressTicket `bcCx82ekFBg` — feature de DS Voice, não de dashboard central.                                         |
| `segunda_via_boleto`        | PressTicket `7RblwKisJm4` — é do módulo financeiro (CFO), não atendimento.                                         |
| `flowchart_builder_preview` | Zaapy `SZqXgqfIDdw` — mini-editor embed é complexo; virar épico separado.                                          |
| `horarios_expediente`       | PressTicket `Ca0JQgUqX-Y` — pode virar widget simples, mas depende de tabela `business_hours` ainda não existente. |

### Rejeitado (feature, não widget)

- Dashboard com Knowledge Base inline (Chatwoot)
- Mini-CRM inline no ticket (PressTicket)
- Filtros avançados globais (Zaapy) — **virou recomendação UX**
- Reações emoji (Digisac)
- Supervisão ao vivo (Zaapy)
- Formulário pré-chat (Chatwoot)

## Recomendações UX (não-widget) — considerar em sprint de polimento

1. **Filtros avançados globais** (Zaapy `EwfLh4stjC4@01:30` + Digisac `zC2vEv1DYQM@09:07`) — drawer único que aplica a todos os widgets (data + departamento + atendente + tag). Salva presets por usuário.
2. **Status bar topo direita** (extensão do Whaticket recommendation) — sumário ao-vivo "3 online · 2 em pausa · 5 filas com espera" — clique abre modal detalhado. Coloca-se no layout do app como banner persistente, não no catálogo.
3. **Abas contextuais "Agora" no cabeçalho** (Digisac `zC2vEv1DYQM@21:04`) — tabs rápidas na home: Geral · Em Atendimento · Por Departamento · Por Atendente. Seria um refinamento do `DashboardHeader`.

## Plano de execução PR B

**Scope:** 10 widgets P1 + 3 widgets P2 = **13 widgets** no catálogo.

Formato: 1 PR só.

1. **Migration** `20260501_atendimento_widget_catalog_expand.sql`: INSERT ... ON CONFLICT DO UPDATE dos 13 novos `catalog_slug`. Migration extra para RPC nova (`get_reply_time_heatmap`).
2. **Componentes**: `MetricWidgets.tsx` ganha 4 novos gráficos; `ComponentWidgets.tsx` ganha 9 novos. Registradores em `WidgetRenderer.tsx`.
3. **Sem mudança** em tabelas core — só catalog.
4. **Tamanho estimado:** ~900 linhas (vs 3k do PR A).

Recomendações UX ficam **fora do PR B** — vão como sprint S8c de polimento separada.

## Decisão pendente

- Aprovar os 13 widgets da lista P1+P2?
- Ajustes (adicionar do P3 / remover algum)?
- Autorização para começar o PR B nesta sessão ou esperar validação visual do PR A primeiro?
