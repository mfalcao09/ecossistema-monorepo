# CLM Fase 2 — Instruções de Ativação

## O que foi criado

### Novos arquivos (já no repositório):

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useContractKPIs.ts` | Hook que agrega KPIs de contratos com filtros |
| `src/components/contracts/CommandCenterKPIs.tsx` | Barra de 6 KPIs visuais |
| `src/components/contracts/CommandCenterFilters.tsx` | Filtros globais (tipo, status, período) |
| `src/components/contracts/ContractPipelineChart.tsx` | Gráfico de barras — pipeline por status |
| `src/pages/ClmDashboardV2.tsx` | Nova página que integra tudo |

---

## Como ativar (2 alterações em `src/App.tsx`)

### Passo 1 — Alterar o import (linha ~17)

**DE:**
```tsx
import ClmCommandCenter from "@/pages/ClmCommandCenter";
```

**PARA:**
```tsx
import ClmDashboardV2 from "@/pages/ClmDashboardV2";
```

### Passo 2 — Alterar a rota (linha ~153)

**DE:**
```tsx
<Route path="/contratos/command-center" element={<ClmCommandCenter />} />
```

**PARA:**
```tsx
<Route path="/contratos/command-center" element={<ClmDashboardV2 />} />
```

### (Opcional) Manter rota legada

Se quiser manter acesso ao dashboard original enquanto testa o novo:

```tsx
import ClmCommandCenter from "@/pages/ClmCommandCenter";
import ClmDashboardV2 from "@/pages/ClmDashboardV2";

// Na seção de rotas:
<Route path="/contratos/command-center" element={<ClmDashboardV2 />} />
<Route path="/contratos/command-center-legado" element={<ClmCommandCenter />} />
```

---

## Resultado esperado

Ao acessar `/contratos/command-center` você verá:

1. **Header** — "CLM Command Center" com botão Atualizar
2. **Barra de filtros** — Tipo de contrato, Status, período (expansível)
3. **6 KPI cards** — Total, Valor, Inadimplência, Aprovações, Vencendo 30d, Recebido
4. **Gráficos lado a lado** — Pipeline por Status (barras) + Distribuição por Tipo (pizza)
5. **Dashboard Operacional** — Todo o conteúdo original abaixo (lifecycle stepper, alertas, aprovações, feed)

---

## Seed data disponível para teste

O banco já possui dados de demonstração:
- 10 propriedades
- 15 contratos (distribuídos em 8 status diferentes)
- 34 parcelas (mix de pago/atrasado/pendente)
- 7 templates de contrato
- 3 regras de aprovação
- 15 eventos de lifecycle (auto-gerados por triggers)
