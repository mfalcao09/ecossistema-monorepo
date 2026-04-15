# CLM Fase 2 — Épico 2: Ativação

## Resumo

O Épico 2 implementa o sistema completo de **Regras de Aprovação e Workflow** do CLM:

- CRUD de regras de aprovação (admin)
- Workflow de aprovação/rejeição por contrato
- Widget de aprovações pendentes para o dashboard
- Página de Configurações CLM

---

## Arquivos Criados

### Hooks
| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useContractApprovalRules.ts` | CRUD de regras de aprovação + busca de regra aplicável |
| `src/hooks/useApprovalWorkflow.ts` | Workflow de aprovação: listar steps, aprovar, rejeitar, iniciar workflow, pendências do usuário |

### Componentes
| Arquivo | Descrição |
|---------|-----------|
| `src/components/contracts/ApprovalRulesManager.tsx` | Interface admin para gerenciar regras de aprovação |
| `src/components/contracts/ApprovalWorkflowPanel.tsx` | Painel de aprovação/rejeição dentro do detalhe do contrato |
| `src/components/contracts/PendingApprovalsWidget.tsx` | Widget de aprovações pendentes para dashboards |

### Páginas
| Arquivo | Descrição |
|---------|-----------|
| `src/pages/ClmSettings.tsx` | Página de configurações do CLM (hospeda ApprovalRulesManager) |

---

## Alterações Necessárias no App.tsx

### 1. Adicionar import da página ClmSettings

Abra `src/App.tsx` e adicione o import (junto com os outros imports de páginas):

```tsx
import ClmSettings from "@/pages/ClmSettings";
```

### 2. Adicionar rota para ClmSettings

Dentro do `<Route element={<AppLayout />}>` (por volta da linha 143), adicione:

```tsx
<Route path="/contratos/configuracoes" element={<ClmSettings />} />
```

Pode colocar logo abaixo da rota do command-center.

---

## Integração do PendingApprovalsWidget no Dashboard

Para adicionar o widget de aprovações pendentes no ClmDashboardV2, adicione o import e insira o componente onde desejar:

```tsx
import PendingApprovalsWidget from "@/components/contracts/PendingApprovalsWidget";

// Dentro do JSX, por exemplo após os KPIs:
<PendingApprovalsWidget />
```

---

## Integração do ApprovalWorkflowPanel no Detalhe do Contrato

Para usar o painel de aprovação dentro de uma página de detalhe de contrato:

```tsx
import ApprovalWorkflowPanel from "@/components/contracts/ApprovalWorkflowPanel";

// Dentro do JSX:
<ApprovalWorkflowPanel
  contractId={contract.id}
  contractType={contract.contract_type}
  contractStatus={contract.status}
  totalValue={contract.total_value}
/>
```

O painel mostra:
- Timeline dos steps de aprovação
- Regra aplicável ao contrato
- Botões de aprovar/rejeitar (apenas para o step atual do usuário logado)
- Botão "Iniciar Workflow" quando aplicável

---

## Dados Seed Criados

### Regras de Aprovação (contract_approval_rules)
| Regra | Faixa de Valor | Prioridade |
|-------|---------------|------------|
| Aprovação Simples | R$ 0 – R$ 50.000 | 1 |
| Aprovação Intermediária | R$ 50.000 – R$ 500.000 | 2 |
| Aprovação Completa | R$ 500.000+ | 3 |

### Aprovações em Andamento (contract_approvals)
- **Venda Apt 401 – Torre Norte (R$ 720.000)**: Step 1 aprovado, Steps 2 e 3 pendentes
- **Venda Terreno Industrial Lote 15 (R$ 1.200.000)**: Todos os 3 steps pendentes

---

## Fluxo de Aprovação

```
rascunho/em_revisao
    │
    ▼ [Iniciar Workflow]
em_aprovacao
    │
    ├─ Step 1: Aprovador decide ──┐
    │                              │
    ├─ Step 2: Aprovador decide ──┤
    │                              │
    ├─ Step N: Aprovador decide ──┘
    │
    ├── Todos aprovaram? ──► aguardando_assinatura
    │
    └── Algum rejeitou? ──► em_revisao (comentário obrigatório)
```

---

## Commit Summary

```
feat(clm): add approval rules CRUD and workflow engine (Épico 2)

- useContractApprovalRules: CRUD hook with findApplicableRule matching
- useApprovalWorkflow: approve/reject/start workflow with auto-advance
- ApprovalRulesManager: admin UI for managing approval rules
- ApprovalWorkflowPanel: contract-level approval timeline + actions
- PendingApprovalsWidget: dashboard widget for pending approvals
- ClmSettings: settings page hosting approval rules manager
- Seed data: 6 approval records for 2 contracts in em_aprovacao

Épico 2 — CLM Fase 2
```
