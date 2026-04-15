# CLM Fase 2 — Análise & Planejamento

**Plataforma:** Intentus Real Estate
**Data:** 6 de março de 2026
**Autor:** Claude (assistente técnico de produto)
**Escopo Original:** "Redesign da Central de Comando — 3 semanas"

---

## 1. Diagnóstico: Estado Atual Pós-Fase 1

### 1.1 O que a Fase 1 entregou

A Fase 1 conectou o frontend React à infraestrutura de backend CLM sem redesenhar nada. Resultado: 5 arquivos novos + 3 modificados, deploy em produção com sucesso.

**Conexões estabelecidas na Fase 1:**

| Backend (Postgres) | Frontend (Hook) | Tela |
|---|---|---|
| `fn_get_contracts_near_expiry()` | `useContractsNearExpiry()` | Central de Comando → RealTimeAlerts |
| `fn_get_overdue_installments_for_collection()` | `useOverdueInstallmentsForCollection()` | Central de Comando → RealTimeAlerts |
| `contract_lifecycle_events` | `useContractLifecycleEvents()` | ContractLifecycleTab |
| `contract_lifecycle_events` | `useRecentLifecycleEvents()` | Central de Comando → ActivityFeed |
| `contract_signature_envelopes` | `useContractSignatureEnvelopes()` | ContractSignaturesTab |
| `contract_signature_envelopes` | `usePendingSignatureCount()` | Central de Comando → RealTimeAlerts |

### 1.2 Inventário Completo CLM

**Frontend — 44 arquivos CLM:**
- 6 Páginas: ClmCommandCenter, Contracts, ContractClauses, ContractAnalytics, ContractTemplates, ContractRenewals
- 2 Páginas especializadas: DevContracts (developments/), ExclusivityContracts (comercial/)
- 17 Componentes (dialogs, forms, selectors)
- 8 Tabs no detalhe do contrato
- 12 Hooks
- 3 Libs (clmApi, clmSchema, clmSettingsDefaults)

**Backend — Infraestrutura robusta:**
- 45 Tabelas CLM (incluindo legal_*)
- 10 Funções Postgres
- 26 Triggers (automações, audit trail, lifecycle events)
- 15 Edge Functions CLM-específicas
- 2 Views (contracts_active)
- 3 Enums (contract_status, contract_type, installment_status)

---

## 2. Análise de Gaps: Backend × Frontend

### 2.1 Tabelas SEM consumo frontend (ou consumo parcial)

| Tabela | Linhas | Status | Prioridade |
|---|---|---|---|
| `contract_versions` | 0 | ❌ Sem hook nem UI | ALTA |
| `contract_ai_analysis` | 0 | ❌ Sem hook (AI-HUB) | ALTA |
| `contract_termination_processes` | 0 | ❌ Sem hook | MÉDIA |
| `contract_terminations` | 0 | ❌ Sem hook | MÉDIA |
| `contract_alert_log` | 0 | ❌ Sem hook | MÉDIA |
| `contract_approval_rules` | 0 | ❌ Sem hook | ALTA |
| `contract_parties` | 0 | ⚠️ Sem hook dedicado | ALTA |
| `collection_rules` | 0 | ❌ Sem hook | MÉDIA |
| `collection_events` | 0 | ❌ Sem hook | BAIXA |
| `collection_actions_log` | 0 | ❌ Sem hook | BAIXA |
| `legal_contract_templates` | 0 | ⚠️ Página existe, mas 0 dados (seed pendente) | ALTA |
| `renewal_templates` | 0 | ❌ Sem hook | MÉDIA |

### 2.2 Funções Postgres — Status de Consumo

| Função | Tipo | Consumida? |
|---|---|---|
| `fn_get_contracts_near_expiry()` | RPC | ✅ Fase 1 |
| `fn_get_overdue_installments_for_collection()` | RPC | ✅ Fase 1 |
| `fn_contract_status_automations()` | Trigger | ⚙️ Interno (automático) |
| `fn_create_renewal_alerts()` | Trigger | ⚙️ Interno |
| `fn_log_contract_changes()` | Trigger | ⚙️ Interno |
| `fn_mark_overdue_installments()` | Scheduled | ⚙️ Interno |
| `fn_obligation_overdue_check()` | Trigger | ⚙️ Interno |
| `mark_overdue_installments()` | Scheduled | ⚙️ Interno |
| `notify_overdue_installment()` | Trigger | ⚙️ Interno |
| `on_contract_activated()` | Trigger | ⚙️ Interno |

**Conclusão:** Todas as funções internas (trigger/scheduled) estão operacionais. As 2 RPCs consumer-facing já foram conectadas na Fase 1.

### 2.3 Edge Functions — Status de Consumo

| Edge Function | Tipo | Consumida pelo Frontend? |
|---|---|---|
| `clm-ai-insights` | AI processing | ⚠️ Parcial (hook `useContractDraftAI` existe mas pode não chamar esta) |
| `contract-draft-ai` | AI drafting | ✅ Hook `useContractDraftAI` |
| `parse-contract-ai` | AI parsing | ⚠️ Chamada via AIContractImportDialog |
| `parse-addendum-ai` | AI parsing | ⚠️ Possivelmente chamada via import |
| `extract-clauses-ai` | AI extraction | ⚠️ Possivelmente via import dialog |
| `clm-contract-api` | REST CRUD | ⚠️ Pode ser usado em `clmApi.ts` |
| `clm-templates-api` | REST CRUD | ⚠️ Pode ser usado em templates page |
| `clm-approvals-api` | REST CRUD | ⚠️ Pode ser usado em approvals hook |
| `clm-obligations-api` | REST CRUD | ⚠️ Pode ser usado em obligations hook |
| `clm-lifecycle-processor` | Event-driven | ⚙️ Interno (pgmq → Edge Function) |
| `clm-alert-scheduler` | Scheduled | ⚙️ Interno |
| `clm-scheduled-automations` | Scheduled | ⚙️ Interno |
| `clm-seed-tenant` | One-time setup | ⚠️ Nunca executado (templates vazios) |
| `signature-proxy` | External integration | ⚠️ Placeholder para Clicksign |
| `run-collection` | Scheduled | ⚙️ Interno |

---

## 3. Bug Pendente (Herdado da Fase 1)

**`fn_contract_status_automations()` — Gênero do enum**

O handler de cancelamento pode usar `'cancelada'` (feminino) em vez de `'cancelado'` (masculino) para o `installment_status`. O enum usa formas masculinas: `pendente`, `pago`, `atrasado`, `cancelado`.

**Impacto:** Parcelas de contratos cancelados não seriam atualizadas corretamente.

**Correção:** Verificar e corrigir o SQL na função.

---

## 4. Ação Pré-Fase 2: Seed de Dados

Antes de iniciar a Fase 2, é necessário executar o seed de dados:

```
POST /functions/v1/clm-seed-tenant
Authorization: Bearer <service_role_key>
```

Isso populará `legal_contract_templates` com templates iniciais, sem os quais a página de Templates ficará vazia.

---

## 5. Escopo da Fase 2 — PRD Estruturado

### 5.1 Problema

A Central de Comando CLM foi criada rapidamente na fase de backend com layout genérico. Embora funcional, ela não maximiza o potencial da infraestrutura construída (45 tabelas, 10 funções, 26 triggers, 15 Edge Functions). Muitos recursos backend estão ociosos — sem UI que os exponha ao usuário.

### 5.2 Contexto

A Fase 1 provou que a abordagem incremental funciona: sem redesenhar, apenas conectar. A Fase 2 vai além: redesenhar a Central de Comando para ser o "cockpit" completo de gestão contratual, expondo funcionalidades que o backend já suporta mas o frontend ainda não consome.

### 5.3 Solução Proposta — 5 Épicos

---

#### ÉPICO 1: Central de Comando Redesenhada (MUST HAVE)
**Estimativa: 5 dias**

**O que muda:**
- Layout atual: cards estáticos + listas simples
- Layout novo: dashboard interativo com KPIs em tempo real, filtros globais, e drill-down

**User Stories:**

1. **Como** gestor, **quero** ver KPIs consolidados (total de contratos, valor total, vencimentos próximos, inadimplência) no topo da Central, **para** ter visão executiva instantânea.

2. **Como** gestor, **quero** filtrar toda a Central por período, tipo de contrato, status e empreendimento, **para** focar no que é relevante no momento.

3. **Como** gestor, **quero** ver um gráfico de distribuição de contratos por status (pipeline visual), **para** entender onde está concentrada a carteira.

4. **Como** gestor, **quero** que os alertas críticos (vencimentos ≤15d, inadimplência) tenham ações rápidas (renovar, cobrar, notificar), **para** agir sem sair da Central.

5. **Como** gestor, **quero** ver o feed de atividades com filtros por tipo de evento (criação, aprovação, assinatura, renovação), **para** acompanhar o que está acontecendo sem ruído.

**Critérios de Aceite:**
- Dashboard carrega em ≤3 segundos
- KPIs atualizados em tempo real (Supabase Realtime ou polling 5min)
- Filtros persistem na sessão do usuário
- Responsivo (funciona em tablet)
- Todas as queries invalidam corretamente no refresh

**Componentes/Hooks a criar:**
- `CommandCenterKPIs` (novo componente)
- `CommandCenterFilters` (novo componente)
- `ContractPipelineChart` (novo componente - recharts)
- `useContractKPIs()` (novo hook - aggregation query)
- Refatorar `RealTimeAlerts` para incluir ações rápidas
- Refatorar `ActivityFeed` para incluir filtros

---

#### ÉPICO 2: Regras de Aprovação & Workflow (MUST HAVE)
**Estimativa: 4 dias**

**Problema:** `contract_approval_rules` tem 0 linhas. Sem regras, o workflow de aprovação não funciona. O backend está pronto (trigger `trg_approval_chain_notification` + Edge Function `clm-approvals-api`), mas não há UI para configurar.

**User Stories:**

1. **Como** admin, **quero** configurar regras de aprovação por tipo/valor de contrato (ex: contratos >R$500k precisam de 2 aprovadores), **para** garantir governança.

2. **Como** aprovador, **quero** ver contratos pendentes de minha aprovação na Central de Comando com botões aprovar/rejeitar, **para** não atrasar o processo.

3. **Como** gestor, **quero** ver o histórico de aprovações de cada contrato na aba de detalhes, **para** ter rastreabilidade completa.

**Critérios de Aceite:**
- CRUD completo de regras de aprovação
- Regras podem ser condicionais (tipo, valor mínimo, empreendimento)
- Aprovação/rejeição com motivo obrigatório
- Notificação (notification bell) quando contrato entra na fila
- Audit trail registra cada aprovação/rejeição

**Componentes/Hooks a criar:**
- `ApprovalRulesManager` (novo componente)
- `useContractApprovalRules()` (novo hook)
- `ApprovalWorkflowPanel` (dentro da Central)
- Expandir `useContractApprovals()` com mutations (aprovar/rejeitar)

---

#### ÉPICO 3: Gestão de Partes & Versionamento (SHOULD HAVE)
**Estimativa: 3 dias**

**Problema:** `contract_parties` e `contract_versions` não têm hooks nem UI. Partes (compradores, vendedores, fiadores, testemunhas) são essenciais para contratos imobiliários. Versionamento permite rastrear alterações em minutas.

**User Stories:**

1. **Como** jurídico, **quero** cadastrar todas as partes de um contrato (com papel: comprador, vendedor, fiador, testemunha), **para** ter registro completo das relações contratuais.

2. **Como** jurídico, **quero** ver o histórico de versões de um contrato (quem alterou, quando, diff), **para** rastrear evolução da minuta.

**Critérios de Aceite:**
- CRUD de partes vinculadas a contratos
- Cada parte tem: nome, CPF/CNPJ, papel, dados de contato
- Versionamento automático ao salvar contrato (trigger já existe: `trg_contract_audit_on_change`)
- Visualização de diff entre versões

**Componentes/Hooks a criar:**
- `ContractPartiesTab` (nova aba no detalhe)
- `useContractParties()` (novo hook)
- `ContractVersionsTab` (nova aba no detalhe)
- `useContractVersions()` (novo hook)

---

#### ÉPICO 4: Cobrança & Inadimplência (SHOULD HAVE)
**Estimativa: 4 dias**

**Problema:** `collection_rules`, `collection_events`, `collection_actions_log` estão vazios. A Edge Function `run-collection` existe mas sem UI para configurar regras ou visualizar resultados. Backend de cobrança completo, frontend zero.

**User Stories:**

1. **Como** financeiro, **quero** configurar regras de cobrança automática (ex: "3 dias após vencimento, enviar SMS; 7 dias, enviar e-mail; 15 dias, notificação extrajudicial"), **para** automatizar o processo de cobrança.

2. **Como** financeiro, **quero** ver um painel de inadimplência com aging (0-30d, 31-60d, 61-90d, >90d), **para** priorizar ações de cobrança.

3. **Como** gestor, **quero** ver o log de ações de cobrança executadas por contrato, **para** saber o que já foi feito com cada inadimplente.

**Critérios de Aceite:**
- CRUD de regras de cobrança (collection_rules)
- Dashboard de aging com gráfico de barras
- Log de ações executadas por contrato
- Integração com sistema de alertas existente

**Componentes/Hooks a criar:**
- `CollectionRulesManager` (novo componente)
- `CollectionDashboard` (novo componente ou seção na Central)
- `useCollectionRules()` (novo hook)
- `useCollectionEvents()` (novo hook)
- `useCollectionActionsLog()` (novo hook)

---

#### ÉPICO 5: Templates & AI Insights (COULD HAVE)
**Estimativa: 3 dias**

**Problema:** `legal_contract_templates` tem 0 linhas (seed não executado). A Edge Function `clm-ai-insights` existe mas não tem consumo claro no frontend. `contract_ai_analysis` (AI-HUB) está vazia.

**User Stories:**

1. **Como** jurídico, **quero** criar e gerenciar templates de contrato com variáveis dinâmicas ({{comprador}}, {{valor}}, {{empreendimento}}), **para** agilizar a geração de minutas.

2. **Como** gestor, **quero** ver insights de AI sobre meus contratos (riscos, anomalias, recomendações), **para** tomar decisões informadas.

**Critérios de Aceite:**
- CRUD de templates com editor de variáveis
- Preview de template preenchido
- Painel de AI insights na Central de Comando
- AI analysis armazenada em `contract_ai_analysis` (AI-HUB)

**Componentes/Hooks a criar:**
- Expandir página ContractTemplates com editor
- `useContractTemplates()` (novo hook ou expandir existente)
- `AIInsightsPanel` (novo componente)
- `useContractAIAnalysis()` (novo hook)
- `useAIInsights()` (novo hook para Edge Function `clm-ai-insights`)

---

## 6. Priorização RICE

| Épico | Reach | Impact | Confidence | Effort (dias) | Score |
|---|---|---|---|---|---|
| 1. Central Redesenhada | 10 | 9 | 9 | 5 | **162** |
| 2. Regras de Aprovação | 8 | 9 | 8 | 4 | **144** |
| 4. Cobrança & Inadimplência | 7 | 8 | 7 | 4 | **98** |
| 3. Partes & Versionamento | 6 | 7 | 9 | 3 | **126** |
| 5. Templates & AI | 5 | 7 | 6 | 3 | **70** |

**Fórmula:** (Reach × Impact × Confidence) / Effort

**Ordem recomendada:**
1. Central Redesenhada (RICE: 162) — fundação visual
2. Regras de Aprovação (RICE: 144) — governança
3. Partes & Versionamento (RICE: 126) — completude contratual
4. Cobrança & Inadimplência (RICE: 98) — valor financeiro
5. Templates & AI (RICE: 70) — otimização

---

## 7. Cronograma Proposto — 3 Semanas

### Semana 1 (Dias 1-5): Fundação + Governança
| Dia | Épico | Entrega |
|---|---|---|
| D1 | Pré-requisito | Executar `clm-seed-tenant` + fix bug `cancelada/cancelado` |
| D1-D2 | Épico 1 | KPIs + Filtros globais + Pipeline chart |
| D3 | Épico 1 | Ações rápidas nos alertas + Feed com filtros |
| D4 | Épico 2 | CRUD de regras de aprovação |
| D5 | Épico 2 | Painel de aprovações pendentes + botões aprovar/rejeitar |

### Semana 2 (Dias 6-10): Completude + Cobrança
| Dia | Épico | Entrega |
|---|---|---|
| D6 | Épico 2 | Finalizar workflow + notificações |
| D7 | Épico 3 | ContractPartiesTab + hook |
| D8 | Épico 3 | ContractVersionsTab + diff viewer |
| D9 | Épico 4 | CollectionRulesManager + hook |
| D10 | Épico 4 | Dashboard de aging + CollectionDashboard |

### Semana 3 (Dias 11-15): Cobrança + AI + Polish
| Dia | Épico | Entrega |
|---|---|---|
| D11 | Épico 4 | Log de ações + integração alertas |
| D12 | Épico 5 | Editor de templates com variáveis |
| D13 | Épico 5 | AI Insights panel + hooks |
| D14 | QA | Testes integrados, fix de edge cases |
| D15 | Deploy | Code review final + deploy produção |

---

## 8. Riscos & Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Tabelas com 0 linhas dificultam testes | Alta | Médio | Executar seed + criar dados de teste |
| Bug `cancelada/cancelado` causa falhas silenciosas | Média | Alto | Corrigir antes de qualquer trabalho |
| Complexidade do diff viewer (Épico 3) | Média | Médio | Usar library existente (diff2html) ou simplificar para lista de mudanças |
| Edge Functions CLM não testadas em produção | Média | Alto | Testar cada uma isoladamente antes de conectar ao frontend |
| Escopo de 3 semanas pode ser apertado | Média | Alto | Épicos 4 e 5 podem migrar para Fase 2.5 se necessário |

---

## 9. Métricas de Sucesso

| Métrica | Baseline (Hoje) | Meta Fase 2 |
|---|---|---|
| Tabelas CLM com dados | 0 de 45 | ≥15 com dados reais |
| Hooks CLM | 12 | ≥20 |
| Tempo para aprovar contrato | N/A (manual) | <2 min via UI |
| Cobertura de regras de cobrança | 0 regras | ≥3 regras ativas |
| Templates disponíveis | 0 | ≥5 templates seeded |
| KPIs visíveis na Central | 0 | ≥6 KPIs em tempo real |

---

## 10. Dependências Técnicas

1. **Supabase Realtime** — KPIs em tempo real precisam de subscription ou polling
2. **recharts** — Já presente no projeto (pipeline chart, aging chart)
3. **date-fns** — Já presente (formatDistanceToNow, format, ptBR)
4. **@tanstack/react-query** — Já configurado (invalidation, refetch)
5. **Clicksign** — NÃO é dependência da Fase 2 (adiada para Fase 3)

---

## 11. Escopo Negativo (O que NÃO está na Fase 2)

- ❌ Integração real com Clicksign/DocuSign (Fase 3)
- ❌ Redesign de páginas fora da Central de Comando
- ❌ Portal do cliente
- ❌ Integrações bancárias para cobrança (apenas configuração de regras)
- ❌ Mobile-first redesign (apenas responsivo tablet)
- ❌ Migração de dados legados
- ❌ Multi-idioma

---

## 12. Caminhos Alternativos

Marcelo, existem **3 abordagens possíveis** para a Fase 2:

### Caminho A: "Tudo em 3 semanas" (Recomendado)
Todos os 5 épicos no cronograma acima. Risco moderado de atraso nos épicos 4-5.

### Caminho B: "Core primeiro, AI depois"
Apenas épicos 1-3 em 2 semanas (12 dias). Épicos 4-5 viram Fase 2.5. Menor risco, entrega mais rápida do essencial.

### Caminho C: "Incremental contínuo"
1 épico por semana, deploy a cada sexta. 5 semanas no total. Máxima segurança, valor entregue toda semana, mas timeline mais longa.

**Recomendação:** Caminho A com fallback para B se semana 1 atrasar. Os épicos 4 e 5 são "should/could have" — podem migrar sem prejudicar o core.
