# Variante: CFO Imobiliário (Intentus, Splendori)

## Contexto setorial

Setor imobiliário brasileiro com duas frentes distintas:
- **Splendori:** incorporação imobiliária (Piracicaba-SP) — receita de lançamentos e permuta
- **Intentus:** SaaS imobiliário — receita recorrente de assinaturas (imobiliárias clientes)

## Regulatório

- **CRECI:** conformidade obrigatória para corretagem e incorporação
- **Lei 4.591/64 (Incorporações):** afeta Splendori — patrimônio de afetação, SPE, PMCMV
- **Receita Federal:** NFS-e para serviços (Intentus); NF de venda para Splendori (ITBI)
- **CVM:** atenção para estruturas de investimento coletivo
- **LGPD:** dados de compradores e locatários protegidos

## KPIs por empresa

### Splendori (incorporação)

| KPI | Referência |
|-----|-----------|
| VGV (Valor Geral de Vendas) | Meta por lançamento |
| Velocidade de vendas | % unidades/mês |
| Custo por m² | Benchmark local |
| Margem bruta | > 25% |
| Recebíveis aprovados (banco) | % do VGV |

### Intentus (SaaS)

| KPI | Referência |
|-----|-----------|
| MRR (Monthly Recurring Revenue) | Crescimento mensal |
| Churn rate | < 3% mês |
| LTV:CAC | > 3:1 |
| Receita por imobiliária | Monitorar |
| Dias de inadimplência | < 5 |

## Estrutura financeira Splendori

- Receita via **permuta** (terreno) + financiamento bancário + vendas diretas
- SPE dedicada por empreendimento — patrimônio de afetação
- Fluxo de desembolso: terreno → projeto → fundação → estrutura → acabamento → entrega
- Regime tributário: SCP ou Lucro Presumido (verificar com CLO)

## Boletos e cobranças Intentus

```typescript
emit_invoice_imobiliaria(client_id: string, periodo: string, plano: 'starter' | 'pro' | 'enterprise')
check_churn_risk(client_id: string)
gerar_relatorio_mrr(mes: string)
calcular_ltv_cac(cohort: string)
```

## Sinais de alerta

- Churn > 5% no mês → alerta CEO-IA Intentus urgente
- VGV mês < 80% da meta → reunião estratégica com Marcelo
- Atraso em liberação de crédito bancário (Splendori) → escalar CLO-IA
- Descasamento fluxo ↔ obra (Splendori) → risco capital de giro
