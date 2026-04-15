# Plano de Melhorias UI/UX — Módulo CLM

**Data**: 10/03/2026 — Sessão 28
**Solicitante**: Marcelo
**Escopo**: Corrigir funcionalidades desconectadas, propor localização para Configurações, criar Central de Aprovações

---

## Diagnóstico Geral

A auditoria completa do módulo CLM identificou **3 categorias de problemas**:

1. **2 rotas órfãs** — existem no código mas não aparecem na sidebar
2. **4 componentes órfãos** — existem no código mas nunca são importados/renderizados
3. **1 widget incompleto** — PendingApprovalsWidget mostra dados mas itens não são clicáveis

---

## Problema 1: CLM Settings sem acesso pela sidebar

### Situação atual
- **Rota** `/contratos/configuracoes` existe em `App.tsx` (linha 156) → renderiza `ClmSettings.tsx`
- **Página** `ClmSettings.tsx` só tem `ApprovalRulesManager` + placeholder "mais configurações em breve"
- **Dialog** `CLMSettingsDialog.tsx` existe em `Contracts.tsx` com **7 abas completas** (Campos, Aprovação, Renovação, Cláusulas, Documentos, Obrigações, Auditoria)
- **Nenhum** dos dois está na sidebar `AppSidebar.tsx`
- O dialog é acessível via botão "Configurações CLM" dentro da página `/contratos` — mas pouco descobrível

### Proposta: Adicionar "Configurações" como último item da seção CLM na sidebar

**Opção A (Recomendada)** — Promover a página `/contratos/configuracoes` e migrar o conteúdo completo do Dialog para ela:
- Adicionar entrada na sidebar: `{ title: "Configurações", url: "/contratos/configuracoes", icon: Settings, module: "contratos" }`
- Expandir `ClmSettings.tsx` para incluir as 7 abas que hoje estão no `CLMSettingsDialog`
- Manter o dialog como atalho rápido dentro de `/contratos` (opcional — pode remover)
- **Prós**: Página dedicada é mais profissional, permite URL compartilhável, mais espaço para configurações futuras
- **Contras**: Duplicação temporária até migrar tudo
- **Estimativa**: ~3h

**Opção B** — Apenas adicionar link na sidebar que abre o dialog existente:
- Sidebar item navega para `/contratos` e auto-abre o dialog via query param ou state
- **Prós**: Zero código novo, usa o dialog completo que já funciona
- **Contras**: Dialog não é ideal para configurações complexas (espaço limitado), não tem URL própria
- **Estimativa**: ~1h

**Opção C** — Híbrida: Sidebar leva para a página, página redireciona para tabs internas:
- `/contratos/configuracoes` vira hub com 3 seções: Regras de Aprovação, Configurações de Campos, Preferências
- Cada seção é um componente já existente (extraído do dialog)
- **Estimativa**: ~4h

---

## Problema 2: Aprovações pendentes não clicáveis / sem Central de Aprovações

### Situação atual
- `PendingApprovalsWidget` (no Command Center) lista aprovações pendentes com dados corretos
- Os itens mostram `ChevronRight` (seta) mas **NÃO têm onClick** — são puramente informativos
- Não existe uma "Central de Aprovações" como página dedicada
- Para aprovar/rejeitar, o usuário precisa: abrir o contrato → aba "Aprovações" → ApprovalWorkflowPanel
- `ApprovalRulesManager` (configuração de regras) está escondido em ClmSettings.tsx (que não está na sidebar)

### Proposta: Criar Central de Aprovações

**Nova página** `/contratos/aprovacoes` — "Central de Aprovações"

**Layout proposto:**

```
┌─────────────────────────────────────────────────────┐
│  ← Central de Aprovações                    ⚙️      │
│  Gerencie aprovações pendentes e regras             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─── KPI Cards ──────────────────────────────┐    │
│  │ 🟡 Pendentes: 5  │ 🔴 Atrasadas: 2  │     │    │
│  │ ✅ Aprovadas (mês): 12  │ ❌ Rejeitadas: 1│    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌─── Tabs ───────────────────────────────────┐    │
│  │ [Minhas Pendentes] [Histórico] [Regras]    │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ── Tab: Minhas Pendentes ──────────────────────    │
│  ┌──────────────────────────────────────────────┐  │
│  │ 📄 Contrato Locação Apt 302 - Vila Pires    │  │
│  │    Step: Aprovação Jurídica │ Prazo: 2 dias  │  │
│  │    R$ 2.500/mês │ Tipo: Locação              │  │
│  │    [👁️ Ver Contrato] [✅ Aprovar] [❌ Rejeitar]│  │
│  ├──────────────────────────────────────────────┤  │
│  │ 📄 Contrato Venda Lote 15 - Splendori       │  │
│  │    Step: Aprovação Diretoria │ ATRASADO 3d   │  │
│  │    R$ 450.000 │ Tipo: Venda                  │  │
│  │    [👁️ Ver Contrato] [✅ Aprovar] [❌ Rejeitar]│  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ── Tab: Regras ────────────────────────────────    │
│  (Renderiza ApprovalRulesManager aqui)              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Funcionalidades:**
1. **Tab "Minhas Pendentes"**: Lista expandida com ações inline (aprovar/rejeitar com dialog de comentário)
2. **Tab "Histórico"**: Aprovações já decididas (aprovado/rejeitado/delegado) com filtros de data
3. **Tab "Regras"**: `ApprovalRulesManager` embutido (hoje escondido em ClmSettings)
4. **KPI cards**: Contadores de pendentes, atrasadas, aprovadas no mês, rejeitadas
5. **Cada item é clicável**: Botão "Ver Contrato" navega para `ContractDetailDialog` na aba de aprovações

**Sidebar**: Adicionar `{ title: "Central de Aprovações", url: "/contratos/aprovacoes", icon: Shield, module: "contratos" }`

**PendingApprovalsWidget no Command Center**: Tornar itens clicáveis → navega para Central de Aprovações

**Estimativa**: ~6-8h

---

## Problema 3: Página de Cobrança & Inadimplência desconectada

### Situação atual
- **Rota** `/contratos/cobranca` existe em `App.tsx` (linha 157) → renderiza `ClmCobranca.tsx`
- `ClmCobranca.tsx` combina `DelinquencyDashboard` + `InstallmentManager`
- **Nenhuma** entrada na sidebar — inacessível pelo usuário
- Esses componentes são funcionais e completos

### Proposta: Adicionar à sidebar

Adicionar entrada: `{ title: "Cobrança", url: "/contratos/cobranca", icon: DollarSign, module: "contratos" }`

**Posição sugerida**: Após "Contratos" e antes de "Rescisões" (fluxo lógico: contratos → cobrança → rescisões)

**Estimativa**: ~15 minutos (1 linha no array `gestaoContratosNav`)

---

## Problema 4: Componentes Órfãos (4 componentes)

### 4.1 — `AIInsightsPanel.tsx`
- **O que faz**: Painel de insights gerados por IA sobre o portfólio de contratos
- **Status**: Componente existe, nunca é importado
- **Proposta**: Integrar como seção no Command Center (`ClmDashboardV2.tsx`) ou no Dashboard Analytics (`ContractAnalytics.tsx`)
- **Estimativa**: ~2h

### 4.2 — `ReportsPanel.tsx`
- **O que faz**: Painel de relatórios/analytics com gráficos e métricas
- **Status**: Componente existe, nunca é importado
- **Proposta**: Avaliar se duplica funcionalidade do `ContractAnalytics.tsx`. Se sim, remover. Se não, integrar como tab adicional no Analytics ou como nova rota `/contratos/relatorios`
- **Estimativa**: ~1-2h (avaliação + decisão)

### 4.3 — `TemplatesManager.tsx`
- **O que faz**: Gerenciador de templates de contrato
- **Status**: Componente existe, nunca é importado
- **Proposta**: Avaliar se duplica a página `ContractTemplates.tsx` (rota `/contratos/minutario`). Se sim, remover. Se complementa, integrar
- **Estimativa**: ~1h (avaliação + decisão)

### 4.4 — `ContractFormCustomizationDialog.tsx`
- **O que faz**: Dialog para personalizar campos do formulário de contrato
- **Status**: Componente existe, nunca é importado
- **Proposta**: Avaliar se duplica a aba "Campos" do `CLMSettingsDialog`. Se sim, remover. Se é versão mais completa, substituir
- **Estimativa**: ~1h (avaliação + decisão)

---

## Resumo Executivo — Priorização

| # | Melhoria | Impacto | Esforço | Prioridade |
|---|----------|---------|---------|------------|
| 1 | Sidebar: adicionar Cobrança | Alto — funcionalidade completa escondida | 15 min | **P0** |
| 2 | PendingApprovalsWidget: tornar clicável | Médio — UX esperado pelo usuário | 1h | **P0** |
| 3 | Central de Aprovações (nova página) | Alto — gestão unificada de aprovações | 6-8h | **P1** |
| 4 | Sidebar: adicionar Configurações | Médio — settings mais acessíveis | 15 min | **P1** |
| 5 | Expandir ClmSettings.tsx (7 abas) | Médio — página dedicada vs dialog | 3h | **P2** |
| 6 | Avaliar 4 componentes órfãos | Baixo — limpeza de código | 2-4h | **P2** |

**Estimativa total**: ~14-18h (incluindo testes e ajustes)

**Sugestão de execução em fases:**
- **Fase 1 (rápida, ~2h)**: Itens 1, 2 e 4 — sidebar entries + widget clicável
- **Fase 2 (média, ~8h)**: Item 3 — Central de Aprovações completa
- **Fase 3 (posterior, ~6h)**: Itens 5 e 6 — expandir settings page + avaliar órfãos

---

## Arquivos que serão modificados

### Fase 1
- `src/components/AppSidebar.tsx` — adicionar 3 entries na sidebar (Cobrança, Aprovações, Configurações)
- `src/components/contracts/PendingApprovalsWidget.tsx` — adicionar onClick nos itens

### Fase 2
- `src/pages/ClmAprovacoes.tsx` — **CRIAR** (Central de Aprovações)
- `src/App.tsx` — adicionar rota `/contratos/aprovacoes`
- `src/components/contracts/PendingApprovalsWidget.tsx` — link "Ver todas" para Central

### Fase 3
- `src/pages/ClmSettings.tsx` — expandir com 7 abas do dialog
- Avaliação dos 4 componentes órfãos (decisão de integrar ou remover)
