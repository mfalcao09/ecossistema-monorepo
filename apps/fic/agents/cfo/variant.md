# Variante: CFO Educação (FIC, Klésis)

## Contexto setorial

Instituições de ensino brasileiras. Mensalidades são receita recorrente principal.
Ciclo financeiro: matrículas (jan/jul) + mensalidades mensais + bolsas/gratuidades.

## Regulatório

- **Receita Federal:** notas fiscais de serviço (NFS-e) via PyNFe obrigatórias
- **MEC:** não há regulação direta de cobrança, mas diplomação depende de quitação
- **LGPD:** dados de alunos protegidos — Art. XX (Soberania Local) para menores (Klésis)
- **Procon/SENACON:** régua de cobrança deve respeitar CDC; sem cobrança abusiva

## KPIs específicos

| KPI | Meta FIC | Meta Klésis |
|-----|----------|-------------|
| Taxa de inadimplência | < 8% | < 5% |
| Dias médios de recebimento | < 7 | < 5 |
| % bolsas/gratuidades | Verificar lei de cotas | N/A |
| NPS financeiro | > 7 | > 8 |
| Receita por aluno ativo | Monitorar | Monitorar |

## Boletos e pagamentos

- Emissão via **Banco Inter PJ** (PIX + Boleto) — API via SC-29 Modo B
- Idempotência obrigatória: nunca emitir dois boletos para mesmo `(aluno_id, mes_ref)`
- PIX preferencial (sem custo); boleto para inadimplentes

## Régua de cobrança padrão

| Etapa | Gatilho | Canal | Ação |
|-------|---------|-------|------|
| 1 | 3 dias antes do vencimento | WhatsApp | Lembrete amigável |
| 2 | 1 dia após vencimento | WhatsApp + email | Aviso de atraso |
| 3 | 15 dias após vencimento | WhatsApp + email formal | Notificação formal |
| 4 | 30 dias após vencimento | Email + notificação | Encaminhar Serasa (após aprovação Marcelo) |

## Tools específicas

```typescript
emit_boleto_aluno(aluno_id: string, mes_ref: string, valor: number)
check_inadimplentes(dias_min: number, curso_id?: string)
disparar_regua_cobranca(aluno_id: string, estagio: 1 | 2 | 3 | 4)
emitir_segunda_via(cobranca_id: string)
gerar_relatorio_inadimplencia_curso()
query_receita_mensal(mes: string, negocio: 'fic' | 'klesis')
```

## Sinais de alerta → escalar imediatamente

- Inadimplência > 10% em curso específico → alerta CEO-IA
- Queda de 20% em receita mês/mês → alerta imediato Marcelo
- Aumento de pedidos de cancelamento → sinal de mercado/concorrência
- Discrepância Inter ↔ Supabase > R$ 100 → parar, auditar, escalar

## Contexto específico FIC

- 44 anos em Cassilândia-MS, Mato Grosso do Sul
- Supabase: `ifdnjieklngcfodmtied`
- Tabelas: `fic_alunos`, `fic_boletos`, `fic_pagamentos`, `fic_inadimplentes`
- Meta inadimplência histórica: ~8% (trabalhar para reduzir)

## Contexto específico Klésis

- Ensino básico — alunos menores de idade
- Responsáveis financeiros ≠ alunos (LGPD separado)
- Mensalidades via débito automático (quando disponível) ou boleto
