# CLM Fase 1 — Relatório de Implementação

**Plataforma:** Intentus Real Estate
**Data:** 6 de março de 2026
**Escopo:** Conectar o frontend existente ao backend CLM construído nas sessões anteriores
**Princípio:** "Não redesenha nada — apenas destrava o que foi construído"

---

## Resumo Executivo

A Fase 1 conectou o frontend React à infraestrutura de backend CLM (37 tabelas, 13 funções, 7 triggers). Foram criados **5 novos arquivos** e **3 arquivos modificados**, sem alterar o design existente.

---

## Arquivos Criados (5)

### 1. `src/hooks/useContractAlerts.ts` (3.965 bytes)
**Função:** Consumir as funções Postgres de alertas em tempo real.

**Hooks exportados:**
- `useContractsNearExpiry()` → chama `supabase.rpc("fn_get_contracts_near_expiry")` com refetch a cada 5 min
- `useOverdueInstallmentsForCollection()` → chama `supabase.rpc("fn_get_overdue_installments_for_collection")` com refetch a cada 5 min
- `useAlertCounts()` → hook combinado que retorna contadores (critical, urgent, attention, planning, totalExpiring, overduePayments, totalAlerts)

**Tipos definidos:**
- `ContractExpiryAlert` (contract_id, contract_title, contract_type, status, end_date, days_until_expiry, alert_level, monthly_value, total_value, has_active_renewal)
- `OverdueInstallmentForCollection` (installment_id, contract_id, contract_title, contract_type, due_date, amount, days_overdue, rule_id, rule_name, action_type, message_template)

---

### 2. `src/hooks/useContractLifecycleEvents.ts` (2.469 bytes)
**Função:** Consultar a tabela `contract_lifecycle_events` para timeline e feed de atividades.

**Hooks exportados:**
- `useContractLifecycleEvents(contractId)` → eventos de um contrato específico (para aba de detalhe)
- `useRecentLifecycleEvents(limit=20)` → eventos recentes com JOIN em contracts(title) (para feed na Central de Comando)

**Tipo definido:**
- `ContractLifecycleEvent` (id, contract_id, from_status, to_status, changed_by, reason, metadata, created_at)

---

### 3. `src/hooks/useContractSignatureEnvelopes.ts` (3.350 bytes)
**Função:** Consultar a tabela `contract_signature_envelopes` para gestão de assinaturas.

**Hooks exportados:**
- `useContractSignatureEnvelopes(contractId)` → envelopes de um contrato específico
- `usePendingSignatureCount()` → contador de envelopes pendentes (status: criado/enviado/visualizado/assinado_parcial)
- `useSendSignatureReminder()` → mutation placeholder para futura integração Clicksign

**Tipo definido:**
- `SignatureEnvelope` (id, contract_id, status [7 valores], provider [4 provedores], external_id/url, document_url, signed_document_url, signatories JSONB, sent_at, completed_at, expires_at, reminder_count, created_at)

---

### 4. `src/components/contracts/tabs/ContractLifecycleTab.tsx` (5.909 bytes)
**Função:** Visualização em timeline dos eventos do ciclo de vida do contrato.

**Características:**
- Timeline vertical com círculos coloridos por status
- Setas mostrando transições (from_status → to_status)
- Badges com cores e ícones por status usando `CONTRACT_STATUS_COLORS` e `CONTRACT_STATUS_LABELS`
- Tempo relativo com `formatDistanceToNow` (ex: "há 2 horas")
- Exibe quem fez a alteração (`changed_by`) e motivo em caixa muted
- Empty state com mensagem explicativa sobre criação automática de eventos

---

### 5. `src/components/contracts/tabs/ContractSignaturesTab.tsx` (9.143 bytes)
**Função:** Aba de gestão de envelopes de assinatura digital no detalhe do contrato.

**Características:**
- `ENVELOPE_STATUS_CONFIG` com 7 configurações de status (label, cor, ícone)
- `PROVIDER_LABELS` para 4 provedores (clicksign, docusign, d4sign, manual)
- Badge de status e provedor
- Alerta visual para envelopes próximos de expirar
- Grid de datas (envio, conclusão, expiração)
- Lista de signatários com pills signed/pending
- Ações: abrir no provedor, baixar documento assinado, enviar lembrete
- Empty state com explicação do fluxo automático

---

## Arquivos Modificados (3)

### 6. `src/pages/ClmCommandCenter.tsx` (27.094 bytes)
**Modificações:**

**Novos imports adicionados:**
- Hooks: `useContractsNearExpiry`, `useOverdueInstallmentsForCollection`, `useRecentLifecycleEvents`, `usePendingSignatureCount`, `useUnreadCount`
- Libs: `formatDistanceToNow`, `format`, `ptBR` (date-fns)
- Ícones: `ArrowRight`, `DollarSign` (lucide-react)

**Componente `RealTimeAlerts` (novo):**
- 4 cards de alerta: Vencimento Crítico (≤15d), Vencimento Urgente (≤30d), Pagamentos Atrasados, Assinaturas Pendentes
- Animação de pulso em alertas críticos
- Lista detalhada de contratos em situação crítica com data de vencimento e valor

**Componente `ActivityFeed` (novo):**
- Exibe os 10 eventos mais recentes do ciclo de vida
- Ícones por status, título do contrato, label de tempo relativo
- Lista scrollable com scroll personalizado

**Atualização do componente principal:**
- `handleRefreshAll` agora invalida 5 query keys (dashboard, approvals, obligations, expiry-alerts, overdue-installments)
- `RealTimeAlerts` posicionado no topo do dashboard
- `ActivityFeed` ao lado das aprovações pendentes no sidebar

---

### 7. `src/components/contracts/ContractDetailDialog.tsx` (10.795 bytes)
**Modificações:**

- Novos imports: `Activity`, `Pen` do lucide-react
- Lazy imports: `ContractLifecycleTab`, `ContractSignaturesTab`
- 2 novos `TabsTrigger`: "Ciclo de Vida" (ícone Activity) e "Assinaturas" (ícone Pen)
- 2 novos `TabsContent` com `Suspense` wrapper para cada aba
- Posicionados logo após a aba "Resumo" para visibilidade

---

### 8. `src/components/NotificationBell.tsx` (4.478 bytes)
**Modificações:**

- 6 novas categorias CLM com cores dark mode:
  - `assinatura` (purple)
  - `aprovacao` (indigo)
  - `renovacao` (cyan)
  - `encerramento` (zinc)
  - `obrigacao` (orange)
  - `lifecycle` (teal)
- Variantes dark mode adicionadas a todas as categorias existentes

---

## Mapa de Conexão Backend → Frontend

| Backend (Postgres) | Frontend (React Hook) | Usado em |
|---|---|---|
| `fn_get_contracts_near_expiry()` | `useContractsNearExpiry()` | ClmCommandCenter → RealTimeAlerts |
| `fn_get_overdue_installments_for_collection()` | `useOverdueInstallmentsForCollection()` | ClmCommandCenter → RealTimeAlerts |
| `contract_lifecycle_events` table | `useContractLifecycleEvents()` | ContractLifecycleTab |
| `contract_lifecycle_events` table | `useRecentLifecycleEvents()` | ClmCommandCenter → ActivityFeed |
| `contract_signature_envelopes` table | `useContractSignatureEnvelopes()` | ContractSignaturesTab |
| `contract_signature_envelopes` table | `usePendingSignatureCount()` | ClmCommandCenter → RealTimeAlerts |
| `notifications` table (realtime) | `useNotifications()` (já existia) | NotificationBell (categorias ampliadas) |

---

## Próximos Passos

### Para Deploy (AGORA)
1. No VS Code/terminal local, executar:
   ```bash
   cd intentus-plataform
   git add -A
   git commit -m "feat(clm): Fase 1 - conectar frontend aos hooks CLM backend"
   git push origin main
   ```
2. O Vercel fará o build automaticamente
3. Verificar em `app.intentusrealestate.com.br`

### Bug Pendente
- `fn_contract_status_automations()` handler de cancelado pode usar `'cancelada'` em vez de `'cancelado'` para installment_status (enum usa masculino)

### Seed de Dados
- Executar Edge Function `clm-seed-tenant` para popular `legal_contract_templates` com dados iniciais

### Fase 2 (Futuro — 3 semanas)
- Redesign da Central de Comando
- Novos layouts e componentes visuais

### Fase 3 (Futuro — 4 semanas)
- Timeline completa + ações contextuais
- Integração real com Clicksign
