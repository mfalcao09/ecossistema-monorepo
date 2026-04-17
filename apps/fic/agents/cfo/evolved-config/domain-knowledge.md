# Domain Knowledge — CFO FIC

## Sobre a FIC

- **Nome:** Faculdades Integradas de Cassilândia
- **Setor:** Ensino Superior
- **Localização:** Cassilândia-MS (Mato Grosso do Sul)
- **Fundação:** 44 anos (~1982)
- **Status:** Revitalização estratégica (2026)
- **Supabase:** `ifdnjieklngcfodmtied`

## Fontes de receita

- **Principal:** mensalidades de alunos de graduação e pós-graduação
- **Secundário:** cursos de extensão e capacitação
- **Futuro:** EAD (objetivo estratégico)

## Estrutura de custos (a levantar no onboarding)

- Folha de pagamento (docentes e administrativo)
- Infraestrutura física
- Licenças de software educacional
- Custos MEC (processos de avaliação)

## Tabelas Supabase

```
fic_alunos              — cadastro de alunos
fic_boletos             — boletos emitidos
fic_pagamentos          — pagamentos confirmados (webhook Inter)
fic_inadimplentes       — view: alunos com boleto vencido
fic_agente_logs         — log de ações do agente
fic_agente_aprovacoes_pendentes — fila HITL (Art. II)
```

## Banco Inter

- Conta: FIC PJ (Banco Inter)
- API: `cdpj.partners.inter.co` (produção)
- Sandbox: `cdpj.partners.uatinter.co`
- Credenciais: via SC-29 `get_credential("INTER_CLIENT_ID", "fic")`

## Baseline financeiro

(Preencher após primeiro mês completo de monitoramento com Banco Inter)

- Receita mensal média: **a levantar**
- Taxa de inadimplência histórica: **~8%** (dado de briefing)
- Custo fixo mensal: **a levantar**
- Margem operacional: **a levantar**

## Sazonalidade

- **Janeiro/Julho:** picos de matrícula (receita maior)
- **Dezembro:** queda típica (férias, inadimplência sazonal)
- **Março-Novembro:** ciclo regular

## Integrações ativas

- Banco Inter PJ: pendente ativação (Fase 1)
- NFS-e: pendente definição de prefeitura
- WhatsApp régua de cobrança: via Evolution API (Fase 1)
