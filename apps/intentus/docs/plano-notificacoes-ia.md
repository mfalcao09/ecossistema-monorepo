# Plano: Notificações Automáticas com IA

**Data:** 08/03/2026
**Status:** Planejamento — infraestrutura de notificações existente, IA a ser integrada

---

## Estado Atual da Infraestrutura

### O que já existe

1. **Sistema de notificações completo** (`src/hooks/useNotifications.ts`):
   - 7 categorias: sistema, contrato, cobrança, aprovação, vencimento, alerta, **ia**
   - CRUD completo: criar, listar, marcar como lida, marcar todas, excluir
   - Realtime via Supabase channel (`postgres_changes` INSERT)
   - Contagem de não-lidas com refresh a cada 15s
   - Navegação por referência (`contract`, `installment`, `approval`, `template`)
   - Tempo relativo formatado ("há 2 min", "há 3h")
   - Função utilitária `createNotification()` pronta para uso

2. **Preferências de notificação** (`src/hooks/useNotificationPreferences.ts`):
   - Por categoria × role
   - Email habilitado/desabilitado
   - In-app habilitado/desabilitado
   - Frequência: imediato, diário, semanal
   - Upsert com `tenant_id`

3. **Tabelas Supabase:**
   - `notifications` (id, user_id, title, message, category, reference_type, reference_id, read, tenant_id)
   - `notification_preferences` (id, tenant_id, role, category, email_enabled, in_app_enabled, frequency)

4. **UI existente:**
   - Ícone de sino no header com badge de contagem
   - Painel de notificações (dropdown ou página)
   - Tela de configuração de preferências em ClmSettings

### O que falta

1. **Triggers automáticos** — Ninguém chama `createNotification()` automaticamente. Todas as notificações teriam que ser criadas manualmente.
2. **IA para gerar conteúdo** — As notificações são texto estático. Não há análise inteligente.
3. **Envio de email** — O campo `email_enabled` existe mas não há integração com serviço de email.
4. **Agendamento** — Frequência "diário" e "semanal" existem na config mas não há cron/scheduler.

## Arquitetura Proposta

```
                     ┌─────────────────────────┐
                     │   Triggers Automáticos   │
                     │                          │
                     │  • Vencimento em 30/15/7d │
                     │  • Contrato sem ação 7d+  │
                     │  • Reajuste pendente      │
                     │  • Aprovação aguardando   │
                     │  • Análise IA concluída   │
                     └──────────┬──────────────┘
                                │
                     ┌──────────▼──────────────┐
                     │  Edge Function           │
                     │  `clm-notifications-ai`  │
                     │                          │
                     │  1. Consulta contexto     │
                     │  2. Gera texto via LLM    │
                     │  3. Insere notificação    │
                     │  4. (Futuro) Envia email  │
                     └──────────┬──────────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
              ┌─────▼─────┐ ┌──▼───┐ ┌────▼────┐
              │ In-App    │ │Email │ │WhatsApp │
              │(Realtime) │ │(TBD) │ │ (TBD)  │
              └───────────┘ └──────┘ └─────────┘
```

## Plano de Implementação

### Etapa 1: Triggers Automáticos sem IA (3h)

Criar Edge Function `clm-auto-notifications` que roda via pg_cron (diário, 08:00):

**Trigger 1 — Vencimentos próximos:**
```sql
SELECT c.id, c.end_date, cp.people_id, p.name
FROM contracts c
JOIN contract_parties cp ON cp.contract_id = c.id
JOIN people p ON p.id = cp.people_id
WHERE c.status = 'ativo'
AND c.end_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
AND NOT EXISTS (
  SELECT 1 FROM notifications n
  WHERE n.reference_id = c.id
  AND n.category = 'vencimento'
  AND n.created_at > NOW() - INTERVAL '7 days'
);
```
→ Cria notificação: "O contrato de [imóvel] com [locatário] vence em [X] dias."

**Trigger 2 — Contratos sem ação:**
```sql
SELECT c.id, c.updated_at
FROM contracts c
WHERE c.status = 'rascunho'
AND c.updated_at < NOW() - INTERVAL '7 days';
```
→ Notificação: "O contrato [título] está parado há [X] dias. Deseja retomar?"

**Trigger 3 — Reajustes pendentes:**
```sql
SELECT c.id, c.adjustment_index, c.adjustment_date
FROM contracts c
WHERE c.status = 'ativo'
AND c.adjustment_date IS NOT NULL
AND c.adjustment_date <= NOW()
AND NOT EXISTS (
  SELECT 1 FROM contract_adjustments ca
  WHERE ca.contract_id = c.id
  AND ca.adjustment_date = c.adjustment_date
);
```
→ Notificação: "O contrato [título] tem reajuste pendente pelo [índice]. O índice acumulado é [X%]."

**Trigger 4 — Aprovações aguardando:**
```sql
SELECT aw.id, aw.contract_id, aw.created_at
FROM approval_workflows aw
WHERE aw.status = 'pending'
AND aw.created_at < NOW() - INTERVAL '2 days';
```
→ Notificação: "Aprovação pendente há [X] dias para o contrato [título]."

### Etapa 2: IA para Mensagens Contextuais (4h)

Em vez de mensagens estáticas, usar LLM para gerar texto natural e contextualizado:

**Edge Function `clm-notifications-ai`:**
1. Coleta contexto do contrato (valor, partes, datas, tipo, histórico)
2. Envia prompt ao LLM (Gemini 2.0 Flash via OpenRouter, mesmo dos outros AIs):

```
Você é o assistente de notificações do CLM Intentus.
Gere uma notificação curta (máx 2 frases) e acionável para o seguinte evento:

Evento: {tipo_trigger}
Contrato: {titulo} — {tipo} — R$ {valor}/mês
Partes: {locador} (locador) ↔ {locatario} (locatário)
Imóvel: {endereco}
Contexto: {detalhes_específicos}

A notificação deve ser:
- Profissional mas amigável
- Específica (mencionar nomes e valores)
- Com call-to-action claro
- Em português brasileiro
```

3. Resultado exemplo: "O contrato de locação do apto 302 (Centro) com Maria Silva vence em 15 dias. Considere iniciar a renovação — o valor atual de R$ 2.500 está 8% abaixo do mercado segundo sua última análise."

### Etapa 3: Integração de Chamadas no Frontend (2h)

Adicionar `createNotification()` nos pontos-chave:

| Evento | Onde | Notificação |
|--------|------|-------------|
| Contrato criado | `useContracts.create()` | Categoria: `contrato` |
| Análise IA concluída | `usePricingAI.generate()` | Categoria: `ia` |
| Contrato aprovado/rejeitado | `ApprovalWorkflowPanel` | Categoria: `aprovacao` |
| Import concluído | `useContractImportAI` | Categoria: `contrato` |
| Draft IA gerado | `useContractDraftAI` | Categoria: `ia` |

### Etapa 4: Email Digest (4h)

1. **Serviço de email:** Resend (simples, API-first, free tier 100 emails/dia)
2. **Edge Function `clm-email-digest`** (pg_cron, diário 07:00):
   - Busca notificações não-lidas das últimas 24h
   - Agrupa por categoria
   - Gera HTML do email com template Intentus
   - Envia via Resend API
   - Respeita `notification_preferences.email_enabled` e `frequency`

3. **Template do email:**
   - Header com logo Intentus
   - Seções por categoria (Vencimentos, Alertas, IA)
   - Cada notificação com link direto para o contrato
   - Footer com link para configurar preferências

### Etapa 5: Notificações Inteligentes com IA (futuro, 6h)

Nível avançado — a IA analisa padrões e gera alertas proativos:

1. **"O mercado subiu"** — Quando pricing-ai detecta que o valor do contrato está muito abaixo do mercado
2. **"Padrão de inadimplência"** — Quando o locatário tem 3+ atrasos consecutivos
3. **"Oportunidade de renovação"** — Contrato a 60 dias do vencimento + mercado favorável
4. **"Risco jurídico"** — Quando `clm-ai-insights` detecta cláusula problemática
5. **"Resumo semanal do portfólio"** — IA gera resumo executivo com KPIs + tendências

## Prioridade e Cronograma

| Etapa | Esforço | Impacto | Prioridade |
|-------|---------|---------|------------|
| 1. Triggers automáticos | 3h | Alto — notificações essenciais | **P0** |
| 3. Chamadas no frontend | 2h | Alto — feedback imediato | **P0** |
| 2. IA para mensagens | 4h | Médio — diferencial de UX | **P1** |
| 4. Email digest | 4h | Alto — engajamento | **P1** |
| 5. IA inteligente proativa | 6h | Alto — diferencial competitivo | **P2** |

**Total: ~19h de desenvolvimento**

**Recomendação:** Etapas 1 e 3 para o lançamento (5h), Etapas 2 e 4 no primeiro mês pós-lançamento (8h), Etapa 5 no roadmap de Q2.

## Métricas de Sucesso

- **Notification open rate:** % de notificações in-app que são clicadas
- **Email open rate:** % de emails digest abertos
- **Time to action:** Tempo entre notificação e ação do usuário
- **Churn de notificações:** % de usuários que desabilitam categorias
- **Engagement lift:** Aumento de DAU/MAU após ativar notificações automáticas

---

*Documento gerado automaticamente — Sessão de 08/03/2026*
