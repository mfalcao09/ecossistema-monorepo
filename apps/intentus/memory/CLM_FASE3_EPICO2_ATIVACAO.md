# CLM Fase 3 — Épico 2: Relatórios e Exportação

## Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useContractReports.ts` | Hook completo com filtros, aggregações e helpers |
| `src/components/contracts/ReportsPanel.tsx` | Painel com gráficos, KPIs, PDF e Excel |

## Dependências Necessárias

```bash
npm install jspdf jspdf-autotable xlsx
```

Ou, se já tiver instaladas, verifique:
```bash
npm list jspdf jspdf-autotable xlsx
```

> **Nota:** `recharts` já está instalado no projeto (usado no dashboard).

## Como Ativar

### Passo 1: Adicionar tab "Relatórios" ao ClmDashboardV2 ou ClmSettings

No arquivo onde você quer exibir os relatórios (sugestão: nova aba no dashboard ou nas configurações), adicione:

```tsx
import ReportsPanel from "@/components/contracts/ReportsPanel";
```

E use o componente:

```tsx
<TabsContent value="relatorios">
  <ReportsPanel />
</TabsContent>
```

Não esqueça de adicionar o trigger na lista de tabs:

```tsx
<TabsTrigger value="relatorios" className="gap-1">
  <BarChart3 className="h-4 w-4" />
  Relatórios
</TabsTrigger>
```

### Passo 2: Importar ícone

```tsx
import { BarChart3 } from "lucide-react";
```

## Funcionalidades

### Filtros
- **Período**: 7 dias, 30 dias, 90 dias, 12 meses, ano atual, todo período, personalizado
- **Tipo de contrato**: Todos os 12 tipos (venda, locação, etc.)
- **Status**: Todos os 8 status (rascunho, ativo, etc.)
- **Datas personalizadas**: Campos de/até quando período = "Personalizado"

### KPI Cards
- Total de Contratos
- Valor Total (R$)
- Taxa de Recebimento (%)
- Valor em Atraso (R$)

### Gráficos (recharts)
- **Pizza**: Contratos por Status (com cores por status)
- **Barras horizontais**: Contratos por Tipo
- **Linhas + Barras**: Tendência Mensal (novos vs encerrados + valor)

### Painéis
- **Parcelas**: Pagas / Pendentes / Atrasadas com valores
- **Top 10 Contratos**: Ranking por valor com badges de tipo e status

### Exportação
- **PDF** (jsPDF + jspdf-autotable): Relatório completo com header Intentus, tabelas formatadas, paginação
- **Excel** (SheetJS/xlsx): 5 abas (Resumo, Por Status, Por Tipo, Tendência, Top Contratos)

## Tabelas Utilizadas
- `contracts` — dados base dos contratos
- `contract_installments` — parcelas para cálculos financeiros

## Commit Sugerido

```
feat(clm): add reports panel with PDF and Excel export (Phase 3 Epic 2)

- Create useContractReports hook with filters, aggregation and helpers
- Create ReportsPanel with interactive charts (pie, bar, line)
- Add PDF export via jsPDF with branded header and tables
- Add Excel export via SheetJS with 5 worksheets
- Support 7 period presets + custom date range
- Show KPIs, installment summary, and top 10 contracts
```
