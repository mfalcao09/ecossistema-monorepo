# CLM Fase 2 — Épico 4: Gestão de Cobrança e Inadimplência

## Resumo

O Épico 4 implementa um módulo completo de gestão de cobrança:

- **Dashboard de Inadimplência**: KPIs (total a receber, inadimplente, taxa, atraso médio), gráfico de aging buckets, ranking de contratos
- **Gerenciador de Parcelas**: lista de parcelas vencidas com ações de registro de pagamento, marcação de atraso e observações
- **Página Dedicada**: `/contratos/cobranca` combinando dashboard + gerenciador

---

## Arquivos Criados

### Hooks
| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useDelinquencyMetrics.ts` | KPIs, aging buckets, ranking de contratos, lista de parcelas vencidas |
| `src/hooks/useInstallmentActions.ts` | Registrar pagamento, alterar status, notas, batch "marcar todos atrasados" |

### Componentes
| Arquivo | Descrição |
|---------|-----------|
| `src/components/contracts/DelinquencyDashboard.tsx` | 4 KPI cards + gráfico aging + ranking de contratos inadimplentes |
| `src/components/contracts/InstallmentManager.tsx` | Lista de parcelas vencidas com dialog de pagamento e ações rápidas |

### Páginas
| Arquivo | Rota | Descrição |
|---------|------|-----------|
| `src/pages/ClmCobranca.tsx` | `/contratos/cobranca` | Página dedicada de cobrança |

---

## Ação Manual Necessária — App.tsx

Adicionar no App.tsx:

```tsx
// 1. Import (no topo do arquivo)
import ClmCobranca from "@/pages/ClmCobranca";

// 2. Rota (dentro do <Routes>, junto das rotas de contratos)
<Route path="/contratos/cobranca" element={<ClmCobranca />} />
```

---

## Funcionalidades

### Dashboard (DelinquencyDashboard)
- **4 KPI Cards**: Total a Receber, Total Inadimplente (vermelho), Taxa de Inadimplência %, Atraso Médio em dias
- **Gráfico Aging**: barras horizontais coloridas por faixa (1-30d amarelo, 31-60d laranja, 61-90d vermelho, 90+d vermelho escuro)
- **Ranking Contratos**: top contratos por valor inadimplente, com badge de tipo, qtd parcelas e dias de atraso
- **Botão "Atualizar Status"**: marca automaticamente como "atrasado" todas as parcelas pendentes com vencimento passado

### Gerenciador de Parcelas (InstallmentManager)
- Lista todas as parcelas vencidas com badges de status e dias de atraso
- **Registrar Pagamento**: dialog com valor pago, data, método (PIX, boleto, transferência, etc.), nº do comprovante, observações
- **Marcar como Atrasado**: botão rápido para parcelas ainda em status "pendente"
- Pode ser filtrado por contrato via prop `contractId`

### Hooks de Ações (useInstallmentActions)
- `useRegisterPayment()`: registra pagamento com todos os campos
- `useUpdateInstallmentStatus()`: altera status (pendente/pago/atrasado/cancelado)
- `useUpdateInstallmentNotes()`: atualiza observações
- `useMarkAllOverdue()`: batch para marcar todas as pendentes vencidas como atrasadas
- **9 métodos de pagamento**: PIX, Boleto, Transferência, Cartão Crédito, Cartão Débito, Cheque, Dinheiro, Depósito, Outro

---

## Dados Existentes

O seed data da Fase 1 já possui 34 parcelas:
- 24 pagas (R$ 296.000)
- 7 pendentes (R$ 156.300) — 4 com vencimento passado
- 3 atrasadas (R$ 36.300)

**Total inadimplente real: 7 parcelas, ~R$ 102.600**

---

## Commit Summary

```
feat(clm): add delinquency dashboard and installment manager (Épico 4)

- useDelinquencyMetrics: KPIs, aging buckets, overdue contracts ranking
- useInstallmentActions: payment registration, status update, batch overdue
- DelinquencyDashboard: 4 KPI cards, aging chart, contracts ranking
- InstallmentManager: overdue installments list with payment dialog
- ClmCobranca page: /contratos/cobranca dedicated route

Épico 4 — CLM Fase 2
```
